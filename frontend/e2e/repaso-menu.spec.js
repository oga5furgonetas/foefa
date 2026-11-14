import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* EL NÚMERO DE «REPASO» EN EL MENÚ (14-11-2026, panel/PanelLayout.jsx). Cada dos minutos el panel pregunta cuántas
   revisiones de hoy quedan por repasar (`GET /repaso/pendientes`). Esa pregunta solo la puede hacer quien puede abrir
   «Repaso», y no antes de saberlo: los módulos de la empresa llegan con `/org/billing` y los permisos de verdad con
   `/auth/me`. Antes, el latido se quedaba con los módulos del primer pintado (aún sin llegar = «todos») y seguía
   preguntando cada dos minutos en una empresa sin el módulo.
   El reloj del navegador va con `page.clock`, para pasar dos minutos sin esperarlos. */

const DOS_MINUTOS = 121_000
const SIN_REPASO = ['dashboard', 'vehiculos', 'inspecciones', 'conductores']

async function montar(page, { modulos = null, permisos } = {}) {
  const pedidas = { pendientes: 0, dia: 0 }
  const llegado = { billing: 0, me: 0 }
  let soltarBilling
  const billing = new Promise((r) => { soltarBilling = r })
  await page.clock.install()
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  // Los módulos de la empresa llegan cuando la prueba lo dice.
  await page.route(/\/api\/org\/billing(\?|$)/, async (r) => {
    await billing
    await r.fulfill({ json: { plan: 'esencial', status: 'active', modulos } })
    llegado.billing++
  })
  // Los permisos de verdad: sin `permissions`, el servidor no restringe nada; con lista, solo lo que haya en ella.
  await page.route(/\/api\/auth\/me(\?|$)/, async (r) => {
    await r.fulfill({ json: { id: 'a1', name: 'Admin Test', role: 'admin', ...(permisos ? { permissions: permisos } : {}) } })
    llegado.me++
  })
  await page.route(/\/api\/repaso\/(pendientes|dia)(\?|$)/, (r) => {
    pedidas[new URL(r.request().url()).pathname.endsWith('/dia') ? 'dia' : 'pendientes']++
    return r.fulfill({ json: { fecha: '2026-11-14', pendientes: 3 } })
  })
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  return { pedidas, llegado, soltarBilling }
}

const enlaceRepaso = (page) => page.locator('aside a[href="/panel/repaso"]')

test('Menú · sin el módulo «Repaso», el panel no pregunta nunca por el número', async ({ page, isMobile }) => {
  const { pedidas, llegado, soltarBilling } = await montar(page, { modulos: SIN_REPASO })
  await page.clock.runFor(1500)
  soltarBilling()
  await expect.poll(() => llegado.billing).toBeGreaterThan(0)
  if (!isMobile) await expect(page.locator('aside a[href="/panel/vehiculos"]')).toBeVisible()
  for (let i = 0; i < 3; i++) await page.clock.runFor(DOS_MINUTOS)
  expect(pedidas).toEqual({ pendientes: 0, dia: 0 })
  if (!isMobile) await expect(enlaceRepaso(page)).toHaveCount(0)
})

test('Menú · con el módulo, no pregunta hasta saber los módulos; luego cada dos minutos', async ({ page, isMobile }) => {
  const { pedidas, llegado, soltarBilling } = await montar(page, { modulos: [...SIN_REPASO, 'repaso'] })
  await expect.poll(() => llegado.me).toBeGreaterThan(0)
  await page.clock.runFor(1500)
  // Mientras los módulos no han llegado, el menú enseña todo (para no parpadear), pero no se pregunta nada.
  expect(pedidas.pendientes).toBe(0)
  soltarBilling()
  await expect.poll(() => pedidas.pendientes).toBe(1)
  if (!isMobile) await expect(enlaceRepaso(page).locator('span')).toHaveText('3')
  await page.clock.runFor(DOS_MINUTOS)
  await expect.poll(() => pedidas.pendientes).toBe(2)
  // Nunca el día entero: solo el número.
  expect(pedidas.dia).toBe(0)
})

test('Menú · sin el permiso de «Repaso», no pregunta aunque la empresa tenga el módulo', async ({ page, isMobile }) => {
  const { pedidas, llegado, soltarBilling } = await montar(page, { modulos: null, permisos: ['dashboard', 'vehiculos', 'inspecciones'] })
  soltarBilling()
  await expect.poll(() => llegado.billing).toBeGreaterThan(0)
  await expect.poll(() => llegado.me).toBeGreaterThan(0)
  if (!isMobile) await expect(page.locator('aside a[href="/panel/vehiculos"]')).toBeVisible()
  for (let i = 0; i < 3; i++) await page.clock.runFor(DOS_MINUTOS)
  expect(pedidas).toEqual({ pendientes: 0, dia: 0 })
  if (!isMobile) await expect(enlaceRepaso(page)).toHaveCount(0)
})

test('Menú · al salir del panel deja de preguntar', async ({ page }) => {
  const { pedidas, soltarBilling } = await montar(page, { modulos: null })
  soltarBilling()
  await expect.poll(() => pedidas.pendientes).toBe(1)
  // Fuera del panel sin recargar la página (como un enlace de la propia app).
  await page.evaluate(() => { window.history.pushState({}, '', '/planes'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.locator('[data-testid="repaso"], aside a[href="/panel/repaso"]')).toHaveCount(0)
  for (let i = 0; i < 3; i++) await page.clock.runFor(DOS_MINUTOS)
  expect(pedidas.pendientes).toBe(1)
})
