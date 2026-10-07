import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  INLINE_SAFE_TYPES,
  MAX_UPLOAD_BYTES,
  WEAK_PASSWORD_MESSAGE,
  clientIp,
  detectFileType,
  isStrongPassword,
  rateLimit,
  tooManyRequests,
  withSecurityHeaders,
} from "./lib/security";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// ── Standard Ebooks catalog ──────────────────────────────────────────────────

type SEBook = {
  id: string;
  title: string;
  url: string;
  author: string;
  language: string;
  description: string;
  subjects: string[];
  cover: string;
  epubUrl: string;
};

let _seCache: SEBook[] | null = null;
let _seCacheTs = 0;

function extractXmlField(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1]!.trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#[0-9]+;/g, (e) => String.fromCharCode(parseInt(e.slice(2, -1), 10))) : "";
}

function extractXmlAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"[^>]*>`));
  return m ? m[1]! : "";
}

function extractAllXmlAttr(xml: string, tag: string, attr: string): string[] {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"[^>]*>`, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1]!);
  return results;
}

async function fetchStandardEbooksCatalog(): Promise<SEBook[]> {
  const now = Date.now();
  if (_seCache && now - _seCacheTs < 4 * 60 * 60 * 1000) return _seCache;

  const entries: SEBook[] = [];
  // O catálogo OPDS completo exige conta Patrons Circle (401 sem login); o feed Atom
  // de lançamentos (≈15 obras) é público e serve de alternativa.
  const FEEDS = [
    "https://standardebooks.org/feeds/opds/all",
    "https://standardebooks.org/feeds/atom/new-releases",
  ];
  let feedIndex = 0;
  let nextUrl: string | null = FEEDS[0]!;

  while (nextUrl && entries.length < 1000) {
    const res = await fetch(nextUrl, {
      headers: { "User-Agent": "GoBeyondd/1.0 (https://www.gobeyondd.com.br)", Accept: "application/atom+xml" },
    });
    if (!res.ok) {
      // Feed bloqueado/indisponível: tenta o próximo, se ainda não achou obras
      feedIndex += 1;
      nextUrl = entries.length === 0 && feedIndex < FEEDS.length ? FEEDS[feedIndex]! : null;
      continue;
    }
    const xml = await res.text();

    // Encontra cada <entry>
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let em: RegExpExecArray | null;
    while ((em = entryRe.exec(xml)) !== null) {
      const entry = em[1]!;
      const title = extractXmlField(entry, "title");
      const id = extractXmlField(entry, "id");
      if (!title || !id) continue;

      const url = id.startsWith("http") ? id : `https://standardebooks.org${id}`;

      // Links: epub e cover
      const linkTags = entry.match(/<link[^>]*\/>/g) ?? entry.match(/<link[^>]*>/g) ?? [];
      let epubUrl = "";
      let cover = "";
      for (const link of linkTags) {
        const type = link.match(/type="([^"]*)"/)?.[1] ?? "";
        const href = link.match(/href="([^"]*)"/)?.[1] ?? "";
        const rel = link.match(/rel="([^"]*)"/)?.[1] ?? "";
        if (type === "application/epub+zip" && !epubUrl) {
          epubUrl = href.startsWith("http") ? href : `https://standardebooks.org${href}`;
        }
        if (rel.includes("opds-spec.org/image") && !rel.includes("thumbnail") && !cover) {
          cover = href.startsWith("http") ? href : `https://standardebooks.org${href}`;
        }
      }
      // Feed Atom: capa em <media:thumbnail url="…">
      if (!cover) cover = entry.match(/<media:thumbnail[^>]*url="([^"]*)"/)?.[1] ?? "";

      // Author
      const authorBlock = entry.match(/<author>([\s\S]*?)<\/author>/)?.[1] ?? "";
      const author = extractXmlField(authorBlock, "name");

      // Language
      const language = extractXmlField(entry, "dc:language") || extractXmlField(entry, "language");

      // Description
      const description = extractXmlField(entry, "summary") || extractXmlField(entry, "content");

      // Subjects
      const subjects = extractAllXmlAttr(entry, "category", "term");

      if (epubUrl) {
        entries.push({ id, title, url, author, language, description, subjects, cover, epubUrl });
      }
    }

    // Paginação: rel="next"
    const nextMatch = xml.match(/<link[^>]*rel="next"[^>]*href="([^"]*)"[^>]*>/);
    nextUrl = nextMatch ? nextMatch[1]! : null;
  }

  // Não guarda resultado vazio por 4h (tenta de novo na próxima requisição)
  if (entries.length > 0) {
    _seCache = entries;
    _seCacheTs = now;
  }
  return entries;
}


// ── Cache e ajustes de HTML ───────────────────────────────────────────────────

/** Dados públicos (iguais para todos): 60s na CDN, servindo o antigo por até 10 min enquanto atualiza. */
const PUBLIC_API_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=600";

// Páginas cujo HTML não depende de quem está logado (o login é resolvido no navegador)
const CACHEABLE_HTML = [
  /^\/$/, /^\/explorar(\/[^/]+)?$/, /^\/ranking$/, /^\/artist\/[^/]+$/, /^\/work\/[^/]+$/,
  /^\/biblioteca$/, /^\/planos$/, /^\/sobre$/, /^\/contato$/, /^\/termos$/, /^\/privacidade$/,
  /^\/candidatura-autor$/,
];

async function finalizeHtmlResponse(request: Request, response: Response): Promise<Response> {
  const type = response.headers.get("content-type") ?? "";
  if (request.method !== "GET" || !type.includes("text/html")) return response;
  const { pathname } = new URL(request.url);

  // 404: título próprio e noindex (o head da raiz herda o título da home)
  if (response.status === 404) {
    const html = (await response.text())
      .replace(/<title>[^<]*<\/title>/, "<title>Página não encontrada | Go Beyondd</title>")
      .replace(/<meta name="robots" content="[^"]*"\/?>/, '<meta name="robots" content="noindex"/>')
      .replace(/<link rel="canonical"[^>]*>/, "");
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html, { status: 404, headers });
  }

  if (response.status === 200 && !response.headers.has("set-cookie") && CACHEABLE_HTML.some((re) => re.test(pathname))) {
    const headers = new Headers(response.headers);
    headers.set("cache-control", PUBLIC_API_CACHE);
    return new Response(response.body, { status: 200, headers });
  }
  return response;
}

// ── Acesso a arquivos privados do Blob ───────────────────────────────────────

async function blobAccess(request: Request, blobUrl: string): Promise<"public" | "private" | "denied"> {
  const { prisma } = await import("./lib/prisma");
  // 1) Público: capa ou PDF de obra publicada, ou foto de autor
  const publicWork = await prisma.work.findFirst({
    where: { status: "approved", coverUrl: blobUrl },
    select: { id: true },
  });
  if (publicWork) return "public";
  // páginas de webtoon publicado (ficam no corpo, como lista JSON de URLs)
  const webtoonPage = await prisma.work.findFirst({
    where: { status: "approved", medium: { in: ["manhwa", "manhua"] }, body: { contains: blobUrl } },
    select: { id: true },
  });
  if (webtoonPage) return "public";
  const avatar = await prisma.authorBio.findFirst({ where: { avatarUrl: blobUrl }, select: { userId: true } }).catch(() => null);
  if (avatar) return "public";

  // Daqui em diante, só com login
  const { auth } = await import("./lib/auth-server");
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user) return "denied";
  const profile = await prisma.profile.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const isStaff = !!profile && ["owner", "admin", "gerente"].includes(profile.role);
  if (isStaff) return "private";

  // 2) Portfólio de candidatura: só o próprio candidato
  const application = await prisma.authorApplication.findFirst({
    where: { portfolioFiles: { contains: blobUrl } },
    select: { userId: true },
  });
  if (application) return application.userId === session.user.id ? "private" : "denied";

  // 3) Arquivo de obra ainda não publicada: só o autor
  const draftWork = await prisma.work.findFirst({
    where: { OR: [{ coverUrl: blobUrl }, { pdfUrl: blobUrl }, { previewUrl: blobUrl }] },
    select: { authorId: true },
  });
  if (draftWork) return draftWork.authorId === session.user.id ? "private" : "denied";

  // 4) Upload recém-feito, ainda sem dono registrado: qualquer pessoa logada
  return "private";
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["owner", "admin", "gerente"] as const;

async function requireAdmin(request: Request): Promise<{ error?: Response; actorId?: string; actorEmail?: string }> {
  const { auth } = await import("./lib/auth-server");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return { error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } }) };
  }
  const { prisma } = await import("./lib/prisma");
  const profile = await prisma.profile.findUnique({ where: { id: session.user.id } });
  if (!profile || !ADMIN_ROLES.includes(profile.role as typeof ADMIN_ROLES[number])) {
    return { error: new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { "content-type": "application/json" } }) };
  }
  return { actorId: session.user.id, actorEmail: session.user.email };
}

// ── Idade: interações exigem data de nascimento informada ────────────────────
// Leitores (reader/vip) precisam ter informado a data de nascimento (mín. 13 anos)
// antes de curtir, salvar, seguir ou comentar. Autores e equipe ficam liberados.
const BIRTH_EXEMPT_ROLES = ["author", "gerente", "admin", "owner"];

async function hasBirthDate(userId: string): Promise<boolean> {
  const { prisma } = await import("./lib/prisma");
  const row = await prisma.userBirth.findUnique({ where: { userId }, select: { userId: true } }).catch(() => null);
  return !!row;
}

