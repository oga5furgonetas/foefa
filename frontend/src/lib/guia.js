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
const sinTraducir = (t, v) => t.replace(/\{(\w+)\}/g, (x, k) => (v && v[k] != null ? String(v[k]) : x))
export function distanciaHablada(m, tx = sinTraducir) {
  if (m < 1000) return tx('{n} metros', { n: Math.max(10, Math.round(m / 10) * 10) })
  const km = Math.round(m / 100) / 10
  return km === 1 ? tx('1 kilómetro') : tx('{n} kilómetros', { n: String(km).replace('.', ',') })
}

/* LA FRASE DE CADA MANIOBRA, EN EL IDIOMA DE LA APP. El servidor manda la
   maniobra en bruto (tipo, modificador y salida de OSRM) y aquí se escribe;
   si no viene (respuestas guardadas de antes), la frase del servidor. Misma
   lógica que reparto.instruccion en el servidor. */
const GIROS = {
  uturn: 'Da la vuelta', 'sharp right': 'Gira cerrado a la derecha', right: 'Gira a la derecha',
  'slight right': 'Ligeramente a la derecha', straight: 'Sigue recto', 'slight left': 'Ligeramente a la izquierda',
  left: 'Gira a la izquierda', 'sharp left': 'Gira cerrado a la izquierda',
}
const ORDINALES = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima']

export function textoPaso(paso, tx) {
  const m = paso?.maniobra
  if (!m || !m.tipo) return paso?.texto ? tx(paso.texto) : ''
  const calle = (paso.calle || '').trim()
  const por = (accion) => (calle ? tx('{accion} por {calle}', { accion, calle }) : accion)
  const giro = tx(GIROS[m.mod] || 'Sigue')
  switch (m.tipo) {
    case 'hacia_parada': return tx('Ve hacia la parada')
    case 'depart': return calle ? tx('Sal por {calle}', { calle }) : tx('Empieza la ruta')
    case 'arrive': return tx('Has llegado')
    case 'roundabout': case 'rotary':
      return m.salida >= 1 && m.salida <= 10
        ? por(tx('En la rotonda, toma la {n} salida', { n: tx(ORDINALES[m.salida - 1]) }))
        : por(tx('Entra en la rotonda'))
    case 'exit roundabout': case 'exit rotary': return por(tx('Sal de la rotonda'))
    case 'roundabout turn': return por(tx('En la rotonda, {giro}', { giro: giro.charAt(0).toLowerCase() + giro.slice(1) }))
    case 'new name': case 'continue':
      if (!m.mod || m.mod === 'straight') return por(tx('Sigue recto'))
      return por(giro)
    case 'fork': {
      const lado = m.mod.includes('right') ? tx('a la derecha') : m.mod.includes('left') ? tx('a la izquierda') : tx('recto')
      return por(tx('En la bifurcación, mantente {lado}', { lado }))
    }
    case 'merge': return por(tx('Incorpórate'))
    case 'on ramp': return por(tx('Toma la entrada'))
    case 'off ramp': return por(tx('Toma la salida'))
    case 'end of road': return por(tx('Al final de la calle, {giro}', { giro: giro.charAt(0).toLowerCase() + giro.slice(1) }))
    default: return por(giro)
  }
}
