import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { money } from "@/lib/beyond-data";

const presets = [5, 15, 40, 100];

type Quote = {
  totalCents: number;
  destino: "autor" | "plataforma";
  feeCents?: number;
  authorCents?: number;
  feeRate?: number;
};

/** Doação via Mercado Pago (Checkout Pro): o leitor paga na página do Mercado Pago e volta ao site. */
export function DonateDialog({
  artistName,
  artistSlug,
  workSlug,
  trigger,
}: {
  artistName: string;
  artistSlug: string;
  workSlug?: string | undefined;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(15);
  const [custom, setCustom] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [sending, setSending] = useState(false);

  const value = custom ? Number(custom.replace(",", ".")) || 0 : amount;
  const valid = value >= 1 && value <= 5000;

  // Total a pagar (e, para autores e equipe, a divisão) vem do servidor, que conhece a regra da taxa
  useEffect(() => {
    if (!open || !valid) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/pagamentos/cotacao?valor=${value}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<Quote>) : null))
        .then((q) => setQuote(q))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, value, valid]);

  async function pay() {
    if (!valid || sending) return;
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

  const total = quote ? quote.totalCents / 100 : value;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">Apoiar {artistName}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {quote?.destino === "plataforma"
              ? "Seu apoio vai para a Go Beyondd, que remunera os autores da plataforma."
              : "Uma doação para quem escreveu. Sem assinatura, sem compromisso."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={!custom && amount === p}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={`rounded border py-3 text-sm transition-colors ${
                !custom && amount === p
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {money(p)}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-sm text-muted-foreground">Outro valor</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ex.: 25"
            className="mt-2 w-full rounded border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
          {custom && !valid && <span className="mt-1 block text-xs text-red-400">Escolha um valor entre R$ 1 e R$ 5.000.</span>}
        </label>

        <dl className="space-y-1.5 border-y border-border/70 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Você paga</dt>
            <dd className="font-bold">{money(total)}</dd>
          </div>
          {/* Taxa e divisão só aparecem para autores e equipe */}
          {quote?.feeCents != null && quote.authorCents != null && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Taxa da plataforma ({Math.round((quote.feeRate ?? 0) * 1000) / 10}%)</dt>
                <dd className="text-muted-foreground">{money(quote.feeCents / 100)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{artistName} recebe</dt>
                <dd>{money(quote.authorCents / 100)}</dd>
              </div>
            </>
          )}
        </dl>

        <button
          type="button"
          onClick={() => void pay()}
          disabled={!valid || sending}
          className="w-full rounded-full bg-gilt py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "Abrindo o pagamento…" : `Pagar ${money(total)}`}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Pagamento seguro pelo Mercado Pago: Pix, cartão ou boleto. Você volta para cá depois.
        </p>
      </DialogContent>
    </Dialog>
  );
}
