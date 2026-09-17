import { formatMoney, formatNumber } from "@/lib/i18n";

export type Medium = "livro" | "manga" | "hq" | "conto";

export type WorkChapter = { number: number; title: string; date: string };

export type Work = {
  id: string;
  slug: string;
  title: string;
  medium: Medium;
  artistSlug: string;
  artistName?: string;
  cover?: string;
  excerpt: string;
  body: string[];
  audio?: boolean;
  clicks: number;
  likes: number;
  published: string;
  readTime?: string;
  genre?: string;
  pages?: number;
  pdfUrl?: string;
  chapters?: WorkChapter[];
  updatedAt?: string;
};

export type Artist = {
  slug: string;
  name: string;
  discipline: string;
  location: string;
  bio: string;
  initials: string;
  supporters: number;
  works: string[];
  social?: { instagram?: string; website?: string; twitter?: string };
};

export const MEDIUM_LABEL: Record<Medium, string> = {
  livro: "Livro",
  manga: "Mangá",
  hq: "HQ",
  conto: "Conto",
};

export const artists: Artist[] = [];

export const works: Work[] = [];

export const PLATFORM_FEE = 0.12;
export const RATE_PER_CLICK = 0.004;

export function getArtist(slug: string) {
  return artists.find((a) => a.slug === slug);
}

export function getWork(slug: string) {
  return works.find((w) => w.slug === slug);
}

export function worksByArtist(slug: string) {
  return works.filter((w) => w.artistSlug === slug);
}

export const money = (n: number) => formatMoney(n);

export const compact = (n: number) => formatNumber(n);

export type AccountType = "free" | "vip" | "author" | "gerente" | "admin" | "owner";

export const ACCOUNT_LABEL: Record<AccountType, string> = {
  free: "Gratuito",
  vip: "VIP",
  author: "Autor",
  gerente: "Gerente",
  admin: "Administrador",
  owner: "Dono",
};

export type Account = {
  id: string;
  name: string;
  email: string;
  type: AccountType;
  joined: string;
  donated: number;
  suspended?: boolean;
};

export const accounts: Account[] = [];

export const donationsByWork: Record<string, number> = {};

export function workDonations(slug: string) {
  return donationsByWork[slug] ?? 0;
}

export type ReviewStatus = "pending" | "approved" | "rejected" | "changes";

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
  changes: "Ajustes solicitados",
};

export type AuthorApplication = {
  id: string;
  artistName: string;
  email: string;
  field: string;
  bio: string;
  portfolio: string;
  samples: number;
  message?: string;
  submitted: string;
  status: ReviewStatus;
};

export const authorApplications: AuthorApplication[] = [];

export type WorkSubmission = {
  id: string;
  title: string;
  artistSlug: string;
  medium: Medium;
  submitted: string;
  status: ReviewStatus;
  note?: string;
  pdfUrl?: string;
};

export const workSubmissions: WorkSubmission[] = [];

export type SearchHit =
  | { kind: "work"; slug: string; title: string; category: string; cover?: string | undefined }
  | { kind: "artist"; slug: string; title: string; category: string; initials: string };

export function searchAll(query: string): { works: SearchHit[]; artists: SearchHit[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { works: [], artists: [] };

  const w = works
    .filter((work) =>
      [work.title, MEDIUM_LABEL[work.medium], work.genre ?? "", work.artistName ?? "", work.excerpt]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 5)
    .map<SearchHit>((work) => ({
      kind: "work",
      slug: work.slug,
      title: work.title,
      category: MEDIUM_LABEL[work.medium],
      cover: work.cover,
    }));

  const a = artists
    .filter((artist) =>
      [artist.name, artist.discipline, artist.location, artist.bio]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 4)
    .map<SearchHit>((artist) => ({
      kind: "artist",
      slug: artist.slug,
      title: artist.name,
      category: artist.discipline,
      initials: artist.initials,
    }));

  return { works: w, artists: a };
}
