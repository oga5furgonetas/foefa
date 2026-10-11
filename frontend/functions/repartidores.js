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

/* LO QUE LEE GOOGLE (11-10-2026). La portada la pinta React; hasta que arranca, el HTML iba vacío y Google
 * tenía /repartidores «descubierta, sin indexar». Ahora lleva su canonical, los datos de la app y de las
 * preguntas frecuentes, y el texto principal ya escrito dentro de #root (el mismo que pinta React, que lo
 * sustituye al montar). La oferta «sin límite» solo mientras dura. */
const PROMO_HASTA = '2026-12-31'
const enPromo = () => new Date().toISOString().slice(0, 10) <= PROMO_HASTA
const VENTAJAS = [
  'Foto a la etiqueta: la dirección y el teléfono entran solos',
  'La ruta se ordena sola por tiempo, con el tráfico típico',
  'Te guía con voz hasta cada puerta, dentro de la app',
  'Manos libres en Android: di «entregado» y sigue conduciendo',
  'Cuánto llevas ganado hoy y la gasolina, en tu moneda',
]
const preguntas = () => [
  ['¿Sirve con los paquetes de mi agencia?', 'Sí. Escaneas el código de la etiqueta o le haces una foto y la app intenta leer la dirección (si no la lee, la escribes tú), o pegas tu lista de direcciones. No necesita conectarse con tu agencia.'],
  ['¿Qué hacéis con mis datos y mi ubicación?', 'La foto de la etiqueta se lee en tu móvil. Tu ubicación solo se usa para guiarte y no se guarda. Los datos de tus clientes se borran solos a los días que tú fijes.'],
  ['¿Cuánto cuesta?', enPromo()
    ? 'Gratis y sin límite hasta el 31 de diciembre, sin tarjeta. Después sigues gratis con hasta 15 paradas al día, o sin tope por 9,99 € al mes o 99 € al año. Cancelas cuando quieras desde la propia app.'
    : 'Gratis para siempre hasta 15 paradas al día, sin tarjeta. Sin tope: 9,99 € al mes o 99 € al año, y los 7 primeros días van sin tope. Cancelas cuando quieras desde la propia app.'],
]
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function contenido() {
  return `<main style="max-width:28rem;margin:0 auto;padding:24px 20px;color:#e6f2f3;font-family:system-ui,sans-serif">
      <h1>Tu ruta de reparto, ordenada sola.</h1>
      <p>Haz una foto a la etiqueta o escanea el paquete: la app ordena las paradas por tiempo y te lleva con voz hasta cada puerta.</p>
      <p><a href="/registro?sector=autonomo&amp;plan=autonomo" style="color:#14e7d8">Crear mi cuenta gratis</a></p>
      <ul>${VENTAJAS.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>
      ${preguntas().map(([q, a]) => `<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join('')}
      <p><a href="/guia-ruta-de-reparto" style="color:#14e7d8">Guía: cómo ordenar tu ruta de reparto</a></p>
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
    `<meta property="og:url" content="${base}/repartidores" />`,
    `<meta property="og:image" content="${base}/og-repartidores.png?v=promo1231" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${TITULO}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="canonical" href="${base}/repartidores" />`,
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'FDS', applicationCategory: 'BusinessApplication',
      operatingSystem: 'Android, iOS, Web', url: `${base}/repartidores`, description: DESCRIPCION,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } })}</script>`,
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'es',
      mainEntity: preguntas().map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}</script>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${cabeza}\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${contenido()}</div>`)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
  })
}
