/* GUÍA «CÓMO ORDENAR TU RUTA DE REPARTO» (11-10-2026). Página para Google en español neutro (sirve en España
 * y en Latinoamérica): consejos de verdad para repartidores y, al final, la app. HTML completo desde aquí
 * (sin esperar al JavaScript) para que el buscador la lea entera. Versión de Brasil: guia-rota-de-entregas.js.
 * La oferta «sin límite» solo sale mientras dura (PROMO_HASTA, la misma fecha que src/lib/precios.js). */
const BASE = 'https://flotadsp.com'
const RUTA = '/guia-ruta-de-reparto'
const PROMO_HASTA = '2026-12-31'
const TITULO = 'Cómo ordenar tu ruta de reparto de paquetes: guía práctica'
const DESCRIPCION = 'Cómo agrupar las paradas, cargar los paquetes, cuadrar los horarios y no perder tiempo en la ruta de reparto. Consejos de repartidor y una app gratis que la ordena sola.'

const PREGUNTAS = [
  ['¿En qué orden cargo los paquetes?',
    'Al revés de como los vas a entregar: lo último de la ruta, al fondo; lo primero, a mano. Si separas por tramos (bolsas o cajas por zona), cada parada te cuesta segundos en vez de minutos.'],
  ['¿Es mejor ordenar las paradas por distancia o por tiempo?',
    'Por tiempo. Dos paradas cerca en el mapa pueden estar lejos si hay que dar la vuelta por una calle de un solo sentido o cruzar una avenida en hora punta. Lo que cuenta es cuánto tardas en llegar a cada una.'],
  ['¿Qué hago con los paquetes que tienen horario?',
    'Ponlos dentro de su franja y ordena el resto alrededor. Si no vas a llegar a tiempo, avisa al cliente antes: es mejor que una entrega fallida.'],
  ['¿Qué hago si el cliente no está?',
    'Déjalo para el final de esa misma zona y sigue. Volver atrás a mitad de ruta es lo que más tiempo hace perder. Apunta qué pasó (foto, nota) por si te lo preguntan.'],
]

const enPromo = () => new Date().toISOString().slice(0, 10) <= PROMO_HASTA

