/* La página de venta para empresas (/empresas) con SUS etiquetas (14-11-2026).
 *
 * Como repartidores.js: es una SPA y el index.html común lleva las etiquetas de la portada. Quien comparte
 * /empresas por correo o WhatsApp tiene que ver una tarjeta que hable de furgonetas y golpes, y Google tiene que leer
 * el texto principal antes de que arranque React (que lo sustituye al montar). Los precios salen de lib/precios.js,
 * los mismos que pinta la página: aquí no se escribe ninguno. Sin cifras de clientes ni testimonios.
 * La marca, de src/marca.js (14-11-2026, ronda 2): se carga en Node y en Workers sin nada del navegador (sus usos de
 * `window` e `import.meta.env` van guardados). Lo comprueba scripts/check-funciones-pages.mjs, que importa todas las
 * funciones con Node. Los textos, los mismos que la página (sin «cada mañana» ni «antes de salir»). */
import { esc } from './repartidores.js'
import { PLANES_EMPRESA, DIAS_PRUEBA_EMPRESA } from '../src/lib/precios.js'
import { MARCA } from '../src/marca.js'

const desde = Math.min(...PLANES_EMPRESA.map((p) => Number(p.por_vehiculo)).filter((x) => x > 0))
const TITULO = `${MARCA.nombre} para empresas con furgonetas · Deja de pagar golpes que no son tuyos`
// El alta de flota (sector «Otra flota», plan Pro), la misma que los botones de la página (Empresas.jsx, ALTA_EMPRESA).
const ALTA = '/registro?sector=otra&plan=completo'
const DESCRIPCION = `Cada conductor revisa su furgoneta con fotos desde el móvil: ves en qué revisión apareció cada golpe y quién la llevaba, y tienes las fotos con fecha al devolverla al renting. Desde ${desde} € por vehículo y mes, ${DIAS_PRUEBA_EMPRESA} días gratis sin tarjeta.`

export const PUNTOS = [
  // 14-11-2026 (ronda 3, V11): la hora, no cuántas veces: cada conductor hace una por furgoneta y día (server.py, 409).
  'El conductor hace las fotos de su furgoneta desde el móvil; a qué hora se hace la revisión lo decide cada empresa (cada conductor hace una por furgoneta y día).',
  'Cada revisión queda guardada con su fecha, su hora y quién la hizo.',
  'La detección de daños mira sola cada foto, la compara con la anterior del mismo lado y señala lo que parece un golpe nuevo. Se equivoca a menudo: sirve para saber dónde mirar; la prueba son las fotos con su fecha.',
  'Cada furgoneta guarda en su ficha todas sus revisiones con foto, cada una con su fecha y su conductor.',
  'Su historial sale en un parte para imprimir o guardar en PDF, con la foto del golpe y la de la misma vista en la revisión anterior, de los últimos daños nuevos.',
  'La lista de ITV de toda la flota, ordenada por lo que caduca antes, y un calendario con el fin de cada renting y una fecha estimada para el aceite, las ruedas y las pastillas, según los kilómetros que hace cada furgoneta.',
]

function contenido() {
  return `<main style="max-width:40rem;margin:0 auto;padding:24px 20px;color:#e6f2f3;font-family:system-ui,sans-serif">
      <p>Para empresas con furgonetas</p>
      <h1>Deja de pagar golpes que no son tuyos</h1>
      <p>Cada conductor revisa su furgoneta con fotos desde el móvil. Si aparece un golpe, ves en qué revisión apareció y quién la llevaba. Y cuando te pasan un cargo al devolverla, tienes las fotos con fecha.</p>
      <p><a href="${esc(ALTA)}" style="color:#14e7d8">Probar gratis ${DIAS_PRUEBA_EMPRESA} días</a> · <a href="/planes" style="color:#14e7d8">Ver precios</a></p>
      <ul>${PUNTOS.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>
      <p>Desde ${desde} € por vehículo y mes · sin tarjeta</p>
    </main>`
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const respuesta = await env.ASSETS.fetch(new URL('/index.html', url))
  let html = await respuesta.text()
  const base = 'https://flotadsp.com' // el proxy del dominio reescribe el host: no fiarse de url.origin
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:(title|description|image|image:alt|image:width|image:height|url)"[^>]*>/gi, '')
  const cabeza = [
    `<title>${esc(TITULO)}</title>`,
    `<meta name="description" content="${esc(DESCRIPCION)}" />`,
    `<meta property="og:title" content="${esc(TITULO)}" />`,
    `<meta property="og:description" content="${esc(DESCRIPCION)}" />`,
    `<meta property="og:url" content="${base}/empresas" />`,
    // La tarjeta general de la marca («La app de reparto y el panel de tu flota»): no hay otra imagen hecha.
    `<meta property="og:image" content="${base}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(TITULO)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="canonical" href="${base}/empresas" />`,
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: MARCA.nombre, applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', url: `${base}/empresas`, description: DESCRIPCION,
      offers: { '@type': 'Offer', priceCurrency: 'EUR', price: String(desde),
        priceSpecification: { '@type': 'UnitPriceSpecification', price: String(desde), priceCurrency: 'EUR', unitText: 'vehículo y mes' } } })}</script>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${cabeza}\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${contenido()}</div>`)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
  })
}
