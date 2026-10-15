// Tipos de publicação da Galeria (usado no site e no servidor; sem acesso ao banco)
export const ARTWORK_KINDS = {
  ilustracao: "Ilustração",
  album: "Álbum",
  fanart: "Fan art",
  conceito: "Arte conceitual",
  historia: "História ilustrada",
  quadrinho: "Quadrinho",
  estudo: "Estudo de personagem",
  autoral: "Projeto autoral",
} as const;
export type ArtworkKind = keyof typeof ARTWORK_KINDS;
export const isArtworkKind = (v: unknown): v is ArtworkKind => typeof v === "string" && v in ARTWORK_KINDS;

