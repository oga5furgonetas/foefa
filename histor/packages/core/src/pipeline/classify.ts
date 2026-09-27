/**
 * Clasificador de sección determinista: cuenta coincidencias del
 * vocabulario de cada categoría (en el idioma de la pieza, y con menor peso
 * en los demás). La pista de la fuente (categoryHint) desempata.
 */
import { CATEGORIES } from '../config/categories';
import { fold } from '../text/normalize';

type Lexicon = { id: string; keywords: Record<string, string[]> }[];

export function classify(text: string, lang: string | null, opts: { hint?: string | null; lexicon?: Lexicon } = {}): { categoryId: string; score: number; scores: Record<string, number> } {
  const lexicon = opts.lexicon ?? CATEGORIES.map((c) => ({ id: c.id, keywords: c.keywords }));
  const f = ` ${fold(text).replace(/[^\p{L}\p{N}&\s-]/gu, ' ').replace(/\s+/g, ' ')} `;
  const scores: Record<string, number> = {};
  for (const cat of lexicon) {
    let score = 0;
    for (const [kwLang, list] of Object.entries(cat.keywords)) {
      const w = kwLang === lang ? 1 : 0.25;
      for (const kw of list) {
        const stem = kw.endsWith('*');
        const needle = stem ? kw.slice(0, -1) : kw;
        if (!needle) continue;
        const re = new RegExp(`\\s${escape(needle)}${stem ? '[\\p{L}]*' : ''}(?=\\s)`, 'gu');
        const hits = f.match(re)?.length ?? 0;
        if (hits) score += w * Math.min(3, hits) * (needle.includes(' ') ? 1.5 : 1);
      }
    }
    if (opts.hint === cat.id) score += 1.5;
    scores[cat.id] = Math.round(score * 100) / 100;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 1) return { categoryId: opts.hint ?? 'society', score: best?.[1] ?? 0, scores };
  return { categoryId: best[0], score: best[1], scores };
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
