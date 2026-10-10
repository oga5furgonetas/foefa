/* Carpeta del lector de tickets, CON VERSIÓN. Sus ficheros no llevan huella en
   el nombre, y si alguien los pide mientras un despliegue se propaga, el borde
   de Cloudflare guarda la página HTML bajo esa dirección durante horas (pasó
   el 03-10-2026 con dos de ellos). Al cambiar el lector o los datos, se sube
   esta versión y nadie vuelve a pedir la dirección envenenada. */
export const OCR_RUTA = '/ocr/t7-spa4-1'

/* El lector de códigos de barras en WebAssembly (zxing-cpp, paquete
   barcode-detector) para los móviles cuyo navegador no trae uno: iPhone, el
   navegador de TikTok o Instagram, los ordenadores. Con su versión en el nombre
   por lo mismo de arriba. */
export const ZXING_WASM = `${OCR_RUTA}/zxing-reader-3.1.3.wasm`
