// Pagamentos via Mercado Pago (Checkout Pro + Preference API).
// A regra de taxa é nossa: o Mercado Pago só recebe "uma cobrança de R$ X".
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";

export type FeeMode = "descontada" | "somada" | "retida";
export const FEE_MODES: FeeMode[] = ["descontada", "somada", "retida"];

export type PaymentConfigData = { feeRate: number; feeMode: FeeMode; priceFaCents: number; priceSuperFaCents: number };
export type PlanId = "fa" | "superfa";
export const PLAN_NAME: Record<PlanId, string> = { fa: "Fã", superfa: "Super Fã" };

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
    priceFaCents: row?.priceFaCents ?? 990,
    priceSuperFaCents: row?.priceSuperFaCents ?? 1990,
  };
}

export async function savePaymentConfig(input: {
  feeRate: number;
  feeMode: FeeMode;
  priceFaCents: number;
  priceSuperFaCents: number;
}): Promise<PaymentConfigData> {
  const feeRate = Math.min(0.5, Math.max(0, Math.round(input.feeRate * 10_000) / 10_000));
  const feeMode = FEE_MODES.includes(input.feeMode) ? input.feeMode : "descontada";
  const price = (v: number, fallback: number) => (Number.isFinite(v) && v >= 100 && v <= 100_000 ? Math.round(v) : fallback);
  const priceFaCents = price(input.priceFaCents, 990);
  const priceSuperFaCents = price(input.priceSuperFaCents, 1990);
  await prisma.paymentConfig.upsert({
    where: { id: "default" },
    create: { id: "default", feeRate, feeMode, priceFaCents, priceSuperFaCents },
    update: { feeRate, feeMode, priceFaCents, priceSuperFaCents },
  });
  return { feeRate, feeMode, priceFaCents, priceSuperFaCents };
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

/** Credenciais de teste: só a equipe pode pagar (para testar); leitores veem "em breve". */
export function paymentsTestMode(): boolean {
  return (process.env["MERCADOPAGO_ACCESS_TOKEN"] ?? "").startsWith("TEST-");
}

/** Pagamentos abertos para esta pessoa? Produção: todos. Teste: só a equipe. */
export function paymentsOpenFor(role: string | null | undefined): boolean {
  if (!paymentsEnabled()) return false;
  if (!paymentsTestMode()) return true;
  return !!role && ["gerente", "admin", "owner"].includes(role);
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

/* ---------- assinaturas (Fã / Super Fã) ---------- */

const ROLE_OF_PLAN: Record<PlanId, "vip" | "superfa"> = { fa: "vip", superfa: "superfa" };

export async function getActiveSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: { userId, status: { in: ["authorized", "paused"] } },
    orderBy: { createdAt: "desc" },
  });
}

