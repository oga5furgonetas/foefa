/**
 * Operaciones del panel. Cada acción exige permiso (RBAC en domain.ts),
 * queda en audit_log y, si afecta a lo publicado, se versiona y se
 * explica en público. Ningún editor puede saltarse los controles: una
 * edición manual vuelve a pasar el validador y los controles de calidad.
 */
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { editorialSettingsSchema, sourceTypeWeightsSchema } from '../config/settings';
import type { Db } from '../db/client';
import {
  articles,
  articleVersions,
  categories,
  claims,
  contradictions,
  corrections,
  evidence,
  languages,
  pricePlans,
  qualityReports,
  rawItems,
  reports,
  reviewTasks,
  sourceReliability,
  sources,
  stories,
  storyItems,
  users,
  verifications,
  auditLog,
  fetchLog,
  pipelineRuns,
  jobs,
  aiUsage,
  outbox,
} from '../db/schema';
import { can, REPORT_KINDS, ROLES, SOURCE_TYPES, type Permission, type Role } from '../domain';
import { retractStory } from '../pipeline/publish';
import { ipHash } from '../security/crypto';
import { audit, openReviewTask } from './audit';
import { getEditorialSettings, setSetting } from './settings';

export class ForbiddenError extends Error {
  constructor(public permission: Permission) {
    super(`permiso requerido: ${permission}`);
  }
}

export function requirePermission(role: Role | null | undefined, p: Permission): void {
  if (!can(role, p)) throw new ForbiddenError(p);
}

export type Actor = { id: string; role: Role };
const actorId = (a: Actor) => `user:${a.id}`;

export async function listStories(db: Db, o: { state?: string; q?: string; flag?: string; demo?: boolean; limit?: number; offset?: number } = {}) {
  const conds = [];
  if (o.state) conds.push(eq(stories.state, o.state));
  if (o.q) conds.push(ilike(stories.headlineHint, `%${o.q}%`));
  if (o.flag) conds.push(sql`${o.flag} = ANY(${stories.flags})`);
  if (o.demo !== undefined) conds.push(eq(stories.isDemo, o.demo));
  return db
    .select({
      id: stories.id,
      slug: stories.slug,
      headline: stories.headlineHint,
      state: stories.state,
      confidence: stories.evidenceConfidence,
      momentum: stories.momentum,
      importance: stories.importance,
      flags: stories.flags,
      items: stories.itemCount,
      independent: stories.independentSourceCount,
      firstSeenAt: stories.firstSeenAt,
      lastItemAt: stories.lastItemAt,
      isDemo: stories.isDemo,
      categoryId: stories.categoryId,
      countryCode: stories.countryCode,
    })
    .from(stories)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(stories.lastItemAt))
    .limit(o.limit ?? 50)
    .offset(o.offset ?? 0);
}

/** Cadena de evidencia completa de una historia (para revisar el porqué de cada decisión). */
export async function storyDetail(db: Db, id: number) {
  const [s] = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  if (!s) return null;
  const items = await db
    .select({ id: rawItems.id, title: rawItems.title, url: rawItems.url, publishedAt: rawItems.publishedAt, language: rawItems.language, source: sources.name, sourceSlug: sources.slug, sourceType: sources.sourceType, independenceKey: storyItems.independenceKey, isCopy: storyItems.isCopy, attributedTo: rawItems.attributedTo })
    .from(storyItems)
    .innerJoin(rawItems, eq(rawItems.id, storyItems.itemId))
    .innerJoin(sources, eq(sources.id, rawItems.sourceId))
    .where(eq(storyItems.storyId, id))
    .orderBy(rawItems.publishedAt);
  const cl = await db.select().from(claims).where(eq(claims.storyId, id)).orderBy(claims.id);
  const ev = cl.length ? await db.select().from(evidence).where(inArray(evidence.claimId, cl.map((c) => c.id))) : [];
  const contra = await db.select().from(contradictions).where(eq(contradictions.storyId, id));
  const verifs = await db.select().from(verifications).where(eq(verifications.storyId, id)).orderBy(desc(verifications.runAt)).limit(20);
  const arts = await db.select().from(articles).where(eq(articles.storyId, id));
  const qrs = await db.select().from(qualityReports).where(eq(qualityReports.storyId, id)).orderBy(desc(qualityReports.createdAt)).limit(20);
  return { story: s, items, claims: cl.map((c) => ({ ...c, evidence: ev.filter((e) => e.claimId === c.id) })), contradictions: contra, verifications: verifs, articles: arts, qualityReports: qrs };
}

