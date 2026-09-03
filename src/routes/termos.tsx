import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — The Beyond" },
      {
        name: "description",
        content:
          "Termos de uso do The Beyond: direitos das obras, regras de curadoria, receita por visualização e doações diretas aos artistas.",
      },
      { property: "og:title", content: "Termos de uso — The Beyond" },
      {
        property: "og:description",
        content: "Direitos das obras, curadoria e repasse de receita aos artistas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">Documento</p>
      <h1 className="hero-type mt-5 text-4xl tracking-tight">Termos de uso</h1>
      <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
        <p>
          As obras publicadas permanecem integralmente do autor. O The Beyond recebe apenas licença
          para exibi-las no site e nos materiais de curadoria.
        </p>
        <p>
          A entrada de autores acontece por candidatura avaliada pela curadoria, e cada obra passa
          por revisão antes de aparecer no feed. Podemos solicitar ajustes ou recusar uma obra,
          sempre com comentário.
        </p>
        <p>
          A receita é composta por visualizações contabilizadas e doações diretas. A plataforma
          retém 12% e repassa o restante ao autor, semanalmente e sem valor mínimo.
        </p>
        <p>
          Contas que publiquem material de terceiros sem autorização podem ser suspensas sem aviso
          prévio.
        </p>
        <p className="caption">Documento de demonstração, sem valor contratual.</p>
      </div>
    </div>
  );
}
