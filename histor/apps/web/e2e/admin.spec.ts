import { expect, test } from '@playwright/test';
import { BASE, E2E_ENV } from '../playwright.config';
import { acceptCookies, apiPost, totp } from './helpers';

test('el panel exige sesión', async ({ request }) => {
  const r = await request.get(`${BASE}/admin`, { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers()['location']).toMatch(/login|entrar/);
});

test('un lector no entra al panel ni a su API', async ({ page, request }) => {
  const email = `lector-admin-${Date.now()}@e2e.test`;
  await apiPost(request, BASE, '/api/v1/auth/register', { email, password: 'una-contraseña-larga-2', lang: 'es' });
  const login = await apiPost(request, BASE, '/api/v1/auth/login', { email, password: 'una-contraseña-larga-2' });
  expect(login.ok()).toBe(true);
  const r = await apiPost(request, BASE, '/api/v1/admin/story.recheck', { id: 1 });
  expect(r.status()).toBe(403);
  void page;
});

test('admin: 2FA obligatorio en producción, cadena de evidencia y acciones auditadas', async ({ page }) => {
  await page.goto('/es/entrar?next=/admin');
  await acceptCookies(page);
  await page.getByLabel('Correo electrónico').fill(E2E_ENV.ADMIN_EMAIL);
  await page.getByLabel('Contraseña').fill(E2E_ENV.ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/admin/);
  // Sin 2FA configurado, el panel obliga a activarlo.
  await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
  await page.getByRole('button', { name: 'Verificación en dos pasos' }).click();
  // La clave se muestra en grupos de 4 para leerla mejor; las apps (y esta prueba) ignoran los espacios.
  const secret = (await page.locator('code').first().textContent())!.replace(/\s+/g, '');
  await page.getByLabel('Código de verificación').fill(totp(secret));
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('✓ Verificación en dos pasos')).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText('Impulso frente a confianza')).toBeVisible();

  await page.goto('/admin/stories');
  await page.locator('table a').first().click();
  await expect(page.getByText('Cadena de evidencia: afirmaciones')).toBeVisible();
  await page.getByRole('button', { name: 'Volver a verificar ahora' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Hecho' })).toBeVisible();

  await page.goto('/admin/tasks');
  await expect(page.getByRole('heading', { name: 'Tareas de revisión' })).toBeVisible();

  await page.goto('/admin/settings');
  await page.getByRole('button', { name: 'Guardar umbrales' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Hecho' })).toBeVisible();

  await page.goto('/admin/ops');
  await expect(page.getByText('story.recheck').first()).toBeVisible();

  for (const p of ['/admin/sources', '/admin/pricing', '/admin/taxonomy', '/admin/users', '/admin/experiments']) {
    const res = await page.goto(p);
    expect(res?.status(), p).toBe(200);
  }
});
