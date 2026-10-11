/* DE TEXTO LEÍDO A PARADA: teléfono, dirección, CP, localidad, cliente y código (10/11-10-2026).

   Es un OCR, no una IA: lee letras, no entiende la etiqueta. Por eso se busca lo que tiene forma
   reconocible y el repartidor SIEMPRE revisa antes de guardar; lo que no se encuentra se deja vacío.

   POR PAÍS (11-10-2026). Las reglas eran solo de España (teléfono +34 de 9 cifras, CP del 01 al 52,
   «Calle/Rúa/Avda»), y desde el giro a Latinoamérica la mayoría de altas nuevas son de allí: a un
   repartidor de México o de Brasil la foto no le sacaba ni el teléfono ni el CP. Ahora cada país trae su
   forma de teléfono y de código postal, y las calles de allí (Carrera, Jirón, Calzada, Rodovia…). La
   colonia, el bairro o el «depto/apto» de la línea siguiente se pegan a la dirección: sin ellos el
   buscador de direcciones de esos países se pierde.

   Sin imports a propósito: así lo ejecuta tal cual scripts/check-leer-etiqueta.mjs con etiquetas de
   cada país (gotcha 40: probar lo que corre, no una copia). */

const VIA = new RegExp(String.raw`(^|\s)(c\/|cl\.?|calle|r[uú]a|r\/|avda\.?|av\.?|avenida|plaza|praza|pza\.?|paseo|p[ºo]\.?|traves[ií]a|trav\.?|camino|carretera|ctra\.?|lugar|lg\.?|urb\.?|urbanizaci[oó]n|ronda|glorieta|pol[ií]gono|pol\.?|estrada|camiño|rueiro|bloque|carrera|cra\.?|kr\.?|diagonal|dg\.?|transversal|tv\.|autopista|jir[oó]n|jr\.?|pasaje|psje\.?|calzada|calz\.?|privada|priv\.?|cerrada|andador|boulevard|bulevar|blvd\.?|prolongaci[oó]n|prol\.?|rodovia|rod\.?|alameda|al\.|travessa|largo|pra[cç]a|street|st\.|avenue|ave\.?|road|rd\.|drive|dr\.|lane|ln\.|rue|chemin|via|viale|piazza|corso|stra(ss|ß)e|str\.|weg|platz|allee)\s`, 'i')

// Lo que va en la línea siguiente y es parte de la dirección: piso, puerta, apartamento, colonia, barrio.
const SIGUE = /^(\d+\s*[ºª°%o]|bajo|entlo|piso|puerta|esc\.?|portal|apto\.?|apt\.?|apartamento|depto\.?|dpto\.?|departamento|int\.?|interior|casa|bloco|torre|col\.?|colonia|fracc\.?|fraccionamiento|barrio|bairro|b[º°]\.?|villa|urbanizaci[oó]n|conjunto|sector)(?=[\s,.:]|$)/i

// Teléfono: [prefijo del país, largos válidos sin prefijo, primera cifra válida (opcional)].
const TEL_PAIS = {
  es: ['34', [9], /^[6789]/], pt: ['351', [9], /^[29]/], mx: ['52', [10]], br: ['55', [10, 11]],
  ar: ['54', [10]], co: ['57', [10], /^(3|60)/], cl: ['56', [9]], pe: ['51', [9], /^9/], us: ['1', [10], /^[2-9]/],
  ec: ['593', [9, 10]], ve: ['58', [10]], uy: ['598', [8, 9]], py: ['595', [9, 10]], bo: ['591', [8]],
  gt: ['502', [8]], cr: ['506', [8]], pa: ['507', [7, 8]], do: ['1', [10]], fr: ['33', [9, 10]], it: ['39', [9, 10]],
  de: ['49', [10, 11]], gb: ['44', [10, 11]],
}

// Código postal: una forma propia (sola vale) o, si es solo cifras corrientes, detrás de «CP», «C.P.», «CEP»…
const CP_PAIS = {
  es: /\b((?:0[1-9]|[1-4]\d|5[0-2])\d{3})\b/,
  pt: /\b(\d{4}-\d{3})\b/,
  br: /\b(\d{5}-\d{3}|\d{8})\b/,
  mx: /\b(\d{5})\b/, us: /\b(\d{5})(?:-\d{4})?\b/, pe: /\b(\d{5})\b/, fr: /\b(\d{5})\b/, it: /\b(\d{5})\b/, de: /\b(\d{5})\b/,
  ar: /\b([A-Z]\d{4}[A-Z]{3})\b/,
}
const CP_CON_RETULO = /\b(?:c\.?\s?p\.?|cep|c[oó]digo postal|zip|postal)\s*[:.-]?\s*([A-Z]?\d{4,7}(?:-\d{3,4})?[A-Z]{0,3})\b/i

