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

/* LOS COLORES DE SU HOJA DE GOOGLE (01-11-2026; Dani: «fíjate en los colores y todo, ponlo igual»), leídos de la
   pestaña «12 A 26» con la paleta de Sheets: el 1 en blanco, el N/T en crema (FFF2CC), el domingo entero en naranja
   (F8CBAD), SUSP en rojo, BAJA / N/D / N/P en crema con la letra roja, el día aprobado en verde claro (E2EFDA), BACKUP
   en magenta, RIDE en azul claro (D9E1F2), V en blanco con la letra gris, S en blanco con la letra roja y el día extra
   en rosa (FF66CC). Son colores fijos, no del tema: la celda se ve igual en claro y en oscuro, como en la hoja; por eso
   la letra va en negro (`text-black`, sin compensación de tema) o en rojo. Lo mismo pinta el Excel que se exporta
   (`cuadrante_exportar`) y lo que la app escribe en la hoja (`_sync_fondo_hoja`). Los otros colores de sus celdas (un
   1 en verde, en cian, en amarillo) son marcas suyas sin significado para la app, y no se pintan. */
export const DOMINGO_TRABAJA = 'bg-[#f8cbad] text-black'
export const DOMINGO_LIBRA = 'bg-[#f8cbad] text-black'
export const COLUMNA_DOMINGO = 'bg-[#f8cbad]/30'
export const NOMBRE_EMPRESA = 'bg-[#00b0f0] text-black'
export const NOMBRE_FINDE = 'bg-[#92d050] text-black'
export const NOMBRE_SE_VA = 'bg-[#ffd966] text-black'
export const CABECERA_DIA = 'bg-[#c0504d] text-white'

export function claseCodigo(cod, extra, domingo = false) {
  if (extra) return 'bg-[#ff66cc] text-black ring-1 ring-pink-400/60'
  if (domingo && ['1', 'T', 'X', 'N/T', 'L'].includes(cod)) return DOMINGO_TRABAJA
  switch (cod) {
    case '1': case 'T': case 'X': return 'bg-white text-black'
    case 'N/T': case 'L': return 'bg-[#fff2cc] text-black'
    case 'BAJA': case 'N/D': case 'N/P': return 'bg-[#fff2cc] text-red-600'
    case 'SUSP': return 'bg-[#ff0000] text-black'
    case 'V': case 'COMP': return 'bg-white text-dark-500'
    case 'S': return 'bg-white text-red-600'
    case 'APROBADO': case 'N/T APROB': return 'bg-[#e2efda] text-black'
    case 'BKP': return 'bg-[#ff00ff] text-black'
    case 'RA': case 'RIDE': return 'bg-[#d9e1f2] text-black'
    case 'EXTRA': return 'bg-[#ff66cc] text-black'
    default: return 'bg-white text-dark-500'
  }
}

/* El color del nombre, como en su hoja: azul «empresa» (horario fijo), verde «fines de semana/días fijos», dorado «baja»
   (deja el cuadrante). */
export function claseNombre(p, hasta = '') {
  if (p?.inactivo_desde && (!hasta || p.inactivo_desde <= hasta)) return NOMBRE_SE_VA
  if (p?.tipo === 'inactivo') return NOMBRE_SE_VA
  if (p?.tipo === 'empresa') return NOMBRE_EMPRESA
  if (p?.tipo === 'finde') return NOMBRE_FINDE
  return ''
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
export function resumenDias(dias, personas, celda, maximas, colchonDe, refuerzoDe = () => 0) {
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
    const ref = refuerzoDe(f) || 0                 // los que BAJAN de otros centros cuentan como rutas
    m[f] = { rutas, extras, refuerzo: ref, maxima: mx ?? null, dif: mx == null ? null : rutas + ref - mx, colchon: colchonDe(f) }
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
