/* La landing de repartidores con SUS etiquetas de vista previa (05-10-2026).
 *
 * POR QUÉ. Es una SPA: todas las rutas sirven el mismo index.html, cuyas etiquetas
 * og: hablan de «Flota — Gestión de flotas con IA». Quien compartía el enlace de
 * repartidores en un grupo de Facebook enseñaba una tarjeta de gestión de flotas,
 * que no tiene que ver con lo que se ofrece y parece una estafa. Aquí se sustituyen
 * solo para esta ruta; la persona recibe la misma página y React monta igual. */
// Plan gratis (10-10-2026): gratis para siempre con tope de paradas; sin tope, de pago.
// 10-10-2026: gratis y sin límite hasta el 31 de diciembre (promoción; ver lib/precios.js).
const TITULO = 'Tu ruta de reparto, ordenada sola · Gratis y sin límite hasta el 31 de diciembre'
const DESCRIPCION = 'Foto a la etiqueta, paradas ordenadas y guía por voz hasta la puerta. Para repartidores autónomos. Sin tarjeta.'

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
    `<title>${TITULO}</title>`,
    `<meta name="description" content="${DESCRIPCION}" />`,
    `<meta property="og:title" content="${TITULO}" />`,
    `<meta property="og:description" content="${DESCRIPCION}" />`,
    `<meta property="og:url" content="${base}/repartidores" />`,
    `<meta property="og:image" content="${base}/og-repartidores.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${TITULO}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${cabeza}\n  </head>`)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
  })
}
