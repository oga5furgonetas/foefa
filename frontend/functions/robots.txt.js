/* robots.txt con la dirección del sitemap del dominio desde el que se pide:
   la norma exige una URL absoluta, y escribirla a mano ataría el despliegue a
   un dominio. */
/* El dominio de verdad. flotadsp.com llega por un Worker que reenvía a Pages
   (infra/web-dominio) y avisa con X-Forwarded-Host; sin él, la petición. */
const origenDe = (request) => {
  const h = request.headers.get('x-forwarded-host')
  return h && /^[a-z0-9.-]+$/i.test(h) ? `https://${h}` : new URL(request.url).origin
}

export async function onRequestGet({ request }) {
  const origen = origenDe(request)
  const texto = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /panel',
    'Disallow: /conductor',
    // Seguimiento de pedidos del cliente: enlaces privados, nunca en un buscador.
    'Disallow: /s/',
    'Disallow: /regalo/',
    'Disallow: /login',
    'Disallow: /reset-password',
    '',
    `Sitemap: ${origen}/sitemap.xml`,
    '',
  ].join('\n')
  return new Response(texto, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
