// FOTOS PARA TIKTOK (10-10-2026): un carrusel de consejos para repartidores (el formato que más
// se comparte en el modo foto de TikTok) y una imagen suelta. Fondos de Pexels (licencia comercial;
// solo enseñan el PROBLEMA, nunca a esa persona usando o recomendando FDS) y la captura real de la app.
//   cd frontend && node ../scripts/tiktok-fotos.mjs   → docs/anuncios/tiktok-fotos/*.png
// Zonas que tapa TikTok: arriba ~170 px, abajo ~420 px y la columna de iconos de la derecha (~150 px).
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

// Playwright vive en frontend/node_modules: se carga desde ahí (el script está en scripts/).
const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('@playwright/test')

const RAIZ = path.resolve(process.cwd(), '..')
const SALIDA = path.join(RAIZ, 'docs', 'anuncios', 'tiktok-fotos')
const b64 = (f, tipo) => `data:${tipo};base64,${fs.readFileSync(f).toString('base64')}`
const fondoCargando = b64(path.join(SALIDA, 'fondos', 'cargando.jpg'), 'image/jpeg')
const fondoApuntando = b64(path.join(SALIDA, 'fondos', 'apuntando.jpg'), 'image/jpeg')
const captura = b64(path.join(RAIZ, 'frontend', 'public', 'capturas-ruta', 'es', '1-ruta.png'), 'image/png')
const PARADAS = 15

const BASE = `
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  :root { --noche:#05141a; --marca:#14e7d8; --marca2:#0fb8ad; --amarillo:#ffd43b; --blanco:#f4fbfb; --gris:#a9c2c6 }
  * { box-sizing:border-box; margin:0; padding:0 }
  body { width:1080px; height:1920px; overflow:hidden; font-family:Inter, Arial, sans-serif; color:var(--blanco); background:var(--noche) }
  .lienzo { position:relative; width:1080px; height:1920px; overflow:hidden }
  .titular { font-family:'Archivo Black', Arial Black, sans-serif; letter-spacing:-1.5px; line-height:1.08 }
  .titular.con-resalte { line-height:1.2 }
  .pildora { display:inline-block; font-weight:800; letter-spacing:4px; text-transform:uppercase; border-radius:999px }
  .resalta { background:var(--amarillo); color:#111; padding:0 14px; border-radius:14px; box-decoration-break:clone; -webkit-box-decoration-break:clone }
  .pie { position:absolute; left:80px; top:1420px; font-size:30px; font-weight:700; color:var(--gris) }
  .pie b { color:var(--marca) }
</style>`

const portada = `
<div class="lienzo" style="background:url(${fondoCargando}) center/cover">
  <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(5,20,26,.55) 0%, rgba(5,20,26,.35) 35%, rgba(5,20,26,.92) 70%, rgba(5,20,26,.98) 100%)"></div>
  <div style="position:absolute; left:80px; right:150px; bottom:440px; display:flex; flex-direction:column; align-items:flex-start; gap:34px">
    <span class="pildora" style="background:var(--marca); color:#04121a; font-size:30px; padding:14px 28px">Para repartidores</span>
    <h1 class="titular con-resalte" style="font-size:112px">5 trucos para <span class="resalta">acabar antes</span> la ruta</h1>
    <p style="font-size:46px; font-weight:700; color:var(--gris)">El 4 casi nadie lo hace</p>
    <span class="pildora" style="border:3px solid var(--blanco); font-size:30px; padding:14px 30px">Desliza ➜</span>
  </div>
</div>`

const TRUCOS = [
  ['📦', 'Carga al revés', 'Lo último que vas a entregar, al fondo. Lo primero, a mano de la puerta.'],
  ['🕗', 'Mira las franjas antes de salir', 'Si alguien solo está por la mañana, va primero. Si no, toca volver.'],
  ['🚪', 'Misma puerta, una parada', 'Tres paquetes para el mismo portal son una parada, no tres.'],
  ['🗺️', 'Ordena por tiempo, no por distancia', 'En ciudad, 500 metros pueden ser 10 minutos. La ruta más corta no siempre es la más rápida.'],
  ['📱', 'Avisa antes a los que nunca están', 'Un mensaje antes de llegar y te ahorras subir para nada.'],
]
const truco = ([icono, titulo, texto], i) => `
<div class="lienzo" style="background:radial-gradient(900px 700px at 85% 10%, rgba(20,231,216,.18), transparent 60%), var(--noche)">
  <svg style="position:absolute; inset:0" width="1080" height="1920" viewBox="0 0 1080 1920">
    <path d="M -40 1700 C 220 1500, 380 1620, 560 1400 S 900 1180, 1120 1260" fill="none" stroke="rgba(20,231,216,.22)" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round"/>
  </svg>
  <div style="position:absolute; left:80px; right:150px; top:300px">
    <div class="titular" style="font-size:300px; line-height:1; color:transparent; -webkit-text-stroke:6px var(--marca)">${i + 1}</div>
    <div style="font-size:110px; margin-top:20px">${icono}</div>
    <h2 class="titular" style="margin-top:36px; font-size:96px">${titulo}</h2>
    <p style="margin-top:40px; font-size:52px; line-height:1.3; font-weight:500; color:var(--gris)">${texto}</p>
  </div>
  <p class="pie">Guárdalo para mañana · <b>FDS</b></p>
</div>`

