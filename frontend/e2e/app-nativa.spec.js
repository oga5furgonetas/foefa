import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LA APP DEL REPARTIDOR SE PORTA COMO UNA APP Y NO COMO UNA WEB (25-10-2026, Dani: «que no se vea como app web;
   es la que vamos a subir a Play Store, debe ser perfecta»). Lo que delataba la web y aquí se comprueba:
   el «atrás» del móvil cerraba la app con una hoja abierta, la barra de arriba salía negra encima de la app
   clara, dentro de la app salía el aviso de cookies y se podía ampliar con dos dedos, y sin cobertura no abría. */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

const PEDIDOS = [
  { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Real 5, A Coruña', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.37, lng: -8.39 },
  { id: 'p2', cliente: 'Bar Pepe', direccion: 'Montero Ríos 12, A Coruña', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.369, lng: -8.405 },
]

async function comoApp(page) {
  await page.addInitScript(() => {
    // La app instalada (la TWA de Play, o «añadir a inicio») se abre «standalone».
    const mm = window.matchMedia.bind(window)
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q)
      ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } }
      : mm(q))
  })
}

async function conRuta(page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-25', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: null, pedidos: PEDIDOS } }))
}

test('Atrás del móvil: cierra la hoja abierta (no la app) y desde otra pestaña vuelve a «Hoy»', async ({ page }) => {
  await conRuta(page)
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Farmacia Sol').first()).toBeVisible()
  await page.getByRole('button', { name: 'Añadir paradas' }).click()
  const hoja = page.getByRole('dialog', { name: 'Añadir paradas' })
  await expect(hoja).toBeVisible()
  await page.goBack()
  await expect(hoja).toHaveCount(0)
  await expect(page).toHaveURL(/\/ruta$/)
  await expect(page.getByText('Farmacia Sol').first()).toBeVisible()
  // Cerrada con su botón: no deja un «atrás» de más (el siguiente atrás no se queda en la misma pantalla).
  await page.getByRole('button', { name: 'Añadir paradas' }).click()
  await hoja.getByRole('button', { name: 'Cerrar' }).click()
  await expect(hoja).toHaveCount(0)
  expect(await page.evaluate(() => window.history.state?.fdsCapa || null)).toBeNull()
  // Pestañas: desde «Historial», atrás vuelve a «Hoy».
  const secciones = page.getByRole('navigation', { name: 'Secciones' })
  await secciones.getByRole('button', { name: 'Historial' }).click()
  await expect(secciones.getByRole('button', { name: 'Historial' })).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(secciones.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveURL(/\/ruta$/)
})

test('La barra de arriba del móvil es del color de la app (y al salir, la de la web)', async ({ page }) => {
  await conRuta(page)
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Farmacia Sol').first()).toBeVisible()
  const color = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute('content'))
  expect(await color()).toBe('#f7f6f3')
  // Con el tema oscuro (Ajustes → Aspecto), oscura.
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('radio', { name: 'Oscuro' }).click()
  await expect.poll(color).toBe('#060a14')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(await color()).toBe('#070a0e')
})

test('Dentro de la app instalada: sin aviso de cookies y sin ampliar con dos dedos; en el navegador, como siempre', async ({ page, context }) => {
  await comoApp(page)
  await page.route(/\/api\//, (r) => r.fulfill({ status: 401, json: { detail: 'x' } }))
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/empezar$/)          // sin recargar la página (antes, dos cargas enteras)
  await expect(page.getByRole('button', { name: /Crear mi cuenta gratis/ }).or(page.getByRole('link', { name: /Crear mi cuenta gratis/ })).first()).toBeVisible()
  await page.waitForTimeout(600)
  await expect(page.getByRole('dialog', { name: 'Cookies' })).toHaveCount(0)
  expect(await page.evaluate(() => document.querySelector('meta[name=viewport]').getAttribute('content'))).toMatch(/user-scalable=no/)
  // En el navegador (otra pestaña, sin app): la página se puede ampliar.
  const web = await context.newPage()
  await web.route(/\/api\//, (r) => r.fulfill({ status: 401, json: { detail: 'x' } }))
  await web.goto('/repartidores', { waitUntil: 'domcontentloaded' })
  expect(await web.evaluate(() => document.querySelector('meta[name=viewport]').getAttribute('content'))).not.toMatch(/user-scalable=no/)
})

test('Sin cobertura la app abre igual, con la ruta que tenía y diciendo de cuándo es', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'escritorio' && test.info().project.name !== 'movil', 'chromium')
  await conRuta(page)
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Farmacia Sol').first()).toBeVisible()
  // El service worker ya manda en la página y tiene guardada la app.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Farmacia Sol').first()).toBeVisible()
  await context.setOffline(true)
  // La API simulada contesta aunque no haya red: sin red de verdad, el servidor no contesta.
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.abort('internetdisconnected'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Farmacia Sol').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión: es tu ruta de las' })).toBeVisible()
  // El logo de arriba también sale (antes, sin red, una imagen rota).
  await expect.poll(() => page.evaluate(() => document.querySelector('main header img')?.naturalWidth || 0)).toBeGreaterThan(0)
  await context.setOffline(false)
})
