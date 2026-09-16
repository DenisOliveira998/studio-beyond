import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkCard } from "@/components/work-card";
import { MEDIUM_LABEL, artists, works, getArtist, type Medium } from "@/lib/beyond-data";

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
      { property: "og:image", content: `${SITE_URL}/images/work-1.jpg` },
      { property: "og:image:width", content: "1280" },
      { property: "og:image:height", content: "720" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/images/work-1.jpg` },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/` },
    ],
  }),
  component: Home,
});

const filters: ("all" | Medium)[] = ["all", "livro", "manga", "hq", "conto"];

const FEATURED = [...works].sort((a, b) => b.clicks - a.clicks).slice(0, 3);

function FeaturedCarousel() {
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = FEATURED.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setCur((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [paused, count]);

  const prev = () => setCur((i) => (i - 1 + count) % count);
  const next = () => setCur((i) => (i + 1) % count);

  return (
    <section
      className="border-b border-border/70 bg-surface"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="eyebrow text-gilt">Em Destaque</p>

        {/* Slide area */}
        <div className="relative mt-6">
          {FEATURED.map((work, i) => {
            const artist = getArtist(work.artistSlug);
            return (
              <div
                key={work.id}
                aria-hidden={i !== cur}
                className={`transition-opacity duration-700 ${
                  i === cur
                    ? "relative opacity-100"
                    : "pointer-events-none absolute inset-0 opacity-0"
                }`}
              >
                <div className="grid gap-8 sm:grid-cols-[1fr_160px] sm:items-start">
                  {/* Text */}
                  <div>
                    <p className="caption">{MEDIUM_LABEL[work.medium]}</p>
                    <h2 className="hero-type mt-3 text-3xl leading-tight sm:text-5xl">
                      {work.title}
                    </h2>
                    {artist && (
                      <p className="mt-3 text-sm text-muted-foreground">{artist.name}</p>
                    )}
                    <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground line-clamp-3">
                      {work.excerpt}
                    </p>
                    <Link
                      to="/work/$slug"
                      params={{ slug: work.slug }}
                      className="btn-type mt-7 inline-block border border-gilt px-6 py-2.5 text-xs text-gilt transition-colors hover:bg-gilt hover:text-ink"
                    >
                      Ler obra
                    </Link>
                  </div>

                  {/* Decorative panel */}
                  <div className="hidden sm:block">
                    <div className="aspect-[3/4] border border-gilt/15 bg-gradient-to-b from-gilt/5 to-transparent">
                      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                        <span className="font-display text-6xl font-bold text-gilt/15">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="eyebrow text-gilt/30">{MEDIUM_LABEL[work.medium]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="mt-10 flex items-center justify-between">
          {/* Indicadores */}
          <div className="flex items-center gap-2">
            {FEATURED.map((_, i) => (
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

          {/* Setas */}
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

function Home() {
  const [filter, setFilter] = useState<"all" | Medium>("all");
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

      <FeaturedCarousel />

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

        <div className="grid gap-14 pt-12 sm:grid-cols-2">
          {feed.map((work, i) => (
            <WorkCard key={work.id} work={work} priority={i === 0} />
          ))}
        </div>
      </section>

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
              <p className="eyebrow">{a.discipline}</p>
              <p className="mt-3 font-display text-lg font-bold group-hover:text-gilt">
                {a.name}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {a.location} · {a.supporters} apoiadores
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
