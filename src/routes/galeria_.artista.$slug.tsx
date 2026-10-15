import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ArtworkGrid, type ArtworkCardData } from "@/components/artwork-grid";
import { SupportCard } from "@/components/support-card";

type ArtistPage = {
  name: string;
  slug: string;
  avatarUrl: string;
  bio: string;
  instagram: string;
  website: string;
  followers: number;
  artworks: ArtworkCardData[];
};

export const Route = createFileRoute("/galeria_/artista/$slug")({
  head: () => ({ meta: [{ title: "Artista da Galeria | Go Beyondd" }] }),
  component: GalleryArtistPage,
});

function GalleryArtistPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const followKey = `galeria-${slug}`;
  const loginHref = `/entrar?redirect=${encodeURIComponent(`/galeria/artista/${slug}`)}`;

  const { data: a, isLoading, isError } = useQuery<ArtistPage>({
    queryKey: ["galeria-artista", slug],
    queryFn: async () => {
      const r = await fetch(`/api/galeria/artista/${slug}`);
      if (!r.ok) throw new Error("not_found");
      return r.json() as Promise<ArtistPage>;
    },
    retry: false,
  });
  const { data: follow } = useQuery<{ followed: boolean }>({
    queryKey: ["follow", followKey],
    queryFn: () => fetch(`/api/artists/${followKey}/follow`).then((r) => r.json()),
    enabled: !!user,
  });
  const toggleFollow = useMutation({
    mutationFn: () => fetch(`/api/artists/${followKey}/follow`, { method: "POST" }).then((r) => r.json() as Promise<{ followed: boolean }>),
    onSuccess: (d) => {
      qc.setQueryData(["follow", followKey], d);
      toast.success(d.followed ? "Seguindo." : "Você deixou de seguir.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }
  if (isError || !a) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-3xl">Artista não encontrado</p>
        <Link to="/galeria" className="mt-6 inline-block text-sm text-gilt underline underline-offset-4">
          Voltar à Galeria
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 py-12 sm:px-10 lg:px-14">
      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {a.avatarUrl ? (
              <img src={a.avatarUrl} alt={`Foto de ${a.name}`} className="size-24 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-24 shrink-0 items-center justify-center rounded-full bg-[#5a3b5e] text-2xl font-bold text-white">
                {a.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Artista da Galeria</p>
              <h1 className="font-display text-4xl tracking-tight">{a.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {a.artworks.length} {a.artworks.length === 1 ? "publicação" : "publicações"}
                {a.followers > 0 ? `, ${a.followers} ${a.followers === 1 ? "seguidor" : "seguidores"}` : ""}
              </p>
              <div className="mt-3">
                {user ? (
                  <button
                    type="button"
                    onClick={() => toggleFollow.mutate()}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${follow?.followed ? "border-gilt text-gilt" : "border-border"}`}
                  >
                    {follow?.followed ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                    {follow?.followed ? "Seguindo" : "Seguir"}
                  </button>
                ) : (
                  <a href={loginHref} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
                    <UserPlus className="size-4" /> Seguir
                  </a>
                )}
              </div>
            </div>
          </div>
          {a.bio && <p className="mt-6 max-w-2xl whitespace-pre-line leading-relaxed text-muted-foreground">{a.bio}</p>}

          <div className="mt-10">
            {a.artworks.length ? (
              <ArtworkGrid items={a.artworks} showArtist={false} />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma publicação aprovada ainda.</p>
            )}
          </div>
        </div>
        {a.artworks.length > 0 && (
          <aside className="lg:w-80 lg:flex-shrink-0">
            <div className="lg:sticky lg:top-8">
              <SupportCard
                artistName={a.name}
                artistSlug={`galeria-${a.slug}`}
                workSlug=""
                workTitle=""
                subtitle="Artista da Galeria"
                profileHref={`/galeria/artista/${a.slug}`}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
