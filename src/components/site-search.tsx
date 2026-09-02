import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchAll, type SearchHit } from "@/lib/beyond-data";

export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchAll(query), [query]);
  const empty = query.trim().length > 0 && !results.works.length && !results.artists.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Buscar obras e artistas"
          title="Buscar (Ctrl+K)"
          className="flex items-center gap-2 border border-transparent px-1.5 py-1.5 text-muted-foreground transition-colors hover:text-gilt"
        >
          <Search className="size-4" strokeWidth={1.5} />
        </button>
      ) : (
        <div className="flex items-center gap-2 border border-border bg-surface px-3 py-1.5 focus-within:border-gilt">
          <Search className="size-3.5 shrink-0 text-gilt" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Obras, artistas, categorias…"
            className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-56"
          />
          <button onClick={close} aria-label="Fechar busca" className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {open && query.trim().length > 0 && (
        <div className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(22rem,calc(100vw-2.5rem))] border border-border bg-surface shadow-[var(--shadow-gallery)]">
          {results.works.length > 0 && (
            <ResultGroup label="Obras">
              {results.works.map((hit) => (
                <Link
                  key={hit.slug}
                  to="/work/$slug"
                  params={{ slug: hit.slug }}
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background"
                >
                  <Thumb hit={hit} />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg leading-tight">
                      {hit.title}
                    </span>
                    <span className="eyebrow">{hit.category}</span>
                  </span>
                </Link>
              ))}
            </ResultGroup>
          )}

          {results.artists.length > 0 && (
            <ResultGroup label="Artistas">
              {results.artists.map((hit) => (
                <Link
                  key={hit.slug}
                  to="/artist/$slug"
                  params={{ slug: hit.slug }}
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background"
                >
                  <Thumb hit={hit} />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg leading-tight">
                      {hit.title}
                    </span>
                    <span className="eyebrow">{hit.category}</span>
                  </span>
                </Link>
              ))}
            </ResultGroup>
          )}

          {empty && (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              Nada encontrado para “{query}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <p className="eyebrow px-4 pt-4">{label}</p>
      <div className="mt-1 pb-2">{children}</div>
    </div>
  );
}

function Thumb({ hit }: { hit: SearchHit }) {
  if (hit.kind === "work" && hit.cover) {
    return (
      <img
        src={hit.cover}
        alt=""
        width={80}
        height={56}
        loading="lazy"
        className="size-10 shrink-0 object-cover"
      />
    );
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center border border-border font-display text-sm text-gilt">
      {hit.kind === "artist" ? hit.initials : "TB"}
    </span>
  );
}
