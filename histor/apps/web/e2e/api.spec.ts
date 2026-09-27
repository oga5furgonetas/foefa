import { expect, test } from '@playwright/test';
import { BASE } from '../playwright.config';

test('API pública de lectura', async ({ request }) => {
  const list = await request.get(`${BASE}/api/v1/articles?lang=en&limit=5`);
  expect(list.ok()).toBe(true);
  const items = (await list.json()).items as { url: string; isDemo: boolean }[];
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.isDemo)).toBe(true); // en DEMO solo se sirve lo DEMO
  const [, lang, , , , slug] = items[0].url.split('/');
  const one = await request.get(`${BASE}/api/v1/articles/${lang}/${slug}`);
  const body = await one.json();
  expect(body.article.verification.confirmed.length).toBeGreaterThan(0);
  expect(body.article.sources.length).toBeGreaterThan(0);
  expect((await request.get(`${BASE}/api/v1/articles?lang=xx`)).status()).toBe(400);
  expect((await request.get(`${BASE}/api/v1/sources`)).ok()).toBe(true);
  const search = await request.get(`${BASE}/api/v1/search?lang=es&q=feria`);
  expect((await search.json()).items.length).toBeGreaterThan(0);
});

test('salud y métricas protegidas', async ({ request }) => {
  expect((await (await request.get(`${BASE}/api/health`)).json()).ok).toBe(true);
  expect((await request.get(`${BASE}/api/metrics`)).status()).toBe(403);
});

test('los eventos de lectura exigen origen propio', async ({ request }) => {
  const bad = await request.post(`${BASE}/api/v1/events`, { data: { events: [{ type: 'page_view' }] }, headers: { origin: 'https://otro.example' } });
  expect(bad.status()).toBe(403);
  const ok = await request.post(`${BASE}/api/v1/events`, { data: { events: [{ type: 'page_view', path: '/es' }, { type: 'inventado' }] }, headers: { origin: BASE } });
  expect((await ok.json()).recorded).toBe(1);
});
