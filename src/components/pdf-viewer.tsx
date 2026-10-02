import { useEffect, useRef, useState } from "react";
import { FileWarning } from "lucide-react";

/**
 * Visor de PDF das obras licenciadas: cada página é desenhada como imagem (canvas),
 * sem barra de ferramentas, sem download, sem impressão e sem texto selecionável.
 * O arquivo vem de /api/reader/:slug/arquivo, que só responde a pedidos do próprio site.
 */
export function PdfViewer({
  slug,
  bodyRef,
  enabled,
}: {
  slug: string;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(0);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const res = await fetch(`/api/reader/${encodeURIComponent(slug)}/arquivo`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const data = new Uint8Array(await res.arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return void doc.destroy();
        docRef.current = doc;
        setNumPages(doc.numPages);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      void docRef.current?.destroy();
      docRef.current = null;
    };
  }, [slug, enabled]);

  if (state === "error") {
    return (
      <div ref={bodyRef} className="flex flex-col items-center gap-3 py-24 text-center text-muted-foreground">
        <FileWarning className="size-10 opacity-40" strokeWidth={1.5} />
        <p className="text-sm">Não foi possível abrir a obra agora. Recarregue a página para tentar de novo.</p>
      </div>
    );
  }
  if (state === "loading" || !docRef.current) {
    return (
      <div ref={bodyRef} className="flex justify-center py-24">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }
  const doc = docRef.current;
  return (
    <div
      ref={bodyRef}
      className="flex select-none flex-col items-center gap-3"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {Array.from({ length: numPages }, (_, i) => (
        <PdfPage key={i} doc={doc} pageNumber={i + 1} />
      ))}
    </div>
  );
}

/** Uma página: só desenha quando chega perto da tela. */
function PdfPage({ doc, pageNumber }: { doc: import("pdfjs-dist").PDFDocumentProxy; pageNumber: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [ratio, setRatio] = useState(1.414);

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

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(pageNumber);
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (cancelled || !canvas || !wrap) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (wrap.clientWidth / base.width) * dpr;
      const viewport = page.getViewport({ scale });
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
  }, [visible, doc, pageNumber]);

  return (
    <div ref={wrapRef} className="w-full max-w-[800px] bg-white" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvasRef} aria-label={`Página ${pageNumber}`} className="block h-full w-full" />
    </div>
  );
}
