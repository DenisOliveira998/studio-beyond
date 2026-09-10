import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Link2, Play } from "lucide-react";
import { toast } from "sonner";
import { DonateDialog } from "@/components/donate-dialog";
import { MEDIUM_LABEL, compact, getArtist, getWork } from "@/lib/beyond-data";
import { stripHtml, isHtml } from "@/lib/utils";

export const Route = createFileRoute("/work/$slug")({
  loader: ({ params }) => {
    const work = getWork(params.slug);
    const artist = work ? getArtist(work.artistSlug) : undefined;
    if (!work || !artist) throw notFound();
    return { work, artist };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Obra não encontrada — The Beyond" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { work, artist } = loaderData;
    // Lição Galinha GSB: sempre stripHtml em meta tags — rich text vaza <p>Título</p>
    const cleanTitle = stripHtml(work.title);
    const cleanExcerpt = stripHtml(work.excerpt);
    return {
      meta: [
        { title: `${cleanTitle}, de ${artist.name} — The Beyond` },
        { name: "description", content: cleanExcerpt },
        { property: "og:title", content: `${cleanTitle}, de ${artist.name}` },
        { property: "og:description", content: cleanExcerpt },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: WorkPage,
});

/**
 * Renderiza um parágrafo do corpo da obra.
 * Lição Galinha GSB: quando o corpo vier de um editor rich text (TipTap etc.),
 * conterá HTML — usar dangerouslySetInnerHTML nesse caso.
 * isHtml() detecta automaticamente para suportar ambos os formatos.
 */
function WorkParagraph({ content, className }: { content: string; className?: string }) {
  if (isHtml(content)) {
    return (
      <p
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return <p className={className}>{content}</p>;
}

function WorkPage() {
  const { work, artist } = Route.useLoaderData();
  const [liked, setLiked] = useState(false);
  const views = work.clicks + 1;

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      {/* Eyebrow: categoria + gênero + data */}
      <p className="eyebrow">
        {MEDIUM_LABEL[work.medium]}
        {work.genre && <> · {work.genre}</>}
        {" · "}{work.published}
      </p>

      <h1 className="hero-type mt-5 text-3xl sm:text-5xl">
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
        <span>{compact(views)} visualizações contabilizadas</span>
        {work.readTime && (
          <>
            <span aria-hidden>·</span>
            <span>{work.readTime}</span>
          </>
        )}
        {work.pages && (
          <>
            <span aria-hidden>·</span>
            <span>{work.pages} páginas</span>
          </>
        )}
      </div>

      {work.cover && (
        <img
          src={work.cover}
          alt={stripHtml(work.title)}
          width={1280}
          height={860}
          className="mt-10 w-full object-cover"
        />
      )}

      {work.audio && (
        <div className="mt-6 flex items-center gap-4 border border-border bg-surface px-5 py-4">
          <button
            onClick={() => toast("A reprodução é simulada nesta prévia.")}
            aria-label="Reproduzir"
            className="flex h-11 w-11 items-center justify-center rounded-[2px] bg-primary text-primary-foreground"
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

      {/* Corpo da obra com prose (typography plugin) para experiência de leitura */}
      <div className="prose mt-10 max-w-none">
        <p className="lead text-muted-foreground not-prose text-lg leading-relaxed">
          {work.excerpt}
        </p>
        <div className="mt-6">
          {work.body.map((p, i) => (
            <WorkParagraph key={i} content={p} />
          ))}
        </div>
      </div>

      <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-border pt-8">
        <button
          onClick={() => setLiked((v) => !v)}
          aria-label={liked ? "Remover curtida" : "Curtir"}
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
            toast.success("Link copiado");
          }}
          className="flex items-center gap-2 border border-border px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="h-3.5 w-3.5" />
          Compartilhar
        </button>
        <DonateDialog
          artistName={artist.name}
          trigger={
            <button className="bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90">
              Doar para {artist.name.split(" ")[0]}
            </button>
          }
        />
      </div>
    </article>
  );
}
