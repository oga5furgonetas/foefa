/**
 * EVIDENCE CONFIDENCE (0-1). Interna: nunca se muestra como opinión.
 *
 * Modelo de log-odds (tipo Bayes ingenuo), explicable término a término:
 *   logit = previo (-1,2)
 *         + Σ aportación de cada grupo independiente creíble (peso × 1,8,
 *           con rendimientos decrecientes: 1, 0,85, 0,7, 0,6…)
 *         + pistas no creíbles (redes, blogs): como mucho +0,3 en total
 *         + fuente primaria/oficial (+0,8 / +0,6)
 *         + corroboración de las afirmaciones clave ((ratio - 0,5) × 1,5)
 *         + evidencia documental (+0,5)
 *         − contradicciones (crítica 2,0 · mayor 1,0 · menor 0,15)
 *   p = sigmoide(logit) × temporal × geográfica × frescura
 * Topes duros: sátira → 0; solo pistas → ≤ 0,20; ninguna creíble → ≤ 0,30;
 * una sola creíble (salvo primaria oficial con dato propio) → ≤ 0,60.
 *
 * Con estos pesos, dos fuentes independientes creíbles que coinciden en lo
 * esencial superan 0,75 (la regla clásica de las dos fuentes) y una sola
 * no puede pasar de "en desarrollo". El momentum NO entra aquí.
 */
import type { ClaimAssessment, ConfidenceBreakdown, IndependenceGroup, VClaim, VContradiction, VItem } from './types';

export type ConfidenceInput = {
  groups: IndependenceGroup[];
  claims: VClaim[];
  assessments: ClaimAssessment[];
  contradictions: VContradiction[];
  items: VItem[];
  temporalScore: number;
  ageScore: number;
  isSatire: boolean;
  primarySelfSufficient: boolean;
};

const DOC_HINT =
  /\.(pdf|docx?|xlsx?|csv)(\?|$)|\/(boe|bocm|dogv|gazette|bundesgesetzblatt|legifrance|gazzettaufficiale|diario-oficial|federalregister)\b|\.gov(\.[a-z]{2})?\/|\.gob\.[a-z]{2}\/|\.gouv\.fr\/|\.bund\.de\/|\.gov\.uk\/|\.europa\.eu\//i;

const LEAD_TYPES = ['social_media', 'ugc', 'anonymous', 'unverifiable', 'aggregator', 'blog', 'witness'];
const PRIOR = -1.2;
const DECAY = [1, 0.85, 0.7, 0.6, 0.5, 0.45, 0.4];

export function computeConfidence(input: ConfidenceInput): { confidence: number; breakdown: ConfidenceBreakdown } {
  const credible = input.groups.filter((g) => g.credible).sort((a, b) => b.weight - a.weight);
  const leads = input.groups.filter((g) => !g.credible);
  const independentCredible = credible.length;
  const independentTotal = input.groups.filter((g) => g.weight > 0).length;

  const sources = credible.reduce((s, g, i) => s + g.weight * 1.8 * (DECAY[i] ?? 0.35), 0);
  const leadBoost = Math.min(0.3, leads.reduce((s, g) => s + g.weight * 0.5, 0));
  const quality = credible.length ? credible[0].weight : Math.max(0, ...input.groups.map((g) => g.weight));
  const primary = credible.some((g) => g.bestType === 'primary_official') ? 0.8 : credible.some((g) => g.bestType === 'official') ? 0.6 : 0;

  const key = input.claims.filter((c) => c.isHeadline || c.kind === 'number' || c.kind === 'fact');
  const statusOf = new Map(input.assessments.map((a) => [a.claimKey, a.status]));
  const assessed = key.length ? key : input.claims;
  const corroborationRatio = assessed.length
    ? assessed.reduce((s, c) => {
        const st = statusOf.get(c.key);
        return s + (st === 'supported' ? 1 : st === 'partially_supported' ? 0.5 : st === 'contradicted' ? -0.5 : 0);
      }, 0) / assessed.length
    : 0;
  const corroboration = (corroborationRatio - 0.5) * 1.5;

  const credibleItemIds = new Set(credible.flatMap((g) => g.itemIds));
  const documents = input.items.some((i) => credibleItemIds.has(i.id) && (DOC_HINT.test(i.url) || i.structured)) ? 0.5 : 0;

  const critical = input.contradictions.filter((c) => c.severity === 'critical').length;
  const major = input.contradictions.filter((c) => c.severity === 'major').length;
  const minor = input.contradictions.filter((c) => c.severity === 'minor').length;
  const contradictionPenalty = 2.0 * critical + 1.0 * major + 0.15 * minor;

  const geoConflicts = input.contradictions.filter((c) => c.field === 'place').length;
  const geo = Math.max(0.3, 1 - 0.25 * geoConflicts);

  const logit = PRIOR + sources + leadBoost + primary + corroboration + documents - contradictionPenalty;
  const base = 1 / (1 + Math.exp(-logit));
  let confidence = base * input.temporalScore * geo * input.ageScore;

  let cap: number | null = null;
  let capReason: string | null = null;
  const setCap = (v: number, why: string) => {
    if (cap === null || v < cap) {
      cap = v;
      capReason = why;
    }
  };
  if (input.isSatire) setCap(0, 'fuente satírica');
  if (input.groups.length > 0 && input.groups.every((g) => LEAD_TYPES.includes(g.bestType)))
    setCap(0.2, 'solo redes sociales, blogs o testigos: son pistas, no evidencia');
  if (independentCredible === 0) setCap(0.3, 'ninguna fuente creíble');
  const hasPrimary = credible.some((g) => g.bestType === 'primary_official');
  if (independentCredible === 1 && !(hasPrimary && input.primarySelfSufficient)) setCap(0.6, 'una sola fuente independiente creíble');
  if (cap !== null) confidence = Math.min(confidence, cap);

  confidence = Math.max(0, Math.min(1, confidence));
  return {
    confidence: r(confidence),
    breakdown: {
      sources: r(sources),
      quality: r(quality),
      primary: r(primary),
      corroboration: r(corroborationRatio),
      documents,
      temporal: r(input.temporalScore),
      geo: r(geo),
      factual: r(-contradictionPenalty),
      age: r(input.ageScore),
      base: r(base),
      cap,
      capReason,
      independentCredible,
      independentTotal,
    },
  };
}

function r(x: number): number {
  return Math.round(x * 1000) / 1000;
}
