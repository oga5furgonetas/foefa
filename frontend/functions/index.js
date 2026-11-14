/* La portada (/) con SUS etiquetas (14-11-2026: la portada para empresas con furgonetas).
 *
 * Desde el 14-11-2026 «/» es la página para empresas con furgonetas (src/pages/Empresas.jsx); la de la app de reparto
 * sigue en /repartidores (functions/repartidores.js). La SPA pinta el texto al montar, pero lo que se ve al compartir
 * el enlace (og:) y lo que lee Google antes de que arranque React sale de aquí. /empresas enseña la misma página y
 * sirve estas mismas etiquetas con la canónica en «/» (functions/empresas.js).
 *
 * Los mismos textos que la página, sin nada que la app no haga: el conductor hace las fotos, una PERSONA repasa el día
 * y marca lo nuevo; la IA no se promete. Los precios salen de lib/precios.js (lo mismo que pinta la página) y la marca
 * de src/marca.js; los dos cargan fuera del navegador (lo comprueba scripts/check-funciones-pages.mjs).
 *
 * La cáscara HTML no se guarda en la caché del borde (no-cache, como dice _headers para «/»): tras cada despliegue
 * cambian los nombres de los .js y una copia vieja pediría ficheros que ya no existen. */
import { esc } from './repartidores.js'
import { PLANES_EMPRESA, DIAS_PRUEBA_EMPRESA } from '../src/lib/precios.js'
import { MARCA } from '../src/marca.js'

const desde = Math.min(...PLANES_EMPRESA.map((p) => Number(p.por_vehiculo)).filter((x) => x > 0))
export const TITULO = `${MARCA.nombre} para empresas con furgonetas · El golpe, el día que aparece`
// El alta de flota (sector «Otra flota») con el plan Esencial, el del «Desde 5 €»: la misma que los botones de la página
// antes de tocar la calculadora (Empresas.jsx, ALTA_EMPRESA y PLAN_DE_ENTRADA).
const ALTA = '/registro?sector=otra&plan=operacion'
export const DESCRIPCION = `Cada conductor fotografía su furgoneta desde el móvil. Tú ves la foto de hoy junto a la anterior del mismo lado y marcas lo que sea nuevo, para arreglarlo antes de que lo vea el perito del renting. Desde ${desde} € por furgoneta y mes, ${DIAS_PRUEBA_EMPRESA} días de prueba sin tarjeta.`

export const PASOS = [
  ['El conductor hace cuatro fotos', 'Frontal, trasera y los dos laterales, más los kilómetros. Desde su móvil, a la hora que decida tu empresa: cada conductor, una revisión por furgoneta y día.'],
  ['Tú repasas el día en unos minutos', 'Cada foto de hoy aparece junto a la anterior del mismo lado. Si está igual, pasas a la siguiente. Si hay algo nuevo, lo marcas sobre la foto.'],
  ['Cada golpe queda con su día', 'Y con quién la llevaba, solo cuando se sabe con seguridad. Cada furgoneta tiene su expediente: cómo entró, qué le ha pasado y cuándo, listo para imprimir.'],
]

/* Lo que lee Google y lo que se ve un instante antes de que monte React. Sin colores propios: hereda el fondo y la tinta
   de arranque (public/fondo-arranque.js marca <html> con el papel, o con la noche si se eligió), así no queda una caja
   clara sobre otro fondo. */
function contenido() {
  return `<main style="max-width:40rem;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif">
      <p>Para empresas con furgonetas</p>
      <h1>El golpe, el día que aparece. No el día que te lo cobran.</h1>
      <p>Cada conductor fotografía su furgoneta desde el móvil. Tú ves la foto de hoy junto a la anterior del mismo lado y marcas lo que sea nuevo. Así puedes arreglarlo en tu taller antes de que lo vea el perito del renting.</p>
      <p><a href="${esc(ALTA)}">Probar con mis furgonetas</a> · <a href="/expediente-ejemplo">Ver un expediente de ejemplo</a></p>
      <p>Desde ${desde} € por furgoneta y mes. ${DIAS_PRUEBA_EMPRESA} días de prueba, sin tarjeta. <a href="/planes">Precios</a></p>
      <h2>Así funciona</h2>
      ${PASOS.map(([t, d]) => `<h3>${esc(t)}</h3><p>${esc(d)}</p>`).join('')}
      <p><a href="/repartidores">¿Repartes tú? La app de ruta</a></p>
    </main>`
}

/* La página con las etiquetas de la portada, para «/» y para /empresas: la canónica es siempre «/». */
export async function servirPortada(context) {
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
    `<meta property="og:url" content="${base}/" />`,
    // La tarjeta general de la marca: no hay otra imagen hecha para la portada de empresas.
    `<meta property="og:image" content="${base}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(TITULO)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="canonical" href="${base}/" />`,
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: MARCA.nombre, applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', url: `${base}/`, description: DESCRIPCION,
      offers: { '@type': 'Offer', priceCurrency: 'EUR', price: String(desde),
        priceSpecification: { '@type': 'UnitPriceSpecification', price: String(desde), priceCurrency: 'EUR', unitText: 'vehículo y mes' } } })}</script>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${cabeza}\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${contenido()}</div>`)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  })
}

export const onRequestGet = servirPortada
