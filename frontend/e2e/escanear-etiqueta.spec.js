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
    const body = r.request().postDataJSON(); const codigo = body.codigo || body.codigos?.[0]; buscados.push(codigo)
    await r.fulfill({ json: { encontrado: false, codigo } })
  })
  const creados = []
  const lotes = []
  await page.route(/\/api\/reparto\/escanear\/lote$/, async (r) => {
    const { paquetes } = r.request().postDataJSON(); lotes.push(paquetes)
    const items = paquetes.map(({ datos }) => {
      if (datos.direccion) { creados.push(datos); return { estado: 'nuevo', codigo: datos.codigo } }
      return { estado: 'revisar', codigo: datos.codigo }
    })
    await r.fulfill({ json: { items, nuevos: items.filter((x) => x.estado === 'nuevo').length,
      existentes: 0, revisar: items.filter((x) => x.estado === 'revisar').length, limite: 0, otro_conductor: 0 } })
  })
  await page.route(/\/api\/reparto\/mis-pedidos$/, async (r) => {
    creados.push(r.request().postDataJSON()); await r.fulfill({ json: { id: `n${creados.length}` } })
  })
  return { buscados, creados, lotes }
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

test('Escanear seguidos · guarda la etiqueta completa en lote, evita repetidas y deja la incompleta para revisar', async ({ page }) => {
  const { creados, lotes } = await preparar(page)
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
  expect(lotes.length).toBeGreaterThan(0)
  expect(lotes[0]).toHaveLength(1)
  expect(creados[0]).toMatchObject({ codigo: '384123450000000017', cliente: 'Maria Lopez', telefono: '612345678', lat: 40.4203, lng: -3.705 })

  await page.getByRole('dialog', { name: 'Escanear' }).getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.getByRole('button', { name: 'Revisar 1 paquetes sin dirección' })).toBeVisible()
  // La hoja de carga vuelve con la cuenta: con un paquete se titula «1 paquete cargado» (no «Cargar paquetes»).
  await expect(page.getByRole('dialog', { name: '1 paquete cargado' })).toBeVisible()
})

/* LA HOJA DE REPARTO (13-10-2026): la foto se lee DE VERDAD con el lector de la app (tesseract en el
   navegador, servido desde dist/ocr): la «foto» es una captura de una hoja impresa con tres paradas. */
async function abrirPegar(page) {
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, puede_pegar: true, empresa: '', fecha: '2026-10-13', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: null, pedidos: [] } }))
  const pegados = []
  await page.route(/\/api\/reparto\/pegar$/, async (r) => {
    const b = r.request().postDataJSON(); pegados.push(b)
    const n = b.texto.split('\n').length - 1
    await r.fulfill({ json: b.confirmar ? { creados: n, repetidos: 0 } : { n, filas: [] } })
  })
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Pegar una lista de direcciones' }).click()
  return { hoja: page.getByRole('dialog', { name: 'Pegar una lista de direcciones' }), pegados }
}

test('Hoja de reparto · un CSV con comas y comillas entra por columnas', async ({ page }) => {
  await preparar(page)
  const { hoja, pegados } = await abrirPegar(page)
  await hoja.getByLabel('Abrir un fichero').setInputFiles({ name: 'ruta.csv', mimeType: 'text/csv',
    buffer: Buffer.from('codigo,cliente,direccion,telefono\nZX1,"López, María","Calle Mayor 12, 15001 A Coruña",612345678\n') })
  await expect(hoja.getByLabel('Lista de direcciones')).toHaveValue('codigo; cliente; direccion; telefono\nZX1; López, María; Calle Mayor 12, 15001 A Coruña; 612345678')
  await hoja.getByRole('button', { name: 'Revisar' }).click()
  await expect(hoja.getByRole('button', { name: 'Añadir 1 parada a mi ruta' })).toBeVisible()
  expect(pegados[0].texto).toContain('ZX1; López, María;')
  // Un Excel no se abre aquí: se explica cómo copiarlo.
  await hoja.getByLabel('Abrir un fichero').setInputFiles({ name: 'ruta.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK') })
  await expect(hoja.getByText('Ese fichero no se puede abrir aquí.', { exact: false })).toBeVisible()
})

