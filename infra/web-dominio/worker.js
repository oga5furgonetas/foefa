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
 *   · /api/* -> el servidor (Fly) por el mismo dominio (04-10-2026). Desde
 *     China *.fly.dev no siempre llega; flotadsp.com sí. La web solo usa este
 *     camino desde China (lib/apiBase.js): así no se gasta cuota del Worker
 *     con el resto del mundo, que sigue yendo directo.
 *
 * Si algún día se activa el dominio en Pages (Workers & Pages -> flota ->
 * Custom domains), este Worker sobra salvo por /api.
 */
const ORIGEN = 'https://flota-2fg.pages.dev'
const API = 'https://flota-backend.fly.dev'
const CANONICO = 'flotadsp.com'

// Un año de HSTS: el navegador que haya entrado una vez por https no vuelve a probar http.
const HSTS = 'max-age=31536000; includeSubDomains'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    // SIEMPRE HTTPS (01-11-2026). La auditoría vio que http://flotadsp.com servía la web entera, login incluido,
    // sin redirigir: Cloudflare solo lo redirige si «Always Use HTTPS» está encendido en el panel, y no lo estaba.
    // Aquí se redirige pase lo que pase con ese ajuste. El esquema real del visitante va en `CF-Visitor`.
    let esquema = url.protocol
    try { esquema = (JSON.parse(request.headers.get('CF-Visitor') || '{}').scheme || esquema.replace(':', '')) + ':' } catch {}
    if (esquema === 'http:' || url.hostname !== CANONICO) {
      url.protocol = 'https:'
      url.hostname = CANONICO
      return Response.redirect(url.toString(), 301)
    }
    const esApi = url.pathname === '/api' || url.pathname.startsWith('/api/')
    const destino = new URL(url.pathname + url.search, esApi ? API : ORIGEN)
    const cabeceras = new Headers(request.headers)
    cabeceras.delete('host')
    cabeceras.set('X-Forwarded-Host', CANONICO)
    // El servidor saca la IP del cliente de aquí (límites por IP, registro).
    const ip = request.headers.get('CF-Connecting-IP')
    if (esApi && ip) cabeceras.set('X-Forwarded-For', ip)
    const conCuerpo = !['GET', 'HEAD'].includes(request.method)
    const r = await fetch(destino, {
      method: request.method,
      headers: cabeceras,
      body: conCuerpo ? request.body : undefined,
      redirect: 'manual',
    })
    const loc = r.headers.get('Location')
    const h = new Headers(r.headers)
    if (loc && loc.startsWith(ORIGEN)) h.set('Location', `https://${CANONICO}${loc.slice(ORIGEN.length)}`)
    if (!h.has('Strict-Transport-Security')) h.set('Strict-Transport-Security', HSTS)
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h })
  },
}
