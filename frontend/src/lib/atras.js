/* EL BOTÓN «ATRÁS» DEL MÓVIL CIERRA LO ABIERTO (25-10-2026).
   Dani: «que no se vea como una web». En la app de Play (una TWA de Chrome) y en la instalada desde la web,
   el «atrás» de Android es el «atrás» del navegador: con una hoja abierta (añadir parada, entregar, el escáner,
   la navegación) se iba de la pantalla o CERRABA LA APP, y la hoja se perdía. Una app cierra primero la hoja.

   Cada capa abierta mete una entrada en el historial (la misma URL, con su marca); el «atrás» la saca y la capa
   se cierra. Si se cierra con su propio botón, se quita la entrada que puso, sin cerrar ninguna otra.
   Encadenadas (una hoja encima de otra), cierra la de arriba. Una capa que se cierra porque se navega a otra
   pantalla no toca el historial: su marca ya no es la entrada actual. */
import { useEffect, useRef } from 'react'

const pila = []          // las capas abiertas, la última arriba
let ignorar = 0          // «atrás» lanzados por nosotros al cerrar una capa con su botón
let escuchando = false

function alVolver() {
  if (ignorar > 0) { ignorar -= 1; return }
  const arriba = pila.pop()
  if (arriba) { arriba.porAtras = true; arriba.cerrar() }
}

export function useAtras(abierta, cerrar) {
  const cerrarRef = useRef(cerrar)
  cerrarRef.current = cerrar
  useEffect(() => {
    if (!abierta || typeof window === 'undefined') return undefined
    const capa = { id: `${Date.now()}-${Math.random()}`, porAtras: false, cerrar: () => cerrarRef.current?.() }
    try {
      window.history.pushState({ ...(window.history.state || {}), fdsCapa: capa.id }, '')
    } catch { return undefined }
    pila.push(capa)
    if (!escuchando) { window.addEventListener('popstate', alVolver); escuchando = true }
    return () => {
      const i = pila.indexOf(capa)
      if (i >= 0) pila.splice(i, 1)
      if (capa.porAtras) return
      try {
        if (window.history.state?.fdsCapa === capa.id) { ignorar += 1; window.history.back() }
      } catch { /* sin historial */ }
    }
  }, [abierta])
}
