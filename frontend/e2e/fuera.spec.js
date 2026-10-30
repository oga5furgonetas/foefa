import { test, expect } from '@playwright/test'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* FUERA DE ESPAÑA (30-10-2026, Dani: «si un tío es de Estados Unidos y abre la aplicación en Estados Unidos, le
   funcione como debe de ser en Estados Unidos; no que le aparezca algo de España ni se le mezcle nada»).
   Un repartidor de Seattle con el navegador en inglés: la ruta en inglés, las distancias en millas, el dinero en
   dólares, los cortes del WZDx (no de la DGT) y sin zonas de bajas emisiones (allí no hay); la portada con el plan
   en dólares; las páginas legales en inglés. Nada de red de verdad: la API está simulada. */

test.describe('fuera de España · Estados Unidos', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/Los_Angeles', viewport: { width: 390, height: 844 } })
  test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

  test('la ruta de un repartidor de Seattle: inglés, millas, dólares y WZDx', async ({ page, context }) => {
    await page.clock.install({ time: new Date('2026-10-29T10:30:00-07:00') })
    await page.clock.resume()
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
      localStorage.setItem('fds_tour_ruta', '1'); localStorage.setItem('fds_aviso_manana', 'no'); localStorage.setItem('fds_instalar_cerrado', '1')
      localStorage.setItem('ruta_vista', 'lista')
    })
    await entrarComoAdmin(page)
    await simularApi(page, 'vacio')
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 47.6062, longitude: -122.3321 })
    const pedidos = [
      { id: 'p1', cliente: 'Pike Place Fish', direccion: '86 Pike St, Seattle, WA 98101', telefono: '2065550123', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05',
        lat: 47.6097, lng: -122.3422, cobrar: 24.5 },
      { id: 'p2', cliente: 'Maria L.', direccion: '400 Broad St, Seattle, WA 98109', estado: 'pendiente', bultos: 2, orden: 2, eta: '10:20', lat: 47.6205, lng: -122.3493 },
    ]
    await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: { plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
      precios: { moneda: 'USD', mensual: 9.99, anual: 99 }, unidades: 'mi', pais: 'us', status: 'active', suscrita: true } }))
    await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: { activo: true, autonomo: true, empresa: '', fecha: '2026-10-29', ia_tickets: false, jornada: {},
      aviso_aceptado: true, base: null, ruta: { fin: '10:40', minutos: 30, km: 5.15, trafico: true }, pedidos,
      ganancias: { pago_parada: 300, pago_dia: 0, coste_km: 12 }, pais: 'us', prefijo: '1', unidades: 'mi', moneda: 'USD' } }))
    await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: { fuente: 'linea_recta', linea: [] } }))
    await page.route(/\/api\/reparto\/mi-ruta\/zonas-carga/, (r) => r.fulfill({ json: { zonas: [], incompleto: false } }))
    // Lo que dice el WZDx de Washington (como lo devuelve el servidor para EE. UU.): obras en la I-5, sin zonas.
    await page.route(/\/api\/reparto\/mi-ruta\/incidencias/, (r) => r.fulfill({ json: { fuente: 'WZDx · Washington State DOT', publicado: '', incompleto: false, aplica: true, avisos: [], incidencias: [
      { id: 'w1', clase: 'obras', que: 'obras', gravedad: '', carretera: 'I-5', pk: '', municipio: '', provincia: '', lat: 47.605, lng: -122.33, lat2: 47.61, lng2: -122.33,
        desde: '2026-01-26T00:00:00+00:00', texto: 'I-5/Yesler Way to Northgate - pavement and drainage', fuente: 'WZDx · Washington State DOT', distancia_km: 0.5, parada: 1 }] } }))
    await page.route(/\/api\/reparto\/mi-ruta\/zbe/, (r) => r.fulfill({ json: { zonas: [], paradas: {}, fuente: null, incompleto: false, aplica: false, tipo: 'LEZ' } }))

    await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Next stop', { exact: false }).first()).toBeVisible()
    const cuerpo = page.locator('body')
    // Millas y dólares, con los números en inglés.
    await expect(cuerpo).toContainText('3.2 mi')
    await expect(cuerpo).toContainText('$24.50')
    // Los cortes vienen del WZDx, y se dice (con el mapa abierto); nada de la DGT ni de ZBE.
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    const dgt = page.getByTestId('dgt')
    await expect(dgt).toContainText('Closures and roadworks (WZDx): 1 near your route · roadworks · I-5')
    await expect(cuerpo).not.toContainText('DGT')
    await expect(cuerpo).not.toContainText('ZBE')
    await expect(page.getByTestId('zbe')).toHaveCount(0)
    // Nada en español en la pantalla de la ruta.
    for (const palabra of ['Siguiente parada', 'Entregado', 'Navegar', 'Cortes y obras', 'Hoy llevas', 'Acabas']) {
      await expect(cuerpo, `«${palabra}» no debería salir en inglés`).not.toContainText(palabra)
    }
  })

  test('la portada en dólares y las páginas legales en inglés', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' })) })
    await simularApi(page, 'vacio')
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).toContainText('$9.99')
    await expect(page.locator('body')).not.toContainText('9,99 €')
    await page.goto('/privacidad', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy')
    await expect(page.locator('body')).toContainText('This is a courtesy translation')
    await page.goto('/terminos', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms and Conditions of Use')
    await page.goto('/cookies', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cookie Policy')
  })
})
