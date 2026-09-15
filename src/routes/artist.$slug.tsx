import { createFileRoute, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { ExternalLink, Instagram } from "lucide-react";
import { DonateDialog } from "@/components/donate-dialog";
import { WorkCard } from "@/components/work-card";
import { compact, getArtist, worksByArtist } from "@/lib/beyond-data";

export const Route = createFileRoute("/artist/$slug")({
  loader: ({ params }) => {
    const artist = getArtist(params.slug);
    if (!artist) throw notFound();
    return { artist, works: worksByArtist(artist.slug) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Artista não encontrado — The Beyond" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { artist, works } = loaderData;
    const description = `${artist.discipline} em ${artist.location}. ${artist.bio}`;
    const meta: Array<Record<string, string>> = [
      { title: `${artist.name} — The Beyond` },
      { name: "description", content: description },
      { property: "og:title", content: `${artist.name} — The Beyond` },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    // Usa a capa da primeira obra como og:image do artista
    const firstCover = works.find((w) => w.cover)?.cover;
    if (firstCover) {
      meta.push({ property: "og:image", content: firstCover });
      meta.push({ name: "twitter:image", content: firstCover });
    }
    meta.push({ property: "og:url", content: `${SITE_URL}/artist/${artist.slug}` });
    return {
      meta,
      links: [
        { rel: "canonical", href: `${SITE_URL}/artist/${artist.slug}` },
      ],
    };
  },
  component: ArtistPage,
});

function ArtistPage() {
  const { artist, works } = Route.useLoaderData();
  const totalViews = works.reduce((sum, w) => sum + w.clicks, 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="flex flex-col gap-10 border-b border-border pb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">
            {artist.discipline} · {artist.location}
          </p>
          <h1 className="mt-5 font-display text-5xl leading-tight tracking-tight sm:text-6xl">
            {artist.name}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">{artist.bio}</p>

          {/* Social links */}
          {artist.social && (
            <div className="mt-5 flex flex-wrap gap-4">
              {artist.social.instagram && (
                <a
                  href={artist.social.instagram}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-gilt"
                >
                  <Instagram className="size-3.5" strokeWidth={1.5} />
                  Instagram
                </a>
              )}
              {artist.social.website && (
                <a
                  href={artist.social.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-gilt"
                >
                  <ExternalLink className="size-3.5" strokeWidth={1.5} />
                  Site pessoal
                </a>
              )}
              {artist.social.twitter && (
                <a
                  href={artist.social.twitter}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-muted-foreground transition-colors hover:text-gilt"
                >
                  X / Twitter
                </a>
              )}
            </div>
          )}
        </div>

        <div className="lg:text-right">
          <dl className="flex gap-10 lg:justify-end">
            <div>
              <dt className="eyebrow">Apoiadores</dt>
              <dd className="mt-1 font-display text-3xl">{artist.supporters}</dd>
            </div>
            <div>
              <dt className="eyebrow">Visualizações totais</dt>
              <dd className="mt-1 font-display text-3xl">{compact(totalViews)}</dd>
            </div>
          </dl>
          <div className="mt-7">
            <DonateDialog
              artistName={artist.name}
              trigger={
                <button className="bg-primary px-6 py-3 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90">
                  Apoiar este artista
                </button>
              }
            />
          </div>
        </div>
      </header>

      <section className="pt-14">
        <h2 className="font-display text-3xl tracking-tight">Obras selecionadas</h2>
        <div className="mt-10 grid gap-14 sm:grid-cols-2">
          {works.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      </section>
    </div>
  );
}
