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
import { interpretaTicket } from './interpretaEtiqueta'
import { paradasDeHoja } from './hojaReparto'

// Las reglas de qué es teléfono, calle o CP (por país) viven en interpretaEtiqueta.js.
export { interpretaTicket }

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

/* LA FOTO PREPARADA PARA LEER (10-10-2026). Una etiqueta fotografiada en la
   furgoneta llega con poca luz, sombras y letra pequeña, y el OCR fallaba a
   menudo. Antes de leer: a tamaño de lectura (≈ 2000 px de ancho, sin pasarse),
   en grises y con el contraste estirado (lo más oscuro a negro y lo más claro a
   blanco, sin contar los extremos: un brillo o una sombra no lo estropean). */
async function preparar(imagen, ancho = 2000) {
  try {
    const bmp = await createImageBitmap(imagen)
    const escala = Math.min(2, ancho / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala)
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    const img = ctx.getImageData(0, 0, c.width, c.height)
    const d = img.data
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
      d[i] = g
      hist[g | 0] += 1
    }
    const total = d.length / 4
    let bajo = 0, alto = 255, acum = 0
    for (; bajo < 255 && (acum += hist[bajo]) < total * 0.01; bajo += 1);
    acum = 0
    for (; alto > 0 && (acum += hist[alto]) < total * 0.01; alto -= 1);
    const rango = Math.max(1, alto - bajo)
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - bajo) * 255) / rango))
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)
    return await new Promise((ok) => c.toBlob((b) => ok(b || imagen), 'image/png'))
  } catch { return imagen }
}

export async function leerTicketEnMovil(imagen, pais = 'es') {
  const w = await lector()
  const lista = await preparar(imagen)
  // Las etiquetas mezclan bloques y columnas. Una sola lectura puede encontrar
  // una dirección plausible pero confundir un CP/calle; comparar segmentaciones
  // ayuda a detectar el desacuerdo antes de dejarla guardar.
  const pasadas = []
  for (const modo of ['3', '6', '11']) {
    await w.setParameters({ tessedit_pageseg_mode: modo })
    const data = (await w.recognize(lista)).data
    pasadas.push({ datos: interpretaTicket(data?.text, pais), texto: data?.text || '' })
  }
  const candidatas = new Map()
  for (const pasada of pasadas) {
    const d = pasada.datos
    if (!d.direccion) continue
    const clave = [d.direccion, d.cp, d.localidad].map((x) => String(x || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).join('|')
    const anterior = candidatas.get(clave)
    if (anterior) anterior.votos += 1
    else candidatas.set(clave, { direccion: d.direccion, cp: d.cp, localidad: d.localidad, votos: 1, datos: d, texto: pasada.texto })
  }
  const ordenadas = [...candidatas.values()].sort((a, b) => b.votos - a.votos ||
    Number(!!b.cp) + Number(!!b.localidad) - Number(!!a.cp) - Number(!!a.localidad))
  const mejor = ordenadas[0] || { datos: pasadas[0]?.datos || {}, texto: pasadas[0]?.texto || '' }
  const consenso = (campo) => {
    const votos = new Map()
    for (const pasada of pasadas) {
      const valor = pasada.datos[campo]
      if (!valor) continue
      const clave = String(valor).trim().toLowerCase()
      const fila = votos.get(clave) || { valor, n: 0 }
      fila.n += 1
      votos.set(clave, fila)
    }
    return [...votos.values()].sort((a, b) => b.n - a.n)[0]?.valor || ''
  }
  return { ...mejor.datos, codigo: consenso('codigo'), cliente: consenso('cliente'),
    telefono: consenso('telefono'), contenido: consenso('contenido'), texto: mejor.texto,
    alternativasDireccion: ordenadas.map(({ direccion, cp, localidad }) => ({ direccion, cp, localidad })),
    direccionAmbigua: ordenadas.length > 1 }
}

/* LA HOJA DE REPARTO ENTERA (13-10-2026): una foto, todas las paradas. Una hoja
   A4 tiene la letra más pequeña que una etiqueta: se lee a más resolución, primero
   como bloque de filas (tabla) y, si salen pocas paradas, por columnas. Qué línea
   es parada lo decide hojaReparto.js; el repartidor lo revisa antes de añadir. */
export async function leerHojaEnMovil(imagen, pais = 'es') {
  const w = await lector()
  const lista = await preparar(imagen, 2800)
  let mejor = { paradas: [], texto: '' }
  for (const modo of ['6', '4']) {
    await w.setParameters({ tessedit_pageseg_mode: modo })
    const texto = (await w.recognize(lista)).data?.text || ''
    const paradas = paradasDeHoja(texto, pais)
    if (paradas.length > mejor.paradas.length) mejor = { paradas, texto }
    if (paradas.length >= 3) break
  }
  return mejor
}
