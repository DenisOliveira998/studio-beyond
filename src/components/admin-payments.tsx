import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { money } from "@/lib/beyond-data";

type FeeMode = "descontada" | "somada" | "retida";
type AdminPaymentsData = {
  enabled: boolean;
  testMode: boolean;
  config: { feeRate: number; feeMode: FeeMode; priceFaCents: number; priceSuperFaCents: number };
  payouts: { artistSlug: string; artistName: string; authorCents: number; payments: number }[];
  payments: {
    id: string;
    status: string;
    payerName: string;
    artistName: string;
    workSlug: string | null;
    grossCents: number;
    feeCents: number;
    authorCents: number;
    feeMode: string;
    method: string | null;
    createdAt: string;
    payoutAt: string | null;
  }[];
};

const MODE_TEXT: Record<FeeMode, string> = {
  descontada: "Taxa descontada da doação (o leitor paga o valor escolhido; o autor recebe menos a taxa)",
  somada: "Taxa somada por cima (o leitor paga o valor + taxa; o autor recebe o valor escolhido)",
  retida: "Plataforma retém a doação inteira (o autor não recebe repasse)",
};
const STATUS_TEXT: Record<string, string> = {
  pending: "Aguardando",
  in_process: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Estornado",
  charged_back: "Contestado",
};

/** Pagamentos do Mercado Pago: regra da taxa, repasses pendentes e últimas cobranças. */
export function AdminPayments() {
  const qc = useQueryClient();
  const { data } = useQuery<AdminPaymentsData>({
    queryKey: ["admin-payments"],
    queryFn: () => fetch("/api/admin/pagamentos").then((r) => r.json() as Promise<AdminPaymentsData>),
    staleTime: 30_000,
  });

  const [rate, setRate] = useState("12");
  const [mode, setMode] = useState<FeeMode>("descontada");
  const [priceFa, setPriceFa] = useState("9.90");
  const [priceSuper, setPriceSuper] = useState("19.90");
  useEffect(() => {
    if (!data) return;
    setRate(String(Math.round(data.config.feeRate * 1000) / 10));
    setMode(data.config.feeMode);
    setPriceFa((data.config.priceFaCents / 100).toFixed(2));
    setPriceSuper((data.config.priceSuperFaCents / 100).toFixed(2));
  }, [data]);

  const saveConfig = useMutation({
    mutationFn: () =>
      fetch("/api/admin/pagamentos/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feeRate: Number(rate.replace(",", ".")) / 100,
          feeMode: mode,
          priceFaCents: Math.round(Number(priceFa.replace(",", ".")) * 100),
          priceSuperFaCents: Math.round(Number(priceSuper.replace(",", ".")) * 100),
        }),
      }).then((r) => {
        if (!r.ok) throw new Error();
      }),
    onSuccess: () => {
      toast.success("Configuração salva. Vale para as próximas doações e assinaturas.");
      void qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: () => toast.error("Não foi possível salvar."),
  });

  const payout = useMutation({
    mutationFn: (artistSlug: string) =>
      fetch("/api/admin/pagamentos/repasse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistSlug }),
      }).then((r) => {
        if (!r.ok) throw new Error();
      }),
    onSuccess: () => {
      toast.success("Repasse marcado como feito.");
      void qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: () => toast.error("Não foi possível marcar o repasse."),
  });

  if (!data) return <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="mt-8 space-y-8">
      <p className="text-sm text-muted-foreground">
        {data.enabled
          ? data.testMode
            ? "Mercado Pago ligado em modo de TESTE: nenhum dinheiro real é cobrado."
            : "Mercado Pago ligado em produção: cobranças reais."
          : "Mercado Pago ainda não configurado (falta o Access Token na Vercel)."}
      </p>

      <div className="border border-border bg-background p-6">
        <h3 className="font-display text-xl font-bold">Taxa das doações e preço dos planos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Só a equipe vê esta configuração. Cada doação guarda a regra do momento em que foi feita; quem já assina
          continua no preço antigo até cancelar.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-muted-foreground">Taxa (%)</span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="mt-1 w-28 rounded border border-input bg-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Fã (R$/mês)</span>
            <input
              type="number"
              min={1}
              step={0.1}
              value={priceFa}
              onChange={(e) => setPriceFa(e.target.value)}
              className="mt-1 w-28 rounded border border-input bg-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Super Fã (R$/mês)</span>
            <input
              type="number"
              min={1}
              step={0.1}
              value={priceSuper}
              onChange={(e) => setPriceSuper(e.target.value)}
              className="mt-1 w-28 rounded border border-input bg-surface px-3 py-2"
            />
          </label>
          <fieldset className="basis-full text-sm">
            <legend className="text-muted-foreground">Modo</legend>
            <div className="mt-1 space-y-1.5">
              {(Object.keys(MODE_TEXT) as FeeMode[]).map((m) => (
                <label key={m} className="flex items-start gap-2">
                  <input type="radio" name="fee-mode" checked={mode === m} onChange={() => setMode(m)} className="mt-1" />
                  <span>{MODE_TEXT[m]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() => saveConfig.mutate()}
            disabled={saveConfig.isPending}
            className="rounded-full bg-gilt px-5 py-2 text-sm font-bold text-ink disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="border border-border bg-background p-6">
        <h3 className="font-display text-xl font-bold">Repasses pendentes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Valores aprovados que ainda não foram pagos aos autores. Depois de fazer o Pix, marque como feito.
        </p>
        {data.payouts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum repasse pendente.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {data.payouts.map((p) => (
              <li key={p.artistSlug} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <strong>{p.artistName}</strong>
                  <span className="text-muted-foreground">. {p.payments} {p.payments === 1 ? "doação" : "doações"}</span>
                </span>
                <span className="flex items-center gap-3">
                  <strong>{money(p.authorCents / 100)}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Confirmar que o repasse de ${money(p.authorCents / 100)} para ${p.artistName} já foi feito?`)) {
                        payout.mutate(p.artistSlug);
                      }
                    }}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-foreground/50"
                  >
                    Marcar repasse feito
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-border bg-background p-6">
        <h3 className="font-display text-xl font-bold">Últimas cobranças</h3>
        {data.payments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma cobrança ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-normal">Data</th>
                  <th className="py-2 font-normal">Quem apoiou</th>
                  <th className="py-2 font-normal">Autor</th>
                  <th className="py-2 font-normal">Pago</th>
                  <th className="py-2 font-normal">Taxa</th>
                  <th className="py-2 font-normal">Autor recebe</th>
                  <th className="py-2 font-normal">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 tabular-nums">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="py-2">{p.payerName}</td>
                    <td className="py-2">{p.artistName}</td>
                    <td className="py-2 tabular-nums">{money(p.grossCents / 100)}</td>
                    <td className="py-2 tabular-nums text-muted-foreground">{money(p.feeCents / 100)}</td>
                    <td className="py-2 tabular-nums">{money(p.authorCents / 100)}</td>
                    <td className="py-2">
                      {STATUS_TEXT[p.status] ?? p.status}
                      {p.payoutAt ? <span className="text-muted-foreground">. Repassado</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
