/**
 * Acciones del panel: POST /api/v1/admin/{acción}. Cada una exige su
 * permiso (RBAC), 2FA si procede, IP autorizada y CSRF; todas quedan en la
 * auditoría (la registra la capa de servicios).
 */
import { z } from 'zod';
import { dashboardMetrics } from '@histor/core/analytics/index';
import { grantManualPremium } from '@histor/core/billing/index';
import { ROLES, SOURCE_TYPES, type Permission } from '@histor/core/domain';
import { createHeadlineExperiment, stopExperiment, validateHeadlineVariant } from '@histor/core/experiments/index';
import { enqueue } from '@histor/core/jobs/queue';
import {
  blockStory,
  correctArticle,
  ForbiddenError,
  recheckStory,
  resolveReviewTask,
  retractByEditor,
  setLanguageEnabled,
  setSourceStatus,
  setUserRole,
  unblockStory,
  updateCategory,
  updateEditorialSettings,
  updatePlan,
  updateSource,
  updateSourceTypeWeights,
  type Actor,
} from '@histor/core/services/admin';
import { audit } from '@histor/core/services/audit';
import { articles } from '@histor/core/db/schema';
import { eq } from 'drizzle-orm';
import { ApiError, assertCsrf, handler, json, parseBody, requirePermission } from '@/lib/api';
import { db } from '@/lib/server';
import type { NextRequest } from 'next/server';

type Ctx = { params: Promise<{ action: string }> };
type Def = { perm: Permission; schema: z.ZodTypeAny; run: (actor: Actor, body: never) => Promise<unknown> };

const id = z.number().int().positive();
const def = <S extends z.ZodTypeAny>(perm: Permission, schema: S, run: (actor: Actor, body: z.infer<S>) => Promise<unknown>): Def => ({ perm, schema, run: run as Def['run'] });

