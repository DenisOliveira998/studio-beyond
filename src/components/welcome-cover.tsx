import { Link } from "@tanstack/react-router";
import type { Work } from "@/lib/beyond-data";

// Cores de apoio para completar a chuva de capas quando ainda há poucas obras (sem texto, só cor)
const FILL = [
  ["#8B83F0", "#3b2f9a"],
  ["#F06A8C", "#8a1f45"],
  ["#4FC3A1", "#0f5a4a"],
  ["#F2A93B", "#8a4f00"],
  ["#5BA8F0", "#1d4f8a"],
  ["#E46BD0", "#7a1f6a"],
];

// Posição, tamanho, velocidade e giro de cada capa que cai (fixo, para o servidor e o navegador desenharem igual)
const DROPS = [
  { left: 4, w: 112, dur: 15, rot: -8 },
  { left: 30, w: 140, dur: 19, rot: 6 },
  { left: 60, w: 118, dur: 16, rot: -4 },
  { left: 80, w: 104, dur: 21, rot: 9 },
  { left: 14, w: 126, dur: 18, rot: 5 },
  { left: 46, w: 98, dur: 14, rot: -10 },
  { left: 70, w: 132, dur: 20, rot: 3 },
  { left: 22, w: 92, dur: 17, rot: 11 },
  { left: 88, w: 116, dur: 18, rot: -6 },
  { left: 52, w: 124, dur: 22, rot: 7 },
];

/**
 * Página de boas-vindas para quem não está logado: um recado curto e uma chuva
 * só de capas (sem título, autor ou nota), como amostra do que tem aqui dentro.
 */
export function WelcomeCover({ works }: { works: Work[] }) {
  const covers = [...new Set(works.map((w) => w.cover).filter((c): c is string => !!c))];

  return (
    <section
      aria-labelledby="boas-vindas"
      className="grid grid-cols-1 overflow-hidden lg:h-[calc(100svh-4rem)] lg:min-h-[600px] lg:grid-cols-[1.05fr_.95fr]"
    >
      <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
        <p className="text-sm text-muted-foreground">Go Beyondd</p>
        <h2 id="boas-vindas" className="mt-3 max-w-xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Um lugar pras histórias que ficavam na gaveta.
        </h2>

        <div className="mt-8 max-w-lg space-y-4 text-[1.05rem] leading-relaxed text-foreground/85">
          <p>Oi! Chega mais.</p>
          <p>
            Aqui tem história nova pra ler no celular, um capítulo por vez, de gente que tá começando agora e que você não vai
            achar em outro lugar.
          </p>
          <p>Tudo que entra aqui alguém do time leu antes. Se curtir uma história, dá pra apoiar quem escreveu direto por aqui.</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/criar" className="rounded-full bg-gilt px-6 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90">
            Criar conta grátis
          </Link>
          <Link to="/entrar" className="rounded-full border border-border px-6 py-3 text-sm transition-colors hover:border-gilt hover:text-gilt">
            Entrar
          </Link>
        </div>
      </div>

      {/* Chuva de capas: caem devagar, cada uma no seu ritmo, girando um pouco */}
      <div
        aria-hidden
        className="welcome-rain relative h-[440px] overflow-hidden lg:h-full"
        style={{ maskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)" }}
      >
        {DROPS.map((d, i) => {
          // Com poucas obras, alterna capa real e bloco de cor; com muitas, só capa real
          const real = covers.length && (covers.length >= DROPS.length || i % 2 === 0) ? covers[i % covers.length] : undefined;
          const [c1, c2] = FILL[i % FILL.length]!;
          const style = {
            left: `${d.left}%`,
            width: d.w,
            ["--dur" as string]: `${d.dur}s`,
            // fração do ciclo já percorrida: espalha as capas pela altura toda desde o início
            ["--df" as string]: String(((i * 0.37) % 1).toFixed(2)),
            ["--rot" as string]: `${d.rot}deg`,
          } as React.CSSProperties;
          return real ? (
            <img key={i} src={real} alt="" className="welcome-drop" style={style} />
          ) : (
            <span key={i} className="welcome-drop" style={{ ...style, background: `linear-gradient(160deg, ${c1}, ${c2})` }} />
          );
        })}
      </div>
    </section>
  );
}

/** Perguntas rápidas da página de boas-vindas (também vão para o Google como FAQ). */
export const WELCOME_FAQ = [
  {
    q: "É de graça?",
    a: "É. Você cria a conta e lê as histórias inteiras.",
  },
  {
    q: "Preciso baixar algum app?",
    a: "Não. Funciona no navegador do celular. Se quiser, dá pra colocar na tela inicial pelo próprio navegador, sem passar por loja.",
  },
  {
    q: "Como apoio quem escreveu?",
    a: "Na página de cada obra tem o card Apoie. Você escolhe um valor e paga por Pix ou cartão, pelo Mercado Pago.",
  },
  {
    q: "Quem escolhe as histórias que entram?",
    a: "Alguém do nosso time lê cada obra antes de ela entrar no site. Vale também pra cada capítulo novo.",
  },
];

const STEPS = [
  { t: "Crie sua conta", d: "Com e-mail ou com o Google." },
  { t: "Escolha uma história", d: "Pela capa, como numa livraria." },
  { t: "Leia no seu tempo", d: "A gente guarda onde você parou." },
];

/** Logo abaixo da capa: três passos para começar, perguntas rápidas e o fechamento. */
export function WelcomeMore() {
  return (
    <>
      <section aria-labelledby="comecar" className="border-t border-border px-6 py-16 sm:px-12 lg:px-16">
        <h2 id="comecar" className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Começar leva um minuto
        </h2>
        <ol className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-xl border border-border bg-surface p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-gilt font-bold text-ink">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="perguntas" className="border-t border-border px-6 py-16 sm:px-12 lg:px-16">
        <h2 id="perguntas" className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Perguntas rápidas
        </h2>
        <div className="mx-auto mt-10 max-w-2xl divide-y divide-border rounded-xl border border-border bg-surface">
          {WELCOME_FAQ.map((f) => (
            <details key={f.q} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-6 py-20 text-center sm:px-12">
        <p className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Sua próxima história favorita tá aqui.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/criar" className="rounded-full bg-gilt px-7 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90">
            Criar conta grátis
          </Link>
          <Link to="/entrar" className="rounded-full border border-border px-7 py-3 text-sm transition-colors hover:border-gilt hover:text-gilt">
            Entrar
          </Link>
        </div>
      </section>
    </>
  );
}
