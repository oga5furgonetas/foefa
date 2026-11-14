/* /devolucion-renting (14-11-2026): «¿Qué te van a cobrar al devolverlo?», la herramienta pública que repasa el
 * vehículo con la guía de devolución de cada compañía (src/pages/DevolucionRenting.jsx). La herramienta es la SPA; lo
 * que lee Google antes de que arranque React (título, descripción, canónica y un HTML con contenido de verdad: las
 * compañías, sus documentos y su edición) sale de aquí, con el patrón de functions/index.js. Las páginas de cada
 * compañía (functions/devolucion-renting/[compania].js) usan las piezas de este fichero.
 *
 * Todo sale de src/lib/guiasRenting.js (las guías leídas el 14-11-2026, cada regla con su página) y de src/marca.js;
 * los dos cargan fuera del navegador (scripts/check-funciones-pages.mjs). Solo en español, como la herramienta. */
import { esc } from './repartidores.js'
import { MARCA } from '../src/marca.js'
import { COMPANIAS, DOCUMENTOS, LEIDA_TEXTO, ORDEN_ZONAS, PRECIOS_APARTE, VIGENCIA, ZONAS, documentosDe, paginasDe, regla, tituloCompania, vozDe } from '../src/lib/guiasRenting.js'

export const BASE = 'https://flotadsp.com' // el proxy del dominio reescribe el host: no fiarse de url.origin
export const RUTA = '/devolucion-renting'
export const TITULO = `¿Qué te van a cobrar al devolverlo? La guía de devolución de tu renting · ${MARCA.nombre}`
export const ENTRADILLA = 'Algunas compañías de renting publican qué consideran desgaste normal y qué no aceptan. Repásalo con la suya antes de que lo haga su perito.'
// Para Google: 155 caracteres como mucho (lo vigila scripts/check-guias-renting.mjs).
export const DESCRIPCION = 'Repasa tu coche o furgoneta zona a zona con la guía de devolución de tu renting: qué acepta y qué no, con la página de cada criterio. Sin registro.'

const P = 'style="color:#2b363a"'
const A = 'style="color:#0b6e69"'

export { documentosDe }

export function fuenteHtml(id) {
  const d = DOCUMENTOS[id]
  const web = d.web ? ` · <a href="${esc(d.web.url)}" ${A} rel="noopener">${esc(d.web.texto)}</a>` : ''
  const vigencia = VIGENCIA[id] ? `<p ${P}>${esc(VIGENCIA[id])}</p>` : ''
  return `<p ${P}>Fuente: <a href="${esc(d.url)}" ${A} rel="noopener">${esc(d.nombre)}</a>${web}. Edición: ${esc(d.edicion)}. Leído el ${esc(LEIDA_TEXTO)}. ${esc(d.paginasNota)}</p>${vigencia}`
}

/* La tabla de criterios de un documento, por zonas: daño · lo que acepta · lo que no · página, con el nombre de su
   documento («Su guía acepta», «Sus condiciones cobran»…). */
export function tablaHtml(id) {
  const d = DOCUMENTOS[id]
  const v = vozDe(id)
  const reglas = d.reglas.map((_, i) => regla(id, i))
  return ORDEN_ZONAS.map((z) => {
    const lista = reglas.filter((r) => r.zona === z)
    if (!lista.length) return ''
    const filas = lista.map((r) => `<tr><th scope="row" style="text-align:left;vertical-align:top;padding:6px 8px 6px 0">${esc(r.dano)}</th><td style="vertical-align:top;padding:6px 8px">${esc(r.no_se_cobra)}</td><td style="vertical-align:top;padding:6px 8px">${esc(r.se_cobra ?? v.soloAcepta)}${r.condicion ? ` ${esc(r.condicion)}` : ''}</td><td style="vertical-align:top;padding:6px 0">pág. ${paginasDe(r)}</td></tr>`).join('')
    return `<h3>${esc(ZONAS[z])}</h3><table style="border-collapse:collapse;width:100%"><thead><tr><th scope="col" style="text-align:left">Daño</th><th scope="col" style="text-align:left">${esc(v.acepta)}</th><th scope="col" style="text-align:left">${esc(v.noAcepta)}</th><th scope="col">Pág.</th></tr></thead><tbody>${filas}</tbody></table>`
  }).join('')
}

