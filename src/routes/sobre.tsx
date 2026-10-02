import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Quem Somos | The Beyond — Plataforma Editorial Independente" },
      {
        name: "description",
        content:
          "O The Beyond é uma plataforma digital de leitura e publicação autoral — editora, distribuidora e produtora digital para novos talentos. Leia de graça e apoie quem escreve.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Quem Somos | The Beyond" },
      {
        property: "og:description",
        content: "Uma vitrine para novos talentos autorais: leitura gratuita, curadoria da equipe e apoio direto a quem escreve.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/sobre` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/sobre` }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">O projeto</p>
      <h1 className="hero-type mt-5 text-5xl tracking-tight">
        Um lugar para novos talentos serem lidos — e apoiados.
      </h1>

      <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
        <p>
          O The Beyond começou como um projeto de estudos e de uma constatação: muita gente escreve
          bem no Brasil e não publica, porque o caminho tradicional fica com a maior parte do lucro.
          Aqui, a obra é do autor — e a maior parte da receita também.
        </p>
        <p>
          A leitura é gratuita. O modo grátis é mantido por anúncios; quem assina os planos Fã e
          Super Fã lê sem anúncios. E quem gostar de um autor pode apoiá-lo diretamente, para que
          ele continue criando.
        </p>
        <p>
          A entrada é por curadoria: a equipe avalia cada obra — qualidade, respeito aos direitos
          autorais e às regras da plataforma — antes de ela ir ao ar. Somos editora, distribuidora
          e produtora digital ao mesmo tempo, com um objetivo: dar perspectiva a quem cria.
        </p>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
        {[
          { k: "Grátis", v: "para ler" },
          { k: "6 meses", v: "de exclusividade, renovável" },
          { k: "Semanal", v: "repasse ao autor, sem mínimo" },
        ].map((s) => (
          <div key={s.k} className="bg-background p-7">
            <p className="font-display text-3xl tracking-tight text-gilt">{s.k}</p>
            <p className="caption mt-2">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link
          to="/candidatura-autor"
          className="btn-type bg-primary px-6 py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90"
        >
          Entrar na lista de autores
        </Link>
        <Link
          to="/planos"
          className="rule-hover text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver planos de leitor
        </Link>
      </div>
    </div>
  );
}
