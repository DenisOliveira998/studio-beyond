import { AGE_RATING_LABEL, type AgeRating } from "@/lib/beyond-data";

// Cores do padrão brasileiro de classificação indicativa
const STYLE: Record<AgeRating, { bg: string; fg: string }> = {
  L: { bg: "#0c9447", fg: "#ffffff" },
  "10": { bg: "#0f7dc2", fg: "#ffffff" },
  "12": { bg: "#f8c411", fg: "#111111" },
  "14": { bg: "#e67824", fg: "#ffffff" },
  "16": { bg: "#db2827", fg: "#ffffff" },
  "18": { bg: "#1d1815", fg: "#ffffff" },
};

/** Etiqueta da classificação indicativa ("L", "12"…), com o texto completo para leitores de tela. */
export function AgeBadge({ rating, size = "sm", className = "" }: { rating?: AgeRating | null | undefined; size?: "sm" | "md"; className?: string }) {
  if (!rating) return null;
  const s = STYLE[rating];
  const dim = size === "md" ? "size-7 text-[13px]" : "size-5 text-[10px]";
  return (
    <span
      title={AGE_RATING_LABEL[rating]}
      aria-label={`Classificação: ${AGE_RATING_LABEL[rating]}`}
      className={`inline-flex shrink-0 items-center justify-center rounded font-bold leading-none shadow-sm ${dim} ${className}`}
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {rating}
    </span>
  );
}
