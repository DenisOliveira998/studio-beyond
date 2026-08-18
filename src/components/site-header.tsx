import { Link } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Feed" },
  { to: "/artists", label: "Artists" },
  { to: "/dashboard", label: "Dashboard" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl leading-none tracking-tight">The Beyond</span>
          <span className="hidden eyebrow sm:inline">Est. 2026</span>
        </Link>

        <nav className="flex items-center gap-5 text-sm text-muted-foreground sm:gap-7">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rule-hover transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/auth"
            className="border border-border px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-foreground transition-colors hover:border-gilt hover:text-gilt"
          >
            Join
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-display text-lg text-foreground">The Beyond</p>
        <p className="max-w-md text-xs leading-relaxed">
          No ads. No banners. No interruptions. Artists earn from every view and every gift; the
          platform keeps 12% to stay alive.
        </p>
      </div>
    </footer>
  );
}