export function preciosHtml(id) {
  const aparte = PRECIOS_APARTE[DOCUMENTOS[id].compania]
  const l = DOCUMENTOS[id].precios.filter((_, i) => !aparte?.indices.includes(i))
  if (!l.length) return `<p ${P}>Este documento no publica precios.</p>`
  return `${aparte ? `<p ${P}>${esc(aparte.texto)}</p>` : ''}<table style="border-collapse:collapse;width:100%"><thead><tr><th scope="col" style="text-align:left">Concepto</th><th scope="col" style="text-align:left">Importe</th><th scope="col">Pág.</th></tr></thead><tbody>${l.map((p) => `<tr><td style="padding:4px 8px 4px 0">${esc(p.concepto)}</td><td style="padding:4px 8px">${esc(p.importe)}</td><td>pág. ${p.pagina}</td></tr>`).join('')}</tbody></table>`
}

export function procesoHtml(id) {
  const pr = DOCUMENTOS[id].proceso
  const filas = [['Quién lo revisa', pr.quien_inspecciona], ['Qué te dan', pr.informe_al_cliente], ['Plazo para discutirlo', pr.plazo_para_discutir], ['¿Se puede reparar antes?', pr.se_puede_reparar_antes]]
    .filter(([, t]) => t).map(([k, t]) => `<dt><b>${esc(k)}</b></dt><dd ${P}>${esc(t)}</dd>`).join('')
  const rec = (pr.recomendaciones_antes_de_devolver || []).map((t) => `<li>${esc(t)}</li>`).join('')
  return `<dl>${filas}</dl>${rec ? `<h4>Lo que recomienda antes de devolver</h4><ul>${rec}</ul>` : ''}`
}

export const enlacesCompanias = (menos) => COMPANIAS.filter((c) => c.slug !== menos)
  .map((c) => `<li><a href="${RUTA}/${c.slug}" ${A}>${esc(tituloCompania(c))}</a></li>`).join('')

function contenido() {
  const lista = (tipo) => COMPANIAS.filter((c) => c.tipo === tipo).map((c) => {
    const docs = documentosDe(c).map(({ id }) => `${esc(DOCUMENTOS[id].corto)} (${esc(DOCUMENTOS[id].edicion)})`).join('; ')
    return `<li><a href="${RUTA}/${c.slug}" ${A}>${esc(c.nombreLargo)}</a>: ${docs}</li>`
  }).join('')
  return `<main style="max-width:44rem;margin:0 auto;padding:24px 16px;color:#10181a;background:#f5f6f3;font-family:system-ui,sans-serif">
      <h1>¿Qué te van a cobrar al devolverlo?</h1>
      <p ${P}>${esc(ENTRADILLA)} Sin registro. No guardamos nada de tu vehículo.</p>
      <h2>Las guías que hemos leído</h2>
      <ul>${lista('renting')}</ul>
      <h2>Si es un alquiler</h2>
      <ul>${lista('alquiler')}</ul>
      <p ${P}>Leídas el ${esc(LEIDA_TEXTO)}. Orientativo: decide el perito de tu compañía con la guía que esté en vigor; en un alquiler, quien revise el vehículo con las condiciones que estén en vigor.</p>
    </main>`
}

/* Pone en la cáscara de la SPA el título, la descripción, la canónica y el contenido. */
export async function servirConEtiquetas(context, { titulo, descripcion, ruta, html, estado = 200 }) {
  const indexar = estado === 200
  const { request, env } = context
  const respuesta = await env.ASSETS.fetch(new URL('/index.html', new URL(request.url)))
  let pagina = await respuesta.text()
  pagina = pagina
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:(title|description|url|type)"[^>]*>/gi, '')
  const cabeza = [
    `<title>${esc(titulo)}</title>`,
    `<meta name="description" content="${esc(descripcion)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${esc(titulo)}" />`,
    `<meta property="og:description" content="${esc(descripcion)}" />`,
    `<meta property="og:url" content="${BASE}${ruta}" />`,
    // Una página que no existe no lleva canónica: se dice a los buscadores que no la guarden.
    indexar ? `<link rel="canonical" href="${BASE}${ruta}" />` : '<meta name="robots" content="noindex" />',
  ].join('\n    ')
  pagina = pagina.replace('</head>', `    ${cabeza}\n  </head>`)
  pagina = pagina.replace('<div id="root"></div>', `<div id="root">${html}</div>`)
  return new Response(pagina, { status: estado, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } })
}

export const onRequestGet = (context) => servirConEtiquetas(context, { titulo: TITULO, descripcion: DESCRIPCION, ruta: RUTA, html: contenido() })
