// Capas gráficas del anuncio con la VOZ DE DANI (29-10-2026, tarde): el gancho de los 25 €, las dos preguntas del
// arranque, «Esto te interesa», la tarjeta del logo, los titulares de cada pantalla, «Forma parte del cambio», el
// marco del panel de empresa y los dos cierres (B: botón; A: QR) con el lema «Cada entrega cuenta.» aparte, para que
// entre cuando lo dice la voz. Misma tipografía (Archivo) y colores (#14e7d8, #FFD43B) que la app y que el spot
// anterior; los titulares de escanear/ordenar/zonas/voz/entregado se reutilizan de super-anuncio/capas.
// Zona segura de TikTok/Reels: nada importante en el 14 % de arriba ni en el 25 % de abajo.
//   cd frontend && node ../scripts/spot-dani/capas.mjs   ->  docs/anuncios/spot-dani/capas/*.png
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = req('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'spot-dani', 'capas')
fs.mkdirSync(SALIDA, { recursive: true })
const b64 = (p) => fs.readFileSync(p).toString('base64')
const LOGO = 'data:image/svg+xml;base64,' + b64(path.join(RAIZ, 'frontend', 'public', 'favicon.svg'))
const QR = 'data:image/png;base64,' + b64(path.join(RAIZ, 'docs', 'anuncios', 'super-anuncio', 'qr-play-fds-spot.png'))
const PLAY = 'data:image/png;base64,' + b64(path.join(RAIZ, 'frontend', 'public', 'google-play-badges', 'es.png'))
const ARCHIVO = 'data:font/woff2;base64,' + b64(path.join(RAIZ, 'frontend', 'node_modules', '@fontsource-variable', 'archivo', 'files', 'archivo-latin-wght-normal.woff2'))

const base = (cuerpo, extra = '', w = 1080, h = 1920) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Archivo'; src: url(${ARCHIVO}) format('woff2'); font-weight: 100 900; font-style: normal }
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:${w}px; height:${h}px; overflow:hidden; font-family:Archivo, system-ui, sans-serif; color:#fff; background:transparent }
  ${extra}
</style></head><body>${cuerpo}</body></html>`

// ── Sobre los planos de ambiente: velo oscuro abajo y texto grande ─────────────────────────────────────────────
const sobrePlano = (html, top = 900) => base(`<div class="velo"></div><div class="g">${html}</div>`, `
  .velo { position:absolute; left:0; right:0; top:520px; bottom:0; background: linear-gradient(180deg, transparent, rgba(0,0,0,.74) 45%, rgba(0,0,0,.9)) }
  .g { position:absolute; left:70px; right:90px; top:${top}px }
  .n { font-weight:900; font-size:168px; line-height:.92; letter-spacing:-.05em; color:#FFD43B; text-shadow: 0 10px 40px rgba(0,0,0,.6) }
  h1 { font-weight:900; font-size:104px; line-height:1.0; letter-spacing:-.035em; text-shadow: 0 8px 40px rgba(0,0,0,.6) }
  h1.peq { font-size:84px }
  h1 em { font-style:normal; color:#14e7d8 }
  .sub { margin-top:30px; font-weight:800; font-size:54px; line-height:1.1; letter-spacing:-.02em; color:#fff; text-shadow: 0 8px 40px rgba(0,0,0,.6) }
  .sub b { color:#14e7d8 }
`)
// El gancho (Dani, 29-10): «empezar con ¿quieres 25 euros gratis?». Con la condición a la vista, que es lo que lo hace
// verdad (bono de bienvenida: 25 € al completar la primera ruta; Términos, precios.js y server.py).
const gancho25 = sobrePlano(`<div class="n">¿Quieres<br>25 € gratis?</div><div class="sub">Te los damos <b>por tu primera ruta</b><br>con la app.</div>`, 840)
// Las dos preguntas con las que arranca la voz.
const pregunta1 = sobrePlano(`<h1>¿Repartes paquetes,<br>comida o<br><em>mensajería?</em></h1>`, 900)
const cambio = sobrePlano(`<h1 class="peq">El reparto evoluciona.<br><em>Forma parte<br>del cambio.</em></h1>`, 960)

// ── Tarjetas sobre el fondo de marca ───────────────────────────────────────────────────────────────────────────
const interesa = base(`<div class="c"><div class="t">Esto te<br>interesa.</div><div class="raya"></div></div>`, `
  .c { position:absolute; left:80px; right:80px; top:620px; text-align:center }
  .t { font-weight:900; font-size:170px; line-height:.95; letter-spacing:-.045em; text-shadow:0 10px 50px rgba(0,0,0,.5) }
  .raya { margin:54px auto 0; width:300px; height:18px; border-radius:9px; background:#FFD43B; box-shadow:0 0 50px rgba(255,212,59,.5) }
`)
const logo = base(`<div class="c"><img src="${LOGO}" alt=""><div class="n">Flota DSP</div><div class="s">FDS · Reparto y rutas</div><div class="p">Google Play · flotadsp.com</div></div>`, `
  .c { position:absolute; left:60px; right:60px; top:560px; text-align:center }
  img { width:300px; height:300px; border-radius:72px; box-shadow:0 40px 120px rgba(20,231,216,.35) }
  .n { margin-top:54px; font-weight:900; font-size:132px; line-height:1; letter-spacing:-.04em }
  .s { margin-top:28px; font-weight:800; font-size:52px; letter-spacing:-.02em; color:#14e7d8 }
  .p { margin-top:60px; display:inline-block; font-weight:800; font-size:36px; color:#04121a; background:#FFD43B; border-radius:999px; padding:14px 34px }
`)

// ── Titulares de la franja de arriba (sobre el móvil o el panel) ───────────────────────────────────────────────
const titulo = (l1, l2, mono = false) => base(`<div class="t"><div class="l1">${l1}</div><div class="l2">${l2}</div></div>`, `
  .t { position:absolute; left:50px; right:50px; top:96px; text-align:center }
  .l1 { font-weight:900; font-size:66px; line-height:1.06; letter-spacing:-.025em; color:${mono ? '#fff' : '#14e7d8'}; text-shadow:0 6px 30px rgba(0,0,0,.5) }
  .l2 { font-weight:900; font-size:66px; line-height:1.06; letter-spacing:-.025em; color:#fff; text-shadow:0 6px 30px rgba(0,0,0,.5) }
`)
const TITULOS = {
  pregunta2: ['¿Autónomo o en una', 'empresa de reparto?', true],
  ruta: ['Tu ruta del día,', 'en el móvil'],
  flota: ['Y la flota entera,', 'en el panel'],
}

// ── El marco del panel de empresa (captura 2560×1600 → 1000×625 en 40,760) ─────────────────────────────────────
const PANEL = { x: 40, y: 760, w: 1000, h: 625, r: 26 }
const panelFondo = base(`<div class="m"></div>`, `
  .m { position:absolute; left:${PANEL.x - 10}px; top:${PANEL.y - 10}px; width:${PANEL.w + 20}px; height:${PANEL.h + 20}px; border-radius:${PANEL.r + 8}px; background:#0a0e13;
       border:3px solid rgba(255,255,255,.12); box-shadow:0 60px 160px rgba(0,0,0,.7), 0 0 90px rgba(20,231,216,.14) }
`)
const panelMask = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0 } body { width:${PANEL.w}px; height:${PANEL.h}px; overflow:hidden; background:#000 }
  .s { position:absolute; inset:0; border-radius:${PANEL.r}px; background:#fff }
</style></head><body><div class="s"></div></body></html>`

// ── Cierres ────────────────────────────────────────────────────────────────────────────────────────────────────
const bono = `<div class="bono"><b>+25 €</b> con tu primera ruta</div>`
const cierreB = base(`<div class="c">
  <div class="marca"><img src="${LOGO}" alt=""><b>Flota DSP</b></div>
  <div class="web">flotadsp.com</div>
  ${bono}
  <div class="boton">Toca el botón de abajo <span>👇</span></div>
  <div class="play"><img src="${PLAY}" alt=""><span>o en iPhone, desde la web</span></div>
</div>`, `
  .c { position:absolute; left:70px; right:70px; top:330px; text-align:center }
  .marca { display:flex; align-items:center; justify-content:center; gap:22px }
  .marca img { width:120px; height:120px; border-radius:32px; box-shadow:0 24px 70px rgba(20,231,216,.35) }
  .marca b { font-weight:900; font-size:100px; letter-spacing:-.03em }
  .web { margin:56px auto 0; display:inline-block; font-weight:900; font-size:100px; letter-spacing:-.02em; color:#04121a; background:#FFD43B; border-radius:30px; padding:22px 46px; box-shadow:0 30px 80px rgba(255,212,59,.3) }
  .bono { margin:40px auto 0; display:inline-block; font-weight:800; font-size:46px; letter-spacing:-.01em; color:#fff; background:rgba(20,231,216,.14); border:2px solid rgba(20,231,216,.6); border-radius:999px; padding:16px 40px }
  .bono b { font-weight:900; color:#14e7d8; font-size:56px }
  .boton { margin:48px auto 0; display:inline-flex; align-items:center; gap:16px; font-weight:900; font-size:46px; color:#04121a; background:#14e7d8; border-radius:999px; padding:22px 40px }
  .boton span { font-size:52px }
  .play { margin-top:44px; display:flex; flex-direction:column; align-items:center; gap:12px }
  .play img { width:280px; height:auto }
  .play span { font-weight:700; font-size:28px; color:#c9f3f1 }
`)
const cierreA = base(`<div class="c">
  <div class="marca"><img src="${LOGO}" alt=""><b>Flota DSP</b></div>
  <div class="qr"><img src="${QR}" alt=""></div>
  <div class="s">Escanea y descárgala</div>
  <div class="fila"><img class="play" src="${PLAY}" alt=""><div class="web">flotadsp.com</div></div>
  ${bono}
</div>`, `
  .c { position:absolute; left:70px; right:70px; top:300px; text-align:center }
  .marca { display:flex; align-items:center; justify-content:center; gap:20px }
  .marca img { width:100px; height:100px; border-radius:28px; box-shadow:0 24px 70px rgba(20,231,216,.35) }
  .marca b { font-weight:900; font-size:86px; letter-spacing:-.03em }
  .qr { margin:40px auto 0; width:500px; height:500px; background:#fff; border-radius:28px; padding:10px; box-shadow:0 30px 80px rgba(0,0,0,.5) }
  .qr img { width:100%; height:100%; image-rendering:pixelated }
  .s { margin-top:22px; font-weight:800; font-size:40px; color:#c9f3f1 }
  .fila { margin-top:30px; display:flex; align-items:center; justify-content:center; gap:30px }
  .play { width:280px; height:auto }
  .web { font-weight:900; font-size:62px; letter-spacing:-.02em; color:#FFD43B }
  .bono { margin:34px auto 0; display:inline-block; font-weight:800; font-size:42px; color:#fff; background:rgba(20,231,216,.14); border:2px solid rgba(20,231,216,.6); border-radius:999px; padding:14px 36px }
  .bono b { font-weight:900; color:#14e7d8; font-size:52px }
`)
// El lema, aparte: entra cuando la voz dice «Cada entrega cuenta».
const lema = (top = 1250) => base(`<div class="l">Cada entrega <em>cuenta.</em></div>`, `
  .l { position:absolute; left:40px; right:40px; top:${top}px; text-align:center; font-weight:900; font-size:84px; letter-spacing:-.03em; text-shadow:0 8px 40px rgba(0,0,0,.6) }
  .l em { font-style:normal; color:#14e7d8 }
`)

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
const pinta = async (nombre, html) => {
  await p.setContent(html, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250)
  await p.screenshot({ path: path.join(SALIDA, nombre), omitBackground: true })
  console.log('ok', nombre)
}
await pinta('gancho-25.png', gancho25)
await pinta('pregunta-1.png', pregunta1)
await pinta('cambio.png', cambio)
await pinta('interesa.png', interesa)
await pinta('logo.png', logo)
for (const [k, [l1, l2, mono]] of Object.entries(TITULOS)) await pinta(`titulo-${k}.png`, titulo(l1, l2, mono))
await pinta('panel-fondo.png', panelFondo)
await pinta('cierre-B.png', cierreB)
await pinta('cierre-A.png', cierreA)
await pinta('lema.png', lema())
await pinta('lema-A.png', lema(1330))
const q = await b.newPage({ viewport: { width: PANEL.w, height: PANEL.h } })
await q.setContent(panelMask); await q.waitForTimeout(100)
await q.screenshot({ path: path.join(SALIDA, 'panel-mask.png') }); console.log('ok panel-mask.png')
await b.close()
