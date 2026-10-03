/* LA GUÍA (navegación dentro de la app): cuentas de geometría sin librerías.
   Distancias en metros; puntos como [lat, lng]. Para tramos de calle (unos
   pocos km) basta proyectar en plano alrededor de la latitud de la ruta. */

const R = 6371000

export function metrosEntre(a, b) {
  const rad = Math.PI / 180
  const dLa = (b[0] - a[0]) * rad
  const dLo = (b[1] - a[1]) * rad
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLo / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Rumbo de a hacia b, en grados desde el norte (0-360).
export function rumbo(a, b) {
  const rad = Math.PI / 180
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad)
  const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad)
  return ((Math.atan2(y, x) / rad) + 360) % 360
}

/* Prepara una línea: lo recorrido hasta cada vértice. */
export function prepararLinea(linea) {
  const acum = [0]
  for (let i = 1; i < linea.length; i += 1) acum.push(acum[i - 1] + metrosEntre(linea[i - 1], linea[i]))
  return { linea, acum, total: acum[acum.length - 1] || 0 }
}

/* Dónde cae un punto sobre la línea: cuánto se lleva recorrido (`hecho`) y a
   cuántos metros está de ella (`fuera`). Busca en toda la línea: con unos
   miles de vértices son microsegundos. */
export function proyectar(prep, p) {
  const { linea, acum } = prep
  if (linea.length < 2) return { hecho: 0, fuera: linea.length ? metrosEntre(linea[0], p) : Infinity }
  const kx = Math.cos((p[0] * Math.PI) / 180) * 111320
  const ky = 110540
  let mejor = { hecho: 0, fuera: Infinity }
  for (let i = 0; i < linea.length - 1; i += 1) {
    const ax = linea[i][1] * kx; const ay = linea[i][0] * ky
    const bx = linea[i + 1][1] * kx; const by = linea[i + 1][0] * ky
    const px = p[1] * kx; const py = p[0] * ky
    const dx = bx - ax; const dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
    const cx = ax + t * dx; const cy = ay + t * dy
    const d = Math.hypot(px - cx, py - cy)
    if (d < mejor.fuera) mejor = { fuera: d, hecho: acum[i] + t * (acum[i + 1] - acum[i]) }
  }
  return mejor
}

/* Cada maniobra con lo recorrido hasta ella sobre la línea. */
export function situarPasos(prep, pasos) {
  return (pasos || []).map((p) => ({ ...p, hecho: proyectar(prep, p.punto).hecho }))
}

/* La próxima maniobra por delante (con 8 m de margen para no quedarse
   anunciando la que se acaba de hacer). La salida no cuenta. */
export function proximoPaso(pasos, hecho) {
  for (let i = 0; i < pasos.length; i += 1) {
    if (i === 0 && pasos.length > 1) continue
    if (pasos[i].hecho > hecho + 8) return i
  }
  return pasos.length - 1
}

export function textoDistancia(m) {
  if (m == null || !Number.isFinite(m)) return ''
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

// Lo mismo pero para decirlo en voz alta.
export function distanciaHablada(m) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} metros`
  const km = Math.round(m / 100) / 10
  return km === 1 ? '1 kilómetro' : `${String(km).replace('.', ',')} kilómetros`
}
