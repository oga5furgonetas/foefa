/**
 * Sin periódicos en el texto (Dani, 03-10-2026: «deja de poner "según 20minutos"… si quieren ver
 * que está verificada, que miren las fuentes; no escribas nada sobre otros periódicos»). Histor
 * cuenta la noticia como la cuenta un periódico: quién la publicó va en el recuadro de fuentes y
 * la etiqueta «Verificada» / «En desarrollo», junto al titular. Sí se atribuye a quien habla en
 * la noticia («según la Policía», «dijo el entrenador»): eso no es un medio.
 */
import type { ArticleBlock } from '../db/schema';
import { sentences } from '../text/tokenize';
import type { FactSheet } from './factsheet';
import { PHRASES } from './phrases';

/** Agencias que los textos de las fuentes citan aunque no estén entre nuestras fuentes. */
const AGENCIES = [
  'Agencia EFE', 'EFE', 'Europa Press', 'Reuters', 'Agence France-Presse', 'AFP', 'Associated Press', 'AP', 'dpa', 'ANSA', 'Lusa', 'Servimedia',
  'Bloomberg', 'Xinhua', 'Kyodo', 'Yonhap', 'Interfax', 'TASS', 'Agência Brasil', 'Agencia Brasil', 'Colpisa', 'Notimex', 'Télam', 'Adnkronos', 'Agence Belga', 'APA', 'KNA', 'epd',
];

/** Fuentes que son medios. Un organismo, una empresa o una universidad no: «según la AEMET» se queda. */
export const MEDIA_TYPES = new Set(['wire_agency', 'reputable_media', 'identified_journalist', 'blog', 'aggregator', 'ugc', 'social_media', 'anonymous', 'unverifiable']);

/** Nombres de medio de una ficha: sus fuentes (también el nombre corto, sin el paréntesis) y las agencias. */
export function mediaNames(fs: Pick<FactSheet, 'sources' | 'claims'>): string[] {
  return expandNames([
    ...fs.sources.filter((s) => MEDIA_TYPES.has(s.sourceType)).map((s) => s.name),
    ...fs.claims.flatMap((c) => c.supporters.filter((s) => MEDIA_TYPES.has(s.sourceType)).map((s) => s.name)),
  ]);
}

