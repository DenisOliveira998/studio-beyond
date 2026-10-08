import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, BookMarked, Heart, Users, User, Bookmark, UserCheck } from "lucide-react";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import type { ReaderProfileStats } from "@/lib/beyond-db";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil | Go Beyondd" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Sua leitura na Go Beyondd: obras favoritas, páginas lidas e progresso." },
      { property: "og:title", content: "Meu Perfil — Go Beyondd" },
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
  const { user, profile, loading, refresh } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  async function changePhoto(file: File) {
    setSendingPhoto(true);
    try {
      const { uploadAvatar } = await import("@/lib/avatar-upload");
      const url = await uploadAvatar(file);
      const res = await fetch("/api/profile/foto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? "Não foi possível salvar a foto.");
      await refresh();
      toast.success("Foto atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setSendingPhoto(false);
    }
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!next) {
      toast.error("O nome não pode ficar vazio.");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      setEditingName(false);
      toast.success("Nome atualizado.");
    } catch {
      toast.error("Não foi possível salvar o nome.");
    } finally {
      setSavingName(false);
    }
  }
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !profile) void navigate({ to: "/entrar" });
  }, [user, profile, loading, navigate]);

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
      <div className="px-5 py-24 text-center sm:px-10 lg:px-14">
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
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      {/* Cabeçalho do perfil */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        <div className="flex shrink-0 flex-col items-start gap-2">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Sua foto" className="size-20 rounded-full object-cover" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full border border-gilt/40 font-display text-3xl text-gilt">
              {initials}
            </div>
          )}
          <button
            type="button"
            disabled={sendingPhoto}
            onClick={() => photoRef.current?.click()}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {sendingPhoto ? "Enviando…" : profile?.avatarUrl ? "Trocar foto" : "Colocar foto"}
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void changePhoto(f);
            }}
          />
        </div>
        <div className="min-w-0">
          <p className="eyebrow">Perfil</p>
          {editingName ? (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveName();
              }}
            >
              <label className="sr-only" htmlFor="perfil-nome">Seu nome</label>
              <input
                id="perfil-nome"
                autoFocus
                maxLength={80}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-0 flex-1 border border-input bg-background px-3 py-2 font-display text-2xl outline-none focus:border-gilt"
              />
              <button type="submit" disabled={savingName} className="rounded-full bg-gilt px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">
                {savingName ? "Salvando…" : "Salvar"}
              </button>
              <button type="button" onClick={() => setEditingName(false)} className="text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
            </form>
          ) : (
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
                {profile?.name || user.name || user.email}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(profile?.name || user.name || "");
                  setEditingName(true);
                }}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Editar nome
              </button>
            </div>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {user.email} <span className="text-xs">(só você vê)</span>
          </p>
          <a href={`/leitor/${user.id}`} className="mt-1 inline-block text-xs text-gilt underline underline-offset-4">
            Ver como os outros veem meu perfil
          </a>
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
              note="Ver quais são"
              href="#favoritos"
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
              label="Seguindo"
              value={stats?.following?.length ?? 0}
              note="Ver os autores"
              href="#seguindo"
            />
          </div>
        )}
      </section>

      {/* Lista de favoritos */}
      <section id="favoritos" className="mt-16 scroll-mt-24">
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
                  href={`/obra/${fav.workSlug}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/60"
                >
                  <Heart className="size-4 shrink-0 text-gilt" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="font-display text-lg leading-tight">{fav.workTitle}</p>
                    {fav.artistName && (
                      <p className="caption mt-0.5">{fav.artistName}</p>
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

      {/* Autores que a pessoa segue */}
      <section id="seguindo" className="mt-16 scroll-mt-24">
        <div className="flex items-center gap-3">
          <UserCheck className="size-5 text-gilt" strokeWidth={1.5} />
          <h2 className="font-display text-3xl tracking-tight">Seguindo</h2>
        </div>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-gilt/60 via-gilt/25 to-transparent" />
        {statsLoading ? (
          <div className="mt-8 h-16 animate-pulse border border-border bg-surface" />
        ) : !stats?.following?.length ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Você ainda não segue nenhum autor. Na página de uma obra, use o botão Seguir ao lado do nome do autor para
            saber quando sair capítulo novo.
          </p>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.following.map((a) => (
              <li key={a.slug}>
                <a
                  href={`/autor/${a.slug}`}
                  className="flex items-center gap-3 border border-border px-4 py-3 transition-colors hover:bg-surface/60"
                >
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#5a3b5e] text-sm font-bold text-white">
                      {a.name.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg leading-tight">{a.name}</span>
                    <span className="caption block">Seguindo desde {new Date(a.since).toLocaleDateString("pt-BR")}</span>
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
  href,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  note: string;
  accent?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-gilt" strokeWidth={1.5} />
        <p className="eyebrow">{label}</p>
      </div>
      <p className={`mt-4 font-display text-4xl tracking-tight ${accent ? "text-gilt" : ""}`}>
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        {note}
        {href && <ArrowRight className="size-3.5 text-gilt transition-transform group-hover:translate-x-1" strokeWidth={1.75} />}
      </p>
    </>
  );
  if (href) {
    return (
      <a href={href} className="group block border border-gilt/25 bg-background p-7 transition-colors hover:border-gilt/60">
        {body}
      </a>
    );
  }
  return <div className="border border-gilt/25 bg-background p-7">{body}</div>;
}
