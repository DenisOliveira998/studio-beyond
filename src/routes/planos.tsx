import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState } from "react";
import { Check, X, CreditCard, Smartphone, ChevronDown, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos de Assinatura | The Beyond — Apoie Autores Independentes" },
      {
        name: "description",
        content:
          "Assine o The Beyond e apoie autores independentes de livros, mangás, HQs e contos. Acesso a curadoria exclusiva, obras em primeira mão e leitura sem interrupções.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Planos | The Beyond — Apoie Autores Independentes" },
      {
        property: "og:description",
        content: "Assine o The Beyond: curadoria exclusiva, acesso antecipado e zero anúncios.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/planos` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/planos` }],
  }),
  component: PlansPage,
});

const GOLD = "#FDC600";
const MODAL_BG = "#212529";
const TAHOMA = "Tahoma, Verdana, Geneva, sans-serif";

type Plan = {
  id: string;
  name: string;
  monthlyPrice: string;
  totalPrice: string;
  billing: string;
  months: number;
  featured: boolean;
  badge: string | null;
  benefits: string[];
  buttonStyle: "ghost" | "secondary" | "primary";
};

const PLANS: Plan[] = [
  {
    id: "monthly",
    name: "Mensal",
    monthlyPrice: "19,90",
    totalPrice: "19,90",
    billing: "cobrado mensalmente",
    months: 1,
    featured: false,
    badge: null,
    benefits: [
      "Acesso a obras VIP exclusivas",
      "Badge de Leitor Assíduo no perfil",
      "Cancele quando quiser",
    ],
    buttonStyle: "ghost",
  },
  {
    id: "quarterly",
    name: "Trimestral",
    monthlyPrice: "16,90",
    totalPrice: "50,70",
    billing: "cobrado R$ 50,70 a cada 3 meses",
    months: 3,
    featured: false,
    badge: null,
    benefits: [
      "Acesso a obras VIP exclusivas",
      "Badge de Leitor Assíduo no perfil",
      "Cancele quando quiser",
    ],
    buttonStyle: "secondary",
  },
  {
    id: "yearly",
    name: "Anual",
    monthlyPrice: "12,90",
    totalPrice: "154,80",
    billing: "cobrado R$ 154,80 por ano",
    months: 12,
    featured: true,
    badge: "MELHOR VALOR",
    benefits: [
      "Acesso a obras VIP exclusivas",
      "Badge de Leitor Assíduo no perfil",
      "Cancele quando quiser",
      "Acesso antecipado a obras em lançamento",
      "Seu nome na lista de apoiadores da plataforma",
    ],
    buttonStyle: "primary",
  },
];

const FAQ = [
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, você cancela a qualquer momento sem taxa ou multa. O acesso continua até o fim do período já pago.",
  },
  {
    q: "O plano VIP remove anúncios?",
    a: "A plataforma já não tem anúncios — esse é um princípio do The Beyond. O VIP dá acesso a obras e conteúdos exclusivos que não aparecem no feed aberto.",
  },
  {
    q: "Como funciona a cobrança?",
    a: "Você paga uma vez e tem acesso pelo período escolhido. Simples assim.",
  },
  {
    q: "Minha assinatura renova automaticamente?",
    a: "Não. Você recebe um aviso antes do vencimento e decide se quer renovar. Sem cobranças surpresa.",
  },
];

type ModalType = "success" | "failure" | null;

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("pt-BR");
}

