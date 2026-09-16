import { createFileRoute, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { DonateDialog } from "@/components/donate-dialog";
import { WorkCard } from "@/components/work-card";
import { compact } from "@/lib/beyond-data";

export const Route = createFileRoute("/artist/$slug")({
  loader: async ({ params }) => {
    const { fetchWorksByArtistSlug, dbWorkToWork } = await import("@/lib/beyond-db");
    const dbWorks = await fetchWorksByArtistSlug(params.slug);
    if (!dbWorks.length) throw notFound();
    const works = dbWorks.map(dbWorkToWork);
    const artistName = dbWorks[0]!.artistName;
    const artistSlug = params.slug;
    return { artistName, artistSlug, works };
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
    const { artistName, artistSlug, works } = loaderData;
    const description = `${works.length} ${works.length === 1 ? "obra publicada" : "obras publicadas"} no The Beyond.`;
    const meta: Array<Record<string, string>> = [
      { title: `${artistName} — The Beyond` },
      { name: "description", content: description },
      { property: "og:title", content: `${artistName} — The Beyond` },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    const firstCover = works.find((w) => w.cover)?.cover;
    if (firstCover) {
      meta.push({ property: "og:image", content: firstCover });
      meta.push({ name: "twitter:image", content: firstCover });
    }
    meta.push({ property: "og:url", content: `${SITE_URL}/artist/${artistSlug}` });
    return {
      meta,
      links: [{ rel: "canonical", href: `${SITE_URL}/artist/${artistSlug}` }],
    };
  },
  component: ArtistPage,
});

function ArtistPage() {
  const { artistName, artistSlug, works } = Route.useLoaderData();
  const totalViews = works.reduce((sum, w) => sum + w.clicks, 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="flex flex-col gap-10 border-b border-border pb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="mt-5 font-display text-5xl leading-tight tracking-tight sm:text-6xl">
            {artistName}
          </h1>
        </div>

        <div className="lg:text-right">
          <dl className="flex gap-10 lg:justify-end">
            <div>
              <dt className="eyebrow">Visualizações totais</dt>
              <dd className="mt-1 font-display text-3xl">{compact(totalViews)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Obras</dt>
              <dd className="mt-1 font-display text-3xl">{works.length}</dd>
            </div>
          </dl>
          <div className="mt-7">
            <DonateDialog
              artistName={artistName}
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
        <h2 className="font-display text-3xl tracking-tight">Obras publicadas</h2>
        <div className="mt-10 grid gap-14 sm:grid-cols-2">
          {works.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      </section>
    </div>
  );
}
