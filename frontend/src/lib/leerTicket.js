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
async function preparar(imagen) {
  try {
    const bmp = await createImageBitmap(imagen)
    const escala = Math.min(2, 2000 / Math.max(bmp.width, bmp.height))
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
  // Primero como un documento; si no sale una dirección, como texto suelto
  // (las etiquetas tienen bloques repartidos y el modo documento los mezcla).
  await w.setParameters({ tessedit_pageseg_mode: '3' })
  let { data } = await w.recognize(lista)
  let leido = interpretaTicket(data?.text, pais)
  if (!leido.direccion) {
    await w.setParameters({ tessedit_pageseg_mode: '11' })
    const otra = (await w.recognize(lista)).data
    const segundo = interpretaTicket(otra?.text, pais)
    if (segundo.direccion) { data = otra; leido = segundo }
  }
  return { ...leido, texto: data?.text || '' }
}
