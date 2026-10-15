import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, UserCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AgeBadge } from "@/components/age-badge";
import { Comments } from "@/components/comments";
import { SupportCard } from "@/components/support-card";
import { ARTWORK_KINDS, type ArtworkKind } from "@/lib/gallery-kinds";
import type { AgeRating } from "@/lib/beyond-data";

type Detail = {
  id: string;
  title: string;
  kind: ArtworkKind;
  description: string;
  images: string[];
  ageRating: string;
  status: string;
  curatorNote: string | null;
  publishedAt: string | null;
  relatedWork: { slug: string; title: string } | null;
  artist: { name: string; slug: string };
  artistAvatar: string;
  likes: number;
};

export const Route = createFileRoute("/galeria_/obra/$id")({
  head: () => ({ meta: [{ title: "Galeria | Go Beyondd" }] }),
  component: ArtworkPage,
});

function ArtworkPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = `galeria-${id}`;
  const here = `/galeria/obra/${id}`;
  const loginHref = `/entrar?redirect=${encodeURIComponent(here)}`;

  const { data: art, isLoading, isError } = useQuery<Detail>({
    queryKey: ["galeria-obra", id, user?.id ?? "anon"],
    queryFn: async () => {
      const r = await fetch(`/api/galeria/obra/${id}`);
      if (!r.ok) throw new Error("not_found");
      return r.json() as Promise<Detail>;
    },
    retry: false,
  });
  const followKey = art ? `galeria-${art.artist.slug}` : "";

  const { data: like } = useQuery<{ liked: boolean; count: number }>({
    queryKey: ["like", key, user?.id ?? "anon"],
    queryFn: () => fetch(`/api/works/${key}/like`).then((r) => r.json()),
    enabled: !!art,
  });
  const toggleLike = useMutation({
    mutationFn: () => fetch(`/api/works/${key}/like`, { method: "POST" }).then((r) => r.json() as Promise<{ liked: boolean; count: number }>),
    onSuccess: (d) => qc.setQueryData(["like", key, user?.id ?? "anon"], d),
    onError: () => toast.error("Não foi possível curtir agora."),
  });
  const { data: follow } = useQuery<{ followed: boolean }>({
    queryKey: ["follow", followKey],
    queryFn: () => fetch(`/api/artists/${followKey}/follow`).then((r) => r.json()),
    enabled: !!user && !!followKey,
  });
  const toggleFollow = useMutation({
    mutationFn: () => fetch(`/api/artists/${followKey}/follow`, { method: "POST" }).then((r) => r.json() as Promise<{ followed: boolean }>),
    onSuccess: (d) => qc.setQueryData(["follow", followKey], d),
    onError: () => toast.error("Não foi possível seguir agora."),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }
  if (isError || !art) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-3xl">Publicação não encontrada</p>
        <Link to="/galeria" className="mt-6 inline-block text-sm text-gilt underline underline-offset-4">
          Voltar à Galeria
        </Link>
      </div>
    );
  }

  const action = "flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-gilt hover:text-gilt";

  return (
    <div className="px-5 py-10 sm:px-10 lg:px-14">
      {art.status !== "approved" && (
        <p className="mb-6 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {art.status === "pending" ? "Esperando a curadoria. Só você e a equipe veem esta página." : `Não aprovada. ${art.curatorNote ?? ""}`}
        </p>
      )}
      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          {art.images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={art.images.length > 1 ? `${art.title}, imagem ${i + 1}` : art.title}
              className="mx-auto w-full max-w-4xl select-none rounded-md"
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          ))}
        </div>

        <aside className="lg:w-80 lg:flex-shrink-0">
          <div className="lg:sticky lg:top-8 space-y-6">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                {ARTWORK_KINDS[art.kind]} <AgeBadge rating={art.ageRating as AgeRating} />
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight">{art.title}</h1>
              <Link to="/galeria/artista/$slug" params={{ slug: art.artist.slug }} className="mt-3 flex items-center gap-2.5 hover:text-gilt">
                {art.artistAvatar ? (
                  <img src={art.artistAvatar} alt="" className="size-8 rounded-full object-cover" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#5a3b5e] text-[11px] font-bold text-white">
                    {art.artist.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span>{art.artist.name}</span>
              </Link>
              {art.relatedWork && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Fan art de{" "}
                  <Link to="/obra/$slug" params={{ slug: art.relatedWork.slug }} className="text-gilt hover:underline">
                    {art.relatedWork.title}
                  </Link>
                </p>
              )}
              {art.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{art.description}</p>}
            </div>

            {art.status === "approved" && (
              <div className="flex flex-wrap gap-2">
                {user ? (
                  <button type="button" onClick={() => toggleLike.mutate()} className={`${action} ${like?.liked ? "border-gilt text-gilt" : ""}`}>
                    <Heart className={`size-4 ${like?.liked ? "fill-current" : ""}`} /> {like?.count ?? art.likes}
                  </button>
                ) : (
                  <a href={loginHref} className={action}>
                    <Heart className="size-4" /> {art.likes}
                  </a>
                )}
                {user ? (
                  <button type="button" onClick={() => toggleFollow.mutate()} className={`${action} ${follow?.followed ? "border-gilt text-gilt" : ""}`}>
                    {follow?.followed ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                    {follow?.followed ? "Seguindo" : "Seguir artista"}
                  </button>
                ) : (
                  <a href={loginHref} className={action}>
                    <UserPlus className="size-4" /> Seguir artista
                  </a>
                )}
              </div>
            )}

            {art.status === "approved" && (
              <SupportCard
                artistName={art.artist.name}
                artistSlug={`galeria-${art.artist.slug}`}
                workSlug=""
                workTitle={art.title}
                subtitle="Artista da Galeria"
                profileHref={`/galeria/artista/${art.artist.slug}`}
              />
            )}
          </div>
        </aside>
      </div>

      {art.status === "approved" && (
        <section className="mt-16 max-w-3xl border-t border-border pt-10">
          <h2 className="eyebrow mb-6">Comentários</h2>
          <Comments workSlug={key} redirectTo={here} />
        </section>
      )}
    </div>
  );
}
