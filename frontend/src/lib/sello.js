/* LA MATRÍCULA Y EL SELLO DE FECHA (14-11-2026): los dos datos que hacen de una foto una prueba. Aquí solo el texto;
   las piezas que lo pintan son components/Matricula.jsx y components/SelloFoto.jsx. */

const ESPANOLA = /^(\d{4})([BCDFGHJKLMNPRSTVWXYZ]{3})$/

/** «5678KLM» o «5678-klm» → «5678 KLM». Lo que no tiene el formato español se devuelve en mayúsculas, sin tocar. */
export function matriculaLegible(texto) {
  const t = String(texto ?? '').trim().toUpperCase()
  const m = t.replace(/[\s-]/g, '').match(ESPANOLA)
  return m ? `${m[1]} ${m[2]}` : t
}

/** ¿Tiene el formato de las matrículas españolas de hoy (cuatro cifras y tres consonantes)? */
export function esMatriculaEspanola(texto) {
  return ESPANOLA.test(String(texto ?? '').toUpperCase().replace(/[\s-]/g, ''))
}

const dos = (n) => String(n).padStart(2, '0')

/** «13 NOV 2026 · 18:12»: día, mes en letras mayúsculas, año y hora, en la hora local de quien mira. `corto` quita
    el año. Devuelve '' si la fecha no vale: nunca «Invalid Date» en pantalla. */
export function selloDeFecha(fecha, { corto = false, idioma = 'es' } = {}) {
  if (fecha === null || fecha === undefined || fecha === '') return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (Number.isNaN(d.getTime())) return ''
  let mes
  try {
    mes = new Intl.DateTimeFormat(idioma, { month: 'short' }).format(d)
  } catch {
    mes = new Intl.DateTimeFormat('es', { month: 'short' }).format(d)
  }
  mes = mes.replace(/\./g, '').toUpperCase().slice(0, 4)
  return `${dos(d.getDate())} ${mes}${corto ? '' : ` ${d.getFullYear()}`} · ${dos(d.getHours())}:${dos(d.getMinutes())}`
}
