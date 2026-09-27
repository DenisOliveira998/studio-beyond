import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, BookOpen, Eye } from "lucide-react";
import { MEDIUM_LABEL, type Work, type Medium } from "@/lib/beyond-data";
import type { ReaderProfileStats } from "@/lib/beyond-db";
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

// ── Destaque Beyond — hero carousel full-width ──────────────────

function DestaqueHero({ works }: { works: Work[] }) {
  const { data: destaqueSlugs = [] } = useQuery<string[]>({
    queryKey: ["destaque"],
    queryFn: () => fetch("/api/destaque").then((r) => r.json() as Promise<string[]>),
    staleTime: 60_000,
  });

  const [activeMedium, setActiveMedium] = useState<Medium | "all">("all");
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);

  // Works em ordem do destaque; fallback: top 5 por cliques
  const destaqueWorks =
    destaqueSlugs.length > 0
      ? (destaqueSlugs.map((slug) => works.find((w) => w.slug === slug)).filter(Boolean) as Work[])
      : [...works].sort((a, b) => b.clicks - a.clicks).slice(0, 5);

  const availableMediums = [...new Set(destaqueWorks.map((w) => w.medium))];

  const slides =
    activeMedium === "all" ? destaqueWorks : destaqueWorks.filter((w) => w.medium === activeMedium);
  const count = slides.length;

  useEffect(() => { setCur(0); }, [activeMedium]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => setCur((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [paused, count]);

  const prev = () => setCur((i) => (i - 1 + count) % count);
  const next = () => setCur((i) => (i + 1) % count);

  function isNew(work: Work) {
    try { return Date.now() - new Date(work.published).getTime() < 14 * 86_400_000; }
    catch { return false; }
  }

  if (works.length === 0) return null;

  return (
    <section className="border-b border-border/70">
      {/* Pills de categoria */}
      {availableMediums.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-border/40 px-5 py-3 sm:px-10 lg:px-14">
          <button
            onClick={() => setActiveMedium("all")}
            className={`border px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
              activeMedium === "all"
                ? "border-gilt bg-gilt text-ink"
                : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {availableMediums.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMedium(m)}
              className={`border px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                activeMedium === m
                  ? "border-gilt bg-gilt text-ink"
                  : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
              }`}
            >
              {MEDIUM_LABEL[m]}
            </button>
          ))}
        </div>
      )}

      {slides.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <span className="text-sm text-muted-foreground">Nenhuma obra nesta categoria.</span>
        </div>
      ) : (
        <div
          className="relative select-none overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Slides */}
          {slides.map((work, i) => {
            const cleanTitle = stripHtml(work.title);
            const coverUrl = work.cover ?? "";
            const tags = Array.isArray(work.tags)
              ? work.tags
              : (work.tags as unknown as string | undefined ?? "").split(",").filter(Boolean);

            return (
              <div
                key={work.id}
                aria-hidden={i !== cur}
                className={`flex flex-col justify-center transition-opacity duration-700 lg:h-[500px] ${
                  i === cur ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
                }`}
              >
                {/* Background blur */}
                {coverUrl && (
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${coverUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      filter: "blur(28px) saturate(1.3) brightness(.55)",
                      transform: "scale(1.1)",
                    }}
                  />
                )}
                {!coverUrl && <div className="absolute inset-0 bg-surface/90" />}

                {/* Conteúdo */}
                <div className="relative z-10 flex flex-col items-center gap-8 px-12 py-10 lg:flex-row lg:items-center lg:gap-14 lg:px-24">
                  {/* Capa */}
                  <div className="flex shrink-0 flex-col items-start gap-2">
                    {isNew(work) && (
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-red-500" />
                        <span className="text-[11px] uppercase tracking-[0.12em] text-red-400">Novo</span>
                      </div>
                    )}
                    <div className="overflow-hidden" style={{ width: 210, height: 315 }}>
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={cleanTitle}
                          className="h-full w-full object-cover object-center transition-transform duration-500 hover:scale-[1.03] hover:-translate-y-0.5"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5">
                          <span className="font-display text-2xl text-white/20">
                            {MEDIUM_LABEL[work.medium].slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 text-center lg:text-left">
                    {/* Status + autor */}
                    <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                      <span
                        className="border border-gilt/40 text-center text-[10px] uppercase tracking-[0.1em] text-gilt/80"
                        style={{ width: 120, padding: "3px 0" }}
                      >
                        {work.workStatus === "finalizado"
                          ? "Finalizado"
                          : work.workStatus === "paralisado"
                          ? "Paralisado"
                          : "Em andamento"}
                      </span>
                      {work.artistName && (
                        <span className="text-xs italic text-white/60">{work.artistName}</span>
                      )}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5 lg:justify-start">
                        {tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/60"
                          >
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Título */}
                    <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-white line-clamp-2 sm:text-4xl" style={{ minHeight: "2.5em" }}>
                      {cleanTitle}
                    </h2>

                    {/* Excerpt */}
                    <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70 line-clamp-3 mx-auto lg:mx-0" style={{ minHeight: "4.875em" }}>
                      {stripHtml(work.excerpt)}
                    </p>

                    {/* Cliques */}
                    <div className="mt-3 flex items-center justify-center gap-1.5 lg:justify-start">
                      <Eye className="size-3.5 text-white/40" strokeWidth={1.5} />
                      <span className="text-xs text-white/40">
                        {work.clicks.toLocaleString("pt-BR")}
                      </span>
                    </div>

                    {/* Botões */}
                    <div className="mt-5 flex flex-wrap justify-center gap-3 lg:justify-start">
                      <Link
                        to="/work/$slug"
                        params={{ slug: work.slug }}
                        className="bg-gilt px-6 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
                      >
                        Começar a Ler
                      </Link>
                      <Link
                        to="/work/$slug"
                        params={{ slug: work.slug }}
                        className="border border-white/30 px-6 py-2.5 text-sm text-white/80 transition-colors hover:border-gilt hover:text-gilt"
                      >
                        Saiba Mais
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Setas */}
          {count > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Anterior"
                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 border border-white/20 bg-black/30 p-2 text-white/60 backdrop-blur-sm transition-colors hover:border-gilt hover:text-gilt sm:left-5"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onClick={next}
                aria-label="Próximo"
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 border border-white/20 bg-black/30 p-2 text-white/60 backdrop-blur-sm transition-colors hover:border-gilt hover:text-gilt sm:right-5"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}

          {/* Dots */}
          {count > 1 && (
            <div className="relative z-20 flex items-center justify-center gap-2 pb-5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCur(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === cur ? "w-5 bg-gilt" : "w-1.5 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
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
            className="aspect-[3/4] w-full object-cover object-center bg-surface transition-transform duration-500 group-hover:scale-[1.04]"
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
  const { data: works = [] } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => fetch("/api/works").then((r) => r.json() as Promise<Work[]>),
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
      {/* Destaque Beyond — hero carousel */}
      <DestaqueHero works={works} />

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

    </div>
  );
}
