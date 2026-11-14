/* UNA EMPRESA NUEVA QUE QUIERE PAGAR (14-11-2026).
   En Stripe solo tiene precio el plan de quien reparte solo (`planes: ['autonomo']` en /billing/config). El aviso de la
   prueba del panel le enseñaba a una empresa «Pasar a Pro», y al pulsarlo el servidor contestaba 400 «El plan
   «completo» aún no tiene precio en Stripe» en un alert(). Ahora, si su plan no tiene precio, el aviso ofrece
   «Escríbenos y te lo activamos» (contacto con el asunto puesto) y no llama al pago; si lo tiene, todo como antes. */
import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

function vigilar(page) {
  const fallos = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/favicon|manifest|net::ERR|Failed to load resource|sw\.js/i.test(t)) return
    fallos.push(`consola: ${t.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => fallos.push(`excepcion: ${String(e.message).slice(0, 200)}`))
  // Ningún alert(): el texto interno del servidor no se le enseña a nadie.
  page.on('dialog', (d) => { fallos.push(`dialogo: ${d.message()}`); d.dismiss().catch(() => {}) })
  return fallos
}

/* La empresa en el panel, con su estado de cobro y lo que Stripe tiene con precio. Devuelve los pagos pedidos. */
/* `planesDespues`: lo que contesta /billing/config a partir de la segunda vez (un precio quitado entre medias). */
async function empresa(page, billing, planes, { suscripcion, planesDespues } = {}) {
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'completo', sector: 'mensajeria', ...billing } }))
  let vecesConfig = 0
  await page.route(/\/api\/billing\/config/, (r) => {
    vecesConfig += 1
    const p = vecesConfig > 1 && planesDespues ? planesDespues : planes
    return r.fulfill({ json: { provider: 'stripe', ready: true, pago_en_app: false, planes: p, checkout: {} } })
  })
  const pedidos = []
  await page.route(/\/api\/billing\/stripe\/suscripcion/, async (r) => {
    pedidos.push(r.request().postDataJSON())
    await r.fulfill(suscripcion || { json: { url: '/panel?pago=cancelado' } })
  })
  return pedidos
}

const ESTADOS = [
  { nombre: 'prueba en curso', billing: { status: 'trial', days_left: 5, required: false } },
  { nombre: 'prueba vencida', billing: { status: 'trial', days_left: 0, required: true } },
  { nombre: 'suspendida', billing: { status: 'suspended', required: false } },
]

for (const e of ESTADOS) {
  test(`Alta empresa · ${e.nombre}, plan Pro sin precio en Stripe: «Escríbenos» al contacto, sin llamar al pago`, async ({ page }) => {
    const fallos = vigilar(page)
    const pedidos = await empresa(page, e.billing, ['autonomo'])
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const escribenos = page.getByRole('link', { name: 'Escríbenos y te lo activamos' })
    await expect(escribenos).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Pasar a Pro|Reactivar/ })).toHaveCount(0)
    await escribenos.click()
    await expect(page).toHaveURL(/\/contacto\?asunto=Activar%20plan%20Pro/)
    // El asunto llega puesto en el formulario.
    await expect(page.getByPlaceholder('Demo / Soporte / Comercial…')).toHaveValue('Activar plan Pro')
    expect(pedidos).toEqual([])
    expect(fallos).toEqual([])
  })
}

test('Alta empresa · plan Pro CON precio en Stripe: «Pasar a Pro» pide el pago de «completo» y va a Stripe', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidos = await empresa(page, { status: 'trial', days_left: 5, required: false }, ['autonomo', 'completo'])
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'Escríbenos y te lo activamos' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pasar a Pro' }).click()
  await expect.poll(() => pedidos.length).toBe(1)
  expect(pedidos[0]).toEqual({ plan: 'completo', anual: false })
  await expect(page).toHaveURL(/\/panel\?pago=cancelado/)
  expect(fallos).toEqual([])
})

/* Las claves antiguas y las mayúsculas se comparan con el nombre del servidor (`_plan_canon`): [plan de la empresa,
   su nombre en `planes`, lo que dice el banner]. Con precio, el botón de siempre; sin él, «Escríbenos». */
const ALIAS = [
  ['pro', 'completo', 'Pro'],
  ['basico', 'operacion', 'Básico'],
  ['flota', 'completo', 'Flota'],
  ['COMPLETO', 'completo', 'Pro'],
  ['Pro', 'completo', 'Pro'],
  ['reparto', 'reparto', 'Reparto'],
]
for (const [plan, canon, nombre] of ALIAS) {
  test(`Alta empresa · plan «${plan}» con precio de «${canon}»: «Pasar a ${nombre}» pide el pago`, async ({ page }) => {
    const fallos = vigilar(page)
    const pedidos = await empresa(page, { plan, status: 'trial', days_left: 5, required: false }, ['autonomo', canon])
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: `Pasar a ${nombre}` }).click()
    await expect.poll(() => pedidos.length).toBe(1)
    expect(pedidos[0]).toEqual({ plan, anual: false })
    await expect(page.getByRole('link', { name: 'Escríbenos y te lo activamos' })).toHaveCount(0)
    expect(fallos).toEqual([])
  })

  test(`Alta empresa · plan «${plan}» sin precio: «Escríbenos» con el asunto «Activar plan ${nombre}»`, async ({ page }) => {
    const fallos = vigilar(page)
    const pedidos = await empresa(page, { plan, status: 'trial', days_left: 5, required: false }, ['autonomo'])
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const escribenos = page.getByRole('link', { name: 'Escríbenos y te lo activamos' })
    await expect(escribenos).toBeVisible({ timeout: 15000 })
    await expect(escribenos).toHaveAttribute('href', `/contacto?asunto=${encodeURIComponent(`Activar plan ${nombre}`)}`)
    await expect(page.getByRole('button', { name: `Pasar a ${nombre}` })).toHaveCount(0)
    expect(pedidos).toEqual([])
    expect(fallos).toEqual([])
  })
}

/* Empresa/Enterprise es a medida: siempre por contacto («Contactar»), nunca «sin precio» ni «Escríbenos». El servidor
   lleva 'enterprise' a 'holding', y las dos (y en mayúsculas) son lo mismo. */
for (const [plan, nombre] of [['enterprise', 'Enterprise'], ['Enterprise', 'Enterprise'], ['holding', 'Empresa'], ['HOLDING', 'Empresa']]) {
  test(`Alta empresa · plan «${plan}»: «Contactar (${nombre})», a medida, sin pago`, async ({ page }) => {
    const fallos = vigilar(page)
    const pedidos = await empresa(page, { plan, status: 'trial', days_left: 5, required: false }, ['autonomo'])
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    const boton = page.getByRole('button', { name: `Contactar (${nombre})` })
    await expect(boton).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: 'Escríbenos y te lo activamos' })).toHaveCount(0)
    await boton.click()
    await expect(page).toHaveURL(/\/contacto\?asunto=Enterprise/)
    expect(pedidos).toEqual([])
    expect(fallos).toEqual([])
  })
}

test('Alta empresa · 400 porque el precio se quitó entre medias: vuelve a mirar los planes y lleva al contacto', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidos = await empresa(page, { status: 'trial', days_left: 5, required: false }, ['autonomo', 'completo'],
    { planesDespues: ['autonomo'], suscripcion: { status: 400, json: { detail: 'texto cualquiera' } } })
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Pasar a Pro' }).click()
  await expect(page).toHaveURL(/\/contacto\?asunto=Activar%20plan%20Pro/)
  expect(pedidos.length).toBe(1)
  await expect(page.getByText(/texto cualquiera/)).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* Cualquier otro error del pago: aviso en el propio banner, con el enlace de contacto; ni «Activar plan» ni diálogos. */
const ERRORES = [
  { nombre: '400 que no es de precio', suscripcion: { status: 400, json: { detail: 'Esta cuenta no tiene suscripción que pagar' } } },
  { nombre: '502 de Stripe', suscripcion: { status: 502, json: { detail: 'Stripe no responde' } } },
]
for (const e of ERRORES) {
  test(`Alta empresa · ${e.nombre}: aviso en pantalla, sin ir a «Activar plan» y sin diálogo`, async ({ page }) => {
    const fallos = vigilar(page)
    const pedidos = await empresa(page, { status: 'trial', days_left: 5, required: false }, ['autonomo', 'completo'],
      { suscripcion: e.suscripcion })
    await page.goto('/panel', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Pasar a Pro' }).click()
    const aviso = page.getByRole('alert').filter({ hasText: 'No se ha podido abrir el pago. Inténtalo en un momento o escríbenos.' })
    await expect(aviso).toBeVisible({ timeout: 15000 })
    await expect(aviso.getByRole('link', { name: 'Contactar' })).toHaveAttribute('href', '/contacto?asunto=Activar%20plan%20Pro')
    await expect(page).toHaveURL(/\/panel/)
    expect(pedidos.length).toBe(1)
    await expect(page.getByText(e.suscripcion.json.detail)).toHaveCount(0)
    expect(fallos).toEqual([])
  })
}

test('Alta empresa · quien reparte solo sigue pagando lo suyo igual (plan «autonomo»)', async ({ page }) => {
  const fallos = vigilar(page)
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 7 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'trial', days_left: 7, trial_ends: fin, falta_tarjeta: true,
    bloqueo: 'Añade tu tarjeta para empezar los 7 días gratis (hoy no se cobra nada).', cobro_al_suscribir: fin } }))
  await page.route(/\/api\/billing\/config/, (r) => r.fulfill({ json: { provider: 'stripe', ready: true, pago_en_app: false, planes: ['autonomo'], checkout: {} } }))
  await page.route(/\/api\/reparto\/mi-ruta/, (r) => r.fulfill({ json: { activo: true, autonomo: true, fecha: '2026-10-04', pedidos: [], jornada: {}, aviso_aceptado: true } }))
  const pedidos = []
  await page.route(/\/api\/billing\/stripe\/suscripcion/, async (r) => { pedidos.push(r.request().postDataJSON()); await r.fulfill({ json: { url: '/ruta?pago=cancelado' } }) })
  // Con su sector, el panel le lleva a su app (PanelLayout): el banner del panel no es su sitio de pagar.
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/ruta/, { timeout: 15000 })
  await page.getByRole('button', { name: 'Añadir tarjeta: hoy 0 €' }).click()
  await expect.poll(() => pedidos.length).toBe(1)
  expect(pedidos[0]).toEqual({ plan: 'autonomo', anual: false })
  await expect(page.getByText('Escríbenos y te lo activamos')).toHaveCount(0)
  expect(fallos).toEqual([])
})

/* Donde quien reparte solo SÍ ve el banner del panel: una cuenta con plan «autonomo» y otro sector (las de antes del
   sector, que el servidor sigue tratando como autónomo por el plan). Su botón de siempre, no «Escríbenos». */
test('Alta empresa · plan «autonomo» en el panel: el banner enseña «Pasar a Repartidor» y paga «autonomo»', async ({ page }) => {
  const fallos = vigilar(page)
  const pedidos = await empresa(page, { plan: 'autonomo', sector: 'mensajeria', status: 'trial', days_left: 5, required: false }, ['autonomo'])
  await page.goto('/panel', { waitUntil: 'domcontentloaded' })
  const boton = page.getByRole('button', { name: 'Pasar a Repartidor' })
  await expect(boton).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('link', { name: 'Escríbenos y te lo activamos' })).toHaveCount(0)
  await boton.click()
  await expect.poll(() => pedidos.length).toBe(1)
  expect(pedidos[0]).toEqual({ plan: 'autonomo', anual: false })
  expect(fallos).toEqual([])
})
