/**
 * Pipeline completo contra PostgreSQL: ingesta de los feeds DEMO →
 * normalización → agrupación → verificación → redacción → controles →
 * publicación → actualización. Comprueba que cada escenario acaba donde debe.
 */
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/client';
import { articles, articleVersions, contradictions, corrections, qualityReports, rawItems, sources, stories, verifications } from '../../src/db/schema';
import { maintenance } from '../../src/pipeline/run';
import { purgeDemo, seedDemo } from '../../src/demo/seed';
import { done, freshDb } from './db';

let db: Db;
const NOW = new Date('2026-09-27T12:00:00Z');

async function storyByHint(fragment: string) {
  const all = await db.select().from(stories);
  return all.find((s) => s.headlineHint.includes(fragment));
}

async function articlesOf(storyId: number) {
  return db.select().from(articles).where(eq(articles.storyId, storyId));
}

beforeAll(async () => {
  db = await freshDb();
  await seedDemo(db, { now: NOW, phase: 1 });
}, 120_000);

afterAll(done);

describe('pipeline DEMO de extremo a extremo', () => {
  it('ingiere todas las fuentes DEMO', async () => {
    const demo = await db.select().from(sources).where(eq(sources.isDemo, true));
    expect(demo.length).toBeGreaterThan(15);
    expect(demo.every((s) => s.lastSuccessAt)).toBe(true);
  });

  it('historia con varias fuentes independientes (y una en otro idioma agrupada con ellas): publicada y verificada', async () => {
    const s = (await storyByHint('Feria Demo'))!;
    expect(s).toBeDefined();
    expect(['PUBLISHED', 'UPDATED']).toContain(s.state);
    expect(s.isDemo).toBe(true);
    // La pieza en inglés de otra agencia se agrupa con la historia española (cifras + lugar).
    expect(s.languages).toEqual(expect.arrayContaining(['es', 'en']));
    const arts = await articlesOf(s.id);
    const langs = arts.map((a) => a.language).sort();
    expect(langs).toContain('es');
    // En inglés solo hay UNA fuente: la ficha determinista copiaría demasiado → el control legal la frena.
    const qr = await db.select().from(qualityReports).where(and(eq(qualityReports.storyId, s.id), eq(qualityReports.language, 'en')));
    if (!langs.includes('en')) expect(qr.some((r) => !r.passed && r.checks.some((c) => c.name === 'LEGAL_CHECK' && !c.passed))).toBe(true);
    const es = arts.find((a) => a.language === 'es')!;
    expect(es.isDeveloping).toBe(false);
    expect(es.isDemo).toBe(true);
    expect(es.sourcesList.length).toBeGreaterThanOrEqual(3);
    expect(es.verification.method).toMatch(/fuentes independientes/);
    const versions = await db.select().from(articleVersions).where(eq(articleVersions.articleId, es.id));
    expect(versions[0].kind).toBe('publish');
  });

  it('fuente única (con una copia en un blog): no se publica, espera a otra fuente independiente', async () => {
    const s = (await storyByHint('autobús en Vigo'))!;
    expect(s).toBeDefined();
    expect(['UNVERIFIED', 'INVESTIGATING', 'HELD']).toContain(s.state);
    expect(await articlesOf(s.id)).toHaveLength(0);
  });

  it('sátira: rechazada, sin artículo', async () => {
    const s = (await storyByHint('prohibirá los lunes'))!;
    expect(s.state).toBe('REJECTED');
    expect(await articlesOf(s.id)).toHaveLength(0);
  });

  it('rumor viral en redes: retenido, sin artículo y con tarea de vigilancia', async () => {
    const s = (await storyByHint('Metro Demo'))!;
    expect(['HELD', 'UNVERIFIED', 'INVESTIGATING']).toContain(s.state);
    expect(s.flags).toContain('social_only');
    expect(await articlesOf(s.id)).toHaveLength(0);
  });

  it('noticia antigua que vuelve a circular: rechazada', async () => {
    const s = (await storyByHint('Demo Airport'))!;
    expect(s.state).toBe('REJECTED');
    expect(s.flags).toContain('old_resurfaced');
    expect(await articlesOf(s.id)).toHaveLength(0);
  });

  it('decisión de una fuente primaria oficial, recogida por un medio independiente: publicada', async () => {
    const s = (await storyByHint('bibliotecas públicas'))!;
    expect(['PUBLISHED', 'UPDATED']).toContain(s.state);
  });

  it('terremoto de fuente sísmica oficial (y una agencia): publicado con plantilla en los 6 idiomas', async () => {
    const s = (await storyByHint('Demo Point'))!;
    const arts = await articlesOf(s.id);
    expect(arts.map((a) => a.language).sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt']);
    expect(arts.find((a) => a.language === 'es')!.headline).toMatch(/Terremoto de magnitud 5,6/);
    expect(arts.find((a) => a.language === 'de')!.headline).toMatch(/Erdbeben der Stärke 5,6/);
  });

  it('cada idioma tiene su historia local (EE. UU., Alemania, Francia, Reino Unido, Italia, Brasil)', async () => {
    for (const [hint, lang] of [
      ['Chicago Demo', 'en'],
      ['Demo-Stadtwerke', 'de'],
      ['Bibliothèque Démo', 'fr'],
      ['London libraries', 'en'],
      ['Museo Demo', 'it'],
      ['Prefeitura Demo', 'pt'],
    ] as const) {
      const s = await storyByHint(hint);
      expect(s, hint).toBeDefined();
      const arts = await articlesOf(s!.id);
      expect(arts.map((a) => a.language), hint).toContain(lang);
    }
  });

  it('cifras contradictorias: quedan registradas y no se publican como dato', async () => {
    const s = (await storyByHint('Maratón Demo'))!;
    const c = await db.select().from(contradictions).where(eq(contradictions.storyId, s.id));
    expect(c.some((x) => x.field === 'number')).toBe(true);
    const arts = await articlesOf(s.id);
    for (const a of arts) {
      const figures = a.body.filter((b) => b.type === 'list').flatMap((b) => (b.type === 'list' ? b.items.map((i) => i.text) : []));
      expect(figures.some((t) => /^Personas:/.test(t))).toBe(false);
    }
  });

  it('cada pasada deja acta y cada idioma su informe de calidad', async () => {
    expect((await db.select().from(verifications)).length).toBeGreaterThan(10);
    expect((await db.select().from(qualityReports)).length).toBeGreaterThan(10);
  });

  it('actualización: cuando cambia el dato, nueva versión con resumen del cambio (y la URL no cambia)', async () => {
    const s = (await storyByHint('Cuenca Demo'))!;
    const before = (await articlesOf(s.id)).find((a) => a.language === 'es')!;
    expect(before).toBeDefined();
    await seedDemo(db, { now: new Date(NOW.getTime() + 3600000), phase: 2 });
    const after = (await db.select().from(articles).where(and(eq(articles.storyId, s.id), eq(articles.language, 'es'))))[0];
    expect(after.version).toBeGreaterThan(before.version);
    expect(after.slug).toBe(before.slug);
    const notes = await db.select().from(corrections).where(eq(corrections.articleId, after.id));
    expect(notes.some((n) => n.kind === 'update')).toBe(true);
    expect(JSON.stringify(after.body)).toMatch(/43/);
    // La cifra anterior no se presenta como hecho actual: queda como «dato superado».
    const box = after.verification;
    expect(box.confirmed.some((c) => /\b41\b/.test(c.text))).toBe(false);
    expect((box.superseded ?? []).some((c) => /\b41\b/.test(c.text))).toBe(true);
    // Sin afirmaciones repetidas en el recuadro.
    const texts = box.confirmed.map((c) => c.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
    // Si ya alcanza el nivel de verificada, deja de estar «en desarrollo» (y la historia también).
    const st = (await db.select().from(stories).where(eq(stories.id, s.id)))[0];
    const [v] = await db.select().from(verifications).where(eq(verifications.storyId, s.id)).orderBy(desc(verifications.runAt)).limit(1);
    if (v.evidenceConfidence >= 0.75 && st.independentSourceCount >= 2) {
      expect(after.isDeveloping).toBe(false);
      expect(st.isDeveloping).toBe(false);
    }
  });

  it('los titulares son frases completas (no empiezan a mitad de frase)', async () => {
    const all = await db.select().from(articles).where(eq(articles.status, 'published'));
    const months = /^(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|enero|january|janvier|gennaio|janeiro)\b/i;
    for (const a of all) {
      expect(a.headline, a.headline).not.toMatch(months);
      expect(a.headline, a.headline).toMatch(/^[\p{Lu}\p{N}«"“¿¡]/u);
    }
  });

  it('ni el subtítulo ni el texto nombran a los medios: van en el recuadro de fuentes (03-10-2026)', async () => {
    const all = await db.select().from(articles).where(eq(articles.status, 'published'));
    const names = (await db.select({ name: sources.name, type: sources.sourceType }).from(sources)).filter((s) => !['primary_official', 'official'].includes(s.type)).map((s) => s.name);
    let checked = 0;
    for (const a of all) {
      if (a.subheadline) for (const n of names) expect(a.subheadline, a.headline).not.toContain(n);
      const text = a.body.flatMap((b) => (b.type === 'p' ? [b.text] : b.type === 'list' ? b.items.map((i) => i.text) : [])).join(' ');
      for (const n of names) for (const w of ['según', 'according to', 'laut', 'selon', 'secondo', 'segundo', 'berichtet']) expect(text, a.headline).not.toContain(`${w} ${n}`);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('mantenimiento: poda el texto de las fuentes a los 30 días (se guardó solo para contrastar)', async () => {
    const r = await maintenance(db, new Date(Date.now() + 40 * 86400000));
    expect(r.prunedTexts).toBeGreaterThan(0);
    const left = await db.select({ id: rawItems.id }).from(rawItems).where(isNotNull(rawItems.contentText));
    expect(left).toHaveLength(0);
  });

  it('demo:purge elimina todo lo DEMO sin tocar la referencia', async () => {
    const r = await purgeDemo(db);
    expect(r.stories).toBeGreaterThan(0);
    const left = await db.select().from(stories).where(inArray(stories.isDemo, [true]));
    expect(left).toHaveLength(0);
    expect((await db.select().from(sources)).length).toBeGreaterThan(30);
  });
});
