// PIEZAS PARA LAS REDES DE FDS (29-10-2026): contenido que no parece anuncio y que se guarda y se
// comparte. Tres carruseles para el modo foto de TikTok (valen para Instagram y la página de Facebook)
// y tarjetas 16:9 para X. La app solo sale en la última diapositiva, con quiénes somos.
//   cd frontend && node ../scripts/redes-fotos.mjs      → frontend/public/redes/*.png (URL pública: flotadsp.com/redes/<fichero>)
// Playwright: el de frontend/node_modules si está; si no, el instalado en el sistema (sesión en la nube).
// Fondos: docs/anuncios/redes/fondos/*.jpg (generados con Artlist, sin personas); si falta alguno, los de
// Pexels de tiktok-fotos/fondos. Zonas que tapa TikTok: arriba ~170 px, abajo ~420 px, derecha ~150 px.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
function cargaPlaywright() {
  for (const [desde, paquete] of [[path.join(RAIZ, 'frontend', 'package.json'), '@playwright/test'], [import.meta.url, 'playwright']]) {
    try { return createRequire(desde)(paquete) } catch { /* siguiente */ }
  }
  throw new Error('No encuentro Playwright: npm install en frontend/ o instálalo en el sistema')
}
const { chromium } = cargaPlaywright()

const SALIDA = path.join(RAIZ, 'frontend', 'public', 'redes')   // se sirve en flotadsp.com/redes/ para que Metricool pueda cogerlas
const FONDOS = path.join(RAIZ, 'docs', 'anuncios', 'redes', 'fondos')
fs.mkdirSync(SALIDA, { recursive: true })
const b64 = (f, tipo) => `data:${tipo};base64,${fs.readFileSync(f).toString('base64')}`
const fondo = (nombre, alternativa) => {
  const propio = path.join(FONDOS, nombre)
  if (fs.existsSync(propio)) return b64(propio, 'image/jpeg')
  return b64(path.join(RAIZ, 'docs', 'anuncios', 'tiktok-fotos', 'fondos', alternativa), 'image/jpeg')
}
const fondoFurgoneta = fondo('furgoneta-amanecer.jpg', 'cargando.jpg')
const fondoInterior = fondo('interior-paquetes.jpg', 'cargando.jpg')
const fondoLibreta = fondo('libreta-salpicadero.jpg', 'apuntando.jpg')
const captura = b64(path.join(RAIZ, 'frontend', 'public', 'capturas-ruta', 'es', '1-ruta.png'), 'image/png')
const OFERTA = 'Gratis y sin límite hasta el 31 de diciembre'   // lib/precios.js; al acabar la promo, cambiarlo

const BASE = `
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  :root { --noche:#05141a; --marca:#14e7d8; --amarillo:#ffd43b; --blanco:#f4fbfb; --gris:#a9c2c6; --rojo:#ff6b6b }
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:Inter, Arial, sans-serif; color:var(--blanco); background:var(--noche); overflow:hidden }
  .lienzo { position:relative; width:1080px; height:1920px; overflow:hidden }
  .ancho { position:relative; width:1600px; height:900px; overflow:hidden }
  .titular { font-family:'Archivo Black', 'Arial Black', sans-serif; letter-spacing:-1.5px; line-height:1.08 }
  .pildora { display:inline-block; font-weight:800; letter-spacing:4px; text-transform:uppercase; border-radius:999px }
  .resalta { background:var(--amarillo); color:#111; padding:0 14px; border-radius:14px; box-decoration-break:clone; -webkit-box-decoration-break:clone }
  .pie { position:absolute; left:80px; top:1420px; font-size:30px; font-weight:700; color:var(--gris) }
  .pie b { color:var(--marca) }
  .velo { position:absolute; inset:0; background:linear-gradient(180deg, rgba(5,20,26,.5) 0%, rgba(5,20,26,.3) 35%, rgba(5,20,26,.92) 68%, rgba(5,20,26,.98) 100%) }
</style>`

/* Portada de carrusel: foto de fondo, titular grande, «desliza». */
const portada = (fondoImg, etiqueta, titular, sub) => `
<div class="lienzo" style="background:url(${fondoImg}) center/cover">
  <div class="velo"></div>
  <div style="position:absolute; left:80px; right:150px; bottom:440px; display:flex; flex-direction:column; align-items:flex-start; gap:34px">
    <span class="pildora" style="background:var(--marca); color:#04121a; font-size:30px; padding:14px 28px">${etiqueta}</span>
    <h1 class="titular" style="font-size:104px; line-height:1.15">${titular}</h1>
    <p style="font-size:44px; font-weight:700; color:var(--gris)">${sub}</p>
    <span class="pildora" style="border:3px solid var(--blanco); font-size:30px; padding:14px 30px">Desliza ➜</span>
  </div>
</div>`

