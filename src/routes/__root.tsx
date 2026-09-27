import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { ErrorScreen, NotFoundScreen } from "@/components/error-screens";
import { DEFAULT_OG_IMAGE, siteUrl } from "@/lib/site-url";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

function NotFoundComponent() {
  return <NotFoundScreen />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <ErrorScreen
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "The Beyond — Leia Livros, Mangás, HQs e Contos Autorais" },
      {
        name: "description",
        content:
          "Descubra livros, mangás, HQs e contos autorais brasileiros. O The Beyond paga autores por visualização e permite apoio direto. Sem anúncios, sem interrupções.",
      },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "The Beyond" },
      { property: "og:site_name", content: "The Beyond" },
      { property: "og:title", content: "The Beyond — Livros, Mangás, HQs e Contos Autorais" },
      {
        property: "og:description",
        content:
          "Plataforma de publicação independente: livros, mangás, HQs e contos autorais com curadoria humana e zero anúncios.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "The Beyond — Livros, Mangás, HQs e Contos Autorais" },
      {
        name: "twitter:description",
        content: "Plataforma de publicação independente sem anúncios. 88% da receita vai para quem cria.",
      },
      { property: "og:image", content: siteUrl(DEFAULT_OG_IMAGE) },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: siteUrl(DEFAULT_OG_IMAGE) },
      { "script:ld+json": organizationJsonLd() },
      { "script:ld+json": websiteJsonLd() },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
            </main>
            <SiteFooter />
          </div>
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
