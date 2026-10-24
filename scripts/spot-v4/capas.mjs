// Capas gráficas del spot v4 (24-10-2026): el gancho sobre el metraje, la tarjeta de la oferta, el cierre con
// la web y qué pulsar, el círculo del toque (una secuencia de PNG) y la portada del anuncio de Spotify.
// Tipografía y colores de la app (Archivo, cian #14e7d8, amarillo de oferta #FFD43B). Lo importante va dentro
// de la zona segura de TikTok/Reels (ni el tercio de abajo ni la columna de iconos de la derecha).
//   cd frontend && node ../scripts/spot-v4/capas.mjs   ->  docs/anuncios/reales/spot-v4/*.png
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = req('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
const SPOTIFY = path.join(RAIZ, 'docs', 'anuncios', 'spotify', 'v2')
fs.mkdirSync(SALIDA, { recursive: true }); fs.mkdirSync(SPOTIFY, { recursive: true })
const LOGO = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(RAIZ, 'frontend', 'public', 'favicon.svg')).toString('base64')

const FUENTE = `<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap" rel="stylesheet">`
const base = (cuerpo, extra = '', w = 1080, h = 1920) => `<!doctype html><html><head><meta charset="utf-8">${FUENTE}<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:${w}px; height:${h}px; overflow:hidden; font-family:Archivo, system-ui, sans-serif; color:#fff; background:transparent }
  ${extra}
</style></head><body>${cuerpo}</body></html>`

// 1. El gancho: sobre el metraje, con degradado oscuro para que se lea.
const gancho = base(`<div class="velo"></div><div class="g"><div class="chip">📦 REPARTIDORES</div><h1>¿Todavía ordenas<br>la ruta <em>a mano</em>?</h1></div>`, `
  .velo { position:absolute; left:0; right:0; top:700px; bottom:0; background: linear-gradient(180deg, transparent, rgba(0,0,0,.72) 45%, rgba(0,0,0,.85)) }
  .g { position:absolute; left:70px; right:120px; top:1010px }
  .chip { display:inline-block; font-weight:900; font-size:34px; letter-spacing:.08em; color:#04121a; background:#14e7d8; border-radius:14px; padding:12px 20px; margin-bottom:26px }
  h1 { font-weight:900; font-size:104px; line-height:.98; letter-spacing:-.035em; text-shadow: 0 8px 40px rgba(0,0,0,.6) }
  h1 em { font-style:normal; color:#04121a; background:#FFD43B; padding:0 14px; border-radius:16px; box-decoration-break:clone }
`)

// 2. La oferta: tarjeta flotante sobre la app desenfocada (el fondo lo pone el montaje).
const oferta = base(`<div class="c"><div class="pill">GRATIS</div><div class="l">sin tarjeta</div><div class="l2">sin límite hasta el 31 de diciembre</div><div class="l3">Android e iPhone</div></div>`, `
  .c { position:absolute; left:90px; right:90px; top:560px; padding:70px 40px 64px; border-radius:56px; text-align:center;
       background: rgba(7,10,14,.72); border:2px solid rgba(20,231,216,.45); box-shadow: 0 50px 120px rgba(0,0,0,.6), 0 0 120px rgba(20,231,216,.18) }
  .pill { display:inline-block; background:#FFD43B; color:#1a1300; font-weight:900; font-size:150px; line-height:1; letter-spacing:-.03em; border-radius:40px; padding:28px 54px; transform:rotate(-3deg); box-shadow:0 24px 70px rgba(255,212,59,.35) }
  .l { margin-top:44px; font-weight:900; font-size:76px; letter-spacing:-.02em }
  .l2 { margin-top:14px; font-weight:700; font-size:40px; color:#c9f3f1 }
  .l3 { margin-top:26px; display:inline-block; font-weight:800; font-size:32px; color:#04121a; background:#14e7d8; border-radius:999px; padding:12px 26px }
`)

