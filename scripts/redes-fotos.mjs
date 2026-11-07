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

/* ── D. Cómo cargar la furgoneta para no volverte loco (30-10) ───────────────────────── */
const CARGA = [
  ['📋', 'Ordena antes de cargar', 'Primero el orden de la ruta, luego la furgoneta. Cargar y ordenar después es hacerlo dos veces.'],
  ['🔄', 'Al revés', 'Lo último que entregas, al fondo. Lo de la primera hora, a mano de la puerta.'],
  ['🧱', 'Por tramos, no por tamaño', 'Un hueco o una balda por cada diez paradas. El paquete grande no va abajo por ser grande.'],
  ['✍️', 'Apunta el hueco', 'Una letra en la etiqueta o en la app: dónde va cada bulto. 150 paquetes sin hueco son 150 búsquedas.'],
  ['🔍', 'Lo frágil y lo urgente, a la vista', 'Franjas horarias y cristal, donde los veas nada más abrir la puerta.'],
]
const D = [
  ['D-1-portada', portada(fondoInterior, 'Antes de arrancar', 'Cómo cargar la furgoneta para <span class="resalta">no volverte loco</span>', 'Cinco reglas que ahorran una hora al día')],
  ...CARGA.map((p, i) => [`D-${i + 2}`, punto(p, i, 'Guárdalo para mañana')]),
  ['D-7-cierre', cierre('¿Y el orden? <span style="color:var(--marca)">Lo pone la app</span>', 'Foto a la etiqueta, la ruta se ordena por tiempo y cada bulto tiene su zona de carga.')],
]

/* ── Tarjetas para X de la segunda semana (08-11 en adelante) ─────────────────────────── */
const X2 = [
  ['X-latam', tarjeta('Repartidores de Latinoamérica', 'Funciona en cualquier país. «Mi dinero hoy», en tu moneda', [['🇲🇽', 'Pesos, soles, pesos colombianos o reales: lo que llevas ganado hoy, en lo tuyo.'], ['🇧🇷', 'En Brasil, Pix. Paradas de ejemplo en tu ciudad para probarla sin cuenta.'], ['💬', 'Si algo no funciona en tu zona, dilo y lo arreglamos.']], 'Gratis y sin límite hasta el 31 de diciembre')],
  ['X-sin-cobertura', tarjeta('Garaje del polígono, sin cobertura', 'La app abre igual. Con tu ruta guardada', [['📴', 'Sin red, abre con la última ruta y sigues entregando.'], ['📤', 'Lo entregado se envía solo cuando vuelve la cobertura.'], ['⏱️', 'Detalle pequeño, mañanas enteras salvadas.']], 'Android e iPhone')],
  ['X-invita', tarjeta('Invita y gana', '10 € por cada compañero que la use de verdad', [['1', 'Le pasas tu enlace desde la app.'], ['2', 'Hace su primera ruta real: 20 entregas en 2 días.'], ['3', 'Tú, 10 € a tu cartera (Bizum o PayPal). Él, 25 € de bienvenida.']], 'Promoción hasta el 31 de diciembre · condiciones en flotadsp.com/invita')],
]

/* ── E. Mensajes que puedes mandar al cliente antes de llegar (03-11) ───────────────────── */
const MENSAJES = [
  ['🕘', 'Antes de llegar', '«Hola, soy el repartidor de tu paquete. Llego en unos 10 minutos. ¿Estás en casa?»'],
  ['🚪', 'En el portal', '«Estoy en tu portal. ¿Me abres, o lo dejo con el conserje o con un vecino?»'],
  ['💶', 'Si hay que cobrar', '«Son 23,40 € al entregar. ¿Efectivo, tarjeta o Bizum?» Dicho antes, nadie va a buscar la cartera con la puerta abierta.'],
  ['📍', 'Si no está', '«No te he encontrado. Lo he dejado en conserjería, te mando la foto.» Te ahorras la llamada de «¿dónde está mi paquete?».'],
  ['✅', 'Al entregar', '«Entregado en tu buzón. ¡Buen día!» Corto. Si lo dejas en un sitio, dilo siempre.'],
]
const E = [
  ['E-1-portada', portada(fondoFurgoneta, 'Cópialos', 'Mensajes para el cliente <span class="resalta">antes de llegar</span>', 'Cinco que te ahorran subir para nada')],
  ...MENSAJES.map((p, i) => [`E-${i + 2}`, punto(p, i, 'Cópialos y guárdalos')]),
  ['E-7-cierre', cierre('¿Y escribirlos cada vez? <span style="color:var(--marca)">Un toque</span>', 'En FDS cada parada tiene su botón de WhatsApp con el mensaje ya escrito.')],
]

