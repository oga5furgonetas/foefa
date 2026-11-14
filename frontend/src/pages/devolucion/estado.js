/* EL ESTADO DEL RECORRIDO, EN EL # DE LA URL (/devolucion-renting, 14-11-2026). Nada en localStorage, ni en cookies,
   ni en un servidor: lo que va detrás del # no sale del navegador al pedir la página, y el enlace que se manda lleva el
   resultado entero. Forma (compacta, legible):

     #v=f&c=ayvens&h=ric51w&r=nsx-&n=1.lateral%20derecho&p=4

   v: t (turismo) o f (furgoneta) · c: la compañía (o «otra») · h: la huella del recorrido con el que se respondió
   (guiasRenting.huellaRecorrido) · r: una letra por paso (n: no, s: sí, x: no lo sé, -: sin responder) ·
   n: las notas de los «sí», «paso.texto» separadas por ~ · p: el paso que se ve, o «fin» (el resultado).
   Si el enlace no cuadra con los datos (otra versión de la guía, sin huella, una compañía o un vehículo que no está, un
   paso que no existe), `leerEstado` lo dice en `error` y la pantalla ofrece empezar de nuevo. Sin paso (la entrada), la
   compañía se abre con un vehículo que tenga: «#c=bmw-financial-services» abre turismo, que es el que tiene. */
import { COMPANIAS, pasosDe, huellaRecorrido, vehiculoPara } from '../../lib/guiasRenting'

export const RESPUESTAS = { n: 'no', s: 'si', x: 'nose' }
const LETRA = { no: 'n', si: 's', nose: 'x' }
export const NOTA_MAX = 80

export function documentoDe(compania, vehiculo) {
  const c = COMPANIAS.find((x) => x.slug === compania)
  return c ? c.documentos[vehiculo] || null : null
}

/* Del # a un estado. Nunca lanza: lo raro vuelve como `error`. */
export function leerEstado(hash) {
  const q = new URLSearchParams(String(hash || '').replace(/^#/, ''))
  const v = q.get('v')
  const vehiculo = v === 't' ? 'turismo' : v === 'f' ? 'furgoneta' : null
  const compania = q.get('c') || null
  const estado = { vehiculo, compania, paso: null, fin: false, respuestas: [], notas: {}, error: null }
  if (v != null && !vehiculo) return { ...estado, error: 'El tipo de vehículo de este enlace no se entiende.' }
  if (!compania) return estado
  const c = COMPANIAS.find((x) => x.slug === compania)
  if (compania !== 'otra' && !c) {
    return { ...estado, compania: null, error: 'Este enlace nombra una compañía que no tenemos.' }
  }
  const p = q.get('p')
  if (p == null) return c ? { ...estado, vehiculo: vehiculoPara(c, vehiculo) } : estado
  if (compania === 'otra') return { ...estado, fin: p === 'fin' || p === '0', paso: null }
  if (!vehiculo) return { ...estado, error: 'Al enlace le falta el tipo de vehículo.' }
  const doc = documentoDe(compania, vehiculo)
  if (!doc) return { ...estado, error: 'Esa compañía no tiene documento para ese tipo de vehículo.' }
  const pasos = pasosDe(doc, vehiculo)
  const h = q.get('h')
  const r = q.get('r') || ''
  if (h && h !== huellaRecorrido(doc, vehiculo)) {
    return { ...estado, error: 'Este enlace se hizo con otra versión de la guía y no podemos rehacer el resultado con seguridad.' }
  }
  if (!h && (r || p === 'fin')) return { ...estado, error: 'A este enlace le falta la marca de la versión de la guía con la que se hizo, y no podemos rehacer el resultado con seguridad.' }
  if (/[^nsx-]/.test(r) || r.length > pasos.length) return { ...estado, error: 'Las respuestas del enlace no se entienden.' }
  estado.respuestas = pasos.map((_, i) => RESPUESTAS[r[i]] || null)
  for (const trozo of (q.get('n') || '').split('~')) {
    const m = trozo.match(/^(\d+)\.(.*)$/s)
    if (m && Number(m[1]) < pasos.length && estado.respuestas[Number(m[1])] === 'si') estado.notas[Number(m[1])] = m[2].slice(0, NOTA_MAX)
  }
  if (p === 'fin') {
    if (estado.respuestas.some((x) => !x)) return { ...estado, error: 'A este enlace le faltan respuestas para enseñar el resultado.' }
    estado.fin = true
  } else {
    const n = Number(p)
    if (!(/^\d+$/.test(p) && n < pasos.length)) return { ...estado, respuestas: [], notas: {}, error: 'Este enlace pide una pregunta que no existe.' }
    estado.paso = n
  }
  return estado
}

/* De un estado al # (sin el #). */
export function escribirEstado({ vehiculo, compania, paso, fin, respuestas = [], notas = {} }) {
  const q = []
  if (vehiculo) q.push(`v=${vehiculo === 'turismo' ? 't' : 'f'}`)
  if (compania) q.push(`c=${encodeURIComponent(compania)}`)
  if (compania === 'otra') {
    if (fin) q.push('p=fin')
    return q.join('&')
  }
  if (!compania || (paso == null && !fin)) return q.join('&')
  const doc = documentoDe(compania, vehiculo)
  if (doc) q.push(`h=${huellaRecorrido(doc, vehiculo)}`)
  const r = respuestas.map((x) => LETRA[x] || '-').join('').replace(/-+$/, '')
  if (r) q.push(`r=${r}`)
  const n = Object.entries(notas).filter(([i, t]) => respuestas[i] === 'si' && String(t || '').trim())
    .map(([i, t]) => `${i}.${encodeURIComponent(String(t).trim().slice(0, NOTA_MAX).replace(/~/g, '-'))}`)
  if (n.length) q.push(`n=${n.join('~')}`)
  q.push(`p=${fin ? 'fin' : paso}`)
  return q.join('&')
}
