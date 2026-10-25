#!/usr/bin/env node
/* ¿ESCANEAR LA ETIQUETA METE LA PARADA SOLA? (25-10-2026)
   ══════════════════════════════════════════════════════════════════════════
   Dani: «si trabajas en MRW, GLS, Nacex, CTT y escaneas el paquete, que se añada a la lista sin esperar a la
   foto; verifica cuáles podemos escanear y haz pruebas».

   Cada caso fabrica los códigos de una etiqueta con el formato que publica esa empresa, los convierte en imagen
   y los LEE con el mismo motor que usa el móvil (zxing-cpp en WebAssembly, el de barcode-detector, en modo de
   texto «Plain» como él). Lo leído pasa por `datosDeCodigos` (frontend/src/lib/codigoEtiqueta.js), la función
   real de la app, y se compara campo a campo. «completa» = la parada entra sola, sin foto.

   Lo que NO prueba: la cámara del móvil (enfoque, luz, distancia; la cadena entera con la cámara simulada está
   en frontend/e2e/escaneo-real.spec.js) ni etiquetas de empresas que no publican su formato (MRW, Nacex, CTT,
   Correos Express): para esas, solo la lectura general de trozos.
   Uso: node scripts/check-escaneo-2d.mjs   (desde la raíz del repo; necesita frontend/node_modules)
*/
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(resolve('frontend/package.json'))
const entrada = require.resolve('zxing-wasm/full')
const z = await import(pathToFileURL(entrada).href)
await z.prepareZXingModule({
  overrides: { wasmBinary: readFileSync(entrada.replace(/dist[\\/].*$/, 'dist/full/zxing_full.wasm')) },
  fireImmediately: true,
})
const { datosDeCodigos, normalizaCodigo } = await import(pathToFileURL(resolve('frontend/src/lib/codigoEtiqueta.js')).href)

const GS = '\x1d'
const RS = '\x1e'
const US = '\x1f'
const EOT = '\x04'

// DPD / SEUR: «Geolabel» 6.0, bloque ISO 15434 «01» (versión 03) + «07 G03» (destinatario) + «07 S081» (GPS).
const geopost = ({ cp, pais = '724', bulto, calle, poblacion, empresa = '', contacto = '', tel = '', numero = '', linea2 = '', gps = null }) =>
  `[)>${RS}01${GS}03${GS}${cp}${GS}${pais}${GS}101${GS}${bulto}${GS}GEOP${GS}${GS}298${GS}${GS}001/001${GS}01.50KG${GS}N${GS}`
  + `${calle}${GS}${poblacion}${GS}${GS}${empresa}${RS}`
  + `07${GS}G03${GS}0${GS}0${GS}1${GS}${['', '', contacto, tel, '', '', '', numero, linea2].join(US)}${GS}${GS}${RS}`
  + (gps ? `07${GS}S081${GS}${gps[0]}${GS}${gps[1]}${GS}1${GS}G${RS}` : '') + EOT