const ETIQ_CLIENTE = /\b(?:cliente|nombre|nome|destinatari[oa]|destinat[aá]rio|recebedor|sr\.?|sra\.?|d\.|dña\.?|ship to|deliver to|to)\s*[:.-]\s*(.{3,60})|\b(?:cliente|nombre|nome|destinatari[oa]|destinat[aá]rio|sr\.?|sra\.?|dña\.?)\s+(.{3,60})/i
const ETIQ_CODIGO = /\b(?:ticket|tique|n[ºo°]\.?\s*(?:de\s*)?(?:ticket|pedido|factura)?|pedido|factura\s+simplificada|albar[aá]n|gu[ií]a|rastreo|tracking|c[oó]digo de rastreio|pedido n[ºo°]?)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9/-]{3,25})/i

/* El teléfono: cada tira de cifras con separadores, sin prefijo del país, con un largo y una primera
   cifra de las que usa ese país. Un número de seguimiento es más largo y no pasa. */
export function telefonoDe(texto, pais = 'es') {
  const [pref, largos, inicio] = TEL_PAIS[pais] || ['', [9, 10, 11]]
  // Sin lookbehind (rompe Safari < 16.4): el carácter de antes va en el grupo 1. Sin saltos de línea dentro.
  for (const m of String(texto || '').matchAll(/(^|[^A-Za-z0-9])(\+?\(?\d[\d \t().-]{6,18}\d)(?![A-Za-z0-9])/gm)) {
    let d = m[2].replace(/\D/g, '')
    if (pref && d.startsWith(pref) && !largos.includes(d.length)) {
      const sin = d.slice(pref.length)
      // México y Argentina meten un dígito de móvil tras el prefijo (+52 1…, +54 9…).
      const conMovil = sin.length === 11 && ((pais === 'mx' && sin[0] === '1') || (pais === 'ar' && sin[0] === '9'))
      if (largos.includes(sin.length) || conMovil) d = sin
    }
    if (pais === 'mx' && d.length === 11 && d.startsWith('1')) d = d.slice(1)                 // el «1» viejo de móvil
    if (pais === 'ar' && d.length === 11 && d.startsWith('9')) d = d.slice(1)                 // el «9» de móvil
    if (pais === 'ar' && /^0?\d{2,4}15\d{6,8}$/.test(d) && d.length > 10) d = d.replace(/^0/, '').replace(/^(\d{2,4})15/, '$1')
    if (d.startsWith('0') && !largos.includes(d.length) && largos.includes(d.length - 1)) d = d.slice(1)   // 0 de larga distancia
    if (largos.includes(d.length) && (!inicio || inicio.test(d))) return d
  }
  return ''
}

export function interpretaTicket(texto, pais = 'es') {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const todo = lineas.join('\n')
  const out = { codigo: '', cliente: '', telefono: '', direccion: '', cp: '', localidad: '', contenido: '' }

  out.telefono = telefonoDe(todo, pais)

  const iVia = lineas.findIndex((l) => VIA.test(' ' + l + ' '))
  if (iVia >= 0) {
    out.direccion = lineas[iVia].replace(/^(direcci[oó]n|domicilio|dir\.?|endere[cç]o|address)\s*[:.-]?\s*/i, '')
    // El piso, el apartamento o la colonia suelen ir en la línea siguiente («2º B», «Depto 4», «Col. Centro»).
    // El OCR lee a veces «3º» como «3%» o «3o».
    const sig = lineas[iVia + 1] || ''
    if (SIGUE.test(sig) && !telefonoDe(sig, pais)) out.direccion += `, ${sig}`
  }
  // El código postal y la población: en la línea de la dirección o cerca.
  const forma = CP_PAIS[pais] || CP_PAIS.es
  const cerca = iVia >= 0 ? lineas.slice(iVia, iVia + 4) : lineas
  for (const l of cerca) {
    const conRotulo = l.match(CP_CON_RETULO)
    const m = conRotulo || l.match(forma)
    if (!m) continue
    const cp = m[1]
    // Que no sea un trozo del teléfono.
    if (!conRotulo && telefonoDe(l, pais) && telefonoDe(l.replace(cp, ' '), pais) === '') continue
    out.cp = cp
    const resto = l.slice(l.indexOf(cp) + cp.length).replace(/^[\s,.-]+/, '').trim()
    if (resto && resto.length < 40 && !/\d{3,}/.test(resto)) out.localidad = resto
    else {
      const antes = l.slice(0, l.indexOf(m[0])).replace(/[\s,.-]+$/, '').trim()
      if (antes && antes.length < 40 && !/\d{3,}/.test(antes) && !VIA.test(' ' + antes + ' ')) out.localidad = antes
    }
    break
  }
  const cli = todo.match(ETIQ_CLIENTE)
  if (cli) out.cliente = (cli[1] || cli[2] || '').replace(/\+?\(?\d[\d \t().-]{6,18}\d/, '').trim()
  const cod = todo.match(ETIQ_CODIGO)
  if (cod) out.codigo = cod[1].replace(/\s+/g, '').toUpperCase()
  return out
}
