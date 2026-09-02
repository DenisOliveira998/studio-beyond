import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/beyond-data";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos do Leitor Assíduo — The Beyond" },
      {
        name: "description",
        content:
          "Assine como Leitor Assíduo: curadoria exclusiva, acesso antecipado às obras, badge de apoiador e nenhuma interrupção.",
      },
      { property: "og:title", content: "Planos do Leitor Assíduo — The Beyond" },
      {
        property: "og:description",
        content: "Mensal ou anual com desconto. Sem interrupções, com curadoria exclusiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlansPage,
});

const BENEFITS = [
  "Leitura sem interrupções — nenhum anúncio, nunca",
  "Curadoria exclusiva enviada uma vez por semana",
  "Acesso antecipado a obras antes da publicação no feed",
  "Badge de apoiador no seu perfil e nas suas doações",
  "Taxa reduzida da plataforma sobre as suas doações",
];

const PLANS = [
  {
    id: "monthly",
    name: "Mensal",
    price: 29,
    note: "Cobrado a cada mês. Cancele quando quiser.",
    tag: null as string | null,
  },
  {
    id: "yearly",
    name: "Anual",
    price: 278,
    note: "Equivale a 23,17 por mês — dois meses livres.",
    tag: "20% de desconto",
  },
];

function PlansPage() {
  const [selected, setSelected] = useState("yearly");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="eyebrow">Leitor Assíduo</p>
      <h1 className="hero-type mt-5 max-w-2xl text-5xl tracking-tight">
        Conta criada. Agora escolha como acompanhar.
      </h1>
      <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
        Você pode usar o The Beyond sem assinar — o feed permanece aberto. Assinantes recebem
        conteúdo exclusivo e entram antes nas novas obras.
      </p>

      <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-5 sm:grid-cols-2">
          {PLANS.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`border p-8 text-left transition-colors ${
                  active ? "border-gilt bg-surface" : "border-border bg-background hover:border-gilt-soft"
                }`}
              >
                <p className="eyebrow">{p.name}</p>
                <p className="mt-4 font-display text-4xl tracking-tight">
                  {money(p.price)}
                  <span className="caption ml-2">{p.id === "yearly" ? "/ ano" : "/ mês"}</span>
                </p>
                {p.tag && (
                  <span className="btn-type mt-4 inline-block border border-gilt/50 px-2 py-1 text-[0.6rem] text-gilt">
                    {p.tag}
                  </span>
                )}
                <p className="caption mt-4">{p.note}</p>
              </button>
            );
          })}

          <div className="sm:col-span-2">
            <button
              onClick={() =>
                toast.success(
                  `Plano ${selected === "yearly" ? "Anual" : "Mensal"} selecionado — pagamento pronto para Stripe (demonstração).`,
                )
              }
              className="btn-type w-full bg-primary py-3.5 text-xs text-primary-foreground transition-opacity hover:opacity-90"
            >
              Assinar como Leitor Assíduo
            </button>
            <p className="caption mt-4">
              Pagamento preparado para Stripe. Nenhuma cobrança é feita nesta demonstração.
            </p>
            <Link
              to="/"
              className="rule-hover mt-5 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Continuar sem assinar
            </Link>
          </div>
        </div>

        <aside className="border border-gilt/25 bg-surface p-8">
          <p className="eyebrow">O que a assinatura inclui</p>
          <ul className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-3">
                <Check className="mt-1 size-3.5 shrink-0 text-gilt" strokeWidth={1.5} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
