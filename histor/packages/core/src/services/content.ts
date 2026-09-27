/**
 * Consultas públicas de contenido. Garantía clave: el contenido DEMO y el
 * real NUNCA se mezclan. Con DEMO_MODE=1 solo se ve lo DEMO (con aviso);
 * sin él, solo lo real.
 */
import { and, desc, eq, gte, inArray, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { CITIES } from '../config/cities';
import { languageDef } from '../config/languages';
import type { Db } from '../db/client';
import {
  articleEntities,
  articles,
  articleVersions,
  authors,
  cities,
  corrections,
  entities,
  events,
  media,
  regions,
  sourceReliability,
  sources,
  stories,
  storyItems,
  rawItems,
} from '../db/schema';
import { env } from '../env';
import { href } from '../i18n/routes';

export function demoMode(): boolean {
  return env().DEMO_MODE;
}

export type ArticleCard = {
  id: number;
  storyId: number;
  language: string;
  slug: string;
  url: string;
  headline: string;
  summary: string;
  publishedAt: Date;
  updatedAt: Date;
  version: number;
  categoryId: string | null;
  countryCode: string | null;
  regionId: number | null;
  cityId: number | null;
  isBreaking: boolean;
  isDeveloping: boolean;
  isDemo: boolean;
  readingMinutes: number;
  sourcesCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
  importance: number;
  evidenceConfidence: number;
  momentum: number;
  status: string;
};

const cardColumns = {
  id: articles.id,
  storyId: articles.storyId,
  language: articles.language,
  slug: articles.slug,
  headline: articles.headline,
  summary: articles.summary,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  version: articles.version,
  categoryId: articles.categoryId,
  countryCode: articles.countryCode,
  regionId: articles.regionId,
  cityId: articles.cityId,
  isBreaking: articles.isBreaking,
  isDeveloping: articles.isDeveloping,
  isDemo: articles.isDemo,
  readingMinutes: articles.readingMinutes,
  sourcesCount: sql<number>`jsonb_array_length(${articles.sourcesList})`,
  imageUrl: media.url,
  imageAlt: sql<string | null>`${media.alt} ->> ${articles.language}`,
  importance: articles.importance,
  evidenceConfidence: articles.evidenceConfidence,
  momentum: stories.momentum,
  status: articles.status,
};

function toCard(r: Record<string, unknown>): ArticleCard {
  const c = r as unknown as Omit<ArticleCard, 'url'> & { publishedAt: Date };
  return { ...c, sourcesCount: Number(c.sourcesCount ?? 0), url: href.article(c.language, c.publishedAt, c.slug) };
}

export function visible(): SQL {
  return and(eq(articles.status, 'published'), eq(articles.isDemo, demoMode()))!;
}

export type ListOpts = {
  lang: string;
  categoryId?: string;
  countryCode?: string;
  regionId?: number;
  cityId?: number;
  authorId?: number;
  entityId?: number;
  sourceId?: number;
  since?: Date;
  breaking?: boolean;
  excludeIds?: number[];
  orderBy?: 'recent' | 'importance' | 'momentum';
  limit?: number;
  offset?: number;
};

export async function listArticles(db: Db, o: ListOpts): Promise<ArticleCard[]> {
  const conds: (SQL | undefined)[] = [visible(), eq(articles.language, o.lang)];
  if (o.categoryId) conds.push(eq(articles.categoryId, o.categoryId));
  if (o.countryCode) conds.push(eq(articles.countryCode, o.countryCode));
  if (o.regionId) conds.push(eq(articles.regionId, o.regionId));
  if (o.cityId) conds.push(eq(articles.cityId, o.cityId));
  if (o.authorId) conds.push(eq(articles.authorId, o.authorId));
  if (o.since) conds.push(gte(articles.publishedAt, o.since));
  if (o.breaking) conds.push(eq(articles.isBreaking, true));
  if (o.excludeIds?.length) conds.push(sql`${articles.id} NOT IN (${sql.join(o.excludeIds.map((i) => sql`${i}`), sql`, `)})`);
  if (o.entityId) conds.push(sql`EXISTS (SELECT 1 FROM article_entities ae WHERE ae.article_id = ${articles.id} AND ae.entity_id = ${o.entityId})`);
  if (o.sourceId) conds.push(sql`${articles.sourcesList} @> ${JSON.stringify([{ sourceId: o.sourceId }])}::jsonb`);
  const order =
    o.orderBy === 'importance'
      ? [desc(sql`${articles.importance} * exp(-extract(epoch from (now() - ${articles.publishedAt})) / 86400.0)`), desc(articles.publishedAt)]
      : o.orderBy === 'momentum'
        ? [desc(stories.momentum), desc(articles.publishedAt)]
        : [desc(articles.publishedAt)];
  const rows = await db
    .select(cardColumns)
    .from(articles)
    .innerJoin(stories, eq(stories.id, articles.storyId))
    .leftJoin(media, eq(media.id, articles.imageId))
    .where(and(...conds))
    .orderBy(...order)
    .limit(o.limit ?? 20)
    .offset(o.offset ?? 0);
  return rows.map(toCard);
}

export type HomeData = {
  top: ArticleCard | null;
  breaking: ArticleCard[];
  latest: ArticleCard[];
  trending: ArticleCard[];
  national: ArticleCard[];
  local: ArticleCard[];
  world: ArticleCard[];
  sections: { categoryId: string; items: ArticleCard[] }[];
};

const HOME_SECTIONS = ['technology', 'economy', 'politics', 'science', 'health', 'sports', 'entertainment', 'culture', 'business', 'society', 'weather', 'travel', 'lifestyle'];

/**
 * Portada: cambia con el país, la región, la hora y lo que está pasando.
 * Lo principal = lo más importante reciente (importancia = momentum ×
 * confianza, solo entre lo ya verificado); la hora decae la importancia.
 */
export async function getHome(db: Db, geo: { lang: string; countryCode: string | null; regionCode: string | null; cityKey: string | null }): Promise<HomeData> {
  const since = new Date(Date.now() - 7 * 86400000);
  const top = (await listArticles(db, { lang: geo.lang, since, orderBy: 'importance', limit: 1 }))[0] ?? null;
  const exclude = top ? [top.id] : [];
  const breaking = await listArticles(db, { lang: geo.lang, breaking: true, since: new Date(Date.now() - 12 * 3600000), limit: 5, excludeIds: exclude });
  const latest = await listArticles(db, { lang: geo.lang, limit: 12, excludeIds: exclude });
  const trending = await listArticles(db, { lang: geo.lang, since: new Date(Date.now() - 48 * 3600000), orderBy: 'momentum', limit: 6, excludeIds: exclude });
  const national = geo.countryCode ? await listArticles(db, { lang: geo.lang, countryCode: geo.countryCode, since, orderBy: 'importance', limit: 8, excludeIds: exclude }) : [];
  let local: ArticleCard[] = [];
  if (geo.cityKey) {
    const cityId = await cityIdByKey(db, geo.cityKey);
    if (cityId) local = await listArticles(db, { lang: geo.lang, cityId, limit: 6 });
  }
  if (local.length < 3 && geo.regionCode) {
    const [r] = await db.select({ id: regions.id }).from(regions).where(eq(regions.code, geo.regionCode)).limit(1);
    if (r) local = [...local, ...(await listArticles(db, { lang: geo.lang, regionId: r.id, limit: 6, excludeIds: local.map((x) => x.id) }))];
  }
  const worldRows = await db
    .select(cardColumns)
    .from(articles)
    .innerJoin(stories, eq(stories.id, articles.storyId))
    .leftJoin(media, eq(media.id, articles.imageId))
    .where(and(visible(), eq(articles.language, geo.lang), geo.countryCode ? or(ne(articles.countryCode, geo.countryCode), sql`${articles.countryCode} IS NULL`) : undefined, gte(articles.publishedAt, since)))
    .orderBy(desc(articles.importance))
    .limit(8);
  const sections: HomeData['sections'] = [];
  for (const categoryId of HOME_SECTIONS) {
    const items = await listArticles(db, { lang: geo.lang, categoryId, limit: 4, since: new Date(Date.now() - 14 * 86400000) });
    if (items.length) sections.push({ categoryId, items });
  }
  return { top, breaking, latest, trending, national, local, world: worldRows.map(toCard), sections };
}

export async function cityIdByKey(db: Db, key: string): Promise<number | null> {
  const c = CITIES.find((x) => x.key === key);
  if (!c) return null;
  const rows = await db.select({ id: cities.id, slugs: cities.slugs }).from(cities).where(eq(cities.countryCode, c.countryCode));
  return rows.find((r) => (r.slugs as Record<string, string>).en === c.slugs.en)?.id ?? null;
}

export async function regionIdByCode(db: Db, code: string): Promise<number | null> {
  const [r] = await db.select({ id: regions.id }).from(regions).where(eq(regions.code, code)).limit(1);
  return r?.id ?? null;
}

/** Artículo completo para su página (incluye retirados: nunca se ocultan en silencio). */
export async function getArticleDetail(db: Db, lang: string, slug: string) {
  const [a] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.language, lang), eq(articles.slug, slug), eq(articles.isDemo, demoMode()), inArray(articles.status, ['published', 'retracted'])))
    .limit(1);
  if (!a) return null;
  const [story] = await db.select().from(stories).where(eq(stories.id, a.storyId)).limit(1);
  const [author] = a.authorId ? await db.select().from(authors).where(eq(authors.id, a.authorId)).limit(1) : [];
  const [image] = a.imageId ? await db.select().from(media).where(eq(media.id, a.imageId)).limit(1) : [];
  const versions = await db
    .select({ version: articleVersions.version, kind: articleVersions.kind, changeSummary: articleVersions.changeSummary, createdAt: articleVersions.createdAt, headline: articleVersions.headline })
    .from(articleVersions)
    .where(eq(articleVersions.articleId, a.id))
    .orderBy(desc(articleVersions.version));
  const corr = await db.select().from(corrections).where(eq(corrections.articleId, a.id)).orderBy(desc(corrections.createdAt));
  const alternates = await db
    .select({ language: articles.language, slug: articles.slug, publishedAt: articles.publishedAt, headline: articles.headline })
    .from(articles)
    .where(and(eq(articles.storyId, a.storyId), ne(articles.id, a.id), inArray(articles.status, ['published', 'retracted'])));
  const ents = await db
    .select({ id: entities.id, slug: entities.slug, name: entities.name, type: entities.type })
    .from(articleEntities)
    .innerJoin(entities, eq(entities.id, articleEntities.entityId))
    .where(eq(articleEntities.articleId, a.id));
  const related = await relatedArticles(db, a, ents.map((e) => e.id));
  const evs = await db.select().from(events).where(eq(events.storyId, a.storyId));
  return { article: a, story, author: author ?? null, image: image ?? null, versions, corrections: corr, alternates, entities: ents, related, events: evs };
}

