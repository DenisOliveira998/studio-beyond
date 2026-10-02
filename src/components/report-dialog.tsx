import { useState, type ReactNode } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { LoginPrompt } from "@/components/login-prompt";

// Mesma lista do servidor (src/lib/moderation.ts)
const REASONS = [
  "Spam ou propaganda",
  "Assédio ou discurso de ódio",
  "Golpe ou fraude",
  "Conteúdo sexual ou impróprio para menores",
  "Plágio ou violação de direitos autorais",
  "Outro",
];

const TARGET_LABEL = { comment: "este comentário", work: "esta obra", author: "este autor" } as const;

/** Botão "Denunciar" + janela com o motivo. Sem conta, convida a entrar. */
export function ReportButton({
  targetType,
  targetId,
  redirectTo,
  trigger,
}: {
  targetType: "comment" | "work" | "author";
  targetId: string;
  redirectTo: string;
  trigger?: ReactNode;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const button = trigger ?? (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-red-400"
    >
      <Flag className="size-3" strokeWidth={1.5} />
      Denunciar
    </button>
  );

  if (!user) {
    return (
      <>
        <span onClick={() => setLoginOpen(true)}>{button}</span>
        <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} redirectTo={redirectTo} />
      </>
    );
  }

  async function send() {
    if (!reason) return;
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, details }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar a denúncia.");
      toast.success("Denúncia enviada. A equipe vai analisar.");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a denúncia.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{button}</DialogTrigger>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader className="text-left">
          <p className="eyebrow">Denúncia</p>
          <DialogTitle className="font-display text-2xl font-normal tracking-tight">
            Denunciar {TARGET_LABEL[targetType]}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            A equipe analisa cada denúncia. Quem foi denunciado não sabe quem denunciou.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="eyebrow mb-2">Motivo</legend>
          {REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 border border-border px-3 py-2 text-sm transition-colors hover:border-gilt/50">
              <input
                type="radio"
                name={`report-${targetType}-${targetId}`}
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-[var(--gilt)]"
              />
              {r}
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className="eyebrow">Detalhes (opcional)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Conte o que aconteceu, se quiser."
            className="mt-2 w-full resize-y border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
        </label>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!reason || sending}
          className="btn-type w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar denúncia"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
