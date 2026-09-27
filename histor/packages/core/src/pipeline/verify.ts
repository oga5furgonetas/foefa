/**
 * VERIFY + SCORE (capa de datos). Carga la historia, ejecuta el motor puro
 * (verification/engine.ts), guarda afirmaciones, evidencias,
 * contradicciones y el acta de la pasada, mueve el estado y agenda la
 * siguiente comprobación. Aprende la fiabilidad de las fuentes cuando una
 * historia se confirma o se retira.
 */
import { and, desc, eq, gte, inArray, lte, notInArray, or, sql } from 'drizzle-orm';
import type { EditorialSettings } from '../config/settings';
import type { Db } from '../db/client';
import {
  analyticsEvents,
  articles,
  claims as claimsT,
  contradictions as contradictionsT,
  events,
  evidence as evidenceT,
  imageFingerprints,
  rawItems,
  sourceReliability,
  stories,
  storyItems,
  verifications,
} from '../db/schema';
import { STORY_TRANSITIONS, type StoryState } from '../domain';
import { openReviewTask } from '../services/audit';
import { getSourceTypeWeights } from '../services/settings';
import { analyseStory } from '../verification/engine';
import { importanceScore } from '../verification/momentum';
import type { StoryAnalysis } from '../verification/types';
import { loadSources, loadStoryItems } from './loaders';

export type VerifyOutcome = { storyId: number; decision: StoryAnalysis['decision']; state: StoryState; confidence: number; momentum: number };

/** Todo lo que la etapa de publicación necesita de la verificación (sin recalcular). */
export type VerifiedStory = {
  outcome: VerifyOutcome;
  story: typeof stories.$inferSelect;
  analysis: StoryAnalysis;
  keyToId: Map<string, number>;
  items: Awaited<ReturnType<typeof loadStoryItems>>['items'];
  sources: Awaited<ReturnType<typeof loadSources>>;
};

/** Camino más corto de estados permitido (para no saltarse la máquina de estados). */
export function statePath(from: StoryState, to: StoryState): StoryState[] | null {
  if (from === to) return [from];
  const queue: StoryState[][] = [[from]];
  const seen = new Set<StoryState>([from]);
  while (queue.length) {
    const path = queue.shift()!;
    for (const next of STORY_TRANSITIONS[path[path.length - 1]]) {
      if (seen.has(next)) continue;
      const p = [...path, next];
      if (next === to) return p;
      seen.add(next);
      queue.push(p);
    }
  }
  return null;
}

export function nextCheckDelayMinutes(state: StoryState, ageHours: number): number | null {
  if (['RETRACTED', 'BLOCKED'].includes(state)) return null;
  if (state === 'REJECTED') return ageHours < 48 ? 120 : null;
  if (state === 'PUBLISHED' || state === 'UPDATED') {
    if (ageHours < 6) return 30;
    if (ageHours < 48) return 120;
    if (ageHours < 168) return 720;
    return null; // historia cerrada; se reabre si llegan piezas nuevas
  }
  return ageHours < 6 ? 10 : 30;
}

export async function verifyDueStories(db: Db, settings: EditorialSettings, opts: { limit?: number; now?: Date; storyIds?: number[] } = {}): Promise<VerifiedStory[]> {
  const now = opts.now ?? new Date();
  const due = await db
    .select()
    .from(stories)
    .where(
      opts.storyIds?.length
        ? inArray(stories.id, opts.storyIds)
        : and(lte(stories.nextCheckAt, now), notInArray(stories.state, ['RETRACTED', 'BLOCKED'])),
    )
    .orderBy(stories.nextCheckAt)
    .limit(opts.limit ?? 50);
  const out: VerifiedStory[] = [];
  for (const st of due) out.push(await verifyStory(db, st, settings, now));
  return out;
}

