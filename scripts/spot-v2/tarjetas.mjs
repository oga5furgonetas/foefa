// Capas gráficas del spot v2 (14-10-2026), dibujadas con HTML/CSS (Inter) y capturadas con Playwright en PNG
// con transparencia: el móvil (bisel), el fondo de marca, los títulos de cada escena y las tarjetas finales.
//   cd frontend && node ../scripts/spot-v2/tarjetas.mjs   ->  docs/anuncios/reales/spot-v2/*.png
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v2')
fs.mkdirSync(SALIDA, { recursive: true })

const FUENTE = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap" rel="stylesheet">`
const base = (cuerpo, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${FUENTE}<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1080px; height:1920px; overflow:hidden; font-family:Inter, system-ui, sans-serif; color:#f4fbfb; background:transparent }
  ${extra}
</style></head><body>${cuerpo}</body></html>`

// El móvil: 780×1360, pantalla 720×1280 (la grabación), isla dinámica, brillo en el canto y sombra larga.
const telefono = base(`<div class="tel"><div class="pantalla"></div><div class="isla"></div></div>`, `
  .tel { position:absolute; left:150px; top:280px; width:780px; height:1360px; border-radius:96px;
    background: linear-gradient(160deg, #2a2f36 0%, #0d1013 55%, #1b1f24 100%);
    box-shadow: 0 60px 120px rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,.08) inset, 0 0 0 6px #0a0c0f;
    border: 2px solid rgba(255,255,255,.14) }
  .pantalla { position:absolute; left:30px; top:40px; width:720px; height:1280px; border-radius:66px; background:#000;
    box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset }
  .isla { position:absolute; left:50%; top:66px; width:150px; height:40px; margin-left:-75px; border-radius:24px; background:#000;
    box-shadow: 0 0 0 1px rgba(255,255,255,.06) }
`)

// La máscara de la pantalla (blanca donde va la app, con sus esquinas): para recortar el vídeo.
const mascara = base(`<div class="m"></div>`, `
  body { background:#000 }
  .m { position:absolute; left:180px; top:320px; width:720px; height:1280px; border-radius:66px; background:#fff }
`)

// Fondo de marca para la sección del móvil: degradado profundo con luz y una malla sutil.
const fondo = base(`<div class="luz"></div><div class="malla"></div>`, `
  body { background: radial-gradient(circle at 50% 20%, #0f6b68 0%, #06262b 42%, #03090c 100%) }
  .luz { position:absolute; left:-200px; top:-300px; width:1480px; height:900px; background: radial-gradient(ellipse at center, rgba(20,231,216,.22), transparent 60%) }
  .malla { position:absolute; inset:0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 90px 90px; mask-image: radial-gradient(circle at 50% 45%, #000 20%, transparent 75%) }
`)

// Títulos de escena (arriba): número + frase corta.
const titulo = (n, t1, t2) => base(`<div class="t"><div class="n">${n}</div><h2>${t1}</h2><p>${t2}</p></div>`, `
  .t { position:absolute; left:70px; right:70px; top:88px; text-align:center }
  .n { display:inline-block; font:800 28px/1 Inter, sans-serif; letter-spacing:.14em; color:#14e7d8; border:2px solid rgba(20,231,216,.55); border-radius:999px; padding:12px 20px; margin-bottom:16px }
  h2 { font:900 68px/1.02 Inter, sans-serif; letter-spacing:-.02em; text-shadow: 0 6px 30px rgba(0,0,0,.6) }
  p { margin-top:12px; font:700 34px/1.25 Inter, sans-serif; color:#d7fff9; text-shadow: 0 4px 20px rgba(0,0,0,.6) }
`)

// Gancho sobre el metraje (abajo, a lo grande).
const gancho = (t1, t2) => base(`<div class="g"><h1>${t1}</h1>${t2 ? `<p>${t2}</p>` : ''}</div>`, `
  .g { position:absolute; left:70px; right:70px; bottom:300px; text-align:left }
  h1 { font:900 112px/.98 Inter, sans-serif; letter-spacing:-.035em; text-shadow: 0 8px 40px rgba(0,0,0,.75) }
  h1 em { font-style:normal; color:#FFD43B }
  p { margin-top:22px; font:700 42px/1.2 Inter, sans-serif; color:#eaffff; text-shadow: 0 4px 24px rgba(0,0,0,.75) }
`)

// Marca (revelación): logo grande.
const marca = base(`<div class="logo">FDS</div><div class="lema">La app que ordena tu reparto</div>`, `
  body { background: radial-gradient(circle at 50% 40%, #0d5a5a 0%, #05141a 60%) }
  .logo { position:absolute; left:50%; top:50%; transform:translate(-50%,-60%); width:420px; height:420px; border-radius:100px; background:#14e7d8; color:#04121a; font:900 190px/420px Inter, sans-serif; text-align:center; box-shadow: 0 40px 120px rgba(20,231,216,.35) }
  .lema { position:absolute; left:0; right:0; top:50%; margin-top:260px; text-align:center; font:800 54px/1.1 Inter, sans-serif; color:#d7fff9 }
`)

// Tarjeta de la oferta.
const oferta = base(`<div class="c"><div class="pre">PARA QUIEN REPARTE POR SU CUENTA</div><div class="pill">GRATIS<br>y sin límite</div><div class="h">hasta el 31 de diciembre</div><div class="s">sin tarjeta · pruébala sin registrarte</div></div>`, `
  body { background: radial-gradient(circle at 50% 18%, #0d5a5a 0, #05141a 55%) }
  .c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px; padding:0 70px; text-align:center }
  .pre { font:800 30px/1 Inter, sans-serif; letter-spacing:.14em; color:#5eead4 }
  .pill { background:#FFD43B; color:#1a1300; font:900 118px/1.0 Inter, sans-serif; border-radius:44px; padding:34px 60px; transform:rotate(-2.5deg); box-shadow:0 24px 70px rgba(255,212,59,.35) }
  .h { font:900 64px/1.1 Inter, sans-serif; color:#fff; margin-top:10px }
  .s { font:700 40px/1.3 Inter, sans-serif; color:#d7fff9 }
`)

// Tarjeta del premio.
const gana = base(`<div class="c"><div class="pre">Y ADEMÁS, HASTA EL 31 DE OCTUBRE</div><div class="pill">GANA 10 €</div><div class="h">por cada compañero que invites y la use</div><div class="s">Lo cobras por Bizum o transferencia</div><div class="peq">cuenta cuando se registra con tu enlace y hace 20 entregas en 2 días · condiciones en la web</div></div>`, `
  body { background: radial-gradient(circle at 50% 18%, #0d5a5a 0, #05141a 55%) }
  .c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px; padding:0 70px; text-align:center }
  .pre { font:800 30px/1.2 Inter, sans-serif; letter-spacing:.12em; color:#5eead4 }
  .pill { background:#FFD43B; color:#1a1300; font:900 138px/1 Inter, sans-serif; white-space:nowrap; border-radius:44px; padding:30px 56px; transform:rotate(-2.5deg); box-shadow:0 24px 70px rgba(255,212,59,.35) }
  .h { font:900 66px/1.1 Inter, sans-serif; max-width:920px }
  .s { font:700 42px/1.3 Inter, sans-serif; color:#d7fff9 }
  .peq { font:600 28px/1.35 Inter, sans-serif; color:#a9c2c6; max-width:900px; margin-top:10px }
`)

// Cierre.
const cierre = base(`<div class="c"><div class="logo">FDS</div><div class="h">Tu ruta de reparto,<br><span>ordenada sola</span></div><div class="web">flotadsp.com/repartidores</div><div class="s">Pruébala sin registrarte</div></div>`, `
  body { background: radial-gradient(circle at 50% 30%, #0d5a5a 0, #05141a 58%) }
  .c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px; padding:0 70px; text-align:center }
  .logo { width:220px; height:220px; border-radius:56px; background:#14e7d8; color:#04121a; font:900 100px/220px Inter, sans-serif; box-shadow:0 30px 90px rgba(20,231,216,.3) }
  .h { font:900 78px/1.04 Inter, sans-serif; letter-spacing:-.02em }
  .h span { color:#14e7d8 }
  .web { font:800 54px/1.2 Inter, sans-serif; color:#FFD43B; margin-top:16px }
  .s { font:700 40px/1.3 Inter, sans-serif; color:#d7fff9 }
`)

const PNGS = {
  'telefono.png': [telefono, true], 'mascara.png': [mascara, false], 'fondo.png': [fondo, false], 'marca.png': [marca, false],
  'gancho1.png': [gancho('¿Y la ruta…<br><em>a ojo?</em>', ''), true],
  'gancho2.png': [gancho('Cada minuto<br>ordenando…', 'es un minuto que no repartes.'), true],
  'titulo1.png': [titulo('01', 'Foto a la etiqueta', 'la dirección y el teléfono entran solos'), true],
  'titulo2.png': [titulo('02', 'Ruta ordenada sola', 'por tiempo, con el tráfico de cada hora'), true],
  'titulo3.png': [titulo('03', 'Voz hasta cada puerta', 'y manos libres: di «entregado» y sigue'), true],
  'titulo4.png': [titulo('04', 'Cuánto llevas ganado', 'hoy, y lo que se va en gasolina'), true],
  'oferta.png': [oferta, false], 'gana.png': [gana, false], 'cierre.png': [cierre, false],
}
const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [nombre, [html, transparente]] of Object.entries(PNGS)) {
  await pagina.setContent(html, { waitUntil: 'networkidle' })
  await pagina.screenshot({ path: path.join(SALIDA, nombre), omitBackground: transparente })
  console.log('ok', nombre)
}
await navegador.close()
