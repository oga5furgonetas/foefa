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

/* LAS PIEZAS QUE SE SUGIEREN SEGÚN EL LADO. La pieza viaja por su CLAVE (`pieza_clave`, CONTRATO «Correcciones tras
   la revisión», R1): el servidor tiene esta misma lista y una prueba suya comprueba que coincide con la de aquí. El
   nombre en español va también, en `part`, para un servidor que aún no conozca las claves; lo que se enseña en pantalla
   es siempre la traducción de la clave (`repaso.p.<clave>`). «Otra pieza» (`otra`) lleva el texto que escriba la
   persona, tal cual. */
export const PIEZA_OTRA = 'otra'
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

/* El nombre de una pieza tal como se enseña: el de su clave en el idioma de quien mira; si no tiene clave (golpes de
   antes, de «Revisión rápida» o «Otra pieza»), el texto que se guardó, tal cual. */
export function nombrePieza(t, clave, pieza) {
  if (clave && clave !== PIEZA_OTRA && Object.prototype.hasOwnProperty.call(PIEZAS, clave)) return t(`repaso.p.${clave}`)
  return pieza || ''
}

// ¿Está lo que pide el formulario del golpe? Devuelve la clave del texto de lo que falta, o '' si está todo.
export function faltaEnGolpe(valor, { sinFoto = false } = {}) {
  if (sinFoto) return 'repaso.golpe.falta.foto'
  if (!valor.caja) return 'repaso.golpe.falta.caja'
  if (!valor.piezaClave || (valor.piezaClave === PIEZA_OTRA && !valor.pieza.trim())) return 'repaso.golpe.falta.pieza'
  if (!valor.gravedad) return 'repaso.golpe.falta.gravedad'
  return ''
}

// Lo que se manda al servidor: la clave de la pieza y su nombre en español, o «otra» con lo que se escribió.
export function cuerpoGolpe(photoIndex, valor) {
  const otra = valor.piezaClave === PIEZA_OTRA
  const part = otra ? valor.pieza.trim() : PIEZAS[valor.piezaClave]
  const nota = valor.nota.trim()
  return {
    photo_index: photoIndex, veredicto: 'golpe', pieza_clave: valor.piezaClave, part, severity: valor.gravedad,
    box_2d: valor.caja, ...(nota ? { description: nota } : {}),
  }
}

/* LOS ERRORES DEL SERVIDOR, EN EL IDIOMA DE QUIEN MIRA. El servidor contesta en español (`{"detail": "…"}`) y sus
   mensajes de estas rutas son pocos y fijos (CONTRATO §A, §B.1, §B.2 y R1): cada uno, por su código y su texto, tiene
   aquí su clave. Uno que no esté en la lista se enseña tal cual, como último recurso. Los que solo pueden salir de un
   fallo de la propia pantalla (un número mal formado, un veredicto que no existe) se dicen todos igual. */
const ERRORES = {
  400: {
    'La fecha tiene que ser AAAA-MM-DD': 'repaso.err.peticion',
    'Ese día todavía no ha llegado': 'repaso.err.futuro',
    'Código de centro inválido': 'repaso.err.peticion',
    'Falta photo_index': 'repaso.err.peticion',
    'photo_index debe ser un numero': 'repaso.err.peticion',
    'El veredicto tiene que ser igual, golpe o no_se_ve': 'repaso.err.peticion',
    'La gravedad tiene que ser leve, moderado, grave o critico': 'repaso.err.peticion',
    'Esa foto no es de la carrocería': 'repaso.err.nocarroceria',
    'Indica la pieza': 'repaso.golpe.falta.pieza',
    'Esa pieza no es de la carrocería: elige otra': 'repaso.err.piezanocarroceria',
    'Esa pieza no está en la lista': 'repaso.err.piezanolista',
    'Dibuja la caja del golpe en la foto': 'repaso.golpe.falta.caja',
  },
  403: {
    'Acceso restringido a administradores': 'repaso.err.soloadmin',
    'No tienes acceso a ese centro': 'repaso.err.centro',
    'No tienes acceso a esa revisión': 'repaso.err.revision',
    'No tienes permiso para esa pantalla': 'repaso.err.permiso',
    'Tu cuenta no tiene esa pantalla': 'repaso.err.modulo',
  },
  404: {
    'Revisión no encontrada': 'repaso.err.norevision',
    'Ese lado no tiene veredicto': 'repaso.err.deshacer.yano',
  },
  409: {
    'Ese lado ya tiene veredicto. Deshazlo antes de cambiarlo.': 'repaso.err.yadecidido',
    'Ese golpe ya está en el taller o reparado: no se puede deshacer desde aquí.': 'repaso.err.deshacer.taller',
    'Ese lado se ha deshecho mientras se guardaba el golpe. Vuelve a mirarlo.': 'repaso.err.deshecho',
  },
  500: {
    'No se ha podido guardar el golpe. No ha quedado nada a medias: vuelve a marcarlo.': 'repaso.err.golpe500',
  },
}
export function textoDeError(t, e) {
  if (!e?.response) return e?.code === 'ECONNABORTED' ? t('repaso.err.lento') : t('repaso.err.red')
  const d = e.response.data?.detail
  const texto = typeof d === 'string' ? d.trim() : ''
  const clave = ERRORES[e.response.status]?.[texto]
  if (clave) return t(clave)
  return texto || t('repaso.err.servidor')
}