export async function verifyStory(db: Db, st: typeof stories.$inferSelect, settings: EditorialSettings, now: Date): Promise<VerifiedStory> {
  const { items, rows } = await loadStoryItems(db, st.id);
  const sources = await loadSources(db, [...new Set(items.map((i) => i.sourceId))]);
  const weights = await getSourceTypeWeights(db);

  // Huellas de imagen previas (mismo "cubo" de 4 hex para acotar la búsqueda).
  const phashes = items.map((i) => i.imagePhash).filter((x): x is string => !!x);
  const prior = phashes.length
    ? (
        await db
          .select()
          .from(imageFingerprints)
          .where(or(...phashes.map((p) => sql`substring(${imageFingerprints.phash}, 1, 4) = ${p.slice(0, 4)}`)))
          .limit(500)
      ).map((f) => ({ phash: f.phash, firstSeenAt: f.firstSeenAt, url: f.url }))
    : [];

  // Señales de lectores (solo para el momentum).
  const views = await db
    .select({ n: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.storyId, st.id), eq(analyticsEvents.type, 'page_view'), gte(analyticsEvents.ts, new Date(now.getTime() - 3600000))));
  const published = await db.select({ id: articles.id, conf: articles.evidenceConfidence }).from(articles).where(and(eq(articles.storyId, st.id), eq(articles.status, 'published'))).limit(1);

  const analysis = analyseStory({
    items,
    sources,
    state: st.state as StoryState,
    now,
    settings,
    weights,
    firstSeenAt: st.firstSeenAt,
    lockedByEditor: st.lockedByEditor,
    published: published.length > 0,
    publishedConfidence: published[0]?.conf ?? null,
    priorImageFingerprints: prior.filter((p) => !rows.some((r) => r.imageUrl === p.url)),
    readerSignals: { pageViewsLastHour: Number(views[0]?.n ?? 0), searchesLastHour: 0 },
  });

  const target = analysis.nextState;
  const path = statePath(st.state as StoryState, target);
  const finalState = path ? target : (st.state as StoryState);
  const reasons = path ? analysis.reasons : [...analysis.reasons, `transición ${st.state} → ${target} no permitida; se mantiene`];
  const ageHours = (now.getTime() - st.firstSeenAt.getTime()) / 3600000;
  const delay = nextCheckDelayMinutes(finalState, ageHours);
  const importance = importanceScore(analysis.momentum, analysis.confidence);

  const keyToId = new Map<string, number>();
  await db.transaction(async (tx) => {
    await tx.delete(claimsT).where(eq(claimsT.storyId, st.id));
    const statusOf = new Map(analysis.assessments.map((a) => [a.claimKey, a]));
    for (const c of analysis.claims) {
      const a = statusOf.get(c.key)!;
      const [row] = await tx
        .insert(claimsT)
        .values({
          storyId: st.id,
          itemId: c.itemId,
          language: c.language,
          text: c.text,
          kind: c.kind,
          modality: c.modality,
          attributedTo: c.attributedTo,
          entities: c.entities,
          numbers: c.numbers.map((n) => ({ value: n.value, unit: n.unit, raw: n.raw })),
          dates: c.dates.map((d) => ({ iso: d.iso, raw: d.raw })),
          places: c.places,
          quote: c.quote,
          status: a.status,
          supportScore: a.supportScore,
          independentSupport: a.supportingGroups.length,
        })
        .returning({ id: claimsT.id });
      keyToId.set(c.key, row.id);
    }
    const evRows = analysis.evidence
      .filter((e) => keyToId.has(e.claimKey))
      .map((e) => ({
        claimId: keyToId.get(e.claimKey)!,
        itemId: e.itemId,
        sourceId: e.sourceId,
        relation: e.relation,
        matchScore: e.score,
        excerpt: e.excerpt,
        matched: e.matched,
        independenceKey: e.independenceKey,
        isPrimary: e.isPrimary,
      }));
    for (let i = 0; i < evRows.length; i += 200) await tx.insert(evidenceT).values(evRows.slice(i, i + 200));
    await tx.delete(contradictionsT).where(and(eq(contradictionsT.storyId, st.id), eq(contradictionsT.resolved, false)));
    if (analysis.contradictions.length) {
      await tx.insert(contradictionsT).values(
        analysis.contradictions.map((c) => ({
          storyId: st.id,
          field: c.field,
          severity: c.severity,
          detail: { ...c.detail, claimIds: c.claimKeys.map((k) => keyToId.get(k)) },
        })),
      );
    }
    for (const [itemId, g] of Object.entries(analysis.itemGroup)) {
      await tx.update(storyItems).set({ independenceKey: g.key, isCopy: g.isCopy }).where(and(eq(storyItems.storyId, st.id), eq(storyItems.itemId, Number(itemId))));
      if (g.copyOf) await tx.update(rawItems).set({ copyOfItemId: g.copyOf }).where(eq(rawItems.id, Number(itemId)));
    }
    await tx.insert(verifications).values({
      storyId: st.id,
      stateBefore: st.state,
      stateAfter: finalState,
      evidenceConfidence: analysis.confidence,
      momentum: analysis.momentum,
      decision: analysis.decision,
      reasons,
      breakdown: { confidence: analysis.confidenceBreakdown, momentum: analysis.momentumBreakdown, flags: analysis.flags, path, probableOriginalItemId: analysis.probableOriginalItemId },
      thresholds: settings as unknown as Record<string, unknown>,
    });
    await tx
      .update(stories)
      .set({
        state: finalState,
        evidenceConfidence: analysis.confidence,
        momentum: analysis.momentum,
        importance,
        confidenceBreakdown: analysis.confidenceBreakdown as unknown as Record<string, unknown>,
        momentumBreakdown: analysis.momentumBreakdown as unknown as Record<string, unknown>,
        flags: analysis.flags,
        independentSourceCount: analysis.confidenceBreakdown.independentCredible,
        itemCount: items.length,
        isBreaking: analysis.isBreaking,
        isDeveloping: analysis.decision === 'publish_developing' || (st.isDeveloping && finalState !== 'VERIFIED' && analysis.decision !== 'publish'),
        eventTime: analysis.eventTime,
        countryCode: analysis.primaryPlace?.countryCode ?? st.countryCode,
        nextCheckAt: delay == null ? null : new Date(now.getTime() + delay * 60000),
        updatedAt: now,
        retractedAt: finalState === 'RETRACTED' ? now : st.retractedAt,
      })
      .where(eq(stories.id, st.id));
  });

  // Acontecimientos estructurados (p. ej. terremotos del USGS).
  for (const it of items) {
    if (it.structured?.type === 'earthquake') {
      const exists = await db.select({ id: events.id }).from(events).where(and(eq(events.storyId, st.id), eq(events.sourceItemId, it.id))).limit(1);
      if (!exists.length) {
        await db.insert(events).values({
          storyId: st.id,
          type: 'earthquake',
          occurredAt: new Date(String(it.structured.time)),
          place: String(it.structured.place ?? ''),
          lat: Number(it.structured.lat),
          lon: Number(it.structured.lon),
          data: it.structured,
          sourceItemId: it.id,
        });
      }
    }
  }

  // Aprendizaje de fiabilidad al confirmar o retirar.
  if (finalState !== st.state && (finalState === 'VERIFIED' || finalState === 'RETRACTED')) {
    await learnReliability(db, analysis, finalState === 'VERIFIED' ? 'confirmed' : 'retracted');
  }

  // Tareas de revisión.
  const review = analysis.reasons.find((r) => r.startsWith('revisión: '));
  if (review) {
    await openReviewTask(db, {
      kind: analysis.flags.includes('viral_unverified') ? 'viral_unverified' : analysis.decision === 'retract' ? 'retraction' : analysis.decision === 'review' ? 'confidence_drop' : 'editorial_review',
      title: `${st.headlineHint.slice(0, 140)} — ${review.slice('revisión: '.length)}`,
      storyId: st.id,
      priority: analysis.decision === 'retract' || analysis.decision === 'review' ? 90 : 60,
      detail: { reasons: analysis.reasons, flags: analysis.flags, confidence: analysis.confidence, momentum: analysis.momentum },
      dedupeKey: `story:${st.id}:${analysis.decision}`,
    });
  }
  const outcome = { storyId: st.id, decision: analysis.decision, state: finalState, confidence: analysis.confidence, momentum: analysis.momentum };
  return { outcome, story: { ...st, state: finalState, evidenceConfidence: analysis.confidence, momentum: analysis.momentum, importance, flags: analysis.flags }, analysis, keyToId, items, sources };
}

