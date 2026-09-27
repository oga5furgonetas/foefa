/**
 * Motor de verificación: función PURA que recibe todo lo que se sabe de una
 * historia (piezas, fuentes, huellas de imagen previas) y devuelve el
 * análisis completo y la decisión. La capa de base de datos
 * (pipeline/verify.ts) solo carga y guarda. Así se puede probar a fondo.
 *
 * INGEST → NORMALIZE → CLASSIFY → CLUSTER → DEDUPLICATE → [VERIFY → SCORE] → WRITE → FACT CHECK → PUBLISH → MONITOR → UPDATE
 */
import { DEFAULT_SOURCE_TYPE_WEIGHTS, type EditorialSettings } from '../config/settings';
import type { StoryFlag, StoryState } from '../domain';
import { extractClaims } from './claims';
import { computeConfidence } from './confidence';
import { decide } from './decision';
import { detectOldImages, type PriorFingerprint } from './images';
import { analyseIndependence, type TypeWeights } from './independence';
import { matchEvidence } from './matching';
import { computeMomentum } from './momentum';
import { assessTemporal } from './temporal';
import type { ClaimAssessment, StoryAnalysis, VClaim, VItem, VPlace, VSource } from './types';

export type EngineInput = {
  items: VItem[];
  sources: Map<number, VSource>;
  state: StoryState;
  now: Date;
  settings: EditorialSettings;
  weights?: TypeWeights;
  firstSeenAt: Date;
  lockedByEditor?: boolean;
  published?: boolean;
  publishedConfidence?: number | null;
  priorImageFingerprints?: PriorFingerprint[];
  readerSignals?: { pageViewsLastHour: number; searchesLastHour: number };
  /** Afirmaciones ya extraídas (si se reutilizan); si no, se extraen aquí. */
  claims?: VClaim[];
};

