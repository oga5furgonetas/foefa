// Capturas de lo cambiado el 29-10-2026 (FDS en todo, cookies, planes) y la imagen og.png nueva.
// Uso: node capturas.mjs <carpeta de salida> <raíz del worktree>   (con `vite preview --port 4174` en marcha)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = process.argv[2]
const W = process.argv[3]
const BASE = process.env.BASE || 'http://localhost:4174'
mkdirSync(OUT, { recursive: true })
const { simularApi, entrarComoAdmin } = await import(pathToFileURL(join(W, 'frontend/e2e/api-simulada.js')).href)

const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
const browser = await chromium.launch()
const titulos = {}

async function captura(nombre, ruta, { movil = true, prep = null, consent = true, full = false, espera = 900 } = {}) {
  const ctx = await browser.newContext(movil
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', userAgent: UA }
    : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'es-ES' })
  const page = await ctx.newPage()
  if (consent) {
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', JSON.stringify({ v: 3, anuncios: false, at: '2026-10-29T00:00:00Z' }))
      localStorage.setItem('fds_tour_ruta', '1')
    })
  }
  if (prep) await prep(page)
  await page.goto(BASE + ruta, { waitUntil: 'networkidle' })
  await page.waitForTimeout(espera)
  await page.screenshot({ path: join(OUT, `${nombre}.png`), fullPage: full })
  titulos[nombre] = { ruta, titulo: await page.title() }
  console.log(`${nombre}: «${titulos[nombre].titulo}»`)
  await ctx.close()
}

const panel = async (page) => {
  await entrarComoAdmin(page)
  await simularApi(page, 'vacio')
}

await captura('01-portada-movil', '/')
await captura('02-planes-movil', '/planes')
await captura('03-empezar-movil', '/empezar')
await captura('04-cookies-movil', '/repartidores', { consent: false })
await captura('05-panel-login-movil', '/panel/login')
await captura('06-panel-movil', '/panel', { prep: panel, espera: 1500 })
await captura('07-vehiculos-movil', '/panel/vehiculos', { prep: panel, espera: 1500 })
await captura('08-portada-escritorio', '/', { movil: false })
await captura('09-planes-escritorio', '/planes', { movil: false, full: true })
await captura('10-panel-escritorio', '/panel', { movil: false, prep: panel, espera: 1500 })

// La imagen al compartir (og.png): la de antes decía «Flota · Gestión de flotas con IA».
const logo = readFileSync(join(W, 'frontend/public/favicon.svg'), 'utf8')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;background:radial-gradient(900px 500px at 80% -10%,rgba(20,231,216,.18),transparent),#070a0e;color:#f4f6f8;font-family:Inter,"Segoe UI",system-ui,sans-serif;position:relative;overflow:hidden}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:40px 40px}
  .logo{position:absolute;left:96px;top:92px;display:flex;align-items:center;gap:28px}
  .logo svg,.logo img{width:104px;height:104px;border-radius:24px}
  .logo b{font-size:96px;letter-spacing:-.04em}
  h1{position:absolute;left:96px;top:300px;margin:0;font-size:52px;font-weight:600;letter-spacing:-.02em;line-height:1.1;max-width:1000px}
  h1 span{color:#14E7D8}
  p{position:absolute;left:96px;bottom:84px;margin:0;font-size:26px;color:#9aa4b2}
</style></head><body><div class="grid"></div>
<div class="logo">${logo}<b>FDS</b></div>
<h1>La app de reparto <span>y el panel de tu flota</span></h1>
<p>Ruta ordenada sola · Guía por voz · Revisiones con IA · Cuadrante y turnos</p>
</body></html>`
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
const pg = await ctx.newPage()
await pg.setContent(html, { waitUntil: 'load' })
await pg.waitForTimeout(300)
await pg.screenshot({ path: join(OUT, 'og.png') })
copyFileSync(join(OUT, 'og.png'), join(W, 'frontend/public/og.png'))
await ctx.close()

writeFileSync(join(OUT, 'titulos.json'), JSON.stringify(titulos, null, 2))
await browser.close()
console.log('capturas hechas en', OUT)