/* Diapositiva numerada (consejo). */
const punto = ([icono, titulo, texto], i, pie) => `
<div class="lienzo" style="background:radial-gradient(900px 700px at 85% 10%, rgba(20,231,216,.18), transparent 60%), var(--noche)">
  <svg style="position:absolute; inset:0" width="1080" height="1920" viewBox="0 0 1080 1920">
    <path d="M -40 1700 C 220 1500, 380 1620, 560 1400 S 900 1180, 1120 1260" fill="none" stroke="rgba(20,231,216,.22)" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round"/>
  </svg>
  <div style="position:absolute; left:80px; right:150px; top:300px">
    <div class="titular" style="font-size:300px; line-height:1; color:transparent; -webkit-text-stroke:6px var(--marca)">${i + 1}</div>
    <div style="font-size:110px; margin-top:20px">${icono}</div>
    <h2 class="titular" style="margin-top:36px; font-size:90px">${titulo}</h2>
    <p style="margin-top:40px; font-size:50px; line-height:1.3; font-weight:500; color:var(--gris)">${texto}</p>
  </div>
  <p class="pie">${pie} · <b>FDS</b></p>
</div>`

/* Cierre: la app, quiénes somos y la oferta. */
const cierre = (titular, sub, enlace = 'flotadsp.com/repartidores', oferta = OFERTA) => `
<div class="lienzo" style="background:linear-gradient(160deg, #0b3b3d 0%, var(--noche) 55%)">
  <div style="position:absolute; left:80px; right:150px; top:190px">
    <h2 class="titular" style="font-size:96px">${titular}</h2>
    <p style="margin-top:28px; font-size:42px; line-height:1.3; font-weight:700; color:var(--gris)">${sub}</p>
  </div>
  <div style="position:absolute; left:230px; top:600px; width:470px; height:680px; border-radius:52px; padding:14px; background:#0d1b20; box-shadow:0 40px 90px rgba(0,0,0,.55), 0 0 0 3px rgba(20,231,216,.35)">
    <div style="width:100%; height:100%; border-radius:42px; overflow:hidden; background:url(${captura}) top center/cover"></div>
  </div>
  <div style="position:absolute; left:80px; right:150px; top:1320px; display:flex; flex-direction:column; align-items:flex-start; gap:20px">
    <span class="pildora" style="background:var(--amarillo); color:#111; font-size:30px; letter-spacing:0.5px; text-transform:none; padding:16px 26px">${oferta}</span>
    <p style="font-size:34px; font-weight:800">${enlace} <span style="color:var(--gris); font-weight:700">· enlace en el perfil</span></p>
    <p style="font-size:26px; font-weight:600; color:var(--gris)">La hicimos nosotros, un equipo pequeño de España. Dinos qué le falta.</p>
  </div>
</div>`

/* ── A. Lo que nadie te cuenta del primer día repartiendo ─────────────────────────────── */
const PRIMER_DIA = [
  ['📦', 'El orden de carga importa más que el de la ruta', 'Si cargas a lo loco, cada parada son tres minutos buscando. Carga al revés: lo último, al fondo.'],
  ['🗺️', 'No te sepas la zona. Sábete el orden', 'La zona se aprende en dos semanas. El orden de hoy lo decides tú antes de arrancar.'],
  ['🕑', 'El que no abre a las 9 abre a las 14', 'Quien no está por la mañana suele estar por la tarde. Apunta quién y vuelve una vez, no tres.'],
  ['🚶', 'Aparca una vez para tres entregas', 'Tres paradas en la misma manzana: un sitio para aparcar y el resto andando. Ahorra más que cualquier atajo.'],
  ['📆', 'La primera semana es la peor', 'Todo el mundo tarda el doble al empezar. En la segunda ya no. No te midas con el veterano.'],
]
const A = [
  ['A-1-portada', portada(fondoInterior, 'Si empiezas a repartir', 'Lo que <span class="resalta">nadie te cuenta</span> del primer día', 'Cinco cosas que se aprenden a golpes')],
  ...PRIMER_DIA.map((p, i) => [`A-${i + 2}`, punto(p, i, 'Guárdalo para tu primer día')]),
  ['A-7-cierre', cierre('¿Y la ruta? Que la ordene <span style="color:var(--marca)">la app</span>', 'Foto a la etiqueta, las paradas se ordenan por tiempo y te lleva con voz hasta cada puerta.')],
]

