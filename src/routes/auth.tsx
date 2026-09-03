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
          "Crie conta de Leitor Assíduo, candidate-se como Autor ou entre na sua conta do The Beyond. Sem anúncios, sempre.",
      },
      { property: "og:title", content: "Entrar ou criar conta — The Beyond" },
      {
        property: "og:description",
        content: "Leitor Assíduo por assinatura, Autor por curadoria. Sem anúncios, nunca.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "reader" | "author" | "login";

const TABS: Array<{ id: Mode; label: string }> = [
  { id: "reader", label: "Leitor" },
  { id: "author", label: "Autor" },
  { id: "login", label: "Entrar" },
];

const COPY: Record<Mode, { eyebrow: string; title: string; blurb: string; points: string[] }> = {
  reader: {
    eyebrow: "Leitor Assíduo",
    title: "Acompanhe as obras que merecem tempo.",
    blurb:
      "Crie a sua conta com nome, e-mail e senha. Em seguida você escolhe o plano — mensal ou anual com desconto. O feed continua aberto para quem não assinar.",
    points: [
      "Leitura sem interrupções, nenhum anúncio.",
      "Curadoria exclusiva e acesso antecipado a obras.",
      "Badge de apoiador nas suas doações.",
    ],
  },
  author: {
    eyebrow: "Autor · por curadoria",
    title: "Publicar aqui começa com uma candidatura.",
    blurb:
      "Autores entram por avaliação da curadoria: nome artístico, área de atuação, bio, portfólio e até três obras. A resposta chega por e-mail.",
    points: [
      "Status “Candidatura em análise” até a decisão.",
      "Aprovado, você recebe acesso ao Painel do Autor.",
      "Cada obra passa por revisão antes de ir ao feed.",
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
  const [mode, setMode] = useState<Mode>("reader");
  const navigate = useNavigate();
  const copy = COPY[mode];

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
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

      <div className="border border-border bg-surface p-7 sm:p-9">
        <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={`btn-type bg-background py-3 text-xs transition-colors ${
                mode === t.id ? "text-gilt" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === "author" ? (
          <div className="mt-8">
            <h2 className="font-display text-2xl tracking-tight">Candidatura de Autor</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Não há criação direta de conta de autor. O acesso ao Painel do Autor é liberado
              somente após aprovação da curadoria.
            </p>
            <Link
              to="/candidatura-autor"
              className="btn-type mt-8 block bg-primary py-3 text-center text-xs text-primary-foreground transition-opacity hover:opacity-90"
            >
              Abrir formulário de candidatura
            </Link>
            <p className="caption mt-4">
              Leva cerca de cinco minutos. Tenha o link do portfólio em mãos.
            </p>
          </div>
        ) : (
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "reader") {
                toast.success("Conta criada. Escolha o seu plano de leitura.");
                navigate({ to: "/planos" });
              } else {
                toast.success("Sessão iniciada (demonstração).");
              }
            }}
          >
            {mode === "reader" && (
              <Field label="Nome completo" type="text" placeholder="Seu nome" />
            )}
            <Field label="E-mail" type="email" placeholder="voce@exemplo.com" />
            <Field label="Senha" type="password" placeholder="••••••••" />

            <button
              type="submit"
              className="btn-type w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90"
            >
              {mode === "reader" ? "Criar conta e ver planos" : "Entrar"}
            </button>

            {mode === "reader" ? (
              <p className="caption">
                Após criar a conta você é levado à página de planos — assinar é opcional.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setMode("reader")}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Ainda não tem conta? Criar conta de leitor
              </button>
            )}
          </form>
        )}
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
