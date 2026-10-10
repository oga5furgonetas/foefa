/* LEER CÓDIGOS EN CUALQUIER MÓVIL (10-10-2026).
   Chrome en Android trae su propio lector (BarcodeDetector); Safari en iPhone,
   el navegador de dentro de TikTok o Instagram y los ordenadores, no: allí la
   app decía «este móvil no sabe leer códigos». Para ellos, el mismo lector
   hecho en WebAssembly (zxing-cpp), servido desde nuestro dominio: la imagen no
   sale del móvil. Se carga solo si hace falta. */
import { ZXING_WASM } from './ocrRuta'

export const FORMATOS = ['code_128', 'ean_13', 'ean_8', 'qr_code', 'code_39', 'itf', 'upc_a', 'upc_e',
  'data_matrix', 'codabar', 'pdf417', 'aztec']

let _lector = null

export function lectorDeCodigos() {
  if (!_lector) {
    _lector = (async () => {
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const soportados = await window.BarcodeDetector.getSupportedFormats()
          const formatos = FORMATOS.filter((f) => soportados.includes(f))
          if (formatos.length) return new window.BarcodeDetector({ formats: formatos })
        } catch { /* el suyo no va: el nuestro */ }
      }
      const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
      await prepareZXingModule({
        overrides: { locateFile: (ruta, prefijo) => (ruta.endsWith('.wasm') ? ZXING_WASM : prefijo + ruta) },
        fireImmediately: true,
      })
      return new BarcodeDetector({ formats: FORMATOS })
    })()
    _lector.catch(() => { _lector = null })
  }
  return _lector
}

/* El primer código que se lea en una imagen, vídeo o foto; '' si ninguno. */
export async function leerCodigo(fuente) {
  try {
    const lector = await lectorDeCodigos()
    const codigos = await lector.detect(fuente)
    return codigos.find((c) => c.rawValue)?.rawValue || ''
  } catch { return '' }
}