export async function relatedArticles(db: Db, a: { id: number; storyId: number; language: string; categoryId: string | null }, entityIds: number[], limit = 6): Promise<ArticleCard[]> {
  const conds: SQL[] = [visible(), eq(articles.language, a.language), ne(articles.storyId, a.storyId)];
  const byEntity = entityIds.length
    ? await db
        .select(cardColumns)
        .from(articles)
        .innerJoin(stories, eq(stories.id, articles.storyId))
        .leftJoin(media, eq(media.id, articles.imageId))
        .where(and(...conds, sql`EXISTS (SELECT 1 FROM article_entities ae WHERE ae.article_id = ${articles.id} AND ae.entity_id IN (${sql.join(entityIds.map((i) => sql`${i}`), sql`, `)}))`))
        .orderBy(desc(articles.publishedAt))
        .limit(limit)
    : [];
  const cards = byEntity.map(toCard);
  if (cards.length < limit && a.categoryId) {
    const more = await listArticles(db, { lang: a.language, categoryId: a.categoryId, limit: limit - cards.length, excludeIds: [a.id, ...cards.map((c) => c.id)] });
    cards.push(...more.filter((m) => m.storyId !== a.storyId));
  }
  return cards.slice(0, limit);
}

/** Búsqueda full-text en el idioma del lector (con respaldo por trigramas). */
export async function searchArticles(db: Db, lang: string, q: string, o: { categoryId?: string; since?: Date; limit?: number; offset?: number } = {}): Promise<{ items: ArticleCard[]; total: number }> {
  const query = q.trim().slice(0, 200);
  if (!query) return { items: [], total: 0 };
  const cfg = languageDef(lang).ftsConfig;
  const tsq = sql`websearch_to_tsquery(${cfg}::regconfig, ${query})`;
  const conds: (SQL | undefined)[] = [visible(), eq(articles.language, lang), sql`${articles.searchVector} @@ ${tsq}`];
  if (o.categoryId) conds.push(eq(articles.categoryId, o.categoryId));
  if (o.since) conds.push(gte(articles.publishedAt, o.since));
  // Relevancia textual, con un empujón a lo reciente (media vida de una semana).
  const rank = sql<number>`ts_rank_cd(${articles.searchVector}, ${tsq}) * (1 + 1.0 / (1 + extract(epoch from (now() - ${articles.publishedAt})) / 604800.0))`;
  const rows = await db
    .select(cardColumns)
    .from(articles)
    .innerJoin(stories, eq(stories.id, articles.storyId))
    .leftJoin(media, eq(media.id, articles.imageId))
    .where(and(...conds))
    .orderBy(desc(rank))
    .limit(o.limit ?? 20)
    .offset(o.offset ?? 0);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(articles).where(and(...conds));
  if (rows.length) return { items: rows.map(toCard), total: Number(n) };
  // Respaldo: coincidencia aproximada en el titular (erratas, nombres propios).
  const fuzzy = await db
    .select(cardColumns)
    .from(articles)
    .innerJoin(stories, eq(stories.id, articles.storyId))
    .leftJoin(media, eq(media.id, articles.imageId))
    .where(and(visible(), eq(articles.language, lang), sql`similarity(${articles.headline}, ${query}) > 0.15`))
    .orderBy(desc(sql`similarity(${articles.headline}, ${query})`))
    .limit(o.limit ?? 20);
  return { items: fuzzy.map(toCard), total: fuzzy.length };
}

