import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { money } from "@/lib/beyond-data";

export type PanelNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "Em revisão",
  approved: "Aprovada",
  rejected: "Recusada",
  changes: "Ajustes solicitados",
  draft: "Rascunho",
};

const REVIEW_BADGE: Record<string, string> = {
  pending: "border-gilt/50 bg-gilt/10 text-gilt",
  approved:
    "border-[color:var(--chart-2)]/50 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)]",
  changes: "border-border bg-muted text-muted-foreground",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
  draft: "border-border bg-muted text-muted-foreground",
};

export function ReviewBadge({ status }: { status: string }) {
  return (
    <span
      className={`btn-type inline-block border px-2 py-1 text-[0.6rem] ${
        REVIEW_BADGE[status] ?? REVIEW_BADGE["pending"]
      }`}
    >
      {REVIEW_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function PanelShell({
  eyebrow,
  title,
  nav,
  footnote,
  children,
}: {
  eyebrow: string;
  title: string;
  nav: PanelNavItem[];
  footnote: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 pt-8 pb-6">
          <p className="eyebrow">{eyebrow}</p>
          <p className="mt-2 font-display text-xl tracking-tight">{title}</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {nav.map((item) => (
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
          <p className="text-xs text-muted-foreground">{footnote}</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-12 sm:px-10 lg:px-14">
        <nav className="mb-10 flex flex-wrap gap-2 md:hidden">
          {nav.map((item) => (
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
        {children}
      </main>
    </div>
  );
}

export function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: ReactNode;
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

export function Stat({
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
      <p className={`mt-4 font-display text-4xl tracking-tight ${accent ? "text-gilt" : ""}`}>
        {value}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-4 align-middle ${className}`}>{children}</td>;
}

export function ActionButton({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-40 ${
        danger
          ? "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
          : "border-border text-muted-foreground hover:border-gilt hover:text-gilt"
      }`}
    >
      {children}
    </button>
  );
}

export function RevenueRow({
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
        <div className="h-full bg-gilt transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-right text-xs text-muted-foreground">
        {pct.toFixed(1).replace(".", ",")}%
      </p>
    </div>
  );
}

export function Ranking({
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
        {rows.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">Ainda sem dados suficientes.</p>
        )}
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
