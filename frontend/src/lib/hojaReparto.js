/* LA HOJA DE REPARTO EN UNA FOTO (13-10-2026).

   Muchas subcontratas reciben la lista del día impresa o en PDF: «nº · código · cliente · dirección ·
   CP · teléfono». Meterla parada a parada era lo que hacía abandonar. La foto se lee en el móvil (el
   mismo lector que las etiquetas) y aquí se decide qué líneas son paradas: las que tienen una calle
   («Calle», «Rúa», «Avda»…) o un código postal del país con texto. Cabeceras, totales y firmas se
   quedan fuera. Si el nombre va en la línea de arriba o el CP y la población en la de abajo, se juntan.

   El resultado va a la caja de «Pegar una lista» con cabecera (código; cliente; dirección; teléfono):
   el repartidor lo ve y lo corrige antes de añadir, y el servidor lo lee como siempre (reparto.lee_pegado).

   Sin React: lo ejecuta tal cual scripts/check-leer-etiqueta.mjs. */
import { VIA, interpretaTicket, telefonoDe } from './interpretaEtiqueta.js'

const SOLO_LETRAS = /^[\p{L} .'-]{4,60}$/u
const CABECERA = /^(n[ºo°]?|num|c[oó]d(igo)?|ref|cliente|destinatari[oa]|nombre|direcci[oó]n|domicilio|tel[eé]?f?(ono)?|cp|poblaci[oó]n|localidad|bultos|observaciones|firma|total)\b/i
const CODIGO = /^[A-Z0-9][A-Z0-9-]{5,}$/

const cpDe = (linea, pais) => interpretaTicket(`Calle x\n${linea}`, pais).cp

// El teléfono fuera de la línea (para que sus cifras no se mezclen con la calle).
function sinTelefono(linea, tel) {
  if (!tel) return linea
  for (const m of linea.matchAll(/\+?\(?\d[\d \t().-]{6,18}\d/g)) {
    if (m[0].replace(/\D/g, '').endsWith(tel)) return (linea.slice(0, m.index) + ' ' + linea.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim()
  }
  return linea
}

/* Lo de antes de la calle: «12 ZX812345 María López» → código y cliente. */
function antesDeLaCalle(texto) {
  const trozos = texto.replace(/^\s*\d{1,3}[.)-]?\s+/, '').split(/\s+/).filter(Boolean)
  let codigo = ''
  if (trozos.length && CODIGO.test(trozos[0]) && /\d/.test(trozos[0])) codigo = trozos.shift()
  const cliente = trozos.join(' ').replace(/[,;:-]+$/, '').trim()
  return { codigo, cliente: /\p{L}{3,}/u.test(cliente) ? cliente : '' }
}

export function paradasDeHoja(texto, pais = 'es') {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.replace(/[|]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const paradas = []
  let previa = ''          // la última línea que no fue parada (puede ser el nombre de la siguiente)
  for (const linea of lineas) {
    if (CABECERA.test(linea) && !VIA.test(` ${linea} `)) { previa = ''; continue }
    const telefono = telefonoDe(linea, pais)
    const limpia = sinTelefono(linea, telefono)
    const m = ` ${limpia} `.match(VIA)
    const cp = cpDe(limpia, pais)
    if (m) {
      const i = Math.max(0, m.index + m[1].length - 1)
      const { codigo, cliente } = antesDeLaCalle(limpia.slice(0, i))
      paradas.push({ codigo, cliente: cliente || (SOLO_LETRAS.test(previa) && previa.includes(' ') ? previa : ''),
        direccion: limpia.slice(i).trim(), telefono, cp })
      previa = ''
      continue
    }
    const ultima = paradas[paradas.length - 1]
    // «15001 A Coruña» o solo el teléfono, debajo de la calle: es de la parada de arriba.
    if (ultima && !previa && ((cp && !ultima.cp && limpia.length < 50) || (telefono && limpia.length < 4))) {
      if (cp && !ultima.cp) { ultima.direccion += `, ${limpia}`; ultima.cp = cp }
      if (telefono && !ultima.telefono) ultima.telefono = telefono
      continue
    }
    // Sin palabra de calle pero con CP y un número de portal: también es una dirección («Mayor 12 28013 Madrid»).
    if (cp && /\p{L}{3,}/u.test(limpia) && /\d/.test(limpia.replace(cp, ''))) {
      paradas.push({ codigo: '', cliente: SOLO_LETRAS.test(previa) && previa.includes(' ') ? previa : '', direccion: limpia, telefono, cp })
      previa = ''
      continue
    }
    previa = limpia
  }
  return paradas.map(({ cp: _cp, ...p }) => p)
}

/* Para la caja de «Pegar una lista»: con cabecera, así el servidor sabe qué es cada columna. */
export function textoParaPegar(paradas) {
  const limpio = (v) => String(v || '').replace(/;/g, ',').trim()
  return ['codigo; cliente; direccion; telefono',
    ...paradas.map((p) => [p.codigo, p.cliente, p.direccion, p.telefono].map(limpio).join('; '))].join('\n')
}

/* Un CSV con comas (con o sin comillas) a columnas con «;», que es lo que lee la
   caja de pegar (tabuladores, «;» o «|»). Lo que ya viene así se deja igual. */
export function csvAPegar(texto) {
  const lineas = String(texto || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  if (!lineas.some((l) => l.includes(',')) || lineas.some((l) => /[\t;|]/.test(l))) return lineas.join('\n').trim()
  return lineas.filter((l) => l.trim()).map((l) => {
    const celdas = []
    let actual = ''
    let comillas = false
    for (let i = 0; i < l.length; i += 1) {
      const c = l[i]
      if (c === '"') { if (comillas && l[i + 1] === '"') { actual += '"'; i += 1 } else comillas = !comillas } else if (c === ',' && !comillas) { celdas.push(actual); actual = '' } else actual += c
    }
    celdas.push(actual)
    return celdas.map((x) => x.trim()).join('; ')
  }).join('\n')
}
