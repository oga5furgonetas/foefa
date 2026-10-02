/**
 * Orden del texto ya escrito (03-10-2026, la noticia de Grimaldo): sin contar dos veces el mismo
 * hecho con otras palabras y sin párrafos de una sola frase uno tras otro.
 */
import type { ArticleBlock } from '../db/schema';
import { fold } from '../text/normalize';
import { sentences } from '../text/tokenize';

/** Raíces (seis primeras letras) de las palabras con peso: «muscular» y «musculares» son la misma. */
function stems(s: string): Set<string> {
  return new Set(fold(s).split(/\W+/).filter((w) => w.length > 4).map((w) => w.slice(0, 6)));
}

/**
 * ¿Cuenta `b` lo mismo que `a`? Comparten al menos el 60 % de las raíces de la más corta y `b` no
 * trae ninguna cifra nueva («votó 38 a 12», «para 2029»): un dato nuevo es información, aunque
 * hable de lo mismo.
 */
export function sameFact(a: string, b: string): boolean {
  const nums = (s: string) => new Set(s.match(/\d+(?:[.,]\d+)?/g) ?? []);
  const an = nums(a);
  if ([...nums(b)].some((n) => !an.has(n))) return false;
  const A = stems(a);
  const B = stems(b);
  const small = Math.min(A.size, B.size);
  if (small < 4) return false;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / small >= 0.6;
}

type P = Extract<ArticleBlock, { type: 'p' }>;

/**
 * Los párrafos de texto corrido del principio (hasta el primer apartado): fuera las frases que
 * repiten un hecho ya contado y, tras la entrada, las frases sueltas se juntan en párrafos de
 * hasta tres. Los apartados (datos clave, citas, sin confirmar…) quedan como estaban.
 */
export function tidyParagraphs(blocks: ArticleBlock[]): ArticleBlock[] {
  const firstSection = blocks.findIndex((b) => b.type !== 'p');
  const head = (firstSection < 0 ? blocks : blocks.slice(0, firstSection)) as P[];
  const rest = firstSection < 0 ? [] : blocks.slice(firstSection);
  const told: string[] = [];
  const kept: P[] = [];
  for (const b of head) {
    const own = sentences(b.text).filter((s) => {
      if (told.some((t) => sameFact(t, s))) return false;
      told.push(s);
      return true;
    });
    if (own.length) kept.push({ ...b, text: own.join(' ') });
  }
  const out: P[] = kept.slice(0, 1);
  for (const b of kept.slice(1)) {
    const prev = out[out.length - 1];
    const prevCount = prev && out.length > 1 ? sentences(prev.text).length : Infinity;
    if (sentences(b.text).length === 1 && prevCount < 3) out[out.length - 1] = { ...prev, text: `${prev.text} ${b.text}`, claimIds: [...new Set([...prev.claimIds, ...b.claimIds])] };
    else out.push(b);
  }
  return [...out, ...rest];
}
