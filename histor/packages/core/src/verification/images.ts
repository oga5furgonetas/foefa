/**
 * Imágenes recicladas: huella perceptual (dHash de 64 bits) + archivo de
 * huellas vistas. Si la foto de una "noticia de hoy" ya circulaba hace
 * semanas, se marca `old_image` y no se usa.
 */

/** dHash a partir de una matriz de grises 9x8 (fila a fila). */
export function dhashFromGray(gray: ArrayLike<number>): string {
  if (gray.length !== 72) throw new Error('dHash necesita 9x8 píxeles');
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += gray[y * 9 + x] > gray[y * 9 + x + 1] ? '1' : '0';
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** dHash de una imagen (buffer) usando sharp. */
export async function dhashImage(buf: Buffer): Promise<string> {
  const sharp = (await import('sharp')).default;
  const raw = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  return dhashFromGray(raw);
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export type PriorFingerprint = { phash: string; firstSeenAt: Date; url: string };

/**
 * ¿Alguna imagen de la historia ya se había visto mucho antes de que la
 * historia empezara? (umbral por defecto: 7 días y distancia ≤ 6 bits)
 */
export function detectOldImages(
  storyStart: Date,
  images: { itemId: number; phash: string }[],
  prior: PriorFingerprint[],
  opts: { maxDistance?: number; minAgeDays?: number } = {},
): { itemId: number; matchedUrl: string; firstSeenAt: Date; distance: number }[] {
  const maxD = opts.maxDistance ?? 6;
  const minAge = (opts.minAgeDays ?? 7) * 86400000;
  const out: { itemId: number; matchedUrl: string; firstSeenAt: Date; distance: number }[] = [];
  for (const img of images) {
    for (const p of prior) {
      const d = hamming(img.phash, p.phash);
      if (d <= maxD && storyStart.getTime() - p.firstSeenAt.getTime() > minAge) {
        out.push({ itemId: img.itemId, matchedUrl: p.url, firstSeenAt: p.firstSeenAt, distance: d });
        break;
      }
    }
  }
  return out;
}