const cierre = `
<div class="lienzo" style="background:linear-gradient(160deg, #0b3b3d 0%, var(--noche) 55%)">
  <div style="position:absolute; left:80px; right:150px; top:190px">
    <h2 class="titular" style="font-size:104px">¿Y si lo hace <span style="color:var(--marca)">la app</span>?</h2>
    <p style="margin-top:28px; font-size:44px; line-height:1.3; font-weight:700; color:var(--gris)">Foto a la etiqueta: la ruta se ordena sola y te guía por voz.</p>
  </div>
  <div style="position:absolute; left:230px; top:560px; width:470px; height:700px; border-radius:52px; padding:14px; background:#0d1b20; box-shadow:0 40px 90px rgba(0,0,0,.55), 0 0 0 3px rgba(20,231,216,.35)">
    <div style="width:100%; height:100%; border-radius:42px; overflow:hidden; background:url(${captura}) top center/cover"></div>
  </div>
  <div style="position:absolute; left:80px; right:150px; top:1310px; display:flex; flex-direction:column; align-items:flex-start; gap:22px">
    <span class="pildora" style="background:var(--amarillo); color:#111; font-size:34px; letter-spacing:1px; text-transform:none; padding:16px 30px">Gratis hasta ${PARADAS} paradas al día · sin tarjeta</span>
    <p style="font-size:34px; font-weight:800; color:var(--blanco)">flotadsp.com/repartidores <span style="color:var(--gris); font-weight:700">· enlace en el perfil</span></p>
  </div>
</div>`

const suelta = `
<div class="lienzo" style="background:url(${fondoApuntando}) center/cover">
  <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(5,20,26,.2) 0%, rgba(5,20,26,.15) 30%, rgba(5,20,26,.9) 58%, rgba(5,20,26,.98) 100%)"></div>
  <div style="position:absolute; left:80px; right:150px; top:740px">
    <h1 class="titular con-resalte" style="font-size:108px">¿Sigues ordenando la ruta <span class="resalta">a mano</span>?</h1>
    <p style="margin-top:36px; font-size:46px; line-height:1.3; font-weight:700; color:var(--blanco)">Haz una foto a la etiqueta y la app ordena las paradas sola.</p>
  </div>
  <div style="position:absolute; left:80px; right:150px; top:1350px; display:flex; flex-direction:column; align-items:flex-start; gap:22px">
    <span class="pildora" style="background:var(--amarillo); color:#111; font-size:34px; letter-spacing:1px; text-transform:none; padding:16px 30px">Gratis hasta ${PARADAS} paradas al día · sin tarjeta</span>
    <p style="font-size:34px; font-weight:800; color:var(--blanco)">flotadsp.com/repartidores <span style="color:var(--gris); font-weight:700">· enlace en el perfil</span></p>
  </div>
</div>`

const PIEZAS = [['1-portada', portada], ...TRUCOS.map((t, i) => [`${i + 2}-truco-${i + 1}`, truco(t, i)]), ['7-la-app', cierre], ['imagen-suelta', suelta]]

const nav = await chromium.launch()
const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
for (const [nombre, html] of PIEZAS) {
  await pag.setContent(`<!doctype html><html><head><meta charset="utf-8">${BASE}</head><body>${html}</body></html>`, { waitUntil: 'networkidle' })
  await pag.evaluate(() => document.fonts.ready)
  const destino = path.join(SALIDA, `${nombre}.png`)
  await pag.screenshot({ path: destino })
  console.log('→', path.relative(RAIZ, destino))
}
await nav.close()
