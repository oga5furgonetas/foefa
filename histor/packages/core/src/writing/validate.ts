/**
 * Control de alucinaciones (sección 22). Para cada frase del artículo:
 *   ¿cita afirmaciones de la ficha?           → si no, y no es frase de servicio: FALLO
 *   ¿cada cifra está en lo citado?             → si no: FALLO
 *   ¿cada fecha está en lo citado?             → si no: FALLO
 *   ¿cada nombre propio existe en lo citado?   → si no: FALLO
 *   ¿cada cita literal existe en las fuentes, con el mismo hablante? → si no: FALLO
 *   ¿algo no confirmado se presenta como hecho? → FALLO
 *   ¿una predicción se presenta como hecho?     → FALLO
 * Si falla cualquier cosa: NO PUBLICAR.
 */
import { extractDates } from '../text/dates';
import { entityKey, extractEntities, findPlaces } from '../text/entities';
import { hasAttributionMarker, hasPredictionMarker } from '../text/modality';
import { extractNumbers, numbersAgree } from '../text/numbers';
import { extractQuotes, quoteAppearsIn, sameSpeaker } from '../text/quotes';
import { fold as foldText } from '../text/normalize';
import { sentences } from '../text/tokenize';
import { claimRef } from './deterministic';
import type { Draft } from './draft';
import type { FactClaim, FactSheet } from './factsheet';

export type ValidationIssue = { check: 'citation' | 'number' | 'date' | 'entity' | 'quote' | 'status' | 'prediction' | 'headline'; text: string; detail: string };

export type ValidationResult = { ok: boolean; issues: ValidationIssue[] };

type Unit = { text: string; claimIds: number[]; section: 'lead' | 'body' | 'unconfirmed' | 'next' | 'figures' | 'quote' };

export function validateDraft(draft: Draft, fs: FactSheet, extraAllowedNames: string[] = []): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byRef = new Map<number, FactClaim>(fs.claims.map((c) => [claimRef(c), c]));
  const boiler = new Set(draft.boilerplate.map((s) => s.trim()));
  const baseNames = [...fs.sources.map((s) => s.name), ...fs.claims.flatMap((c) => c.attribution), ...extraAllowedNames, 'Histor', 'USGS'];
  if (fs.earthquake) baseNames.push(fs.earthquake.agency, ...(fs.earthquake.placeName ? [fs.earthquake.placeName] : []));
  const allowedNames = new Set(
    [...baseNames, ...baseNames.flatMap((n) => extractEntities(n).map((e) => e.name)), ...baseNames.flatMap((n) => n.split(/[()]/).map((x) => x.trim()).filter(Boolean))].map(entityKey),
  );
  const sourceTexts = fs.sourceTexts.map((s) => s.text);

  // Recorrer bloques, sabiendo en qué sección está cada frase.
  const units: Unit[] = [];
  let section: Unit['section'] = 'lead';
  for (const b of draft.body) {
    if (b.type === 'h2') {
      const P = b.text;
      section = /confirm|bestätigt|confermat|confirmad|confirmé/i.test(P) && /no|not|nicht|non|não|pas|ainda|encore|noch/i.test(P)
        ? 'unconfirmed'
        : /pasar|happen|weitergehen|suivre|succedere|acontecer/i.test(P)
          ? 'next'
          : /datos|figures|zahlen|chiffres|numeri|números/i.test(P)
            ? 'figures'
            : 'body';
      continue;
    }
    if (b.type === 'p') units.push({ text: b.text, claimIds: b.claimIds, section });
    else if (b.type === 'list') for (const it of b.items) units.push({ text: it.text, claimIds: it.claimIds, section });
    else if (b.type === 'quote') units.push({ text: `«${b.text}» ${b.speaker}`, claimIds: b.claimIds, section: 'quote' });
  }

  for (const u of units) {
    if (boiler.has(u.text.trim())) continue;
    const cited = u.claimIds.map((id) => byRef.get(id)).filter((c): c is FactClaim => !!c);
    if (!cited.length) {
      issues.push({ check: 'citation', text: u.text, detail: 'frase sin afirmaciones que la respalden' });
      continue;
    }
    for (const s of u.section === 'quote' ? [u.text] : sentences(u.text)) checkSentence(s, cited, u, issues, fs, allowedNames, sourceTexts);
  }

  // Titular: cifras y nombres respaldados; si no está verificado, atribuido.
  const leadClaims = [...fs.confirmed, ...fs.attributed];
  const hNums = extractNumbers(draft.headline, draft.language).filter((n) => n.unit || n.value >= 10);
  for (const n of hNums) {
    const ok =
      leadClaims.some((c) => c.numbers.some((m) => numbersAgree(n, m) || (!n.unit && m.value === n.value))) ||
      (fs.earthquake && (n.unit === 'magnitude' || !n.unit) && Math.abs(n.value - fs.earthquake.magnitude) < 0.05);
    if (!ok) issues.push({ check: 'headline', text: draft.headline, detail: `cifra no respaldada en el titular: ${n.raw}` });
  }
  if (!fs.verified && !fs.earthquake && !hasAttributionMarker(draft.headline)) {
    issues.push({ check: 'headline', text: draft.headline, detail: 'titular de una noticia no verificada sin atribución' });
  }
  for (const e of extractEntities(draft.headline, draft.language).filter((x) => x.type === 'person')) {
    const k = entityKey(e.name);
    if (!leadClaims.some((c) => c.entities.some((x) => x === k || x.endsWith(` ${k.split(' ').pop()}`))) && !allowedNames.has(k)) {
      issues.push({ check: 'headline', text: draft.headline, detail: `persona no respaldada en el titular: ${e.name}` });
    }
  }
  return { ok: issues.length === 0, issues };
}

