import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* El mapa del repartidor se mueve con él (04-10-2026): el punto azul sigue la
   posición del móvil, y al alejarse más de 150 m de donde se calculó el camino
   (pasados 30 s) se vuelve a pedir el trazado desde donde está. */
test.use({ locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 } })
test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

test('Mapa en vivo · el recorrido se recalcula desde donde estás cuando avanzas', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
    localStorage.setItem('guia_voz', '0')
    localStorage.setItem('fds_instalar_cerrado', '1')
  })
  await page.clock.install({ time: new Date('2026-10-02T09:32:00+02:00') })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 43.3636, longitude: -8.4118 })
  const fin = new Date(Date.now() + 30 * 86400000).toISOString()
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
    plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
    status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
  const desdes = []
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, async (r) => {
    desdes.push(r.request().postDataJSON()?.desde || null)
    await r.fulfill({ json: { linea: [[43.3636, -8.4118], [43.3639, -8.4099]], fuente: 'carreteras', km: 0.2, minutos: 1 } })
  })
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true },
    pedidos: [{ id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', estado: 'pendiente',
      bultos: 1, orden: 1, eta: '10:05', lat: 43.3639, lng: -8.4099 }] } }))

  await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Mapa' }).click()
  await expect(page.getByText('Por las calles:')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Seguirme' })).toBeVisible()
  // Los botones del mapa miden 48: los dos propios (BotonMapa) y el zoom de Leaflet (diseño compacto, §5.7).
  for (const nombre of ['Seguirme', 'Centrar la ruta', 'Zoom in', 'Zoom out']) {
    const caja = await page.getByRole('button', { name: nombre, exact: true }).boundingBox()
    expect(caja.width, nombre).toBeGreaterThanOrEqual(47.9)    // 48, menos el redondeo del móvil
    expect(caja.height, nombre).toBeGreaterThanOrEqual(47.9)
  }
  expect(desdes.length).toBe(1)
  expect(desdes[0]).toMatchObject({ lat: 43.3636, lng: -8.4118 })   // desde el 30-10 va también la precisión del GPS

  // Un tembleque del GPS (unos metros) no recalcula nada.
  await context.setGeolocation({ latitude: 43.36362, longitude: -8.41178 })
  await page.clock.fastForward(40000)
  await page.waitForTimeout(500)
  expect(desdes.length).toBe(1)

  // Avanza ~400 m: se vuelve a pedir el camino desde la nueva posición.
  await context.setGeolocation({ latitude: 43.3672, longitude: -8.4118 })
  await page.clock.fastForward(40000)
  await expect.poll(() => desdes.length).toBe(2)
  expect(desdes[1].lat).toBeCloseTo(43.3672, 3)

  // «Seguirme» se enciende y se apaga.
  const seguir = page.getByRole('button', { name: 'Seguirme' })
  await seguir.click()
  await expect(seguir).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Centrar la ruta' }).click()
  await expect(seguir).toHaveAttribute('aria-pressed', 'false')
})

/* LAS VENTANAS DEL MAPA (07-11-2026, diseño compacto, §5.7): a 360 se cortaban por el lado (captura 62 del «antes») y las capas
   (C/D, DGT, ZBE) tapaban el título. Ahora la ventana cabe en el mapa, no queda bajo el control del zoom ni bajo las capas
   (a 280 no hay sitio al lado del zoom: se pone por debajo), lleva la letra del tema (14) y sus botones miden 40 como poco. */
