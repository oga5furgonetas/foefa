import { fnv1a, fold } from './normalize';
import { extractNumbers } from './numbers';
import { contentTokens } from './tokenize';

/**
 * Similitud determinista:
 * - MinHash sobre "shingles" de 5 palabras → detecta COPIAS (texto casi igual).
 * - Coseno TF sobre tokens de contenido + solapamiento de entidades y cifras →
 *   detecta el MISMO ACONTECIMIENTO contado con palabras distintas.
 * Los embeddings de un proveedor de IA son opcionales y solo refinan.
 */

export const MINHASH_SIZE = 64;
const SEEDS = Array.from({ length: MINHASH_SIZE }, (_, i) => (0x9e3779b1 * (i + 1)) >>> 0);

export function shingles(text: string, k = 5): Set<string> {
  const w = fold(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  if (w.length < k) {
    if (w.length) out.add(w.join(' '));
    return out;
  }
  for (let i = 0; i <= w.length - k; i++) out.add(w.slice(i, i + k).join(' '));
  return out;
}

export function minhash(text: string): number[] {
  const sh = shingles(text);
  const sig = new Array<number>(MINHASH_SIZE).fill(0xffffffff);
  for (const s of sh) {
    for (let i = 0; i < MINHASH_SIZE; i++) {
      const h = fnv1a(s, SEEDS[i]);
      if (h < sig[i]) sig[i] = h;
    }
  }
  // postgres integer es con signo: se guarda como int32.
  return sig.map((v) => v | 0);
}

export function minhashSimilarity(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let eq = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) eq++;
  return eq / a.length;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Proporción de B cubierta por A: sirve para "¿este texto contiene al otro?" */
export function containment<T>(a: Set<T>, b: Set<T>): number {
  if (!b.size) return 0;
  let inter = 0;
  for (const x of b) if (a.has(x)) inter++;
  return inter / b.size;
}

export type TermVector = Record<string, number>;

/** Vector de frecuencias con estemización ligera (prefijo de 6 letras). */
export function termVector(text: string, lang?: string): TermVector {
  const v: TermVector = {};
  for (const t of contentTokens(text, lang)) {
    const stem = t.length > 7 ? t.slice(0, 7) : t;
    v[stem] = (v[stem] ?? 0) + 1;
  }
  // Cifras como términos "#120": no dependen del idioma y anclan el mismo hecho entre lenguas.
  for (const n of extractNumbers(text, lang)) {
    if (n.value < 10 || (n.value >= 1900 && n.value <= 2100 && Number.isInteger(n.value))) continue;
    const k = `#${n.value}`;
    v[k] = (v[k] ?? 0) + 1;
  }
  return v;
}

export function sharedNumberTerms(a: TermVector, b: TermVector): number {
  let n = 0;
  for (const k of Object.keys(a)) if (k.startsWith('#') && b[k]) n++;
  return n;
}

export function cosine(a: TermVector, b: TermVector, idf?: (term: string) => number): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, x] of Object.entries(a)) {
    const w = idf ? idf(t) : 1;
    na += (x * w) ** 2;
    const y = b[t];
    if (y) dot += x * y * w * w;
  }
  for (const [t, y] of Object.entries(b)) {
    const w = idf ? idf(t) : 1;
    nb += (y * w) ** 2;
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

/** Suma vectores (para el centroide de una historia), con tope de términos. */
export function mergeVectors(a: TermVector, b: TermVector, maxTerms = 300): TermVector {
  const out: TermVector = { ...a };
  for (const [t, x] of Object.entries(b)) out[t] = (out[t] ?? 0) + x;
  const entries = Object.entries(out);
  if (entries.length <= maxTerms) return out;
  entries.sort((x, y) => y[1] - x[1]);
  return Object.fromEntries(entries.slice(0, maxTerms));
}

/** Hash de contenido para detectar duplicados exactos. */
export function contentHash(text: string): string {
  const f = fold(text).replace(/[^\p{L}\p{N}]/gu, '');
  return `${fnv1a(f).toString(16)}${fnv1a(f, 0x1234567).toString(16)}`;
}
