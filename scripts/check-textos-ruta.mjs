// Comprueba las traducciones de la app de reparto (src/lib/textosRuta*.js):
// - cada tx('…') literal de las pantallas tiene entrada,
// - cada entrada trae los 5 idiomas (en, pt, fr, it, de), sin huecos,
// - las variables {x} de cada traducción son las mismas que las del español,
// - no sobran entradas que ya no usa nadie: ni la web, ni la app nativa (Traducciones.kt) ni el servidor.
// Los textos que llegan a tx() desde una lista (motivos, huecos, pestañas…)
// se sacan de esas listas por su nombre.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src')
const FICHEROS = [
  'pages/driver/MiRuta.jsx', 'pages/driver/Navegacion.jsx', 'pages/Empezar.jsx', 'pages/InstalarApp.jsx',
  'pages/RegaloPagina.jsx', 'pages/RutaApp.jsx', 'pages/RutaCuenta.jsx', 'pages/SeguimientoPedido.jsx', 'lib/guia.js',
  'pages/Registro.jsx', 'legal/CookieBanner.jsx', 'pages/Repartidores.jsx', 'pages/PaseMovil.jsx', 'lib/compartir.js',
  'pages/driver/AntesPuerta.jsx', 'pages/driver/AjustesMovil.jsx', 'pages/OpinionRuta.jsx', 'pages/OpinionCorreo.jsx',
  'pages/AvisoManana.jsx', 'pages/Landing.jsx', 'pages/Iphone.jsx',
  // Lo que pide la calle (30-10-2026): lo que dice el cliente y el mapa con lo de la DGT.
  'pages/driver/ClienteDice.jsx', 'panel/components/MapaReparto.jsx',
  // Los ajustes de la ruta que ve quien reparte por su cuenta (30-10-2026): la parte con tx() de la pantalla del panel.
  'panel/pages/Reparto.jsx',
  // La carga guiada y el briefing por voz (01-11-2026).
  'pages/driver/CargaGuiada.jsx', 'lib/briefing.js',
  // La entrega verificada (01-11-2026): lo que la IA dijo de la foto, en una frase.
  'lib/entregaIa.js',
  // La memoria de la calle (01-11-2026): el portal, dónde dejar y cómo se entra.
  'pages/driver/MemoriaPuerta.jsx',
  // El día en una tarjeta (01-11-2026): la imagen de «Comparte tu día».
  'lib/compartirDia.js',
  // La página a la que lleva el enlace de la invitación (02-11-2026): la ve el invitado, en su idioma.
  'pages/Invita.jsx',
  // «Situar la parada» (02-11-2026): la parada que no está en el mapa se pone en el nuestro, no en Google Maps.
  'pages/driver/SituarParada.jsx',
  // «¿Dónde?» corto (06-11-2026, diseño compacto): la etiqueta corta de los chips de «Prueba de entrega» y de la memoria.
  'lib/dejar.js',
  // «Mis DNR» del portal del conductor (11-11-2026, tanda 2): la pantalla y lo que comparte con su casilla del inicio.
  'pages/driver/MisDnr.jsx', 'pages/driver/dnrVistas.js',
  // Su ejemplo de la pantalla de entrega, «¿Cómo sé si tiene preferencia?» (11-11-2026, R11).
  'pages/driver/EjemploPreferencia.jsx',
  // La página de venta para empresas (14-11-2026) y las piezas que comparte con la portada (la rejilla de la empresa,
  // la vista del panel y el pie).
  'pages/Empresas.jsx', 'pages/portadaComun.jsx',
]
// Las piezas de la app de reparto (06-11-2026, diseño compacto): todo pages/driver/piezas/, sin nombrarlas una a una; si
// no, sus textos no se comprueban y las claves que se mudan a ellas se dan por muertas.
for (const f of readdirSync(join(raiz, 'pages/driver/piezas')).sort()) if (/\.jsx?$/.test(f)) FICHEROS.push(`pages/driver/piezas/${f}`)
// Nombres que llegan de datos (el plan del autónomo en Registro: tt(planInfo.name)).
// y los métodos de cobro de lib/region.js (metodosCobro), que se pintan con tx(t).
const DE_DATOS = ['Repartidor', 'Bizum', 'Transferencia']
// Listas cuyos textos se traducen al pintarlos.
const LISTAS = ['MOTIVOS', 'DONDE', 'DONDE_CORTO', 'NAVEGADORES', 'HUECOS', 'PESTANAS', 'GIROS', 'ORDINALES', 'OPCIONES', 'ESTADO', 'VENTAJAS', 'FORMAS', 'DEJAR', 'ATAJOS_HORARIO',
  // Dónde se dejó, en las frases de «La última vez» y de la memoria de la puerta (08-11-2026): tx(SITIO[donde]).
  'SITIO', 'SITIOS',
  // La portada (/): lo que hace la app, la IA y lo de la empresa.
  'PASOS_PORTADA', 'FUNCIONES_RUTA', 'PREGUNTAS_PORTADA', 'IA_PORTADA', 'MODULOS_EMPRESA',
  // La guía de iPhone (/iphone).
  'PASOS', 'QUE_FUNCIONA',
  // «Mis DNR» (11-11-2026, V5): cómo la marcó y por qué no pasó la foto, [lo que se ve, la frase larga, …] (MisDnr.jsx).
  'COMO', 'FOTO',
  // /empresas (14-11-2026): los tres problemas con lo que se ve en el panel, los pasos para empezar y las preguntas.
  'PROBLEMAS', 'PASOS_EMPRESA', 'PREGUNTAS_EMPRESA']