export async function getSourceBySlug(db: Db, slug: string) {
  const [s] = await db
    .select({ s: sources, r: sourceReliability })
    .from(sources)
    .leftJoin(sourceReliability, eq(sourceReliability.sourceId, sources.id))
    .where(and(eq(sources.slug, slug), eq(sources.isDemo, demoMode())))
    .limit(1);
  return s ?? null;
}

export async function listPublicSources(db: Db) {
  return db
    .select({ s: sources, r: sourceReliability })
    .from(sources)
    .leftJoin(sourceReliability, eq(sourceReliability.sourceId, sources.id))
    .where(and(eq(sources.isDemo, demoMode()), ne(sources.status, 'blocked')))
    .orderBy(sources.sourceType, sources.name);
}

export async function getAuthorBySlug(db: Db, slug: string) {
  const [a] = await db.select().from(authors).where(eq(authors.slug, slug)).limit(1);
  return a ?? null;
}

export async function getEntityBySlug(db: Db, slug: string) {
  const [e] = await db.select().from(entities).where(eq(entities.slug, slug)).limit(1);
  return e ?? null;
}

/** Página de historia: cronología pública (piezas por fuente y versiones del artículo). */
export async function getStoryTimeline(db: Db, slug: string, lang: string) {
  const [s] = await db.select().from(stories).where(and(eq(stories.slug, slug), eq(stories.isDemo, demoMode()))).limit(1);
  if (!s) return null;
  const [art] = await db.select().from(articles).where(and(eq(articles.storyId, s.id), eq(articles.language, lang))).limit(1);
  const items = await db
    .select({ at: sql<Date>`coalesce(${rawItems.publishedAt}, ${rawItems.fetchedAt})`, source: sources.name, sourceSlug: sources.slug, sourceType: sources.sourceType, url: rawItems.url, isCopy: storyItems.isCopy })
    .from(storyItems)
    .innerJoin(rawItems, eq(rawItems.id, storyItems.itemId))
    .innerJoin(sources, eq(sources.id, rawItems.sourceId))
    .where(eq(storyItems.storyId, s.id))
    .orderBy(sql`1`);
  const versions = art ? await db.select().from(articleVersions).where(eq(articleVersions.articleId, art.id)).orderBy(articleVersions.version) : [];
  return { story: s, article: art ?? null, items, versions };
}