test('Mapa en vivo · la ventana de una parada cabe en el mapa a 360 y a 280, sin quedar bajo el zoom ni las capas', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-10-29T10:30:00+01:00') })
  await page.clock.resume()
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
    localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1'); localStorage.setItem('guia_voz', '0')
    localStorage.setItem('ruta_vista', 'mapa')
  })
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 43.3636, longitude: -8.4118 })
  await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
    precios: { mensual: 9.99, anual: 99 }, status: 'active', suscrita: true } }))
  await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { fuente: 'linea_recta', linea: [] } }))
  await page.route(/\/api\/reparto\/mi-ruta\/incidencias/, (r) => r.fulfill({ json: { fuente: 'DGT', publicado: '2026-10-29T10:11:52+01:00', incompleto: false, incidencias: [
    { id: '1', clase: 'corte', que: 'calzada cortada (obras)', gravedad: 'alta', carretera: 'N-550', pk: '12.1', municipio: 'Culleredo', provincia: 'A Coruña',
      lat: 43.352, lng: -8.408, desde: '2025-12-12T08:05:19+01:00', distancia_km: 0.9, parada: 1 }] } }))
  await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
    activo: true, autonomo: true, empresa: '', fecha: '2026-10-29', ia_tickets: false, jornada: {}, aviso_aceptado: true,
    base: null, ruta: { fin: '10:30', minutos: 30, km: 2, trafico: true },
    pedidos: [{ id: 'p1', cliente: 'Farmacia Sol', direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 1,
      orden: 1, eta: '10:05', lat: 43.363889, lng: -8.409899,
      cliente_dice: { estare: 'no', dejar: 'vecino', franja: null, portal: '1234', nota: '', cuando: '2026-10-29T09:00:00Z' } }] } }))

  // Dos rectángulos se pisan si comparten más de 2 px en los dos ejes.
  const pisan = (a, b) => a.x < b.x + b.width - 2 && a.x + a.width > b.x + 2 && a.y < b.y + b.height - 2 && a.y + a.height > b.y + 2
  for (const ancho of [360, 280]) {
    await page.setViewportSize({ width: ancho, height: 800 })
    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    const capas = page.getByRole('group', { name: 'Capas del mapa' })
    await expect(capas.getByRole('button', { name: 'DGT 1' })).toBeVisible()
    await page.locator('.leaflet-marker-icon[title="Farmacia Sol"]').click()
    const ventana = page.locator('.leaflet-popup').last()
    await expect(ventana).toContainText('1 · Farmacia Sol')
    // La ventana se coloca con una animación de 250 ms: se mide hasta que se asienta.
    await expect.poll(async () => {
      const [mapa, v, zoom, arriba] = await Promise.all([page.locator('.leaflet-container').boundingBox(), ventana.boundingBox(),
        page.locator('.leaflet-control-zoom').boundingBox(), capas.boundingBox()])
      return {
        dentro: v.x >= mapa.x - 1 && v.x + v.width <= mapa.x + mapa.width + 1 && v.y >= mapa.y - 1 && v.y + v.height <= mapa.y + mapa.height + 1,
        bajoElZoom: pisan(v, zoom), bajoLasCapas: pisan(v, arriba),
      }
    }, { message: `la ventana a ${ancho}` }).toEqual({ dentro: true, bajoElZoom: false, bajoLasCapas: false })
    expect(await ventana.locator('.leaflet-popup-content').evaluate((el) => getComputedStyle(el).fontSize)).toBe('14px')
    for (const [rol, nombre] of [['button', 'Ir'], ['link', 'Llamar'], ['button', 'Abrir']]) {
      const caja = await ventana.getByRole(rol, { name: nombre, exact: true }).boundingBox()
      expect(caja.height, `${nombre} a ${ancho}`).toBeGreaterThanOrEqual(40)
    }
  }
})

/* El mapa es el mismo componente en el panel de escritorio (riesgo 11 de la especificación): ahí el zoom de Leaflet se queda como
   estaba (la regla de 48 es de la app de reparto, `.app-ruta`) y «Centrar la ruta» es el BotonMapa de 48. */
test('Mapa en vivo · el mapa del panel de reparto conserva su zoom de Leaflet y lleva el botón de 48', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await entrarComoAdmin(page)
  await simularApi(page, 'lleno')
  await page.goto('/panel/reparto', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Centrar la ruta' })).toBeVisible()
  const zoom = await page.getByRole('button', { name: 'Zoom in', exact: true }).boundingBox()
  expect(zoom.width).toBeLessThan(48)
  const centrar = await page.getByRole('button', { name: 'Centrar la ruta' }).boundingBox()
  expect(centrar.width).toBeGreaterThanOrEqual(47.9)    // 48, menos el redondeo del móvil
  expect(centrar.height).toBeGreaterThanOrEqual(47.9)
})
