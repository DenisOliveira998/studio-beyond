// ---------------------------------------------------------------------------
// beyond-db.ts — camada de acesso ao banco (Prisma + TiDB Cloud)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/auth";
import type { Medium, Work } from "@/lib/beyond-data";
import { stripHtml } from "@/lib/utils";

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
  curatorNote: string | null;
  createdAt: string;
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
  coverUrl?: string | null;
  status: "pending" | "draft";
}) {
  // Lição Galinha GSB: sempre stripHtml no título antes de gerar slug
  const base = slugify(stripHtml(input.title)) || `obra-${Date.now()}`;
  await prisma.work.create({
    data: {
      slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
      title: input.title,
      medium: input.medium,
      artistName: input.artistName,
      artistSlug: slugify(input.artistName),
      authorId: input.authorId,
      excerpt: input.excerpt.slice(0, 240),
      body: input.body,
      tags: input.tags,
      pdfUrl: input.pdfUrl ?? null,
      coverUrl: input.coverUrl ?? null,
      status: input.status,
    },
  });
}

export async function updateAuthorWork(
  id: string,
  authorId: string,
  data: { title?: string; medium?: string; status?: "pending" | "draft" },
) {
  const work = await prisma.work.findFirst({ where: { id, authorId } });
  if (!work) throw new Error("Obra não encontrada ou sem permissão");
  const patch: Parameters<typeof prisma.work.update>[0]["data"] = {};
  if (data.title !== undefined) patch["title"] = data.title;
  if (data.medium !== undefined) patch["medium"] = data.medium as import("@prisma/client").WorkMedium;
  if (data.status !== undefined) patch["status"] = data.status as import("@prisma/client").ReviewStatus;
  await prisma.work.update({ where: { id }, data: patch });
}

export async function decideWork(
  id: string,
  status: "approved" | "rejected" | "changes",
  note?: string,
) {
  await prisma.work.update({
    where: { id },
    data: {
      status,
      curatorNote: note ?? null,
      ...(status === "approved" ? { publishedAt: new Date() } : {}),
    },
  });
}

export async function updateWorkPdf(id: string, pdfUrl: string | null) {
  await prisma.work.update({ where: { id }, data: { pdfUrl } });
}

export async function deleteWork(id: string) {
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
) {
  const app = await prisma.authorApplication.update({
    where: { id },
    data: {
      status,
      curatorNote: note ?? null,
      decidedAt: new Date(),
    },
  });

  // Se aprovado e tem userId, promove para author
  if (status === "approved" && app.userId) {
    await prisma.profile.update({
      where: { id: app.userId },
      data: { role: "author" },
    });
  }
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
};

export async function getReaderProfileStats(userId: string): Promise<ReaderProfileStats> {
  const [favorites, { totalPagesRead, finishedCount }] = await Promise.all([
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
};

export async function getWorkComments(workSlug: string): Promise<CommentData[]> {
  const rows = await prisma.workComment.findMany({
    where: { workSlug },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    author: r.author,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
  }));
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
    ...(w.coverUrl ? { cover: blobProxy(w.coverUrl) } : {}),
    ...(w.pdfUrl ? { pdfUrl: blobProxy(w.pdfUrl) } : {}),
    ...(w.genre ? { genre: w.genre } : {}),
    excerpt: w.excerpt,
    body: w.body ? w.body.split("\n").filter(Boolean) : [],
    clicks: 0,
    likes: 0,
    published: new Date(w.publishedAt ?? w.createdAt).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
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
function workToDb(w: any): DbWork {
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
    curatorNote: w.curatorNote,
    createdAt: (w.createdAt as Date).toISOString(),
    publishedAt: w.publishedAt ? (w.publishedAt as Date).toISOString() : null,
  };
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