/* ── F. Antes de firmar con una agencia de reparto (03-11) ───────────────────────────────── */
const AGENCIA = [
  ['💶', 'Cómo te pagan', 'Por parada, por paquete o por día. Y qué pasa con los ausentes y las devoluciones: ¿se cobran o no?'],
  ['🚐', 'Quién pone qué', 'Furgoneta, seguro, gasóleo, móvil. Cada cosa que pones tú se resta de lo que ganas.'],
  ['📦', 'Paradas de verdad', 'Cuántas salen un día normal en tu zona, no las del anuncio. Y cuántos kilómetros hay entre ellas.'],
  ['📅', 'Cuándo pagan', 'A 30, 60 o 90 días cambia mucho tu mes. Y si hay penalizaciones, por qué y cuánto.'],
  ['🧮', 'Haz la cuenta antes', 'Lo que facturas menos gasóleo, cuota y gastos fijos, dividido por tus horas. Ese es tu sueldo.'],
]
const F = [
  ['F-1-portada', portada(fondoLibreta, 'Autónomos del reparto', 'Antes de firmar con <span class="resalta">una agencia</span> de reparto', 'Cinco preguntas que conviene hacer')],
  ...AGENCIA.map((p, i) => [`F-${i + 2}`, punto(p, i, 'Guárdalo antes de firmar')]),
  ['F-7-cierre', cierre('Haz la cuenta con <span style="color:var(--marca)">tus números</span>', 'Calculadora gratis y sin registro: lo que te queda de verdad por hora.', 'flotadsp.com/calculadora-repartidor', 'Calculadora gratis · sin registro')],
]

/* ── G. Black Friday y Navidad: cómo sobrevivir al pico de paquetes (03-11) ────────────────── */
const PICO = [
  ['📈', 'Cuenta con el doble', 'De Black Friday a Reyes salen muchas más paradas. Planifica la semana como si fueran el doble.'],
  ['🌙', 'Ordena la noche antes', 'Si te pasan la lista la víspera, deja la ruta hecha. Por la mañana solo cargas y sales.'],
  ['📦', 'Carga por tramos', 'Un hueco por cada diez paradas. Con el doble de bultos, el orden de carga lo es todo.'],
  ['🔋', 'Batería y cobertura', 'Más horas de móvil y menos de luz: cargador en la furgoneta y la ruta guardada por si te quedas sin red.'],
  ['🥪', 'Para cinco minutos', 'Comer algo y beber agua no es perder tiempo: es lo que te deja acabar la semana entero.'],
]
const G = [
  ['G-1-portada', portada(fondoInterior, 'Se acerca el pico', 'Black Friday y Navidad: <span class="resalta">cómo sobrevivir</span>', 'Cinco reglas para no acabar reventado')],
  ...PICO.map((p, i) => [`G-${i + 2}`, punto(p, i, 'Guárdalo para el pico')]),
  ['G-7-cierre', cierre('¿El doble? <span style="color:var(--marca)">Que ordene la app</span>', 'Con el pico de paquetes, foto a la etiqueta y la ruta se ordena sola, también la noche antes.')],
]

/* ── H. Lo que no puede faltar en la furgoneta (07-11) ───────────────────────────────────── */
const KIT = [
  ['🔋', 'Cargador y batería externa', 'El móvil es tu ruta. Cable de repuesto y una batería cargada: si se apaga el móvil, se apaga el día.'],
  ['🛒', 'Carretilla plegable', 'Para los bultos pesados y los portales sin ascensor. Ocupa poco y tu espalda lo nota.'],
  ['✂️', 'Cúter, cinta y rotulador', 'Cajas que se abren, etiquetas que se despegan y huecos que marcar. Caben en la puerta.'],
  ['🔦', 'Linterna frontal', 'En invierno anochece pronto: números de portal, garajes y buzones a oscuras. Con las manos libres.'],
  ['🧤', 'Guantes y chubasquero', 'El frío y la lluvia no avisan. Y el chaleco reflectante, siempre a mano.'],
]
const H = [
  ['H-1-portada', portada(fondoFurgoneta, 'Revisa la tuya', 'Lo que no puede faltar en <span class="resalta">la furgoneta</span>', 'Cinco cosas que salvan el día')],
  ...KIT.map((p, i) => [`H-${i + 2}`, punto(p, i, 'Guárdalo y revisa la tuya')]),
  ['H-7-cierre', cierre('¿Y la ruta? <span style="color:var(--marca)">En el móvil</span>', 'Foto a la etiqueta y la ruta se ordena sola. Sin cobertura, sigue abierta.')],
]

