import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, CreditCard, Smartphone, ChevronDown, Hammer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { faqJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos Fã e Super Fã: leia sem anúncios | Go Beyondd" },
      {
        name: "description",
        content:
          "Planos Fã (R$ 9,90/mês) e Super Fã (R$ 19,90/mês) da Go Beyondd: leitura sem anúncios e sem limite diário, acesso antecipado e clube de fãs.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Planos Fã e Super Fã | Go Beyondd" },
      {
        property: "og:description",
        content: "Leia sem anúncios e sem limite diário. Fã por R$ 9,90 e Super Fã por R$ 19,90 por mês.",
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
    q: "Quanto custam os planos?",
    a: "Fã: R$ 9,90 por mês. Super Fã: R$ 19,90 por mês. A cobrança é mensal e automática pelo Mercado Pago.",
  },
  {
    q: "Como cancelo?",
    a: "Nesta página, no botão Cancelar assinatura, ou na sua conta do Mercado Pago. As próximas cobranças param na hora e os benefícios do plano terminam junto.",
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
    q: "Como funciona a cobrança?",
    a: "Você autoriza a cobrança mensal na página do Mercado Pago, com cartão de crédito ou saldo da sua conta Mercado Pago. Os dados do cartão ficam só com o Mercado Pago.",
  },
];

type PlanosData = {
  prices: { fa: number; superfa: number };
  available: boolean;
  testMode?: boolean;
  loggedIn: boolean;
  current: { plan: string; status: string; priceCents: number; nextPaymentAt: string | null } | null;
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PlansPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: planos } = useQuery<PlanosData>({
    queryKey: ["planos", user?.id ?? "anon"],
    queryFn: () => fetch("/api/planos").then((r) => r.json() as Promise<PlanosData>),
    staleTime: 30_000,
  });
  const available = planos?.available === true;
  const prices = planos?.prices ?? { fa: 990, superfa: 1990 };
  const [mode, setMode] = useState<"waitlist" | "subscribe">("waitlist");
  const [cancelling, setCancelling] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  function openWaitlist(plan: Plan) {
    setMode(available ? "subscribe" : "waitlist");
    setSelectedPlan(plan);
    setEmail((prev) => prev || user?.email || "");
    setJoined(false);
    setError("");
  }

  function closeWaitlist() {
    setSelectedPlan(null);
  }

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/pagamentos/assinatura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plano: selectedPlan.id, email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "Não foi possível abrir a assinatura agora.");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a assinatura agora.");
      setSending(false);
    }
  }

  async function cancelSubscription() {
    if (!window.confirm("Cancelar a assinatura? As próximas cobranças param e os benefícios terminam agora.")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/pagamentos/assinatura/cancelar", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Assinatura cancelada.");
      void qc.invalidateQueries({ queryKey: ["planos"] });
    } catch {
      toast.error("Não foi possível cancelar agora. Tente de novo.");
    } finally {
      setCancelling(false);
    }
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
      {/* Selo de construção (só enquanto os pagamentos não abrem) */}
      {!available && <div
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
      </div>}

      {/* Modo de teste: ninguém paga de verdade */}
      {available && planos?.testMode && (
        <div className="mb-10 rounded border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm leading-relaxed">
          <strong>Modo de teste.</strong> Nenhum valor real é cobrado. Para testar, use o cartão de teste do Mercado Pago:
          <span className="font-mono"> 5031 4332 1540 6351</span>, validade <span className="font-mono">11/30</span>, CVV{" "}
          <span className="font-mono">123</span>, titular <span className="font-mono">APRO</span>. Não use seu cartão de verdade.
        </div>
      )}

      {/* Assinatura atual */}
      {planos?.current && (
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface px-5 py-4 text-sm">
          <span>
            Seu plano: <strong>{planos.current.plan === "superfa" ? "Super Fã" : "Fã"}</strong>
            <span className="text-muted-foreground">
              . R$ {brl(planos.current.priceCents)} por mês
              {planos.current.nextPaymentAt ? `, próxima cobrança em ${new Date(planos.current.nextPaymentAt).toLocaleDateString("pt-BR")}` : ""}
              {planos.current.status === "paused" ? ". Pausado pelo Mercado Pago (confira o cartão)" : ""}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void cancelSubscription()}
            disabled={cancelling}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {cancelling ? "Cancelando…" : "Cancelar assinatura"}
          </button>
        </div>
      )}

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
        Você pode usar a Go Beyondd sem assinar — a leitura gratuita continua aberta. Os planos
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
                R$ {brl(plan.id === "superfa" ? prices.superfa : prices.fa)}
              </span>
              <span className="caption">/mês</span>
            </div>
            <p className="caption mt-1">cobrança mensal, cancele quando quiser</p>

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
              onClick={() => {
                if (available && !planos?.loggedIn) {
                  window.location.href = `/entrar?redirect=${encodeURIComponent("/planos")}`;
                  return;
                }
                openWaitlist(plan);
              }}
              disabled={planos?.current?.plan === plan.id}
              className="btn-type mt-8 w-full py-3 text-xs transition-all disabled:cursor-default disabled:opacity-60"
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
              {planos?.current?.plan === plan.id
                ? "Seu plano atual"
                : available
                  ? planos?.loggedIn
                    ? planos?.current
                      ? `Trocar para ${plan.name}`
                      : `Assinar ${plan.name}`
                    : "Entrar para assinar"
                  : "Entrar na lista de espera"}
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
          Formas de pagamento:
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
            <CreditCard className="size-3" /> Crédito
          </span>
          <span className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
            <Smartphone className="size-3" /> Saldo Mercado Pago
          </span>
        </div>
      </div>
      <p
        className="mt-3 text-[0.65rem] text-muted-foreground"
        style={{ fontFamily: TAHOMA }}
      >
        {available ? "Cobrança mensal pelo Mercado Pago. Os dados do cartão ficam só com eles." : "Pagamentos disponíveis quando o plano abrir."}
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
              {mode === "subscribe" ? `Plano ${selectedPlan.name}` : `Lista de espera · ${selectedPlan.name}`}
            </p>

            {mode === "subscribe" ? (
              <form onSubmit={(e) => void handleSubscribe(e)}>
                <h2 id="waitlist-title" className="font-display text-xl font-bold text-foreground">
                  R$ {brl(selectedPlan.id === "superfa" ? prices.superfa : prices.fa)} por mês
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Você vai para o Mercado Pago autorizar a cobrança mensal e volta para cá. Cancele quando quiser.
                </p>
                <label className="mt-6 block">
                  <span className="text-sm text-muted-foreground">E-mail da sua conta no Mercado Pago</span>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="mt-2 w-full rounded border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
                  />
                </label>
                {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="btn-type mt-6 w-full py-3 text-xs transition-opacity hover:opacity-85 disabled:opacity-60"
                  style={{ background: GOLD, color: "#121519", fontFamily: TAHOMA, fontWeight: "bold" }}
                >
                  {sending ? "Abrindo o Mercado Pago…" : "Continuar para o Mercado Pago"}
                </button>
              </form>
            ) : joined ? (
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
