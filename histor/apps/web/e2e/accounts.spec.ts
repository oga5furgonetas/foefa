import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { BASE } from '../playwright.config';
import { acceptCookies, apiPost, firstArticleUrl } from './helpers';

const email = `lector-${Date.now()}@e2e.test`;
const password = 'una-contraseña-larga-1';

test('registro, entrada, guardar noticia, preferencias, exportar y borrar la cuenta', async ({ page, request }) => {
  await page.goto('/es/registro');
  await acceptCookies(page);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('status')).toContainText('Te hemos enviado un correo');

  await page.goto('/es/entrar');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Mi cuenta' })).toBeVisible();

  const url = await firstArticleUrl(request, BASE);
  await page.goto(url);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('button', { name: /Guardada/ })).toBeVisible();
  await page.goto('/es/guardadas');
  await expect(page.locator('.card')).toHaveCount(1);

  await page.goto('/es/cuenta');
  await page.getByLabel('Máximo de alertas al día').fill('5');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible();

  const dl = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar mis datos' }).click();
  const file = await (await dl).path();
  const data = JSON.parse(readFileSync(file!, 'utf8'));
  expect(data.profile.email).toBe(email);
  expect(data.profile.passwordHash).toBeUndefined();
  expect(data.saved).toHaveLength(1);

  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  await page.locator('input[name="confirm"]').fill('ELIMINAR');
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  await expect(page).toHaveURL(/\/es$/);
  await page.goto('/es/entrar');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('.alert-error')).toContainText('incorrectos');
});

test('sin token CSRF u origen propio, la API rechaza cambios', async ({ request }) => {
  const noToken = await request.post(`${BASE}/api/v1/auth/login`, { data: { email: 'x@y.z', password: 'x' }, headers: { origin: BASE } });
  expect(noToken.status()).toBe(403);
  const r = await request.get(`${BASE}/api/v1/csrf`);
  const { token } = await r.json();
  const badOrigin = await request.post(`${BASE}/api/v1/auth/login`, { data: { email: 'x@y.z', password: 'x' }, headers: { origin: 'https://malo.example', 'x-csrf-token': token } });
  expect(badOrigin.status()).toBe(403);
});

test('informar de un error crea una tarea de revisión', async ({ page, request }) => {
  const url = await firstArticleUrl(request, BASE);
  await page.goto(url);
  await acceptCookies(page);
  await page.getByRole('link', { name: 'Informar de un error' }).first().click();
  await page.getByLabel('Explica el problema').fill('La cifra del segundo párrafo no coincide con la fuente original.');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('status')).toContainText('Gracias');
});

test('newsletter: alta con doble confirmación y bloqueo de las premium', async ({ request }) => {
  const ok = await apiPost(request, BASE, '/api/v1/newsletters/subscribe', { slug: 'espana-manana', email: `nl-${Date.now()}@e2e.test`, lang: 'es' });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).status).toBe('pending');
  const premium = await apiPost(request, BASE, '/api/v1/newsletters/subscribe', { slug: 'berlin-daily', email: `nl2-${Date.now()}@e2e.test`, lang: 'de' });
  expect(premium.status()).toBe(402);
});

test('suscripción sin Stripe configurado: lo dice y no inventa un cobro', async ({ page, request }) => {
  await page.goto('/es/suscribete');
  await expect(page.locator('.notice-developing')).toContainText('todavía no están activas');
  await expect(page.locator('.plan.featured .price')).toContainText('€');
  const r = await request.post(`${BASE}/api/v1/stripe/webhook`, { data: '{}', headers: { 'stripe-signature': 'x' } });
  expect(r.status()).toBe(503);
});
