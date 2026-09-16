import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useQuery } from "@tanstack/react-query";
import type { ArtistSummary } from "@/lib/beyond-db";

export const Route = createFileRoute("/artists")({
  head: () => ({
    meta: [
      { title: "Autores e Artistas | The Beyond — Publicação Independente" },
      {
        name: "description",
        content:
          "Conheça os escritores, mangakistas e quadrinistas que publicam no The Beyond. Obras autorais de mangá, HQ, livro e conto com curadoria independente e sem anúncios.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Autores e Artistas | The Beyond" },
      {
        property: "og:description",
        content:
          "Escritores, mangakistas e quadrinistas independentes. Conheça quem publica no The Beyond e ganha por cada leitura.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/artists` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/artists` }],
  }),
  component: ArtistsPage,
});

function ArtistsPage() {
  const { data: artists = [] } = useQuery<ArtistSummary[]>({
    queryKey: ["artists"],
    queryFn: () => fetch("/api/artists").then((r) => r.json() as Promise<ArtistSummary[]>),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">O elenco</p>
      <h1 className="mt-5 max-w-2xl font-display text-5xl leading-tight tracking-tight">
        Artistas residentes
      </h1>

      <div className="mt-10 divide-y divide-border border-y border-border">
        {artists.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum artista publicou obras ainda.</p>
        ) : artists.map((a) => (
          <Link
            key={a.slug}
            to="/artist/$slug"
            params={{ slug: a.slug }}
            className="group flex flex-col gap-4 py-8 transition-colors hover:bg-surface/60 sm:flex-row sm:items-start sm:gap-10 sm:px-4"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-border font-display text-lg text-gilt">
              {a.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="mt-2 font-display text-3xl tracking-tight group-hover:text-gilt">
                {a.name}
              </h2>
            </div>
            <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
              <p className="text-foreground">{a.workCount} {a.workCount === 1 ? "obra" : "obras"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
