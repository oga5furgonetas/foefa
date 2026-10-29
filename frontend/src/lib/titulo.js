import { useEffect } from 'react'
import { MARCA } from '../marca'

/* EL TÍTULO DE LA PESTAÑA, POR PANTALLA (29-10-2026). Hasta hoy casi todas las páginas salían como «Flota — Gestión
   de flotas con IA» (el título de index.html) en Google, en el historial del móvil y al compartir, aunque fueran de
   FDS. Cada pantalla pone el suyo y al salir devuelve el anterior. */
export function tituloDe(texto) {
  return texto ? `${texto} · ${MARCA.nombre}` : `${MARCA.nombre} — ${MARCA.lema}`
}

export function useTitulo(texto) {
  useEffect(() => {
    const antes = document.title
    document.title = tituloDe(texto)
    return () => { document.title = antes }
  }, [texto])
}
