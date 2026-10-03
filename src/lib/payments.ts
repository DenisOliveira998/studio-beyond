// Pagamentos via Mercado Pago (Checkout Pro + Preference API).
// A regra de taxa é nossa: o Mercado Pago só recebe "uma cobrança de R$ X".
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";

export type FeeMode = "descontada" | "somada" | "retida";
export const FEE_MODES: FeeMode[] = ["descontada", "somada", "retida"];

export type PaymentConfigData = { feeRate: number; feeMode: FeeMode };

const MP_API = "https://api.mercadopago.com";
export const DONATION_MIN_CENTS = 100; // R$ 1,00
export const DONATION_MAX_CENTS = 500_000; // R$ 5.000,00

/* ---------- configuração da taxa (só equipe) ---------- */

export async function getPaymentConfig(): Promise<PaymentConfigData> {
  const row = await prisma.paymentConfig.findUnique({ where: { id: "default" } }).catch(() => null);
  const mode = row?.feeMode as FeeMode | undefined;
  return {
    feeRate: row ? Number(row.feeRate) : 0.12,
    feeMode: mode && FEE_MODES.includes(mode) ? mode : "descontada",
  };
}

export async function savePaymentConfig(input: { feeRate: number; feeMode: FeeMode }): Promise<PaymentConfigData> {
  const feeRate = Math.min(0.5, Math.max(0, Math.round(input.feeRate * 10_000) / 10_000));
  const feeMode = FEE_MODES.includes(input.feeMode) ? input.feeMode : "descontada";
  await prisma.paymentConfig.upsert({
    where: { id: "default" },
    create: { id: "default", feeRate, feeMode },
    update: { feeRate, feeMode },
  });
  return { feeRate, feeMode };
}

/* ---------- divisão do valor ---------- */

export type Split = { grossCents: number; feeCents: number; authorCents: number };

/** `amountCents` é o valor que o leitor escolheu doar. */
export function splitAmount(amountCents: number, cfg: PaymentConfigData): Split {
  const fee = Math.round(amountCents * cfg.feeRate);
  if (cfg.feeMode === "somada") return { grossCents: amountCents + fee, feeCents: fee, authorCents: amountCents };
  if (cfg.feeMode === "retida") return { grossCents: amountCents, feeCents: amountCents, authorCents: 0 };
  return { grossCents: amountCents, feeCents: fee, authorCents: amountCents - fee };
}

/* ---------- Mercado Pago ---------- */

function accessToken(): string {
  const t = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!t) throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente");
  return t;
}

export function paymentsEnabled(): boolean {
  return !!process.env["MERCADOPAGO_ACCESS_TOKEN"];
}

