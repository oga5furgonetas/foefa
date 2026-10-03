/**
 * Vuelve a calcular el país y la sección de lo ya publicado con las reglas de hoy. Al llegar, cada
 * pieza los calcula una vez; si las reglas mejoran (03-10-2026: gentilicios, clubes, sucesos en
 * «Sociedad»), lo publicado seguiría mal hasta que cambiara su texto. También retira de la
 * portada lo que con los filtros de hoy no es noticia (loterías, el tiempo de una ciudad…).
 */
import { and, eq, gte, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles, categories, rawItems, sources, stories, storyItems } from '../db/schema';
import { placeAndSection } from '../pipeline/normalize';
import { storyConsensus } from '../pipeline/verify';
import { nonNewsReason } from '../text/nonnews';

export async function reclassifyRecent(db: Db, hours: number): Promise<{ items: number; stories: number; articles: number; hidden: number }> {
  const since = new Date(Date.now() - hours * 3600_000);
  const lexicon = (await db.select({ id: categories.id, keywords: categories.keywords }).from(categories)).filter((c) => Object.keys(c.keywords).length);
  const rows = await db
    .select()
    .from(rawItems)
    .where(and(eq(rawItems.status, 'normalized'), gte(rawItems.fetchedAt, since)));
  if (!rows.length) return { items: 0, stories: 0, articles: 0, hidden: 0 };
  const srcRows = await db.select().from(sources).where(inArray(sources.id, [...new Set(rows.map((r) => r.sourceId))]));
  const srcById = new Map(srcRows.map((s) => [s.id, s]));
  let items = 0;
  for (const r of rows) {
    const src = srcById.get(r.sourceId);
    if (!src) continue;
    const { places, countryWeights, countryCode, cls } = placeAndSection(r, src, r.language, lexicon);
    if (countryCode === r.countryCode && cls.categoryId === r.categoryId) continue;
    await db
      .update(rawItems)
      .set({ countryCode: countryCode ?? null, categoryId: cls.categoryId, meta: { ...(r.meta ?? {}), places, countryWeights, classification: cls.scores } })
      .where(eq(rawItems.id, r.id));
    items++;
  }

  // Historias publicadas con piezas en la ventana: consenso de nuevo y, con él, sus artículos.
  const pubs = await db
    .selectDistinct({ storyId: articles.storyId })
    .from(articles)
    .where(and(eq(articles.status, 'published'), eq(articles.isDemo, false), gte(articles.publishedAt, since)));
  let storiesChanged = 0;
  let articlesChanged = 0;
  let hidden = 0;
  for (const { storyId } of pubs) {
    const [st] = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
    if (!st) continue;
    const its = await db
      .select({ categoryId: rawItems.categoryId, countryCode: rawItems.countryCode, meta: rawItems.meta, title: rawItems.title, url: rawItems.url })
      .from(storyItems)
      .innerJoin(rawItems, eq(rawItems.id, storyItems.itemId))
      .where(eq(storyItems.storyId, storyId));
    if (!its.length) continue;
    const heads = await db.select({ headline: articles.headline }).from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
    if (its.every((i) => nonNewsReason(i.title, i.url)) || heads.some((h) => nonNewsReason(h.headline, 'https://histor.invalid/'))) {
      await db.update(articles).set({ status: 'held' }).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
      await db.update(stories).set({ state: 'REJECTED', nextCheckAt: null }).where(eq(stories.id, storyId));
      hidden++;
      continue;
    }
    if (st.lockedByEditor) continue;
    const c = storyConsensus(its);
    const categoryId = c.categoryId ?? st.categoryId;
    const countryCode = c.countryCode;
    if (categoryId === st.categoryId && countryCode === st.countryCode) continue;
    await db.update(stories).set({ categoryId, countryCode }).where(eq(stories.id, storyId));
    const res = await db
      .update(articles)
      .set({ categoryId, countryCode })
      .where(eq(articles.storyId, storyId))
      .returning({ id: articles.id });
    storiesChanged++;
    articlesChanged += res.length;
  }
  return { items, stories: storiesChanged, articles: articlesChanged, hidden };
}
