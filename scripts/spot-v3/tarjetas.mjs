// Capas gráficas del spot v3 (23-10-2026). Dani: «un buen vídeo, nada básico ni cutre: a la gente le entra
// todo por los ojos». Mismo sistema que el v2 (HTML/CSS → PNG con transparencia por Playwright), con la
// tipografía de la app (Archivo), títulos más grandes y limpios, el gancho en amarillo, la oferta de
// lib/precios.js y un cierre con QR a la app (quien ve el vídeo en la tele o en el móvil de otro lo escanea).
//   cd frontend && node ../scripts/spot-v3/tarjetas.mjs   ->  docs/anuncios/reales/spot-v3/*.png
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = req('@playwright/test')
const QR = req('qrcode')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v3')
fs.mkdirSync(SALIDA, { recursive: true })
const LOGO = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(RAIZ, 'frontend', 'public', 'favicon.svg')).toString('base64')
const qr = await QR.toDataURL('https://flotadsp.com/app?utm_source=video&utm_content=spot3', { margin: 1, width: 420, color: { dark: '#04121a', light: '#ffffff' } })

const FUENTE = `<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap" rel="stylesheet">`
const base = (cuerpo, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${FUENTE}<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1080px; height:1920px; overflow:hidden; font-family:Archivo, Inter, system-ui, sans-serif; color:#f4fbfb; background:transparent }
  ${extra}
</style></head><body>${cuerpo}</body></html>`

// El móvil: 780×1360, pantalla 720×1280 (la grabación), isla, brillo en el canto y sombra larga.
const telefono = base(`<div class="tel"><div class="pantalla"></div><div class="isla"></div></div>`, `
  .tel { position:absolute; left:150px; top:280px; width:780px; height:1360px; border-radius:96px;
    background: linear-gradient(160deg, #2a2f36 0%, #0d1013 55%, #1b1f24 100%);
    box-shadow: 0 70px 140px rgba(0,0,0,.7), 0 0 0 2px rgba(255,255,255,.08) inset, 0 0 0 6px #0a0c0f;
    border: 2px solid rgba(255,255,255,.16) }
  .pantalla { position:absolute; left:30px; top:40px; width:720px; height:1280px; border-radius:66px; background:#000;
    box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset }
  .isla { position:absolute; left:50%; top:66px; width:150px; height:40px; margin-left:-75px; border-radius:24px; background:#000;
    box-shadow: 0 0 0 1px rgba(255,255,255,.06) }
`)
const mascara = base(`<div class="m"></div>`, `
  body { background:#000 }
  .m { position:absolute; left:180px; top:320px; width:720px; height:1280px; border-radius:66px; background:#fff }
`)
// Fondo de marca: profundo, con una luz cian arriba y una malla que se desvanece.
const fondo = base(`<div class="luz"></div><div class="luz2"></div><div class="malla"></div>`, `
  body { background: radial-gradient(circle at 50% 18%, #0b5f5c 0%, #062229 45%, #03080b 100%) }
  .luz { position:absolute; left:-200px; top:-300px; width:1480px; height:900px; background: radial-gradient(ellipse at center, rgba(20,231,216,.26), transparent 60%) }
  .luz2 { position:absolute; left:300px; top:1300px; width:1200px; height:900px; background: radial-gradient(ellipse at center, rgba(14,165,183,.16), transparent 60%) }
  .malla { position:absolute; inset:0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 90px 90px; mask-image: radial-gradient(circle at 50% 45%, #000 20%, transparent 75%) }
`)
// Títulos de escena (arriba): número en píldora + frase corta + detalle.
const titulo = (n, t1, t2) => base(`<div class="t"><div class="n">${n}</div><h2>${t1}</h2><p>${t2}</p></div>`, `
  .t { position:absolute; left:60px; right:60px; top:80px; text-align:center }
  .n { display:inline-block; font-weight:800; font-size:26px; line-height:1; letter-spacing:.16em; color:#04121a; background:#14e7d8; border-radius:999px; padding:12px 20px; margin-bottom:18px }
  h2 { font-weight:900; font-size:72px; line-height:1.02; letter-spacing:-.025em; text-shadow: 0 6px 30px rgba(0,0,0,.6) }
  p { margin-top:12px; font-weight:700; font-size:34px; line-height:1.25; color:#d7fff9; text-shadow: 0 4px 20px rgba(0,0,0,.6) }
`)
// Gancho sobre el metraje: abajo, a lo grande, con el amarillo de la oferta.
const gancho = (t1, t2) => base(`<div class="g"><h1>${t1}</h1>${t2 ? `<p>${t2}</p>` : ''}</div>`, `
  .g { position:absolute; left:64px; right:64px; bottom:280px; text-align:left }
  h1 { font-weight:900; font-size:116px; line-height:.96; letter-spacing:-.035em; text-shadow: 0 8px 40px rgba(0,0,0,.8) }
  h1 em { font-style:normal; color:#FFD43B }
  p { margin-top:24px; font-weight:700; font-size:44px; line-height:1.2; color:#eaffff; text-shadow: 0 4px 24px rgba(0,0,0,.8) }
`)
// Marca (revelación): el logo de verdad, grande.
const marca = base(`<img class="logo" src="${LOGO}" alt=""><div class="nombre">FDS</div><div class="lema">La app de reparto gratis</div>`, `
  body { background: radial-gradient(circle at 50% 40%, #0d5a5a 0%, #05141a 60%) }
  .logo { position:absolute; left:50%; top:50%; transform:translate(-50%,-78%); width:360px; height:360px; border-radius:90px; box-shadow: 0 40px 120px rgba(20,231,216,.35) }
  .nombre { position:absolute; left:0; right:0; top:50%; margin-top:140px; text-align:center; font-weight:900; font-size:150px; line-height:1; letter-spacing:-.02em }
  .lema { position:absolute; left:0; right:0; top:50%; margin-top:310px; text-align:center; font-weight:800; font-size:52px; line-height:1.1; color:#14e7d8 }
`)
// La oferta (de lib/precios.js: gratis y sin límite hasta el 31-12, sin tarjeta).
const oferta = base(`<div class="c"><div class="pre">PARA QUIEN REPARTE</div><div class="pill">GRATIS<br>y sin límite</div><div class="h">hasta el 31 de diciembre</div><div class="s">sin tarjeta · Android e iPhone</div></div>`, `
  body { background: radial-gradient(circle at 50% 18%, #0d5a5a 0, #05141a 55%) }
  .c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px; padding:0 70px; text-align:center }
  .pre { font-weight:800; font-size:30px; line-height:1; letter-spacing:.16em; color:#5eead4 }
  .pill { background:#FFD43B; color:#1a1300; font-weight:900; font-size:120px; line-height:1.0; border-radius:44px; padding:36px 64px; transform:rotate(-2.5deg); box-shadow:0 24px 70px rgba(255,212,59,.35); letter-spacing:-.02em }
  .h { font-weight:900; font-size:66px; line-height:1.1; color:#fff; margin-top:12px; letter-spacing:-.02em }
  .s { font-weight:700; font-size:40px; line-height:1.3; color:#d7fff9 }
`)
// Cierre: logo, nombre, la web y un QR a la app.
const cierre = base(`<div class="c"><img class="logo" src="${LOGO}" alt=""><div class="h">FDS</div><div class="sub">La app de reparto gratis</div><div class="qr"><img src="${qr}" alt=""></div><div class="web">flotadsp.com</div><div class="s">Escanea o entra y pruébala hoy</div></div>`, `
  body { background: radial-gradient(circle at 50% 30%, #0d5a5a 0, #05141a 58%) }
  .c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; padding:0 70px; text-align:center }
  .logo { width:200px; height:200px; border-radius:52px; box-shadow:0 30px 90px rgba(20,231,216,.3) }
  .h { font-weight:900; font-size:96px; line-height:1; letter-spacing:-.02em }
  .sub { font-weight:800; font-size:46px; line-height:1.1; color:#14e7d8; margin-bottom:14px }
  .qr { background:#fff; border-radius:36px; padding:22px; box-shadow:0 30px 80px rgba(0,0,0,.5) }
  .qr img { display:block; width:360px; height:360px }
  .web { font-weight:900; font-size:60px; line-height:1.2; color:#FFD43B; margin-top:10px }
  .s { font-weight:700; font-size:38px; line-height:1.3; color:#d7fff9 }
`)

const PNGS = {
  'telefono.png': [telefono, true], 'mascara.png': [mascara, false], 'fondo.png': [fondo, false], 'marca.png': [marca, false],
  'gancho1.png': [gancho('¿Todavía ordenas<br>la ruta <em>a mano?</em>', ''), true],
  'gancho2.png': [gancho('Cada minuto<br>ordenando…', 'es un minuto que no repartes.'), true],
  'titulo1.png': [titulo('01', 'Foto a la etiqueta', 'la dirección y el teléfono entran solos'), true],
  'titulo2.png': [titulo('02', 'La ruta se ordena sola', 'por tiempo, con el tráfico de cada hora'), true],
  'titulo3.png': [titulo('03', 'Voz hasta cada puerta', 'y en Android, manos libres'), true],
  'titulo4.png': [titulo('04', 'Entregado en un toque', 'dónde lo dejas, quién lo recoge, su firma'), true],
  'oferta.png': [oferta, false], 'cierre.png': [cierre, false],
}
const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [nombre, [html, transparente]] of Object.entries(PNGS)) {
  await pagina.setContent(html, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.waitForTimeout(300)
  await pagina.screenshot({ path: path.join(SALIDA, nombre), omitBackground: transparente })
  console.log('ok', nombre)
}
await navegador.close()
