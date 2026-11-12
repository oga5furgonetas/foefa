/* La caducidad del carnet de conducir (11-11-2026, tanda 3, historia-10): la usan la ficha del conductor y la pestaña
   «Carnets» de Vencimientos. Se avisa de lo caducado (rojo) y de lo que caduca en 30 días o menos (ámbar). */
export const DIAS_AVISO_CARNET = 30

/* Días que faltan (negativo: ya caducó), por días de calendario de aquí y no por horas. null si no es una fecha. */
export function diasHastaCarnet(fecha, hoy = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((d - h) / 864e5)
}

export const fechaCarnet = (f) => (f ? String(f).split('-').reverse().join('/') : '')

export function textoDiasCarnet(n) {
  if (n === 0) return 'caduca hoy'
  if (n < 0) return `caducó hace ${-n} ${n === -1 ? 'día' : 'días'}`
  return `caduca en ${n} ${n === 1 ? 'día' : 'días'}`
}
