/* BUSCADOR DE DIRECCIONES (como el de Circuit o Google Maps): al escribir una
   calle salen sugerencias y, al tocar una, la parada entra ya con su punto
   exacto en el mapa (sin esperar a que el servidor la sitúe ni equivocarse de
   pueblo). Usa Photon (OpenStreetMap, sin clave). Solo sale el texto de la
   dirección que se escribe: nunca nombres ni teléfonos de clientes.
   Si el servicio no contesta, no pasa nada: se escribe la dirección entera
   y el servidor la sitúa como siempre. */

import { noToca, paraBuscar, punto } from './situar'

const URL = 'https://photon.komoot.io/api/'
/* CUÁNTAS (03-11-2026, igual en la app nativa): se piden 10 y aquí se quitan las que no tocan; el corte a 5 va LUEGO,
   ya marcadas con la dirección de la parada y con las de su calle delante (situar.js juntarSugerencias, como
   Situar.ordenar). Cortando antes, las de la calle buscada se podían quedar fuera detrás de otras que se quitaban. */
const PEDIDAS = 10
// La posición con la que Photon ordena lo que da (la del móvil, la zona o la base), a 2 decimales: unos 1 km basta
// para ordenar y no dice en qué calle está el móvil (03-11-2026, igual en la app nativa: «%.2f», «-8.40»).
const aKm = (x) => (Math.round(x * 100) / 100).toFixed(2)

export function etiqueta(p) {
  const calle = p.street || p.name || ''
  const linea1 = [calle, p.housenumber].filter(Boolean).join(' ')
  const linea2 = [p.postcode, p.city || p.town || p.village || p.district].filter(Boolean).join(' ')
  return [linea1, linea2].filter(Boolean).join(', ')
}

/* SIN EL PISO (C, 03-11-2026, el emulador; igual en la app nativa: urlPhoton). Photon toma el piso por el portal: con
   «Trav. de Meicende nº50 2 B, 15140, Arteixo» daba «Travesía de Meicende 2B», y al elegirla la parada quedaba con el
   punto del 2B, a 380 m del 50. A Photon va lo buscado sin el piso (situar.js paraBuscar; lo buscado si queda vacío),
   para la ficha (MiRuta) y para «Situar la parada»; lo que se quita (noToca) y se marca sigue mirando lo buscado y la
   dirección de la parada. Al servidor (POST /reparto/ubicar), como hasta ahora. */
export async function buscarDirecciones(texto, { cerca = null, pais = '', senal } = {}) {
  const q = String(texto || '').trim()
  if (q.length < 4) return []
  const params = new URLSearchParams({ q: paraBuscar(q) || q, limit: String(PEDIDAS) })
  const centro = cerca ? punto(cerca.lat, cerca.lng) : null
  if (centro) { params.set('lat', aKm(centro[0])); params.set('lon', aKm(centro[1])) }
  const r = await fetch(`${URL}?${params}`, { signal: senal })
  if (!r.ok) return []
  const j = await r.json()
  const vistos = new Set()
  const out = []
  for (const f of j.features || []) {
    const p = f.properties || {}
    const c = f.geometry?.coordinates
    if (!Array.isArray(c) || c.length < 2) continue
    if (pais && p.countrycode && String(p.countrycode).toLowerCase() !== pais) continue
    // Una dirección es una calle (con o sin número) o un sitio con nombre en una calle.
    if (!p.street && !p.name) continue
    const texto2 = etiqueta(p)
    if (!texto2 || vistos.has(texto2)) continue
    // LAS QUE NO TOCAN (03-11-2026, la regla de la app nativa: situar.js, noToca). Con una calle que no conoce, Photon
    // da otras del mismo CP con el mismo número («Rúa Almirante Mourelle 41» para «Rúa Valtrenxo 41»): con el número
    // en lo BUSCADO, la que no comparte con ello ninguna palabra que distinga la calle no sale. Sin número (un sitio
    // buscado por su nombre, o mientras se teclea), todo. La marca «Otra calle» no se pone aquí: va con la dirección
    // de la parada, que en «Situar» no es lo buscado (juntarSugerencias).
    if (noToca(q, texto2)) continue
    vistos.add(texto2)
    // `precision` (02-11-2026, como la app nativa): con su número es la casa («portal»); sin él, solo la calle o el
    // sitio («calle»), que la lista enseña como «Sin el portal» y que al elegirla no pisa el número escrito.
    out.push({ direccion: texto2, cp: p.postcode || '', localidad: p.city || p.town || p.village || '', lat: c[1], lng: c[0],
      precision: p.housenumber ? 'portal' : 'calle', fuente: 'photon' })
  }
  return out
}
