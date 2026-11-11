/* diseño compacto */
/* «Mis DNR» (11-11-2026, tanda 2): lo que comparten la pantalla y su casilla del inicio del portal.

   LAS NUEVAS, EN ESTE MÓVIL. Se apunta qué DNR vio (paquete → estado) la última vez que abrió la pantalla, por conductor
   (un móvil compartido no mezcla las de dos personas). Lo que no estaba es «nueva»; lo que cambió de estado (Amazon la ha
   clasificado), «actualizada», y se cuentan APARTE (revisión final, F4/F16): una que solo cambió de estado no es una DNR
   nueva y no suma al número rojo de la casilla. La primera vez no hay nada apuntado y todas son nuevas: nunca las ha
   visto. Es una comodidad de este móvil y nada más: si se borra, solo vuelven a salir como nuevas.
   Del paquete se apunta una HUELLA corta, no su código (revisión final, F13): en un móvil compartido, lo que queda tras
   «Salir» no dice qué paquetes eran. */
import { Fragment, createElement, useEffect, useState } from 'react'
import { PackageX } from 'lucide-react'
import { getMisDnr, DRIVER_TOKEN_KEY } from '../../services/api'
import { tx } from '../../lib/idioma'
import { lista } from '../../lib/lista'

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

const todas = (datos) => lista(datos?.semanas).flatMap((s) => lista(s?.dnr))

// La huella del paquete: FNV-1a de 32 bits en base 36 (6 o 7 letras). Distingue de sobra las pocas decenas de paquetes
// de 4 semanas y no deja leer el código.
export function huella(paquete) {
  const s = String(paquete)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}

