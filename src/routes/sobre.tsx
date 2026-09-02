import { createFileRoute, Link } from "@tanstack/react-router";
import { PLATFORM_FEE } from "@/lib/beyond-data";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o projeto — The Beyond" },
      {
        name: "description",
        content:
          "Por que o The Beyond existe: uma galeria editorial sem anúncios, com curadoria humana e remuneração direta aos artistas.",
      },
      { property: "og:title", content: "Sobre o projeto — The Beyond" },
      {
        property: "og:description",
        content: "Curadoria humana, zero anúncios e 88% da receita para quem cria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">O projeto</p>
      <h1 className="hero-type mt-5 text-5xl tracking-tight">
        Uma galeria que não quer a sua atenção — quer o seu tempo.
      </h1>

      <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
        <p>
          O The Beyond nasceu de uma recusa simples: nenhum anúncio, nenhum banner, nenhuma
          interrupção entre quem olha e o que foi feito. A página existe para a obra.
        </p>
        <p>
          Cada visualização contabilizada gera receita para o artista. Quem quiser ir além pode
          doar diretamente ao ateliê. A plataforma retém {Math.round(PLATFORM_FEE * 100)}% para se
          manter — o resto é de quem cria.
        </p>
        <p>
          A entrada é por curadoria. Autores se candidatam, e cada obra passa por revisão antes de
          aparecer no feed. Não é um filtro de gosto: é um compromisso com o silêncio editorial do
          espaço.
        </p>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
        {[
          { k: "Zero", v: "anúncios, sempre" },
          { k: "88%", v: "da receita ao artista" },
          { k: "Semanal", v: "pagamentos sem mínimo" },
        ].map((s) => (
          <div key={s.k} className="bg-background p-7">
            <p className="font-display text-3xl tracking-tight text-gilt">{s.k}</p>
            <p className="caption mt-2">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link
          to="/candidatura-autor"
          className="btn-type bg-primary px-6 py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90"
        >
          Candidatar-se como autor
        </Link>
        <Link
          to="/planos"
          className="rule-hover text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver planos de leitor
        </Link>
      </div>
    </div>
  );
}
