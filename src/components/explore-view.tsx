import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MEDIUM_LABEL, VIEWS_DISPLAY_MIN, compact, type Work, type Medium } from "@/lib/beyond-data";
import { stripHtml } from "@/lib/utils";

export const MEDIA: Medium[] = ["livro", "manga", "hq", "conto", "lightnovel", "manhwa", "manhua"];

export function isMedium(value: string): value is Medium {
  return (MEDIA as string[]).includes(value);
}

const NOTE: Record<Medium, string> = {
  livro: "Romances, novelas e ficção literária publicados capítulo a capítulo ou completos.",
  manga: "Mangás autorais com roteiro e traço originais — nenhuma adaptação.",
  hq: "Histórias em quadrinhos brasileiras, do noir ao documental, do autobiográfico ao fantástico.",
  conto: "Contos curtos e longas histórias breves — leitura de uma sentada.",
  lightnovel: "Histórias longas em prosa publicadas por capítulos — webnovels e light novels autorais.",
  manhwa: "Quadrinhos coreanos em formato webtoon — leitura vertical em scroll contínuo.",
  manhua: "Quadrinhos chineses em formato webtoon ou paginado — arte detalhada e narrativa visual.",
};

/** Títulos e descrições das páginas de categoria (/explorar/$categoria). */
/** Texto de apresentação de cada categoria (aparece abaixo do título). */
const INTRO: Record<Medium, string> = {
  livro: "Todos os livros aqui foram escritos por autores independentes e passaram pela curadoria da equipe. Dá para ler online e de graça, direto no navegador, sem baixar nada.",
  manga: "Mangás criados por autores brasileiros, com história e desenho próprios. Cada obra passa pela curadoria antes de ir ao ar, e a leitura é gratuita.",
  hq: "Quadrinhos nacionais de autores independentes, de vários estilos e gêneros. A leitura é online e gratuita, e você pode apoiar quem desenhou.",
  conto: "Histórias curtas para ler numa pausa do dia. Todas são autorais, passaram pela curadoria e podem ser lidas de graça.",
  lightnovel: "Novels e webnovels publicadas por capítulos, para acompanhar a história conforme sai. Leitura online, gratuita e com curadoria.",
  manhwa: "Quadrinhos no formato webtoon, feitos para ler rolando a tela. Leitura online e gratuita, com obras escolhidas pela equipe.",
  manhua: "Quadrinhos no estilo chinês, em formato webtoon ou paginado. Todas as obras passam pela curadoria e podem ser lidas de graça.",
};

export const CATEGORY_SEO: Record<Medium, { h1: string; title: string; description: string }> = {
  livro: {
    h1: "Livros autorais",
    title: "Livros autorais brasileiros para ler online | Go Beyondd",
    description: "Leia livros autorais online, de graça, com foco em autores brasileiros. Romances e ficção independente com curadoria na Go Beyondd.",
  },
  manga: {
    h1: "Mangás brasileiros",
    title: "Mangás brasileiros autorais para ler online | Go Beyondd",
    description: "Leia mangás brasileiros autorais online, de graça. Roteiro e traço originais de mangakás independentes, com curadoria da Go Beyondd.",
  },
  hq: {
    h1: "HQs nacionais",
    title: "HQs nacionais independentes para ler online | Go Beyondd",
    description: "Leia HQs nacionais independentes online, de graça. Quadrinhos brasileiros autorais selecionados pela curadoria da Go Beyondd.",
  },
  conto: {
    h1: "Contos",
    title: "Contos autorais brasileiros para ler online | Go Beyondd",
    description: "Leia contos autorais online, de graça, com foco em autores brasileiros. Histórias curtas para ler de uma sentada, com curadoria.",
  },
  lightnovel: {
    h1: "Novels",
    title: "Novels e webnovels autorais para ler online | Go Beyondd",
    description: "Leia novels e webnovels autorais online, de graça. Histórias longas em prosa, por capítulos, de autores independentes na Go Beyondd.",
  },
  manhwa: {
    h1: "Manhwas",
    title: "Manhwas em formato webtoon para ler online | Go Beyondd",
    description: "Leia manhwas em formato webtoon online, de graça, com leitura vertical em scroll contínuo na Go Beyondd.",
  },
  manhua: {
    h1: "Manhuas",
    title: "Manhuas para ler online | Go Beyondd",
    description: "Leia manhuas online, de graça, em formato webtoon ou paginado na Go Beyondd.",
  },
};

export const ITEMS_PER_PAGE = 20;