export async function blockStory(db: Db, actor: Actor, storyId: number, reason: string) {
  requirePermission(actor.role, 'stories.block');
  await db.update(stories).set({ state: 'BLOCKED', blockedReason: reason.slice(0, 500), updatedAt: new Date() }).where(eq(stories.id, storyId));
  // Si ya estaba publicada, no se oculta en silencio: se retira con nota.
  const published = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
  if (published.length) await retractStory(db, storyId, 'editor', new Date(), actorId(actor), reason);
  await audit(db, { actor: actorId(actor), action: 'story.block', targetType: 'story', targetId: storyId, detail: { reason } });
}

export async function unblockStory(db: Db, actor: Actor, storyId: number) {
  requirePermission(actor.role, 'stories.block');
  await db.update(stories).set({ state: 'INVESTIGATING', blockedReason: null, nextCheckAt: new Date(), updatedAt: new Date() }).where(and(eq(stories.id, storyId), eq(stories.state, 'BLOCKED')));
  await audit(db, { actor: actorId(actor), action: 'story.unblock', targetType: 'story', targetId: storyId });
}

export async function recheckStory(db: Db, actor: Actor, storyId: number) {
  requirePermission(actor.role, 'stories.edit');
  await db.update(stories).set({ nextCheckAt: new Date(), lockedByEditor: false }).where(eq(stories.id, storyId));
  await audit(db, { actor: actorId(actor), action: 'story.recheck', targetType: 'story', targetId: storyId });
}

export async function retractByEditor(db: Db, actor: Actor, storyId: number, note: string) {
  requirePermission(actor.role, 'articles.retract');
  if (note.trim().length < 20) throw new Error('La nota de retirada debe explicar el motivo (mínimo 20 caracteres).');
  await retractStory(db, storyId, 'editor', new Date(), actorId(actor), note.trim());
}

/**
 * Corrección pública: cambia titular/cuerpo, crea versión nueva y una nota
 * visible. El texto nuevo debe pasar los controles (se valida en la capa
 * web con la ficha de hechos antes de llamar aquí).
 */
export async function correctArticle(db: Db, actor: Actor, articleId: number, input: { headline?: string; paragraphs?: { index: number; text: string }[]; note: string; kind: 'correction' | 'clarification' | 'update' }) {
  requirePermission(actor.role, 'articles.correct');
  if (input.note.trim().length < 10) throw new Error('La nota pública es obligatoria (mínimo 10 caracteres).');
  const [a] = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) throw new Error('artículo no encontrado');
  const body = JSON.parse(JSON.stringify(a.body)) as typeof a.body;
  for (const p of input.paragraphs ?? []) {
    const b = body[p.index];
    if (b && (b.type === 'p' || b.type === 'h2')) b.text = p.text.trim();
  }
  const version = a.version + 1;
  const headline = input.headline?.trim() || a.headline;
  const bodyText = body.map((b) => ('text' in b ? b.text : b.type === 'list' ? b.items.map((i) => i.text).join('\n') : '')).join('\n');
  await db.update(articles).set({ headline, body, bodyText, version, updatedAt: new Date() }).where(eq(articles.id, articleId));
  await db.insert(articleVersions).values({ articleId, version, kind: input.kind, headline, body, verification: a.verification, changeSummary: input.note.trim(), changedBy: actorId(actor) });
  await db.insert(corrections).values({ articleId, kind: input.kind, note: input.note.trim(), version, createdBy: actorId(actor) });
  await audit(db, { actor: actorId(actor), action: `article.${input.kind}`, targetType: 'article', targetId: articleId, detail: { note: input.note } });
}

