import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PLATFORM_FEE, money } from "@/lib/beyond-data";

const presets = [5, 15, 40, 100];

export function DonateDialog({
  artistName,
  trigger,
}: {
  artistName: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(15);
  const [custom, setCustom] = useState("");

  const value = custom ? Math.max(1, Number(custom) || 0) : amount;
  const toArtist = value * (1 - PLATFORM_FEE);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader className="text-left">
          <p className="eyebrow">Apoio direto</p>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">
            Apoiar {artistName}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Uma doação, direto para o ateliê. Sem assinatura, sem amarras.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={`border py-3 text-sm transition-colors ${
                !custom && amount === p
                  ? "border-gilt text-gilt"
                  : "border-border text-muted-foreground hover:border-gilt-soft hover:text-foreground"
              }`}
            >
              {money(p)}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="eyebrow">Valor personalizado</span>
          <input
            type="number"
            min={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Digite um valor"
            className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
        </label>

        <dl className="space-y-1.5 border-y border-border/70 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Sua doação</dt>
            <dd>{money(value)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxa da plataforma (12%)</dt>
            <dd className="text-muted-foreground">−{money(value * PLATFORM_FEE)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{artistName} recebe</dt>
            <dd className="text-gilt">{money(toArtist)}</dd>
          </div>
        </dl>

        <button
          onClick={() => {
            setOpen(false);
            toast.success(`Obrigado — ${money(value)} enviados para ${artistName}.`, {
              description: "Checkout de demonstração: os pagamentos ainda não estão ativos.",
            });
          }}
          className="w-full bg-primary py-3 text-sm uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90"
        >
          Enviar {money(value)}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          O pagamento por cartão está pronto para o Stripe. Nada é cobrado nesta prévia.
        </p>
      </DialogContent>
    </Dialog>
  );
}
