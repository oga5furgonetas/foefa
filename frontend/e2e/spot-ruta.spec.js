import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* MATERIAL DE LA APP PARA EL ANUNCIO «LA RUTA HECHA» (29-10-2026, docs/anuncios/super-anuncio/GUION.md).
   Como el spot v5 (un día de reparto creíble: 15 paradas reales de A Coruña, fixtures/coruna-dia.json), más lo
   que pidió Dani: ESCANEAR el paquete y que la parada entre sola (la «cámara» es un lienzo con códigos Aztec
   Geopost sin ninguna marca, leídos por el lector propio de la app, como en escaneo-real.spec.js), las ZONAS DE
   CARGA Y DESCARGA encendiéndose en el mapa, y la entrega CON PRUEBA (foto).
   Uso: cd frontend && npx playwright test spot-ruta --project=escritorio --update-snapshots
   Salida: test-results/spot-ruta/frames/*.jpg + marcas.json */

const REAL = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-real.json'), 'utf8'))
const DIA = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-dia.json'), 'utf8'))
const YO = { latitude: 43.3636, longitude: -8.4118 }
const ANCHO = 393
const DSF = 1080 / ANCHO
const SALIDA = path.join(process.cwd(), 'test-results', 'spot-ruta')
const ETIQUETA = path.join(process.cwd(), '..', 'docs', 'anuncios', 'reales', 'spot-v4', 'etiqueta.png')
const FOTO_ENTREGA = path.join(process.cwd(), '..', 'docs', 'anuncios', 'super-anuncio', 'stills', 'plano-3-etiqueta-desenfocada.jpg')

const ORDENADAS = DIA.paradas_ordenadas.map((p) => ({ ...p, estado: 'pendiente', bultos: p.id === 'p3' ? 2 : 1 }))
const sinOrden = (id) => { const { orden, eta, ...p } = ORDENADAS.find((x) => x.id === id); return p }
// Dos paradas entran ESCANEANDO (p14 y p9), una por FOTO (p3, Bar Pepe); las otras 12 ya están cargadas.
const ESCANEADAS = ['p14', 'p9'].map(sinOrden)
const P3 = sinOrden('p3')
const SIN_ORDEN = (() => {
  const l = ORDENADAS.filter((p) => !['p3', 'p14', 'p9'].includes(p.id)).map(({ orden, eta, ...p }) => p)
  return [5, 11, 0, 8, 3, 1, 9, 6, 2, 10, 4, 7].map((i) => l[i]).filter(Boolean)
})()
const HECHAS = [
  { id: 'h1', cliente: 'Kiosko Luz', direccion: 'Rúa San Andrés 30, A Coruña', estado: 'entregado', bultos: 1, orden: 0, cerrado_en: '2026-10-02T07:20:00Z' },
]
// Zonas de carga y descarga cerca de las paradas (lo que devuelve /zonas-carga: OpenStreetMap).
const ZONAS = [
  ['Rúa Juan Flórez', 43.36430, -8.40850, 'L-V 8-20 h', '30 min'], ['Rúa Emilia Pardo Bazán', 43.36395, -8.40740, 'L-S 9-14, 16-20 h', '20 min'],
  ['Rúa Marcial del Adalid', 43.36230, -8.40690, 'L-V 8-20 h', '30 min'], ['Rúa Cidade de Lugo', 43.36470, -8.41080, 'L-V 8-14 h', '15 min'],
  ['Rúa Pérez Cepeda', 43.36560, -8.41270, 'L-S 8-20 h', '30 min'], ['Rúa Fernando Macías', 43.36620, -8.41190, 'L-V 9-20 h', '20 min'],
  ['Rúa Alfredo Vicenti', 43.36700, -8.41020, 'L-S 8-20 h', '30 min'], ['Rúa Sinfónica de Galicia', 43.36370, -8.40960, 'L-V 8-14 h', '15 min'],
].map(([calle, lat, lng, horario, maximo], i) => ({ id: `z${i + 1}`, lat, lng, calle, horario, maximo }))

// Las etiquetas que se escanean: Aztec «Geolabel» (SEUR/DPD) + barra del bulto, SIN marca de ninguna empresa.
const GS = '\x1d', RS = '\x1e', US = '\x1f', EOT = '\x04'
const geopost = ({ cp, id, calle, portal, piso, nombre, tel, lat, lng }) =>
  `[)>${RS}01${GS}03${GS}${cp}${GS}724${GS}101${GS}${id}${GS}GEOP${GS}${GS}298${GS}${GS}001/001${GS}01.50KG${GS}N${GS}` +
  `${calle}${GS}A Coruña${GS}${GS}${RS}07${GS}G03${GS}0${GS}0${GS}1${GS}${['', '', nombre, tel, '', '', '', portal, piso].join(US)}${GS}${GS}${RS}` +
  `07${GS}S081${GS}${lat >= 0 ? '+' : '-'}${Math.abs(lat).toFixed(4)}${GS}${lng >= 0 ? '+' : '-'}${String(Math.abs(lng).toFixed(4)).padStart(8, '0')}${GS}1${GS}G${RS}${EOT}`
