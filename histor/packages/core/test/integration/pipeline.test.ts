/**
 * Pipeline completo contra PostgreSQL: ingesta de los feeds DEMO →
 * normalización → agrupación → verificación → redacción → controles →
 * publicación → actualización. Comprueba que cada escenario acaba donde debe.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/client';
import { articles, articleVersions, contradictions, corrections, qualityReports, sources, stories, verifications } from '../../src/db/schema';
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

  it('fuente única (con una copia en un blog): se publica solo "en desarrollo" y atribuida', async () => {
    const s = (await storyByHint('autobús en Vigo'))!;
    expect(s).toBeDefined();
    const arts = await articlesOf(s.id);
    expect(arts).toHaveLength(1);
    expect(arts[0].isDeveloping).toBe(true);
    expect(arts[0].headline).toMatch(/según Diario Demo/);
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

  it('fuente primaria oficial con su propia decisión: publicada', async () => {
    const s = (await storyByHint('bibliotecas públicas'))!;
    expect(['PUBLISHED', 'UPDATED']).toContain(s.state);
  });

  it('terremoto de fuente sísmica oficial: publicado con plantilla en los 6 idiomas', async () => {
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

  it('el subtítulo nombra tantas fuentes como dice (o «entre ellas»)', async () => {
    const all = await db.select().from(articles).where(eq(articles.status, 'published'));
    for (const a of all) {
      const m = a.subheadline?.match(/(\d+) (?:fuentes|independent|unabhängigen|sources|fonti|fontes)/);
      if (!m) continue;
      const n = Number(m[1]);
      const listed = a.subheadline!.split(/:|,(?= )| y | and | und | et | e /).length - 1;
      if (/entre ellas|including|darunter|dont|tra cui|entre elas/.test(a.subheadline!)) expect(n).toBeGreaterThan(4);
      else expect(listed).toBe(n);
    }
  });

  it('demo:purge elimina todo lo DEMO sin tocar la referencia', async () => {
    const r = await purgeDemo(db);
    expect(r.stories).toBeGreaterThan(0);
    const left = await db.select().from(stories).where(inArray(stories.isDemo, [true]));
    expect(left).toHaveLength(0);
    expect((await db.select().from(sources)).length).toBeGreaterThan(30);
  });
});
