import { expect, test } from '@playwright/test';
import { BASE } from '../playwright.config';
import { acceptCookies, firstArticleUrl } from './helpers';

const LANGS = ['es', 'en', 'de', 'fr', 'it', 'pt'];

test('la raíz redirige al idioma del navegador', async ({ request }) => {
  const r = await request.get(`${BASE}/`, { headers: { 'accept-language': 'de-DE,de;q=0.9' }, maxRedirects: 0 });
  expect(r.status()).toBe(302);
  expect(r.headers()['location']).toMatch(/\/de$/);
});

for (const lang of LANGS) {
  test(`portada en ${lang}: aviso DEMO, noticias y sin índice`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/${lang}`);
    await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`));
    await expect(page.locator('.demo-banner')).toBeVisible();
    await expect(page.locator('.lead-story h1')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(errors).toEqual([]);
  });
}

test('noticia: recuadro de verificación, fuentes, datos estructurados y hreflang', async ({ page, request }) => {
  const url = await firstArticleUrl(request, BASE);
  await page.goto(url);
  await acceptCookies(page);
  await expect(page.locator('article h1')).toBeVisible();
  // La verificación, las fuentes y la cronología van plegadas: se ve la noticia, no el andamiaje.
  const more = page.locator('details.verify-more');
  await expect(more).not.toHaveAttribute('open', /.*/);
  await expect(page.locator('.sources ol li').first()).toBeHidden();
  await more.locator('summary').click();
  const box = page.locator('aside.verify');
  await expect(box).toContainText('Cómo verificamos esta noticia');
  await expect(box).toContainText('Confirmado');
  await expect(page.locator('.sources ol li').first()).toBeVisible();
  await expect(page.getByText('Elaborada por Redacción', { exact: false })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const article = ld.map((x) => JSON.parse(x)).flat().find((x) => x['@type'] === 'NewsArticle');
  expect(article).toBeTruthy();
  // Las mesas automáticas se declaran como organización, nunca como periodista.
  expect(article.author['@type']).toBe('Organization');
  expect(article.citation.length).toBeGreaterThan(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${url}$`));
});

test('una noticia actualizada muestra la nota y el dato anterior tachado, no como confirmado', async ({ page, request }) => {
  const r = await request.get(`${BASE}/api/v1/articles?lang=es&limit=20`);
  const items = ((await r.json()) as { items: { url: string; headline: string; version: number }[] }).items;
  // La historia de los embalses de la Cuenca Demo (el titular puede decir «embalses» o «reserva»).
  const updated = items.find((i) => i.version > 1 && /embalses|reserva de la Cuenca Demo/i.test(i.headline));
  test.skip(!updated, 'el escenario DEMO no tiene la actualización');
  await page.goto(updated!.url);
  await expect(page.getByText('Correcciones y actualizaciones')).toBeVisible();
  const box = page.locator('aside.verify');
  await expect(box.locator('s').first()).toContainText('41');
  await expect(box.locator('h3', { hasText: 'Confirmado' }).locator('+ ul')).not.toContainText('41 %');
});

test('una historia en desarrollo lo dice y atribuye', async ({ page, request }) => {
  const r = await request.get(`${BASE}/api/v1/articles?lang=es&limit=20`);
  const dev = ((await r.json()) as { items: { url: string; isDeveloping: boolean }[] }).items.find((i) => i.isDeveloping);
  test.skip(!dev, 'no hay historias en desarrollo');
  await page.goto(dev!.url);
  await expect(page.locator('.notice-developing')).toBeVisible();
  // Sin la fuente en el titular (01-10-2026): la etiqueta «en desarrollo» va con él y el texto atribuye.
  await expect(page.locator('article h1')).not.toContainText(/según/);
  await expect(page.locator('article .badge-developing').first()).toBeVisible();
  await expect(page.locator('.article-body')).toContainText(/según/);
});

test('secciones, países, ciudades, listas y páginas legales responden', async ({ page }) => {
  for (const p of ['/es/economia', '/es/espana', '/es/espana/galicia', '/es/espana/galicia/vigo', '/es/ultimas', '/es/tendencias', '/es/como-funciona', '/es/politica-editorial', '/es/correcciones', '/es/fuentes', '/es/aviso-legal', '/en/legal-notice', '/de/impressum', '/fr/mentions-legales']) {
    const res = await page.goto(p);
    expect(res?.status(), p).toBe(200);
  }
});

test('el aviso legal no inventa datos: muestra marcadores pendientes', async ({ page }) => {
  await page.goto('/es/aviso-legal');
  await expect(page.locator('mark.pending').first()).toContainText('PENDIENTE');
});

test('búsqueda', async ({ page }) => {
  await page.goto('/es/buscar?q=feria');
  await expect(page.getByRole('status')).toContainText('feria');
  await expect(page.locator('.card').first()).toBeVisible();
});

test('404 localizado y palabra de ruta de otro idioma redirige', async ({ page, request }) => {
  const res = await page.goto('/es/esto-no-existe');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  const r = await request.get(`${BASE}/es/search`, { maxRedirects: 0 });
  expect(r.status()).toBe(308);
  expect(r.headers()['location']).toMatch(/\/es\/buscar$/);
});

test('consentimiento de cookies: rechazar no crea identificador', async ({ page, context }) => {
  await page.goto('/es');
  await page.getByRole('button', { name: 'Rechazar todo' }).click();
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'histor_aid')).toBeUndefined();
  expect(cookies.find((c) => c.name === 'histor_consent_v')).toBeDefined();
});

test('cabeceras de seguridad', async ({ request }) => {
  const r = await request.get(`${BASE}/es`);
  const h = r.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['x-powered-by']).toBeUndefined();
});

test('SEO: robots en DEMO bloquea todo; sitemaps, RSS y manifest válidos', async ({ request }) => {
  expect(await (await request.get(`${BASE}/robots.txt`)).text()).toContain('Disallow: /');
  const sm = await request.get(`${BASE}/sitemap.xml`);
  expect(sm.headers()['content-type']).toContain('xml');
  expect(await sm.text()).toContain('<sitemapindex');
  const st = await (await request.get(`${BASE}/sitemaps/static.xml`)).text();
  expect(st).toContain('hreflang="de"');
  const rss = await (await request.get(`${BASE}/es/rss.xml`)).text();
  expect(rss).toContain('<rss');
  expect(rss).toContain('[DEMO]');
  expect((await request.get(`${BASE}/manifest.webmanifest`)).ok()).toBe(true);
  const og = await request.get(`${BASE}/api/og?lang=es`);
  expect(og.headers()['content-type']).toBe('image/png');
});

test('«Cómo funciona» muestra las cifras de transparencia (incluido lo descartado)', async ({ page }) => {
  await page.goto('/es/como-funciona');
  const box = page.locator('#stats-h').locator('..');
  await expect(box).toContainText('Histor en cifras');
  await expect(box).toContainText('Descartadas');
});
