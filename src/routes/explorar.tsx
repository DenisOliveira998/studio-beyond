import { createFileRoute, redirect } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import type { Work } from "@/lib/beyond-data";
import { loaderFetch } from "@/lib/loader-fetch";
import { ExploreView, isMedium } from "@/components/explore-view";

export const Route = createFileRoute("/explorar")({
  // Links antigos /explorar?m=manga → /explorar/manga
  validateSearch: (search: Record<string, unknown>): { m?: string } =>
    typeof search["m"] === "string" ? { m: search["m"] } : {},
  beforeLoad: ({ search }) => {
    if (search.m && isMedium(search.m)) {
      throw redirect({ to: "/explorar/$categoria", params: { categoria: search.m }, statusCode: 301 });
    }
  },
  loader: async () => ({ works: await loaderFetch<Work[]>("/api/works", []) }),
  head: () => ({
    meta: [
      { title: "Explorar Categorias | The Beyond — Livros, Mangás, HQs e Contos" },
      {
        name: "description",
        content:
          "Explore livros, mangás, HQs e contos autorais por categoria. Descubra obras independentes selecionadas pela curadoria do The Beyond — sem anúncios e sem pressa.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Explorar | The Beyond — Livros, Mangás, HQs e Contos" },
      {
        property: "og:description",
        content: "Livros, mangás, HQs e contos autorais brasileiros — explore por categoria no The Beyond.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/explorar` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/explorar` }],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const { works } = Route.useLoaderData();
  return <ExploreView initialWorks={works} />;
}
