// Capítulos (cada um é um PDF), revisões pela curadoria e notificações de leitores.
import { prisma } from "@/lib/prisma";

export const EARLY_ACCESS_DAYS = 3;
/** Quantos capítulos (os de menor número) qualquer pessoa lê inteiros, sem login. */
export const FREE_CHAPTERS = 2;

const STAFF = ["gerente", "admin", "owner"];

export type ChapterAccess = "full" | "preview" | "early" | "login";

export type ChapterInfo = {
  id: string;
  number: number;
  title: string | null;
  pdfPages: number | null;
  publishedAt: string;
  earlyUntil: string | null;
  hasPreview: boolean;
  free: boolean;
};

type ChapterRow = Awaited<ReturnType<typeof prisma.chapter.findMany>>[number];

/** "Capítulo 1" ou, com nome, "Capítulo 1 - O começo". */
export function chapterLabel(n: number, title?: string | null): string {
  const base = `Capítulo ${String(n).replace(".", ",")}`;
  return title ? `${base} - ${title}` : base;
}

/** Nome de capítulo limpo: sem HTML, espaços normalizados, até 120 caracteres. */
export function cleanChapterTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
  return t || null;
}

function toInfo(c: ChapterRow, index: number): ChapterInfo {
  return {
    id: c.id,
    number: Number(c.number),
    title: c.title,
    pdfPages: c.pdfPages,
    publishedAt: c.publishedAt.toISOString(),
    earlyUntil: c.earlyUntil && c.earlyUntil > new Date() ? c.earlyUntil.toISOString() : null,
    hasPreview: !!c.previewUrl,
    free: index < FREE_CHAPTERS,
  };
}

/** Capítulos da obra em ordem de número (0, 1, 1.5, 2…). */
export async function listChapters(workId: string): Promise<{ rows: ChapterRow[]; info: ChapterInfo[] }> {
  const rows = await prisma.chapter.findMany({ where: { workId }, orderBy: { number: "asc" } });
  return { rows, info: rows.map(toInfo) };
}

/**
 * Quem pode ler o quê:
 * - capítulo em acesso antecipado (3 dias): só Super Fã, o autor da obra e a equipe;
 * - os 2 capítulos de menor número: inteiros para qualquer pessoa, sem login;
 * - os demais: inteiros com login (vale o limite diário); sem login, só a prévia de 2 páginas.
 */
export function chapterAccess(
  info: ChapterInfo,
  viewer: { loggedIn: boolean; role: string | null; isOwner: boolean },
): ChapterAccess {
  const privileged = viewer.isOwner || (!!viewer.role && (STAFF.includes(viewer.role) || viewer.role === "superfa"));
  if (info.earlyUntil && !privileged) return "early";
  if (info.free) return "full";
  if (viewer.loggedIn) return "full";
  return info.hasPreview ? "preview" : "login";
}

/** O arquivo já é usado por alguma obra, capítulo, candidatura ou foto? (impede apontar para arquivo alheio) */
export async function blobUrlInUse(url: string): Promise<boolean> {
  const [w, c, a, b] = await Promise.all([
    prisma.work.findFirst({ where: { OR: [{ pdfUrl: url }, { previewUrl: url }, { coverUrl: url }] }, select: { id: true } }),
    prisma.chapter.findFirst({ where: { OR: [{ pdfUrl: url }, { previewUrl: url }] }, select: { id: true } }),
    prisma.authorApplication.findFirst({ where: { portfolioFiles: { contains: url } }, select: { id: true } }),
    prisma.authorBio.findFirst({ where: { avatarUrl: url }, select: { userId: true } }).catch(() => null),
  ]);
  return !!(w || c || a || b);
}

/** Avisa quem segue o autor e quem favoritou a obra (sem duplicar e sem avisar o próprio autor). */
async function notifyNewChapter(
  work: { slug: string; title: string; artistSlug: string; artistName: string; authorId: string | null },
  number: number,
  early: boolean,
  chapterTitle: string | null,
) {
  const [followers, favs] = await Promise.all([
    prisma.artistFollow.findMany({ where: { artistSlug: work.artistSlug }, select: { userId: true } }),
    prisma.userFavorite.findMany({ where: { workSlug: work.slug }, select: { userId: true } }),
  ]);
  const ids = [...new Set([...followers, ...favs].map((r) => r.userId))].filter((id) => id !== work.authorId);
  if (ids.length === 0) return;
  const { stripHtml } = await import("@/lib/utils");
  const title = `${chapterLabel(number, chapterTitle)} (${stripHtml(work.title)})`;
  const body = early
    ? `${work.artistName} publicou um capítulo novo. Super Fãs leem agora; para todos, em ${EARLY_ACCESS_DAYS} dias.`
    : `${work.artistName} publicou um capítulo novo.`;
  const link = `/ler/${work.slug}?cap=${number}`;
  for (let i = 0; i < ids.length; i += 500) {
    await prisma.notification.createMany({
      data: ids.slice(i, i + 500).map((userId) => ({ userId, type: "new_chapter", title, body, link })),
    });
  }
}