export function analyseStory(input: EngineInput): StoryAnalysis {
  const { sources, settings, now } = input;
  // Sátira: si la historia NACE en una fuente satírica, es sátira (aunque otros
  // la repitan). Si una pieza satírica se cuela en una historia real ya
  // contada antes por otros, se aparta y no cuenta para nada.
  let items = input.items;
  const satireNotes: string[] = [];
  const isSat = (i: VItem) => !!sources.get(i.sourceId)?.isSatire;
  if (items.some(isSat)) {
    const earliest = [...items].sort((a, b) => (a.publishedAt ?? a.fetchedAt).getTime() - (b.publishedAt ?? b.fetchedAt).getTime())[0];
    if (!isSat(earliest) && items.some((i) => !isSat(i))) {
      satireNotes.push(`se apartan ${items.filter(isSat).length} pieza(s) de fuentes satíricas`);
      items = items.filter((i) => !isSat(i));
    }
  }
  const weights = input.weights ?? DEFAULT_SOURCE_TYPE_WEIGHTS;
  const flags = new Set<StoryFlag>();

  // 1) Independencia real (orígenes citados, copias, grupos propietarios).
  const { groups, itemGroup } = analyseIndependence(items, sources, { copyThreshold: settings.copyThreshold, weights });
  const groupByKey = new Map(groups.map((g) => [g.key, g]));
  const isPrimary = (key: string) => groupByKey.get(key)?.isPrimary ?? false;

  // 2) Afirmaciones.
  const claims = input.claims ?? items.flatMap((it) => extractClaims(it));

  // 3) Evidencias y contradicciones.
  const { evidence, contradictions } = matchEvidence(claims, items, itemGroup, isPrimary);

  // 4) Estado de cada afirmación.
  const assessments: ClaimAssessment[] = claims.map((c) => {
    const ownKey = itemGroup[c.itemId]?.key;
    const ownGroup = ownKey ? groupByKey.get(ownKey) : undefined;
    const sup = new Set<string>();
    const con = new Set<string>();
    // La pieza que hace la afirmación la sostiene (si la afirma, no si la desmiente o pregunta).
    if (ownKey && !['denied', 'questioned'].includes(c.modality)) sup.add(ownKey);
    for (const e of evidence) {
      if (e.claimKey !== c.key || e.independenceKey === ownKey) continue;
      if (e.relation === 'supports') sup.add(e.independenceKey);
      if (e.relation === 'contradicts') con.add(e.independenceKey);
    }
    const credSup = [...sup].filter((k) => groupByKey.get(k)?.credible);
    const credCon = [...con].filter((k) => groupByKey.get(k)?.credible);
    const selfPrimary = settings.primaryOfficialSelfSufficient && ownGroup?.bestType === 'primary_official' && c.modality === 'asserted';
    let status: ClaimAssessment['status'];
    if (credCon.length && credCon.length >= credSup.length) status = 'contradicted';
    else if (credSup.length >= 2 || selfPrimary) status = 'supported';
    else if (credSup.length === 1) status = 'partially_supported';
    else status = 'unsupported';
    // Una cita solo cuenta si existe en una fuente creíble.
    if (c.quote && !credSup.length) status = 'unsupported';
    const supportScore = Math.min(1, [...sup].reduce((s, k) => s + (groupByKey.get(k)?.weight ?? 0), 0));
    return { claimKey: c.key, status, supportScore: Math.round(supportScore * 1000) / 1000, supportingGroups: [...sup], contradictingGroups: [...con] };
  });

  // Citas inventadas o mal atribuidas.
  if (contradictions.some((c) => c.field === 'quote')) flags.add('fabricated_quote');
  const quoteClaims = claims.filter((c) => c.quote);
  const statusOf = new Map(assessments.map((a) => [a.claimKey, a]));
  for (const q of quoteClaims) {
    const a = statusOf.get(q.key)!;
    const own = groupByKey.get(itemGroup[q.itemId]?.key ?? '');
    // Cita que solo aparece en fuentes no creíbles y que nadie fiable recoge.
    if (a.status === 'unsupported' && own && !own.credible && groups.some((g) => g.credible)) flags.add('fabricated_quote');
  }

  // 5) Flags de fuentes.
  const isSatire = items.some((i) => sources.get(i.sourceId)?.isSatire);
  void satireNotes;
  if (isSatire) flags.add('satire_source');
  const credibleGroups = groups.filter((g) => g.credible);
  const leadTypes = ['social_media', 'ugc', 'anonymous', 'unverifiable', 'aggregator', 'blog', 'witness'];
  if (groups.length && groups.every((g) => leadTypes.includes(g.bestType))) flags.add('social_only');
  if (credibleGroups.length <= 1) flags.add('single_source');
  if (!groups.some((g) => g.isPrimary)) flags.add('no_primary');
  const copies = Object.values(itemGroup).filter((g) => g.isCopy).length;
  if (copies >= 2 && copies >= items.length / 2) flags.add('copied_network');
  if (contradictions.length) flags.add('contradictions');
  if (contradictions.some((c) => c.field === 'place')) flags.add('geo_mismatch');
  // Predicción presentada como hecho en el titular de una fuente no fiable.
  if (claims.some((c) => c.isHeadline && c.kind === 'prediction' && statusOf.get(c.key)?.status !== 'supported')) flags.add('prediction_as_fact');

  // 6) Tiempo.
  const temporal = assessTemporal(items, claims, groups, now, {
    staleDays: settings.staleDays,
    dateContradictions: contradictions.filter((c) => c.field === 'date').length,
  });
  for (const f of temporal.flags) flags.add(f);

  // 7) Imágenes recicladas.
  const imgs = items.filter((i) => i.imagePhash).map((i) => ({ itemId: i.id, phash: i.imagePhash! }));
  const oldImgs = input.priorImageFingerprints?.length ? detectOldImages(input.firstSeenAt, imgs, input.priorImageFingerprints) : [];
  if (oldImgs.length) flags.add('old_image');

  // 8) Confianza (sin momentum).
  const { confidence, breakdown } = computeConfidence({
    groups,
    claims,
    assessments,
    contradictions,
    items,
    temporalScore: temporal.score,
    ageScore: temporal.ageScore,
    isSatire,
    primarySelfSufficient: settings.primaryOfficialSelfSufficient,
  });

  // 9) Momentum (sin confianza).
  const countries = new Set(items.map((i) => sources.get(i.sourceId)?.countryCode).filter(Boolean));
  const { momentum, breakdown: mBreakdown } = computeMomentum({
    items,
    now,
    distinctSources: new Set(items.map((i) => i.sourceId)).size,
    distinctCountries: countries.size,
    readerSignals: input.readerSignals,
  });
  if (momentum >= 0.5 && confidence < settings.developingMin) flags.add('viral_unverified');

  // 10) Decisión.
  const headlineSupported = claims.some((c) => (c.isHeadline || c.kind === 'fact' || c.kind === 'number') && ['supported', 'partially_supported'].includes(statusOf.get(c.key)!.status) && c.modality !== 'questioned');
  const lastItem = Math.max(...items.map((i) => (i.publishedAt ?? i.fetchedAt).getTime()));
  const d = decide({
    state: input.state,
    confidence,
    momentum,
    groups,
    flags: [...flags],
    contradictions,
    settings,
    isSatire,
    lockedByEditor: !!input.lockedByEditor,
    ageHours: (now.getTime() - input.firstSeenAt.getTime()) / 3600000,
    hoursSinceLastItem: (now.getTime() - lastItem) / 3600000,
    published: !!input.published,
    publishedConfidence: input.publishedConfidence ?? null,
    hasSupportedHeadline: headlineSupported,
  });

  const probable = groups.length
    ? [...groups].sort((a, b) => {
        const ta = items.find((i) => i.id === a.originalItemId)!;
        const tb = items.find((i) => i.id === b.originalItemId)!;
        return (ta.publishedAt ?? ta.fetchedAt).getTime() - (tb.publishedAt ?? tb.fetchedAt).getTime();
      })[0].originalItemId
    : null;

  return {
    groups,
    itemGroup,
    claims,
    evidence,
    contradictions,
    assessments,
    flags: [...flags],
    confidence,
    confidenceBreakdown: breakdown,
    momentum,
    momentumBreakdown: mBreakdown,
    decision: d.decision,
    nextState: d.nextState,
    verifiedLevel: d.verifiedLevel,
    reasons: [...satireNotes, ...temporal.reasons, ...d.reasons, ...(d.needsReview ? [`revisión: ${d.needsReview}`] : [])],
    probableOriginalItemId: probable,
    eventTime: temporal.eventTime,
    primaryPlace: pickPrimaryPlace(items),
    isBreaking: d.isBreaking,
  };
}

/** Lugar principal: el más citado entre las piezas (ciudad > región > país). */
export function pickPrimaryPlace(items: VItem[]): VPlace | null {
  const score = new Map<string, { p: VPlace; n: number }>();
  for (const it of items) {
    for (const p of it.places) {
      const k = `${p.kind}:${p.cityKey ?? p.regionCode ?? p.countryCode}`;
      const cur = score.get(k) ?? { p, n: 0 };
      cur.n += p.kind === 'city' ? 3 : p.kind === 'region' ? 2 : 1;
      score.set(k, cur);
    }
  }
  const best = [...score.values()].sort((a, b) => b.n - a.n)[0];
  return best?.p ?? null;
}
