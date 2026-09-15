import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState } from "react";
import { artists, worksByArtist } from "@/lib/beyond-data";

export const Route = createFileRoute("/artists")({
  head: () => ({
    meta: [
      { title: "Autores e Artistas | The Beyond — Publicação Independente" },
      {
        name: "description",
        content:
          "Conheça os escritores, mangakistas e quadrinistas que publicam no The Beyond. Obras autorais de mangá, HQ, livro e conto com curadoria independente e sem anúncios.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Autores e Artistas | The Beyond" },
      {
        property: "og:description",
        content:
          "Escritores, mangakistas e quadrinistas independentes. Conheça quem publica no The Beyond e ganha por cada leitura.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/artists` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/artists` }],
  }),
  component: ArtistsPage,
});

const disciplines = ["Todos", ...Array.from(new Set(artists.map((a) => a.discipline)))];

function ArtistsPage() {
  const [filter, setFilter] = useState("Todos");

  const list = filter === "Todos" ? artists : artists.filter((a) => a.discipline === filter);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">O elenco</p>
      <h1 className="mt-5 max-w-2xl font-display text-5xl leading-tight tracking-tight">
        Artistas residentes
      </h1>

      {/* Filtro por disciplina */}
      <div className="mt-8 flex flex-wrap gap-2">
        {disciplines.map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`border px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
              filter === d
                ? "border-gilt text-gilt"
                : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mt-10 divide-y divide-border border-y border-border">
        {list.map((a) => (
          <Link
            key={a.slug}
            to="/artist/$slug"
            params={{ slug: a.slug }}
            className="group flex flex-col gap-4 py-8 transition-colors hover:bg-surface/60 sm:flex-row sm:items-start sm:gap-10 sm:px-4"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-border font-display text-lg text-gilt">
              {a.initials}
            </div>
            <div className="flex-1">
              <p className="eyebrow">
                {a.discipline} · {a.location}
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight group-hover:text-gilt">
                {a.name}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{a.bio}</p>
            </div>
            <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
              <p className="text-foreground">{a.supporters} apoiadores</p>
              <p className="mt-1">{worksByArtist(a.slug).length} obras</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
