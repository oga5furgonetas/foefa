/* LAS FECHAS DEL EXPEDIENTE (14-11-2026). El servidor da cada día como «AAAA-MM-DD» y cada hora como «HH:MM», ya en
   la zona de la empresa (CONTRATO.md §1): aquí se pintan TAL CUAL, sin pasar por la zona de quien mira, para que el
   documento diga lo mismo impreso en Madrid que abierto en Canarias. Solo las marcas sueltas en UTC (`*_at` sin su
   `hora`: cuándo se marcó un golpe o se reparó) se pasan a la hora local del navegador. */

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/
const HORA = /^(\d{2}):(\d{2})$/

/** «2026-11-12» → Date a las 00:00 locales de ese día; null si no vale. */
export function diaLocal(texto) {
  const m = DIA.exec(String(texto ?? ''))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** El día y la hora que dio el servidor, como un Date local con esos mismos números (para SelloFoto). Sin hora
    válida, la marca UTC tal cual (la convierte el navegador); sin nada, null. */
export function momento(fecha, hora, at) {
  const d = diaLocal(fecha)
  const h = HORA.exec(String(hora ?? ''))
  if (d && h) { d.setHours(Number(h[1]), Number(h[2])); return d }
  if (at) { const x = new Date(at); if (!Number.isNaN(x.getTime())) return x }
  return null
}

/** El día de una marca: «2026-11-12» o una ISO completa (que se lee en la hora local). */
function comoFecha(x) {
  const d = diaLocal(x)
  if (d) return d
  if (!x) return null
  const y = new Date(x)
  return Number.isNaN(y.getTime()) ? null : y
}

/** «12 de noviembre de 2026» (en el idioma del panel). '' si la fecha no vale: nunca «Invalid Date». */
export function fechaLarga(x, locale = 'es-ES') {
  const d = comoFecha(x)
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  } catch {
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  }
}

/** «11 nov 2026» (en el idioma del panel), para los pies de foto pequeños. '' si la fecha no vale. */
export function fechaCorta(x, locale = 'es-ES') {
  const d = comoFecha(x)
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(/\./g, '')
  } catch {
    return ''
  }
}

/** Días entre dos «AAAA-MM-DD» (b − a), contando días de calendario y no horas (el cambio de hora no lo tuerce). */
export function diasEntre(a, b) {
  const x = diaLocal(a)
  const y = diaLocal(b)
  if (!x || !y) return null
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5)
}

/** «2026-11-12» de un Date local. */
export function isoDia(d) {
  const dos = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

export function numero(n, locale = 'es-ES') {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ''
  try { return new Intl.NumberFormat(locale).format(n) } catch { return String(n) }
}

export function euros(n, locale = 'es-ES') {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ''
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n) } catch { return `${n} €` }
}

/** Una lista que puede no serlo (respuesta rara del servidor): siempre un array. */
export const comoLista = (x) => (Array.isArray(x) ? x : [])
