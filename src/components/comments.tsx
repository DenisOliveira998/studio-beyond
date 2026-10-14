import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ReportButton } from "@/components/report-dialog";
import type { CommentData } from "@/lib/beyond-db";

function CommentAvatar({ name, url }: { name: string; url?: string | undefined }) {
  if (url) return <img src={url} alt="" className="size-8 shrink-0 rounded-full object-cover" />;
  const words = name.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(/\s+/).filter(Boolean);
  const ini = (words.length > 1 ? words.map((w) => w[0] ?? "").join("") : (words[0] ?? "?")).slice(0, 2).toUpperCase();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#5a3b5e] text-[11px] font-bold text-white">{ini}</span>
  );
}

const capLabel = (n: number) => `Cap. ${String(n).replace(".", ",")}`;

/**
 * Comentários de uma obra. Com `cap`, só os daquele capítulo (e o novo comentário fica nele);
 * sem `cap`, todos — os de capítulo aparecem com a etiqueta "Cap. N".
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
  const { data: comments = [], isLoading } = useQuery<CommentData[]>({
    queryKey: key,
    queryFn: () =>
      fetch(`/api/works/${workSlug}/comments${cap != null ? `?cap=${cap}` : ""}`).then((r) => r.json() as Promise<CommentData[]>),
    staleTime: 30_000,
  });
  const [draft, setDraft] = useState("");
  const add = useMutation({
    mutationFn: (text: string) =>
      fetch(`/api/works/${workSlug}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, ...(cap != null ? { cap } : {}) }),
      }).then(async (r) => {
        const out = (await r.json().catch(() => ({}))) as CommentData & { error?: string };
        if (!r.ok) throw new Error(out.error ?? "Erro ao publicar comentário.");
        return out;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comments", workSlug] });
      setDraft("");
      toast.success("Comentário publicado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar comentário."),
  });

  const shown = limit ? comments.slice(0, limit) : comments;

  return (
    <div>
      {!user ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">
            <a href={`/entrar?redirect=${encodeURIComponent(redirectTo)}`} className="text-gilt underline-offset-2 hover:underline">
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
        {!isLoading && comments.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {cap != null ? "Ninguém comentou este capítulo ainda. Seja o primeiro." : "Seja o primeiro a comentar."}
          </p>
        )}
        {shown.map((c) => (
          <div key={c.id} className="py-5">
            <div className="flex flex-wrap items-center gap-3">
              {c.profilePath ? (
                <a href={c.profilePath} className="group flex items-center gap-2.5" title={`Ver o perfil de ${c.author}`}>
                  <CommentAvatar name={c.author} url={c.avatarUrl} />
                  <span className="font-display text-base group-hover:text-gilt group-hover:underline group-hover:underline-offset-4">{c.author}</span>
                </a>
              ) : (
                <span className="flex items-center gap-2.5">
                  <CommentAvatar name={c.author} url={c.avatarUrl} />
                  <span className="font-display text-base">{c.author}</span>
                </span>
              )}
              {c.badge && (
                <span className="border border-gilt/50 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gilt">{c.badge}</span>
              )}
              {cap == null && c.chapter != null && (
                <a
                  href={`/ler/${workSlug}?cap=${c.chapter}`}
                  className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {capLabel(c.chapter)}
                </a>
              )}
              <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
              <span className="ml-auto">
                <ReportButton targetType="comment" targetId={c.id} redirectTo={redirectTo} />
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
