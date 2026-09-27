/**
 * Redactor determinista ("ficha verificada"). Funciona sin IA y sin coste:
 *   titular  ← la afirmación mejor respaldada, comprimida (atribuida si no está verificada)
 *   entrada  ← esa afirmación + quién la confirma
 *   Lo que se sabe / Datos clave / Citas / Discrepancias / No confirmado / Qué puede pasar
 *   Cómo lo verificamos ← recuadro con lo confirmado, lo atribuido y lo pendiente
 * Cada frase lleva los ids de las afirmaciones que la sostienen, y las
 * afirmaciones solo aparecen como hecho si están confirmadas.
 * Límite de copia: ninguna frase supera maxWords palabras de una fuente, y se
 * reparten las afirmaciones entre fuentes para no depender de una sola.
 */
import type { ArticleBlock, VerificationBox } from '../db/schema';
import { country } from '../config/countries';
import { localeFor } from '../config/languages';
import { truncate } from '../text/normalize';
import { compressClaim, lowerFirst } from './compress';
import type { Draft } from './draft';
import type { FactClaim, FactSheet } from './factsheet';
import { listJoin, PHRASES } from './phrases';

export type WriteOptions = { maxWords?: number; timeZone?: string; countryCode?: string | null };

export function writeDeterministic(fs: FactSheet, opts: WriteOptions = {}): Draft | null {
  const lang = fs.language;
  const P = PHRASES[lang];
  if (!P) return null;
  const maxWords = opts.maxWords ?? 22;
  const locale = localeFor(lang, opts.countryCode ?? null);
  const tz = opts.timeZone ?? (opts.countryCode ? country(opts.countryCode)?.timezone : undefined) ?? 'UTC';
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long', timeZone: tz });
  const boilerplate: string[] = [];
  const bp = (s: string) => {
    boilerplate.push(s);
    return s;
  };

  const developing = !fs.verified;
  const body: ArticleBlock[] = [];
  let headline: string | null = null;
  let summary = '';
  let leadClaim: FactClaim | null = null;

  // ── Plantilla de datos estructurados (terremoto de fuente primaria) ──
  if (fs.earthquake) {
    const q = fs.earthquake;
    const place = q.placeName ? P.near(q.placeName) : '';
    const mag = nf.format(q.magnitude);
    headline = P.earthquake.headline(mag, place).trim();
    // Sin verificar (una sola fuente), también el titular va atribuido: «…, según USGS».
    if (developing) headline = stripPeriod(P.according(headline, q.agency));
    const lead = P.earthquake.lead(capitalize(q.agency), timeFmt.format(q.time), mag, place, q.depthKm == null ? '—' : nf.format(q.depthKm));
    body.push({ type: 'p', text: lead, claimIds: [] });
    boilerplate.push(lead);
    if (q.tsunami) body.push({ type: 'p', text: bp(P.earthquake.tsunami), claimIds: [] });
    summary = lead;
  }

  // ── Afirmación principal (entrada) y titular ──
  // Titular: el titular de fuente mejor respaldado, comprimido; si no hay,
  // la afirmación principal. Entrada: la mejor frase del cuerpo, más completa.
  const pool = developing ? [...fs.confirmed, ...fs.attributed] : fs.confirmed;
  const bodyFirst = [...pool.filter((c) => !c.isHeadline), ...pool.filter((c) => c.isHeadline)];
  let headlineClaim: FactClaim | null = null;
  for (const c of bodyFirst) {
    const compressed = compressClaim(c.text, maxWords);
    if (!compressed) continue;
    leadClaim = c;
    const leadSentence = developing ? P.according(compressed, listJoin(lang, c.attribution.slice(0, 3))) : `${compressed}.`;
    body.push({ type: 'p', text: leadSentence, claimIds: [claimRef(c)] });
    if (!summary) summary = leadSentence;
    break;
  }
  if (!headline) {
    const candidates = [...pool.filter((c) => c.isHeadline && c.key !== leadClaim?.key), ...(leadClaim ? [leadClaim] : [])];
    for (const c of candidates) {
      const short = compressClaim(c.text, 16);
      if (!short) continue;
      const h = developing ? stripPeriod(P.according(short, listJoin(lang, c.attribution.slice(0, 2)))) : short;
      if (h.length <= 120) {
        headline = h;
        headlineClaim = c;
        break;
      }
    }
  }
  if (!headline || (!leadClaim && !fs.earthquake)) return null;
  void headlineClaim;

  // Quién lo confirma (en la entradilla si está verificada; aquí si es de una sola fuente)
  const confirmers = fs.sources.map((s) => s.name);
  if (developing && confirmers.length === 1) body.push({ type: 'p', text: bp(P.singleSource(confirmers[0])), claimIds: [] });

  // ── Lo que se sabe (reparto entre fuentes) ──
  const used = new Set<string>(leadClaim ? [leadClaim.key] : []);
  const perSource = new Map<string, number>();
  const known: { text: string; claimIds: number[] }[] = [];
  const knownPool = developing ? [...fs.confirmed, ...fs.attributed] : fs.confirmed;
  for (const c of knownPool) {
    if (known.length >= 5) break;
    if (used.has(c.key) || nearDuplicate(c, [...used].map((k) => fs.claims.find((x) => x.key === k)!).filter(Boolean))) continue;
    const src = c.attribution[0] ?? '';
    if ((perSource.get(src) ?? 0) >= 2) continue;
    const compressed = compressClaim(c.text, maxWords);
    if (!compressed) continue;
    used.add(c.key);
    perSource.set(src, (perSource.get(src) ?? 0) + 1);
    const text = c.status === 'supported' && !developing ? `${compressed}.` : P.according(compressed, listJoin(lang, c.attribution.slice(0, 2)));
    known.push({ text, claimIds: [claimRef(c)] });
  }
  if (known.length) {
    body.push({ type: 'h2', text: P.headings.known });
    body.push({ type: 'list', items: known });
  }

  // ── Datos clave (estructurados, redacción propia) ──
  const figures = fs.figures.filter((f) => P.units[f.unit.startsWith('currency:') ? 'currency' : f.unit]);
  if (figures.length) {
    body.push({ type: 'h2', text: P.headings.figures });
    body.push({
      type: 'list',
      items: figures.slice(0, 6).map((f) => {
        const isCur = f.unit.startsWith('currency:');
        const label = P.units[isCur ? 'currency' : f.unit];
        const value = isCur ? new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode(f.unit), maximumFractionDigits: 0 }).format(f.value) : nf.format(f.value);
        const ids = fs.claims
          .filter((c) => c.kind !== 'prediction' && c.modality !== 'hedged' && c.numbers.some((n) => n.unit === f.unit && n.value === f.value) && ['supported', 'partially_supported'].includes(c.status))
          .map(claimRef);
        return { text: `${label}: ${value} ${P.figureSource(listJoin(lang, f.sources.slice(0, 3)))}`, claimIds: ids };
      }),
    });
  }

  // ── Citas verificadas ──
  for (const c of fs.quotes.slice(0, 2)) {
    if (!c.quote?.speaker) continue;
    body.push({ type: 'quote', text: c.quote.text, speaker: c.quote.speaker, claimIds: [claimRef(c)], sourceUrl: c.supporters[0]?.url ?? '' });
  }

  // ── Discrepancias ──
  if (fs.discrepancies.length) {
    body.push({ type: 'h2', text: P.headings.discrepancies });
    body.push({
      type: 'list',
      items: fs.discrepancies.slice(0, 4).map((d) => {
        const parts = d.parts.map((p) => `${p.source}: ${formatValue(p.value, nf)}`).join('; ');
        return { text: bp(P.discrepancy(P.fieldNames[d.field] ?? d.field, parts)), claimIds: [] };
      }),
    });
  }

  // ── No confirmado ──
  const unconf = fs.unconfirmed.filter((c) => !used.has(c.key)).slice(0, 4);
  const unconfItems: { text: string; claimIds: number[] }[] = [];
  for (const c of unconf) {
    const compressed = compressClaim(c.text, maxWords);
    if (!compressed) continue;
    unconfItems.push({ text: `${P.according(compressed, listJoin(lang, c.attribution.slice(0, 2)))} ${P.unconfirmedSuffix}`, claimIds: [claimRef(c)] });
  }
  if (unconfItems.length) {
    body.push({ type: 'h2', text: P.headings.unconfirmed });
    body.push({ type: 'list', items: unconfItems });
  }

  // ── Predicciones (siempre atribuidas y en futuro/condicional) ──
  const preds: { text: string; claimIds: number[] }[] = [];
  for (const c of fs.predictions.slice(0, 3)) {
    const compressed = compressClaim(c.text, maxWords);
    if (!compressed) continue;
    preds.push({ text: P.according(compressed, listJoin(lang, c.attribution.slice(0, 2))), claimIds: [claimRef(c)] });
  }
  if (preds.length) {
    body.push({ type: 'h2', text: P.headings.next });
    body.push({ type: 'list', items: preds });
  }

  if (developing) body.push({ type: 'p', text: bp(P.willUpdate), claimIds: [] });

  const uniq = <T extends { text: string }>(xs: T[]): T[] => {
    const seen = new Set<string>();
    return xs.filter((x) => {
      const k = x.text.toLowerCase().replace(/[\s.,;:]+/g, ' ').trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const verification: VerificationBox = {
    confirmed: uniq(fs.confirmed.slice(0, 6).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    attributed: uniq(fs.attributed.slice(0, 6).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    unconfirmed: uniq(fs.unconfirmed.slice(0, 6).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    superseded: uniq(fs.superseded.slice(0, 3).map((c) => ({ text: compressClaim(c.text, 30) ?? truncate(c.text, 200), by: c.attribution }))),
    contradictions: fs.discrepancies.map((d) => ({ text: P.discrepancy(P.fieldNames[d.field] ?? d.field, d.parts.map((p) => `${p.source}: ${formatValue(p.value, nf)}`).join('; ')) })),
    method: P.method(fs.independentCredible, fs.hasPrimary),
  };

  // El número y los nombres cuadran siempre: si hay más de cuatro, se dice «entre ellas».
  const subheadline = developing
    ? P.developingNote
    : confirmers.length > 4
      ? P.confirmedByMany(confirmers.length, listJoin(lang, confirmers.slice(0, 3)))
      : confirmers.length
        ? P.confirmedBy(confirmers.length, listJoin(lang, confirmers))
        : null;
  if (subheadline) boilerplate.push(subheadline);
  const timeline = fs.timeline.map((e) => ({ at: e.at.toISOString(), text: `${P.timelineItem(e.source)}` }));

  return {
    language: lang,
    headline,
    subheadline,
    summary: truncate(summary, 300),
    body,
    verification,
    seoTitle: truncate(headline, 70),
    seoDescription: truncate(summary, 160),
    writer: 'template',
    isDeveloping: developing,
    timeline,
    boilerplate,
  };
}

/** Referencia estable a la afirmación (id de BD si ya existe; si no, índice negativo temporal). */
export function claimRef(c: FactClaim): number {
  if (c.dbId) return c.dbId;
  const [item, idx] = c.key.split(':').map(Number);
  return -(item * 1000 + idx + 1);
}

function stripPeriod(s: string): string {
  return s.replace(/\.$/, '');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function currencyCode(unit: string): string {
  const c = unit.split(':')[1];
  return c === 'PESO' ? 'MXN' : c;
}

function formatValue(v: string, nf: Intl.NumberFormat): string {
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== '' ? nf.format(n) : v;
}

function nearDuplicate(c: FactClaim, others: FactClaim[]): boolean {
  const a = new Set(c.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  return others.some((o) => {
    const b = new Set(o.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    return inter / Math.max(1, Math.min(a.size, b.size)) > 0.7;
  });
}

export { lowerFirst };
