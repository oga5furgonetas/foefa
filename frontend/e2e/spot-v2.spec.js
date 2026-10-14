import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* MATERIAL LIMPIO DE LA APP PARA EL SPOT V2 (14-10-2026). Como spot-material.spec.js, pero a 720×1280
   (más nítido dentro del móvil del spot), sin rótulos, y con dos escenas más: «Entregado» y «Mi dinero
   hoy». Lo que se ve es la app de verdad con la API simulada (trazado real de A Coruña).
   Uso: npx playwright test spot-v2 --project=escritorio --update-snapshots
   Salida: test-results/spot-v2/es.webm + es.json (instantes de cada escena). */

const REAL = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-real.json'), 'utf8'))
const YO = { latitude: 43.3636, longitude: -8.4118 }
const pedidos0 = () => [
  { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.363889, lng: -8.409899, franja: ['10:00', '12:00'] },
  { id: 'p2', cliente: 'Lucía M.', direccion: 'Rúa Emilia Pardo Bazán 14, A Coruña', telefono: '600000002', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.363999, lng: -8.407109 },
  { id: 'p3', cliente: 'Bar Pepe', direccion: 'Rúa Marcial del Adalid 5, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 2, orden: 3, eta: '10:24', lat: 43.36219, lng: -8.407002 },
  { id: 'p4', cliente: 'Kiosko Luz', direccion: 'Rúa San Andrés 30, A Coruña', estado: 'entregado', bultos: 1, orden: 4, cobrado_importe: 12, cobrado_metodo: 'tarjeta', cerrado_en: '2026-10-02T08:00:00Z' },
  { id: 'p5', cliente: 'Óptica Mar', direccion: 'Rúa Real 22, A Coruña', estado: 'entregado', bultos: 1, orden: 5, cerrado_en: '2026-10-02T08:20:00Z' },
]

let t0 = 0
const marcas = []
const marca = (texto) => marcas.push({ t: (Date.now() - t0) / 1000, texto })

test.use({
  timezoneId: 'Europe/Madrid', locale: 'es-ES', viewport: { width: 720, height: 1280 }, deviceScaleFactor: 2,
  video: { mode: 'on', size: { width: 720, height: 1280 } },
})

test('grabar material limpio para el spot v2', async ({ page, context }, testInfo) => {
  test.skip(!['all', 'changed'].includes(testInfo.config.updateSnapshots), 'solo con --update-snapshots')
  t0 = Date.now(); marcas.length = 0
  test.setTimeout(420_000)
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 2, anuncios: false, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('fds_tour_ruta', '1')
    localStorage.setItem('fds_aviso_manana', '1')
  })
  await page.clock.install({ time: new Date('2026-10-02T09:32:00+02:00') })
  await page.clock.resume()
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(YO)
  const fin = new Date(Date.now() + 80 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, status: 'trial', days_left: 80, promo: { activa: true, hasta: '2026-12-31' } } }))
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: { codigo: 'FDS123', invitados: 0, premiados: 0, saldo: 0, ganado: 0, por_invitado: 1000, promo_hasta: '2026-10-31', promo_cent: 1000, retirada_min: 6000 } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: REAL.trazado }))
  await page.route(/\/api\/reparto\/mi-ruta\/navegar/, (r) => r.fulfill({ json: REAL.navegar }))
  await page.route(/\/api\/reparto\/tarifa/, (r) => r.fulfill({ json: { parada: 1.8, dia: 0, km: 0.12 } }))
  let pedidos = pedidos0()
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => {
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: 'entregado', cerrado_en: new Date().toISOString() } : p))
    await r.fulfill({ json: {} })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: false, jornada: { empezada: '2026-10-02T07:40:00Z' }, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: REAL.trazado.km, trafico: true }, pedidos, ganancias: { pago_parada: 180, pago_dia: 0, coste_km: 12 } } }))

  // 1. La lista de hoy.
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Solo necesarias' }).click({ timeout: 2500 }).catch(() => {})
  await page.waitForTimeout(900)
  marca('lista')
  await page.waitForTimeout(2200)

  // 2. Pedido nuevo (lo que abre la foto a la etiqueta).
  await page.getByRole('button', { name: 'Más formas de añadir' }).click({ timeout: 2500 }).catch(() => {})
  await page.getByRole('button', { name: 'Añadir un pedido sin código' }).click()
  await page.waitForTimeout(500)
  marca('etiqueta')
  await page.waitForTimeout(2600)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Cerrar$/ }).first().click({ timeout: 2500 }).catch(() => {})
  await page.waitForTimeout(500)

  // 3. El mapa con el trazado real.
  await page.getByRole('group').getByRole('button').nth(1).click()
  const contenedor = page.locator('.leaflet-container').first()
  await contenedor.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 160))
  marca('mapa')
  await page.waitForTimeout(3400)
  await page.evaluate(() => window.scrollTo(0, 0))

  // 4. La navegación por voz.
  await page.getByRole('button', { name: 'Empezar a navegar' }).click()
  await context.setGeolocation({ latitude: 43.36361, longitude: -8.41181 })
  const nav = page.getByRole('dialog')
  await expect(nav.getByTestId('guia-texto')).toBeVisible()
  marca('navegacion')
  await page.waitForTimeout(1500)
  await context.setGeolocation({ latitude: 43.3638, longitude: -8.4108 })
  await page.waitForTimeout(1500)
  await context.setGeolocation({ latitude: 43.363889, longitude: -8.409899 })
  await page.waitForTimeout(1200)

  // 5. Entregado.
  marca('entregado')
  await nav.getByRole('button', { name: /^Entregado$/ }).click({ force: true })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /^Entregar sin foto$/ }).click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(1600)
  // Tras entregar, la guía pasa a la siguiente parada (sin la X al estar «llegado»): se vuelve a la lista recargando.
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Solo necesarias' }).click({ timeout: 2500 }).catch(() => {})
  await page.waitForTimeout(900)

  // 6. Mi dinero hoy.
  const dinero = page.getByRole('button', { name: 'Mi dinero hoy' }).first()
  if (await dinero.count()) {
    await dinero.scrollIntoViewIfNeeded()
    await dinero.click({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(600)
    marca('dinero')
    await page.waitForTimeout(3000)
  } else {
    marca('dinero')
    await page.waitForTimeout(3000)
  }

  marca('fin')
  await page.waitForTimeout(500)
  const destino = path.join(process.cwd(), 'test-results', 'spot-v2')
  fs.mkdirSync(destino, { recursive: true })
  await context.close()
  const v = await page.video().path()
  fs.copyFileSync(v, path.join(destino, 'es.webm'))
  fs.writeFileSync(path.join(destino, 'es.json'), JSON.stringify({ marcas, fin: (Date.now() - t0) / 1000 }, null, 1))
})
