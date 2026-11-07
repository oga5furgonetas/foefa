import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* LA CARGA GUIADA Y EL BRIEFING POR VOZ (01-11-2026). Con la ruta ordenada, cada parada trae su hueco de la
   furgoneta; «Cargar la furgoneta» abre la pantalla que, al escanear (o escribir) un código, dice en grande y por voz
   dónde va, cuenta cuántos van y deja marcar a mano desde la lista por hueco. Y al ordenar o al cambiar la siguiente
   parada, se dice en una frase lo que hay que saber. La voz del navegador se sustituye por un apuntador. */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 },
  geolocation: { latitude: 43.36, longitude: -8.41 }, permissions: ['geolocation'] })

test('Ruta · cargar la furgoneta por huecos y oír la siguiente parada', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('fds_instalar_cerrado', '1')
    // La voz, apuntada en vez de hablada (la guía por voz queda encendida: es la misma preferencia).
    window.__dicho = []
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, getVoices() { return [] }, speak(u) { window.__dicho.push(u.text) } } })
    window.SpeechSynthesisUtterance = function (t) { this.text = t }
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  // Sin ordenar todavía: sin huecos ni hora de fin.
  let pedidos = [
    { id: 'p1', codigo: 'COD1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', estado: 'pendiente', bultos: 1, lat: 43.36, lng: -8.41, cobrar: 12.5, notas: 'Llamar al timbre 2' },
    { id: 'p2', codigo: 'COD2', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 3, lat: 43.37, lng: -8.40, ventana_hasta: '11:00' },
    { id: 'p3', codigo: 'COD3', cliente: 'Marta Ríos', direccion: 'Avda. Montero Ríos 12', estado: 'pendiente', bultos: 1, lat: 43.371, lng: -8.402 },
  ]
  let ruta = { trafico: true }
  const escaneos = []
  const marcas = []
  const cargados = () => pedidos.filter((p) => p.cargado_en).length
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta\/ordenar/, (r) => {
    ruta = { fin: '10:30', minutos: 30, km: 2, trafico: true, carga_por: 'traseras' }
    const huecos = ['Detrás · izq', 'Detrás · der', 'Medio · izq']
    pedidos = pedidos.map((p, i) => ({ ...p, orden: i + 1, eta: `09:${30 + i * 10}`, hueco: huecos[i], hueco_auto: true }))
    r.fulfill({ json: { ordenados: 3, ruta } })
  })
  await page.route(/\/api\/reparto\/escanear$/, (r) => {
    const b = r.request().postDataJSON(); escaneos.push(b)
    const p = pedidos.find((x) => (b.codigos || [b.codigo]).includes(x.codigo))
    if (!p) return r.fulfill({ json: { encontrado: false } })
    if (b.carga) { p.cargado_en = '2026-10-04T07:00:00Z'; return r.fulfill({ json: { encontrado: true, pedido: p, cargados: cargados(), total: pedidos.length } }) }
    r.fulfill({ json: { encontrado: true, pedido: { ...p, escaneos: 1 } } })
  })
  await page.route(/\/api\/reparto\/mi-ruta\/cargado/, (r) => {
    const b = r.request().postDataJSON(); marcas.push(b)
    const p = pedidos.find((x) => x.id === b.id)
    p.cargado_en = b.cargado ? '2026-10-04T07:01:00Z' : null
    r.fulfill({ json: { ok: true, cargados: cargados(), total: pedidos.length } })
  })
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, (r) => {
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: 'entregado' } : p))
    r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta, pedidos } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const sig = page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' })
  await expect(sig.getByText('Farmacia Sol')).toBeVisible()
  // Sin ordenar: ni se carga ni se habla.
  await expect(page.getByRole('button', { name: /Cargar la furgoneta/ })).toHaveCount(0)
  expect(await page.evaluate(() => window.__dicho)).toEqual([])

  // Al ordenar, cada parada trae su hueco y se dice la primera (con el hueco, el cobro y la nota).
  await page.getByRole('button', { name: 'Ordenar ruta' }).click()
  await expect(page.getByText(/Ruta ordenada por tiempo/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__dicho.length)).toBe(1)
  const dicho = (await page.evaluate(() => window.__dicho[0])).replace(/\u00a0/g, ' ')
  expect(dicho).toContain('Siguiente parada: Farmacia Sol, Rúa Sinfónica de Galicia 8, A Coruña')
  expect(dicho).toContain('en la furgoneta, detrás, a la izquierda')
  expect(dicho).toContain('cobro a la entrega: 12,50 €')
  expect(dicho).toContain('nota: Llamar al timbre 2')
  await expect(sig.getByText('Detrás · izq')).toBeVisible()

  // El altavoz de la tarjeta lo repite cuando se quiera.
  await sig.getByRole('button', { name: 'Escuchar la siguiente parada' }).click()
  expect(await page.evaluate(() => window.__dicho.length)).toBe(2)

  // Cargar: la furgoneta por huecos, con lo que va en cada uno.
  const abrir = page.getByRole('button', { name: /Cargar la furgoneta/ })
  await expect(abrir).toContainText('0 de 3 cargados')
  await abrir.click()
  const carga = page.getByRole('dialog', { name: 'Cargar la furgoneta' })
  // Diseño compacto (07-11-2026, §5.6): la explicación va detrás del «?» y en la pantalla queda «↓ Puertas traseras».
  await expect(carga.getByText('↓ Puertas traseras')).toBeVisible()
  await carga.getByRole('button', { name: 'Ayuda' }).click()
  await expect(carga.getByText('Cargas por las puertas traseras.')).toBeVisible()
  await expect(carga.getByText('Lo de detrás se entrega primero.')).toBeVisible()
  await carga.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
  await expect(carga.locator('[data-hueco="Detrás · izq"]')).toContainText('1')
  await expect(carga.locator('[data-hueco="Detrás · der"]')).toContainText('1')
  await expect(carga.locator('[data-hueco="Medio · izq"]')).toContainText('1')
  await expect(carga.locator('[data-hueco="Delante · der"]')).toContainText('0')

  // Un código de la ruta: se dice el hueco (en grande y por voz) y cuenta.
  await carga.getByPlaceholder('Escribe o pega un código').fill('COD1')
  await carga.getByPlaceholder('Escribe o pega un código').press('Enter')
  await expect(carga.getByText('→ Detrás · izq')).toBeVisible()
  await expect(carga.getByRole('status', { name: '1 de 3 cargados' })).toBeVisible()
  expect(escaneos.at(-1)).toEqual({ codigos: ['COD1'], carga: true })
  expect(await page.evaluate(() => window.__dicho.at(-1))).toBe('detrás, a la izquierda')
  await expect(carga.locator('[data-hueco="Detrás · izq"]')).toContainText('1/1')

  // Uno que no es de la ruta: se dice y no cuenta.
  await carga.getByPlaceholder('Escribe o pega un código').fill('NADA')
  await carga.getByPlaceholder('Escribe o pega un código').press('Enter')
  await expect(carga.getByRole('alert')).toContainText('No es de tu ruta de hoy.')
  await expect(carga.getByRole('status', { name: '1 de 3 cargados' })).toBeVisible()

  // Sin escanear: la lista por hueco, con una casilla por paquete.
  await carga.getByRole('button', { name: 'Lista por hueco' }).click()
  const casillaPepe = carga.getByRole('checkbox', { name: /Bar Pepe/ })
  await expect(casillaPepe).toHaveAttribute('aria-checked', 'false')
  await casillaPepe.click()
  await expect(casillaPepe).toHaveAttribute('aria-checked', 'true')
  expect(marcas).toEqual([{ id: 'p2', cargado: true }])
  await expect(carga.getByRole('status', { name: '2 de 3 cargados' })).toBeVisible()
  await expect(carga.getByRole('checkbox', { name: /Farmacia Sol/ })).toHaveAttribute('aria-checked', 'true')

  // Salir: la ruta sigue diciendo cuántos van.
  await carga.getByRole('button', { name: 'Salir (1 faltan)' }).click()
  await expect(carga).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Cargar la furgoneta/ })).toContainText('2 de 3 cargados')

  // Entregada la primera (con su cobro y sin foto), se dice la siguiente (su hora límite y sus bultos), sin tocar nada.
  await sig.getByRole('button', { name: 'Entregado', exact: true }).click()
  await expect(page.getByText('¿Cómo ha pagado?')).toBeVisible()
  await page.getByRole('button', { name: 'Bizum' }).click()
  await expect(page.getByRole('heading', { name: 'Prueba de entrega' })).toBeVisible()
  await page.getByRole('button', { name: 'Entregar sin foto' }).click()
  await expect(page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' }).getByText('Bar Pepe')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__dicho.length)).toBe(4)
  const segunda = (await page.evaluate(() => window.__dicho.at(-1))).replace(/\u00a0/g, ' ')
  expect(segunda).toContain('Siguiente parada: Bar Pepe, Rúa Real 5')
  expect(segunda).toContain('hasta las 11:00')
  expect(segunda).toContain('en la furgoneta, detrás, a la derecha')
  expect(segunda).toContain('3 bultos')
})

