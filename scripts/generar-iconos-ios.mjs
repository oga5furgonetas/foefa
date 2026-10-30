/* LOS ICONOS DE LA APP DE IPHONE (30-10-2026), desde el mismo `frontend/public/favicon.svg` que todo lo demás.
 *   · AppIcon-512@2x.png (1024×1024, sin transparencia: Apple la rechaza) — el icono de la App Store y del iPhone;
 *     iOS le recorta las esquinas, así que va a sangre sobre el fondo de la marca.
 *   · splash-2732x2732.png (y -1, -2: las tres escalas de Xcode) — la pantalla de arranque: el logo en el centro
 *     sobre el fondo de la marca; es cuadrada y grande para que valga en cualquier pantalla recortando.
 * Se escriben en frontend/ios/App/App/Assets.xcassets/. Igual que generar-iconos.mjs, con el Chromium de Playwright.
 *   node scripts/generar-iconos-ios.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRONT = join(RAIZ, 'frontend')
const ASSETS = join(FRONT, 'ios', 'App', 'App', 'Assets.xcassets')
const require = createRequire(join(FRONT, 'package.json'))
const { chromium } = require('@playwright/test')

const svg = readFileSync(join(FRONT, 'public', 'favicon.svg'), 'utf8')
const FONDO = '#070A0E'   // el del <rect> del logo y el theme-color de la web

// El logo sin su recuadro redondeado (iOS pone el suyo): el mismo dibujo sobre el fondo a sangre.
const sinRecuadro = svg.replace(/<rect width="64" height="64" rx="15" fill="#070A0E"\/>\s*/, '')
const lienzo = (lado, logo, fondo) => `<!doctype html><html><body style="margin:0;background:${fondo}">
  <div style="width:${lado}px;height:${lado}px;display:flex;align-items:center;justify-content:center;background:${fondo}">
    ${sinRecuadro.replace('<svg ', `<svg width="${logo}" height="${logo}" `)}
  </div></body></html>`

const nav = await chromium.launch()
const pag = await nav.newPage({ deviceScaleFactor: 1 })
async function foto(html, lado, destino) {
  await pag.setViewportSize({ width: lado, height: lado })
  await pag.setContent(html, { waitUntil: 'load' })
  const buf = await pag.screenshot({ clip: { x: 0, y: 0, width: lado, height: lado } })
  writeFileSync(join(ASSETS, destino), buf)
  console.log('  ' + destino + ' (' + buf.length + ' bytes)')
}
console.log('iconos de iOS desde favicon.svg:')
await foto(lienzo(1024, 1024, FONDO), 1024, join('AppIcon.appiconset', 'AppIcon-512@2x.png'))
const splash = lienzo(2732, 640, FONDO)
for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await foto(splash, 2732, join('Splash.imageset', n))
await nav.close()
