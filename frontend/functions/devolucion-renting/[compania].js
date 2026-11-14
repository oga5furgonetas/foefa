/* /devolucion-renting/<compañía> (14-11-2026): «Qué cobra <compañía> al devolver un vehículo». La pantalla es la SPA
 * (src/pages/devolucion/Compania.jsx); aquí va, para los buscadores, la misma página en HTML: la tabla de sus criterios
 * con la página de cada uno, la fuente con enlace, edición y fecha de lectura, sus precios y lo que dice del proceso.
 * Una compañía que no tenemos: la SPA con un 404 (dice que no la tenemos y enseña las que sí). */
import { esc } from '../repartidores.js'
import { MARCA } from '../../src/marca.js'
import { COMPANIAS, DOCUMENTOS, LEIDA_TEXTO, tituloCompania } from '../../src/lib/guiasRenting.js'
import { RUTA, documentosDe, enlacesCompanias, fuenteHtml, preciosHtml, procesoHtml, servirConEtiquetas, tablaHtml } from '../devolucion-renting.js'

const VEHICULOS = { furgoneta: 'Furgonetas', turismo: 'Turismos' }

export function descripcionDe(c) {
  const docs = documentosDe(c).map(({ id }) => `${DOCUMENTOS[id].corto} (${DOCUMENTOS[id].edicion.charAt(0).toLowerCase()}${DOCUMENTOS[id].edicion.slice(1)})`).join(' y ')
  return c.tipo === 'alquiler'
    ? `Lo que ${c.nombre} dice que factura por los daños al devolver un vehículo de alquiler, criterio a criterio y con su página. Fuente: ${docs}.`
    : `Lo que ${c.nombre} acepta como desgaste normal y lo que factura al devolver el vehículo, criterio a criterio y con su página. Fuente: ${docs}.`
}

function contenido(c) {
  const docs = documentosDe(c)
  const cuerpo = docs.map(({ id, vehiculos }) => `
      ${docs.length > 1 ? `<h2>${esc(vehiculos.map((v) => VEHICULOS[v]).join(' y '))}</h2>` : ''}
      ${fuenteHtml(id)}
      <h2>Qué se cobra y qué no</h2>
      ${tablaHtml(id)}
      <h2>Precios que publica</h2>
      ${preciosHtml(id)}
      <h2>Cómo es la devolución, según este documento</h2>
      ${procesoHtml(id)}`).join('')
  return `<main style="max-width:52rem;margin:0 auto;padding:24px 16px;color:#10181a;background:#f5f6f3;font-family:system-ui,sans-serif">
      <h1>${esc(tituloCompania(c))}</h1>
      ${c.aviso ? `<p>${esc(c.aviso)}</p>` : ''}
      <p><a href="${RUTA}#c=${esc(c.slug)}" style="color:#0b6e69">Repasar mi vehículo con esta guía</a></p>
      ${cuerpo}
      <p>Leída el ${esc(LEIDA_TEXTO)}. Orientativo: decide el perito de ${esc(c.nombre)} con la guía que esté en vigor.</p>
      <h2>Otras compañías</h2>
      <ul>${enlacesCompanias(c.slug)}</ul>
    </main>`
}

export async function onRequestGet(context) {
  const slug = String(context.params?.compania || '')
  const c = COMPANIAS.find((x) => x.slug === slug)
  if (!c) {
    return servirConEtiquetas(context, {
      titulo: `No tenemos la guía de esa compañía · ${MARCA.nombre}`, descripcion: 'Las guías de devolución que hemos leído, compañía a compañía.',
      ruta: RUTA, estado: 404, html: `<main><h1>No tenemos la guía de esa compañía</h1><ul>${enlacesCompanias(null)}</ul></main>`,
    })
  }
  return servirConEtiquetas(context, { titulo: `${tituloCompania(c)} · ${MARCA.nombre}`, descripcion: descripcionDe(c), ruta: `${RUTA}/${c.slug}`, html: contenido(c) })
}
