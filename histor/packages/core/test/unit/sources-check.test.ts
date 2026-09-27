/**
 * Veredicto de `sources:check`, con los casos reales del 27-09-2026.
 */
import { describe, expect, it } from 'vitest';
import { evaluateSourceCheck } from '../../src/services/sources';

const now = new Date('2026-09-27T12:00:00Z');
const at = (iso: string) => ({ publishedAt: new Date(iso) });

describe('sources:check', () => {
  it('la pieza más nueva se elige por fecha, no por texto (antes ganaba el miércoles)', () => {
    const r = evaluateSourceCheck('rss', { items: [at('2026-09-23T21:29:00Z'), at('2026-09-27T11:14:00Z'), at('2026-09-26T08:00:00Z')] }, now);
    expect(r.ok).toBe(true);
    expect(r.newest?.toISOString()).toBe('2026-09-27T11:14:00.000Z');
  });

  it('un feed abandonado falla aunque responda con piezas (WHO: última de febrero)', () => {
    const r = evaluateSourceCheck('rss', { items: [at('2026-02-25T18:06:55Z'), at('2026-01-24T20:09:49Z')] }, now);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('sin piezas nuevas desde 2026-02-25');
  });

  it('un feed vacío falla, salvo el de sucesos (un día sin terremotos no es un error)', () => {
    expect(evaluateSourceCheck('rss', { items: [] }, now)).toMatchObject({ ok: false, error: 'sin piezas' });
    expect(evaluateSourceCheck('geojson', { items: [] }, now)).toMatchObject({ ok: true, error: null });
  });

  it('un error de red o de robots.txt manda sobre todo lo demás', () => {
    expect(evaluateSourceCheck('rss', { error: 'robots.txt no permite leer esta URL', items: [] }, now)).toMatchObject({ ok: false, error: 'robots.txt no permite leer esta URL' });
  });

  it('piezas sin fecha no cuentan como abandonadas', () => {
    expect(evaluateSourceCheck('rss', { items: [{ publishedAt: null }] }, now)).toMatchObject({ ok: true, newest: null });
  });
});
