import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ReportButton } from "@/components/report-dialog";
import type { CommentData } from "@/lib/beyond-db";

function CommentAvatar({ name, url, small }: { name: string; url?: string | undefined; small?: boolean }) {
  const size = small ? "size-7" : "size-8";
  if (url) return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  const words = name.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(/\s+/).filter(Boolean);
  const ini = (words.length > 1 ? words.map((w) => w[0] ?? "").join("") : (words[0] ?? "?")).slice(0, 2).toUpperCase();
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-[#5a3b5e] text-[11px] font-bold text-white`}>{ini}</span>
  );
}

const capLabel = (n: number) => `Cap. ${String(n).replace(".", ",")}`;

async function postComment(workSlug: string, body: { text: string; cap?: number; parentId?: string }): Promise<CommentData> {
  const r = await fetch(`/api/works/${workSlug}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = (await r.json().catch(() => ({}))) as CommentData & { error?: string };
  if (!r.ok) throw new Error(out.error ?? "Erro ao publicar comentário.");
  return out;
}

/**
 * Comentários de uma obra. Com `cap`, só os daquele capítulo (e o novo comentário fica nele);
 * sem `cap`, todos — os de capítulo aparecem com a etiqueta "Cap. N".
 * Cada comentário pode ser curtido e respondido (as respostas ficam logo abaixo dele).
 */
export function Comments({
  workSlug,
  cap,
  redirectTo,
  limit,
}: {
  workSlug: string;
  cap?: number | undefined;
  redirectTo: string;
  /** Mostra só os N mais recentes (o resto fica na página da obra) */
  limit?: number;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["comments", workSlug, cap ?? "todos"];
  const loginHref = `/entrar?redirect=${encodeURIComponent(redirectTo)}`;
  const { data: comments = [], isLoading } = useQuery<CommentData[]>({
    queryKey: [...key, user?.id ?? "anon"],
    queryFn: () =>
      fetch(`/api/works/${workSlug}/comments${cap != null ? `?cap=${cap}` : ""}`).then((r) => r.json() as Promise<CommentData[]>),
    staleTime: 30_000,
  });
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const refresh = () => void qc.invalidateQueries({ queryKey: ["comments", workSlug] });

  const add = useMutation({
    mutationFn: (text: string) => postComment(workSlug, { text, ...(cap != null ? { cap } : {}) }),
    onSuccess: () => {
      refresh();
      setDraft("");
      toast.success("Comentário publicado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar comentário."),
  });

  const reply = useMutation({
    mutationFn: (v: { parentId: string; text: string }) => postComment(workSlug, v),
    onSuccess: () => {
      refresh();
      setReplyTo(null);
      setReplyDraft("");
      toast.success("Resposta publicada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar resposta."),
  });

  const like = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/comentarios/${id}/curtir`, { method: "POST" }).then(async (r) => {
        const out = (await r.json().catch(() => ({}))) as { liked?: boolean; likes?: number; error?: string };
        if (!r.ok) throw new Error(out.error ?? "Não foi possível curtir.");
        return { id, liked: !!out.liked, likes: out.likes ?? 0 };
      }),
    // Atualiza na hora; o servidor confirma a contagem
    onSuccess: ({ id, liked, likes }) => {
      qc.setQueriesData<CommentData[]>({ queryKey: ["comments", workSlug] }, (old) =>
        old?.map((c) => (c.id === id ? { ...c, likes, ...(liked ? { liked: true } : { liked: false }) } : c)),
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível curtir."),
  });

  // Comentários principais (mais novos primeiro) e respostas de cada um (em ordem de conversa)
  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = new Map<string, CommentData[]>();
  for (const c of [...comments].reverse()) {
    if (!c.parentId) continue;
    repliesOf.set(c.parentId, [...(repliesOf.get(c.parentId) ?? []), c]);
  }
  const shown = limit ? roots.slice(0, limit) : roots;

  const actions = (c: CommentData, rootId: string) => (
    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
      {user ? (
        <button
          type="button"
          onClick={() => like.mutate(c.id)}
          disabled={like.isPending && like.variables === c.id}
          aria-pressed={!!c.liked}
          aria-label={c.liked ? "Descurtir comentário" : "Curtir comentário"}
          className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${c.liked ? "text-rose-500 hover:text-rose-500" : ""}`}
        >
          <Heart className={`size-3.5 ${c.liked ? "fill-current" : ""}`} />
          {c.likes > 0 ? c.likes : "Curtir"}
        </button>
      ) : (
        <a href={loginHref} className="flex items-center gap-1.5 hover:text-foreground">
          <Heart className="size-3.5" />
          {c.likes > 0 ? c.likes : "Curtir"}
        </a>
      )}
      {user ? (
        <button
          type="button"
          onClick={() => {
            setReplyTo(rootId);
            // Respondendo uma resposta: já começa citando o nome
            setReplyDraft(c.id !== rootId ? `@${c.author.split(" ")[0]} ` : "");
          }}
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <MessageCircle className="size-3.5" /> Responder
        </button>
      ) : (
        <a href={loginHref} className="flex items-center gap-1.5 hover:text-foreground">
          <MessageCircle className="size-3.5" /> Responder
        </a>
      )}
    </div>
  );

  const header = (c: CommentData, small = false) => (
    <div className="flex flex-wrap items-center gap-3">
      {c.profilePath ? (
        <a href={c.profilePath} className="group flex items-center gap-2.5" title={`Ver o perfil de ${c.author}`}>
          <CommentAvatar name={c.author} url={c.avatarUrl} small={small} />
          <span className={`font-display group-hover:text-gilt group-hover:underline group-hover:underline-offset-4 ${small ? "text-sm" : "text-base"}`}>
            {c.author}
          </span>
        </a>
      ) : (
        <span className="flex items-center gap-2.5">
          <CommentAvatar name={c.author} url={c.avatarUrl} small={small} />
          <span className={`font-display ${small ? "text-sm" : "text-base"}`}>{c.author}</span>
        </span>
      )}
      {c.badge && <span className="border border-gilt/50 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gilt">{c.badge}</span>}
      {!small && cap == null && c.chapter != null && (
        <a href={`/ler/${workSlug}?cap=${c.chapter}`} className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
          {capLabel(c.chapter)}
        </a>
      )}
      <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
      <span className="ml-auto">
        <ReportButton targetType="comment" targetId={c.id} redirectTo={redirectTo} />
      </span>
    </div>
  );

  return (
    <div>
      {!user ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">
            <a href={loginHref} className="text-gilt underline-offset-2 hover:underline">
              Faça login
            </a>{" "}
            para deixar um comentário.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) add.mutate(draft.trim());
          }}
          className="border border-border bg-surface p-5"
        >
          <label className="block">
            <span className="eyebrow">{cap != null ? `Comentar o ${capLabel(cap).replace("Cap.", "capítulo")}` : "Seu comentário"}</span>
            <textarea
              required
              rows={3}
              maxLength={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={cap != null ? "O que achou deste capítulo?" : "O que achou da obra?"}
              className="mt-2 w-full resize-y border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
            <span className="caption mt-1 block text-right">{draft.length}/500</span>
          </label>
          <button
            type="submit"
            disabled={add.isPending}
            className="btn-type mt-3 border border-gilt px-5 py-2 text-xs text-gilt transition-colors hover:bg-gilt hover:text-primary-foreground disabled:opacity-60"
          >
            {add.isPending ? "Publicando…" : "Publicar comentário"}
          </button>
        </form>
      )}

      <div className="mt-4 divide-y divide-border text-left">
        {isLoading && (
          <div className="py-8 text-center">
            <span className="inline-block size-5 animate-spin rounded-full border-2 border-border border-t-gilt" />
          </div>
        )}
        {!isLoading && roots.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {cap != null ? "Ninguém comentou este capítulo ainda. Seja o primeiro." : "Seja o primeiro a comentar."}
          </p>
        )}
        {shown.map((c) => {
          const replies = repliesOf.get(c.id) ?? [];
          return (
            <div key={c.id} className="py-5">
              {header(c)}
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{c.text}</p>
              {actions(c, c.id)}

              {(replies.length > 0 || replyTo === c.id) && (
                <div className="mt-4 space-y-4 border-l-2 border-border pl-4 sm:ml-4">
                  {replies.map((r) => (
                    <div key={r.id}>
                      {header(r, true)}
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                      {actions(r, c.id)}
                    </div>
                  ))}
                  {replyTo === c.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (replyDraft.trim()) reply.mutate({ parentId: c.id, text: replyDraft.trim() });
                      }}
                    >
                      <textarea
                        autoFocus
                        required
                        rows={2}
                        maxLength={500}
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder={`Responder ${c.author.split(" ")[0]}`}
                        aria-label={`Responder o comentário de ${c.author}`}
                        className="w-full resize-y border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={reply.isPending}
                          className="btn-type border border-gilt px-4 py-1.5 text-xs text-gilt transition-colors hover:bg-gilt hover:text-primary-foreground disabled:opacity-60"
                        >
                          {reply.isPending ? "Publicando…" : "Publicar resposta"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(null);
                            setReplyDraft("");
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </button>
                        <span className="caption ml-auto">{replyDraft.length}/500</span>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
