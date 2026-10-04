import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ────────────────────────────────────────────────────────────────────────────
   Capturas de la APP DEL REPARTIDOR, una tanda por idioma, para la portada
   (/cn enseña las de chino) y los anuncios. Igual que capturas.spec.js: es la
   app de verdad con la API simulada, no maquetas; si cambia una pantalla se
   relanza y se rehacen.

   Uso:  npx playwright test capturas-ruta --project=escritorio --update-snapshots
   Salida: public/capturas-ruta/<idioma>/{1-ruta,2-mapa,3-navegando}.png
   ──────────────────────────────────────────────────────────────────────────── */

const IDIOMAS = {
  zh: { locale: 'zh-CN', clientes: ['王记超市', '李女士', 'Farmacia Sol', '陈先生'] },
  es: { locale: 'es-ES', clientes: ['Bar Pepe', 'Lucía M.', 'Farmacia Sol', 'Kiosko Luz'] },
}

const pedidosDe = (c) => [
  { id: 'p1', cliente: c[0], direccion: 'Rúa Galera 10, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 2, orden: 1, eta: '10:05', lat: 43.3704, lng: -8.4003, hueco: 'Detrás · izq' },
  { id: 'p2', cliente: c[1], direccion: 'Rúa Real 5, A Coruña', telefono: '600000002', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:14', lat: 43.3690, lng: -8.4010, cobrar: 24.5, hueco: 'Medio · der' },
  { id: 'p3', cliente: c[2], direccion: 'Avda. Montero Ríos 12, A Coruña', estado: 'pendiente', bultos: 1, orden: 3, eta: '10:26', lat: 43.3660, lng: -8.4060, franja: ['10:00', '12:00'] },
  { id: 'p4', cliente: c[3], direccion: 'Rúa San Andrés 30, A Coruña', estado: 'entregado', bultos: 1, orden: 4, cobrado_importe: 12, cobrado_metodo: 'tarjeta', cerrado_en: '2026-10-04T08:00:00Z' },
]

const NAVEGAR = {
  fuente: 'carreteras', metros: 999, minutos: 4.1,
  linea: [[43.3665, -8.4065], [43.3675, -8.4074], [43.3679, -8.4066], [43.3713, -8.4006], [43.3704, -8.4003]],
  pasos: [
    { texto: 'Sal por Túnel Praza de Lugo', icono: 'recto', punto: [43.3665, -8.4065], metros: 140, calle: 'Praza de Lugo', maniobra: { tipo: 'depart' } },
    { texto: 'Gira a la derecha por Praza de Pontevedra', icono: 'derecha', punto: [43.3675, -8.4074], metros: 86, calle: 'Praza de Pontevedra', maniobra: { tipo: 'turn', mod: 'right' } },
    { texto: 'Sigue recto por Rúa San Andrés', icono: 'recto', punto: [43.3679, -8.4066], metros: 620, calle: 'Rúa San Andrés', maniobra: { tipo: 'continue', mod: 'straight' } },
    { texto: 'Gira a la derecha por Rúa Torreiro', icono: 'derecha', punto: [43.3713, -8.4006], metros: 99, calle: 'Rúa Torreiro', maniobra: { tipo: 'turn', mod: 'right' } },
    { texto: 'Has llegado', icono: 'llegada', punto: [43.3704, -8.4003], metros: 0, maniobra: { tipo: 'arrive' } },
  ],
}

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
      await context.setGeolocation({ latitude: 43.3677, longitude: -8.4070 })
      const fin = new Date(Date.now() + 30 * 86400000).toISOString()
      await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
        plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
        precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
        status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
      await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: {
        linea: [[43.3704, -8.4003], [43.3697, -8.4007], [43.3690, -8.4010], [43.3675, -8.4035], [43.3660, -8.4060]],
        fuente: 'carreteras', km: 3.1, minutos: 9 } }))
      await page.route(/\/api\/reparto\/mi-ruta\/navegar/, (r) => r.fulfill({ json: NAVEGAR }))
      await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
        activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: false, jornada: {}, aviso_aceptado: true,
        base: null, ruta: { fin: '10:40', minutos: 40, km: 9.5, trafico: true }, pedidos: pedidosDe(cfg.clientes) } }))

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
      const nav = page.getByRole('dialog')
      await expect(nav.getByTestId('guia-texto')).toBeVisible()
      await page.waitForTimeout(3500)
      await page.screenshot({ path: path.join(destino, '3-navegando.png') })

    })
  })
}
