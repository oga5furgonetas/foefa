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
 *
 * Y LA TARJETA DE LOS ENLACES DE REPARTO (14-11-2026): /repartidores, /invita, /empezar e /iphone son los enlaces
 * que un repartidor pasa por WhatsApp. Se llama a cada función con el index.html de verdad y se comprueba que la
 * vista previa es la de la app de ruta (og-repartidores.png) y que no queda la genérica (/og.png: desde la
 * portada nueva, una furgoneta con un golpe).
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
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

// La tarjeta de los enlaces de reparto, con el index.html de verdad (el que sirve ASSETS en producción).
const INDEX = readFileSync(join(RAIZ, 'frontend', 'index.html'), 'utf8')
const TARJETAS = ['repartidores', 'invita', 'empezar', 'iphone']
for (const nombre of TARJETAS) {
  const f = join(FUNCIONES, `${nombre}.js`)
  try {
    const { onRequestGet } = await import(pathToFileURL(f).href)
    const r = await onRequestGet({
      request: new Request(`https://flotadsp.com/${nombre}?ref=abc123`),
      env: { ASSETS: { fetch: async () => new Response(INDEX, { headers: { 'content-type': 'text/html' } }) } },
    })
    const html = await r.text()
    const imagenes = [...html.matchAll(/<meta\s+property="og:image"\s+content="([^"]*)"/g)].map((m) => m[1])
    if (imagenes.length !== 1 || !/\/og-repartidores\.png/.test(imagenes[0])) {
      fallos.push(`frontend/functions/${nombre}.js: la vista previa de /${nombre} no es la de la app de ruta (og:image = ${JSON.stringify(imagenes)})`)
    }
    if (!/<meta\s+property="og:title"\s+content="[^"]*ruta de reparto/i.test(html)) {
      fallos.push(`frontend/functions/${nombre}.js: el título de la vista previa de /${nombre} no habla de la ruta de reparto`)
    }
    if (!html.includes('<div id="root">')) fallos.push(`frontend/functions/${nombre}.js: /${nombre} ya no lleva el #root de la app`)
  } catch (e) {
    fallos.push(`frontend/functions/${nombre}.js: no se puede llamar: ${String(e?.message || e).split('\n')[0]}`)
  }
}

if (!fallos.length) {
  console.log(`check-funciones-pages: las ${lista.length} funciones de Pages cargan fuera del navegador y los ${TARJETAS.length} enlaces de reparto llevan su tarjeta`)
  process.exit(0)
}
console.error(`check-funciones-pages: ${fallos.length} función(es) de Pages que no cargan\n`)
for (const x of fallos) console.error('  ' + x)
process.exit(1)
