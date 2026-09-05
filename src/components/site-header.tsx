import { Link } from "@tanstack/react-router";
import { Instagram, Youtube } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { SiteSearch } from "@/components/site-search";

const nav = [
  { to: "/", label: "Feed" },
  { to: "/artists", label: "Artistas" },
  { to: "/dashboard", label: "Painel do autor" },
  { to: "/admin", label: "Administração" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone/60 bg-ink text-chalk">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="hero-type text-2xl leading-none text-white">
            The <span className="text-gilt">Beyond</span>
          </span>
          <span className="hidden eyebrow sm:inline">desde 2026</span>
        </Link>

        <nav className="flex items-center gap-5 text-sm text-white/85 sm:gap-7">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rule-hover hidden transition-colors hover:text-gilt lg:inline"
              activeProps={{ className: "text-gilt" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
          <SiteSearch />
          <Link
            to="/auth"
            className="btn-type border border-white/40 px-3 py-1.5 text-xs text-white transition-colors hover:border-gilt hover:text-gilt"
          >
            Entrar
          </Link>
          <LanguageSelector />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

const navLinks = [
  { to: "/", label: "Feed" },
  { to: "/artists", label: "Artistas" },
  { to: "/explorar", label: "Explorar categorias" },
  { to: "/sobre", label: "Sobre o projeto" },
] as const;

const accountLinks = [
  { to: "/auth", label: "Criar conta como Leitor" },
  { to: "/planos", label: "Planos de assinatura" },
  { to: "/candidatura-autor", label: "Candidatura de Autor" },
  { to: "/auth", label: "Entrar" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-surface/40">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-2xl tracking-tight text-foreground">The Beyond</p>
          <p className="title-italic mt-4 max-w-xs text-lg leading-snug text-muted-foreground">
            Um espaço silencioso para obras que merecem ser olhadas por mais tempo.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <a
              href="https://instagram.com"
              aria-label="Instagram"
              className="text-muted-foreground transition-colors hover:text-gilt"
            >
              <Instagram className="size-4" strokeWidth={1.5} />
            </a>
            <a
              href="https://youtube.com"
              aria-label="YouTube"
              className="text-muted-foreground transition-colors hover:text-gilt"
            >
              <Youtube className="size-4" strokeWidth={1.5} />
            </a>
          </div>
        </div>

        <FooterColumn title="Navegação">
          {navLinks.map((l) => (
            <li key={l.label}>
              <Link to={l.to} className="rule-hover transition-colors hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Contas">
          {accountLinks.map((l) => (
            <li key={l.label}>
              <Link to={l.to} className="rule-hover transition-colors hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Contato">
          <li>Rua das Artes, 142 — Lisboa, Portugal</li>
          <li>
            <a href="tel:+351910000000" className="transition-colors hover:text-foreground">
              +351 910 000 000
            </a>
          </li>
          <li>
            <a
              href="mailto:contato@thebeyond.art"
              className="transition-colors hover:text-foreground"
            >
              contato@thebeyond.art
            </a>
          </li>
        </FooterColumn>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="caption">© 2026 The Beyond. Sem anúncios, sem interrupções.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacidade" className="caption transition-colors hover:text-foreground">
              Privacidade
            </Link>
            <Link to="/termos" className="caption transition-colors hover:text-foreground">
              Termos de uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-5 space-y-3 text-sm font-light text-muted-foreground">{children}</ul>
    </div>
  );
}
