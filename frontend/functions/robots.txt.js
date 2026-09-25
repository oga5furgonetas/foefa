/* robots.txt con la dirección del sitemap del dominio desde el que se pide:
   la norma exige una URL absoluta, y escribirla a mano ataría el despliegue a
   un dominio. */
export async function onRequestGet({ request }) {
  const origen = new URL(request.url).origin
  const texto = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /panel',
    'Disallow: /conductor',
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
