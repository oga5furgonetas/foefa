import { fold } from './normalize';

/**
 * Fechas: parser determinista multilingüe. Sirve para dos cosas críticas:
 * 1) saber CUÁNDO se publicó cada pieza (feeds: RFC 822 / ISO 8601);
 * 2) extraer las fechas que un texto AFIRMA ("el 3 de marzo de 2019") para
 *    detectar noticias viejas recicladas y fechas contradictorias.
 */

const MONTHS: Record<string, number> = {};
const MONTH_NAMES: Record<string, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  de: ['januar', 'februar', 'marz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
  fr: ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  pt: ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};
for (const names of Object.values(MONTH_NAMES)) names.forEach((n, i) => (MONTHS[n] = i + 1));
Object.assign(MONTHS, { setiembre: 9, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, jaenner: 1, janner: 1 });

const MONTH_ALT = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

export type ExtractedDate = { iso: string; raw: string; precision: 'day' | 'month' | 'year' | 'relative' };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function valid(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1;
}

/** Fecha de un feed o metadato (RFC 822, ISO 8601, con o sin zona). */
export function parseFeedDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  // Zonas horarias textuales que Date.parse no entiende en todos los motores.
  const fixed = s
    .replace(/\b(CEST)\b/, '+0200')
    .replace(/\b(CET)\b/, '+0100')
    .replace(/\b(BST)\b/, '+0100')
    .replace(/\b(EDT)\b/, '-0400')
    .replace(/\b(EST)\b/, '-0500')
    .replace(/\b(PDT)\b/, '-0700')
    .replace(/\b(PST)\b/, '-0800');
  const t = Date.parse(fixed);
  if (!Number.isNaN(t)) return new Date(t);
  // dd/mm/yyyy [hh:mm]
  const m = fixed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, hh, mm] = m;
    if (valid(+y, +mo, +d)) return new Date(Date.UTC(+y, +mo - 1, +d, hh ? +hh : 0, mm ? +mm : 0));
  }
  return null;
}

const RELATIVE: Record<string, number> = {
  hoy: 0, today: 0, heute: 0, "aujourd'hui": 0, aujourdhui: 0, oggi: 0, hoje: 0,
  ayer: -1, yesterday: -1, gestern: -1, hier: -1, ieri: -1, ontem: -1,
  anteayer: -2, vorgestern: -2, 'avant-hier': -2, 'l altro ieri': -2, anteontem: -2,
};

/**
 * Extrae fechas afirmadas en un texto. `ref` = fecha de publicación (para
 * resolver "ayer" y años implícitos).
 */
export function extractDates(text: string, ref: Date = new Date()): ExtractedDate[] {
  const out: ExtractedDate[] = [];
  const f = fold(text);
  const seen = new Set<string>();
  const push = (iso: string, raw: string, precision: ExtractedDate['precision']) => {
    const k = `${iso}|${precision}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ iso, raw, precision });
  };
  const refY = ref.getUTCFullYear();

  // ISO 2026-09-27
  for (const m of f.matchAll(/\b(19\d{2}|20\d{2})-(\d{2})-(\d{2})\b/g)) {
    if (valid(+m[1], +m[2], +m[3])) push(`${m[1]}-${m[2]}-${m[3]}`, m[0], 'day');
  }
  // 27 de septiembre de 2026 | 27 septembre 2026 | 27. September 2026 | 27 settembre 2026
  const reDMY = new RegExp(`\\b(\\d{1,2})(?:º|o|er|\\.)?\\s*(?:de\\s+)?(${MONTH_ALT})\\.?(?:\\s*(?:de|del)?\\s*(\\d{4}))?\\b`, 'g');
  for (const m of f.matchAll(reDMY)) {
    const d = +m[1];
    const mo = MONTHS[m[2]];
    const y = m[3] ? +m[3] : inferYear(mo, d, ref);
    if (valid(y, mo, d)) push(`${y}-${pad(mo)}-${pad(d)}`, m[0], m[3] ? 'day' : 'day');
  }
  // September 27, 2026 | Sept. 27
  const reMDY = new RegExp(`\\b(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'g');
  for (const m of f.matchAll(reMDY)) {
    const mo = MONTHS[m[1]];
    const d = +m[2];
    const y = m[3] ? +m[3] : inferYear(mo, d, ref);
    if (valid(y, mo, d)) push(`${y}-${pad(mo)}-${pad(d)}`, m[0], 'day');
  }
  // dd/mm/yyyy (europeo; en inglés de EE. UU. es ambiguo y solo se acepta si d>12)
  for (const m of f.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (valid(y, b, a)) push(`${y}-${pad(b)}-${pad(a)}`, m[0], 'day');
  }
  // mes + año: "en marzo de 2019", "in March 2019"
  const reMY = new RegExp(`\\b(${MONTH_ALT})\\s+(?:de\\s+|del\\s+)?(\\d{4})\\b`, 'g');
  for (const m of f.matchAll(reMY)) {
    const mo = MONTHS[m[1]];
    const y = +m[2];
    if (valid(y, mo, 1) && !out.some((o) => o.iso.startsWith(`${y}-${pad(mo)}`))) push(`${y}-${pad(mo)}`, m[0], 'month');
  }
  // Años sueltos con preposición: "en 2019", "in 2019", "im Jahr 2019", "nel 2019", "em 2019"
  for (const m of f.matchAll(/\b(?:en|in|im jahr|nel|em|del ano|de|since|desde|seit|depuis|dal|desde)\s+(19\d{2}|20\d{2})\b/g)) {
    const y = +m[1];
    if (y !== refY && !out.some((o) => o.iso.startsWith(String(y)))) push(String(y), m[0], 'year');
  }
  // Relativas
  for (const [word, delta] of Object.entries(RELATIVE)) {
    const re = new RegExp(`(^|[^\\p{L}])${word.replace(/[-']/g, '[-\' ]?')}($|[^\\p{L}])`, 'u');
    if (re.test(f)) {
      const d = new Date(ref.getTime() + delta * 86400000);
      push(d.toISOString().slice(0, 10), word, 'relative');
    }
  }
  return out;
}

function inferYear(month: number, day: number, ref: Date): number {
  const y = ref.getUTCFullYear();
  // Si la fecha sin año quedaría más de 2 meses en el futuro respecto a la
  // publicación, se refiere al año anterior ("el 20 de diciembre", publicado en enero).
  const candidate = Date.UTC(y, month - 1, day);
  if (candidate - ref.getTime() > 60 * 86400000) return y - 1;
  return y;
}

/** Diferencia en días (a - b). */
export function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 86400000;
}

/** Convierte una fecha extraída a Date (inicio del periodo). */
export function extractedToDate(d: ExtractedDate): Date {
  if (d.precision === 'year') return new Date(Date.UTC(+d.iso, 0, 1));
  if (d.precision === 'month') {
    const [y, m] = d.iso.split('-');
    return new Date(Date.UTC(+y, +m - 1, 1));
  }
  return new Date(`${d.iso}T00:00:00Z`);
}
