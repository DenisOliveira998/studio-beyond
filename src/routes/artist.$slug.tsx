import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Instagram, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";
import { DonateDialog } from "@/components/donate-dialog";
import { WorkCard } from "@/components/work-card";
import { LoginPrompt } from "@/components/login-prompt";
import { VIEWS_DISPLAY_MIN, compact } from "@/lib/beyond-data";
import type { AuthorBioData, Work } from "@/lib/beyond-data";
import { useAuth } from "@/lib/auth";
import { authorProfileJsonLd, breadcrumbJsonLd, instagramUrl } from "@/lib/seo";

const EMPTY_BIO: AuthorBioData = { bio: "", avatarUrl: "", city: "", instagram: "", website: "" };

export const Route = createFileRoute("/artist/$slug")({
  loader: async ({ params }) => {
    const base = typeof window === "undefined" ? SITE_URL : "";
    const res = await fetch(`${base}/api/artists/${encodeURIComponent(params.slug)}`);
    if (res.status === 404) throw notFound();
    if (!res.ok) throw new Error("Falha ao carregar perfil do autor");
    const data = (await res.json()) as { artistName: string; artistSlug: string; works: Work[]; bio?: AuthorBioData };
    return { ...data, bio: data.bio ?? EMPTY_BIO };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Autor não encontrado — The Beyond" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { artistName, artistSlug, works, bio } = loaderData;
    const fallback = `${works.length} ${works.length === 1 ? "obra publicada" : "obras publicadas"} no The Beyond.`;
    const description = bio.bio ? bio.bio.replace(/\s+/g, " ").slice(0, 160) : fallback;
    const meta: Array<Record<string, unknown>> = [
      { title: `${artistName} — The Beyond` },
      { name: "description", content: description },
      { property: "og:title", content: `${artistName} — The Beyond` },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    const image = bio.avatarUrl || works.find((w) => w.cover)?.cover;
    if (image) {
      meta.push({ property: "og:image", content: absoluteUrl(image) });
      meta.push({ name: "twitter:image", content: absoluteUrl(image) });
    }
    meta.push({ property: "og:url", content: `${SITE_URL}/artist/${artistSlug}` });
    meta.push({
      "script:ld+json": authorProfileJsonLd({ name: artistName, slug: artistSlug, bio, worksCount: works.length }),
    });
    meta.push({
      "script:ld+json": breadcrumbJsonLd([
        { name: "Início", path: "/" },
        { name: "Autores", path: "/artists" },
        { name: artistName, path: `/artist/${artistSlug}` },
      ]),
    });
    return {
      meta,
      links: [{ rel: "canonical", href: `${SITE_URL}/artist/${artistSlug}` }],
    };
  },
  component: ArtistPage,
});

function ArtistPage() {
  const { artistName, artistSlug, works, bio } = Route.useLoaderData();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loginOpen, setLoginOpen] = useState(false);
  const totalViews = works.reduce((sum, w) => sum + w.clicks, 0);
  const firstName = artistName.split(" ")[0];
  const insta = instagramUrl(bio.instagram);

  const { data: followData } = useQuery<{ followed: boolean }>({
    queryKey: ["follow", artistSlug],
    queryFn: () =>
      fetch(`/api/artists/${artistSlug}/follow`).then((r) => r.json() as Promise<{ followed: boolean }>),
    enabled: !!user,
    staleTime: 60_000,
  });
  const followed = followData?.followed ?? false;
  const follow = useMutation({
    mutationFn: () =>
      fetch(`/api/artists/${artistSlug}/follow`, { method: "POST" }).then(
        (r) => r.json() as Promise<{ followed: boolean }>,
      ),
    onSuccess: (data) => {
      qc.setQueryData(["follow", artistSlug], data);
      toast.success(data.followed ? `Seguindo ${artistName}.` : `Você deixou de seguir ${artistName}.`);
    },
    onError: () => toast.error("Erro. Tente novamente."),
  });

  return (
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <header className="flex flex-col gap-10 border-b border-border pb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-6 sm:flex-row sm:items-start">
          {bio.avatarUrl ? (
            <img
              src={bio.avatarUrl}
              alt={artistName}
              className="size-24 shrink-0 border border-border object-cover"
            />
          ) : (
            <div className="flex size-24 shrink-0 items-center justify-center border border-gilt/40 font-display text-3xl text-gilt">
              {artistName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="eyebrow">Autor</p>
            <h1 className="mt-3 font-display text-5xl leading-tight tracking-tight sm:text-6xl">
              {artistName}
            </h1>
            {bio.bio && (
              <p className="mt-5 max-w-xl whitespace-pre-line leading-relaxed text-muted-foreground">{bio.bio}</p>
            )}
            {(bio.city || insta || bio.website) && (
              <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                {bio.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" strokeWidth={1.5} /> {bio.city}
                  </span>
                )}
                {insta && (
                  <a href={insta} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 hover:text-gilt">
                    <Instagram className="size-3.5" strokeWidth={1.5} /> Instagram
                  </a>
                )}
                {bio.website && (
                  <a href={bio.website} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 hover:text-gilt">
                    <Globe className="size-3.5" strokeWidth={1.5} /> Site
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:text-right">
          <dl className="flex gap-10 lg:justify-end">
            {totalViews >= VIEWS_DISPLAY_MIN && (
              <div>
                <dt className="eyebrow">Visualizações totais</dt>
                <dd className="mt-1 font-display text-3xl">{compact(totalViews)}</dd>
              </div>
            )}
            <div>
              <dt className="eyebrow">Obras</dt>
              <dd className="mt-1 font-display text-3xl">{works.length}</dd>
            </div>
          </dl>
          <div className="mt-7 flex flex-wrap gap-3 lg:justify-end">
            <button
              onClick={() => (user ? follow.mutate() : setLoginOpen(true))}
              disabled={follow.isPending}
              className={`border px-6 py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
                followed ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:border-gilt hover:text-gilt"
              }`}
            >
              {followed ? "✓ Seguindo" : `Seguir ${firstName}`}
            </button>
            <DonateDialog
              artistName={artistName}
              trigger={
                <button className="bg-primary px-6 py-3 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90">
                  Apoiar {artistName}
                </button>
              }
            />
          </div>
        </div>
      </header>

      <section className="pt-14">
        <h2 className="font-display text-3xl tracking-tight">Obras publicadas</h2>
        <div className="mt-10 grid gap-14 sm:grid-cols-2">
          {works.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      </section>

      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} redirectTo={`/artist/${artistSlug}`} />
    </div>
  );
}
