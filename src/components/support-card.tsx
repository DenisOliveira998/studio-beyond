import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { money } from "@/lib/beyond-data";

const PRESETS = [5, 10, 15];

type Quote = { totalCents: number; available?: boolean; testMode?: boolean; destino?: "autor" | "plataforma" };
type AuthorSupport = { name: string; avatarUrl: string; rank: number | null };

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  // Nome de uma palavra só ("CS'Santos"): as duas primeiras letras
  const raw = words.length > 1 ? words.map((w) => w[0] ?? "").join("") : (words[0] ?? "");
  return raw.replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 2).toUpperCase();
}

/** Card "Apoie o autor": foto e posição no ranking, valores e pagamento pelo Mercado Pago. */
export function SupportCard({
  artistName,
  artistSlug,
  workSlug,
  workTitle,
}: {
  artistName: string;
  artistSlug: string;
  workSlug: string;
  workTitle: string;
  cover?: string | undefined;
}) {
  const { data: author } = useQuery<AuthorSupport>({
    queryKey: ["apoio-autor", artistSlug],
    queryFn: () => fetch(`/api/apoio/autor/${encodeURIComponent(artistSlug)}`).then((r) => r.json() as Promise<AuthorSupport>),
    staleTime: 5 * 60_000,
  });
  const [amount, setAmount] = useState(10);
  const [custom, setCustom] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [sending, setSending] = useState(false);

  const value = custom !== null ? Number(custom.replace(",", ".")) || 0 : amount;
  const valid = value >= 1 && value <= 5000;

  useEffect(() => {
    if (!valid) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/pagamentos/cotacao?valor=${value}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<Quote>) : null))
        .then(setQuote)
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, valid]);

  const closed = quote?.available === false;
  const total = quote ? quote.totalCents / 100 : value;
  const name = author?.name || artistName;

  async function pay() {
    if (!valid || sending || closed) return;
    setSending(true);
    try {
      const res = await fetch("/api/pagamentos/doacao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistSlug, workSlug, valor: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "Não foi possível abrir o pagamento.");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o pagamento.");
      setSending(false);
    }
  }

  const chip = (active: boolean) =>
    `flex-1 rounded-lg border py-2.5 text-sm transition-colors ${
      active ? "border-gilt bg-gilt/10 font-bold text-gilt" : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <section aria-label={`Apoie ${name}`} className="overflow-hidden rounded-xl bg-transparent">
      <div className="p-[18px]">
        <div className="flex items-center gap-3">
          {author?.avatarUrl ? (
            <img
              src={author.avatarUrl}
              alt={`Foto de ${name}`}
              width={52}
              height={52}
              className="size-[52px] shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-[#5a3b5e] text-[15px] font-bold text-white">
              {initials(name)}
            </span>
          )}
          <p className="flex min-w-0 items-baseline gap-2 text-[15px] font-bold text-foreground">
            <span className="truncate">Apoie {name}</span>
            {author?.rank != null && (
              <a
                href="/ranking?aba=autores"
                title={`${author.rank}º no ranking de autores da semana`}
                className="shrink-0 rounded bg-gilt/15 px-1.5 py-0.5 text-xs font-bold tabular-nums text-gilt hover:bg-gilt/25"
              >
                #{author.rank}
              </a>
            )}
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Autor de {workTitle}</p>

        <div role="group" aria-label="Valor do apoio" className="mt-[18px] flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={custom === null && amount === p}
              onClick={() => {
                setAmount(p);
                setCustom(null);
              }}
              className={chip(custom === null && amount === p)}
            >
              R$ {p}
            </button>
          ))}
        </div>
        {custom === null ? (
          <button type="button" onClick={() => setCustom("")} className={`mt-2 w-full ${chip(false)}`}>
            Outro valor
          </button>
        ) : (
          <label className="mt-2 block">
            <span className="sr-only">Outro valor, em reais</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Digite o valor, ex.: 25"
              className="w-full rounded-lg border border-gilt bg-background px-3 py-2.5 text-center text-sm outline-none"
            />
          </label>
        )}
        {custom !== null && custom !== "" && !valid && (
          <p className="mt-1 text-center text-xs text-red-400">Escolha um valor entre R$ 1 e R$ 5.000.</p>
        )}

        <button
          type="button"
          onClick={() => void pay()}
          disabled={!valid || sending || closed}
          className="mt-4 w-full rounded-lg bg-gilt py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {closed ? "Pagamentos em breve" : sending ? "Abrindo o pagamento…" : `Apoiar com ${money(valid ? total : 0)}`}
        </button>
        <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
          {quote?.testMode && !closed
            ? "Modo de teste: use o cartão 5031 4332 1540 6351, 11/30, CVV 123, titular APRO."
            : "Pix, cartão ou boleto pelo Mercado Pago"}
        </p>
      </div>
    </section>
  );
}
