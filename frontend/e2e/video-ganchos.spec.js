import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { simularApi, entrarComoAdmin } from './api-simulada.js'

/* ────────────────────────────────────────────────────────────────────────────
   LOS OTROS GANCHOS DEL ANUNCIO (05-10-2026). Meta no deja segmentar por
   «repartidor»: el propio anuncio tiene que elegir a quién habla. Cada vídeo
   enseña UN dolor concreto de quien reparte para una agencia, con la app de
   verdad (misma API simulada que los otros vídeos) y solo lo que la app hace:

     llama  — «¿Cuántas veces te llaman para preguntar dónde estás?»
              → el mensaje de WhatsApp con tu hora de llegada (texto REAL del
                enlace del botón, no inventado).
     cobro  — «¿Cobras contrarreembolso?» → apuntar cómo pagan y lo cobrado.

   Uso:  npx playwright test video-ganchos --project=escritorio --update-snapshots
   Salida: test-results/video-tiktok/<idioma>-<gancho>.webm → node e2e/video-montar.mjs
   ──────────────────────────────────────────────────────────────────────────── */

const TEXTOS = {
  es: {
    locale: 'es-ES', pais: 'es', clientes: ['Lucía M.', 'Farmacia Sol', 'Bar Pepe'],
    llama: ['¿Te llaman para preguntar dónde estás?', 'Avísales con un toque, con tu hora de llegada', 'Ellos saben cuándo llegas. Tú, a conducir.'],
    cobro: ['¿Cobras contrarreembolso?', 'Apunta cómo te pagan', 'Y sabes lo que llevas cobrado'],
    cierre: ['GRATIS 7 días', 'FDS · flotadsp.com'], burbuja: 'Lo que recibe el cliente', efectivo: /^Efectivo$/, sinFoto: /^Entregar sin foto$/, entregado: /^Entregado$/,
  },
  pt: {
    locale: 'pt-PT', pais: 'pt', clientes: ['Lúcia M.', 'Farmácia Sol', 'Bar do Zé'],
    llama: ['Ligam-te a perguntar onde estás?', 'Avisa-os com um toque, com a tua hora de chegada', 'Eles sabem quando chegas. Tu, a conduzir.'],
    cobro: ['Cobras à cobrança?', 'Regista como te pagam', 'E sabes o que levas cobrado'],
    cierre: ['GRÁTIS 7 dias', 'FDS · flotadsp.com'], burbuja: 'O que o cliente recebe', efectivo: /^Dinheiro$|^Efectivo$|^Numerário$/, sinFoto: /^Entregar sem foto$/, entregado: /^Entregue$/,
  },
}

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
  #burbuja-video { position: fixed; left: 20px; right: 20px; bottom: 110px; z-index: 99997; pointer-events: none; opacity: 0; transform: translateY(16px); transition: opacity .35s, transform .35s }
  #burbuja-video.ver { opacity: 1; transform: none }
  #burbuja-video small { display: block; margin: 0 0 8px 6px; font: 700 26px/1.1 Inter, system-ui, sans-serif; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.8) }
  #burbuja-video div { background: #d9fdd3; color: #111b21; border-radius: 22px 22px 22px 6px; padding: 18px 22px; font: 500 28px/1.3 Inter, system-ui, sans-serif; box-shadow: 0 10px 34px rgba(0,0,0,.45) }
  .dedo-video { position: fixed; z-index: 99996; width: 70px; height: 70px; margin: -35px 0 0 -35px; border-radius: 50%; background: rgba(255,255,255,.55); border: 4px solid #fff;
    pointer-events: none; animation: dedo 0.9s ease-out infinite }
  @keyframes dedo { 0% { transform: scale(.5); opacity: .95 } 100% { transform: scale(1.5); opacity: 0 } }
