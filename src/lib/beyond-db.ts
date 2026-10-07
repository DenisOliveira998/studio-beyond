// ---------------------------------------------------------------------------
// beyond-db.ts — camada de acesso ao banco (Prisma + TiDB Cloud)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/auth";
import type { AuthorBioData, Medium, Work } from "@/lib/beyond-data";
import { stripHtml } from "@/lib/utils";
import { sanitizeWorkHtml } from "@/lib/sanitize";

/** Status que o próprio autor pode definir — aprovar é só da curadoria. */
export const AUTHOR_SETTABLE_STATUS = ["pending", "draft"] as const;
export type AuthorSettableStatus = (typeof AUTHOR_SETTABLE_STATUS)[number];

export function toAuthorStatus(value: unknown): AuthorSettableStatus {
  return value === "draft" ? "draft" : "pending";
}

export type ReviewStatusDb = "pending" | "approved" | "rejected" | "changes" | "draft";

export type DbWork = {
  id: string;
  slug: string;
  title: string;
  medium: Medium;
  artistName: string;
  artistSlug: string;
  authorId: string | null;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  pdfUrl: string | null;
  genre: string | null;
  tags: string | null;
  status: ReviewStatusDb;
  workStatus: "andamento" | "finalizado" | "paralisado";
  curatorNote: string | null;
  createdAt: string;
  updatedAt: Date;
  publishedAt: string | null;
};

