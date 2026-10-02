/**
 * Aceita só caminhos internos ("/algo") para redirecionar depois do login.
 * Resolve a URL e confere a origem: bloqueia "//host", "/\host" (o navegador
 * trata "\" como "/"), caracteres de controle e qualquer destino externo.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/";
  }
  try {
    const base = "https://interno.invalid";
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
