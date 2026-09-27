import { createFileRoute, notFound } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import type { Work } from "@/lib/beyond-data";
import { loaderFetch } from "@/lib/loader-fetch";
import { breadcrumbJsonLd } from "@/lib/seo";
import { CATEGORY_SEO, ExploreView, isMedium } from "@/components/explore-view";

// /explorar/$categoria — página própria (indexável) por categoria
export const Route = createFileRoute("/explorar_/$categoria")({
  loader: async ({ params }) => {
    if (!isMedium(params.categoria)) throw notFound();
    return { medium: params.categoria, works: await loaderFetch<Work[]>("/api/works", []) };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Categoria não encontrada — The Beyond" }, { name: "robots", content: "noindex" }] };
    }
    const seo = CATEGORY_SEO[loaderData.medium];
    const url = `${SITE_URL}/explorar/${params.categoria}`;
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: seo.title },
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
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { medium, works } = Route.useLoaderData();
  return <ExploreView medium={medium} initialWorks={works} />;
}
