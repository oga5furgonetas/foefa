/* diseño compacto */
/* «Mis DNR» (11-11-2026, tanda 2): lo que comparten la pantalla y su casilla del inicio del portal.

   LAS NUEVAS, EN ESTE MÓVIL. Se apunta qué DNR vio (paquete → estado) la última vez que abrió la pantalla, por conductor
   (un móvil compartido no mezcla las de dos personas). Lo que no estaba es «nueva»; lo que cambió de estado (Amazon la ha
   clasificado), «actualizada», y se cuentan APARTE (revisión final, F4/F16): una que solo cambió de estado no es una DNR
   nueva y no suma al número rojo de la casilla. La primera vez no hay nada apuntado y todas son nuevas: nunca las ha
   visto. Es una comodidad de este móvil y nada más: si se borra, solo vuelven a salir como nuevas.
   Lo apuntado se JUNTA con lo de antes (comprobación de las correcciones, G12): una DNR que deja de venir un rato (su ID
   entra en revisión, la oficina le cambia el ID…) y vuelve no sale otra vez como «nueva». Lo que lleva más de 5 semanas
   sin verse se poda (la pantalla solo enseña 4).
   Del paquete se apunta una HUELLA corta, no su código (revisión final, F13), con una SAL al azar de este móvil, guardada
   una vez (G9). Lo que eso da y lo que no: la huella no se lee como un código y no es la misma en dos móviles, así que no
   sirve una lista de huellas hecha de antemano; pero NO es un cifrado: quien tenga este móvil tiene también la sal y,
   probando códigos de uno en uno, puede confirmar si un paquete estaba. */
import { createElement, useEffect, useState } from 'react'
import { PackageX } from 'lucide-react'
import { getMisDnr, DRIVER_TOKEN_KEY } from '../../services/api'
import { tx } from '../../lib/idioma'
import { lista } from '../../lib/lista'
import { PAUSAS } from './dnrPausas'

// El mismo icono en la casilla y en la pantalla.
export const IconoDnr = PackageX

/* QUIÉN ES (revisión final, F2). La ficha guardada en el móvil no siempre trae el id: quien entra con contraseña la guarda
   sin él (DriverLogin). Sin id, dos conductores del mismo móvil compartían lo apuntado y la casilla de uno se le pintaba al
   otro. Si falta, se saca de la sesión (el `sub` del token, que es su ficha). */
function subDelToken() {
  try {
    const p = (localStorage.getItem(DRIVER_TOKEN_KEY) || '').split('.')[1]
    if (!p) return null
    const sub = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))?.sub
    return typeof sub === 'string' && sub ? sub : null
  } catch { return null }
}
export const yo = (id) => id || subDelToken() || 'yo'

const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const poner = (k, v) => {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* modo privado */ }
}

const clave = (id) => `fds_dnr_vistas_${yo(id)}`
const CLAVE_SAL = 'fds_dnr_sal'
const PODA_MS = 5 * 7 * 24 * 60 * 60 * 1000   // 5 semanas sin verse

const todas = (datos) => lista(datos?.semanas).flatMap((s) => lista(s?.dnr))

// La sal de este móvil: unas letras al azar, una vez (G9). Sin almacenamiento (modo privado) sale otra cada vez y, como
// tampoco se guarda lo apuntado, no cambia nada.
function sal() {
  let s = leer(CLAVE_SAL)
  if (!s) {
    try {
      const a = new Uint32Array(2)
      crypto.getRandomValues(a)
      s = Array.from(a, (n) => n.toString(36)).join('')
    } catch { s = Math.random().toString(36).slice(2) }
    poner(CLAVE_SAL, s)
  }
  return s
}