/** Los nombres dados más las agencias, también por partes («ZDFheute (ZDF)» → «ZDF»). */
export function expandNames(given: string[]): string[] {
  const raw = [...given, ...AGENCIES];
  const out = new Set<string>();
  for (const n of raw) {
    if (!n) continue;
    out.add(n.trim());
    // «ZDFheute (ZDF)», «El País (y 2 más)»: también cada parte.
    for (const part of n.split(/[()]/).map((x) => x.trim())) if (part.length >= 2 && !/^(y|and|und|et|e)\s/i.test(part)) out.add(part);
  }
  return [...out].filter((n) => n.length >= 2);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bordes de palabra que entienden de acentos: «APA» no puede salir de «el mapa indica que…». */
const B0 = String.raw`(?<![\p{L}\p{N}])`;
const B1 = String.raw`(?![\p{L}\p{N}])`;

/** «20minutos» también como «20 Minutos». */
const nameAlt = (n: string) => esc(n).replace(/\s+/g, String.raw`\s*`).replace(/^(\d+)(?=\p{L})/u, String.raw`$1\s*`);

/** Uno o varios seguidos («20minutos y La Vanguardia»), con «el diario…» delante si lo lleva. */
function namePattern(names: string[]): string {
  const alts = [...new Set(names)].sort((a, b) => b.length - a.length).map(nameAlt);
  const kind = String.raw`(?:(?:el|la|los|las|the|der|die|das|le|il|lo|o|a)\s+(?:diario|periódico|periodico|agencia|cadena|emisora|web|portal|medio|newspaper|agency|outlet|broadcaster|zeitung|agentur|sender|journal|quotidien|agence|chaîne|quotidiano|agenzia|giornale|jornal|agência)\s+)?`;
  const one = `${B0}${kind}(?:${alts.join('|')})${B1}`;
  return `${one}(?:${String.raw`\s*(?:,|\by\b|\band\b|\bund\b|\bet\b|\be\b|&)\s*`}${one})*`;
}

const INTRO = `(?:según|segun|de acuerdo con|conforme a|according to|as reported by|laut|nach angaben von|selon|d'après|d’après|secondo|stando a|segundo|de acordo com|conforme)`;
const VERB = `(?:(?:ha|han|hat|haben|a|ont|hanno|tem|têm) )?(?:informa|informó|informado|informan|publica|publicó|publicado|publican|adelanta|adelantó|adelantado|avanza|avanzó|avanzado|recoge|recogió|recogido|revela|reveló|revelado|explica|explicó|asegura|aseguró|reporta|reportó|reportado|detalla|detalló|señala|señaló|indica|indicó|reported|reports|reveals|revealed|says|said|writes|wrote|berichtet|berichtete|meldet|meldete|schreibt|schrieb|rapporte|rapporté|révèle|révélé|indique|indiqué|écrit|riporta|riportato|rivela|rivelato|scrive|scritto|informou|noticiou|revelou|relata|relatou)`;
const THAT = String.raw`(?:de\s+)?(?:que|that|dass|qu'|qu’|che)`;
const INTERVIEW = `(?:en (?:unas )?declaraciones (?:a|al|recogidas por)|en (?:una )?entrevista (?:con|en|a|al|concedida a)|in an interview with|im gespräch mit|gegenüber|dans un entretien (?:avec|à|au)|in un'intervista (?:a|con|al)|em entrevista (?:a|à|ao))`;

type Compiled = { lead: RegExp; tail: RegExp; mid: RegExp; paren: RegExp; subject: RegExp; interview: RegExp; told: RegExp; any: RegExp; okCase: (m: string) => boolean };
const cache = new Map<string, Compiled>();

function compile(names: string[]): Compiled {
  const key = names.join('\u0001');
  const hit = cache.get(key);
  if (hit) return hit;
  const N = namePattern(names);
  const S = String.raw`\s`;
  // Los nombres cortos («AS», «AP», «APA») solo cuentan escritos tal cual: en minúscula son
  // palabras corrientes («as reported», «a pesar de»). Los demás, se escriban como se escriban.
  const short = names.filter((n) => n.replace(/\s/g, '').length <= 4);
  const long = names.filter((n) => n.replace(/\s/g, '').length > 4);
  const longRe = long.length ? new RegExp(`${B0}(?:${long.map(nameAlt).join('|')})${B1}`, 'iu') : null;
  const shortRe = short.length ? new RegExp(`${B0}(?:${short.map(esc).join('|')})${B1}`, 'u') : null;
  const c: Compiled = {
    // «Según 20minutos y La Vanguardia, Álex Grimaldo…»
    lead: new RegExp(`^${S}*${INTRO}${S}+${N}${S}*,${S}*`, 'iu'),
    // «…, según 20minutos.» / «…, informa El País.» (el verbo, solo tras coma: «la noticia la adelantó Marca» no se toca)
    tail: new RegExp(`(?:${S}*[,;]?${S}*${INTRO}|${S}*[,;]${S}*(?:(?:como|tal y como|as)${S}+)?${VERB})${S}+${N}${S}*(?=[.!?]?${S}*$)`, 'iu'),
    // «El ministro, según El País, dimitirá.»
    mid: new RegExp(`${S}*,${S}*${INTRO}${S}+${N}${S}*,`, 'iu'),
    // «(según EFE)», «(EFE)»
    paren: new RegExp(`${S}*[(](?:${INTRO}${S}+)?${N}[)]`, 'iu'),
    // «20minutos informa de que…», «La Vanguardia ha publicado que…»
    subject: new RegExp(`^${S}*${N}${S}+${VERB}${S}+${THAT}${S}*`, 'iu'),
    // «…explicó en declaraciones a Marca que…»
    interview: new RegExp(`${S}+${INTERVIEW}${S}+${N}`, 'iu'),
    told: new RegExp(`${B0}told${S}+${N}`, 'iu'),
    any: new RegExp(`(?:${INTRO}${S}+${N}|${N}${S}+${VERB}${B1}|[,;]${S}*${VERB}${S}+${N}|[(]${N}[)]|${INTERVIEW}${S}+${N})`, 'giu'),
    okCase: (m: string) => !!(longRe?.test(m) || shortRe?.test(m)),
  };
  cache.set(key, c);
  return c;
}

function capitalizeFirst(s: string): string {
  return s.replace(/^(\s*[«"“¿¡]?)(\p{Ll})/u, (_, a: string, b: string) => a + b.toUpperCase());
}

/**
 * Quita de una frase la atribución a un medio. Devuelve la frase limpia (con su punto final si lo
 * tenía) o la misma si no había nada que quitar.
 */
export function stripMediaAttribution(sentence: string, names: string[]): string {
  if (!names.length || !sentence.trim()) return sentence;
  const c = compile(names);
  const cut = (s: string, re: RegExp, by = '') => s.replace(re, (m) => (c.okCase(m) ? by : m));
  const endPunct = /[.!?]\s*$/.test(sentence);
  let s = sentence;
  s = cut(s, c.paren);
  s = cut(s, c.mid);
  s = cut(s, c.interview);
  s = cut(s, c.told, 'said');
  const led = cut(s, c.lead);
  if (led !== s) s = capitalizeFirst(led);
  const subj = cut(s, c.subject);
  if (subj !== s) s = capitalizeFirst(subj);
  s = cut(s, c.tail);
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  if (endPunct && !/[.!?»”"]$/.test(s)) s += '.';
  return s;
}

type StoredText = { subheadline: string | null; summary: string; seoDescription: string; body: ArticleBlock[] };

/** Subtítulos antiguos con la lista de medios («Lo confirman 3 fuentes independientes: A, B y C.»). */
const OLD_CONFIRMED = /^(?:Lo confirman|Confirmed by|Bestätigt von|Confirmé par|Confirmée? par|Lo confermano|Confirmado por)\s+(\d+)\s/i;
const OLD_CONFIRMED_ONE = /^(?:Lo confirma|Confirmed by|Bestätigt von|Confirmé par|Lo conferma|Confirmado por)\s+[^\d]/i;
const OLD_DEVELOPING = /(Cada dato se atribuye|Each detail is attributed|Jede Angabe wird der Quelle|Chaque élément est attribué|Ogni dato è attribuito|Cada dado é atribuído)/;

/**
 * Lo ya publicado, sin periódicos (03-10-2026): quita las atribuciones a medios de cada frase y,
 * si alguna no se puede limpiar, la frase fuera. Devuelve null si no había nada que cambiar.
 */
export function cleanStoredArticle(a: StoredText, lang: string, names: string[]): StoredText | null {
  const P = PHRASES[lang] ?? PHRASES.en;
  let changed = false;
  const fix = (text: string): string => {
    const out = sentences(text)
      .map((s) => stripMediaAttribution(s.trim(), names))
      .filter((s) => s && !namesMedia(s, names))
      .join(' ');
    if (out !== text) changed = true;
    return out;
  };
  const body: ArticleBlock[] = [];
  for (const b of a.body) {
    if (b.type === 'p') {
      const text = fix(b.text);
      if (text) body.push({ ...b, text });
      else changed = true;
    } else if (b.type === 'list') {
      const items = b.items.map((it) => ({ ...it, text: fix(it.text.replace(/\s*\((?:según|according to|laut|selon|secondo|segundo)\s[^)]*\)\s*$/i, '')) })).filter((it) => it.text);
      if (items.length) body.push({ ...b, items });
      else changed = true;
    } else body.push(b);
  }
  // Un apartado que se ha quedado sin contenido, fuera.
  const tidy = body.filter((b, i) => b.type !== 'h2' || (body[i + 1] && body[i + 1].type !== 'h2'));
  if (tidy.length !== body.length) changed = true;
  let subheadline = a.subheadline;
  if (subheadline) {
    const many = subheadline.match(OLD_CONFIRMED);
    if (many) subheadline = P.confirmedBy(Number(many[1]));
    else if (OLD_CONFIRMED_ONE.test(subheadline)) subheadline = P.confirmedBy(1);
    else if (OLD_DEVELOPING.test(subheadline)) subheadline = P.developingNote;
    else subheadline = fix(subheadline) || null;
    if (subheadline !== a.subheadline) changed = true;
  }
  const summary = fix(a.summary) || a.summary;
  const seoDescription = fix(a.seoDescription) || a.seoDescription;
  return changed ? { subheadline, summary, seoDescription, body: tidy } : null;
}

/** ¿Sigue la frase atribuyendo algo a un medio («según X», «X informa…», «(X)»)? */
export function namesMedia(sentence: string, names: string[]): boolean {
  if (!names.length) return false;
  const c = compile(names);
  return [...sentence.matchAll(c.any)].some((m) => c.okCase(m[0]));
}
