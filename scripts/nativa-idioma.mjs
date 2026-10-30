// LA APP NATIVA EN LOS IDIOMAS DE LA WEB (30-10-2026, expansión fuera de España).
//
// Hace tres cosas sobre app-android/app/src/main/java:
//  1. `--envolver`: envuelve en tx() los textos visibles de los .kt que aún no lo están: Text("…"),
//     contentDescription = "…", Toast.makeText(ctx, "…", Titulo("…"), avisar("…"), Chip("…"). Idempotente. No toca
//     los textos con $ (plantillas: esos se pasan a mano a tx("… {n}", "n" to x)), ni los que no tienen minúsculas
//     (claves, siglas).
//  2. `--generar`: escribe ui/Traducciones.kt: para cada tx("…") de los .kt, las 5 traducciones (en, pt, fr, it, de)
//     de la web (frontend/src/lib/textosRuta{A,B,C}.js, la misma clave en español) o de
//     app-android/traducciones-nativa.json (lo que solo dice la nativa). Partido en bloques: una constante de
//     Kotlin no puede pasar de 64 KB.
//  3. `--comprobar`: falla (exit 1) si algún tx("…") no tiene traducción en ningún sitio, y lista cuáles.
//
// Uso:  node scripts/nativa-idioma.mjs [--envolver] [--generar] [--comprobar]   (sin opciones: --generar --comprobar)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const KOTLIN = join(RAIZ, 'app-android', 'app', 'src', 'main', 'java')
const SALIDA = join(KOTLIN, 'com', 'flotadsp', 'fds', 'ui', 'Traducciones.kt')
const PROPIAS = join(RAIZ, 'app-android', 'traducciones-nativa.json')
const args = new Set(process.argv.slice(2))
const envolver = args.has('--envolver')
const generar = args.has('--generar') || args.size === 0
const comprobar = args.has('--comprobar') || args.size === 0

function ficherosKt(dir) {
  const r = []
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) r.push(...ficherosKt(p))
    else if (f.endsWith('.kt') && f !== 'Traducciones.kt' && f !== 'Idioma.kt') r.push(p)
  }
  return r.sort()
}

