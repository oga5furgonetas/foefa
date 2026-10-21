/* La portada (/) con SUS etiquetas (21-10-2026).
 *
 * Dani: «véndelo sobre todo como la app de reparto gratis». La portada ya lo hace al
 * montar React, pero lo que se ve al compartir el enlace (og:) y lo que lee Google
 * antes de que arranque salía del index.html común: «Flota — Gestión de flotas con IA».
 * Aquí se cambia solo para «/», como hace repartidores.js con su ruta, y se reutilizan
 * sus ventajas y preguntas para que las dos digan lo mismo.
 *
 * La cáscara HTML no se guarda en la caché del borde (no-cache, como dice _headers
 * para «/»): tras cada despliegue cambian los nombres de los .js y una copia vieja
 * pediría ficheros que ya no existen. */
import { VENTAJAS, preguntas, esc } from './repartidores.js'

const TITULO = 'FDS · La app de reparto gratis: ruta ordenada, escáner y navegación'
const DESCRIPCION = 'Escanea o haz una foto a la etiqueta: la ruta se ordena sola y te guía con voz hasta cada puerta. Gratis y sin tarjeta. Y para empresas, el panel de la flota con IA.'

function contenido() {
  return `<main style="max-width:40rem;margin:0 auto;padding:24px 20px;color:#e6f2f3;font-family:system-ui,sans-serif">
      <h1>La app de reparto gratis que ordena tu ruta sola.</h1>
      <p>Escanea los paquetes o haz una foto a la etiqueta, sea de la empresa que sea. La app ordena las paradas, te lleva con voz hasta cada puerta y apunta lo que ganas.</p>
      <p><a href="/registro?sector=autonomo&amp;plan=autonomo" style="color:#14e7d8">Crear mi cuenta gratis</a></p>
      <ul>${VENTAJAS.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>
      <h2>¿Tienes una empresa de reparto o una flota?</h2>
      <p>Tu gente reparte con la app y tú lo ves todo en el panel de la oficina: furgonetas, revisiones con IA, taller, vencimientos, cuadrante y equipo. <a href="/planes" style="color:#14e7d8">Ver precios</a></p>
      ${preguntas().map(([q, a]) => `<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join('')}
      <p><a href="/repartidores" style="color:#14e7d8">App de reparto</a> · <a href="/guia-ruta-de-reparto" style="color:#14e7d8">Guía: cómo ordenar tu ruta de reparto</a></p>
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
    `<title>${TITULO}</title>`,
    `<meta name="description" content="${DESCRIPCION}" />`,
    `<meta property="og:title" content="${TITULO}" />`,
    `<meta property="og:description" content="${DESCRIPCION}" />`,
    `<meta property="og:url" content="${base}/" />`,
    `<meta property="og:image" content="${base}/og-repartidores.png?v=promo1231" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${TITULO}" />`,
    `<link rel="canonical" href="${base}/" />`,
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'FDS', applicationCategory: 'BusinessApplication',
      operatingSystem: 'Android, iOS, Web', url: `${base}/`, description: DESCRIPCION,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } })}</script>`,
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'es',
      mainEntity: preguntas().map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}</script>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${cabeza}\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${contenido()}</div>`)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  })
}
