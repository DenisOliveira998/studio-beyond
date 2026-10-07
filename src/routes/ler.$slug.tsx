import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { FREE_DAILY_QUOTA, MEDIUM_LABEL } from "@/lib/beyond-data";
import type { Work } from "@/lib/beyond-data";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowUp, ImageOff } from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";
import { toast } from "sonner";
import { stripHtml } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DonateDialog } from "@/components/donate-dialog";

type Quota = { consumed: number; limit: number | null; remaining: number | null };

// Visitantes sem conta seguem a mesma regra diária das contas gratuitas,
// contada neste navegador (o servidor só identifica quem está logado).
const ANON_QUOTA_KEY = "beyond_anon_quota";

function readAnonQuota(): Quota {
  const today = new Date().toISOString().slice(0, 10);
  let consumed = 0;
  try {
    const raw = localStorage.getItem(ANON_QUOTA_KEY);
    const parsed = raw ? (JSON.parse(raw) as { date?: string; consumed?: number }) : null;
    if (parsed?.date === today) consumed = Number(parsed.consumed) || 0;
  } catch {}
  return { consumed, limit: FREE_DAILY_QUOTA, remaining: Math.max(0, FREE_DAILY_QUOTA - consumed) };
}

function consumeAnonQuota(pages: number): Quota {
  const current = readAnonQuota();
  const consumed = current.consumed + pages;
  try {
    localStorage.setItem(
      ANON_QUOTA_KEY,
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), consumed }),
    );
  } catch {}
  return { consumed, limit: FREE_DAILY_QUOTA, remaining: Math.max(0, FREE_DAILY_QUOTA - consumed) };
}

type ChapterMeta = { number: number; label: string; free: boolean; earlyUntil: string | null; hasPreview: boolean; pdfPages: number | null };