const ETIQUETAS = [
  { aztec: geopost({ cp: '15004', id: '05123456789014', calle: 'Rúa Cidade de Lugo', portal: '15', piso: '3º A', nombre: 'Elena F.', tel: '+34612345614', lat: 43.3648, lng: -8.4110 }), barra: '%0015004051234567890141017240' },
  { aztec: geopost({ cp: '15005', id: '05123456789009', calle: 'Rúa Pérez Cepeda', portal: '20', piso: 'Bajo', nombre: 'Ferretería', tel: '+34612345609', lat: 43.3655, lng: -8.4129 }), barra: '%0015005051234567890091017240' },
]
const imagenes = []

// Sin red no hay teselas de OpenStreetMap: un callejero esquemático y limpio (manzanas, calles blancas, parques),
// continuo entre teselas, para que el mapa no salga gris en la grabación. En producción el mapa es el de OSM.
const hash = (n) => { let t = (Math.imul(n | 0, 2654435761) >>> 0); t ^= t >>> 13; t = Math.imul(t, 0x5bd1e995) >>> 0; return ((t ^ (t >>> 15)) >>> 0) / 4294967296 }
const tileSvg = (z, x, y) => {
  const gx0 = x * 256, gy0 = y * 256
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ece8df"/>`
  const PX = 96, PY = 118
  // Parques y manzanas destacadas.
  for (let i = Math.floor(gx0 / PX) - 1; i <= Math.floor((gx0 + 256) / PX) + 1; i++) {
    for (let j = Math.floor(gy0 / PY) - 1; j <= Math.floor((gy0 + 256) / PY) + 1; j++) {
      const r = hash(i * 7919 + j * 104729 + z * 13)
      if (r < 0.11) s += `<rect x="${i * PX - gx0 + 6}" y="${j * PY - gy0 + 6}" width="${PX - 12}" height="${PY - 12}" rx="6" fill="#cfe3c2"/>`
      else if (r < 0.2) s += `<rect x="${i * PX - gx0 + 10}" y="${j * PY - gy0 + 10}" width="${PX - 20}" height="${PY - 20}" rx="4" fill="#e2ddd3"/>`
    }
  }
  const calle = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d2cdc2" stroke-width="${w + 3}" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="${w}" stroke-linecap="round"/>`
  for (let i = Math.floor(gx0 / PX) - 1; i <= Math.floor((gx0 + 256) / PX) + 1; i++) {
    const X = i * PX + (hash(i * 31 + 5) - 0.5) * 26 - gx0
    s += calle(X, -10, X + (hash(i * 17 + 3) - 0.5) * 18, 266, i % 5 === 0 ? 13 : 6)
  }
  for (let j = Math.floor(gy0 / PY) - 1; j <= Math.floor((gy0 + 256) / PY) + 1; j++) {
    const Y = j * PY + (hash(j * 37 + 11) - 0.5) * 30 - gy0
    s += calle(-10, Y, 266, Y + (hash(j * 23 + 7) - 0.5) * 18, j % 4 === 0 ? 13 : 6)
  }
  // Una avenida diagonal cada 1 600 px.
  const D = 1600
  for (let k = Math.floor((gx0 + gy0) / D) - 1; k <= Math.floor((gx0 + 256 + gy0 + 256) / D) + 1; k++) {
    const c = k * D
    s += calle(c - gy0 - gx0 + 0, 0, c - gy0 - gx0 - 256, 256, 16)
  }
  return s + '</svg>'
}

test.use({
  timezoneId: 'Europe/Madrid', locale: 'es-ES', viewport: { width: ANCHO, height: 852 },
  hasTouch: true, video: 'off', launchOptions: { args: [`--force-device-scale-factor=${DSF}`] },
})

