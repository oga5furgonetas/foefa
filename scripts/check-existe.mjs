#!/usr/bin/env node
/**
 * Lo que se importa tiene que EXISTIR.
 *
 * `check-importados` mira lo contrario —que lo que se usa esté importado—. Este
 * mira las dos cosas que se rompen al BORRAR: un nombre importado de un módulo
 * que ya no lo exporta, y un fichero importado que ya no está (incluidos los
 * `lazy(() => import('./X'))`, que fallan al abrir la pantalla, no al compilar
 * el resto).
 *
 * Nació al quitar de la app todo lo de otra plataforma: 102 funciones de la API
 * y 45 ficheros. Vite para en el primer error; esto los da todos de una vez.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'

const RAIZ = process.cwd()
const SRC = join(RAIZ, 'frontend', 'src')

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.(jsx?|mjs)$/.test(n)) out.push(p)
  }
  return out
}

function resolver(desde, spec) {
  if (!spec.startsWith('.')) return null            // paquetes de npm: no se miran
  const base = resolve(dirname(desde), spec)
  for (const c of [base, base + '.js', base + '.jsx', base + '.mjs',
                   join(base, 'index.js'), join(base, 'index.jsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return false
}

const cacheExports = new Map()
function exportsDe(fich) {
  if (cacheExports.has(fich)) return cacheExports.get(fich)
  const t = readFileSync(fich, 'utf8')
  const s = new Set()
  for (const m of t.matchAll(/export\s+(?:const|let|var|function\*?|async\s+function|class)\s+([A-Za-z_$][\w$]*)/g)) s.add(m[1])
  for (const m of t.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const x of m[1].split(',')) {
      const nom = x.trim().split(/\s+as\s+/).pop().trim()
      if (nom) s.add(nom)
    }
  }
  if (/export\s+default\b/.test(t)) s.add('default')
  cacheExports.set(fich, s)
  return s
}

const fallos = []
for (const f of ficheros(SRC)) {
  const t = readFileSync(f, 'utf8')
  const rel = relative(RAIZ, f)
  // import { a, b as c } from './x'   ·   import X, { a } from './x'
  for (const m of t.matchAll(/import\s+([^'"]+?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const destino = resolver(f, m[2])
    if (destino === null) continue
    if (destino === false) { fallos.push(`${rel}: importa «${m[2]}», que no existe`); continue }
    const llaves = m[1].match(/\{([^}]*)\}/)
    if (llaves) {
      const exp = exportsDe(destino)
      for (const x of llaves[1].split(',')) {
        const nom = x.trim().split(/\s+as\s+/)[0].trim()
        if (nom && !exp.has(nom)) fallos.push(`${rel}: «${nom}» no lo exporta ${relative(RAIZ, destino)}`)
      }
    }
  }
  // lazy(() => import('./X'))  ·  import('./X')
  for (const m of t.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (resolver(f, m[1]) === false) fallos.push(`${rel}: carga «${m[1]}», que no existe`)
  }
}

if (!fallos.length) {
  console.log('check-existe: todo lo importado existe')
  process.exit(0)
}
console.error(`check-existe: ${fallos.length} importación(es) de algo que no existe\n`)
for (const x of fallos) console.error('  ' + x)
process.exit(1)
