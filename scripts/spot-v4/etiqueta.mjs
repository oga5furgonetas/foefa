// La etiqueta del paquete que «se fotografía» en el spot v4 (24-10-2026): una etiqueta de envío genérica,
// SIN marca de ninguna empresa de paquetería, con un destinatario inventado (el mismo que devuelve la
// lectura simulada en e2e/spot-v4.spec.js). Dos salidas:
//   etiqueta.png — la etiqueta sola (lo que se le pasa a la app como foto)
//   camara.png   — la etiqueta pegada en una caja, vista por la cámara del móvil (plano del anuncio)
//   cd frontend && node ../scripts/spot-v4/etiqueta.mjs
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
fs.mkdirSync(SALIDA, { recursive: true })

// Código de barras de mentira (barras de anchos variados) en SVG.
const barras = (() => {
  let x = 0; let s = ''
  const anchos = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 1, 2, 3, 1, 1, 2, 1]
  anchos.forEach((a, i) => { if (i % 2 === 0) s += `<rect x="${x * 4}" y="0" width="${a * 4}" height="120" fill="#111"/>`; x += a })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x * 4}" height="120">${s}</svg>`
})()

const etiqueta = `
<div class="et">
  <div class="cab"><b>ENVÍO ESTÁNDAR</b><span>24 h</span></div>
  <div class="fila"><small>REMITENTE</small><p>Distribuciones Noroeste · Pol. Ind. Sabón, 15142 Arteixo</p></div>
  <div class="dest"><small>DESTINATARIO</small>
    <h2>BAR PEPE</h2>
    <h3>Rúa Marcial del Adalid 5</h3>
    <h3>15005 A Coruña</h3>
    <p>Tel. 600 000 001</p>
  </div>
  <div class="pie"><div><small>BULTOS</small><b>1 / 2</b></div><div><small>PESO</small><b>3,4 kg</b></div><div><small>REF.</small><b>ES7731005</b></div></div>
  <div class="cb">${barras}<span>ES7731005</span></div>
</div>`
const css = `
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family: Arial, Helvetica, sans-serif; color:#111 }
  .et { width:760px; background:#fff; border:3px solid #111; padding:26px 30px; }
  .cab { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #111; padding-bottom:12px; font-size:30px }
  .cab span { font-weight:900; font-size:40px; border:3px solid #111; padding:2px 12px }
  small { display:block; font-size:16px; font-weight:700; letter-spacing:.08em; color:#444; margin-bottom:4px }
  .fila { padding:12px 0; border-bottom:2px solid #111; font-size:19px }
  .dest { padding:16px 0 14px; border-bottom:2px solid #111 }
  .dest h2 { font-size:52px; letter-spacing:.01em }
  .dest h3 { font-size:38px; font-weight:700; line-height:1.18 }
  .dest p { font-size:26px; margin-top:6px }
  .pie { display:flex; gap:30px; padding:12px 0; border-bottom:2px solid #111 }
  .pie b { font-size:26px }
  .cb { padding-top:16px; text-align:center }
  .cb svg { width:100%; height:120px }
  .cb span { display:block; font:700 24px monospace; letter-spacing:.3em; margin-top:6px }`

const camara = `
<div class="caja"><div class="cinta"></div><div class="pegada">${etiqueta}</div></div>
<div class="visor"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></div>
<div class="ui"><span>FOTO</span></div>`
const cssCamara = `
  body { width:1080px; height:1920px; overflow:hidden; background:#000 }
  .caja { position:absolute; inset:-80px; background:
      radial-gradient(1200px 900px at 50% 40%, rgba(255,230,190,.35), transparent 60%),
      repeating-linear-gradient(92deg, rgba(0,0,0,.035) 0 3px, transparent 3px 9px),
      linear-gradient(160deg, #c99a63, #a8763f 55%, #8a5d2e) }
  .cinta { position:absolute; left:-40px; right:-40px; top:330px; height:150px; background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.12)); transform:rotate(-4deg) }
  .pegada { position:absolute; left:50%; top:52%; transform:translate(-50%,-50%) rotate(-3deg); box-shadow: 0 30px 60px rgba(0,0,0,.35) }
  .visor i { position:absolute; width:120px; height:120px; border-color:#fff; border-style:solid; opacity:.95 }
  .visor .a { left:90px; top:420px; border-width:10px 0 0 10px; border-radius:26px 0 0 0 }
  .visor .b { right:90px; top:420px; border-width:10px 10px 0 0; border-radius:0 26px 0 0 }
  .visor .c { left:90px; bottom:420px; border-width:0 0 10px 10px; border-radius:0 0 0 26px }
  .visor .d { right:90px; bottom:420px; border-width:0 10px 10px 0; border-radius:0 0 26px 0 }
  .ui { position:absolute; left:0; right:0; bottom:120px; text-align:center }
  .ui span { display:inline-block; font:700 30px Arial; color:#FFD43B; letter-spacing:.12em }`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 820, height: 980 }, deviceScaleFactor: 2 })
await p.setContent(`<!doctype html><meta charset="utf-8"><style>${css} body{background:#fff;padding:30px}</style>${etiqueta}`)
await p.locator('.et').screenshot({ path: path.join(SALIDA, 'etiqueta.png') })
await p.setViewportSize({ width: 1080, height: 1920 })
await p.setContent(`<!doctype html><meta charset="utf-8"><style>${css}${cssCamara}</style>${camara}`)
await p.screenshot({ path: path.join(SALIDA, 'camara.png') })
await b.close()
console.log('ok etiqueta.png camara.png')
