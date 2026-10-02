import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState } from "react";
import { Check, X, CreditCard, Smartphone, ChevronDown, Hammer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { faqJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos Fã e Super Fã: leia sem anúncios | The Beyond" },
      {
        name: "description",
        content:
          "Planos Fã e Super Fã do The Beyond (em construção): leitura sem anúncios e sem limite diário, acesso antecipado e clube de fãs. Entre na lista de espera.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Planos Fã e Super Fã | The Beyond" },
      {
        property: "og:description",
        content: "Leia sem anúncios e sem limite diário. Os planos Fã e Super Fã estão em construção — entre na lista de espera.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/planos` },
      { name: "twitter:card", content: "summary_large_image" },
      { "script:ld+json": faqJsonLd(FAQ) },
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
  /** Preço ainda em definição — mostrado como "Preço em breve" */
  price: string | null;
  featured: boolean;
  badge: string | null;
  benefits: string[];
  buttonStyle: "ghost" | "secondary" | "primary";
};

// Planos do plano de negócio: níveis escalonados (Fã → Super Fã). Preços a definir.
const PLANS: Plan[] = [
  {
    id: "fa",
    name: "Fã",
    price: null,
    featured: false,
    badge: null,
    benefits: [
      "Leitura sem anúncios",
      "Leitura ilimitada, sem limite diário",
      "Selo de Fã no perfil",
    ],
    buttonStyle: "secondary",
  },
  {
    id: "superfa",
    name: "Super Fã",
    price: null,
    featured: true,
    badge: "Mais completo",
    benefits: [
      "Tudo do plano Fã",
      "Acesso antecipado a obras em lançamento",
      "Clube de fãs dos seus autores favoritos",
      "Selo de Super Fã no perfil",
      "Seu nome na lista de apoiadores da plataforma",
    ],
    buttonStyle: "primary",
  },
];

const FAQ = [
  {
    q: "Quando os planos abrem?",
    a: "Assim que os pagamentos forem ativados. Quem está na lista de espera é avisado primeiro, por e-mail.",
  },
  {
    q: "Entrar na lista de espera cobra alguma coisa?",
    a: "Não. É só o seu e-mail. Nenhum valor é cobrado e você decide depois se quer assinar.",
  },
  {
    q: "Preciso assinar para ler?",
    a: "Não. A leitura gratuita continua aberta, com limite diário. Os planos removem o limite e os anúncios.",
  },
  {
    q: "Os planos removem anúncios?",
    a: "Sim. A leitura gratuita é mantida por anúncios; nos planos Fã e Super Fã você lê sem anúncios.",
  },
  {
    q: "Como vai funcionar a cobrança?",
    a: "Os detalhes de cobrança e cancelamento serão publicados nesta página antes da abertura.",
  },
];

function PlansPage() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  function openWaitlist(plan: Plan) {
    setSelectedPlan(plan);
    setEmail((prev) => prev || user?.email || "");
    setJoined(false);
    setError("");
  }

  function closeWaitlist() {
    setSelectedPlan(null);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plan: selectedPlan.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Não foi possível entrar na lista agora.");
      }
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar na lista agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      {/* Selo de construção */}
      <div
        className="mb-10 flex items-center gap-3 px-4 py-3 text-xs"
        style={{ border: `1px solid ${GOLD}50`, background: `${GOLD}10`, fontFamily: TAHOMA }}
      >
        <Hammer className="size-4 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
        <span>
          <strong className="uppercase tracking-[0.18em]" style={{ color: GOLD }}>
            Em construção
          </strong>
          <span className="text-muted-foreground">
            {" "}— os pagamentos ainda não estão ativos. Entre na lista de espera e avisamos quando o plano abrir.
          </span>
        </span>
      </div>

      {/* Header */}
      <p
        className="text-[0.65rem] font-bold uppercase tracking-[0.22em]"
        style={{ fontFamily: TAHOMA, color: GOLD }}
      >
        Planos Fã e Super Fã
      </p>
      <h1 className="hero-type mt-5 max-w-2xl text-4xl sm:text-5xl">
        Leia sem anúncios. Apoie quem escreve.
      </h1>
      <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
        Você pode usar o The Beyond sem assinar — a leitura gratuita continua aberta. Os planos
        tiram os anúncios e o limite diário, e o Super Fã ainda dá acesso antecipado e clube de fãs.
      </p>

      {/* Plans grid */}
      <div className="mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="relative flex flex-col bg-surface p-7 transition-colors"
            style={{
              border: plan.featured ? `1px solid ${GOLD}` : "1px solid var(--border)",
            }}
          >
            {/* Badge */}
            {plan.badge ? (
              <span
                className="mb-4 inline-block self-start px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.15em]"
                style={{ fontFamily: TAHOMA, color: GOLD, border: `1px solid ${GOLD}50` }}
              >
                {plan.badge}
              </span>
            ) : (
              <span className="mb-4 inline-block py-1 text-[0.6rem]" aria-hidden>
                &nbsp;
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
                {plan.price ? `R$ ${plan.price}` : "Em breve"}
              </span>
              {plan.price && <span className="caption">/mês</span>}
            </div>
            <p className="caption mt-1">{plan.price ? "cobrança mensal" : "Preço anunciado na abertura"}</p>

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

            <button
              onClick={() => openWaitlist(plan)}
              className="btn-type mt-8 w-full py-3 text-xs transition-all"
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
              Entrar na lista de espera
            </button>
          </div>
        ))}
      </div>

      {/* Payment methods */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span
          className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground"
          style={{ fontFamily: TAHOMA }}
        >
          Formas de pagamento previstas:
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
        Pagamentos disponíveis quando o plano abrir.
      </p>

      <Link
        to="/explorar"
        className="rule-hover mt-6 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Continuar lendo de graça
      </Link>

      {/* FAQ */}
      <div className="mt-20 border-t border-border pt-14">
        <h2 className="eyebrow mb-8">Perguntas frequentes</h2>
        <div className="divide-y divide-border">
          {FAQ.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
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

      {/* Modal — lista de espera */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(0,0,0,0.76)" }}
          onClick={closeWaitlist}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="waitlist-title"
            className="relative w-full max-w-md p-8"
            style={{
              background: MODAL_BG,
              border: `1px solid ${GOLD}30`,
              borderRadius: "4px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeWaitlist}
              aria-label="Fechar"
              className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>

            <p
              className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.2em]"
              style={{ fontFamily: TAHOMA, color: GOLD }}
            >
              Lista de espera · {selectedPlan.name}
            </p>

            {joined ? (
              <>
                <h2 id="waitlist-title" className="font-display text-xl font-bold text-foreground">
                  Você está na lista.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Avisamos <span className="text-foreground">{email.trim()}</span> assim que o plano
                  abrir. Nenhum valor foi cobrado.
                </p>
                <Link
                  to="/explorar"
                  onClick={closeWaitlist}
                  className="btn-type mt-6 block w-full py-3 text-center text-xs transition-opacity hover:opacity-85"
                  style={{ background: GOLD, color: "#121519", fontFamily: TAHOMA, fontWeight: "bold" }}
                >
                  Continuar lendo
                </Link>
              </>
            ) : (
              <form onSubmit={(e) => void handleJoin(e)}>
                <h2 id="waitlist-title" className="font-display text-xl font-bold text-foreground">
                  O plano abre em breve.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Deixe seu e-mail e avisamos no dia. Nenhum valor é cobrado agora.
                </p>
                <label className="mt-6 block">
                  <span className="eyebrow">E-mail</span>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
                  />
                </label>
                {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="btn-type mt-6 w-full py-3 text-xs transition-opacity hover:opacity-85 disabled:opacity-60"
                  style={{ background: GOLD, color: "#121519", fontFamily: TAHOMA, fontWeight: "bold" }}
                >
                  {sending ? "Enviando…" : "Quero ser avisado"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
