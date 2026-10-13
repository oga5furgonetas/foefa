import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LOS CÓDIGOS DE LA ETIQUETA, SEA DE LA EMPRESA QUE SEA (13-10-2026).
   Se simulan la cámara (un lienzo) y el lector de códigos del navegador: `window.__ahora` es lo que
   «ve» la cámara en cada momento. Los textos de los códigos son los que devuelve el lector real
   (ver scripts/check-leer-etiqueta.mjs). */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

const GS = '\x1d'
const GS1 = `0038412345000000001742028013${GS}4301Maria Lopez${GS}4302Gran Via 32 3B${GS}4305Madrid${GS}4308+34612345678${GS}430913042030003562950000`

async function preparar(page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
    window.__ahora = []
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['code_128', 'qr_code', 'data_matrix', 'pdf417'] }
      async detect() { return (window.__ahora || []).map((rawValue) => ({ rawValue })) }
    }
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 240)
      return c.captureStream(5)
    }
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-13', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: null, pedidos: [] } }))
  const buscados = []
  await page.route(/\/api\/reparto\/escanear$/, async (r) => {
    const { codigo } = r.request().postDataJSON(); buscados.push(codigo)
    await r.fulfill({ json: { encontrado: false, codigo } })
  })
  const creados = []
  await page.route(/\/api\/reparto\/mis-pedidos$/, async (r) => {
    creados.push(r.request().postDataJSON()); await r.fulfill({ json: { id: `n${creados.length}` } })
  })
  return { buscados, creados }
}

test('Escanear · una etiqueta con la barra y un 2D aparte (como GLS) rellena dirección y teléfono', async ({ page }) => {
  const { buscados, creados } = await preparar(page)
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Escanear', exact: true }).click()
  // La barra se ve primero; el 2D con la dirección, un instante después: tiene que leer los dos.
  await page.evaluate(() => { window.__ahora = ['ZX81234567'] })
  await page.waitForTimeout(120)
  await page.evaluate(() => { window.__ahora = ['ZX81234567', 'ES|28013|MADRID|MARIA LOPEZ|GRAN VIA 32|612345678'] })
  await expect(page.getByRole('heading', { name: 'El código ZX81234567 no está en la lista' })).toBeVisible()
  await expect(page.getByPlaceholder('Dirección completa')).toHaveValue('GRAN VIA 32, 28013, MADRID')
  await expect(page.locator('input[value="612345678"]')).toBeVisible()
  expect(buscados).toContain('ZX81234567')
  await page.getByRole('button', { name: 'Añadir a mi ruta' }).click()
  await expect.poll(() => creados.length).toBe(1)
  expect(creados[0]).toMatchObject({ codigo: 'ZX81234567', telefono: '612345678', cliente: 'MARIA LOPEZ', de_ticket: true })
})

test('Escanear seguidos · la etiqueta con todo entra sola, la repetida no cuenta y la que no trae dirección queda para revisar', async ({ page }) => {
  const { creados } = await preparar(page)
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Cargar paquetes: uno tras otro' }).click()
  await page.getByRole('button', { name: 'Escanear seguidos' }).click()
  const estado = page.getByRole('status').filter({ hasText: /añadidos|una tras otra/ })
  await expect(estado).toHaveText(/Pasa las etiquetas una tras otra/)

  await page.evaluate((v) => { window.__ahora = [v] }, GS1)
  await expect(estado).toHaveText(/1 añadidos/)
  // La misma etiqueta sigue delante de la cámara: no se vuelve a añadir.
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__ahora = ['ZX99999999'] })
  await expect(estado).toHaveText(/1 añadidos · 1 para revisar/)
  expect(creados).toHaveLength(1)
  expect(creados[0]).toMatchObject({ codigo: '384123450000000017', cliente: 'Maria Lopez', telefono: '612345678', lat: 40.4203, lng: -3.705 })

  await page.getByRole('dialog', { name: 'Escanear' }).getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.getByRole('button', { name: 'Revisar 1 paquetes sin dirección' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '1 paquete cargado' })).toBeVisible()
})