`

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
// Un círculo que «toca» el botón (el vídeo no graba el cursor).
async function tocar(page, locator) {
  const b = await locator.boundingBox()
  await page.evaluate(({ x, y }) => { const d = document.createElement('div'); d.className = 'dedo-video'; d.style.left = `${x}px`; d.style.top = `${y}px`; document.body.appendChild(d); setTimeout(() => d.remove(), 1800) },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 })
}

test.use({
  timezoneId: 'Europe/Madrid', viewport: { width: 540, height: 960 }, deviceScaleFactor: 2,
  video: { mode: 'on', size: { width: 540, height: 960 } },
})

const REAL = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'coruna-real.json'), 'utf8'))

for (const [lang, cfg] of Object.entries(TEXTOS)) {
  for (const gancho of ['llama', 'cobro']) {
    test.describe(`gancho ${gancho} (${lang})`, () => {
      test.use({ locale: cfg.locale })
      test.skip(({ browserName }) => browserName !== 'chromium', 'solo chromium')

      test('grabar', async ({ page, context }, testInfo) => {
        test.skip(!['all', 'changed'].includes(testInfo.config.updateSnapshots), 'solo con --update-snapshots')
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
        await context.setGeolocation({ latitude: 43.3636, longitude: -8.4118 })
        const fin = new Date(Date.now() + 30 * 86400000).toISOString()
        await page.route(/\/api\/org\/billing/, (r) => r.fulfill({ json: {
          plan: 'autonomo', sector: 'autonomo', modulos: ['dashboard', 'reparto', 'configuracion'],
          precios: { mensual: 9.99, anual: 99 }, regalos: { 1: 9.99, 12: 99 },
          status: 'active', suscrita: true, ciclo: 'mensual', proximo_cobro: fin } }))
        await page.route(/\/api\/reparto\/mi-ruta\/trazado/, (r) => r.fulfill({ json: REAL.trazado }))
        let pedidos = [
          { id: 'p1', cliente: cfg.clientes[0], direccion: 'Rúa Sinfónica de Galicia 8, A Coruña', telefono: '612345678', estado: 'pendiente', bultos: 1, orden: 1, eta: '10:05', lat: 43.363889, lng: -8.409899, cobrar: 24.5, seguimiento: 'x7k2q9' },
          { id: 'p2', cliente: cfg.clientes[1], direccion: 'Rúa Emilia Pardo Bazán 14, A Coruña', telefono: '698765432', estado: 'pendiente', bultos: 1, orden: 2, eta: '10:16', lat: 43.363999, lng: -8.407109 },
          { id: 'p3', cliente: cfg.clientes[2], direccion: 'Rúa Marcial del Adalid 5, A Coruña', estado: 'pendiente', bultos: 2, orden: 3, eta: '10:24', lat: 43.36219, lng: -8.407002 },
          { id: 'p4', cliente: 'Kiosko Luz', direccion: 'Rúa San Andrés 30, A Coruña', estado: 'entregado', bultos: 1, orden: 4, cobrado_importe: 12, cobrado_metodo: 'tarjeta', cerrado_en: '2026-10-02T08:00:00Z' },
        ]
        await page.route(/\/api\/reparto\/pedidos\/p1\/estado/, async (r) => {
          const b = r.request().postDataJSON()
          pedidos = pedidos.map((p) => (p.id === 'p1' ? { ...p, estado: b.estado, cobrado_importe: p.cobrar, cobrado_metodo: b.metodo, cerrado_en: new Date().toISOString() } : p))
          await r.fulfill({ json: {} })
        })
        await page.route(/\/api\/reparto\/mi-ruta$/, (r) => r.fulfill({ json: {
          activo: true, autonomo: true, empresa: '', fecha: '2026-10-02', ia_tickets: false, jornada: {}, aviso_aceptado: true, pais: cfg.pais, prefijo: cfg.pais === 'es' ? '34' : '351',
          base: null, ruta: { fin: '10:30', minutos: 30, km: REAL.trazado.km, trafico: true }, pedidos } }))

        await page.goto('/ruta', { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(700)
        const [r0, r1, r2] = cfg[gancho]

        if (gancho === 'llama') {
          await rotulo(page, r0)
          await page.waitForTimeout(2300)
          const wa = page.getByRole('link', { name: 'WhatsApp' }).first()
          await wa.scrollIntoViewIfNeeded()
          await page.evaluate(() => window.scrollBy(0, 120))
          await rotulo(page, r1)
          await page.waitForTimeout(500)
          await tocar(page, wa)
          // El texto REAL que envía el botón (el mismo enlace de wa.me).
          const href = await wa.getAttribute('href')
          // En la grabación la app corre en localhost: en el anuncio se ve la dirección real.
          const texto = decodeURIComponent(href.split('text=')[1] || '').replace(/https?:\/\/localhost:\d+/, 'flotadsp.com')
          await page.evaluate(([t, titulo]) => {
            const b = document.createElement('div'); b.id = 'burbuja-video'
            b.innerHTML = '<small></small><div></div>'; b.querySelector('small').textContent = titulo; b.querySelector('div').textContent = t
            document.body.appendChild(b); requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('ver')))
          }, [texto, cfg.burbuja])
          await page.waitForTimeout(3600)
          await rotulo(page, r2)
          await page.waitForTimeout(2200)
        } else {
          await rotulo(page, r0)
          await page.waitForTimeout(2300)
          const sig = page.locator('div.rounded-2xl', { hasText: /Siguiente parada|Próxima paragem|Seguinte/ }).first()
          const entregado = sig.getByRole('button', { name: cfg.entregado }).first()
          await entregado.scrollIntoViewIfNeeded()
          await tocar(page, entregado)
          await page.waitForTimeout(500)
          await entregado.click()
          await rotulo(page, r1)
          await page.waitForTimeout(2600)
          const ef = page.getByRole('button', { name: cfg.efectivo }).first()
          await tocar(page, ef)
          await page.waitForTimeout(500)
          await ef.click()
          await page.waitForTimeout(600)
          await page.getByRole('button', { name: cfg.sinFoto }).click().catch(() => {})
          await page.waitForTimeout(700)
          await page.evaluate(() => window.scrollTo(0, 0))
          await rotulo(page, r2)
          await expect(page.getByText(/36,50/).first()).toBeVisible()
          await page.waitForTimeout(2600)
        }

        // Cierre con marca.
        marcas.push((Date.now() - t0) / 1000)
        await page.evaluate(([g, m]) => {
          document.getElementById('rotulo-video')?.remove(); document.getElementById('burbuja-video')?.remove()
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
        fs.copyFileSync(v, path.join(destino, `${lang}-${gancho}.webm`))
        fs.writeFileSync(path.join(destino, `${lang}-${gancho}.json`), JSON.stringify({ marcas, fin: (Date.now() - t0) / 1000 }))
      })
    })
  }
}
