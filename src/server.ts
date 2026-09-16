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
          const { auth } = await import("./lib/auth-server");
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session?.user) {
            return new Response(JSON.stringify({ error: "Não autorizado" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
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
          const { auth } = await import("./lib/auth-server");
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session?.user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
          const { createCarouselItem } = await import("./lib/beyond-db");
          const body = (await request.json()) as Parameters<typeof createCarouselItem>[0];
          const item = await createCarouselItem(body);
          return new Response(JSON.stringify(item), { headers: { "content-type": "application/json" } });
        }
      }

      if (pathname.startsWith("/api/carousel/reorder") && request.method === "POST") {
        const { auth } = await import("./lib/auth-server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
        const { ids } = (await request.json()) as { ids: string[] };
        const { reorderCarouselItems } = await import("./lib/beyond-db");
        await reorderCarouselItems(ids);
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }

      const carouselItemMatch = pathname.match(/^\/api\/carousel\/([^/]+)$/);
      if (carouselItemMatch) {
        const id = carouselItemMatch[1];
        if (request.method === "PATCH") {
          const { auth } = await import("./lib/auth-server");
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session?.user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
          const body = (await request.json()) as Record<string, unknown>;
          const { updateCarouselItem } = await import("./lib/beyond-db");
          await updateCarouselItem(id, body as Parameters<typeof updateCarouselItem>[1]);
          return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
        }
        if (request.method === "DELETE") {
          const { auth } = await import("./lib/auth-server");
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session?.user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
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
          const blob = await put(safeName, file, { access: "public" });
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
          pdfUrl?: string | null; status?: "pending" | "draft";
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
          status: body.status ?? "pending",
        });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Formulário de contato → Resend
      if (pathname === "/api/contact" && request.method === "POST") {
        const body = (await request.json()) as {
          name: string; email: string; subject?: string; message: string;
        };
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

      // Candidatura de autor → Resend
      if (pathname === "/api/candidatura" && request.method === "POST") {
        const body = (await request.json()) as {
          artistName: string; email: string; field: string;
          bio: string; portfolio: string; message?: string;
        };
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
