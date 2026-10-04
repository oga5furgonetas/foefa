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
  expect(desdes.length).toBe(1)
  expect(desdes[0]).toEqual({ lat: 43.3636, lng: -8.4118 })

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
