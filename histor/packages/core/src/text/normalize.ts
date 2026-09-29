/** Utilidades de texto deterministas (sin IA, sin dependencias). */

const SPECIAL: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  Æ: 'ae',
  ø: 'o',
  Ø: 'o',
  œ: 'oe',
  Œ: 'oe',
  ð: 'd',
  þ: 'th',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  ı: 'i',
};

/** Quita diacríticos: "Galicia, A Coruña" → "Galicia, A Coruna". */
export function stripDiacritics(s: string): string {
  return s
    .replace(/[ßæÆøØœŒðþłŁđı]/g, (ch) => SPECIAL[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

/** Forma de comparación: minúsculas, sin tildes, espacios simples. */
export function fold(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function slugify(s: string, maxLength = 80): string {
  const out = stripDiacritics(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (out.length <= maxLength) return out;
  const cut = out.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > maxLength * 0.6 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
}

/** Quita etiquetas HTML y entidades comunes; deja texto plano. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
      // Etiquetas de línea (enlaces, énfasis…) sin espacio: «<a>three</a>-<a>day</a>» es «three-day», no «three - day».
      .replace(/<\/?(a|abbr|b|bdi|bdo|cite|code|data|dfn|em|font|i|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var)\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  bdquo: '„',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  euro: '€',
  oelig: 'œ',
  OElig: 'Œ',
  scaron: 'š',
  Scaron: 'Š',
  zcaron: 'ž',
  Zcaron: 'Ž',
  bull: '•',
  trade: '™',
  prime: '′',
  Prime: '″',
  sbquo: '‚',
  thinsp: ' ',
  ensp: ' ',
  emsp: ' ',
  zwnj: '',
  zwj: '',
  lrm: '',
  rlm: '',
};
// Latin-1 completo (U+00A0–U+00FF), en orden: sin ellas salía «S&aacute;nchez» en portada.
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(' ');
LATIN1.forEach((name, i) => (NAMED[name] ??= String.fromCharCode(0xa0 + i)));
NAMED.shy = '';

function decodeOnce(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : m;
    }
    // Sensible a mayúsculas (&Aacute; ≠ &aacute;); si no existe así, se prueba en minúsculas (&QUOT;).
    return NAMED[ent] ?? NAMED[ent.toLowerCase()] ?? m;
  });
}

export function decodeEntities(s: string): string {
  const once = decodeOnce(s);
  // Feeds con doble escapado («&amp;aacute;»): una segunda pasada solo si quedó una entidad conocida.
  return /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/i.test(once) && once !== s ? decodeOnce(once) : once;
}

/** Recorta a n caracteres sin partir palabras. */
export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

export function wordCount(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Hash FNV-1a de 32 bits (determinista, rápido; no criptográfico). */
export function fnv1a(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
