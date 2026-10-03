// Lição Galinha GSB: cores hardcoded ignoram o tema escuro e ficam invisíveis.
// Esta página é servida como HTML standalone (sem Tailwind/CSS vars), então usamos
// prefers-color-scheme no próprio <style> para respeitar o tema do sistema.
// Visual alinhado às telas de erro do app (src/components/error-screens.tsx).
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não carregou — Go Beyondd</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <style>
      :root {
        --bg: #f6f6f6;
        --fg: #121519;
        --muted: #4b4f58;
        --border: rgba(75,79,88,.28);
        --gilt: #fdc600;
        --gilt-dark: #a08d24;
        --ink: #121519;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #121519;
          --fg: #f6f6f6;
          --muted: #9ba1ab;
          --border: rgba(75,79,88,.6);
        }
      }
      * { box-sizing: border-box; }
      body { font: 15px/1.6 Verdana, Geneva, "DejaVu Sans", sans-serif; background: var(--bg); color: var(--fg); min-height: 100vh; margin: 0; display: flex; flex-direction: column; }
      header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
      .logo { font-weight: 700; font-style: italic; font-size: 1.4rem; color: var(--fg); text-decoration: none; letter-spacing: -0.02em; }
      .logo span { color: var(--gilt); }
      main { flex: 1; display: grid; place-items: center; padding: 3rem 1.5rem; }
      .wrap { max-width: 60rem; width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 2.5rem 4rem; }
      .folio { font-weight: 700; font-style: italic; font-size: clamp(6rem, 18vw, 10rem); line-height: 1; color: transparent; -webkit-text-stroke: 1.5px var(--gilt); letter-spacing: -0.02em; user-select: none; }
      .rule { display: block; height: 1px; width: 6rem; background: var(--gilt); margin-top: .75rem; }
      .text { flex: 1; min-width: 16rem; }
      .eyebrow { font: 700 .65rem Tahoma, Verdana, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: var(--gilt-dark); margin: 0; }
      h1 { font-weight: 700; font-style: italic; font-size: clamp(2rem, 5vw, 3rem); line-height: 1.08; letter-spacing: -0.02em; margin: 1.25rem 0 0; }
      p { color: var(--muted); margin: 1.5rem 0 0; max-width: 32rem; }
      p a { color: var(--gilt-dark); }
      .actions { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 2.5rem; }
      .btn { padding: .8rem 1.5rem; border-radius: 2px; font: 700 .75rem Verdana, sans-serif; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: var(--gilt); color: var(--ink); }
      .secondary { background: transparent; color: var(--fg); border-color: var(--border); }
      .secondary:hover { border-color: var(--gilt); color: var(--gilt-dark); }
    </style>
  </head>
  <body>
    <header><a class="logo" href="/">Go <span>Beyondd</span></a></header>
    <main>
      <div class="wrap">
        <div aria-hidden="true"><span class="folio">500</span><span class="rule"></span></div>
        <div class="text">
          <p class="eyebrow">Erro · Algo saiu do lugar</p>
          <h1>Esta página não carregou.</h1>
          <p>Algo deu errado do nosso lado, não do seu. Tente de novo em instantes — se continuar, <a href="/contato">avise a gente</a>.</p>
          <div class="actions">
            <button class="btn primary" onclick="location.reload()">Tentar novamente</button>
            <a class="btn secondary" href="/">Voltar ao início</a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>`;
}
