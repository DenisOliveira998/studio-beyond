// Lição Galinha GSB: cores hardcoded ignoram o tema escuro e ficam invisíveis.
// Esta página é servida como HTML standalone (sem Tailwind/CSS vars), então usamos
// prefers-color-scheme no próprio <style> para respeitar o tema do sistema.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não carregou</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #f6f6f6;
        --fg: #121519;
        --muted: #4b4f58;
        --border: rgba(75,79,88,.28);
        --primary-bg: #fdc600;
        --primary-fg: #121519;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #121519;
          --fg: #f6f6f6;
          --muted: #9ba1ab;
          --border: rgba(75,79,88,.6);
          --primary-bg: #fdc600;
          --primary-fg: #121519;
        }
      }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 2px; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: var(--primary-bg); color: var(--primary-fg); font-weight: 700; }
      .secondary { background: transparent; color: var(--fg); border-color: var(--border); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página não carregou</h1>
      <p>Algo deu errado do nosso lado. Tente atualizar a página ou voltar ao início.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <a class="secondary" href="/">Voltar ao início</a>
      </div>
    </div>
  </body>
</html>`;
}
