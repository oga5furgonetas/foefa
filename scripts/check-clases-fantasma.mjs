#!/usr/bin/env node
/**
 * Clases de la paleta propia que NO EXISTEN.
 *
 * POR QUÉ. Una clase de Tailwind mal escrita no da error: simplemente no
 * genera CSS, y el elemento se queda con el color que herede. Falla en
 * silencio y hacia el lado peor.
 *
 * Pasó el 21-09-2026 con `text-brand-tinta`. La variable `--brand-tinta`
 * existe —es la tinta oscura del botón cian, y el propio `tailwind.config.js`
 * avisa de que en blanco ese cian da 1,7:1 y no se lee—, pero NO estaba
 * declarada como color, así que `text-brand-tinta` no pintaba nada. Dos
 * botones se quedaron con texto casi blanco sobre cian claro: **1,44:1**,
 * medido con axe. Y llevaba meses ahí, porque nadie mira un botón que
 * "está puesto".
 *
 * QUÉ MIRA. Solo las clases de LA PALETA DE LA CASA (`brand-*` y `dark-*`),
 * contra los tonos que declara `tailwind.config.js`. No es un linter genérico
 * de Tailwind: acotarlo así lo deja en cero falsos positivos, que es la única
 * forma de que un checker se siga mirando.
 *
 * Lo que no puede ver: clases construidas a trozos (`text-${c}-400`). Eso no
 * lo sabe nadie sin ejecutar, y tampoco es donde ha mordido.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const CONFIG = join(RAIZ, 'frontend', 'tailwind.config.js')
const FUENTES = join(RAIZ, 'frontend', 'src')

/* Las utilidades que aceptan un color. Si mañana se usa otra, el checker la
   ignora y no molesta: prefiero que se escape una a inventar avisos. */
const UTILIDADES = ['text', 'bg', 'border', 'ring', 'fill', 'stroke', 'divide',
  'from', 'to', 'via', 'placeholder', 'decoration', 'outline', 'accent',
  'caret', 'shadow']

function tonosDeclarados() {
  const cfg = readFileSync(CONFIG, 'utf8')
  const paletas = {}
  for (const familia of ['brand', 'dark']) {
    // El bloque `familia: { ... }` dentro de `colors`.
    const i = cfg.indexOf(`${familia}: {`)
    if (i === -1) throw new Error(`no encuentro la paleta "${familia}" en tailwind.config.js`)
    let prof = 0, fin = i
    for (let j = cfg.indexOf('{', i); j < cfg.length; j++) {
      if (cfg[j] === '{') prof++
      else if (cfg[j] === '}') { prof--; if (!prof) { fin = j; break } }
    }
    const bloque = cfg.slice(i, fin)
    paletas[familia] = new Set(
      [...bloque.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1])
        .filter((t) => t !== familia))
  }
  return paletas
}

function ficheros(dir, salida = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, salida)
    else if (/\.(jsx?|tsx?)$/.test(n)) salida.push(p)
  }
  return salida
}

const paletas = tonosDeclarados()
const familias = Object.keys(paletas)
// `text-brand-400/80` → la opacidad no es parte del tono.
const RE = new RegExp(
  `\\b(?:[a-z-]+:)*(${UTILIDADES.join('|')})-(${familias.join('|')})-([A-Za-z0-9_]+)`, 'g')

const fantasmas = []
for (const f of ficheros(FUENTES)) {
  const texto = readFileSync(f, 'utf8')
  const lineas = texto.split('\n')
  for (let i = 0; i < lineas.length; i++) {
    for (const m of lineas[i].matchAll(RE)) {
      const [todo, , familia, tono] = m
      if (paletas[familia].has(tono)) continue
      fantasmas.push({ fichero: relative(RAIZ, f), linea: i + 1, clase: todo,
        familia, tono })
    }
  }
}

if (!fantasmas.length) {
  const total = familias.map((f) => `${f}: ${[...paletas[f]].length} tonos`).join(', ')
  console.log(`check-clases-fantasma: 0 clases inexistentes (${total})`)
  process.exit(0)
}

console.error(`check-clases-fantasma: ${fantasmas.length} clase(s) que NO generan CSS\n`)
for (const g of fantasmas) {
  console.error(`  ${g.fichero}:${g.linea}`)
  console.error(`    ${g.clase}  →  la paleta "${g.familia}" no tiene el tono "${g.tono}"`)
  console.error(`    Tonos que sí existen: ${[...paletas[g.familia]].join(', ')}\n`)
}
console.error('Una clase que no existe no da error: deja el elemento con el color que herede.')
process.exit(1)
