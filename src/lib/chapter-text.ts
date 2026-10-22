// Texto dos capítulos para o modo Texto do leitor: extraído do PDF uma vez, no servidor,
// e guardado no banco. Assim o celular não precisa abrir o PDF para mostrar o texto.
import { prisma } from "./prisma";
import { mergePages, pageBlocks, type TextBlock } from "./pdf-text";

/** Quanto da obra a prévia (visitante sem login) mostra no modo Texto. */
const PREVIEW_CHARS = 1600;

async function extractBlocks(bytes: Uint8Array): Promise<TextBlock[]> {
  // unpdf: pdf.js preparado para rodar no servidor (sem navegador)
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  try {
    const pages: TextBlock[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(pageBlocks(tc.items as Parameters<typeof pageBlocks>[0], page.getViewport({ scale: 1 }).width));
      page.cleanup();
    }
    return mergePages(pages);
  } finally {
    await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.();
  }
}

/** Blocos de texto do capítulo; na primeira vez, extrai do PDF e guarda. */
export async function getChapterBlocks(chapterId: string): Promise<TextBlock[]> {
  const ch = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { text: true, pdfUrl: true } });
  if (!ch) return [];
  if (ch.text != null) {
    try {
      return JSON.parse(ch.text) as TextBlock[];
    } catch {
      return [];
    }
  }
  const { get } = await import("@vercel/blob");
  const file = await get(ch.pdfUrl, { access: "private" }).catch(() => null);
  if (!file?.stream) return [];
  const bytes = new Uint8Array(await new Response(file.stream).arrayBuffer());
  const blocks = await extractBlocks(bytes).catch((e) => {
    console.error("texto do capítulo: falha ao extrair", e);
    return null;
  });
  if (!blocks) return [];
  await prisma.chapter.update({ where: { id: chapterId }, data: { text: JSON.stringify(blocks) } }).catch(() => {});
  return blocks;
}

/** Começo do capítulo para a prévia: blocos até ~1600 letras. */
export function previewBlocks(blocks: TextBlock[]): TextBlock[] {
  const out: TextBlock[] = [];
  let n = 0;
  for (const b of blocks) {
    out.push(b);
    n += b.text.length;
    if (n >= PREVIEW_CHARS) break;
  }
  return out;
}
