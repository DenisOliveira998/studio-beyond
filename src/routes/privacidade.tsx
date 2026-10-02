import { SITE_URL } from "@/lib/site-url";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — The Beyond" },
      {
        name: "description",
        content:
          "Como o The Beyond trata os seus dados: o que guardamos, anúncios de parceiros na leitura gratuita e proteção a menores. Não vendemos dados.",
      },
      { property: "og:title", content: "Privacidade — The Beyond" },
      {
        property: "og:description",
        content: "Sem rastreadores publicitários e sem venda de dados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacidade` }],
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
          Não vendemos nem alugamos dados pessoais. A leitura gratuita exibe anúncios de parceiros
          (como o Google), que podem usar cookies para medir e personalizar anúncios; você poderá
          ajustar essa escolha no aviso de cookies. Quem assina os planos Fã e Super Fã não vê
          anúncios.
        </p>
        <p>
          Registramos apenas o necessário para contabilizar visualizações e repassar a receita ao
          autor correto: identificador da obra, data e um contador agregado.
        </p>
        <p>
          Contas armazenam nome, e-mail, data de nascimento e preferências de leitura. Dados de
          pagamento, quando houver, são processados pelo provedor de pagamentos e nunca ficam nos
          nossos servidores.
        </p>
        <p>
          <strong className="text-foreground">Menores de idade.</strong> A conta exige pelo menos 13
          anos. Para usuários de 13 a 17 anos, o cadastro depende da autorização dos pais ou
          responsáveis, e não exibimos anúncios personalizados a eles.
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
