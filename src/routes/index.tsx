import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { WorkCard } from "@/components/work-card";
import { MEDIUM_LABEL, artists, works, type Medium } from "@/lib/beyond-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Beyond — Uma galeria sem anúncios para artistas" },
      {
        name: "description",
        content:
          "Um espaço sem distrações onde autores de livros, mangás, HQs e contos publicam suas obras, ganham por visualização e recebem apoio direto.",
      },
      {
        property: "og:title",
        content: "The Beyond — Uma galeria sem anúncios para artistas",
      },
      {
        property: "og:description",
        content: "Publique, seja visto, seja pago. Sem anúncios, sem banners, sem interrupções.",
      },
    ],
  }),
  component: Home,
});

const filters: ("all" | Medium)[] = ["all", "livro", "manga", "hq", "conto"];

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
              to="/auth"
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
