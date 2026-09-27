/**
 * Analítica propia y respetuosa (sin terceros, sin vender datos):
 * - Sin consentimiento de medición: se cuentan eventos SIN identificador.
 * - Con consentimiento: identificador anónimo (hash con sal), nunca la IP.
 * - Con consentimiento de personalización (o cuenta con la opción activa):
 *   se actualiza el perfil de intereses que usa el recomendador.
 */
import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { aiUsage, analyticsEvents, articleEntities, articles, entities, readingHistory, reviewTasks, sources, sourceReliability, stories, rawItems, storyItems, subscriptions, corrections } from '../db/schema';
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from '../domain';
import { updateInterestProfile } from '../reco';
import { sha256 } from '../security/crypto';
import { env } from '../env';

export type IncomingEvent = {
  type: string;
  articleId?: number | null;
  path?: string | null;
  value?: number | null;
  props?: Record<string, unknown>;
};

export type EventContext = {
  userId: string | null;
  anonCookie: string | null;
  countryCode: string | null;
  language: string | null;
  device: 'mobile' | 'tablet' | 'desktop' | null;
  referrerHost: string | null;
  consentAnalytics: boolean;
  consentPersonalization: boolean;
};

export function anonId(cookie: string | null): string | null {
  if (!cookie) return null;
  return sha256(`${env().ANALYTICS_SALT || 'histor-dev-salt'}|${cookie}`).slice(0, 32);
}

