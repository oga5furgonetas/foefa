/* PLANTILLA DE LAS GUÍAS PARA GOOGLE (11-10-2026). Cada guía (functions/guia-*.js) da sus textos y esto
 * monta la página entera en HTML, sin esperar al JavaScript, con sus datos para Google (Article y
 * FAQPage), hreflang entre idiomas, la app al final y la oferta solo mientras dura. Va fuera de
 * functions/ para que no sea una ruta: wrangler la mete al empaquetar quien la importa. */
export const BASE = 'https://flotadsp.com'
export const PROMO_HASTA = '2026-12-31'          // la misma fecha que src/lib/precios.js
const enPromo = () => new Date().toISOString().slice(0, 10) <= PROMO_HASTA

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* g = { ruta, lang, titulo, descripcion, h1, entradilla, secciones: [[titulo, htmlParrafo]], caja: { titulo,
 *       intro, puntos: [], boton }, oferta: { promo, siempre }, preguntas: [[q, a]], alternas: [[lang, ruta]],
 *       pie: { legal, privacidad, otro: [texto, ruta, lang] }, utm } */
export function paginaGuia(g) {
  const enlace = `/repartidores?utm_source=guia&utm_content=${g.utm}`
  const oferta = enPromo() ? g.oferta.promo : g.oferta.siempre
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: g.lang,
    mainEntity: g.preguntas.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  const articulo = {
    '@context': 'https://schema.org', '@type': 'Article', headline: g.titulo, description: g.descripcion, inLanguage: g.lang,
    datePublished: g.fecha || '2026-10-11', dateModified: g.fecha || '2026-10-11', mainEntityOfPage: `${BASE}${g.ruta}`,
    publisher: { '@type': 'Organization', name: 'FDS', url: BASE },
  }
  const alternas = [[g.lang, g.ruta], ...(g.alternas || [])]
    .map(([l, r]) => `<link rel="alternate" hreflang="${l}" href="${BASE}${r}" />`).join('\n  ')
  return `<!doctype html>
<html lang="${g.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(g.titulo)}</title>
  <meta name="description" content="${esc(g.descripcion)}" />
  <link rel="canonical" href="${BASE}${g.ruta}" />
  ${alternas}
  <link rel="icon" href="/favicon.svg" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(g.titulo)}" />
  <meta property="og:description" content="${esc(g.descripcion)}" />
  <meta property="og:url" content="${BASE}${g.ruta}" />
  <meta property="og:image" content="${BASE}/og-repartidores.png?v=promo1231" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(articulo)}</script>
  <script type="application/ld+json">${JSON.stringify(faq)}</script>
  <style>
    :root { color-scheme: dark; --fondo:#05141a; --tarjeta:#0b2329; --marca:#14e7d8; --texto:#e6f2f3; --suave:#a9c2c6; --amarillo:#ffd43b }
    * { box-sizing: border-box }
    body { margin:0; background:var(--fondo); color:var(--texto); font:17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif }
    main { max-width: 720px; margin: 0 auto; padding: 28px 16px 64px }
    a { color: var(--marca) }
    .marca { display:flex; align-items:center; gap:10px; font-weight:800; color:var(--texto); text-decoration:none }
    .marca img { width:32px; height:32px }
    h1 { font-size: clamp(28px, 6vw, 40px); line-height:1.1; margin: 28px 0 12px }
    h2 { font-size: 22px; margin: 34px 0 8px; color: var(--marca) }
    .entradilla { color: var(--suave); font-size: 18px }
    ul li { margin: 6px 0 }
    .caja { background: var(--tarjeta); border: 1px solid #16414a; border-radius: 16px; padding: 20px; margin: 30px 0 }
    .boton { display:inline-block; margin-top:12px; background: var(--marca); color:#04121a; font-weight:800; text-decoration:none; padding: 14px 22px; border-radius: 14px }
    .oferta { color: var(--amarillo); font-weight: 700 }
    details { border-top: 1px solid #16414a; padding: 12px 0 }
    summary { cursor: pointer; font-weight: 700 }
    footer { margin-top: 40px; color: var(--suave); font-size: 14px }
  </style>
</head>
<body>
<main>
  <a class="marca" href="/repartidores?utm_source=guia&utm_content=${g.utm}_logo"><img src="/favicon.svg" alt="" />FDS</a>
  <h1>${g.h1}</h1>
  <p class="entradilla">${g.entradilla}</p>
${g.secciones.map(([t, p]) => `  <h2>${t}</h2>\n  <p>${p}</p>`).join('\n\n')}

  <div class="caja">
    <h2 style="margin-top:0">${g.caja.titulo}</h2>
    <p>${g.caja.intro}</p>
    <ul>
      ${g.caja.puntos.map((x) => `<li>${x}</li>`).join('\n      ')}
    </ul>
    <p class="oferta">${oferta}</p>
    <a class="boton" href="${enlace}">${g.caja.boton}</a>
  </div>

  <h2>${g.titPreguntas}</h2>
  ${g.preguntas.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n  ')}

  <footer>FDS · <a href="/aviso-legal">${g.pie.legal}</a> · <a href="/privacidad">${g.pie.privacidad}</a>${(g.pie.otros || []).map(([t, r, l]) => ` ·\n  <a href="${r}"${l ? ` hreflang="${l}"` : ''}>${t}</a>`).join('')}</footer>
</main>
</body>
</html>`
}

export function respuestaGuia(g) {
  return new Response(paginaGuia(g), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
  })
}
