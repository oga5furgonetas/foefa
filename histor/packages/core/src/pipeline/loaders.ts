/** Conversión filas de BD → estructuras del motor de verificación. */
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rawItems, sourceReliability, sources, storyItems } from '../db/schema';
import type { SourceType } from '../domain';
import { pressReleaseReason } from '../text/nonnews';
import type { VItem, VPlace, VSource } from '../verification/types';

export type RawItemRow = typeof rawItems.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;

export function toVItem(r: RawItemRow): VItem {
  const meta = (r.meta ?? {}) as { places?: VPlace[]; structured?: Record<string, unknown> | null; phash?: string | null };
  return {
    id: r.id,
    sourceId: r.sourceId,
    url: r.url,
    title: r.title,
    summary: r.summary,
    text: r.contentText,
    language: r.language,
    publishedAt: r.publishedAt,
    fetchedAt: r.fetchedAt,
    attributedTo: r.attributedTo,
    minhash: r.minhash,
    imageUrl: r.imageUrl,
    imagePhash: meta.phash ?? null,
    places: meta.places ?? [],
    structured: meta.structured ?? null,
    reserved: r.tdmReserved,
  };
}

export async function loadSources(db: Db, ids: number[]): Promise<Map<number, VSource>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ s: sources, r: sourceReliability })
    .from(sources)
    .leftJoin(sourceReliability, eq(sourceReliability.sourceId, sources.id))
    .where(inArray(sources.id, ids));
  return new Map(
    rows.map(({ s, r }) => [
      s.id,
      {
        id: s.id,
        slug: s.slug,
        name: s.name,
        sourceType: s.sourceType as SourceType,
        ownershipGroup: s.ownershipGroup,
        isSatire: s.isSatire,
        countryCode: s.countryCode,
        reliability: { alpha: r?.alpha ?? 6, beta: r?.beta ?? 3 },
        homepageUrl: s.homepageUrl,
        corroborateOnly: (s.config as { corroborateOnly?: boolean } | null)?.corroborateOnly === true,
      },
    ]),
  );
}

export async function loadStoryItems(db: Db, storyId: number): Promise<{ items: VItem[]; rows: RawItemRow[] }> {
  const rows = await db
    .select({ r: rawItems })
    .from(storyItems)
    .innerJoin(rawItems, eq(rawItems.id, storyItems.itemId))
    .where(eq(storyItems.storyId, storyId));
  // Las notas de prensa de pago que entraron antes del filtro no cuentan ni como fuente ni como texto.
  const raw = rows.map((x) => x.r).filter((r) => !pressReleaseReason(r.summary) && !pressReleaseReason(r.contentText));
  return { items: raw.map(toVItem), rows: raw };
}
