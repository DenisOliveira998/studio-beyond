/**
 * URL canônica do site.
 * Domínio definitivo (DNS na HostGator apontando para a Vercel desde 03/10/2026).
 * Usado em: canonical links, og:url, og:image, twitter:image.
 */
export const SITE_URL = "https://www.gobeyondd.com.br";

/** Retorna URL absoluta para um caminho relativo (sem barra dupla). */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Converte caminho relativo (ex.: "/api/blob-proxy?…") em URL absoluta; mantém URLs http(s). */
export function absoluteUrl(pathOrUrl: string): string {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : siteUrl(pathOrUrl);
}

/** Imagem social padrão (1200×630). */
export const DEFAULT_OG_IMAGE = "/images/og-default.png";
