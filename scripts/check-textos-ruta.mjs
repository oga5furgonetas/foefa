// Comprueba las traducciones de la app de reparto (src/lib/textosRuta*.js):
// - cada tx('…') literal de las pantallas tiene entrada,
// - cada entrada trae los 6 idiomas, sin huecos,
// - las variables {x} de cada traducción son las mismas que las del español,
// - no sobran entradas que ya no usa nadie.
// Los textos que llegan a tx() desde una lista (motivos, huecos, pestañas…)
// se sacan de esas listas por su nombre.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src')
const FICHEROS = [
  'pages/driver/MiRuta.jsx', 'pages/driver/Navegacion.jsx', 'pages/Empezar.jsx', 'pages/InstalarApp.jsx',
  'pages/RegaloPagina.jsx', 'pages/RutaApp.jsx', 'pages/RutaCuenta.jsx', 'pages/SeguimientoPedido.jsx', 'lib/guia.js',
  'pages/Registro.jsx', 'legal/CookieBanner.jsx',
]
// Nombres que llegan de datos (el plan del autónomo en Registro: tt(planInfo.name)).
const DE_DATOS = ['Repartidor']
// Listas cuyos textos se traducen al pintarlos.
const LISTAS = ['MOTIVOS', 'NAVEGADORES', 'HUECOS', 'PESTANAS', 'GIROS', 'ORDINALES', 'OPCIONES', 'ESTADO']

const usadas = new Set(DE_DATOS)
const cadenas = (trozo) => [...trozo.matchAll(/'((?:\\'|[^'])*)'/g)].map((m) => m[1].replace(/\\'/g, "'"))
for (const f of FICHEROS) {
  const s = readFileSync(join(raiz, f), 'utf8')
  // tx('…') y, en Registro, tt('…') (el mismo tx solo para quien reparte solo).
  for (const m of s.matchAll(/\bt[xt]\(\s*'((?:\\'|[^'])*)'/g)) usadas.add(m[1].replace(/\\'/g, "'"))
  // tx(a ? 'x' : 'y') y similares: las cadenas dentro del primer argumento.
  for (const m of s.matchAll(/\btx\(([^()]*\?[^()]*)\)/g)) cadenas(m[1]).forEach((c) => usadas.add(c))
  for (const nombre of LISTAS) {
    const m = s.match(new RegExp(`const ${nombre} = ([\\[{][\\s\\S]*?\\n?[\\]}])\\s*\\n`))
    if (!m) continue
    if (nombre === 'ORDINALES') { cadenas(m[1]).forEach((c) => usadas.add(c)); continue }
    if (nombre === 'GIROS') { for (const g of m[1].matchAll(/:\s*'([^']+)'/g)) usadas.add(g[1]); continue }
    // Solo frases (con mayúscula): fuera claves internas (pendiente, app, text-sky-300…).
    for (const c of cadenas(m[1])) if (/[A-ZÁÉÍÓÚ¿¡]/.test(c) && !/^(text|bg|border)-|^#/.test(c)) usadas.add(c)
  }
  // tx(X || 'por defecto')
  for (const m of s.matchAll(/\btx\([^()']*\|\|\s*'([^']+)'\)/g)) usadas.add(m[1])
  // [['k', 'Texto'], …].map(([k, t]) => … tx(t) …): botones en línea.
  for (const m of s.matchAll(/\[(\[\s*'[a-z_]+',\s*'[^']+'(?:,\s*\w+)?\](?:,\s*\[\s*'[a-z_]+',\s*'[^']+'(?:,\s*\w+)?\])*)\]\.map/g)) {
    for (const p of m[1].matchAll(/\[\s*'[a-z_]+',\s*'([^']+)'/g)) usadas.add(p[1])
  }
  for (const m of s.matchAll(/\{\[((?:'[^']+',?\s*)+)\]\.map\(\(t\)/g)) cadenas(m[1]).forEach((c) => usadas.add(c))
}

const { A } = await import(new URL('file://' + join(raiz, 'lib/textosRutaA.js').replace(/\\/g, '/')))
const { B } = await import(new URL('file://' + join(raiz, 'lib/textosRutaB.js').replace(/\\/g, '/')))
const dic = { ...A, ...B }
const dobles = Object.keys(A).filter((k) => k in B)

const vars = (t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const fallos = []
for (const k of usadas) if (!(k in dic)) fallos.push(`falta traducir: «${k}»`)
for (const [k, l] of Object.entries(dic)) {
  if (!Array.isArray(l) || l.length !== 6 || l.some((x) => typeof x !== 'string' || !x.trim())) fallos.push(`incompleta: «${k}»`)
  else l.forEach((x, i) => { if (vars(x) !== vars(k)) fallos.push(`variables distintas (${i}): «${k}» → «${x}»`) })
}
dobles.forEach((k) => fallos.push(`repetida en A y B: «${k}»`))
const sobran = Object.keys(dic).filter((k) => !usadas.has(k))

if (sobran.length) console.log(`Aviso: ${sobran.length} traducciones sin uso:\n  ` + sobran.join('\n  '))
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log(`textos de ruta: ${usadas.size} usados, ${Object.keys(dic).length} traducidos a 6 idiomas`)

// La portada en chino (/cn): las mismas claves que la de seis idiomas.
const { LANDING } = await import(new URL('file://' + join(raiz, 'pages/landingTextos.js').replace(/\\/g, '/')))
const { LANDING_ZH } = await import(new URL('file://' + join(raiz, 'pages/landingZh.js').replace(/\\/g, '/')))
const faltanZh = Object.keys(LANDING).filter((k) => !LANDING_ZH[k] || !LANDING_ZH[k].trim())
if (faltanZh.length) {
  console.error('portada en chino, faltan: ' + faltanZh.join(', '))
  process.exit(1)
}
console.log(`portada en chino: ${Object.keys(LANDING).length} textos`)
