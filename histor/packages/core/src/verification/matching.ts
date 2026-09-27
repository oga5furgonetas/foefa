/**
 * Emparejamiento de evidencias y detección de contradicciones.
 * Para cada afirmación se buscan, en las piezas de OTROS grupos
 * independientes, frases que la respalden o la contradigan: mismas
 * entidades, mismas cifras (misma magnitud), mismos lugares, misma cita
 * atribuida a la misma persona. Todo determinista y explicable.
 */
import { extractDates } from '../text/dates';
import { entityKey, extractEntities, findPlaces } from '../text/entities';
import { detectModality } from '../text/modality';
import { extractNumbers, numbersAgree, type ExtractedNumber } from '../text/numbers';
import { extractQuotes, quoteKey, sameSpeaker } from '../text/quotes';
import { cosine, termVector, type TermVector } from '../text/similarity';
import { sentences } from '../text/tokenize';
import { itemFullText, placeKey } from './claims';
import type { VClaim, VContradiction, VEvidence, VItem } from './types';

type ItemProfile = {
  item: VItem;
  groupKey: string;
  language: string | null;
  sentences: { text: string; vec: TermVector }[];
  entityKeys: Set<string>;
  numbers: ExtractedNumber[];
  dayDates: Set<string>;
  placeKeys: Set<string>;
  quotes: { key: string; speaker: string | null }[];
  denials: { text: string; entities: Set<string> }[];
  fullText: string;
};

export function profileItem(item: VItem, groupKey: string): ItemProfile {
  const full = itemFullText(item);
  const lang = item.language;
  const sents = sentences(full).map((s) => ({ text: s, vec: termVector(s, lang ?? undefined) }));
  const ents = extractEntities(full);
  const ref = item.publishedAt ?? item.fetchedAt;
  const denials = sents
    .filter((s) => detectModality(s.text).modality === 'denied')
    .map((s) => ({ text: s.text, entities: new Set(extractEntities(s.text).map((e) => entityKey(e.name))) }));
  return {
    item,
    groupKey,
    language: lang,
    sentences: sents,
    entityKeys: new Set(ents.map((e) => entityKey(e.name))),
    numbers: extractNumbers(full, lang ?? undefined),
    dayDates: new Set(extractDates(full, ref).filter((d) => d.precision === 'day').map((d) => d.iso)),
    placeKeys: new Set([...findPlaces(full).map(placeKey), ...item.places.map(placeKey)]),
    quotes: extractQuotes(full).map((q) => ({ key: quoteKey(q.text), speaker: q.speaker })),
    denials,
    fullText: full,
  };
}

function entityMatches(key: string, pool: Set<string>): boolean {
  if (pool.has(key)) return true;
  const last = key.split(' ').pop() ?? '';
  if (last.length < 5) return false;
  for (const k of pool) {
    const kl = k.split(' ').pop() ?? '';
    if (kl === last) {
      // Mismo apellido; si ambos tienen nombre de pila distinto, no es la misma persona.
      const a = key.split(' ');
      const b = k.split(' ');
      if (a.length > 1 && b.length > 1 && a[0] !== b[0]) continue;
      return true;
    }
  }
  return false;
}

export type MatchResult = { evidence: VEvidence[]; contradictions: VContradiction[] };

