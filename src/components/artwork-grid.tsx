import { Link } from "@tanstack/react-router";
import { Heart, Layers } from "lucide-react";
import { AgeBadge } from "@/components/age-badge";
import { ARTWORK_KINDS } from "@/lib/gallery-kinds";
import type { AgeRating } from "@/lib/beyond-data";

export type ArtworkCardData = {
  id: string;
  title: string;
  kind: keyof typeof ARTWORK_KINDS;
  cover: string;
  imageCount: number;
  ageRating: string;
  artist: { name: string; slug: string };
  likes: number;
};

/** Grade em colunas (estilo mural): cada imagem mantém a própria proporção. */
export function ArtworkGrid({ items, showArtist = true }: { items: ArtworkCardData[]; showArtist?: boolean }) {
  return (
    <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
      {items.map((a) => (
        <li key={a.id} className="mb-3 break-inside-avoid">
          <Link to="/galeria/obra/$id" params={{ id: a.id }} className="group block">
            <div className="relative overflow-hidden rounded-md bg-surface">
              <img src={a.cover} alt={a.title} loading="lazy" className="w-full transition-transform duration-500 group-hover:scale-[1.03]" />
              <AgeBadge rating={a.ageRating as AgeRating} className="absolute bottom-2 right-2" />
              {a.imageCount > 1 && (
                <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                  <Layers className="size-3" /> {a.imageCount}
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm leading-snug group-hover:text-gilt">{a.title}</p>
          </Link>
          <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {showArtist ? (
              <Link to="/galeria/artista/$slug" params={{ slug: a.artist.slug }} className="truncate hover:text-foreground">
                {a.artist.name}
              </Link>
            ) : (
              <span>{ARTWORK_KINDS[a.kind]}</span>
            )}
            {a.likes > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                <Heart className="size-3" /> {a.likes}
              </span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
