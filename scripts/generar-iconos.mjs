#!/usr/bin/env node
/* LOS ICONOS SALEN DEL SVG, NO SE DIBUJAN APARTE.
 *
 * `public/favicon.svg` es la única fuente del logo. De él se sacan, con el
 * Chromium de Playwright, los PNG que piden los sitios que no leen SVG:
 *   · apple-touch-icon.png (180×180) — el icono al «añadir a pantalla de inicio»
 *     en iPhone, que ignora el SVG;
 *   · icon-192.png / icon-512.png — los del manifest para Android;
 *   · og.png (1200×630) — la tarjeta que sale al pegar el enlace en WhatsApp,
 *     LinkedIn o Slack.
 * Si el logo cambia, se cambia el SVG y se vuelve a lanzar esto: nunca quedan
 * dos logos distintos conviviendo.
 *
 * Uso (desde la raíz):  node scripts/generar-iconos.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRONT = join(RAIZ, 'frontend')
const PUB = join(FRONT, 'public')
const require = createRequire(join(FRONT, 'package.json'))
const { chromium } = require('@playwright/test')

const svg = readFileSync(join(PUB, 'favicon.svg'), 'utf8')
const fuente = pathToFileURL(join(FRONT, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2')).href
const nombre = (readFileSync(join(FRONT, 'src/marca.js'), 'utf8').match(/nombre:\s*'([^']+)'/) || [])[1] || 'Flota'
const lema = (readFileSync(join(FRONT, 'src/marca.js'), 'utf8').match(/lema:\s*'([^']+)'/) || [])[1] || ''

const icono = (lado, margen = 0) => `<!doctype html><html><body style="margin:0;background:transparent">
  <div style="width:${lado}px;height:${lado}px;padding:${margen}px;box-sizing:border-box">${svg.replace('<svg ', `<svg width="${lado - 2 * margen}" height="${lado - 2 * margen}" `)}</div>
</body></html>`

const og = `<!doctype html><html><head><style>
  @font-face { font-family: Archivo; src: url('${fuente}') format('woff2'); font-weight: 100 900; }
  body { margin: 0; }
  .lienzo { width: 1200px; height: 630px; box-sizing: border-box; padding: 88px 96px;
    background: radial-gradient(900px 500px at 85% 20%, rgba(20,231,216,.16), transparent 60%),
                radial-gradient(700px 420px at 10% 110%, rgba(10,172,211,.18), transparent 60%), #070A0E;
    color: #F4F7FA; font-family: Archivo, system-ui, sans-serif; display: flex; flex-direction: column;
    justify-content: space-between; position: relative; overflow: hidden; }
  .rejilla { position: absolute; inset: 0; opacity: .07;
    background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px);
    background-size: 48px 48px; }
  .marca { display: flex; align-items: center; gap: 28px; position: relative; }
  .marca svg { width: 112px; height: 112px; }
  .nombre { font-size: 104px; font-weight: 800; letter-spacing: -0.045em; line-height: 1; }
  .lema { position: relative; font-size: 46px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; max-width: 900px; }
  .lema b { background: linear-gradient(90deg, #14E7D8, #0AACD3); -webkit-background-clip: text; color: transparent; }
  .pie { position: relative; font-size: 24px; color: #9AA4B2; letter-spacing: .01em; }
</style></head><body><div class="lienzo"><div class="rejilla"></div>
  <div class="marca">${svg}<span class="nombre">${nombre}</span></div>
  <div class="lema">${lema ? lema.replace(/IA/, '<b>IA</b>') : ''}</div>
  <div class="pie">Inspecciones con foto · Taller · Vencimientos · Cuadrante · Equipo</div>
</div></body></html>`

const nav = await chromium.launch()
const pag = await nav.newPage({ deviceScaleFactor: 1 })
async function foto(html, ancho, alto, destino, fondo = false) {
  await pag.setViewportSize({ width: ancho, height: alto })
  await pag.setContent(html, { waitUntil: 'load' })
  await pag.evaluate(() => document.fonts.ready)
  const buf = await pag.screenshot({ omitBackground: !fondo, clip: { x: 0, y: 0, width: ancho, height: alto } })
  writeFileSync(join(PUB, destino), buf)
  console.log('  ' + destino)
}
console.log('iconos desde favicon.svg:')
await foto(icono(180), 180, 180, 'apple-touch-icon.png', true)
await foto(icono(192), 192, 192, 'icon-192.png')
await foto(icono(512), 512, 512, 'icon-512.png')
await foto(icono(64), 64, 64, 'favicon.png')
await foto(og, 1200, 630, 'og.png', true)
await nav.close()
