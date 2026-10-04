import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ────────────────────────────────────────────────────────────────────────────
   EL VÍDEO PARA TIKTOK / REELS (04-10-2026). Grabación de la app DE VERDAD
   (misma API simulada que las capturas), en vertical, ~22 s, con rótulos
   grandes encima de la pantalla: lo que se ve es lo que hace la app.

   Guion (lo que vende, en el orden en que un repartidor lo vive):
     0-4 s   «¿Aún ordenas la ruta a mano?»          — la lista de paradas
     4-9 s   «Foto a la etiqueta y entra sola»       — se abre «Pedido nuevo»
     9-14 s  «La ruta se ordena sola por tiempo»     — el mapa con el trazado
     14-20 s «Te guía con voz hasta cada puerta»     — la navegación
     20-24 s «Entregado. Siguiente.» + «GRATIS 7 días» — cierre con marca

   Uso:  npx playwright test video-tiktok --project=escritorio --update-snapshots
   Salida: test-results/video-tiktok/<idioma>.webm  → luego node e2e/video-montar.mjs
   ──────────────────────────────────────────────────────────────────────────── */

const ESC = {
  es: {
    locale: 'es-ES',
    mas: 'Más formas de añadir', clientes: ['Bar Pepe', 'Lucía M.', 'Farmacia Sol', 'Kiosko Luz'],
    rotulos: ['¿Aún ordenas la ruta a mano?', 'Foto a la etiqueta y entra sola', 'La ruta se ordena sola por tiempo',
      'Te guía con voz hasta cada puerta', 'Entregado. Siguiente.'],
    cierre: ['GRATIS 7 días', 'FDS · flotadsp.com'],
    botonNav: 'Empezar a navegar', botonNuevo: 'Añadir un pedido sin código',
  },
  zh: {
    locale: 'zh-CN',
    mas: '更多添加方式', clientes: ['王记超市', '李女士', 'Farmacia Sol', '陈先生'],
    rotulos: ['还在手动排路线？', '拍面单，地址自动录入', '路线按时间自动排好', '中文语音导航到每个门口', '已送达，下一站。'],
    cierre: ['免费7天', 'FDS · flotadsp.com/cn'],
    botonNav: '开始导航', botonNuevo: '添加无单号订单',
  },
  en: {
    locale: 'en-GB',
    mas: 'More ways to add', clientes: ["Pepe's Bar", 'Lucy M.', 'Sun Pharmacy', 'Luz Kiosk'],
    rotulos: ['Still planning your route by hand?', 'Snap the label: address goes in', 'The route sorts itself by time',
      'Voice guidance to every door', 'Delivered. Next.'],
    cierre: ['FREE 7 days', 'FDS · flotadsp.com'],
    botonNav: 'Start navigation', botonNuevo: 'Add an order without a code',
  },
  pt: {
    locale: 'pt-PT',
    mas: 'Mais formas de adicionar', clientes: ['Bar do Zé', 'Lúcia M.', 'Farmácia Sol', 'Quiosque Luz'],
    rotulos: ['Ainda ordenas a rota à mão?', 'Foto à etiqueta e a morada entra', 'A rota ordena-se sozinha por tempo',
      'Guia-te por voz até cada porta', 'Entregue. Seguinte.'],
    cierre: ['GRÁTIS 7 dias', 'FDS · flotadsp.com'],
    botonNav: 'Começar a navegar', botonNuevo: 'Adicionar uma encomenda sem código',
  },
  fr: {
    locale: 'fr-FR',
    mas: 'Plus de façons d’ajouter', clientes: ['Bar Pépé', 'Lucie M.', 'Pharmacie Soleil', 'Kiosque Luz'],
    rotulos: ['Vous triez encore votre tournée à la main ?', "Photo de l'étiquette : l'adresse est saisie", 'La tournée se trie toute seule',
      "Guidage vocal jusqu'à chaque porte", 'Livré. Suivant.'],
    cierre: ['GRATUIT 7 jours', 'FDS · flotadsp.com'],
    botonNav: 'Démarrer la navigation', botonNuevo: 'Ajouter une commande sans code',
  },
  it: {
    locale: 'it-IT',
    mas: 'Altri modi per aggiungere', clientes: ['Bar Pepe', 'Lucia M.', 'Farmacia Sole', 'Edicola Luz'],
    rotulos: ['Ordini ancora il giro a mano?', "Foto all'etichetta e l'indirizzo entra", 'Il percorso si ordina da solo',
      'Guida vocale fino a ogni porta', 'Consegnato. Avanti.'],
    cierre: ['GRATIS 7 giorni', 'FDS · flotadsp.com'],
    botonNav: 'Avvia navigazione', botonNuevo: 'Aggiungi un ordine senza codice',
  },
  de: {
    locale: 'de-DE',
    mas: 'Weitere Wege zum Hinzufügen', clientes: ['Bar Pepe', 'Lucia M.', 'Sonnen-Apotheke', 'Kiosk Luz'],
    rotulos: ['Planst du deine Tour noch von Hand?', 'Etikett fotografieren, Adresse ist drin', 'Die Route sortiert sich von selbst',
      'Sprachführung bis zu jeder Tür', 'Zugestellt. Weiter.'],
    cierre: ['GRATIS 7 Tage', 'FDS · flotadsp.com'],
    botonNav: 'Navigation starten', botonNuevo: 'Auftrag ohne Code hinzufügen',
  },
}

