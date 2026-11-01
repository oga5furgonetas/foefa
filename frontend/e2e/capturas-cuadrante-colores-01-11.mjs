// La rejilla del cuadrante del panel con los colores de la hoja de Google de Dani (01-11-2026): cada código con su color,
// los nombres en azul / verde / dorado, la fila de los días en rojo y el domingo en naranja. La app de verdad con la
// API simulada (los mismos datos que el caso «Cuadrante» de humo.spec.js, con todos los códigos).
// Uso: node e2e/capturas-cuadrante-colores-01-11.mjs <carpeta de salida>   (con `vite preview --port 4174` en marcha)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

const OUT = process.argv[2]
const BASE = process.env.BASE || 'http://localhost:4174'
mkdirSync(OUT, { recursive: true })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const lunes = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })()
const dia = (n) => { const d = new Date(lunes); d.setDate(d.getDate() + n); return iso(d) }
const persona = (id, nombre, tipo, extra = {}) => ({ id, nombre, tipo, ficha_activa: true, apodos: [], nota: '', reglas: {}, entendido: [], sin_entender: '', reglas_fijas: [], ...extra })
const personas = [
  persona('p1', 'ADRIAN FRANCISCO LOBATO', 'normal'), persona('p2', 'ALEJANDRO BRAGANA BUELA', 'empresa'),
  persona('p3', 'ALVARO FLORES SARDELLA', 'finde'), persona('p4', 'CAROLINA CRESPO SEGOVIA', 'normal'),
  persona('p5', 'FABIO GONZALEZ CALVO', 'normal'), persona('p6', 'HELENA NEGREIRA FERNANDEZ', 'normal', { inactivo_desde: dia(9) }),
  persona('p7', 'LUIS MIGUEL VIELMA VADELL', 'normal'), persona('p8', 'DANIEL BRAO LOUREIRO', 'finde'),
]
const S = { // una semana y media, como en su hoja «12 A 26»
  p1: ['N/T', '1', 'N/T', '1', 'SUSP', 'SUSP', 'N/P', 'SUSP', '1', '1', 'N/T', '1', '1', 'N/T'],
  p2: ['1', '1', 'BKP', 'N/T', 'N/T', 'N/T', 'N/T', 'N/T', '1', '1', '1', '1', '1', 'N/T'],
  p3: ['1', 'N/T', 'N/T', 'N/T', 'N/T', '1', '1', '1', 'N/T', 'N/T', 'N/T', 'N/T', '1', '1'],
  p4: ['N/P', '1', 'N/T', '1', '1', '1', 'N/T APROB', 'N/T APROB', 'N/T APROB', '1', '1', '1', 'N/T', 'N/T'],
  p5: ['BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA', 'BAJA'],
  p6: ['1', 'N/T', '1', '1', 'N/T', 'N/T', '1', '1', '1', 'N/T', '', '', '', ''],
  p7: ['N/T', 'N/T', 'RA', '1', '1', '1', '1', 'N/T', '1', '1', 'V', 'V', 'V', 'V'],
  p8: ['S', 'S', 'S', 'N/T', 'N/T', 'S', 'S', 'S', 'S', 'S', 'N/T', 'N/T', 'S', 'S'],
}
const celdas = {}
for (const [pid, cods] of Object.entries(S)) cods.forEach((cod, i) => { if (cod) celdas[`${pid}|${dia(i)}`] = { cod, extra: pid === 'p3' && i === 5, fijada: pid === 'p1' && i === 1 } })
const maximas = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [dia(i), 5]))
const DATOS = { center: 'NORTE', desde: dia(0), hasta: dia(13), hoy: dia(1), personas, celdas, maximas, objetivos: {},
  config: { colchon: 2, permitir_extra: true }, ajustes: [], aprobados: [], propuesta: null,
  ultimo_cambio: { id: 'c1', que: 'Importar la hoja MENSUAL', en: new Date().toISOString(), por: 'Admin' },
  tipos: ['normal', 'empresa', 'finde', 'inactivo'] }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 2, locale: 'es-ES', timezoneId: 'Europe/Madrid', baseURL: BASE })
await page.addInitScript(() => { localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' })) })
await entrarComoAdmin(page)
await simularApi(page, 'vacio')
await page.route(/\/api\/cuadrante\?/, (r) => r.fulfill({ json: DATOS }))
await page.goto('/panel/cuadrante', { waitUntil: 'domcontentloaded' })
await page.getByText('Rutas (cuenta de 1)').waitFor({ timeout: 15000 })
await page.waitForTimeout(800)
const tabla = page.locator('table').first()
await tabla.scrollIntoViewIfNeeded()
await page.screenshot({ path: join(OUT, 'panel-01-cuadrante-con-los-colores-de-la-hoja.png'), fullPage: false })
console.log('panel-01-cuadrante-con-los-colores-de-la-hoja')
await browser.close()
