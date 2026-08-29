import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no The Beyond — Autores e Apoiadores" },
      {
        name: "description",
        content:
          "Crie uma conta de autor para publicar e receber, ou entre como leitor para acompanhar e apoiar as obras que você ama.",
      },
      { property: "og:title", content: "Entrar no The Beyond" },
      {
        property: "og:description",
        content: "Cadastro separado para autores e leitores. Sem anúncios, nunca.",
      },
    ],
  }),
  component: AuthPage,
});

type Role = "artist" | "supporter" | "vip";
type Mode = "signup" | "login";

const copy: Record<Role, { title: string; blurb: string }> = {
  artist: {
    title: "Publique e receba",
    blurb:
      "Envie textos, imagens, áudio ou ilustrações. Ganhe por cada visualização contabilizada, além das doações diretas dos apoiadores.",
  },
  supporter: {
    title: "Acompanhe as obras que você ama",
    blurb:
      "Conta gratuita de leitor: salve artistas, receba as novidades num feed silencioso, curta e doe quando quiser.",
  },
  vip: {
    title: "Leia como VIP",
    blurb:
      "Tudo da conta gratuita, mais acesso antecipado às novas obras, notas exclusivas dos artistas e uma taxa menor da plataforma nas suas doações.",
  },
};

const ROLE_LABEL: Record<Role, string> = {
  artist: "Autor",
  vip: "VIP",
  supporter: "Gratuito",
};

function AuthPage() {
  const [role, setRole] = useState<Role>("artist");
  const [mode, setMode] = useState<Mode>("signup");

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
      <div>
        <p className="eyebrow">
          {mode === "signup" ? "Criar uma conta" : "Bem-vindo de volta"}
        </p>
        <h1 className="mt-5 font-display text-5xl leading-tight tracking-tight sm:text-6xl">
          {copy[role].title}
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
          {copy[role].blurb}
        </p>
        <ul className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
          <li>Nenhuma publicidade, nunca — o feed é só obra.</li>
          <li>88% da receita de cliques e das doações vai para o artista.</li>
          <li>Pagamentos semanais, sem valor mínimo.</li>
        </ul>
      </div>

      <div className="border border-border bg-surface p-7 sm:p-9">
        <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
          {(["supporter", "vip", "artist"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`bg-background py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
                role === r ? "text-gilt" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            toast.success(
              mode === "signup"
                ? `Conta ${ROLE_LABEL[role]} criada (demonstração).`
                : "Sessão iniciada (demonstração).",
            );
          }}
        >
          {mode === "signup" && (
            <Field label="Nome completo" type="text" placeholder="Seu nome" />
          )}
          {mode === "signup" && role === "artist" && (
            <Field label="Área de atuação" type="text" placeholder="Pintor, ensaísta, compositor…" />
          )}
          <Field label="E-mail" type="email" placeholder="voce@ateliê.com" />
          <Field label="Senha" type="password" placeholder="••••••••" />

          <button
            type="submit"
            className="w-full bg-primary py-3 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90"
          >
            {mode === "signup"
              ? role === "artist"
                ? "Criar conta de autor"
                : role === "vip"
                  ? "Criar conta VIP"
                  : "Criar conta gratuita"
              : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="mt-6 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signup"
            ? "Já tem uma conta? Entre aqui"
            : "Novo no The Beyond? Crie uma conta"}
        </button>
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
