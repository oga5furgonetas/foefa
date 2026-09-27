import 'server-only';
import { cookies } from 'next/headers';
import { anonId } from '@histor/core/analytics/index';
import { applyHeadlines, headlineAssignments } from '@histor/core/experiments/index';
import type { ArticleCard } from '@histor/core/services/content';
import { db, parseConsent } from './server';

export type CardWithExp = ArticleCard & { exp?: { key: string; variant: string } };

/** Unidad de experimento: solo existe con consentimiento de medición. */
export async function experimentUnit(): Promise<string | null> {
  const c = await cookies();
  if (!parseConsent(c.get('histor_consent')?.value).analytics) return null;
  return anonId(c.get('histor_aid')?.value ?? null);
}

/** Aplica los titulares A/B en marcha a grupos de tarjetas. */
export async function withHeadlineTests(groups: ArticleCard[][]): Promise<CardWithExp[][]> {
  const unit = await experimentUnit();
  const ids = [...new Set(groups.flat().map((c) => c.id))];
  const assigned = await headlineAssignments(db(), ids, unit);
  if (!assigned.size) return groups;
  return groups.map((g) => applyHeadlines(g, assigned));
}