test.beforeAll(async () => {
  const require = createRequire(import.meta.url)
  const entrada = require.resolve('zxing-wasm/full')
  const z = await import(pathToFileURL(entrada).href)
  await z.prepareZXingModule({ overrides: { wasmBinary: fs.readFileSync(entrada.replace(/dist[\\/].*$/, 'dist/full/zxing_full.wasm')) }, fireImmediately: true })
  for (const e of ETIQUETAS) {
    const par = []
    for (const [format, texto, scale] of [['Aztec', e.aztec, 5], ['Code128', e.barra, 3]]) {
      const w = await z.writeBarcode(texto, { format, scale })
      if (w.error) throw new Error(`${format}: ${w.error}`)
      par.push(`data:image/png;base64,${Buffer.from(await w.image.arrayBuffer()).toString('base64')}`)
    }
    imagenes.push(par)
  }
})

test('grabar la app para el anuncio «La ruta hecha»', async ({ page, context }, testInfo) => {
  test.skip(!['all', 'changed'].includes(testInfo.config.updateSnapshots), 'solo con --update-snapshots')
  test.setTimeout(420_000)
  fs.rmSync(SALIDA, { recursive: true, force: true })
  fs.mkdirSync(path.join(SALIDA, 'frames'), { recursive: true })
  const marcas = []
  const marca = (texto, extra = {}) => { marcas.push({ t: Date.now() / 1000, texto, ...extra }); console.log('marca', texto) }
  const toque = async (loc, texto, opts = {}) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {})
    const b = await loc.boundingBox()
    if (b) marca(texto, { x: Math.round((b.x + b.width / 2) * DSF), y: Math.round((b.y + b.height / 2) * DSF) })
    await loc.click({ timeout: 8000, ...opts })
  }

  await page.addInitScript((urls) => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('fds_tour_ruta', '1')
    localStorage.setItem('fds_aviso_manana', 'si')
    localStorage.setItem('panel_theme', 'dark')
    localStorage.setItem('panel_theme_elegido', '1')
    localStorage.setItem('ruta_zonas_carga', '0')   // se encienden en el anuncio
    for (const c of ['ordenar', 'hueco', 'ir_con']) localStorage.setItem(`consejo_${c}`, 'visto')   // sin consejos: distraen en el anuncio
    delete window.BarcodeDetector                   // el lector propio (zxing), como en iPhone
    window.__etq = -1                               // -1: visor sin código todavía; 0/1: la etiqueta que se escanea
    navigator.mediaDevices.getUserMedia = async () => {
      // Lienzo VERTICAL (como se ve en el móvil): una caja marrón con la etiqueta blanca y los códigos centrados.
      const c = document.createElement('canvas'); c.width = 720; c.height = 1280
      const ctx = c.getContext('2d')
      const imgs = await Promise.all(urls.map((par) => Promise.all(par.map(async (u) => { const i = new Image(); i.src = u; await i.decode(); return i }))))
      const pintar = () => {
        ctx.fillStyle = '#9a6b3c'; ctx.fillRect(0, 0, c.width, c.height)
        ctx.fillStyle = '#8a5f33'; for (let x = 0; x < c.width; x += 9) ctx.fillRect(x, 0, 3, c.height)
        ctx.fillStyle = '#fff'; ctx.fillRect(50, 150, c.width - 100, c.height - 300)
        ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.strokeRect(50, 150, c.width - 100, c.height - 300)
        ctx.fillStyle = '#111'; ctx.textAlign = 'center'
        ctx.font = 'bold 34px Arial'; ctx.fillText('ENVÍO ESTÁNDAR · 24 h', c.width / 2, 215)
        ctx.font = '24px Arial'; ctx.fillText('DESTINATARIO · 1/1 · 1,50 KG · REF 298', c.width / 2, 258)
        ctx.fillRect(80, 280, c.width - 160, 3)
        ctx.font = '22px Arial'; ctx.fillText('Entregar en horario de mañana.', c.width / 2, 1085)
        ctx.fillRect(80, 1020, c.width - 160, 3)
        const par = imgs[window.__etq]
        if (par) {
          const [az, barra] = par
          const s = Math.min(1, 440 / az.width)
          const aw = az.width * s, ah = az.height * s
          ctx.drawImage(az, (c.width - aw) / 2, 330, aw, ah)
          const bs = Math.min(1, 520 / barra.width)
          ctx.drawImage(barra, (c.width - barra.width * bs) / 2, 330 + ah + 60, barra.width * bs, barra.height * bs)
        }
      }
      pintar(); setInterval(pintar, 100)
      return c.captureStream(10)
    }
  }, imagenes)
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
  await page.route(/\/api\/reparto\/mi-ruta\/zonas-carga/, (r) => r.fulfill({ json: { zonas: ZONAS, incompleto: false, fuente: 'OpenStreetMap' } }))
  await page.route(/\/api\/reparto\/tarifa/, (r) => r.fulfill({ json: { parada: 1.8, dia: 0, km: 0.12 } }))
  await page.route(/\/api\/reparto\/escanear$/, async (r) => { const b = r.request().postDataJSON() || {}; await r.fulfill({ json: { encontrado: false, codigo: b.codigo || b.codigos?.[0] } }) })
  await page.route(/\/api\/reparto\/formas-codigo/, (r) => r.fulfill({ json: {} }))
  await page.route(/\/api\/reparto\/ticket/, async (r) => {
    await new Promise((ok) => setTimeout(ok, 700))
    await r.fulfill({ json: { cliente: 'Bar Pepe', direccion: 'Rúa Marcial del Adalid 5', cp: '15005', localidad: 'A Coruña', telefono: '600000001', bultos: 2 } })
  })
  let pedidos = [...SIN_ORDEN, ...HECHAS]
  let escaneos = 0
  let ordenada = false
  await page.route(/\/api\/reparto\/mis-pedidos$/, async (r) => {
    if (r.request().method() === 'POST') {
      const b = r.request().postDataJSON() || {}
      if (b.codigo || b.codigos) {           // viene del escáner
        const p = ESCANEADAS[Math.min(escaneos, ESCANEADAS.length - 1)]; escaneos++
        pedidos = [p, ...pedidos]
        return r.fulfill({ json: { ...p } })
      }
      pedidos = [...pedidos.slice(0, 3), P3, ...pedidos.slice(3)]
      return r.fulfill({ json: { ...P3 } })
    }
    return r.fallback()
  })
  await page.route(/\/api\/reparto\/mi-ruta\/ordenar/, async (r) => {
    await new Promise((ok) => setTimeout(ok, 900))
    ordenada = true
    pedidos = [...ORDENADAS, ...HECHAS]
    await r.fulfill({ json: { ordenados: ORDENADAS.length, ruta: { fin: DIA.fin, minutos: DIA.trazado.minutos, km: DIA.trazado.km, fuente: 'osrm' } } })
  })
  await page.route(/\/api\/reparto\/pedidos\/p1\/(estado|foto)/, async (r) => {
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: 'entregado', cerrado_en: new Date().toISOString() } : p))
    await r.fulfill({ json: {} })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: true, jornada: { empezada: '2026-10-02T07:40:00Z' }, aviso_aceptado: true,
    base: null, ruta: ordenada ? { fin: DIA.fin, minutos: DIA.trazado.minutos, km: DIA.trazado.km, trafico: true } : null, pedidos,
    ganancias: { pago_parada: 180, pago_dia: 0, coste_km: 12 } } }))

  // Teselas: las del mapa REAL de A Coruña si están generadas (scripts/spot-ruta/teselas.py, variable TESELAS);
  // si falta alguna (o no hay carpeta), el callejero esquemático.
  const TESELAS = process.env.TESELAS || path.join(process.cwd(), 'test-results', 'teselas')
  await page.route(/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/, (r) => {
    const m = r.request().url().match(/\/(\d+)\/(\d+)\/(\d+)\.png/)
    const real = path.join(TESELAS, m[1], m[2], `${m[3]}.jpg`)
    if (fs.existsSync(real)) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(real) })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: tileSvg(+m[1], +m[2], +m[3]) })
  })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Solo necesarias' }).click({ timeout: 2000 }).catch(() => {})
  await expect(page.getByRole('button', { name: /Ordenar ruta/ }).first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1200)

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
  await page.waitForTimeout(1200)

  // 1. ESCANEAR: dos paquetes seguidos, y la parada entra sola.
  const abrirAnadir = async () => {
    const directo = page.getByRole('button', { name: 'Escanear', exact: true })
    if (await directo.count() && await directo.first().isVisible().catch(() => false)) return directo.first()
    await toque(page.getByRole('button', { name: 'Añadir paradas' }).first(), 'tap_mas')
    await page.waitForTimeout(700)
    return page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'Escanear', exact: true })
  }
  await toque(await abrirAnadir(), 'tap_escanear')
  const visor = page.getByRole('dialog', { name: 'Escanear' })
  await expect(visor).toBeVisible({ timeout: 10000 })
  marca('visor')
  await page.waitForTimeout(900)
  await page.evaluate(() => { window.__etq = 0 })
  const anadida = page.getByRole('status').filter({ hasText: 'Añadida a tu ruta' })
  await expect(anadida).toContainText('Elena F.', { timeout: 20000 })
  marca('bip1')
  await page.waitForTimeout(1300)
  await page.evaluate(() => { window.__etq = -1 })
  await toque(page.getByRole('button', { name: 'Escanear otro' }), 'tap_otro')
  await page.waitForTimeout(500)
  await page.evaluate(() => { window.__etq = 1 })
  await expect(anadida).toContainText('Ferretería', { timeout: 20000 })
  marca('bip2')
  await page.waitForTimeout(1400)
  // Cerrar la tarjeta de «Añadida» y el visor: la lista con las dos paradas nuevas.
  await page.getByRole('button', { name: 'Cerrar' }).last().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)
  if (await visor.isVisible().catch(() => false)) await visor.getByRole('button', { name: 'Cerrar' }).first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)
  const hojaAbierta = page.getByRole('dialog', { name: 'Añadir paradas' })
  if (await hojaAbierta.isVisible().catch(() => false)) await hojaAbierta.getByRole('button', { name: 'Cerrar' }).first().click({ timeout: 3000 }).catch(() => {})
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  marca('lista_escaneo')
  await page.waitForTimeout(1400)

  // 2. FOTO a la etiqueta → se rellena el pedido (como en el v5).
  await toque(page.getByRole('button', { name: 'Añadir paradas' }).first(), 'tap_mas2')
  await page.waitForTimeout(800)
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
  await page.waitForTimeout(1800)
  await toque(page.getByRole('checkbox').last(), 'tap_revisar').catch((e) => console.log('sin casilla', e.message.slice(0, 80)))
  await page.waitForTimeout(500)
  await toque(page.getByRole('button', { name: /Añadir a mi ruta/ }), 'tap_anadir')
  await page.waitForTimeout(1500)
  marca('lista3')
  await page.waitForTimeout(900)

  // 3. ORDENAR ruta.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
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

  // 4. El MAPA y las zonas de carga y descarga.
  const mapa = page.getByRole('button', { name: /^Mapa$/ }).first()
  if (await mapa.count()) {
    await toque(mapa, 'tap_mapa')
    await page.waitForTimeout(500)
    const cont = page.locator('.leaflet-container').first()
    await cont.scrollIntoViewIfNeeded().catch(() => {})
    await page.evaluate(() => window.scrollBy(0, 120))
    marca('mapa')
    await page.waitForTimeout(1800)
    const zonas = page.getByRole('checkbox', { name: /Zonas de carga y descarga/ }).first()
    if (await zonas.count()) {
      await toque(zonas, 'tap_zonas')
      await expect(page.getByText(/cerca de tus paradas/)).toBeVisible({ timeout: 8000 }).catch(() => {})
      marca('zonas')
      await page.waitForTimeout(2600)
    } else { console.log('sin casilla de zonas'); marca('zonas') ; await page.waitForTimeout(1500) }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(300)
  }

  // 5. La GUÍA, parada a parada.
  await toque(page.getByRole('button', { name: 'Empezar a navegar' }).first(), 'tap_navegar')
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

  // 6. ENTREGADO, con prueba (foto).
  await toque(nav.getByRole('button', { name: /^Entregado$/ }), 'tap_entregado').catch(() => {})
  await page.waitForTimeout(900)
  marca('prueba')
  const dondeBtn = page.getByRole('button', { name: /En mano|Al vecino|Portería|Buzón|Puerta/ }).first()
  if (await dondeBtn.count()) { await toque(dondeBtn, 'tap_donde').catch(() => {}); await page.waitForTimeout(500) }
  const inputFoto = page.locator('input[type="file"][capture="environment"]').last()
  const lab = page.getByText('Hacer foto y entregar').first()
  const lb = await lab.boundingBox().catch(() => null)
  if (lb) marca('tap_hacer_foto', { x: Math.round((lb.x + lb.width / 2) * DSF), y: Math.round((lb.y + lb.height / 2) * DSF) })
  await page.waitForTimeout(300)
  if (await inputFoto.count()) await inputFoto.setInputFiles(FOTO_ENTREGA).catch(async (e) => { console.log('sin input foto', e.message.slice(0, 80)); await page.getByRole('button', { name: /^Entregar sin foto$/ }).click().catch(() => {}) })
  else await page.getByRole('button', { name: /^Entregar sin foto$/ }).click().catch(() => {})
  marca('entregado')
  await page.waitForTimeout(2400)
  marca('fin')

  await cdp.send('Page.stopScreencast').catch(() => {})
  await page.waitForTimeout(300)
  fs.writeFileSync(path.join(SALIDA, 'marcas.json'), JSON.stringify({ marcas, frames: indice, ancho: 1080 }, null, 1))
  expect(indice.length).toBeGreaterThan(30)
})
