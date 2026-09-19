import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { MEDIUM_LABEL, compact, getArtist, type Work } from "@/lib/beyond-data";
import { stripHtml } from "@/lib/utils";

export function WorkCard({ work, priority = false }: { work: Work; priority?: boolean }) {
  const artist = getArtist(work.artistSlug);
  const artistName = artist?.name ?? work.artistName;
  const artistSlug = work.artistSlug;
  // Lição Galinha GSB: alt e aria nunca devem conter HTML — stripHtml por precaução
  const cleanTitle = stripHtml(work.title);

  return (
    <article className="card-lift group border border-border bg-card p-3">
      <Link to="/work/$slug" params={{ slug: work.slug }} className="block">
        {work.cover ? (
          <div className="aspect-[3/2] overflow-hidden rounded-[3px] bg-ink">
            <img
              src={work.cover}
              alt={cleanTitle}
              loading={priority ? "eager" : "lazy"}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div className="flex aspect-[3/2] items-center justify-center rounded-[3px] bg-surface border border-gilt/15 flex-col gap-3">
            <BookOpen className="h-8 w-8 text-gilt/30" strokeWidth={1} />
            <span className="eyebrow text-[10px] text-gilt/30">{MEDIUM_LABEL[work.medium]}</span>
          </div>
        )}
      </Link>

      <div className="mt-4 space-y-2 px-1 pb-2">
        <p className="eyebrow">
          {MEDIUM_LABEL[work.medium]}
          {work.genre && <span className="text-muted-foreground/70"> · {work.genre}</span>}
          {" · "}{work.readTime ?? work.published}
        </p>
        <h3 className="font-display text-lg font-bold leading-tight">
          <Link to="/work/$slug" params={{ slug: work.slug }} className="rule-hover">
            {work.title}
          </Link>
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{work.excerpt}</p>
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          {artistName && (
            <Link
              to="/artist/$slug"
              params={{ slug: artistSlug }}
              className="text-foreground transition-colors hover:text-gilt"
            >
              {artistName}
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
