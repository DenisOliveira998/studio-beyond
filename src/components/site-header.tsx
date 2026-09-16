import { Link } from "@tanstack/react-router";
import { Instagram, LayoutDashboard, LogOut, Shield, Youtube } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { SiteSearch } from "@/components/site-search";
import { useAuth } from "@/lib/auth";
import type { SiteConfigData } from "@/lib/beyond-db";

async function fetchSiteConfig(): Promise<SiteConfigData> {
  const res = await fetch("/api/site-config");
  if (!res.ok) throw new Error("Erro ao buscar configurações");
  return res.json() as Promise<SiteConfigData>;
}

const DEFAULT_CONFIG: SiteConfigData = {
  instagram: "",
  youtube: "",
  email: "",
  phone: "",
  address: "",
  cnpj: "",
};

const nav = [
  { to: "/", label: "Obras" },
  { to: "/artists", label: "Artistas" },
  { to: "/explorar", label: "Explorar" },
  { to: "/planos", label: "Planos" },
  { to: "/sobre", label: "Quem somos" },
];

function UserMenu() {
  const { user, profile, isStaff, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = (user?.name ?? user?.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center rounded-full border border-white/30 bg-gilt/20 text-xs font-bold text-gilt transition-colors hover:border-gilt"
        aria-label="Menu da conta"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-52 border border-border bg-ink shadow-lg">
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-xs font-medium text-white">{user?.name ?? user?.email}</p>
            {profile?.role && profile.role !== "reader" && (
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gilt/70">
                {profile.role === "owner" ? "Dono" :
                 profile.role === "admin" ? "Administrador" :
                 profile.role === "gerente" ? "Gerente" :
                 profile.role === "author" ? "Autor" :
                 profile.role === "vip" ? "Leitor Assíduo" : "Leitor"}
              </p>
            )}
          </div>
          <div className="py-1">
            <Link
              to={isStaff || profile?.role === "author" ? "/dashboard" : "/perfil"}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-white/80 transition-colors hover:bg-white/5 hover:text-gilt"
            >
              <LayoutDashboard className="size-3.5" strokeWidth={1.5} />
              {isStaff || profile?.role === "author" ? "Painel do autor" : "Meu perfil"}
            </Link>
            {isStaff && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-white/80 transition-colors hover:bg-white/5 hover:text-gilt"
              >
                <Shield className="size-3.5" strokeWidth={1.5} />
                Administração
              </Link>
            )}
            <button
              onClick={() => { setOpen(false); void signOut(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-red-400"
            >
              <LogOut className="size-3.5" strokeWidth={1.5} />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-stone/60 bg-ink text-chalk">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:gap-6 sm:px-8">

        {/* ── Esquerda: logo ── */}
        <Link to="/" className="flex shrink-0 items-baseline gap-2">
          <span className="hero-type text-2xl leading-none text-white">
            The <span className="text-gilt">Beyond</span>
          </span>
          <span className="hidden eyebrow sm:inline">desde 2026</span>
        </Link>

        {/* ── Centro: busca exposta ── */}
        <div className="hidden flex-1 lg:block lg:max-w-sm xl:max-w-md">
          <SiteSearch inline />
        </div>

        {/* ── Direita: links de nav + controles ── */}
        <div className="ml-auto flex items-center gap-4 text-sm text-white/85 sm:gap-5">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rule-hover hidden transition-colors hover:text-gilt xl:inline"
              activeProps={{ className: "text-gilt" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}

          {/* Ícone de busca no mobile (quando o campo central não aparece) */}
          <span className="lg:hidden">
            <SiteSearch />
          </span>

          {!loading && (
            user ? (
              <UserMenu />
            ) : (
              <Link
                to="/entrar"
                className="btn-type border border-white/40 px-3 py-1.5 text-xs text-white transition-colors hover:border-gilt hover:text-gilt"
              >
                Entrar
              </Link>
            )
          )}
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

const navLinks = [
  { to: "/", label: "Obras" },
  { to: "/artists", label: "Artistas" },
  { to: "/explorar", label: "Explorar categorias" },
  { to: "/planos", label: "Planos de leitura" },
  { to: "/sobre", label: "Quem somos" },
  { to: "/contato", label: "Contato" },
] as const;

const accountLinks = [
  { to: "/entrar", label: "Entrar" },
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
