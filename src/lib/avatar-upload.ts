/**
 * Foto de perfil: reduz no navegador para 512px (fotos de celular passam do limite de 4,5 MB
 * do servidor) e envia. Devolve o endereço do arquivo ou lança um erro com a mensagem para o usuário.
 */
const MAX_SIDE = 512;

async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Não conseguimos abrir essa imagem. Envie uma foto PNG ou JPEG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a foto.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Não foi possível preparar a foto.");
  return blob;
}

export async function uploadAvatar(file: File): Promise<string> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") throw new Error("A foto precisa ser PNG ou JPEG.");
  const small = await shrink(file);
  const fd = new FormData();
  fd.append("file", small, "foto.jpg");
  fd.append("purpose", "avatar");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !out.url) throw new Error(out.error ?? "Não foi possível enviar a foto.");
  return out.url;
}