export const Route = createFileRoute("/ler/$slug")({
  // ?cap=N escolhe o capítulo (mantido como chegou: "2" vira número no roteador)
  validateSearch: (s: Record<string, unknown>): { cap?: number | string } =>
    typeof s["cap"] === "number" || typeof s["cap"] === "string" ? { cap: s["cap"] as number | string } : {},
  loader: async ({ params }) => {
    const base = typeof window === "undefined" ? SITE_URL : "";
    // Só os dados da obra; o texto é buscado no navegador, com a sessão do leitor,
    // para o servidor conferir o limite diário (a página é noindex, não precisa do texto no HTML)
    const res = await fetch(`${base}/api/reader/${params.slug}?meta=1`);
    if (res.status === 404) throw notFound();
    if (!res.ok) throw new Error("Falha ao carregar obra");
    return (await res.json()) as { work: Work; readerMode: "text" | "webtoon" | "pdf"; chapters?: ChapterMeta[] };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Obra não encontrada | Go Beyondd" }] };
    const { work } = loaderData;
    const cleanTitle = stripHtml(work.title);
    const artistName = work.artistName ?? "";
    return {
      meta: [
        { title: `Ler ${cleanTitle}${artistName ? `, de ${artistName}` : ""} | Go Beyondd` },
        { name: "description", content: stripHtml(work.excerpt) },
        { property: "og:type", content: "article" },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/obra/${work.slug}` }],
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

function WebtoonBody({
  images,
  bodyRef,
  loading,
}: {
  images: string[];
  bodyRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div ref={bodyRef} className="flex justify-center py-24">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }
  if (images.length === 0) {
    return (
      <div ref={bodyRef} className="flex flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
        <ImageOff className="size-10 opacity-30" strokeWidth={1.5} />
        <p className="text-sm">As imagens desta obra ainda não foram carregadas.</p>
      </div>
    );
  }
  return (
    <div ref={bodyRef} className="flex flex-col items-center gap-0">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Página ${i + 1}`}
          className="w-full max-w-[800px] block"
          loading={i < 3 ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </div>
  );
}

function ReaderPage() {
  const loaderData = Route.useLoaderData();
  const { work } = loaderData;
  const isWebtoon = loaderData.readerMode === "webtoon";
  const isPdf = loaderData.readerMode === "pdf";
  const { user, loading: authLoading } = useAuth();
  // Capítulo atual (o de menor número quando não vem na URL)
  const { cap } = Route.useSearch();
  const chapters = loaderData.chapters ?? [];
  const capIdx = Math.max(0, cap != null ? chapters.findIndex((c) => c.number === Number(cap)) : 0);
  const chapter = chapters[capIdx];
  const prevChapter = capIdx > 0 ? chapters[capIdx - 1] : undefined;
  const nextChapter = capIdx < chapters.length - 1 ? chapters[capIdx + 1] : undefined;
  // Texto/imagens com a sessão do leitor (o servidor confere o limite diário de contas gratuitas)
  const { data: content, isLoading: contentLoading } = useQuery<{
    bodyHtml?: string;
    bodyImages?: string[];
    locked?: boolean;
    access?: "full" | "preview" | "early" | "login";
    free?: boolean;
    earlyUntil?: string | null;
  }>({
    queryKey: ["reader-content", work.slug, chapter?.number ?? "-", user?.id ?? "anon"],
    queryFn: () => fetch(`/api/reader/${work.slug}${chapter ? `?cap=${chapter.number}` : ""}`).then((r) => r.json()),
    enabled: !authLoading,
    staleTime: 0,
  });
  const bodyHtml = content?.bodyHtml ?? "";
  const bodyImages = content?.bodyImages ?? [];
  const lockedByServer = content?.locked === true;
  const bodyRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [progress, setProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [fontKey, setFontKey] = useState<FontKey>(() => readFontPref());
  const fontCss = FONT_SIZES.find((f) => f.key === fontKey)?.css ?? FONT_SIZES[1].css;
  const scrollKey = `beyond_scroll_${work.slug}`;

  // Salva preferência de fonte
  useEffect(() => {
    try { localStorage.setItem("beyond_reader_font", fontKey); } catch {}
  }, [fontKey]);

  // Restaura posição de scroll
  useEffect(() => {
    try {
      const saved = localStorage.getItem(scrollKey);
      if (saved) {
        const y = parseInt(saved, 10);
        if (!isNaN(y) && y > 0) setTimeout(() => window.scrollTo(0, y), 120);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Barra de progresso de leitura + salva posição
  useEffect(() => {
    function onScroll() {
      const el = bodyRef.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = Math.max(0, viewH - top);
      setProgress(Math.min(scrolled / height, 1));
      setShowBackTop(window.scrollY > 600);
      try { localStorage.setItem(scrollKey, String(window.scrollY)); } catch {}
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quota de leitura (mesmo sistema da página de obra)
  const { data: quota, refetch: refetchQuota } = useQuery<Quota>({
    queryKey: ["reading-quota", user?.id ?? "anon"],
    queryFn: () =>
      user
        ? fetch("/api/quota").then((r) => r.json() as Promise<Quota>)
        : Promise.resolve(readAnonQuota()),
    staleTime: 60_000,
  });
  const quotaExhausted = lockedByServer || (quota ? quota.remaining !== null && quota.remaining <= 0 : false);
  const showQuotaWarning =
    quota &&
    quota.remaining !== null &&
    quota.limit !== null &&
    quota.remaining > 0 &&
    quota.remaining <= Math.max(3, Math.floor(quota.limit * 0.2));
  const pagesConsumedRef = useRef(0);

  useEffect(() => {
    if (quotaExhausted || content?.free || content?.access !== undefined && content.access !== "full") return;
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
        // texto ainda carregando (altura ~0): não conta páginas
        if (height < 200) return;
        const scrolled = Math.max(0, window.innerHeight - top);
        const fraction = Math.min(scrolled / height, 1);
        const pagesRead = Math.floor(fraction * segments);
        const toConsume = pagesRead - pagesConsumedRef.current;
        if (toConsume <= 0) return;
        pagesConsumedRef.current = pagesRead;
        if (!user) {
          const next = consumeAnonQuota(toConsume);
          if ((next.remaining ?? 1) <= 0) void refetchQuota();
          return;
        }
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
  }, [user, quotaExhausted, work.pages, refetchQuota, bodyHtml, bodyImages.length]);

  const cleanTitle = stripHtml(work.title);

  return (
    <>
      {/* Barra de progresso fixa no topo */}
      <div
        className="fixed left-0 right-0 top-0 z-50 h-1 bg-gilt/25"
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
            to="/obra/$slug"
            params={{ slug: work.slug }}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gilt"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Voltar à obra
          </Link>

          <div className={`flex items-center gap-1 border border-border bg-surface ${isWebtoon || isPdf ? "hidden" : ""}`}>
            {!isWebtoon && !isPdf && FONT_SIZES.map((f) => (
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
          </div>
        </div>

        {/* Cabeçalho da obra */}
        <header className="border-b border-border pb-8 mb-10">
          <p className="eyebrow mb-3">{MEDIUM_LABEL[work.medium] ?? work.medium}</p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{cleanTitle}</h1>
          {work.artistName && (
            <p className="mt-3 text-sm text-muted-foreground">
              {work.artistName}
            </p>
          )}
        </header>

        {/* Corpo da obra */}
        <div className="relative">
          {isPdf ? (
            <>
              {/* Navegação entre capítulos */}
              {chapters.length > 1 && (
                <nav aria-label="Capítulos" className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                  {prevChapter ? (
                    <Link to="/ler/$slug" params={{ slug: work.slug }} search={{ cap: prevChapter.number }} className="text-muted-foreground hover:text-foreground">
                      Capítulo anterior
                    </Link>
                  ) : <span />}
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Escolher capítulo</span>
                    <select
                      value={chapter?.number}
                      onChange={(e) => { window.location.href = `/ler/${work.slug}?cap=${e.target.value}`; }}
                      className="rounded border border-border bg-surface px-3 py-1.5"
                    >
                      {chapters.map((c) => (
                        <option key={c.number} value={c.number}>
                          {c.label}{c.earlyUntil ? " (antecipado)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {nextChapter ? (
                    <Link to="/ler/$slug" params={{ slug: work.slug }} search={{ cap: nextChapter.number }} className="text-muted-foreground hover:text-foreground">
                      Próximo capítulo
                    </Link>
                  ) : <span />}
                </nav>
              )}
              {authLoading || contentLoading ? (
                <div className="flex justify-center py-24">
                  <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
                </div>
              ) : content?.access === "early" ? (
                <div ref={bodyRef} className="rounded border border-border bg-surface px-6 py-12 text-center">
                  <h2 className="font-display text-2xl font-bold tracking-tight">{chapter?.label}: acesso antecipado</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Super Fãs já podem ler este capítulo. Para todos, ele libera
                    {content.earlyUntil ? ` em ${new Date(content.earlyUntil).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}` : " em breve"}.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link to="/planos" className="rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">Conhecer o Super Fã</Link>
                    {prevChapter && (
                      <Link to="/ler/$slug" params={{ slug: work.slug }} search={{ cap: prevChapter.number }} className="rounded-full border border-border px-6 py-2.5 text-sm">
                        Ler o capítulo anterior
                      </Link>
                    )}
                  </div>
                </div>
              ) : content?.access === "login" ? (
                <div ref={bodyRef} className="rounded border border-border bg-surface px-6 py-12 text-center">
                  <h2 className="font-display text-2xl font-bold tracking-tight">Entre para ler este capítulo</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    A leitura é gratuita: basta ter uma conta. Leva menos de um minuto.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link to="/criar" className="rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">Criar conta grátis</Link>
                    <a href={`/entrar?redirect=${encodeURIComponent(`/ler/${work.slug}?cap=${chapter?.number ?? ""}`)}`} className="rounded-full border border-border px-6 py-2.5 text-sm">
                      Já tenho conta
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <PdfViewer
                    key={`${chapter?.number}-${content?.access}`}
                    slug={work.slug}
                    cap={chapter?.number}
                    bodyRef={bodyRef}
                    enabled={!quotaExhausted}
                    preview={content?.access === "preview"}
                    defaultTheme={["livro", "conto", "lightnovel"].includes(work.medium) ? "escuro" : "original"}
                  />
                  {content?.access === "preview" && (
                    <div className="mt-6 rounded border border-border bg-surface px-6 py-10 text-center">
                      <h2 className="font-display text-2xl font-bold tracking-tight">Gostou do começo?</h2>
                      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                        Estas são as 2 primeiras páginas{chapter?.pdfPages ? ` de ${chapter.pdfPages}` : ""}. Crie sua conta grátis para ler o resto.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Link to="/criar" className="rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">Criar conta grátis</Link>
                        <a href={`/entrar?redirect=${encodeURIComponent(`/ler/${work.slug}?cap=${chapter?.number ?? ""}`)}`} className="rounded-full border border-border px-6 py-2.5 text-sm">
                          Já tenho conta
                        </a>
                      </div>
                    </div>
                  )}
                  {content?.access === "full" && nextChapter && (
                    <div className="mt-8 flex justify-center">
                      <Link
                        to="/ler/$slug"
                        params={{ slug: work.slug }}
                        search={{ cap: nextChapter.number }}
                        className="rounded-full bg-gilt px-8 py-3 text-sm font-bold text-ink"
                      >
                        Próximo capítulo
                      </Link>
                    </div>
                  )}
                </>
              )}
            </>
          ) : isWebtoon ? (
            <WebtoonBody images={bodyImages} bodyRef={bodyRef} loading={authLoading || contentLoading} />
          ) : (
            <>
            {(authLoading || contentLoading) && (
              <div className="flex justify-center py-24">
                <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
              </div>
            )}
            <div
              ref={bodyRef}
              className={`prose prose-invert max-w-none ${fontCss} [&_p]:mb-[1.4em] [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-display [&_blockquote]:border-l-2 [&_blockquote]:border-gilt/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground`}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
            </>
          )}

          {/* Paywall overlay */}
          {quotaExhausted && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
          )}
        </div>

        {quotaExhausted && (
          <div className="mt-0 border border-gilt/40 bg-surface px-8 py-10 text-center">
            <p className="eyebrow">Limite diário atingido</p>
            <p className="mt-4 font-display text-2xl tracking-tight">
              Você chegou ao limite de leitura de hoje
            </p>
            <p className="caption mt-3">
              Volte amanhã para continuar — ou entre na lista dos planos Fã e Super Fã para ler sem limite e sem anúncios.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                to="/planos"
                className="btn-type border border-gilt bg-gilt/10 px-5 py-2.5 text-xs text-gilt transition-colors hover:bg-gilt hover:text-ink"
              >
                Ver os planos Fã e Super Fã
              </Link>
              <Link
                to="/obra/$slug"
                params={{ slug: work.slug }}
                className="btn-type border border-border px-5 py-2.5 text-xs text-muted-foreground transition-colors hover:border-gilt/50 hover:text-foreground"
              >
                Voltar à obra
              </Link>
            </div>
          </div>
        )}

        {/* Rodapé do leitor (não aparece para quem ainda não pode ler o PDF inteiro) */}
        {!quotaExhausted && !(isPdf && (content?.access !== "full" || !!nextChapter)) && (
          <EndOfWork work={work} title={cleanTitle} />
        )}
      </div>

      {/* Indicador de cota restante */}
      {showQuotaWarning && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 border border-gilt/40 bg-surface px-4 py-2 text-xs text-gilt shadow-lg">
          {quota!.remaining} {quota!.remaining === 1 ? "página" : "páginas"} restantes hoje
        </div>
      )}

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

// ── Fim da obra: apoio, seguir e próximas leituras ───────────────

function EndOfWork({ work, title }: { work: Work; title: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const artistName = work.artistName ?? "";
  const artistSlug = work.artistSlug;
  const loginHref = `/entrar?redirect=${encodeURIComponent(`/ler/${work.slug}`)}`;

  const { data: followData } = useQuery<{ followed: boolean }>({
    queryKey: ["follow", artistSlug],
    queryFn: () =>
      fetch(`/api/artists/${artistSlug}/follow`).then((r) => r.json() as Promise<{ followed: boolean }>),
    enabled: !!artistSlug && !!user,
    staleTime: 60_000,
  });
  const followed = followData?.followed ?? false;
  const follow = useMutation({
    mutationFn: () =>
      fetch(`/api/artists/${artistSlug}/follow`, { method: "POST" }).then(
        (r) => r.json() as Promise<{ followed: boolean }>,
      ),
    onSuccess: (data) => {
      qc.setQueryData(["follow", artistSlug], data);
      toast.success(data.followed ? `Seguindo ${artistName}.` : `Você deixou de seguir ${artistName}.`);
    },
    onError: () => toast.error("Erro. Tente novamente."),
  });

  const btn =
    "btn-type border border-border px-5 py-2.5 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt";

  return (
    <div className="mt-16 border-t border-border pt-10 text-center">
      <p className="caption">Fim da obra</p>
      {artistName ? (
        <>
          <p className="mx-auto mt-3 max-w-md font-display text-2xl leading-snug tracking-tight">
            Gostou de <span className="title-italic">{title}</span>?
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Apoie {artistName} diretamente — o apoio vai para quem escreveu.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <DonateDialog
              artistName={artistName}
              artistSlug={work.artistSlug}
              workSlug={work.slug}
              trigger={
                <button className="btn-type bg-gilt px-5 py-2.5 text-xs font-bold text-ink transition-opacity hover:opacity-90">
                  Apoiar {artistName.split(" ")[0]}
                </button>
              }
            />
            {user ? (
              <button onClick={() => follow.mutate()} disabled={follow.isPending} className={btn}>
                {followed ? "Seguindo" : `Seguir ${artistName.split(" ")[0]}`}
              </button>
            ) : (
              <a href={loginHref} className={btn}>
                Seguir {artistName.split(" ")[0]}
              </a>
            )}
            <Link to="/artist/$slug" params={{ slug: artistSlug }} className={btn}>
              Mais de {artistName.split(" ")[0]}
            </Link>
          </div>
        </>
      ) : null}
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to="/obra/$slug" params={{ slug: work.slug }} className={btn}>
          ← Página da obra
        </Link>
        <Link
          to="/explorar"
          className="btn-type border border-gilt/50 px-5 py-2.5 text-xs text-gilt/80 transition-colors hover:border-gilt hover:text-gilt"
        >
          Explorar mais obras →
        </Link>
      </div>
    </div>
  );
}
