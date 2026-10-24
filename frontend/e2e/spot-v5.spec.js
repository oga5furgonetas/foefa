import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* MATERIAL DE LA APP PARA EL SPOT V5 (24-10-2026). Como el v4, pero con un DÍA DE REPARTO creíble: 15 paradas
   en calles reales de A Coruña con su ruta por carretera (fixtures/coruna-dia.json, de scripts/spot-v5/ruta.py),
   el desplazamiento de la lista ordenada con la hora de cada parada y el punto azul avanzando en la guía.
   ── Lo de abajo es el v4, adaptado ──
   MATERIAL DE LA APP PARA EL SPOT V4 (24-10-2026). Dani: «parece una app del 2001: estudia cómo funcionan
   los anuncios y hazlo». Los anuncios de apps que funcionan en TikTok/Reels enseñan la app A PANTALLA
   COMPLETA y nítida, haciendo el trabajo, con cortes rápidos. Aquí se graba la app de verdad (API simulada,
   trazado real de A Coruña) con el screencast de Chrome a 1080 px de ancho —la grabación de vídeo de
   Playwright solo da 720 y se ve borrosa al ampliarla— y se apunta dónde y cuándo se toca cada cosa para
   hacer zoom y marcar el toque en el montaje (scripts/montar-spot-v4.mjs).
   Uso: npx playwright test spot-v4 --project=escritorio --update-snapshots
   Salida: test-results/spot-v4/frames/*.jpg + marcas.json */

const REAL = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-real.json'), 'utf8'))
const DIA = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-dia.json'), 'utf8'))
const YO = { latitude: 43.3636, longitude: -8.4118 }
const ANCHO = 393
const DSF = 1080 / ANCHO
const SALIDA = path.join(process.cwd(), 'test-results', 'spot-v5')
const ETIQUETA = path.join(process.cwd(), '..', 'docs', 'anuncios', 'reales', 'spot-v4', 'etiqueta.png')

// Antes de ordenar: 14 paradas metidas, desordenadas y sin hora (Bar Pepe entra luego por la foto de la etiqueta).
const ORDENADAS = DIA.paradas_ordenadas.map((p) => ({ ...p, estado: 'pendiente', bultos: p.id === 'p3' ? 2 : 1 }))
const P3 = { ...ORDENADAS.find((p) => p.id === 'p3') }
delete P3.orden; delete P3.eta
const SIN_ORDEN = (() => {
  const l = ORDENADAS.filter((p) => p.id !== 'p3').map(({ orden, eta, ...p }) => p)
  // Un desorden fijo (no aleatorio: la grabación tiene que salir igual cada vez).
  return [5, 11, 0, 8, 3, 13, 1, 9, 6, 12, 2, 10, 4, 7].map((i) => l[i]).filter(Boolean)
})()
const HECHAS = [
  { id: 'h1', cliente: 'Kiosko Luz', direccion: 'Rúa San Andrés 30, A Coruña', estado: 'entregado', bultos: 1, orden: 0, cerrado_en: '2026-10-02T07:20:00Z' },
]

test.use({
  timezoneId: 'Europe/Madrid', locale: 'es-ES', viewport: { width: ANCHO, height: 852 },
  hasTouch: true, video: 'off', launchOptions: { args: [`--force-device-scale-factor=${DSF}`] },
})

