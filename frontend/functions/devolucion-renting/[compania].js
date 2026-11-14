/* /devolucion-renting/<compañía> (14-11-2026): «Qué cobra <compañía> al devolver un vehículo». La pantalla es la SPA
 * (src/pages/devolucion/Compania.jsx); aquí va, para los buscadores, la misma página en HTML: la tabla de sus criterios
 * con la página de cada uno, la fuente con enlace, edición y fecha de lectura, sus precios y lo que dice del proceso.
 * Una compañía que no tenemos: la SPA con un 404 (dice que no la tenemos y enseña las que sí). */
import { esc } from '../repartidores.js'
import { MARCA } from '../../src/marca.js'
import { COMPANIAS, LEIDA_TEXTO, subtituloCompania, tituloCompania, vehiculoPara } from '../../src/lib/guiasRenting.js'
import { RUTA, documentosDe, enlacesCompanias, fuenteHtml, preciosHtml, procesoHtml, servirConEtiquetas, tablaHtml } from '../devolucion-renting.js'

const VEHICULOS = { furgoneta: 'Furgonetas', turismo: 'Turismos' }

/* La de cada compañía, escrita a mano en guiasRenting.js (155 caracteres como mucho: lo vigila check-guias-renting). */
export const descripcionDe = (c) => c.descripcion

function contenido(c) {
  const docs = documentosDe(c)
  const cuerpo = docs.map(({ id, vehiculos }) => `
      ${docs.length > 1 ? `<h2>${esc(vehiculos.map((v) => VEHICULOS[v]).join(' y '))}</h2>` : ''}
      ${fuenteHtml(id)}
      <h2>Qué acepta y qué no</h2>
      ${tablaHtml(id)}
      <h2>Precios que publica</h2>
      ${preciosHtml(id)}
      <h2>Cómo es la devolución, según este documento</h2>
      ${procesoHtml(id)}`).join('')
  return `<main style="max-width:52rem;margin:0 auto;padding:24px 16px;color:#10181a;background:#f5f6f3;font-family:system-ui,sans-serif">
      <h1>${esc(tituloCompania(c))}</h1>
      <p>${esc(subtituloCompania(c))}</p>
      ${c.aviso ? `<p>${esc(c.aviso)}</p>` : ''}
      <p><a href="${RUTA}#v=${vehiculoPara(c, 'furgoneta') === 'turismo' ? 't' : 'f'}&amp;c=${esc(c.slug)}" style="color:#0b6e69">Repasar mi vehículo con este documento</a></p>
      ${cuerpo}
      <p>Leído el ${esc(LEIDA_TEXTO)}. ${c.tipo === 'alquiler' ? `Orientativo: decide quien revise el vehículo en ${esc(c.nombre)}, con ${c.voz === 'condiciones' ? 'las condiciones que estén' : 'la tabla que esté'} en vigor.` : `Orientativo: decide el perito de ${esc(c.nombre)} con la guía que esté en vigor.`}</p>
      <h2>Otras compañías</h2>
      <ul>${enlacesCompanias(c.slug)}</ul>
    </main>`
}

export async function onRequestGet(context) {
  const slug = String(context.params?.compania || '')
  const c = COMPANIAS.find((x) => x.slug === slug)
  if (!c) {
    return servirConEtiquetas(context, {
      titulo: `No tenemos el documento de esa compañía · ${MARCA.nombre}`, descripcion: 'Los documentos de devolución que hemos leído, compañía a compañía.',
      ruta: RUTA, estado: 404, html: `<main><h1>No tenemos el documento de esa compañía</h1><ul>${enlacesCompanias(null)}</ul></main>`,
    })
  }
  return servirConEtiquetas(context, { titulo: `${tituloCompania(c)} · ${MARCA.nombre}`, descripcion: descripcionDe(c), ruta: `${RUTA}/${c.slug}`, html: contenido(c) })
}
