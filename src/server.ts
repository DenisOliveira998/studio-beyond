import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

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
  let nextUrl: string | null = "https://standardebooks.org/feeds/opds/all";

  while (nextUrl && entries.length < 1000) {
    const res = await fetch(nextUrl, {
      headers: { "User-Agent": "TheBeyond/1.0 (https://thebeyond.art)", Accept: "application/atom+xml" },
    });
    if (!res.ok) break;
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

  _seCache = entries;
  _seCacheTs = now;
  return entries;
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["owner", "admin", "gerente"] as const;

async function requireAdmin(request: Request): Promise<{ error?: Response }> {
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
  return {};
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

  return new Response(JSON.stringify(profile), {
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const { pathname } = new URL(request.url);

      // OTP bypass — chama auth.api diretamente (evita bug de 404 no plugin emailOTP)
      if (pathname === "/api/otp/send" && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const body = (await request.json()) as { email: string; type: string };
        try {
          await (auth.api as Record<string, (opts: unknown) => Promise<unknown>>).sendVerificationOTP({ body });
          return new Response(JSON.stringify({ success: true }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: unknown) {
          const err = e as { statusCode?: number; message?: string };
          const status = typeof err?.statusCode === "number" ? err.statusCode : 400;
          return new Response(JSON.stringify({ error: err?.message ?? String(e) }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }
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
        const { newPassword } = (await request.json()) as { newPassword: string };
        const valid =
          newPassword?.length >= 8 &&
          /[A-Z]/.test(newPassword) &&
          /[a-z]/.test(newPassword) &&
          /[0-9]/.test(newPassword);
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

      // Better Auth intercepta /api/auth/*
      if (pathname.startsWith("/api/auth")) {
        const { auth } = await import("./lib/auth-server");
        return auth.handler(request);
      }

      // Perfil do usuário autenticado
      if (pathname === "/api/me" && request.method === "GET") {
        return handleMe(request);
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
        try {
          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          if (!file) {
            return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }
          const { put } = await import("@vercel/blob");
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const blob = await put(safeName, file, { access: "private" });
          return new Response(JSON.stringify({ url: blob.url }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: unknown) {
          const err = e as { message?: string };
          return new Response(JSON.stringify({ error: err?.message ?? "Erro no upload" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
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
        const { submitWork } = await import("./lib/beyond-db");
        const body = (await request.json()) as {
          title: string; medium: string; artistName: string;
          excerpt?: string; body?: string; tags?: string;
          pdfUrl?: string | null; coverUrl?: string | null; status?: "pending" | "draft";
        };
        await submitWork({
          authorId: session.user.id,
          title: body.title ?? "",
          medium: (body.medium ?? "livro") as import("./lib/beyond-data").Medium,
          artistName: body.artistName ?? session.user.name ?? "",
          excerpt: body.excerpt ?? "",
          body: body.body ?? "",
          tags: body.tags ?? "",
          pdfUrl: body.pdfUrl ?? null,
          coverUrl: body.coverUrl ?? null,
          status: body.status ?? "pending",
        });
        if ((body.status ?? "pending") === "pending") {
          const { pushEvent: pushWork } = await import("./lib/pusher");
          void pushWork({ event: "work-submitted", data: { title: body.title ?? "", artistName: body.artistName ?? "" } });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
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
        const body = (await request.json()) as { title?: string; medium?: string; status?: "pending" | "draft" };
        const { updateAuthorWork } = await import("./lib/beyond-db");
        try {
          await updateAuthorWork(workId, session.user.id, body);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        } catch {
          return new Response(JSON.stringify({ error: "Obra não encontrada ou sem permissão" }), { status: 403, headers: { "content-type": "application/json" } });
        }
      }

      // Formulário de contato → Resend
      if (pathname === "/api/contact" && request.method === "POST") {
        const body = (await request.json()) as {
          name: string; email: string; subject?: string; message: string;
        };
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Serviço de e-mail não configurado. Escreva diretamente para contato@thebeyond.art" }), {
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
              from: "The Beyond <noreply@thebeyond.art>",
              to: "contato@thebeyond.art",
              reply_to: body.email,
              subject: `[Contato] ${body.subject ?? "Mensagem"} — ${body.name}`,
              html: `<p><strong>Nome:</strong> ${body.name}</p>
                     <p><strong>E-mail:</strong> ${body.email}</p>
                     <p><strong>Assunto:</strong> ${body.subject ?? "—"}</p>
                     <hr/>
                     <p>${body.message.replace(/\n/g, "<br>")}</p>`,
            }),
          });
          // Confirma para o remetente
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "The Beyond <noreply@thebeyond.art>",
              to: body.email,
              subject: "Mensagem recebida — The Beyond",
              html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#121519">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#a08d24">The Beyond</p>
                <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#f6f6f6">Mensagem recebida</h1>
                <p style="color:#9ba1ab;font-size:15px">Ol&#225;, <strong style="color:#f6f6f6">${body.name}</strong>. Recebemos sua mensagem e responderemos em breve.</p>
                <p style="color:#9ba1ab;font-size:14px;margin-top:16px;padding:12px 16px;border-left:3px solid #a08d24">${body.message.replace(/\n/g, "<br>")}</p>
                <p style="color:#9ba1ab;font-size:13px;margin-top:16px">&#8212; Equipe The Beyond</p>
              </div>`,
            }),
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
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
        // Persiste no banco independente do e-mail
        const { createApplication } = await import("./lib/beyond-db");
        const session = await (await import("./lib/auth-server")).auth.api.getSession({ headers: request.headers });
        await createApplication({
          userId: session?.user?.id ?? null,
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
              from: "The Beyond <noreply@thebeyond.art>",
              to: "contato@thebeyond.art",
              reply_to: body.email,
              subject: `[Candidatura] ${body.artistName} — ${body.field}`,
              html: `<p><strong>Nome artístico:</strong> ${body.artistName}</p>
                     <p><strong>E-mail:</strong> ${body.email}</p>
                     <p><strong>Área:</strong> ${body.field}</p>
                     <p><strong>Portfólio:</strong> <a href="${body.portfolio}">${body.portfolio}</a></p>
                     <p><strong>Bio:</strong> ${body.bio}</p>
                     <p><strong>Mensagem:</strong> ${body.message ?? "—"}</p>`,
            }),
          });
          // Confirma para candidato
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "The Beyond <noreply@thebeyond.art>",
              to: body.email,
              subject: "Candidatura recebida — The Beyond",
              html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#121519">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#a08d24">The Beyond</p>
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f6f6f6">Candidatura recebida</h1>
                <p style="color:#9ba1ab;font-size:15px">Recebemos a candidatura de <strong style="color:#f6f6f6">${body.artistName}</strong> em ${body.field}. A curadoria avalia por ordem de chegada.</p>
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

      // Listar obras aprovadas (público)
      if (pathname === "/api/works" && request.method === "GET") {
        const { fetchApprovedWorks, dbWorkToWork } = await import("./lib/beyond-db");
        const rows = await fetchApprovedWorks();
        return new Response(JSON.stringify(rows.map(dbWorkToWork)), {
          headers: { "content-type": "application/json" },
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
        return new Response(JSON.stringify(artists), { headers: { "content-type": "application/json" } });
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
        const { error } = await requireAdmin(request);
        if (error) return error;
        const userId = accountMatch[1]!;
        const body = (await request.json()) as { role?: string; suspended?: boolean };
        const { setUserRole, setSuspended } = await import("./lib/beyond-db");
        if (typeof body.role === "string") {
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
          await decideApplication(appId, status as "approved" | "rejected" | "changes", note);
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
        const { error } = await requireAdmin(request);
        if (error) return error;
        const workId = adminWorkMatch[1]!;
        if (request.method === "PATCH") {
          const { status, note } = (await request.json()) as { status: string; note?: string };
          const { decideWork } = await import("./lib/beyond-db");
          await decideWork(workId, status as "approved" | "rejected" | "changes", note);
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

      // Atualizar PDF de uma obra (autor/admin)
      if (pathname.startsWith("/api/works/") && pathname.endsWith("/pdf") && request.method === "PATCH") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const id = pathname.replace("/api/works/", "").replace("/pdf", "");
        const { pdfUrl } = (await request.json()) as { pdfUrl: string | null };
        const { updateWorkPdf } = await import("./lib/beyond-db");
        await updateWorkPdf(id, pdfUrl ?? null);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

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
        if (profile && ["vip", "author", "gerente", "admin", "owner"].includes(profile.role)) {
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
        if (profile && ["vip", "author", "gerente", "admin", "owner"].includes(profile.role)) {
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
          const { author, text } = (await request.json()) as { author?: string; text: string };
          if (!text?.trim()) {
            return new Response(JSON.stringify({ error: "Texto obrigatório" }), { status: 400, headers: { "content-type": "application/json" } });
          }
          const { auth } = await import("./lib/auth-server");
          const session = await auth.api.getSession({ headers: request.headers });
          const { addWorkComment } = await import("./lib/beyond-db");
          const comment = await addWorkComment({
            workSlug: slug,
            userId: session?.user?.id ?? null,
            author: author?.trim() || session?.user?.name || "Anônimo",
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
          const { toggleArtistFollow } = await import("./lib/beyond-db");
          const result = await toggleArtistFollow(session.user.id, artistSlug);
          return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
        }
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
          headers: { "User-Agent": "TheBeyond/1.0 (https://thebeyond.art)" },
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

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
