import { Link } from "@tanstack/react-router";
import { MEDIUM_LABEL, compact, getArtist, type Work } from "@/lib/beyond-data";

export function WorkCard({ work, priority = false }: { work: Work; priority?: boolean }) {
  const artist = getArtist(work.artistSlug);

  return (
    <article className="card-lift group border border-border bg-card p-3">
      <Link to="/work/$slug" params={{ slug: work.slug }} className="block">
        {work.cover ? (
          <div className="overflow-hidden rounded-[3px] bg-ink">
            <img
              src={work.cover}
              alt={work.title}
              width={1280}
              height={860}
              loading={priority ? "eager" : "lazy"}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div className="flex aspect-[3/2] items-center justify-center rounded-[3px] bg-ink px-8">
            <p className="hero-type text-xl leading-snug text-gilt">
              “{work.excerpt.split(".")[0]}.”
            </p>
          </div>
        )}
      </Link>

      <div className="mt-4 space-y-2 px-1 pb-2">
        <p className="eyebrow">
          {MEDIUM_LABEL[work.medium]} · {work.readTime ?? work.published}
        </p>
        <h3 className="font-display text-lg font-bold leading-tight">
          <Link to="/work/$slug" params={{ slug: work.slug }} className="rule-hover">
            {work.title}
          </Link>
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{work.excerpt}</p>
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          {artist && (
            <Link
              to="/artist/$slug"
              params={{ slug: artist.slug }}
              className="text-foreground transition-colors hover:text-gilt"
            >
              {artist.name}
            </Link>
          )}
          <span aria-hidden>·</span>
          <span>{compact(work.clicks)} visualizações</span>
          <span aria-hidden>·</span>
          <span>{compact(work.likes)} curtidas</span>
        </div>
      </div>
    </article>
  );
}
