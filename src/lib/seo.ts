// Dados estruturados (JSON-LD) — usados via `{ "script:ld+json": … }` no head() das rotas.
import { SITE_URL, absoluteUrl, siteUrl } from "@/lib/site-url";
import { MEDIUM_LABEL, type AuthorBioData, type Work } from "@/lib/beyond-data";
import { stripHtml } from "@/lib/utils";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Go Beyondd",
    url: `${SITE_URL}/`,
    logo: siteUrl("/icon-512.png"),
    description:
      "Plataforma digital de leitura e publicação autoral de livros, mangás, HQs, contos e novels, com foco em novos talentos brasileiros.",
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "Go Beyondd",
    url: `${SITE_URL}/`,
    inLanguage: "pt-BR",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}

/** Livro/conto/light novel → Book; mangá/HQ/manhwa/manhua → ComicStory. */
export function workJsonLd(work: Work) {
  const isComic = ["manga", "hq", "manhwa", "manhua"].includes(work.medium);
  const tags = work.tags ?? [];
  return {
    "@context": "https://schema.org",
    "@type": isComic ? "ComicStory" : "Book",
    name: stripHtml(work.title),
    url: siteUrl(`/work/${work.slug}`),
    description: stripHtml(work.excerpt),
    inLanguage: "pt-BR",
    genre: [MEDIUM_LABEL[work.medium], ...(work.genre ? [work.genre] : []), ...tags],
    isAccessibleForFree: true,
    ...(work.cover ? { image: absoluteUrl(work.cover) } : {}),
    ...(work.publishedAt ? { datePublished: work.publishedAt.slice(0, 10) } : {}),
    ...(work.artistName
      ? {
          author: {
            "@type": "Person",
            name: work.artistName,
            url: siteUrl(`/artist/${work.artistSlug}`),
          },
        }
      : {}),
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function authorProfileJsonLd(input: { name: string; slug: string; bio: AuthorBioData; worksCount: number }) {
  const sameAs = [instagramUrl(input.bio.instagram), input.bio.website].filter((v) => /^https?:\/\//i.test(v));
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: siteUrl(`/artist/${input.slug}`),
    mainEntity: {
      "@type": "Person",
      name: input.name,
      url: siteUrl(`/artist/${input.slug}`),
      ...(input.bio.bio ? { description: input.bio.bio } : {}),
      ...(input.bio.avatarUrl ? { image: absoluteUrl(input.bio.avatarUrl) } : {}),
      ...(input.bio.city ? { homeLocation: { "@type": "Place", name: input.bio.city } } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** Link de Instagram: aceita "@usuario", "usuario" ou URL completa. */
export function instagramUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, "")}`;
}

/** "mangá", "livro", "HQ"… para usar no meio de frases. */
export function mediumNoun(medium: Work["medium"]): string {
  const label = MEDIUM_LABEL[medium];
  return label === "HQ" ? "HQ" : label.toLowerCase();
}

/** Corta no limite sem quebrar palavra, com reticências. */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 0) || cut.length).replace(/[\s,;:.—-]+$/, "")}…`;
}

/** Título e descrição da página da obra. O título cabe em 60 caracteres sempre que possível. */
export function workSeo(work: Work): { title: string; description: string } {
  const name = stripHtml(work.title);
  const noun = mediumNoun(work.medium);
  const brand = " | Go Beyondd";
  const options = [
    work.artistName ? `${name}: ${noun} de ${work.artistName}` : `${name}: ${noun}`,
    work.artistName ? `${name}, de ${work.artistName}` : "",
    name,
  ].filter(Boolean);
  const head = options.find((t) => t.length + brand.length <= 60) ?? name;
  const suffix = " Leia grátis na Go Beyondd.";
  return {
    title: `${head}${brand}`,
    description: `${clampText(stripHtml(work.excerpt), 158 - suffix.length)}${suffix}`,
  };
}

/** Lista de obras de uma página de catálogo (Explorar e categorias). */
export function workListJsonLd(name: string, path: string, works: Pick<Work, "slug" | "title">[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: siteUrl(path),
    numberOfItems: works.length,
    itemListElement: works.map((w, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: siteUrl(`/work/${w.slug}`),
      name: stripHtml(w.title),
    })),
  };
}

/** Lista de livros da Biblioteca clássica (domínio público, links externos). */
export function bookListJsonLd(books: { title: string; author: string; url: string; cover?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Biblioteca clássica",
    url: siteUrl("/biblioteca"),
    numberOfItems: books.length,
    itemListElement: books.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Book",
        name: b.title,
        url: b.url,
        author: { "@type": "Person", name: b.author },
        isAccessibleForFree: true,
        ...(b.cover ? { image: b.cover } : {}),
      },
    })),
  };
}
