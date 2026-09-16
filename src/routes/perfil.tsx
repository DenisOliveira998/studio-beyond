import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, BookMarked, Heart, Users, User, Bookmark } from "lucide-react";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import type { ReaderProfileStats } from "@/lib/beyond-db";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — The Beyond" },
      { name: "description", content: "Sua leitura no The Beyond: obras favoritas, páginas lidas e progresso." },
      { property: "og:title", content: "Meu Perfil — The Beyond" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PerfilPage,
});

async function fetchProfileStats(): Promise<ReaderProfileStats> {
  const res = await fetch("/api/profile/stats");
  if (!res.ok) throw new Error("Erro ao carregar perfil");
  return res.json() as Promise<ReaderProfileStats>;
}

function PerfilPage() {
  const { user, profile, loading } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<ReaderProfileStats>({
    queryKey: ["profile-stats"],
    queryFn: fetchProfileStats,
    enabled: !!user,
    staleTime: 60_000,
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-24 text-center sm:px-8">
        <p className="text-muted-foreground">Faça login para ver seu perfil.</p>
      </div>
    );
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const role = profile?.role ?? "reader";
  const roleLabel = ROLE_LABEL[role];

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      {/* Cabeçalho do perfil */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        <div className="flex size-20 shrink-0 items-center justify-center border border-gilt/40 font-display text-3xl text-gilt">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="eyebrow">Perfil</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
            {user.name ?? user.email}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          <span className="mt-3 inline-block border border-gilt/30 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-gilt">
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Linha separadora */}
      <div className="mt-10 h-px w-full bg-gradient-to-r from-gilt/60 via-gilt/25 to-transparent" />

      {/* Stats */}
      <section className="mt-10">
        <p className="eyebrow">Sua leitura</p>
        {statsLoading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse border border-gilt/10 bg-surface" />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Heart}
              label="Obras favoritadas"
              value={stats?.favoritedCount ?? 0}
              note="Obras que você marcou"
            />
            <StatCard
              icon={BookOpen}
              label="Páginas lidas"
              value={stats?.totalPagesRead ?? 0}
              note="Total acumulado"
            />
            <StatCard
              icon={BookMarked}
              label="Obras finalizadas"
              value={stats?.finishedCount ?? 0}
              note="Do início ao fim"
              accent
            />
            <StatCard
              icon={Users}
              label="Autores favoritos"
              value={stats?.favoriteAuthorsCount ?? 0}
              note="Por obras curtidas"
            />
          </div>
        )}
      </section>

      {/* Lista de favoritos */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <Bookmark className="size-5 text-gilt" strokeWidth={1.5} />
          <h2 className="font-display text-3xl tracking-tight">Obras favoritas</h2>
        </div>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-gilt/60 via-gilt/25 to-transparent" />

        {statsLoading ? (
          <div className="mt-8 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse border border-border bg-surface" />
            ))}
          </div>
        ) : !stats?.favorites.length ? (
          <div className="mt-10 py-16 text-center">
            <User className="mx-auto mb-4 size-8 text-muted-foreground/40" strokeWidth={1} />
            <p className="text-sm text-muted-foreground">
              Você ainda não favoritou nenhuma obra.
            </p>
            <p className="mt-2 text-xs text-muted-foreground/60">
              Clique no coração em qualquer obra para adicionar aqui.
            </p>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-border border border-border">
            {stats.favorites.map((fav) => (
              <li key={fav.id}>
                <a
                  href={`/work/${fav.workSlug}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/60"
                >
                  <Heart className="size-4 shrink-0 text-gilt" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="font-display text-lg leading-tight">{fav.workSlug}</p>
                    {fav.artistSlug && (
                      <p className="caption mt-0.5">{fav.artistSlug}</p>
                    )}
                  </div>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {new Date(fav.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Info sobre páginas lidas */}
      {(stats?.totalPagesRead ?? 0) === 0 && !statsLoading && (
        <section className="mt-16">
          <div className="border border-border bg-surface/40 px-6 py-8 text-center">
            <BookOpen className="mx-auto mb-4 size-8 text-muted-foreground/40" strokeWidth={1} />
            <p className="text-sm text-muted-foreground">
              Seu progresso de leitura aparece aqui conforme você lê as obras.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-gilt/25 bg-background p-7">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-gilt" strokeWidth={1.5} />
        <p className="eyebrow">{label}</p>
      </div>
      <p className={`mt-4 font-display text-4xl tracking-tight ${accent ? "text-gilt" : ""}`}>
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
