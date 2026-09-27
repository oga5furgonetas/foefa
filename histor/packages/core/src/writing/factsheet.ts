/**
 * Ficha de hechos: lo ÚNICO que el redactor (determinista o IA) puede usar.
 * Separa lo confirmado de lo atribuido, lo no confirmado, las predicciones,
 * las citas verificadas, las cifras y las discrepancias. Nada que no esté
 * aquí puede aparecer en un artículo.
 */
import type { ArticleSourceRef } from '../db/schema';
import type { ClaimStatus } from '../domain';
import type { ExtractedNumber } from '../text/numbers';
import { sourceOriginName } from '../verification/independence';
import type { StoryAnalysis, VClaim, VItem, VSource } from '../verification/types';

export type Supporter = { sourceId: number; name: string; url: string; sourceType: string; isPrimary: boolean; publishedAt: Date | null };

export type FactClaim = VClaim & {
  status: ClaimStatus;
  supportScore: number;
  supporters: Supporter[];
  /** Nombres para atribuir ("EFE", "Diario Uno"). */
  attribution: string[];
  dbId?: number;
};

export type Figure = { unit: string; value: number; approximate: boolean; sources: string[]; evolving: boolean };

export type Discrepancy = { field: string; parts: { value: string; source: string }[] };

export type FactSheet = {
  storyId: number | null;
  language: string;
  verified: boolean;
  claims: FactClaim[];
  confirmed: FactClaim[];
  attributed: FactClaim[];
  unconfirmed: FactClaim[];
  predictions: FactClaim[];
  quotes: FactClaim[];
  figures: Figure[];
  discrepancies: Discrepancy[];
  sources: ArticleSourceRef[];
  independentCredible: number;
  hasPrimary: boolean;
  eventTime: Date | null;
  earthquake: EarthquakeData | null;
  timeline: { at: Date; source: string; kind: 'first' | 'confirms' | 'denies' | 'update' }[];
  /** Textos completos de las fuentes (para comprobar citas y copia literal). */
  sourceTexts: { sourceId: number; text: string }[];
};

export type EarthquakeData = {
  agency: string;
  magnitude: number;
  place: string;
  placeName: string | null;
  depthKm: number | null;
  time: Date;
  tsunami: boolean;
  url: string;
  distanceKm: number | null;
  direction: string | null;
};

export function groupDisplayName(key: string, sourceIds: number[], sources: Map<number, VSource>): string {
  if (key.startsWith('origin:')) return key.slice('origin:'.length);
  const s = sources.get(sourceIds[0]);
  return s?.name ?? key;
}

