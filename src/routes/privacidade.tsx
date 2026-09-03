import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — The Beyond" },
      {
        name: "description",
        content:
          "Como o The Beyond trata os seus dados: sem rastreadores publicitários, sem venda de dados, apenas o necessário para contabilizar visualizações.",
      },
      { property: "og:title", content: "Privacidade — The Beyond" },
      {
        property: "og:description",
        content: "Sem rastreadores publicitários e sem venda de dados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">Política</p>
      <h1 className="hero-type mt-5 text-4xl tracking-tight">Privacidade</h1>
      <div className="mt-10 space-y-6 leading-relaxed text-muted-foreground">
        <p>
          Não usamos rastreadores publicitários. Não vendemos, alugamos nem compartilhamos dados
          pessoais com terceiros para fins de marketing.
        </p>
        <p>
          Registramos apenas o necessário para contabilizar visualizações e repassar a receita ao
          artista correto: identificador da obra, data e um contador agregado.
        </p>
        <p>
          Contas armazenam nome, e-mail e preferências de leitura. Dados de pagamento, quando
          houver, são processados pelo provedor de pagamentos e nunca ficam nos nossos servidores.
        </p>
        <p>
          Para solicitar exportação ou exclusão dos seus dados, escreva para
          contato@thebeyond.art.
        </p>
        <p className="caption">Documento de demonstração, sem valor contratual.</p>
      </div>
    </div>
  );
}
