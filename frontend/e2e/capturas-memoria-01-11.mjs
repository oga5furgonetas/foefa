// Capturas de la memoria de la calle (01-11-2026): la hoja «Para la próxima vez en esta puerta» y la tarjeta de la
// parada con la memoria. La app de verdad con la API simulada (los mismos datos que e2e/memoria-calle.spec.js).
// Uso: node e2e/capturas-memoria-01-11.mjs <carpeta de salida>   (con `vite preview --port 4174` en marcha)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

const OUT = process.argv[2]
const BASE = process.env.BASE || 'http://localhost:4174'
mkdirSync(OUT, { recursive: true })
const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES',
  timezoneId: 'Europe/Madrid', userAgent: UA, baseURL: BASE, geolocation: { latitude: 43.3623, longitude: -8.4115 }, permissions: ['geolocation'] })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
  localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
  localStorage.setItem('ruta_vista', 'lista'); localStorage.setItem('guia_voz', '0')
})
async function foto(nombre, espera = 900) {
  await page.waitForTimeout(espera)
  await page.screenshot({ path: join(OUT, `${nombre}.png`) })
  console.log(nombre)
}

await entrarComoAdmin(page)
await simularApi(page, 'vacio')
const fin = new Date(Date.now() + 30 * 86400000).toISOString()
await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
  plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
  precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
const pedidos = [
  { id: 'p1', codigo: 'COD1', cliente: 'Bea Castro', direccion: 'Rúa Real 22, A Coruña', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:20', lat: 43.36, lng: -8.41, cobrar: 0, notas: '', telefono: '',
    cliente_dice: { estare: 'no', dejar: 'vecino', franja: null, portal: '4321', nota: '', cuando: '2026-11-01T08:00:00Z' } },
  { id: 'p2', codigo: 'COD2', cliente: 'Clínica Riazor', direccion: 'Rúa Juan Flórez 20', estado: 'pendiente', bultos: 2, orden: 1, eta: '10:05', lat: 43.362, lng: -8.412, cobrar: 0, notas: '', telefono: '',
    memoria: { portal: '1980', dejar: 'porteria', acceso: 'Entrada por el garaje, timbre de la derecha', por: 'Luis', actualizado: '2026-10-28T10:00:00Z' } },
]
await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
  activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null,
  ruta: { fin: '10:40', minutos: 35, km: 4, trafico: true }, pedidos } }))
await page.goto('/ruta', { waitUntil: 'networkidle' })
await page.getByTestId('memoria').scrollIntoViewIfNeeded()
await foto('web-02-la-parada-con-la-memoria-de-la-puerta')
// La otra parada, desplegada (la memoria y el botón solo se ven en la tarjeta abierta).
await page.getByText('Rúa Real 22, A Coruña').first().click()
await page.getByRole('button', { name: 'Guardar para la próxima' }).first().click()
const hoja = page.getByRole('dialog', { name: 'Para la próxima vez en esta puerta' })
await hoja.getByLabel('Código del portal').fill('1234B')
await hoja.getByRole('button', { name: 'En portería o recepción' }).click()
await hoja.getByLabel('Cómo se entra').fill('Entrada por el garaje')
await foto('web-01-guardar-para-la-proxima')
await browser.close()
