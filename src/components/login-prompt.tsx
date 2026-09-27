import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Convite para criar conta/entrar quando um visitante tenta curtir, salvar ou seguir. */
export function LoginPrompt({
  open,
  onOpenChange,
  redirectTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo: string;
}) {
  const search = { redirect: redirectTo };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader className="text-left">
          <p className="eyebrow">Conta gratuita</p>
          <DialogTitle className="font-display text-2xl font-normal tracking-tight">
            Crie sua conta grátis para salvar obras e continuar de onde parou.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Leva menos de um minuto. Seus dados não são vendidos.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/criar"
            search={search}
            onClick={() => onOpenChange(false)}
            className="btn-type flex-1 bg-gilt px-5 py-3 text-center text-xs font-bold text-ink transition-opacity hover:opacity-90"
          >
            Criar conta
          </Link>
          <Link
            to="/entrar"
            search={search}
            onClick={() => onOpenChange(false)}
            className="btn-type flex-1 border border-border px-5 py-3 text-center text-xs text-foreground transition-colors hover:border-gilt hover:text-gilt"
          >
            Entrar
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
