import { fold } from './normalize';

/** Palabras vacías por idioma (plegadas). Sirven para detectar idioma y para TF-IDF. */
export const STOPWORDS: Record<string, Set<string>> = {
  es: new Set(
    'el la los las un una unos unas de del al a en y o u que se por con para su sus es son fue han ha lo le les como mas pero sin sobre entre tras este esta estos estas ese esa eso cuando donde muy ya tambien segun hasta desde durante contra no si hay ser estar era sido tiene tienen este otro otra otros'.split(
      ' ',
    ),
  ),
  en: new Set(
    'the a an of to in and or that is are was were be been has have had it its on for with as by at from this these those which who whom not but if their they them he she his her we our you your will would can could may might said says about after before over into than also more most other'.split(
      ' ',
    ),
  ),
  de: new Set(
    'der die das den dem des ein eine einer eines einem einen und oder dass ist sind war waren wird werden wurde wurden hat haben hatte zu im in am an auf fur mit von bei nach aus uber unter nicht auch als wie sich es er sie wir ihr sein seine ihre noch nur schon mehr sagte laut'.split(
      ' ',
    ),
  ),
  fr: new Set(
    'le la les un une des de du au aux et ou que qui est sont etait ete a ont avait en dans sur pour par avec pas plus ce cette ces son sa ses leur leurs il elle ils elles nous vous on se ne mais comme apres avant selon aussi tres entre'.split(
      ' ',
    ),
  ),
  it: new Set(
    'il lo la i gli le un uno una di del della dei delle degli al alla ai alle e o che chi non si per con su da in nel nella nei sono era erano stato stata ha hanno aveva come ma anche piu dopo prima secondo tra fra questo questa questi quello sua suo loro'.split(
      ' ',
    ),
  ),
  pt: new Set(
    'o a os as um uma uns umas de do da dos das ao aos em no na nos nas e ou que se por com para seu sua seus suas e sao foi foram ha tem tinha como mas nao mais sobre entre apos antes segundo tambem ja quando onde muito este esta estes estas isso pelo pela'.split(
      ' ',
    ),
  ),
};

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’\-.]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu;

/** Palabras tal cual (conserva mayúsculas y tildes). */
export function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

/** Tokens plegados (minúsculas, sin tildes). */
export function tokens(text: string): string[] {
  return words(fold(text)).map((w) => w.replace(/['’]/g, ''));
}

/** Tokens de contenido: sin palabras vacías de ningún idioma y sin cortos. */
export function contentTokens(text: string, lang?: string): string[] {
  const sw = lang && STOPWORDS[lang] ? [STOPWORDS[lang]] : Object.values(STOPWORDS);
  return tokens(text).filter((t) => t.length > 2 && !sw.some((s) => s.has(t)) && !/^\d+$/.test(t));
}

const ABBREVIATIONS = new Set(
  [
    'sr', 'sra', 'srta', 'dr', 'dra', 'd', 'dña', 'mr', 'mrs', 'ms', 'prof', 'st', 'jr', 'sen', 'rep', 'gov', 'gen', 'lt', 'col',
    'hr', 'fr', 'frau', 'herr', 'nr', 'bzw', 'z', 'b', 'etc', 'vs', 'no', 'núm', 'num', 'art', 'pág', 'p', 'aprox', 'ca', 'inc', 'ltd',
    'co', 'corp', 'm', 'mme', 'mlle', 'sig', 'dott', 'ing', 'avv', 'eeuu', 'ee', 'uu', 'u.s', 'u', 's', 'a', 'jan', 'feb', 'mar',
    'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'ene', 'dic',
  ].map((a) => a.toLowerCase()),
);

/**
 * Palabras que tras «N.» indican un ordinal (alemán sobre todo: «1. Januar»,
 * «19. Jahrhundert», «3. Liga»), no el final de una frase.
 */
const ORDINAL_FOLLOWERS = new Set(
  [
    'januar', 'februar', 'marz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
    'january', 'february', 'march', 'may', 'june', 'july', 'october', 'december',
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    'janvier', 'fevrier', 'mars', 'avril', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
    'gennaio', 'febbraio', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'dicembre',
    'janeiro', 'fevereiro', 'marco', 'maio', 'junho', 'julho', 'setembro', 'outubro', 'novembro', 'dezembro',
    'jahrhundert', 'jahrhunderts', 'weltkrieg', 'weltkriegs', 'mal', 'platz', 'liga', 'bundesliga', 'runde', 'spieltag', 'stock', 'etage', 'klasse', 'quartal', 'halbjahr', 'lebensjahr', 'jahrestag',
  ].map((w) => w.toLowerCase()),
);

/** Divide un texto en frases, respetando abreviaturas, iniciales, decimales y ordinales. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return out;
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    // Consumir cierres de comillas/paréntesis tras el signo.
    let j = i + 1;
    while (j < clean.length && /["'”’»)\]]/.test(clean[j])) j++;
    if (j < clean.length && clean[j] !== ' ') continue; // 3.5, e.g.x
    const next = clean.slice(j + 1, j + 2);
    if (next && !/[\p{Lu}\p{N}"'“«¿¡(]/u.test(next)) continue; // la siguiente no empieza frase
    if (ch === '.') {
      const before = clean.slice(start, i).split(' ').pop() ?? '';
      const w = before.replace(/^[("'“«]+/, '').toLowerCase();
      if (ABBREVIATIONS.has(w) || /^\p{L}$/u.test(w) || /^(\p{L}\.)+\p{L}$/u.test(w)) continue;
      if (/^\d{1,3}$/.test(w)) {
        const nextWord = fold(clean.slice(j + 1).split(' ')[0] ?? '').replace(/[^a-z]/g, '');
        if (ORDINAL_FOLLOWERS.has(nextWord)) continue;
      }
    }
    const s = clean.slice(start, j).trim();
    if (s) out.push(s);
    start = j + 1;
  }
  const tail = clean.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}