test('grabar un día de reparto para el spot v5', async ({ page, context }, testInfo) => {
  test.skip(!['all', 'changed'].includes(testInfo.config.updateSnapshots), 'solo con --update-snapshots')
  test.setTimeout(300_000)
  fs.rmSync(SALIDA, { recursive: true, force: true })
  fs.mkdirSync(path.join(SALIDA, 'frames'), { recursive: true })
  const marcas = []
  const marca = (texto, extra = {}) => marcas.push({ t: Date.now() / 1000, texto, ...extra })
  // Dónde está lo que se va a tocar, en píxeles del fotograma (para el zoom y el círculo del toque).
  const toque = async (loc, texto) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {})
    const b = await loc.boundingBox()
    if (b) marca(texto, { x: Math.round((b.x + b.width / 2) * DSF), y: Math.round((b.y + b.height / 2) * DSF) })
    await loc.click({ timeout: 8000 })
    console.log('toque', texto)
  }

  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('fds_tour_ruta', '1')
    localStorage.setItem('fds_aviso_manana', 'si')
    // Tema oscuro: en el anuncio se ve más «app» y contrasta con los rótulos.
    localStorage.setItem('panel_theme', 'dark')
    localStorage.setItem('panel_theme_elegido', '1')
  })
  await page.clock.install({ time: new Date('2026-10-02T09:32:00+02:00') })
  await page.clock.resume()
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(YO)
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', pais: 'es', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, status: 'active', promo: { activa: true, hasta: '2026-12-31' } } }))
  await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: { codigo: 'FDS123', invitados: 0, premiados: 0, saldo: 0, ganado: 0, por_invitado: 1000 } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: DIA.trazado }))
  await page.route(/\/api\/reparto\/mi-ruta\/navegar/, (r) => r.fulfill({ json: REAL.navegar }))
  await page.route(/\/api\/reparto\/tarifa/, (r) => r.fulfill({ json: { parada: 1.8, dia: 0, km: 0.12 } }))
  // La foto de la etiqueta: lo que devuelve la lectura (en producción la hace el móvil o la IA).
  await page.route(/\/api\/reparto\/ticket/, async (r) => {
    await new Promise((ok) => setTimeout(ok, 700))
    await r.fulfill({ json: { cliente: 'Bar Pepe', direccion: 'Rúa Marcial del Adalid 5', cp: '15005', localidad: 'A Coruña', telefono: '600000001', bultos: 2 } })
  })
  let pedidos = [...SIN_ORDEN, ...HECHAS]
  let ordenada = false
  await page.route(/\/api\/reparto\/mis-pedidos$/, async (r) => {
    if (r.request().method() === 'POST') { pedidos = [...SIN_ORDEN.slice(0, 3), P3, ...SIN_ORDEN.slice(3), ...HECHAS]; return r.fulfill({ json: { ...P3 } }) }
    return r.fallback()
  })
  await page.route(/\/api\/reparto\/mi-ruta\/ordenar/, async (r) => {
    await new Promise((ok) => setTimeout(ok, 900))
    ordenada = true
    pedidos = [...ORDENADAS, ...HECHAS]
    await r.fulfill({ json: { ordenados: ORDENADAS.length, ruta: { fin: DIA.fin, minutos: DIA.trazado.minutos, km: DIA.trazado.km, fuente: 'osrm' } } })
  })
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => {
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: 'entregado', cerrado_en: new Date().toISOString() } : p))
    await r.fulfill({ json: {} })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: true, jornada: { empezada: '2026-10-02T07:40:00Z' }, aviso_aceptado: true,
    base: null, ruta: ordenada ? { fin: DIA.fin, minutos: DIA.trazado.minutos, km: DIA.trazado.km, trafico: true } : null, pedidos,
    ganancias: { pago_parada: 180, pago_dia: 0, coste_km: 12 } } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Solo necesarias' }).click({ timeout: 2000 }).catch(() => {})
  await expect(page.getByRole('button', { name: /Ordenar ruta/ }).first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1200)

  // El screencast de Chrome: un JPG por cada vez que la pantalla cambia, a 1080 px de ancho.
  const cdp = await context.newCDPSession(page)
  const indice = []
  let n = 0
  cdp.on('Page.screencastFrame', async (f) => {
    const nombre = `${String(n++).padStart(5, '0')}.jpg`
    fs.writeFileSync(path.join(SALIDA, 'frames', nombre), Buffer.from(f.data, 'base64'))
    indice.push({ f: nombre, t: f.metadata.timestamp })
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 2400, everyNthFrame: 1 })
  await page.waitForTimeout(600)
  marca('inicio')
  await page.waitForTimeout(1600)

  // 1. Foto a la etiqueta → se rellena el pedido.
  // Con la jornada empezada, lo de añadir va plegado en «+» (Añadir paradas).
  await toque(page.getByRole('button', { name: 'Añadir paradas' }).first(), 'tap_mas')
  await page.waitForTimeout(900)
  // «Foto etiqueta» abre la cámara del móvil (un selector de fichero): se le da la foto de la etiqueta.
  // Es una etiqueta <label> con el <input type=file> dentro: se marca el toque y se le da el fichero.
  const hoja = page.getByRole('dialog', { name: 'Añadir paradas' })
  const boton = hoja.getByText('Foto etiqueta').first()
  const bb = await boton.boundingBox()
  if (bb) marca('tap_foto', { x: Math.round((bb.x + bb.width / 2) * DSF), y: Math.round((bb.y + bb.height / 2) * DSF) })
  await page.waitForTimeout(250)
  await hoja.locator('input[type="file"][capture="environment"]').first().setInputFiles(ETIQUETA)
  marca('foto')
  await expect(page.getByRole('button', { name: /Añadir a mi ruta/ })).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(200)
  marca('leido')
  await page.waitForTimeout(2200)
  await toque(page.getByRole('checkbox').last(), 'tap_revisar').catch((e) => console.log('sin casilla', e.message.slice(0, 80)))
  await page.waitForTimeout(700)
  await toque(page.getByRole('button', { name: /Añadir a mi ruta/ }), 'tap_anadir')
  await page.waitForTimeout(1600)
  marca('lista3')
  await page.waitForTimeout(1000)

  // 2. Ordenar ruta.
  await toque(page.getByRole('button', { name: /Ordenar ruta/ }).first(), 'tap_ordenar')
  await page.waitForTimeout(400)
  marca('ordenando')
  await expect(page.getByText(/Ruta ordenada por tiempo/)).toBeVisible({ timeout: 10000 })
  marca('ordenada')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(1400)
  marca('baja_lista')
  for (let i = 0; i < 70; i++) { await page.mouse.wheel(0, 14); await page.waitForTimeout(28) }
  marca('lista_abajo')
  await page.waitForTimeout(900)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(500)

  // 3. El mapa con la ruta.
  const mapa = page.getByRole('button', { name: /^Mapa$/ }).first()
  if (await mapa.count()) {
    await toque(mapa, 'tap_mapa')
    await page.waitForTimeout(500)
    const cont = page.locator('.leaflet-container').first()
    await cont.scrollIntoViewIfNeeded().catch(() => {})
    await page.evaluate(() => window.scrollBy(0, 120))
    marca('mapa')
    await page.waitForTimeout(3000)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(300)
  }

  // 4. La guía por voz.
  await toque(page.getByRole('button', { name: 'Empezar a navegar' }).first(), 'tap_navegar')
  // La guía pide la ruta cuando le llega una posición nueva.
  await context.setGeolocation({ latitude: 43.36361, longitude: -8.41181 })
  const nav = page.getByRole('dialog')
  await expect(nav.getByTestId('guia-texto')).toBeVisible({ timeout: 15000 })
  marca('navegacion')
  await page.waitForTimeout(1200)
  const linea = DIA.navegar.linea
  for (let i = 1; i < linea.length; i += 2) {
    await context.setGeolocation({ latitude: linea[i][0], longitude: linea[i][1] })
    await page.waitForTimeout(260)
  }
  await context.setGeolocation({ latitude: 43.363889, longitude: -8.409899 })
  await page.waitForTimeout(1500)
  marca('llegada')
  await page.waitForTimeout(800)

  // 5. Entregado.
  await toque(nav.getByRole('button', { name: /^Entregado$/ }), 'tap_entregado').catch(() => {})
  await page.waitForTimeout(600)
  await page.waitForTimeout(500)
  await toque(page.getByRole('button', { name: /^Entregar sin foto$/ }), 'tap_sin_foto').catch(() => {})
  marca('entregado')
  await page.waitForTimeout(2200)
  marca('fin')

  await cdp.send('Page.stopScreencast').catch(() => {})
  await page.waitForTimeout(300)
  fs.writeFileSync(path.join(SALIDA, 'marcas.json'), JSON.stringify({ marcas, frames: indice, ancho: 1080 }, null, 1))
  expect(indice.length).toBeGreaterThan(30)
})
