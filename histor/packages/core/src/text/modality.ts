import type { Modality } from '../domain';
import { fold } from './normalize';

/**
 * Modalidad de una afirmación: ¿se afirma como hecho, se atribuye, se
 * matiza, es una predicción, un desmentido o una pregunta?
 * Una predicción NUNCA puede aparecer como hecho en un artículo.
 */

const HEDGED = [
  'presuntamente', 'supuestamente', 'al parecer', 'segun fuentes', 'fuentes no identificadas', 'podria haber', 'rumor', 'rumores', 'sin confirmar',
  'reportedly', 'allegedly', 'purportedly', 'apparently', 'unconfirmed', 'rumour', 'rumor', 'unverified', 'is said to', 'are said to',
  'angeblich', 'mutmasslich', 'offenbar', 'unbestatigt', 'geruchte', 'soll haben', 'sollen haben',
  'presume', 'presumee', 'pretendument', 'apparemment', 'non confirme', 'rumeur', 'aurait', 'auraient',
  'presunto', 'presunta', 'presumibilmente', 'a quanto pare', 'non confermat', 'indiscrezion', 'avrebbe', 'avrebbero',
  'alegadamente', 'supostamente', 'aparentemente', 'nao confirmad', 'boato', 'teria', 'teriam',
];

const PREDICTED = [
  'podria', 'podrian', 'se espera que', 'prevé', 'preve', 'previsiblemente', 'va a ', 'van a ', 'estara', 'sera ', 'seran ', 'planea', 'pretende', 'amenaza con', 'se preve', 'proyecta',
  'will ', 'would ', 'could ', 'might ', 'is expected to', 'are expected to', 'plans to', 'is set to', 'forecast', 'projected to', 'is likely to', 'threatens to',
  'wird ', 'werden ', 'konnte', 'durfte', 'soll ', 'sollen ', 'plant ', 'voraussichtlich', 'erwartet',
  'va ', 'vont ', 'pourrait', 'pourraient', 'devrait', 'devraient', 'prevoit', 'sera ', 'seront ', 'envisage',
  'potrebbe', 'potrebbero', 'dovrebbe', 'dovrebbero', 'prevede', 'sara ', 'saranno', 'intende',
  'podera', 'poderao', 'deve ', 'devem ', 'preve', 'vai ', 'vao ', 'pretende', 'devera', 'deverao',
];

const DENIED = [
  'desmintio', 'desmiente', 'ha desmentido', 'nego', 'niega', 'es falso', 'es un bulo', 'bulo',
  'denied', 'denies', 'refuted', 'is false', 'debunked', 'hoax',
  'dementierte', 'dementiert', 'bestritt', 'bestreitet', 'falschmeldung',
  'a dementi', 'dement', 'a nie', 'est faux', 'infox', 'intox',
  'ha smentito', 'smentisce', 'smentita', 'nega', 'bufala', 'e falso',
  'desmentiu', 'desmente', 'negou', 'nega', 'e falso', 'fake news',
];

const ATTRIBUTED = [
  'dijo', 'ha dicho', 'afirmo', 'ha afirmado', 'aseguro', 'declaro', 'segun', 'informo', 'anuncio', 'ha anunciado', 'comunico', 'explico', 'senalo',
  'said', 'says', 'told', 'stated', 'announced', 'according to', 'reported', 'claimed', 'claims',
  'sagte', 'erklarte', 'teilte mit', 'laut', 'berichtete', 'kundigte an', 'zufolge',
  'a declare', 'a dit', 'a affirme', 'selon', 'a annonce', 'a indique', 'rapporte',
  'ha detto', 'ha dichiarato', 'ha affermato', 'secondo', 'ha annunciato', 'riferisce',
  'disse', 'afirmou', 'declarou', 'segundo', 'anunciou', 'informou',
  // En presente, como escribe la IA: «El Confidencial indica que…», «La Nación señala que…».
  'indica que', 'senala que', 'explica que', 'afirma que', 'asegura que', 'sostiene que', 'detalla que', 'precisa que', 'apunta que',
  'notes that', 'noted that', 'writes that', 'wrote that', 'indicates that', 'indicated that',
  'indique que', 'precise que', 'souligne que', 'indica che', 'sottolinea che', 'afferma che', 'aponta que', 'destaca que', 'schreibt', 'berichtet',
];

function has(f: string, list: string[]): string | null {
  for (const w of list) {
    const needle = w.trim();
    const re = new RegExp(`(^|[^\\p{L}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'u');
    if (re.test(f)) return needle;
  }
  return null;
}

export function detectModality(sentence: string): { modality: Modality; marker: string | null } {
  const f = ` ${fold(sentence)} `;
  if (/\?\s*["'»”]?\s*$/.test(sentence.trim())) return { modality: 'questioned', marker: '?' };
  const d = has(f, DENIED);
  if (d) return { modality: 'denied', marker: d };
  const h = has(f, HEDGED);
  if (h) return { modality: 'hedged', marker: h };
  const p = has(f, PREDICTED) ?? (/(^|[^\p{L}])may (?!\d)/u.test(f) ? 'may' : null);
  if (p) return { modality: 'predicted', marker: p };
  const a = has(f, ATTRIBUTED);
  if (a) return { modality: 'attributed', marker: a };
  return { modality: 'asserted', marker: null };
}

/** Marcadores de predicción que el redactor debe conservar al reescribir. */
export function hasPredictionMarker(sentence: string): boolean {
  const f = ` ${fold(sentence)} `;
  return has(f, PREDICTED) != null || /(^|[^\p{L}])may (?!\d)/u.test(f);
}

/** Marcadores de atribución/cautela en el texto redactado. */
export function hasAttributionMarker(sentence: string): boolean {
  const f = ` ${fold(sentence)} `;
  return has(f, ATTRIBUTED) != null || has(f, HEDGED) != null || /informa|report|berichte|rapporte|riferisce|informa/.test(f);
}