test('Hoja de reparto · con una foto de la hoja impresa salen las tres paradas para revisar', async ({ page, context }) => {
  test.setTimeout(150000)
  await preparar(page)
  const imprenta = await context.newPage()
  await imprenta.setViewportSize({ width: 1400, height: 520 })
  await imprenta.setContent(`<body style="margin:30px;font:22px Arial;background:#fff;color:#000">
    <h2 style="font:bold 26px Arial">HOJA DE REPARTO 13/10/2026 Ruta 4</h2>
    <table style="border-collapse:collapse;font:22px Arial" cellpadding="8">
      <tr><th>N°</th><th>Código</th><th>Destinatario</th><th>Dirección</th><th>Teléfono</th></tr>
      <tr><td>1</td><td>ZX812345</td><td>María López</td><td>Calle Mayor 12 15001 A Coruña</td><td>612 345 678</td></tr>
      <tr><td>2</td><td>ZX812346</td><td>Bar Pepe</td><td>Rúa Real 5 15003 A Coruña</td><td>981 22 33 44</td></tr>
      <tr><td>3</td><td>ZX812347</td><td>Ana Ruiz</td><td>Avenida de Finisterre 100 15004 A Coruña</td><td></td></tr>
    </table><p>Total bultos: 3</p></body>`)
  const foto = await imprenta.screenshot()
  await imprenta.close()
  const { hoja } = await abrirPegar(page)
  await hoja.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'hoja.png', mimeType: 'image/png', buffer: foto })
  await expect(hoja.getByText(/He leído 3 paradas/)).toBeVisible({ timeout: 120000 })
  const texto = await hoja.getByLabel('Lista de direcciones').inputValue()
  // La letra del código la puede confundir (la «Z» sale a veces «7»): por eso se revisa antes de añadir.
  for (const trozo of ['X812345; María López; Calle Mayor 12 15001 A Coruña; 612345678', 'X812346; Bar Pepe; Rúa Real 5 15003 A Coruña; 981223344',
    'X812347; Ana Ruiz; Avenida de Finisterre 100 15004 A Coruña']) expect(texto).toContain(trozo)
})

/* ZONAS DE CARGA Y DESCARGA (13-10-2026): en el mapa, un «C/D» morado por zona; el interruptor
   las quita y se recuerda. Las zonas las da el servidor (de OpenStreetMap), aquí simuladas. */
test('Mapa · las zonas de carga y descarga cerca de las paradas, y se pueden quitar', async ({ page }) => {
  await preparar(page)
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-13', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true }, pedidos: [
      { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 1, lat: 43.3712, lng: -8.3990 },
      { id: 'p2', cliente: 'Bar Pepe', direccion: 'Montero Ríos 12', estado: 'pendiente', bultos: 1, orden: 2, lat: 43.3690, lng: -8.4050 }] } }))
  let pedidas = 0
  await page.route(/\/api\/reparto\/mi-ruta\/zonas-carga$/, (r) => { pedidas += 1; return r.fulfill({ json: { fuente: 'OpenStreetMap', incompleto: false, zonas: [
    { id: 'way101', lat: 43.3692, lng: -8.4049, horario: 'Mo-Fr 08:00-14:00', maximo: '30 min', calle: 'Rúa Montero Ríos' },
    { id: 'node5', lat: 43.3713, lng: -8.3992, horario: '', maximo: '', calle: '' }] } }) })
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 204 }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Mapa' }).click()
  await expect(page.getByText('2 cerca de tus paradas', { exact: false })).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon', { hasText: 'C/D' })).toHaveCount(2)
  const interruptor = page.getByRole('checkbox', { name: /Zonas de carga y descarga/ })
  await interruptor.uncheck()
  await expect(page.locator('.leaflet-marker-icon', { hasText: 'C/D' })).toHaveCount(0)
  // Apagado se recuerda: al volver, ni se piden.
  const antes = pedidas
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Mapa' }).click()
  await expect(page.getByRole('checkbox', { name: /Zonas de carga y descarga/ })).not.toBeChecked()
  await page.waitForTimeout(800)
  expect(pedidas).toBe(antes)
})