/* ── B. Siete frases que todo repartidor ha oído ──────────────────────────────────────── */
const FRASES = [
  ['«¿Me lo subes? Es que estoy en pijama.»', 'Quinto. Sin ascensor. 18 kilos.'],
  ['«No he oído el timbre.»', 'Estás delante de la puerta. Con el dedo en el timbre.'],
  ['«¿Puedes volver a las siete?»', 'A las siete estás a 30 km, con 40 paradas más.'],
  ['«Déjalo en el buzón.»', 'El paquete es una televisión de 55 pulgadas.'],
  ['«¿Y el otro paquete?»', '¿Qué otro paquete?'],
  ['«Estaba en casa, no has llamado.»', 'Tres llamadas. Dos timbrazos. Un mensaje.'],
  ['«¿Trabajáis también los sábados?»', 'Se lo entregas. Un sábado.'],
]
const frase = ([cita, reaccion], i) => `
<div class="lienzo" style="background:radial-gradient(800px 600px at ${i % 2 ? 90 : 10}% 15%, rgba(255,212,59,.16), transparent 60%), var(--noche)">
  <div style="position:absolute; left:80px; right:150px; top:330px">
    <div class="titular" style="font-size:220px; line-height:.8; color:var(--amarillo); opacity:.9">“</div>
    <div style="margin-top:-30px; border-radius:40px; padding:46px 48px; background:rgba(255,255,255,.07); border:2px solid rgba(255,212,59,.35)">
      <h2 class="titular" style="font-size:78px; line-height:1.15">${cita}</h2>
    </div>
    <div style="margin-top:70px; display:flex; gap:26px; align-items:flex-start">
      <div style="font-size:84px; line-height:1">😮‍💨</div>
      <p style="font-size:50px; line-height:1.3; font-weight:700; color:var(--gris); padding-top:14px">${reaccion}</p>
    </div>
  </div>
  <div class="titular" style="position:absolute; right:170px; top:1300px; font-size:120px; color:transparent; -webkit-text-stroke:5px rgba(20,231,216,.6)">${i + 1}/7</div>
  <p class="pie">Etiqueta a quien le pasa · <b>FDS</b></p>
</div>`
const B = [
  ['B-1-portada', portada(fondoFurgoneta, 'Humor de furgoneta', '7 frases que <span class="resalta">todo repartidor</span> ha oído', 'La 4 duele')],
  ...FRASES.map((f, i) => [`B-${i + 2}`, frase(f, i)]),
  ['B-9-cierre', cierre('Eso no lo arreglamos. <span style="color:var(--marca)">La ruta, sí</span>', 'Foto a la etiqueta y las paradas se ordenan solas. Lo del pijama sigue siendo cosa tuya.')],
]

/* ── C. ¿Cuánto gana de verdad un repartidor autónomo? (los números por defecto de la calculadora) ── */
const CUENTAS = [
  ['🧾', 'Lo que facturas', [['100 paradas al día', '× 1,10 € la parada'], ['22 días al mes', '= <b>2.420 €</b> facturados']]],
  ['⛽', 'Lo que se va', [['120 km al día × 0,15 €/km × 22 días', '= 396 € de gasóleo y desgaste'], ['Cuota, seguro, furgoneta, gestoría', '= 600 € fijos al mes'], ['Total', '= <b>996 €</b>']]],
  ['💶', 'Lo que te queda', [['2.420 − 996', '= <b>1.424 € al mes</b> antes de impuestos'], ['9 horas × 22 días = 198 h', '= <b>7,19 € la hora</b>'], ['IRPF e IVA', 'van aparte']]],
  ['📈', 'Diez paradas más al día', [['+10 × 1,10 € × 22 días', '= <b>+242 € al mes</b>'], ['Mismas horas, misma furgoneta', 'Es lo que da ordenar bien la ruta']]],
]
const cuenta = ([icono, titulo, filas], i) => `
<div class="lienzo" style="background:radial-gradient(900px 700px at 85% 10%, rgba(20,231,216,.16), transparent 60%), var(--noche)">
  <div style="position:absolute; left:80px; right:150px; top:300px">
    <div style="display:flex; align-items:center; gap:28px">
      <div class="titular" style="font-size:170px; line-height:1; color:transparent; -webkit-text-stroke:5px var(--marca)">${i + 1}</div>
      <div style="font-size:96px">${icono}</div>
    </div>
    <h2 class="titular" style="margin-top:30px; font-size:88px">${titulo}</h2>
    <div style="margin-top:50px; display:flex; flex-direction:column; gap:22px">
      ${filas.map(([a, b]) => `<div style="border-radius:28px; padding:28px 32px; background:rgba(255,255,255,.06); border:2px solid rgba(20,231,216,.25)">
        <div style="font-size:36px; font-weight:700; color:var(--gris)">${a}</div>
        <div style="margin-top:8px; font-size:46px; font-weight:800; line-height:1.2">${b}</div></div>`).join('')}
    </div>
  </div>
  <p class="pie">Ejemplo orientativo: pon tus números · <b>FDS</b></p>
</div>`
const C = [
  ['C-1-portada', portada(fondoLibreta, 'Autónomos del reparto', '¿Cuánto gana <span class="resalta">de verdad</span> un repartidor autónomo?', 'Un ejemplo con números corrientes, sin humo')],
  ...CUENTAS.map((c, i) => [`C-${i + 2}`, cuenta(c, i)]),
  ['C-6-cierre', cierre('Haz la cuenta con <span style="color:var(--marca)">tus números</span>', 'Calculadora gratis y sin registro. Y la app que te ayuda a hacer más paradas en las mismas horas.', 'flotadsp.com/calculadora-repartidor', 'Calculadora gratis · sin registro')],
]

