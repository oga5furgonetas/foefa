/* BUSCADOR DE DIRECCIONES (como el de Circuit o Google Maps): al escribir una
   calle salen sugerencias y, al tocar una, la parada entra ya con su punto
   exacto en el mapa (sin esperar a que el servidor la sitúe ni equivocarse de
   pueblo). Usa Photon (OpenStreetMap, sin clave). Solo sale el texto de la
   dirección que se escribe: nunca nombres ni teléfonos de clientes.
   Si el servicio no contesta, no pasa nada: se escribe la dirección entera
   y el servidor la sitúa como siempre. */

const URL = 'https://photon.komoot.io/api/'

export function etiqueta(p) {
  const calle = p.street || p.name || ''
  const linea1 = [calle, p.housenumber].filter(Boolean).join(' ')
  const linea2 = [p.postcode, p.city || p.town || p.village || p.district].filter(Boolean).join(' ')
  return [linea1, linea2].filter(Boolean).join(', ')
}

export async function buscarDirecciones(texto, { cerca = null, pais = '', senal } = {}) {
  const q = String(texto || '').trim()
  if (q.length < 4) return []
  const params = new URLSearchParams({ q, limit: '8' })
  if (cerca && cerca.lat != null) { params.set('lat', String(cerca.lat)); params.set('lon', String(cerca.lng)) }
  const r = await fetch(`${URL}?${params}`, { signal: senal })
  if (!r.ok) return []
  const j = await r.json()
  const vistos = new Set()
  const salida = []
  for (const f of j.features || []) {
    const p = f.properties || {}
    const c = f.geometry?.coordinates
    if (!Array.isArray(c) || c.length < 2) continue
    if (pais && p.countrycode && String(p.countrycode).toLowerCase() !== pais) continue
    // Una dirección es una calle (con o sin número) o un sitio con nombre en una calle.
    if (!p.street && !p.name) continue
    const texto2 = etiqueta(p)
    if (!texto2 || vistos.has(texto2)) continue
    vistos.add(texto2)
    salida.push({ direccion: texto2, cp: p.postcode || '', localidad: p.city || p.town || p.village || '', lat: c[1], lng: c[0] })
    if (salida.length >= 5) break
  }
  return salida
}
