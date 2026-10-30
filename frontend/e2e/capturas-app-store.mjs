// LAS CAPTURAS DE LA FICHA DE LA APP STORE (30-10-2026): Dani no tiene iPhone, así que salen de la propia app (la misma
// web que va dentro de la app de iPhone) a tamaño de iPhone 6,7" (1290×2796: 430×932 CSS a 3x), con la API simulada
// (los mismos datos que e2e/calle.spec.js y e2e/fuera.spec.js), no maquetas. En español (A Coruña) y en inglés (Seattle).
// Uso: node e2e/capturas-app-store.mjs <carpeta de salida> [es|en]   (con `vite preview --port 4174` en marcha)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

const OUT = process.argv[2]
const IDIOMA = process.argv[3] || 'es'
const BASE = process.env.BASE || 'http://localhost:4174'
mkdirSync(OUT, { recursive: true })
// El UA de la app de iPhone (lleva FDSApp/: la web la trata como app, sin «instalar» ni Google Play).
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FDSApp/2.4.1 (iOS)'
const ES = IDIOMA === 'es'
const browser = await chromium.launch()

async function contexto() {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA,
    locale: ES ? 'es-ES' : 'en-US', timezoneId: ES ? 'Europe/Madrid' : 'America/Los_Angeles',
    geolocation: ES ? { latitude: 43.3636, longitude: -8.4118 } : { latitude: 47.6062, longitude: -122.3321 }, permissions: ['geolocation'],
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
    localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('ruta_vista', 'lista'); localStorage.setItem('guia_voz', '0')
  })
  return { ctx, page }
}
// JPEG (Apple lo admite) y no PNG: el mapa en PNG pesa 1,6 MB por captura; así, unos 300 KB.
async function foto(page, nombre, espera = 900) {
  await page.waitForTimeout(espera)
  await page.screenshot({ path: join(OUT, `${nombre}.jpg`), type: 'jpeg', quality: 92 })
  console.log(nombre)
}

const RESPUESTA = ES
  ? { estare: 'no', dejar: 'porteria', franja: null, portal: '1234', nota: '2º izq, el timbre no va', cuando: '2026-10-29T09:00:00Z' }
  : { estare: 'si', dejar: '', franja: null, portal: '4521', nota: 'Ring twice', cuando: '2026-10-29T09:00:00Z' }

const PEDIDOS = ES ? [
  { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05',
    lat: 43.363889, lng: -8.409899, cliente_dice: RESPUESTA, antes: { fecha: '2026-10-21', estado: 'entregado', donde: 'porteria', nota: '' } },
  { id: 'p2', cliente: 'Lucía M.', direccion: 'Rúa Emilia Pardo Bazán 14, A Coruña', telefono: '600000002', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.363999, lng: -8.407109, cobrar: 24.5 },
  { id: 'p4', cliente: 'Café Marina', direccion: 'Avenida da Mariña 8, A Coruña', estado: 'pendiente', bultos: 3, orden: 3, eta: '10:28', lat: 43.3692, lng: -8.3940 },
  { id: 'p5', cliente: 'Kiosko Luz', direccion: 'Rúa San Andrés 30, A Coruña', estado: 'pendiente', bultos: 1, orden: 4, eta: '10:36', lat: 43.3713, lng: -8.4007, hueco: 'Detrás · der' },
  { id: 'p3', cliente: 'Bar Pepe', direccion: 'Rúa Marcial del Adalid 5, A Coruña', estado: 'entregado', bultos: 2, orden: 5, cerrado_en: '2026-10-29T09:40:00+01:00', lat: 43.3700, lng: -8.4030 },
] : [
  { id: 'p1', cliente: 'Pike Place Fish', direccion: '86 Pike St, Seattle, WA 98101', telefono: '2065550123', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05',
    lat: 47.6097, lng: -122.3422, cliente_dice: RESPUESTA, antes: { fecha: '2026-10-21', estado: 'entregado', donde: 'porteria', nota: '' } },
  { id: 'p2', cliente: 'Maria L.', direccion: '400 Broad St, Seattle, WA 98109', telefono: '2065550124', estado: 'pendiente', bultos: 2, orden: 2, eta: '10:20', lat: 47.6205, lng: -122.3493, cobrar: 24.5 },
  { id: 'p4', cliente: 'Capitol Deli', direccion: '1124 Pike St, Seattle, WA 98101', estado: 'pendiente', bultos: 3, orden: 3, eta: '10:31', lat: 47.6141, lng: -122.3289 },
  { id: 'p5', cliente: 'J. Park', direccion: '305 Harrison St, Seattle, WA 98109', estado: 'pendiente', bultos: 1, orden: 4, eta: '10:40', lat: 47.6218, lng: -122.3515, hueco: 'Back · right' },
  { id: 'p3', cliente: 'Belltown Books', direccion: '2nd Ave 2200, Seattle, WA 98121', estado: 'entregado', bultos: 2, orden: 5, cerrado_en: '2026-10-29T09:40:00-07:00', lat: 47.6135, lng: -122.3450 },
]

