import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* El repartidor puede corregir una parada (calle, cliente, teléfono, bultos…)
   y quitarla de su ruta (04-10-2026). Quitar pide un segundo toque. */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })

test('Ruta · editar una parada y quitarla con doble toque', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  let pedidos = [
    { id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.36, lng: -8.41 },
    { id: 'p2', cliente: 'Bar Pepe', direccion: 'Rúa Real 5', estado: 'pendiente', bultos: 2, orden: 2, eta: '10:16', lat: 43.37, lng: -8.40 },
  ]
  const editados = []
  const quitados = []
  // El buscador de direcciones (Photon) devuelve una sugerencia con su punto exacto.
  await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ json: { features: [
    { geometry: { coordinates: [-8.405, 43.369] }, properties: { street: 'Avenida Montero Ríos', housenumber: '12', postcode: '15001', city: 'A Coruña', countrycode: 'ES' } },
    { geometry: { coordinates: [-8.4, 43.37] }, properties: { name: 'Zona sin calle', countrycode: 'ES' } },
  ] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mis-pedidos\/p1\/editar/, async (r) => {
    const b = r.request().postDataJSON(); editados.push(b)
    pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, cliente: b.cliente, direccion: b.direccion, bultos: Number(b.bultos), telefono: b.telefono } : p))
    await r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/reparto\/mis-pedidos\/p1\/quitar/, async (r) => {
    quitados.push('p1'); pedidos = pedidos.filter((p) => p.id !== 'p1'); await r.fulfill({ json: { ok: true } })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true }, pedidos } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  const sig = page.locator('div.rounded-2xl', { hasText: 'Siguiente parada' })
  await expect(sig.getByText('Farmacia Sol')).toBeVisible()

  // Con paradas cargadas (17-10-2026), añadir va en el botón «+»: la hoja trae escanear, el código y lo demás.
  await expect(page.getByPlaceholder('o escribe el código')).toHaveCount(0)
  await page.getByRole('button', { name: 'Añadir paradas' }).click()
  await expect(page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'Escanear', exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('o escribe el código')).toBeVisible()
  await page.getByRole('dialog', { name: 'Añadir paradas' }).getByRole('button', { name: 'Cerrar' }).click()

  // Editar: se abre la hoja con los datos de la parada y sin la foto del ticket.
  await sig.getByRole('button', { name: /Editar parada: Farmacia Sol/ }).click()
  await expect(page.getByRole('heading', { name: 'Editar parada' })).toBeVisible()
  await expect(page.getByText('Foto del ticket')).toHaveCount(0)
  await page.getByPlaceholder('Dirección completa').fill('Montero Ríos 12')
  await page.getByRole('button', { name: /Avenida Montero Ríos 12, 15001 A Coruña/ }).click()
  await expect(page.getByText('Sitio encontrado en el mapa')).toBeVisible()
  await page.getByPlaceholder('Cliente', { exact: true }).fill('Farmacia Sol 2')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('✓ Cambios guardados')).toBeVisible()
  expect(editados).toHaveLength(1)
  expect(editados[0]).toMatchObject({ direccion: 'Avenida Montero Ríos 12, 15001 A Coruña', lat: 43.369, lng: -8.405, cliente: 'Farmacia Sol 2', telefono: '600000001' })
  await expect(page.getByText('Farmacia Sol 2')).toBeVisible()

  // Quitar: el primer toque pide confirmar, el segundo la quita.
  await page.getByRole('button', { name: /Editar parada: Farmacia Sol 2/ }).click()
  await page.getByRole('button', { name: 'Quitar esta parada' }).click()
  expect(quitados).toEqual([])
  await page.getByRole('button', { name: '¿Seguro? Toca otra vez para quitarla' }).click()
  await expect(page.getByText('Parada quitada de tu ruta')).toBeVisible()
  expect(quitados).toEqual(['p1'])
  await expect(page.getByText('Farmacia Sol 2')).toHaveCount(0)
})

test('Ruta · reordenar arrastrando el asa de una parada', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  const pedidos = ['Uno', 'Dos', 'Tres'].map((c, i) => ({ id: `p${i + 1}`, cliente: c, direccion: `Calle ${i + 1}`, estado: 'pendiente', bultos: 1, orden: i + 1, lat: 43.36 + i / 100, lng: -8.4 }))
  const ordenes = []
  await page.route(/\/api\/reparto\/mi-ruta\/orden/, async (r) => {
    ordenes.push(r.request().postDataJSON().ids)
    await r.fulfill({ json: { ordenados: 3, ruta: { fin: '11:00', manual: true } } })
  })
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { linea: [], fuente: 'linea_recta' } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-04', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true }, pedidos } }))
  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'A mano' }).click()
  const asa = page.getByRole('button', { name: /Arrastrar Uno/ })
  const destino = page.getByRole('button', { name: /Arrastrar Tres/ })
  const a = await asa.boundingBox()
  const b = await destino.boundingBox()
  // Se agarra el asa de «Uno» y se suelta por debajo de «Tres».
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, (a.y + b.y) / 2, { steps: 5 })
  await page.mouse.move(a.x + a.width / 2, b.y + b.height + 6, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Guardar este orden' }).click()
  await expect.poll(() => ordenes.length).toBe(1)
  expect(ordenes[0]).toEqual(['p2', 'p3', 'p1'])
})
