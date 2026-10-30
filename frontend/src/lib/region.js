import { locale, idioma } from './idioma'
import { PRECIOS_REPARTIDOR } from './precios'

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
  // El idioma de la app al darse de alta: en ese le llegan los correos.
  try { fuera.idioma = idioma() } catch { /* nada */ }
  return fuera
}

/* LA MONEDA DEL REPARTO. Lo que se cobra en la puerta va en la moneda del país
   de la cuenta (un repartidor de México cobra pesos, no euros). El país llega
   con la ruta (mi-ruta → pais) y se recuerda para el historial. */
const MONEDAS = {
  es: 'EUR', mx: 'MXN', ar: 'ARS', co: 'COP', cl: 'CLP', pe: 'PEN', ve: 'VES', ec: 'USD', bo: 'BOB', py: 'PYG',
  uy: 'UYU', cr: 'CRC', pa: 'USD', gt: 'GTQ', hn: 'HNL', sv: 'USD', ni: 'NIO', do: 'DOP', pr: 'USD', cu: 'CUP',
  br: 'BRL', cn: 'CNY',
  pt: 'EUR', fr: 'EUR', it: 'EUR', de: 'EUR', ie: 'EUR', be: 'EUR', nl: 'EUR', at: 'EUR', ad: 'EUR',
  gb: 'GBP', ch: 'CHF', us: 'USD',
}
let paisRuta = (() => {
  try { const g = localStorage.getItem('fds_pais'); if (g && MONEDAS[g]) return g } catch { /* sin almacenamiento */ }
  return 'es'
})()

// El país de la ruta (para leer las etiquetas con sus teléfonos y códigos postales).
export const paisActual = () => paisRuta

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

/* FUERA DE ESPAÑA (30-10-2026, docs/EXPANSION-INTERNACIONAL-30-10.md). */

/* Un importe en una moneda concreta, con los números del idioma: el plan («$9.99», «9,99 €», «MX$149»). */
export function importeEn(n, moneda) {
  const v = Number(n || 0)
  try {
    return new Intl.NumberFormat(localeNumeros(), { style: 'currency', currency: moneda || 'EUR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2 })
      .format(v).replace(/[\u00a0\u202f]/g, ' ')
  } catch { return `${v} ${moneda || 'EUR'}` }
}

/* El plan Repartidor en la moneda de un país: lo que manda el servidor (`precios` con `moneda`) y, mientras no
   contesta, la tabla de lib/precios.js. Sin precio en su moneda, en dólares. */
export function precioRepartidor(pais, servidor = null) {
  if (servidor?.moneda && servidor.mensual != null) return { moneda: servidor.moneda, mensual: servidor.mensual, anual: servidor.anual }
  const moneda = PRECIOS_REPARTIDOR[MONEDAS[pais]] ? MONEDAS[pais] : 'USD'
  const [mensual, anual] = PRECIOS_REPARTIDOR[moneda]
  return { moneda, mensual, anual }
}

/* Millas en EE. UU. y Reino Unido (y Liberia y Birmania); km en el resto. El servidor lo dice con la ruta
   (`unidades`) y aquí sale del país. Los km se guardan siempre en km: solo cambia lo que se enseña y se escribe. */
const MILLAS = new Set(['us', 'gb', 'lr', 'mm'])
export const KM_POR_MILLA = 1.609344
export const unidades = () => (MILLAS.has(paisRuta) ? 'mi' : 'km')
/** «3,1 km» o «1.9 mi», con los números del idioma. */
export function distancia(km, decimales = 1) {
  const millas = unidades() === 'mi'
  const v = (Number(km) || 0) / (millas ? KM_POR_MILLA : 1)
  try {
    return new Intl.NumberFormat(localeNumeros(), { style: 'unit', unit: millas ? 'mile' : 'kilometer', unitDisplay: 'short', maximumFractionDigits: decimales }).format(v)
  } catch { return `${v.toFixed(decimales).replace('.', ',')} ${millas ? 'mi' : 'km'}` }
}

/* Cómo puede pagar el cliente en la puerta: Bizum solo existe en España y Pix en Brasil. */
export const metodosCobro = () => (paisRuta === 'es'
  ? [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['bizum', 'Bizum']]
  : paisRuta === 'br'
    ? [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['pix', 'Pix']]
    : [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia']])

/* EL PAÍS DE QUIEN VISITA (sin cuenta todavía), por la hora del móvil: la portada le enseña las
   empresas con las que reparte en SU país (en México no hay MRW). '' si no se sabe. */
const ZONA_PAIS = {
  'America/Bogota': 'co', 'America/Santiago': 'cl', 'America/Punta_Arenas': 'cl', 'America/Lima': 'pe',
  'America/Caracas': 've', 'America/Guayaquil': 'ec', 'America/La_Paz': 'bo', 'America/Asuncion': 'py',
  'America/Montevideo': 'uy', 'America/Costa_Rica': 'cr', 'America/Panama': 'pa', 'America/Guatemala': 'gt',
  'America/Tegucigalpa': 'hn', 'America/El_Salvador': 'sv', 'America/Managua': 'ni', 'America/Santo_Domingo': 'do',
  'America/Puerto_Rico': 'pr', 'America/Havana': 'cu', 'Europe/Madrid': 'es', 'Atlantic/Canary': 'es', 'Africa/Ceuta': 'es',
  'Europe/Lisbon': 'pt', 'Atlantic/Madeira': 'pt', 'Atlantic/Azores': 'pt',
}
export function paisDelMovil() {
  let z = ''
  try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
  if (ZONA_PAIS[z]) return ZONA_PAIS[z]
  if (/^America\/(Argentina\/|Buenos_Aires$|Cordoba$)/.test(z)) return 'ar'
  if (/^America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Mazatlan|Bahia_Banderas|Hermosillo|Tijuana)$/.test(z)) return 'mx'
  if (/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Maceio|Araguaina|Santarem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Eirunepe|Noronha)$/.test(z)) return 'br'
  if (/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)|Pacific\/Honolulu)$/.test(z)) return 'us'
  return ''
}
