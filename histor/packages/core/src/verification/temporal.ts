/**
 * Coherencia temporal: ¿está pasando AHORA? ¿Es una noticia vieja que
 * vuelve a circular? ¿Las fechas encajan entre fuentes?
 */
import { extractedToDate } from '../text/dates';
import type { IndependenceGroup, VClaim, VItem } from './types';

export type TemporalReport = {
  score: number; // 0-1
  ageScore: number; // 0-1 (frescura de la evidencia)
  flags: ('old_resurfaced' | 'date_mismatch')[];
  reasons: string[];
  newestCredibleAt: Date | null;
  oldestCredibleAt: Date | null;
  eventTime: Date | null;
};

const DAY = 86400000;

export function assessTemporal(
  items: VItem[],
  claims: VClaim[],
  groups: IndependenceGroup[],
  now: Date,
  opts: { staleDays: number; dateContradictions: number },
): TemporalReport {
  const credibleItems = new Set(groups.filter((g) => g.credible).flatMap((g) => g.itemIds));
  const credible = items.filter((i) => credibleItems.has(i.id));
  const pubTime = (i: VItem) => (i.publishedAt ?? i.fetchedAt).getTime();
  const flags: TemporalReport['flags'] = [];
  const reasons: string[] = [];
  let score = 1;

  const credTimes = credible.map(pubTime);
  const newestCredibleAt = credTimes.length ? new Date(Math.max(...credTimes)) : null;
  const oldestCredibleAt = credTimes.length ? new Date(Math.min(...credTimes)) : null;
  const allTimes = items.map(pubTime);
  const newestAny = allTimes.length ? Math.max(...allTimes) : now.getTime();

  // 1) Fechas futuras: señal de manipulación o de error de la fuente.
  const future = items.filter((i) => i.publishedAt && i.publishedAt.getTime() > now.getTime() + 2 * 3600000);
  if (future.length) {
    flags.push('date_mismatch');
    reasons.push(`${future.length} pieza(s) con fecha de publicación futura`);
    score *= 0.6;
  }

  // 2) Información vieja que vuelve a circular.
  const staleMs = opts.staleDays * DAY;
  const credibleStale = newestCredibleAt ? now.getTime() - newestCredibleAt.getTime() > staleMs : false;
  const recentChatter = now.getTime() - newestAny < 2 * DAY;
  if (credibleStale && recentChatter) {
    flags.push('old_resurfaced');
    reasons.push('las fuentes fiables son antiguas y la historia vuelve a circular ahora');
    score *= 0.2;
  }
  // Los titulares afirman un acontecimiento con fecha muy anterior a hoy.
  const headlineDates = claims
    .filter((c) => c.isHeadline || c.kind === 'fact' || c.kind === 'number')
    .flatMap((c) => c.dates.filter((d) => d.precision !== 'relative'))
    .map(extractedToDate)
    .filter((d) => !Number.isNaN(d.getTime()));
  if (headlineDates.length) {
    const newestClaimed = Math.max(...headlineDates.map((d) => d.getTime()));
    // Si TODAS las fechas afirmadas son de hace más de 30 días, el hecho no es de ahora.
    if (now.getTime() - newestClaimed > 30 * DAY && !flags.includes('old_resurfaced')) {
      flags.push('old_resurfaced');
      reasons.push('las fechas que se afirman son de hace más de 30 días');
      score *= 0.3;
    }
  }

  // 3) Fechas contradictorias entre fuentes.
  if (opts.dateContradictions > 0) {
    if (!flags.includes('date_mismatch')) flags.push('date_mismatch');
    reasons.push(`${opts.dateContradictions} contradicción(es) de fecha entre fuentes`);
    score *= opts.dateContradictions > 1 ? 0.5 : 0.7;
  }

  // Frescura de la evidencia creíble (decae con los días).
  let ageScore = 1;
  if (newestCredibleAt) {
    const ageDays = (now.getTime() - newestCredibleAt.getTime()) / DAY;
    ageScore = ageDays <= 1 ? 1 : Math.max(0.3, 1 - (ageDays - 1) / (opts.staleDays * 4));
  }

  const eventTime = oldestCredibleAt ?? (allTimes.length ? new Date(Math.min(...allTimes)) : null);
  return { score: Math.max(0, Math.min(1, score)), ageScore, flags, reasons, newestCredibleAt, oldestCredibleAt, eventTime };
}
