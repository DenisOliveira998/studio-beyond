import { Link } from "@tanstack/react-router";
import { Instagram, Youtube } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { SiteSearch } from "@/components/site-search";
import type { SiteConfigData } from "@/lib/beyond-db";

async function fetchSiteConfig(): Promise<SiteConfigData> {
  const res = await fetch("/api/site-config");
  if (!res.ok) throw new Error("Erro ao buscar configurações");
  return res.json() as Promise<SiteConfigData>;
}

const DEFAULT_CONFIG: SiteConfigData = {
  instagram: "https://instagram.com/thebeyond.art",
  youtube: "https://youtube.com/@thebeyond",
  email: "contato@thebeyond.art",
  phone: "(11) 99999-9999",
  address: "Rua das Artes, 142 — São Paulo, SP",
  cnpj: "00.000.000/0001-00",
};

const nav = [
  { to: "/", label: "Obras" },
  { to: "/artists", label: "Artistas" },
  { to: "/explorar", label: "Explorar" },
  { to: "/sobre", label: "Quem somos" },
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
  { to: "/", label: "Obras" },
  { to: "/artists", label: "Artistas" },
  { to: "/explorar", label: "Explorar categorias" },
  { to: "/sobre", label: "Quem somos" },
  { to: "/contato", label: "Contato" },
] as const;

const accountLinks = [
  { to: "/auth", label: "Entrar" },
  { to: "/planos", label: "Planos de assinatura" },
  { to: "/candidatura-autor", label: "Candidatura de Autor" },
] as const;

const legalLinks = [
  { to: "/termos", label: "Termos de uso" },
  { to: "/privacidade", label: "Privacidade" },
] as const;

export function SiteFooter() {
  const { data: cfg = DEFAULT_CONFIG } = useQuery({
    queryKey: ["site-config"],
    queryFn: fetchSiteConfig,
    staleTime: 5 * 60 * 1000,
  });

  const igHandle = cfg.instagram
    ? cfg.instagram.replace(/.*instagram\.com\//i, "").replace(/\/$/, "")
    : "thebeyond.art";

  return (
    <footer className="mt-24 border-t border-border/70 bg-surface/40">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:py-20 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        {/* Identidade */}
        <div>
          <p className="hero-type text-2xl text-foreground">The <span className="text-gilt">Beyond</span></p>
          <p className="title-italic mt-4 max-w-xs text-lg leading-snug text-muted-foreground">
            Um espaço para obras que merecem ser lidas com calma.
          </p>
          <div className="mt-6 flex items-center gap-4">
            {cfg.instagram && (
              <a
                href={cfg.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="text-muted-foreground transition-colors hover:text-gilt"
              >
                <Instagram className="size-4" strokeWidth={1.5} />
              </a>
            )}
            {cfg.youtube && (
              <a
                href={cfg.youtube}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="text-muted-foreground transition-colors hover:text-gilt"
              >
                <Youtube className="size-4" strokeWidth={1.5} />
              </a>
            )}
          </div>
        </div>

        {/* Navegação */}
        <FooterColumn title="Navegação">
          {navLinks.map((l) => (
            <li key={l.label}>
              <Link to={l.to} className="rule-hover transition-colors hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        {/* Acesso */}
        <FooterColumn title="Acesso">
          {accountLinks.map((l) => (
            <li key={l.label}>
              <Link to={l.to} className="rule-hover transition-colors hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
          {legalLinks.map((l) => (
            <li key={l.label}>
              <Link to={l.to} className="rule-hover transition-colors hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        {/* Contato */}
        <FooterColumn title="Contato">
          {cfg.instagram && (
            <li>
              <a
                href={cfg.instagram}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground"
              >
                @{igHandle}
              </a>
            </li>
          )}
          {cfg.email && (
            <li>
              <a href={`mailto:${cfg.email}`} className="transition-colors hover:text-foreground">
                {cfg.email}
              </a>
            </li>
          )}
          {cfg.phone && (
            <li>
              <a
                href={`tel:${cfg.phone.replace(/\D/g, "")}`}
                className="transition-colors hover:text-foreground"
              >
                {cfg.phone}
              </a>
            </li>
          )}
          {cfg.address && <li className="pt-1">{cfg.address}</li>}
          {cfg.cnpj && (
            <li className="pt-1 text-xs text-muted-foreground/60">CNPJ {cfg.cnpj}</li>
          )}
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