/* ── I. Errores del primer mes repartiendo (07-11) ───────────────────────────────────────── */
const ERRORES = [
  ['🗺️', 'Salir sin ordenar la ruta', 'Ir por donde te parece cuesta vueltas y kilómetros. Diez minutos de orden por la mañana se notan por la tarde.'],
  ['🪫', 'Fiarse de la batería', 'Navegador, fotos y llamadas todo el día. A mediodía ya vas justo: cargador en la furgoneta desde el primer día.'],
  ['💶', 'No apuntar los cobros', 'Efectivo aquí, Bizum allá… y al cerrar no cuadra. Apunta cada cobro en el momento, no al final.'],
  ['📸', 'Dejarlo sin foto', 'Buzón, conserje, vecino. Sin foto, el «no me ha llegado» es tu palabra contra la suya.'],
  ['🙋', 'No preguntar', 'Al que lleva años en la zona: dónde aparcar, qué portal tiene truco, a qué hora cierra cada tienda.'],
]
const I = [
  ['I-1-portada', portada(fondoLibreta, 'Si estás empezando', 'Errores del <span class="resalta">primer mes</span> repartiendo', 'Cinco que todos hemos cometido')],
  ...ERRORES.map((p, i) => [`I-${i + 2}`, punto(p, i, 'Pásaselo al que empieza')]),
  ['I-7-cierre', cierre('Tres, <span style="color:var(--marca)">resueltos</span>', 'La ruta, con una foto a la etiqueta. Cobros y entregas, apuntados con foto.')],
]

/* ── J. Cuida la espalda repartiendo (07-11) ─────────────────────────────────────────────── */
const ESPALDA = [
  ['🦵', 'Dobla las rodillas', 'Agáchate con las piernas, no con la espalda. El bulto sube con las piernas.'],
  ['🤲', 'Pegado al cuerpo', 'Cuanto más lejos llevas el peso, más carga la espalda. Abrázalo.'],
  ['🔄', 'Gira con los pies', 'Con peso en las manos, no tuerzas la cintura: mueve los pies.'],
  ['🚐', 'Baja sin saltar', 'Saltar de la cabina en cada parada lo pagan rodillas y tobillos. Escalón y asidero.'],
  ['🧘', 'Estira un minuto', 'Entre paradas largas: espalda, cuello y piernas. Se nota al final de la semana.'],
]
const J = [
  ['J-1-portada', portada(fondoInterior, 'Tu herramienta eres tú', 'Cuida la <span class="resalta">espalda</span> repartiendo', 'Cinco gestos que se notan el viernes')],
  ...ESPALDA.map((p, i) => [`J-${i + 2}`, punto(p, i, 'Guárdalo para mañana')]),
  ['J-7-cierre', cierre('¿Y las vueltas de más? <span style="color:var(--marca)">Fuera</span>', 'Ruta ordenada por tiempo con una foto a la etiqueta.')],
]

// SOLO=E,F genera solo las piezas que empiezan así (las ya publicadas no se tocan). Cada carrusel sale también en
// JPEG (TikTok no admite PNG en los posts de fotos: «use image/jpeg», 31-10-2026).
const SOLO = (process.env.SOLO || '').split(',').map((x) => x.trim()).filter(Boolean)
const PIEZAS = [...A, ...B, ...C, ...D, ...E, ...F, ...G, ...H, ...I, ...J, ...X.map(([n, h]) => [n, h, 1600, 900]), ...X2.map(([n, h]) => [n, h, 1600, 900])]
  .filter(([n]) => !SOLO.length || SOLO.some((p) => n.startsWith(p)))
// PW_CHROMIUM: ruta a un Chromium ya instalado si la versión de Playwright no trae el suyo (p. ej. /opt/pw-browsers/chromium).
const nav = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
for (const [nombre, html, ancho = 1080, alto = 1920] of PIEZAS) {
  await pag.setViewportSize({ width: ancho, height: alto })
  await pag.setContent(`<!doctype html><html><head><meta charset="utf-8">${BASE}<style>body{width:${ancho}px;height:${alto}px}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' })
  await pag.evaluate(() => document.fonts.ready)
  const destino = path.join(SALIDA, `${nombre}.png`)
  await pag.screenshot({ path: destino })
  if (ancho === 1080) await pag.screenshot({ path: destino.replace(/\.png$/, '.jpg'), type: 'jpeg', quality: 90 })
  console.log('→', path.relative(RAIZ, destino))
}
await nav.close()
