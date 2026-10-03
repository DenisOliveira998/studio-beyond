// Conferência no servidor de PDFs enviados direto do navegador para o Blob.
import { MAX_WORK_PDF_BYTES } from "@/lib/security";

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
  return { ok: true, size: meta.size };
}
