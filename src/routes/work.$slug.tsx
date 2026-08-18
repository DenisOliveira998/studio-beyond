import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Link2, Play } from "lucide-react";
import { toast } from "sonner";
import { DonateDialog } from "@/components/donate-dialog";
import { MEDIUM_LABEL, compact, getArtist, getWork } from "@/lib/beyond-data";

export const Route = createFileRoute("/work/$slug")({
  loader: ({ params }) => {
    const work = getWork(params.slug);
    const artist = work ? getArtist(work.artistSlug) : undefined;
    if (!work || !artist) throw notFound();
    return { work, artist };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Work not found — The Beyond" }, { name: "robots", content: "noindex" }] };
    }
    const { work, artist } = loaderData;
    return {
      meta: [
        { title: `${work.title} by ${artist.name} — The Beyond` },
        { name: "description", content: work.excerpt },
        { property: "og:title", content: `${work.title} by ${artist.name}` },
        { property: "og:description", content: work.excerpt },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: WorkPage,
});

function WorkPage() {
  const { work, artist } = Route.useLoaderData();
  const [liked, setLiked] = useState(false);
  const views = work.clicks + 1;

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">
        {MEDIUM_LABEL[work.medium]} · {work.published}
      </p>
      <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-tight sm:text-6xl">
        {work.title}
      </h1>
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Link
          to="/artist/$slug"
          params={{ slug: artist.slug }}
          className="rule-hover text-foreground"
        >
          {artist.name}
        </Link>
        <span aria-hidden>·</span>
        <span>{compact(views)} views counted</span>
        {work.readTime && (
          <>
            <span aria-hidden>·</span>
            <span>{work.readTime}</span>
          </>
        )}
      </div>

      {work.cover && (
        <img
          src={work.cover}
          alt={work.title}
          width={1280}
          height={860}
          className="mt-10 w-full object-cover"
        />
      )}

      {work.audio && (
        <div className="mt-6 flex items-center gap-4 border border-border bg-surface px-5 py-4">
          <button
            onClick={() => toast("Playback is mocked in this preview.")}
            aria-label="Play"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Play className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <p className="text-sm">{work.title}</p>
            <div className="mt-2 h-px w-full bg-border">
              <div className="h-px w-1/3 bg-gilt" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">11:04</span>
        </div>
      )}

      <div className="mt-10 space-y-6 text-lg leading-relaxed text-foreground/90">
        <p className="text-muted-foreground">{work.excerpt}</p>
        {work.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-border pt-8">
        <button
          onClick={() => setLiked((v) => !v)}
          className={`flex items-center gap-2 border px-4 py-2.5 text-xs uppercase tracking-[0.18em] transition-colors ${
            liked ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          {compact(work.likes + (liked ? 1 : 0))}
        </button>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              void navigator.clipboard?.writeText(window.location.href);
            }
            toast.success("Link copied");
          }}
          className="flex items-center gap-2 border border-border px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="h-3.5 w-3.5" />
          Share
        </button>
        <DonateDialog
          artistName={artist.name}
          trigger={
            <button className="bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90">
              Donate to {artist.name.split(" ")[0]}
            </button>
          }
        />
      </div>
    </article>
  );
}