function checkSentence(s: string, cited: FactClaim[], u: Unit, issues: ValidationIssue[], fs: FactSheet, allowedNames: Set<string>, sourceTexts: string[]) {
  const lang = cited[0]?.language;
  // Cifras
  const citedNums = cited.flatMap((c) => c.numbers);
  for (const n of extractNumbers(s, lang)) {
    if (!n.unit && n.value < 10) continue; // ordinales y conteos pequeños sin magnitud
    const loose = (u: string | null) => !u || u.startsWith('n:');
    const ok = citedNums.some((m) => numbersAgree(n, m) || ((loose(n.unit) || loose(m.unit)) && Math.abs(m.value - n.value) <= Math.abs(m.value) * 0.001));
    if (!ok) issues.push({ check: 'number', text: s, detail: `cifra no respaldada: ${n.raw}` });
  }
  // Fechas (solo las de día concreto)
  const citedDays = new Set(cited.flatMap((c) => c.dates.filter((d) => d.precision === 'day').map((d) => d.iso)));
  const ref = fs.eventTime ?? new Date();
  for (const d of extractDates(s, ref).filter((x) => x.precision === 'day')) {
    if (!citedDays.has(d.iso)) issues.push({ check: 'date', text: s, detail: `fecha no respaldada: ${d.raw}` });
  }
  // Nombres propios (personas y organizaciones)
  const citedEntities = new Set(cited.flatMap((c) => c.entities));
  const places = new Set(findPlaces(s).map((p) => entityKey(p.name)));
  for (const e of extractEntities(s, lang)) {
    if (e.type === 'place' || e.type === 'other') continue;
    const k = entityKey(e.name);
    if (places.has(k) || allowedNames.has(k)) continue;
    const last = k.split(' ').pop() ?? '';
    const ok = citedEntities.has(k) || [...citedEntities].some((x) => x.includes(k) || (last.length > 3 && x.split(' ').pop() === last));
    if (!ok) issues.push({ check: 'entity', text: s, detail: `nombre no respaldado: ${e.name}` });
  }
  // Citas literales
  const quotes = u.section === 'quote' ? [{ text: s.replace(/^«|».*$/g, ''), speaker: s.split('» ').pop() ?? null }] : extractQuotes(s).map((q) => ({ text: q.text, speaker: q.speaker }));
  for (const q of quotes) {
    if (!quoteAppearsIn(q.text, sourceTexts)) {
      issues.push({ check: 'quote', text: s, detail: 'la cita no aparece literalmente en ninguna fuente' });
      continue;
    }
    const claimSpeaker = cited.find((c) => c.quote)?.quote?.speaker ?? null;
    if (q.speaker && claimSpeaker && !sameSpeaker(q.speaker, claimSpeaker)) {
      issues.push({ check: 'quote', text: s, detail: `cita atribuida a ${q.speaker}, pero la fuente la atribuye a ${claimSpeaker}` });
    }
  }
  // Estado: lo no confirmado debe ir atribuido; nada no confirmado en "lo que se sabe" como hecho.
  const weakest = cited.some((c) => c.status === 'unsupported' || c.status === 'contradicted')
    ? 'unsupported'
    : cited.some((c) => c.status === 'partially_supported')
      ? 'partial'
      : 'supported';
  if (weakest !== 'supported' && u.section !== 'figures' && !hasAttributionMarker(s)) {
    issues.push({ check: 'status', text: s, detail: 'afirmación no verificada presentada como hecho (falta atribución)' });
  }
  if (cited.some((c) => c.status === 'contradicted') && u.section !== 'unconfirmed') {
    issues.push({ check: 'status', text: s, detail: 'usa una afirmación contradicha fuera de la sección de no confirmados' });
  }
  // Predicciones: deben seguir siendo predicciones.
  // Un tramo literal de la afirmación sin la parte predictiva (p. ej. se quitó
  // "…, que prevé X") no es una predicción; una paráfrasis sí debe conservar la marca.
  const core = foldText(stripAttribution(s));
  const literalSubspan = cited.some((c) => foldText(c.text).includes(core) && core.length > 20);
  if (cited.some((c) => c.kind === 'prediction') && !hasPredictionMarker(s) && !literalSubspan) {
    issues.push({ check: 'prediction', text: s, detail: 'una predicción aparece como hecho' });
  }
}

function stripAttribution(s: string): string {
  return s
    .replace(/[,;]?\s*(según|according to|berichtet|laut|selon|secondo|segundo)\b[^.]*\.?$/i, '')
    .replace(/[.!?]+$/, '')
    .trim();
}
