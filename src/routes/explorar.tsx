import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect } from "react";
import { MEDIUM_LABEL, compact, works, type Medium } from "@/lib/beyond-data";
import { WorkCardSkeleton } from "@/components/work-card-skeleton";

export const Route = createFileRoute("/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar Categorias | The Beyond — Livros, Mangás, HQs e Contos" },
      {
        name: "description",
        content:
          "Explore livros, mangás, HQs e contos autorais por categoria. Descubra obras independentes selecionadas pela curadoria do The Beyond — sem anúncios e sem pressa.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Explorar | The Beyond — Livros, Mangás, HQs e Contos" },
      {
        property: "og:description",
        content: "Livros, mangás, HQs e contos autorais brasileiros — explore por categoria no The Beyond.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/explorar` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/explorar` }],
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

const ALL = "Tudo" as const;
type FilterType = typeof ALL | Medium;

function ExplorePage() {
  const [filter, setFilter] = useState<FilterType>(ALL);
  const [loading, setLoading] = useState(false);

  // Breve estado de carregamento ao trocar filtro (skeleton UX)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(t);
  }, [filter]);

  const filtered = filter === ALL ? works : works.filter((w) => w.medium === filter);
  const totalViews = filtered.reduce((s, w) => s + w.clicks, 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">Categorias</p>
      <h1 className="hero-type mt-5 max-w-2xl text-5xl tracking-tight">Explorar por categoria</h1>
      <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
        Livros, mangás, HQs e contos autorais — nenhuma recomendação automática. Escolha por onde entrar.
      </p>

      {/* Filtros */}
      <div className="mt-10 flex flex-wrap gap-2">
        {([ALL, ...MEDIA] as FilterType[]).map((m) => (
          <button
            key={m}
            onClick={() => { setFilter(m); setLoading(true); }}
            className={`border px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
              filter === m
                ? "border-gilt text-gilt"
                : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
            }`}
          >
            {m === ALL ? "Tudo" : MEDIUM_LABEL[m]}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground/60">
        {filtered.length} {filtered.length === 1 ? "obra" : "obras"} · {compact(totalViews)} visualizações
      </p>

      {filter === ALL ? (
        /* Grade por categoria */
        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
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
      ) : loading ? (
        /* Skeleton durante troca de filtro */
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <WorkCardSkeleton key={i} />)}
        </div>
      ) : (
        /* Lista da categoria filtrada */
        <div className="mt-10 divide-y divide-border border-y border-border">
          {filtered.map((w) => (
            <Link
              key={w.slug}
              to="/work/$slug"
              params={{ slug: w.slug }}
              className="group flex items-baseline justify-between gap-6 py-5 transition-colors hover:bg-surface/50 sm:px-3"
            >
              <div>
                <span className="title-italic text-xl group-hover:text-gilt">{w.title}</span>
                {w.genre && <span className="ml-3 text-xs text-muted-foreground">{w.genre}</span>}
                <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{w.excerpt}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{compact(w.clicks)} views</span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-12 text-sm text-muted-foreground">
        {NOTE[filter === ALL ? "livro" : filter]}
      </p>
    </div>
  );
}
