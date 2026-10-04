import { locale, idioma } from './idioma'

/* La región del móvil para el alta: su zona horaria (así «hoy» y las horas de
   llegada salen en su hora) y, como pista del país, la región de su idioma
   («es-MX» -> «mx»). El servidor decide: si no conoce el país, lo deduce de
   la zona horaria. */
export function regionDelMovil() {
  const fuera = {}
  try { fuera.zona_horaria = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined } catch { /* sin Intl */ }
  try {
    const r = new Intl.Locale(navigator.language || '').maximize().region
    if (r && /^[A-Z]{2}$/.test(r)) fuera.pais = r.toLowerCase()
  } catch { /* idioma raro */ }
  return fuera
}

/* LA MONEDA DEL REPARTO. Lo que se cobra en la puerta va en la moneda del país
   de la cuenta (un repartidor de México cobra pesos, no euros). El país llega
   con la ruta (mi-ruta → pais) y se recuerda para el historial. */
const MONEDAS = {
  es: 'EUR', mx: 'MXN', ar: 'ARS', co: 'COP', cl: 'CLP', pe: 'PEN', ve: 'VES', ec: 'USD', bo: 'BOB', py: 'PYG',
  uy: 'UYU', cr: 'CRC', pa: 'USD', gt: 'GTQ', hn: 'HNL', sv: 'USD', ni: 'NIO', do: 'DOP', pr: 'USD', cu: 'CUP',
  cn: 'CNY',
}
let paisRuta = (() => {
  try { const g = localStorage.getItem('fds_pais'); if (g && MONEDAS[g]) return g } catch { /* sin almacenamiento */ }
  return 'es'
})()

export function fijarPais(pais) {
  if (!pais || !MONEDAS[pais]) return
  paisRuta = pais
  try { localStorage.setItem('fds_pais', pais) } catch { /* sin almacenamiento */ }
}

// Con el formato del móvil si habla el idioma de la app (es-MX: «$250.00»);
// si no, el del idioma elegido.
function localeNumeros() {
  try {
    const nav = navigator.language || ''
    if (nav.toLowerCase().startsWith(idioma())) return nav
  } catch { /* sin navegador */ }
  return locale()
}
const formato = () => new Intl.NumberFormat(localeNumeros(), { style: 'currency', currency: MONEDAS[paisRuta] || 'EUR' })

export function importe(n) {
  try { return formato().format(Number(n || 0)) } catch { return `${Number(n || 0).toFixed(2)} €` }
}

export function simboloMoneda() {
  try { return formato().formatToParts(0).find((x) => x.type === 'currency')?.value || '€' } catch { return '€' }
}

/* Cómo puede pagar el cliente en la puerta: Bizum solo existe en España. */
export const metodosCobro = () => (paisRuta === 'es'
  ? [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['bizum', 'Bizum']]
  : [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia']])
