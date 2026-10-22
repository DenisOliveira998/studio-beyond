// Importação de obras em domínio público do Wikisource (só admin).
// A obra fica em rascunho enquanto os capítulos entram (um por pedido, para caber no tempo
// de cada chamada do servidor) e vai ao ar quando o admin publica.
import { prisma } from "./prisma";
import { blocksToPdf, fetchWikiChapter, fetchWikiIndex, parseWikiRef, wikiPageUrl, type WikiIndex, type WikiRef } from "./wikisource";
import { cleanTags, slugify, uniqueWorkSlug } from "./beyond-db";
import { cleanChapterTitle } from "./chapters";
import { stripHtml } from "./utils";

const MEDIUMS = ["livro", "conto"] as const;
const RATINGS = ["L", "10", "12", "14", "16"];

export type WikiPreview = WikiIndex & {
  /** Já existe obra importada desta página: retomar em vez de criar outra */
  existing: { id: string; slug: string; status: string; chapters: number[] } | null;
};

export async function previewWikiWork(input: string): Promise<WikiPreview> {
  const ref = parseWikiRef(input);
  if (!ref) throw new Error("Cole o endereço de uma página do Wikisource (ex.: https://pt.wikisource.org/wiki/Dom_Casmurro).");
  const index = await fetchWikiIndex(ref);
  const work = await prisma.work.findFirst({ where: { source: index.url }, select: { id: true, slug: true, status: true } });
  const chapters = work ? (await prisma.chapter.findMany({ where: { workId: work.id }, select: { number: true } })).map((c) => Number(c.number)) : [];
  return { ...index, existing: work ? { ...work, chapters } : null };
}

export async function createWikiWork(input: {
  source: string;
  title: string;
  artistName: string;
  medium: string;
  excerpt: string;
  tags: string;
  ageRating: string;
  coverUrl: string | null;
}): Promise<{ id: string; slug: string }> {
  const ref = parseWikiRef(input.source);
  if (!ref) throw new Error("Endereço do Wikisource inválido.");
  const source = wikiPageUrl(ref);
  const existing = await prisma.work.findFirst({ where: { source }, select: { id: true, slug: true } });
  if (existing) return existing;
  const title = stripHtml(input.title).trim().slice(0, 200);
  const artistName = stripHtml(input.artistName).trim().slice(0, 120);
  if (!title) throw new Error("Informe o título.");
  if (!artistName) throw new Error("Informe o autor.");
  if (!MEDIUMS.includes(input.medium as (typeof MEDIUMS)[number])) throw new Error("Categoria inválida: use Livro ou Conto.");
  const excerpt = stripHtml(input.excerpt).trim();
  if (excerpt.length < 20) throw new Error("Escreva uma sinopse (pelo menos 20 letras).");
  const tags = cleanTags(input.tags);
  if (!tags.length) throw new Error("Informe pelo menos 1 gênero.");
  if (!RATINGS.includes(input.ageRating)) throw new Error("Escolha a classificação indicativa.");
  const slug = await uniqueWorkSlug(title);
  const created = await prisma.work.create({
    data: {
      slug,
      title,
      medium: input.medium as (typeof MEDIUMS)[number],
      artistName,
      artistSlug: slugify(artistName),
      authorId: null,
      excerpt: excerpt.slice(0, 280),
      body: "",
      tags: tags.join(", "),
      ageRating: input.ageRating,
      coverUrl: input.coverUrl,
      status: "draft",
      workStatus: "finalizado",
      publicDomain: true,
      source,
    },
    select: { id: true, slug: true },
  });
  return created;
}

/** Importa um capítulo: busca o texto, gera o PDF, guarda os dois. Capítulo que já existe é pulado. */
export async function importWikiChapter(input: { workId: string; page: string; number: number; title: string }): Promise<{ number: number; skipped: boolean; pages: number }> {
  const work = await prisma.work.findUnique({ where: { id: input.workId }, select: { id: true, slug: true, title: true, artistName: true, source: true, publicDomain: true } });
  if (!work?.publicDomain || !work.source) throw new Error("Obra não encontrada.");
  const ref = parseWikiRef(work.source);
  if (!ref) throw new Error("Fonte da obra inválida.");
  // Só subpáginas da própria obra (ou a página dela, quando é uma página só)
  const page = input.page.replace(/ /g, "_");
  if (page !== ref.page && !page.startsWith(`${ref.page}/`)) throw new Error("Capítulo de outra obra.");
  const number = Math.round(input.number);
  if (!Number.isFinite(number) || number < 1 || number > 5000) throw new Error("Número de capítulo inválido.");
  if (await prisma.chapter.findFirst({ where: { workId: work.id, number }, select: { id: true } })) return { number, skipped: true, pages: 0 };

  const blocks = await fetchWikiChapter({ host: ref.host, page } satisfies WikiRef);
  if (!blocks.length) throw new Error(`O capítulo ${number} veio sem texto. Confira a página no Wikisource.`);
  const chapterTitle = cleanChapterTitle(input.title);
  // Página sem título no começo (conto numa página só, capítulo sem cabeçalho): põe o nome
  if (blocks[0]!.kind !== "h") blocks.unshift({ kind: "h", text: chapterTitle || stripHtml(work.title) });
  const pdf = await blocksToPdf(blocks, { title: stripHtml(work.title), author: work.artistName });

  const { put } = await import("@vercel/blob");
  const blob = await put(`dominio-publico/${work.slug}/cap-${number}.pdf`, new Blob([pdf.bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/pdf",
  });
  await prisma.chapter.create({
    data: { workId: work.id, number, title: chapterTitle, pdfUrl: blob.url, previewUrl: null, pdfPages: pdf.pages, text: JSON.stringify(blocks) },
  });
  return { number, skipped: false, pages: pdf.pages };
}

/** Coloca a obra importada no ar (ou tira de novo, voltando a rascunho). */
export async function publishWikiWork(workId: string, publish: boolean): Promise<{ slug: string }> {
  const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true, slug: true, publicDomain: true, publishedAt: true } });
  if (!work?.publicDomain) throw new Error("Obra não encontrada.");
  if (publish && !(await prisma.chapter.count({ where: { workId } }))) throw new Error("Importe os capítulos antes de publicar.");
  await prisma.work.update({
    where: { id: workId },
    data: publish ? { status: "approved", publishedAt: work.publishedAt ?? new Date() } : { status: "draft" },
  });
  return { slug: work.slug };
}

/** Obras já importadas (para retomar ou publicar). */
export async function listWikiWorks() {
  const rows = await prisma.work.findMany({
    where: { publicDomain: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, artistName: true, medium: true, status: true, source: true },
  });
  const counts = await prisma.chapter.groupBy({ by: ["workId"], where: { workId: { in: rows.map((r) => r.id) } }, _count: { _all: true } });
  const byId = new Map(counts.map((c) => [c.workId, c._count._all]));
  return rows.map((r) => ({ ...r, chapters: byId.get(r.id) ?? 0 }));
}
