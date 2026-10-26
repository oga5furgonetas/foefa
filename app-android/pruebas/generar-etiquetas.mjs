// Fabrica los códigos de las etiquetas de cada empresa (los formatos que publican) como PNG, para la prueba que los
// lee EN EL MÓVIL con ML Kit (app/src/androidTest/.../LecturaEnElMovilTest.kt). Usa el escritor de zxing de la web.
//   node app-android/pruebas/generar-etiquetas.mjs     (desde la raíz del repo)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(resolve('frontend/package.json'))
const entrada = require.resolve('zxing-wasm/full')
const z = await import(pathToFileURL(entrada).href)
await z.prepareZXingModule({ overrides: { wasmBinary: readFileSync(entrada.replace(/dist[\\/].*$/, 'dist/full/zxing_full.wasm')) }, fireImmediately: true })

const GS = '\x1d', RS = '\x1e', US = '\x1f', EOT = '\x04'
const geopost = ({ cp, bulto, calle, poblacion, contacto = '', tel = '', numero = '', linea2 = '', gps = null }) =>
  `[)>${RS}01${GS}03${GS}${cp}${GS}724${GS}101${GS}${bulto}${GS}GEOP${GS}${GS}298${GS}${GS}001/001${GS}01.50KG${GS}N${GS}`
  + `${calle}${GS}${poblacion}${GS}${GS}${RS}`
  + `07${GS}G03${GS}0${GS}0${GS}1${GS}${['', '', contacto, tel, '', '', '', numero, linea2].join(US)}${GS}${GS}${RS}`
  + (gps ? `07${GS}S081${GS}${gps[0]}${GS}${gps[1]}${GS}1${GS}G${RS}` : '') + EOT

const CODIGOS = {
  'seur-aztec': ['Aztec', geopost({ cp: '15003', bulto: '05123456789012', calle: 'Rúa Real', poblacion: 'A Coruña', contacto: 'María López',
    tel: '+34612345678', numero: '5', linea2: '2º B', gps: ['+43.3712', '-008.3990'] })],
  'seur-barra': ['Code128', '%0015003051234567890121017240'],
  'gls-matriz': ['DataMatrix', 'A|María López|Calle Mayor 12|Santiago de Compostela|| 612345678| 1234567|'],
  'gls-barra': ['Code128', '61234567890'],
  'gs1-matriz': ['DataMatrix', `00385123450000000016${GS}4301María López${GS}4302Calle Real 5${GS}4305A Coruña${GS}42015003${GS}4308612345678`],
  'qr-trozos': ['QRCode', 'María López|Calle del Pez 3|28004|Madrid|612345678'],
  'gs1-fnc1': ['DataMatrix', '(00)385123450000000016(4301)Maria Lopez(4302)Calle Real 5(4305)A Coruna(420)15003(4308)612345678', 'gs1,forceSquare'],
  'solo-barra': ['Code128', '02940800123456'],
}
const dir = resolve('app-android/app/src/androidTest/assets/etiquetas')
mkdirSync(dir, { recursive: true })
for (const [nombre, [format, texto, opciones]] of Object.entries(CODIGOS)) {
  // DataMatrix cuadrado, como en las etiquetas: el rectangular (252x168) ML Kit ni lo detectó en el emulador.
  const options = opciones || (format === 'DataMatrix' ? 'forceSquare' : '')
  const w = await z.writeBarcode(texto, { format, scale: format === 'Code128' ? 3 : 6, options })
  if (w.error) throw new Error(`${nombre}: ${w.error}`)
  writeFileSync(resolve(dir, `${nombre}.png`), Buffer.from(await w.image.arrayBuffer()))
}
console.log(`${Object.keys(CODIGOS).length} códigos en ${dir}`)
