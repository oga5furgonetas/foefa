/**
 * `sources:check --update`: pausa lo que falla, reactiva lo que pausó ella
 * misma cuando vuelve a funcionar y nunca pisa una decisión del panel.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/client';
import { sources } from '../../src/db/schema';
import { recordSourceCheck } from '../../src/services/sources';
import { done, freshDb } from './db';

let db: Db;

beforeAll(async () => {
  db = await freshDb();
}, 120_000);

afterAll(done);

const row = async (slug: string) => (await db.select().from(sources).where(eq(sources.slug, slug)))[0];
const setState = (slug: string, status: string, blockedReason: string | null) => db.update(sources).set({ status, blockedReason }).where(eq(sources.slug, slug));

describe('resultado de sources:check', () => {
  it('una fuente que falla queda en pausa con el motivo', async () => {
    await setState('bbc-world', 'active', null);
    await recordSourceCheck(db, 'bbc-world', { ok: false, error: 'HTTP 500', tdmReserved: false });
    const r = await row('bbc-world');
    expect(r.status).toBe('paused');
    expect(r.blockedReason).toBe('sources:check: HTTP 500');
  });

  it('si vuelve a funcionar, se reactiva la que pausó la comprobación', async () => {
    await recordSourceCheck(db, 'bbc-world', { ok: true, tdmReserved: false });
    const r = await row('bbc-world');
    expect(r.status).toBe('active');
    expect(r.blockedReason).toBeNull();
    expect(r.verifiedAt).toBeInstanceOf(Date);
  });

  it('una pausa del panel no se levanta aunque la fuente responda', async () => {
    await setState('npr', 'paused', 'Pausada por el editor');
    await recordSourceCheck(db, 'npr', { ok: true, tdmReserved: false });
    const r = await row('npr');
    expect(r.status).toBe('paused');
    expect(r.blockedReason).toBe('Pausada por el editor');
  });

  it('un bloqueo del panel no se convierte en pausa ni pierde su motivo si la fuente falla', async () => {
    await setState('spiegel', 'blocked', 'Condiciones de uso');
    await recordSourceCheck(db, 'spiegel', { ok: false, error: 'HTTP 403', tdmReserved: false });
    const r = await row('spiegel');
    expect(r.status).toBe('blocked');
    expect(r.blockedReason).toBe('Condiciones de uso');
  });

  it('marca cuándo robots.txt no deja leer', async () => {
    await setState('le-monde', 'active', null);
    await recordSourceCheck(db, 'le-monde', { ok: false, error: 'robots.txt no permite leer esta URL', tdmReserved: false });
    const r = await row('le-monde');
    expect(r.robotsAllowed).toBe(false);
    expect(r.status).toBe('paused');
  });
});