/** Cria a cobrança no Mercado Pago e devolve o link do checkout. */
export async function createDonationCheckout(input: {
  amountCents: number;
  artistSlug: string;
  artistName: string;
  workSlug: string | null;
  workTitle: string | null;
  userId: string | null;
  payerName: string;
}): Promise<{ checkoutUrl: string; paymentId: string }> {
  const cfg = await getPaymentConfig();
  const split = splitAmount(input.amountCents, cfg);
  const payment = await prisma.payment.create({
    data: {
      kind: "donation",
      userId: input.userId,
      payerName: input.payerName.slice(0, 80) || "Anônimo",
      artistSlug: input.artistSlug,
      artistName: input.artistName,
      workSlug: input.workSlug,
      grossCents: split.grossCents,
      feeCents: split.feeCents,
      authorCents: split.authorCents,
      feeRate: cfg.feeRate,
      feeMode: cfg.feeMode,
    },
  });

  const back = `${SITE_URL}/apoio/retorno`;
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken()}`,
      "content-type": "application/json",
      "x-idempotency-key": payment.id,
    },
    body: JSON.stringify({
      items: [
        {
          id: payment.id,
          title: `Apoio a ${input.artistName}${input.workTitle ? ` (${input.workTitle})` : ""}`.slice(0, 250),
          description: "Doação pela Go Beyondd",
          quantity: 1,
          currency_id: "BRL",
          unit_price: split.grossCents / 100,
        },
      ],
      external_reference: payment.id,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: "approved",
      notification_url: `${SITE_URL}/api/pagamentos/webhook`,
      statement_descriptor: "GOBEYONDD",
      metadata: { payment_id: payment.id, kind: "donation" },
    }),
  });
  if (!res.ok) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "cancelled" } }).catch(() => {});
    throw new Error(`Mercado Pago recusou a preferência (${res.status})`);
  }
  const pref = (await res.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
  await prisma.payment.update({ where: { id: payment.id }, data: { mpPreferenceId: pref.id } });
  // Credenciais de teste usam o checkout de testes
  const isTest = accessToken().startsWith("TEST-");
  const checkoutUrl = (isTest ? pref.sandbox_init_point : pref.init_point) ?? pref.init_point ?? pref.sandbox_init_point;
  if (!checkoutUrl) throw new Error("Mercado Pago não devolveu o link do checkout");
  return { checkoutUrl, paymentId: payment.id };
}

/**
 * Confere a assinatura do webhook (cabeçalho x-signature: "ts=...,v1=...").
 * Modelo assinado: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */
export function verifyWebhookSignature(request: Request, dataId: string | null): boolean {
  const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!secret) return false;
  const header = request.headers.get("x-signature") ?? "";
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k ?? "", v.join("=")];
    }),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const requestId = request.headers.get("x-request-id");
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

type MpPayment = {
  id: number;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  date_approved?: string | null;
};

/** Busca o pagamento no Mercado Pago e atualiza o nosso registro. */
export async function syncMpPayment(mpPaymentId: string): Promise<void> {
  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(mpPaymentId)}`, {
    headers: { authorization: `Bearer ${accessToken()}` },
  });
  if (!res.ok) throw new Error(`Falha ao consultar pagamento (${res.status})`);
  const mp = (await res.json()) as MpPayment;
  const ref = mp.external_reference;
  if (!ref) return;
  const current = await prisma.payment.findUnique({ where: { id: ref } });
  if (!current) return;

  // Valor pago precisa bater com o valor cobrado
  const paidCents = Math.round((mp.transaction_amount ?? 0) * 100);
  let status = mp.status;
  if (status === "approved" && paidCents !== current.grossCents) status = "rejected";

  const becameApproved = status === "approved" && current.status !== "approved";
  await prisma.payment.update({
    where: { id: current.id },
    data: {
      status,
      mpPaymentId: String(mp.id),
      method: mp.payment_method_id ?? mp.payment_type_id ?? null,
      paidAt: status === "approved" ? (mp.date_approved ? new Date(mp.date_approved) : new Date()) : current.paidAt,
    },
  });

  // Doação aprovada de uma obra também entra nas estatísticas antigas de doações
  if (becameApproved && current.kind === "donation" && current.workSlug) {
    await prisma.donation
      .create({
        data: {
          workSlug: current.workSlug,
          artistSlug: current.artistSlug,
          artistName: current.artistName,
          donorId: current.userId,
          donorName: current.payerName,
          amount: current.grossCents / 100,
        },
      })
      .catch(() => {});
  }
}

/* ---------- consultas ---------- */

export async function getPaymentStatus(id: string) {
  const p = await prisma.payment.findUnique({
    where: { id },
    select: { status: true, artistName: true, artistSlug: true, workSlug: true, grossCents: true },
  });
  return p;
}

export async function listPayments(limit = 50) {
  const rows = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((r) => ({ ...r, feeRate: Number(r.feeRate) }));
}

/** Valores aprovados ainda não repassados, por autor. */
export async function pendingPayouts() {
  const rows = await prisma.payment.groupBy({
    by: ["artistSlug", "artistName"],
    where: { status: "approved", payoutAt: null, authorCents: { gt: 0 } },
    _sum: { authorCents: true },
    _count: { id: true },
  });
  return rows.map((r) => ({
    artistSlug: r.artistSlug,
    artistName: r.artistName,
    authorCents: r._sum.authorCents ?? 0,
    payments: r._count.id,
  }));
}

export async function markPayoutDone(artistSlug: string): Promise<number> {
  const r = await prisma.payment.updateMany({
    where: { artistSlug, status: "approved", payoutAt: null },
    data: { payoutAt: new Date() },
  });
  return r.count;
}
