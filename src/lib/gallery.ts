// Galeria: artistas visuais (ilustradores, desenhistas) e suas publicações.
// Cada publicação passa pela curadoria antes de aparecer. Curtidas e comentários
// reaproveitam as tabelas das obras, com a chave "galeria-<id>".
import { prisma } from "./prisma";

import { ARTWORK_KINDS, isArtworkKind, type ArtworkKind } from "./gallery-kinds";
export { ARTWORK_KINDS, isArtworkKind, type ArtworkKind };

/** Chave usada nas curtidas e comentários de uma publicação da Galeria. */
export const artworkKey = (id: string) => `galeria-${id}`;
/** Chave usada para seguir um artista da Galeria. */
export const artistFollowKey = (slug: string) => `galeria-${slug}`;

export type ArtworkCard = {
  id: string;
  title: string;
  kind: ArtworkKind;
  cover: string;
  imageCount: number;
  ageRating: string;
  artist: { name: string; slug: string };
  likes: number;
};

export type ArtworkDetail = ArtworkCard & {
  description: string;
  images: string[];
  status: string;
  curatorNote: string | null;
  publishedAt: string | null;
  relatedWork: { slug: string; title: string } | null;
  artistAvatar: string;
};

function proxy(url: string): string {
  return url.includes("blob.vercel-storage.com") ? `/api/blob-proxy?url=${encodeURIComponent(url)}` : url;
}

