import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowUp, Bookmark, Download, Heart, Link2, Play } from "lucide-react";
import { toast } from "sonner";
import { DonateDialog } from "@/components/donate-dialog";
import { WorkCard } from "@/components/work-card";
import { MEDIUM_LABEL, compact } from "@/lib/beyond-data";
import { stripHtml, isHtml } from "@/lib/utils";

export const Route = createFileRoute("/work/$slug")({
  loader: async ({ params }) => {
    const { fetchWorkBySlug, fetchApprovedWorks, dbWorkToWork } = await import("@/lib/beyond-db");
    const dbWork = await fetchWorkBySlug(params.slug);
    if (!dbWork || dbWork.status !== "approved") throw notFound();
    const work = dbWorkToWork(dbWork);
    const allWorks = await fetchApprovedWorks();
    const related = allWorks
      .filter((w) => w.slug !== work.slug && (w.artistSlug === work.artistSlug || w.medium === work.medium))
      .slice(0, 3)
      .map(dbWorkToWork);
    return { work, related };
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
    // Lição Galinha GSB: sempre stripHtml em meta tags — rich text vaza <p>Título</p>
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
      links: [
        { rel: "canonical", href: `${SITE_URL}/work/${work.slug}` },
      ],
    };
  },
  component: WorkPage,
});

/**
 * Renderiza um parágrafo do corpo da obra.
 * Lição Galinha GSB: quando o corpo vier de um editor rich text (TipTap etc.),
 * conterá HTML — usar dangerouslySetInnerHTML nesse caso.
 * isHtml() detecta automaticamente para suportar ambos os formatos.
 */
function WorkParagraph({ content, className }: { content: string; className?: string }) {
  if (isHtml(content)) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return <p className={className}>{content}</p>;
}

// ── Comentários ────────────────────────────────────────────────

type Comment = { id: string; author: string; text: string; ago: string };

const SEED_COMMENTS: Comment[] = [
  { id: "c1", author: "Mariana T.", text: "Que obra densa. Terminei de ler às 2h da manhã e fiquei olhando pro teto por meia hora.", ago: "3 dias atrás" },
  { id: "c2", author: "Felipe R.", text: "A escrita tem um ritmo muito particular — às vezes lenta demais e depois te pega de surpresa. Gostei muito.", ago: "1 semana atrás" },
];

const COMMENTS_KEY = "beyond:comments:";

function CommentsSection({ workSlug }: { workSlug: string }) {
  const key = COMMENTS_KEY + workSlug;
  const [comments, setComments] = useState<Comment[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Comment[]) : SEED_COMMENTS;
    } catch { return SEED_COMMENTS; }
  });
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);

  const persist = useCallback((list: Comment[]) => {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
  }, [key]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setTimeout(() => {
      const next: Comment[] = [
        { id: `c${Date.now()}`, author: name.trim() || "Anônimo", text: draft.trim(), ago: "agora mesmo" },
        ...comments,
      ];
      setComments(next);
      persist(next);
      setDraft("");
      setSending(false);
      toast.success("Comentário publicado.");
    }, 600);
  }

  return (
    <section className="mt-20 border-t border-border pt-12">
      <h2 className="font-display text-2xl tracking-tight">
        Comentários <span className="ml-2 text-base text-muted-foreground">({comments.length})</span>
      </h2>

      {/* Formulário */}
      <form onSubmit={handleSend} className="mt-8 border border-border bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow">Seu nome (opcional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como quer ser chamado?"
              className="mt-2 w-full border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
          </label>
        </div>
        <label className="mt-4 block">
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
          disabled={sending}
          className="btn-type mt-4 border border-gilt px-5 py-2 text-xs text-gilt transition-colors hover:bg-gilt hover:text-primary-foreground disabled:opacity-60"
        >
          {sending ? "Publicando…" : "Publicar comentário"}
        </button>
      </form>

      {/* Lista */}
      <div className="mt-8 divide-y divide-border">
        {comments.map((c) => (
          <div key={c.id} className="py-6">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-base">{c.author}</span>
              <span className="text-xs text-muted-foreground">{c.ago}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Bookmark ────────────────────────────────────────────────────

const BOOKMARK_KEY = "beyond:bookmarks";

function useBookmark(slug: string) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      setSaved(list.includes(slug));
    } catch { /* ignore */ }
  }, [slug]);

  function toggle() {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
      setSaved(next.includes(slug));
      toast.success(next.includes(slug) ? "Obra salva na sua lista." : "Removida da lista.");
    } catch { /* ignore */ }
  }

  return { saved, toggle };
}

