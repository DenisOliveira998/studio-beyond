/**
 * Envio de imagens (Galeria): reduz no navegador antes de subir, porque o servidor
 * aceita até 4,5 MB por arquivo. PNG continua PNG (mantém transparência); o resto vira JPEG.
 * O servidor regrava a imagem de novo (sem metadados), então isto é só para caber no envio.
 */
export async function uploadImage(file: File, purpose: "gallery", maxSide = 2400): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`"${file.name}": envie JPG, PNG ou WebP.`);
  }
  let blob: Blob = file;
  let name = file.name;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale < 1 || file.size > 4_000_000) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const png = file.type === "image/png";
      const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, png ? "image/png" : "image/jpeg", 0.9));
      if (out) {
        blob = out;
        name = name.replace(/\.[^.]+$/, png ? ".png" : ".jpg");
      }
    }
    bitmap.close();
  } catch {
    throw new Error(`Não conseguimos abrir "${file.name}".`);
  }
  if (blob.size > 4_400_000) throw new Error(`"${file.name}" continua grande demais. Envie uma versão menor.`);
  const fd = new FormData();
  fd.append("file", blob, name);
  fd.append("purpose", purpose);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !out.url) throw new Error(out.error ?? `Não foi possível enviar "${file.name}".`);
  return out.url;
}