/* El trazado y la navegación son REALES (el camino por las calles que da el
   servidor de rutas entre estas mismas paradas, e2e/fixtures/coruna-real.json):
   antes eran 5 puntos a mano y en el vídeo se veían rayas rectas. */
const REAL = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-real.json'), 'utf8'))
const NAVEGAR = REAL.navegar
const YO = { latitude: 43.3636, longitude: -8.4118 }

const pedidosDe = (c) => [
  { id: 'p1', cliente: c[2], direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.363889, lng: -8.409899, franja: ['10:00', '12:00'] },
  { id: 'p2', cliente: c[1], direccion: 'Rúa Emilia Pardo Bazán 14, A Coruña', telefono: '600000002', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.363999, lng: -8.407109, cobrar: 24.5, hueco: 'Medio · der' },
  { id: 'p3', cliente: c[0], direccion: 'Rúa Marcial del Adalid 5, A Coruña', telefono: '600000001', estado: 'pendiente', bultos: 2, orden: 3, eta: '10:24', lat: 43.36219, lng: -8.407002, hueco: 'Detrás · izq' },
  { id: 'p4', cliente: c[3], direccion: 'Rúa San Andrés 30, A Coruña', estado: 'entregado', bultos: 1, orden: 4, cobrado_importe: 12, cobrado_metodo: 'tarjeta', cerrado_en: '2026-10-02T08:00:00Z' },
]

/* El rótulo: una capa encima de la app, grande y legible en un móvil, con la
   fuente del sistema. Se mete y se quita por DOM: no toca la app. */
const ROTULO_CSS = `
  #rotulo-video { position: fixed; left: 24px; right: 24px; top: 72px; z-index: 99999; pointer-events: none;
    font: 900 44px/1.08 Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; letter-spacing: -1px;
    color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,.75), 0 0 28px rgba(0,0,0,.55);
    background: linear-gradient(135deg, rgba(5,28,30,.92), rgba(5,28,30,.78)); border-radius: 22px; padding: 18px 22px;
    border: 2px solid rgba(20,231,216,.7); opacity: 0; transform: translateY(-12px); transition: opacity .35s, transform .35s }
  #rotulo-video.ver { opacity: 1; transform: none }
  #cierre-video { position: fixed; inset: 0; z-index: 99998; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
    background: radial-gradient(120% 80% at 80% 10%, #0b6e6a 0%, #071a1f 45%, #04090c 100%); opacity: 0; transition: opacity .5s }
  #cierre-video.ver { opacity: 1 }
  #cierre-video .gratis { text-align: center; max-width: 88vw; font: 900 62px/1.05 Inter, system-ui, sans-serif; letter-spacing: 1px; background: #FFD43B; color: #1a1300; border-radius: 28px; padding: 14px 44px; transform: rotate(-3deg); box-shadow: 0 16px 50px rgba(255,212,59,.35) }
  #cierre-video .marca { font: 700 34px/1.2 Inter, system-ui, sans-serif; color: #d7fff9; margin-top: 12px; text-align: center }
  #cierre-video .logo { width: 110px; height: 110px; border-radius: 30px; background: #0FC2BC; color: #04201f; display: flex; align-items: center; justify-content: center; font: 900 44px Inter, system-ui, sans-serif }
`

// Los instantes de cada rótulo (segundos desde que arranca la grabación), para
// colocar la voz en off encima en el montaje.
let t0 = 0
const marcas = []
async function rotulo(page, texto) {
  marcas.push((Date.now() - t0) / 1000)
  await page.evaluate((t) => {
    let el = document.getElementById('rotulo-video')
    if (!el) { el = document.createElement('div'); el.id = 'rotulo-video'; document.body.appendChild(el) }
    el.classList.remove('ver'); el.textContent = t
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('ver')))
  }, texto)
}

// El vídeo va al nivel del fichero (Playwright no lo admite dentro de un describe).
test.use({
  timezoneId: 'Europe/Madrid', viewport: { width: 540, height: 960 }, deviceScaleFactor: 2,
  // El vídeo se graba al tamaño del viewport (Playwright solo REDUCE: si se
  // pide 1080×1920 sale la pantalla pequeña y gris alrededor, visto el 04-10).
  // Se escala a 1080×1920 al montar (e2e/video-montar.mjs).
  video: { mode: 'on', size: { width: 540, height: 960 } },
})