function WorkPage() {
  const { work, related } = Route.useLoaderData();
  const artistName = work.artistName ?? "";
  const artistSlug = work.artistSlug;
  const [liked, setLiked] = useState(false);
  const [followed, setFollowed] = useState(false);
  const { saved, toggle: toggleBookmark } = useBookmark(work.slug);
  const [showBackTop, setShowBackTop] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const views = work.clicks + 1;

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <article ref={topRef} className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      {/* Eyebrow: categoria + gênero + data */}
      <p className="eyebrow">
        {MEDIUM_LABEL[work.medium]}
        {work.genre && <> · {work.genre}</>}
        {" · "}{work.published}
      </p>

      <h1 className="hero-type mt-5 text-3xl sm:text-5xl">
        {work.title}
      </h1>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {artistName && (
          <Link
            to="/artist/$slug"
            params={{ slug: artistSlug }}
            className="rule-hover text-foreground"
          >
            {artistName}
          </Link>
        )}
        <span aria-hidden>·</span>
        <span>{compact(views)} visualizações contabilizadas</span>
        {work.readTime && (
          <>
            <span aria-hidden>·</span>
            <span>{work.readTime}</span>
          </>
        )}
        {work.pages && (
          <>
            <span aria-hidden>·</span>
            <span>{work.pages} páginas</span>
          </>
        )}
      </div>

      {/* Seguir autor */}
      {artistName && (
        <div className="mt-5">
          <button
            onClick={() => {
              setFollowed((v) => !v);
              toast.success(
                followed
                  ? `Você deixou de seguir ${artistName}.`
                  : `Você está seguindo ${artistName}. Novidades chegarão por e-mail.`,
              );
            }}
            className={`text-xs uppercase tracking-[0.18em] border px-4 py-2 transition-colors ${
              followed
                ? "border-gilt text-gilt"
                : "border-border text-muted-foreground hover:border-gilt hover:text-gilt"
            }`}
          >
            {followed ? "✓ Seguindo" : `+ Seguir ${artistName.split(" ")[0]}`}
          </button>
        </div>
      )}

      {work.cover && (
        <img
          src={work.cover}
          alt={stripHtml(work.title)}
          width={1280}
          height={860}
          className="mt-10 w-full object-cover"
        />
      )}

      {work.audio && (
        <div className="mt-6 flex items-center gap-4 border border-border bg-surface px-5 py-4">
          <button
            onClick={() => toast("A reprodução é simulada nesta prévia.")}
            aria-label="Reproduzir"
            className="flex h-11 w-11 items-center justify-center rounded-[2px] bg-primary text-primary-foreground"
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

      {/* ── Índice de capítulos ── */}
      {work.chapters && work.chapters.length > 0 && (
        <div className="mt-10 border border-border bg-surface">
          <p className="eyebrow border-b border-border px-5 py-3 text-xs">Capítulos</p>
          <ol className="divide-y divide-border">
            {work.chapters.map((ch) => (
              <li
                key={ch.number}
                className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm"
              >
                <span className="flex items-baseline gap-3">
                  <span className="tabular-nums text-muted-foreground/50">{String(ch.number).padStart(2, "0")}</span>
                  <span className="text-foreground">{ch.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{ch.date}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Corpo da obra com prose (typography plugin) para experiência de leitura */}
      <div className="prose mt-10 max-w-none">
        <p className="lead text-muted-foreground not-prose text-lg leading-relaxed">
          {work.excerpt}
        </p>
        <div className="mt-6">
          {work.body.map((p, i) => (
            <WorkParagraph key={i} content={p} />
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-border pt-8">
        <button
          onClick={() => setLiked((v) => !v)}
          aria-label={liked ? "Remover curtida" : "Curtir"}
          className={`flex items-center gap-2 border px-4 py-2.5 text-xs uppercase tracking-[0.18em] transition-colors ${
            liked ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          {compact(work.likes + (liked ? 1 : 0))}
        </button>

        <button
          onClick={toggleBookmark}
          aria-label={saved ? "Remover da lista" : "Salvar na lista"}
          className={`flex items-center gap-2 border px-4 py-2.5 text-xs uppercase tracking-[0.18em] transition-colors ${
            saved ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
          {saved ? "Salvo" : "Salvar"}
        </button>

        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              void navigator.clipboard?.writeText(window.location.href);
            }
            toast.success("Link copiado");
          }}
          className="flex items-center gap-2 border border-border px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="h-3.5 w-3.5" />
          Compartilhar
        </button>

        {artistName && (
          <DonateDialog
            artistName={artistName}
            trigger={
              <button className="bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90">
                Doar para {artistName.split(" ")[0]}
              </button>
            }
          />
        )}

        {work.pdfUrl && (
          <a
            href={work.pdfUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 border border-border px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </a>
        )}
      </div>

      {/* ── Obras relacionadas ── */}
      {related.length > 0 && (
        <section className="mt-20 border-t border-border pt-12">
          <p className="eyebrow mb-8">Você também pode gostar</p>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((w) => (
              <WorkCard key={w.id} work={w} />
            ))}
          </div>
        </section>
      )}

      {/* ── Comentários ── */}
      <CommentsSection workSlug={work.slug} />

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
    </article>
  );
}
