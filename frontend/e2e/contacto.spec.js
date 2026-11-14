import { test, expect } from '@playwright/test'
import { simularApi } from './api-simulada.js'

/* EL FORMULARIO DE CONTACTO (14-11-2026, tercera tanda, U6). El servidor contesta a POST /auth/lead con
   «¡Recibido! Te respondemos…» (con exclamación): ninguna página lo enseña. /contacto pone su propia frase, en su idioma
   (español; en inglés, la página en inglés), y su error tampoco es el del servidor. Y dice «correo», no «email». */

const DEL_SERVIDOR = '¡Recibido! Te respondemos en menos de 24 horas hábiles.'

async function preparar(page, { idioma, fallo = false } = {}) {
  await page.addInitScript((l) => {
    try {
      localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-11-14T00:00:00Z' }))
      if (l) localStorage.setItem('fds_idioma', l)
    } catch { /* nada */ }
  }, idioma)
  await simularApi(page, 'vacio')
  const enviados = []
  await page.route('**/api/auth/lead', (r) => {
    enviados.push(r.request().postDataJSON())
    return fallo
      ? r.fulfill({ status: 429, json: { detail: '¡Demasiados envíos! Espera un poco.' } })
      : r.fulfill({ json: { ok: true, mensaje: DEL_SERVIDOR } })
  })
  return enviados
}

test('en español: el recibido es el de la página, sin exclamaciones; y dice «correo»', async ({ page }) => {
  const enviados = await preparar(page, { idioma: 'es' })
  await page.goto('/contacto', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Correo *')).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText(/\bE-?mail\b/)
  await page.locator('input[type=email]').fill('marta@ejemplo.com')
  await page.locator('textarea').fill('Queremos verlo con 30 furgonetas.')
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  const recibido = page.getByRole('status')
  await expect(recibido).toContainText('Mensaje enviado.')
  await expect(recibido).toContainText('Te responderemos a marta@ejemplo.com en menos de 24 horas hábiles.')
  expect(enviados).toHaveLength(1)
  await expect(page.locator('body')).not.toContainText('¡')
  await expect(page.locator('body')).not.toContainText(DEL_SERVIDOR)
})

test('si el servidor dice que no, la página pone su propio aviso (no el del servidor)', async ({ page }) => {
  await preparar(page, { idioma: 'es', fallo: true })
  await page.goto('/contacto', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type=email]').fill('marta@ejemplo.com')
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(page.getByRole('alert')).toHaveText('No se pudo enviar el mensaje. Inténtalo de nuevo o escríbenos directamente al correo.')
  await expect(page.locator('body')).not.toContainText('¡')
})

test('en inglés: su propio recibido, en inglés, sin el texto del servidor', async ({ page }) => {
  await preparar(page, { idioma: 'en' })
  await page.goto('/contacto', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type=email]').fill('marta@example.com')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('status')).toContainText('Message sent.')
  await expect(page.locator('body')).not.toContainText(/¡|Recibido/)
})

test('la portada (el formulario de la demostración) tampoco enseña el texto del servidor', async ({ page }) => {
  await preparar(page, { idioma: 'es' })
  await page.goto('/#demo', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Tu nombre').fill('Marta Gil')
  await page.getByLabel('Tu empresa', { exact: true }).fill('Mensajería Norte')
  await page.getByLabel('Correo').fill('marta@ejemplo.com')
  await page.getByLabel('¿Cuántas furgonetas?').selectOption('10-29')
  await page.getByRole('button', { name: 'Pedir la demostración' }).click()
  await expect(page.getByTestId('emp-recibido')).toHaveText('Recibido. Te respondemos en menos de 24 horas hábiles.')
  await expect(page.locator('body')).not.toContainText('¡')
})
