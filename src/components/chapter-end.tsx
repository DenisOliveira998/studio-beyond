import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, UserPlus, UserCheck, HandHeart, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DonateDialog } from "@/components/donate-dialog";
import { Comments } from "@/components/comments";
import { stripHtml } from "@/lib/utils";
import type { Work } from "@/lib/beyond-data";

const capName = (n: number) => `Capítulo ${String(n).replace(".", ",")}`;

/**
 * Fim do capítulo, dentro do leitor: próximo capítulo, curtir, seguir e apoiar,
 * comentários deste capítulo (com link para os da obra) e obras parecidas.
 */
export function ChapterEnd({
  work,
  chapterNumber,
  nextChapter,
}: {
  work: Work;
  chapterNumber: number;
  nextChapter?: { number: number; title?: string } | undefined;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const artistName = work.artistName ?? "";
  const first = artistName.split(" ")[0] ?? artistName;
  const here = `/ler/${work.slug}?cap=${chapterNumber}`;
  const loginHref = `/entrar?redirect=${encodeURIComponent(here)}`;

  const { data: like } = useQuery<{ liked: boolean; count: number }>({
    queryKey: ["like", work.slug, user?.id ?? "anon"],
    queryFn: () => fetch(`/api/works/${work.slug}/like`).then((r) => r.json()),
    staleTime: 60_000,
  });
  const toggleLike = useMutation({
    mutationFn: () => fetch(`/api/works/${work.slug}/like`, { method: "POST" }).then((r) => r.json() as Promise<{ liked: boolean; count: number }>),
    onSuccess: (d) => qc.setQueryData(["like", work.slug, user?.id ?? "anon"], d),
    onError: () => toast.error("Não foi possível curtir agora."),
  });

  const { data: follow } = useQuery<{ followed: boolean }>({
    queryKey: ["follow", work.artistSlug],
    queryFn: () => fetch(`/api/artists/${work.artistSlug}/follow`).then((r) => r.json()),
    enabled: !!user && !!work.artistSlug,
    staleTime: 60_000,
  });
  const toggleFollow = useMutation({
    mutationFn: () => fetch(`/api/artists/${work.artistSlug}/follow`, { method: "POST" }).then((r) => r.json() as Promise<{ followed: boolean }>),
    onSuccess: (d) => {
      qc.setQueryData(["follow", work.artistSlug], d);
      toast.success(d.followed ? `Seguindo ${artistName}. Você será avisado dos capítulos novos.` : `Você deixou de seguir ${artistName}.`);
    },
    onError: () => toast.error("Não foi possível seguir agora."),
  });

  // Obras parecidas (mesmo autor ou mesmo tipo), vindas da página da obra
  const { data: related = [] } = useQuery<Work[]>({
    queryKey: ["related", work.slug],
    queryFn: () =>
      fetch(`/api/work/${encodeURIComponent(work.slug)}`)
        .then((r) => r.json() as Promise<{ related?: Work[] }>)
        .then((d) => d.related ?? []),
    staleTime: 5 * 60_000,
  });

  const action =
    "flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm transition-colors hover:border-gilt hover:text-gilt";

  return (
    <section aria-label="Fim do capítulo" className="mt-12 border-t border-border pt-10">
      <p className="text-center text-sm text-muted-foreground">Fim do {capName(chapterNumber)}</p>

      {nextChapter ? (
        <div className="mt-5 flex justify-center">
          <Link
            to="/ler/$slug"
            params={{ slug: work.slug }}
            search={{ cap: nextChapter.number }}
            className="flex items-center gap-2 rounded-full bg-gilt px-8 py-3 text-sm font-bold text-ink"
          >
            Próximo capítulo
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted-foreground">
          {work.workStatus === "finalizado"
            ? "Você chegou ao fim da obra."
            : `Você está em dia. Siga ${first || "o autor"} para saber quando sair o próximo capítulo.`}
        </p>
      )}

      {/* Ações */}
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {user ? (
          <button type="button" onClick={() => toggleLike.mutate()} disabled={toggleLike.isPending} className={`${action} ${like?.liked ? "border-gilt text-gilt" : ""}`}>
            <Heart className={`size-4 ${like?.liked ? "fill-current" : ""}`} />
            {like?.liked ? "Curtida" : "Curtir a obra"}
          </button>
        ) : (
          <a href={loginHref} className={action}>
            <Heart className="size-4" /> Curtir a obra
          </a>
        )}
        {artistName &&
          (user ? (
            <button type="button" onClick={() => toggleFollow.mutate()} disabled={toggleFollow.isPending} className={`${action} ${follow?.followed ? "border-gilt text-gilt" : ""}`}>
              {follow?.followed ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
              {follow?.followed ? "Seguindo" : `Seguir ${first}`}
            </button>
          ) : (
            <a href={loginHref} className={action}>
              <UserPlus className="size-4" /> Seguir {first}
            </a>
          ))}
        {artistName && (
          <DonateDialog
            artistName={artistName}
            artistSlug={work.artistSlug}
            workSlug={work.slug}
            trigger={
              <button type="button" className={`${action} border-gilt/60 text-gilt`}>
                <HandHeart className="size-4" /> Apoiar {first}
              </button>
            }
          />
        )}
      </div>

      {/* Comentários do capítulo */}
      <div className="mt-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl tracking-tight">Comentários do {capName(chapterNumber).toLowerCase()}</h2>
          <a href={`/obra/${work.slug}#comentarios`} className="text-sm text-gilt underline-offset-4 hover:underline">
            Ver todos os comentários da obra
          </a>
        </div>
        <Comments workSlug={work.slug} cap={chapterNumber} redirectTo={here} limit={20} />
      </div>

      {/* Obras parecidas */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 font-display text-xl tracking-tight">Obras parecidas</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.slice(0, 4).map((w) => (
              <li key={w.slug}>
                <Link to="/obra/$slug" params={{ slug: w.slug }} className="group block">
                  <div className="aspect-[3/4] overflow-hidden rounded-md bg-surface">
                    {w.cover && (
                      <img src={w.cover} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-snug group-hover:text-gilt">{stripHtml(w.title)}</p>
                  {w.artistName && <p className="caption truncate">{w.artistName}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
