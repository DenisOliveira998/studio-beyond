import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { WorkCard } from "@/components/work-card";
import { MEDIUM_LABEL, type Work, type Medium } from "@/lib/beyond-data";
import type { CarouselItemData, ReaderProfileStats, ArtistSummary } from "@/lib/beyond-db";
import { useAuth } from "@/lib/auth";

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
    links: [
      { rel: "canonical", href: `${SITE_URL}/` },
    ],
  }),
  component: Home,
});

const filters: ("all" | Medium)[] = ["all", "livro", "manga", "hq", "conto"];

type SlideItem =
  | { kind: "db"; item: CarouselItemData }
  | { kind: "work"; work: Work };

function FeaturedCarousel({ works }: { works: Work[] }) {
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);

  const { data: dbItems = [] } = useQuery<CarouselItemData[]>({
    queryKey: ["carousel"],
    queryFn: () => fetch("/api/carousel").then((r) => r.json() as Promise<CarouselItemData[]>),
    staleTime: 60_000,
  });

  const featuredFallback = [...works].slice(0, 3);

  const slides: SlideItem[] =
    dbItems.filter((i) => i.active).length > 0
      ? dbItems.filter((i) => i.active).map((item) => ({ kind: "db" as const, item }))
      : featuredFallback.map((work) => ({ kind: "work" as const, work }));

  const count = slides.length || 1;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setCur((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [paused, count]);

  const prev = () => setCur((i) => (i - 1 + count) % count);
  const next = () => setCur((i) => (i + 1) % count);

  if (slides.length === 0) return null;

  return (
    <section
      className="border-b border-border/70 bg-surface"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="eyebrow text-gilt">Em Destaque</p>

        <div className="relative mt-6">
          {slides.map((slide, i) => {
            const isDb = slide.kind === "db";
            const title = isDb ? slide.item.title : slide.work.title;
            const subtitle = isDb ? slide.item.subtitle : (slide.work.artistName ?? "");
            const excerpt = isDb ? "" : slide.work.excerpt;
            const imgUrl = isDb ? slide.item.imageUrl : (slide.work.cover ?? "");
            const linkUrl = isDb ? slide.item.linkUrl : `/work/${slide.work.slug}`;
            const tag = isDb ? "" : MEDIUM_LABEL[slide.work.medium];

            return (
              <div
                key={isDb ? slide.item.id : slide.work.id}
                aria-hidden={i !== cur}
                className={`transition-opacity duration-700 ${
                  i === cur
                    ? "relative opacity-100"
                    : "pointer-events-none absolute inset-0 opacity-0"
                }`}
              >
                <div className="grid gap-8 sm:grid-cols-[1fr_200px] sm:items-start">
                  <div>
                    {tag && <p className="caption">{tag}</p>}
                    <h2 className="hero-type mt-3 text-3xl leading-tight sm:text-5xl">{title}</h2>
                    {subtitle && (
                      <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
                    )}
                    {excerpt && (
                      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground line-clamp-3">
                        {excerpt}
                      </p>
                    )}
                    {linkUrl && (
                      <a
                        href={linkUrl}
                        className="btn-type mt-7 inline-block border border-gilt px-6 py-2.5 text-xs text-gilt transition-colors hover:bg-gilt hover:text-ink"
                      >
                        {isDb ? "Ver mais" : "Ler obra"}
                      </a>
                    )}
                  </div>

                  <div className="hidden sm:block">
                    {imgUrl ? (
                      <div className="aspect-[3/4] overflow-hidden border border-gilt/20">
                        <img src={imgUrl} alt={title} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-[3/4] border border-gilt/15 bg-gradient-to-b from-gilt/5 to-transparent">
                        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                          <span className="font-display text-6xl font-bold text-gilt/15">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {tag && <span className="eyebrow text-gilt/30">{tag}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-between">
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
          <div className="flex gap-2">
            <button
              onClick={prev}
              aria-label="Anterior"
              className="border border-border p-2 text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={next}
              aria-label="Próximo"
              className="border border-border p-2 text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContinueReading({ works }: { works: Work[] }) {
  const { user, loading } = useAuth();

  const { data: stats } = useQuery<ReaderProfileStats>({
    queryKey: ["profile-stats"],
    queryFn: () => fetch("/api/profile/stats").then((r) => r.json() as Promise<ReaderProfileStats>),
    enabled: !!user,
    staleTime: 60_000,
  });

  if (loading || !user) return null;

  const inProgress = (stats?.progress ?? [])
    .filter((p) => !p.finished && p.pagesRead > 0)
    .slice(0, 6)
    .map((p) => {
      const work = works.find((w) => w.slug === p.workSlug);
      return work ? { work, pagesRead: p.pagesRead } : null;
    })
    .filter(Boolean) as { work: Work; pagesRead: number }[];

  if (!inProgress.length) return null;

  return (
    <section className="border-b border-border/70 bg-surface/40">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="size-4 text-gilt" strokeWidth={1.5} />
          <p className="eyebrow">De onde você parou</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {inProgress.map(({ work, pagesRead }) => (
            <Link
              key={work.id}
              to="/work/$slug"
              params={{ slug: work.slug }}
              className="group shrink-0 w-48 border border-border bg-background p-4 transition-colors hover:border-gilt"
            >
              <p className="eyebrow text-gilt/70">{MEDIUM_LABEL[work.medium]}</p>
              <p className="mt-2 font-display text-base leading-tight line-clamp-2 group-hover:text-gilt">
                {work.title}
              </p>
              {work.artistName && (
                <p className="mt-1 text-xs text-muted-foreground">{work.artistName}</p>
              )}
              <div className="mt-3 h-px w-full bg-border">
                <div
                  className="h-px bg-gilt transition-all"
                  style={{ width: `${Math.min(pagesRead, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[0.65rem] text-muted-foreground">
                {pagesRead}% lido
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Home() {
  const [filter, setFilter] = useState<"all" | Medium>("all");

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

  const feed = filter === "all" ? works : works.filter((w) => w.medium === filter);

  return (
    <div>
      <section className="border-b border-border/70">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="eyebrow">Sem anúncios · Sem banners · Sem interrupções</p>
          <h1 className="hero-type mt-6 max-w-3xl text-4xl sm:text-6xl">
            Um espaço silencioso para livros, mangás, HQs e contos que merecem ser lidos por mais tempo.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            O The Beyond paga os artistas por cada visualização que a obra conquista e permite que
            qualquer pessoa envie apoio direto ao ateliê. Ficamos com 12%. O resto é de quem cria.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/entrar"
              className="btn-type bg-primary px-6 py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90"
            >
              Publique sua obra
            </Link>
            <Link
              to="/artists"
              className="rule-hover text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Explorar artistas
            </Link>
          </div>
        </div>
      </section>

      <ContinueReading works={works} />
      <FeaturedCarousel works={works} />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border/70 pb-4">
          <h2 className="font-display text-2xl font-bold">Obras</h2>
          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em]">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`transition-colors ${
                  filter === f ? "text-gilt" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Tudo" : MEDIUM_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {feed.length === 0 ? (
          <p className="pt-12 text-center text-muted-foreground text-sm">Nenhuma obra publicada ainda.</p>
        ) : (
          <div className="grid gap-14 pt-12 sm:grid-cols-2">
            {feed.map((work, i) => (
              <WorkCard key={work.id} work={work} priority={i === 0} />
            ))}
          </div>
        )}
      </section>

      {artists.length > 0 && (
        <section className="mx-auto max-w-6xl border-t border-border/70 px-5 py-16 sm:px-8">
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
                <p className="mt-3 font-display text-lg font-bold group-hover:text-gilt">
                  {a.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
