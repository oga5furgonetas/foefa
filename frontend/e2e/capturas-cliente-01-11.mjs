// Capturas del cliente avisado, la propina y la valoración (01-11-2026): la hoja «Avisar a todos por WhatsApp» y el
// enlace del cliente ya entregado, con las estrellas y el Bizum. La app de verdad con la API simulada (los mismos
// datos que e2e/cliente-avisado.spec.js), no maquetas.
// Uso: node e2e/capturas-cliente-01-11.mjs <carpeta de salida>   (con `vite preview --port 4174` en marcha)
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

// El enlace del cliente, ya entregado: las estrellas (una puesta) y el Bizum.
await page.route(/\/api\/seguimiento\/tok1234567890abcdef$/, (r) => r.fulfill({ json: {
  empresa: 'Ana reparte', estado: 'entregado', fecha: HOY, eta: null, franja: null, paradas_antes: 0, tipo: 'entrega',
  dejado: 'En el buzón', respuesta: null, puede_contestar: false, intento: null, verificada: true,
  valoracion: { estrellas: 5, cuando: '2026-11-01T11:00:00Z' }, puede_valorar: true, bizum: '612345678' } }))
await page.goto('/s/tok1234567890abcdef', { waitUntil: 'domcontentloaded' })
await page.getByTestId('valoracion').waitFor()
await foto('web-02-el-cliente-valora-y-la-propina')

// La ruta: «Avisar a todos por WhatsApp», con uno ya avisado.
await entrarComoAdmin(page)
await simularApi(page, 'vacio')
const fin = new Date(Date.now() + 30 * 86400000).toISOString()
await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
  plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
  precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
const pedidos = [
  { id: 'p1', codigo: 'COD1', cliente: 'Bea Castro', direccion: 'Rúa Real 22', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.36, lng: -8.41, cobrar: 0, notas: '', telefono: '612 345 678', seguimiento: 'tokAAAAAAAAAAAAAAAAA' },
  { id: 'p2', codigo: 'COD2', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8', estado: 'pendiente', bultos: 2, orden: 2, eta: '10:20', lat: 43.361, lng: -8.411, cobrar: 0, notas: '', telefono: '981 22 33 44', seguimiento: 'tokBBBBBBBBBBBBBBBBB' },
  { id: 'p3', codigo: 'COD3', cliente: 'Luis Varela', direccion: 'Avda. Montero Ríos 12', estado: 'pendiente', bultos: 1, orden: 3, eta: '10:40', lat: 43.362, lng: -8.412, cobrar: 0, notas: '', telefono: '698112233', seguimiento: 'tokCCCCCCCCCCCCCCCCC' },
  { id: 'p4', codigo: 'COD4', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 4, eta: '10:55', lat: 43.363, lng: -8.413, cobrar: 0, notas: '', telefono: '' },
]
await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
  activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, pais: 'es', prefijo: '34',
  ruta: { fin: '11:10', minutos: 55, km: 7, trafico: true }, pedidos } }))
await page.addInitScript((hoy) => { localStorage.setItem(`avisados_${hoy}`, JSON.stringify(['p1'])) }, HOY)
await page.goto('/ruta', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Avisar a todos por WhatsApp/ }).click()
await page.getByRole('dialog', { name: 'Avisar a todos por WhatsApp' }).waitFor()
await foto('web-01-avisar-a-todos-por-whatsapp')
await browser.close()
