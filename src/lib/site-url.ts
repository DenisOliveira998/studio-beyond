/**
 * URL canônica do site.
 * Alterar aqui quando o domínio definitivo (thebeyond.art) estiver configurado.
 * Usado em: canonical links, og:url, og:image, twitter:image.
 */
export const SITE_URL = "https://studio-beyond-phi.vercel.app";

/** Retorna URL absoluta para um caminho relativo (sem barra dupla). */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
