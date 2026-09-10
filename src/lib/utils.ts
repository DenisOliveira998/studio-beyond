import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Remove todas as tags HTML de uma string.
 * Usar SEMPRE antes de inserir conteúdo em:
 *   - slugs (slugify(stripHtml(title)))
 *   - meta tags <title>, og:title, twitter:title
 *   - aria-label e atributos de acessibilidade
 *
 * Lição do Galinha GSB: TipTap envolve tudo em <p> tags; sem strip,
 * o slug vira "p-titulo-do-livro-p" e a aba do browser mostra "<p>Título</p>".
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Retorna true se a string contém tags HTML.
 * Útil para decidir entre renderização como texto puro ou dangerouslySetInnerHTML.
 */
export function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}
