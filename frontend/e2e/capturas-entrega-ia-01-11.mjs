// Capturas de la entrega verificada (01-11-2026): la hoja «Mira la foto de entrega» cuando la IA pide revisarla, lo
// hecho con el veredicto (una verificada y una por revisar) y el enlace del cliente con «entrega verificada». La app
// de verdad con la API simulada (los mismos datos que e2e/entrega-verificada.spec.js), no maquetas.
// Uso: node e2e/capturas-entrega-ia-01-11.mjs <carpeta de salida>   (con `vite preview --port 4174` en marcha)
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
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const pedidos = [
  { id: 'p1', codigo: 'COD1', cliente: 'Bea Castro', direccion: 'Rúa Real 5, 2º', estado: 'pendiente', bultos: 1, orden: 3, eta: '10:40', lat: 43.36, lng: -8.41, cobrar: 0, notas: '', telefono: '' },
  { id: 'p2', codigo: 'COD2', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8', estado: 'entregado', bultos: 2, orden: 1, cerrado_en: hace(25), entrega_donde: 'mano', lat: 43.362, lng: -8.412,
    entrega_ia: { nivel: 'verificada', aviso: null, numero: '8', portal: '8', lugar: 'puerta' } },
  { id: 'p3', codigo: 'COD3', cliente: 'Luis Varela', direccion: 'Avda. Montero Ríos 12', estado: 'entregado', bultos: 1, orden: 2, cerrado_en: hace(9), entrega_donde: 'buzon', lat: 43.364, lng: -8.414,
    entrega_ia: { nivel: 'revisar', aviso: 'otro_numero', numero: '14', portal: '12', lugar: 'portal' } },
]
await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
  activo: true, autonomo: true, empresa: '', fecha: HOY, ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null,
  ruta: { fin: '11:10', minutos: 40, km: 5, trafico: true }, pedidos } }))
await page.route(/\/api\/reparto\/pedidos\/p1\/estado$/, (r) => {
  const b = r.request().postDataJSON()
  pedidos[0] = { ...pedidos[0], estado: b.estado, cerrado_en: new Date().toISOString(),
    entrega_ia: b.foto ? { nivel: 'revisar', aviso: 'sin_paquete', numero: '5', portal: '5', lugar: 'puerta' } : null }
  r.fulfill({ json: pedidos[0] })
})

await page.goto('/ruta', { waitUntil: 'networkidle' })
// Lo hecho hoy, con el veredicto de cada entrega.
await page.getByText('2 hechos hoy').click()
await page.locator('details').filter({ hasText: 'Farmacia Sol' }).scrollIntoViewIfNeeded()
await foto('web-02-hechas-con-el-veredicto')
// Entregar la pendiente con foto: la IA no ve el paquete y la app pregunta.
const jpeg = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16
  const g = c.getContext('2d'); g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 16, 16)
  return c.toDataURL('image/jpeg', 0.8).split(',')[1]
})
await page.getByRole('button', { name: 'Entregado', exact: true }).click()
await page.getByRole('dialog', { name: 'Prueba de entrega' }).locator('input[type=file]')
  .setInputFiles({ name: 'puerta.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') })
await page.getByRole('dialog', { name: 'Mira la foto de entrega' }).waitFor()
await foto('web-01-la-ia-pide-mirar-la-foto')
// El enlace del cliente.
await page.route(/\/api\/seguimiento\/tok1234567890abcdef$/, (r) => r.fulfill({ json: {
  empresa: 'Ana reparte', estado: 'entregado', fecha: HOY, eta: null, franja: null, paradas_antes: 0, tipo: 'entrega',
  dejado: 'En el buzón', respuesta: null, puede_contestar: false, intento: null, verificada: true } }))
await page.goto('/s/tok1234567890abcdef', { waitUntil: 'domcontentloaded' })
await page.getByTestId('verificada').waitFor()
await foto('web-03-el-cliente-ve-entrega-verificada')
await browser.close()
