/** Aceita só caminhos internos ("/algo"), nunca "//host" ou URLs externas. */
export function safeRedirect(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
