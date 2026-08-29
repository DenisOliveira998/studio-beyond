import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ACCOUNT_LABEL,
  PLATFORM_FEE,
  RATE_PER_CLICK,
  accounts as seedAccounts,
  compact,
  getArtist,
  money,
  works,
  workDonations,
  type Account,
  type AccountType,
} from "@/lib/beyond-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — The Beyond" },
      {
        name: "description",
        content:
          "Rankings de obras por cliques e doações, controle de contas por tipo e visão geral da receita da plataforma.",
      },
      { property: "og:title", content: "Painel administrativo — The Beyond" },
      {
        property: "og:description",
        content: "Receita total, obras mais populares e gerenciamento de contas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const FILTERS: Array<{ value: AccountType | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "free", label: "Gratuito" },
  { value: "vip", label: "VIP" },
  { value: "author", label: "Autor" },
  { value: "admin", label: "Administrador" },
];

const LADDER: AccountType[] = ["free", "vip", "author", "admin"];

function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>(seedAccounts);
  const [filter, setFilter] = useState<AccountType | "all">("all");

  const byClicks = useMemo(() => [...works].sort((a, b) => b.clicks - a.clicks), []);
  const byDonations = useMemo(
    () => [...works].sort((a, b) => workDonations(b.slug) - workDonations(a.slug)),
    [],
  );

  const clickGross = works.reduce((s, w) => s + w.clicks * RATE_PER_CLICK, 0);
  const donationGross = works.reduce((s, w) => s + workDonations(w.slug), 0);
  const gross = clickGross + donationGross;
  const platformCut = gross * PLATFORM_FEE;

  const visible = filter === "all" ? accounts : accounts.filter((a) => a.type === filter);

  function change(id: string, direction: 1 | -1) {
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const idx = Math.min(LADDER.length - 1, Math.max(0, LADDER.indexOf(a.type) + direction));
        const next = LADDER[idx] as AccountType;
        if (next !== a.type) {
          toast.success(`${a.name} agora é ${ACCOUNT_LABEL[next]}.`);
        }
        return { ...a, type: next };
      }),
    );
  }

  function toggleSuspend(id: string) {
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        toast.success(a.suspended ? `${a.name} reativado.` : `${a.name} suspenso.`);
        return { ...a, suspended: !a.suspended };
      }),
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">Painel administrativo · Agosto 2026</p>
      <h1 className="mt-5 font-display text-5xl leading-tight tracking-tight">
        Visão geral da plataforma
      </h1>

      <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Receita bruta" value={money(gross)} note="Cliques + doações" />
        <Stat label="Receita por cliques" value={money(clickGross)} note={`${compact(works.reduce((s, w) => s + w.clicks, 0))} visualizações`} />
        <Stat label="Doações recebidas" value={money(donationGross)} note="Todos os artistas" />
        <Stat label="Retido pela plataforma" value={money(platformCut)} note="12% de tudo" accent />
      </div>

      <div className="mt-16 grid gap-16 lg:grid-cols-2">
        <Ranking
          title="📊 Obras mais populares"
          note="Ordenado por cliques/visualizações"
          rows={byClicks.map((w) => ({
            slug: w.slug,
            title: w.title,
            artist: getArtist(w.artistSlug)?.name ?? "",
            metric: `${compact(w.clicks)} cliques`,
          }))}
        />
        <Ranking
          title="💰 Obras mais apoiadas"
          note="Ordenado por doações recebidas"
          rows={byDonations.map((w) => ({
            slug: w.slug,
            title: w.title,
            artist: getArtist(w.artistSlug)?.name ?? "",
            metric: money(workDonations(w.slug)),
          }))}
        />
      </div>

      <section className="mt-20">
        <h2 className="font-display text-3xl tracking-tight">👥 Controle de contas</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
                filter === f.value
                  ? "border-gilt text-gilt"
                  : "border-border text-muted-foreground hover:border-gilt-soft hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-8 divide-y divide-border border-y border-border">
          {visible.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {a.name}
                  {a.suspended && (
                    <span className="ml-2 text-xs uppercase tracking-[0.18em] text-destructive">
                      suspenso
                    </span>
                  )}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {a.email} · desde {a.joined} · doou {money(a.donated)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="border border-border px-2 py-1 text-xs uppercase tracking-[0.14em] text-gilt">
                  {ACCOUNT_LABEL[a.type]}
                </span>
                <button
                  onClick={() => change(a.id, 1)}
                  className="border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                >
                  Promover
                </button>
                <button
                  onClick={() => change(a.id, -1)}
                  className="border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                >
                  Rebaixar
                </button>
                <button
                  onClick={() => toggleSuspend(a.id)}
                  className="border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                >
                  {a.suspended ? "Reativar" : "Suspender"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Dados mockados: alterações valem apenas nesta sessão.
        </p>
      </section>
    </div>
  );
}

function Ranking({
  title,
  note,
  rows,
}: {
  title: string;
  note: string;
  rows: Array<{ slug: string; title: string; artist: string; metric: string }>;
}) {
  return (
    <section>
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {rows.map((r, i) => (
          <div key={r.slug} className="flex items-baseline justify-between gap-6 py-4">
            <div className="flex min-w-0 items-baseline gap-4">
              <span className="font-display text-lg text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <Link
                  to="/work/$slug"
                  params={{ slug: r.slug }}
                  className="rule-hover font-display text-xl"
                >
                  {r.title}
                </Link>
                <p className="mt-1 truncate text-xs text-muted-foreground">{r.artist}</p>
              </div>
            </div>
            <p className="shrink-0 text-sm text-gilt">{r.metric}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-background p-6">
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 font-display text-4xl tracking-tight ${accent ? "text-gilt" : ""}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
