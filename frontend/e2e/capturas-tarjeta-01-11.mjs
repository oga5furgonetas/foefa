// La tarjeta de «Comparte tu día» (01-11-2026) tal como sale del móvil: la app de verdad con la API simulada pinta la
// imagen (canvas) y aquí se guarda el PNG que iría al estado de WhatsApp.
// Uso: node e2e/capturas-tarjeta-01-11.mjs <carpeta de salida>   (con `vite preview --port 4174` en marcha)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

const OUT = process.argv[2]
const BASE = process.env.BASE || 'http://localhost:4174'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES',
  timezoneId: 'Europe/Madrid', baseURL: BASE })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
  localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
  localStorage.setItem('ruta_vista', 'lista'); localStorage.setItem('guia_voz', '0')
  window.__png = null
  navigator.canShare = () => true
  navigator.share = async (d) => {
    const f = d.files?.[0]
    await new Promise((ok) => { const r = new FileReader(); r.onload = () => { window.__png = String(r.result).split(',')[1]; ok() }; r.readAsDataURL(f) })
  }
})
await entrarComoAdmin(page)
await simularApi(page, 'vacio')
const fin = new Date(Date.now() + 30 * 86400000).toISOString()
await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
  plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
  precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 }, status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
const hecho = (n, estado = 'entregado') => ({ id: `h${n}`, cliente: `Cliente ${n}`, direccion: `Calle ${n}`, estado, orden: n, lat: 43.36, lng: -8.41,
  cerrado_en: `2026-11-01T${String(8 + Math.floor(n / 8)).padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}:00+01:00` })
const pedidos = Array.from({ length: 112 }, (_, i) => hecho(i + 1, i % 28 === 27 ? 'fallido' : 'entregado'))
await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
  activo: true, autonomo: true, fecha: '2026-11-01', aviso_aceptado: true, ganancias: { pago_parada: 110, pago_dia: 0, coste_km: 12, bizum: '' },
  jornada: { empezada: '2026-11-01T07:00:00+01:00', terminada: '2026-11-01T16:10:00+01:00' }, ruta: { km: 68.4 }, pedidos } }))
await page.route(/\/api\/referidos$/, (r) => r.fulfill({ json: { codigo: 'ANA123', invitados: 0, premiados: 0, saldo: 0, ganado: 0 } }))
await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: 'Comparte tu día' }).click()
await page.waitForFunction(() => window.__png !== null, null, { timeout: 30000 })
const b64 = await page.evaluate(() => window.__png)
writeFileSync(join(OUT, 'web-01-la-tarjeta-del-dia.png'), Buffer.from(b64, 'base64'))
console.log('web-01-la-tarjeta-del-dia')
await browser.close()
