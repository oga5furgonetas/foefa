/* LA DIRECCIÓN DENTRO DE LOS CÓDIGOS DE LA ETIQUETA, SEA DE LA EMPRESA QUE SEA (13-10-2026).

   Una etiqueta de paquetería lleva varios códigos: la barra del seguimiento y, a menudo, uno o dos
   códigos 2D con los datos del destinatario. El escáner se quedaba con el PRIMERO que veía (casi
   siempre la barra, que solo es un número) y solo sacaba la dirección de un 2D si la calle empezaba
   por «Calle», «Avda»… Ahora se juntan todos los códigos de la etiqueta y cada uno se lee según
   su forma:

   · GS1 (el estándar «Scan4Transport» de las etiquetas de transporte): campos numerados fijos.
     4301 nombre, 4302/4303 dirección, 4304 barrio, 4305 localidad, 4308 teléfono, 420 código postal,
     4309 coordenadas (20 cifras: latitud + 90 y longitud de 0 a 360, por 10 millones; comprobado con
     el conversor de referencia de GS1, github.com/gs1/geocode). 00 es el número del bulto (SSCC).
   · ANSI MH10.8.3 («[)>»), el de UPS y FedEx: campos separados; tras el «Y/N» de dirección validada
     vienen dirección, ciudad y estado.
   · Cualquier otro con los datos separados por «|», «;», «^»… (GLS mete la dirección en su SEGUNDO
     código 2D): cada trozo se clasifica por su forma (teléfono, código postal, calle, población).

   Lo de GS1 sigue la norma; lo de ANSI y el resto no se ha probado con etiquetas reales de cada
   empresa (no hay muestras en el repo): el repartidor SIEMPRE revisa la parada antes de guardarla, y
   lo que no está en los códigos lo completa la foto (la misma imagen en la que se leyeron).

   Sin React ni nada del navegador: lo ejecuta tal cual scripts/check-leer-etiqueta.mjs. */
/* eslint-disable no-control-regex -- los separadores GS y RS de las etiquetas son caracteres de control a propósito */
import { interpretaTicket, telefonoDe } from './interpretaEtiqueta.js'

const GS = '\x1d'
const RS = '\x1e'

/* ───────── GS1 ───────── */

// Cuántas cifras tiene el identificador (AI) según cómo empieza.
function largoAI(s) {
  if (/^(0[0-4]|1\d|2[0-2]|30|37|9\d)/.test(s)) return 2
  if (/^(2[3-5]|4[0-2])/.test(s)) return 3
  return 4
}
// Los de largo fijo (tabla de la norma GS1: «predefined length»), por sus dos primeras cifras: cifras de datos.
const FIJOS = { '00': 18, '01': 14, '02': 14, '03': 14, '04': 16, 11: 6, 12: 6, 13: 6, 14: 6, 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 2, 31: 6, 32: 6, 33: 6, 34: 6, 35: 6, 36: 6, 41: 13 }

/* Del texto del código a {AI: valor}; null si no parece GS1. Admite las tres formas en que llega:
   con separadores invisibles (GS) como lo da el lector, con «]d2» delante y la legible «(4302)Calle…». */
export function camposGS1(texto) {
  let s = String(texto || '')
  const out = {}
  if (/^\(\d{2,4}\)/.test(s)) {
    for (const m of s.matchAll(/\((\d{2,4})\)([^(]*)/g)) out[m[1]] = m[2].trim()
    return Object.keys(out).length ? out : null
  }
  const marcado = /^\][dQCe]\d/.test(s)
  s = s.replace(/^\][dQCe]\d/, '').replace(/^\x1d+/, '')
  // Sin marca, solo se intenta si tiene la pinta: separadores GS o un SSCC/GTIN al empezar.
  if (!marcado && !s.includes(GS) && !/^(00\d{18}|01\d{14})/.test(s)) return null
  let i = 0
  while (i < s.length) {
    if (s[i] === GS) { i += 1; continue }
    const n = largoAI(s.slice(i, i + 2))
    const ai = s.slice(i, i + n)
    if (!/^\d+$/.test(ai) || ai.length < n) return null
    i += n
    const fijo = FIJOS[ai.slice(0, 2)]
    let valor
    if (fijo) { valor = s.slice(i, i + fijo); i += fijo } else {
      const fin = s.indexOf(GS, i)
      valor = s.slice(i, fin < 0 ? s.length : fin)
      i = fin < 0 ? s.length : fin + 1
    }
    out[ai] = valor
  }
  return Object.keys(out).length ? out : null
}