test('Ruta · con la guía por voz apagada no se habla, y con la puerta lateral la fila de delante va primero', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('guia_voz', '0')
    window.__dicho = []
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, getVoices() { return [] }, speak(u) { window.__dicho.push(u.text) } } })
    window.SpeechSynthesisUtterance = function (t) { this.text = t }
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  let pedidos = [
    { id: 'p1', codigo: 'COD1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8', estado: 'pendiente', bultos: 1, orden: 1, eta: '09:30', hueco: 'Delante · izq', lat: 43.36, lng: -8.41 },
    { id: 'p2', codigo: 'COD2', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 2, eta: '09:40', hueco: 'Detrás · der', lat: 43.37, lng: -8.40 },
  ]
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, (r) => {
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: 'entregado' } : p))
    r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/reparto\/escanear$/, (r) => {
    const p = pedidos.find((x) => x.codigo === 'COD1'); p.cargado_en = '2026-10-04T07:00:00Z'
    r.fulfill({ json: { encontrado: true, pedido: p, cargados: 1, total: 2 } })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true, carga_por: 'lateral' }, pedidos } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const sig = page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' })
  await expect(sig.getByText('Farmacia Sol')).toBeVisible()
  await page.getByRole('button', { name: /Cargar la furgoneta/ }).click()
  const carga = page.getByRole('dialog', { name: 'Cargar la furgoneta' })
  // Diseño compacto (07-11-2026, §5.6): «← Puerta lateral» arriba; lo demás, detrás del «?».
  await expect(carga.getByText('← Puerta lateral')).toBeVisible()
  await carga.getByRole('button', { name: 'Ayuda' }).click()
  await expect(carga.getByText('Cargas por la puerta lateral.')).toBeVisible()
  await expect(carga.getByText('Lo de delante se entrega primero.')).toBeVisible()
  await carga.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
  // En la lista, la fila de la puerta (delante) sale antes que la de detrás.
  await carga.getByRole('button', { name: 'Lista por hueco' }).click()
  const titulos = await carga.locator('section p').allTextContents()
  expect(titulos.findIndex((t) => t.startsWith('Delante · izq'))).toBeLessThan(titulos.findIndex((t) => t.startsWith('Detrás · der')))
  // Escanear sigue diciendo el hueco en pantalla, pero nada por voz.
  await carga.getByPlaceholder('Escribe o pega un código').fill('COD1')
  await carga.getByPlaceholder('Escribe o pega un código').press('Enter')
  await expect(carga.getByText('→ Delante · izq')).toBeVisible()
  await carga.getByRole('button', { name: 'Salir (1 faltan)' }).click()
  // Ni el briefing al avanzar.
  await sig.getByRole('button', { name: 'Entregado', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Prueba de entrega' })).toBeVisible()
  await page.getByRole('button', { name: 'Entregar sin foto' }).click()
  await expect(page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' }).getByText('Bar Pepe')).toBeVisible()
  expect(await page.evaluate(() => window.__dicho)).toEqual([])
})

/* ESCANEAR DESDE LA CARGA (diseño compacto, 07-11-2026, §5.5 y §5.6): el escáner se abre sin cerrarse tras cada paquete y su barra
   de abajo dice el paquete, su hueco en grande y cuántos van; un código que no es de la ruta sale como error (sustituye a lo
   anterior, con su icono) sin cerrar el escáner. Se simulan la cámara (un lienzo) y el lector de códigos del navegador. */
test('Ruta · escanear desde la carga: el hueco en grande en la barra y el error sin cerrar el escáner', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('fds_instalar_cerrado', '1')
    localStorage.setItem('guia_voz', '0')
    window.__ahora = []
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['code_128', 'qr_code'] }
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
  const pedidos = [
    { id: 'p1', codigo: 'COD1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8', estado: 'pendiente', bultos: 1, orden: 1, eta: '09:30', hueco: 'Delante · izq', lat: 43.36, lng: -8.41 },
    { id: 'p2', codigo: 'COD2', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 1, orden: 2, eta: '09:40', hueco: 'Detrás · der', lat: 43.37, lng: -8.40 },
  ]
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/escanear$/, (r) => {
    const b = r.request().postDataJSON()
    const p = pedidos.find((x) => (b.codigos || [b.codigo]).includes(x.codigo))
    if (!p) return r.fulfill({ json: { encontrado: false } })
    p.cargado_en = '2026-10-04T07:00:00Z'
    r.fulfill({ json: { encontrado: true, pedido: p, cargados: pedidos.filter((x) => x.cargado_en).length, total: pedidos.length } })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true, carga_por: 'traseras' }, pedidos } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Cargar la furgoneta/ }).click()
  const carga = page.getByRole('dialog', { name: 'Cargar la furgoneta' })
  // «Escanear» se ve corto y se llama «Escanear para cargar».
  await carga.getByRole('button', { name: 'Escanear para cargar' }).click()
  const escaner = page.getByRole('dialog', { name: 'Escanear' })
  const barra = escaner.getByRole('status')
  await expect(escaner.getByText('Apunta al código')).toBeVisible()
  await expect(barra).toHaveText('0 de 2 cargados')

  // Un paquete de la ruta: su parada, el hueco en grande y la cuenta.
  await page.evaluate(() => { window.__ahora = ['COD1'] })
  await expect(barra).toContainText('Parada 1 · Farmacia Sol')
  await expect(barra).toContainText('→ Delante · izq')
  await expect(barra).toContainText('1 de 2 cargados')

  // Uno que no es de la ruta: el error en la barra, sin lo anterior y sin cerrar el escáner.
  await page.evaluate(() => { window.__ahora = ['NADA'] })
  await expect(barra).toContainText('No es de tu ruta de hoy.')
  await expect(barra).not.toContainText('Parada 1')
  await expect(escaner).toBeVisible()

  // «Listo» vuelve a la carga, que sigue diciendo lo último que entró.
  await escaner.getByRole('button', { name: 'Listo' }).click()
  await expect(escaner).toHaveCount(0)
  await expect(carga.getByText('Parada 1 · Farmacia Sol')).toBeVisible()
  await expect(carga.locator('[data-hueco="Delante · izq"]')).toContainText('1/1')
})
