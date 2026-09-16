import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — The Beyond" },
      { name: "description", content: "Acesse sua conta no The Beyond com e-mail e senha ou Google." },
      { property: "og:title", content: "Entrar — The Beyond" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EntrarPage,
});

type Mode = "login" | "forgot-email" | "forgot-otp" | "forgot-password";

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

function EntrarPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [logging, setLogging] = useState(false);

  // google
  const [signingGoogle, setSigningGoogle] = useState(false);

  // forgot
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [settingPw, setSettingPw] = useState(false);

  // --- login ---
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLogging(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result?.error) {
        toast.error(result.error.message ?? "E-mail ou senha incorretos.");
      } else {
        void navigate({ to: "/" });
      }
    } catch {
      toast.error("Erro ao entrar. Verifique suas credenciais.");
    } finally {
      setLogging(false);
    }
  }

  // --- google ---
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

  // --- forgot: step 1 (send OTP) ---
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setSendingOtp(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), type: "sign-in" }),
      });
      let data: { success?: boolean; error?: string } = {};
      try { data = (await res.json()) as typeof data; } catch { /* non-JSON */ }
      if (!res.ok || !data.success) {
        toast.error(data.error ?? `Erro ${res.status} ao enviar código.`);
        return;
      }
      setMode("forgot-otp");
      toast.success("Código enviado! Verifique sua caixa de entrada.");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setSendingOtp(false);
    }
  }

  // --- forgot: step 2 (verify OTP → sign in) ---
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: otp.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Código inválido ou expirado.");
        return;
      }
      setMode("forgot-password");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  // --- forgot: step 3 (set new password) ---
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmNewPw) { toast.error("As senhas não coincidem."); return; }
    if (!/[A-Z]/.test(newPw) || !/[a-z]/.test(newPw) || !/[0-9]/.test(newPw) || newPw.length < 8) {
      toast.error("A senha não atende os requisitos de segurança.");
      return;
    }
    setSettingPw(true);
    try {
      const res = await fetch("/api/password/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: newPw }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Erro ao definir senha.");
        return;
      }
      toast.success("Senha definida com sucesso!");
      void navigate({ to: "/" });
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setSettingPw(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
      {/* Coluna esquerda */}
      <div>
        <p className="eyebrow">Acesso</p>
        <h1 className="hero-type mt-5 text-5xl tracking-tight sm:text-6xl">
          {mode === "login" && "Entre e continue de onde parou."}
          {mode === "forgot-email" && "Recuperar senha."}
          {mode === "forgot-otp" && "Verifique seu e-mail."}
          {mode === "forgot-password" && "Nova senha."}
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          {mode === "login" && "Acesse com e-mail e senha ou entre diretamente com sua conta Google."}
          {mode === "forgot-email" && "Enviaremos um código de verificação para o e-mail cadastrado."}
          {mode === "forgot-otp" && `Enviamos um código de 6 dígitos para ${forgotEmail}. Válido por 10 minutos.`}
          {mode === "forgot-password" && "Escolha uma nova senha segura para a sua conta."}
        </p>
        {mode === "login" && (
          <ul className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
            <li>Conta criada automaticamente no primeiro cadastro.</li>
            <li>Novos leitores entram com papel Leitor por padrão.</li>
            <li>Autores aprovados pela curadoria acessam o Painel do Autor.</li>
          </ul>
        )}
      </div>

      {/* Coluna direita */}
      <div className="flex flex-col gap-6">

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <>
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
                  Entrar com Google
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou acesse por e-mail</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={(e) => void handleLogin(e)} className="border border-border bg-surface p-7 space-y-5 sm:p-9">
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
              </label>

              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  disabled={logging}
                  className="btn-type bg-primary px-6 py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {logging ? "Entrando…" : "Entrar"}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotEmail(email); setMode("forgot-email"); }}
                  className="text-xs text-muted-foreground transition-colors hover:text-gilt"
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>

            <p className="text-xs text-muted-foreground text-center">
              Não tem uma conta?{" "}
              <Link to="/criar" className="text-gilt transition-colors hover:text-gilt/80">
                Crie aqui
              </Link>
            </p>
          </>
        )}

        {/* ── FORGOT: step 1 — email ── */}
        {mode === "forgot-email" && (
          <form onSubmit={(e) => void handleSendOtp(e)} className="border border-border bg-surface p-7 space-y-5 sm:p-9">
            <label className="block">
              <span className="eyebrow">E-mail cadastrado</span>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="btn-type border border-border px-5 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={sendingOtp}
                className="btn-type flex-1 bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {sendingOtp ? "Enviando…" : "Enviar código"}
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT: step 2 — OTP ── */}
        {mode === "forgot-otp" && (
          <form onSubmit={(e) => void handleVerifyOtp(e)} className="border border-border bg-surface p-7 space-y-5 sm:p-9">
            <div>
              <p className="eyebrow">Código enviado para</p>
              <p className="mt-1 text-sm text-foreground">{forgotEmail}</p>
            </div>
            <label className="block">
              <span className="eyebrow">Código de 6 dígitos</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-center font-mono text-xl tracking-[0.5em] outline-none placeholder:text-muted-foreground focus:border-gilt"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode("forgot-email")}
                className="btn-type border border-border px-5 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={verifyingOtp || otp.length < 6}
                className="btn-type flex-1 bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {verifyingOtp ? "Verificando…" : "Verificar código"}
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT: step 3 — new password ── */}
        {mode === "forgot-password" && (
          <form onSubmit={(e) => void handleSetPassword(e)} className="border border-border bg-surface p-7 space-y-5 sm:p-9">
            <label className="block">
              <span className="eyebrow">Nova senha</span>
              <div className="relative mt-2">
                <input
                  type={showNewPw ? "text" : "password"}
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNewPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <PasswordRules password={newPw} />
            </label>
            <label className="block">
              <span className="eyebrow">Confirmar nova senha</span>
              <input
                type={showNewPw ? "text" : "password"}
                required
                value={confirmNewPw}
                onChange={(e) => setConfirmNewPw(e.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
              />
              {confirmNewPw && newPw !== confirmNewPw && (
                <p className="mt-1 text-xs text-red-400">As senhas não coincidem.</p>
              )}
            </label>
            <button
              type="submit"
              disabled={settingPw || newPw !== confirmNewPw}
              className="btn-type w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {settingPw ? "Salvando…" : "Definir nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
