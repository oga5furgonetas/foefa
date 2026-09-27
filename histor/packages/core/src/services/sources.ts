import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sources } from '../db/schema';

const CHECK_PREFIX = 'sources:check:';

/** Un feed cuya pieza más nueva tiene más de esto está abandonado (WHO dejó el suyo en febrero de 2026). */
export const SOURCE_STALE_DAYS = 30;

/**
 * Veredicto de `sources:check` para una fuente: responde, tiene piezas y no
 * está abandonada. Un feed de sucesos (GeoJSON de terremotos) puede venir
 * vacío un día tranquilo sin estar roto.
 */
export function evaluateSourceCheck(
  connector: string,
  r: { error?: string | null; items: { publishedAt: Date | null }[] },
  now = new Date(),
): { ok: boolean; error: string | null; newest: Date | null } {
  // Por instante, no como texto: ordenar Date como cadenas pone «Wed …» por delante de «Sat …».
  const times = r.items.map((i) => i.publishedAt?.getTime() ?? NaN).filter((t) => Number.isFinite(t));
  const newest = times.length ? new Date(Math.max(...times)) : null;
  if (r.error) return { ok: false, error: r.error, newest };
  if (!r.items.length) return connector === 'geojson' ? { ok: true, error: null, newest } : { ok: false, error: 'sin piezas', newest };
  if (newest && now.getTime() - newest.getTime() > SOURCE_STALE_DAYS * 86_400_000) {
    return { ok: false, error: `sin piezas nuevas desde ${newest.toISOString().slice(0, 10)}`, newest };
  }
  return { ok: true, error: null, newest };
}

/**
 * Guarda el resultado de `sources:check --update` para una fuente.
 * - Si falla, queda en pausa con el motivo (salvo que ya estuviera en pausa o
 *   bloqueada desde el panel: esa decisión y su motivo no se pisan).
 * - Si funciona, solo se reactiva la que pausó una comprobación anterior.
 */
export async function recordSourceCheck(db: Db, slug: string, r: { ok: boolean; error?: string | null; tdmReserved: boolean }): Promise<void> {
  const pausedByCheck = sql`(${sources.status} = 'paused' and coalesce(${sources.blockedReason}, '') like ${CHECK_PREFIX + '%'})`;
  const manual = sql`(${sources.status} in ('paused', 'blocked') and coalesce(${sources.blockedReason}, '') not like ${CHECK_PREFIX + '%'})`;
  const reason = `${CHECK_PREFIX} ${r.error ?? 'sin piezas'}`.slice(0, 300);
  await db
    .update(sources)
    .set({
      robotsAllowed: !(r.error ?? '').includes('robots'),
      tdmReserved: r.tdmReserved,
      verifiedAt: r.ok ? new Date() : undefined,
      status: r.ok
        ? sql`case when ${pausedByCheck} then 'active' else ${sources.status} end`
        : sql`case when ${manual} then ${sources.status} else 'paused' end`,
      blockedReason: r.ok
        ? sql`case when ${pausedByCheck} then null else ${sources.blockedReason} end`
        : sql`case when ${manual} then ${sources.blockedReason} else ${reason} end`,
      updatedAt: new Date(),
    })
    .where(eq(sources.slug, slug));
}
