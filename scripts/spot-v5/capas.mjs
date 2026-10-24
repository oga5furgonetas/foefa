// Etiquetas de función del spot v5 (24-10-2026): una píldora arriba que nombra lo que se está viendo («Foto a la
// etiqueta», «Ruta ordenada sola»…), como en los anuncios de apps que funcionan. El gancho, la oferta, el cierre,
// el fondo y el círculo del toque se reutilizan del v4 (scripts/spot-v4/capas.mjs).
//   cd frontend && node ../scripts/spot-v5/capas.mjs   ->  docs/anuncios/reales/spot-v5/etiqueta-*.png
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v5')
fs.mkdirSync(SALIDA, { recursive: true })

const ETIQUETAS = {
  foto: ['📸', 'Foto a la etiqueta'],
  ordenar: ['⚡', 'Ruta ordenada sola'],
  horas: ['🕐', 'La hora de cada parada'],
  mapa: ['🗺️', 'Tus 15 paradas, en el mapa'],
  voz: ['🔊', 'Te guía con voz'],
  // Son dos toques (Entregado → dónde lo dejas / sin foto): «en un toque» no sería verdad.
  entregado: ['✅', 'Entrega con prueba'],
}
const html = (icono, texto) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1080px; height:1920px; overflow:hidden; background:transparent; font-family:Archivo, system-ui, sans-serif }
  .p { position:absolute; left:50%; top:118px; transform:translateX(-50%); display:flex; align-items:center; gap:18px; white-space:nowrap;
       background: rgba(6,10,14,.86); border:2px solid rgba(20,231,216,.65); border-radius:999px; padding:20px 38px 20px 26px;
       box-shadow: 0 18px 50px rgba(0,0,0,.55), 0 0 40px rgba(20,231,216,.25) }
  .i { font-size:46px; line-height:1 }
  .t { font-weight:900; font-size:50px; letter-spacing:-.01em; color:#fff }
</style></head><body><div class="p"><span class="i">${icono}</span><span class="t">${texto}</span></div></body></html>`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [clave, [icono, texto]] of Object.entries(ETIQUETAS)) {
  await p.setContent(html(icono, texto), { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(200)
  await p.screenshot({ path: path.join(SALIDA, `etiqueta-${clave}.png`), omitBackground: true })
  console.log('ok etiqueta', clave)
}
await b.close()