/** Autor publica um capítulo numa obra já aprovada pela curadoria (o capítulo vai direto ao ar). */
export async function createChapter(input: {
  workId: string;
  authorId: string;
  number: number;
  title?: string | null;
  pdfUrl: string;
  previewUrl: string | null;
  pdfPages: number | null;
}): Promise<{ number: number }> {
  const work = await prisma.work.findFirst({
    where: { id: input.workId, authorId: input.authorId },
    select: { id: true, slug: true, title: true, status: true, artistSlug: true, artistName: true, authorId: true },
  });
  if (!work) throw new Error("Obra não encontrada.");
  if (work.status !== "approved") throw new Error("A obra precisa ser aprovada pela curadoria antes de receber capítulos.");
  const number = Math.round(input.number * 100) / 100;
  if (!Number.isFinite(number) || number < 0 || number > 99999) throw new Error("Número de capítulo inválido.");
  const taken = await prisma.chapter.findFirst({ where: { workId: work.id, number } });
  if (taken) throw new Error(`Já existe o ${chapterLabel(number)} nesta obra.`);
  const count = await prisma.chapter.count({ where: { workId: work.id } });
  const now = new Date();
  // O primeiro capítulo de uma obra não tem acesso antecipado; os seguintes, 3 dias para Super Fã
  const early = count > 0;
  const chapterTitle = cleanChapterTitle(input.title);
  await prisma.chapter.create({
    data: {
      workId: work.id,
      number,
      title: chapterTitle,
      pdfUrl: input.pdfUrl,
      previewUrl: input.previewUrl,
      pdfPages: input.pdfPages,
      publishedAt: now,
      earlyUntil: early ? new Date(now.getTime() + EARLY_ACCESS_DAYS * 86_400_000) : null,
    },
  });
  // Obra sobe em "atualizadas"
  await prisma.work.update({ where: { id: work.id }, data: { updatedAt: now } });
  await notifyNewChapter(work, number, early, chapterTitle).catch((e) => console.error("notificação de capítulo falhou", e));
  return { number };
}

/** Primeiro capítulo, criado junto com a obra (antes da curadoria; sem acesso antecipado). */
export async function createInitialChapter(input: { workId: string; number: number; title?: string | null; pdfUrl: string; previewUrl: string | null; pdfPages: number | null }) {
  const number = Number.isFinite(input.number) && input.number >= 0 && input.number <= 99999 ? Math.round(input.number * 100) / 100 : 1;
  await prisma.chapter.create({
    data: { workId: input.workId, number, title: cleanChapterTitle(input.title), pdfUrl: input.pdfUrl, previewUrl: input.previewUrl, pdfPages: input.pdfPages },
  });
}

/* ---------- revisões (curadoria de alterações) ---------- */

export type WorkRevisionData = { title?: string; excerpt?: string; coverUrl?: string; medium?: string };
export type ChapterRevisionData = { pdfUrl?: string; previewUrl?: string | null; pdfPages?: number | null; title?: string | null };

export async function requestWorkRevision(workId: string, authorId: string, data: WorkRevisionData) {
  const work = await prisma.work.findFirst({ where: { id: workId, authorId }, select: { id: true } });
  if (!work) throw new Error("Obra não encontrada.");
  // Um pedido pendente por obra: o novo substitui o anterior
  await prisma.workRevision.updateMany({ where: { workId, kind: "work", status: "pending" }, data: { status: "rejected", note: "Substituído por um pedido mais novo." } });
  return prisma.workRevision.create({ data: { workId, authorId, kind: "work", data: JSON.stringify(data) } });
}

export async function requestChapterRevision(chapterId: string, authorId: string, data: ChapterRevisionData) {
  const ch = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true, workId: true } });
  if (!ch) throw new Error("Capítulo não encontrado.");
  const work = await prisma.work.findFirst({ where: { id: ch.workId, authorId }, select: { id: true } });
  if (!work) throw new Error("Sem permissão.");
  await prisma.workRevision.updateMany({ where: { chapterId, status: "pending" }, data: { status: "rejected", note: "Substituído por um pedido mais novo." } });
  return prisma.workRevision.create({ data: { workId: ch.workId, authorId, kind: "chapter", chapterId, data: JSON.stringify(data) } });
}

