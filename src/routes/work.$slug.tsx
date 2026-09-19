import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect, useRef } from "react";
import { ArrowUp, BookOpen, Bookmark, FileDown, Heart, Link2, Play } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DonateDialog } from "@/components/donate-dialog";
import { WorkCard } from "@/components/work-card";
import { MEDIUM_LABEL, compact } from "@/lib/beyond-data";
import { stripHtml, isHtml } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { CommentData } from "@/lib/beyond-db";

export const Route = createFileRoute("/work/$slug")({
  loader: async ({ params }) => {
    const { fetchWorkBySlug, fetchApprovedWorks, dbWorkToWork } = await import("@/lib/beyond-db");
    const dbWork = await fetchWorkBySlug(params.slug);
    if (!dbWork || dbWork.status !== "approved") throw notFound();
    const work = dbWorkToWork(dbWork);
    const allWorks = await fetchApprovedWorks();
    const related = allWorks
      .filter((w) => w.slug !== work.slug && (w.artistSlug === work.artistSlug || w.medium === work.medium))
      .slice(0, 4)
      .map(dbWorkToWork);
    return { work, related, hasBody: !!dbWork.body?.trim() };
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
    const { work } = loaderData;
    const cleanTitle = stripHtml(work.title);
    const cleanExcerpt = stripHtml(work.excerpt);
    const artistName = work.artistName ?? "";
    const meta: Array<Record<string, string>> = [
      { title: `${cleanTitle}${artistName ? `, de ${artistName}` : ""} — The Beyond` },
      { name: "description", content: cleanExcerpt },
      { property: "og:title", content: `${cleanTitle}${artistName ? `, de ${artistName}` : ""}` },
      { property: "og:description", content: cleanExcerpt },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (work.cover) {
      meta.push({ property: "og:image", content: work.cover });
      meta.push({ name: "twitter:image", content: work.cover });
    }
    meta.push({ property: "og:url", content: `${SITE_URL}/work/${work.slug}` });
    return {
      meta,
      links: [{ rel: "canonical", href: `${SITE_URL}/work/${work.slug}` }],
    };
  },
  component: WorkPage,
});

function WorkParagraph({ content, className }: { content: string; className?: string }) {
  if (isHtml(content)) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: content }} />;
  }
  return <p className={className}>{content}</p>;
}

// ── Comentários ─────────────────────────────────────────────────

