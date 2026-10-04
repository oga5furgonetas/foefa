import { useEffect, useState } from 'react'
import { TEXTOS } from './textosRuta'

/* IDIOMA DE LA APP DE REPARTO (04-10-2026)
   La app del repartidor (ruta, navegación, cuenta, alta, regalo, seguimiento)
   en 7 idiomas. La CLAVE es el propio texto en español: así el código se lee
   igual que antes y, si falta una traducción, sale el español (nunca una
   clave rara ni un hueco). Variables con {nombre}: tx('Quedan {n} paradas',
   { n: 3 }). El idioma: el que elija en «Cuenta», si no el del móvil, y si el
   móvil está en un idioma que no tenemos, inglés. */

export const IDIOMAS = {
  es: 'Español', en: 'English', pt: 'Português', fr: 'Français', it: 'Italiano', de: 'Deutsch', zh: '中文',
}
// Para la voz de la navegación y las fechas.
export const LOCALES = { es: 'es-ES', en: 'en-GB', pt: 'pt-PT', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', zh: 'zh-CN' }

const CLAVE = 'fds_idioma'
const oyentes = new Set()

export function idiomaDelMovil() {
  try {
    const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'es'
    const base = l.toLowerCase().split('-')[0]
    return IDIOMAS[base] ? base : 'en'
  } catch { return 'es' }
}

let actual = (() => {
  try { const g = localStorage.getItem(CLAVE); if (g && IDIOMAS[g]) return g } catch { /* nada */ }
  return typeof navigator === 'undefined' ? 'es' : idiomaDelMovil()
})()

export const idioma = () => actual
export const locale = () => LOCALES[actual] || 'es-ES'

export function cambiarIdioma(l) {
  if (!IDIOMAS[l]) return
  actual = l
  try { localStorage.setItem(CLAVE, l) } catch { /* nada */ }
  try { document.documentElement.lang = l } catch { /* nada */ }
  oyentes.forEach((f) => f(l))
}

export function tx(texto, vars) {
  let s = (actual !== 'es' && TEXTOS[texto] && TEXTOS[texto][actual]) || texto
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
  return s
}

/* Para que una pantalla se repinte al cambiar de idioma. */
export function useIdioma() {
  const [l, setL] = useState(actual)
  useEffect(() => { oyentes.add(setL); return () => oyentes.delete(setL) }, [])
  return l
}
