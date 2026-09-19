import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MEDIUM_LABEL, compact, type Work, type Medium } from "@/lib/beyond-data";
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
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<"views" | "date">("views");
  const [loading, setLoading] = useState(false);

  // Read ?m= search param on first render to pre-select the medium
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (m && (MEDIA as string[]).includes(m)) {
      setFilter(m as Medium);
    }
  }, []);

  const { data: works = [] } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => fetch("/api/works").then((r) => r.json() as Promise<Work[]>),
    staleTime: 60_000,
  });

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(t);
  }, [filter]);

  // Reset tag filter when switching medium
  useEffect(() => {
    setTagFilter(null);
  }, [filter]);

  const mediumFiltered = filter === ALL ? works : works.filter((w) => w.medium === filter);
  const tagFiltered = tagFilter
    ? mediumFiltered.filter((w) => w.tags?.includes(tagFilter))
    : mediumFiltered;
  const filtered = [...tagFiltered].sort((a, b) =>
    sort === "date"
      ? new Date(b.published).getTime() - new Date(a.published).getTime()
      : b.clicks - a.clicks
  );

  const totalViews = filtered.reduce((s, w) => s + w.clicks, 0);

  // Collect unique tags from the medium-filtered works
  const availableTags = Array.from(
    new Set(mediumFiltered.flatMap((w) => w.tags ?? []))
  ).sort();

  const tagCounts = Object.fromEntries(
    availableTags.map((tag) => [tag, mediumFiltered.filter((w) => w.tags?.includes(tag)).length])
  );

  function changeFilter(m: FilterType) {
    setFilter(m);
    setLoading(true);
    // Clear the URL search param so the browser doesn't re-apply it on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete("m");
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <p className="eyebrow">Categorias</p>
      <h1 className="hero-type mt-5 max-w-2xl text-5xl tracking-tight">Explorar por categoria</h1>
      <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
        Livros, mangás, HQs e contos autorais — nenhuma recomendação automática. Escolha por onde entrar.
      </p>

      {/* Medium filter */}
      <div className="mt-10 flex flex-wrap gap-2">
        {([ALL, ...MEDIA] as FilterType[]).map((m) => (
          <button
            key={m}
            onClick={() => changeFilter(m)}
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

      {/* Tag filter */}
      {availableTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors ${
                tagFilter === tag
                  ? "border-gilt/60 bg-gilt/10 text-gilt"
                  : "border-border/50 text-muted-foreground/70 hover:border-gilt/40 hover:text-muted-foreground"
              }`}
            >
              {tag} <span className="opacity-50">{tagCounts[tag]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground/60">
          {filtered.length} {filtered.length === 1 ? "obra" : "obras"} · {compact(totalViews)} visualizações
          {tagFilter && <span> · tag: {tagFilter}</span>}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSort("views")}
            className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors ${sort === "views" ? "text-gilt" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
          >
            Popular
          </button>
          <span className="text-border">|</span>
          <button
            onClick={() => setSort("date")}
            className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors ${sort === "date" ? "text-gilt" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
          >
            Recente
          </button>
        </div>
      </div>

      {/* Works list — flat for both ALL and medium-filtered views */}
      {loading ? (
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <WorkCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="mt-10 divide-y divide-border border-y border-border">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tagFilter
                ? `Nenhuma obra com a tag "${tagFilter}"${filter !== ALL ? ` em ${MEDIUM_LABEL[filter as Medium]}` : ""}.`
                : "Nenhuma obra aqui ainda."}
            </p>
          ) : (
            filtered.map((w) => (
              <Link
                key={w.slug}
                to="/work/$slug"
                params={{ slug: w.slug }}
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-surface/50 sm:px-3"
              >
                {w.cover && (
                  <img
                    src={w.cover}
                    alt=""
                    className="h-14 w-9 shrink-0 object-cover bg-surface"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="title-italic text-xl group-hover:text-gilt">{w.title}</span>
                    {filter === ALL && (
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
                        {MEDIUM_LABEL[w.medium]}
                      </span>
                    )}
                    {w.genre && (
                      <span className="shrink-0 text-xs text-muted-foreground">{w.genre}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{w.excerpt}</p>
                  {w.tags && w.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {w.tags.map((t) => (
                        <span
                          key={t}
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${
                            tagFilter === t
                              ? "border-gilt/60 text-gilt"
                              : "border-border/40 text-muted-foreground/60"
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{compact(w.clicks)} views</span>
              </Link>
            ))
          )}
        </div>
      )}

      {filter !== ALL && (
        <p className="mt-12 text-sm text-muted-foreground">
          {NOTE[filter as Medium]}
        </p>
      )}
    </div>
  );
}
