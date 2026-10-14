import { useEffect, useRef, useState } from "react";
import { FileText, FileWarning, Image as ImageIcon, Minus, Plus } from "lucide-react";
import type { TextBlock } from "@/lib/pdf-text";

type PdfTheme = "original" | "sepia" | "escuro";

/** Tema de leitura aplicado como filtro sobre a página desenhada (o arquivo não muda). */
const THEMES: Record<PdfTheme, { label: string; filter: string; paper: string }> = {
  original: { label: "Original", filter: "none", paper: "#ffffff" },
  sepia: { label: "Sépia", filter: "sepia(0.5) saturate(0.85) brightness(0.96)", paper: "#efe4cc" },
  escuro: { label: "Escuro", filter: "invert(0.9) hue-rotate(180deg) contrast(0.92)", paper: "#262626" },
};
const THEME_KEY = "beyond_pdf_theme";
const MODE_KEY = "beyond_pdf_mode";
/** Cores do modo Texto (o texto é do site, não da página: dá para trocar de verdade). */
const TEXT_COLORS: Record<PdfTheme, { bg: string; fg: string }> = {
  original: { bg: "#ffffff", fg: "#1b1b1b" },
  sepia: { bg: "#f1e6cf", fg: "#3b2f20" },
  escuro: { bg: "#1c1c1e", fg: "#e6e1d8" },
};
const ZOOM_KEY = "beyond_pdf_zoom";
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.2;

function readTheme(fallback: PdfTheme): PdfTheme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "original" || v === "sepia" || v === "escuro") return v;
  } catch {}
  return fallback;
}

/**
 * Visor de PDF das obras licenciadas: cada página é desenhada como imagem (canvas),
 * sem barra de ferramentas, sem download, sem impressão e sem texto selecionável.
 * O arquivo vem de /api/reader/:slug/arquivo, que só responde a pedidos do próprio site.
 */
