import { formatMoney, formatNumber } from "@/lib/i18n";

export type Medium = "livro" | "manga" | "hq" | "conto" | "lightnovel" | "manhwa" | "manhua";

// Mediums com leitor de imagem vertical (webtoon/scroll)
export const WEBTOON_MEDIUMS: Medium[] = ["manhwa", "manhua"];
// Mediums com leitor de texto
export const TEXT_MEDIUMS: Medium[] = ["livro", "conto", "lightnovel", "manga"];

export function getReaderMode(medium: Medium): "text" | "webtoon" {
  return WEBTOON_MEDIUMS.includes(medium) ? "webtoon" : "text";
}

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
  /** Data ISO de publicação (usada para o selo "Novo") */
  publishedAt?: string;
  readTime?: string;
  genre?: string;
  pages?: number;
  pdfUrl?: string;
  tags?: string[];
  chapters?: WorkChapter[];
  updatedAt?: string;
  workStatus?: "andamento" | "finalizado" | "paralisado";
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
  lightnovel: "Light Novel",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

export const artists: Artist[] = [];

export const works: Work[] = [];

export const PLATFORM_FEE = 0.12;
export const RATE_PER_CLICK = 0.004;

/** Contadores de visualização só aparecem a partir deste número (evita "0 visualizações"). */
export const VIEWS_DISPLAY_MIN = 50;

/** Selo "Novo": obras publicadas há menos de 14 dias. */
export const NEW_WORK_DAYS = 14;

export function isRecentWork(work: Pick<Work, "publishedAt">): boolean {
  if (!work.publishedAt) return false;
  const t = new Date(work.publishedAt).getTime();
  return !Number.isNaN(t) && Date.now() - t < NEW_WORK_DAYS * 86_400_000;
}

/** Limite diário de leitura gratuita (mesma regra para visitantes e contas gratuitas). */
export const FREE_DAILY_QUOTA = 10;

/** Resumo público do autor retornado por /api/artists (busca e listagens). */
export type PublicArtist = { name: string; slug: string; workCount: number };

/** Perfil público do autor (bio, foto, redes) — vazio quando o autor não preencheu. */
export type AuthorBioData = {
  bio: string;
  avatarUrl: string;
  city: string;
  instagram: string;
  website: string;
};

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

/** Minúsculas, sem acentos e sem tags HTML — para comparar termos de busca. */
function normalizeSearch(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function searchAll(
  query: string,
  works: Work[],
  artists: PublicArtist[],
): { works: SearchHit[]; artists: SearchHit[] } {
  const q = normalizeSearch(query.trim());
  if (!q) return { works: [], artists: [] };

  const w = works
    .filter((work) =>
      normalizeSearch(
        [work.title, MEDIUM_LABEL[work.medium], work.genre ?? "", work.artistName ?? "", (work.tags ?? []).join(" "), work.excerpt].join(" "),
      ).includes(q),
    )
    .slice(0, 5)
    .map<SearchHit>((work) => ({
      kind: "work",
      slug: work.slug,
      title: work.title.replace(/<[^>]*>/g, ""),
      category: MEDIUM_LABEL[work.medium],
      cover: work.cover,
    }));

  const a = artists
    .filter((artist) => normalizeSearch(artist.name).includes(q))
    .slice(0, 4)
    .map<SearchHit>((artist) => ({
      kind: "artist",
      slug: artist.slug,
      title: artist.name,
      category: `${artist.workCount} ${artist.workCount === 1 ? "obra" : "obras"}`,
      initials: artist.name.slice(0, 2).toUpperCase(),
    }));

  return { works: w, artists: a };
}
