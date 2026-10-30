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

export const VIA = new RegExp(String.raw`(^|\s)(c\/|cl\.?|calle|r[uú]a|r\/|avda\.?|av\.?|avenida|plaza|praza|pza\.?|paseo|p[ºo]\.?|traves[ií]a|trav\.?|camino|carretera|ctra\.?|lugar|lg\.?|urb\.?|urbanizaci[oó]n|ronda|glorieta|pol[ií]gono|pol\.?|estrada|camiño|rueiro|bloque|carrera|cra\.?|kr\.?|diagonal|dg\.?|transversal|tv\.|autopista|jir[oó]n|jr\.?|pasaje|psje\.?|calzada|calz\.?|privada|priv\.?|cerrada|andador|boulevard|bulevar|blvd\.?|prolongaci[oó]n|prol\.?|rodovia|rod\.?|alameda|al\.|travessa|largo|pra[cç]a|street|st\.|avenue|ave\.?|road|rd\.|drive|dr\.|lane|ln\.|rue|chemin|via|viale|piazza|corso|stra(ss|ß)e|str\.|weg|platz|allee|ladeira|impasse|all[ée]e|place|cours|quai|route|r[ée]sidence|lotissement|gasse|damm|ufer|steig|straat|gracht|laan|plein|kade|dijk|singel|court|ct\.|terrace|circle|cir\.|parkway|pkwy|highway|hwy|close|crescent|gardens|grove|square|sq\.|mews|vicolo|piazzale|lungomare|praceta)[\s,]+`, 'i')

// Lo que va en la línea siguiente y es parte de la dirección: piso, puerta, apartamento, colonia, barrio.
const SIGUE = /^(\d+\s*[ºª°%o]|\d+(?:er|e|ème|st|nd|rd|th)\b|\d+\.\s*(?:og|stock|etage)|bajo|entlo|piso|puerta|esc\.?|portal|apto\.?|apt\.?|apartamento|depto\.?|dpto\.?|departamento|int\.?|interior|casa|bloco|torre|col\.?|colonia|fracc\.?|fraccionamiento|barrio|bairro|b[º°]\.?|villa|urbanizaci[oó]n|conjunto|sector|[ée]tage|[ée]tg\.?|b[âa]t\.?|b[âa]timent|r[ée]sidence|flat|floor|fl\.?|unit|suite|ste\.?|stock|og|wohnung|whg\.?|andar|sala|lote|mz\.?|manzana|edif\.?|edificio|house|apartment|appartement|appt\.?|room|rm\.?)(?=[\s,.:]|$)/i

// Teléfono: [prefijo del país, largos válidos sin prefijo, primera cifra válida (opcional)].
const TEL_PAIS = {
  es: ['34', [9], /^[6789]/], pt: ['351', [9], /^[29]/], mx: ['52', [10]], br: ['55', [10, 11]],
  ar: ['54', [10]], co: ['57', [10], /^(3|60)/], cl: ['56', [9]], pe: ['51', [9], /^9/], us: ['1', [10], /^[2-9]/],
  ec: ['593', [9, 10]], ve: ['58', [10]], uy: ['598', [8, 9]], py: ['595', [9, 10]], bo: ['591', [8]],
  gt: ['502', [8]], cr: ['506', [8]], pa: ['507', [7, 8]], do: ['1', [10]], fr: ['33', [9, 10]], it: ['39', [9, 10]],
  de: ['49', [10, 11]], gb: ['44', [10, 11]], nl: ['31', [9]], be: ['32', [8, 9]], ch: ['41', [9]], at: ['43', [9, 10, 11, 12, 13]],
  ie: ['353', [9]], ad: ['376', [6, 9]],
}

// Código postal: una forma propia (sola vale) o, si es solo cifras corrientes, detrás de «CP», «C.P.», «CEP»…
const CP_PAIS = {
  es: /\b((?:0[1-9]|[1-4]\d|5[0-2])\d{3})\b/,
  pt: /\b(\d{4}-\d{3})\b/,
  br: /\b(\d{5}-\d{3}|\d{8})\b/,
  mx: /\b(\d{5})\b/, us: /\b(\d{5})(?:-\d{4})?\b/, pe: /\b(\d{5})\b/, fr: /\b(\d{5})\b/, it: /\b(\d{5})\b/, de: /\b(\d{5})\b/,
  ar: /\b([A-Z]\d{4}[A-Z]{3})\b/,
  gb: /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i, nl: /\b(\d{4}\s?[A-Z]{2})\b/, ie: /\b([A-Z]\d{2}\s?[A-Z0-9]{4})\b/,
  be: /\b(\d{4})\b/, ch: /\b(\d{4})\b/, at: /\b(\d{4})\b/, ad: /\b(AD\d{3})\b/, cl: /\b(\d{7})\b/, co: /\b(\d{6})\b/, uy: /\b(\d{5})\b/, py: /\b(\d{4})\b/,
  cr: /\b(\d{5})\b/, pa: /\b(\d{4})\b/, gt: /\b(\d{5})\b/, do: /\b(\d{5})\b/, ve: /\b(\d{4})\b/, ec: /\b(\d{6})\b/, hn: /\b(\d{5})\b/, ni: /\b(\d{5})\b/,
  sv: /\b(\d{4})\b/, cu: /\b(\d{5})\b/, cn: /\b(\d{6})\b/,
}
const CP_CON_RETULO = /\b(?:c\.?\s?p\.?|cep|c[oó]digo postal|zip|postal)\s*[:.-]?\s*([A-Z]?\d{4,7}(?:-\d{3,4})?[A-Z]{0,3})\b/i

