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
// 10-10-2026: la promoción (ver frontend/src/lib/precios.js). Al acabar, volver a la de abajo.
const OFERTA = 'Gratis y sin límite hasta el 31 de diciembre'
// const OFERTA = `Gratis hasta ${PARADAS} paradas al día · sin tarjeta`

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

const portada = (llamada) => `
<div class="lienzo" style="background:url(${fondoCargando}) center/cover">
  <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(5,20,26,.55) 0%, rgba(5,20,26,.35) 35%, rgba(5,20,26,.92) 70%, rgba(5,20,26,.98) 100%)"></div>
  <div style="position:absolute; left:80px; right:150px; bottom:440px; display:flex; flex-direction:column; align-items:flex-start; gap:34px">
    <span class="pildora" style="background:var(--marca); color:#04121a; font-size:30px; padding:14px 28px">Para repartidores</span>
    <h1 class="titular con-resalte" style="font-size:112px">5 trucos para <span class="resalta">acabar antes</span> la ruta</h1>
    <p style="font-size:46px; font-weight:700; color:var(--gris)">El 4 casi nadie lo hace</p>
    <span class="pildora" style="border:3px solid var(--blanco); font-size:30px; padding:14px 30px">${llamada}</span>
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
    <span class="pildora" style="background:var(--amarillo); color:#111; font-size:30px; letter-spacing:0.5px; text-transform:none; padding:16px 26px">${OFERTA}</span>
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
    <span class="pildora" style="background:var(--amarillo); color:#111; font-size:30px; letter-spacing:0.5px; text-transform:none; padding:16px 26px">${OFERTA}</span>
    <p style="font-size:34px; font-weight:800; color:var(--blanco)">flotadsp.com/repartidores <span style="color:var(--gris); font-weight:700">· enlace en el perfil</span></p>
  </div>
</div>`


/* EL ANUNCIO DE LA PROMOCIÓN (10-10-2026): lo que se ofrece, en grande, y la app de verdad. */
const promo = (alto) => {
  const alto916 = alto > 1500       // 9:16: todo por encima de lo que tapa TikTok abajo (~420 px) y a la derecha (~150 px)
  return `
<div class="lienzo" style="height:${alto}px; background:radial-gradient(900px 700px at 80% 0%, rgba(20,231,216,.22), transparent 60%), var(--noche)">
  <div style="position:absolute; left:80px; right:${alto916 ? 150 : 80}px; top:${alto916 ? 200 : 70}px">
    <span class="pildora" style="background:var(--marca); color:#04121a; font-size:28px; padding:12px 26px">Para repartidores</span>
    <h1 class="titular" style="margin-top:28px; font-size:${alto916 ? 100 : 92}px">Tu ruta de reparto, <span style="color:var(--marca)">ordenada sola</span></h1>
    <p style="margin-top:22px; font-size:${alto916 ? 40 : 38}px; line-height:1.3; font-weight:700; color:var(--gris)">Foto a la etiqueta, la app ordena las paradas y te guía con voz.</p>
  </div>
  <div style="position:absolute; left:${alto916 ? 560 : 620}px; top:${alto916 ? 800 : 520}px; width:${alto916 ? 360 : 380}px; height:${alto916 ? 580 : 600}px; border-radius:46px; padding:12px; background:#0d1b20; box-shadow:0 40px 90px rgba(0,0,0,.55), 0 0 0 3px rgba(20,231,216,.35)">
    <div style="width:100%; height:100%; border-radius:36px; overflow:hidden; background:url(${captura}) top center/cover"></div>
  </div>
  <div style="position:absolute; left:80px; width:${alto916 ? 450 : 500}px; top:${alto916 ? 840 : 560}px; display:flex; flex-direction:column; align-items:flex-start; gap:18px">
    <div class="titular" style="font-size:${alto916 ? 64 : 70}px; line-height:1.05; color:var(--amarillo)">GRATIS Y SIN LÍMITE</div>
    <div style="font-size:${alto916 ? 38 : 36}px; font-weight:800">hasta el 31 de diciembre</div>
    <div style="font-size:30px; font-weight:700; color:var(--gris)">Sin tarjeta · solo registrarte</div>
    <div style="margin-top:22px; font-size:${alto916 ? 28 : 30}px; font-weight:800">flotadsp.com/repartidores</div>
  </div>
</div>`
}

