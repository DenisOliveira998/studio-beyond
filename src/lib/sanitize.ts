// Limpeza do HTML das obras (servidor). O corpo vem do editor (TipTap/StarterKit)
// e é exibido com dangerouslySetInnerHTML — por isso só passam as tags de texto
// do editor; scripts, eventos (onerror…), iframes, estilos e links javascript: caem.
import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "strike",
    "code", "pre", "blockquote", "ul", "ol", "li", "hr", "a", "span",
  ],
  allowedAttributes: { a: ["href", "title", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
  },
};

export function sanitizeWorkHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}

/** Escapa texto para interpolar em HTML de e-mail. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