const ACTIONS: Record<string, Def> = {
  'story.recheck': def('stories.edit', z.object({ id }), (a, b) => recheckStory(db(), a, b.id)),
  'story.block': def('stories.block', z.object({ id, reason: z.string().min(5).max(500) }), (a, b) => blockStory(db(), a, b.id, b.reason)),
  'story.unblock': def('stories.block', z.object({ id }), (a, b) => unblockStory(db(), a, b.id)),
  'story.retract': def('articles.retract', z.object({ id, note: z.string().min(20).max(1000) }), (a, b) => retractByEditor(db(), a, b.id, b.note)),
  'article.correct': def(
    'articles.correct',
    z.object({ id, kind: z.enum(['correction', 'clarification', 'update']), headline: z.string().max(200).optional(), paragraphs: z.array(z.object({ index: z.number().int().min(0), text: z.string().min(1).max(3000) })).max(40).optional(), note: z.string().min(10).max(1000) }),
    async (a, b) => {
      const [art] = await db().select().from(articles).where(eq(articles.id, b.id)).limit(1);
      if (!art) throw new ApiError(404, 'not_found');
      // Un titular corregido pasa los mismos controles anti-sensacionalismo que uno automático.
      if (b.headline && b.headline.trim() !== art.headline) {
        const problems = validateHeadlineVariant(b.headline.trim(), { headline: art.headline, bodyText: `${art.bodyText} ${(b.paragraphs ?? []).map((p) => p.text).join(' ')}` });
        if (problems.length) throw new ApiError(400, `headline: ${problems.join('; ')}`);
      }
      await correctArticle(db(), a, b.id, { headline: b.headline, paragraphs: b.paragraphs, note: b.note, kind: b.kind });
    },
  ),
  'source.status': def('sources.block', z.object({ id, status: z.enum(['active', 'paused', 'blocked']), reason: z.string().max(300).optional() }), (a, b) => setSourceStatus(db(), a, b.id, b.status, b.reason)),
  'source.update': def(
    'sources.manage',
    z.object({ id, sourceType: z.enum(SOURCE_TYPES).optional(), ownershipGroup: z.string().max(80).optional(), isSatire: z.boolean().optional(), fetchIntervalMinutes: z.number().int().min(5).max(1440).optional() }),
    (a, b) => updateSource(db(), a, b.id, { sourceType: b.sourceType, ownershipGroup: b.ownershipGroup === undefined ? undefined : b.ownershipGroup || null, isSatire: b.isSatire, fetchIntervalMinutes: b.fetchIntervalMinutes }),
  ),
  'settings.editorial': def('settings.manage', z.record(z.string(), z.unknown()), (a, b) => {
    const patch = { ...b };
    if (typeof patch.publishLanguages === 'string') patch.publishLanguages = patch.publishLanguages.split(',').map((s) => s.trim()).filter(Boolean);
    return updateEditorialSettings(db(), a, patch);
  }),
  'settings.weights': def('settings.manage', z.object({ weights: z.record(z.string(), z.unknown()) }), (a, b) => updateSourceTypeWeights(db(), a, b.weights)),
  'plan.update': def(
    'pricing.manage',
    z.object({ id, monthlyCents: z.number().int().optional(), yearlyCents: z.number().int().optional(), trialDays: z.number().int().optional(), active: z.boolean().optional(), stripePriceMonthly: z.string().max(100).optional(), stripePriceYearly: z.string().max(100).optional() }),
    (a, b) => updatePlan(db(), a, b.id, { monthlyCents: b.monthlyCents, yearlyCents: b.yearlyCents, trialDays: b.trialDays, active: b.active, stripePriceMonthly: b.stripePriceMonthly === undefined ? undefined : b.stripePriceMonthly || null, stripePriceYearly: b.stripePriceYearly === undefined ? undefined : b.stripePriceYearly || null }),
  ),
  'category.update': def('categories.manage', z.object({ id: z.string().max(40), enabled: z.boolean().optional(), sort: z.number().int().min(0).max(1000).optional(), keywords: z.record(z.string(), z.array(z.string().max(60)).max(200)).optional() }), (a, b) => updateCategory(db(), a, b.id, { enabled: b.enabled, sort: b.sort, keywords: b.keywords })),
  'language.enabled': def('languages.manage', z.object({ code: z.string().max(5), enabled: z.boolean() }), (a, b) => setLanguageEnabled(db(), a, b.code, b.enabled)),
  'user.role': def('users.manage', z.object({ id: z.string().uuid(), role: z.enum(ROLES) }), (a, b) => setUserRole(db(), a, b.id, b.role)),
  'user.premium': def('users.manage', z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(3650) }), (a, b) => grantManualPremium(db(), b.id, b.days, `user:${a.id}`)),
  'task.resolve': def('reports.manage', z.object({ id, status: z.enum(['done', 'dismissed', 'in_progress']), resolution: z.string().max(1000).optional() }), (a, b) => resolveReviewTask(db(), a, b.id, b.status, b.resolution || undefined)),
  'experiment.create': def('experiments.manage', z.object({ articleId: id, headlines: z.union([z.string(), z.array(z.string())]) }), async (a, b) => {
    const list = (Array.isArray(b.headlines) ? b.headlines : b.headlines.split('\n')).map((h) => h.trim()).filter(Boolean).slice(0, 3);
    if (!list.length) throw new ApiError(400, 'headlines_required');
    const r = await createHeadlineExperiment(db(), b.articleId, list, `user:${a.id}`);
    if (!r.ok) throw new ApiError(400, Object.entries(r.problems).map(([h, p]) => `«${h}»: ${p.join(', ')}`).join(' | '));
    return { message: `Experimento #${r.id} creado` };
  }),
  'experiment.stop': def('experiments.manage', z.object({ id, winner: z.string().max(20).optional() }), (a, b) => stopExperiment(db(), a, b.id, b.winner ?? null)),
  'pipeline.run': def('settings.manage', z.object({}), async (a) => {
    await enqueue(db(), 'pipeline:tick', { manual: true }, { uniqueKey: 'pipeline:tick:manual' });
    await audit(db(), { actor: `user:${a.id}`, action: 'pipeline.run', targetType: 'pipeline' });
    return { message: 'En cola: el worker la ejecutará en segundos.' };
  }),
  'newsletters.send': def('newsletters.manage', z.object({}), async (a) => {
    await enqueue(db(), 'newsletters:send', { manual: true }, { uniqueKey: 'newsletters:send:manual' });
    await audit(db(), { actor: `user:${a.id}`, action: 'newsletters.send', targetType: 'newsletter' });
    return { message: 'En cola.' };
  }),
};

export const POST = handler<Ctx>(async (req: NextRequest, ctx) => {
  assertCsrf(req);
  const { action } = await ctx.params;
  const d = ACTIONS[action];
  if (!d) throw new ApiError(404, 'unknown_action');
  const user = await requirePermission(req, d.perm);
  const body = await parseBody(req, d.schema);
  try {
    const out = await d.run({ id: user.id, role: user.role }, body as never);
    const message = out && typeof out === 'object' && 'message' in out ? String((out as { message: unknown }).message) : undefined;
    return json({ ok: true, message });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof ForbiddenError) throw new ApiError(403, 'forbidden');
    if (e instanceof z.ZodError) throw new ApiError(400, e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    // Errores de validación de negocio (mensajes pensados para el editor).
    if (e instanceof Error && e.message.length < 300) throw new ApiError(400, e.message);
    throw e;
  }
});

/** GET /api/v1/admin/metrics?hours=24 → métricas del panel en JSON. */
export const GET = handler<Ctx>(async (req, ctx) => {
  const { action } = await ctx.params;
  if (action !== 'metrics') throw new ApiError(404, 'unknown_action');
  await requirePermission(req, 'admin.view');
  const hours = Math.min(24 * 90, Math.max(1, Number(req.nextUrl.searchParams.get('hours')) || 24));
  return json(await dashboardMetrics(db(), { hours }));
});
