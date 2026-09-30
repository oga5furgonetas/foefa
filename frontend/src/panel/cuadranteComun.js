/* Lo que comparten la rejilla del Cuadrante y su hoja (DIARIO / MENSUAL /
   DEBER HORAS): los códigos, sus colores (con el domingo en naranja) y las
   cuentas del día. Un solo sitio: si la hoja pintara distinto que la
   rejilla, la misma celda diría dos cosas. */
import { isoLocal } from '../lib/fecha'

export const TRABAJO = new Set(['1', 'T', 'X', 'EXTRA', 'BKP', 'S', 'RA', 'RIDE'])
export const RUTA = new Set(['1', 'T', 'X', 'EXTRA'])
export const LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
export const PALETA = [
  ['1', 'Trabaja'], ['N/T', 'Libra'], ['V', 'Vacaciones'], ['BAJA', 'Baja'],
  ['N/D', 'No disponible'], ['APROBADO', 'Día aprobado'], ['BKP', 'Reserva'],
  ['RA', 'Acompañante'], ['S', 'Oficina'], ['N/P', 'No presentado'],
]
export const ABREV = { 'N/T APROB': 'APR', APROBADO: 'APR', EXTRA: 'EX', RIDE: 'RA', COMP: 'COMP' }

/* Colores: los de la hoja donde los hay, y pares texto/fondo que se leen en
   los tres temas (el rosa no tiene compensación en el tema claro: por eso el
   texto del día extra es el de la rampa, que sí se invierte). */
/* El domingo, la columna entera en naranja como en su hoja (Dani, 30-09-2026:
   «márcame los domingos con un color distinto toda la columna»): el 1 y el
   N/T cambian de color; el rosa del extra y los códigos con color propio
   mandan, igual que en el Excel que se exporta. */
export const DOMINGO_TRABAJA = 'bg-orange-500/35 text-dark-50'
export const DOMINGO_LIBRA = 'bg-orange-500/[0.18] text-orange-300'
export const COLUMNA_DOMINGO = 'bg-orange-500/[0.12]'

export function claseCodigo(cod, extra, domingo = false) {
  if (extra) return 'bg-pink-500/35 text-dark-50 ring-1 ring-pink-400/60'
  if (domingo && ['1', 'T', 'X'].includes(cod)) return DOMINGO_TRABAJA
  if (domingo && ['N/T', 'L'].includes(cod)) return DOMINGO_LIBRA
  switch (cod) {
    case '1': case 'T': case 'X': return 'bg-dark-800 text-dark-50'
    case 'N/T': case 'L': return 'bg-amber-200/15 text-amber-200'
    case 'V': return 'bg-sky-500/20 text-sky-300'
    case 'BAJA': return 'bg-red-500/20 text-red-300'
    case 'N/D': case 'N/P': case 'SUSP': return 'bg-orange-500/15 text-orange-300'
    case 'APROBADO': case 'N/T APROB': return 'bg-emerald-500/20 text-emerald-300'
    case 'BKP': return 'bg-amber-500/20 text-amber-300'
    case 'RA': case 'RIDE': return 'bg-violet-500/20 text-violet-300'
    case 'EXTRA': return 'bg-pink-500/35 text-dark-50'
    default: return 'bg-dark-800 text-dark-300'
  }
}

export const wd = (iso) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7
export function sumaDias(iso, n) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}
export function rangoDias(a, b, tope = 100) {
  const out = []
  let x = a
  while (a && b && x <= b && out.length < tope) { out.push(x); x = sumaDias(x, 1) }
  return out
}
export const fmt = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
export const lunesDe = (iso) => sumaDias(iso, -wd(iso))
export const signo = (n) => (n == null ? '—' : n > 0 ? `+${n}` : String(n))
export const claseDif = (d) => (d.dif == null ? 'text-dark-500'
  : d.dif >= d.colchon ? 'bg-emerald-500/20 text-emerald-300'
    : d.dif >= 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300')


/* Rutas, extras, máxima y diferencia de cada día, como la fila RUTAS (cuenta
   de 1) de su hoja: lo que está en otro centro no cuenta aquí. */
export function resumenDias(dias, personas, celda, maximas, colchonDe) {
  const m = {}
  for (const f of dias) {
    let rutas = 0
    let extras = 0
    for (const p of personas) {
      const c = celda(p.id, f)
      if (!c || c.otro_centro) continue
      if (RUTA.has(c.cod)) rutas += 1
      if (c.extra) extras += 1
    }
    const mx = maximas?.[f]
    m[f] = { rutas, extras, maxima: mx ?? null, dif: mx == null ? null : rutas - mx, colchon: colchonDe(f) }
  }
  return m
}

/* Lo que se escribe en una celda de la hoja, como código. Se aceptan los de
   la paleta (en mayúsculas o no) y el día extra: «1E», «E», «EXTRA» o
   «1.EXTRA» (como en su DIARIO) son un 1 en rosa. Lo que no se reconoce no se
   adivina: devuelve null y la hoja dice qué se puede escribir. */
const _ALIAS_COD = { NT: 'N/T', 'N T': 'N/T', LIBRE: 'N/T', ND: 'N/D', NP: 'N/P', VAC: 'V', APR: 'APROBADO',
  APROB: 'APROBADO', BAJ: 'BAJA', BK: 'BKP' }
export const CODIGOS_HOJA = ['1', 'N/T', 'V', 'BAJA', 'N/D', 'APROBADO', 'BKP', 'RA', 'S', 'N/P', 'L', 'T', 'X']
export function leerCodigo(texto) {
  const t = String(texto ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  if (!t) return { cod: '', extra: false }
  if (['1E', 'E', 'EXTRA', '1.EXTRA', '1 EXTRA', '1+'].includes(t)) return { cod: '1', extra: true }
  if (/^1(\.0+)?$/.test(t)) return { cod: '1', extra: false }
  const cod = _ALIAS_COD[t] || t
  return CODIGOS_HOJA.includes(cod) ? { cod, extra: false } : null
}

/* El 7º día seguido trabajando (la ley: como mucho 6), contando la semana de
   antes, que viene en los datos. Lo de otro centro también cuenta: se trabaja
   igual. Devuelve las celdas «id|fecha» que lo son, dentro de desde..hasta. */
export function septimosDe(personas, celda, desde, hasta) {
  const s = new Set()
  if (!desde || !hasta) return s
  const todos = rangoDias(sumaDias(desde, -7), hasta, 110)
  for (const p of personas) {
    let seguidos = 0
    for (const f of todos) {
      const c = celda(p.id, f)
      seguidos = c && TRABAJO.has(c.cod) ? seguidos + 1 : 0
      if (seguidos > 6 && f >= desde) s.add(`${p.id}|${f}`)
    }
  }
  return s
}
