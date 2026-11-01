// Capturas de la carga guiada y el briefing por voz (01-11-2026): la ruta ordenada con «Cargar la furgoneta», la
// furgoneta por huecos con un paquete recién escaneado y la lista por hueco. La app de verdad con la API simulada
// (los mismos datos que e2e/carga-guiada.spec.js), no maquetas.
// Uso: node e2e/capturas-carga-01-11.mjs <carpeta de salida>   (con `vite preview --port 4174` en marcha)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

const OUT = process.argv[2]
const BASE = process.env.BASE || 'http://localhost:4174'
mkdirSync(OUT, { recursive: true })
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES',
  timezoneId: 'Europe/Madrid', userAgent: UA, baseURL: BASE })
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
const huecos = ['Detrás · izq', 'Detrás · izq', 'Detrás · der', 'Detrás · der', 'Medio · izq', 'Medio · der', 'Delante · izq', 'Delante · der']
const nombres = [['Farmacia Sol', 'Rúa Sinfónica de Galicia 8'], ['Bar Pepe', 'Rúa Real 5'], ['Marta Ríos', 'Avda. Montero Ríos 12'], ['Luis Varela', 'Rúa Nova 3, 2º'],
  ['Panadería Lola', 'Praza de Lugo 1'], ['Clínica Riazor', 'Rúa Juan Flórez 20'], ['Óptica Mar', 'Rúa San Andrés 44'], ['Xoán Pérez', 'Rúa da Torre 15']]
const pedidos = nombres.map(([cliente, direccion], i) => ({ id: `p${i + 1}`, codigo: `COD${i + 1}`, cliente, direccion, estado: 'pendiente', bultos: i === 1 ? 3 : 1,
  orden: i + 1, eta: `09:${String(30 + i * 7).padStart(2, '0')}`, hueco: huecos[i], hueco_auto: true, lat: 43.36 + i * 0.002, lng: -8.41 + i * 0.002,
  cargado_en: i < 3 ? '2026-11-01T07:00:00Z' : null, cobrar: i === 0 ? 12.5 : 0, notas: i === 0 ? 'Llamar al timbre 2' : '' }))
const ruta = { fin: '10:30', minutos: 55, km: 6, trafico: true, carga_por: 'traseras' }
await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
await page.route(/\/api\/reparto\/escanear$/, (r) => {
  const p = pedidos.find((x) => x.codigo === 'COD4'); p.cargado_en = '2026-11-01T07:02:00Z'
  r.fulfill({ json: { encontrado: true, pedido: p, cargados: pedidos.filter((x) => x.cargado_en).length, total: pedidos.length } })
})
await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
  activo: true, autonomo: true, empresa: '', fecha: '2026-11-01', ia_tickets: false, jornada: {}, aviso_aceptado: true, base: null, ruta, pedidos } }))

await page.goto('/ruta', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Cargar la furgoneta/ }).waitFor()
await foto('web-01-ruta-ordenada-con-cargar')
await page.getByRole('button', { name: /Cargar la furgoneta/ }).click()
const carga = page.getByRole('dialog', { name: 'Cargar la furgoneta' })
await carga.getByPlaceholder('Escribe o pega un código').fill('COD4')
await carga.getByPlaceholder('Escribe o pega un código').press('Enter')
await carga.getByText('→ Detrás · der').waitFor()
await foto('web-02-furgoneta-por-huecos-escaneado')
await carga.getByRole('button', { name: 'Lista por hueco' }).click()
await foto('web-03-lista-por-hueco')
await browser.close()
