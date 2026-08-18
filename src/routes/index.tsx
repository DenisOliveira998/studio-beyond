import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { WorkCard } from "@/components/work-card";
import { MEDIUM_LABEL, artists, works, type Medium } from "@/lib/beyond-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Beyond — An ad-free gallery for artists" },
      {
        name: "description",
        content:
          "A distraction-free space where writers, painters, photographers and composers publish their work, earn per view, and receive direct support.",
      },
      { property: "og:title", content: "The Beyond — An ad-free gallery for artists" },
      {
        property: "og:description",
        content: "Publish, be seen, be paid. No ads, no banners, no interruptions.",
      },
    ],
  }),
  component: Home,
});

const filters: ("all" | Medium)[] = ["all", "visual", "writing", "illustration", "music"];

function Home() {
  const [filter, setFilter] = useState<"all" | Medium>("all");
  const feed = filter === "all" ? works : works.filter((w) => w.medium === filter);

  return (
    <div>
      <section className="border-b border-border/70">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <p className="eyebrow">No ads · No banners · No interruptions</p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight sm:text-7xl">
            A quiet room for work that deserves to be looked at longer.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            The Beyond pays artists for every view their work earns, and lets anyone send support
            directly to the studio. We keep 12%. The rest belongs to the maker.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/auth"
              className="bg-primary px-6 py-3 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90"
            >
              Publish your work
            </Link>
            <Link
              to="/artists"
              className="rule-hover text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Browse artists
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border/70 pb-4">
          <h2 className="font-display text-3xl tracking-tight">The Feed</h2>
          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em]">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`transition-colors ${
                  filter === f ? "text-gilt" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Everything" : MEDIUM_LABEL[f]}
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

      <section className="mx-auto max-w-6xl border-t border-border/70 px-5 py-14 sm:px-8">
        <h2 className="font-display text-3xl tracking-tight">Artists in residence</h2>
        <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {artists.map((a) => (
            <Link
              key={a.slug}
              to="/artist/$slug"
              params={{ slug: a.slug }}
              className="group bg-background p-6 transition-colors hover:bg-surface"
            >
              <p className="eyebrow">{a.discipline}</p>
              <p className="mt-3 font-display text-2xl tracking-tight group-hover:text-gilt">
                {a.name}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {a.location} · {a.supporters} supporters
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
