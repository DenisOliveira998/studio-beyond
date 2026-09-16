import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/criar")({
  head: () => ({
    meta: [
      { title: "Criar conta — The Beyond" },
      { name: "description", content: "Crie sua conta de leitor no The Beyond e comece a ler agora." },
      { property: "og:title", content: "Criar conta — The Beyond" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CriarPage,
});

function PasswordRules({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "1 letra maiúscula", ok: /[A-Z]/.test(password) },
    { label: "1 letra minúscula", ok: /[a-z]/.test(password) },
    { label: "1 número", ok: /[0-9]/.test(password) },
  ];
  return (
    <ul className="mt-2 space-y-1">
      {checks.map((c) => (
        <li
          key={c.label}
          className={`flex items-center gap-2 text-xs transition-colors ${c.ok ? "text-green-400" : "text-muted-foreground"}`}
        >
          <span className="font-mono">{c.ok ? "✓" : "○"}</span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}

function CriarPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signingGoogle, setSigningGoogle] = useState(false);

  const pwValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!pwValid) {
      toast.error("A senha não atende os requisitos de segurança.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: email.split("@")[0],
        callbackURL: "/",
      });
      if (result?.error) {
        const msg = result.error.message ?? "";
        if (/exist|already|exists/i.test(msg)) {
          toast.error("Esse e-mail já possui uma conta. Entre em /entrar ou use 'Esqueci minha senha'.");
        } else {
          toast.error(msg || "Erro ao criar conta.");
        }
      } else {
        toast.success("Conta criada! Bem-vindo ao The Beyond.");
        window.location.href = "/";
      }
    } catch {
      toast.error("Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setSigningGoogle(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (result?.error) {
        toast.error(result.error.message ?? "Erro ao entrar com Google.");
        setSigningGoogle(false);
      }
    } catch {
      toast.error("Erro ao entrar com Google. Tente novamente.");
      setSigningGoogle(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
      {/* Coluna esquerda */}
      <div>
        <p className="eyebrow">Cadastro</p>
        <h1 className="hero-type mt-5 text-5xl tracking-tight sm:text-6xl">
          Crie sua conta e comece a ler.
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          Conta de Leitor criada em segundos. Acesso completo ao acervo sem anúncios, sem interrupções.
        </p>
        <ul className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
          <li>Papel Leitor por padrão — leia qualquer obra do acervo.</li>
          <li>Quer publicar? Candidate-se como autor após criar a conta.</li>
          <li className="text-xs text-muted-foreground/60">
            Seus dados não são compartilhados ou vendidos.
          </li>
        </ul>
      </div>

      {/* Coluna direita */}
      <div className="flex flex-col gap-6">
        {/* Google */}
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={signingGoogle}
          className="flex w-full items-center justify-center gap-3 border border-border bg-surface px-5 py-3.5 text-sm transition-colors hover:border-gilt hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingGoogle ? (
            <>
              <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-border border-t-gilt" />
              Redirecionando…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Criar com Google
            </>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou cadastre com e-mail</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(e) => void handleCriar(e)} className="border border-border bg-surface p-7 space-y-5 sm:p-9">
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

          <label className="block">
            <span className="eyebrow">Senha</span>
            <div className="relative mt-2">
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <PasswordRules password={password} />
          </label>

          <label className="block">
            <span className="eyebrow">Confirmar senha</span>
            <input
              type={showPw ? "text" : "password"}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
            {confirm && password !== confirm && (
              <p className="mt-1 text-xs text-red-400">As senhas não coincidem.</p>
            )}
          </label>

          <button
            type="submit"
            disabled={loading || !pwValid || password !== confirm}
            className="btn-type w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Já tem uma conta?{" "}
          <Link to="/entrar" className="text-gilt transition-colors hover:text-gilt/80">
            Entrar aqui
          </Link>
        </p>
      </div>
    </div>
  );
}
