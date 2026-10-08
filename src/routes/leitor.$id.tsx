import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Heart, UserCheck } from "lucide-react";
import { MEDIUM_LABEL } from "@/lib/beyond-data";
import { SITE_URL } from "@/lib/site-url";

/** Perfil público de quem comenta: nome, foto, selo, data de entrada, favoritos e autores seguidos. Nada de e-mail. */
export type PublicProfile = {
  name: string;
  avatarUrl: string;
  badge: string;
  since: string;
  artistSlug: string | null;
  comments: number;
  following: { slug: string; name: string; avatarUrl: string }[];
  favorites: { slug: string; title: string; artistName: string; cover: string; medium: string }[];
};

export const Route = createFileRoute("/leitor/$id")({
  loader: async ({ params }) => {
    const base = typeof window === "undefined" ? SITE_URL : "";
    const res = await fetch(`${base}/api/leitor/${encodeURIComponent(params.id)}`);
    if (res.status === 404) throw notFound();
    if (!res.ok) throw new Error("Falha ao carregar o perfil");
    return (await res.json()) as PublicProfile;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} | Go Beyondd` : "Perfil não encontrado | Go Beyondd" },
      // Perfil de leitor não entra no Google
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicProfilePage,
  notFoundComponent: () => (
    <div className="px-5 py-24 text-center">
      <p className="font-display text-3xl">Perfil não encontrado</p>
      <Link to="/" className="mt-6 inline-block text-sm text-gilt underline underline-offset-4">
        Voltar ao início
      </Link>
    </div>
  ),
});

function initialsOf(name: string) {
  const words = name.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0] ?? "").join("") : (words[0] ?? "?");
  return raw.slice(0, 2).toUpperCase();
}

function PublicProfilePage() {
  const p = Route.useLoaderData();
  return (
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        {p.avatarUrl ? (
          <img src={p.avatarUrl} alt={`Foto de ${p.name}`} className="size-24 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-full border border-gilt/40 font-display text-3xl text-gilt">
            {initialsOf(p.name)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{p.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="border border-gilt/40 px-2 py-0.5 text-xs text-gilt">{p.badge}</span>
            <span>Na Go Beyondd desde {new Date(p.since).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
            {p.comments > 0 && <span>{p.comments === 1 ? "1 comentário" : `${p.comments} comentários`}</span>}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a href="#favoritos" className="group inline-flex items-center gap-1.5 hover:text-gilt">
              <strong>{p.favorites.length}</strong> {p.favorites.length === 1 ? "favorito" : "favoritos"}
              <ArrowRight className="size-3.5 text-gilt transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
            </a>
            <a href="#seguindo" className="group inline-flex items-center gap-1.5 hover:text-gilt">
              Seguindo <strong>{p.following.length}</strong> {p.following.length === 1 ? "autor" : "autores"}
              <ArrowRight className="size-3.5 text-gilt transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
            </a>
          </p>
          {p.artistSlug && (
            <Link
              to="/autor/$slug"
              params={{ slug: p.artistSlug }}
              className="mt-4 inline-block rounded-full bg-gilt px-5 py-2 text-sm font-bold text-ink"
            >
              Ver obras de {p.name}
            </Link>
          )}
        </div>
      </div>

      <section id="favoritos" className="mt-14 scroll-mt-24">
        <div className="flex items-center gap-3">
          <Heart className="size-5 text-gilt" strokeWidth={1.5} />
          <h2 className="font-display text-2xl tracking-tight">Favoritos</h2>
        </div>
        {p.favorites.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Ainda não favoritou nenhuma obra.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {p.favorites.map((w) => (
              <li key={w.slug}>
                <Link to="/obra/$slug" params={{ slug: w.slug }} className="group block">
                  <div className="aspect-[3/4] overflow-hidden rounded-md bg-surface">
                    {w.cover ? (
                      <img src={w.cover} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        {MEDIUM_LABEL[w.medium as keyof typeof MEDIUM_LABEL] ?? ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-snug group-hover:text-gilt">{w.title}</p>
                  <p className="caption truncate">{w.artistName}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="seguindo" className="mt-14 scroll-mt-24">
        <div className="flex items-center gap-3">
          <UserCheck className="size-5 text-gilt" strokeWidth={1.5} />
          <h2 className="font-display text-2xl tracking-tight">Seguindo</h2>
        </div>
        {p.following.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Ainda não segue nenhum autor.</p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {p.following.map((a) => (
              <li key={a.slug}>
                <Link
                  to="/autor/$slug"
                  params={{ slug: a.slug }}
                  className="flex items-center gap-3 border border-border px-4 py-3 transition-colors hover:bg-surface/60"
                >
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#5a3b5e] text-sm font-bold text-white">
                      {initialsOf(a.name)}
                    </span>
                  )}
                  <span className="min-w-0 truncate font-display text-lg">{a.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
