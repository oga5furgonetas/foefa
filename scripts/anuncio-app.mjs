// IMÁGENES DE ANUNCIO CON LA APP DE VERDAD (23-10-2026). Dani: «más anuncios con buena interfaz y buenas
// imágenes sobre la app». Cada tarjeta lleva una captura REAL de la app (public/capturas-ruta y
// docs/capturas-ruta, generadas por Playwright) dentro de un móvil, un titular con una función que la app
// hace hoy, y la oferta de lib/precios.js. Sin fotos de terceros ni cifras inventadas.
//   cd frontend && node ../scripts/anuncio-app.mjs
// Salida: docs/anuncios/app/<n>-<clave>-{4x5,9x16,1x1}.png (+ 1x1 .jpg ≤200 KB para Spotify)
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { execFileSync } from 'child_process'
const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')
const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'app')
const LOGO = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(RAIZ, 'frontend', 'public', 'favicon.svg')).toString('base64')
const PROMO = 'Gratis y sin límite hasta el 31 de diciembre · sin tarjeta'

const captura = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')
const CAP = {
  ruta: path.join(RAIZ, 'frontend', 'public', 'capturas-ruta', 'es', '1-ruta.png'),
  mapa: path.join(RAIZ, 'frontend', 'public', 'capturas-ruta', 'es', '2-mapa.png'),
  navegando: path.join(RAIZ, 'frontend', 'public', 'capturas-ruta', 'es', '3-navegando.png'),
  llegado: path.join(RAIZ, 'docs', 'capturas-ruta', '7-has-llegado.png'),
}

// [clave, titular (con <em> para el cian), subtítulo, captura]
const TARJETAS = [
  ['ruta-sola', 'La ruta se <em>ordena sola</em>', 'Escanea los paquetes o haz una foto a la etiqueta: la app pone las paradas en orden, por tiempo y con el tráfico.', CAP.ruta],
  ['voz', 'Te lleva <em>con voz</em> hasta cada puerta', 'Dentro de la app, parada a parada. Y en Android, manos libres: di «entregado» y sigue.', CAP.navegando],
  ['mapa', 'Tus paradas, <em>en el mapa</em>', 'Ves la ruta entera, la siguiente parada y a qué hora llegas a cada una.', CAP.mapa],
  ['entregado', 'Entregado <em>en un toque</em>', 'Dónde lo dejas, quién lo recoge y su firma con el dedo. Sin cobertura también.', CAP.llegado],
]

const html = (t, ancho, alto) => {
  const [, titular, sub, cap] = t
  const vertical = alto > ancho * 1.3          // 9:16
  const cuadrada = alto === ancho              // 1:1 (Spotify)
  const telW = cuadrada ? 330 : vertical ? 470 : 440
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:${ancho}px; height:${alto}px; overflow:hidden; font-family:Archivo, Inter, system-ui, sans-serif; color:#eef8f8;
    background: radial-gradient(900px 700px at 70% 0%, rgba(20,231,216,.22), transparent 60%), radial-gradient(700px 600px at 10% 100%, rgba(14,165,183,.18), transparent 60%), #070a0e }
  .marca { position:absolute; left:${cuadrada ? 36 : 56}px; top:${cuadrada ? 32 : 52}px; display:flex; align-items:center; gap:14px }
  .marca img { width:${cuadrada ? 54 : 68}px; height:${cuadrada ? 54 : 68}px; border-radius:18px }
  .marca b { font-size:${cuadrada ? 30 : 36}px; letter-spacing:-.01em }
  .promo { position:absolute; right:${cuadrada ? 36 : 56}px; top:${cuadrada ? 40 : 62}px; background:#FFD43B; color:#1a1300; font-weight:900; font-size:${cuadrada ? 17 : 22}px; border-radius:999px; padding:${cuadrada ? 9 : 12}px ${cuadrada ? 16 : 22}px; max-width:${cuadrada ? 300 : 480}px; text-align:center; line-height:1.15 }
  .texto { position:absolute; left:${cuadrada ? 36 : 56}px; right:${cuadrada ? 36 : 56}px; ${vertical ? 'top:190px' : cuadrada ? 'top:120px' : 'top:170px'} }
  h1 { font-weight:900; font-size:${cuadrada ? 54 : vertical ? 84 : 76}px; line-height:1.02; letter-spacing:-.03em; max-width:${cuadrada ? 560 : 640}px }
  h1 em { font-style:normal; color:#14e7d8 }
  .sub { margin-top:${cuadrada ? 14 : 22}px; font-weight:600; font-size:${cuadrada ? 20 : vertical ? 32 : 28}px; line-height:1.3; color:#c9e9ea; max-width:${cuadrada ? 330 : vertical ? 940 : 520}px }
  .tel { position:absolute; width:${telW}px; ${cuadrada ? 'right:36px; bottom:-60px' : vertical ? 'left:50%; transform:translateX(-50%); bottom:-120px' : 'right:56px; bottom:-110px'};
    border:14px solid #11161c; border-radius:56px; overflow:hidden; box-shadow:0 60px 120px -40px rgba(0,0,0,.9), 0 0 0 2px #2a333d; background:#0b0f14 }
  .tel img { display:block; width:100% }
  .pie { position:absolute; left:${cuadrada ? 36 : 56}px; ${vertical ? 'top:560px' : `bottom:${cuadrada ? 30 : 48}px`}; font-weight:800; font-size:${cuadrada ? 22 : 30}px; color:#14e7d8 }
  .pie small { display:block; font-weight:600; font-size:${cuadrada ? 16 : 22}px; color:#a9c3c5; margin-top:6px }
</style></head><body>
  <div class="marca"><img src="${LOGO}" alt=""><b>FDS</b></div>
  <div class="promo">${PROMO}</div>
  <div class="texto"><h1>${titular}</h1><p class="sub">${sub}</p></div>
  <div class="tel"><img src="${captura(cap)}" alt=""></div>
  <div class="pie">La app de reparto gratis<small>flotadsp.com · Android e iPhone</small></div>
</body></html>`
}

fs.mkdirSync(SALIDA, { recursive: true })
const b = await chromium.launch()
const formatos = [['4x5', 1080, 1350], ['9x16', 1080, 1920], ['1x1', 1080, 1080]]
let n = 0
for (const t of TARJETAS) {
  n += 1
  for (const [nombre, w, h] of formatos) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    await p.setContent(html(t, w, h), { waitUntil: 'networkidle' })
    await p.evaluate(() => document.fonts.ready)
    await p.waitForTimeout(400)
    const png = path.join(SALIDA, `${n}-${t[0]}-${nombre}.png`)
    await p.screenshot({ path: png })
    await p.close()
    if (nombre === '1x1') {
      // Spotify: imagen de acompañamiento 640×640, JPEG o PNG, ≤200 KB.
      const jpg = path.join(SALIDA, `${n}-${t[0]}-spotify-640.jpg`)
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=640:640', '-q:v', '5', jpg])
      console.log(path.basename(jpg), Math.round(fs.statSync(jpg).size / 1024), 'KB')
    }
  }
  console.log('tarjeta', n, t[0])
}
await b.close()
