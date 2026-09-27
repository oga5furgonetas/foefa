/**
 * ENRICH: lee la noticia completa de cada fuente de las historias que ya tienen más
 * de una pieza (las candidatas a publicarse). Un feed solo trae el titular y una o dos
 * frases: con eso no se puede contar qué ha pasado (27-09-2026: «El etíope Guye Adola
 * ganó su…» y poco más). Con el texto completo hay hechos para contrastar y redactar:
 * quién, qué, cuándo, dónde, cifras, reacciones.
 *
 * Mismas reglas que la ingesta: robots.txt, ritmo por dominio, reserva de minería
 * (TDM y `Content-Signal: ai-input=no`: no se guarda texto) y nada de muros de pago.
 * El texto solo sirve para contrastar; se poda a los 30 días.
 */
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rawItems, stories, storyItems } from '../db/schema';
import { PoliteFetcher } from '../ingest/fetcher';
import { extractArticleText } from '../ingest/parsers';

export async function enrichStoryItems(db: Db, opts: { fetcher?: PoliteFetcher; now?: Date; limit?: number } = {}): Promise<{ enriched: number; skipped: number }> {
  const now = opts.now ?? new Date();
  const fetcher = opts.fetcher ?? new PoliteFetcher();
  const since = new Date(now.getTime() - 48 * 3600_000);
  const rows = await db
    .select({ id: rawItems.id, url: rawItems.url, meta: rawItems.meta, storyId: stories.id })
    .from(rawItems)
    .innerJoin(storyItems, eq(storyItems.itemId, rawItems.id))
    .innerJoin(stories, eq(stories.id, storyItems.storyId))
    .where(
      and(
        isNull(rawItems.contentText),
        eq(rawItems.isDemo, false),
        eq(rawItems.tdmReserved, false),
        gte(rawItems.fetchedAt, since),
        gte(stories.itemCount, 2),
        sql`coalesce(${rawItems.meta}->>'enrich', '') = ''`,
      ),
    )
    .orderBy(desc(stories.lastItemAt))
    .limit(opts.limit ?? 30);

  let enriched = 0;
  let skipped = 0;
  const touched = new Set<number>();
  for (const r of rows) {
    let status: string;
    let text: string | null = null;
    try {
      const res = await fetcher.get(r.url, { accept: 'text/html,application/xhtml+xml' });
      if (res.blockedByRobots) status = 'robots';
      else if (!res.ok) status = `http ${res.status}`;
      else if (res.tdmReserved) status = 'reservado';
      else {
        const out = extractArticleText(res.body);
        text = out.text;
        status = text ? 'ok' : (out.reason ?? 'sin texto');
      }
    } catch (e) {
      status = `error: ${(e as Error).message}`.slice(0, 80);
    }
    const meta = { ...((r.meta as Record<string, unknown>) ?? {}), enrich: status };
    await db.update(rawItems).set(text ? { contentText: text, meta } : { meta }).where(eq(rawItems.id, r.id));
    if (text) {
      enriched++;
      touched.add(r.storyId);
    } else skipped++;
  }
  // Con más material, la historia se vuelve a verificar y a redactar ya.
  if (touched.size) await db.update(stories).set({ nextCheckAt: now }).where(inArray(stories.id, [...touched]));
  return { enriched, skipped };
}
