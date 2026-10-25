import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ESCANEAR DE VERDAD (25-10-2026). Aquí no se simula el lector: la «cámara» es un lienzo con los códigos
   de la etiqueta pintados (fabricados con zxing, el formato de cada empresa) y los lee el lector propio de
   la app (zxing en WebAssembly, el que usan iPhone e Instagram), servido desde la web como en producción.
   Es la cadena entera: imagen → lector → datosDeCodigos → la parada entra sola. Lo que no cubre: la
   cámara física (luz, enfoque, distancia). Los formatos, en scripts/check-escaneo-2d.mjs. */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

const GS = '\x1d'
const RS = '\x1e'
const US = '\x1f'
const EOT = '\x04'

const ETIQUETAS = {
  seur: [
    ['Aztec', `[)>${RS}01${GS}03${GS}15003${GS}724${GS}101${GS}05123456789012${GS}GEOP${GS}${GS}298${GS}${GS}001/001${GS}01.50KG${GS}N${GS}`
      + `Rúa Real${GS}A Coruña${GS}${GS}${RS}07${GS}G03${GS}0${GS}0${GS}1${GS}${['', '', 'María López', '+34612345678', '', '', '', '5', '2º B'].join(US)}${GS}${GS}${RS}`
      + `07${GS}S081${GS}+43.3712${GS}-008.3990${GS}1${GS}G${RS}${EOT}`],
    ['Code128', '%0015003051234567890121017240']],
  gls: [
    ['DataMatrix', 'A|Bar O Peto|Calle del Villar 12|Santiago de Compostela|| 612345678| 1234567|'],
    ['Code128', '61234567890']],
}
// UPS no está: su MaxiCode (con la dirección) zxing solo lo lee «puro», sin nada más en el encuadre. Probado el
// 25-10 aquí mismo: con la barra 1Z al lado o con letra alrededor no lo encuentra, y el lector de Chrome en
// Android no lo trae. En una etiqueta UPS se lee la barra 1Z y la dirección sale de la foto.
const imagenes = {}

test.beforeAll(async () => {
  const require = createRequire(import.meta.url)
  const entrada = require.resolve('zxing-wasm/full')
  const z = await import(pathToFileURL(entrada).href)
  await z.prepareZXingModule({
    overrides: { wasmBinary: readFileSync(entrada.replace(/dist[\\/].*$/, 'dist/full/zxing_full.wasm')) }, fireImmediately: true })
  for (const [nombre, codigos] of Object.entries(ETIQUETAS)) {
    imagenes[nombre] = []
    for (const [format, texto] of codigos) {
      const w = await z.writeBarcode(texto, { format, scale: format === 'Code128' || format === 'MaxiCode' ? 3 : 5 })
      if (w.error) throw new Error(`${nombre}/${format}: ${w.error}`)
      imagenes[nombre].push(`data:image/png;base64,${Buffer.from(await w.image.arrayBuffer()).toString('base64')}`)
    }
  }
})

async function preparar(page, etiqueta) {
  await page.addInitScript((urls) => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    delete window.BarcodeDetector   // el lector propio, no el del navegador
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720
      const ctx = c.getContext('2d')
      const imgs = await Promise.all(urls.map(async (u) => { const i = new Image(); i.src = u; await i.decode(); return i }))
      const pintar = () => {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
        // Letra de etiqueta alrededor, como en una de verdad (el lector tiene que encontrar el código entre texto).
        ctx.fillStyle = '#000'; ctx.font = 'bold 30px Arial'
        ctx.fillText('DESTINATARIO  ·  1/1  ·  1,50 KG  ·  REF 298', 60, 50)
        ctx.font = '24px Arial'
        ctx.fillText('Entregar en horario de mañana. No dejar en conserjería.', 60, 690)
        let x = 80
        for (const i of imgs) { ctx.drawImage(i, x, (c.height - i.height) / 2); x += i.width + 80 }
      }
      pintar(); setInterval(pintar, 100)
      return c.captureStream(10)
    }
  }, imagenes[etiqueta])
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-25', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: null, pedidos: [] } }))
  await page.route(/\/api\/reparto\/escanear$/, async (r) => {
    const body = r.request().postDataJSON(); await r.fulfill({ json: { encontrado: false, codigo: body.codigo || body.codigos?.[0] } })
  })
  const creados = []
  await page.route(/\/api\/reparto\/mis-pedidos$/, async (r) => {
    const b = r.request().postDataJSON(); creados.push(b); await r.fulfill({ json: { id: `n${creados.length}`, ...b, estado: 'pendiente' } })
  })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Escanear', exact: true }).click()
  return { creados, hecho: page.getByRole('status').filter({ hasText: 'Añadida a tu ruta' }) }
}

test('Escaneo real · SEUR/DPD (Aztec): calle con portal y piso, teléfono y el punto GPS', async ({ page }) => {
  const { creados, hecho } = await preparar(page, 'seur')
  await expect(hecho).toContainText('María López · Rúa Real 5, 2º B, 15003, A Coruña', { timeout: 20000 })
  expect(creados).toHaveLength(1)
  expect(creados[0]).toMatchObject({ codigo: '05123456789012', cliente: 'María López', telefono: '612345678', cp: '15003',
    localidad: 'A Coruña', lat: 43.3712, lng: -8.399 })
  expect(creados[0].codigos).toContain('%0015003051234567890121017240')
})

test('Escaneo real · GLS (DataMatrix con la dirección y la barra del bulto)', async ({ page }) => {
  const { creados, hecho } = await preparar(page, 'gls')
  await expect(hecho).toContainText('Bar O Peto · Calle del Villar 12, Santiago de Compostela', { timeout: 20000 })
  expect(creados[0]).toMatchObject({ codigo: '61234567890', cliente: 'Bar O Peto', telefono: '612345678', localidad: 'Santiago de Compostela' })
})