async function birthGate(userId: string): Promise<Response | null> {
  const { prisma } = await import("./lib/prisma");
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { role: true, suspended: true } });
  // Conta suspensa pela moderação não curte, salva, segue nem comenta
  if (profile?.suspended) {
    return new Response(JSON.stringify({ error: "Sua conta está suspensa. Fale com a equipe pelo Contato.", code: "account_suspended" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  if (profile && BIRTH_EXEMPT_ROLES.includes(profile.role)) return null;
  if (await hasBirthDate(userId)) return null;
  return new Response(
    JSON.stringify({ error: "Confirme sua data de nascimento para continuar.", code: "birthdate_required" }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}

// Endpoint para buscar o perfil do usuário autenticado
async function handleMe(request: Request): Promise<Response> {
  const { auth } = await import("./lib/auth-server");
  const { prisma } = await import("./lib/prisma");

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(JSON.stringify(null), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const profile = await prisma.profile.findUnique({ where: { id: session.user.id } });
  if (!profile) {
    return new Response(JSON.stringify(null), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const birthOk = BIRTH_EXEMPT_ROLES.includes(profile.role) || (await hasBirthDate(session.user.id));
  return new Response(JSON.stringify({ ...profile, hasBirthDate: birthOk }), {
    headers: { "content-type": "application/json" },
  });
}

// Endereço antigo da Vercel → domínio oficial (mesmo caminho e parâmetros).
// Só o endereço de produção; prévias de deploy (*.vercel.app) continuam acessíveis.
const OLD_HOSTS = new Set(["studio-beyond-phi.vercel.app"]);
const OFFICIAL_ORIGIN = "https://www.gobeyondd.com.br";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const host = (request.headers.get("x-forwarded-host") ?? url.host).split(",")[0]!.trim().toLowerCase();
    // /work/<obra> virou /obra/<obra>; endereços antigos de obra (ex.: com sufixo) levam ao atual
    const obraPath = url.pathname.match(/^\/(work|obra|ler)\/([^/]+)(\/?.*)$/);
    if (obraPath && request.method === "GET" && !OLD_HOSTS.has(host)) {
      const [, section, rawSlug, rest] = obraPath;
      let slug = rawSlug!;
      try {
        const { prisma } = await import("./lib/prisma");
        const alias = await prisma.workSlugAlias.findUnique({ where: { oldSlug: decodeURIComponent(slug) }, select: { newSlug: true } });
        if (alias) slug = encodeURIComponent(alias.newSlug);
      } catch {}
      const target = section === "work" ? "obra" : section!;
      if (target !== section || slug !== rawSlug) {
        return new Response(null, { status: 308, headers: { location: `/${target}/${slug}${rest ?? ""}${url.search}`, "cache-control": "public, max-age=3600" } });
      }
    }
    if (OLD_HOSTS.has(host)) {
      return new Response(null, {
        status: 308,
        headers: { location: `${OFFICIAL_ORIGIN}${url.pathname}${url.search}`, "cache-control": "public, max-age=3600" },
      });
    }
    return withSecurityHeaders(await route(request, env, ctx));
  },
};

async function route(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    try {
      const { pathname } = new URL(request.url);

      // OTP bypass — chama auth.api diretamente (evita bug de 404 no plugin emailOTP)
      if (pathname === "/api/otp/send" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const body = (await request.json().catch(() => ({}))) as { email?: string; type?: string };
        const otpEmail = String(body.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) {
          return new Response(JSON.stringify({ error: "Informe um e-mail válido." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (!(await rateLimit(`otp:ip:${clientIp(request)}`, 10, 15 * 60)) || !(await rateLimit(`otp:email:${otpEmail}`, 3, 15 * 60))) {
          return tooManyRequests("Muitos códigos pedidos. Aguarde 15 minutos e tente de novo.");
        }
        try {
          await (auth.api as Record<string, (opts: unknown) => Promise<unknown>>).sendVerificationOTP({
            body: { email: otpEmail, type: body.type ?? "sign-in" },
          });
        } catch (e: unknown) {
          // Não revela se o e-mail existe: registra e responde igual
          console.error("otp/send:", (e as { message?: string })?.message ?? e);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      if (pathname === "/api/otp/verify" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const body = (await request.json()) as { email: string; otp: string };
        try {
          const response = await (
            auth.api as Record<string, (opts: unknown) => Promise<Response>>
          ).signInEmailOTP({ body, asResponse: true });
          return response;
        } catch (e: unknown) {
          const err = e as { statusCode?: number; message?: string };
          const status = typeof err?.statusCode === "number" ? err.statusCode : 400;
          return new Response(JSON.stringify({ error: err?.message ?? String(e) }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // Redefinir senha após verificação OTP
      if (pathname === "/api/password/set" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autenticado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        // Só com login recente (ex.: pelo código de "Esqueci minha senha"): uma sessão
        // antiga ou roubada não consegue trocar a senha e tomar a conta.
        const sessionCreated = new Date((session as { session?: { createdAt?: string | Date } }).session?.createdAt ?? 0).getTime();
        if (!sessionCreated || Date.now() - sessionCreated > 15 * 60 * 1000) {
          return new Response(
            JSON.stringify({ error: "Por segurança, peça um código em “Esqueci minha senha” e defina a nova senha em seguida." }),
            { status: 403, headers: { "content-type": "application/json" } },
          );
        }
        const { newPassword } = (await request.json()) as { newPassword: string };
        const valid = isStrongPassword(newPassword);
        if (!valid) {
          return new Response(JSON.stringify({ error: "Senha não atende os requisitos de segurança." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const { hashPassword } = await import("better-auth/crypto");
        const { prisma } = await import("./lib/prisma");
        const hash = await hashPassword(newPassword);
        const existing = await prisma.account.findFirst({
          where: { userId: session.user.id, providerId: "credential" },
        });
        if (existing) {
          await prisma.account.update({
            where: { id: existing.id },
            data: { password: hash, updatedAt: new Date() },
          });
        } else {
          await prisma.account.create({
            data: {
              id: crypto.randomUUID(),
              accountId: session.user.email,
              providerId: "credential",
              userId: session.user.id,
              password: hash,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Cadastro e troca de senha pelo Better Auth: mesmas regras do formulário + limite
      if (
        request.method === "POST" &&
        ["/api/auth/sign-up/email", "/api/auth/reset-password", "/api/auth/change-password"].includes(pathname)
      ) {
        const payload = (await request.clone().json().catch(() => ({}))) as { password?: string; newPassword?: string };
        const pw = pathname === "/api/auth/sign-up/email" ? payload.password : payload.newPassword;
        if (!isStrongPassword(pw)) {
          return new Response(JSON.stringify({ message: WEAK_PASSWORD_MESSAGE, code: "WEAK_PASSWORD" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (pathname === "/api/auth/sign-up/email" && !(await rateLimit(`signup:ip:${clientIp(request)}`, 10, 60 * 60))) {
          return tooManyRequests("Muitos cadastros a partir desta conexão. Tente de novo mais tarde.");
        }
      }

      // Better Auth intercepta /api/auth/*
      if (pathname.startsWith("/api/auth")) {
        const { auth } = await import("./lib/auth-server");
        return auth.handler(request);
      }

      // Perfil do usuário autenticado
      if (pathname === "/api/me" && request.method === "GET") {
        return handleMe(request);
      }

      // ── Pagamentos (Mercado Pago) ─────────────────────────────────────────────

      // Cotação da doação: total a pagar para todos; taxa e parte do autor só para autores e equipe
      if (pathname === "/api/pagamentos/cotacao" && request.method === "GET") {
        const valor = Number(new URL(request.url).searchParams.get("valor") ?? "0");
        const amountCents = Math.round(valor * 100);
        const { getPaymentConfig, splitAmount, DONATION_MIN_CENTS, DONATION_MAX_CENTS } = await import("./lib/payments");
        if (!Number.isFinite(amountCents) || amountCents < DONATION_MIN_CENTS || amountCents > DONATION_MAX_CENTS) {
          return new Response(JSON.stringify({ error: "Valor entre R$ 1 e R$ 5.000." }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const cfg = await getPaymentConfig();
        const split = splitAmount(amountCents, cfg);
        const { auth } = await import("./lib/auth-server");
        const s = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        let detail: Record<string, unknown> = {};
        let role: string | null = null;
        if (s?.user) {
          const { prisma: prismaQ } = await import("./lib/prisma");
          const prof = await prismaQ.profile.findUnique({ where: { id: s.user.id }, select: { role: true } });
          role = prof?.role ?? null;
          const { canSeePlatformFee } = await import("./lib/beyond-data");
          if (canSeePlatformFee(role)) detail = { feeCents: split.feeCents, authorCents: split.authorCents, feeRate: cfg.feeRate };
        }
        const { paymentsOpenFor } = await import("./lib/payments");
        return new Response(
          JSON.stringify({
            totalCents: split.grossCents,
            destino: cfg.feeMode === "retida" ? "plataforma" : "autor",
            available: await paymentsOpenFor(role),
            testMode: await (await import("./lib/payments")).paymentsTestMode(),
            ...detail,
          }),
          { headers: { "content-type": "application/json", "cache-control": "private, no-store" } },
        );
      }

      // Cria a doação e devolve o link do Checkout Pro
      if (pathname === "/api/pagamentos/doacao" && request.method === "POST") {
        const json = (h: Record<string, unknown>, status = 200) =>
          new Response(JSON.stringify(h), { status, headers: { "content-type": "application/json" } });
        if (!(await rateLimit(`doacao:ip:${clientIp(request)}`, 15, 60 * 60))) {
          return tooManyRequests("Muitas tentativas de pagamento. Aguarde e tente de novo.");
        }
        const { paymentsEnabled, createDonationCheckout, DONATION_MIN_CENTS, DONATION_MAX_CENTS } = await import("./lib/payments");
        if (!paymentsEnabled()) return json({ error: "Pagamentos ainda não estão disponíveis." }, 503);
        const body = (await request.json().catch(() => ({}))) as { artistSlug?: string; workSlug?: string; valor?: number };
        const amountCents = Math.round(Number(body.valor ?? 0) * 100);
        if (!Number.isFinite(amountCents) || amountCents < DONATION_MIN_CENTS || amountCents > DONATION_MAX_CENTS) {
          return json({ error: "Escolha um valor entre R$ 1 e R$ 5.000." }, 400);
        }
        const artistSlug = String(body.artistSlug ?? "").slice(0, 120);
        const workSlug = body.workSlug ? String(body.workSlug).slice(0, 200) : null;
        const { prisma: prismaD } = await import("./lib/prisma");
        // O autor precisa ter obra publicada; a obra (se vier) precisa ser dele
        const work = await prismaD.work.findFirst({
          where: { status: "approved", artistSlug, ...(workSlug ? { slug: workSlug } : {}) },
          select: { slug: true, title: true, artistName: true },
        });
        if (!work) return json({ error: "Autor ou obra não encontrados." }, 404);
        const { auth } = await import("./lib/auth-server");
        const s = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        const donorRole = s?.user
          ? ((await prismaD.profile.findUnique({ where: { id: s.user.id }, select: { role: true } }))?.role ?? null)
          : null;
        const { paymentsOpenFor } = await import("./lib/payments");
        if (!(await paymentsOpenFor(donorRole))) return json({ error: "Os pagamentos abrem em breve." }, 503);
        const { stripHtml } = await import("./lib/utils");
        try {
          const { checkoutUrl } = await createDonationCheckout({
            amountCents,
            artistSlug,
            artistName: work.artistName,
            workSlug,
            workTitle: workSlug ? stripHtml(work.title) : null,
            userId: s?.user?.id ?? null,
            payerName: s?.user?.name ?? "Anônimo",
          });
          return json({ checkoutUrl });
        } catch (e) {
          console.error("doação: falha ao criar checkout", e);
          return json({ error: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." }, 502);
        }
      }

      // Aviso do Mercado Pago: só aceita com assinatura válida; consulta o pagamento direto na API deles
      if (pathname === "/api/pagamentos/webhook" && request.method === "POST") {
        const url = new URL(request.url);
        const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
        const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);
        const type = url.searchParams.get("type") ?? body.type ?? body.topic ?? "";
        const { verifyWebhookSignature, syncMpPayment } = await import("./lib/payments");
        if (!verifyWebhookSignature(request, dataId)) {
          return new Response("assinatura inválida", { status: 401 });
        }
        if (dataId) {
          try {
            if (type === "payment") await syncMpPayment(dataId);
            else if (type === "subscription_preapproval" || type === "preapproval") {
              const { syncPreapproval } = await import("./lib/payments");
              await syncPreapproval(dataId);
            } else if (type === "subscription_authorized_payment" || type === "authorized_payment") {
              const { syncAuthorizedPayment } = await import("./lib/payments");
              await syncAuthorizedPayment(dataId);
            }
          } catch (e) {
            console.error(`webhook: falha ao sincronizar ${type}`, e);
            return new Response("erro", { status: 500 }); // o Mercado Pago tenta de novo
          }
        }
        return new Response("ok");
      }

      // Planos: preços, se a assinatura está aberta para esta pessoa e a assinatura atual
      if (pathname === "/api/planos" && request.method === "GET") {
        const { getPaymentConfig, paymentsOpenFor, getActiveSubscription } = await import("./lib/payments");
        const cfg = await getPaymentConfig();
        const { auth } = await import("./lib/auth-server");
        const s = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        let role: string | null = null;
        let current: { plan: string; status: string; priceCents: number; nextPaymentAt: Date | null } | null = null;
        if (s?.user) {
          const { prisma: prismaPl } = await import("./lib/prisma");
          role = (await prismaPl.profile.findUnique({ where: { id: s.user.id }, select: { role: true } }))?.role ?? null;
          const sub = await getActiveSubscription(s.user.id);
          if (sub) current = { plan: sub.plan, status: sub.status, priceCents: sub.priceCents, nextPaymentAt: sub.nextPaymentAt };
        }
        return new Response(
          JSON.stringify({
            prices: { fa: cfg.priceFaCents, superfa: cfg.priceSuperFaCents },
            available: await paymentsOpenFor(role),
            testMode: await (await import("./lib/payments")).paymentsTestMode(),
            loggedIn: !!s?.user,
            current,
          }),
          { headers: { "content-type": "application/json", "cache-control": "private, no-store" } },
        );
      }

      // Assinar Fã ou Super Fã (precisa de login)
      if (pathname === "/api/pagamentos/assinatura" && request.method === "POST") {
        const json = (h: Record<string, unknown>, status = 200) =>
          new Response(JSON.stringify(h), { status, headers: { "content-type": "application/json" } });
        const { auth } = await import("./lib/auth-server");
        const s = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!s?.user) return json({ error: "Entre na sua conta para assinar." }, 401);
        if (!(await rateLimit(`assinatura:user:${s.user.id}`, 10, 60 * 60))) {
          return tooManyRequests("Muitas tentativas. Aguarde e tente de novo.");
        }
        const { prisma: prismaA } = await import("./lib/prisma");
        const prof = await prismaA.profile.findUnique({ where: { id: s.user.id }, select: { role: true, suspended: true } });
        const { paymentsOpenFor, createSubscriptionCheckout } = await import("./lib/payments");
        if (!(await paymentsOpenFor(prof?.role))) return json({ error: "Os planos abrem em breve." }, 503);
        if (prof?.suspended) return json({ error: "Conta suspensa." }, 403);
        const body = (await request.json().catch(() => ({}))) as { plano?: string; email?: string };
        const plan = body.plano === "superfa" ? "superfa" : body.plano === "fa" ? "fa" : null;
        if (!plan) return json({ error: "Plano inválido." }, 400);
        const email = String(body.email ?? s.user.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: "Informe um e-mail válido." }, 400);
        try {
          const { checkoutUrl } = await createSubscriptionCheckout({ userId: s.user.id, plan, payerEmail: email });
          return json({ checkoutUrl });
        } catch (e) {
          console.error("assinatura: falha ao criar", e);
          return json({ error: "Não foi possível abrir a assinatura agora. Confira o e-mail da sua conta no Mercado Pago e tente de novo." }, 502);
        }
      }

      // Cancelar a própria assinatura
      if (pathname === "/api/pagamentos/assinatura/cancelar" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const s = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!s?.user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        const { cancelUserSubscription } = await import("./lib/payments");
        try {
          const ok = await cancelUserSubscription(s.user.id);
          return new Response(JSON.stringify({ ok }), { headers: { "content-type": "application/json" } });
        } catch (e) {
          console.error("assinatura: falha ao cancelar", e);
          return new Response(JSON.stringify({ error: "Não foi possível cancelar agora. Tente de novo." }), { status: 502, headers: { "content-type": "application/json" } });
        }
      }

      // Situação da assinatura (página de retorno); consulta o Mercado Pago direto
      if (pathname === "/api/pagamentos/assinatura/status" && request.method === "GET") {
        const id = new URL(request.url).searchParams.get("preapproval_id") ?? "";
        const { auth } = await import("./lib/auth-server");
        const s = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!s?.user || !/^[a-zA-Z0-9-]{6,80}$/.test(id)) {
          return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
        }
        const { syncPreapproval, getSubscriptionByPreapproval } = await import("./lib/payments");
        await syncPreapproval(id).catch(() => {});
        const sub = await getSubscriptionByPreapproval(id);
        if (!sub || sub.userId !== s.user.id) {
          return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ status: sub.status, plan: sub.plan, priceCents: sub.priceCents }), {
          headers: { "content-type": "application/json", "cache-control": "private, no-store" },
        });
      }

      // Situação de uma cobrança (página de retorno)
      if (pathname === "/api/pagamentos/status" && request.method === "GET") {
        const ref = new URL(request.url).searchParams.get("ref") ?? "";
        const mpId = new URL(request.url).searchParams.get("payment_id");
        const { getPaymentStatus, syncMpPayment, paymentsEnabled } = await import("./lib/payments");
        // Se o leitor voltou antes do aviso chegar, consulta o Mercado Pago direto
        if (mpId && /^\d+$/.test(mpId) && paymentsEnabled()) await syncMpPayment(mpId).catch(() => {});
        const p = ref ? await getPaymentStatus(ref) : null;
        if (!p) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify(p), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
      }

      // Admin: regra de taxa, últimos pagamentos e repasses pendentes
      if (pathname === "/api/admin/pagamentos" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { getPaymentConfig, listPayments, pendingPayouts, paymentsEnabled } = await import("./lib/payments");
        const [config, payments, payouts] = await Promise.all([getPaymentConfig(), listPayments(50), pendingPayouts()]);
        const { paymentsTestMode } = await import("./lib/payments");
        const testMode = await paymentsTestMode();
        return new Response(JSON.stringify({ config, payments, payouts, enabled: paymentsEnabled(), testMode }), {
          headers: { "content-type": "application/json", "cache-control": "private, no-store" },
        });
      }
      if (pathname === "/api/admin/pagamentos/config" && request.method === "POST") {
        const { error, actorId, actorEmail } = await requireAdmin(request);
        if (error) return error;
        const body = (await request.json().catch(() => ({}))) as {
          feeRate?: number;
          feeMode?: string;
          priceFaCents?: number;
          priceSuperFaCents?: number;
        };
        const { savePaymentConfig } = await import("./lib/payments");
        const saved = await savePaymentConfig({
          feeRate: Number(body.feeRate ?? 0.12),
          feeMode: (body.feeMode ?? "descontada") as "descontada",
          priceFaCents: Number(body.priceFaCents ?? 990),
          priceSuperFaCents: Number(body.priceSuperFaCents ?? 1990),
        });
        const { insertAuditLog } = await import("./lib/beyond-db");
        await insertAuditLog({
          action: "payment_config",
          workSlug: "",
          workTitle: "",
          actorId: actorId ?? "",
          actorEmail: actorEmail ?? "",
          note: `Taxa ${Math.round(saved.feeRate * 1000) / 10}%, modo ${saved.feeMode}, Fã R$ ${(saved.priceFaCents / 100).toFixed(2)}, Super Fã R$ ${(saved.priceSuperFaCents / 100).toFixed(2)}`,
        }).catch(() => {});
        return new Response(JSON.stringify(saved), { headers: { "content-type": "application/json" } });
      }
      if (pathname === "/api/admin/pagamentos/repasse" && request.method === "POST") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { artistSlug } = (await request.json().catch(() => ({}))) as { artistSlug?: string };
        if (!artistSlug) return new Response(JSON.stringify({ error: "artistSlug obrigatório" }), { status: 400, headers: { "content-type": "application/json" } });
        const { markPayoutDone } = await import("./lib/payments");
        const count = await markPayoutDone(artistSlug);
        return new Response(JSON.stringify({ ok: true, count }), { headers: { "content-type": "application/json" } });
      }

      // Card "Apoie o autor": nome, foto e posição no ranking de autores da semana (público).
      // A posição vale para a lista inteira de autores, não só para o top 50.
      const apoioMatch = pathname.match(/^\/api\/apoio\/autor\/([^/]+)$/);
      if (apoioMatch && request.method === "GET") {
        const slug = decodeURIComponent(apoioMatch[1]!);
        const { fetchRanking, getAuthorBio } = await import("./lib/beyond-db");
        const ranking = await fetchRanking(100_000).catch(() => null);
        const idx = ranking ? ranking.authors.findIndex((a) => a.slug === slug) : -1;
        const a = idx >= 0 ? ranking!.authors[idx]! : null;
        let name = a?.name ?? "";
        let avatarUrl = a?.avatarUrl ?? "";
        if (!a) {
          const { prisma: prismaAp } = await import("./lib/prisma");
          const w = await prismaAp.work.findFirst({ where: { artistSlug: slug, status: "approved" }, select: { artistName: true, authorId: true } });
          if (!w) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
          name = w.artistName;
          avatarUrl = (await getAuthorBio(w.authorId)).avatarUrl;
        }
        return new Response(JSON.stringify({ name, avatarUrl, rank: idx >= 0 ? idx + 1 : null }), {
          headers: { "content-type": "application/json", "cache-control": PUBLIC_API_CACHE },
        });
      }

// Configurações públicas do site (Instagram, contato, etc.)
      if (pathname === "/api/site-config") {
        if (request.method === "GET") {
          const { getSiteConfig } = await import("./lib/beyond-db");
          const cfg = await getSiteConfig();
          return new Response(JSON.stringify(cfg), {
            headers: { "content-type": "application/json" },
          });
        }
        if (request.method === "POST") {
          const { error } = await requireAdmin(request);
          if (error) return error;
          const { saveSiteConfig } = await import("./lib/beyond-db");
          const body = (await request.json()) as Record<string, string>;
          await saveSiteConfig(body);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
          });
        }
      }

      // Destaque Beyond — obras selecionadas para o hero carousel
      if (pathname === "/api/destaque") {
        if (request.method === "GET") {
          const { getDestaqueWorks } = await import("./lib/beyond-db");
          const slugs = await getDestaqueWorks();
          return new Response(JSON.stringify(slugs), { headers: { "content-type": "application/json", "cache-control": PUBLIC_API_CACHE } });
        }
        if (request.method === "POST") {
          const { error } = await requireAdmin(request);
          if (error) return error;
          const { slugs } = (await request.json()) as { slugs: string[] };
          const { setDestaqueWorks } = await import("./lib/beyond-db");
          await setDestaqueWorks(slugs);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
      }

      // Carrossel — leitura pública / gestão admin
      if (pathname === "/api/carousel") {
        if (request.method === "GET") {
          const { getCarouselItems } = await import("./lib/beyond-db");
          const items = await getCarouselItems();
          return new Response(JSON.stringify(items), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "POST") {
          const { error } = await requireAdmin(request);
          if (error) return error;
          const { createCarouselItem } = await import("./lib/beyond-db");
          const body = (await request.json()) as Parameters<typeof createCarouselItem>[0];
          const item = await createCarouselItem(body);
          return new Response(JSON.stringify(item), { headers: { "content-type": "application/json" } });
        }
      }

      if (pathname.startsWith("/api/carousel/reorder") && request.method === "POST") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { ids } = (await request.json()) as { ids: string[] };
        const { reorderCarouselItems } = await import("./lib/beyond-db");
        await reorderCarouselItems(ids);
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      const carouselItemMatch = pathname.match(/^\/api\/carousel\/([^/]+)$/);
      if (carouselItemMatch) {
        const id = carouselItemMatch[1];
        if (request.method === "PATCH") {
          const { error } = await requireAdmin(request);
          if (error) return error;
          const body = (await request.json()) as Record<string, unknown>;
          const { updateCarouselItem } = await import("./lib/beyond-db");
          await updateCarouselItem(id, body as Parameters<typeof updateCarouselItem>[1]);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "DELETE") {
          const { error } = await requireAdmin(request);
          if (error) return error;
          const { deleteCarouselItem } = await import("./lib/beyond-db");
          await deleteCarouselItem(id);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
      }

      // Envio direto do PDF da obra para o Blob (navegador → Blob), até 100 MB, só autores aprovados
      if (pathname === "/api/upload/presign" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        const { prisma: prismaUp } = await import("./lib/prisma");
        const prof = await prismaUp.profile.findUnique({ where: { id: session.user.id }, select: { role: true, suspended: true } });
        if (!prof || prof.suspended || !["author", "gerente", "admin", "owner"].includes(prof.role)) {
          return new Response(JSON.stringify({ error: "Apenas autores aprovados podem enviar obras." }), { status: 403, headers: { "content-type": "application/json" } });
        }
        if (!(await rateLimit(`presign:user:${session.user.id}`, 60, 60 * 60))) {
          return tooManyRequests("Muitos envios em pouco tempo. Aguarde e tente de novo.");
        }
        const { handleUploadPresigned } = await import("@vercel/blob/client");
        const { issueSignedToken } = await import("@vercel/blob");
        const { MAX_WORK_PDF_BYTES } = await import("./lib/security");
        try {
          const result = await handleUploadPresigned({
            body: (await request.json()) as import("@vercel/blob/client").HandleUploadPresignedBody,
            request,
            getSignedToken: async (pathname) => {
              if (!/^obras\/[a-zA-Z0-9._-]{1,120}\.pdf$/.test(pathname)) throw new Error("Nome de arquivo inválido");
              const opts = { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_WORK_PDF_BYTES };
              const token = await issueSignedToken({ pathname, operations: ["put"], validUntil: Date.now() + 15 * 60_000, ...opts });
              return { token, urlOptions: { ...opts, addRandomSuffix: true } };
            },
          });
          return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
        } catch (e) {
          console.error("presign falhou:", e);
          return new Response(JSON.stringify({ error: "Não foi possível autorizar o envio. Tente de novo." }), { status: 400, headers: { "content-type": "application/json" } });
        }
      }

      // Upload de arquivo (PDF de obra) → Vercel Blob
      if (pathname === "/api/upload" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        if (!(await rateLimit(`upload:user:${session.user.id}`, 40, 60 * 60))) {
          return tooManyRequests("Muitos envios em pouco tempo. Aguarde e tente de novo.");
        }
        const uploadError = (msg: string, status = 400) =>
          new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } });
        try {
          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          if (!file) return uploadError("Nenhum arquivo enviado.");
          if (file.size > MAX_UPLOAD_BYTES) return uploadError("Arquivo grande demais. O limite é 4,5 MB.");
          // Tipo real pelo conteúdo: só imagens (JPG, PNG, GIF, WebP, AVIF) e PDF — nada de SVG/HTML
          const bytes = new Uint8Array(await file.arrayBuffer());
          const kind = detectFileType(bytes.subarray(0, 80));
          if (!kind) return uploadError("Formato não aceito. Envie JPG, PNG, WebP, GIF, AVIF ou PDF.");
          // Arquivo da obra: só PDF (lido no visor do site, sem download). Capa: só imagem.
          const purpose = String(formData.get("purpose") ?? "");
          if (purpose === "work" && kind.type !== "application/pdf") return uploadError("O arquivo da obra precisa ser PDF.");
          if (purpose === "cover" && !kind.type.startsWith("image/")) return uploadError("A capa precisa ser uma imagem JPG, PNG ou WebP.");
          if (kind.ext === "epub") return uploadError("EPUB não é aceito. Envie a obra em PDF.");
          const { put } = await import("@vercel/blob");
          const base = file.name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "arquivo";
          const blob = await put(`${base}.${kind.ext}`, new Blob([bytes], { type: kind.type }), {
            access: "private",
            addRandomSuffix: true,
            contentType: kind.type,
          });
          return new Response(JSON.stringify({ url: blob.url }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: unknown) {
          console.error("upload falhou:", e);
          return uploadError("Não foi possível enviar o arquivo agora. Tente de novo.", 500);
        }
      }

      // Submeter obra (autor autenticado)
      if (pathname === "/api/works" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { prisma: prismaW } = await import("./lib/prisma");
        const authorProfile = await prismaW.profile.findUnique({ where: { id: session.user.id }, select: { role: true, suspended: true } });
        if (!authorProfile || authorProfile.suspended || !["author", "gerente", "admin", "owner"].includes(authorProfile.role)) {
          return new Response(JSON.stringify({ error: "Apenas autores aprovados podem publicar obras." }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
        const { submitWork, toAuthorStatus } = await import("./lib/beyond-db");
        const body = (await request.json()) as {
          title: string; medium: string; artistName: string;
          excerpt?: string; body?: string; tags?: string;
          pdfUrl?: string | null; previewUrl?: string | null; pdfPages?: number; chapterNumber?: number; chapterTitle?: string;
          coverUrl?: string | null; status?: "pending" | "draft";
        };
        // Toda obra é PDF: o arquivo precisa existir na nossa loja, ser PDF de verdade e caber no limite
        const { verifyStoredPdf } = await import("./lib/pdf-storage");
        const pdfCheck = body.pdfUrl ? await verifyStoredPdf(body.pdfUrl) : { ok: false as const, error: "Envie o PDF da obra." };
        if (!pdfCheck.ok) {
          return new Response(JSON.stringify({ error: pdfCheck.error }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const { blobUrlInUse, createInitialChapter } = await import("./lib/chapters");
        if (body.pdfUrl && (await blobUrlInUse(body.pdfUrl))) {
          return new Response(JSON.stringify({ error: "Envie um PDF novo." }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const { cleanTags } = await import("./lib/beyond-db");
        const tagList = cleanTags(body.tags);
        if (toAuthorStatus(body.status) === "pending" && tagList.length === 0) {
          return new Response(JSON.stringify({ error: "Escolha pelo menos um gênero para a obra." }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const previewCheck = body.previewUrl && !(await blobUrlInUse(body.previewUrl)) ? await verifyStoredPdf(body.previewUrl) : null;
        const submitted = await submitWork({
          authorId: session.user.id,
          title: body.title ?? "",
          medium: (body.medium ?? "livro") as import("./lib/beyond-data").Medium,
          artistName: body.artistName ?? session.user.name ?? "",
          excerpt: body.excerpt ?? "",
          body: "",
          tags: tagList.join(", "),
          pdfUrl: body.pdfUrl ?? null,
          previewUrl: previewCheck?.ok ? body.previewUrl ?? null : null,
          pdfPages: Number.isInteger(body.pdfPages) && (body.pdfPages ?? 0) > 0 && (body.pdfPages ?? 0) < 5000 ? body.pdfPages! : null,
          coverUrl: body.coverUrl ?? null,
          status: toAuthorStatus(body.status),
        });
        // O PDF enviado vira o primeiro capítulo (com o número que o autor escolheu)
        await createInitialChapter({
          workId: submitted.id,
          number: Number(body.chapterNumber ?? 1),
          title: body.chapterTitle ?? null,
          pdfUrl: body.pdfUrl!,
          previewUrl: previewCheck?.ok ? body.previewUrl ?? null : null,
          pdfPages: Number.isInteger(body.pdfPages) && (body.pdfPages ?? 0) > 0 ? body.pdfPages! : null,
        });
        const { insertAuditLog } = await import("./lib/beyond-db");
        await insertAuditLog({
          action: "work_created",
          workSlug: submitted.slug,
          workTitle: body.title ?? "",
          actorId: session.user.id,
          actorEmail: session.user.email,
          note: null,
        }).catch(() => {});
        if (toAuthorStatus(body.status) === "pending") {
          const { pushEvent: pushWork } = await import("./lib/pusher");
          void pushWork({ event: "work-submitted", data: { title: body.title ?? "", artistName: body.artistName ?? "" } });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      // ── Capítulos ───────────────────────────────────────────────────────────

      // Autor: capítulos da própria obra (com pedidos de troca pendentes)
      const capListMatch = pathname.match(/^\/api\/works\/([^/]+)\/capitulos$/);
      if (capListMatch && (request.method === "GET" || request.method === "POST")) {
        const json = (h: unknown, status = 200) => new Response(JSON.stringify(h), { status, headers: { "content-type": "application/json" } });
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) return json({ error: "Não autorizado" }, 401);
        const { prisma: prismaCh } = await import("./lib/prisma");
        const work = await prismaCh.work.findFirst({ where: { id: capListMatch[1]!, authorId: session.user.id }, select: { id: true, status: true } });
        if (!work) return json({ error: "Obra não encontrada" }, 404);
        const chapters = await import("./lib/chapters");
        if (request.method === "GET") {
          const { info } = await chapters.listChapters(work.id);
          const pending = await prismaCh.workRevision.findMany({ where: { workId: work.id, status: "pending" }, select: { kind: true, chapterId: true, createdAt: true } });
          const pendingNew = await chapters.pendingChapterNumbers(work.id);
          return json({ status: work.status, chapters: info, pending, pendingNew });
        }
        if (!(await rateLimit(`capitulo:user:${session.user.id}`, 30, 60 * 60))) return tooManyRequests("Muitos envios em pouco tempo.");
        const body = (await request.json().catch(() => ({}))) as { number?: number; title?: string; pdfUrl?: string; previewUrl?: string; pdfPages?: number };
        const { verifyStoredPdf } = await import("./lib/pdf-storage");
        if (!body.pdfUrl) return json({ error: "Envie o PDF do capítulo." }, 400);
        const check = await verifyStoredPdf(body.pdfUrl);
        if (!check.ok) return json({ error: check.error }, 400);
        if (await chapters.blobUrlInUse(body.pdfUrl)) return json({ error: "Envie um PDF novo." }, 400);
        const previewOk = body.previewUrl && !(await chapters.blobUrlInUse(body.previewUrl)) && (await verifyStoredPdf(body.previewUrl)).ok;
        try {
          const r = await chapters.createChapter({
            workId: work.id,
            authorId: session.user.id,
            number: Number(body.number),
            title: body.title ?? null,
            pdfUrl: body.pdfUrl,
            previewUrl: previewOk ? body.previewUrl! : null,
            pdfPages: Number.isInteger(body.pdfPages) && body.pdfPages! > 0 && body.pdfPages! < 5000 ? body.pdfPages! : null,
          });
          return json({ ok: true, number: r.number });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Não foi possível publicar o capítulo." }, 400);
        }
      }

      // Autor: pedir troca do PDF de um capítulo (vale depois da curadoria)
      const capRevMatch = pathname.match(/^\/api\/capitulos\/([^/]+)\/revisao$/);
      if (capRevMatch && request.method === "POST") {
        const json = (h: unknown, status = 200) => new Response(JSON.stringify(h), { status, headers: { "content-type": "application/json" } });
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) return json({ error: "Não autorizado" }, 401);
        const body = (await request.json().catch(() => ({}))) as { pdfUrl?: string; previewUrl?: string; pdfPages?: number; title?: string };
        const chapters = await import("./lib/chapters");
        const { verifyStoredPdf } = await import("./lib/pdf-storage");
        const wantsTitle = typeof body.title === "string";
        if (!body.pdfUrl && !wantsTitle) return json({ error: "Envie o PDF novo ou o nome novo." }, 400);
        const revData: import("./lib/chapters").ChapterRevisionData = {};
        if (body.pdfUrl) {
          const check = await verifyStoredPdf(body.pdfUrl);
          if (!check.ok) return json({ error: check.error }, 400);
          if (await chapters.blobUrlInUse(body.pdfUrl)) return json({ error: "Envie um PDF novo." }, 400);
          const previewOk = body.previewUrl && !(await chapters.blobUrlInUse(body.previewUrl)) && (await verifyStoredPdf(body.previewUrl)).ok;
          revData.pdfUrl = body.pdfUrl;
          revData.previewUrl = previewOk ? body.previewUrl! : null;
          revData.pdfPages = Number.isInteger(body.pdfPages) && body.pdfPages! > 0 ? body.pdfPages! : null;
        }
        if (wantsTitle) revData.title = chapters.cleanChapterTitle(body.title);
        try {
          await chapters.requestChapterRevision(capRevMatch[1]!, session.user.id, revData);
          return json({ ok: true, review: true });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Não foi possível enviar." }, 400);
        }
      }

      // Admin: alterações pendentes (nome, sinopse, capa, PDF de capítulo)
      if (pathname === "/api/admin/revisoes" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { listPendingRevisions } = await import("./lib/chapters");
        return new Response(JSON.stringify(await listPendingRevisions()), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
      }
      const revDecMatch = pathname.match(/^\/api\/admin\/revisoes\/([^/]+)$/);
      if (revDecMatch && request.method === "POST") {
        const { error, actorId } = await requireAdmin(request);
        if (error) return error;
        const body = (await request.json().catch(() => ({}))) as { aprovar?: boolean; nota?: string };
        const { decideRevision } = await import("./lib/chapters");
        try {
          await decideRevision(revDecMatch[1]!, body.aprovar === true, actorId ?? "", body.nota?.slice(0, 500) || null);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 400, headers: { "content-type": "application/json" } });
        }
      }

      // Notificações de quem está logado
      if (pathname === "/api/notificacoes" && (request.method === "GET" || request.method === "POST")) {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) return new Response(JSON.stringify({ unread: 0, items: [] }), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
        const { listNotifications, markNotificationsRead } = await import("./lib/chapters");
        if (request.method === "POST") await markNotificationsRead(session.user.id);
        return new Response(JSON.stringify(await listNotifications(session.user.id)), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
      }

      // Favoritos para a home (obras com capítulo novo primeiro)
      if (pathname === "/api/favoritos" && request.method === "GET") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) return new Response("[]", { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
        const { favoritesForHome } = await import("./lib/chapters");
        return new Response(JSON.stringify(await favoritesForHome(session.user.id)), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
      }

      // Autor: atualizar obra própria (título, tipo, despublicar/republicar)
      const authorWorkMatch = pathname.match(/^\/api\/works\/([^/]+)$/);
      if (authorWorkMatch && request.method === "PATCH") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        const workId = authorWorkMatch[1]!;
        const body = (await request.json()) as { title?: string; medium?: string; excerpt?: string; coverUrl?: string; tags?: string; workStatus?: string; status?: "pending" | "draft" };
        if (body.workStatus !== undefined && !["andamento", "finalizado", "paralisado"].includes(body.workStatus)) {
          return new Response(JSON.stringify({ error: "Situação inválida." }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const { updateAuthorWork, insertAuditLog, cleanTags } = await import("./lib/beyond-db");
        // Gêneros nunca vazios
        if (body.tags !== undefined) {
          const list = cleanTags(body.tags);
          if (list.length === 0) {
            return new Response(JSON.stringify({ error: "Escolha pelo menos um gênero." }), { status: 400, headers: { "content-type": "application/json" } });
          }
          body.tags = list.join(", ");
        }
        const { prisma: prismaEd } = await import("./lib/prisma");
        const current = await prismaEd.work.findFirst({ where: { id: workId, authorId: session.user.id }, select: { status: true } });
        if (!current) return new Response(JSON.stringify({ error: "Obra não encontrada." }), { status: 404, headers: { "content-type": "application/json" } });
        // Obra no ar: despublicar também passa pela curadoria (continua no ar até a aprovação)
        if (current.status === "approved" && body.status === "draft") {
          const { requestWorkRevision } = await import("./lib/chapters");
          await requestWorkRevision(workId, session.user.id, { unpublish: true });
          return new Response(JSON.stringify({ ok: true, review: true }), { headers: { "content-type": "application/json" } });
        }
        if (current.status === "approved") delete body.status; // já está no ar
        // Obra no ar: nome, sinopse, capa, formato, situação e gêneros passam pela curadoria (a versão atual segue no ar)
        if (current.status === "approved" && (body.title !== undefined || body.medium !== undefined || body.excerpt !== undefined || body.coverUrl !== undefined || body.workStatus !== undefined || body.tags !== undefined)) {
          const { requestWorkRevision, blobUrlInUse } = await import("./lib/chapters");
          if (body.coverUrl && (await blobUrlInUse(body.coverUrl))) {
            return new Response(JSON.stringify({ error: "Envie uma capa nova." }), { status: 400, headers: { "content-type": "application/json" } });
          }
          await requestWorkRevision(workId, session.user.id, {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.medium !== undefined ? { medium: body.medium } : {}),
            ...(body.excerpt !== undefined ? { excerpt: body.excerpt } : {}),
            ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {}),
            ...(body.workStatus !== undefined ? { workStatus: body.workStatus } : {}),
            ...(body.tags !== undefined ? { tags: body.tags } : {}),
          });
          return new Response(JSON.stringify({ ok: true, review: true }), { headers: { "content-type": "application/json" } });
        }
        // Obra ainda fora do ar: a situação muda direto
        if (body.workStatus !== undefined) {
          const { prisma: prismaWs } = await import("./lib/prisma");
          await prismaWs.work.updateMany({
            where: { id: workId, authorId: session.user.id },
            data: { workStatus: body.workStatus as "andamento" | "finalizado" | "paralisado" },
          });
        }
        if (body.title === undefined && body.medium === undefined && body.status === undefined && body.tags === undefined) {
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
        try {
          const updated = await updateAuthorWork(workId, session.user.id, body);
          if (updated && body.title) {
            await insertAuditLog({
              action: "work_edited",
              workSlug: updated.slug,
              workTitle: updated.title,
              actorId: session.user.id,
              actorEmail: session.user.email,
              note: null,
            }).catch(() => {});
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        } catch {
          return new Response(JSON.stringify({ error: "Obra não encontrada ou sem permissão" }), { status: 403, headers: { "content-type": "application/json" } });
        }
      }

      // Formulário de contato → Resend
      if (pathname === "/api/contact" && request.method === "POST") {
        const raw = (await request.json().catch(() => ({}))) as {
          name?: string; email?: string; subject?: string; message?: string;
        };
        const { escapeHtml } = await import("./lib/sanitize");
        const body = {
          name: String(raw.name ?? "").trim().slice(0, 120),
          email: String(raw.email ?? "").trim().slice(0, 254),
          subject: String(raw.subject ?? "").trim().slice(0, 160),
          message: String(raw.message ?? "").trim().slice(0, 5000),
        };
        if (!(await rateLimit(`contact:ip:${clientIp(request)}`, 5, 60 * 60))) {
          return tooManyRequests("Você enviou várias mensagens seguidas. Tente de novo em uma hora.");
        }
        if (!body.name || !body.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
          return new Response(JSON.stringify({ error: "Preencha nome, e-mail válido e mensagem." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Serviço de e-mail não configurado. Escreva diretamente para contato@gobeyondd.com.br" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        if (apiKey) {
          // Notifica equipe
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Go Beyondd <noreply@gobeyondd.com.br>",
              to: "contato@gobeyondd.com.br",
              reply_to: body.email,
              subject: `[Contato] ${(body.subject || "Mensagem").replace(/[\r\n]/g, " ")} — ${body.name.replace(/[\r\n]/g, " ")}`,
              html: `<p><strong>Nome:</strong> ${escapeHtml(body.name)}</p>
                     <p><strong>E-mail:</strong> ${escapeHtml(body.email)}</p>
                     <p><strong>Assunto:</strong> ${escapeHtml(body.subject || "—")}</p>
                     <hr/>
                     <p>${escapeHtml(body.message).replace(/\n/g, "<br>")}</p>`,
            }),
          });
          // Confirma para o remetente
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Go Beyondd <noreply@gobeyondd.com.br>",
              to: body.email,
              subject: "Mensagem recebida — Go Beyondd",
              html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#121519">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#a08d24">Go Beyondd</p>
                <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#f6f6f6">Mensagem recebida</h1>
                <p style="color:#9ba1ab;font-size:15px">Ol&#225;. Recebemos sua mensagem pelo formul&#225;rio do site e responderemos em breve.</p>
                <p style="color:#9ba1ab;font-size:13px;margin-top:12px">Se n&#227;o foi voc&#234; quem enviou, ignore este e-mail.</p>
                <p style="color:#9ba1ab;font-size:13px;margin-top:16px">&#8212; Equipe Go Beyondd</p>
              </div>`,
            }),
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      // ── SEO: robots.txt, sitemap.xml, llms.txt (dinâmicos, seguem SITE_URL) ──

      if (pathname === "/robots.txt") {
        const { SITE_URL } = await import("./lib/site-url");
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /dashboard",
          "Disallow: /perfil",
          "",
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      }

      if (pathname === "/sitemap.xml") {
        const { SITE_URL } = await import("./lib/site-url");
        const { fetchApprovedWorks, fetchDistinctArtists, dbWorkToWork } = await import("./lib/beyond-db");
        const { stripHtml } = await import("./lib/utils");
        const [works, artists] = await Promise.all([
          fetchApprovedWorks().catch(() => []),
          fetchDistinctArtists().catch(() => []),
        ]);
        const esc = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const abs = (u: string) => (u.startsWith("/") ? `${SITE_URL}${u}` : u);
        const url = (path: string, lastmod?: string, image?: { loc: string; title: string }) =>
          `  <url><loc>${esc(`${SITE_URL}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}${
            image ? `<image:image><image:loc>${esc(abs(image.loc))}</image:loc><image:title>${esc(image.title)}</image:title></image:image>` : ""
          }</url>`;
        // Última atualização de cada autor = obra mais recente dele
        const artistMod = new Map<string, string>();
        for (const w of works) {
          const iso = w.updatedAt.toISOString();
          if ((artistMod.get(w.artistSlug) ?? "") < iso) artistMod.set(w.artistSlug, iso);
        }
        const latest = works.reduce((m, w) => (w.updatedAt.toISOString() > m ? w.updatedAt.toISOString() : m), "");
        const mediums = ["livro", "manga", "hq", "conto", "lightnovel", "manhwa", "manhua"];
        const usedMediums = new Set(works.map((w) => w.medium));
        const lines = [
          url("/", latest || undefined),
          url("/explorar", latest || undefined),
          ...mediums.filter((m) => usedMediums.has(m as never)).map((m) => url(`/explorar/${m}`)),
          url("/ranking"),
          url("/biblioteca"),
          url("/planos"),
          url("/sobre"),
          url("/candidatura-autor"),
          url("/contato"),
          url("/termos"),
          url("/privacidade"),
          ...works.map((w) => {
            const cover = dbWorkToWork(w).cover;
            return url(
              `/obra/${encodeURIComponent(w.slug)}`,
              w.updatedAt.toISOString(),
              cover ? { loc: cover, title: stripHtml(w.title) } : undefined,
            );
          }),
          ...artists.filter((a) => a.slug).map((a) => url(`/artist/${encodeURIComponent(a.slug)}`, artistMod.get(a.slug))),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${lines.join("\n")}\n</urlset>\n`;
        return new Response(xml, {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      }

      if (pathname === "/llms.txt") {
        const { SITE_URL } = await import("./lib/site-url");
        const { fetchApprovedWorks } = await import("./lib/beyond-db");
        const { stripHtml } = await import("./lib/utils");
        const { MEDIUM_LABEL } = await import("./lib/beyond-data");
        const works = await fetchApprovedWorks().catch(() => []);
        const oneLine = (s: string, max = 160) => {
          const t = stripHtml(s).replace(/\s+/g, " ").trim();
          return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
        };
        const order = ["livro", "manga", "hq", "conto", "lightnovel", "manhwa", "manhua"] as const;
        const catalog = order
          .map((m) => {
            const list = works.filter((w) => w.medium === m);
            if (list.length === 0) return "";
            const items = list
              .map((w) => {
                const desc = oneLine(w.excerpt);
                return `- [${oneLine(w.title, 120)}](${SITE_URL}/obra/${encodeURIComponent(w.slug)}): de ${w.artistName}${desc ? `. ${desc}` : ""}`;
              })
              .join("\n");
            return `### ${MEDIUM_LABEL[m]}\n${items}`;
          })
          .filter(Boolean)
          .join("\n\n");
        const body = `# Go Beyondd

> Plataforma digital de leitura e publicação autoral de livros, mangás, HQs, contos e novels, com foco em novos talentos brasileiros. Leitura gratuita e apoio direto a quem escreve.

## Para leitores
- Leitura gratuita, com limite diário e anúncios; os planos Fã e Super Fã removem o limite e os anúncios.
- Apoio direto: o leitor pode doar para o autor que gostar; o apoio vai para quem escreveu.
- Planos Fã e Super Fã (em construção): sem anúncios, sem limite diário; o Super Fã inclui acesso antecipado e clube de fãs. Lista de espera aberta.

## Para autores
- Entrada por curadoria humana. As candidaturas de autor abrem em breve, por etapas (lista de espera aberta). Candidatar-se não custa nada.
- Renda: R$ 0,004 por visualização + doações diretas dos leitores.
- A maior parte da receita é do autor; repasse semanal, sem valor mínimo.
- Exclusividade de 6 meses por obra, renovável; depois o autor pode publicar onde quiser.
- A obra continua do autor; a Go Beyondd tem apenas licença para exibi-la.

## Páginas principais
- [Início](${SITE_URL}/): destaques e catálogo por categoria
- [Explorar](${SITE_URL}/explorar): livros, mangás, HQs e contos por categoria
- [Biblioteca clássica](${SITE_URL}/biblioteca): obras em domínio público
- [Ranking](${SITE_URL}/ranking): Top 50 da semana, com as obras e os autores mais lidos
- [Planos](${SITE_URL}/planos): planos Fã e Super Fã (em construção)
- [Publique aqui](${SITE_URL}/candidatura-autor): candidatura de autor (em construção, lista de espera)
- [Quem somos](${SITE_URL}/sobre)
- [Sitemap](${SITE_URL}/sitemap.xml)

## Catálogo
${works.length} obras publicadas, todas com curadoria da equipe. Cada link leva à página da obra, com sinopse, autor e botão de leitura.

${catalog}
`;
        return new Response(body, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      }

      // Ranking semanal (Top 50) de obras e autores — público, igual para todos
      if (pathname === "/api/ranking" && request.method === "GET") {
        const { fetchRanking } = await import("./lib/beyond-db");
        const data = await fetchRanking(50);
        return new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json", "cache-control": PUBLIC_API_CACHE },
        });
      }

      // Página de autores foi substituída pelo ranking
      if (pathname === "/artists") {
        return new Response(null, { status: 301, headers: { location: "/ranking?aba=autores" } });
      }

      // Data de nascimento informada no cadastro (mínimo 13 anos)
      if (pathname === "/api/profile/birthdate" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        const body = (await request.json().catch(() => ({}))) as { birthDate?: string; guardianConsent?: boolean };
        const { ageFromBirthDate } = await import("./lib/age");
        const age = ageFromBirthDate(body.birthDate ?? "");
        if (age === null || age < 13 || age > 120) {
          return new Response(JSON.stringify({ error: "Data de nascimento inválida. É preciso ter pelo menos 13 anos." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (age < 18 && body.guardianConsent !== true) {
          return new Response(JSON.stringify({ error: "Menores de 18 anos precisam da autorização dos responsáveis." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const { saveUserBirth } = await import("./lib/beyond-db");
        await saveUserBirth(session.user.id, body.birthDate!, age < 18);
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      // ── Denúncias (moderação) ────────────────────────────────────────────────
      if (pathname === "/api/reports" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Entre na sua conta para denunciar." }), { status: 401, headers: { "content-type": "application/json" } });
        }
        if (!(await rateLimit(`report:user:${session.user.id}`, 10, 60 * 60))) {
          return tooManyRequests("Você enviou muitas denúncias seguidas. Aguarde um pouco.");
        }
        const body = (await request.json().catch(() => ({}))) as { targetType?: string; targetId?: string; reason?: string; details?: string };
        const { REPORT_REASONS, createReport } = await import("./lib/moderation");
        const targetType = body.targetType ?? "";
        if (!["comment", "work", "author"].includes(targetType) || !body.targetId || !REPORT_REASONS.includes(body.reason ?? "")) {
          return new Response(JSON.stringify({ error: "Denúncia inválida." }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const result = await createReport({
          reporterId: session.user.id,
          targetType: targetType as "comment" | "work" | "author",
          targetId: String(body.targetId).slice(0, 191),
          reason: body.reason!,
          details: String(body.details ?? "").trim().slice(0, 500),
        });
        if (!result.ok) {
          return new Response(JSON.stringify({ error: "Não encontramos o conteúdo denunciado." }), { status: 404, headers: { "content-type": "application/json" } });
        }
        if (result.created) {
          const { pushEvent: pushReport } = await import("./lib/pusher");
          void pushReport({ event: "new-report", data: { targetType, reason: body.reason ?? "" } });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      if (pathname === "/api/admin/reports" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const status = new URL(request.url).searchParams.get("status") ?? "open";
        const { fetchReports } = await import("./lib/moderation");
        return new Response(JSON.stringify(await fetchReports(status === "all" ? null : status)), {
          headers: { "content-type": "application/json" },
        });
      }

      const reportActionMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)$/);
      if (reportActionMatch && request.method === "PATCH") {
        const { error, actorId, actorEmail } = await requireAdmin(request);
        if (error) return error;
        const body = (await request.json().catch(() => ({}))) as { action?: string };
        const { applyReportAction } = await import("./lib/moderation");
        const result = await applyReportAction(reportActionMatch[1]!, body.action ?? "", actorId!, actorEmail ?? "");
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), { status: 400, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      // Lista de espera dos planos (Fã/Super Fã) e de autores
      if (pathname === "/api/waitlist" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as { email?: string; plan?: string };
        const email = (body.email ?? "").trim().toLowerCase();
        const plan = ["fa", "superfa", "monthly", "quarterly", "yearly", "author"].includes(body.plan ?? "") ? body.plan! : "";
        if (!(await rateLimit(`waitlist:ip:${clientIp(request)}`, 10, 60 * 60))) {
          return tooManyRequests();
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          return new Response(JSON.stringify({ error: "Informe um e-mail válido." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const session = await (await import("./lib/auth-server")).auth.api
          .getSession({ headers: request.headers })
          .catch(() => null);
        const { addToWaitlist } = await import("./lib/beyond-db");
        try {
          await addToWaitlist({ email, plan, userId: session?.user?.id ?? null });
        } catch (err) {
          console.error("waitlist: falha ao salvar (tabela waitlist_entries existe?)", err);
          return new Response(JSON.stringify({ error: "Não foi possível salvar agora. Tente novamente em instantes." }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      if (pathname === "/api/admin/waitlist" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { fetchWaitlist } = await import("./lib/beyond-db");
        const rows = await fetchWaitlist().catch(() => []);
        return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
      }

      // Bio pública do próprio autor (editar no painel)
      if (pathname === "/api/profile/author-bio") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        const { prisma: prismaBio } = await import("./lib/prisma");
        const bioProfile = await prismaBio.profile.findUnique({ where: { id: session.user.id }, select: { role: true } });
        if (!bioProfile || !["author", "gerente", "admin", "owner"].includes(bioProfile.role)) {
          return new Response(JSON.stringify({ error: "Apenas autores podem editar o perfil público." }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
        if (request.method === "GET") {
          const { getOwnAuthorBio } = await import("./lib/beyond-db");
          return new Response(JSON.stringify(await getOwnAuthorBio(session.user.id)), {
            headers: { "content-type": "application/json" },
          });
        }
        if (request.method === "PATCH") {
          const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
          const httpOnly = (v: string) => (v === "" || /^https?:\/\//i.test(v) ? v : `https://${v}`);
          const data = {
            bio: str(raw["bio"], 1200),
            avatarUrl: str(raw["avatarUrl"], 1000),
            city: str(raw["city"], 80),
            instagram: str(raw["instagram"], 200),
            website: httpOnly(str(raw["website"], 300)),
          };
          const { saveAuthorBio } = await import("./lib/beyond-db");
          try {
            await saveAuthorBio(session.user.id, data);
          } catch (err) {
            console.error("author-bio: falha ao salvar (tabela author_bios existe?)", err);
            return new Response(JSON.stringify({ error: "Não foi possível salvar o perfil agora." }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
      }

      // Candidatura de autor → salva no DB + Resend
      if (pathname === "/api/candidatura" && request.method === "POST") {
        const body = (await request.json()) as {
          artistName: string;
          email: string;
          phone?: string;
          field?: string;
          bio?: string;
          portfolio?: string;
          portfolioFiles?: string;
          portfolioCitations?: string;
          message?: string;
        };
        const { escapeHtml } = await import("./lib/sanitize");
        // Candidaturas em construção: só a equipe envia enquanto estiverem fechadas
        const candSession = await (await import("./lib/auth-server")).auth.api.getSession({ headers: request.headers });
        if (!candSession?.user) {
          return new Response(JSON.stringify({ error: "Faça login para enviar a candidatura." }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        if (!(await rateLimit(`candidatura:user:${candSession.user.id}`, 5, 24 * 60 * 60))) {
          return tooManyRequests("Limite de envios atingido por hoje. Tente amanhã.");
        }
        const { CANDIDATURAS_ABERTAS } = await import("./lib/features");
        if (!CANDIDATURAS_ABERTAS) {
          const { prisma: prismaC } = await import("./lib/prisma");
          const candProfile = await prismaC.profile.findUnique({ where: { id: candSession.user.id }, select: { role: true } });
          if (!candProfile || !["owner", "admin", "gerente"].includes(candProfile.role)) {
            return new Response(JSON.stringify({ error: "As candidaturas abrem em breve. Entre na lista de espera." }), {
              status: 403,
              headers: { "content-type": "application/json" },
            });
          }
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email ?? "")) || !String(body.artistName ?? "").trim()) {
          return new Response(JSON.stringify({ error: "Preencha nome e um e-mail válido." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        // Persiste no banco independente do e-mail
        const { createApplication } = await import("./lib/beyond-db");
        await createApplication({
          userId: candSession.user.id,
          artistName: body.artistName,
          email: body.email,
          phone: body.phone ?? "",
          field: body.field ?? "",
          bio: body.bio ?? "",
          portfolio: body.portfolio ?? "",
          portfolioFiles: body.portfolioFiles ?? "[]",
          portfolioCitations: body.portfolioCitations ?? "",
          samples: 0,
          message: body.message ?? "",
        });
        const { pushEvent } = await import("./lib/pusher");
        void pushEvent({ event: "new-application", data: { artistName: body.artistName, email: body.email } });
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
          // Notifica equipe
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Go Beyondd <noreply@gobeyondd.com.br>",
              to: "contato@gobeyondd.com.br",
              reply_to: body.email,
              subject: `[Candidatura] ${String(body.artistName ?? "").replace(/[\r\n]/g, " ").slice(0, 120)}`,
              html: `<p><strong>Nome:</strong> ${escapeHtml(body.artistName)}</p>
                     <p><strong>E-mail:</strong> ${escapeHtml(body.email)}</p>
                     <p><strong>Telefone:</strong> ${escapeHtml(body.phone ?? "")}</p>
                     <p><strong>Portfólio:</strong> ${escapeHtml(body.portfolio ?? "")}</p>
                     <p><strong>Trechos:</strong> ${escapeHtml(body.portfolioCitations ?? "").replace(/\n/g, "<br>")}</p>
                     <p>Arquivos e detalhes no painel de administração.</p>`,
            }),
          });
          // Confirma para candidato
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Go Beyondd <noreply@gobeyondd.com.br>",
              to: body.email,
              subject: "Candidatura recebida — Go Beyondd",
              html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#121519">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#a08d24">Go Beyondd</p>
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f6f6f6">Candidatura recebida</h1>
                <p style="color:#9ba1ab;font-size:15px">Recebemos a sua candidatura. A curadoria avalia por ordem de chegada.</p>
                <p style="color:#9ba1ab;font-size:15px;margin-top:12px">Prazo: <strong style="color:#f6f6f6">até 15 dias úteis</strong>. Você receberá uma resposta neste e-mail com aprovação ou recusa comentada.</p>
              </div>`,
            }),
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Perfil do leitor: stats consolidadas
      if (pathname === "/api/profile/stats" && request.method === "GET") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { getReaderProfileStats } = await import("./lib/beyond-db");
        const stats = await getReaderProfileStats(session.user.id);
        return new Response(JSON.stringify(stats), {
          headers: { "content-type": "application/json" },
        });
      }

      // Favoritos: toggle
      if (pathname === "/api/favorites" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const gateFav = await birthGate(session.user.id);
        if (gateFav) return gateFav;
        const { workSlug, artistSlug } = (await request.json()) as {
          workSlug: string;
          artistSlug: string;
        };
        const { toggleFavorite } = await import("./lib/beyond-db");
        const result = await toggleFavorite(session.user.id, workSlug, artistSlug);
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      }

      // Favoritos: checar se obra específica é favoritada
      if (pathname.startsWith("/api/favorites/") && request.method === "GET") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ favorited: false }), {
            headers: { "content-type": "application/json" },
          });
        }
        const workSlug = pathname.replace("/api/favorites/", "");
        const { isFavorited } = await import("./lib/beyond-db");
        const favorited = await isFavorited(session.user.id, workSlug);
        return new Response(JSON.stringify({ favorited }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Progresso de leitura: upsert
      if (pathname === "/api/reading-progress" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { workSlug, pagesRead, finished } = (await request.json()) as {
          workSlug: string;
          pagesRead: number;
          finished: boolean;
        };
        const { upsertReadingProgress } = await import("./lib/beyond-db");
        await upsertReadingProgress(session.user.id, workSlug, pagesRead, finished);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Obra individual por slug (público) — usado pelo loader de /obra/$slug
      const workSlugApiMatch = pathname.match(/^\/api\/work\/([^/]+)$/);
      if (workSlugApiMatch && request.method === "GET") {
        const slug = workSlugApiMatch[1];
        const { fetchWorkBySlug, fetchApprovedWorks, dbWorkToWork, dbWorkToCard } = await import("./lib/beyond-db");
        const dbWork = await fetchWorkBySlug(slug);
        if (!dbWork || dbWork.status !== "approved") {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        // Só o 1º parágrafo (prévia); o texto completo vem do leitor
        const full = dbWorkToWork(dbWork);
        const work = { ...full, body: full.body.slice(0, 1), readable: dbWorkToCard(dbWork).readable };
        const allWorks = await fetchApprovedWorks();
        const related = allWorks
          .filter((w) => w.slug !== work.slug && (w.artistSlug === work.artistSlug || w.medium === work.medium))
          .slice(0, 4)
          .map(dbWorkToCard);
        const { listChapters: listWorkChapters, chapterLabel: labelOf } = await import("./lib/chapters");
        const workChapters = (await listWorkChapters(dbWork.id)).info.map((c) => ({
          number: c.number,
          title: labelOf(c.number, c.title),
          date: new Date(c.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
          free: c.free,
          earlyUntil: c.earlyUntil,
        }));
        return new Response(
          JSON.stringify({ work: { ...work, chapters: workChapters }, related, hasBody: !!(dbWork.body?.trim()) || workChapters.length > 0 }),
          { headers: { "content-type": "application/json", "cache-control": PUBLIC_API_CACHE } },
        );
      }

      // Listar obras aprovadas (público)
      if (pathname === "/api/works" && request.method === "GET") {
        const { fetchApprovedWorks, dbWorkToCard } = await import("./lib/beyond-db");
        const rows = await fetchApprovedWorks();
        return new Response(JSON.stringify(rows.map(dbWorkToCard)), {
          headers: { "content-type": "application/json", "cache-control": PUBLIC_API_CACHE },
        });
      }

      // Minhas obras (autor autenticado) — retorna DbWork[] (formato do DB)
      if (pathname === "/api/works/mine" && request.method === "GET") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify([]), { headers: { "content-type": "application/json" } });
        }
        const { fetchMyWorks } = await import("./lib/beyond-db");
        const rows = await fetchMyWorks(session.user.id);
        return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
      }

      // Dashboard do autor — retorna works convertidos para Work[] + donations
      if (pathname === "/api/author/dashboard" && request.method === "GET") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { fetchMyWorks, fetchWorkStats, fetchDonations, dbWorkToWork } = await import("./lib/beyond-db");
        const [rawWorks, stats, allDonations] = await Promise.all([
          fetchMyWorks(session.user.id),
          fetchWorkStats(),
          fetchDonations(),
        ]);
        const works = rawWorks.map(dbWorkToWork);
        const mySlugs = new Set(rawWorks.map((w) => w.slug));
        const donations = allDonations.filter((d) => mySlugs.has(d.workSlug));
        return new Response(JSON.stringify({ works, stats, donations }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Artistas distintos (público, derivados de obras aprovadas)
      if (pathname === "/api/artists" && request.method === "GET") {
        const { fetchDistinctArtists } = await import("./lib/beyond-db");
        const artists = await fetchDistinctArtists();
        return new Response(JSON.stringify(artists), { headers: { "content-type": "application/json", "cache-control": PUBLIC_API_CACHE } });
      }

      // Perfil de artista por slug (obras publicadas)
      const artistProfileMatch = pathname.match(/^\/api\/artists\/([^/]+)$/);
      if (artistProfileMatch && request.method === "GET") {
        const artistSlug = decodeURIComponent(artistProfileMatch[1]!);
        const { fetchWorksByArtistSlug, dbWorkToCard } = await import("./lib/beyond-db");
        const dbWorks = await fetchWorksByArtistSlug(artistSlug);
        if (!dbWorks.length) {
          return new Response(JSON.stringify({ error: "Autor não encontrado" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        const works = dbWorks.map(dbWorkToCard);
        const artistName = dbWorks[0]!.artistName;
        const { getAuthorBio } = await import("./lib/beyond-db");
        const authorId = dbWorks.find((w) => w.authorId)?.authorId ?? null;
        const bio = await getAuthorBio(authorId);
        return new Response(JSON.stringify({ artistName, artistSlug, works, bio }), {
          headers: { "content-type": "application/json", "cache-control": PUBLIC_API_CACHE },
        });
      }

      // Admin: contas
      if (pathname === "/api/accounts" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { fetchAccounts } = await import("./lib/beyond-db");
        const accounts = await fetchAccounts();
        return new Response(JSON.stringify(accounts), { headers: { "content-type": "application/json" } });
      }

      const accountMatch = pathname.match(/^\/api\/accounts\/([^/]+)$/);
      if (accountMatch && request.method === "PATCH") {
        const { error, actorId } = await requireAdmin(request);
        if (error) return error;
        const userId = accountMatch[1]!;
        const body = (await request.json()) as { role?: string; suspended?: boolean };
        const { setUserRole, setSuspended } = await import("./lib/beyond-db");
        const { prisma: prismaA } = await import("./lib/prisma");
        const [actor, target] = await Promise.all([
          prismaA.profile.findUnique({ where: { id: actorId! }, select: { role: true } }),
          prismaA.profile.findUnique({ where: { id: userId }, select: { role: true } }),
        ]);
        const deny = (msg: string) =>
          new Response(JSON.stringify({ error: msg }), { status: 403, headers: { "content-type": "application/json" } });
        const VALID_ROLES = ["owner", "admin", "gerente", "author", "vip", "superfa", "reader"];
        const PRIVILEGED = ["owner", "admin"];
        const actorIsOwner = actor?.role === "owner";
        if (!target) {
          return new Response(JSON.stringify({ error: "Conta não encontrada" }), { status: 404, headers: { "content-type": "application/json" } });
        }
        // Só o dono mexe em contas de dono/admin ou concede esses papéis; ninguém altera o próprio papel
        if (PRIVILEGED.includes(target.role) && !actorIsOwner) return deny("Apenas o dono pode alterar esta conta.");
        if (typeof body.role === "string") {
          if (!VALID_ROLES.includes(body.role)) return deny("Papel inválido.");
          if (userId === actorId) return deny("Você não pode alterar o próprio papel.");
          if (PRIVILEGED.includes(body.role) && !actorIsOwner) return deny("Apenas o dono pode conceder este papel.");
          if (body.role === "gerente" && actor?.role === "gerente") return deny("Gerentes não podem promover outros gerentes.");
          await setUserRole(userId, body.role as import("./lib/auth").AppRole);
        }
        if (typeof body.suspended === "boolean") {
          await setSuspended(userId, body.suspended);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      // Admin: candidaturas
      if (pathname === "/api/applications" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { fetchApplications } = await import("./lib/beyond-db");
        const apps = await fetchApplications();
        return new Response(JSON.stringify(apps), { headers: { "content-type": "application/json" } });
      }

      const appMatch = pathname.match(/^\/api\/applications\/([^/]+)$/);
      if (appMatch) {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const appId = appMatch[1]!;
        if (request.method === "PATCH") {
          const { status, note } = (await request.json()) as { status: string; note?: string };
          const { decideApplication } = await import("./lib/beyond-db");
          const { email, artistName } = await decideApplication(appId, status as "approved" | "rejected" | "changes", note);
          const apiKey = process.env["RESEND_API_KEY"];
          if (apiKey && email) {
            const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
            const safeName = esc(artistName);
            const safeNote = note ? esc(note) : "";
            const subjects: Record<string, string> = {
              approved: "Candidatura aprovada — Go Beyondd",
              rejected: "Resposta à sua candidatura — Go Beyondd",
              changes: "Ajustes solicitados — Go Beyondd",
            };
            const bodies: Record<string, string> = {
              approved: `Olá, ${safeName}!<br><br>Sua candidatura à <strong>Go Beyondd</strong> foi <strong>aprovada</strong>. Acesse o Painel do Autor para começar a publicar suas obras:<br><br><a href="https://www.gobeyondd.com.br/dashboard">Painel do Autor</a><br><br>Bem-vindo(a) à plataforma!<br><em>Equipe Go Beyondd</em>`,
              rejected: `Olá, ${safeName}.<br><br>Agradecemos o interesse em fazer parte da <strong>Go Beyondd</strong>. Após análise cuidadosa, não foi possível aprovar sua candidatura neste momento.${safeNote ? `<br><br><em>Nota da curadoria: ${safeNote}</em>` : ""}<br><br>Você poderá candidatar-se novamente no futuro.<br><em>Equipe Go Beyondd</em>`,
              changes: `Olá, ${safeName}.<br><br>Sua candidatura à <strong>Go Beyondd</strong> precisa de alguns ajustes antes de ser aprovada.${safeNote ? `<br><br><em>Nota da curadoria: ${safeNote}</em>` : ""}<br><br>Por favor, entre em contato conosco para mais informações.<br><em>Equipe Go Beyondd</em>`,
            };
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Go Beyondd <noreply@gobeyondd.com.br>",
                to: [email],
                subject: subjects[status] ?? "Atualização da sua candidatura — Go Beyondd",
                html: bodies[status] ?? "",
              }),
            }).catch(() => {});
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "DELETE") {
          const { deleteApplication } = await import("./lib/beyond-db");
          await deleteApplication(appId);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
      }

      // Admin: obras (todas, para revisão)
      if (pathname === "/api/admin/works" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { fetchAllWorks } = await import("./lib/beyond-db");
        const rows = await fetchAllWorks();
        return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
      }

      const adminWorkMatch = pathname.match(/^\/api\/admin\/works\/([^/]+)$/);
      if (adminWorkMatch) {
        const { error, actorId, actorEmail } = await requireAdmin(request);
        if (error) return error;
        const workId = adminWorkMatch[1]!;
        if (request.method === "PATCH") {
          const { status, note } = (await request.json()) as { status: string; note?: string };
          const { decideWork, insertAuditLog } = await import("./lib/beyond-db");
          const { authorEmail, authorName, title, slug, keptLive } = await decideWork(workId, status as "approved" | "rejected" | "changes", note);
          await insertAuditLog({
            action: status === "approved" ? "work_approved" : status === "rejected" ? "work_rejected" : "work_changes",
            workSlug: slug,
            workTitle: title,
            actorId: actorId!,
            actorEmail: actorEmail!,
            note: note ?? null,
          }).catch(() => {});
          const apiKey = process.env["RESEND_API_KEY"];
          if (apiKey && authorEmail) {
            const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
            const safeName = esc(authorName);
            const safeTitle = esc(title);
            const safeNote = note ? esc(note) : "";
            const subjects: Record<string, string> = {
              approved: `"${title}" foi aprovada — Go Beyondd`,
              rejected: `"${title}" não foi aprovada — Go Beyondd`,
              changes: `Ajustes solicitados para "${title}" — Go Beyondd`,
            };
            const bodies: Record<string, string> = {
              approved: `Olá, ${safeName}.<br><br>Sua obra <strong>${safeTitle}</strong> foi <strong>aprovada</strong> pela curadoria da <strong>Go Beyondd</strong> e já está publicada no feed.<br><br>Obrigado por publicar conosco.<br><em>Equipe Go Beyondd</em>`,
              rejected: `Olá, ${safeName}.<br><br>Após análise, sua obra <strong>${safeTitle}</strong> não foi aprovada neste momento.${safeNote ? `<br><br><em>Nota da curadoria: ${safeNote}</em>` : ""}<br><br><em>Equipe Go Beyondd</em>`,
              changes: keptLive
                ? `Olá, ${safeName}.<br><br>A curadoria pediu alguns ajustes em <strong>${safeTitle}</strong>. A obra continua no ar enquanto isso.${safeNote ? `<br><br><em>Nota da curadoria: ${safeNote}</em>` : ""}<br><br>Faça os ajustes pelo botão Editar no seu painel.<br><em>Equipe Go Beyondd</em>`
                : `Olá, ${safeName}.<br><br>Sua obra <strong>${safeTitle}</strong> precisa de alguns ajustes antes de ser aprovada.${safeNote ? `<br><br><em>Nota da curadoria: ${safeNote}</em>` : ""}<br><br>Por favor, entre em contato conosco para mais informações.<br><em>Equipe Go Beyondd</em>`,
            };
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Go Beyondd <noreply@gobeyondd.com.br>",
                to: [authorEmail],
                subject: subjects[status] ?? "Atualização da sua obra — Go Beyondd",
                html: bodies[status] ?? "",
              }),
            }).catch(() => {});
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "DELETE") {
          const { deleteWork } = await import("./lib/beyond-db");
          await deleteWork(workId);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
      }

      // Admin: estatísticas de receita (views + doações)
      if (pathname === "/api/admin/stats" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { fetchWorkStats } = await import("./lib/beyond-db");
        const stats = await fetchWorkStats();
        return new Response(JSON.stringify(stats), { headers: { "content-type": "application/json" } });
      }

      // Atualizar PDF de uma obra (autor dono ou admin)
      // (troca de PDF agora é por capítulo e passa pela curadoria: /api/capitulos/:id/revisao)

      // ── Quota de leitura ─────────────────────────────────────────────────────

      if (pathname === "/api/quota" && request.method === "GET") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ consumed: 0, limit: 10, remaining: 10 }), {
            headers: { "content-type": "application/json" },
          });
        }
        const { prisma } = await import("./lib/prisma");
        const profile = await prisma.profile.findUnique({ where: { id: session.user.id }, select: { role: true } });
        if (profile && ["vip", "superfa", "author", "gerente", "admin", "owner"].includes(profile.role)) {
          return new Response(JSON.stringify({ consumed: 0, limit: null, remaining: null }), {
            headers: { "content-type": "application/json" },
          });
        }
        const { getReadingQuota } = await import("./lib/beyond-db");
        const quota = await getReadingQuota(session.user.id);
        return new Response(JSON.stringify(quota), { headers: { "content-type": "application/json" } });
      }

      if (pathname === "/api/quota/consume" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ allowed: true, remaining: null }), {
            headers: { "content-type": "application/json" },
          });
        }
        const { prisma } = await import("./lib/prisma");
        const profile = await prisma.profile.findUnique({ where: { id: session.user.id }, select: { role: true } });
        if (profile && ["vip", "superfa", "author", "gerente", "admin", "owner"].includes(profile.role)) {
          return new Response(JSON.stringify({ allowed: true, remaining: null }), {
            headers: { "content-type": "application/json" },
          });
        }
        const { pages = 1 } = (await request.json()) as { pages?: number };
        const { consumeReadingQuota } = await import("./lib/beyond-db");
        const result = await consumeReadingQuota(session.user.id, pages);
        return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
      }

      // ── Resend webhook ───────────────────────────────────────────────────────

      if (pathname === "/api/webhooks/resend" && request.method === "POST") {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        if (secret) {
          const svixId = request.headers.get("svix-id") ?? "";
          const svixTs = request.headers.get("svix-timestamp") ?? "";
          const svixSig = request.headers.get("svix-signature") ?? "";
          const rawBody = await request.text();
          const toSign = `${svixId}.${svixTs}.${rawBody}`;
          const encoder = new TextEncoder();
          const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
          const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
          const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(toSign));
          const computed = `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
          const sigList = svixSig.split(" ");
          if (!sigList.some((s) => s === computed)) {
            return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { "content-type": "application/json" } });
          }
          const payload = JSON.parse(rawBody) as { type?: string; data?: { email_id?: string; to?: string[]; subject?: string } };
          const { createEmailEvent } = await import("./lib/beyond-db");
          await createEmailEvent({
            eventType: payload.type ?? "unknown",
            recipient: payload.data?.to?.[0] ?? "",
            subject: payload.data?.subject ?? "",
            resendId: payload.data?.email_id ?? null,
            payload: rawBody,
          });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      // ── Pusher auth (canais privados) ────────────────────────────────────────

      if (pathname === "/api/pusher/auth" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        const { error } = await requireAdmin(request);
        if (error) return error;
        const formText = await request.text();
        const params = new URLSearchParams(formText);
        const socketId = params.get("socket_id") ?? "";
        const channel = params.get("channel_name") ?? "";
        const { pushEvent: _pe, ...pusherModule } = await import("./lib/pusher");
        void _pe; // suppress unused warning
        const Pusher = require("pusher") as typeof import("pusher").default;
        const appId = process.env["PUSHER_APP_ID"];
        const key = process.env["PUSHER_KEY"];
        const secret = process.env["PUSHER_SECRET"];
        const cluster = process.env["PUSHER_CLUSTER"] ?? "mt1";
        if (!appId || !key || !secret) {
          return new Response(JSON.stringify({ error: "Pusher não configurado" }), { status: 503, headers: { "content-type": "application/json" } });
        }
        const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
        const authResponse = pusher.authorizeChannel(socketId, channel);
        return new Response(JSON.stringify(authResponse), { headers: { "content-type": "application/json" } });
      }

      // ── Admin: eventos de email ───────────────────────────────────────────────

      if (pathname === "/api/admin/email-events" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { fetchEmailEvents } = await import("./lib/beyond-db");
        const events = await fetchEmailEvents(200);
        return new Response(JSON.stringify(events), { headers: { "content-type": "application/json" } });
      }

      // Admin: log de auditoria (imutável, somente leitura)
      if (pathname === "/api/admin/audit-logs" && request.method === "GET") {
        const { error } = await requireAdmin(request);
        if (error) return error;
        const { fetchAuditLogs } = await import("./lib/beyond-db");
        const logs = await fetchAuditLogs(300);
        return new Response(JSON.stringify(logs), { headers: { "content-type": "application/json" } });
      }

      // Registrar visualização de obra
      const workViewMatch = pathname.match(/^\/api\/works\/([^/]+)\/view$/);
      if (workViewMatch && request.method === "POST") {
        const slug = decodeURIComponent(workViewMatch[1]!);
        const { registerWorkView } = await import("./lib/beyond-db");
        const views = await registerWorkView(slug);
        return new Response(JSON.stringify({ views }), { headers: { "content-type": "application/json" } });
      }

      // Like/unlike obra
      const workLikeMatch = pathname.match(/^\/api\/works\/([^/]+)\/like$/);
      if (workLikeMatch) {
        const slug = decodeURIComponent(workLikeMatch[1]!);
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (request.method === "GET") {
          if (!session?.user) {
            const { getWorkLikeCount } = await import("./lib/beyond-db");
            const count = await getWorkLikeCount(slug);
            return new Response(JSON.stringify({ liked: false, count }), { headers: { "content-type": "application/json" } });
          }
          const { getWorkLikeStatus } = await import("./lib/beyond-db");
          const status = await getWorkLikeStatus(session.user.id, slug);
          return new Response(JSON.stringify(status), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "POST") {
          if (!session?.user) {
            return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
          }
          const gateLike = await birthGate(session.user.id);
          if (gateLike) return gateLike;
          const { toggleWorkLike } = await import("./lib/beyond-db");
          const result = await toggleWorkLike(session.user.id, slug);
          return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
        }
      }

      // Comentários de obra
      const workCommentsMatch = pathname.match(/^\/api\/works\/([^/]+)\/comments$/);
      if (workCommentsMatch) {
        const slug = decodeURIComponent(workCommentsMatch[1]!);
        if (request.method === "GET") {
          const { getWorkComments } = await import("./lib/beyond-db");
          const comments = await getWorkComments(slug);
          return new Response(JSON.stringify(comments), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "POST") {
          const { text } = (await request.json()) as { author?: string; text: string };
          if (!text?.trim()) {
            return new Response(JSON.stringify({ error: "Texto obrigatório" }), { status: 400, headers: { "content-type": "application/json" } });
          }
          if (text.trim().length > 500) {
            return new Response(JSON.stringify({ error: "O comentário pode ter no máximo 500 caracteres." }), { status: 400, headers: { "content-type": "application/json" } });
          }
          const { auth } = await import("./lib/auth-server");
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session?.user) {
            return new Response(JSON.stringify({ error: "Faça login para comentar." }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
          const gateComment = await birthGate(session.user.id);
          if (gateComment) return gateComment;
          if (!(await rateLimit(`comment:user:${session.user.id}`, 10, 5 * 60))) {
            return tooManyRequests("Você comentou muitas vezes seguidas. Aguarde alguns minutos.");
          }
          const { addWorkComment } = await import("./lib/beyond-db");
          const comment = await addWorkComment({
            workSlug: slug,
            userId: session?.user?.id ?? null,
            author: session.user.name || "Leitor",
            text: text.trim(),
          });
          const { pushEvent: pushComment } = await import("./lib/pusher");
          void pushComment({ event: "new-comment", data: { workSlug: slug, author: comment.author } });
          return new Response(JSON.stringify(comment), { headers: { "content-type": "application/json" } });
        }
      }

      // Seguir/deixar de seguir artista
      const artistFollowMatch = pathname.match(/^\/api\/artists\/([^/]+)\/follow$/);
      if (artistFollowMatch) {
        const artistSlug = decodeURIComponent(artistFollowMatch[1]!);
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (request.method === "GET") {
          if (!session?.user) {
            return new Response(JSON.stringify({ followed: false }), { headers: { "content-type": "application/json" } });
          }
          const { isArtistFollowed } = await import("./lib/beyond-db");
          const followed = await isArtistFollowed(session.user.id, artistSlug);
          return new Response(JSON.stringify({ followed }), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "POST") {
          if (!session?.user) {
            return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
          }
          const gateFollow = await birthGate(session.user.id);
          if (gateFollow) return gateFollow;
          const { toggleArtistFollow } = await import("./lib/beyond-db");
          const result = await toggleArtistFollow(session.user.id, artistSlug);
          return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
        }
      }

      // ── Leitor web: dados da obra por slug ───────────────────────────────────

      // Arquivo PDF da obra: entregue só para o visor do leitor (fetch do próprio site),
      // nunca como página ou download. Obras licenciadas não têm link de download.
      const pdfMatch = pathname.match(/^\/api\/reader\/([^/]+)\/arquivo$/);
      if (pdfMatch && request.method === "GET") {
        const denied = (status = 404) =>
          new Response("Não disponível", { status, headers: { "cache-control": "private, no-store" } });
        // Abrir o endereço direto no navegador (aba, iframe, embed) ou de outro site: bloqueado
        const dest = request.headers.get("sec-fetch-dest");
        const site = request.headers.get("sec-fetch-site");
        if (!dest || !["empty"].includes(dest)) return denied(403);
        if (site && site !== "same-origin") return denied(403);
        const { prisma: prismaPdf } = await import("./lib/prisma");
        const dbWork = await prismaPdf.work.findUnique({
          where: { slug: decodeURIComponent(pdfMatch[1]!) },
          select: { id: true, status: true, authorId: true },
        });
        if (!dbWork || dbWork.status !== "approved") return denied();
        const { listChapters, chapterAccess } = await import("./lib/chapters");
        const { rows: chRows, info: chInfo } = await listChapters(dbWork.id);
        if (chRows.length === 0) return denied();
        const capParam = new URL(request.url).searchParams.get("cap");
        const capIdx = capParam != null ? chInfo.findIndex((c) => c.number === Number(capParam)) : 0;
        if (capIdx < 0) return denied();
        const wantPreview = new URL(request.url).searchParams.get("previa") === "1";
        const { auth } = await import("./lib/auth-server");
        const sessionPdf = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        const viewerRole = sessionPdf?.user
          ? ((await prismaPdf.profile.findUnique({ where: { id: sessionPdf.user.id }, select: { role: true } }))?.role ?? null)
          : null;
        // Regras: antecipado só Super Fã/autor/equipe; 2 primeiros capítulos para todos; resto com login (prévia sem login)
        const access = chapterAccess(chInfo[capIdx]!, {
          loggedIn: !!sessionPdf?.user,
          role: viewerRole,
          isOwner: !!sessionPdf?.user && dbWork.authorId === sessionPdf.user.id,
        });
        if (access === "early") return denied(403);
        if (!wantPreview && access !== "full") return denied(401);
        const fileUrl = wantPreview ? chRows[capIdx]!.previewUrl : chRows[capIdx]!.pdfUrl;
        if (!fileUrl) return denied();
        // Limite diário de contas gratuitas (não vale para os capítulos grátis)
        if (!wantPreview && sessionPdf?.user && !chInfo[capIdx]!.free) {
          const unlimited = !!viewerRole && ["vip", "superfa", "author", "gerente", "admin", "owner"].includes(viewerRole);
          if (!unlimited) {
            const { getReadingQuota } = await import("./lib/beyond-db");
            const quota = await getReadingQuota(sessionPdf.user.id);
            if (quota.remaining <= 0) return denied(403);
          }
        }
        // Leitura por partes: o visor pede só os pedaços que precisa (Range)
        const range = request.headers.get("range");
        const safeRange = range && /^bytes=\d*-\d*$/.test(range) ? range : null;
        const { get: blobGetPdf } = await import("@vercel/blob");
        const file = await blobGetPdf(fileUrl, { access: "private", ...(safeRange ? { headers: { range: safeRange } } : {}) }).catch(() => null);
        if (!file || file.stream === null) return denied();
        const out = new Headers({
          "content-type": "application/octet-stream",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
          "accept-ranges": "bytes",
        });
        const contentRange = file.headers.get("content-range");
        const contentLength = file.headers.get("content-length");
        if (contentRange) out.set("content-range", contentRange);
        if (contentLength) out.set("content-length", contentLength);
        return new Response(file.stream, { status: contentRange ? 206 : 200, headers: out });
      }

      if (pathname.startsWith("/api/reader/") && request.method === "GET") {
        const slug = pathname.replace("/api/reader/", "").split("/")[0];
        if (!slug) return new Response(JSON.stringify({ error: "Slug inválido" }), { status: 400, headers: { "content-type": "application/json" } });
        const { fetchWorkBySlug, dbWorkToWork } = await import("./lib/beyond-db");
        const dbWork = await fetchWorkBySlug(slug);
        if (!dbWork || dbWork.status !== "approved") {
          return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404, headers: { "content-type": "application/json" } });
        }
        // Obra com capítulos (PDF) abre no visor de PDF, qualquer que seja o formato
        const { listChapters, chapterAccess, chapterLabel } = await import("./lib/chapters");
        const { rows: rdRows, info: rdInfo } = await listChapters(dbWork.id);
        const isPdf = rdRows.length > 0;
        const isWebtoon = !isPdf && ["manhwa", "manhua"].includes(dbWork.medium);
        if (!isWebtoon && !isPdf && !dbWork.body?.trim()) {
          return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404, headers: { "content-type": "application/json" } });
        }
        const { dbWorkToCard } = await import("./lib/beyond-db");
        const work = dbWorkToCard(dbWork);
        const readerMode = isWebtoon ? "webtoon" : isPdf ? "pdf" : "text";
        const noStore = { "content-type": "application/json", "cache-control": "private, no-store" };

        // ?meta=1 → só os dados da obra (usado pelo loader no servidor, sem cookies)
        if (new URL(request.url).searchParams.get("meta") === "1") {
          return new Response(
            JSON.stringify({
              work,
              readerMode,
              chapters: rdInfo.map((c) => ({ number: c.number, label: chapterLabel(c.number, c.title), free: c.free, earlyUntil: c.earlyUntil, hasPreview: c.hasPreview, pdfPages: c.pdfPages })),
            }),
            { headers: noStore },
          );
        }

        // Limite diário conferido no servidor para contas gratuitas logadas.
        // (Visitantes sem conta: controle no navegador por enquanto.)
        let locked = false;
        const { auth } = await import("./lib/auth-server");
        const readerSession = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (readerSession?.user) {
          const { prisma: prismaR } = await import("./lib/prisma");
          const readerProfile = await prismaR.profile.findUnique({ where: { id: readerSession.user.id }, select: { role: true } });
          const unlimited = readerProfile && ["vip", "superfa", "author", "gerente", "admin", "owner"].includes(readerProfile.role);
          if (!unlimited) {
            const { getReadingQuota } = await import("./lib/beyond-db");
            const quota = await getReadingQuota(readerSession.user.id);
            locked = quota.remaining <= 0;
          }
        }

        if (isPdf) {
          // Acesso ao capítulo pedido, com a sessão de quem lê
          const capQ = new URL(request.url).searchParams.get("cap");
          const idx = capQ != null ? rdInfo.findIndex((c) => c.number === Number(capQ)) : 0;
          const ch = rdInfo[idx < 0 ? 0 : idx]!;
          let role: string | null = null;
          if (readerSession?.user) {
            const { prisma: prismaAc } = await import("./lib/prisma");
            role = (await prismaAc.profile.findUnique({ where: { id: readerSession.user.id }, select: { role: true } }))?.role ?? null;
          }
          const access = chapterAccess(ch, {
            loggedIn: !!readerSession?.user,
            role,
            isOwner: !!readerSession?.user && dbWork.authorId === readerSession.user.id,
          });
          return new Response(
            JSON.stringify({ work, readerMode, locked: ch.free ? false : locked, access, chapter: ch.number, free: ch.free, earlyUntil: ch.earlyUntil }),
            { headers: noStore },
          );
        }

        if (isWebtoon) {
          // body armazena JSON com array de URLs de imagem para obras webtoon
          let bodyImages: string[] = [];
          try { bodyImages = JSON.parse(dbWork.body ?? "[]"); } catch {}
          if (locked) bodyImages = bodyImages.slice(0, 2);
          return new Response(JSON.stringify({ work, bodyImages, readerMode, locked }), { headers: noStore });
        }
        const { sanitizeWorkHtml } = await import("./lib/sanitize");
        let bodyHtml = sanitizeWorkHtml(dbWork.body);
        if (locked) {
          // prévia: só o primeiro parágrafo
          const end = bodyHtml.indexOf("</p>");
          bodyHtml = end >= 0 ? bodyHtml.slice(0, end + 4) : bodyHtml.slice(0, 600);
        }
        return new Response(JSON.stringify({ work, bodyHtml, readerMode, locked }), { headers: noStore });
      }

      // ── Proxy de arquivos do Vercel Blob (private store) ─────────────────────

      if (pathname === "/api/blob-proxy" && request.method === "GET") {
        const blobUrl = new URL(request.url).searchParams.get("url");
        if (!blobUrl || !blobUrl.includes("blob.vercel-storage.com")) {
          return new Response("Forbidden", { status: 403 });
        }
        // Quem pode abrir: arquivos públicos (capa/PDF de obra publicada, foto de autor) para todos;
        // portfólios de candidatura só para a equipe ou o próprio candidato; arquivos de obras
        // em revisão só para a equipe ou o autor; uploads ainda não salvos, só para quem está logado.
        const access = await blobAccess(request, blobUrl);
        if (access === "denied") {
          return new Response("Arquivo não encontrado", { status: 404, headers: { "cache-control": "private, no-store" } });
        }
        const { get: blobGet } = await import("@vercel/blob");
        const result = await blobGet(blobUrl, { access: "private" }).catch(() => null);
        if (!result || result.stream === null) {
          return new Response("Arquivo não encontrado", { status: 404 });
        }
        const filename = decodeURIComponent(blobUrl.split("/").pop()?.split("?")[0] ?? "arquivo");
        // Só imagens comuns e PDF aparecem na página; qualquer outro tipo (ex.: SVG antigo) vira download
        const isInline = INLINE_SAFE_TYPES.includes(result.blob.contentType);
        return new Response(result.stream, {
          headers: {
            "content-type": isInline ? result.blob.contentType : "application/octet-stream",
            "content-disposition": `${isInline ? "inline" : "attachment"}; filename="${filename.replace(/["\\\r\n]/g, "")}"`,
            "x-content-type-options": "nosniff",
            // imagens não executam nada; PDF fica sem sandbox para o leitor do navegador funcionar
            ...(result.blob.contentType === "application/pdf"
              ? {}
              : { "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" }),
            // arquivos públicos: cache da CDN (imagens por 1 ano); privados: sem cache compartilhado
            "cache-control":
              access === "public"
                ? result.blob.contentType.startsWith("image/")
                  ? "public, max-age=31536000, s-maxage=31536000, immutable"
                  : "public, max-age=3600, s-maxage=3600"
                : "private, no-store",
          },
        });
      }

      // ── Biblioteca Standard Ebooks ───────────────────────────────────────────

      if (pathname === "/api/biblioteca" && request.method === "GET") {
        const books = await fetchStandardEbooksCatalog();
        return new Response(JSON.stringify(books), {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=14400", // 4h no CDN
          },
        });
      }

      // Proxy de download de EPUB (apenas domínio standardebooks.org)
      if (pathname === "/api/biblioteca/epub" && request.method === "GET") {
        const epubUrl = new URL(request.url).searchParams.get("url");
        if (!epubUrl) {
          return new Response(JSON.stringify({ error: "Parâmetro url obrigatório" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        let parsed: URL;
        try {
          parsed = new URL(epubUrl);
        } catch {
          return new Response(JSON.stringify({ error: "URL inválida" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (parsed.hostname !== "standardebooks.org") {
          return new Response(JSON.stringify({ error: "Fonte não permitida" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
        const upstream = await fetch(parsed.toString(), {
          headers: { "User-Agent": "GoBeyondd/1.0 (https://www.gobeyondd.com.br)" },
        });
        if (!upstream.ok) {
          return new Response(JSON.stringify({ error: "EPUB não encontrado" }), {
            status: upstream.status,
            headers: { "content-type": "application/json" },
          });
        }
        const filename = parsed.pathname.split("/").pop() ?? "book.epub";
        return new Response(upstream.body, {
          headers: {
            "content-type": "application/epub+zip",
            "content-disposition": `attachment; filename="${filename}"`,
            "cache-control": "public, max-age=86400",
          },
        });
      }

      // Atualizar perfil
      if (pathname === "/api/profile" && request.method === "PATCH") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        const { name } = (await request.json()) as { name?: string };
        if (name !== undefined && !name.trim()) {
          return new Response(JSON.stringify({ error: "Nome não pode ser vazio" }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const { updateProfile } = await import("./lib/beyond-db");
        const patch: { name?: string } = {};
        if (name !== undefined) patch.name = name.trim();
        await updateProfile(session.user.id, patch);
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      // Barra no final → endereço sem barra, permanente (308)
      if (pathname.length > 1 && pathname.endsWith("/") && !pathname.startsWith("/api/")) {
        const url = new URL(request.url);
        url.pathname = pathname.replace(/\/+$/, "") || "/";
        return new Response(null, { status: 308, headers: { location: url.pathname + url.search } });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await finalizeHtmlResponse(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
}
