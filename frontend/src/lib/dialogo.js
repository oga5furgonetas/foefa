/* UN DIÁLOGO QUE SE LLEVA BIEN CON EL TECLADO (10-11-2026).
   Las confirmaciones (bloquear a una persona en el mercadillo, quitarle el mercadillo a alguien en Negocio) se abrían sin mover
   el foco: quien va con teclado seguía «detrás», en la pantalla tapada, y Escape no hacía nada. Con esto:
     · al abrirse, el foco entra en el diálogo, al elemento de `foco` (un ref; normalmente «Cancelar», que es lo que no hace daño);
     · Escape lo cierra (`cerrar`), salvo mientras está `ocupado` enviando;
     · al cerrarse, el foco vuelve a donde estaba (el botón que lo abrió), si sigue en la página.
   `activo: false` mientras el diálogo tiene otra hoja encima: no atiende a Escape y, al volver a `true`, el foco entra otra vez. */
import { useEffect, useRef } from 'react'

export function useDialogo({ foco, cerrar, ocupado = false, activo = true }) {
  const ahora = useRef({ cerrar, ocupado })
  ahora.current = { cerrar, ocupado }
  // De dónde venía el foco: se apunta al abrirse y se devuelve al cerrarse. Va ANTES del efecto que lo mete dentro.
  useEffect(() => {
    const antes = document.activeElement
    return () => { if (antes && antes !== document.body && antes.isConnected) antes.focus?.() }
  }, [])
  useEffect(() => {
    if (!activo) return undefined
    foco?.current?.focus?.()
    const tecla = (e) => {
      if (e.key !== 'Escape' || ahora.current.ocupado) return
      e.preventDefault()
      ahora.current.cerrar?.()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [activo, foco])
}
