import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileClock,
  LayoutDashboard,
  Trophy,
  Users,
} from "lucide-react";
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
  MEDIUM_LABEL,
  REVIEW_LABEL,
  authorApplications as seedApplications,
  workSubmissions as seedSubmissions,
  type Account,
  type AccountType,
  type AuthorApplication,
  type ReviewStatus,
  type WorkSubmission,
} from "@/lib/beyond-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — The Beyond" },
      {
        name: "description",
        content:
          "Painel administrativo: visão geral da receita, rankings de obras e gestão de contas da plataforma.",
      },
      { property: "og:title", content: "Administração — The Beyond" },
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

const NAV = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "candidaturas", label: "Candidaturas", icon: ClipboardList },
  { id: "obras-revisao", label: "Obras em revisão", icon: FileClock },
  { id: "contas", label: "Gestão de Contas", icon: Users },
  { id: "receita", label: "Receita", icon: CircleDollarSign },
];

const TYPE_BADGE: Record<AccountType, string> = {
  free: "border-border bg-muted text-muted-foreground",
  vip: "border-gilt/50 bg-gilt/10 text-gilt",
  author: "border-[color:var(--chart-2)]/50 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)]",
  admin: "border-destructive/50 bg-destructive/10 text-destructive",
};

function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>(seedAccounts);
  const [filter, setFilter] = useState<AccountType | "all">("all");
  const [applications, setApplications] = useState<AuthorApplication[]>(seedApplications);
  const [submissions, setSubmissions] = useState<WorkSubmission[]>(seedSubmissions);

  function decideApplication(id: string, status: ReviewStatus) {
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        toast.success(
          status === "approved"
            ? `${a.artistName} aprovado — e-mail de acesso ao Painel do Autor enviado.`
            : `${a.artistName} recusado — mensagem da curadoria enviada.`,
        );
        return { ...a, status };
      }),
    );
  }

  function decideSubmission(id: string, status: ReviewStatus) {
    setSubmissions((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        toast.success(
          status === "approved"
            ? `“${w.title}” aprovada e publicada no feed.`
            : status === "changes"
              ? `Ajustes solicitados ao autor de “${w.title}”.`
              : `“${w.title}” recusada com comentário do curador.`,
        );
        return { ...w, status };
      }),
    );
  }

  const pendingApplications = applications.filter((a) => a.status === "pending").length;
  const pendingSubmissions = submissions.filter((w) => w.status === "pending").length;

  const byClicks = useMemo(
    () => [...works].sort((a, b) => b.clicks - a.clicks).slice(0, 5),
    [],
  );
  const byDonations = useMemo(
    () =>
      [...works]
        .sort((a, b) => workDonations(b.slug) - workDonations(a.slug))
        .slice(0, 5),
    [],
  );

  const clickGross = works.reduce((s, w) => s + w.clicks * RATE_PER_CLICK, 0);
  const donationGross = works.reduce((s, w) => s + workDonations(w.slug), 0);
  const gross = clickGross + donationGross;
  const platformCut = gross * PLATFORM_FEE;
  const totalClicks = works.reduce((s, w) => s + w.clicks, 0);

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
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar fixa */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 pt-8 pb-6">
          <p className="eyebrow">Administração</p>
          <p className="mt-2 font-display text-xl tracking-tight">The Beyond</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <item.icon className="size-4 text-gilt" strokeWidth={1.5} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto px-6 pb-8">
          <p className="text-xs text-muted-foreground">Agosto 2026 · dados mockados</p>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="min-w-0 flex-1 px-5 py-12 sm:px-10 lg:px-14">
        {/* Navegação mobile */}
        <nav className="mb-10 flex flex-wrap gap-2 md:hidden">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-2 border border-border px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              <item.icon className="size-3.5 text-gilt" strokeWidth={1.5} />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Visão Geral */}
        <section id="visao-geral" className="scroll-mt-24">
          <SectionTitle icon={LayoutDashboard}>Visão Geral</SectionTitle>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Receita Bruta" value={money(gross)} note="Cliques + doações" />
            <Stat
              label="Receita por Cliques"
              value={money(clickGross)}
              note={`${compact(totalClicks)} visualizações`}
            />
            <Stat label="Doações Recebidas" value={money(donationGross)} note="Todos os artistas" />
            <Stat
              label="Retido pela Plataforma"
              value={money(platformCut)}
              note="12% de tudo"
              accent
            />
          </div>
        </section>

        {/* Rankings */}
        <section id="rankings" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Trophy}>Rankings</SectionTitle>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Ranking
              title="🏆 Obras mais populares"
              note="Top 5 por cliques/visualizações"
              rows={byClicks.map((w) => ({
                slug: w.slug,
                title: w.title,
                artist: getArtist(w.artistSlug)?.name ?? "",
                metric: `${compact(w.clicks)} cliques`,
              }))}
            />
            <Ranking
              title="💰 Obras mais apoiadas"
              note="Top 5 por doações recebidas"
              rows={byDonations.map((w) => ({
                slug: w.slug,
                title: w.title,
                artist: getArtist(w.artistSlug)?.name ?? "",
                metric: money(workDonations(w.slug)),
              }))}
            />
          </div>
        </section>

        {/* Candidaturas */}
        <section id="candidaturas" className="mt-16 scroll-mt-24">
          <SectionTitle icon={ClipboardList}>Candidaturas</SectionTitle>
          <p className="caption mt-4">
            {pendingApplications} candidatura(s) pendente(s) · fila por data de envio
          </p>

          <div className="mt-6 space-y-4">
            {[...applications]
              .sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1))
              .map((a) => (
                <article key={a.id} className="border border-border bg-surface p-6 sm:p-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="eyebrow">
                        {a.field} · enviada em {a.submitted}
                      </p>
                      <h3 className="mt-2 font-display text-2xl tracking-tight">{a.artistName}</h3>
                      <p className="caption mt-1">{a.email}</p>
                    </div>
                    <ReviewBadge status={a.status} />
                  </div>

                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {a.bio}
                  </p>
                  {a.message && (
                    <p className="title-italic mt-3 max-w-2xl text-base text-muted-foreground">
                      “{a.message}”
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <a
                      href={a.portfolio}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-type inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                    >
                      <Eye className="size-3.5" strokeWidth={1.5} /> Ver portfólio
                    </a>
                    <span className="caption">{a.samples} obra(s) enviada(s)</span>
                    {a.status === "pending" && (
                      <div className="ml-auto flex flex-wrap gap-2">
                        <ActionButton onClick={() => decideApplication(a.id, "approved")}>
                          Aprovar
                        </ActionButton>
                        <ActionButton danger onClick={() => decideApplication(a.id, "rejected")}>
                          Recusar com mensagem
                        </ActionButton>
                      </div>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </section>

        {/* Obras em revisão */}
        <section id="obras-revisao" className="mt-16 scroll-mt-24">
          <SectionTitle icon={FileClock}>Obras em revisão</SectionTitle>
          <p className="caption mt-4">
            {pendingSubmissions} obra(s) aguardando revisão · a obra só aparece nas Obras após
            aprovação
          </p>

          <div className="mt-6 overflow-x-auto border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th>Obra</Th>
                  <Th>Autor</Th>
                  <Th>Enviada em</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((w) => (
                  <tr key={w.id} className="transition-colors hover:bg-surface/60">
                    <Td>
                      <p className="font-display text-lg leading-tight">{w.title}</p>
                      <p className="caption mt-0.5">{MEDIUM_LABEL[w.medium]}</p>
                      {w.note && <p className="caption mt-1">Nota: {w.note}</p>}
                    </Td>
                    <Td className="text-muted-foreground">
                      {getArtist(w.artistSlug)?.name ?? "—"}
                    </Td>
                    <Td className="text-muted-foreground">{w.submitted}</Td>
                    <Td>
                      <ReviewBadge status={w.status} />
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <ActionButton onClick={() => decideSubmission(w.id, "approved")}>
                          Aprovar
                        </ActionButton>
                        <ActionButton onClick={() => decideSubmission(w.id, "changes")}>
                          Solicitar ajuste
                        </ActionButton>
                        <ActionButton danger onClick={() => decideSubmission(w.id, "rejected")}>
                          Recusar
                        </ActionButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Gestão de Contas */}
        <section id="contas" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Users}>Gestão de Contas</SectionTitle>

          <div className="mt-8 flex flex-wrap gap-2">
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

          <div className="mt-6 overflow-x-auto border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Tipo de conta</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-surface/60">
                    <Td>
                      <p className="font-medium">{a.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        desde {a.joined} · doou {money(a.donated)}
                      </p>
                    </Td>
                    <Td className="text-muted-foreground">{a.email}</Td>
                    <Td>
                      <span
                        className={`inline-block border px-2 py-1 text-xs uppercase tracking-[0.14em] ${TYPE_BADGE[a.type]}`}
                      >
                        {ACCOUNT_LABEL[a.type]}
                      </span>
                    </Td>
                    <Td>
                      {a.suspended ? (
                        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-destructive">
                          <Ban className="size-3.5" /> Suspenso
                        </span>
                      ) : (
                        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          Ativo
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <ActionButton onClick={() => change(a.id, 1)}>
                          <ArrowUp className="size-3.5" /> Promover
                        </ActionButton>
                        <ActionButton onClick={() => change(a.id, -1)}>
                          <ArrowDown className="size-3.5" /> Rebaixar
                        </ActionButton>
                        <ActionButton danger onClick={() => toggleSuspend(a.id)}>
                          <Ban className="size-3.5" />
                          {a.suspended ? "Reativar" : "Suspender"}
                        </ActionButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Dados mockados: alterações valem apenas nesta sessão.
          </p>
        </section>

        {/* Receita */}
        <section id="receita" className="mt-16 scroll-mt-24">
          <SectionTitle icon={CircleDollarSign}>Receita</SectionTitle>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="border border-gilt/25 bg-background p-8">
              <p className="eyebrow">Composição da receita</p>
              <div className="mt-6 space-y-5">
                <RevenueRow
                  label="Cliques / visualizações"
                  value={clickGross}
                  total={gross}
                />
                <RevenueRow label="Doações diretas" value={donationGross} total={gross} />
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Receita bruta total</p>
                  <p className="font-display text-2xl tracking-tight">{money(gross)}</p>
                </div>
              </div>
            </div>
            <div className="border border-gilt/25 bg-background p-8">
              <p className="eyebrow">Divisão da plataforma</p>
              <div className="mt-6 space-y-5">
                <RevenueRow
                  label={`Retido pela plataforma (${Math.round(PLATFORM_FEE * 100)}%)`}
                  value={platformCut}
                  total={gross}
                />
                <RevenueRow
                  label="Repasse aos artistas"
                  value={gross - platformCut}
                  total={gross}
                />
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Taxa por clique</p>
                  <p className="font-display text-2xl tracking-tight text-gilt">
                    {money(RATE_PER_CLICK)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const REVIEW_BADGE: Record<ReviewStatus, string> = {
  pending: "border-gilt/50 bg-gilt/10 text-gilt",
  approved: "border-[color:var(--chart-2)]/50 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)]",
  changes: "border-border bg-muted text-muted-foreground",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
};

function ReviewBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`btn-type inline-block border px-2 py-1 text-[0.6rem] ${REVIEW_BADGE[status]}`}
    >
      {REVIEW_LABEL[status]}
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-gilt" strokeWidth={1.5} />
        <h2 className="font-display text-3xl tracking-tight">{children}</h2>
      </div>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-gilt/60 via-gilt/25 to-transparent" />
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-4 align-middle ${className}`}>{children}</td>;
}

function ActionButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs transition-colors ${
        danger
          ? "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
          : "border-border text-muted-foreground hover:border-gilt hover:text-gilt"
      }`}
    >
      {children}
    </button>
  );
}

function RevenueRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-xl tracking-tight">{money(value)}</p>
      </div>
      <div className="mt-2 h-1 w-full bg-muted">
        <div
          className="h-full bg-gilt transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-xs text-muted-foreground">
        {pct.toFixed(1).replace(".", ",")}%
      </p>
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
    <div className="border border-gilt/25 bg-background p-8">
      <h3 className="font-display text-2xl tracking-tight">{title}</h3>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {rows.map((r, i) => (
          <div key={r.slug} className="flex items-baseline justify-between gap-6 py-4">
            <div className="flex min-w-0 items-baseline gap-4">
              <span className="font-display text-lg text-gilt">
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
    </div>
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
    <div className="border border-gilt/25 bg-background p-7">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-4 font-display text-4xl tracking-tight ${accent ? "text-gilt" : ""}`}
      >
        {value}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