const usadas = new Set(DE_DATOS)
const cadenas = (trozo) => [...trozo.matchAll(/'((?:\\'|[^'])*)'/g)].map((m) => m[1].replace(/\\'/g, "'"))
for (const f of FICHEROS) {
  const s = readFileSync(join(raiz, f), 'utf8')
  // tx('…') y, en Registro, tt('…') (el mismo tx solo para quien reparte solo).
  for (const m of s.matchAll(/\bt[xt]\(\s*'((?:\\'|[^'])*)'/g)) usadas.add(m[1].replace(/\\'/g, "'"))
  // txError(e, 'por defecto')
  for (const m of s.matchAll(/\btxError\(\s*\w+,\s*'((?:\\'|[^'])*)'/g)) usadas.add(m[1].replace(/\\'/g, "'"))
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
const { C } = await import(new URL('file://' + join(raiz, 'lib/textosRutaC.js').replace(/\\/g, '/')))
const dic = { ...A, ...B, ...C }
const dobles = [...Object.keys(A).filter((k) => k in B), ...Object.keys(C).filter((k) => k in A || k in B)]
// Los mensajes del servidor (C) cuentan como usados mientras el servidor los diga.
const servidor = readFileSync(join(raiz, '..', '..', 'backend', 'server.py'), 'utf8')
for (const k of Object.keys(C)) {
  if (servidor.includes(`"${k}"`)) usadas.add(k)
  else console.log(`Aviso: el servidor ya no dice «${k}»`)
}

const vars = (t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const fallos = []
for (const k of usadas) if (!(k in dic)) fallos.push(`falta traducir: «${k}»`)
for (const [k, l] of Object.entries(dic)) {
  if (!Array.isArray(l) || l.length !== 5 || l.some((x) => typeof x !== 'string' || !x.trim())) fallos.push(`incompleta: «${k}»`)
  else l.forEach((x, i) => { if (vars(x) !== vars(k)) fallos.push(`variables distintas (${i}): «${k}» → «${x}»`) })
}
dobles.forEach((k) => fallos.push(`repetida en A y B: «${k}»`))
// El portugués de Brasil del embudo (textosBrasil.js): cada clave existe en el diccionario y lleva sus variables.
const { BR } = await import(new URL('file://' + join(raiz, 'lib/textosBrasil.js').replace(/\\/g, '/')))
for (const [k, br] of Object.entries(BR)) {
  if (!(k in dic)) fallos.push(`textosBrasil: la clave ya no existe en el diccionario: «${k}»`)
  else if (vars(br) !== vars(k)) fallos.push(`textosBrasil: variables distintas: «${k}» → «${br}»`)
  if (/(^|[^\p{L}])(telemóvel|palavra-passe|paragem|paragens|morada|ecrã|registo)([^\p{L}]|$)/iu.test(br)) fallos.push(`textosBrasil: palabra de Portugal: «${br}»`)
}

// Lo que pide alguien que este recorrido no ve (08-11-2026). Una traducción no está «sin uso» si:
//  - la pide la app nativa: está en la primera columna de Traducciones.kt (generado por nativa-idioma.mjs desde sus tx());
//  - su texto está escrito entre comillas en otro fichero de la web, de las funciones de Pages o del servidor: una tabla
//    que se pinta con tx(x), un mensaje de la API que la web traduce o una pantalla que no está en FICHEROS.
// Así «sin uso» es lo que de verdad no pide nadie; borrar de más dejaba un texto sin traducir en un idioma.
const raizRepo = join(raiz, '..', '..')
const pideLaNativa = new Set()
try {
  const kt = readFileSync(join(raizRepo, 'app-android', 'app', 'src', 'main', 'java', 'com', 'flotadsp', 'fds', 'ui', 'Traducciones.kt'), 'utf8')
  for (const bloque of kt.matchAll(/"""([\s\S]*?)"""/g)) {
    for (const fila of bloque[1].split('\n')) {
      const c = fila.split('\t')
      if (c.length === 6) pideLaNativa.add(c[0].replace(/⏎/g, '\n').replace(/\$\{'\$'\}/g, '$'))
    }
  }
} catch { /* sin la nativa (otra copia del repo): solo cuenta la web */ }
const DICCIONARIOS = new Set(['textosRuta.js', 'textosRutaA.js', 'textosRutaB.js', 'textosRutaC.js', 'textosBrasil.js'])
function fuentes(dir, ext, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (n === 'node_modules' || n === 'tests' || n === '__pycache__') continue
    if (statSync(p).isDirectory()) fuentes(p, ext, out)
    else if (ext.test(n) && !DICCIONARIOS.has(n)) out.push(p)
  }
  return out
}
const codigo = [
  ...fuentes(raiz, /\.jsx?$/), ...fuentes(join(raizRepo, 'frontend', 'functions'), /\.js$/),
  ...readdirSync(join(raizRepo, 'backend')).filter((n) => n.endsWith('.py')).map((n) => join(raizRepo, 'backend', n)),
].map((f) => readFileSync(f, 'utf8')).join('\n')
const entreComillas = (k) => ["'", '"', '`'].some((q) => codigo.includes(q + k.replace(/\\/g, '\\\\').split(q).join('\\' + q).replace(/\n/g, '\\n') + q))
const sobran = Object.keys(dic).filter((k) => !usadas.has(k) && !pideLaNativa.has(k) && !entreComillas(k))

if (sobran.length) console.log(`Aviso: ${sobran.length} traducciones sin uso (ni la web, ni la nativa, ni el servidor):\n  ` + sobran.join('\n  '))
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log(`textos de ruta: ${usadas.size} usados, ${Object.keys(dic).length} traducidos a 5 idiomas`)

