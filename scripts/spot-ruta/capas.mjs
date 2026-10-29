// Capas gráficas del anuncio «La ruta hecha» (29-10-2026): píldoras, pago emocional, oferta, cierre A (con QR) y
// cierre B (botón), gancho alternativo «112 paquetes». Tipografía Archivo (la de la app) metida en el HTML desde
// node_modules, para que salga igual sin red. Zona segura de TikTok/Reels: nada importante en el 14 % de arriba
// ni en el 25 % de abajo. Colores de la app: cian #14e7d8, amarillo #FFD43B.
//   cd frontend && node ../scripts/spot-ruta/capas.mjs   ->  docs/anuncios/super-anuncio/capas/*.png
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = req('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'super-anuncio', 'capas')
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

// Píldoras (≤41 caracteres, una línea, al 17 % de la altura: fuera de lo que tapan Reels y TikTok).
const PILDORAS = {
  escaneo: 'Foto o escaneo: la dirección entra sola',
  ordenar: 'Ruta ordenada, con la hora de cada parada',
  zonas: 'Zonas de carga y descarga, en el mapa',
  voz: 'Te lleva con voz, parada a parada',
  entregado: 'Entregado, con prueba',
}
const pildora = (texto) => base(`<div class="p"><i></i><span class="t">${texto}</span></div>`, `
  .p { position:absolute; left:50%; top:326px; transform:translateX(-50%); display:flex; align-items:center; gap:18px; white-space:nowrap;
       background: rgba(6,10,14,.88); border:2px solid rgba(20,231,216,.7); border-radius:999px; padding:18px 36px 18px 26px;
       box-shadow: 0 18px 50px rgba(0,0,0,.55), 0 0 40px rgba(20,231,216,.22) }
  .p i { width:18px; height:18px; border-radius:50%; background:#14e7d8; box-shadow:0 0 18px rgba(20,231,216,.9); flex:0 0 auto }
  .t { font-weight:900; font-size:44px; letter-spacing:-.01em; color:#fff }
`)

// El gancho alternativo «112 paquetes» (el principal reutiliza gancho.png del v4: «¿Todavía ordenas la ruta a mano?»).
const gancho112 = base(`<div class="velo"></div><div class="g"><div class="n">112 paquetes.</div><h1>¿Por dónde<br>empiezas?</h1></div>`, `
  .velo { position:absolute; left:0; right:0; top:600px; bottom:0; background: linear-gradient(180deg, transparent, rgba(0,0,0,.72) 45%, rgba(0,0,0,.88)) }
  .g { position:absolute; left:70px; right:110px; top:960px }
  .n { font-weight:900; font-size:150px; line-height:1; letter-spacing:-.04em; color:#FFD43B; text-shadow: 0 10px 40px rgba(0,0,0,.6) }
  h1 { margin-top:26px; font-weight:900; font-size:112px; line-height:.98; letter-spacing:-.035em; text-shadow: 0 8px 40px rgba(0,0,0,.6) }
`)

// El pago emocional, sobre el plano del repartidor.
const manana = base(`<div class="velo"></div><div class="g"><h1>Mañana sales<br>con la ruta <em>hecha.</em></h1></div>`, `
  .velo { position:absolute; left:0; right:0; top:560px; bottom:0; background: linear-gradient(180deg, transparent, rgba(0,0,0,.70) 45%, rgba(0,0,0,.88)) }
  .g { position:absolute; left:70px; right:100px; top:1010px }
  h1 { font-weight:900; font-size:108px; line-height:1.0; letter-spacing:-.035em; text-shadow: 0 8px 40px rgba(0,0,0,.6) }
  h1 em { font-style:normal; color:#04121a; background:#14e7d8; padding:0 16px; border-radius:18px; box-decoration-break:clone }
`)

// La oferta (sin fecha): empieza gratis · sin tarjeta · Android e iPhone.
const oferta = base(`<div class="c"><div class="pill">Empieza<br>gratis</div><div class="l">sin tarjeta</div><div class="l2">Te registras y empiezas ya</div><div class="l3">Android e iPhone</div></div>`, `
  .c { position:absolute; left:90px; right:90px; top:520px; padding:70px 40px 64px; border-radius:56px; text-align:center;
       background: rgba(7,10,14,.74); border:2px solid rgba(20,231,216,.45); box-shadow: 0 50px 120px rgba(0,0,0,.6), 0 0 120px rgba(20,231,216,.18) }
  .pill { display:inline-block; background:#FFD43B; color:#1a1300; font-weight:900; font-size:132px; line-height:.95; letter-spacing:-.03em; border-radius:40px; padding:30px 54px; transform:rotate(-3deg); box-shadow:0 24px 70px rgba(255,212,59,.35) }
  .l { margin-top:48px; font-weight:900; font-size:78px; letter-spacing:-.02em }
  .l2 { margin-top:14px; font-weight:700; font-size:40px; color:#c9f3f1 }
  .l3 { margin-top:26px; display:inline-block; font-weight:800; font-size:32px; color:#04121a; background:#14e7d8; border-radius:999px; padding:12px 26px }
`)

// Cierre B (móvil: TikTok, Reels, feed): la web, qué pulsar, Play pequeño.
const cierreB = base(`<div class="c">
  <div class="marca"><img src="${LOGO}" alt=""><b>FDS</b></div>
  <div class="t">Tu cuenta gratis,<br>en un minuto</div>
  <div class="web">flotadsp.com</div>
  <div class="boton">Toca el botón de abajo <span>👇</span></div>
  <div class="play"><img src="${PLAY}" alt=""><span>o en iPhone, desde la web</span></div>
</div>`, `
  .c { position:absolute; left:70px; right:70px; top:380px; text-align:center }
  .marca { display:flex; align-items:center; justify-content:center; gap:22px }
  .marca img { width:130px; height:130px; border-radius:34px; box-shadow:0 24px 70px rgba(20,231,216,.35) }
  .marca b { font-weight:900; font-size:110px; letter-spacing:-.02em }
  .t { margin-top:64px; font-weight:900; font-size:78px; line-height:1.05; letter-spacing:-.025em }
  .web { margin:40px auto 0; display:inline-block; font-weight:900; font-size:96px; letter-spacing:-.02em; color:#04121a; background:#FFD43B; border-radius:30px; padding:22px 44px; box-shadow:0 30px 80px rgba(255,212,59,.3) }
  .boton { margin:56px auto 0; display:inline-flex; align-items:center; gap:16px; font-weight:900; font-size:46px; color:#04121a; background:#14e7d8; border-radius:999px; padding:22px 40px }
  .boton span { font-size:52px }
  .play { margin-top:54px; display:flex; flex-direction:column; align-items:center; gap:14px }
  .play img { width:300px; height:auto }
  .play span { font-weight:700; font-size:30px; color:#c9f3f1 }
`)

// Cierre A (QR: YouTube en ordenador, tele, pantallas de la nave, flyer): el QR grande y quieto.
const cierreA = base(`<div class="c">
  <div class="marca"><img src="${LOGO}" alt=""><b>FDS</b></div>
  <div class="t">Empieza gratis. Sin tarjeta.</div>
  <div class="qr"><img src="${QR}" alt=""></div>
  <div class="play"><img src="${PLAY}" alt=""></div>
  <div class="web">flotadsp.com/app</div>
  <div class="s">Escanea y descárgala</div>
</div>`, `
  .c { position:absolute; left:70px; right:70px; top:300px; text-align:center }
  .marca { display:flex; align-items:center; justify-content:center; gap:20px }
  .marca img { width:110px; height:110px; border-radius:30px; box-shadow:0 24px 70px rgba(20,231,216,.35) }
  .marca b { font-weight:900; font-size:96px; letter-spacing:-.02em }
  .t { margin-top:34px; font-weight:900; font-size:60px; letter-spacing:-.02em }
  .qr { margin:44px auto 0; width:540px; height:540px; background:#fff; border-radius:28px; padding:10px; box-shadow:0 30px 80px rgba(0,0,0,.5) }
  .qr img { width:100%; height:100%; image-rendering:pixelated }
  .play { margin-top:36px } .play img { width:360px; height:auto }
  .web { margin-top:26px; font-weight:900; font-size:72px; letter-spacing:-.02em; color:#FFD43B }
  .s { margin-top:14px; font-weight:700; font-size:40px; color:#c9f3f1 }
`)


// ── El móvil y los titulares (29-10, tarde): nada de letras encima de la app ────────────────────────────────
// La app va dentro de un móvil limpio (pantalla 972×1728 en 54,330; el borde inferior se funde con el fondo) y el
// mensaje de cada escena va en una franja APARTE, arriba. Así la pantalla se ve entera y limpia.
const TITULOS = {
  escaneo: ['Foto o escaneo:', 'la dirección entra sola'],
  ordenar: ['Ruta ordenada,', 'con la hora de cada parada'],
  zonas: ['Zonas de carga y descarga,', 'en el mapa'],
  voz: ['Te lleva con voz,', 'parada a parada'],
  entregado: ['Entregado,', 'con prueba'],
}
const titulo = (l1, l2) => base(`<div class="t"><div class="l1">${l1}</div><div class="l2">${l2}</div></div>`, `
  .t { position:absolute; left:50px; right:50px; top:96px; text-align:center }
  .l1 { font-weight:900; font-size:66px; line-height:1.06; letter-spacing:-.025em; color:#14e7d8; text-shadow:0 6px 30px rgba(0,0,0,.5) }
  .l2 { font-weight:900; font-size:66px; line-height:1.06; letter-spacing:-.025em; color:#fff; text-shadow:0 6px 30px rgba(0,0,0,.5) }
`)
// El cuerpo del móvil (sombra, borde) bajo la pantalla; se funde por abajo.
const marcoFondo = base(`<div class="m"></div>`, `
  .m { position:absolute; left:38px; top:314px; width:1004px; height:1760px; border-radius:72px; background:#0a0e13;
       border:3px solid rgba(255,255,255,.12); box-shadow:0 60px 160px rgba(0,0,0,.7), 0 0 90px rgba(20,231,216,.14), inset 0 0 0 2px rgba(0,0,0,.6);
       -webkit-mask-image: linear-gradient(to bottom, #000 80%, transparent 97%); mask-image: linear-gradient(to bottom, #000 80%, transparent 97%) }
`)
// La máscara de la pantalla (blanco = se ve): esquinas redondas y fundido por abajo. Mismo tamaño que la pantalla.
const marcoMask = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0 } body { width:972px; height:1728px; overflow:hidden; background:#000 }
  .s { position:absolute; inset:0; border-radius:60px; background:#fff;
       -webkit-mask-image: linear-gradient(to bottom, #000 82%, transparent 97%); mask-image: linear-gradient(to bottom, #000 82%, transparent 97%) }
</style></head><body><div class="s"></div></body></html>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
const pinta = async (nombre, html) => {
  await p.setContent(html, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250)
  await p.screenshot({ path: path.join(SALIDA, nombre), omitBackground: true })
  console.log('ok', nombre)
}
for (const [k, t] of Object.entries(PILDORAS)) await pinta(`pildora-${k}.png`, pildora(t))
await pinta('gancho-112.png', gancho112)
await pinta('manana.png', manana)
await pinta('oferta.png', oferta)
await pinta('cierre-B.png', cierreB)
await pinta('cierre-A.png', cierreA)
for (const [k, [l1, l2]] of Object.entries(TITULOS)) await pinta(`titulo-${k}.png`, titulo(l1, l2))
await pinta('marco-fondo.png', marcoFondo)
const q = await b.newPage({ viewport: { width: 972, height: 1728 } })
await q.setContent(marcoMask); await q.waitForTimeout(100)
await q.screenshot({ path: path.join(SALIDA, 'marco-mask.png') }); console.log('ok marco-mask.png')
await b.close()