function PlansPage() {
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function openModal(plan: Plan) {
    setSelectedPlan(plan);
    setModal("success");
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      {/* Header */}
      <p
        className="text-[0.65rem] font-bold uppercase tracking-[0.22em]"
        style={{ fontFamily: TAHOMA, color: GOLD }}
      >
        Planos Leitor Assíduo
      </p>
      <h1 className="hero-type mt-5 max-w-2xl text-4xl sm:text-5xl">
        Apoie a arte. Leia sem limites.
      </h1>
      <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
        Você pode usar o The Beyond sem assinar — o feed permanece aberto. Assinantes entram
        antes nas novas obras e acessam conteúdo exclusivo.
      </p>

      {/* Plans grid */}
      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="relative flex flex-col bg-surface p-7 transition-colors"
            style={{
              border: plan.featured ? `1px solid ${GOLD}` : "1px solid var(--border)",
            }}
          >
            {/* Badge */}
            {plan.badge && (
              <span
                className="mb-4 inline-block px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.15em]"
                style={{ fontFamily: TAHOMA, color: GOLD, border: `1px solid ${GOLD}50` }}
              >
                {plan.badge}
              </span>
            )}

            {/* Name */}
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
              style={{ fontFamily: TAHOMA }}
            >
              {plan.name}
            </p>

            {/* Price */}
            <div className="mt-4 flex items-baseline gap-1">
              <span
                className="text-3xl font-bold tracking-tight text-foreground"
                style={{ fontFamily: TAHOMA }}
              >
                R$ {plan.monthlyPrice}
              </span>
              <span className="caption">/mês</span>
            </div>
            <p className="caption mt-1">{plan.billing}</p>

            {/* Benefits */}
            <ul className="mt-6 flex-1 space-y-3">
              {plan.benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                >
                  <Check
                    className="mt-0.5 size-3 shrink-0"
                    strokeWidth={2}
                    style={{ color: GOLD }}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Button with "Em breve" tooltip */}
            <div className="group relative mt-8">
              <button
                onClick={() => openModal(plan)}
                className="btn-type w-full py-3 text-xs transition-all"
                style={
                  plan.buttonStyle === "primary"
                    ? {
                        background: GOLD,
                        color: "#121519",
                        fontFamily: TAHOMA,
                        fontWeight: "bold",
                      }
                    : plan.buttonStyle === "secondary"
                    ? {
                        background: "var(--secondary)",
                        color: "var(--secondary-foreground)",
                        fontFamily: TAHOMA,
                      }
                    : {
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                        fontFamily: TAHOMA,
                      }
                }
              >
                Começar
              </button>
              <span
                className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  fontFamily: TAHOMA,
                  background: MODAL_BG,
                  color: GOLD,
                  border: `1px solid ${GOLD}40`,
                }}
              >
                Em breve
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Payment methods */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span
          className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground"
          style={{ fontFamily: TAHOMA }}
        >
          Formas de pagamento:
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
            <CreditCard className="size-3" /> Crédito
          </span>
          <span className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
            <CreditCard className="size-3" /> Débito
          </span>
          <span className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
            <Smartphone className="size-3" /> Pix
          </span>
        </div>
      </div>
      <p
        className="mt-3 text-[0.65rem] text-muted-foreground"
        style={{ fontFamily: TAHOMA }}
      >
        Pagamentos processados com segurança. Você decide se renova.
      </p>

      <Link
        to="/"
        className="rule-hover mt-6 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Continuar sem assinar
      </Link>

      {/* FAQ */}
      <div className="mt-20 border-t border-border pt-14">
        <p className="eyebrow mb-8">Perguntas frequentes</p>
        <div className="divide-y divide-border">
          {FAQ.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between py-5 text-left text-sm font-bold transition-colors hover:text-gilt"
              >
                {item.q}
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaq === i && (
                <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(0,0,0,0.76)" }}
          onClick={() => setModal(null)}
        >
          <div
            className="relative w-full max-w-md p-8"
            style={{
              background: MODAL_BG,
              border: `1px solid ${GOLD}30`,
              borderRadius: "4px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModal(null)}
              className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>

            {modal === "success" ? (
              <>
                <div
                  className="mb-6 flex size-12 items-center justify-center"
                  style={{
                    border: `1px solid ${GOLD}40`,
                    background: `${GOLD}14`,
                    borderRadius: "2px",
                  }}
                >
                  <Check className="size-6" strokeWidth={2} style={{ color: GOLD }} />
                </div>
                <p
                  className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.2em]"
                  style={{ fontFamily: TAHOMA, color: GOLD }}
                >
                  Assinatura ativa
                </p>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Seja bem-vindo, Leitor Assíduo.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Sua assinatura está ativa. Agora você tem acesso a tudo que o The Beyond
                  reservou para quem vai além.
                </p>
                {selectedPlan && (
                  <div
                    className="mt-6 space-y-1.5 p-4"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <p className="caption">Plano: {selectedPlan.name}</p>
                    <p className="caption">Valor: R$ {selectedPlan.totalPrice}</p>
                    <p className="caption">Vencimento: {addMonths(selectedPlan.months)}</p>
                  </div>
                )}
                <div className="mt-6 flex flex-col gap-3">
                  <Link
                    to="/"
                    onClick={() => setModal(null)}
                    className="btn-type block w-full py-3 text-center text-xs transition-opacity hover:opacity-85"
                    style={{
                      background: GOLD,
                      color: "#121519",
                      fontFamily: TAHOMA,
                      fontWeight: "bold",
                    }}
                  >
                    Explorar obras exclusivas
                  </Link>
                  <button
                    onClick={() => setModal(null)}
                    className="btn-type w-full py-3 text-xs text-foreground transition-colors hover:text-gilt"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Ver meu perfil
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  className="mb-6 flex size-12 items-center justify-center"
                  style={{
                    border: "1px solid rgba(180,100,100,0.3)",
                    background: "rgba(150,70,70,0.08)",
                    borderRadius: "2px",
                  }}
                >
                  <AlertCircle
                    className="size-6"
                    strokeWidth={1.5}
                    style={{ color: "#c87070" }}
                  />
                </div>
                <p
                  className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.2em]"
                  style={{ fontFamily: TAHOMA, color: "#c87070" }}
                >
                  Pagamento não processado
                </p>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Algo deu errado.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Não conseguimos processar seu pagamento. Nenhum valor foi cobrado.
                </p>
                <ul className="mt-5 space-y-2">
                  {[
                    "Saldo insuficiente",
                    "Dados do cartão incorretos",
                    "Pagamento Pix expirado",
                  ].map((r) => (
                    <li
                      key={r}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="size-1 shrink-0 rounded-full bg-muted-foreground" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="btn-type w-full py-3 text-xs transition-opacity hover:opacity-85"
                    style={{
                      background: GOLD,
                      color: "#121519",
                      fontFamily: TAHOMA,
                      fontWeight: "bold",
                    }}
                  >
                    Tentar novamente
                  </button>
                  <Link
                    to="/contato"
                    onClick={() => setModal(null)}
                    className="btn-type block w-full py-3 text-center text-xs text-foreground transition-colors hover:text-gilt"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Falar com suporte
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