function CommentsSection({ workSlug }: { workSlug: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: comments = [], isLoading: commentsLoading } = useQuery<CommentData[]>({
    queryKey: ["comments", workSlug],
    queryFn: () => fetch(`/api/works/${workSlug}/comments`).then((r) => r.json() as Promise<CommentData[]>),
    staleTime: 30_000,
  });
  const addComment = useMutation({
    mutationFn: (payload: { author: string; text: string }) =>
      fetch(`/api/works/${workSlug}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<CommentData>;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comments", workSlug] });
      toast.success("Comentário publicado.");
    },
    onError: () => toast.error("Erro ao publicar comentário."),
  });

  const [draft, setDraft] = useState("");
  const [name, setName] = useState(user?.name ?? "");

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    addComment.mutate({ author: name.trim() || user?.name || "Anônimo", text: draft.trim() });
    setDraft("");
  }

  return (
    <div className="pt-6">
      {!user ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">
            <a href="/entrar" className="text-gilt underline-offset-2 hover:underline">Faça login</a> para deixar um comentário.
          </p>
        </div>
      ) : (
      <form onSubmit={handleSend} className="border border-border bg-surface p-6">
        <label className="block">
          <span className="eyebrow">Seu comentário</span>
          <textarea
            required
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="O que achou da obra?"
            className="mt-2 w-full resize-y border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
        </label>
        <button
          type="submit"
          disabled={addComment.isPending}
          className="btn-type mt-4 border border-gilt px-5 py-2 text-xs text-gilt transition-colors hover:bg-gilt hover:text-primary-foreground disabled:opacity-60"
        >
          {addComment.isPending ? "Publicando…" : "Publicar comentário"}
        </button>
      </form>
      )}

      <div className="mt-6 divide-y divide-border">
        {commentsLoading && (
          <div className="py-8 text-center">
            <span className="size-5 animate-spin rounded-full border-2 border-border border-t-gilt inline-block" />
          </div>
        )}
        {!commentsLoading && comments.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Seja o primeiro a comentar.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="py-6">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-base">{c.author}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bookmark ─────────────────────────────────────────────────────

function useBookmark(slug: string, artistSlug: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery<{ favorited: boolean }>({
    queryKey: ["bookmark", slug],
    queryFn: () => fetch(`/api/favorites/${slug}`).then((r) => r.json() as Promise<{ favorited: boolean }>),
    enabled: !!user,
    staleTime: 60_000,
  });
  const saved = data?.favorited ?? false;

  const mutation = useMutation({
    mutationFn: () =>
      fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workSlug: slug, artistSlug }),
      }).then((r) => r.json() as Promise<{ favorited: boolean }>),
    onSuccess: (result) => {
      qc.setQueryData(["bookmark", slug], result);
      toast.success(result.favorited ? "Obra salva na sua lista." : "Removida da lista.");
    },
    onError: () => toast.error("Erro ao salvar. Tente novamente."),
  });

  function toggle() {
    if (!user) { toast.error("Faça login para salvar obras."); return; }
    mutation.mutate();
  }

  return { saved, toggle };
}

// ── Status badge ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  andamento: { label: "EM ANDAMENTO", cls: "border-gilt/60 text-gilt bg-gilt/10" },
  finalizado: { label: "FINALIZADO", cls: "border-emerald-500/60 text-emerald-400 bg-emerald-500/10" },
  paralisado: { label: "PARALISADO", cls: "border-red-500/60 text-red-400 bg-red-500/10" },
} as const;

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const { label, cls } = STATUS_CONFIG[status];
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${cls}`}>
      {label}
    </span>
  );
}

// ── WorkPage ──────────────────────────────────────────────────────

type Tab = "sobre" | "comentarios" | "relacionados";

function WorkPage() {
  const { work, related, hasBody } = Route.useLoaderData();
  const { user } = useAuth();
  const qc = useQueryClient();
  const artistName = work.artistName ?? "";
  const artistSlug = work.artistSlug;

  const [activeTab, setActiveTab] = useState<Tab>("sobre");
  const [showBackTop, setShowBackTop] = useState(false);
  const [chapterOrder, setChapterOrder] = useState<"asc" | "desc">("asc");
  const topRef = useRef<HTMLDivElement>(null);
  const views = work.clicks + 1;

  // View counter + registra timestamp da última leitura (para detectar atualizações)
  useEffect(() => {
    void fetch(`/api/works/${work.slug}/view`, { method: "POST" });
    try { localStorage.setItem(`beyond_last_read_${work.slug}`, new Date().toISOString()); } catch {}
  }, [work.slug]);

  // Back to top
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Like
  const { data: likeData } = useQuery<{ liked: boolean; count: number }>({
    queryKey: ["like", work.slug],
    queryFn: () => fetch(`/api/works/${work.slug}/like`).then((r) => r.json() as Promise<{ liked: boolean; count: number }>),
    staleTime: 60_000,
  });
  const liked = likeData?.liked ?? false;
  const likeCount = likeData?.count ?? work.likes;
  const likeMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/works/${work.slug}/like`, { method: "POST" }).then((r) => r.json() as Promise<{ liked: boolean; count: number }>),
    onSuccess: (data) => { qc.setQueryData(["like", work.slug], data); },
    onError: () => toast.error("Erro ao curtir. Tente novamente."),
  });

  // Bookmark
  const { saved, toggle: toggleBookmark } = useBookmark(work.slug, artistSlug);

  // Follow
  const { data: followData } = useQuery<{ followed: boolean }>({
    queryKey: ["follow", artistSlug],
    queryFn: () => fetch(`/api/artists/${artistSlug}/follow`).then((r) => r.json() as Promise<{ followed: boolean }>),
    enabled: !!artistSlug,
    staleTime: 60_000,
  });
  const followed = followData?.followed ?? false;
  const followMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/artists/${artistSlug}/follow`, { method: "POST" }).then((r) => r.json() as Promise<{ followed: boolean }>),
    onSuccess: (data) => {
      qc.setQueryData(["follow", artistSlug], data);
      toast.success(
        data.followed
          ? `Seguindo ${artistName}.`
          : `Você deixou de seguir ${artistName}.`,
      );
    },
    onError: () => toast.error("Erro. Tente novamente."),
  });

  // Comments query (for tab count)
  const { data: comments = [] } = useQuery<CommentData[]>({
    queryKey: ["comments", work.slug],
    queryFn: () => fetch(`/api/works/${work.slug}/comments`).then((r) => r.json() as Promise<CommentData[]>),
    staleTime: 30_000,
  });

  const genreTags = work.genre
    ? work.genre.split(",").map((g) => g.trim()).filter(Boolean)
    : [];

  function handleLike() {
    if (!user) { toast.error("Faça login para curtir."); return; }
    likeMutation.mutate();
  }

  function handleShare() {
    if (typeof window !== "undefined") {
      void navigator.clipboard?.writeText(window.location.href);
    }
    toast.success("Link copiado");
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "sobre", label: "Sobre" },
    { key: "comentarios", label: `Comentários${comments.length ? ` (${comments.length})` : ""}` },
    { key: "relacionados", label: `Relacionados${related.length ? ` (${related.length})` : ""}` },
  ];

  return (
    <div ref={topRef} className="px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
      <div className="flex flex-col gap-10 lg:flex-row lg:gap-10">

        {/* ── SIDEBAR ───────────────────────────────────────────── */}
        <aside className="flex flex-row gap-4 lg:flex-col lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-8 lg:self-start">

          {/* Cover */}
          {work.cover ? (
            <img
              src={work.cover}
              alt={stripHtml(work.title)}
              className="w-28 flex-shrink-0 object-contain bg-surface lg:w-full aspect-[3/4]"
            />
          ) : (
            <div className="w-28 flex-shrink-0 aspect-[3/4] border border-gilt/15 bg-gradient-to-b from-gilt/5 to-transparent flex flex-col items-center justify-center gap-2 lg:w-full">
              <span className="font-display text-4xl font-bold text-gilt/20">
                {MEDIUM_LABEL[work.medium].slice(0, 2).toUpperCase()}
              </span>
              <span className="eyebrow text-gilt/25 text-[10px]">{MEDIUM_LABEL[work.medium]}</span>
            </div>
          )}

          {/* Mobile meta inline with cover */}
          <div className="flex flex-col gap-3 flex-1 lg:hidden">
            <div>
              <p className="eyebrow">{MEDIUM_LABEL[work.medium]}</p>
              <h1 className="mt-1 font-display text-2xl leading-tight tracking-tight">
                {work.title}
              </h1>
            </div>
            {artistName && (
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/artist/$slug" params={{ slug: artistSlug }} className="text-sm rule-hover">
                  {artistName}
                </Link>
                <button
                  onClick={() => {
                    if (!user) { toast.error("Faça login para seguir artistas."); return; }
                    followMutation.mutate();
                  }}
                  className={`text-[10px] uppercase tracking-[0.16em] border px-2.5 py-1 transition-colors ${
                    followed ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:border-gilt hover:text-gilt"
                  }`}
                >
                  {followed ? "✓ Seguindo" : `+ Seguir`}
                </button>
              </div>
            )}
            <StatusBadge status={work.workStatus ?? "andamento"} />
          </div>

          {/* Desktop sidebar content */}
          <div className="hidden lg:flex lg:flex-col lg:gap-4">

            {/* LER button */}
            {hasBody && (
              <Link
                to="/ler/$slug"
                params={{ slug: work.slug }}
                className="flex items-center justify-center gap-2 bg-gilt px-4 py-3 text-sm uppercase tracking-[0.18em] text-ink font-bold transition-opacity hover:opacity-90"
              >
                <BookOpen className="h-4 w-4" />
                LER
              </Link>
            )}
            {work.pdfUrl && (
              <a
                href={work.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border border-gilt px-4 py-3 text-sm uppercase tracking-[0.18em] text-gilt font-bold transition-opacity hover:opacity-80"
              >
                <FileDown className="h-4 w-4" />
                PDF
              </a>
            )}

            {/* Curtir + Salvar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleLike}
                aria-label={liked ? "Remover curtida" : "Curtir"}
                className={`flex items-center justify-center gap-2 border py-2.5 text-xs uppercase tracking-[0.14em] transition-colors ${
                  liked ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
                Curtir
              </button>
              <button
                onClick={toggleBookmark}
                aria-label={saved ? "Remover da lista" : "Salvar"}
                className={`flex items-center justify-center gap-2 border py-2.5 text-xs uppercase tracking-[0.14em] transition-colors ${
                  saved ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
                Salvar
              </button>
            </div>

            {/* Compartilhar */}
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 border border-border py-2.5 text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Link2 className="h-3.5 w-3.5" />
              Compartilhar
            </button>

            {/* Stats */}
            <div className="border border-border bg-surface p-3 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Visualizações</span>
                <span className="font-mono tabular-nums">{compact(views)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Curtidas</span>
                <span className="font-mono tabular-nums">{compact(likeCount)}</span>
              </div>
            </div>

            {/* Meta */}
            <div className="border border-border bg-surface p-3 flex flex-col gap-2.5 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground uppercase tracking-[0.12em] text-[10px]">Status</span>
                <StatusBadge status={work.workStatus ?? "andamento"} />
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span>{MEDIUM_LABEL[work.medium]}</span>
              </div>
              {work.pages && (
                <>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Páginas</span>
                    <span className="tabular-nums">{work.pages}</span>
                  </div>
                </>
              )}
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Publicado</span>
                <span>{work.published}</span>
              </div>
            </div>

            {/* Donate */}
            {artistName && (
              <DonateDialog
                artistName={artistName}
                trigger={
                  <button className="w-full bg-primary py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90">
                    Apoiar {artistName.split(" ")[0]}
                  </button>
                }
              />
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT ───────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          {/* Header (desktop only — mobile is in sidebar row above) */}
          <div className="hidden lg:block">
            <p className="eyebrow">{MEDIUM_LABEL[work.medium]}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              {work.title}
            </h1>

            {/* Author + follow */}
            {artistName && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  to="/artist/$slug"
                  params={{ slug: artistSlug }}
                  className="text-sm rule-hover"
                >
                  {artistName}
                </Link>
                <button
                  onClick={() => {
                    if (!user) { toast.error("Faça login para seguir artistas."); return; }
                    followMutation.mutate();
                  }}
                  className={`text-xs uppercase tracking-[0.16em] border px-3 py-1.5 transition-colors ${
                    followed
                      ? "border-gilt text-gilt"
                      : "border-border text-muted-foreground hover:border-gilt hover:text-gilt"
                  }`}
                >
                  {followed ? "✓ Seguindo" : `+ Seguir ${artistName.split(" ")[0]}`}
                </button>
              </div>
            )}

            {/* Genre tags */}
            {genreTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {genreTags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mobile action buttons */}
          <div className="flex flex-wrap gap-2 mt-5 lg:hidden">
            {hasBody && (
              <Link
                to="/ler/$slug"
                params={{ slug: work.slug }}
                className="flex items-center gap-2 bg-gilt px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-ink font-bold transition-opacity hover:opacity-90"
              >
                <BookOpen className="h-3.5 w-3.5" />
                LER
              </Link>
            )}
            {work.pdfUrl && (
              <a
                href={work.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 border border-gilt px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-gilt font-bold transition-opacity hover:opacity-80"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </a>
            )}
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 border px-4 py-2.5 text-xs uppercase tracking-[0.18em] transition-colors ${
                liked ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
              {compact(likeCount)}
            </button>
            <button
              onClick={toggleBookmark}
              className={`flex items-center gap-2 border px-4 py-2.5 text-xs uppercase tracking-[0.18em] transition-colors ${
                saved ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
              {saved ? "Salvo" : "Salvar"}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 border border-border px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Link2 className="h-3.5 w-3.5" />
              Compartilhar
            </button>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <div className="mt-8 lg:mt-10">
            <div className="flex border-b border-border">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-5 py-3 text-xs uppercase tracking-[0.16em] transition-colors border-b-2 -mb-px ${
                    activeTab === t.key
                      ? "border-gilt text-gilt"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Sobre ── */}
            {activeTab === "sobre" && (
              <div className="pt-8">
                {/* Synopsis */}
                <p className="text-base leading-relaxed text-muted-foreground">
                  {stripHtml(work.excerpt)}
                </p>

                {/* Body preview (first paragraph as teaser) */}
                {work.body.length > 0 && work.body[0] && (
                  <div className="mt-6 prose max-w-none">
                    <WorkParagraph content={work.body[0]} className="text-sm leading-relaxed text-foreground/70 line-clamp-4" />
                    {hasBody && (
                      <Link
                        to="/ler/$slug"
                        params={{ slug: work.slug }}
                        className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gilt hover:underline"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Continuar lendo
                      </Link>
                    )}
                  </div>
                )}

                {/* Tags */}
                {work.tags && work.tags.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {work.tags.map((tag) => (
                      <span
                        key={tag}
                        className="border border-border/50 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Audio player */}
                {work.audio && (
                  <div className="mt-8 flex items-center gap-4 border border-border bg-surface px-5 py-4">
                    <button
                      onClick={() => toast("A reprodução é simulada nesta prévia.")}
                      aria-label="Reproduzir"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[2px] bg-primary text-primary-foreground"
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

                {/* Chapters index */}
                {work.chapters && work.chapters.length > 0 && (
                  <div className="mt-8 border border-border bg-surface">
                    <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
                      <p className="eyebrow text-xs">Capítulos ({work.chapters.length})</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setChapterOrder("asc")}
                          className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors ${
                            chapterOrder === "asc"
                              ? "bg-gilt text-ink"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Mais antigo
                        </button>
                        <button
                          onClick={() => setChapterOrder("desc")}
                          className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors ${
                            chapterOrder === "desc"
                              ? "bg-gilt text-ink"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Mais recente
                        </button>
                      </div>
                    </div>
                    <ol className="divide-y divide-border">
                      {[...work.chapters]
                        .sort((a, b) => chapterOrder === "asc" ? a.number - b.number : b.number - a.number)
                        .map((ch) => (
                          <li
                            key={ch.number}
                            className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm"
                          >
                            <span className="flex items-baseline gap-3">
                              <span className="tabular-nums text-muted-foreground/50">
                                {String(ch.number).padStart(2, "0")}
                              </span>
                              <span className="text-foreground">{ch.title}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{ch.date}</span>
                          </li>
                        ))}
                    </ol>
                  </div>
                )}

                {/* Mobile donate + stats */}
                <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border pt-6 lg:hidden">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{compact(views)} visualizações</span>
                    <span>{compact(likeCount)} curtidas</span>
                    {work.pages && <span>{work.pages} páginas</span>}
                  </div>
                  {artistName && (
                    <DonateDialog
                      artistName={artistName}
                      trigger={
                        <button className="bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90">
                          Apoiar {artistName.split(" ")[0]}
                        </button>
                      }
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Comentários ── */}
            {activeTab === "comentarios" && (
              <CommentsSection workSlug={work.slug} />
            )}

            {/* ── Relacionados ── */}
            {activeTab === "relacionados" && (
              <div className="pt-6">
                {related.length === 0 ? (
                  <p className="py-8 text-sm text-muted-foreground">Nenhuma obra relacionada encontrada.</p>
                ) : (
                  <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                    {related.map((w) => (
                      <WorkCard key={w.id} work={w} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Voltar ao topo ── */}
      {showBackTop && (
        <button
          onClick={() => topRef.current?.scrollIntoView({ behavior: "smooth" })}
          aria-label="Voltar ao topo"
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center border border-border bg-surface text-muted-foreground shadow-sm transition-colors hover:border-gilt hover:text-gilt"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