export function leerVistas(id) {
  try {
    const v = JSON.parse(leer(clave(id)))
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch { return null }
}

export function guardarVistas(id, datos) {
  const m = {}
  for (const x of todas(datos)) if (x?.paquete) m[huella(x.paquete)] = x.estado
  poner(clave(id), JSON.stringify(m))
}

// {paquete: 'nueva' | 'actualizada'} de lo que no vio la última vez.
export function novedades(datos, vistas) {
  const out = {}
  for (const x of todas(datos)) {
    if (!x?.paquete) continue
    const h = huella(x.paquete)
    if (!vistas || !Object.prototype.hasOwnProperty.call(vistas, h)) out[x.paquete] = 'nueva'
    else if (vistas[h] !== x.estado) out[x.paquete] = 'actualizada'
  }
  return out
}

export const contar = (marcas, cual) => Object.values(marcas || {}).filter((m) => m === cual).length
export const cuantasNuevas = (n) => (n === 1 ? tx('1 nueva') : n > 1 ? tx('{n} nuevas', { n }) : '')
export const cuantasActualizadas = (n) => (n === 1 ? tx('1 actualizada') : n > 1 ? tx('{n} actualizadas', { n }) : '')
// «2 nuevas · 1 actualizada», o lo que haya; '' si no hay nada.
export const novedadesEnCorto = (marcas) =>
  [cuantasNuevas(contar(marcas, 'nueva')), cuantasActualizadas(contar(marcas, 'actualizada'))].filter(Boolean).join(' · ')

/* ESTA SEMANA, EN CUÁL DE LOS CASOS ESTÁ (revisión final, F3/F6). La DNR va por la fecha de concesión, que llega con unos
   días de retraso: de domingo a martes, más o menos, la semana en curso no tiene ni un dato y decir «no llevas ninguna»
   con la marca verde sería afirmar algo que no se sabe. La semana y `datos_hasta` (el último día con datos de su centro)
   los da el servidor; aquí no se calcula «hoy».
     'lleva'            → tiene DNR esta semana (si las hay, hay datos de esta semana);
     'sin_reportes'     → `datos_hasta` es null: su centro aún no tiene ningún reporte;
     'sin_datos_semana' → los datos acaban antes del domingo de esta semana;
     'ninguna'          → hay datos de esta semana y ninguna DNR suya.
   null si no hay semanas (sin ID, por ejemplo). */
export function casoSemana(datos) {
  const s = lista(datos?.semanas)[0]
  if (!s) return null
  if (lista(s.dnr).length > 0) return 'lleva'
  const hasta = datos?.datos_hasta
  if (!hasta) return 'sin_reportes'
  if (String(hasta) < String(s.semana)) return 'sin_datos_semana'
  return 'ninguna'
}

/* UNA VEZ CADA POCOS MINUTOS (11-11-2026, revisión de seguridad D7). La casilla del inicio se pinta cada vez que se vuelve
   al inicio, y antes cada vuelta pedía la ruta entera al servidor. Ahora la respuesta se guarda en memoria (no en el
   móvil) unos minutos por conductor y la casilla la reutiliza; las nuevas se recalculan con lo apuntado, así que al volver
   de la pantalla ya no salen. La pantalla siempre pide la suya y la deja aquí. El «no la tiene» (404 o 403) también se
   guarda. Al salir («Salir»), olvidarDnr() la vacía (revisión final, F2).

   Y EN EL MÓVIL, DOS MARCAS POR CONDUCTOR (revisión final, F20/F21), sin nada de sus DNR:
     - «la ha tenido» (al recibir un 200): con un fallo de red o un 5xx, la casilla sale sin número para que pueda entrar
       y ver el «Reintentar»; si no se sabe si la tiene, no sale.
     - «su empresa no la tiene» (al recibir un 404), 12 horas: en las empresas sin la DNR diaria el portal no la pide en
       cada apertura (ni deja un 404 en la consola y en el registro del servidor cada vez). Un 200 la borra. */
const CADA_MS = 3 * 60 * 1000
const NO_LA_TIENE_MS = 12 * 60 * 60 * 1000
const claveTiene = (id) => `fds_dnr_tiene_${id}`
const claveNo = (id) => `fds_dnr_no_${id}`
let reciente = null   // { id, at, datos } ; datos null = no la tiene (404) o no puede verla (403)

export function recordarDnr(id, datos) {
  const quien = yo(id)
  reciente = { id: quien, at: Date.now(), datos }
  if (datos) { poner(claveTiene(quien), '1'); poner(claveNo(quien), null) }
}

export function olvidarDnr() { reciente = null }

async function misDnrRecientes(id) {
  if (reciente && reciente.id === id && Date.now() - reciente.at < CADA_MS) return reciente.datos
  const no = Number(leer(claveNo(id)))
  if (no && Date.now() - no >= 0 && Date.now() - no < NO_LA_TIENE_MS) return null
  try {
    const r = await getMisDnr()
    recordarDnr(id, r.data || {})
    return r.data || {}
  } catch (e) {
    const st = e?.response?.status
    if (st === 404 || st === 403) {
      reciente = { id, at: Date.now(), datos: null }
      poner(claveTiene(id), null)
      if (st === 404) poner(claveNo(id), String(Date.now()))
    }
    throw e
  }
}

// Lo que dice la casilla debajo de su nombre, en corto, lo mismo que la frase grande de la pantalla.
function lineaCasilla(datos) {
  const caso = casoSemana(datos)
  if (!caso) return null
  if (caso === 'lleva') return tx('Esta semana: {n}', { n: lista(lista(datos.semanas)[0].dnr).length })
  if (caso === 'ninguna') return tx('Esta semana: ninguna')
  return tx('Esta semana: aún sin datos')
}

/* La casilla del inicio: sale solo si la empresa tiene la DNR diaria (si no, el servidor contesta 404 y no se pinta),
   con cuántas hay NUEVAS desde la última vez (el número rojo; las actualizadas no suman). Se mira al volver al inicio,
   como las respuestas sin leer. Debajo del nombre, lo mismo que la pantalla en corto (Dani, 11-11-2026): «Esta semana:
   2», «Esta semana: ninguna» o «Esta semana: aún sin datos». La casilla del portal solo pinta su título (el detalle es
   para el lector de pantalla), así que esa línea va dentro del título; el detalle dice cuántas son nuevas y cuántas
   actualizadas, porque el número rojo no se lee.
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
        const linea = lineaCasilla(datos)
        const titulo = linea
          ? createElement(Fragment, null, tx('Mis DNR'),
            createElement('span', { className: 'block text-sec text-dark-400', 'data-testid': 'dnr-casilla-semana' }, linea))
          : tx('Mis DNR')
        setEstado({ id, info: { titulo, nuevas: contar(marcas, 'nueva'), detalle: novedadesEnCorto(marcas) || undefined } })
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
