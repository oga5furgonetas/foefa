#!/usr/bin/env node
/* Los tokens del diseño compacto de la app de reparto (06-11-2026; §3 y §7.2 de la especificación).

   Mira los ficheros de `frontend/src` que llevan arriba el comentario `/* diseño compacto *\/` (las piezas y, pantalla a
   pantalla, lo que cada parte va terminando; la parte F lo pasa a todas las pantallas de reparto sin marca) y falla si
   alguna clase de un className lleva:
     - `text-[`, `bg-[#`, `border-[#` o un color hex: la letra y el color salen de los tokens (text-texto, text-ruta-ok…);
     - `rounded-3xl` o un espaciado `*.5` (salvo `0.5`): los radios son 4 · 8 · 12 · 16 · redondo y los espacios 4 · 8 · 12 ·
       16 · 24;
     - `bg-gradient-`, `from-`, `via-` o `to-`: plano;
     - `shadow-lg`, `-xl`, `-2xl` o una sombra de color: sombra solo en lo que flota (shadow-md);
     - alturas en `vh` (van en `dvh`, que descuenta la barra del navegador del móvil);
     - `text-dark-500` o `-600` en un texto que no esté desactivado (no se leen al sol).
   Se miran todas las cadenas del fichero (los className suelen montarse a trozos), sin los comentarios.

   Uso: node scripts/check-tokens-ruta.mjs   (sale con 1 si encuentra algo) */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const SRC = join(RAIZ, 'frontend', 'src')
const MARCA = 'diseño compacto'

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.jsx?$/.test(n)) out.push(p)
  }
  return out
}

/* [patrón sobre la clase, motivo, condición extra sobre el match] */
const REGLAS = [
  [/^(?:[\w-]+:)*text-\[/, 'text-[…]: la letra y el color salen de los tokens (text-texto, text-ruta-ok…)'],
  [/^(?:[\w-]+:)*(?:bg|border|text|ring|shadow|from|via|to|divide|outline|fill|stroke|decoration|accent|caret)-\[#/, 'color hex a mano: va como --r-* en index.css'],
  [/#[0-9a-fA-F]{3,8}\b/, 'color hex a mano: va como --r-* en index.css'],
  [/^(?:[\w-]+:)*rounded(?:-[trblse]{1,2})?-3xl$/, 'rounded-3xl: los radios son 4 · 8 · 12 · 16 · redondo (rounded, -lg, -xl, -2xl, -full)'],
  [/^(?:[\w-]+:)*-?[a-z]+(?:-[a-z]+)*-(\d+)\.5$/, 'espaciado *.5: solo 4 · 8 · 12 · 16 · 24 (0.5 vale entre dos líneas del mismo elemento)', (m) => m[1] !== '0'],
  [/^(?:[\w-]+:)*(?:bg-gradient-|from-|via-|to-)/, 'degradado: plano, sin degradados'],
  [/^(?:[\w-]+:)*shadow-(?:lg|xl|2xl)$/, 'sombra grande: sombra solo en lo que flota (shadow-md)'],
  [/^(?:[\w-]+:)*shadow-(?:black|white|[a-z]+-\d+)(?:\/\d+)?$/, 'sombra de color: sin sombras de color'],
  [/\[[^\]]*(?<!d)vh\b/, 'altura en vh: va en dvh'],
]
const DARK = /^(?:[\w-]+:)*text-dark-(?:500|600)(?:\/\d+)?$/

/* Fuera los comentarios, conservando las líneas (para decir en cuál está cada fallo). */
const sinComentarios = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1')

const CADENA = /'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g

let conMarca = 0
let miradas = 0
const fallos = []
for (const f of ficheros(SRC)) {
  const crudo = readFileSync(f, 'utf8')
  if (!crudo.split('\n').slice(0, 3).join('\n').includes(MARCA)) continue
  conMarca += 1
  const texto = sinComentarios(crudo)
  const rel = relative(RAIZ, f).replace(/\\/g, '/')
  for (const m of texto.matchAll(CADENA)) {
    const contenido = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
    const linea = texto.slice(0, m.index).split('\n').length
    const lineaTexto = texto.split('\n')[linea - 1] || ''
    for (const clase of contenido.split(/\s+/).filter(Boolean)) {
      miradas += 1
      for (const [re, motivo, extra] of REGLAS) {
        const mm = clase.match(re)
        if (mm && (!extra || extra(mm))) { fallos.push({ rel, linea, clase, motivo }); break }
      }
      if (DARK.test(clase) && !/(^|:)disabled:/.test(clase) && !/disabled/.test(lineaTexto)) {
        fallos.push({ rel, linea, clase, motivo: 'text-dark-500/600 en un texto que se lee: el secundario es text-dark-400' })
      }
    }
  }
}

if (!fallos.length) {
  console.log(`check-tokens-ruta: ${conMarca} ficheros con la marca «${MARCA}», ${miradas} clases miradas, 0 fuera de los tokens`)
  process.exit(0)
}
console.error(`check-tokens-ruta: ${fallos.length} clase(s) fuera de los tokens del diseño compacto en ${conMarca} fichero(s) con marca\n`)
for (const x of fallos) console.error(`  ${x.rel}:${x.linea}  ${x.clase}  →  ${x.motivo}`)
console.error('\nLos tokens están en frontend/tailwind.config.js (text-*, ruta-*) y en index.css (--r-*, .campo).')
process.exit(1)
