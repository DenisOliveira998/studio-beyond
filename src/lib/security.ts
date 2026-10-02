// Utilitários de segurança do servidor: limite de requisições, IP do cliente,
// regras de senha, validação de arquivos enviados e cabeçalhos de proteção.

/** IP do cliente (Vercel envia em x-forwarded-for / x-real-ip). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "desconhecido";
}

/**
 * Limite de requisições guardado no banco (funciona entre instâncias serverless).
 * Retorna true se a ação pode seguir. Em erro de banco, deixa passar (não derruba o site).
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const now = new Date();
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row || row.resetAt <= now) {
      const resetAt = new Date(now.getTime() + windowSeconds * 1000);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return true;
    }
    if (row.count >= max) return false;
    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return true;
  } catch (err) {
    console.error("rateLimit falhou (tabela rate_limits existe?)", err);
    return true;
  }
}

export function tooManyRequests(message = "Muitas tentativas. Aguarde alguns minutos e tente de novo."): Response {
  return new Response(JSON.stringify({ error: message, message }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "600" },
  });
}

/** Mesmas regras de senha do formulário: 8+ caracteres, maiúscula, minúscula e número. */
export function isStrongPassword(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

export const WEAK_PASSWORD_MESSAGE =
  "A senha precisa ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula e número.";

/** Tipos aceitos no envio de arquivos (capas, fotos, PDFs de obras, portfólios). */
const FILE_SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/gif", ext: "gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    type: "image/avif",
    ext: "avif",
    test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69,
  },
  { type: "application/pdf", ext: "pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  {
    // EPUB = ZIP cujo primeiro arquivo é "mimetype" com "application/epub+zip" (sempre servido como download)
    type: "application/epub+zip",
    ext: "epub",
    test: (b) =>
      b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 &&
      new TextDecoder().decode(b.subarray(30, 70)).includes("application/epub+zip"),
  },
];

/** Limite de tamanho (o limite de corpo das funções da Vercel é ~4,5 MB). */
export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

/** Identifica o tipo real pelo conteúdo (não pelo nome nem pelo tipo informado pelo navegador). */
export function detectFileType(bytes: Uint8Array): { type: string; ext: string } | null {
  const hit = FILE_SIGNATURES.find((s) => s.test(bytes));
  return hit ? { type: hit.type, ext: hit.ext } : null;
}

/** Tipos que o proxy pode exibir dentro da página; o resto vira download. */
export const INLINE_SAFE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "application/pdf"];

/** Cabeçalhos de proteção aplicados a todas as respostas do site. */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("x-content-type-options")) headers.set("x-content-type-options", "nosniff");
  if (!headers.has("x-frame-options")) headers.set("x-frame-options", "SAMEORIGIN");
  if (!headers.has("referrer-policy")) headers.set("referrer-policy", "strict-origin-when-cross-origin");
  if (!headers.has("permissions-policy")) {
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  }
  if (!headers.has("content-security-policy")) headers.set("content-security-policy", "frame-ancestors 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
