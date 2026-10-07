import { useEffect, useRef, useState } from "react";
import { FileWarning, Minus, Plus } from "lucide-react";

type PdfTheme = "original" | "sepia" | "escuro";

/** Tema de leitura aplicado como filtro sobre a página desenhada (o arquivo não muda). */
const THEMES: Record<PdfTheme, { label: string; filter: string; paper: string }> = {
  original: { label: "Original", filter: "none", paper: "#ffffff" },
  sepia: { label: "Sépia", filter: "sepia(0.5) saturate(0.85) brightness(0.96)", paper: "#efe4cc" },
  escuro: { label: "Escuro", filter: "invert(0.9) hue-rotate(180deg) contrast(0.92)", paper: "#262626" },
};
const THEME_KEY = "beyond_pdf_theme";
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
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [doc, setDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [theme, setTheme] = useState<PdfTheme>(defaultTheme);
  const [zoom, setZoom] = useState(1);

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
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div role="group" aria-label="Tamanho da página" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => changeZoom(-ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Diminuir"
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
          aria-label="Aumentar"
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
      {/* Com zoom acima de 100%, a página passa da coluna: rola para o lado */}
      <div className="overflow-x-auto">
        <div
          ref={bodyRef}
          className="mx-auto flex select-none flex-col items-center gap-3"
          style={{ width: `${zoom * 100}%` }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i} doc={doc} pageNumber={i + 1} filter={t.filter} paper={t.paper} />
          ))}
        </div>
      </div>
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
      className="w-full overflow-hidden rounded-sm transition-colors"
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