async function learnReliability(db: Db, analysis: StoryAnalysis, outcome: 'confirmed' | 'retracted') {
  const supportByGroup = new Map<string, number>();
  for (const a of analysis.assessments) {
    const c = analysis.claims.find((x) => x.key === a.claimKey);
    if (!c || !(c.isHeadline || c.kind === 'fact' || c.kind === 'number')) continue;
    for (const g of a.supportingGroups) supportByGroup.set(g, (supportByGroup.get(g) ?? 0) + 1);
  }
  for (const g of analysis.groups) {
    const supported = supportByGroup.has(g.key);
    for (const sourceId of g.sourceIds) {
      const isCopy = Object.values(analysis.itemGroup).some((x) => x.key === g.key && x.isCopy);
      if (outcome === 'confirmed' && supported) {
        await db
          .update(sourceReliability)
          .set({ alpha: sql`${sourceReliability.alpha} + 1`, confirmedCount: sql`${sourceReliability.confirmedCount} + 1`, originalCount: isCopy ? sql`${sourceReliability.originalCount}` : sql`${sourceReliability.originalCount} + 1`, copyCount: isCopy ? sql`${sourceReliability.copyCount} + 1` : sql`${sourceReliability.copyCount}`, updatedAt: new Date() })
          .where(eq(sourceReliability.sourceId, sourceId));
      } else if (outcome === 'retracted' && supported) {
        await db
          .update(sourceReliability)
          .set({ beta: sql`${sourceReliability.beta} + 2`, contradictedCount: sql`${sourceReliability.contradictedCount} + 1`, updatedAt: new Date() })
          .where(eq(sourceReliability.sourceId, sourceId));
      }
    }
  }
}

export async function lastVerification(db: Db, storyId: number) {
  const rows = await db.select().from(verifications).where(eq(verifications.storyId, storyId)).orderBy(desc(verifications.runAt)).limit(1);
  return rows[0] ?? null;
}
