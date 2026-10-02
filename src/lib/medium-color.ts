import type { Medium } from "@/lib/beyond-data";

/** Cor de cada categoria: selo na capa e tag de filtro. `ink` é a cor do texto sobre ela. */
export const MEDIUM_COLOR: Record<Medium, { bg: string; ink: string }> = {
  livro: { bg: "#E63946", ink: "#ffffff" },
  manga: { bg: "#FF2E88", ink: "#ffffff" },
  hq: { bg: "#2F6BFF", ink: "#ffffff" },
  conto: { bg: "#00B37E", ink: "#ffffff" },
  lightnovel: { bg: "#8B5CF6", ink: "#ffffff" },
  manhwa: { bg: "#FF7A00", ink: "#121519" },
  manhua: { bg: "#00C2E0", ink: "#121519" },
};
