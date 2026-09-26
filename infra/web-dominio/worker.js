/* flotadsp.com -> la web de Flota (proyecto de Cloudflare Pages `flota`).
 *
 * POR QUÉ UN WORKER Y NO EL DOMINIO PROPIO DE PAGES. Pages acepta el dominio
 * pero lo deja «pendiente» hasta que alguien crea el registro DNS, y la sesión
 * de wrangler de este PC no tiene permiso de DNS. Un Worker con dominio propio
 * sí: Cloudflare le crea el registro y el certificado solo. Este Worker no
 * hace nada más que reenviar la petición a Pages tal cual.
 *
 *   · www.flotadsp.com -> 301 a flotadsp.com (una sola dirección buena).
 *   · Las redirecciones de Pages que apunten a *.pages.dev vuelven con el
 *     dominio bueno, para que nadie acabe en la dirección técnica.
 *   · `X-Forwarded-Host` le dice a las funciones de Pages (sitemap, robots,
 *     ofertas de empleo) cuál es el dominio de verdad.
 *
 * Si algún día se activa el dominio en Pages (Workers & Pages -> flota ->
 * Custom domains), este Worker sobra: se borra y listo.
 */
const ORIGEN = 'https://flota-2fg.pages.dev'
const CANONICO = 'flotadsp.com'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.hostname !== CANONICO) {
      url.hostname = CANONICO
      return Response.redirect(url.toString(), 301)
    }
    const destino = new URL(url.pathname + url.search, ORIGEN)
    const cabeceras = new Headers(request.headers)
    cabeceras.delete('host')
    cabeceras.set('X-Forwarded-Host', CANONICO)
    const conCuerpo = !['GET', 'HEAD'].includes(request.method)
    const r = await fetch(destino, {
      method: request.method,
      headers: cabeceras,
      body: conCuerpo ? request.body : undefined,
      redirect: 'manual',
    })
    const loc = r.headers.get('Location')
    if (loc && loc.startsWith(ORIGEN)) {
      const h = new Headers(r.headers)
      h.set('Location', `https://${CANONICO}${loc.slice(ORIGEN.length)}`)
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h })
    }
    return r
  },
}
