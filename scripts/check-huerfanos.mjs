#!/usr/bin/env node
/**
 * Ficheros del frontend a los que no llega nadie desde la entrada.
 *
 * Al quitar una pantalla se quedan colgando sus piezas: un componente que solo
 * usaba ella, un ayudante de su carpeta `lib/`. No rompen nada —por eso nadie
 * los ve—, pero engordan el código, salen en las búsquedas y confunden al que
 * viene detrás, que los cree vivos y los mantiene.
 *
 * Se recorre el grafo de imports (estáticos y `import()`) desde `src/main.jsx`
 * y se listan los ficheros de `src/` que no aparecen en él. Los tests y los
 * ficheros de configuración no cuentan.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'

const RAIZ = process.cwd()
const SRC = join(RAIZ, 'frontend', 'src')
const ENTRADA = join(SRC, 'main.jsx')

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.(jsx?|mjs)$/.test(n) && !/\.test\.|\.spec\./.test(n)) out.push(p)
  }
  return out
}

function resolver(desde, spec) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(desde), spec)
  for (const c of [base, base + '.js', base + '.jsx', base + '.mjs',
                   join(base, 'index.js'), join(base, 'index.jsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

const vistos = new Set()
const pila = [ENTRADA]
while (pila.length) {
  const f = pila.pop()
  if (vistos.has(f)) continue
  vistos.add(f)
  const t = readFileSync(f, 'utf8')
  const specs = [
    ...[...t.matchAll(/(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...t.matchAll(/import\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...t.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ]
  for (const s of specs) {
    const d = resolver(f, s)
    if (d && /\.(jsx?|mjs)$/.test(d)) pila.push(d)
  }
}

const huerfanos = ficheros(SRC).filter((f) => !vistos.has(f)).map((f) => relative(RAIZ, f))
if (!huerfanos.length) {
  console.log(`check-huerfanos: los ${vistos.size} ficheros se usan todos`)
  process.exit(0)
}
console.error(`check-huerfanos: ${huerfanos.length} fichero(s) a los que no llega nadie\n`)
for (const h of huerfanos.sort()) console.error('  ' + h)
process.exit(1)