// La huella del paquete: FNV-1a de 32 bits, con la sal delante, en base 36 (6 o 7 letras). Distingue de sobra las pocas
// decenas de paquetes de 4 semanas.
export function huella(paquete, conSal = sal()) {
  const s = `${conSal}|${paquete}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}

// Lo apuntado, como {huella: {e: estado, t: cuándo se vio por última vez}}. Lo de antes de G12 era {huella: estado}: se lee
// igual, como visto ahora.
export function leerVistas(id) {
  try {
    const v = JSON.parse(leer(clave(id)))
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    const ahora = Date.now()
    const out = {}
    for (const [h, x] of Object.entries(v)) {
      if (typeof x === 'string') out[h] = { e: x, t: ahora }
      else if (x && typeof x === 'object' && typeof x.e === 'string') out[h] = { e: x.e, t: Number(x.t) || ahora }
    }
    return out
  } catch { return null }
}

export function guardarVistas(id, datos) {
  const ahora = Date.now()
  const m = {}
  for (const [h, x] of Object.entries(leerVistas(id) || {})) if (ahora - x.t < PODA_MS) m[h] = x
  const s = sal()
  for (const x of todas(datos)) if (x?.paquete) m[huella(x.paquete, s)] = { e: x.estado, t: ahora }
  poner(clave(id), JSON.stringify(m))
}

// {paquete: 'nueva' | 'actualizada'} de lo que no vio la última vez. Con el estado EN PAUSA (dnrPausas.js, 11-11-2026: la
// pantalla no dice si le cuenta), una que solo cambió de estado no es novedad: ni se marca ni cuenta. Lo apuntado sigue
// guardando el estado, para que al volver a enseñarlo se compare con lo que vio.
export function novedades(datos, vistas) {
  const out = {}
  const s = sal()
  for (const x of todas(datos)) {
    if (!x?.paquete) continue
    const h = huella(x.paquete, s)
    if (!vistas || !Object.prototype.hasOwnProperty.call(vistas, h)) out[x.paquete] = 'nueva'
    else if (!PAUSAS.estado && vistas[h].e !== x.estado) out[x.paquete] = 'actualizada'
  }
  return out
}

export const contar = (marcas, cual) => Object.values(marcas || {}).filter((m) => m === cual).length
export const cuantasNuevas = (n) => (n === 1 ? tx('1 nueva') : n > 1 ? tx('{n} nuevas', { n }) : '')
export const cuantasActualizadas = (n) => (n === 1 ? tx('1 actualizada') : n > 1 ? tx('{n} actualizadas', { n }) : '')
// «2 nuevas · 1 actualizada», o lo que haya; '' si no hay nada.
export const novedadesEnCorto = (marcas) =>
  [cuantasNuevas(contar(marcas, 'nueva')), cuantasActualizadas(contar(marcas, 'actualizada'))].filter(Boolean).join(' · ')

/* ESTA SEMANA, EN CUÁL DE LOS CASOS ESTÁ (revisión final, F3/F6; y G3). La DNR va por la fecha de concesión, que llega con
   unos días de retraso: de domingo a martes, más o menos, la semana en curso no tiene ni un dato y decir «ninguna» con la
   marca verde sería afirmar algo que no se sabe. Con uno de sus ID en revisión (G3), el servidor quita las DNR de ese ID:
   tampoco se sabe si lleva «ninguna» ni si las que se ven son todas. La semana y `datos_hasta` (el último día con datos de
   su centro) los da el servidor; aquí no se calcula «hoy».
     'lleva'            → tiene DNR esta semana (si las hay, hay datos de esta semana);
     'lleva_revision'   → tiene DNR esta semana, pero puede faltar alguna (en revisión): el número no es el total;
     'sin_reportes'     → `datos_hasta` es null: su centro aún no tiene ningún reporte;
     'sin_datos_semana' → los datos acaban antes del domingo de esta semana;
     'en_revision'      → hay datos de esta semana, ninguna a la vista, y uno de sus ID está en revisión;
     'ninguna'          → hay datos de esta semana y ninguna DNR suya.
   null si no hay semanas (sin ID, por ejemplo). */
export function casoSemana(datos) {
  const s = lista(datos?.semanas)[0]
  if (!s) return null
  const revision = !!datos?.en_revision
  if (lista(s.dnr).length > 0) return revision ? 'lleva_revision' : 'lleva'
  const hasta = datos?.datos_hasta
  if (!hasta) return 'sin_reportes'
  if (String(hasta) < String(s.semana)) return 'sin_datos_semana'
  return revision ? 'en_revision' : 'ninguna'
}

/* Una semana anterior sin DNR (G5/G7): «Ninguna» con la marca verde solo si hay datos de esa semana y no hay nada en
   revisión; sin datos de esa semana (o ninguno), «Sin datos», neutra; con un ID en revisión, «Ninguna» neutra (puede
   faltar alguna: no se celebra). */
export function vaciaAnterior(datos, s) {
  const hasta = datos?.datos_hasta
  if (!hasta || String(hasta) < String(s?.semana)) return 'sin_datos'
  return datos?.en_revision ? 'neutra' : 'ninguna'
}

/* UNA VEZ CADA POCOS MINUTOS (11-11-2026, revisión de seguridad D7). La casilla del inicio se pinta cada vez que se vuelve
   al inicio, y antes cada vuelta pedía la ruta entera al servidor. Ahora la respuesta se guarda en memoria (no en el
   móvil) unos minutos por conductor y la casilla la reutiliza; las nuevas se recalculan con lo apuntado, así que al volver
   de la pantalla ya no salen. La pantalla siempre pide la suya y la deja aquí. El «no la tiene» (404 o 403) también se
   guarda. Al salir («Salir»), olvidarDnr() la vacía (revisión final, F2).

   Y EN EL MÓVIL, DOS MARCAS POR CONDUCTOR (revisión final, F20/F21), sin nada de sus DNR:
     - «la ha tenido» (al recibir un 200): con un fallo de red o un 5xx, la casilla sale sin número para que pueda entrar
       y ver el «Reintentar»; si no se sabe si la tiene, no sale.
     - «su empresa no la tiene», 12 horas: en las empresas sin la DNR diaria el portal no la pide en cada apertura (ni deja
       un 404 en la consola y en el registro del servidor cada vez). Un 200 la borra. SOLO con el 404 propio de la ruta,
       `{"detail": "Sin DNR diaria"}` (G10): el 404 genérico de un servidor que aún no tiene la ruta (durante un despliegue
       o tras una vuelta atrás) esconde la casilla, pero solo los minutos de la memoria. */
const CADA_MS = 3 * 60 * 1000
const NO_LA_TIENE_MS = 12 * 60 * 60 * 1000
export const SIN_DNR_DIARIA = 'Sin DNR diaria'
const claveTiene = (id) => `fds_dnr_tiene_${id}`
const claveNo = (id) => `fds_dnr_no_${id}`
let reciente = null   // { id, at, datos } ; datos null = no la tiene (404) o no puede verla (403)

export function recordarDnr(id, datos) {
  const quien = yo(id)
  reciente = { id: quien, at: Date.now(), datos }
  if (datos) { poner(claveTiene(quien), '1'); poner(claveNo(quien), null) }
}

export function olvidarDnr() { reciente = null }

/* Un 404 o un 403 quiere decir «aquí no hay Mis DNR para ti»: se apunta (como arriba) y devuelve true. Lo usan la casilla
   y la pantalla (G8: abierta por ?vista=dnr, vuelve al inicio en vez de ofrecer un «Reintentar» que nunca sirve). */
export function apuntarSinDnr(id, e) {
  const st = e?.response?.status
  if (st !== 404 && st !== 403) return false
  const quien = yo(id)
  reciente = { id: quien, at: Date.now(), datos: null }
  poner(claveTiene(quien), null)
  if (st === 404 && e?.response?.data?.detail === SIN_DNR_DIARIA) poner(claveNo(quien), String(Date.now()))
  return true
}

async function misDnrRecientes(id) {
  if (reciente && reciente.id === id && Date.now() - reciente.at < CADA_MS) return reciente.datos
  const no = Number(leer(claveNo(id)))
  if (no && Date.now() - no >= 0 && Date.now() - no < NO_LA_TIENE_MS) return null
  try {
    const r = await getMisDnr()
    recordarDnr(id, r.data || {})
    return r.data || {}
  } catch (e) {
    apuntarSinDnr(id, e)
    throw e
  }
}

/* Lo que dice la casilla debajo de su nombre, en corto, lo mismo que la pantalla. Con uno de sus ID en revisión, «en
   revisión» (G3): ni «ninguna» ni un número que puede no ser el total. Más cortas que antes (G6: «Esta semana: aún sin
   datos» no cabía en alemán ni en francés y se cortaba justo en «Daten»). El número va pegado a sus dos puntos y los dos
   puntos del francés a su palabra, con espacios duros (G14): ni el «4» ni el «:» se quedan solos en otra línea. Entre los
   dos puntos y una palabra («keine Daten») el espacio es normal: pegados, en alemán no cabían en dos líneas. Se hace al
   pintarla, no en la clave: la app nativa usa la misma clave en español. */
const pegado = (s) => s.replace(/ :/g, ' :').replace(/: (?=\d)/g, ': ')
function lineaCasilla(datos) {
  if (datos?.en_revision) return pegado(tx('Esta semana: en revisión'))
  const caso = casoSemana(datos)
  if (!caso) return null
  if (caso === 'lleva') return pegado(tx('Esta semana: {n}', { n: lista(lista(datos.semanas)[0].dnr).length }))
  if (caso === 'ninguna') return pegado(tx('Esta semana: ninguna'))
  return pegado(tx('Esta semana: sin datos'))
}

/* La casilla del inicio: sale solo si la empresa tiene la DNR diaria (si no, el servidor contesta 404 y no se pinta),
   con cuántas hay NUEVAS desde la última vez (el número rojo; las actualizadas no suman). Se mira al volver al inicio,
   como las respuestas sin leer. Debajo del nombre, lo mismo que la pantalla en corto (Dani, 11-11-2026): «Esta semana:
   2», «Esta semana: ninguna», «Esta semana: sin datos» o «Esta semana: en revisión». Esa línea va APARTE del título
   (`linea`, G6): el título se recorta a tres líneas y la cortaba. El detalle (para el lector de pantalla) dice cuántas
   son nuevas y cuántas actualizadas, porque el número rojo no se lee.
   El resultado se guarda con el conductor al que pertenece y solo se devuelve si es el de ahora (revisión final, F2): al
   salir y entrar otro en el mismo móvil, la casilla no enseña ni un momento lo del anterior. */
export function useCasillaDnr(driver, vista) {
  const id = driver ? yo(driver.id) : null
  const [estado, setEstado] = useState(null)   // { id, info }
  useEffect(() => {
    if (!id || vista !== 'inicio') return undefined
    let vivo = true
    misDnrRecientes(id)
      .then((datos) => {
        if (!vivo) return
        if (!datos) { setEstado({ id, info: null }); return }
        const marcas = novedades(datos, leerVistas(id))
        const texto = lineaCasilla(datos)
        const linea = texto ? createElement('span', { 'data-testid': 'dnr-casilla-semana' }, texto) : null
        setEstado({ id, info: { titulo: tx('Mis DNR'), linea, nuevas: contar(marcas, 'nueva'), detalle: novedadesEnCorto(marcas) || undefined } })
      })
      .catch((e) => {
        if (!vivo) return
        const st = e?.response?.status
        const fallo = !e?.response || st >= 500
        setEstado({ id, info: fallo && leer(claveTiene(id)) ? { titulo: tx('Mis DNR'), nuevas: 0 } : null })
      })
    return () => { vivo = false }
  }, [driver, vista, id])
  return estado && estado.id === id ? estado.info : null
}