/** Lista de obras de /explorar (todas) e /explorar/$categoria (uma categoria). */
export function ExploreView({
  medium,
  initialWorks,
  page: pageParam = 1,
  basePath,
}: {
  medium?: Medium;
  initialWorks: Work[];
  /** Página atual (vem de ?pagina= na URL — links reais, indexáveis) */
  page?: number;
  /** Caminho da listagem atual, ex.: "/explorar" ou "/explorar/manga" */
  basePath: string;
}) {
  const navigate = useNavigate();
  const [tagFilter, setTagFilterState] = useState<string | null>(null);
  const [sort, setSortState] = useState<"views" | "date">("date");

  // Mudar filtro/ordem volta para a página 1
  function resetPage() {
    if (pageParam > 1) void navigate({ to: basePath as never, search: {} as never, replace: true });
  }
  function setTagFilter(value: string | null | ((prev: string | null) => string | null)) {
    setTagFilterState(value);
    resetPage();
  }
  function setSort(value: "views" | "date") {
    setSortState(value);
    resetPage();
  }

  const { data: works = [] } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => fetch("/api/works").then((r) => r.json() as Promise<Work[]>),
    staleTime: 60_000,
    initialData: initialWorks,
  });

  // Reset tag filter when switching medium
  useEffect(() => {
    setTagFilterState(null);
  }, [medium]);

  const mediumFiltered = medium ? works.filter((w) => w.medium === medium) : works;
  const tagFiltered = tagFilter
    ? mediumFiltered.filter((w) => w.tags?.includes(tagFilter))
    : mediumFiltered;
  const filtered = [...tagFiltered].sort((a, b) =>
    sort === "date"
      ? (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
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

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const page = Math.min(Math.max(1, pageParam), Math.max(totalPages, 1));
  const pageSearch = (n: number) => (n > 1 ? { pagina: n } : {}) as never;
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const pillCls = (active: boolean) =>
    `border px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
      active
        ? "border-gilt text-gilt"
        : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
    }`;

  return (
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <p className="eyebrow">Categorias</p>
      <h1 className="hero-type mt-5 max-w-2xl text-5xl tracking-tight">
        {medium ? CATEGORY_SEO[medium].h1 : "Explorar por categoria"}
      </h1>
      <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
        {medium
          ? NOTE[medium]
          : "Livros, mangás, HQs e contos autorais — nenhuma recomendação automática. Escolha por onde entrar."}
      </p>
      {medium && <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground/80">{INTRO[medium]}</p>}

      {/* Categorias — links reais (indexáveis) */}
      <nav aria-label="Categorias" className="mt-10 flex flex-wrap gap-2">
        <Link to="/explorar" className={pillCls(!medium)}>
          Tudo
        </Link>
        {MEDIA.map((m) => (
          <Link key={m} to="/explorar/$categoria" params={{ categoria: m }} className={pillCls(medium === m)}>
            {MEDIUM_LABEL[m]}
          </Link>
        ))}
      </nav>

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
          {filtered.length} {filtered.length === 1 ? "obra" : "obras"}
          {totalViews >= VIEWS_DISPLAY_MIN && <> · {compact(totalViews)} visualizações</>}
          {tagFilter && <span> · tag: {tagFilter}</span>}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSort("date")}
            className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors ${sort === "date" ? "text-gilt" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
          >
            Recente
          </button>
          <span className="text-border">|</span>
          <button
            onClick={() => setSort("views")}
            className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors ${sort === "views" ? "text-gilt" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
          >
            Popular
          </button>
        </div>
      </div>

      <h2 className="mt-10 font-display text-lg font-bold">
        {medium ? `Catálogo de ${CATEGORY_SEO[medium].h1}` : "Catálogo completo"}
      </h2>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {paginated.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {tagFilter
              ? `Nenhuma obra com a tag "${tagFilter}"${medium ? ` em ${MEDIUM_LABEL[medium]}` : ""}.`
              : "Nenhuma obra aqui ainda."}
          </p>
        ) : (
          paginated.map((w) => (
            <Link
              key={w.slug}
              to="/obra/$slug"
              params={{ slug: w.slug }}
              className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-surface/50 sm:px-3"
            >
              {w.cover && (
                <img
                  width={36} height={56}
                  src={w.cover}
                  alt={`Capa de ${stripHtml(w.title)}`}
                  className="h-14 w-9 shrink-0 object-cover bg-surface"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <h3 className="title-italic text-xl group-hover:text-gilt">{stripHtml(w.title)}</h3>
                  {!medium && (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
                      {MEDIUM_LABEL[w.medium]}
                    </span>
                  )}
                  {w.genre && (
                    <span className="shrink-0 text-xs text-muted-foreground">{w.genre}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{stripHtml(w.excerpt)}</p>
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
              {w.clicks >= VIEWS_DISPLAY_MIN && (
                <span className="shrink-0 text-xs text-muted-foreground">{compact(w.clicks)} visualizações</span>
              )}
            </Link>
          ))
        )}
      </div>

      {/* Paginação — links reais (?pagina=N) para o Google seguir */}
      {totalPages > 1 && (
        <nav aria-label="Paginação" className="mt-10 flex items-center justify-center gap-1">
          {page > 1 ? (
            <Link
              to={basePath as never}
              search={pageSearch(page - 1)}
              rel="prev"
              className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground opacity-30" aria-hidden>
              <ChevronLeft className="size-3.5" />
            </span>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "…" ? (
                <span key={`sep-${idx}`} className="px-1 text-xs text-muted-foreground/50">…</span>
              ) : (
                <Link
                  key={p}
                  to={basePath as never}
                  search={pageSearch(p as number)}
                  aria-current={page === p ? "page" : undefined}
                  className={`flex h-8 w-8 items-center justify-center border text-xs transition-colors ${
                    page === p
                      ? "border-gilt text-gilt"
                      : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
                  }`}
                >
                  {p}
                </Link>
              )
            )}

          {page < totalPages ? (
            <Link
              to={basePath as never}
              search={pageSearch(page + 1)}
              rel="next"
              className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
              aria-label="Próxima página"
            >
              <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground opacity-30" aria-hidden>
              <ChevronRight className="size-3.5" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

/** Lê ?pagina= (número inteiro ≥ 1); valores inválidos viram 1. */
export function parsePagina(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
