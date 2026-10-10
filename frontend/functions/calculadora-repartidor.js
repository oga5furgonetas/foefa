/* La calculadora de repartidores con SUS etiquetas (11-10-2026): título, descripción y vista previa
 * propias para Google y para quien la comparte. Mismo truco que functions/repartidores.js. */
const TITULO = '¿Cuánto gana un repartidor autónomo? Calculadora gratis'
const DESCRIPCION = 'Pon tus paradas al día, lo que te pagan por parada y tus gastos (gasóleo, cuota, furgoneta) y mira lo que te queda al mes, al día y por hora.'

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const respuesta = await env.ASSETS.fetch(new URL('/index.html', url))
  let html = await respuesta.text()
  const base = 'https://flotadsp.com'
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:(title|description|image|image:alt|image:width|image:height|url)"[^>]*>/gi, '')
  const datos = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Calculadora de ganancias del repartidor autónomo',
    url: `${base}/calculadora-repartidor`, applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, inLanguage: 'es',
  }
  const cabeza = [
    `<title>${TITULO}</title>`,
    `<meta name="description" content="${DESCRIPCION}" />`,
    `<link rel="canonical" href="${base}/calculadora-repartidor" />`,
    `<meta property="og:title" content="${TITULO}" />`,
    `<meta property="og:description" content="${DESCRIPCION}" />`,
    `<meta property="og:url" content="${base}/calculadora-repartidor" />`,
    `<meta property="og:image" content="${base}/og-repartidores.png?v=promo1231" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${JSON.stringify(datos)}</script>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${cabeza}\n  </head>`)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
  })
}
