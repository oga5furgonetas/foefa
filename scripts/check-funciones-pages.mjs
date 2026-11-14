#!/usr/bin/env node
/**
 * Las funciones de Cloudflare Pages (frontend/functions/, con sus subcarpetas) tienen que CARGAR fuera del navegador.
 *
 * Corren en un Worker: no hay `window`, ni `localStorage`, ni `import.meta.env` de Vite. Las pruebas de pantalla no
 * las ven (Playwright sirve la web con `vite preview`, sin funciones), así que si una importa algo de src/ que un día
 * gana un import del navegador (functions/empresas.js importa src/lib/precios.js y src/marca.js), la página se rompe
 * en producción sin que falle nada aquí. Nació con /empresas (14-11-2026, revisión de regresiones, R3).
 *
 * Importa cada fichero con Node (que tampoco tiene `window`) y falla si alguno no carga. Una ruta de Pages
 * (`[param].js`, `[[catchall]].js`) se importa igual: el nombre no cambia nada.
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const RAIZ = process.cwd()
const FUNCIONES = join(RAIZ, 'frontend', 'functions')

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.m?js$/.test(n)) out.push(p)
  }
  return out
}

if (!existsSync(FUNCIONES)) {
  console.error(`check-funciones-pages: no encuentro ${relative(RAIZ, FUNCIONES)} (lánzalo desde la raíz del repo)`)
  process.exit(1)
}

const lista = ficheros(FUNCIONES)
const fallos = []
for (const f of lista) {
  try {
    await import(pathToFileURL(f).href)
  } catch (e) {
    fallos.push(`${relative(RAIZ, f).replace(/\\/g, '/')}: no carga fuera del navegador: ${String(e?.message || e).split('\n')[0]}`)
  }
}

if (!fallos.length) {
  console.log(`check-funciones-pages: las ${lista.length} funciones de Pages cargan fuera del navegador`)
  process.exit(0)
}
console.error(`check-funciones-pages: ${fallos.length} función(es) de Pages que no cargan\n`)
for (const x of fallos) console.error('  ' + x)
process.exit(1)
