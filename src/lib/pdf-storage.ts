// Conferência no servidor de PDFs enviados direto do navegador para o Blob.
import { MAX_WORK_PDF_BYTES } from "@/lib/security";

/**
 * PDF com conteúdo ativo (scripts, ações que abrem programas, arquivos anexados,
 * formulários que enviam dados) é recusado. O leitor do site já não executa scripts,
 * mas o arquivo não deve nem ficar guardado.
 */
export async function scanPdfActiveContent(bytes: Uint8Array): Promise<string | null> {
  const { PDFDocument, PDFDict, PDFName, PDFRawStream } = await import("pdf-lib");
  let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  } catch {
    return "Não conseguimos ler esse PDF. Exporte o arquivo de novo e envie.";
  }
  const BAD_KEYS = ["JS", "JavaScript", "EmbeddedFiles", "EmbeddedFile", "RichMedia", "XFA"];
  const BAD_ACTIONS = ["JavaScript", "Launch", "ImportData", "SubmitForm", "RichMediaExecute", "GoToE"];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null;
    if (!dict) continue;
    for (const k of BAD_KEYS) if (dict.has(PDFName.of(k))) return "O PDF tem scripts, anexos ou formulários ativos. Exporte de novo como PDF simples e envie.";
    const s = dict.get(PDFName.of("S"));
    if (s instanceof PDFName && BAD_ACTIONS.includes(s.decodeText())) {
      return "O PDF tem ações automáticas (scripts ou links para programas). Exporte de novo como PDF simples e envie.";
    }
  }
  return null;
}

/** O arquivo existe na nossa loja, começa com "%PDF" e cabe no limite? */
export async function verifyStoredPdf(url: string): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  try {
    const { hostname } = new URL(url);
    if (!hostname.endsWith(".blob.vercel-storage.com")) return { ok: false, error: "Arquivo inválido." };
  } catch {
    return { ok: false, error: "Arquivo inválido." };
  }
  const { head, get } = await import("@vercel/blob");
  const meta = await head(url).catch(() => null);
  if (!meta) return { ok: false, error: "O PDF não foi encontrado. Envie de novo." };
  if (meta.size > MAX_WORK_PDF_BYTES) return { ok: false, error: "O PDF passa de 100 MB." };
  // Assinatura real do arquivo (não confia no tipo informado pelo navegador)
  const first = await get(url, { access: "private", headers: { range: "bytes=0-7" } }).catch(() => null);
  if (!first?.stream) return { ok: false, error: "Não foi possível conferir o PDF. Envie de novo." };
  const reader = first.stream.getReader();
  const { value } = await reader.read();
  void reader.cancel().catch(() => {});
  const sig = value ? new TextDecoder().decode(value.slice(0, 5)) : "";
  if (sig !== "%PDF-") return { ok: false, error: "O arquivo enviado não é um PDF." };
  // Conteúdo ativo: confere o arquivo inteiro
  const full = await get(url, { access: "private" }).catch(() => null);
  if (!full?.stream) return { ok: false, error: "Não foi possível conferir o PDF. Envie de novo." };
  const all = new Uint8Array(await new Response(full.stream).arrayBuffer());
  const problem = await scanPdfActiveContent(all);
  if (problem) return { ok: false, error: problem };
  return { ok: true, size: meta.size };
}