export async function listSources(db: Db, o: { q?: string; status?: string; demo?: boolean } = {}) {
  const conds = [];
  if (o.q) conds.push(or(ilike(sources.name, `%${o.q}%`), ilike(sources.slug, `%${o.q}%`)));
  if (o.status) conds.push(eq(sources.status, o.status));
  if (o.demo !== undefined) conds.push(eq(sources.isDemo, o.demo));
  return db
    .select({ s: sources, r: sourceReliability })
    .from(sources)
    .leftJoin(sourceReliability, eq(sourceReliability.sourceId, sources.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sources.name);
}

export async function setSourceStatus(db: Db, actor: Actor, sourceId: number, status: 'active' | 'paused' | 'blocked', reason?: string) {
  requirePermission(actor.role, status === 'blocked' ? 'sources.block' : 'sources.manage');
  await db.update(sources).set({ status, blockedReason: status === 'blocked' ? (reason ?? 'bloqueada por un editor') : null, nextFetchAt: status === 'active' ? new Date() : null, updatedAt: new Date() }).where(eq(sources.id, sourceId));
  await audit(db, { actor: actorId(actor), action: `source.${status}`, targetType: 'source', targetId: sourceId, detail: { reason } });
}

export async function updateSource(db: Db, actor: Actor, sourceId: number, patch: { sourceType?: string; ownershipGroup?: string | null; isSatire?: boolean; fetchIntervalMinutes?: number; feedUrl?: string | null }) {
  requirePermission(actor.role, 'sources.manage');
  if (patch.sourceType && !(SOURCE_TYPES as readonly string[]).includes(patch.sourceType)) throw new Error('tipo de fuente no válido');
  await db.update(sources).set({ ...patch, updatedAt: new Date() }).where(eq(sources.id, sourceId));
  await audit(db, { actor: actorId(actor), action: 'source.update', targetType: 'source', targetId: sourceId, detail: patch });
}

export async function updateEditorialSettings(db: Db, actor: Actor, patch: Record<string, unknown>) {
  requirePermission(actor.role, 'settings.manage');
  const merged = editorialSettingsSchema.parse({ ...(await getEditorialSettings(db)), ...patch });
  if (merged.developingMin >= merged.verifiedMin) throw new Error('El umbral "en desarrollo" debe ser menor que el de verificado.');
  await setSetting(db, 'editorial', merged, actorId(actor));
  return merged;
}

export async function updateSourceTypeWeights(db: Db, actor: Actor, weights: unknown) {
  requirePermission(actor.role, 'settings.manage');
  const parsed = sourceTypeWeightsSchema.parse(weights);
  // Las redes sociales y los anónimos nunca pueden ser "creíbles" por sí solos.
  for (const t of ['social_media', 'ugc', 'anonymous', 'unverifiable', 'aggregator']) if (parsed[t]?.credible) throw new Error(`${t} no puede marcarse como creíble`);
  await setSetting(db, 'source_type_weights', parsed, actorId(actor));
  return parsed;
}

export async function listPlans(db: Db) {
  return db.select().from(pricePlans).orderBy(pricePlans.market);
}

export async function updatePlan(db: Db, actor: Actor, planId: number, patch: { monthlyCents?: number; yearlyCents?: number; trialDays?: number; active?: boolean; currency?: string; countryCodes?: string[]; stripePriceMonthly?: string | null; stripePriceYearly?: string | null }) {
  requirePermission(actor.role, 'pricing.manage');
  for (const k of ['monthlyCents', 'yearlyCents'] as const) if (patch[k] != null && (patch[k]! < 50 || patch[k]! > 100_000_000)) throw new Error(`${k} fuera de rango`);
  if (patch.trialDays != null && (patch.trialDays < 0 || patch.trialDays > 60)) throw new Error('prueba entre 0 y 60 días');
  const [before] = await db.select().from(pricePlans).where(eq(pricePlans.id, planId)).limit(1);
  await db.update(pricePlans).set({ ...patch, updatedAt: new Date(), updatedBy: actorId(actor) }).where(eq(pricePlans.id, planId));
  await audit(db, { actor: actorId(actor), action: 'pricing.update', targetType: 'price_plan', targetId: planId, detail: { before, patch } });
}

export async function updateCategory(db: Db, actor: Actor, id: string, patch: { enabled?: boolean; sort?: number; keywords?: Record<string, string[]> }) {
  requirePermission(actor.role, 'categories.manage');
  await db.update(categories).set(patch).where(eq(categories.id, id));
  await audit(db, { actor: actorId(actor), action: 'category.update', targetType: 'category', targetId: id, detail: patch });
}

export async function setLanguageEnabled(db: Db, actor: Actor, code: string, enabled: boolean) {
  requirePermission(actor.role, 'languages.manage');
  await db.update(languages).set({ enabled }).where(eq(languages.code, code));
  await audit(db, { actor: actorId(actor), action: 'language.update', targetType: 'language', targetId: code, detail: { enabled } });
}

export async function setUserRole(db: Db, actor: Actor, userId: string, role: Role) {
  requirePermission(actor.role, 'users.manage');
  if (!(ROLES as readonly string[]).includes(role)) throw new Error('rol no válido');
  if (userId === actor.id && role !== 'admin') throw new Error('No puedes quitarte tu propio rol de administrador.');
  await db.update(users).set({ role }).where(eq(users.id, userId));
  await audit(db, { actor: actorId(actor), action: 'user.role', targetType: 'user', targetId: userId, detail: { role } });
}

export async function listUsers(db: Db, q?: string) {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, totpEnabled: users.totpEnabled, verified: users.emailVerifiedAt })
    .from(users)
    .where(q ? ilike(users.email, `%${q}%`) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);
}