export function buildFactSheet(
  analysis: StoryAnalysis,
  items: VItem[],
  sources: Map<number, VSource>,
  opts: { language: string; storyId?: number | null; claimDbIds?: Map<string, number> },
): FactSheet {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const groupByKey = new Map(analysis.groups.map((g) => [g.key, g]));
  const assessment = new Map(analysis.assessments.map((a) => [a.claimKey, a]));

  const supportersFor = (keys: string[]): Supporter[] => {
    const out: Supporter[] = [];
    for (const k of keys) {
      const g = groupByKey.get(k);
      if (!g) continue;
      const orig = itemById.get(g.originalItemId);
      const src = orig ? sources.get(orig.sourceId) : undefined;
      if (!orig || !src) continue;
      out.push({
        sourceId: src.id,
        name: groupDisplayName(k, g.sourceIds, sources),
        url: orig.url,
        sourceType: g.bestType,
        isPrimary: g.isPrimary,
        publishedAt: orig.publishedAt,
      });
    }
    return out;
  };

  const claims: FactClaim[] = analysis.claims.map((c) => {
    const a = assessment.get(c.key)!;
    const credibleKeys = a.supportingGroups.filter((k) => groupByKey.get(k)?.credible);
    const supporters = supportersFor(credibleKeys.length ? credibleKeys : a.supportingGroups);
    const ownItem = itemById.get(c.itemId);
    const ownSource = ownItem ? sources.get(ownItem.sourceId) : undefined;
    const attribution = [...new Set([...(c.attributedTo ? [c.attributedTo] : []), ...supporters.map((s) => s.name)])];
    if (!attribution.length && ownSource) attribution.push(sourceOriginName(ownSource) ?? ownSource.name);
    return { ...c, status: a.status, supportScore: a.supportScore, supporters, attribution, dbId: opts.claimDbIds?.get(c.key) };
  });

  const lang = opts.language;
  const inLang = (c: FactClaim) => c.language === lang;
  const usable = (c: FactClaim) => !['questioned', 'denied'].includes(c.modality);
  const confirmed = claims.filter((c) => inLang(c) && usable(c) && c.status === 'supported' && !c.quote && c.kind !== 'prediction' && c.kind !== 'allegation');
  const attributed = claims.filter(
    (c) => inLang(c) && usable(c) && c.status === 'partially_supported' && !c.quote && c.kind !== 'prediction' && c.kind !== 'allegation',
  );
  const unconfirmed = claims.filter(
    (c) => inLang(c) && (c.status === 'unsupported' || c.kind === 'allegation') && c.supporters.some((s) => isCredibleType(s.sourceType)) && !c.quote,
  );
  const predictions = claims.filter((c) => inLang(c) && c.kind === 'prediction' && c.status !== 'contradicted' && c.supporters.some((s) => isCredibleType(s.sourceType)));
  const quotes = claims.filter((c) => inLang(c) && c.quote && c.quote.speaker && (c.status === 'supported' || c.status === 'partially_supported'));

  const credible = analysis.groups.filter((g) => g.credible);
  const sourcesList: ArticleSourceRef[] = credible
    .map((g) => {
      const orig = itemById.get(g.originalItemId)!;
      const src = sources.get(orig.sourceId)!;
      return {
        sourceId: src.id,
        name: groupDisplayName(g.key, g.sourceIds, sources),
        url: orig.url,
        sourceType: g.bestType,
        publishedAt: orig.publishedAt ? orig.publishedAt.toISOString() : null,
        isPrimary: g.isPrimary,
      };
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));

  const timeline: FactSheet['timeline'] = [];
  const sortedGroups = [...credible].sort((a, b) => t(itemById.get(a.originalItemId)) - t(itemById.get(b.originalItemId)));
  sortedGroups.forEach((g, i) => {
    const it = itemById.get(g.originalItemId);
    if (!it) return;
    timeline.push({ at: it.publishedAt ?? it.fetchedAt, source: groupDisplayName(g.key, g.sourceIds, sources), kind: i === 0 ? 'first' : 'confirms' });
  });
  for (const c of analysis.contradictions.filter((x) => x.field === 'denial')) {
    const it = itemById.get(Number(c.detail.itemId));
    if (it) timeline.push({ at: it.publishedAt ?? it.fetchedAt, source: sources.get(it.sourceId)?.name ?? '', kind: 'denies' });
  }
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    storyId: opts.storyId ?? null,
    language: lang,
    verified: analysis.nextState === 'VERIFIED' || analysis.decision === 'publish',
    claims,
    confirmed: rank(confirmed),
    attributed: rank(attributed),
    unconfirmed: rank(unconfirmed),
    predictions: rank(predictions),
    quotes: rank(quotes),
    figures: buildFigures(claims, analysis, itemById),
    discrepancies: buildDiscrepancies(analysis, claims, itemById, sources),
    sources: sourcesList,
    independentCredible: credible.length,
    hasPrimary: credible.some((g) => g.isPrimary),
    eventTime: analysis.eventTime,
    earthquake: extractEarthquake(items, credible.flatMap((g) => g.itemIds), sources),
    timeline,
    sourceTexts: items.map((i) => ({ sourceId: i.sourceId, text: [i.title, i.summary, i.text].filter(Boolean).join('\n') })),
  };
}

function isCredibleType(t: string): boolean {
  return ['primary_official', 'official', 'wire_agency', 'academic', 'reputable_media', 'identified_journalist'].includes(t);
}

function t(i: VItem | undefined): number {
  return i ? (i.publishedAt ?? i.fetchedAt).getTime() : 0;
}

function rank(list: FactClaim[]): FactClaim[] {
  return [...list].sort(
    (a, b) =>
      b.supporters.length - a.supporters.length ||
      b.supportScore - a.supportScore ||
      Number(a.isHeadline) - Number(b.isHeadline) || // preferimos frases del cuerpo a titulares ajenos
      b.numbers.length + b.entities.length - (a.numbers.length + a.entities.length),
  );
}

