import { createFileRoute, redirect } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import type { Work } from "@/lib/beyond-data";
import { loaderFetch } from "@/lib/loader-fetch";
import { ExploreView, ITEMS_PER_PAGE, isMedium, parsePagina } from "@/components/explore-view";

export const Route = createFileRoute("/explorar")({
  // Links antigos /explorar?m=manga → /explorar/manga; ?pagina=N para a paginação
  validateSearch: (search: Record<string, unknown>): { m?: string; pagina?: number } => ({
    ...(typeof search["m"] === "string" ? { m: search["m"] } : {}),
    ...(parsePagina(search["pagina"]) > 1 ? { pagina: parsePagina(search["pagina"]) } : {}),
  }),
  beforeLoad: ({ search }) => {
    if (search.m && isMedium(search.m)) {
      throw redirect({ to: "/explorar/$categoria", params: { categoria: search.m }, statusCode: 301 });
    }
  },
  loader: async () => ({ works: await loaderFetch<Work[]>("/api/works", []) }),
  head: ({ match, loaderData }) => {
    // Página além da última → trata como a última existente
    const total = Math.max(1, Math.ceil((loaderData?.works.length ?? 0) / ITEMS_PER_PAGE));
    const pagina = Math.min((match.search as { pagina?: number }).pagina ?? 1, total);
    const url = `${SITE_URL}/explorar${pagina > 1 ? `?pagina=${pagina}` : ""}`;
    const title = `Explorar livros, mangás, HQs e contos${pagina > 1 ? ` — página ${pagina}` : ""} | The Beyond`;
    const description =
      "Explore livros, mangás, HQs e contos autorais brasileiros por categoria. Obras selecionadas pela curadoria do The Beyond, sem anúncios.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ExplorePage,
});

function ExplorePage() {
  const { works } = Route.useLoaderData();
  const { pagina } = Route.useSearch();
  return <ExploreView initialWorks={works} page={pagina ?? 1} basePath="/explorar" />;
}
