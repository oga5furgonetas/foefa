#!/usr/bin/env node
/**
 * Claves de traducción que ya no usa nadie.
 *
 * `check-i18n` mira lo contrario (que lo usado exista). Aquí una clave cuenta
 * como MUERTA solo si su texto no aparece en ningún otro fichero de `src/` —ni
 * en un t('…'), ni guardada en un objeto para traducirla después ({ tit:
 * 'ob.n.vehiculos' })— y ningún prefijo dinámico (t(`sev.${x}`), t('nav.' + k))
 * la puede fabricar. Ante la duda, viva: borrar una clave que sí se usaba deja
 * el texto literal «ob.n.vehiculos» en la pantalla.
 *
 * Uso:  node scripts/i18n-muertas.mjs            → lista
 *       node scripts/i18n-muertas.mjs --borrar   → las quita de i18n.jsx
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'frontend', 'src')
const I18N = join(SRC, 'i18n.jsx')

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.(jsx?|mjs)$/.test(n)) out.push(p)
  }
  return out
}

const dic = readFileSync(I18N, 'utf8')
const claves = [...dic.matchAll(/^ {2}'([^']+)':\s*\{/gm)].map((m) => m[1])

// Todo el código menos las definiciones del diccionario.
let codigo = ''
for (const f of ficheros(SRC)) {
  const t = readFileSync(f, 'utf8')
  codigo += '\n' + (f === I18N ? t.replace(/^ {2}'[^']+':\s*\{[^\n]*$/gm, '') : t)
}

// Prefijos dinámicos: t(`pre.${x}`), t('pre.' + x), `pre.${x}` guardado aparte.
const prefijos = new Set()
for (const m of codigo.matchAll(/`([a-zA-Z][\w.-]*\.)\$\{/g)) prefijos.add(m[1])
for (const m of codigo.matchAll(/['"]([a-zA-Z][\w.-]*\.)['"]\s*\+/g)) prefijos.add(m[1])

const muertas = claves.filter((k) => {
  if ([...prefijos].some((p) => k.startsWith(p))) return false
  const q = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return !new RegExp(`['"\`]${q}['"\`]`).test(codigo)
})

console.log(`i18n: ${claves.length} claves, ${muertas.length} sin ningún uso` +
  ` (prefijos dinámicos respetados: ${[...prefijos].sort().join(' ')})`)
if (!process.argv.includes('--borrar')) {
  for (const k of muertas) console.log('  ' + k)
  process.exit(0)
}

// Solo entradas de UNA línea: las de varias se dejan (y se dicen) para no
// cortar un objeto por la mitad.
const set = new Set(muertas)
let quitadas = 0
const dejadas = []
const lineas = dic.split('\n').filter((l) => {
  const m = l.match(/^ {2}'([^']+)':\s*\{.*\},\s*$/)
  if (m && set.has(m[1])) { quitadas++; set.delete(m[1]); return false }
  return true
})
for (const k of set) dejadas.push(k)
writeFileSync(I18N, lineas.join('\n'))
console.log(`quitadas ${quitadas}; de varias líneas, sin tocar: ${dejadas.length}`)
for (const k of dejadas) console.log('  ' + k)