/* «INVITA Y GANA» (10-10-2026): la app gratis y, además, 5 € por cada compañero que la use. */
const invita = (alto) => {
  const alto916 = alto > 1500
  return `
<div class="lienzo" style="height:${alto}px; background:radial-gradient(900px 700px at 15% 0%, rgba(255,212,59,.18), transparent 60%), radial-gradient(800px 600px at 100% 100%, rgba(20,231,216,.18), transparent 60%), var(--noche)">
  <div style="position:absolute; left:80px; right:${alto916 ? 150 : 80}px; top:${alto916 ? 210 : 80}px">
    <span class="pildora" style="background:var(--amarillo); color:#111; font-size:28px; padding:12px 26px">Para repartidores</span>
    <h1 class="titular" style="margin-top:30px; font-size:${alto916 ? 104 : 96}px">Gana <span style="color:var(--amarillo)">2,50&nbsp;€</span> por cada compañero</h1>
    <p style="margin-top:24px; font-size:${alto916 ? 42 : 38}px; line-height:1.3; font-weight:700; color:var(--gris)">Pásale la app de rutas. Cuando la use, te llevas 2,50&nbsp;€. Lo cobras por Bizum.</p>
  </div>
  <div style="position:absolute; left:80px; right:${alto916 ? 150 : 80}px; top:${alto916 ? 900 : 660}px; display:grid; grid-template-columns:repeat(3, 1fr); gap:20px">
    ${[['1', 'Le pasas tu enlace'], ['2', 'Hace sus repartos con la app'], ['3', 'Cobras 2,50&nbsp;€ por Bizum']].map(([n, t]) => `
      <div style="border-radius:28px; padding:26px 22px; background:rgba(255,255,255,.06); border:2px solid rgba(20,231,216,.3)">
        <div class="titular" style="font-size:64px; color:var(--marca)">${n}</div>
        <div style="margin-top:10px; font-size:${alto916 ? 32 : 30}px; font-weight:800; line-height:1.2">${t}</div>
      </div>`).join('')}
  </div>
  <div style="position:absolute; left:80px; right:${alto916 ? 150 : 80}px; top:${alto916 ? 1240 : 1020}px; display:flex; flex-direction:column; align-items:flex-start; gap:16px">
    <span class="pildora" style="background:var(--marca); color:#04121a; font-size:30px; letter-spacing:.5px; text-transform:none; padding:14px 26px">La app: gratis y sin límite hasta el 31 de diciembre</span>
    <div style="font-size:${alto916 ? 30 : 28}px; font-weight:800">flotadsp.com/repartidores</div>
    <div style="font-size:22px; font-weight:600; color:var(--gris)">Cuenta cuando tu compañero hace 20 entregas en 2 días distintos. Se cobra desde 10&nbsp;€. Condiciones en la web.</div>
  </div>
</div>`
}

/* «PROMO DE LANZAMIENTO» (10-10-2026): la app se está creando con los repartidores y a los
   primeros se les premia: gratis y sin límite hasta el 31-12 y 5 € por cada compañero que la use. */
const lanzamiento = (alto) => {
  const alto916 = alto > 1500
  const dcha = alto916 ? 150 : 80
  return `
<div class="lienzo" style="height:${alto}px; background:radial-gradient(900px 700px at 85% 0%, rgba(20,231,216,.20), transparent 60%), radial-gradient(800px 600px at 0% 100%, rgba(255,212,59,.14), transparent 60%), var(--noche)">
  <div style="position:absolute; left:80px; right:${dcha}px; top:${alto916 ? 200 : 70}px">
    <span class="pildora" style="background:var(--amarillo); color:#111; font-size:28px; padding:12px 26px">Promo de lanzamiento</span>
    <h1 class="titular" style="margin-top:28px; font-size:${alto916 ? 92 : 84}px">Estamos creando la app que te <span style="color:var(--marca)">facilita el reparto</span></h1>
    <p style="margin-top:22px; font-size:${alto916 ? 40 : 36}px; line-height:1.3; font-weight:700; color:var(--gris)">Y queremos premiar a los primeros que la usen.</p>
  </div>
  <div style="position:absolute; left:80px; right:${dcha}px; top:${alto916 ? 860 : 600}px; display:flex; flex-direction:column; gap:22px">
    ${[['✅', 'Gratis y sin límite', 'hasta el 31 de diciembre · sin tarjeta'], ['💶', 'Gana 2,50&nbsp;€ por cada compañero', 'que la use · lo cobras por Bizum']].map(([i, t, s]) => `
      <div style="display:flex; gap:24px; align-items:center; border-radius:30px; padding:${alto916 ? 30 : 24}px 30px; background:rgba(255,255,255,.06); border:2px solid rgba(20,231,216,.3)">
        <div style="font-size:${alto916 ? 76 : 64}px">${i}</div>
        <div><div class="titular" style="font-size:${alto916 ? 54 : 48}px">${t}</div>
        <div style="margin-top:8px; font-size:${alto916 ? 32 : 30}px; font-weight:700; color:var(--gris)">${s}</div></div>
      </div>`).join('')}
  </div>
  <div style="position:absolute; left:80px; right:${dcha}px; top:${alto916 ? 1300 : 1060}px; display:flex; flex-direction:column; align-items:flex-start; gap:14px">
    <div style="font-size:${alto916 ? 34 : 32}px; font-weight:800">📸 Foto a la etiqueta · 🗺️ ruta ordenada · 🗣️ guía con voz</div>
    <div style="font-size:${alto916 ? 34 : 32}px; font-weight:800; color:var(--marca)">flotadsp.com/repartidores</div>
    <div style="font-size:22px; font-weight:600; color:var(--gris)">Los 2,50&nbsp;€ cuentan cuando tu compañero hace 20 entregas en 2 días distintos. Cobro desde 10&nbsp;€. Condiciones en la web.</div>
  </div>
</div>`
}

const PIEZAS = [['lanzamiento-9x16', lanzamiento(1920)], ['lanzamiento-4x5', lanzamiento(1350), 1350],['1-portada', portada('Desliza ➜')], ['1-portada-video', portada('Los 5, en 20 segundos')], ...TRUCOS.map((t, i) => [`${i + 2}-truco-${i + 1}`, truco(t, i)]), ['7-la-app', cierre], ['imagen-suelta', suelta], ['promo-9x16', promo(1920)], ['promo-4x5', promo(1350), 1350], ['invita-9x16', invita(1920)], ['invita-4x5', invita(1350), 1350]]

const nav = await chromium.launch()
const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
for (const [nombre, html, alto = 1920] of PIEZAS) {
  await pag.setViewportSize({ width: 1080, height: alto })
  await pag.setContent(`<!doctype html><html><head><meta charset="utf-8">${BASE}<style>body{height:${alto}px}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' })
  await pag.evaluate(() => document.fonts.ready)
  const destino = path.join(SALIDA, `${nombre}.png`)
  await pag.screenshot({ path: destino })
  console.log('→', path.relative(RAIZ, destino))
}
await nav.close()
