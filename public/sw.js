// Service worker mínimo: torna o site instalável no celular.
// Não guarda páginas nem obras em cache (tudo vem da rede), para nunca mostrar versão antiga.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Deixa o navegador buscar normalmente.
});