export async function listPendingRevisions() {
  const rows = await prisma.workRevision.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 100 });
  const works = await prisma.work.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.workId))] } },
    select: { id: true, slug: true, title: true, excerpt: true, coverUrl: true, medium: true, artistName: true },
  });
  const chapters = await prisma.chapter.findMany({
    where: { id: { in: rows.map((r) => r.chapterId).filter((x): x is string => !!x) } },
    select: { id: true, number: true, title: true },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.createdAt.toISOString(),
    data: JSON.parse(r.data) as Record<string, unknown>,
    work: works.find((w) => w.id === r.workId) ?? null,
    chapterNumber: r.chapterId ? Number(chapters.find((c) => c.id === r.chapterId)?.number ?? 0) : null,
    chapterTitle: r.chapterId ? (chapters.find((c) => c.id === r.chapterId)?.title ?? null) : null,
  }));
}

/** Equipe aprova ou recusa: aprovado aplica a alteração; o autor é avisado nos dois casos. */
export async function decideRevision(id: string, approve: boolean, reviewerId: string, note: string | null) {
  const rev = await prisma.workRevision.findUnique({ where: { id } });
  if (!rev || rev.status !== "pending") throw new Error("Pedido não encontrado ou já decidido.");
  const work = await prisma.work.findUnique({ where: { id: rev.workId }, select: { slug: true, title: true } });
  if (approve) {
    const data = JSON.parse(rev.data) as Record<string, unknown>;
    if (rev.kind === "work") {
      const patch: Record<string, unknown> = {};
      if (typeof data["title"] === "string" && data["title"].trim()) patch["title"] = data["title"];
      if (typeof data["excerpt"] === "string" && data["excerpt"].trim()) patch["excerpt"] = String(data["excerpt"]).slice(0, 240);
      if (typeof data["coverUrl"] === "string") patch["coverUrl"] = data["coverUrl"];
      if (typeof data["medium"] === "string") patch["medium"] = data["medium"];
      await prisma.work.update({ where: { id: rev.workId }, data: patch });
    } else if (rev.chapterId) {
      const patch: Record<string, unknown> = {};
      if (typeof data["pdfUrl"] === "string") {
        patch["pdfUrl"] = data["pdfUrl"];
        patch["previewUrl"] = typeof data["previewUrl"] === "string" ? data["previewUrl"] : null;
        patch["pdfPages"] = typeof data["pdfPages"] === "number" ? data["pdfPages"] : null;
      }
      if ("title" in data) patch["title"] = cleanChapterTitle(data["title"]);
      if (Object.keys(patch).length) await prisma.chapter.update({ where: { id: rev.chapterId }, data: patch });
    }
  }
  await prisma.workRevision.update({
    where: { id },
    data: { status: approve ? "approved" : "rejected", note, reviewerId, reviewedAt: new Date() },
  });
  if (work) {
    const { stripHtml } = await import("@/lib/utils");
    await prisma.notification.create({
      data: {
        userId: rev.authorId,
        type: approve ? "revision_approved" : "revision_rejected",
        title: approve ? `Alteração aprovada em ${stripHtml(work.title)}` : `Alteração recusada em ${stripHtml(work.title)}`,
        body: note ?? (approve ? "Sua alteração já está no ar." : "A versão anterior continua no ar."),
        link: `/obra/${work.slug}`,
      },
    }).catch(() => {});
  }
}

/* ---------- notificações ---------- */

export async function listNotifications(userId: string) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

/* ---------- favoritos na home ---------- */

/** Obras favoritas, com as que têm capítulo novo (desde a última leitura) primeiro. */
export async function favoritesForHome(userId: string) {
  const favs = await prisma.userFavorite.findMany({ where: { userId }, select: { workSlug: true } });
  if (favs.length === 0) return [];
  const works = await prisma.work.findMany({ where: { slug: { in: favs.map((f) => f.workSlug) }, status: "approved" } });
  const [chapters, progress] = await Promise.all([
    prisma.chapter.groupBy({ by: ["workId"], where: { workId: { in: works.map((w) => w.id) } }, _max: { publishedAt: true, number: true } }),
    prisma.readingProgress.findMany({ where: { userId, workSlug: { in: works.map((w) => w.slug) } }, select: { workSlug: true, updatedAt: true } }),
  ]);
  const { dbWorkToCard, workToDb } = await import("@/lib/beyond-db");
  return works
    .map((w) => {
      const ch = chapters.find((c) => c.workId === w.id);
      const lastChapterAt = ch?._max.publishedAt ?? null;
      const readAt = progress.find((p) => p.workSlug === w.slug)?.updatedAt ?? null;
      const hasNew = !!lastChapterAt && (!readAt || lastChapterAt > readAt);
      return {
        work: dbWorkToCard(workToDb(w)),
        hasNew,
        lastChapter: ch?._max.number != null ? Number(ch._max.number) : null,
        lastChapterAt: lastChapterAt ? lastChapterAt.toISOString() : null,
      };
    })
    .sort((a, b) => Number(b.hasNew) - Number(a.hasNew) || (b.lastChapterAt ?? "").localeCompare(a.lastChapterAt ?? ""));
}
