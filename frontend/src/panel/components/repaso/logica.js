/* EL REPASO DEL DÍA: las cuentas y el orden, sin React (14-11-2026). La pantalla es panel/pages/Repaso.jsx; la forma
   de los datos es la de `GET /api/repaso/dia` (CONTRATO «Antes del perito», §A). Todo lo de aquí se calcula sobre lo
   que hay en pantalla, para que las cuentas cambien en el momento en que alguien decide un lado, sin volver a pedir
   el día entero al servidor. */

export const VISTAS = ['frontal', 'trasera', 'lateral_izq', 'lateral_der']

// El nombre de cada lado. Una foto de carrocería sin vista conocida se nombra por su número.
const CLAVE_VISTA = {
  frontal: 'repaso.vista.frontal',
  trasera: 'repaso.vista.trasera',
  lateral_izq: 'repaso.vista.lateral_izq',
  lateral_der: 'repaso.vista.lateral_der',
}
export const nombreLado = (t, lado) => (CLAVE_VISTA[lado?.vista]
  ? t(CLAVE_VISTA[lado.vista])
  : t('repaso.vista.foto').replace('{n}', String(lado?.photo_index ?? '')))

/* LAS PIEZAS QUE SE SUGIEREN SEGÚN EL LADO. El valor va en español a propósito: el servidor decide a qué pieza del
   libro va cada golpe leyendo el texto (`_canon_panel`) y solo entiende el español. Lo que se enseña es la traducción. */
export const PIEZAS = {
  paragolpes_del: 'Paragolpes delantero',
  capo: 'Capó',
  rejilla: 'Rejilla delantera',
  faro_izq: 'Faro delantero izquierdo',
  faro_der: 'Faro delantero derecho',
  parabrisas: 'Parabrisas',
  aleta_del_izq: 'Aleta delantera izquierda',
  aleta_del_der: 'Aleta delantera derecha',
  paragolpes_tras: 'Paragolpes trasero',
  puerta_tras_izq: 'Puerta trasera izquierda',
  puerta_tras_der: 'Puerta trasera derecha',
  porton: 'Portón trasero',
  piloto_izq: 'Piloto trasero izquierdo',
  piloto_der: 'Piloto trasero derecho',
  puerta_del_izq: 'Puerta delantera izquierda',
  puerta_del_der: 'Puerta delantera derecha',
  corredera_izq: 'Puerta lateral corredera izquierda',
  corredera_der: 'Puerta lateral corredera derecha',
  lateral_izq: 'Panel lateral trasero izquierdo',
  lateral_der: 'Panel lateral trasero derecho',
  retrovisor_izq: 'Retrovisor izquierdo',
  retrovisor_der: 'Retrovisor derecho',
  faldon_izq: 'Faldón izquierdo',
  faldon_der: 'Faldón derecho',
  llanta_del_izq: 'Llanta delantera izquierda',
  llanta_tras_izq: 'Llanta trasera izquierda',
  llanta_del_der: 'Llanta delantera derecha',
  llanta_tras_der: 'Llanta trasera derecha',
}
export const PIEZAS_DEL_LADO = {
  frontal: ['paragolpes_del', 'capo', 'rejilla', 'faro_izq', 'faro_der', 'parabrisas', 'aleta_del_izq', 'aleta_del_der'],
  trasera: ['paragolpes_tras', 'puerta_tras_izq', 'puerta_tras_der', 'porton', 'piloto_izq', 'piloto_der'],
  lateral_izq: ['corredera_izq', 'puerta_del_izq', 'aleta_del_izq', 'lateral_izq', 'retrovisor_izq', 'faldon_izq',
    'llanta_del_izq', 'llanta_tras_izq'],
  lateral_der: ['corredera_der', 'puerta_del_der', 'aleta_del_der', 'lateral_der', 'retrovisor_der', 'faldon_der',
    'llanta_del_der', 'llanta_tras_der'],
  otra: ['paragolpes_del', 'paragolpes_tras', 'puerta_del_izq', 'puerta_del_der', 'retrovisor_izq', 'retrovisor_der'],
}

export const GRAVEDADES = ['leve', 'moderado', 'grave']

/* El estado de una revisión según sus lados, con los mismos nombres que el servidor (§A). Se recalcula aquí porque
   el `estado` que vino al cargar deja de valer en cuanto se marca un lado. */
export function estadoRevision(rev) {
  const lados = rev?.lados || []
  if (!lados.length) return 'sin_lados'
  const hechos = lados.filter((l) => l.veredicto).length
  if (!hechos) return 'sin_repasar'
  return hechos === lados.length ? 'repasada' : 'a_medias'
}
export const porRepasar = (rev) => {
  const e = estadoRevision(rev)
  return e === 'sin_repasar' || e === 'a_medias'
}
// Un golpe NUEVO: los que ya estaban al empezar (lado sin foto anterior) no cuentan como nuevos.
export const golpeNuevo = (lado) => lado?.veredicto === 'golpe' && !lado?.golpe?.ya_estaba

