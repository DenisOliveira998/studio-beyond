import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca Clássica | The Beyond — Obras de Domínio Público" },
      {
        name: "description",
        content:
          "Clássicos da literatura universal em domínio público, cuidadosamente editados. Baixe EPUBs gratuitos de Machado de Assis, H.G. Wells, Jane Austen e muito mais.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Biblioteca Clássica | The Beyond" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/biblioteca` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/biblioteca` }],
  }),
  component: BibliotecaPage,
});

type SEBook = {
  id: string;
  title: string;
  url: string;
  author: string;
  language: string;
  description: string;
  subjects: string[];
  cover: string;
  epubUrl: string;
};

const SUBJECTS_PT = [
  "Portuguese fiction",
  "Brazilian fiction",
  "Portuguese literature",
  "Brazilian literature",
];

const SUBJECTS_CURATED = [
  "Fiction",
  "Short stories",
  "Poetry",
  "Drama",
  "Gothic fiction",
  "Science fiction",
  "Detective and mystery stories",
  "Horror tales",
  "Adventure stories",
];

type Filter = "pt" | "classic" | "all";

const FILTER_LABELS: Record<Filter, string> = {
  pt: "Português",
  classic: "Curadoria",
  all: "Todos",
};

function EpubDownloadButton({ book }: { book: SEBook }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/biblioteca/epub?url=${encodeURIComponent(book.epubUrl)}`);
      if (!res.ok) throw new Error("Falha no download");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = book.epubUrl.split("/").pop() ?? `${book.title}.epub`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // fallback: download direto
      window.open(book.epubUrl, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 border border-gilt/60 px-3 py-1.5 text-xs text-gilt transition-colors hover:bg-gilt/10 disabled:opacity-50"
    >
      <Download className="size-3" />
      {loading ? "Baixando…" : "EPUB"}
    </button>
  );
}

function BibliotecaPage() {
  const [filter, setFilter] = useState<Filter>("pt");
  const [search, setSearch] = useState("");

  const { data: books = [], isLoading } = useQuery<SEBook[]>({
    queryKey: ["standard-ebooks"],
    queryFn: () => fetch("/api/biblioteca").then((r) => r.json() as Promise<SEBook[]>),
    staleTime: 60 * 60 * 1000,
  });

  const filtered = books.filter((b) => {
    const matchSearch =
      !search.trim() ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (filter === "pt") return b.language === "pt" || b.subjects.some((s) => SUBJECTS_PT.includes(s));
    if (filter === "classic") return b.subjects.some((s) => SUBJECTS_CURATED.includes(s));
    return true;
  });

  return (
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <p className="eyebrow">Domínio público</p>
      <h1 className="mt-5 max-w-2xl font-display text-5xl leading-tight tracking-tight">
        Biblioteca clássica
      </h1>
      <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
        Clássicos curados pelo{" "}
        <a
          href="https://standardebooks.org"
          target="_blank"
          rel="noreferrer"
          className="text-gilt underline-offset-2 hover:underline"
        >
          Standard Ebooks
        </a>
        {" "}— obras de domínio público com tipografia profissional. Baixe o EPUB gratuitamente.
      </p>

      {/* Filtros + busca */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["pt", "classic", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn-type px-4 py-2 text-xs transition-colors ${
                filter === f
                  ? "border border-gilt text-gilt"
                  : "border border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar título ou autor…"
          className="flex-1 min-w-[200px] border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
        />
        {books.length > 0 && (
          <span className="text-xs text-muted-foreground">{filtered.length} obras</span>
        )}
      </div>

      {/* Grid */}
      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-56 animate-pulse border border-border bg-surface" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <BookOpen className="mx-auto mb-4 size-8 text-muted-foreground/40" strokeWidth={1} />
            <p className="text-sm text-muted-foreground">Nenhuma obra encontrada.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <div
                key={b.id}
                className="flex flex-col border border-border bg-surface transition-colors hover:border-border/80"
              >
                {b.cover ? (
                  <img
                    src={b.cover}
                    alt={b.title}
                    className="h-48 w-full object-contain bg-surface"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-surface/60">
                    <BookOpen className="size-10 text-muted-foreground/30" strokeWidth={1} />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="font-display text-lg leading-tight">{b.title}</p>
                  <p className="caption mt-1">{b.author}</p>
                  {b.description && (
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {b.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <EpubDownloadButton book={b} />
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                      Ver obra
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-10 text-xs text-muted-foreground/60">
        Obras curadas por{" "}
        <a href="https://standardebooks.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          standardebooks.org
        </a>{" "}
        · CC0 / Domínio público · Nenhum DRM
      </p>
    </div>
  );
}
