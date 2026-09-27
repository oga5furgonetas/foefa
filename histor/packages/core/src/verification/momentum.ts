/**
 * NEWS MOMENTUM (0-1): cuánto está creciendo una historia.
 * Mira velocidad de aparición, número de fuentes (incluidas redes), países,
 * recencia e interés de los lectores. NO mira la evidencia ni la confianza,
 * y la confianza tampoco lo mira a él: VIRAL ≠ VERDADERO.
 */
import type { MomentumBreakdown, VItem } from './types';

export type MomentumInput = {
  items: VItem[];
  now: Date;
  /** Fuentes distintas que la mencionan (todas, también redes). */
  distinctSources: number;
  /** Países distintos de las fuentes. */
  distinctCountries: number;
  /** Lecturas y búsquedas de la última hora en Histor (0 si aún no hay). */
  readerSignals?: { pageViewsLastHour: number; searchesLastHour: number };
};

const HOUR = 3600000;

export function computeMomentum(input: MomentumInput): { momentum: number; breakdown: MomentumBreakdown } {
  const t = (i: VItem) => (i.publishedAt ?? i.fetchedAt).getTime();
  const now = input.now.getTime();
  const lastHour = input.items.filter((i) => now - t(i) <= HOUR).length;
  const last6h = input.items.filter((i) => now - t(i) <= 6 * HOUR).length;
  const newest = input.items.length ? Math.max(...input.items.map(t)) : 0;

  // Velocidad: piezas en la última hora frente a la media de las 6 horas.
  const baseline = Math.max(1, last6h / 6);
  const velocity = sat(lastHour / baseline / 3 + lastHour / 10);
  const sourceSpread = sat(input.distinctSources / 8);
  const countrySpread = sat((input.distinctCountries - 1) / 4);
  const recency = newest ? Math.exp(-(now - newest) / (6 * HOUR)) : 0;
  const rs = input.readerSignals ?? { pageViewsLastHour: 0, searchesLastHour: 0 };
  const readerInterest = sat(Math.log10(1 + rs.pageViewsLastHour + 3 * rs.searchesLastHour) / 4);

  const momentum = 0.3 * velocity + 0.25 * sourceSpread + 0.15 * countrySpread + 0.2 * recency + 0.1 * readerInterest;
  return {
    momentum: Math.round(sat(momentum) * 1000) / 1000,
    breakdown: {
      velocity: r(velocity),
      sourceSpread: r(sourceSpread),
      countrySpread: r(countrySpread),
      recency: r(recency),
      readerInterest: r(readerInterest),
      itemsLastHour: lastHour,
      itemsLast6h: last6h,
    },
  };
}

function sat(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function r(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Importancia editorial: ordena lo que YA es publicable. Combina momentum
 * con confianza de forma multiplicativa para que ninguna compense a la otra
 * por debajo de los umbrales (la elegibilidad la decide decision.ts).
 */
export function importanceScore(momentum: number, confidence: number, categoryBoost = 0): number {
  return Math.round(Math.min(1, (0.65 * momentum + 0.35 * confidence) * (1 + categoryBoost)) * 1000) / 1000;
}
