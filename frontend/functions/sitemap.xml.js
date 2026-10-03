/* El sitemap, montado EN CADA PETICIÓN con el dominio desde el que se pide.
 *
 * Las páginas fijas se escriben aquí con el origen de la petición: así el mismo
 * despliegue sirve para cualquier dominio sin un fichero con la dirección
 * escrita a mano. Y las ofertas de empleo entran solas: publicas una y entra;
 * la desactivas y sale.
 *
 * Si el backend no contesta se sirven solo las fijas. Un sitemap a medias es
 * mucho peor que uno corto: Google se queda con lo que le des.
 */

/* La API sale de la variable API_URL del proyecto (Cloudflare Pages →
   Settings → Environment variables). Sin ella, la del mismo dominio. */
const apiDe = (env, url) => (env && env.API_URL ? env.API_URL : new URL('/api', url).href).replace(/\/+$/, '')

const xml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const FIJAS = [
  ['/', '1.0'], ['/planes', '0.9'], ['/registro', '0.8'], ['/peritaje-tecnico', '0.7'],
  ['/contacto', '0.6'], ['/security', '0.5'], ['/empleo', '0.6'],
  ['/privacidad', '0.2'], ['/terminos', '0.2'], ['/encargo', '0.2'], ['/prueba-reparto', '0.6'], ['/cookies', '0.2'], ['/aviso-legal', '0.2'],
]

/* El dominio de verdad. flotadsp.com llega por un Worker que reenvía a Pages
   (infra/web-dominio) y avisa con X-Forwarded-Host; sin él, la petición. */
const origenDe = (request) => {
  const h = request.headers.get('x-forwarded-host')
  return h && /^[a-z0-9.-]+$/i.test(h) ? `https://${h}` : new URL(request.url).origin
}

export async function onRequestGet(context) {
  const { env, request } = context
  const origen = origenDe(request)

  const filas = FIJAS.map(([ruta, prioridad]) =>
    `  <url><loc>${xml(origen + ruta)}</loc><priority>${prioridad}</priority></url>`)

  try {
    const r = await fetch(`${apiDe(env, request.url)}/empleo/seo/sitemap`, { headers: { accept: 'application/json' } })
    if (r.ok) {
      const { ofertas } = await r.json()
      for (const o of ofertas || []) {
        const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(o.lastmod || '')
          ? `<lastmod>${o.lastmod}</lastmod>` : ''
        // Prioridad alta: son las páginas que queremos que Google recorra a
        // menudo, porque caducan.
        filas.push(`  <url><loc>${xml(o.url)}</loc>${lastmod}<changefreq>daily</changefreq><priority>0.9</priority></url>`)
      }
    }
  } catch {
    /* se sirven solo las fijas */
  }

  const texto = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${filas.join('\n')}
</urlset>
`
  return new Response(texto, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600',
    },
  })
}
