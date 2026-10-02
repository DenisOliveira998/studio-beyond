import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { SITE_URL } from "@/lib/site-url";
import { MEDIUM_LABEL, VIEWS_DISPLAY_MIN, compact } from "@/lib/beyond-data";
import type { RankingData } from "@/lib/beyond-db";
import { loaderFetch } from "@/lib/loader-fetch";
import { breadcrumbJsonLd } from "@/lib/seo";
import { stripHtml } from "@/lib/utils";

type Aba = "obras" | "autores";

const EMPTY: RankingData = { since: "", works: [], authors: [] };

export const Route = createFileRoute("/ranking")({
  validateSearch: (search: Record<string, unknown>): { aba?: Aba } =>
    search["aba"] === "autores" ? { aba: "autores" } : {},
  loader: async () => ({ ranking: await loaderFetch<RankingData>("/api/ranking", EMPTY) }),
  head: () => {
    const title = "Ranking da semana: obras e autores mais lidos | The Beyond";
    const description =
      "Top 50 da semana no The Beyond: as obras e os autores mais lidos dos últimos 7 dias — livros, mangás, HQs, contos e novels autorais.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE_URL}/ranking` },
        { name: "twitter:card", content: "summary_large_image" },
        {
          "script:ld+json": breadcrumbJsonLd([
            { name: "Início", path: "/" },
            { name: "Ranking", path: "/ranking" },
          ]),
        },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/ranking` }],
    };
  },
  component: RankingPage,
});

function formatSince(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function Position({ n }: { n: number }) {
  return (
    <span
      className={`w-10 shrink-0 text-right font-display text-2xl font-bold tabular-nums tracking-tight ${
        n <= 3 ? "text-gilt" : "text-muted-foreground/50"
      }`}
    >
      {n}
    </span>
  );
}

function Reads({ week, total }: { week: number; total: number }) {
  if (week >= VIEWS_DISPLAY_MIN) return <span>{compact(week)} leituras na semana</span>;
  if (total >= VIEWS_DISPLAY_MIN) return <span>{compact(total)} leituras</span>;
  return null;
}

function RankingPage() {
  const initial = Route.useLoaderData();
  const { aba = "obras" } = Route.useSearch();
  const hasInitial = initial.ranking.works.length > 0;
  const { data = initial.ranking } = useQuery<RankingData>({
    queryKey: ["ranking"],
    queryFn: () => fetch("/api/ranking").then((r) => r.json() as Promise<RankingData>),
    staleTime: 60_000,
    // Se o servidor não trouxe dados, busca de novo no navegador
    ...(hasInitial ? { initialData: initial.ranking } : {}),
  });

  const tabCls = (active: boolean) =>
    `border px-5 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
      active ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
    }`;

  return (
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <p className="eyebrow">Top 50 · últimos 7 dias</p>
      <h1 className="hero-type mt-5 max-w-2xl text-5xl tracking-tight">Ranking da semana</h1>
      <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
        As obras e os autores mais lidos{data.since ? ` desde ${formatSince(data.since)}` : " nesta semana"}.
        Atualizado ao longo do dia.
      </p>

      <nav aria-label="Ranking" className="mt-10 flex flex-wrap gap-2">
        <Link to="/ranking" className={tabCls(aba === "obras")}>
          Obras
        </Link>
        <Link to="/ranking" search={{ aba: "autores" }} className={tabCls(aba === "autores")}>
          Autores
        </Link>
      </nav>

      {aba === "obras" ? (
        <ol className="mt-10 divide-y divide-border border-y border-border">
          {data.works.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">O ranking aparece quando houver obras publicadas.</li>
          )}
          {data.works.map((w, i) => {
            const title = stripHtml(w.title);
            return (
              <li key={w.slug}>
                <Link
                  to="/work/$slug"
                  params={{ slug: w.slug }}
                  className="group flex items-center gap-4 py-4 transition-colors hover:bg-surface/50 sm:gap-6 sm:px-3"
                >
                  <Position n={i + 1} />
                  {w.cover ? (
                    <img
                      src={w.cover}
                      alt=""
                      width={40}
                      height={60}
                      loading={i < 6 ? "eager" : "lazy"}
                      className="h-[60px] w-10 shrink-0 bg-surface object-cover"
                    />
                  ) : (
                    <span className="flex h-[60px] w-10 shrink-0 items-center justify-center border border-gilt/15 bg-surface">
                      <BookOpen className="size-4 text-gilt/30" strokeWidth={1.5} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold leading-tight group-hover:text-gilt">{title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="uppercase tracking-[0.12em]">{MEDIUM_LABEL[w.medium]}</span>
                      {w.artistName && <span>{w.artistName}</span>}
                      <Reads week={w.weekViews} total={w.totalViews} />
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="mt-10 divide-y divide-border border-y border-border">
          {data.authors.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">O ranking aparece quando houver autores publicados.</li>
          )}
          {data.authors.map((a, i) => (
            <li key={a.slug}>
              <Link
                to="/artist/$slug"
                params={{ slug: a.slug }}
                className="group flex items-center gap-4 py-4 transition-colors hover:bg-surface/50 sm:gap-6 sm:px-3"
              >
                <Position n={i + 1} />
                {a.avatarUrl ? (
                  <img
                    src={a.avatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    loading={i < 8 ? "eager" : "lazy"}
                    className="size-12 shrink-0 border border-border object-cover"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center border border-gilt/40 font-display text-sm text-gilt">
                    {a.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold leading-tight group-hover:text-gilt">{a.name}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {a.workCount} {a.workCount === 1 ? "obra" : "obras"}
                    </span>
                    {a.followers > 0 && (
                      <span>
                        {compact(a.followers)} {a.followers === 1 ? "seguidor" : "seguidores"}
                      </span>
                    )}
                    {a.topWork && <span className="truncate">Destaque: {a.topWork.title}</span>}
                    <Reads week={a.weekViews} total={a.totalViews} />
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