export async function publishedCountForEntity(db: Db, entityId: number, lang: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(articleEntities)
    .innerJoin(articles, eq(articles.id, articleEntities.articleId))
    .where(and(eq(articleEntities.entityId, entityId), visible(), eq(articles.language, lang)));
  return Number(r?.n ?? 0);
}

/** Entradas de sitemap (solo contenido real y publicado). */
export async function sitemapArticles(db: Db, lang: string, page: number, pageSize = 5000) {
  return db
    .select({ id: articles.id, storyId: articles.storyId, slug: articles.slug, publishedAt: articles.publishedAt, updatedAt: articles.updatedAt, language: articles.language })
    .from(articles)
    .where(and(eq(articles.status, 'published'), eq(articles.isDemo, false), eq(articles.language, lang)))
    .orderBy(desc(articles.publishedAt))
    .limit(pageSize)
    .offset(page * pageSize);
}

export async function newsSitemapArticles(db: Db) {
  return db
    .select({ slug: articles.slug, language: articles.language, headline: articles.headline, publishedAt: articles.publishedAt })
    .from(articles)
    .where(and(eq(articles.status, 'published'), eq(articles.isDemo, false), gte(articles.publishedAt, new Date(Date.now() - 48 * 3600000))))
    .orderBy(desc(articles.publishedAt))
    .limit(1000);
}

export async function alternatesForStories(db: Db, storyIds: number[]) {
  if (!storyIds.length) return [];
  return db
    .select({ storyId: articles.storyId, language: articles.language, slug: articles.slug, publishedAt: articles.publishedAt })
    .from(articles)
    .where(and(inArray(articles.storyId, storyIds), eq(articles.status, 'published')));
}

export async function recentCorrections(db: Db, lang: string, limit = 50) {
  return db
    .select({ note: corrections.note, kind: corrections.kind, createdAt: corrections.createdAt, headline: articles.headline, slug: articles.slug, publishedAt: articles.publishedAt, language: articles.language })
    .from(corrections)
    .innerJoin(articles, eq(articles.id, corrections.articleId))
    .where(and(eq(articles.language, lang), eq(articles.isDemo, demoMode()), inArray(corrections.kind, ['correction', 'retraction', 'clarification'])))
    .orderBy(desc(corrections.createdAt))
    .limit(limit);
}

export { lt };
