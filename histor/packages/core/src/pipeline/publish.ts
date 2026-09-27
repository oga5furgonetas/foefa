/**
 * WRITE → FACT CHECK → PUBLISH / UPDATE / RETRACT.
 * Por cada idioma: ficha de hechos → redactor (IA si está configurada;
 * determinista si no o si la IA no pasa los controles) → controles de
 * calidad → artículo + versión. Si ningún idioma pasa los controles, la
 * historia queda retenida (HELD) con su informe y una tarea para el panel.
 * Nada se borra: cada cambio es una versión nueva con su resumen.
 */
import { and, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { providerFor } from '../ai/router';
import { country } from '../config/countries';
import { DESK_BY_CATEGORY } from '../config/editorial';
import { ACTIVE_LANGUAGES } from '../config/languages';
import type { EditorialSettings } from '../config/settings';
import type { Db } from '../db/client';
import { articleEntities, articles, articleVersions, authors, corrections, entities, qualityReports, sources as sourcesT, stories } from '../db/schema';
import { audit, openReviewTask } from '../services/audit';
import { entityKey } from '../text/entities';
import { slugify, wordCount } from '../text/normalize';
import { minhash } from '../text/similarity';
import { writeDeterministic } from '../writing/deterministic';
import { bodyText, type Draft } from '../writing/draft';
import { buildFactSheet, type FactSheet } from '../writing/factsheet';
import { translateDraft, writeWithLlm } from '../writing/llm';
import { notesFor } from '../writing/notes';
import { PHRASES } from '../writing/phrases';
import { runQualityChecks, type QualityReport } from '../writing/quality';
import type { VerifiedStory } from './verify';

export type PublishResult = { storyId: number; published: string[]; updated: string[]; held: boolean; retracted: boolean; reports: Record<string, QualityReport> };

export async function publishStory(db: Db, v: VerifiedStory, settings: EditorialSettings, opts: { now?: Date } = {}): Promise<PublishResult> {
  const now = opts.now ?? new Date();
  const { analysis, story } = v;
  const result: PublishResult = { storyId: story.id, published: [], updated: [], held: false, retracted: false, reports: {} };

  if (analysis.decision === 'retract') {
    await retractStory(db, story.id, 'denial', now);
    result.retracted = true;
    return result;
  }
  if (!['publish', 'publish_developing', 'update', 'review'].includes(analysis.decision)) return result;
  if (analysis.decision === 'review') {
    await markUnderReview(db, story.id, now);
    return result;
  }

  const forbidden = new Set(
    (await db.select({ id: sourcesT.id }).from(sourcesT).where(sql`${sourcesT.status} = 'blocked' OR ${sourcesT.isSatire} = true`)).map((r) => r.id),
  );
  const recent = (
    await db
      .select({ storyId: articles.storyId, headline: articles.headline, language: articles.language })
      .from(articles)
      .where(and(eq(articles.status, 'published'), gte(articles.publishedAt, new Date(now.getTime() - 72 * 3600000)), ne(articles.storyId, story.id)))
      .limit(500)
  ).map((r) => ({ ...r, minhash: null as number[] | null }));

  const existing = await db.select().from(articles).where(eq(articles.storyId, story.id));
  const existingByLang = new Map(existing.map((a) => [a.language, a]));
  const deskSlug = DESK_BY_CATEGORY[story.categoryId ?? ''] ?? 'redaccion';
  const [author] = await db.select({ id: authors.id }).from(authors).where(eq(authors.slug, deskSlug)).limit(1);
  const edition = story.countryCode ? country(story.countryCode) : undefined;

  const langs = settings.publishLanguages.filter((l) => (ACTIVE_LANGUAGES as string[]).includes(l));
  const drafts = new Map<string, { draft: Draft; fs: FactSheet; report: QualityReport }>();
  const failed: Record<string, QualityReport> = {};

  for (const lang of langs) {
    const fs = buildFactSheet(analysis, v.items, v.sources, { language: lang, storyId: story.id, claimDbIds: v.keyToId });
    const writeOpts = { countryCode: edition && edition.defaultLanguage === lang ? edition.code : null, timeZone: edition?.timezone };
    const candidates: Draft[] = [];
    if (providerFor('writing')) {
      const ai = await writeWithLlm(db, fs, { ...writeOpts, storyId: story.id });
      if (ai) candidates.push(ai);
    }
    const det = writeDeterministic(fs, writeOpts);
    if (det) candidates.push(det);
    for (const draft of candidates) {
      const report = runQualityChecks({
        draft,
        factSheet: fs,
        state: story.state as never,
        flags: analysis.flags,
        confidence: analysis.confidence,
        settings,
        storyBlocked: story.state === 'BLOCKED',
        recentPublished: recent.filter((r) => r.language === lang),
        storyId: story.id,
        forbiddenSourceIds: forbidden,
        now,
      });
      await db.insert(qualityReports).values({ storyId: story.id, language: lang, passed: report.passed, checks: report.checks, writer: draft.writer });
      if (report.passed) {
        drafts.set(lang, { draft, fs, report });
        break;
      }
      failed[lang] = report;
    }
  }

  // Idiomas sin material propio: adaptación por IA de un borrador ya validado.
  if (providerFor('translation') && drafts.size) {
    const [srcLang, best] = [...drafts.entries()].sort((a, b) => b[1].fs.confirmed.length - a[1].fs.confirmed.length)[0];
    for (const lang of langs.filter((l) => !drafts.has(l))) {
      const tr = await translateDraft(db, best.draft, lang, { storyId: story.id });
      if (!tr) continue;
      const fs = { ...best.fs, language: lang };
      const report = runQualityChecks({
        draft: tr,
        factSheet: fs,
        state: story.state as never,
        flags: analysis.flags,
        confidence: analysis.confidence,
        settings,
        storyBlocked: false,
        recentPublished: recent.filter((r) => r.language === lang),
        storyId: story.id,
        forbiddenSourceIds: forbidden,
        now,
        isTranslation: true,
      });
      await db.insert(qualityReports).values({ storyId: story.id, language: lang, passed: report.passed, checks: report.checks, writer: `${tr.writer} (desde ${srcLang})` });
      if (report.passed) drafts.set(lang, { draft: tr, fs, report });
    }
  }

  result.reports = Object.fromEntries([...drafts.entries()].map(([l, d]) => [l, d.report]));
  if (!drafts.size && !existing.length) {
    await db.update(stories).set({ state: 'HELD', updatedAt: now }).where(eq(stories.id, story.id));
    const firstFail = Object.values(failed)[0];
    await openReviewTask(db, {
      kind: 'qc_failure',
      title: `No supera los controles de calidad: ${story.headlineHint.slice(0, 140)}`,
      storyId: story.id,
      priority: 55,
      detail: { failed: Object.fromEntries(Object.entries(failed).map(([l, r]) => [l, r.checks.filter((c) => !c.passed)])) , first: firstFail?.checks.filter((c) => !c.passed) },
      dedupeKey: `qc:${story.id}`,
    });
    result.held = true;
    return result;
  }

  const entityIds = await upsertStoryEntities(db, v);
  for (const [lang, { draft, fs }] of drafts) {
    const prev = existingByLang.get(lang);
    const text = bodyText(draft.body);
    const base = {
      headline: draft.headline,
      subheadline: draft.subheadline,
      summary: draft.summary,
      body: draft.body,
      bodyText: text,
      verification: draft.verification,
      sourcesList: fs.sources,
      timeline: draft.timeline,
      isDeveloping: draft.isDeveloping,
      isBreaking: analysis.isBreaking,
      categoryId: story.categoryId,
      countryCode: story.countryCode,
      regionId: story.regionId,
      cityId: story.cityId,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription,
      writer: draft.writer,
      wordCount: wordCount(text),
      readingMinutes: Math.max(1, Math.round(wordCount(text) / 220)),
      evidenceConfidence: analysis.confidence,
      importance: v.story.importance,
      isDemo: story.isDemo,
      authorId: author?.id ?? null,
    };
    if (!prev) {
      const slug = `${slugify(draft.headline, 80)}-${story.id.toString(36)}`;
      const [row] = await db
        .insert(articles)
        .values({ ...base, storyId: story.id, language: lang, slug, status: 'published', version: 1, publishedAt: now, updatedAt: now })
        .returning({ id: articles.id });
      await db.insert(articleVersions).values({ articleId: row.id, version: 1, kind: 'publish', headline: draft.headline, body: draft.body, verification: draft.verification, changeSummary: 'Publicación inicial', changedBy: 'system' });
      if (entityIds.length) await db.insert(articleEntities).values(entityIds.map((e) => ({ articleId: row.id, entityId: e }))).onConflictDoNothing();
      await audit(db, { actor: 'system', action: 'article.publish', targetType: 'article', targetId: row.id, detail: { storyId: story.id, language: lang, writer: draft.writer, confidence: analysis.confidence } });
      result.published.push(lang);
    } else if (prev.status !== 'retracted' && materialChange(prev, draft)) {
      const summary = changeSummary(prev, draft, fs, lang);
      const version = prev.version + 1;
      // La URL no cambia nunca (SEO y enlaces): se conserva el slug original.
      await db.update(articles).set({ ...base, status: 'published', version, updatedAt: now }).where(eq(articles.id, prev.id));
      await db.insert(articleVersions).values({ articleId: prev.id, version, kind: 'update', headline: draft.headline, body: draft.body, verification: draft.verification, changeSummary: summary, changedBy: 'system' });
      await db.insert(corrections).values({ articleId: prev.id, kind: 'update', note: summary, version, createdBy: 'system' });
      result.updated.push(lang);
    }
  }

  if (result.published.length || result.updated.length) {
    const wasPublished = ['PUBLISHED', 'UPDATED'].includes(story.state);
    await db
      .update(stories)
      .set({
        state: wasPublished ? 'UPDATED' : 'PUBLISHED',
        publishedAt: story.publishedAt ?? now,
        isDeveloping: analysis.decision === 'publish_developing' || (analysis.decision === 'update' && !analysis.verifiedLevel),
        updatedAt: now,
      })
      .where(eq(stories.id, story.id));
  }
  return result;
}

function materialChange(prev: typeof articles.$inferSelect, next: Draft): boolean {
  if (prev.headline !== next.headline) return true;
  if (prev.isDeveloping !== next.isDeveloping) return true;
  const a = prev.body.map((b) => ('text' in b ? b.text : b.type === 'list' ? b.items.map((i) => i.text).join('|') : '')).join('\n');
  const b = next.body.map((x) => ('text' in x ? x.text : x.type === 'list' ? x.items.map((i) => i.text).join('|') : '')).join('\n');
  return a !== b;
}

function changeSummary(prev: typeof articles.$inferSelect, next: Draft, fs: FactSheet, lang: string): string {
  const N = notesFor(lang);
  const parts: string[] = [];
  const prevSources = new Set(prev.sourcesList.map((s) => s.name));
  const added = fs.sources.filter((s) => !prevSources.has(s.name)).map((s) => s.name);
  if (added.length) parts.push(N.updateNewSources(added.join(', ')));
  if (prev.isDeveloping && !next.isDeveloping) parts.push(N.updateStatusVerified);
  // Cifras que cambian ("Fallecidos: 3" → "Fallecidos: 5")
  const units = PHRASES[lang]?.units ?? {};
  const figText = (body: typeof prev.body) =>
    body.flatMap((b) => (b.type === 'list' ? b.items.map((i) => i.text) : [])).filter((t) => Object.values(units).some((u) => t.startsWith(`${u}:`)));
  const before = new Map(figText(prev.body).map((t) => [t.split(':')[0], t.split(':')[1]?.split('(')[0].trim()]));
  for (const t of figText(next.body)) {
    const [label, rest] = [t.split(':')[0], t.split(':')[1]?.split('(')[0].trim()];
    const old = before.get(label);
    if (old && rest && old !== rest) parts.push(N.updateFigure(label, old, rest));
  }
  if (!parts.length) parts.push(N.updateNewFacts);
  return parts.join(' ');
}

async function upsertStoryEntities(db: Db, v: VerifiedStory): Promise<number[]> {
  const counts = new Map<string, { name: string; n: number; type: string }>();
  for (const c of v.analysis.claims) {
    c.entityNames.forEach((name, i) => {
      const key = c.entities[i] ?? entityKey(name);
      const cur = counts.get(key) ?? { name, n: 0, type: 'other' };
      cur.n++;
      counts.set(key, cur);
    });
  }
  const top = [...counts.entries()].filter(([k]) => k.length > 2).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const ids: number[] = [];
  for (const [key, e] of top) {
    if (e.n < 2) continue;
    const slug = slugify(key, 60);
    if (!slug) continue;
    const [row] = await db
      .insert(entities)
      .values({ slug, name: e.name, type: e.type })
      .onConflictDoUpdate({ target: entities.slug, set: { name: sql`${entities.name}` } })
      .returning({ id: entities.id });
    ids.push(row.id);
  }
  return ids;
}

/** Retirada: el artículo NO se borra; se marca, se explica y se versiona. */
export async function retractStory(db: Db, storyId: number, reason: 'denial' | 'confidence' | 'editor', now = new Date(), actor = 'system', editorNote?: string): Promise<void> {
  const arts = await db.select().from(articles).where(eq(articles.storyId, storyId));
  for (const a of arts) {
    if (a.status === 'retracted') continue;
    const N = notesFor(a.language);
    const note = editorNote ?? N.retraction(reason === 'denial' ? N.retractionReasonDenial : N.retractionReasonConfidence);
    const version = a.version + 1;
    await db.update(articles).set({ status: 'retracted', retractedAt: now, retractionNote: note, version, updatedAt: now, isBreaking: false }).where(eq(articles.id, a.id));
    await db.insert(articleVersions).values({ articleId: a.id, version, kind: 'retraction', headline: a.headline, body: a.body, verification: a.verification, changeSummary: note, changedBy: actor });
    await db.insert(corrections).values({ articleId: a.id, kind: 'retraction', note, version, createdBy: actor });
  }
  await db.update(stories).set({ state: 'RETRACTED', retractedAt: now, updatedAt: now, nextCheckAt: null }).where(eq(stories.id, storyId));
  await audit(db, { actor, action: 'story.retract', targetType: 'story', targetId: storyId, detail: { reason } });
}

async function markUnderReview(db: Db, storyId: number, now: Date) {
  const arts = await db.select().from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
  for (const a of arts) {
    const note = notesFor(a.language).underReview;
    const already = await db.select({ id: corrections.id }).from(corrections).where(and(eq(corrections.articleId, a.id), eq(corrections.note, note))).limit(1);
    if (already.length) continue;
    await db.update(articles).set({ isDeveloping: true, updatedAt: now }).where(eq(articles.id, a.id));
    await db.insert(corrections).values({ articleId: a.id, kind: 'clarification', note, version: a.version, createdBy: 'system' });
  }
}

export async function latestArticles(db: Db, storyIds: number[]) {
  if (!storyIds.length) return [];
  return db.select().from(articles).where(inArray(articles.storyId, storyIds)).orderBy(desc(articles.publishedAt));
}

export function editionMinhash(headline: string, summary: string): number[] {
  return minhash(`${headline} ${summary}`);
}