export function cuentasDelDia(dia) {
  const revs = dia?.revisiones || []
  const conLados = revs.filter((r) => (r.lados || []).length)
  const repasadas = conLados.filter((r) => estadoRevision(r) === 'repasada')
  const conGolpe = conLados.filter((r) => r.lados.some(golpeNuevo))
  return {
    revisiones: conLados.length,
    repasadas: repasadas.length,
    porRepasar: conLados.filter(porRepasar).length,
    sinGolpeNuevo: repasadas.filter((r) => !r.lados.some(golpeNuevo)).length,
    conGolpe: conGolpe.length,
    sinLados: revs.length - conLados.length,
    sinRevision: (dia?.sin_revision || []).length,
  }
}

export function golpesNuevosDelDia(dia) {
  const out = []
  for (const r of dia?.revisiones || []) {
    for (const l of r.lados || []) if (golpeNuevo(l)) out.push({ rev: r, lado: l })
  }
  return out
}

/* EL ORDEN DEL REPASO. Desde el lado que se acaba de mirar: el siguiente sin decidir de la misma furgoneta, luego las
   furgonetas que vienen detrás (en orden de llegada) y al final las de delante que se dejaron a medias. `null` = no
   queda nada por decidir ese día. */
export function siguienteFoco(revs, foco) {
  const lista = revs || []
  const ri = foco ? lista.findIndex((r) => r.id === foco.r) : -1
  const pendientes = (r, desde = 0) => (r.lados || []).slice(desde).find((l) => !l.veredicto)
  if (ri >= 0) {
    const rev = lista[ri]
    const li = (rev.lados || []).findIndex((l) => l.photo_index === foco.k)
    const mismo = pendientes(rev, li + 1) || pendientes(rev)
    if (mismo) return { r: rev.id, k: mismo.photo_index }
  }
  for (let n = 1; n <= lista.length; n++) {
    const rev = lista[(Math.max(ri, -1) + n + lista.length) % lista.length]
    if (!rev) continue
    const l = pendientes(rev)
    if (l) return { r: rev.id, k: l.photo_index }
  }
  return null
}
export const primerFoco = (revs) => siguienteFoco(revs, null)

// El lado `paso` posiciones más allá (o más acá) del que se mira, dentro de la misma revisión.
export function ladoVecino(rev, k, paso) {
  const lados = rev?.lados || []
  const i = lados.findIndex((l) => l.photo_index === k)
  const j = i + paso
  return j >= 0 && j < lados.length ? lados[j] : null
}

/* LAS FECHAS. Las del servidor son días de la empresa (AAAA-MM-DD) y horas «HH:MM» ya en su zona: aquí no se
   convierte ninguna zona. Para el sello de la foto se monta una fecha local con ese día y esa hora, así el sello dice
   lo mismo que el servidor mire quien mire. */
export function fechaDeSello(fecha, hora, respaldo) {
  if (fecha && /^\d{2}:\d{2}$/.test(hora || '')) {
    const d = new Date(`${fecha}T${hora}:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return respaldo || null
}

export function sumarDias(fecha, n) {
  const [a, m, d] = String(fecha).split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, d + n))
  return x.toISOString().slice(0, 10)
}

export function fechaLarga(fecha, locale = 'es-ES', conDiaSemana = true) {
  const [a, m, d] = String(fecha || '').split('-').map(Number)
  if (!a || !m || !d) return ''
  const x = new Date(Date.UTC(a, m - 1, d))
  try {
    return new Intl.DateTimeFormat(locale, {
      ...(conDiaSemana ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', timeZone: 'UTC',
    }).format(x)
  } catch {
    return fecha
  }
}

// «08:41» de una marca ISO en UTC, en la hora de quien mira (es la hora en que alguien de la oficina decidió).
export function horaDe(iso, locale = 'es-ES') {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

// La fecha de hoy en este navegador, solo para el tope del selector mientras el servidor no ha dicho cuál es su hoy.
export function hoyLocal() {
  const d = new Date()
  const dos = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

// Cambia un lado dentro del día, sin tocar lo demás.
export function conLado(dia, revId, lado) {
  return {
    ...dia,
    revisiones: (dia.revisiones || []).map((r) => (r.id !== revId ? r : {
      ...r,
      lados: r.lados.map((l) => (l.photo_index === lado.photo_index ? { ...l, ...lado } : l)),
    })),
  }
}

// Lo que se manda al servidor: la pieza en español si salió de una sugerencia (ver PIEZAS), si no lo escrito.
export function cuerpoGolpe(photoIndex, valor) {
  const part = valor.piezaClave ? PIEZAS[valor.piezaClave] : valor.pieza.trim()
  const nota = valor.nota.trim()
  return {
    photo_index: photoIndex, veredicto: 'golpe', part, severity: valor.gravedad, box_2d: valor.caja,
    ...(nota ? { description: nota } : {}),
  }
}
