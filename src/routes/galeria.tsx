import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SITE_URL } from "@/lib/site-url";
import { ARTWORK_KINDS, type ArtworkKind } from "@/lib/gallery-kinds";
import { ArtworkGrid, type ArtworkCardData } from "@/components/artwork-grid";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/galeria")({
  validateSearch: (s: Record<string, unknown>): { tipo?: ArtworkKind } =>
    typeof s["tipo"] === "string" && s["tipo"] in ARTWORK_KINDS ? { tipo: s["tipo"] as ArtworkKind } : {},
  head: () => ({
    meta: [
      { title: "Galeria: ilustrações e artes autorais | Go Beyondd" },
      {
        name: "description",
        content: "Ilustrações, fan arts, artes conceituais e histórias ilustradas de artistas brasileiros, com curadoria da Go Beyondd. Curta, comente e apoie quem desenha.",
      },
      { property: "og:title", content: "Galeria | Go Beyondd" },
      { property: "og:url", content: `${SITE_URL}/galeria` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/galeria` }],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { tipo } = Route.useSearch();
  const { profile } = useAuth();
  const { data = [], isLoading } = useQuery<ArtworkCardData[]>({
    queryKey: ["galeria", tipo ?? "todos"],
    queryFn: () => fetch(`/api/galeria${tipo ? `?tipo=${tipo}` : ""}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const pill = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
      active ? "border-gilt bg-gilt/10 text-gilt" : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Galeria</h1>
          <p className="mt-3 text-muted-foreground">
            Ilustrações, fan arts, artes conceituais e histórias ilustradas de artistas brasileiros. Cada imagem passa pela
            curadoria antes de aparecer aqui.
          </p>
        </div>
        {profile?.gallerySlug ? (
          <Link to="/galeria/minha" className="rounded-full bg-gilt px-5 py-2.5 text-sm font-bold text-ink">
            Publicar na Galeria
          </Link>
        ) : (
          <Link to="/candidatura-autor" search={{ tipo: "artista" }} className="rounded-full border border-gilt px-5 py-2.5 text-sm text-gilt">
            Você desenha? Candidate-se
          </Link>
        )}
      </div>

      <nav aria-label="Tipos" className="mt-8 flex flex-wrap gap-2">
        <Link to="/galeria" className={pill(!tipo)}>
          Tudo
        </Link>
        {(Object.keys(ARTWORK_KINDS) as ArtworkKind[]).map((k) => (
          <Link key={k} to="/galeria" search={{ tipo: k }} className={pill(tipo === k)}>
            {ARTWORK_KINDS[k]}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
          </div>
        ) : data.length === 0 ? (
          <div className="rounded border border-border bg-surface px-6 py-16 text-center">
            <p className="font-display text-2xl">A Galeria está abrindo.</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              {tipo ? `Ainda não há ${ARTWORK_KINDS[tipo].toLowerCase()} publicada.` : "As primeiras artes aparecem aqui assim que a curadoria aprovar."}{" "}
              Se você desenha, candidate-se para publicar.
            </p>
          </div>
        ) : (
          <ArtworkGrid items={data} />
        )}
      </div>
    </div>
  );
}
