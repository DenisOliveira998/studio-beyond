import { createFileRoute, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import type { Work } from "@/lib/beyond-data";
import { loaderFetch } from "@/lib/loader-fetch";
import { breadcrumbJsonLd, workListJsonLd } from "@/lib/seo";
import { CATEGORY_SEO, ExploreView, ITEMS_PER_PAGE, isMedium, parsePagina } from "@/components/explore-view";

// /explorar/$categoria — página própria (indexável) por categoria
export const Route = createFileRoute("/explorar_/$categoria")({
  validateSearch: (search: Record<string, unknown>): { pagina?: number } =>
    parsePagina(search["pagina"]) > 1 ? { pagina: parsePagina(search["pagina"]) } : {},
  loader: async ({ params }) => {
    if (!isMedium(params.categoria)) throw notFound();
    return { medium: params.categoria, works: await loaderFetch<Work[]>("/api/works", []) };
  },
  head: ({ loaderData, params, match }) => {
    if (!loaderData) {
      return { meta: [{ title: "Categoria não encontrada | The Beyond" }, { name: "robots", content: "noindex" }] };
    }
    const seo = CATEGORY_SEO[loaderData.medium];
    // Página além da última → trata como a última existente
    const count = loaderData.works.filter((w) => w.medium === loaderData.medium).length;
    const total = Math.max(1, Math.ceil(count / ITEMS_PER_PAGE));
    const pagina = Math.min((match.search as { pagina?: number }).pagina ?? 1, total);
    const url = `${SITE_URL}/explorar/${params.categoria}${pagina > 1 ? `?pagina=${pagina}` : ""}`;
    const title = pagina > 1 ? seo.title.replace(" | The Beyond", `, página ${pagina} | The Beyond`) : seo.title;
    return {
      meta: [
        { title },
        { name: "description", content: seo.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: seo.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        {
          "script:ld+json": breadcrumbJsonLd([
            { name: "Início", path: "/" },
            { name: "Explorar", path: "/explorar" },
            { name: seo.h1, path: `/explorar/${params.categoria}` },
          ]),
        },
        {
          "script:ld+json": workListJsonLd(
            seo.h1,
            `/explorar/${params.categoria}${pagina > 1 ? `?pagina=${pagina}` : ""}`,
            loaderData.works
              .filter((w) => w.medium === loaderData.medium)
              .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
              .slice((pagina - 1) * ITEMS_PER_PAGE, pagina * ITEMS_PER_PAGE),
          ),
        },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { medium, works } = Route.useLoaderData();
  const { pagina } = Route.useSearch();
  return <ExploreView medium={medium} initialWorks={works} page={pagina ?? 1} basePath={`/explorar/${medium}`} />;
}
