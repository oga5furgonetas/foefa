/* diseño compacto */
/* Pinta el icono de una pieza (06-11-2026): se acepta el componente de lucide (Camera) o un elemento ya hecho
   (<Camera />). Los iconos no se leen (aria-hidden): el nombre va siempre en el texto o en el aria-label del botón. */
import { createElement, isValidElement } from 'react'

export default function icono(Icono, size, className) {
  if (!Icono) return null
  if (isValidElement(Icono)) return Icono
  return createElement(Icono, { size, 'aria-hidden': true, className })
}