// 3. El cierre: dónde entrar y qué pulsar.
const cierre = base(`<div class="c">
  <div class="marca"><img src="${LOGO}" alt=""><b>FDS</b></div>
  <div class="t">Crea tu cuenta gratis</div>
  <div class="web">flotadsp.com</div>
  <div class="s">Tardas un minuto · sin tarjeta</div>
  <div class="boton">Toca el botón de abajo <span>👇</span></div>
</div>`, `
  .c { position:absolute; left:70px; right:70px; top:420px; text-align:center }
  .marca { display:flex; align-items:center; justify-content:center; gap:22px }
  .marca img { width:130px; height:130px; border-radius:34px; box-shadow:0 24px 70px rgba(20,231,216,.35) }
  .marca b { font-weight:900; font-size:110px; letter-spacing:-.02em }
  .t { margin-top:70px; font-weight:900; font-size:78px; line-height:1.05; letter-spacing:-.025em }
  .web { margin:40px auto 0; display:inline-block; font-weight:900; font-size:96px; letter-spacing:-.02em; color:#04121a; background:#FFD43B; border-radius:30px; padding:22px 44px; box-shadow:0 30px 80px rgba(255,212,59,.3) }
  .s { margin-top:34px; font-weight:700; font-size:40px; color:#c9f3f1 }
  .boton { margin:70px auto 0; display:inline-flex; align-items:center; gap:16px; font-weight:900; font-size:46px; color:#04121a; background:#14e7d8; border-radius:999px; padding:22px 40px }
  .boton span { font-size:52px }
`)

// 3b. Fondo de marca para el cierre: luz cian arriba y una malla que se desvanece (opaco).
const fondoMarca = base(`<div class="luz"></div><div class="luz2"></div><div class="malla"></div>`, `
  body { background: radial-gradient(circle at 50% 30%, #0b5552 0%, #062027 42%, #03080b 100%) }
  .luz { position:absolute; left:-200px; top:-200px; width:1480px; height:1000px; background: radial-gradient(ellipse at center, rgba(20,231,216,.30), transparent 60%) }
  .luz2 { position:absolute; left:200px; top:1300px; width:1200px; height:900px; background: radial-gradient(ellipse at center, rgba(255,212,59,.10), transparent 60%) }
  .malla { position:absolute; inset:0; background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 90px 90px; mask-image: radial-gradient(circle at 50% 40%, #000 15%, transparent 70%) }
`)

// 4. Portada del anuncio de Spotify (640×640, ≤200 KB): la web, grande, y qué hacer.
const spotify = base(`<div class="c"><div class="marca"><img src="${LOGO}" alt=""><b>FDS</b></div><div class="t">La app de reparto <em>gratis</em></div><div class="web">flotadsp.com</div><div class="s">Toca y crea tu cuenta en 1 minuto</div></div>`, `
  body { background: radial-gradient(900px 700px at 70% 0%, rgba(20,231,216,.28), transparent 60%), #070a0e }
  .c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:26px; padding:40px }
  .marca { display:flex; align-items:center; gap:18px }
  .marca img { width:110px; height:110px; border-radius:28px }
  .marca b { font-weight:900; font-size:96px }
  .t { font-weight:900; font-size:64px; line-height:1.05; letter-spacing:-.02em }
  .t em { font-style:normal; color:#14e7d8 }
  .web { font-weight:900; font-size:84px; color:#04121a; background:#FFD43B; border-radius:24px; padding:14px 34px }
  .s { font-weight:700; font-size:38px; color:#c9f3f1 }
`, 1080, 1080)

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [nombre, html] of [['gancho.png', gancho], ['oferta.png', oferta], ['cierre.png', cierre], ['fondo-marca.png', fondoMarca]]) {
  await p.setContent(html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250)
  await p.screenshot({ path: path.join(SALIDA, nombre), omitBackground: true })
  console.log('ok', nombre)
}
// El círculo del toque: 14 fotogramas (a 30 fps, ~0,45 s), crece y se desvanece.
const q = await b.newPage({ viewport: { width: 320, height: 320 } })
for (let i = 0; i < 14; i++) {
  const k = i / 13
  const r = 46 + 96 * k
  const a = (1 - k) ** 1.4
  await q.setContent(`<html><body style="margin:0;background:transparent"><div style="position:absolute;left:${160 - r}px;top:${160 - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:${10 - 6 * k}px solid rgba(255,255,255,${a});box-shadow:0 0 30px rgba(20,231,216,${a * 0.9});background:rgba(255,255,255,${0.22 * (1 - k)})"></div></body></html>`)
  await q.screenshot({ path: path.join(SALIDA, `toque_${String(i).padStart(2, '0')}.png`), omitBackground: true })
}
console.log('ok toque_00..13.png')
const sp = await b.newPage({ viewport: { width: 1080, height: 1080 } })
await sp.setContent(spotify, { waitUntil: 'networkidle' }); await sp.evaluate(() => document.fonts.ready); await sp.waitForTimeout(250)
await sp.screenshot({ path: path.join(SPOTIFY, 'portada-1080.png') })
console.log('ok spotify/v2/portada-1080.png')
await b.close()
