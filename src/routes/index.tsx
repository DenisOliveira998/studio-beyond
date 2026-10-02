import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import {
  MEDIUM_LABEL,
  VIEWS_DISPLAY_MIN,
  WEBTOON_MEDIUMS,
  isRecentWork,
  type Work,
  type Medium,
} from "@/lib/beyond-data";
import type { ReaderProfileStats } from "@/lib/beyond-db";
import { useAuth } from "@/lib/auth";
import { stripHtml } from "@/lib/utils";
import { loaderFetch } from "@/lib/loader-fetch";
import { MEDIUM_COLOR } from "@/lib/medium-color";

export const Route = createFileRoute("/")({
  // Catálogo carregado no servidor: o HTML já sai com obras e links (Google/IA)
  loader: async () => {
    const [works, destaque] = await Promise.all([
      loaderFetch<Work[]>("/api/works", []),
      loaderFetch<string[]>("/api/destaque", []),
    ]);
    return { works, destaque };
  },
  head: () => ({
    meta: [
      { title: "Livros, mangás e HQs autorais para ler grátis | The Beyond" },
      {
        name: "description",
        content:
          "Livros, mangás, HQs, contos e novels autorais, com foco em autores brasileiros. Leia de graça e apoie direto quem escreve.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Livros, mangás e HQs autorais para ler grátis | The Beyond" },
      {
        property: "og:description",
        content:
          "Plataforma de leitura e publicação autoral com curadoria da equipe. Livros, mangás, HQs, contos e novels — leia de graça.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: Home,
});

const MEDIA: Medium[] = ["livro", "manga", "hq", "conto", "lightnovel", "manhwa", "manhua"];
// ── Destaque: vitrine compacta (uma obra por vez, contador "Nº 2") ──

/** Obra com leitor disponível: webtoon (imagens) ou texto com corpo — senão, /ler dá 404. */
function isReadable(work: Work): boolean {
  return work.readable ?? (WEBTOON_MEDIUMS.includes(work.medium) || work.body.length > 0);
}

const STATUS_TEXT = { andamento: "Em andamento", finalizado: "Finalizada", paralisado: "Pausada" } as const;

function DestaqueHero({ works, initialDestaque }: { works: Work[]; initialDestaque: string[] }) {
  const { data: destaqueSlugs = [] } = useQuery<string[]>({
    queryKey: ["destaque"],
    queryFn: () => fetch("/api/destaque").then((r) => r.json() as Promise<string[]>),
    staleTime: 60_000,
    initialData: initialDestaque,
  });

  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);

  // Obras na ordem do destaque; sem destaque definido, as 5 mais lidas
  const slides =
    destaqueSlugs.length > 0
      ? (destaqueSlugs.map((slug) => works.find((w) => w.slug === slug)).filter(Boolean) as Work[])
      : [...works].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
  const count = slides.length;

  useEffect(() => {
    if (paused || count <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setCur((i) => (i + 1) % count), 7000);
    return () => clearInterval(t);
  }, [paused, count]);

  if (count === 0) return null;
  const prev = () => setCur((i) => (i - 1 + count) % count);
  const next = () => setCur((i) => (i + 1) % count);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative overflow-hidden border-b border-border/70"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((work, i) => {
        const title = stripHtml(work.title);
        const tags = (Array.isArray(work.tags) ? work.tags : []).slice(0, 5);
        const color = MEDIUM_COLOR[work.medium];
        const status = STATUS_TEXT[work.workStatus ?? "andamento"] ?? "Em andamento";
        const active = i === cur;
        return (
          <div
            key={work.id}
            aria-hidden={!active}
            className={`transition-opacity duration-500 ${active ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"}`}
          >
            {/* Faixa da capa, desfocada, só no alto do bloco */}
            {work.cover && (
              <div aria-hidden className="absolute inset-x-0 top-0 h-full overflow-hidden">
                <div
                  className="absolute inset-0 scale-110"
                  style={{
                    backgroundImage: `url(${work.cover})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center 30%",
                    filter: "blur(24px) brightness(.35) saturate(1.1)",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
              </div>
            )}

            <div className="relative px-5 pb-6 pt-6 sm:px-10 lg:px-14">
              <h2 className="font-display text-lg font-bold text-white/90">Destaques</h2>

              <div className="mt-4 flex gap-4 sm:gap-6">
                <Link
                  to="/work/$slug"
                  params={{ slug: work.slug }}
                  tabIndex={active ? 0 : -1}
                  className="relative w-[104px] shrink-0 overflow-hidden rounded-md sm:w-[150px] lg:w-[170px]"
                >
                  {work.cover ? (
                    <img
                      src={work.cover}
                      alt={`Capa de ${title}`}
                      width={170}
                      height={240}
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "low"}
                      className="aspect-[17/24] w-full bg-surface object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[17/24] items-center justify-center bg-surface text-xs text-muted-foreground">
                      {MEDIUM_LABEL[work.medium]}
                    </div>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    to="/work/$slug"
                    params={{ slug: work.slug }}
                    tabIndex={active ? 0 : -1}
                    className="font-display text-xl font-bold leading-tight text-white line-clamp-3 hover:underline sm:text-3xl lg:text-4xl"
                  >
                    {title}
                  </Link>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-bold leading-tight"
                      style={{ backgroundColor: color.bg, color: color.ink }}
                    >
                      {MEDIUM_LABEL[work.medium]}
                    </span>
                    {isRecentWork(work) && (
                      <span className="rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold leading-tight text-ink">Novo</span>
                    )}
                    {tags.map((t) => (
                      <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] leading-tight text-white/80">
                        {t}
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 hidden max-w-2xl text-sm leading-relaxed text-white/75 line-clamp-3 sm:block">
                    {stripHtml(work.excerpt)}
                  </p>

                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
                    <p className="text-sm italic text-white/70">
                      {work.artistName}
                      <span className="not-italic text-white/45">. {status}</span>
                    </p>
                    <Link
                      to={isReadable(work) ? "/ler/$slug" : "/work/$slug"}
                      params={{ slug: work.slug }}
                      tabIndex={active ? 0 : -1}
                      className="hidden rounded-full bg-gilt px-5 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90 sm:inline-block"
                    >
                      Começar a ler
                    </Link>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-white/75 line-clamp-3 sm:hidden">{stripHtml(work.excerpt)}</p>
            </div>
          </div>
        );
      })}

      {/* Contador e setas, como na MangaDex */}
      {count > 1 && (
        <div className="absolute right-5 top-6 z-10 flex items-center gap-1 sm:right-10 lg:right-14">
          <span className="mr-2 text-sm font-bold tabular-nums text-white/85" aria-live="polite">
            Nº {cur + 1}
          </span>
          <button
            type="button"
            onClick={prev}
            aria-label="Destaque anterior"
            className="flex size-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Próximo destaque"
            className="flex size-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </section>
  );
}

// ── Card compacto (retrato 3/4) ──────────────────────────────────

const BADGE_LABEL = { HOT: "Em alta", NEW: "Novo", NOVO: "Atualizado" } as const;

function CatalogCard({
  work,
  badge,
  pagesRead,
}: {
  work: Work;
  badge?: "HOT" | "NEW" | "NOVO";
  pagesRead?: number;
}) {
  const cleanTitle = stripHtml(work.title);
  const color = MEDIUM_COLOR[work.medium];

  return (
    <Link to="/work/$slug" params={{ slug: work.slug }} className="group block">
      <div className="relative overflow-hidden rounded-md">
        {work.cover ? (
          <img
            width={180} height={240}
            src={work.cover}
            alt={`Capa de ${cleanTitle}`}
            loading="lazy"
            className="aspect-[3/4] w-full object-cover object-center bg-surface"
          />
        ) : (
          <div className="aspect-[3/4] flex items-center justify-center bg-surface">
            <span className="font-display text-sm text-muted-foreground/50">{MEDIUM_LABEL[work.medium]}</span>
          </div>
        )}
        {/* Selo da categoria, na cor dela */}
        <span
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[11px] font-bold leading-tight shadow-sm"
          style={{ backgroundColor: color.bg, color: color.ink }}
        >
          {MEDIUM_LABEL[work.medium]}
        </span>
        {badge && (
          <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] leading-tight text-white">
            {BADGE_LABEL[badge]}
          </span>
        )}
        {pagesRead !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-white"
              style={{ width: `${work.pages ? Math.min(Math.round((pagesRead / work.pages) * 100), 100) : Math.min(pagesRead, 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-sm font-bold leading-tight text-foreground line-clamp-2 group-hover:underline">
          {cleanTitle}
        </p>
        {work.artistName && (
          <p className="mt-0.5 text-xs text-muted-foreground">{work.artistName}</p>
        )}
      </div>
    </Link>
  );
}

// ── Catálogo: um bloco só, com as categorias como filtro ─────────

const PAGE_SIZE = 32;

function CatalogGrid({ works, badges }: { works: Work[]; badges: Record<string, "HOT" | "NEW"> }) {
  const [filter, setFilter] = useState<Medium | "all">("all");
  const [page, setPage] = useState(1);

  const counts = new Map<Medium, number>();
  for (const w of works) counts.set(w.medium, (counts.get(w.medium) ?? 0) + 1);
  const mediums = MEDIA.filter((m) => counts.has(m));

  const list = [...(filter === "all" ? works : works.filter((w) => w.medium === filter))].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function choose(f: Medium | "all") {
    setFilter(f);
    setPage(1);
  }

  function goTo(n: number) {
    setPage(n);
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (works.length === 0) return null;

  return (
    <section id="catalogo" className="scroll-mt-20 px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
      <h2 className="font-display text-2xl font-bold tracking-tight">Catálogo</h2>

      <div role="group" aria-label="Filtrar por categoria" className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => choose("all")}
          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
            filter === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Todas
        </button>
        {mediums.map((m) => {
          const active = filter === m;
          const color = MEDIUM_COLOR[m];
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => choose(active ? "all" : m)}
              className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors"
              style={
                active
                  ? { backgroundColor: color.bg, borderColor: color.bg, color: color.ink }
                  : { borderColor: "var(--border)" }
              }
            >
              {!active && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color.bg }} />}
              <span className={active ? "font-bold" : "text-muted-foreground"}>{MEDIUM_LABEL[m]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {shown.map((w) => (
          <CatalogCard key={w.id} work={w} {...(badges[w.slug] ? { badge: badges[w.slug] } : {})} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Páginas do catálogo" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => goTo(n)}
              aria-current={n === current ? "page" : undefined}
              aria-label={`Página ${n}`}
              className={`flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                n === current
                  ? "bg-foreground font-bold text-background"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}

// ── Continue Lendo ───────────────────────────────────────────────

function ContinueReading({ works }: { works: Work[] }) {
  const { user, loading } = useAuth();
  const [hasUpdates, setHasUpdates] = useState<Record<string, boolean>>({});

  const { data: stats } = useQuery<ReaderProfileStats>({
    queryKey: ["profile-stats"],
    queryFn: () => fetch("/api/profile/stats").then((r) => r.json() as Promise<ReaderProfileStats>),
    enabled: !!user,
    staleTime: 60_000,
  });

  const inProgress = (stats?.progress ?? [])
    .filter((p) => !p.finished && p.pagesRead > 0)
    .slice(0, 8)
    .map((p) => {
      const work = works.find((w) => w.slug === p.workSlug);
      return work ? { work, pagesRead: p.pagesRead } : null;
    })
    .filter(Boolean) as { work: Work; pagesRead: number }[];

  // Detecta obras atualizadas desde a última visita
  useEffect(() => {
    const updates: Record<string, boolean> = {};
    for (const { work } of inProgress) {
      try {
        const lastRead = localStorage.getItem(`beyond_last_read_${work.slug}`);
        if (lastRead && work.updatedAt && new Date(work.updatedAt) > new Date(lastRead)) {
          updates[work.slug] = true;
        }
      } catch {}
    }
    setHasUpdates(updates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress.length]);

  if (loading || !user || !inProgress.length) return null;

  // Obras com update sobem pro topo
  const sorted = [...inProgress].sort((a, b) => {
    const aUp = hasUpdates[a.work.slug] ? 1 : 0;
    const bUp = hasUpdates[b.work.slug] ? 1 : 0;
    return bUp - aUp;
  });

  return (
    <section className="border-b border-border/70 bg-surface/40">
      <div className="px-5 py-8 sm:px-10 lg:px-14">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="size-4 text-gilt" strokeWidth={1.5} />
          <p className="eyebrow">Continue lendo</p>
        </div>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
          {sorted.map(({ work, pagesRead }) => (
            <div key={work.id} className="w-[130px] shrink-0 sm:w-[150px]">
              {hasUpdates[work.slug] ? (
                <CatalogCard work={work} badge="NOVO" pagesRead={pagesRead} />
              ) : (
                <CatalogCard work={work} pagesRead={pagesRead} />
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {work.pages ? `${Math.min(Math.round((pagesRead / work.pages) * 100), 100)}% lido` : `${pagesRead} p. lidas`}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Home ─────────────────────────────────────────────────────────

function Home() {
  const initial = Route.useLoaderData();
  const { data: works = [] } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => fetch("/api/works").then((r) => r.json() as Promise<Work[]>),
    staleTime: 60_000,
    initialData: initial.works,
  });

  // Badges: HOT = top 30% em views (mín. VIEWS_DISPLAY_MIN) | NEW ("Novo") = publicada há < 14 dias
  const sorted = [...works].sort((a, b) => b.clicks - a.clicks);
  const hotCount = Math.max(1, Math.ceil(works.length * 0.3));
  const hotSlugs = new Set(
    sorted.slice(0, hotCount).filter((w) => w.clicks >= VIEWS_DISPLAY_MIN).map((w) => w.slug),
  );
  const newSlugs = new Set(works.filter((w) => isRecentWork(w) && !hotSlugs.has(w.slug)).map((w) => w.slug));

  function badges(list: Work[]): Record<string, "HOT" | "NEW"> {
    const out: Record<string, "HOT" | "NEW"> = {};
    for (const w of list) {
      if (hotSlugs.has(w.slug)) out[w.slug] = "HOT";
      else if (newSlugs.has(w.slug)) out[w.slug] = "NEW";
    }
    return out;
  }

  return (
    <div>
      {/* H1 só para leitores de tela e buscadores — o topo visível é o Destaque */}
      <h1 className="sr-only">The Beyond — livros, mangás, HQs, contos e novels autorais para ler de graça</h1>

      {/* Destaque Beyond — hero carousel */}
      <DestaqueHero works={works} initialDestaque={initial.destaque} />

      {/* Continue lendo */}
      <ContinueReading works={works} />

      {/* Catálogo: um bloco só, filtrado por categoria */}
      <CatalogGrid works={works} badges={badges(works)} />

    </div>
  );
}
