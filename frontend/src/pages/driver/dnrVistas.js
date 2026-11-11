/* diseño compacto */
/* «Mis DNR» (11-11-2026, tanda 2): lo que comparten la pantalla y su casilla del inicio del portal.

   LAS NUEVAS, EN ESTE MÓVIL. Se apunta qué DNR vio (paquete → estado) la última vez que abrió la pantalla, por conductor
   (un móvil compartido no mezcla las de dos personas). Lo que no estaba es «nueva»; lo que cambió de estado (Amazon la ha
   clasificado), «actualizada». La primera vez no hay nada apuntado y todas son nuevas: nunca las ha visto. Es una
   comodidad de este móvil y nada más: si se borra, solo vuelven a salir como nuevas. */
import { Fragment, createElement, useEffect, useState } from 'react'
import { PackageX } from 'lucide-react'
import { getMisDnr } from '../../services/api'
import { tx } from '../../lib/idioma'
import { lista } from '../../lib/lista'

// El mismo icono en la casilla y en la pantalla.
export const IconoDnr = PackageX

const clave = (id) => `fds_dnr_vistas_${id || 'yo'}`

const todas = (datos) => lista(datos?.semanas).flatMap((s) => lista(s?.dnr))

export function leerVistas(id) {
  try {
    const v = JSON.parse(localStorage.getItem(clave(id)))
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch { return null }
}

export function guardarVistas(id, datos) {
  const m = {}
  for (const x of todas(datos)) if (x?.paquete) m[x.paquete] = x.estado
  try { localStorage.setItem(clave(id), JSON.stringify(m)) } catch { /* modo privado: la próxima vez saldrán como nuevas */ }
}

// {paquete: 'nueva' | 'actualizada'} de lo que no vio la última vez.
export function novedades(datos, vistas) {
  const out = {}
  for (const x of todas(datos)) {
    if (!x?.paquete) continue
    if (!vistas || !Object.prototype.hasOwnProperty.call(vistas, x.paquete)) out[x.paquete] = 'nueva'
    else if (vistas[x.paquete] !== x.estado) out[x.paquete] = 'actualizada'
  }
  return out
}

/* UNA VEZ CADA POCOS MINUTOS (11-11-2026, revisión de seguridad D7). La casilla del inicio se pinta cada vez que se vuelve
   al inicio, y antes cada vuelta pedía la ruta entera al servidor. Ahora la respuesta se guarda en memoria (no en el
   móvil) unos minutos por conductor y la casilla la reutiliza; las nuevas se recalculan con lo apuntado, así que al volver
   de la pantalla ya no salen. La pantalla siempre pide la suya y la deja aquí. El «no la tiene» (404) también se guarda. */
const CADA_MS = 3 * 60 * 1000
let reciente = null   // { id, at, datos } ; datos null = su empresa no tiene la DNR diaria

export function recordarDnr(id, datos) {
  reciente = { id, at: Date.now(), datos }
}

async function misDnrRecientes(id) {
  if (reciente && reciente.id === id && Date.now() - reciente.at < CADA_MS) return reciente.datos
  try {
    const r = await getMisDnr()
    recordarDnr(id, r.data || {})
    return r.data || {}
  } catch (e) {
    if (e?.response?.status === 404) recordarDnr(id, null)
    throw e
  }
}

/* La casilla del inicio: sale solo si la empresa tiene la DNR diaria (si no, el servidor contesta 404 y no se pinta),
   con cuántas hay nuevas desde la última vez (el número rojo). Se mira al volver al inicio, como las respuestas sin
   leer. Debajo del nombre, lo mismo que la pantalla en corto (Dani, 11-11-2026): «Esta semana: 2» o «Esta semana:
   ninguna». La casilla del portal solo pinta su título (el detalle es para el lector de pantalla), así que esa línea va
   dentro del título; el detalle dice cuántas son nuevas, porque el número rojo no se lee. */
export function useCasillaDnr(driver, vista) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    if (!driver || vista !== 'inicio') return undefined
    let vivo = true
    misDnrRecientes(driver.id)
      .then((datos) => {
        if (!vivo) return
        if (!datos) { setInfo(null); return }
        const r = { data: datos }
        const n = Object.keys(novedades(r.data, leerVistas(driver.id))).length
        const semana = lista(r.data?.semanas)[0]
        const esta = semana ? lista(semana.dnr).length : null
        const linea = esta == null ? null : esta ? tx('Esta semana: {n}', { n: esta }) : tx('Esta semana: ninguna')
        const titulo = linea
          ? createElement(Fragment, null, tx('Mis DNR'),
            createElement('span', { className: 'block text-sec text-dark-400', 'data-testid': 'dnr-casilla-semana' }, linea))
          : tx('Mis DNR')
        setInfo({ titulo, nuevas: n, detalle: n === 1 ? tx('1 nueva') : n > 1 ? tx('{n} nuevas', { n }) : undefined })
      })
      .catch(() => { if (vivo) setInfo(null) })
    return () => { vivo = false }
  }, [driver, vista])
  return info
}
