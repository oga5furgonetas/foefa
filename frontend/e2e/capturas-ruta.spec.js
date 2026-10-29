import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ────────────────────────────────────────────────────────────────────────────
   Capturas de la APP DEL REPARTIDOR, una tanda por idioma, para la portada
   y los anuncios. Igual que capturas.spec.js: es la
   app de verdad con la API simulada, no maquetas; si cambia una pantalla se
   relanza y se rehacen.

   Uso:  npx playwright test capturas-ruta --project=escritorio --update-snapshots
   Salida: public/capturas-ruta/<idioma>/{1-ruta,2-mapa,3-navegando}.png
   ──────────────────────────────────────────────────────────────────────────── */

const IDIOMAS = {
  es: { locale: 'es-ES', clientes: ['Bar Pepe', 'Lucía M.', 'Farmacia Sol', 'Kiosko Luz'] },
}

const pedidosDe = (c) => [
  { id: 'p3', cliente: c[2], direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.363889, lng: -8.409899, franja: ['10:00', '12:00'] },
  { id: 'p2', cliente: c[1], direccion: 'Rúa Emilia Pardo Bazán 14, A Coruña', telefono: '600000002', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.363999, lng: -8.407109, cobrar: 24.5, hueco: 'Medio · der' },
  { id: 'p1', cliente: c[0], direccion: 'Rúa Marcial del Adalid 5, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 2, orden: 3, eta: '10:24', lat: 43.36219, lng: -8.407002, hueco: 'Detrás · izq' },
  { id: 'p4', cliente: c[3], direccion: 'Rúa San Andrés 30, A Coruña', estado: 'entregado', bultos: 1, orden: 4, cobrado_importe: 12, cobrado_metodo: 'tarjeta', cerrado_en: '2026-10-04T08:00:00Z' },
]

/* El trazado y la navegación son REALES: el camino por las calles que da el
   servidor de rutas (OSRM) entre estas mismas paradas, guardado en
   fixtures/coruna-real.json. Antes eran 5 puntos escritos a mano y en las
   capturas se veían rayas rectas (04-10-2026, Dani). */
const REAL = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-real.json'), 'utf8'))
const NAVEGAR = REAL.navegar

for (const [lang, cfg] of Object.entries(IDIOMAS)) {
  test.describe(`capturas de la app de ruta (${lang})`, () => {
    test.use({ locale: cfg.locale, timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
    test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

    test('generar', async ({ page, context }, testInfo) => {
      test.skip(!['all', 'changed'].includes(testInfo.config.updateSnapshots), 'solo con --update-snapshots')
      test.setTimeout(120_000)
      const destino = path.join(process.cwd(), 'public', 'capturas-ruta', lang)
      fs.mkdirSync(destino, { recursive: true })

      await page.addInitScript(() => {
        localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
        localStorage.setItem('guia_voz', '0')
        localStorage.setItem('fds_instalar_cerrado', '1')
      })
      // Un viernes por la mañana YA PASADO (si fuese futuro, la sesión simulada
      // saldría caducada): las horas de llegada salen creíbles, no las 4:46.
      await page.clock.install({ time: new Date('2026-10-02T09:32:00+02:00') })
      await page.clock.resume()   // que el tiempo corra: el mapa anima sus teselas con la hora
      await entrarComoAdmin(page)
      await simularApi(page, 'vacio')
      await context.grantPermissions(['geolocation'])
      await context.setGeolocation({ latitude: 43.3636, longitude: -8.4118 })
      const fin = new Date(Date.now() + 30 * 86400000).toISOString()
      await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
        plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
        precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
        status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
      await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: REAL.trazado }))
      await page.route(/\/api\/reparto\/mi-ruta\/navegar/, (r) => r.fulfill({ json: NAVEGAR }))
      await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
        activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: false, jornada: {}, aviso_aceptado: true,
        base: null, ruta: { fin: '10:30', minutos: 30, km: REAL.trazado.km, trafico: true }, pedidos: pedidosDe(cfg.clientes) } }))

      await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      await page.screenshot({ path: path.join(destino, '1-ruta.png') })

      const mapa = page.getByRole('group').getByRole('button').nth(1)   // [Lista, Mapa]
      await mapa.click()
      const contenedor = page.locator('.leaflet-container').first()
      await contenedor.scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollBy(0, 260))
      await page.waitForTimeout(3500)   // teselas del mapa
      await page.screenshot({ path: path.join(destino, '2-mapa.png') })
      await page.evaluate(() => window.scrollTo(0, 0))

      await page.getByRole('button', { name: /^(Empezar a navegar|开始导航)$/ }).click()
      // Chromium emulado solo avisa de la posición cuando cambia: un empujón para la guía.
      await context.setGeolocation({ latitude: 43.36361, longitude: -8.41181 })
      const nav = page.getByRole('dialog')
      await expect(nav.getByTestId('guia-texto')).toBeVisible()
      await page.waitForTimeout(3500)
      await page.screenshot({ path: path.join(destino, '3-navegando.png') })

    })
  })
}
