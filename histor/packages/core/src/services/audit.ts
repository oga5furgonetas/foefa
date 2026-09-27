import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { auditLog, reviewTasks } from '../db/schema';

export async function audit(
  db: Db,
  e: { actor: string; action: string; targetType: string; targetId?: string | number | null; detail?: Record<string, unknown>; ipHash?: string | null },
): Promise<void> {
  await db.insert(auditLog).values({
    actor: e.actor,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId == null ? null : String(e.targetId),
    detail: e.detail ?? {},
    ipHash: e.ipHash ?? null,
  });
}

/**
 * Crea una tarea de revisión si no hay ya una abierta con la misma clave
 * (evita inundar el panel con la misma alerta cada 15 minutos).
 */
export async function openReviewTask(
  db: Db,
  t: {
    kind: string;
    title: string;
    priority?: number;
    detail?: Record<string, unknown>;
    storyId?: number | null;
    articleId?: number | null;
    reportId?: number | null;
    sourceId?: number | null;
    dedupeKey?: string | null;
  },
): Promise<number | null> {
  const rows = await db
    .insert(reviewTasks)
    .values({
      kind: t.kind,
      title: t.title.slice(0, 300),
      priority: t.priority ?? 50,
      detail: t.detail ?? {},
      storyId: t.storyId ?? null,
      articleId: t.articleId ?? null,
      reportId: t.reportId ?? null,
      sourceId: t.sourceId ?? null,
      dedupeKey: t.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: reviewTasks.dedupeKey, where: sql`status in ('open','in_progress')` })
    .returning({ id: reviewTasks.id });
  return rows[0]?.id ?? null;
}
