import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { MEDIUM_LABEL, type Work, type Medium } from "@/lib/beyond-data";
import type { CarouselItemData, ReaderProfileStats, ArtistSummary } from "@/lib/beyond-db";
import { useAuth } from "@/lib/auth";
import { stripHtml } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Beyond — Leia Livros, Mangás, HQs e Contos Autorais" },
      {
        name: "description",
        content:
          "Descubra livros, mangás, HQs e contos autorais brasileiros. O The Beyond paga autores por visualização e permite apoio direto. Sem anúncios, sem interrupções.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "The Beyond — Livros, Mangás, HQs e Contos Autorais" },
      {
        property: "og:description",
        content:
          "Plataforma de publicação independente com curadoria humana. Livros, mangás, HQs e contos — sem anúncios, sem interrupções.",
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

// ── Carrossel (coluna direita do hero) ──────────────────────────

type SlideItem =
  | { kind: "db"; item: CarouselItemData }
  | { kind: "work"; work: Work };

function HeroCarousel({ works }: { works: Work[] }) {
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);

  const { data: dbItems = [] } = useQuery<CarouselItemData[]>({
    queryKey: ["carousel"],
    queryFn: () => fetch("/api/carousel").then((r) => r.json() as Promise<CarouselItemData[]>),
    staleTime: 60_000,
  });

  const featuredFallback = [...works].slice(0, 5);
  const slides: SlideItem[] =
    dbItems.filter((i) => i.active).length > 0
      ? dbItems.filter((i) => i.active).map((item) => ({ kind: "db" as const, item }))
      : featuredFallback.map((work) => ({ kind: "work" as const, work }));
  const count = slides.length;

  useEffect(() => {
    if (paused || count === 0) return;
    const t = setInterval(() => setCur((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [paused, count]);

  const prev = () => setCur((i) => (i - 1 + count) % count);
  const next = () => setCur((i) => (i + 1) % count);

  if (count === 0) {
    return (
      <div className="flex aspect-square max-h-[520px] flex-col items-center justify-center gap-3 border border-gilt/15 bg-gradient-to-b from-gilt/5 to-transparent">
        <span className="font-display text-5xl font-bold text-gilt/10">EM BREVE</span>
        <span className="eyebrow text-gilt/20">obras em destaque</span>
      </div>
    );
  }

  return (
    <div
      className="relative select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      <div className="relative overflow-hidden">
        {slides.map((slide, i) => {
          const isDb = slide.kind === "db";
          const title = isDb ? slide.item.title : stripHtml(slide.work.title);
          const imgUrl = isDb ? (slide.item.imageUrl ?? "") : (slide.work.cover ?? "");
          const linkUrl = isDb ? (slide.item.linkUrl ?? "#") : `/work/${slide.work.slug}`;

          return (
            <div
              key={isDb ? slide.item.id : slide.work.id}
              aria-hidden={i !== cur}
              className={`transition-opacity duration-700 ${
                i === cur ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
              }`}
            >
              <a href={linkUrl} className="group block">
                {imgUrl ? (
                  <div className="aspect-square w-full max-h-[520px] overflow-hidden border border-gilt/20 bg-surface">
                    <img
                      src={imgUrl}
                      alt={title}
                      className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <div className="aspect-square w-full max-h-[520px] border border-gilt/15 bg-gradient-to-b from-gilt/5 to-transparent" />
                )}
              </a>
            </div>
          );
        })}
      </div>

      {/* Controles */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCur(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-px transition-all duration-300 ${
                i === cur ? "w-8 bg-gilt" : "w-4 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={prev}
            aria-label="Anterior"
            className="border border-border p-1.5 text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={next}
            aria-label="Próximo"
            className="border border-border p-1.5 text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card compacto (retrato 3/4) ──────────────────────────────────

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
  const badgeCls = {
    HOT: "border-red-500/50 bg-red-950/80 text-red-300",
    NEW: "border-gilt/50 bg-background/80 text-gilt",
    NOVO: "border-gilt bg-gilt text-ink font-bold",
  };

  return (
    <Link to="/work/$slug" params={{ slug: work.slug }} className="group block">
      <div className="relative overflow-hidden">
        {work.cover ? (
          <img
            src={work.cover}
            alt={cleanTitle}
            loading="lazy"
            className="aspect-[3/4] w-full object-contain bg-surface transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="aspect-[3/4] flex flex-col items-center justify-center gap-1 border border-gilt/15 bg-gradient-to-b from-gilt/5 to-transparent">
            <span className="font-display text-2xl font-bold text-gilt/20">
              {MEDIUM_LABEL[work.medium].slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[9px] uppercase tracking-[0.12em] text-gilt/25">
              {MEDIUM_LABEL[work.medium]}
            </span>
          </div>
        )}
        {badge && (
          <span className={`absolute left-2 top-2 border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${badgeCls[badge]}`}>
            {badge}
          </span>
        )}
        {pagesRead !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/50">
            <div
              className="h-full bg-gilt transition-all"
              style={{ width: `${work.pages ? Math.min(Math.round((pagesRead / work.pages) * 100), 100) : Math.min(pagesRead, 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-bold leading-tight text-foreground line-clamp-2 transition-colors group-hover:text-gilt">
          {cleanTitle}
        </p>
        {work.artistName && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{work.artistName}</p>
        )}
      </div>
    </Link>
  );
}

// ── Linha de categoria ───────────────────────────────────────────

function CategoryRow({
  label,
  works,
  to,
  badges = {},
}: {
  label: string;
  works: Work[];
  to?: string;
  badges?: Record<string, "HOT" | "NEW" | "NOVO">;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const dragDist = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [works]);

  const SCROLL_STEP = 340;

  const arrowCls =
    "absolute top-[calc(50%-12px)] z-10 flex h-7 w-7 items-center justify-center border border-border bg-surface/95 text-muted-foreground shadow-sm transition-colors hover:border-gilt hover:text-gilt";

  if (works.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight">{label}</h2>
        {to && (
          <a
            href={to}
            className="text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-gilt"
          >
            Ver tudo →
          </a>
        )}
      </div>

      <div className="relative">
        {canLeft && (
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -SCROLL_STEP, behavior: "smooth" })}
            className={`${arrowCls} -left-3 lg:-left-4`}
            aria-label="Anterior"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-3 select-none sm:-mx-10 sm:px-10 lg:mx-0 lg:px-0 lg:pb-0 lg:gap-4"
          style={{ scrollbarWidth: "none", cursor: dragging ? "grabbing" : "grab" }}
          onMouseDown={(e) => {
            isDragging.current = true;
            dragDist.current = 0;
            setDragging(true);
            dragStartX.current = e.clientX;
            dragScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
          }}
          onMouseMove={(e) => {
            if (!isDragging.current || !scrollRef.current) return;
            const dx = e.clientX - dragStartX.current;
            dragDist.current = Math.abs(dx);
            scrollRef.current.scrollLeft = dragScrollLeft.current - dx;
          }}
          onMouseUp={() => { isDragging.current = false; setDragging(false); }}
          onMouseLeave={() => { isDragging.current = false; setDragging(false); }}
          onClickCapture={(e) => { if (dragDist.current > 5) e.stopPropagation(); }}
        >
          {works.slice(0, 12).map((work) => {
            const b = badges[work.slug];
            return (
              <div key={work.id} className="w-[140px] shrink-0 sm:w-[160px] lg:w-[180px]">
                {b ? <CatalogCard work={work} badge={b} /> : <CatalogCard work={work} />}
              </div>
            );
          })}
        </div>

        {canRight && (
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: SCROLL_STEP, behavior: "smooth" })}
            className={`${arrowCls} -right-3 lg:-right-4`}
            aria-label="Próximo"
          >
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
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
  const { user, role } = useAuth();
  const { data: works = [] } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => fetch("/api/works").then((r) => r.json() as Promise<Work[]>),
    staleTime: 60_000,
  });

  const { data: artists = [] } = useQuery<ArtistSummary[]>({
    queryKey: ["artists"],
    queryFn: () => fetch("/api/artists").then((r) => r.json() as Promise<ArtistSummary[]>),
    staleTime: 60_000,
  });

  // Badges: HOT = top 30% em views com pelo menos 3 visualizações | NEW = < 5 views
  const sorted = [...works].sort((a, b) => b.clicks - a.clicks);
  const hotCount = Math.max(1, Math.ceil(works.length * 0.3));
  const hotSlugs = new Set(sorted.slice(0, hotCount).filter((w) => w.clicks >= 3).map((w) => w.slug));
  const newSlugs = new Set(works.filter((w) => w.clicks < 5 && !hotSlugs.has(w.slug)).map((w) => w.slug));

  function badges(list: Work[]): Record<string, "HOT" | "NEW"> {
    const out: Record<string, "HOT" | "NEW"> = {};
    for (const w of list) {
      if (hotSlugs.has(w.slug)) out[w.slug] = "HOT";
      else if (newSlugs.has(w.slug)) out[w.slug] = "NEW";
    }
    return out;
  }

  const sections = [
    {
      key: "em-alta",
      label: "🔥 Em alta",
      works: sorted.slice(0, 6),
      to: "/explorar" as const,
    },
    ...MEDIA.map((m) => ({
      key: m,
      label: MEDIUM_LABEL[m],
      works: works.filter((w) => w.medium === m),
      to: `/explorar?m=${m}`,
    })),
    {
      key: "novidades",
      label: "★ Novidades",
      works: [...works].reverse().slice(0, 6),
      to: "/explorar" as const,
    },
  ].filter((s) => s.works.length > 0);

  return (
    <div>
      {/* Hero + Carrossel lado a lado */}
      <section className="border-b border-border/70">
        <div className="grid items-center gap-10 px-5 py-16 sm:px-10 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-24">
          {/* Texto */}
          <div>
            <p className="eyebrow">Sem anúncios · Sem banners · Sem interrupções</p>
            <h1 className="hero-type mt-6 text-4xl sm:text-5xl xl:text-6xl">
              Um espaço silencioso para livros, mangás, HQs e contos que merecem ser lidos por mais tempo.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              O The Beyond paga os artistas por cada visualização que a obra conquista e permite que
              qualquer pessoa envie apoio direto ao ateliê. Ficamos com 12%. O resto é de quem cria.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                to={
                  !user
                    ? "/entrar"
                    : (["author", "admin", "gerente", "owner"] as const).includes(role as "author" | "admin" | "gerente" | "owner")
                    ? "/dashboard"
                    : "/candidatura-autor"
                }
                className="btn-type bg-primary px-6 py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90"
              >
                Publique sua obra
              </Link>
              <Link to="/artists" className="rule-hover text-sm text-muted-foreground transition-colors hover:text-foreground">
                Explorar artistas
              </Link>
            </div>
          </div>
          {/* Carrossel */}
          <div className="w-full">
            <HeroCarousel works={works} />
          </div>
        </div>
      </section>

      {/* Continue lendo */}
      <ContinueReading works={works} />

      {/* Catálogo por categoria */}
      <section className="px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="flex flex-col gap-12">
          {sections.map((s) => (
            <CategoryRow
              key={s.key}
              label={s.label}
              works={s.works}
              to={s.to}
              badges={badges(s.works)}
            />
          ))}
        </div>
      </section>

      {/* Artistas */}
      {artists.length > 0 && (
        <section className="border-t border-border/70 px-5 py-16 sm:px-10 lg:px-14">
          <h2 className="font-display text-2xl font-bold">Artistas residentes</h2>
          <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {artists.map((a) => (
              <Link
                key={a.slug}
                to="/artist/$slug"
                params={{ slug: a.slug }}
                className="group bg-background p-6 transition-colors hover:bg-surface"
              >
                <p className="eyebrow">{a.workCount} {a.workCount === 1 ? "obra" : "obras"}</p>
                <p className="mt-3 font-display text-lg font-bold group-hover:text-gilt">{a.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