// Un literal de Kotlin tal como está escrito -> el texto; y al revés.
const desescapa = (s) => s.replace(/\\(["\\$nt])/g, (_, c) => ({ '"': '"', '\\': '\\', $: '$', n: '\n', t: '\t' }[c]))
// Lo que se traduce: tiene alguna minúscula (no es una clave ni una sigla) y no es una plantilla con $.
const traducible = (lit) => /[a-záéíóúñü]/.test(lit) && !lit.includes('$')

const LIT = String.raw`"((?:[^"\\]|\\.)*)"`
// Cada patrón dice en qué grupo está el literal y cómo queda envuelto.
const PATRONES = [
  { re: new RegExp(String.raw`\bText\(${LIT}`, 'g'), lit: 1, rep: (g) => `Text(tx("${g[1]}")` },
  { re: new RegExp(String.raw`\bcontentDescription = ${LIT}`, 'g'), lit: 1, rep: (g) => `contentDescription = tx("${g[1]}")` },
  { re: new RegExp(String.raw`Toast\.makeText\(([^,()]+), ${LIT}`, 'g'), lit: 2, rep: (g) => `Toast.makeText(${g[1]}, tx("${g[2]}")` },
  { re: new RegExp(String.raw`\b(Titulo|avisar|Chip|Aviso)\(${LIT}`, 'g'), lit: 2, rep: (g) => `${g[1]}(tx("${g[2]}")` },
]

function envuelve(ruta) {
  let t = readFileSync(ruta, 'utf8')
  const antes = t
  for (const { re, lit, rep } of PATRONES) {
    t = t.replace(re, (...m) => {
      const g = m.slice(0, -2)   // los grupos (m[0] es el texto entero); fuera offset y cadena
      return traducible(g[lit]) ? rep(g) : g[0]
    })
  }
  if (t !== antes) {
    if (!/^import com\.flotadsp\.fds\.ui\.tx$/m.test(t) && !/^package com\.flotadsp\.fds\.ui$/m.test(t)) {
      t = t.replace(/^(package [^\n]+\n)/, `$1\nimport com.flotadsp.fds.ui.tx`)
    }
    writeFileSync(ruta, t)
    return true
  }
  return false
}

function clavesDe(ruta) {
  const t = readFileSync(ruta, 'utf8')
  const r = new Set()
  for (const m of t.matchAll(new RegExp(String.raw`\btx\(${LIT}`, 'g'))) r.add(desescapa(m[1]))
  return r
}

async function diccionarioWeb() {
  const todo = {}
  for (const letra of ['A', 'B', 'C']) {
    const mod = await import(pathToFileURL(join(RAIZ, 'frontend', 'src', 'lib', `textosRuta${letra}.js`)).href)
    Object.assign(todo, mod[letra])
  }
  return todo
}

const ficheros = ficherosKt(KOTLIN)
if (envolver) {
  let n = 0
  for (const f of ficheros) if (envuelve(f)) { n += 1; console.log('envuelto', relative(RAIZ, f)) }
  console.log(`nativa-idioma: ${n} ficheros envueltos`)
}

if (generar || comprobar) {
  const web = await diccionarioWeb()
  let propias = {}
  try { propias = JSON.parse(readFileSync(PROPIAS, 'utf8')) } catch { /* aún no existe */ }
  const claves = new Map()   // clave -> ficheros
  for (const f of ficheros) for (const k of clavesDe(f)) claves.set(k, [...(claves.get(k) || []), relative(RAIZ, f)])
  const faltan = []
  const filas = []
  for (const k of [...claves.keys()].sort()) {
    const lista = propias[k] || web[k]
    if (!Array.isArray(lista) || lista.length !== 5 || lista.some((x) => typeof x !== 'string' || !x.trim())) { faltan.push(k); continue }
    filas.push([k, ...lista])
  }
  if (generar) {
    // Bloques de texto crudo de como mucho 40 KB; dentro, una fila por línea, columnas con TAB; los saltos de
    // línea de un texto van como ⏎ y el $ como ${'$'} (en Kotlin interpola también en los textos crudos).
    const cruda = (s) => s.replace(/\n/g, '⏎').replace(/\t/g, ' ').replace(/\$/g, "${'$'}")
    const lineas = filas.map((f) => f.map(cruda).join('\t'))
    const bloques = []
    let actual = ''
    for (const l of lineas) {
      if (Buffer.byteLength(actual + l + '\n', 'utf8') > 40000) { bloques.push(actual); actual = '' }
      actual += l + '\n'
    }
    if (actual) bloques.push(actual)
    const kt = `package com.flotadsp.fds.ui

/* GENERADO por scripts/nativa-idioma.mjs (30-10-2026): no editar a mano. ${filas.length} textos de la app nativa con sus
   traducciones (en, pt, fr, it, de), sacadas de la web (frontend/src/lib/textosRuta*.js) y de
   app-android/traducciones-nativa.json. Una fila por línea, columnas con TAB; ⏎ es un salto de línea. En bloques
   porque una constante de Kotlin no puede pasar de 64 KB. */
internal object Traducciones {
    private val BLOQUES = listOf(
${bloques.map((b) => `        """${b}""",`).join('\n')}
    )

    /** { español -> [en, pt, fr, it, de] } */
    val MAPA: Map<String, Array<String>> by lazy {
        val m = HashMap<String, Array<String>>(${filas.length * 2})
        for (b in BLOQUES) for (l in b.lineSequence()) {
            if (l.isBlank()) continue
            val c = l.split('\\t')
            if (c.size == 6) m[c[0].replace('⏎', '\\n')] = Array(5) { c[it + 1].replace('⏎', '\\n') }
        }
        m
    }
}
`
    writeFileSync(SALIDA, kt)
    console.log(`nativa-idioma: Traducciones.kt con ${filas.length} textos (${bloques.length} bloques)`)
  }
  if (comprobar) {
    if (faltan.length) {
      console.log(`nativa-idioma: ${faltan.length} textos SIN traducción (ponlos en app-android/traducciones-nativa.json):`)
      for (const k of faltan) console.log(`  ${JSON.stringify(k)}  ← ${claves.get(k).join(', ')}`)
      process.exit(1)
    }
    console.log(`nativa-idioma: ${claves.size} textos, todos con sus 5 traducciones`)
  }
}
