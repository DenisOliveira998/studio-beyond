// Comprime o PDF no navegador e envia direto para o armazenamento (obra completa + prévia).
import { optimizePdf, formatBytes } from "@/lib/pdf-optimize";

export type UploadedPdf = { pdfUrl: string; previewUrl: string; pages: number; originalBytes: number; finalBytes: number };

const COMIC_MEDIA = ["manga", "hq", "manhwa", "manhua"];

export async function uploadWorkPdf(
  file: File,
  opts: { medium: string; onProgress?: (message: string, percent: number) => void },
): Promise<UploadedPdf> {
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Envie um arquivo PDF.");
  }
  const opt = await optimizePdf(file, {
    comic: COMIC_MEDIA.includes(opts.medium),
    onProgress: (m, p) => opts.onProgress?.(m, Math.round(p * 0.5)),
  });
  if (opt.full.size > 100 * 1024 * 1024) throw new Error("O PDF passa de 100 MB mesmo depois de comprimido.");
  const { uploadPresigned } = await import("@vercel/blob/client");
  const base = file.name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "obra";
  const sent = await uploadPresigned(`obras/${base}.pdf`, opt.full, {
    access: "private",
    handleUploadUrl: "/api/upload/presign",
    contentType: "application/pdf",
    multipart: opt.full.size > 8 * 1024 * 1024,
    onUploadProgress: (e) => opts.onProgress?.(`Enviando ${formatBytes(opt.full.size)}…`, 50 + Math.round(e.percentage * 0.45)),
  });
  const sentPreview = await uploadPresigned(`obras/${base}-previa.pdf`, opt.preview, {
    access: "private",
    handleUploadUrl: "/api/upload/presign",
    contentType: "application/pdf",
  });
  opts.onProgress?.("PDF enviado", 100);
  return { pdfUrl: sent.url, previewUrl: sentPreview.url, pages: opt.pages, originalBytes: opt.originalBytes, finalBytes: opt.finalBytes };
}
