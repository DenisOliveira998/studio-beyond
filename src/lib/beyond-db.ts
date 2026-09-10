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
  field: string;
  bio: string;
  portfolio: string;
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
      status: input.status,
    },
  });
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
      publishedAt: status === "approved" ? new Date() : undefined,
    },
  });
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
  field: string;
  bio: string;
  portfolio: string;
  samples: number;
  message: string;
}) {
  await prisma.authorApplication.create({
    data: {
      userId: input.userId,
      artistName: input.artistName,
      email: input.email,
      field: input.field,
      bio: input.bio,
      portfolio: input.portfolio,
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

/* ---------- utilidades ---------- */

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function dbWorkToWork(w: DbWork): Work {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    medium: w.medium,
    artistSlug: w.artistSlug,
    ...(w.coverUrl ? { cover: w.coverUrl } : {}),
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
    field: a.field,
    bio: a.bio,
    portfolio: a.portfolio,
    samples: a.samples,
    message: a.message,
    status: a.status as ReviewStatusDb,
    curatorNote: a.curatorNote,
    createdAt: (a.createdAt as Date).toISOString(),
    decidedAt: a.decidedAt ? (a.decidedAt as Date).toISOString() : null,
  };
}