function pagina() {
  const enlace = `/repartidores?utm_source=guia&utm_content=guia_es`
  const oferta = enPromo()
    ? 'Gratis y sin límite hasta el 31 de diciembre de 2026, sin tarjeta. Después, gratis hasta 15 paradas al día.'
    : 'Gratis hasta 15 paradas al día, sin tarjeta.'
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'es',
    mainEntity: PREGUNTAS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  const articulo = {
    '@context': 'https://schema.org', '@type': 'Article', headline: TITULO, description: DESCRIPCION, inLanguage: 'es',
    datePublished: '2026-10-11', dateModified: '2026-10-11', mainEntityOfPage: `${BASE}${RUTA}`,
    publisher: { '@type': 'Organization', name: 'FDS', url: BASE },
  }
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${TITULO}</title>
  <meta name="description" content="${DESCRIPCION}" />
  <link rel="canonical" href="${BASE}${RUTA}" />
  <link rel="alternate" hreflang="es" href="${BASE}${RUTA}" />
  <link rel="alternate" hreflang="pt-BR" href="${BASE}/guia-rota-de-entregas" />
  <link rel="icon" href="/favicon.svg" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${TITULO}" />
  <meta property="og:description" content="${DESCRIPCION}" />
  <meta property="og:url" content="${BASE}${RUTA}" />
  <meta property="og:image" content="${BASE}/og-repartidores.png?v=promo1231" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(articulo)}</script>
  <script type="application/ld+json">${JSON.stringify(faq)}</script>
  <style>
    :root { color-scheme: dark; --fondo:#05141a; --tarjeta:#0b2329; --marca:#14e7d8; --texto:#e6f2f3; --suave:#a9c2c6; --amarillo:#ffd43b }
    * { box-sizing: border-box }
    body { margin:0; background:var(--fondo); color:var(--texto); font:17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif }
    main { max-width: 720px; margin: 0 auto; padding: 28px 16px 64px }
    a { color: var(--marca) }
    .marca { display:flex; align-items:center; gap:10px; font-weight:800; color:var(--texto); text-decoration:none }
    .marca img { width:32px; height:32px }
    h1 { font-size: clamp(28px, 6vw, 40px); line-height:1.1; margin: 28px 0 12px }
    h2 { font-size: 22px; margin: 34px 0 8px; color: var(--marca) }
    .entradilla { color: var(--suave); font-size: 18px }
    ol li, ul li { margin: 6px 0 }
    .caja { background: var(--tarjeta); border: 1px solid #16414a; border-radius: 16px; padding: 20px; margin: 30px 0 }
    .boton { display:inline-block; margin-top:12px; background: var(--marca); color:#04121a; font-weight:800; text-decoration:none; padding: 14px 22px; border-radius: 14px }
    .oferta { color: var(--amarillo); font-weight: 700 }
    details { border-top: 1px solid #16414a; padding: 12px 0 }
    summary { cursor: pointer; font-weight: 700 }
    footer { margin-top: 40px; color: var(--suave); font-size: 14px }
  </style>
</head>
<body>
<main>
  <a class="marca" href="/repartidores?utm_source=guia&utm_content=guia_es_logo"><img src="/favicon.svg" alt="" />FDS</a>
  <h1>Cómo ordenar tu ruta de reparto de paquetes</h1>
  <p class="entradilla">Una guía práctica para repartidores y mensajeros: cómo agrupar las paradas, cargar los paquetes,
  cuadrar los horarios y terminar antes. Sirve con 20 paradas o con 150.</p>

  <h2>1. Antes de salir: mira todas las guías</h2>
  <p>Repasa las etiquetas antes de cargar. Separa tres montones: los que tienen <b>horario</b>, los que hay que
  <b>cobrar</b> y el resto. Si ves una dirección incompleta o rara, apúntala ahora: en la calle es tarde.</p>

  <h2>2. Agrupa por zonas, no por orden de llegada</h2>
  <p>Junta los paquetes por barrio, colonia o código postal. Cada zona es un tramo de la ruta. Así no cruzas la
  ciudad dos veces por el mismo sitio.</p>

  <h2>3. Ordena por tiempo, no solo por distancia</h2>
  <p>Lo que importa es cuánto tardas en llegar a cada parada. Cuentan los sentidos de las calles, los giros que no se
  pueden hacer, el tráfico a esa hora (salidas de colegio, mercados, hora punta) y lo que tardas en cada portal.
  Dos paradas juntas en el mapa pueden estar a diez minutos.</p>

  <h2>4. Carga al revés</h2>
  <p>Lo último que vas a entregar, al fondo; lo primero, a mano. Una bolsa o caja por tramo ahorra minutos en cada
  parada, y en una jornada de 100 paradas eso es más de una hora.</p>

  <h2>5. Los que tienen horario, en su franja</h2>
  <p>Coloca primero las entregas con hora y ordena el resto alrededor. Si ves que no llegas, avisa al cliente antes de
  la hora: una llamada o un mensaje evita una entrega fallida y un reintento mañana.</p>

  <h2>6. Avisa antes de llegar</h2>
  <p>Un mensaje con la hora aproximada («llego en 10 minutos») reduce mucho los «no estaba». Tenlo escrito para no
  perder tiempo.</p>

  <h2>7. Si no está, al final de su zona</h2>
  <p>No vuelvas atrás a mitad de ruta. Deja el reintento para el final de ese tramo y sigue. Haz una foto o apunta qué
  pasó por si luego te lo preguntan.</p>

  <h2>8. Lleva la cuenta del día</h2>
  <p>Paradas hechas, kilómetros, gasolina y lo que te pagan por entrega. Con esos cuatro números sabes si una ruta te
  sale a cuenta o no. Si quieres hacer el cálculo del mes, tienes una
  <a href="/calculadora-repartidor">calculadora para repartidores</a>.</p>

  <div class="caja">
    <h2 style="margin-top:0">Hacerlo con una app</h2>
    <p>Lo más pesado de todo esto lo hace <b>FDS</b>, una app para repartidores que reparten por su cuenta:</p>
    <ul>
      <li>Le haces una foto a la etiqueta o escaneas el código y la dirección entra sola.</li>
      <li>Ordena las paradas por tiempo, con el tráfico típico de cada hora, y te dice a qué hora llegas a cada una.</li>
      <li>Te guía con voz hasta cada puerta y, en Android, con manos libres: dices «entregado» y sigues conduciendo.</li>
      <li>Te dice cuánto llevas ganado en el día y cuánto se fue en gasolina, en la moneda de tu país.</li>
    </ul>
    <p class="oferta">${oferta}</p>
    <a class="boton" href="${enlace}">Probar FDS gratis</a>
  </div>

  <h2>Preguntas frecuentes</h2>
  ${PREGUNTAS.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n  ')}

  <footer>FDS · <a href="/aviso-legal">Aviso legal</a> · <a href="/privacidad">Privacidad</a> ·
  <a href="/guia-rota-de-entregas" hreflang="pt-BR">Em português</a> ·
  <a href="/guia-ganar-mas-repartidor">Cómo ganar más como repartidor</a></footer>
</main>
</body>
</html>`
}

export async function onRequestGet() {
  return new Response(pagina(), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
  })
}
