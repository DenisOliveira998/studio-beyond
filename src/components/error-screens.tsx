import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MEDIUM_LABEL, type Work } from "@/lib/beyond-data";
import { stripHtml } from "@/lib/utils";

// Telas de erro no estilo editorial do site: número grande como fólio de livro,
// título em itálico, texto calmo e caminhos claros de volta ao acervo.

function ErrorLayout({
  code,
  eyebrow,
  title,
  children,
  actions,
  footer,
}: {
  code: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
        {/* Fólio */}
        <div className="relative select-none" aria-hidden="true">
          <span
            className="hero-type block text-[7rem] leading-none text-transparent sm:text-[10rem]"
            style={{ WebkitTextStroke: "1.5px var(--gilt)" }}
          >
            {code}
          </span>
          <span className="mt-3 block h-px w-24 bg-gilt" />
        </div>

        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="hero-type mt-5 max-w-xl text-4xl tracking-tight sm:text-5xl">{title}</h1>
          <div className="mt-6 max-w-lg leading-relaxed text-muted-foreground">{children}</div>
          <div className="mt-10 flex flex-wrap gap-3">{actions}</div>
        </div>
      </div>
      {footer}
    </div>
  );
}

const primaryBtn =
  "btn-type bg-gilt px-6 py-3 text-xs text-ink transition-opacity hover:opacity-90";
const secondaryBtn =
  "btn-type border border-border px-6 py-3 text-xs text-foreground transition-colors hover:border-gilt hover:text-gilt";

/** Obras recentes para o leitor não sair de mãos vazias. */
function Suggestions() {
  const { data: works = [] } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => fetch("/api/works").then((r) => (r.ok ? (r.json() as Promise<Work[]>) : [])),
    staleTime: 60_000,
  });
  const picks = [...works]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 4);
  if (picks.length === 0) return null;

  return (
    <section className="mx-auto mt-20 max-w-5xl border-t border-border pt-10">
      <h2 className="eyebrow">Enquanto isso, no acervo</h2>
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
        {picks.map((w) => {
          const title = stripHtml(w.title);
          return (
            <Link key={w.id} to="/work/$slug" params={{ slug: w.slug }} className="group block">
              {w.cover ? (
                <img
                  width={180} height={240}
                  src={w.cover}
                  alt={title}
                  loading="lazy"
                  className="aspect-[3/4] w-full bg-surface object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center border border-gilt/15 bg-surface">
                  <span className="font-display text-2xl font-bold text-gilt/25">
                    {MEDIUM_LABEL[w.medium].slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <p className="mt-2 line-clamp-2 text-xs font-bold leading-tight transition-colors group-hover:text-gilt">
                {title}
              </p>
              {w.artistName && <p className="mt-0.5 text-[10px] text-muted-foreground">{w.artistName}</p>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function NotFoundScreen() {
  return (
    <ErrorLayout
      code="404"
      eyebrow="Erro 404 · Página não encontrada"
      title="Esta página não está no acervo."
      actions={
        <>
          <Link to="/explorar" className={primaryBtn}>
            Explorar obras
          </Link>
          <Link to="/" className={secondaryBtn}>
            Voltar ao início
          </Link>
        </>
      }
      footer={<Suggestions />}
    >
      <p>
        O endereço pode ter mudado ou a obra saiu de circulação. O resto da biblioteca continua
        aqui, no mesmo silêncio de sempre.
      </p>
      <p className="mt-4 text-sm">
        Chegou aqui por um link nosso?{" "}
        <Link to="/contato" className="text-gilt underline-offset-4 hover:underline">
          Conte para a gente
        </Link>
        .
      </p>
    </ErrorLayout>
  );
}

export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorLayout
      code="500"
      eyebrow="Erro · Algo saiu do lugar"
      title="Esta página não carregou."
      actions={
        <>
          <button onClick={onRetry} className={primaryBtn}>
            Tentar novamente
          </button>
          <a href="/" className={secondaryBtn}>
            Voltar ao início
          </a>
        </>
      }
    >
      <p>
        Algo deu errado do nosso lado, não do seu. Tente de novo em instantes — se continuar,{" "}
        <a href="/contato" className="text-gilt underline-offset-4 hover:underline">
          avise a gente
        </a>
        .
      </p>
    </ErrorLayout>
  );
}