function buildFigures(claims: FactClaim[], analysis: StoryAnalysis, itemById: Map<number, VItem>): Figure[] {
  const byUnit = new Map<string, { n: ExtractedNumber; claim: FactClaim; at: number }[]>();
  for (const c of claims) {
    if (!['supported', 'partially_supported'].includes(c.status) || c.kind === 'prediction' || c.modality === 'hedged') continue;
    for (const n of c.numbers) {
      if (!n.unit) continue;
      const it = itemById.get(c.itemId);
      const list = byUnit.get(n.unit) ?? [];
      list.push({ n, claim: c, at: t(it) });
      byUnit.set(n.unit, list);
    }
  }
  const out: Figure[] = [];
  const evolvingUnits = new Set(analysis.contradictions.filter((c) => c.field === 'number' && c.severity === 'minor').map((c) => String(c.detail.unit)));
  const conflictUnits = new Set(analysis.contradictions.filter((c) => c.field === 'number' && c.severity !== 'minor').map((c) => String(c.detail.unit)));
  for (const [unit, list] of byUnit) {
    if (conflictUnits.has(unit)) continue; // se presentan como discrepancia, no como dato
    const evolving = evolvingUnits.has(unit);
    // Valor: el más reciente si evoluciona; si no, el más respaldado.
    const pick = evolving
      ? [...list].sort((a, b) => b.at - a.at)[0]
      : [...list].sort((a, b) => b.claim.supporters.length - a.claim.supporters.length || b.at - a.at)[0];
    const sources = [...new Set(list.filter((x) => x.n.value === pick.n.value).flatMap((x) => x.claim.attribution))];
    out.push({ unit, value: pick.n.value, approximate: pick.n.approximate, sources, evolving });
  }
  return out;
}

function buildDiscrepancies(analysis: StoryAnalysis, claims: FactClaim[], itemById: Map<number, VItem>, sources: Map<number, VSource>): Discrepancy[] {
  const out: Discrepancy[] = [];
  const claimByKey = new Map(claims.map((c) => [c.key, c]));
  for (const c of analysis.contradictions) {
    if (c.severity === 'minor') continue;
    const claim = claimByKey.get(c.claimKeys[0]);
    const otherItem = itemById.get(Number(c.detail.itemId));
    const otherSource = otherItem ? sources.get(otherItem.sourceId)?.name : undefined;
    const ownSource = claim?.attribution[0];
    if (!claim || !otherSource || !ownSource) continue;
    if (c.field === 'number') {
      out.push({ field: 'number', parts: [{ value: String(c.detail.claimValue), source: ownSource }, { value: String(c.detail.otherValue), source: otherSource }] });
    } else if (c.field === 'date') {
      out.push({ field: 'date', parts: [{ value: (c.detail.claimDates as string[]).join(', '), source: ownSource }, { value: (c.detail.otherDates as string[]).join(', '), source: otherSource }] });
    } else if (c.field === 'place') {
      out.push({ field: 'place', parts: [{ value: (c.detail.claimPlaces as string[]).join(', '), source: ownSource }, { value: (c.detail.otherPlaces as string[]).join(', '), source: otherSource }] });
    }
  }
  return dedupe(out);
}

function dedupe(list: Discrepancy[]): Discrepancy[] {
  const seen = new Set<string>();
  return list.filter((d) => {
    const k = JSON.stringify(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractEarthquake(items: VItem[], credibleItemIds: number[], sources: Map<number, VSource>): EarthquakeData | null {
  for (const it of items) {
    const s = it.structured;
    if (!s || s.type !== 'earthquake' || !credibleItemIds.includes(it.id)) continue;
    const place = String(s.place ?? '');
    // USGS: "12 km NNE of Granada, Spain"
    const m = place.match(/^(\d+(?:\.\d+)?)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/);
    const src = sources.get(it.sourceId);
    return {
      agency: src ? (src.slug === 'usgs-earthquakes' ? 'USGS' : src.name) : 'USGS',
      magnitude: Number(s.magnitude),
      place,
      placeName: m ? m[3] : place || null,
      depthKm: s.depthKm == null ? null : Number(s.depthKm),
      time: new Date(String(s.time)),
      tsunami: !!s.tsunami,
      url: it.url,
      distanceKm: m ? Number(m[1]) : null,
      direction: m ? m[2] : null,
    };
  }
  return null;
}
