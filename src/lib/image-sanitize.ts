/**
 * Imagens enviadas por usuários são sempre regravadas no servidor:
 * abre, corrige a rotação, reduz ao tamanho de uso e salva de novo.
 * Isso descarta metadados (GPS, câmera), código escondido no arquivo e
 * bytes extras, e ainda economiza espaço no armazenamento.
 */
export type ImagePurpose = "avatar" | "cover" | "other";

const LIMITS: Record<ImagePurpose, { width: number; height?: number }> = {
  avatar: { width: 512, height: 512 },
  cover: { width: 1200, height: 1800 },
  // Páginas de webtoon são altas: limita só a largura
  other: { width: 2000 },
};

export async function sanitizeImage(
  bytes: Uint8Array,
  purpose: ImagePurpose,
): Promise<{ bytes: Uint8Array; type: "image/jpeg" | "image/png"; ext: "jpg" | "png" }> {
  const sharp = (await import("sharp")).default;
  // limitInputPixels barra "bombas" de descompressão (imagem minúscula que vira gigante na memória)
  const img = sharp(bytes, { limitInputPixels: 80_000_000, animated: false, failOn: "error" }).rotate();
  const meta = await img.metadata();
  const { width, height } = LIMITS[purpose];
  img.resize({ width, ...(height ? { height } : {}), fit: "inside", withoutEnlargement: true });
  // Transparência (logos, artes em PNG) fica em PNG; o resto vira JPEG, bem menor
  if (meta.hasAlpha && purpose !== "avatar" && purpose !== "cover") {
    const out = await img.png({ compressionLevel: 9, palette: true }).toBuffer();
    return { bytes: new Uint8Array(out), type: "image/png", ext: "png" };
  }
  const out = await img.flatten({ background: "#ffffff" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return { bytes: new Uint8Array(out), type: "image/jpeg", ext: "jpg" };
}