export type DbApplication = {
  id: string;
  userId: string | null;
  artistName: string;
  email: string;
  phone: string;
  field: string;
  bio: string;
  portfolio: string;
  portfolioFiles: string;
  portfolioCitations: string;
  samples: number;
  message: string | null;
  status: ReviewStatusDb;
  curatorNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type WorkStats = {
  views: Record<string, number>;
  donations: Record<string, number>;
  supporters: Record<string, number>;
};

/* ---------- obras ---------- */

export async function fetchApprovedWorks(): Promise<DbWork[]> {
  const rows = await prisma.work.findMany({
    where: { status: "approved" },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map(workToDb);
}

export async function fetchWorkBySlug(slug: string): Promise<DbWork | null> {
  const row = await prisma.work.findUnique({ where: { slug } });
  return row ? workToDb(row) : null;
}

export async function fetchAllWorks(): Promise<DbWork[]> {
  const rows = await prisma.work.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(workToDb);
}

export async function fetchMyWorks(authorId: string): Promise<DbWork[]> {
  const rows = await prisma.work.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(workToDb);
}

export async function submitWork(input: {
  authorId: string;
  title: string;
  medium: Medium;
  artistName: string;
  excerpt: string;
  body: string;
  tags: string;
  pdfUrl?: string | null;
  previewUrl?: string | null;
  pdfPages?: number | null;
  coverUrl?: string | null;
  status: "pending" | "draft";
}) {
  // Lição Galinha GSB: sempre stripHtml no título antes de gerar slug
  const base = slugify(stripHtml(input.title)) || `obra-${Date.now()}`;
  // Endereço limpo, só o título; se já existir (obra ou endereço antigo), vira -2, -3…
  let slug = base;
  for (let n = 2; ; n++) {
    const [taken, alias] = await Promise.all([
      prisma.work.findUnique({ where: { slug }, select: { id: true } }),
      prisma.workSlugAlias.findUnique({ where: { oldSlug: slug }, select: { oldSlug: true } }),
    ]);
    if (!taken && !alias) break;
    slug = `${base}-${n}`;
  }
  const created = await prisma.work.create({
    data: {
      slug,
      title: input.title,
      medium: input.medium,
      artistName: input.artistName,
      artistSlug: slugify(input.artistName),
      authorId: input.authorId,
      excerpt: input.excerpt.slice(0, 240),
      // obras de texto: HTML limpo; webtoon (manhwa/manhua): JSON com URLs de imagem
      body: ["manhwa", "manhua"].includes(input.medium) ? input.body : sanitizeWorkHtml(input.body),
      tags: input.tags,
      pdfUrl: input.pdfUrl ?? null,
      previewUrl: input.previewUrl ?? null,
      pdfPages: input.pdfPages ?? null,
      coverUrl: input.coverUrl ?? null,
      status: toAuthorStatus(input.status),
    },
  });
  return { slug, id: created.id };
}

/** Gêneros da obra: "a, b, c" vira lista limpa, sem repetição, até 8 de até 30 letras. */
export function cleanTags(raw: string | undefined | null): string[] {
  const out = (raw ?? "").split(",").map((t) => t.replace(/<[^>]*>/g, "").trim().slice(0, 30)).filter(Boolean);
  return [...new Set(out)].slice(0, 8);
}

export async function updateAuthorWork(
  id: string,
  authorId: string,
  data: { title?: string; medium?: string; tags?: string; status?: "pending" | "draft" },
) {
  const work = await prisma.work.findFirst({ where: { id, authorId } });
  if (!work) throw new Error("Obra não encontrada ou sem permissão");
  const patch: Parameters<typeof prisma.work.update>[0]["data"] = {};
  if (data.title !== undefined) patch["title"] = data.title;
  if (data.medium !== undefined) patch["medium"] = data.medium as import("@prisma/client").WorkMedium;
  if (data.status !== undefined) patch["status"] = toAuthorStatus(data.status);
  if (data.tags !== undefined) patch["tags"] = data.tags;
  const updated = await prisma.work.update({ where: { id }, data: patch, select: { slug: true, title: true } });
  return updated;
}

export async function decideWork(
  id: string,
  status: "approved" | "rejected" | "changes",
  note?: string,
): Promise<{ authorEmail: string; authorName: string; title: string; slug: string }> {
  const work = await prisma.work.findUnique({
    where: { id },
    select: { title: true, slug: true, authorId: true },
  });
  if (!work) throw new Error("Work not found");
  const author = work.authorId
    ? await prisma.profile.findUnique({ where: { id: work.authorId }, select: { email: true, name: true } })
    : null;
  await prisma.work.update({
    where: { id },
    data: {
      status,
      curatorNote: note ?? null,
      ...(status === "approved" ? { publishedAt: new Date() } : {}),
    },
  });
  return { authorEmail: author?.email ?? "", authorName: author?.name ?? "Autor", title: work.title, slug: work.slug };
}

export async function updateWorkPdf(id: string, pdfUrl: string | null) {
  await prisma.work.update({ where: { id }, data: { pdfUrl } });
}

export async function deleteWork(id: string) {
  const work = await prisma.work.findUnique({ where: { id }, select: { slug: true } });
  if (!work) return;
  // Com relationMode="prisma", apagar filhos antes da obra
  await prisma.donation.deleteMany({ where: { workSlug: work.slug } });
  await prisma.workView.deleteMany({ where: { workSlug: work.slug } });
  await prisma.work.delete({ where: { id } });
}

/* ---------- candidaturas ---------- */

export async function fetchApplications(): Promise<DbApplication[]> {
  const rows = await prisma.authorApplication.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map(appToDb);
}

export async function createApplication(input: {
  userId: string | null;
  artistName: string;
  email: string;
  phone: string;
  field: string;
  bio: string;
  portfolio: string;
  portfolioFiles: string;
  portfolioCitations: string;
  samples: number;
  message: string;
}) {
  await prisma.authorApplication.create({
    data: {
      userId: input.userId,
      artistName: input.artistName,
      email: input.email,
      phone: input.phone,
      field: input.field,
      bio: input.bio,
      portfolio: input.portfolio,
      portfolioFiles: input.portfolioFiles,
      portfolioCitations: input.portfolioCitations,
      samples: input.samples,
      message: input.message || null,
    },
  });
}

export async function decideApplication(
  id: string,
  status: "approved" | "rejected" | "changes",
  note?: string,
): Promise<{ email: string; artistName: string }> {
  const app = await prisma.authorApplication.update({
    where: { id },
    data: {
      status,
      curatorNote: note ?? null,
      decidedAt: new Date(),
    },
  });

  // Se aprovado e tem userId, promove para author — exceto roles superiores
  if (status === "approved" && app.userId) {
    const current = await prisma.profile.findUnique({ where: { id: app.userId }, select: { role: true } });
    const PROTECTED: string[] = ["owner", "admin", "gerente"];
    if (current && !PROTECTED.includes(current.role)) {
      await prisma.profile.update({
        where: { id: app.userId },
        data: { role: "author" },
      });
    }
  }

  return { email: app.email, artistName: app.artistName };
}

export async function deleteApplication(id: string) {
  await prisma.authorApplication.delete({ where: { id } });
}

/* ---------- contadores reais ---------- */

export async function fetchWorkStats(): Promise<WorkStats> {
  const [viewRows, donationRows] = await Promise.all([
    prisma.workView.findMany(),
    prisma.donation.groupBy({
      by: ["workSlug"],
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const views: Record<string, number> = {};
  for (const row of viewRows) {
    views[row.workSlug] = Number(row.views);
  }

  const donations: Record<string, number> = {};
  const supporters: Record<string, number> = {};
  for (const row of donationRows) {
    donations[row.workSlug] = Number(row._sum.amount ?? 0);
    supporters[row.workSlug] = row._count.id;
  }

  return { views, donations, supporters };
}

export async function registerWorkView(slug: string): Promise<number | null> {
  try {
    // Só conta se a obra existir e estiver aprovada
    const work = await prisma.work.findFirst({
      where: { slug, status: "approved" },
      select: { slug: true },
    });
    if (!work) return null;

    const row = await prisma.workView.upsert({
      where: { workSlug: slug },
      update: { views: { increment: 1 } },
      create: { workSlug: slug, views: 1 },
    });
    // Contagem do dia (ranking semanal); falha aqui não impede a contagem total
    const date = new Date().toISOString().slice(0, 10);
    await prisma.workViewDaily
      .upsert({
        where: { workSlug_date: { workSlug: slug, date } },
        update: { views: { increment: 1 } },
        create: { workSlug: slug, date, views: 1 },
      })
      .catch(() => {});
    return Number(row.views);
  } catch {
    return null;
  }
}

export type DonationRow = {
  id: string;
  workSlug: string;
  artistSlug: string;
  artistName: string;
  donorName: string;
  amount: number;
  createdAt: string;
};

export async function fetchDonations(): Promise<DonationRow[]> {
  const rows = await prisma.donation.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((d) => ({
    id: d.id,
    workSlug: d.workSlug,
    artistSlug: d.artistSlug,
    artistName: d.artistName,
    donorName: d.donorName,
    amount: Number(d.amount),
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function createDonation(input: {
  workSlug: string;
  artistSlug: string;
  artistName: string;
  donorId: string | null;
  donorName: string;
  amount: number;
}) {
  await prisma.donation.create({
    data: {
      workSlug: input.workSlug,
      artistSlug: input.artistSlug,
      artistName: input.artistName,
      donorId: input.donorId,
      donorName: input.donorName || "Anônimo",
      amount: input.amount,
    },
  });
}

/* ---------- contas ---------- */

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  suspended: boolean;
  createdAt: string;
};

export async function fetchAccounts(): Promise<AccountRow[]> {
  const rows = await prisma.profile.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role as AppRole,
    suspended: p.suspended,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function setUserRole(userId: string, role: AppRole) {
  await prisma.profile.update({
    where: { id: userId },
    data: { role },
  });
}

export async function setSuspended(userId: string, suspended: boolean) {
  await prisma.profile.update({
    where: { id: userId },
    data: { suspended },
  });
}

/* ---------- configurações do site ---------- */

export type SiteConfigData = {
  instagram: string;
  youtube: string;
  email: string;
  phone: string;
  address: string;
  cnpj: string;
};

export async function getSiteConfig(): Promise<SiteConfigData> {
  const row = await prisma.siteConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return {
    instagram: row.instagram,
    youtube: row.youtube,
    email: row.email,
    phone: row.phone,
    address: row.address,
    cnpj: row.cnpj,
  };
}

export async function saveSiteConfig(data: Partial<SiteConfigData>): Promise<void> {
  await prisma.siteConfig.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
}

/* ---------- carrossel ---------- */

export type CarouselItemData = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  order: number;
  active: boolean;
};

export async function getCarouselItems(): Promise<CarouselItemData[]> {
  const rows = await prisma.carouselItem.findMany({ orderBy: { order: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    imageUrl: r.imageUrl,
    linkUrl: r.linkUrl,
    order: r.order,
    active: r.active,
  }));
}

export async function createCarouselItem(
  data: Omit<CarouselItemData, "id">,
): Promise<CarouselItemData> {
  const row = await prisma.carouselItem.create({ data });
  return { ...data, id: row.id };
}

export async function updateCarouselItem(
  id: string,
  data: Partial<Omit<CarouselItemData, "id">>,
): Promise<void> {
  await prisma.carouselItem.update({ where: { id }, data });
}

export async function deleteCarouselItem(id: string): Promise<void> {
  await prisma.carouselItem.delete({ where: { id } });
}

export async function reorderCarouselItems(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, index) =>
      prisma.carouselItem.update({ where: { id }, data: { order: index } }),
    ),
  );
}

/* ---------- destaque ---------- */

export async function getDestaqueWorks(): Promise<string[]> {
  const rows = await prisma.destaqueWork.findMany({ orderBy: { order: "asc" } });
  return rows.map((r) => r.workSlug);
}

export async function setDestaqueWorks(slugs: string[]): Promise<void> {
  const safe = slugs.slice(0, 10);
  await prisma.$transaction([
    prisma.destaqueWork.deleteMany(),
    ...safe.map((workSlug, i) => prisma.destaqueWork.create({ data: { workSlug, order: i } })),
  ]);
}

/* ---------- favoritos ---------- */

export type FavoriteData = {
  id: string;
  workSlug: string;
  workTitle: string;
  artistSlug: string;
  artistName: string;
  createdAt: string;
};

export async function getUserFavorites(userId: string): Promise<FavoriteData[]> {
  const rows = await prisma.userFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!rows.length) return [];
  const slugs = rows.map((r) => r.workSlug);
  const works = await prisma.work.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, title: true, artistName: true },
  });
  const titleMap = new Map(works.map((w) => [w.slug, { title: w.title, artistName: w.artistName }]));
  return rows.map((r) => ({
    id: r.id,
    workSlug: r.workSlug,
    workTitle: titleMap.get(r.workSlug)?.title ?? r.workSlug,
    artistSlug: r.artistSlug,
    artistName: titleMap.get(r.workSlug)?.artistName ?? r.artistSlug,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function toggleFavorite(
  userId: string,
  workSlug: string,
  artistSlug: string,
): Promise<{ favorited: boolean }> {
  const existing = await prisma.userFavorite.findUnique({
    where: { userId_workSlug: { userId, workSlug } },
  });
  if (existing) {
    await prisma.userFavorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }
  await prisma.userFavorite.create({ data: { userId, workSlug, artistSlug } });
  return { favorited: true };
}

export async function isFavorited(userId: string, workSlug: string): Promise<boolean> {
  const row = await prisma.userFavorite.findUnique({
    where: { userId_workSlug: { userId, workSlug } },
  });
  return !!row;
}

/* ---------- progresso de leitura ---------- */

export type ReadingProgressData = {
  workSlug: string;
  pagesRead: number;
  finished: boolean;
  updatedAt: string;
};

export async function getUserReadingStats(userId: string): Promise<{
  totalPagesRead: number;
  finishedCount: number;
  progress: ReadingProgressData[];
}> {
  const rows = await prisma.readingProgress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  const totalPagesRead = rows.reduce((s, r) => s + r.pagesRead, 0);
  const finishedCount = rows.filter((r) => r.finished).length;
  return {
    totalPagesRead,
    finishedCount,
    progress: rows.map((r) => ({
      workSlug: r.workSlug,
      pagesRead: r.pagesRead,
      finished: r.finished,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function upsertReadingProgress(
  userId: string,
  workSlug: string,
  pagesRead: number,
  finished: boolean,
): Promise<void> {
  await prisma.readingProgress.upsert({
    where: { userId_workSlug: { userId, workSlug } },
    update: { pagesRead, finished },
    create: { userId, workSlug, pagesRead, finished },
  });
}

/* ---------- perfil do leitor (stats consolidadas) ---------- */

export type ReaderProfileStats = {
  favoritedCount: number;
  totalPagesRead: number;
  finishedCount: number;
  favoriteAuthorsCount: number;
  favorites: FavoriteData[];
  progress: ReadingProgressData[];
};

export async function getReaderProfileStats(userId: string): Promise<ReaderProfileStats> {
  const [favorites, { totalPagesRead, finishedCount, progress }] = await Promise.all([
    getUserFavorites(userId),
    getUserReadingStats(userId),
  ]);
  const uniqueAuthors = new Set(favorites.map((f) => f.artistSlug).filter(Boolean));
  return {
    favoritedCount: favorites.length,
    totalPagesRead,
    finishedCount,
    favoriteAuthorsCount: uniqueAuthors.size,
    favorites,
    progress,
  };
}

/* ---------- likes de obras ---------- */

export async function toggleWorkLike(
  userId: string,
  workSlug: string,
): Promise<{ liked: boolean; count: number }> {
  const existing = await prisma.workLike.findUnique({
    where: { userId_workSlug: { userId, workSlug } },
  });
  if (existing) {
    await prisma.workLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.workLike.create({ data: { userId, workSlug } });
  }
  const count = await prisma.workLike.count({ where: { workSlug } });
  return { liked: !existing, count };
}

export async function getWorkLikeStatus(
  userId: string,
  workSlug: string,
): Promise<{ liked: boolean; count: number }> {
  const [row, count] = await Promise.all([
    prisma.workLike.findUnique({ where: { userId_workSlug: { userId, workSlug } } }),
    prisma.workLike.count({ where: { workSlug } }),
  ]);
  return { liked: !!row, count };
}

export async function getWorkLikeCount(workSlug: string): Promise<number> {
  return prisma.workLike.count({ where: { workSlug } });
}

/* ---------- seguir artistas ---------- */

export async function toggleArtistFollow(
  userId: string,
  artistSlug: string,
): Promise<{ followed: boolean }> {
  const existing = await prisma.artistFollow.findUnique({
    where: { userId_artistSlug: { userId, artistSlug } },
  });
  if (existing) {
    await prisma.artistFollow.delete({ where: { id: existing.id } });
    return { followed: false };
  }
  await prisma.artistFollow.create({ data: { userId, artistSlug } });
  return { followed: true };
}

export async function isArtistFollowed(userId: string, artistSlug: string): Promise<boolean> {
  const row = await prisma.artistFollow.findUnique({
    where: { userId_artistSlug: { userId, artistSlug } },
  });
  return !!row;
}

/* ---------- comentários de obras ---------- */

export type CommentData = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  /** Selo pelo cargo de quem comentou: Fã, Super Fã, Autor ou Equipe */
  badge?: string;
};

const COMMENT_BADGE: Record<string, string> = {
  vip: "Fã",
  superfa: "Super Fã",
  author: "Autor",
  gerente: "Equipe",
  admin: "Equipe",
  owner: "Equipe",
};

export async function getWorkComments(workSlug: string): Promise<CommentData[]> {
  const rows = await prisma.workComment.findMany({
    where: { workSlug, hidden: false },
    orderBy: { createdAt: "desc" },
  });
  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const profiles = userIds.length
    ? await prisma.profile.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } })
    : [];
  const roleById = new Map(profiles.map((p) => [p.id, p.role as string]));
  return rows.map((r) => {
    const badge = r.userId ? COMMENT_BADGE[roleById.get(r.userId) ?? ""] : undefined;
    return {
      id: r.id,
      author: r.author,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      ...(badge ? { badge } : {}),
    };
  });
}

export async function addWorkComment(input: {
  workSlug: string;
  userId?: string | null;
  author: string;
  text: string;
}): Promise<CommentData> {
  const row = await prisma.workComment.create({
    data: {
      workSlug: input.workSlug,
      userId: input.userId ?? null,
      author: input.author || "Anônimo",
      text: input.text,
    },
  });
  return { id: row.id, author: row.author, text: row.text, createdAt: row.createdAt.toISOString() };
}

/* ---------- quota de leitura diária ---------- */

const FREE_DAILY_QUOTA = 10;

export async function getReadingQuota(userId: string): Promise<{ consumed: number; limit: number; remaining: number }> {
  const date = new Date().toISOString().slice(0, 10);
  const row = await prisma.dailyReadingQuota.findUnique({
    where: { userId_date: { userId, date } },
  });
  const consumed = row?.pagesConsumed ?? 0;
  return { consumed, limit: FREE_DAILY_QUOTA, remaining: Math.max(0, FREE_DAILY_QUOTA - consumed) };
}

export async function consumeReadingQuota(userId: string, pages: number): Promise<{ allowed: boolean; remaining: number }> {
  const date = new Date().toISOString().slice(0, 10);
  const existing = await prisma.dailyReadingQuota.findUnique({
    where: { userId_date: { userId, date } },
  });
  const consumed = existing?.pagesConsumed ?? 0;
  if (consumed >= FREE_DAILY_QUOTA) return { allowed: false, remaining: 0 };

  await prisma.dailyReadingQuota.upsert({
    where: { userId_date: { userId, date } },
    update: { pagesConsumed: { increment: pages } },
    create: { userId, date, pagesConsumed: pages },
  });
  const newConsumed = consumed + pages;
  return { allowed: true, remaining: Math.max(0, FREE_DAILY_QUOTA - newConsumed) };
}

/* ---------- eventos de email (Resend webhooks) ---------- */

export type EmailEventData = {
  id: string;
  eventType: string;
  recipient: string;
  subject: string;
  resendId: string | null;
  createdAt: string;
};

export async function createEmailEvent(input: {
  eventType: string;
  recipient: string;
  subject: string;
  resendId?: string | null;
  payload: string;
}): Promise<void> {
  await prisma.emailEvent.create({
    data: {
      eventType: input.eventType,
      recipient: input.recipient,
      subject: input.subject,
      resendId: input.resendId ?? null,
      payload: input.payload,
    },
  });
}

export async function fetchEmailEvents(limit = 100): Promise<EmailEventData[]> {
  const rows = await prisma.emailEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    recipient: r.recipient,
    subject: r.subject,
    resendId: r.resendId,
    createdAt: r.createdAt.toISOString(),
  }));
}

/* ---------- atualizar perfil ---------- */

export async function updateProfile(userId: string, data: { name?: string }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch["name"] = data.name;
  if (!Object.keys(patch).length) return;
  await prisma.profile.update({ where: { id: userId }, data: patch });
}

/* ---------- utilidades ---------- */

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function blobProxy(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes("blob.vercel-storage.com")) return `/api/blob-proxy?url=${encodeURIComponent(url)}`;
  return url;
}

export function dbWorkToWork(w: DbWork): Work {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    medium: w.medium,
    artistSlug: w.artistSlug,
    artistName: w.artistName,
    ...(w.coverUrl ? { cover: blobProxy(w.coverUrl) as string } : {}),
    ...(w.genre ? { genre: w.genre } : {}),
    ...(w.tags ? { tags: w.tags.split(",").map((t) => t.trim()).filter(Boolean) } : {}),
    excerpt: w.excerpt,
    body: w.body
      ? (["manhwa", "manhua"].includes(w.medium) ? w.body : sanitizeWorkHtml(w.body)).split("\n").filter(Boolean)
      : [],
    clicks: 0,
    likes: 0,
    publishedAt: new Date(w.publishedAt ?? w.createdAt).toISOString(),
    published: new Date(w.publishedAt ?? w.createdAt).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    updatedAt: w.updatedAt.toISOString(),
    workStatus: w.workStatus,
  };
}

/**
 * Obra para listagens públicas (home, explorar, autor, relacionadas): sem o texto
 * completo — ele só é entregue pelo leitor (/api/reader), que confere o limite diário.
 */
export function dbWorkToCard(w: DbWork): Work {
  const card = dbWorkToWork({ ...w, body: "" });
  return { ...card, body: [], readable: ["manhwa", "manhua"].includes(w.medium) || !!w.body?.trim() || !!w.pdfUrl };
}

export async function fetchWorksByArtistSlug(artistSlug: string): Promise<DbWork[]> {
  const rows = await prisma.work.findMany({
    where: { artistSlug, status: "approved" },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map(workToDb);
}

export type ArtistSummary = {
  name: string;
  slug: string;
  workCount: number;
};

export async function fetchDistinctArtists(): Promise<ArtistSummary[]> {
  const rows = await prisma.work.groupBy({
    by: ["artistSlug", "artistName"],
    where: { status: "approved" },
    _count: { id: true },
  });
  return rows.map((r) => ({
    name: r.artistName,
    slug: r.artistSlug,
    workCount: r._count.id,
  }));
}

/* ---------- helpers internos ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function workToDb(w: any): DbWork {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    medium: w.medium as Medium,
    artistName: w.artistName,
    artistSlug: w.artistSlug,
    authorId: w.authorId,
    excerpt: w.excerpt,
    body: w.body,
    coverUrl: w.coverUrl,
    pdfUrl: w.pdfUrl,
    genre: w.genre,
    tags: w.tags,
    status: w.status as ReviewStatusDb,
    workStatus: (w.workStatus ?? "andamento") as "andamento" | "finalizado" | "paralisado",
    curatorNote: w.curatorNote,
    createdAt: (w.createdAt as Date).toISOString(),
    updatedAt: w.updatedAt as Date,
    publishedAt: w.publishedAt ? (w.publishedAt as Date).toISOString() : null,
  };
}

/* ---------- audit log ---------- */

export type AuditLogEntry = {
  id: string;
  action: string;
  workSlug: string;
  workTitle: string;
  actorId: string;
  actorEmail: string;
  note: string | null;
  createdAt: string;
};

export async function insertAuditLog(entry: Omit<AuditLogEntry, "id" | "createdAt">) {
  await prisma.auditLog.create({ data: entry });
}

export async function fetchAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appToDb(a: any): DbApplication {
  return {
    id: a.id,
    userId: a.userId,
    artistName: a.artistName,
    email: a.email,
    phone: a.phone ?? "",
    field: a.field ?? "",
    bio: a.bio ?? "",
    portfolio: a.portfolio ?? "",
    portfolioFiles: (a.portfolioFiles as string | null) ?? "[]",
    portfolioCitations: (a.portfolioCitations as string | null) ?? "",
    samples: a.samples ?? 0,
    message: a.message,
    status: a.status as ReviewStatusDb,
    curatorNote: a.curatorNote,
    createdAt: (a.createdAt as Date).toISOString(),
    decidedAt: a.decidedAt ? (a.decidedAt as Date).toISOString() : null,
  };
}

/* ---------- lista de espera (planos Fã/Super Fã e autores) ---------- */

export type WaitlistRow = { id: string; email: string; plan: string; createdAt: string };

export async function addToWaitlist(input: { email: string; plan: string; userId?: string | null }): Promise<void> {
  await prisma.waitlistEntry.upsert({
    where: { email: input.email },
    create: { email: input.email, plan: input.plan, userId: input.userId ?? null },
    // Inscrição já existente não é alterada (ninguém troca o plano de outra pessoa)
    update: {},
  });
}

export async function fetchWaitlist(): Promise<WaitlistRow[]> {
  const rows = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, email: r.email, plan: r.plan, createdAt: r.createdAt.toISOString() }));
}

/* ---------- perfil público do autor ---------- */

export const EMPTY_AUTHOR_BIO: AuthorBioData = { bio: "", avatarUrl: "", city: "", instagram: "", website: "" };

/** Retorna a bio do autor; se a tabela ainda não existir no banco, devolve vazio. */
export async function getAuthorBio(userId: string | null | undefined): Promise<AuthorBioData> {
  if (!userId) return EMPTY_AUTHOR_BIO;
  try {
    const row = await prisma.authorBio.findUnique({ where: { userId } });
    if (!row) return EMPTY_AUTHOR_BIO;
    return {
      bio: row.bio,
      avatarUrl: blobProxy(row.avatarUrl) ?? "",
      city: row.city,
      instagram: row.instagram,
      website: row.website,
    };
  } catch (err) {
    console.error("getAuthorBio falhou (tabela author_bios existe?)", err);
    return EMPTY_AUTHOR_BIO;
  }
}

/** Bio crua (sem proxy) para o formulário de edição do próprio autor. */
export async function getOwnAuthorBio(userId: string): Promise<AuthorBioData> {
  try {
    const row = await prisma.authorBio.findUnique({ where: { userId } });
    if (!row) return EMPTY_AUTHOR_BIO;
    return { bio: row.bio, avatarUrl: row.avatarUrl, city: row.city, instagram: row.instagram, website: row.website };
  } catch {
    return EMPTY_AUTHOR_BIO;
  }
}

export async function saveAuthorBio(userId: string, data: AuthorBioData): Promise<void> {
  await prisma.authorBio.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/* ---------- ranking semanal (Top 50) ---------- */

export type RankedWork = Work & { weekViews: number; totalViews: number };
export type RankedAuthor = {
  name: string;
  slug: string;
  workCount: number;
  weekViews: number;
  totalViews: number;
  followers: number;
  avatarUrl: string;
  topWork: { slug: string; title: string } | null;
};
export type RankingData = { since: string; works: RankedWork[]; authors: RankedAuthor[] };

/**
 * Obras e autores mais lidos nos últimos 7 dias. Desempate: leituras totais e,
 * por último, data de publicação (mais recentes primeiro) — assim o ranking nunca
 * fica vazio enquanto as leituras da semana ainda são poucas.
 */
export async function fetchRanking(limit = 50): Promise<RankingData> {
  const since = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const [works, weekRows, totalRows, followRows] = await Promise.all([
    fetchApprovedWorks(),
    prisma.workViewDaily
      .groupBy({ by: ["workSlug"], where: { date: { gte: since } }, _sum: { views: true } })
      .catch(() => [] as { workSlug: string; _sum: { views: number | null } }[]),
    prisma.workView.findMany({ select: { workSlug: true, views: true } }),
    prisma.artistFollow.groupBy({ by: ["artistSlug"], _count: { id: true } }).catch(() => [] as { artistSlug: string; _count: { id: number } }[]),
  ]);
  const week = new Map(weekRows.map((r) => [r.workSlug, r._sum.views ?? 0]));
  const total = new Map(totalRows.map((r) => [r.workSlug, Number(r.views)]));
  const follows = new Map(followRows.map((r) => [r.artistSlug, r._count.id]));

  const ranked: RankedWork[] = works.map((w) => ({
    ...dbWorkToCard(w),
    weekViews: week.get(w.slug) ?? 0,
    totalViews: total.get(w.slug) ?? 0,
  }));
  const byRank = (a: { weekViews: number; totalViews: number }, b: { weekViews: number; totalViews: number }) =>
    b.weekViews - a.weekViews || b.totalViews - a.totalViews;
  ranked.sort((a, b) => byRank(a, b) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  // Autores: soma das obras; foto do perfil público quando houver
  const authorMap = new Map<string, RankedAuthor & { authorId: string | null }>();
  for (const w of works) {
    if (!w.artistSlug) continue;
    const cur = authorMap.get(w.artistSlug) ?? {
      name: w.artistName,
      slug: w.artistSlug,
      workCount: 0,
      weekViews: 0,
      totalViews: 0,
      followers: follows.get(w.artistSlug) ?? 0,
      avatarUrl: "",
      topWork: null,
      authorId: w.authorId,
    };
    const wv = week.get(w.slug) ?? 0;
    const tv = total.get(w.slug) ?? 0;
    cur.workCount += 1;
    cur.weekViews += wv;
    cur.totalViews += tv;
    const topScore = cur.topWork ? (week.get(cur.topWork.slug) ?? 0) * 1e9 + (total.get(cur.topWork.slug) ?? 0) : -1;
    if (wv * 1e9 + tv > topScore) cur.topWork = { slug: w.slug, title: stripHtml(w.title) };
    if (!cur.authorId && w.authorId) cur.authorId = w.authorId;
    authorMap.set(w.artistSlug, cur);
  }
  const authorIds = [...authorMap.values()].map((a) => a.authorId).filter(Boolean) as string[];
  const bios = authorIds.length
    ? await prisma.authorBio.findMany({ where: { userId: { in: authorIds } }, select: { userId: true, avatarUrl: true } }).catch(() => [])
    : [];
  const avatarById = new Map(bios.map((b) => [b.userId, blobProxy(b.avatarUrl) ?? ""]));
  const authors: RankedAuthor[] = [...authorMap.values()]
    .map(({ authorId, ...a }) => ({ ...a, avatarUrl: authorId ? avatarById.get(authorId) ?? "" : "" }))
    .sort((a, b) => byRank(a, b) || b.followers - a.followers || a.name.localeCompare(b.name));

  return { since, works: ranked.slice(0, limit), authors: authors.slice(0, limit) };
}

/* ---------- idade informada no cadastro ---------- */

export async function saveUserBirth(userId: string, birthDate: string, guardianConsent: boolean): Promise<void> {
  await prisma.userBirth.upsert({
    where: { userId },
    create: { userId, birthDate, guardianConsent },
    update: { birthDate, guardianConsent },
  });
}