export function matchEvidence(
  claims: VClaim[],
  items: VItem[],
  itemGroup: Record<number, { key: string }>,
  groupIsPrimary: (key: string) => boolean,
): MatchResult {
  const profiles = new Map<number, ItemProfile>();
  for (const it of items) if (itemGroup[it.id]) profiles.set(it.id, profileItem(it, itemGroup[it.id].key));
  const evidence: VEvidence[] = [];
  const contradictions: VContradiction[] = [];
  const contraSeen = new Set<string>();

  for (const c of claims) {
    const own = profiles.get(c.itemId);
    if (!own) continue;
    const cVec = termVector(c.text, c.language);
    // Lo que se AFIRMA (sin nombres, lugares ni cifras): «negocia comprar terrenos» ≠ «estudia abrir».
    const nameTerms = new Set(Object.keys(termVector([...extractEntities(c.text, c.language).map((e) => e.name), ...findPlaces(c.text).map((x) => x.name)].join(' '), c.language)));
    const cPred = predicateOf(cVec, nameTerms);
    const cQuoteKey = c.quote ? quoteKey(c.quote.text) : null;
    for (const p of profiles.values()) {
      if (p.item.id === c.itemId) continue;
      const sameGroup = p.groupKey === own.groupKey;
      const sameLang = !!p.language && p.language === c.language;
      // Similitud léxica: mejor frase de la otra pieza (solo mismo idioma).
      let lexSim = 0;
      let predSim = 0;
      let bestSentence: string | null = null;
      if (sameLang) {
        for (const s of p.sentences) {
          const sim = cosine(cVec, s.vec);
          if (sim > lexSim) {
            lexSim = sim;
            bestSentence = s.text;
          }
          predSim = Math.max(predSim, coverage(cPred, s.vec));
        }
      }
      const entCov = c.entities.length ? c.entities.filter((e) => entityMatches(e, p.entityKeys)).length / c.entities.length : null;
      // Cifras: acuerdo o conflicto por magnitud.
      let numAgree = 0;
      let numConflict: { claim: ExtractedNumber; other: ExtractedNumber } | null = null;
      const unitNums = c.numbers.filter((n) => n.unit);
      const pseudoUnit = (u: string | null) => !!u && u.startsWith('n:');
      for (const n of unitNums) {
        // Entre idiomas la "pseudounidad" (el sustantivo) cambia: se compara solo el valor.
        const same = p.numbers.filter((m) => m.unit === n.unit || (!sameLang && pseudoUnit(n.unit) && pseudoUnit(m.unit)));
        if (!same.length) continue;
        if (same.some((m) => numbersAgree(n, m) || (m.unit !== n.unit && m.value === n.value))) numAgree++;
        else if (same.some((m) => m.unit === n.unit)) numConflict ??= { claim: n, other: same.find((m) => m.unit === n.unit)! };
      }
      const numRatio = unitNums.length ? numAgree / unitNums.length : null;
      const placeAgree = c.places.length ? c.places.filter((k) => p.placeKeys.has(k)).length / c.places.length : null;

      const topical = (entCov ?? 0) >= 0.5 || lexSim >= 0.3 || (numRatio ?? 0) > 0;

      // Cita: debe existir en la otra pieza atribuida a la misma persona.
      let quoteAgree = false;
      if (cQuoteKey) {
        const q = p.quotes.find((x) => x.key.includes(cQuoteKey) || cQuoteKey.includes(x.key));
        if (q) {
          if (!c.quote?.speaker || !q.speaker || sameSpeaker(c.quote.speaker, q.speaker)) quoteAgree = true;
          else if (!sameGroup) {
            addContradiction(contradictions, contraSeen, {
              field: 'quote',
              severity: 'critical',
              claimKeys: [c.key],
              detail: { quote: c.quote?.text, speakerClaimed: c.quote?.speaker, speakerElsewhere: q.speaker, itemId: p.item.id },
            });
            evidence.push(ev(c, p, 'contradicts', 0.9, groupIsPrimary, { quoteSpeakerMismatch: true }, null));
            continue;
          }
        }
      }

      // Desmentido explícito que comparte protagonistas.
      if (!sameGroup && c.entities.length && c.modality !== 'denied') {
        const den = p.denials.find((d) => {
          const shared = c.entities.filter((e) => entityMatches(e, d.entities)).length;
          return shared / c.entities.length >= 0.5;
        });
        if (den) {
          addContradiction(contradictions, contraSeen, {
            field: 'denial',
            severity: groupIsPrimary(p.groupKey) ? 'critical' : 'major',
            claimKeys: [c.key],
            detail: { denial: den.text.slice(0, 280), itemId: p.item.id },
          });
          evidence.push(ev(c, p, 'contradicts', 0.85, groupIsPrimary, { denial: true }, den.text));
          continue;
        }
      }

      const pseudo = numConflict?.claim.unit?.startsWith('n:') ?? false;
      if (numConflict && !sameGroup && (pseudo ? sameLang && lexSim >= 0.5 : topical)) {
        const ti = (own.item.publishedAt ?? own.item.fetchedAt).getTime();
        const tj = (p.item.publishedAt ?? p.item.fetchedAt).getTime();
        // Una cifra que cambia con horas de diferencia suele ser un balance que evoluciona.
        const evolution = Math.abs(tj - ti) > 60 * 60 * 1000;
        addContradiction(contradictions, contraSeen, {
          field: 'number',
          severity: evolution ? 'minor' : 'major',
          claimKeys: [c.key],
          detail: {
            unit: numConflict.claim.unit,
            claimValue: numConflict.claim.value,
            otherValue: numConflict.other.value,
            evolution,
            laterItemId: tj > ti ? p.item.id : own.item.id,
            itemId: p.item.id,
          },
        });
        if (!evolution) {
          evidence.push(ev(c, p, 'contradicts', 0.7, groupIsPrimary, { numberConflict: numConflict }, bestSentence));
          continue;
        }
      }

      // Lugar incompatible: misma historia, ciudades distintas del mismo país.
      if (!sameGroup && topical && c.places.some((k) => k.startsWith('city:'))) {
        const cCities = c.places.filter((k) => k.startsWith('city:'));
        const pCities = [...p.placeKeys].filter((k) => k.startsWith('city:'));
        if (pCities.length && !cCities.some((k) => p.placeKeys.has(k)) && (entCov ?? 0) >= 0.6 && lexSim >= 0.35) {
          addContradiction(contradictions, contraSeen, {
            field: 'place',
            severity: 'major',
            claimKeys: [c.key],
            detail: { claimPlaces: cCities, otherPlaces: pCities, itemId: p.item.id },
          });
        }
      }

      // Fecha incompatible (ambas con día) sobre lo mismo.
      if (!sameGroup && topical && lexSim >= 0.4) {
        const cDays = c.dates.filter((d) => d.precision === 'day').map((d) => d.iso);
        if (cDays.length && p.dayDates.size && !cDays.some((d) => p.dayDates.has(d))) {
          const diff = Math.min(...cDays.flatMap((a) => [...p.dayDates].map((b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000)));
          if (diff > 1) {
            addContradiction(contradictions, contraSeen, {
              field: 'date',
              severity: diff > 30 ? 'critical' : 'major',
              claimKeys: [c.key],
              detail: { claimDates: cDays, otherDates: [...p.dayDates], itemId: p.item.id },
            });
          }
        }
      }

      // Puntuación de respaldo.
      let score: number;
      if (c.quote) {
        score = quoteAgree ? 0.9 : 0;
      } else if (sameLang) {
        score = 0.45 * lexSim + 0.3 * (entCov ?? lexSim) + 0.15 * (numRatio ?? 0.5) + 0.1 * (placeAgree ?? 0.5);
        if (entCov === 0 && (numRatio ?? 0) === 0) score *= 0.5;
      } else {
        // Entre idiomas: entidades, cifras y lugares son lo que viaja.
        const anchor = (entCov ?? 0) > 0 || (numRatio ?? 0) > 0;
        score = anchor ? 0.6 * (entCov ?? 0.3) + 0.25 * (numRatio ?? 0.4) + 0.15 * (placeAgree ?? 0.4) : 0;
      }
      if (numRatio === 0 && unitNums.length) score *= 0.6; // no confirma las cifras
      // Compartir protagonistas y lugar no basta: sin cifras que coincidan, la otra pieza
      // tiene que decir lo mismo de ellos. Si no, solo «menciona» (queda atribuida, no confirmada).
      if (sameLang && !c.quote && !numAgree && Object.keys(cPred).length >= 2 && predSim < PREDICATE_MIN) score = Math.min(score, 0.45);
      const relation = score >= 0.5 ? 'supports' : score >= 0.3 ? 'mentions' : null;
      if (relation) {
        evidence.push(
          ev(
            c,
            p,
            relation,
            Math.round(score * 1000) / 1000,
            groupIsPrimary,
            { lexSim: round(lexSim), entityCoverage: entCov == null ? null : round(entCov), numbers: numRatio, places: placeAgree, quote: quoteAgree },
            bestSentence,
          ),
        );
      }
    }
  }
  return { evidence, contradictions };
}

function ev(
  c: VClaim,
  p: ItemProfile,
  relation: VEvidence['relation'],
  score: number,
  groupIsPrimary: (key: string) => boolean,
  matched: Record<string, unknown>,
  excerpt: string | null,
): VEvidence {
  return {
    claimKey: c.key,
    itemId: p.item.id,
    sourceId: p.item.sourceId,
    relation,
    score,
    independenceKey: p.groupKey,
    isPrimary: groupIsPrimary(p.groupKey),
    matched,
    excerpt: excerpt ? excerpt.slice(0, 280) : null,
  };
}

function addContradiction(list: VContradiction[], seen: Set<string>, c: VContradiction) {
  // A contra B y B contra A son la misma contradicción.
  const d = c.detail as Record<string, unknown>;
  const pairKey =
    c.field === 'number'
      ? `number|${d.unit}|${[d.claimValue, d.otherValue].map(String).sort().join('/')}`
      : `${c.field}|${c.claimKeys.join(',')}|${JSON.stringify(c.detail).slice(0, 120)}`;
  const k = pairKey;
  if (seen.has(k)) return;
  seen.add(k);
  list.push(c);
}

/**
 * Parte mínima de lo que afirma una frase (sus palabras de contenido, sin nombres ni
 * cifras) que tiene que aparecer en una frase de otra pieza para RESPALDARLA cuando no
 * comparten cifras. «negocia comprar terrenos para un nuevo campus» frente a «estudia
 * abrir un nuevo campus»: 2 de 5 → solo la menciona.
 */
const PREDICATE_MIN = 0.5;

function coverage(claimPred: TermVector, sentence: TermVector): number {
  const terms = Object.keys(claimPred);
  return terms.length ? terms.filter((t) => t in sentence).length / terms.length : 0;
}

function predicateOf(v: TermVector, names: Set<string>): TermVector {
  const out: TermVector = {};
  for (const [t, n] of Object.entries(v)) if (!names.has(t) && !t.startsWith('#') && !/^\d/.test(t)) out[t] = n;
  return out;
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
