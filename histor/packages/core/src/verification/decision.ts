/**
 * Decisión editorial automática. Reglas explícitas, en orden, cada una con
 * su motivo escrito (queda en `verifications.reasons`).
 *
 * Principio: ante la duda, NO publicar. El momentum no aparece en ninguna
 * condición de elegibilidad; solo decide si algo publicable es "última hora".
 */
import type { EditorialSettings } from '../config/settings';
import type { StoryFlag, StoryState } from '../domain';
import type { Decision, IndependenceGroup, VContradiction } from './types';

export type DecisionInput = {
  state: StoryState;
  confidence: number;
  momentum: number;
  groups: IndependenceGroup[];
  flags: StoryFlag[];
  contradictions: VContradiction[];
  settings: EditorialSettings;
  isSatire: boolean;
  lockedByEditor: boolean;
  /** Horas desde que se descubrió la historia. */
  ageHours: number;
  /** Horas desde la última pieza nueva. */
  hoursSinceLastItem: number;
  /** La historia ya tiene artículo publicado. */
  published: boolean;
  /** Confianza con la que se publicó (para detectar caídas). */
  publishedConfidence: number | null;
  hasSupportedHeadline: boolean;
};

export type DecisionOutput = { decision: Decision; nextState: StoryState; reasons: string[]; isBreaking: boolean; needsReview: string | null };

export function decide(i: DecisionInput): DecisionOutput {
  const s = i.settings;
  const reasons: string[] = [];
  const credible = i.groups.filter((g) => g.credible);
  const primarySelf = s.primaryOfficialSelfSufficient && credible.some((g) => g.bestType === 'primary_official');
  const criticalOpen = i.contradictions.filter((c) => c.severity === 'critical');
  const credibleDenial = i.contradictions.some((c) => c.field === 'denial' && c.severity === 'critical');

  if (i.state === 'BLOCKED' || i.state === 'RETRACTED') {
    return { decision: 'none', nextState: i.state, reasons: ['estado final o bloqueado por un editor'], isBreaking: false, needsReview: null };
  }
  if (i.lockedByEditor) {
    return { decision: 'none', nextState: i.state, reasons: ['bloqueada para edición manual'], isBreaking: false, needsReview: null };
  }

  // ── Historias ya publicadas: actualizar, revisar o retirar ──
  if (i.published) {
    if (credibleDenial && i.confidence < s.retractBelow) {
      reasons.push('desmentido de fuente primaria/oficial y confianza por debajo del umbral de retirada');
      return { decision: 'retract', nextState: 'RETRACTED', reasons, isBreaking: false, needsReview: 'retracción automática: revisar' };
    }
    if (i.confidence < s.developingMin || criticalOpen.length) {
      reasons.push(
        criticalOpen.length
          ? `contradicción crítica tras publicar (${criticalOpen.map((c) => c.field).join(', ')})`
          : `la confianza ha caído a ${i.confidence.toFixed(2)}`,
      );
      return { decision: 'review', nextState: i.state === 'PUBLISHED' ? 'UPDATED' : i.state, reasons, isBreaking: false, needsReview: reasons[0] };
    }
    reasons.push('publicada: se actualiza si hay cambios materiales');
    return { decision: 'update', nextState: 'UPDATED', reasons, isBreaking: breaking(i), needsReview: null };
  }

  // ── Filtros duros (rechazo) ──
  if (i.isSatire || i.flags.includes('satire_source')) {
    return { decision: 'reject', nextState: 'REJECTED', reasons: ['procede de una fuente satírica'], isBreaking: false, needsReview: null };
  }
  if (i.flags.includes('old_resurfaced')) {
    return {
      decision: 'reject',
      nextState: 'REJECTED',
      reasons: ['información antigua que vuelve a circular como si fuera nueva'],
      isBreaking: false,
      needsReview: i.momentum >= 0.5 ? 'noticia antigua viral: valorar desmentido o explicador' : null,
    };
  }

  // ── Retenciones ──
  if (i.flags.includes('social_only')) {
    reasons.push('solo hay publicaciones en redes/pistas: se investiga, no se publica');
    const viral = i.momentum >= 0.5;
    return {
      decision: 'hold',
      nextState: i.ageHours > s.investigationTtlHours ? 'REJECTED' : 'HELD',
      reasons,
      isBreaking: false,
      needsReview: viral ? 'historia viral sin evidencia: vigilar' : null,
    };
  }
  if (i.flags.includes('fabricated_quote')) {
    reasons.push('una cita atribuida no aparece en ninguna fuente fiable o se atribuye a otra persona');
  }
  if (i.flags.includes('old_image')) reasons.push('imagen reciclada de otro acontecimiento (no se usará)');
  if (criticalOpen.length) {
    reasons.push(`contradicciones críticas sin resolver: ${criticalOpen.map((c) => c.field).join(', ')}`);
    return { decision: 'hold', nextState: 'HELD', reasons, isBreaking: false, needsReview: 'contradicción crítica entre fuentes: revisar' };
  }
  if (!i.hasSupportedHeadline && i.confidence < s.verifiedMin) {
    reasons.push('el hecho principal no está respaldado por ninguna fuente creíble');
  }

  // ── Publicación ──
  const enoughForVerified = credible.length >= s.minIndependentVerified || primarySelf;
  if (i.confidence >= s.verifiedMin && enoughForVerified && i.hasSupportedHeadline) {
    reasons.push(`confianza ${i.confidence.toFixed(2)} ≥ ${s.verifiedMin} con ${credible.length} fuente(s) independiente(s) creíble(s)`);
    return { decision: 'publish', nextState: 'VERIFIED', reasons, isBreaking: breaking(i), needsReview: null };
  }
  if (i.confidence >= s.developingMin && credible.length >= s.minIndependentDeveloping) {
    reasons.push(
      `confianza ${i.confidence.toFixed(2)} suficiente para informar "en desarrollo", con cada afirmación atribuida a su fuente`,
    );
    return { decision: 'publish_developing', nextState: 'PARTIALLY_VERIFIED', reasons, isBreaking: breaking(i), needsReview: null };
  }

  // ── Seguir investigando o descartar ──
  reasons.push(`confianza ${i.confidence.toFixed(2)} insuficiente (mínimo ${s.developingMin} para informar)`);
  const majorConflict = i.contradictions.some((c) => c.severity === 'major') && credible.length >= 2;
  if (i.ageHours > s.investigationTtlHours && i.hoursSinceLastItem > 6) {
    reasons.push(`sin avances en ${Math.round(i.ageHours)} h: se descarta`);
    return { decision: 'reject', nextState: 'REJECTED', reasons, isBreaking: false, needsReview: null };
  }
  const next: StoryState = i.state === 'DISCOVERED' ? 'UNVERIFIED' : 'INVESTIGATING';
  return {
    decision: 'hold',
    nextState: next,
    reasons,
    isBreaking: false,
    needsReview: majorConflict
      ? 'fuentes fiables que se contradicen: revisar'
      : i.momentum >= 0.6
        ? 'historia con mucho momentum pero sin evidencia suficiente'
        : null,
  };

  function breaking(x: DecisionInput): boolean {
    return x.momentum >= x.settings.breakingMomentum && x.hoursSinceLastItem < 3;
  }
}