for (const [lang, cfg] of Object.entries(ESC)) {
  test.describe(`vídeo TikTok (${lang})`, () => {
    test.use({ locale: cfg.locale })
    test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

    test('grabar', async ({ page, context }, testInfo) => {
      test.skip(!['all', 'changed'].includes(testInfo.config.updateSnapshots), 'solo con --update-snapshots')
      // La grabación arranca con la página (justo antes de esta línea).
      t0 = Date.now(); marcas.length = 0
      test.setTimeout(180_000)
      await page.addInitScript((css) => {
        localStorage.setItem('cookie_consent', JSON.stringify({ v: 1, at: new Date().toISOString() }))
        localStorage.setItem('guia_voz', '0')
        localStorage.setItem('fds_instalar_cerrado', '1')
        document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s) })
      }, ROTULO_CSS)
      await page.clock.install({ time: new Date('2026-10-02T09:32:00+02:00') })
      await page.clock.resume()
      await entrarComoAdmin(page)
      await simularApi(page, 'vacio')
      await context.grantPermissions(['geolocation'])
      await context.setGeolocation(YO)
      const fin = new Date(Date.now() + 30 * 86400000).toISOString()
      await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
        plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
        precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
        status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
      await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: REAL.trazado }))
      await page.route(/\/api\/reparto\/mi-ruta\/navegar/, (r) => r.fulfill({ json: NAVEGAR }))
      let pedidos = pedidosDe(cfg.clientes)
      await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => {
        pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: 'entregado', cerrado_en: new Date().toISOString() } : p))
        await r.fulfill({ json: {} })
      })
      await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
        activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: false, jornada: {}, aviso_aceptado: true,
        base: null, ruta: { fin: '10:30', minutos: 30, km: REAL.trazado.km, trafico: true }, pedidos } }))

      // 1. La lista.
      await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(700)
      await rotulo(page, cfg.rotulos[0])
      await page.waitForTimeout(1900)

      // 2. Pedido nuevo (la foto a la etiqueta): se abre y se cierra.
      await page.getByRole('button', { name: cfg.mas }).click()
      await page.getByRole('button', { name: cfg.botonNuevo }).click()
      await page.waitForTimeout(400)
      await rotulo(page, cfg.rotulos[1])
      await page.waitForTimeout(2000)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: /^(Cerrar|关闭|Close|Fechar|Fermer|Chiudi|Schließen)$/ }).first().click().catch(() => {})
      await page.waitForTimeout(500)

      // 3. El mapa con el trazado.
      await page.getByRole('group').getByRole('button').nth(1).click()
      const contenedor = page.locator('.leaflet-container').first()
      await contenedor.scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollBy(0, 200))
      await rotulo(page, cfg.rotulos[2])
      await page.waitForTimeout(3000)
      await page.evaluate(() => window.scrollTo(0, 0))

      // 4. La navegación.
      await page.getByRole('button', { name: cfg.botonNav }).click()
      await context.setGeolocation({ latitude: 43.36361, longitude: -8.41181 })   // Chromium emulado solo avisa si cambia
      const nav = page.getByRole('dialog')
      await expect(nav.getByTestId('guia-texto')).toBeVisible()
      await rotulo(page, cfg.rotulos[3])
      await page.waitForTimeout(1500)
      await context.setGeolocation({ latitude: 43.3638, longitude: -8.4108 })
      await page.waitForTimeout(1500)
      await context.setGeolocation({ latitude: 43.363889, longitude: -8.409899 })
      await page.waitForTimeout(1100)

      // 5. Entregado.
      await rotulo(page, cfg.rotulos[4])
      await nav.getByRole('button', { name: /^(Entregado|已送达|Delivered|Entregue|Livré|Consegnato|Zugestellt)$/ }).click()
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: /^(Entregar sin foto|不拍照直接送达|Deliver without photo|Entregar sem foto|Livrer sans photo|Consegna senza foto|Ohne Foto zustellen)$/ }).click().catch(() => {})
      await page.waitForTimeout(1300)

      // 6. Cierre con marca.
      marcas.push((Date.now() - t0) / 1000)
      await page.evaluate(([g, m]) => {
        document.getElementById('rotulo-video')?.remove()
        const c = document.createElement('div'); c.id = 'cierre-video'
        c.innerHTML = `<div class="logo">FDS</div><div class="gratis"></div><div class="marca"></div>`
        c.querySelector('.gratis').textContent = g; c.querySelector('.marca').textContent = m
        document.body.appendChild(c)
        requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('ver')))
      }, cfg.cierre)
      await page.waitForTimeout(2800)

      const destino = path.join(process.cwd(), 'test-results', 'video-tiktok')
      fs.mkdirSync(destino, { recursive: true })
      await context.close()
      const v = await page.video().path()
      fs.copyFileSync(v, path.join(destino, `${lang}.webm`))
      fs.writeFileSync(path.join(destino, `${lang}.json`), JSON.stringify({ marcas, fin: (Date.now() - t0) / 1000 }))
    })
  })
}
