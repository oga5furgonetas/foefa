import { STOPWORDS, tokens } from './tokenize';

/**
 * Detección de idioma por palabras vacías: para textos de noticias en los
 * seis idiomas activos es muy fiable y no necesita modelos. Si ninguno
 * destaca claramente, devuelve null (idioma desconocido) en vez de adivinar.
 */
export function detectLanguage(text: string, hint?: string | null): { lang: string | null; confidence: number } {
  const toks = tokens(text).slice(0, 400);
  if (toks.length < 3) return { lang: hint ?? null, confidence: hint ? 0.3 : 0 };
  const scores: [string, number][] = Object.entries(STOPWORDS).map(([lang, set]) => {
    let hits = 0;
    for (const t of toks) if (set.has(t)) hits++;
    return [lang, hits / toks.length];
  });
  // Pistas ortográficas que distinguen idiomas cercanos.
  const raw = text.toLowerCase();
  const bonus: Record<string, number> = {
    es: (raw.match(/ñ|¿|¡|ción\b|ciones\b/g)?.length ?? 0) * 0.01,
    pt: (raw.match(/ã|õ|ç(ão|ões)|ção\b|ções\b|\bnão\b/g)?.length ?? 0) * 0.015,
    de: (raw.match(/ß|ä|ö|ü|\bund\b|sch/g)?.length ?? 0) * 0.004,
    fr: (raw.match(/\bl'|\bd'|\bqu'|è|ê|ç|eau\b/g)?.length ?? 0) * 0.006,
    it: (raw.match(/\bgli\b|\bdell['a]|zione\b|zioni\b|\bè\b/g)?.length ?? 0) * 0.01,
    en: (raw.match(/\bthe\b|ing\b|\bof\b/g)?.length ?? 0) * 0.002,
  };
  for (const s of scores) s[1] += bonus[s[0]] ?? 0;
  scores.sort((a, b) => b[1] - a[1]);
  const [best, second] = scores;
  if (best[1] < 0.08) return { lang: hint ?? null, confidence: 0.2 };
  const margin = best[1] - (second?.[1] ?? 0);
  const confidence = Math.max(0, Math.min(1, margin * 8 + best[1]));
  if (margin < 0.02 && hint && scores.slice(0, 2).some(([l]) => l === hint)) return { lang: hint, confidence: 0.5 };
  return { lang: best[0], confidence };
}
