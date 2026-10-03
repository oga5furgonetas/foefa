/* LEER UN TICKET DE CAJA EN EL PROPIO MÓVIL.

   Por qué aquí y no en el servidor con IA: la foto lleva el nombre, el
   teléfono y la dirección de un cliente de OTRA empresa. Mandarla a la IA
   gratuita de Google no es legal (puede usarla para entrenar), y la de pago
   cuesta. Leída en el móvil con tesseract.js no sale de él: no hay tercero.

   Es un OCR, no una IA: lee letras, no entiende el ticket. Por eso
   `interpretaTicket` busca lo que tiene forma reconocible (teléfono, código
   postal, una línea que empieza por «Calle», «Rúa», «Avda»…) y el conductor
   SIEMPRE revisa antes de guardar. Lo que no encuentra lo deja vacío. */

import { OCR_RUTA } from './ocrRuta'

const VIA = /\b(c\/|cl\.?|calle|r[uú]a|r\/|avda\.?|av\.|avenida|plaza|praza|pza\.?|paseo|p[ºo]\.?|traves[ií]a|trav\.?|camino|carretera|ctra\.?|lugar|lg\.?|urb\.?|urbanizaci[oó]n|ronda|glorieta|pol[ií]gono|pol\.?|estrada|camiño|rueiro|bloque)\s/i
const TEL = /(?:\+?34[\s.-]?)?([6789](?:[\s.-]?\d){8})\b/
const CP = /\b((?:0[1-9]|[1-4]\d|5[0-2])\d{3})\b/
const ETIQ_CLIENTE = /\b(?:cliente|nombre|destinatario|sr\.?|sra\.?|d\.|dña\.?)\s*[:.-]?\s*(.{3,60})/i
const ETIQ_CODIGO = /\b(?:ticket|tique|n[ºo°]\.?\s*(?:de\s*)?(?:ticket|pedido|factura)?|pedido|factura\s+simplificada|albar[aá]n)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9/-]{3,25})/i

export function interpretaTicket(texto) {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const todo = lineas.join('\n')
  const out = { codigo: '', cliente: '', telefono: '', direccion: '', cp: '', localidad: '', contenido: '' }

  const tel = todo.match(TEL)
  if (tel) out.telefono = tel[1].replace(/\D/g, '')

  const iVia = lineas.findIndex((l) => VIA.test(l + ' '))
  if (iVia >= 0) {
    out.direccion = lineas[iVia].replace(/^(direcci[oó]n|domicilio|dir\.?)\s*[:.-]?\s*/i, '')
    // El piso o la puerta suelen ir en la línea siguiente («2º B», «Bajo»).
    const sig = lineas[iVia + 1] || ''
    // El OCR lee a veces «3º» como «3%» o «3o».
    if (/^(\d+\s*[ºª°%o]|bajo|entlo|piso|puerta|esc\.?|portal)(?=[\s,.]|$)/i.test(sig)) out.direccion += `, ${sig}`
  }
  // El código postal y la población: en la línea de la dirección o cerca.
  const cerca = iVia >= 0 ? lineas.slice(iVia, iVia + 3) : lineas
  for (const l of cerca) {
    const m = l.match(CP)
    if (m && !TEL.test(l.replace(m[1], ''))) {
      out.cp = m[1]
      const resto = l.slice(l.indexOf(m[1]) + 5).replace(/^[\s,.-]+/, '').trim()
      if (resto && resto.length < 40 && !/\d{3,}/.test(resto)) out.localidad = resto
      break
    }
  }
  const cli = todo.match(ETIQ_CLIENTE)
  if (cli) out.cliente = cli[1].replace(TEL, '').trim()
  const cod = todo.match(ETIQ_CODIGO)
  if (cod) out.codigo = cod[1].replace(/\s+/g, '').toUpperCase()
  return out
}

let _lector = null

/* El lector se crea una vez y se reutiliza: arrancarlo cuesta (la primera vez
   descarga ~6 MB desde nuestro dominio; después queda en la caché). */
async function lector() {
  if (!_lector) {
    _lector = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('spa', 1, {
        workerPath: `${OCR_RUTA}/worker.min.js`,
        corePath: `${OCR_RUTA}/`,
        langPath: OCR_RUTA,
        gzip: true,
        // Sin blob: la CSP solo deja workers de nuestro propio origen.
        workerBlobURL: false,
      })
    })()
    _lector.catch(() => { _lector = null })
  }
  return _lector
}

export async function leerTicketEnMovil(imagen) {
  const w = await lector()
  const { data } = await w.recognize(imagen)
  return { ...interpretaTicket(data?.text), texto: data?.text || '' }
}
