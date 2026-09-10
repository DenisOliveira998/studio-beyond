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