export function deviceFromUA(ua: string | null | undefined): EventContext['device'] {
  if (!ua) return null;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export async function recordEvents(db: Db, events: IncomingEvent[], ctx: EventContext): Promise<number> {
  const valid = events
    .slice(0, 50)
    .filter((e) => (ANALYTICS_EVENT_TYPES as readonly string[]).includes(e.type))
    .map((e) => ({ ...e, type: e.type as AnalyticsEventType }));
  if (!valid.length) return 0;
  const aid = ctx.consentAnalytics ? anonId(ctx.anonCookie) : null;
  const articleIds = [...new Set(valid.map((e) => e.articleId).filter((x): x is number => typeof x === 'number'))];
  const storyOf = new Map<number, number>();
  if (articleIds.length) {
    const rows = await db.select({ id: articles.id, storyId: articles.storyId }).from(articles).where(sql`${articles.id} IN (${sql.join(articleIds.map((i) => sql`${i}`), sql`, `)})`);
    for (const r of rows) storyOf.set(r.id, r.storyId);
  }
  await db.insert(analyticsEvents).values(
    valid.map((e) => ({
      type: e.type,
      anonId: aid,
      userId: ctx.consentAnalytics ? ctx.userId : null,
      articleId: e.articleId && storyOf.has(e.articleId) ? e.articleId : null,
      storyId: e.articleId ? (storyOf.get(e.articleId) ?? null) : null,
      path: e.path?.slice(0, 300) ?? null,
      language: ctx.language,
      countryCode: ctx.countryCode,
      device: ctx.device,
      referrerHost: ctx.referrerHost?.slice(0, 120) ?? null,
      value: typeof e.value === 'number' && Number.isFinite(e.value) ? e.value : null,
      props: sanitizeProps(e.props),
    })),
  );
  // Historial de lectura (usuarios registrados).
  if (ctx.userId) {
    for (const e of valid) {
      if (!e.articleId || !storyOf.has(e.articleId)) continue;
      if (e.type === 'read_progress' || e.type === 'dwell' || e.type === 'page_view') {
        await db
          .insert(readingHistory)
          .values({ userId: ctx.userId, articleId: e.articleId, maxScroll: e.type === 'read_progress' ? Math.min(1, e.value ?? 0) : 0, dwellSeconds: e.type === 'dwell' ? Math.round(e.value ?? 0) : 0 })
          .onConflictDoUpdate({
            target: [readingHistory.userId, readingHistory.articleId],
            set: {
              lastReadAt: new Date(),
              maxScroll: e.type === 'read_progress' ? sql`greatest(${readingHistory.maxScroll}, ${Math.min(1, e.value ?? 0)})` : readingHistory.maxScroll,
              dwellSeconds: e.type === 'dwell' ? sql`${readingHistory.dwellSeconds} + ${Math.round(e.value ?? 0)}` : readingHistory.dwellSeconds,
            },
          });
      }
    }
  }
  // Perfil de intereses (personalización consentida).
  if (ctx.consentPersonalization && (ctx.userId || aid)) {
    const key = ctx.userId ? `u:${ctx.userId}` : `a:${aid}`;
    for (const e of valid) if (e.articleId && storyOf.has(e.articleId)) await updateInterestProfile(db, key, e.articleId, e.type, e.value ?? null);
  }
  return valid.length;
}

function sanitizeProps(p: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!p) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p).slice(0, 12)) {
    if (!/^[a-z_]{1,32}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 120);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

const n = (x: unknown) => Number(x ?? 0);

/** Métricas del panel (sección 29): pipeline, calidad, audiencia, negocio y costes. */
export async function dashboardMetrics(db: Db, opts: { hours?: number } = {}) {
  const hours = opts.hours ?? 24;
  const since = new Date(Date.now() - hours * 3600000);
  const [itemsRow] = await db.select({ c: sql<number>`count(*)` }).from(rawItems).where(gte(rawItems.fetchedAt, since));
  const states = await db.select({ state: stories.state, c: sql<number>`count(*)` }).from(stories).where(gte(stories.firstSeenAt, since)).groupBy(stories.state);
  const byState = Object.fromEntries(states.map((s) => [s.state, n(s.c)]));
  const discovered = states.reduce((a, s) => a + n(s.c), 0);
  const [pub] = await db.select({ c: sql<number>`count(*)` }).from(articles).where(and(gte(articles.publishedAt, since), eq(articles.status, 'published')));
  const [corr] = await db.select({ c: sql<number>`count(DISTINCT ${corrections.articleId})` }).from(corrections).where(and(gte(corrections.createdAt, since), sql`${corrections.kind} IN ('correction','retraction')`));
  const [ttp] = await db
    .select({ avg: sql<number>`avg(extract(epoch from (${stories.publishedAt} - ${stories.firstSeenAt})))` })
    .from(stories)
    .where(and(gte(stories.publishedAt, since)));
  const [dups] = await db.select({ c: sql<number>`count(*)` }).from(storyItems).where(and(eq(storyItems.isCopy, true), gte(storyItems.joinedAt, since)));
  const bestSources = await db
    .select({ name: sources.name, slug: sources.slug, alpha: sourceReliability.alpha, beta: sourceReliability.beta, confirmed: sourceReliability.confirmedCount })
    .from(sources)
    .innerJoin(sourceReliability, eq(sourceReliability.sourceId, sources.id))
    .orderBy(sql`${sourceReliability.alpha} / (${sourceReliability.alpha} + ${sourceReliability.beta}) DESC`)
    .limit(8);
  const problemSources = await db
    .select({ name: sources.name, slug: sources.slug, status: sources.status, failures: sources.consecutiveFailures, contradicted: sourceReliability.contradictedCount })
    .from(sources)
    .leftJoin(sourceReliability, eq(sourceReliability.sourceId, sources.id))
    .where(sql`${sources.status} IN ('failing','blocked') OR ${sourceReliability.contradictedCount} > 0 OR ${sources.consecutiveFailures} > 0`)
    .limit(12);
  const ev = await db.select({ type: analyticsEvents.type, c: sql<number>`count(*)`, v: sql<number>`avg(${analyticsEvents.value})` }).from(analyticsEvents).where(gte(analyticsEvents.ts, since)).groupBy(analyticsEvents.type);
  const evs = Object.fromEntries(ev.map((e) => [e.type, { count: n(e.c), avg: Number(e.v ?? 0) }]));
  const [visitors] = await db.select({ c: sql<number>`count(DISTINCT ${analyticsEvents.anonId})` }).from(analyticsEvents).where(and(gte(analyticsEvents.ts, since), eq(analyticsEvents.type, 'page_view')));
  const [returning] = await db.execute(sql`
    SELECT count(*)::int AS c FROM (
      SELECT anon_id FROM analytics_events WHERE ts >= now() - interval '7 days' AND anon_id IS NOT NULL AND type = 'page_view'
      GROUP BY anon_id HAVING count(DISTINCT date_trunc('day', ts)) >= 2) t`) as unknown as { c: number }[];
  const [aiCost] = await db.select({ usd: sql<number>`coalesce(sum(${aiUsage.costUsd}),0)` }).from(aiUsage).where(gte(aiUsage.ts, since));
  const [activeSubs] = await db.select({ c: sql<number>`count(*)` }).from(subscriptions).where(sql`${subscriptions.status} IN ('trialing','active','past_due')`);
  const [openTasks] = await db.select({ c: sql<number>`count(*)` }).from(reviewTasks).where(sql`${reviewTasks.status} IN ('open','in_progress')`);
  const byCountry = await db.select({ country: analyticsEvents.countryCode, c: sql<number>`count(*)` }).from(analyticsEvents).where(and(gte(analyticsEvents.ts, since), eq(analyticsEvents.type, 'page_view'))).groupBy(analyticsEvents.countryCode).orderBy(sql`2 DESC`).limit(10);
  const byLang = await db.select({ lang: analyticsEvents.language, c: sql<number>`count(*)` }).from(analyticsEvents).where(and(gte(analyticsEvents.ts, since), eq(analyticsEvents.type, 'page_view'))).groupBy(analyticsEvents.language).orderBy(sql`2 DESC`);
  const viral = await db
    .select({ id: stories.id, headline: stories.headlineHint, momentum: stories.momentum, confidence: stories.evidenceConfidence, state: stories.state, flags: stories.flags })
    .from(stories)
    .where(gte(stories.lastItemAt, since))
    .orderBy(sql`${stories.momentum} DESC`)
    .limit(10);
  const topEntities = await db
    .select({ name: entities.name, slug: entities.slug, c: sql<number>`count(*)` })
    .from(articleEntities)
    .innerJoin(entities, eq(entities.id, articleEntities.entityId))
    .innerJoin(articles, eq(articles.id, articleEntities.articleId))
    .where(gte(articles.publishedAt, since))
    .groupBy(entities.name, entities.slug)
    .orderBy(sql`3 DESC`)
    .limit(10);
  const impressions = evs.impression?.count ?? 0;
  const clicks = evs.click?.count ?? 0;
  const published = n(pub?.c);
  return {
    windowHours: hours,
    pipeline: {
      itemsDiscovered: n(itemsRow?.c),
      itemsPerHour: Math.round((n(itemsRow?.c) / hours) * 10) / 10,
      storiesDiscovered: discovered,
      byState,
      published,
      rejectedPct: discovered ? Math.round(((byState.REJECTED ?? 0) / discovered) * 1000) / 10 : 0,
      heldPct: discovered ? Math.round(((byState.HELD ?? 0) / discovered) * 1000) / 10 : 0,
      correctedPct: published ? Math.round((n(corr?.c) / published) * 1000) / 10 : 0,
      avgDiscoveryToPublishMin: ttp?.avg ? Math.round(Number(ttp.avg) / 60) : null,
      duplicatesDetected: n(dups?.c),
    },
    sources: { best: bestSources.map((s) => ({ ...s, reliability: Math.round((s.alpha / (s.alpha + s.beta)) * 100) })), problematic: problemSources },
    audience: {
      pageViews: evs.page_view?.count ?? 0,
      uniqueVisitors: n(visitors?.c),
      returningVisitors7d: n(returning?.c),
      ctr: impressions ? Math.round((clicks / impressions) * 1000) / 10 : null,
      avgDwellSeconds: Math.round(evs.dwell?.avg ?? 0),
      avgScroll: Math.round((evs.read_progress?.avg ?? 0) * 100),
      byCountry: byCountry.map((r) => ({ country: r.country, views: n(r.c) })),
      byLanguage: byLang.map((r) => ({ lang: r.lang, views: n(r.c) })),
      newsletterSignups: evs.newsletter_signup?.count ?? 0,
    },
    business: {
      activeSubscriptions: n(activeSubs?.c),
      checkoutsStarted: evs.subscribe_start?.count ?? 0,
      conversions: evs.subscribe_success?.count ?? 0,
      conversionRatePct: n(visitors?.c) ? Math.round(((evs.subscribe_success?.count ?? 0) / n(visitors?.c)) * 10000) / 100 : null,
    },
    costs: { aiUsd: Number(aiCost?.usd ?? 0), aiUsdPerArticle: published ? Math.round((Number(aiCost?.usd ?? 0) / published) * 10000) / 10000 : 0, aiUsdPerVisitor: n(visitors?.c) ? Math.round((Number(aiCost?.usd ?? 0) / n(visitors?.c)) * 100000) / 100000 : 0 },
    viral,
    topEntities: topEntities.map((e) => ({ ...e, c: n(e.c) })),
    openReviewTasks: n(openTasks?.c),
  };
}
