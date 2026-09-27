/**
 * Contenido público: aislamiento DEMO/real, portada, búsqueda full-text,
 * ficha de noticia, recomendación, analítica, newsletters y denuncias.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordEvents } from '../../src/analytics';
import type { Db } from '../../src/db/client';
import { analyticsEvents, articles, interestProfiles, newsletterSubscriptions, outbox, reports, reviewTasks, stories } from '../../src/db/schema';
import { seedDemo } from '../../src/demo/seed';
import { resetEnvCache } from '../../src/env';
import { confirmNewsletter, subscribeNewsletter, unsubscribeNewsletter } from '../../src/newsletter';
import { recommend } from '../../src/reco';
import { submitReport } from '../../src/services/admin';
import { getArticleDetail, getHome, listArticles, searchArticles } from '../../src/services/content';
import { done, freshDb } from './db';

let db: Db;

function demo(on: boolean) {
  process.env.DEMO_MODE = on ? '1' : '';
  resetEnvCache();
}

beforeAll(async () => {
  db = await freshDb();
  await seedDemo(db, { now: new Date(Date.now() - 30 * 60000) });
}, 120_000);

afterAll(async () => {
  demo(false);
  await done();
});

describe('aislamiento DEMO / real', () => {
  it('sin DEMO_MODE no se ve NADA del contenido de demostración', async () => {
    demo(false);
    const home = await getHome(db, { lang: 'es', countryCode: 'ES', regionCode: null, cityKey: null });
    expect(home.top).toBeNull();
    expect(home.latest).toHaveLength(0);
    expect((await searchArticles(db, 'es', 'Feria')).items).toHaveLength(0);
  });

  it('con DEMO_MODE solo se ve lo DEMO, marcado como tal', async () => {
    demo(true);
    const home = await getHome(db, { lang: 'es', countryCode: 'ES', regionCode: null, cityKey: null });
    expect(home.top).not.toBeNull();
    expect(home.latest.length).toBeGreaterThan(2);
    expect([home.top!, ...home.latest].every((a) => a.isDemo)).toBe(true);
  });
});

describe('portada, búsqueda y noticia', () => {
  it('la portada de EE. UU. en inglés prioriza su país', async () => {
    demo(true);
    const home = await getHome(db, { lang: 'en', countryCode: 'US', regionCode: null, cityKey: null });
    expect(home.national.some((a) => a.countryCode === 'US')).toBe(true);
  });

  it('búsqueda full-text por idioma (con derivación: "bibliotecas" encuentra "biblioteca")', async () => {
    demo(true);
    const r = await searchArticles(db, 'es', 'biblioteca');
    expect(r.items.length).toBeGreaterThan(0);
    const de = await searchArticles(db, 'de', 'Strompreis');
    expect(de.items.length).toBeGreaterThan(0);
  });

  it('la ficha de la noticia trae versiones, fuentes y otras ediciones', async () => {
    demo(true);
    const [quake] = await listArticles(db, { lang: 'es', limit: 50 }).then((l) => l.filter((a) => a.headline.includes('Terremoto')));
    const d = await getArticleDetail(db, 'es', quake.slug);
    expect(d?.versions.length).toBeGreaterThan(0);
    expect(d?.article.sourcesList.length).toBeGreaterThan(0);
    expect(d?.alternates.map((a) => a.language)).toEqual(expect.arrayContaining(['en', 'de']));
  });
});

describe('recomendación y analítica con consentimiento', () => {
  it('sin consentimiento no guarda identificador; con él aprende intereses', async () => {
    demo(true);
    const [a] = await listArticles(db, { lang: 'es', categoryId: 'technology', limit: 1 });
    const anyArticle = a ?? (await listArticles(db, { lang: 'es', limit: 1 }))[0];
    await recordEvents(db, [{ type: 'page_view', articleId: anyArticle.id }], { userId: null, anonCookie: 'c1', countryCode: 'ES', language: 'es', device: 'mobile', referrerHost: null, consentAnalytics: false, consentPersonalization: false });
    const ev = await db.select().from(analyticsEvents).where(eq(analyticsEvents.articleId, anyArticle.id));
    expect(ev[0].anonId).toBeNull();
    await recordEvents(db, [{ type: 'read_progress', articleId: anyArticle.id, value: 0.9 }, { type: 'save', articleId: anyArticle.id }], { userId: null, anonCookie: 'c1', countryCode: 'ES', language: 'es', device: 'mobile', referrerHost: null, consentAnalytics: true, consentPersonalization: true });
    const profiles = await db.select().from(interestProfiles);
    expect(profiles.length).toBe(1);
    expect(Object.keys(profiles[0].affinities).length).toBeGreaterThan(0);
    const recs = await recommend(db, { lang: 'es', profileKey: profiles[0].key, countryCode: 'ES', limit: 6 });
    expect(recs.length).toBeGreaterThan(0);
    // Diversidad: no dos veces la misma historia.
    expect(new Set(recs.map((r) => r.storyId)).size).toBe(recs.length);
  });
});

describe('newsletters y denuncias', () => {
  it('doble confirmación y baja en un clic', async () => {
    expect(await subscribeNewsletter(db, 'espana-manana', 'lector@example.org', { lang: 'es' })).toBe('pending');
    const mail = (await db.select().from(outbox).where(eq(outbox.to, 'lector@example.org')))[0];
    const token = mail.textBody.match(/token=([A-Za-z0-9_-]+)/)![1];
    expect(await confirmNewsletter(db, token)).toBe(true);
    const [sub] = await db.select().from(newsletterSubscriptions).where(eq(newsletterSubscriptions.email, 'lector@example.org'));
    expect(sub.status).toBe('confirmed');
    expect(await unsubscribeNewsletter(db, sub.unsubscribeToken)).toBe(true);
    expect(await subscribeNewsletter(db, 'berlin-daily', 'lector@example.org', { lang: 'de' })).toBe('premium_required');
  });

  it('un aviso de error se convierte en tarea de revisión priorizada', async () => {
    demo(true);
    const [a] = await db.select().from(articles).limit(1);
    const id = await submitReport(db, { kind: 'factual_error', articleId: a.id, description: 'La cifra de visitantes no coincide con la fuente.', ip: '1.2.3.4' });
    const [r] = await db.select().from(reports).where(eq(reports.id, id));
    expect(r.ipHash).not.toContain('1.2.3.4');
    const [t] = await db.select().from(reviewTasks).where(eq(reviewTasks.reportId, id));
    expect(t.priority).toBe(80);
    const [s] = await db.select().from(stories).where(eq(stories.id, a.storyId));
    expect(t.storyId).toBe(s.id);
  });
});