/* ── Tarjetas 16:9 para X ─────────────────────────────────────────────────────────────── */
const tarjeta = (etiqueta, titular, lineas, pie) => `
<div class="ancho" style="background:radial-gradient(900px 600px at 90% 0%, rgba(20,231,216,.2), transparent 60%), var(--noche)">
  <div style="position:absolute; left:90px; right:90px; top:80px">
    <span class="pildora" style="background:var(--marca); color:#04121a; font-size:24px; padding:10px 22px">${etiqueta}</span>
    <h1 class="titular" style="margin-top:26px; font-size:70px">${titular}</h1>
    <div style="margin-top:40px; display:flex; flex-direction:column; gap:18px">
      ${lineas.map(([n, t]) => `<div style="display:flex; gap:22px; align-items:baseline"><div class="titular" style="font-size:44px; color:var(--amarillo); min-width:56px">${n}</div><div style="font-size:36px; font-weight:700; line-height:1.25">${t}</div></div>`).join('')}
    </div>
  </div>
  <div style="position:absolute; left:90px; right:90px; bottom:60px; display:flex; justify-content:space-between; align-items:center; font-size:26px; font-weight:700; color:var(--gris)">
    <span>${pie}</span><span style="color:var(--marca); font-weight:800">FDS · flotadsp.com/repartidores</span>
  </div>
</div>`
const X = [
  ['X-primer-dia', tarjeta('Si empiezas a repartir', 'Lo que nadie te cuenta del primer día', [['1', 'El orden de carga importa más que el de la ruta.'], ['2', 'El que no abre a las 9 abre a las 14.'], ['3', 'Aparca una vez para tres entregas.']], '¿Cuál añadirías?')],
  ['X-truco', tarjeta('Nos lo preguntan', '«¿Y dónde está el truco de que sea gratis?»', [['—', 'Hasta el 31 de diciembre: gratis y sin límite, sin tarjeta.'], ['—', 'Después: gratis para siempre hasta 15 paradas al día.'], ['—', 'Quien reparte 100 al día paga 9,99 € al mes. Lo decimos ya.']], 'Somos un equipo pequeño y la app es nuestra')],
  ['X-manos-libres', tarjeta('Android', '«Entregado». «Siguiente». «Llamar». Sin soltar el volante', [['🎙️', 'La app te escucha mientras conduces y pasa a la siguiente parada.'], ['🚫', 'Mirar el móvil en marcha es multa y es peligroso. Por eso lo hicimos.']], 'Manos libres en la app de Android')],
  ['X-cuanto-gana', tarjeta('Autónomos del reparto', '¿Cuánto gana de verdad un repartidor autónomo?', [['2.420 €', '100 paradas × 1,10 € × 22 días facturados'], ['− 996 €', 'gasóleo, desgaste y gastos fijos'], ['1.424 €', 'al mes antes de impuestos: 7,19 € la hora']], 'Ejemplo orientativo · calculadora gratis: flotadsp.com/calculadora-repartidor')],
]

const PIEZAS = [...A, ...B, ...C, ...X.map(([n, h]) => [n, h, 1600, 900])]
const nav = await chromium.launch()
const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
for (const [nombre, html, ancho = 1080, alto = 1920] of PIEZAS) {
  await pag.setViewportSize({ width: ancho, height: alto })
  await pag.setContent(`<!doctype html><html><head><meta charset="utf-8">${BASE}<style>body{width:${ancho}px;height:${alto}px}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' })
  await pag.evaluate(() => document.fonts.ready)
  const destino = path.join(SALIDA, `${nombre}.png`)
  await pag.screenshot({ path: destino })
  console.log('→', path.relative(RAIZ, destino))
}
await nav.close()
