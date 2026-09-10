import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — The Beyond" },
      {
        name: "description",
        content:
          "Crie sua conta de leitor ou entre na plataforma The Beyond. Autores acessam apos candidatura aprovada pela curadoria.",
      },
      { property: "og:title", content: "Entrar ou criar conta — The Beyond" },
      {
        property: "og:description",
        content: "Leitor por cadastro, Autor por curadoria. Sem anuncios, nunca.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

// ------------------------------------------------------------
// Fluxo de email OTP: step "email" → digita email → envia codigo
//                    step "code"  → digita 6 digitos → entra
// ------------------------------------------------------------
type OtpStep = "email" | "code";

function AuthPage() {
  const navigate = useNavigate();

  // ---- email OTP state ----
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<OtpStep>("email");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // ---- Google OAuth ----
  async function signInWithGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  }

  // ---- Passo 1: enviar codigo ----
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), type: "sign-in" }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Nao foi possivel enviar o codigo.");
        return;
      }
      setStep("code");
      toast.success("Codigo enviado! Verifique sua caixa de entrada.");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  // ---- Passo 2: verificar codigo ----
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      toast.error("Digite o codigo de 6 digitos.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: code.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Codigo invalido ou expirado.");
        return;
      }
      toast.success("Bem-vindo ao The Beyond!");
      void navigate({ to: "/" });
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
      {/* Coluna esquerda */}
      <div>
        <p className="eyebrow">Acesso</p>
        <h1 className="hero-type mt-5 text-5xl tracking-tight sm:text-6xl">
          {step === "code"
            ? "Verifique seu e-mail."
            : "Entre e continue de onde parou."}
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          {step === "code"
            ? `Enviamos um codigo de 6 digitos para ${email}. Valido por 10 minutos.`
            : "Sem senha. Voce recebe um codigo por e-mail a cada acesso — seguro e simples."}
        </p>
        <ul className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
          <li>Conta criada automaticamente no primeiro acesso.</li>
          <li>Novos leitores entram com papel Leitor por padrao.</li>
          <li>Autores aprovados pela curadoria acessam o Painel do Autor.</li>
        </ul>
      </div>

      {/* Coluna direita — formularios */}
      <div className="flex flex-col gap-6">
        {/* Google OAuth */}
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="flex w-full items-center justify-center gap-3 border border-border bg-surface px-5 py-3.5 text-sm transition-colors hover:border-gilt hover:text-foreground"
        >
          {/* SVG Google */}
          <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar com Google
        </button>

        {/* Divisor */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou acesse por e-mail</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email OTP */}
        <div className="border border-border bg-surface p-7 sm:p-9">
          {step === "email" ? (
            <form onSubmit={(e) => void sendCode(e)} className="space-y-5">
              <label className="block">
                <span className="eyebrow">E-mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
                />
              </label>
              <button
                type="submit"
                disabled={sending}
                className="btn-type w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {sending ? "Enviando codigo..." : "Receber codigo por e-mail"}
              </button>
              <p className="caption">
                Primeira vez? Sua conta e criada automaticamente como Leitor.
              </p>
            </form>
          ) : (
            <form onSubmit={(e) => void verifyCode(e)} className="space-y-5">
              <div>
                <p className="eyebrow">Codigo enviado para</p>
                <p className="mt-1 text-sm text-foreground">{email}</p>
              </div>
              <label className="block">
                <span className="eyebrow">Codigo de 6 digitos</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-center font-mono text-xl tracking-[0.5em] outline-none placeholder:text-muted-foreground focus:border-gilt"
                />
              </label>
              <button
                type="submit"
                disabled={verifying || code.length < 6}
                className="btn-type w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {verifying ? "Verificando..." : "Entrar"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); }}
                className="w-full text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Usar outro e-mail
              </button>
            </form>
          )}
        </div>

        {/* Link candidatura */}
        <p className="text-xs text-muted-foreground">
          Quer publicar no The Beyond?{" "}
          <Link
            to="/candidatura-autor"
            className="text-gilt transition-colors hover:text-gilt/80"
          >
            Candidate-se como autor
          </Link>
        </p>
      </div>
    </div>
  );
}