export function PdfViewer({
  slug,
  bodyRef,
  enabled,
  cap,
  preview = false,
  defaultTheme = "original",
  textMode = false,
}: {
  slug: string;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  /** Número do capítulo (sem ele, o primeiro) */
  cap?: number | undefined;
  /** Só as 2 primeiras páginas (visitante sem login) */
  preview?: boolean;
  /** Prosa abre no escuro; quadrinhos, no original (não altera a arte). */
  defaultTheme?: PdfTheme;
  /** Livros, contos e novels: oferece o modo Texto (letra ajustável, sem zoom). */
  textMode?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [doc, setDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [theme, setTheme] = useState<PdfTheme>(defaultTheme);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<"texto" | "pagina">("pagina");
  const [blocks, setBlocks] = useState<TextBlock[] | null>(null);
  const [noText, setNoText] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  // Prosa: no celular abre em Texto; no computador, na página original. A escolha fica salva.
  useEffect(() => {
    if (!textMode) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(MODE_KEY); } catch {}
    if (saved === "texto" || saved === "pagina") setMode(saved);
    else setMode(window.matchMedia("(max-width: 767px)").matches ? "texto" : "pagina");
  }, [textMode]);

  function chooseMode(m: "texto" | "pagina") {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch {}
  }

  // Extrai o texto do PDF quando o modo Texto é usado
  useEffect(() => {
    if (!textMode || mode !== "texto" || !doc || blocks || noText) return;
    let cancelled = false;
    (async () => {
      const { pageBlocks, mergePages } = await import("@/lib/pdf-text");
      const pages: TextBlock[][] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i).catch(() => null);
        if (!page) continue;
        const tc = await page.getTextContent().catch(() => null);
        if (!tc) continue;
        pages.push(pageBlocks(tc.items as Parameters<typeof pageBlocks>[0], page.getViewport({ scale: 1 }).width));
        if (cancelled) return;
      }
      const merged = mergePages(pages);
      const chars = merged.reduce((n, b) => n + b.text.length, 0);
      if (cancelled) return;
      // PDF escaneado (só imagem): não há texto para mostrar
      if (chars < 40 * Math.min(doc.numPages, 3)) setNoText(true);
      else setBlocks(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [textMode, mode, doc, blocks, noText]);

  /** Dois toques (ou duplo clique) na página: aproxima naquele ponto; de novo, volta ao tamanho normal. */
  function zoomAt(clientX: number, clientY: number) {
    const body = bodyRef.current;
    const scroller = scrollerRef.current;
    if (!body || !scroller) return;
    const rect = body.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    const next = zoom > 1 ? 1 : 2;
    setZoom(next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const r2 = body.getBoundingClientRect();
        scroller.scrollLeft = Math.max(0, fx * r2.width - scroller.clientWidth / 2);
        window.scrollBy({ top: r2.top + fy * r2.height - clientY });
      }),
    );
  }

  // Preferência salva só depois de montar (evita diferença entre servidor e navegador)
  useEffect(() => { setTheme(readTheme(defaultTheme)); }, [defaultTheme]);
  useEffect(() => {
    try {
      const z = Number(localStorage.getItem(ZOOM_KEY));
      if (z >= ZOOM_MIN && z <= ZOOM_MAX) setZoom(z);
    } catch {}
  }, []);

  function changeZoom(delta: number) {
    setZoom((z) => {
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)) * 10) / 10;
      try { localStorage.setItem(ZOOM_KEY, String(next)); } catch {}
      return next;
    });
  }

  function chooseTheme(t: PdfTheme) {
    setTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch {}
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let loaded: import("pdfjs-dist").PDFDocumentProxy | null = null;
    setState("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        // Carrega por partes: a primeira página aparece sem baixar o arquivo inteiro
        const doc = await pdfjs.getDocument({
          url: `/api/reader/${encodeURIComponent(slug)}/arquivo?${new URLSearchParams({
            ...(cap != null ? { cap: String(cap) } : {}),
            ...(preview ? { previa: "1" } : {}),
          }).toString()}`,
          rangeChunkSize: 512 * 1024,
          disableAutoFetch: true,
          disableStream: true,
        }).promise;
        if (cancelled) return void doc.destroy();
        loaded = doc;
        setDoc(doc);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      setDoc(null);
      void loaded?.destroy();
    };
  }, [slug, enabled, preview, cap]);

  if (state === "error") {
    return (
      <div ref={bodyRef} className="flex flex-col items-center gap-3 py-24 text-center text-muted-foreground">
        <FileWarning className="size-10 opacity-40" strokeWidth={1.5} />
        <p className="text-sm">Não foi possível abrir a obra agora. Recarregue a página para tentar de novo.</p>
      </div>
    );
  }
  if (state === "loading" || !doc) {
    return (
      <div ref={bodyRef} className="flex justify-center py-24">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }
  const t = THEMES[theme];
  const showText = textMode && mode === "texto" && !noText;
  const colors = TEXT_COLORS[theme];
  return (
    <div>
      {textMode && (
        <div role="group" aria-label="Modo de leitura" className="mb-4 inline-flex rounded-full border border-border p-0.5 text-sm">
          {([
            ["texto", "Texto", FileText],
            ["pagina", "Página original", ImageIcon],
          ] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => chooseMode(m)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors ${
                mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
      {textMode && mode === "texto" && noText && (
        <p className="mb-4 rounded border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          Esta obra é formada por imagens, sem texto para ajustar. Mostrando a página original.
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div role="group" aria-label={showText ? "Tamanho da letra" : "Tamanho da página"} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => changeZoom(-ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          aria-label={showText ? "Diminuir a letra" : "Diminuir"}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center tabular-nums text-muted-foreground" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => changeZoom(ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX}
          aria-label={showText ? "Aumentar a letra" : "Aumentar"}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div role="group" aria-label="Cor do fundo" className="flex items-center gap-1">
        <span className="mr-2 text-muted-foreground">Fundo</span>
        {(Object.keys(THEMES) as PdfTheme[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={theme === k}
            onClick={() => chooseTheme(k)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
              theme === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              aria-hidden
              className="size-3 rounded-full border border-black/20"
              style={{ backgroundColor: k === "original" ? "#fff" : k === "sepia" ? "#e9dcbd" : "#1e1e1e" }}
            />
            {THEMES[k].label}
          </button>
        ))}
      </div>
      </div>
      {showText ? (
        <div
          ref={bodyRef}
          className="select-none rounded-sm px-5 py-8 transition-colors sm:px-10 sm:py-12"
          style={{ backgroundColor: colors.bg, color: colors.fg, fontSize: `${Math.round(18 * zoom)}px`, lineHeight: 1.75 }}
          onContextMenu={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
        >
          {!blocks ? (
            <div className="flex justify-center py-16">
              <span className="size-6 animate-spin rounded-full border-2 border-current/20 border-t-gilt" />
            </div>
          ) : (
            <div className="mx-auto max-w-[38em] font-serif">
              {blocks.map((b, i) =>
                b.kind === "h" ? (
                  <p key={i} className="mb-6 mt-10 text-center text-[1.35em] font-bold leading-snug first:mt-0">
                    {b.text}
                  </p>
                ) : b.kind === "center" ? (
                  <p key={i} className="my-2 text-center">
                    {b.text}
                  </p>
                ) : (
                  <p key={i} className="mb-[0.9em] text-pretty">
                    {b.text}
                  </p>
                ),
              )}
            </div>
          )}
        </div>
      ) : (
      /* Com zoom acima de 100%, a página passa da coluna: rola para o lado */
      <div ref={scrollerRef} className="overflow-x-auto">
        <div
          ref={bodyRef}
          className="mx-auto flex select-none flex-col items-center"
          style={{ width: `${zoom * 100}%`, touchAction: "manipulation" }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          onDoubleClick={(e) => zoomAt(e.clientX, e.clientY)}
          onTouchEnd={(e) => {
            const p = e.changedTouches[0];
            if (!p || e.touches.length) return;
            const now = Date.now();
            const prev = lastTap.current;
            if (prev && now - prev.t < 300 && Math.hypot(p.clientX - prev.x, p.clientY - prev.y) < 30) {
              e.preventDefault();
              lastTap.current = null;
              zoomAt(p.clientX, p.clientY);
            } else {
              lastTap.current = { t: now, x: p.clientX, y: p.clientY };
            }
          }}
        >
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i} doc={doc} pageNumber={i + 1} filter={t.filter} paper={t.paper} />
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

/** Uma página: só desenha quando chega perto da tela, em alta resolução, e redesenha se a largura mudar. */
function PdfPage({
  doc,
  pageNumber,
  filter,
  paper,
}: {
  doc: import("pdfjs-dist").PDFDocumentProxy;
  pageNumber: number;
  filter: string;
  paper: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [ratio, setRatio] = useState(1.414);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  // Largura real na tela (muda com zoom, giro do celular, janela)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const cssWidth = width || wrapRef.current?.clientWidth || 0;
      if (!cssWidth) return;
      const page = await doc.getPage(pageNumber).catch(() => null);
      const canvas = canvasRef.current;
      if (cancelled || !canvas || !page) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      // Desenha com folga de resolução (mín. 2x) para o texto não serrilhar
      const density = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * density });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const render = page.render({ canvas, viewport });
      task = render;
      await render.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, width, doc, pageNumber]);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden transition-colors"
      style={{ aspectRatio: `1 / ${ratio}`, backgroundColor: paper }}
    >
      <canvas
        ref={canvasRef}
        aria-label={`Página ${pageNumber}`}
        className="block h-full w-full transition-[filter]"
        style={{ filter }}
      />
    </div>
  );
}