const ETIQ_CLIENTE = /\b(?:cliente|nombre|nome|destinatari[oa]|destinat[aá]rio|recebedor|sr\.?|sra\.?|d\.|dña\.?|ship to|deliver to|to)\s*[:.-]\s*(.{3,60})|\b(?:cliente|nombre|nome|destinatari[oa]|destinat[aá]rio|sr\.?|sra\.?|dña\.?)\s+(.{3,60})/i
const ETIQ_CODIGO = /\b(?:ticket|tique|n[ºo°]\.?\s*(?:de\s*)?(?:ticket|pedido|factura)?|pedido|factura\s+simplificada|albar[aá]n|gu[ií]a|rastreo|tracking|c[oó]digo de rastreio|pedido n[ºo°]?)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9/-]{3,25})/i
const LINEA_LOGISTICA = /\b(?:cycle|ciclo|kg|kgs|weight|peso|tnw|awb|tracking|rastreo|shipment|envio)\b/i
const ROTULO_TELEFONO = /\b(?:t[1il]f|tel(?:[ée]fono)?|telefone|phone|mobile|movil|cel|whatsapp)/i

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

/* EL NÚMERO Y EL PISO (30-10-2026; Dani: «número 2, primero B, hay veces que lee número 21»). El OCR junta cifras
   separadas por poco espacio («2 1º B» → «21º B») o se come el «º» («2 1 B»). Un piso 13 o más es rarísimo en un
   reparto: con dos o tres cifras pegadas a «º/ª/°» se separa la última como piso («21º B» → «2, 1º B»); «2 1 B»
   (número, piso sin «º», puerta) y «2 1º B» se escriben como lo que son, con la coma que el buscador de direcciones
   entiende (el servidor quita el piso al buscar: reparto.direccion_para_buscar). */
export function arreglaPiso(d) {
  let s = String(d || '')
  s = s.replace(/\b(\d{1,3})(\d)\s*([ºª°])\s*([A-Za-z]{1,4})?(?=[\s,.]|$)/g, (m, a, b, o, puerta) =>
    (parseInt(a + b, 10) > 12 ? `${a}, ${b}º${puerta ? ` ${puerta.toUpperCase()}` : ''}` : m))
  s = s.replace(/\b(\d{1,4})\s+(\d{1,2})\s*([A-H])\s*$/i, (m, n, piso, puerta) => `${n}, ${piso}º ${puerta.toUpperCase()}`)
  s = s.replace(/\b(\d{1,4})\s+(\d{1,2})\s*([ºª°])/g, '$1, $2º')
  return s.replace(/\s+,/g, ',')
}

