import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Download, Minus, Plus, ArrowUp } from "lucide-react";
import { stripHtml } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/ler/$slug")({
  loader: async ({ params }) => {
    const { fetchWorkBySlug, dbWorkToWork } = await import("@/lib/beyond-db");
    const dbWork = await fetchWorkBySlug(params.slug);
    if (!dbWork || dbWork.status !== "approved") throw notFound();
    if (!dbWork.body?.trim()) throw notFound();
    const work = dbWorkToWork(dbWork);
    return { work, bodyHtml: dbWork.body };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Obra não encontrada — The Beyond" }] };
    const { work } = loaderData;
    const cleanTitle = stripHtml(work.title);
    const artistName = work.artistName ?? "";
    return {
      meta: [
        { title: `Ler: ${cleanTitle}${artistName ? `, de ${artistName}` : ""} — The Beyond` },
        { name: "description", content: stripHtml(work.excerpt) },
        { property: "og:type", content: "article" },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/work/${work.slug}` }],
    };
  },
  component: ReaderPage,
});

const FONT_SIZES = [
  { key: "sm", label: "A", css: "text-base leading-[1.85] sm:text-[1.05rem]" },
  { key: "md", label: "A", css: "text-lg leading-[1.9] sm:text-[1.15rem]" },
  { key: "lg", label: "A", css: "text-xl leading-[2] sm:text-[1.3rem]" },
] as const;

type FontKey = (typeof FONT_SIZES)[number]["key"];

function readFontPref(): FontKey {
  try {
    const v = localStorage.getItem("beyond_reader_font");
    if (v === "sm" || v === "md" || v === "lg") return v;
  } catch {}
  return "md";
}

function ReaderPage() {
  const { work, bodyHtml } = Route.useLoaderData();
  const { user } = useAuth();
  const bodyRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [progress, setProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [fontKey, setFontKey] = useState<FontKey>(() => readFontPref());
  const fontCss = FONT_SIZES.find((f) => f.key === fontKey)?.css ?? FONT_SIZES[1].css;

  // Salva preferência de fonte
  useEffect(() => {
    try { localStorage.setItem("beyond_reader_font", fontKey); } catch {}
  }, [fontKey]);

  // Barra de progresso de leitura
  useEffect(() => {
    function onScroll() {
      const el = bodyRef.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = Math.max(0, viewH - top);
      setProgress(Math.min(scrolled / height, 1));
      setShowBackTop(window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Quota de leitura (mesmo sistema da página de obra)
  const { data: quota, refetch: refetchQuota } = useQuery<{
    consumed: number;
    limit: number | null;
    remaining: number | null;
  }>({
    queryKey: ["reading-quota"],
    queryFn: () =>
      fetch("/api/quota").then(
        (r) => r.json() as Promise<{ consumed: number; limit: number | null; remaining: number | null }>,
      ),
    staleTime: 60_000,
  });
  const quotaExhausted = quota ? quota.remaining !== null && quota.remaining <= 0 : false;
  const pagesConsumedRef = useRef(0);

  useEffect(() => {
    if (!user || quotaExhausted) return;
    const bodyEl = bodyRef.current;
    if (!bodyEl) return;
    const totalPages = work.pages ? Number(work.pages) : 5;
    const segments = Math.min(totalPages, 10);
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    function onScroll() {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        if (!bodyEl) return;
        const { top, height } = bodyEl.getBoundingClientRect();
        const scrolled = Math.max(0, window.innerHeight - top);
        const fraction = Math.min(scrolled / height, 1);
        const pagesRead = Math.floor(fraction * segments);
        const toConsume = pagesRead - pagesConsumedRef.current;
        if (toConsume <= 0) return;
        pagesConsumedRef.current = pagesRead;
        void fetch("/api/quota/consume", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pages: toConsume }),
        })
          .then((r) => r.json() as Promise<{ allowed: boolean; remaining: number }>)
          .then((res) => {
            if (!res.allowed) void refetchQuota();
          });
      }, 500);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [user, quotaExhausted, work.pages, refetchQuota]);

  const cleanTitle = stripHtml(work.title);

  return (
    <>
      {/* Barra de progresso fixa no topo */}
      <div
        className="fixed left-0 right-0 top-0 z-50 h-0.5 bg-gilt/25"
        aria-hidden="true"
      >
        <div
          className="h-full bg-gilt transition-all duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div ref={topRef} className="mx-auto max-w-[720px] px-5 py-12 sm:px-8 sm:py-16">
        {/* Barra de navegação do leitor */}
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            to="/work/$slug"
            params={{ slug: work.slug }}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gilt"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Voltar à obra
          </Link>

          <div className="flex items-center gap-1 border border-border bg-surface">
            {FONT_SIZES.map((f) => (
              <button
                key={f.key}
                onClick={() => setFontKey(f.key)}
                title={`Tamanho ${f.label}`}
                className={`px-3 py-1.5 transition-colors ${
                  fontKey === f.key
                    ? "bg-gilt/15 text-gilt"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{
                  fontSize:
                    f.key === "sm" ? "0.75rem" : f.key === "md" ? "0.875rem" : "1rem",
                }}
              >
                A
              </button>
            ))}
            {work.pdfUrl && (
              <>
                <span className="h-4 w-px bg-border" />
                <a
                  href={work.pdfUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Baixar PDF"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-gilt"
                >
                  <Download className="size-3.5" strokeWidth={1.5} />
                  PDF
                </a>
              </>
            )}
          </div>
        </div>

        {/* Cabeçalho da obra */}
        <header className="border-b border-border pb-8 mb-10">
          <p className="eyebrow mb-3">{work.medium}</p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{cleanTitle}</h1>
          {work.artistName && (
            <p className="mt-3 text-sm text-muted-foreground">
              {work.artistName}
            </p>
          )}
        </header>

        {/* Corpo da obra */}
        <div className="relative">
          <div
            ref={bodyRef}
            className={`prose prose-invert max-w-none ${fontCss} [&_p]:mb-[1.4em] [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-display [&_blockquote]:border-l-2 [&_blockquote]:border-gilt/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground`}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          {/* Paywall overlay */}
          {quotaExhausted && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
          )}
        </div>

        {quotaExhausted && (
          <div className="mt-0 border border-gilt/40 bg-surface px-8 py-10 text-center">
            <p className="eyebrow">Limite diário atingido</p>
            <p className="mt-4 font-display text-2xl tracking-tight">
              Você leu suas 10 páginas de hoje
            </p>
            <p className="caption mt-3">
              Volte amanhã para continuar — ou torne-se VIP para leitura ilimitada.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                to="/planos"
                className="btn-type border border-gilt bg-gilt/10 px-5 py-2.5 text-xs text-gilt transition-colors hover:bg-gilt hover:text-ink"
              >
                Ver planos VIP
              </Link>
              <Link
                to="/work/$slug"
                params={{ slug: work.slug }}
                className="btn-type border border-border px-5 py-2.5 text-xs text-muted-foreground transition-colors hover:border-gilt/50 hover:text-foreground"
              >
                Voltar à obra
              </Link>
            </div>
          </div>
        )}

        {/* Rodapé do leitor */}
        {!quotaExhausted && (
          <div className="mt-16 border-t border-border pt-8 text-center">
            <p className="caption">Fim da obra</p>
            <Link
              to="/work/$slug"
              params={{ slug: work.slug }}
              className="btn-type mt-4 inline-block border border-border px-5 py-2.5 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
            >
              ← Voltar à página da obra
            </Link>
          </div>
        )}
      </div>

      {/* Botão voltar ao topo */}
      {showBackTop && (
        <button
          onClick={() => topRef.current?.scrollIntoView({ behavior: "smooth" })}
          aria-label="Voltar ao topo"
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center border border-border bg-surface text-muted-foreground shadow-sm transition-colors hover:border-gilt hover:text-gilt"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