/* 4309: veinte cifras, latitud y longitud. */
export function geoGS1(v) {
  if (!/^\d{20}$/.test(v || '')) return null
  const lat = parseInt(v.slice(0, 10), 10) / 1e7 - 90
  let lng = parseInt(v.slice(10), 10) / 1e7
  if (lng > 180) lng -= 360
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

function deGS1(c, pais) {
  const r = {}
  const unir = (...xs) => xs.map((x) => (x || '').trim()).filter(Boolean).join(', ')
  r.cliente = c['4301'] || c['4300'] || ''
  r.direccion = unir(c['4302'], c['4303'], c['4304'])
  r.localidad = c['4305'] || ''
  if (c['420']) r.cp = c['420']
  else if (c['421']) r.cp = c['421'].slice(3)              // 421: país (3 cifras) + código postal
  if (c['4308']) r.telefono = telefonoDe(c['4308'], pais) || c['4308'].replace(/[^\d+]/g, '')
  const geo = geoGS1(c['4309'])
  if (geo) Object.assign(r, geo)
  r.codigo = c['00'] || c['401'] || c['402'] || ''
  return r
}

/* ───────── ANSI MH10.8.3 (UPS, FedEx) ───────── */

function deANSI(texto, pais) {
  if (!String(texto).startsWith('[)>')) return null
  const campos = String(texto).split(new RegExp(`[${GS}${RS}\x04]`)).map((x) => x.trim())
  const r = {}
  const iSN = campos.findIndex((x, i) => i > 3 && /^[YN]$/.test(x))
  if (iSN > 0) {
    r.direccion = campos[iSN + 1] || ''
    r.localidad = [campos[iSN + 2], campos[iSN + 3]].filter(Boolean).join(', ')
  }
  // El código postal va al principio, a veces pegado a la versión del formato («96» + CP).
  for (const x of campos.slice(1, 4)) {
    let v = x.replace(/^(?:01|02|96)(?=\w{4,})/, '')
    if (/^\d{9}$/.test(v) && pais === 'us') v = v.slice(0, 5)        // ZIP+4 sin guion
    const cp = interpretaTicket(`Calle x\n${v}`, pais).cp
    if (cp) { r.cp = cp; break }
  }
  const seg = campos.find((x) => /^1Z[0-9A-Z]{16}$/.test(x)) || campos.find((x) => /^\d{12,22}$/.test(x))
  if (seg) r.codigo = seg
  return r
}

/* ───────── El resto: trozos separados ───────── */

const SOLO_LETRAS = /^[\p{L} .'-]{2,60}$/u
const PARECE_CODIGO = /^[A-Z0-9-]{6,}$/

function deTrozos(texto, pais) {
  const trozos = String(texto).split(/[|^~;\t\r\n\x1d\x1e]+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (trozos.length < 3) return null
  // Primero, la lectura de siempre con un trozo por línea: reconoce calles con «Calle», «Rúa»…, teléfono y CP.
  const r = interpretaTicket(trozos.join('\n'), pais)
  const iCP = trozos.findIndex((x) => interpretaTicket(`Calle x\n${x}`, pais).cp === x)
  if (!r.cp && iCP >= 0) r.cp = trozos[iCP]
  if (!r.direccion) {
    // Sin palabra de calle («Gran Vía 3», «Mayor 12»): letras y un número, con espacio, que no sea un código.
    const i = trozos.findIndex((x, k) => k !== iCP && /\p{L}{3,}/u.test(x) && /\d/.test(x) && x.includes(' ')
      && !telefonoDe(x, pais) && !/\d{8,}/.test(x) && !PARECE_CODIGO.test(x))
    if (i >= 0) r.direccion = trozos[i]
  }
  if (!r.localidad && iCP >= 0) {
    const vecino = [trozos[iCP + 1], trozos[iCP - 1]].find((x) => x && SOLO_LETRAS.test(x) && x !== r.direccion)
    if (vecino) r.localidad = vecino
  }
  if (!r.cliente && r.direccion) {
    const iDir = trozos.indexOf(r.direccion.split(',')[0])
    const nombre = trozos.slice(0, iDir < 0 ? trozos.length : iDir)
      .find((x) => SOLO_LETRAS.test(x) && x.trim().includes(' ') && x !== r.localidad)
    if (nombre) r.cliente = nombre
  }
  return r
}

/* ───────── Todo junto ───────── */

/* El número de seguimiento de siempre: un código corto sin separadores. */
export function esCodigoSimple(v) {
  const s = String(v || '').trim()
  return s.length >= 4 && s.length <= 40 && !/[\x1d\x1e|;^~\s]/.test(s) && !/^https?:/i.test(s)
}

/* Todos los códigos leídos en la etiqueta → una parada.
   {codigo, codigos, cliente, telefono, direccion, cp, localidad, lat?, lng?, completa}
   `codigos`: los simples, por si el paquete ya está en la lista con otro de ellos. */
export function datosDeCodigos(valores, pais = 'es') {
  const lista = [...new Set((Array.isArray(valores) ? valores : [valores]).map((v) => String(v || '')).filter(Boolean))]
  const out = { codigo: '', cliente: '', telefono: '', direccion: '', cp: '', localidad: '' }
  const poner = (r) => {
    if (!r) return
    for (const [k, v] of Object.entries(r)) if (v !== '' && v != null && (out[k] === '' || out[k] == null)) out[k] = v
  }
  // Por fiabilidad: primero lo que sigue una norma, después lo adivinado.
  for (const v of lista) { const c = camposGS1(v); if (c) poner(deGS1(c, pais)) }
  for (const v of lista) poner(deANSI(v, pais))
  for (const v of lista) if (!camposGS1(v) && !v.startsWith('[)>')) poner(deTrozos(v, pais))
  const simples = lista.filter(esCodigoSimple)
  if (!out.codigo) out.codigo = simples[0] || (lista.length === 1 && lista[0].length <= 60 ? lista[0] : '')
  out.codigos = [...new Set([out.codigo, ...simples].filter(Boolean))]
  out.completa = !!(out.direccion && (out.cp || out.localidad || out.lat != null))
  return out
}
