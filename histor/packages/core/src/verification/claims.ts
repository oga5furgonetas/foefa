/**
 * Extracción de afirmaciones (claims) de cada pieza, sin IA.
 * Una afirmación es una frase con contenido comprobable: nombres, cifras,
 * fechas o lugares. Se guarda su modalidad (hecho, atribución, predicción,
 * rumor, desmentido) porque de ella depende cómo se puede publicar.
 */
import type { ClaimKind } from '../domain';
import { detectAttribution, stripDateline } from '../text/attribution';
import { extractDates } from '../text/dates';
import { entityKey, extractEntities, findPlaces } from '../text/entities';
import { detectModality } from '../text/modality';
import { extractNumbers } from '../text/numbers';
import { CREDIT_LINE, PROMO } from '../text/nonnews';
import { decodeEntities } from '../text/normalize';
import { extractQuotes } from '../text/quotes';
import { sentences, words } from '../text/tokenize';
import type { VClaim, VItem } from './types';

export function placeKey(p: { kind: string; countryCode: string; regionCode: string | null; cityKey: string | null }): string {
  if (p.kind === 'city') return `city:${p.cityKey}`;
  if (p.kind === 'region') return `region:${p.regionCode}`;
  return `country:${p.countryCode}`;
}

const MAX_CLAIMS_PER_ITEM = 10;

/** Texto analizable de una pieza (título + entradilla + cuerpo), sin duplicar el título. */
export function itemFullText(it: Pick<VItem, 'title' | 'summary' | 'text'>): string {
  const parts = [it.title];
  if (it.summary && !it.summary.startsWith(it.title)) parts.push(it.summary);
  if (it.text && !(it.summary && it.text.startsWith(it.summary))) parts.push(it.text);
  return parts.join('\n');
}

export function extractClaims(item: VItem): VClaim[] {
  const lang = item.language ?? 'und';
  const ref = item.publishedAt ?? item.fetchedAt;
  const itemAttribution = item.attributedTo ?? null;
  const out: VClaim[] = [];
  const seen = new Set<string>();

  const add = (text: string, isHeadline: boolean) => {
    // Entidades sueltas («S&aacute;nchez») y firma de agencia («MADRID, 29 (EUROPA PRESS) -») fuera.
    const clean = stripDateline(decodeEntities(text).replace(/\s+/g, ' ').trim());
    const wc = words(clean).length;
    if (wc < 4 || wc > 70) return;
    // Frase truncada por el feed («…Francisco Toscano…») o que anuncia lo que sigue («declaró:»): no afirma nada completo.
    if (/(…|\.\.\.|:)$/.test(clean)) return;
    // Publicidad de la web del medio («Suivez toute l'actualité… en téléchargeant l'application RFI»).
    // Ni pies de foto («…, CC BY-NC»), ni frases que empiezan por un signo suelto.
    if (PROMO.test(clean) || CREDIT_LINE.test(clean) || /^[^\p{L}\p{N}¿¡«"“'‘(]/u.test(clean)) return;
    // Tuits incrustados y enlaces («…decreto Maricarmen: pic.twitter.com/Y6zh…», «— Name (@user)»).
    if (/pic\.twitter\.com|https?:\/\/|\bt\.co\/|\(@\w{2,15}\)|\bwww\.\w/i.test(clean)) return;
    const norm = clean.toLowerCase();
    if (seen.has(norm)) return;
    const ents = extractEntities(clean, lang).filter((e) => e.type !== 'other' || e.name.split(' ').length > 1);
    const nums = extractNumbers(clean, lang);
    const dates = extractDates(clean, ref);
    const places = findPlaces(clean);
    const quotes = extractQuotes(clean);
    // Sin nada comprobable → no es una afirmación útil.
    if (!isHeadline && !ents.length && !nums.length && !dates.length && !places.length && !quotes.length) return;
    seen.add(norm);
    const { modality } = detectModality(clean);
    const sentenceAttribution = detectAttribution(clean);
    let kind: ClaimKind = 'fact';
    if (quotes.length) kind = 'quote';
    else if (modality === 'predicted') kind = 'prediction';
    else if (modality === 'hedged') kind = 'allegation';
    else if (modality === 'questioned') kind = 'question';
    else if (nums.length) kind = 'number';
    out.push({
      key: `${item.id}:${out.length}`,
      itemId: item.id,
      language: lang,
      text: clean,
      kind,
      modality,
      attributedTo: sentenceAttribution ?? itemAttribution,
      entities: [...new Set(ents.map((e) => entityKey(e.name)).filter(Boolean))],
      entityNames: ents.map((e) => e.name),
      numbers: nums,
      dates,
      places: [...new Set(places.map(placeKey))],
      quote: quotes[0] ? { text: quotes[0].text, speaker: quotes[0].speaker } : null,
      isHeadline,
    });
  };

  add(item.title, true);
  const body = [item.summary, item.text].filter(Boolean).join(' ');
  for (const s of sentences(body)) {
    if (out.length >= MAX_CLAIMS_PER_ITEM) break;
    add(s, false);
  }
  return out;
}