// 1. La ruta: lista con la siguiente parada, el dinero y lo que dijo el cliente; la furgoneta aparcada; una parada; el mapa.
{
  const { ctx, page } = await contexto()
  await page.clock.install({ time: new Date(ES ? '2026-10-29T10:30:00+01:00' : '2026-10-29T10:30:00-07:00') })
  await page.clock.resume()
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: ES ? { mensual: 9.99, anual: 99 } : { moneda: 'USD', mensual: 9.99, anual: 99 }, unidades: ES ? 'km' : 'mi', pais: ES ? 'es' : 'us', status: 'active', suscrita: true } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, empresa: '', fecha: '2026-10-29', ia_tickets: false,
    jornada: { empezada: ES ? '2026-10-29T08:30:00+01:00' : '2026-10-29T08:30:00-07:00' }, aviso_aceptado: true, base: null,
    ruta: { fin: '10:50', minutos: 34, km: ES ? 3.1 : 5.15, trafico: true }, pedidos: PEDIDOS, ganancias: { pago_parada: ES ? 110 : 300, pago_dia: 0, coste_km: 12 },
    pais: ES ? 'es' : 'us', prefijo: ES ? '34' : '1', unidades: ES ? 'km' : 'mi', moneda: ES ? 'EUR' : 'USD' } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { fuente: 'linea_recta', linea: [] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/zonas-carga/, (r) => r.fulfill({ json: { zonas: [], incompleto: false } }))
  await page.route(/\/api\/reparto\/mi-ruta\/incidencias/, (r) => r.fulfill({ json: ES ? { fuente: 'DGT', publicado: '2026-10-29T10:11:52+01:00', incompleto: false, aplica: true, avisos: [], incidencias: [
    { id: '1', clase: 'corte', que: 'calzada cortada (obras)', gravedad: 'alta', carretera: 'N-550', pk: '12.1', municipio: 'Culleredo', provincia: 'A Coruña', lat: 43.3585, lng: -8.4045, lat2: 43.3560, lng2: -8.4080, desde: '2026-10-27T08:00:00+01:00', distancia_km: 0.6, parada: 1 },
    { id: '2', clase: 'retencion', que: 'retención', gravedad: 'media', carretera: 'AC-12', pk: '2.0', municipio: 'A Coruña', provincia: 'A Coruña', lat: 43.3660, lng: -8.3985, lat2: null, lng2: null, desde: '2026-10-29T09:50:00+01:00', distancia_km: 0.4, parada: 3 }] }
    : { fuente: 'WZDx · Washington State DOT', publicado: '', incompleto: false, aplica: true, avisos: [], incidencias: [
      { id: 'w1', clase: 'obras', que: 'obras', gravedad: '', carretera: 'I-5', pk: '', municipio: '', provincia: '', lat: 47.605, lng: -122.33, lat2: 47.61, lng2: -122.33,
        desde: '2026-01-26T00:00:00+00:00', texto: 'I-5/Yesler Way to Northgate - pavement and drainage', fuente: 'WZDx · Washington State DOT', distancia_km: 0.5, parada: 1 }] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/zbe/, (r) => r.fulfill({ json: ES ? { fuente: 'DGT', incompleto: false, aplica: true, tipo: 'ZBE', paradas: { p4: { id: 'z1', nombre: 'A Coruña - Marina', tipo: 'ZBE' } },
    zonas: [{ id: 'z1', ciudad: 'A Coruña', nombre: 'A Coruña - Marina', descripcion: 'Carga y descarga de 6h a 11h.', estado: 'active', url: '', version: '2023-10-25', etiquetas: ['ECO', 'C'], tipo: 'ZBE', fuente: 'dgt',
      poligonos: [[[43.3680, -8.3960], [43.3705, -8.3960], [43.3705, -8.3920], [43.3680, -8.3920]]] }] }
    : { zonas: [], paradas: {}, fuente: null, incompleto: false, aplica: false, tipo: 'LEZ' } }))
  await page.route(/\/api\/reparto\/mi-ruta\/ordenar/, (r) => r.fulfill({ json: { ordenados: 4, ruta: { fin: '10:55', km: 3.1 } } }))
  await page.goto(`${BASE}/ruta`, { waitUntil: 'networkidle' })
  await foto(page, '01-ruta', 1500)
  await page.getByTestId('aparcar').click()
  await page.waitForTimeout(600)
  await page.evaluate(() => window.scrollTo(0, 0))
  await foto(page, '02-furgoneta-aparcada')
  await page.getByRole('button', { name: ES ? /Editar parada: Farmacia Sol/ : /Edit stop: Pike Place Fish/ }).click()
  await foto(page, '03-parada', 700)
  await page.getByRole('dialog', { name: ES ? 'Editar parada' : 'Edit stop' }).getByRole('button', { name: ES ? 'Cerrar' : 'Close', exact: true }).click()
  await page.getByRole('group', { name: ES ? 'Vista' : 'View' }).getByRole('button', { name: ES ? 'Mapa' : 'Map' }).click()
  await page.waitForTimeout(3500)
  await page.evaluate(() => document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'center' }))
  await foto(page, '04-mapa', 1200)
  await page.locator(`.leaflet-marker-icon[title="${ES ? 'Farmacia Sol' : 'Pike Place Fish'}"]`).click()
  await foto(page, '05-mapa-parada', 700)
  await ctx.close()
}

// 2. El enlace del cliente, contestado.
{
  const { ctx, page } = await contexto()
  const estado = { empresa: ES ? 'Ana reparte' : 'Seattle Courier', estado: 'pendiente', fecha: '2026-10-29', eta: '10:20', franja: null, paradas_antes: 2, tipo: 'entrega',
    dejado: null, respuesta: RESPUESTA, puede_contestar: false, intento: null }
  await page.route(/\/api\/seguimiento\/tok1234567890abcdef$/, (r) => r.fulfill({ json: estado }))
  await page.goto(`${BASE}/s/tok1234567890abcdef`, { waitUntil: 'networkidle' })
  await foto(page, '06-enlace-cliente')
  await ctx.close()
}

await browser.close()
console.log('capturas de la App Store en', OUT)