export function interpretaTicket(texto, pais = 'es') {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const todo = lineas.join('\n')
  const out = { codigo: '', cliente: '', telefono: '', direccion: '', cp: '', localidad: '', contenido: '' }

  // Exclude package identifiers from phone detection; accept labeled or digits-only lines.
  const telefonoRotulado = lineas.some((l) => ROTULO_TELEFONO.test(l))
  const etiquetaLogistica = /\b(?:cycle|ciclo|kg|kgs|weight|peso|tnw|awb|tracking|rastreo|shipment|envio)\b/i.test(todo) ||
    /\b[A-Z]{1,4}\d{6,}\b/i.test(todo)
  // Conserva líneas con texto (incluidas etiquetas de teléfono mal reconocidas);
  // solo excluye tiras numéricas aisladas cuando la etiqueta tiene tracking/logística.
  const lineasTelefono = lineas.filter((l) => !etiquetaLogistica || !/^[+\d\s()./-]+$/.test(l))
  out.telefono = telefonoDe(lineasTelefono.join('\n'), pais)
  out.telefonoRotulado = telefonoRotulado

  let iVia = lineas.findIndex((l) => VIA.test(' ' + l + ' '))
  // En algunas etiquetas españolas la calle no lleva prefijo: p. ej. «Ladeira, Chazo 33».
  // Solo aceptamos esta forma si cerca aparece un CP; así no confundimos pesos/fechas con la dirección.
  if (iVia < 0) {
    const cpRe = CP_PAIS[pais] || CP_PAIS.es
    iVia = lineas.findIndex((l, i) => !LINEA_LOGISTICA.test(l) && !/\b\d{1,2}\/\d{1,2}\b/.test(l) &&
      /\b[A-ZÁÉÍÓÚÑ][\p{L}.'’-]+(?:\s*,?\s+[\p{L}.'’-]+){0,4}\s+\d{1,4}[A-Z]?\b/iu.test(l)
      && lineas.slice(i + 1, i + 4).some((s) => cpRe.test(s) || CP_CON_RETULO.test(s)))
  }
  if (iVia >= 0) {
    const linea = lineas[iVia]
    const via = VIA.exec(' ' + linea + ' ')
    // El OCR puede pegar a la calle un campo vecino («IN : Ladeira… AZ 00»). Lo de ANTES del tipo de vía
    // solo se quita si es un rótulo (acaba en «:»): «123 Main St.» o «GRAN VIA 32» llevan el número o el
    // nombre delante y son la dirección entera (14-10-2026: cortar siempre se comía «123 Main» y «GRAN»).
    let direccion = linea
    if (via && via.index > 0) {
      const antes = linea.slice(0, Math.max(0, via.index + via[1].length - 1))
      if (/[:：]\s*$/.test(antes)) direccion = linea.slice(antes.length)
    }
    direccion = direccion.replace(/^(direcci[oó]n|domicilio|dir\.?|endere[cç]o|address)\s*[:.-]?\s*/i, '').trim()
    // Tras el número solo se corta lo que es basura del OCR (uno o dos trozos de letras y un número suelto,
    // «AZ 00»); «# 32-16 Apto 501», «, 2º Esq», «- Apto 45» o «3B» son parte de la dirección.
    const direccionConNumero = direccion.match(/^(.+?\b\d{1,4}[A-Z]?\b)(.*)$/i)
    const basura = direccionConNumero && /^\s+(?:[A-Z]{1,4}\s+){1,2}\d{1,4}\s*$/i.test(direccionConNumero[2])
    out.direccion = arreglaPiso(basura ? direccionConNumero[1] : direccion)
    // El piso, el apartamento o la colonia suelen ir en la línea siguiente («2º B», «Depto 4», «Col. Centro»).
    // El OCR lee a veces «3º» como «3%» o «3o».
    const sig = lineas[iVia + 1] || ''
    if (SIGUE.test(sig) && !telefonoDe(sig, pais)) out.direccion += `, ${sig}`
  }
  // El código postal y la población: en la línea de la dirección o cerca.
  const forma = CP_PAIS[pais] || CP_PAIS.es
  // Los bloques OCR pueden reordenar columnas: buscar el CP en toda la etiqueta y priorizar el más cercano.
  const cerca = iVia >= 0
    ? lineas.map((l, i) => ({ l, i })).sort((a, b) => Math.abs(a.i - iVia) - Math.abs(b.i - iVia)).map(({ l }) => l)
    : lineas
  for (const l of cerca) {
    const indice = lineas.indexOf(l)
    const contexto = lineas.slice(Math.max(0, indice - 1), indice + 2).join(' ')
    // Fechas, pesos y números pegados a cycle/tracking no son códigos postales.
    if (LINEA_LOGISTICA.test(l) || /\d\s*\/\s*\d/.test(l) || LINEA_LOGISTICA.test(contexto)) continue
    const conRotulo = l.match(CP_CON_RETULO)
    // Si el OCR detectó tracking/pesos, un CP suelto puede ser una secuencia del ciclo o del bulto.
    // Exigimos que el CP comparta línea con la localidad o que venga rotulado para no inventarlo.
    if (etiquetaLogistica && !conRotulo && /^[A-Z]?\d[\d-]{3,9}[A-Z]{0,3}$/i.test(l.trim())) continue
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
      else {
        const previa = lineas[lineas.indexOf(l) - 1] || ''
        // Una población tiene al menos una palabra de 3 letras: «ES» (el país dentro de un código) no lo es.
        if (previa && previa.length < 40 && /\p{L}{3,}/u.test(previa) && !/\d{3,}/.test(previa) && !LINEA_LOGISTICA.test(previa) && !VIA.test(' ' + previa + ' ')) out.localidad = previa
      }
    }
    break
  }
  const cli = todo.match(ETIQ_CLIENTE)
  if (cli) out.cliente = (cli[1] || cli[2] || '').replace(/\+?\(?\d[\d \t().-]{6,18}\d/, '').trim()
  const cod = todo.match(ETIQ_CODIGO)
  if (cod) out.codigo = cod[1].replace(/\s+/g, '').toUpperCase()
  return out
}
