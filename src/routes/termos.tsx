import { SITE_URL } from "@/lib/site-url";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — The Beyond" },
      {
        name: "description",
        content:
          "Termos de uso do The Beyond: direitos e exclusividade das obras, curadoria, receita do autor, anúncios, idade mínima e regras de convivência.",
      },
      { property: "og:title", content: "Termos de uso — The Beyond" },
      {
        property: "og:description",
        content: "Direitos das obras, curadoria e repasse de receita aos autores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/termos` }],
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
          <strong className="text-foreground">Exclusividade.</strong> Cada obra fica em exclusividade
          no The Beyond por 6 meses a partir da publicação, renováveis por acordo. Terminado o
          período, o autor pode publicá-la em outros lugares.
        </p>
        <p>
          <strong className="text-foreground">Curadoria.</strong> A entrada de autores e cada obra
          passam pela avaliação da equipe: qualidade, respeito aos direitos autorais e às regras da
          plataforma. Podemos solicitar ajustes ou recusar uma obra, sempre com comentário.
        </p>
        <p>
          <strong className="text-foreground">Receita.</strong> O autor recebe pelas visualizações
          contabilizadas e pelo apoio direto dos leitores; a plataforma retém uma parte para se
          manter, informada ao autor no Painel do Autor. Repasses semanais, sem valor mínimo.
        </p>
        <p>
          <strong className="text-foreground">Leitura e anúncios.</strong> A leitura gratuita tem
          limite diário e exibe anúncios de parceiros. Os planos pagos removem o limite e os
          anúncios. É proibido incentivar ou simular cliques em anúncios.
        </p>
        <p>
          <strong className="text-foreground">Idade mínima.</strong> É preciso ter pelo menos 13 anos
          para criar uma conta. Menores de 18 anos precisam da autorização dos pais ou responsáveis.
        </p>
        <p>
          <strong className="text-foreground">Convivência.</strong> São proibidos golpes, assédio,
          discurso de ódio, conteúdo ilegal e a publicação de material de terceiros sem autorização.
          Contas que descumprirem estas regras podem ser suspensas sem aviso prévio. Quem tem conta
          pode denunciar comentários, obras e autores; a equipe analisa cada denúncia.
        </p>
        <p className="caption">Documento de demonstração, sem valor contratual.</p>
      </div>
    </div>
  );
}
