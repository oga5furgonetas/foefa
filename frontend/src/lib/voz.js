/* LA VOZ DE LA APP (01-11-2026). Una sola función para hablar, la usan la guía dentro de la app (Navegacion.jsx), el
   briefing de la siguiente parada y la carga guiada (MiRuta.jsx). La preferencia es la misma que la de la guía por voz
   («guia_voz» en localStorage): si el repartidor la apagó allí, aquí tampoco se habla. */
import { locale } from './idioma'

export function vozActiva() {
  try { return localStorage.getItem('guia_voz') !== '0' } catch { return true }
}

export function cambiarVoz(activa) {
  try { localStorage.setItem('guia_voz', activa ? '1' : '0') } catch { /* nada */ }
  if (!activa) try { window.speechSynthesis?.cancel() } catch { /* nada */ }
}

/* Dice un texto en el idioma de la cuenta, con la voz del móvil que lo hable. Corta lo que estuviera diciendo, salvo con
   `cola` (el briefing: espera a que la guía acabe su maniobra en vez de pisarla). */
export function decir(texto, { cola = false } = {}) {
  try {
    const s = window.speechSynthesis
    if (!s || !texto) return
    if (!cola) s.cancel()
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = locale()
    const base = locale().slice(0, 2).toLowerCase()
    const v = s.getVoices().find((x) => (x.lang || '').toLowerCase().startsWith(base))
    if (v) u.voice = v
    s.speak(u)
  } catch { /* sin voz en este móvil: se sigue viendo */ }
}