export async function listReviewTasks(db: Db, status: string[] = ['open', 'in_progress']) {
  return db.select().from(reviewTasks).where(inArray(reviewTasks.status, status)).orderBy(desc(reviewTasks.priority), desc(reviewTasks.createdAt)).limit(200);
}

export async function resolveReviewTask(db: Db, actor: Actor, taskId: number, status: 'done' | 'dismissed' | 'in_progress', resolution?: string) {
  requirePermission(actor.role, 'reports.manage');
  const [t] = await db
    .update(reviewTasks)
    .set({ status, resolution: resolution ?? null, resolvedAt: status === 'in_progress' ? null : new Date(), assignedTo: actor.id })
    .where(eq(reviewTasks.id, taskId))
    .returning();
  if (t?.reportId && status !== 'in_progress') await db.update(reports).set({ status: status === 'done' ? 'resolved' : 'rejected', resolution: resolution ?? null, resolvedAt: new Date() }).where(eq(reports.id, t.reportId));
  await audit(db, { actor: actorId(actor), action: 'review_task.update', targetType: 'review_task', targetId: taskId, detail: { status, resolution } });
}

/** Denuncia pública → tarea de revisión con prioridad según el tipo. */
export async function submitReport(db: Db, input: { kind: string; articleId?: number | null; url?: string | null; description: string; name?: string | null; email?: string | null; ip?: string | null }) {
  if (!(REPORT_KINDS as readonly string[]).includes(input.kind)) throw new Error('tipo no válido');
  const description = input.description.trim().slice(0, 4000);
  if (description.length < 10) throw new Error('descripción demasiado corta');
  let articleId = input.articleId ?? null;
  if (!articleId && input.url) {
    const slug = input.url.split('?')[0].split('/').filter(Boolean).pop();
    if (slug) {
      const [a] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).limit(1);
      articleId = a?.id ?? null;
    }
  }
  const [r] = await db
    .insert(reports)
    .values({ kind: input.kind, articleId, url: input.url?.slice(0, 500) ?? null, description, reporterName: input.name?.slice(0, 120) || null, reporterEmail: input.email?.slice(0, 200) || null, ipHash: ipHash(input.ip) })
    .returning({ id: reports.id });
  const priority = { factual_error: 80, privacy: 85, copyright: 75, wrong_source: 70, incorrect_content: 70, other: 40 }[input.kind] ?? 50;
  const [art] = articleId ? await db.select({ storyId: articles.storyId, headline: articles.headline }).from(articles).where(eq(articles.id, articleId)).limit(1) : [];
  await openReviewTask(db, {
    kind: 'report',
    title: `Aviso de lector (${input.kind})${art ? `: ${art.headline.slice(0, 120)}` : ''}`,
    priority,
    reportId: r.id,
    articleId,
    storyId: art?.storyId ?? null,
    detail: { kind: input.kind, description: description.slice(0, 500), url: input.url },
    dedupeKey: `report:${r.id}`,
  });
  return r.id;
}

export async function opsOverview(db: Db) {
  const recentRuns = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(30);
  const failedJobs = await db.select().from(jobs).where(eq(jobs.status, 'failed')).orderBy(desc(jobs.finishedAt)).limit(20);
  const fetchErrors = await db
    .select({ source: sources.name, ts: fetchLog.ts, error: fetchLog.error, status: fetchLog.statusCode })
    .from(fetchLog)
    .innerJoin(sources, eq(sources.id, fetchLog.sourceId))
    .where(sql`${fetchLog.error} IS NOT NULL`)
    .orderBy(desc(fetchLog.ts))
    .limit(30);
  const ai = await db
    .select({ task: aiUsage.task, model: aiUsage.model, calls: sql<number>`count(*)`, usd: sql<number>`sum(${aiUsage.costUsd})`, errors: sql<number>`count(*) FILTER (WHERE NOT ${aiUsage.ok})` })
    .from(aiUsage)
    .where(sql`${aiUsage.ts} >= now() - interval '30 days'`)
    .groupBy(aiUsage.task, aiUsage.model);
  const mail = await db.select().from(outbox).orderBy(desc(outbox.createdAt)).limit(20);
  const auditRows = await db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(50);
  return { recentRuns, failedJobs, fetchErrors, ai, mail, audit: auditRows };
}
