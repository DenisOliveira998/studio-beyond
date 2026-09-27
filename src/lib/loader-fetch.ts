import { SITE_URL } from "@/lib/site-url";

/**
 * GET de JSON para loaders de rota: no servidor usa a URL absoluta do site,
 * no navegador usa caminho relativo. Em erro, devolve `fallback` (a página
 * continua renderizando; o useQuery do componente tenta de novo no cliente).
 */
export async function loaderFetch<T>(path: string, fallback: T): Promise<T> {
  const base = typeof window === "undefined" ? SITE_URL : "";
  try {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}
