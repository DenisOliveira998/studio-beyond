import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — The Beyond" },
      {
        name: "description",
        content:
          "Crie sua conta de leitor ou entre na plataforma The Beyond. Autores acessam após candidatura aprovada pela curadoria.",
      },
      { property: "og:title", content: "Entrar ou criar conta — The Beyond" },
      {
        property: "og:description",
        content: "Leitor por cadastro, Autor por curadoria. Sem anúncios, nunca.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "register" | "login";

const COPY: Record<Mode, { eyebrow: string; title: string; blurb: string; points: string[] }> = {
  register: {
    eyebrow: "Criar conta · Leitor",
    title: "Acompanhe as obras que merecem tempo.",
    blurb:
      "Cadastro gratuito. Você já entra como Leitor e pode navegar pelo feed, curtir e apoiar autores. Assinatura é opcional.",
    points: [
      "Feed aberto, sem anúncios, para todos.",
      "Assinantes têm curadoria exclusiva e acesso antecipado.",
      "Autores entram por candidatura — link abaixo.",
    ],
  },
  login: {
    eyebrow: "Bem-vindo de volta",
    title: "Entre e continue de onde parou.",
    blurb:
      "Leitores, assinantes e autores aprovados usam o mesmo acesso. O painel aparece conforme o seu perfil.",
    points: [
      "Sessão silenciosa, sem notificações intrusivas.",
      "Autores acessam o Painel do Autor após entrar.",
      "Assinantes mantêm o conteúdo exclusivo liberado.",
    ],
  },
};

function AuthPage() {
  const [mode, setMode] = useState<Mode>("register");
  const navigate = useNavigate();
  const copy = COPY[mode];

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
      {/* Coluna esquerda — contexto */}
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="hero-type mt-5 text-5xl tracking-tight sm:text-6xl">{copy.title}</h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">{copy.blurb}</p>
        <ul className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
          {copy.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      {/* Coluna direita — formulário */}
      <div className="border border-border bg-surface p-7 sm:p-9">
        {/* Toggle criar / entrar */}
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
          {(["register", "login"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`btn-type bg-background py-3 text-xs transition-colors ${
                mode === m ? "text-gilt" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "register" ? "Criar conta" : "Entrar"}
            </button>
          ))}
        </div>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "register") {
              toast.success("Conta criada. Bem-vindo ao The Beyond!");
              void navigate({ to: "/planos" });
            } else {
              toast.success("Sessão iniciada.");
              void navigate({ to: "/" });
            }
          }}
        >
          {mode === "register" && (
            <Field label="Nome completo" type="text" placeholder="Seu nome" />
          )}
          <Field label="E-mail" type="email" placeholder="voce@exemplo.com" />
          <Field label="Senha" type="password" placeholder="••••••••" />

          <button
            type="submit"
            className="btn-type w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90"
          >
            {mode === "register" ? "Criar conta gratuita" : "Entrar"}
          </button>

          {mode === "register" ? (
            <p className="caption">
              Após criar a conta você é Leitor. Assinatura é opcional e pode ser feita depois.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setMode("register")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Ainda não tem conta? Criar conta gratuita
            </button>
          )}
        </form>

        {/* Link para candidatura de autor — fora do formulário */}
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            Quer publicar no The Beyond?{" "}
            <Link
              to="/candidatura-autor"
              className="text-gilt transition-colors hover:text-gilt/80"
            >
              Candidate-se como autor →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
}: {
  label: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        required
        placeholder={placeholder}
        className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
      />
    </label>
  );
}