const CASOS = [
  { nombre: 'SEUR / DPD · Aztec con portal, piso, teléfono y GPS', pais: 'es', codigos: [
    ['Aztec', geopost({ cp: '15003', bulto: '05123456789012', calle: 'Rúa Real', poblacion: 'A Coruña', contacto: 'María López',
      tel: '+34612345678', numero: '5', linea2: '2º B', gps: ['+43.3712', '-008.3990'] })],
    ['Code128', '%0015003051234567890121017240']],
  espera: { direccion: 'Rúa Real 5, 2º B', localidad: 'A Coruña', cp: '15003', cliente: 'María López', telefono: '612345678',
    lat: 43.3712, lng: -8.399, codigo: '05123456789012', completa: true } },
  { nombre: 'SEUR / DPD · Aztec solo con el bloque ISO (calle con número)', pais: 'es', codigos: [
    ['Aztec', geopost({ cp: '15705', bulto: '05999999999999', calle: 'Calle del Villar 12', poblacion: 'Santiago de Compostela', empresa: 'Bar O Peto' })]],
  espera: { direccion: 'Calle del Villar 12', localidad: 'Santiago de Compostela', cp: '15705', cliente: 'Bar O Peto', completa: true } },
  { nombre: 'DPD Portugal · Aztec', pais: 'pt', codigos: [
    ['Aztec', geopost({ cp: '4000-322', pais: '620', bulto: '07123456789012', calle: 'Rua de Santa Catarina 120', poblacion: 'Porto', contacto: 'Ana Sousa', tel: '912345678' })]],
  espera: { direccion: 'Rua de Santa Catarina 120', localidad: 'Porto', cp: '4000-322', cliente: 'Ana Sousa', completa: true } },
  { nombre: 'GLS · segundo DataMatrix (formato de su documentación)', pais: 'es', codigos: [
    ['DataMatrix', 'AES 700ES 7001234567890 1234567890 TEST1234AA 3esa123465760 02320001001'],
    ['DataMatrix', 'A|María López|Calle Mayor 12|Santiago de Compostela|| 612345678| 1234567|']],
  espera: { direccion: 'Calle Mayor 12', localidad: 'Santiago de Compostela', cliente: 'María López', telefono: '612345678', completa: true } },
  { nombre: 'GLS · el ejemplo literal de su documentación', pais: 'es', codigos: [
    ['DataMatrix', 'A|Hr. Test|Teststraße 42|Rostock-Brinckmansdorf|| 987654321| 1234567|']],
  espera: { direccion: 'Teststraße 42', localidad: 'Rostock-Brinckmansdorf', cliente: 'Hr. Test', completa: true } },
  // MaxiCode cabe poco (unos 90 caracteres): en él va el seguimiento corto; el largo, en la barra de al lado.
  // OJO: aquí se prueba solo el FORMATO. En una etiqueta real el móvil no lee el MaxiCode (zxing solo «puro»,
  // y Chrome en Android no lo trae; probado en frontend/e2e/escaneo-real.spec.js): de UPS entra la barra 1Z.
  { nombre: 'UPS · MaxiCode (solo el formato: en el móvil no se lee)', pais: 'es', codigos: [
    ['MaxiCode', `[)>${RS}01${GS}9628001${GS}724${GS}011${GS}1Z12345675${GS}UPSN${GS}12345E${GS}298${GS}${GS}1/1${GS}2.0${GS}N${GS}CALLE ALCALA 45${GS}MADRID${GS}${RS}${EOT}`],
    ['Code128', '1Z12345E6605272234']],
  espera: { direccion: 'CALLE ALCALA 45', localidad: 'MADRID', cp: '28001', codigo: '1Z12345E6605272234', completa: true } },
  { nombre: 'GS1 «Scan4Transport» · DataMatrix', pais: 'es', codigos: [
    ['DataMatrix', `00385123450000000016${GS}4301María López${GS}4302Calle Real 5${GS}4305A Coruña${GS}42015003${GS}4308612345678`]],
  espera: { direccion: 'Calle Real 5', localidad: 'A Coruña', cp: '15003', cliente: 'María López', telefono: '612345678', completa: true } },
  { nombre: 'QR con los datos separados por «|» (cualquier empresa)', pais: 'es', codigos: [
    ['QRCode', 'María López|Calle del Pez 3|28004|Madrid|612345678']],
  espera: { direccion: 'Calle del Pez 3', localidad: 'Madrid', cp: '28004', completa: true } },
  { nombre: 'Solo la barra del seguimiento (MRW, Nacex, CTT, Correos…)', pais: 'es', codigos: [
    ['Code128', '02940800123456']],
  espera: { codigo: '02940800123456', completa: false } },
]

let fallos = 0
for (const caso of CASOS) {
  const leidos = []
  for (const [formato, texto] of caso.codigos) {
    const w = await z.writeBarcode(texto, { format: formato, scale: 4 })
    if (w.error) { console.log(`✗ ${caso.nombre}: no se pudo fabricar el ${formato}: ${w.error}`); fallos += 1; continue }
    const r = await z.readBarcodes(w.image, { tryHarder: true, textMode: 'Plain' })
    const leido = r.find((x) => x.text === texto)
    if (!leido) { console.log(`✗ ${caso.nombre}: el ${formato} no se lee igual (${JSON.stringify(r[0]?.text || '')})`); fallos += 1; continue }
    leidos.push(leido.text)
  }
  const d = datosDeCodigos(leidos, caso.pais)
  const mal = Object.entries(caso.espera).filter(([k, v]) => (typeof v === 'number' ? Math.abs((d[k] ?? NaN) - v) > 1e-6 : d[k] !== v))
  if (mal.length) {
    fallos += 1
    console.log(`✗ ${caso.nombre}`)
    for (const [k, v] of mal) console.log(`    ${k}: esperaba ${JSON.stringify(v)}, sale ${JSON.stringify(d[k])}`)
  } else {
    console.log(`✓ ${caso.nombre}${caso.espera.completa ? ' — entra sola' : ' — pide la foto'}`)
  }
}

// Un lector que devuelve los separadores «dibujados» (␝ ␞ ␟ ␄ y ␠) da lo mismo.
const dibujado = geopost({ cp: '15003', bulto: '05123456789012', calle: 'Rúa Real', poblacion: 'A Coruña', contacto: 'María López', numero: '5' })
  .replace(/\x1d/g, '␝').replace(/\x1e/g, '␞').replace(/\x1f/g, '␟').replace(/\x04/g, '␄').replace(/ /g, '␠')
const a = datosDeCodigos([dibujado], 'es')
if (normalizaCodigo('a␝b') !== `a${GS}b` || a.direccion !== 'Rúa Real 5' || a.localidad !== 'A Coruña' || !a.completa) {
  fallos += 1
  console.log('✗ Separadores dibujados: no se entienden', JSON.stringify(a))
} else console.log('✓ Separadores «dibujados» por el lector: se entienden igual')

if (fallos) {
  console.error(`\ncheck-escaneo-2d: ${fallos} caso(s) fallan`)
  process.exit(1)
}
console.log(`\ncheck-escaneo-2d: los ${CASOS.length + 1} casos bien`)
