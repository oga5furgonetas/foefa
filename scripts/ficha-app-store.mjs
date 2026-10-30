/* LA FICHA DE LA APP STORE EN LOS 6 IDIOMAS (30-10-2026), sacada de la de Google Play (app-android/play-listing/)
 * y adaptada a los campos y límites de App Store Connect:
 *   name (30) · subtitle (30) · promotional (170) · description (4000) · keywords (100, separadas por comas)
 * Lo que cambia: no se nombra Google Play ni Android, ni precios ni pagos (en el iPhone no se vende nada: regla 3.1.1
 * de Apple; ver docs/APP_STORE.md). Escribe frontend/ios/listing/<idioma>/*.txt y falla si algo pasa del límite.
 *   node scripts/ficha-app-store.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAY = join(RAIZ, 'app-android', 'play-listing')
const SALIDA = join(RAIZ, 'frontend', 'ios', 'listing')

// Por idioma: nombre (30), subtítulo (30), palabras clave (100) y cómo se llama el idioma en App Store Connect.
const IDIOMAS = {
  'es-ES': { asc: 'Spanish (Spain)', name: 'FDS: ruta de reparto', subtitle: 'Escanea, ordena y entrega',
    keywords: 'reparto,repartidor,ruta,entregas,paquetes,mensajería,escanear,etiqueta,navegación,furgoneta,autónomo' },
  'es-419': { asc: 'Spanish (Mexico)', name: 'FDS: ruta de reparto', subtitle: 'Escanea, ordena y entrega',
    keywords: 'reparto,repartidor,ruta,entregas,paquetes,paquetería,escanear,etiqueta,navegación,camioneta' },
  'en-US': { asc: 'English (U.S.)', name: 'FDS: delivery route planner', subtitle: 'Scan, sort your route, deliver',
    keywords: 'delivery,courier,route,planner,parcels,packages,scan,label,navigation,driver,van,stops,dispatch' },
  'pt-BR': { asc: 'Portuguese (Brazil)', name: 'FDS: rota de entregas', subtitle: 'Escaneie, ordene, entregue',
    keywords: 'entrega,entregador,rota,pacotes,encomendas,escanear,etiqueta,navegação,motorista,paradas,delivery' },
  'fr-FR': { asc: 'French', name: 'FDS : tournée de livraison', subtitle: 'Scannez, triez, livrez',
    keywords: 'livraison,livreur,tournée,colis,scanner,étiquette,navigation,chauffeur,itinéraire,coursier,arrêts' },
  'it-IT': { asc: 'Italian', name: 'FDS: giro di consegne', subtitle: 'Scansiona, ordina, consegna',
    keywords: 'consegne,corriere,percorso,pacchi,scansione,etichetta,navigazione,autista,giro,fermate,spedizioni' },
  'de-DE': { asc: 'German', name: 'FDS: Zustellroute', subtitle: 'Scannen, sortieren, zustellen',
    keywords: 'zustellung,kurier,route,pakete,scannen,etikett,navigation,fahrer,lieferung,tour,stopps,paketdienst' },
}
const LIMITES = { name: 30, subtitle: 30, promotional: 170, description: 4000, keywords: 100 }

// Lo que no vale en Apple: el párrafo del precio entero (su título y lo que le sigue hasta la línea en blanco) y
// cualquier línea que nombre Google Play o Android.
const TITULO_PRECIO = /^(PRECIO|PRICE|PREÇO|PRIX|PREZZO|PREIS)\s*$/i
const FUERA = /google play|android/i

const filas = []
for (const [idioma, d] of Object.entries(IDIOMAS)) {
  const corto = readFileSync(join(PLAY, idioma, 'short.txt'), 'utf8').trim()
  const largo = readFileSync(join(PLAY, idioma, 'full.txt'), 'utf8').replace(/\r\n/g, '\n')
  const quitadas = []
  let enPrecio = false
  const descripcion = largo.split('\n').filter((l) => {
    if (TITULO_PRECIO.test(l.trim())) enPrecio = true
    else if (enPrecio && !l.trim()) enPrecio = false
    if (enPrecio || FUERA.test(l)) { quitadas.push(l.trim()); return false }
    return true
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
  const campos = { name: d.name, subtitle: d.subtitle, promotional: corto, description: descripcion, keywords: d.keywords }
  const dir = join(SALIDA, idioma)
  mkdirSync(dir, { recursive: true })
  for (const [campo, texto] of Object.entries(campos)) {
    const n = [...texto.trim()].length
    if (n > LIMITES[campo]) throw new Error(`${idioma}/${campo}: ${n} caracteres, el límite es ${LIMITES[campo]}`)
    writeFileSync(join(dir, campo + '.txt'), texto.trim() + '\n')
  }
  filas.push(`| ${idioma} | ${d.asc} | ${[...d.name].length} | ${[...d.subtitle].length} | ${[...corto].length} | ${[...descripcion.trim()].length} | ${[...d.keywords].length} |`)
  if (quitadas.length) console.log(`${idioma}: fuera ${quitadas.length} línea(s) de Play:\n   ` + quitadas.map((l) => l.slice(0, 110)).join('\n   '))
}

writeFileSync(join(SALIDA, 'LEEME.md'), `# La ficha de FDS en la App Store, por idioma (30-10-2026)

Generada con \`node scripts/ficha-app-store.mjs\` desde la de Google Play (\`app-android/play-listing/\`), sin Google
Play, Android, precios ni pagos (en el iPhone no se vende nada: regla 3.1.1 de Apple, ver \`docs/APP_STORE.md\`).
Se pega en App Store Connect → la app → App Store → la versión → cada idioma (añadir idiomas en «Localizations»):

| Carpeta | Idioma en App Store Connect | name (30) | subtitle (30) | promotional (170) | description (4000) | keywords (100) |
|---|---|---|---|---|---|---|
${filas.join('\n')}

- \`name.txt\` → Name · \`subtitle.txt\` → Subtitle · \`promotional.txt\` → Promotional Text · \`description.txt\` →
  Description · \`keywords.txt\` → Keywords. Support URL: https://flotadsp.com · Marketing URL: https://flotadsp.com ·
  Privacy Policy URL: https://flotadsp.com/privacidad (en inglés sale sola cuando el móvil no está en español).
- Categoría: Business (secundaria: Navigation). Clasificación de edad: 4+. Copyright: © 2026 FDS.
- Las capturas (iPhone 6,7": 1290×2796) se hacen con la app en TestFlight con el iPhone en cada idioma.
`)
console.log('ficha de la App Store en', SALIDA)
console.log(filas.join('\n'))
