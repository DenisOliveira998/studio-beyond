import { createFileRoute, Link } from "@tanstack/react-router";
import { MEDIUM_LABEL, compact, works, type Medium } from "@/lib/beyond-data";

export const Route = createFileRoute("/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar categorias — The Beyond" },
      {
        name: "description",
        content:
          "Percorra as categorias do The Beyond: livros, mangás, HQs e contos autorais, sem anúncios e sem pressa.",
      },
      { property: "og:title", content: "Explorar categorias — The Beyond" },
      {
        property: "og:description",
        content: "Livros, mangás, HQs e contos autorais — uma categoria por vez.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

const MEDIA: Medium[] = ["livro", "manga", "hq", "conto"];

const NOTE: Record<Medium, string> = {
  livro: "Romances, novelas e ficção literária publicados capítulo a capítulo ou completos.",
  manga: "Mangás autorais com roteiro e traço originais — nenhuma adaptação.",
  hq: "Histórias em quadrinhos brasileiras, do noir ao documental, do autobiográfico ao fantástico.",
  conto: "Contos curtos e longas histórias breves — leitura de uma sentada.",
};

function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">Categorias</p>
      <h1 className="hero-type mt-5 max-w-2xl text-5xl tracking-tight">Explorar por categoria</h1>
      <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
        Livros, mangás, HQs e contos autorais — nenhuma recomendação automática. Escolha por onde entrar.
      </p>

      <div className="mt-14 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
        {MEDIA.map((m) => {
          const list = works.filter((w) => w.medium === m);
          const views = list.reduce((s, w) => s + w.clicks, 0);
          return (
            <div key={m} className="bg-background p-8">
              <p className="eyebrow">{list.length} obras · {compact(views)} visualizações</p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-gilt">
                {MEDIUM_LABEL[m]}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{NOTE[m]}</p>
              <ul className="mt-6 space-y-3 border-t border-border pt-5">
                {list.map((w) => (
                  <li key={w.slug}>
                    <Link
                      to="/work/$slug"
                      params={{ slug: w.slug }}
                      className="rule-hover title-italic text-lg transition-colors hover:text-gilt"
                    >
                      {w.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