/** Cria a assinatura no Mercado Pago e devolve o link para o leitor autorizar a cobrança mensal. */
export async function createSubscriptionCheckout(input: {
  userId: string;
  plan: PlanId;
  payerEmail: string;
}): Promise<{ checkoutUrl: string }> {
  const cfg = await getPaymentConfig();
  const priceCents = input.plan === "fa" ? cfg.priceFaCents : cfg.priceSuperFaCents;
  const sub = await prisma.subscription.create({
    data: { userId: input.userId, plan: input.plan, priceCents, payerEmail: input.payerEmail },
  });
  const res = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken()}`,
      "content-type": "application/json",
      "x-idempotency-key": sub.id,
    },
    body: JSON.stringify({
      reason: `Go Beyondd ${PLAN_NAME[input.plan]}`,
      external_reference: sub.id,
      payer_email: input.payerEmail,
      back_url: `${SITE_URL}/planos/retorno`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: priceCents / 100,
        currency_id: "BRL",
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled" } }).catch(() => {});
    throw new Error(`Mercado Pago recusou a assinatura (${res.status}) ${detail.slice(0, 200)}`);
  }
  const pre = (await res.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
  await prisma.subscription.update({ where: { id: sub.id }, data: { mpPreapprovalId: pre.id } });
  const checkoutUrl = pre.init_point ?? pre.sandbox_init_point;
  if (!checkoutUrl) throw new Error("Mercado Pago não devolveu o link da assinatura");
  return { checkoutUrl };
}

/** Atualiza o cargo do leitor conforme a assinatura (nunca mexe em autor ou equipe). */
async function applyPlanRole(userId: string) {
  const active = await prisma.subscription.findFirst({
    where: { userId, status: "authorized" },
    orderBy: { createdAt: "desc" },
  });
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { role: true } });
  if (!profile || !["reader", "vip", "superfa"].includes(profile.role)) return;
  const target = active ? (ROLE_OF_PLAN[active.plan as PlanId] ?? "vip") : "reader";
  if (profile.role !== target) await prisma.profile.update({ where: { id: userId }, data: { role: target } });
}

type MpPreapproval = { id: string; status: string; external_reference?: string | null; next_payment_date?: string | null };

async function cancelPreapproval(preapprovalId: string) {
  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (!res.ok) throw new Error(`Falha ao cancelar assinatura (${res.status})`);
}

/** Busca a assinatura no Mercado Pago e atualiza status e cargo. */
export async function syncPreapproval(preapprovalId: string): Promise<{ status: string; plan: string } | null> {
  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`, {
    headers: { authorization: `Bearer ${accessToken()}` },
  });
  if (!res.ok) throw new Error(`Falha ao consultar assinatura (${res.status})`);
  const mp = (await res.json()) as MpPreapproval;
  const sub =
    (mp.external_reference ? await prisma.subscription.findUnique({ where: { id: mp.external_reference } }) : null) ??
    (await prisma.subscription.findUnique({ where: { mpPreapprovalId: mp.id } }));
  if (!sub) return null;
  const status = ["pending", "authorized", "paused", "cancelled"].includes(mp.status) ? mp.status : sub.status;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status,
      mpPreapprovalId: mp.id,
      nextPaymentAt: mp.next_payment_date ? new Date(mp.next_payment_date) : sub.nextPaymentAt,
    },
  });
  // Uma assinatura nova autorizada substitui a anterior (troca de plano)
  if (status === "authorized") {
    const others = await prisma.subscription.findMany({
      where: { userId: sub.userId, id: { not: sub.id }, status: { in: ["authorized", "paused"] } },
    });
    for (const o of others) if (o.mpPreapprovalId) await cancelPreapproval(o.mpPreapprovalId).catch(() => {});
    await prisma.subscription.updateMany({
      where: { userId: sub.userId, id: { not: sub.id }, status: { in: ["authorized", "paused", "pending"] } },
      data: { status: "cancelled" },
    });
  }
  await applyPlanRole(sub.userId);
  return { status, plan: sub.plan };
}

/** Leitor cancela a própria assinatura: para as próximas cobranças e volta a ser leitor. */
export async function cancelUserSubscription(userId: string): Promise<boolean> {
  const sub = await getActiveSubscription(userId);
  if (!sub) return false;
  if (sub.mpPreapprovalId) await cancelPreapproval(sub.mpPreapprovalId);
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });
  await applyPlanRole(userId);
  return true;
}

type MpAuthorizedPayment = {
  id: number;
  preapproval_id?: string;
  transaction_amount?: number;
  status?: string;
  payment?: { id?: number; status?: string };
};

/** Cobrança mensal de uma assinatura: registra como receita da plataforma. */
export async function syncAuthorizedPayment(authorizedPaymentId: string): Promise<void> {
  const res = await fetch(`${MP_API}/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`, {
    headers: { authorization: `Bearer ${accessToken()}` },
  });
  if (!res.ok) throw new Error(`Falha ao consultar cobrança da assinatura (${res.status})`);
  const ap = (await res.json()) as MpAuthorizedPayment;
  if (!ap.preapproval_id) return;
  const sub = await prisma.subscription.findUnique({ where: { mpPreapprovalId: ap.preapproval_id } });
  if (!sub) return;
  const status = ap.payment?.status ?? ap.status ?? "pending";
  const cents = Math.round((ap.transaction_amount ?? sub.priceCents / 100) * 100);
  const mpPaymentId = ap.payment?.id ? String(ap.payment.id) : `ap-${ap.id}`;
  await prisma.payment.upsert({
    where: { mpPaymentId },
    create: {
      kind: "subscription",
      status,
      mpPaymentId,
      userId: sub.userId,
      payerName: sub.payerEmail.split("@")[0] ?? "Assinante",
      artistSlug: "",
      artistName: `Plano ${PLAN_NAME[sub.plan as PlanId] ?? sub.plan}`,
      grossCents: cents,
      feeCents: cents,
      authorCents: 0,
      feeRate: 1,
      feeMode: "assinatura",
      paidAt: status === "approved" ? new Date() : null,
    },
    update: { status, ...(status === "approved" ? { paidAt: new Date() } : {}) },
  });
  // Mantém o cargo em dia (ex.: cobrança recusada pode pausar a assinatura)
  await syncPreapproval(ap.preapproval_id).catch(() => {});
}

export async function getSubscriptionByPreapproval(preapprovalId: string) {
  return prisma.subscription.findUnique({
    where: { mpPreapprovalId: preapprovalId },
    select: { status: true, plan: true, priceCents: true, userId: true },
  });
}