function parseImages(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getGalleryArtist(userId: string) {
  return prisma.galleryArtist.findUnique({ where: { userId } });
}

/** Aprovação da candidatura de artista: cria o perfil na Galeria (endereço único pelo nome). */
export async function ensureGalleryArtist(userId: string, name: string) {
  const existing = await prisma.galleryArtist.findUnique({ where: { userId } });
  if (existing) return existing;
  const base = slugify(name) || "artista";
  let slug = base;
  for (let n = 2; await prisma.galleryArtist.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
  return prisma.galleryArtist.create({ data: { userId, slug, name: name.slice(0, 120) } });
}

async function likeCounts(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await prisma.workLike.groupBy({
    by: ["workSlug"],
    where: { workSlug: { in: ids.map(artworkKey) } },
    _count: true,
  });
  return new Map(rows.map((r) => [r.workSlug.replace(/^galeria-/, ""), r._count]));
}

type Row = Awaited<ReturnType<typeof prisma.artwork.findMany>>[number];

async function toCards(rows: Row[]): Promise<ArtworkCard[]> {
  const artists = await prisma.galleryArtist.findMany({ where: { userId: { in: [...new Set(rows.map((r) => r.artistId))] } } });
  const likes = await likeCounts(rows.map((r) => r.id));
  return rows.flatMap((r) => {
    const a = artists.find((x) => x.userId === r.artistId);
    const images = parseImages(r.images);
    if (!a || !images.length) return [];
    return [
      {
        id: r.id,
        title: r.title,
        kind: (isArtworkKind(r.kind) ? r.kind : "ilustracao") as ArtworkKind,
        cover: proxy(images[0]!),
        imageCount: images.length,
        ageRating: r.ageRating,
        artist: { name: a.name, slug: a.slug },
        likes: likes.get(r.id) ?? 0,
      },
    ];
  });
}

/** Publicações aprovadas, mais recentes primeiro. */
export async function listArtworks(opts: { kind?: string; artistId?: string; take?: number } = {}): Promise<ArtworkCard[]> {
  const rows = await prisma.artwork.findMany({
    where: { status: "approved", ...(opts.kind && isArtworkKind(opts.kind) ? { kind: opts.kind } : {}), ...(opts.artistId ? { artistId: opts.artistId } : {}) },
    orderBy: { publishedAt: "desc" },
    take: opts.take ?? 120,
  });
  return toCards(rows);
}

/** Uma publicação. Antes da aprovação, só o próprio artista e a equipe veem. */
export async function getArtwork(id: string, viewer: { userId: string | null; staff: boolean }): Promise<ArtworkDetail | null> {
  const r = await prisma.artwork.findUnique({ where: { id } });
  if (!r) return null;
  if (r.status !== "approved" && !(viewer.staff || viewer.userId === r.artistId)) return null;
  const [card] = await toCards([r]);
  if (!card) return null;
  const related = r.relatedWorkSlug
    ? await prisma.work.findFirst({ where: { slug: r.relatedWorkSlug, status: "approved" }, select: { slug: true, title: true } })
    : null;
  const bio = await prisma.authorBio.findUnique({ where: { userId: r.artistId }, select: { avatarUrl: true } }).catch(() => null);
  return {
    ...card,
    description: r.description,
    images: parseImages(r.images).map(proxy),
    status: r.status,
    curatorNote: r.status === "approved" ? null : r.curatorNote,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    relatedWork: related ? { slug: related.slug, title: related.title.replace(/<[^>]*>/g, "") } : null,
    artistAvatar: bio?.avatarUrl ? proxy(bio.avatarUrl) : "",
  };
}

/** Página pública do artista. */
export async function getArtistPage(slug: string) {
  const a = await prisma.galleryArtist.findUnique({ where: { slug } });
  if (!a) return null;
  const [artworks, bio, followers] = await Promise.all([
    listArtworks({ artistId: a.userId }),
    prisma.authorBio.findUnique({ where: { userId: a.userId } }).catch(() => null),
    prisma.artistFollow.count({ where: { artistSlug: artistFollowKey(a.slug) } }),
  ]);
  return {
    name: a.name,
    slug: a.slug,
    userId: a.userId,
    avatarUrl: bio?.avatarUrl ? proxy(bio.avatarUrl) : "",
    bio: bio?.bio ?? "",
    instagram: bio?.instagram ?? "",
    website: bio?.website ?? "",
    followers,
    artworks,
  };
}

/** Painel do artista: todas as publicações dele, com situação na curadoria. */
export async function listMyArtworks(userId: string) {
  const rows = await prisma.artwork.findMany({ where: { artistId: userId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => {
    const images = parseImages(r.images);
    return {
      id: r.id,
      title: r.title,
      kind: r.kind,
      status: r.status,
      curatorNote: r.curatorNote,
      cover: images[0] ? proxy(images[0]) : "",
      imageCount: images.length,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function createArtwork(input: {
  artistId: string;
  title: string;
  description: string;
  kind: ArtworkKind;
  images: string[];
  ageRating: string;
  relatedWorkSlug: string | null;
}) {
  return prisma.artwork.create({
    data: {
      artistId: input.artistId,
      title: input.title,
      description: input.description,
      kind: input.kind,
      images: JSON.stringify(input.images),
      ageRating: input.ageRating,
      relatedWorkSlug: input.relatedWorkSlug,
    },
    select: { id: true },
  });
}

/** O artista tira a publicação do ar (apaga o registro; as imagens deixam de ser exibidas). */
export async function deleteMyArtwork(userId: string, id: string): Promise<boolean> {
  const r = await prisma.artwork.deleteMany({ where: { id, artistId: userId } });
  return r.count > 0;
}

/** Equipe: publicações esperando a curadoria. */
export async function listPendingArtworks() {
  const rows = await prisma.artwork.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 100 });
  const artists = await prisma.galleryArtist.findMany({ where: { userId: { in: [...new Set(rows.map((r) => r.artistId))] } } });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    description: r.description,
    ageRating: r.ageRating,
    relatedWorkSlug: r.relatedWorkSlug,
    images: parseImages(r.images).map(proxy),
    artist: artists.find((a) => a.userId === r.artistId)?.name ?? "Artista",
    artistSlug: artists.find((a) => a.userId === r.artistId)?.slug ?? "",
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function decideArtwork(id: string, approve: boolean, note: string | null, ageRating?: string) {
  const r = await prisma.artwork.findUnique({ where: { id } });
  if (!r || r.status !== "pending") throw new Error("Publicação não encontrada ou já decidida.");
  await prisma.artwork.update({
    where: { id },
    data: {
      status: approve ? "approved" : "rejected",
      curatorNote: note,
      ...(approve ? { publishedAt: new Date() } : {}),
      ...(ageRating ? { ageRating } : {}),
    },
  });
  await prisma.notification
    .create({
      data: {
        userId: r.artistId,
        type: approve ? "artwork_approved" : "artwork_rejected",
        title: approve ? `"${r.title}" está na Galeria` : `"${r.title}" não foi aprovada`,
        body: (note ?? (approve ? "Sua publicação já está no ar." : "Veja o motivo no seu painel da Galeria.")).slice(0, 500),
        link: approve ? `/galeria/obra/${r.id}` : "/galeria/minha",
      },
    })
    .catch(() => {});
}

/** Artistas da Galeria que a pessoa segue (para "Seguindo" no perfil). */
export async function followedGalleryArtists(followSlugs: string[]) {
  const slugs = followSlugs.filter((s) => s.startsWith("galeria-")).map((s) => s.slice("galeria-".length));
  if (!slugs.length) return [];
  const artists = await prisma.galleryArtist.findMany({ where: { slug: { in: slugs } } });
  const bios = await prisma.authorBio
    .findMany({ where: { userId: { in: artists.map((a) => a.userId) } }, select: { userId: true, avatarUrl: true } })
    .catch(() => []);
  return artists.map((a) => {
    const av = bios.find((b) => b.userId === a.userId)?.avatarUrl;
    return { key: artistFollowKey(a.slug), slug: a.slug, name: a.name, avatarUrl: av ? proxy(av) : "" };
  });
}
