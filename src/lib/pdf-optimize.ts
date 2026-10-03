// Otimização do PDF no navegador do autor, antes do envio (nada passa pelo servidor).
// - Quadrinhos (mangá, HQ, manhwa, manhua): cada página vira JPEG em boa resolução, o que
//   costuma reduzir muito o tamanho de arquivos exportados com imagens pesadas.
// - Prosa (livro, conto, novel): reorganiza o arquivo (object streams) sem mexer no texto.
// Só usa a versão nova se ela for de fato menor. Também gera a prévia (2 primeiras páginas).

type Progress = (message: string, percent: number) => void;

export type OptimizedPdf = {
  full: Blob;
  preview: Blob;
  pages: number;
  originalBytes: number;
  finalBytes: number;
};

const MAX_WIDTH = 1500; // px por página nos quadrinhos
const JPEG_QUALITY = 0.82;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Falha ao gerar imagem da página"));
        void blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/** Desenha páginas do PDF como JPEG e monta um PDF novo com elas. */
async function rasterize(
  source: Uint8Array,
  pageCount: number,
  onProgress?: Progress,
  progressFrom = 0,
  progressTo = 100,
): Promise<Uint8Array> {
  const pdfjs = await loadPdfJs();
  const { PDFDocument } = await import("pdf-lib");
  const doc = await pdfjs.getDocument({ data: source.slice() }).promise;
  const out = await PDFDocument.create();
  const total = Math.min(pageCount, doc.numPages);
  const canvas = document.createElement("canvas");
  try {
    for (let n = 1; n <= total; n++) {
      onProgress?.(`Otimizando página ${n} de ${total}…`, progressFrom + ((progressTo - progressFrom) * (n - 1)) / total);
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(MAX_WIDTH / base.width, 3);
      const viewport = page.getViewport({ scale: Math.max(scale, 1) });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // intent "print": desenha sem esperar o quadro de animação do navegador
      // (senão a compressão pausa se o autor trocar de aba)
      await page.render({ canvas, viewport, intent: "print" }).promise;
      const jpg = await out.embedJpg(await canvasToJpeg(canvas));
      // Mantém o tamanho físico da página original (em pontos)
      const p = out.addPage([base.width, base.height]);
      p.drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
    canvas.width = canvas.height = 0;
  }
  return out.save({ useObjectStreams: true });
}

export async function optimizePdf(file: File, opts: { comic: boolean; onProgress?: Progress }): Promise<OptimizedPdf> {
  const original = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfJs();
  const probe = await pdfjs.getDocument({ data: original.slice() }).promise;
  const pages = probe.numPages;
  await probe.destroy();

  let best: Uint8Array = original;
  try {
    if (opts.comic) {
      const raster = await rasterize(original, pages, opts.onProgress, 0, 90);
      if (raster.byteLength < original.byteLength * 0.9) best = raster;
    } else {
      opts.onProgress?.("Organizando o arquivo…", 30);
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(original, { ignoreEncryption: false, updateMetadata: false });
      const resaved = await doc.save({ useObjectStreams: true });
      if (resaved.byteLength < original.byteLength * 0.97) best = resaved;
    }
  } catch {
    best = original; // PDF protegido ou incomum: envia como veio
  }

  opts.onProgress?.("Gerando a prévia…", 92);
  // Prévia: copia as 2 primeiras páginas (leve e nítida); só vira imagem se o PDF for protegido
  let preview: Uint8Array;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(best, { updateMetadata: false });
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, [0, 1].filter((i) => i < src.getPageCount()));
    for (const page of copied) out.addPage(page);
    preview = await out.save({ useObjectStreams: true });
  } catch {
    preview = await rasterize(best, 2);
  }
  opts.onProgress?.("Pronto para enviar", 100);

  // Uint8Array.slice() garante um ArrayBuffer comum para o Blob
  return {
    full: new Blob([best.slice()], { type: "application/pdf" }),
    preview: new Blob([preview.slice()], { type: "application/pdf" }),
    pages,
    originalBytes: original.byteLength,
    finalBytes: best.byteLength,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
