#!/usr/bin/env node
/* Los tokens del diseño compacto de la app de reparto (06-11-2026; §3 y §7.2 de la especificación).

   Mira TODAS las pantallas de reparto de `frontend/src`, sin marca (08-11-2026; antes solo los ficheros con el comentario
   `/* diseño compacto *\/`, y una pantalla nueva sin él se colaba): `pages/driver/**` (la ruta, las piezas, la guía, el
   portal), `pages/RutaApp.jsx`, `RutaCuenta.jsx`, `InstalarApp.jsx`, `AvisoManana.jsx`, `OpinionRuta.jsx` y
   `panel/components/MapaReparto.jsx` (el mapa es también del panel: se le miran todas las reglas menos los colores hex).
   Falla si alguna clase de un className lleva:
     - `text-[`, `bg-[#`, `border-[#` o un color hex: la letra y el color salen de los tokens (text-texto, text-ruta-ok…);
     - `rounded-3xl` o un espaciado `*.5` (salvo `0.5`): los radios son 4 · 8 · 12 · 16 · redondo y los espacios 4 · 8 · 12 ·
       16 · 24;
     - `bg-gradient-`, `from-`, `via-` o `to-`: plano;
     - `shadow-lg`, `-xl`, `-2xl` o una sombra de color: sombra solo en lo que flota (shadow-md);
     - alturas en `vh` (van en `dvh`, que descuenta la barra del navegador del móvil);
     - `text-dark-500` o `-600` en un texto que no esté desactivado (no se leen al sol).
   Se miran todas las cadenas del fichero (los className suelen montarse a trozos), sin los comentarios.

   Dos salvedades, las dos escritas abajo con su porqué:
     - DIBUJOS_DEL_MAPA: los colores hex de las chinchetas, las líneas y las ventanas de Leaflet no son clases y no cambian (§2).
     - EXCEPCIONES: pantallas del portal que el diseño no rediseñó (§2: «les llega solo el tema»), con cuántos fallos tienen
       hoy. El número es un tope: si una de ellas se pasa, el checker falla; si baja, avisa para bajar el tope. Una
       pantalla nueva no entra aquí: se monta con las piezas de `pages/driver/piezas/`.

   Uso: node scripts/check-tokens-ruta.mjs   (sale con 1 si encuentra algo) */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const SRC = join(RAIZ, 'frontend', 'src')

/* Lo que se mira (rutas relativas a frontend/src, con /). */
const esPantallaDeReparto = (rel) => rel.startsWith('pages/driver/')
  || ['pages/RutaApp.jsx', 'pages/RutaCuenta.jsx', 'pages/InstalarApp.jsx', 'pages/AvisoManana.jsx', 'pages/OpinionRuta.jsx',
    'panel/components/MapaReparto.jsx'].includes(rel)

/* Ficheros que dibujan en el mapa con colores hex (SVG, estilos en línea y CSS de las ventanas de Leaflet): el diseño
   no toca los dibujos del mapa, así que ahí la regla del hex no vale. Las demás reglas, sí. */
const DIBUJOS_DEL_MAPA = new Set([
  'panel/components/MapaReparto.jsx',   // las chinchetas, la furgoneta, las zonas y las ventanas (también las del panel)
  'pages/driver/Navegacion.jsx',        // la línea de la guía, la chincheta de la parada y la flecha de «yo»
])

/* Pantallas que el diseño compacto no rediseñó (§2 «Lo que NO se toca»): cada una con su tope de fallos de hoy y por qué.
   Quitar uno de esos fallos cambia cómo se ve la pantalla (otra letra, otro color o otro hueco), y eso no es de este
   checker: se hará cuando se rediseñe la pantalla, y entonces se baja el tope (a 0 se quita la línea). */
const EXCEPCIONES = {
  'pages/driver/MiRuta.jsx': [3, '«Navegar con» (ElegirNavegador): lo comparten Ajustes y el portal, que no se rediseñan; el resto de MiRuta está limpio'],
  'pages/driver/AjustesMovil.jsx': [9, 'Ajustes de la app: no se rediseñan, les llegó solo el tema'],
  'pages/driver/DriverLogin.jsx': [21, 'la entrada del portal del conductor: no se rediseña'],
  'pages/driver/MiClave.jsx': [47, 'cuenta del portal (cambiar la contraseña): no se rediseña'],
  'pages/driver/MiCorreoPersonal.jsx': [9, 'cuenta del portal (correo personal de recuperación): no se rediseña'],
  'pages/driver/VerificarCorreoConductor.jsx': [4, 'cuenta del portal (verificar el correo): no se rediseña'],
  'pages/driver/DriverReferralWallet.jsx': [40, 'la cartera de referidos del portal: un extra que no se rediseña'],
  'pages/driver/MisTurnos.jsx': [41, 'los turnos del portal: no se rediseñan'],
  'pages/driver/PedirDias.jsx': [101, 'pedir días libres, turnos del portal: no se rediseña'],
  'pages/driver/TrabajarMas.jsx': [45, 'turnos extra del portal: no se rediseñan'],
  'pages/driver/InspectionFlow.jsx': [52, 'la auditoría de la furgoneta (fotos y km antes de salir): no se rediseña'],
  'pages/driver/InspectionDone.jsx': [33, 'la auditoría de la furgoneta (resumen final): no se rediseña'],
  'pages/driver/Tienda.jsx': [113, 'la tienda de ropa es del dueño del producto (solo super-admin), no de la app de reparto'],
}

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.jsx?$/.test(n)) out.push(p)
  }
  return out
}

/* [patrón sobre la clase, motivo, condición extra sobre el match, id] */
const REGLAS = [
  [/^(?:[\w-]+:)*text-\[/, 'text-[…]: la letra y el color salen de los tokens (text-texto, text-ruta-ok…)'],
  [/^(?:[\w-]+:)*(?:bg|border|text|ring|shadow|from|via|to|divide|outline|fill|stroke|decoration|accent|caret)-\[#/, 'color hex a mano: va como --r-* en index.css', null, 'hex'],
  [/#[0-9a-fA-F]{3,8}\b/, 'color hex a mano: va como --r-* en index.css', null, 'hex'],
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

let mirados = 0
let miradas = 0
const fallosPorFichero = new Map()
for (const f of ficheros(SRC)) {
  const rel = relative(SRC, f).replace(/\\/g, '/')
  if (!esPantallaDeReparto(rel)) continue
  mirados += 1
  const sinHex = DIBUJOS_DEL_MAPA.has(rel)
  const texto = sinComentarios(readFileSync(f, 'utf8'))
  const lineas = texto.split('\n')
  const fallos = []
  for (const m of texto.matchAll(CADENA)) {
    const contenido = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
    const linea = texto.slice(0, m.index).split('\n').length
    const lineaTexto = lineas[linea - 1] || ''
    for (const clase of contenido.split(/\s+/).filter(Boolean)) {
      miradas += 1
      for (const [re, motivo, extra, id] of REGLAS) {
        if (id === 'hex' && sinHex) continue
        const mm = clase.match(re)
        if (mm && (!extra || extra(mm))) { fallos.push({ linea, clase, motivo }); break }
      }
      if (DARK.test(clase) && !/(^|:)disabled:/.test(clase) && !/disabled/.test(lineaTexto)) {
        fallos.push({ linea, clase, motivo: 'text-dark-500/600 en un texto que se lee: el secundario es text-dark-400' })
      }
    }
  }
  if (fallos.length) fallosPorFichero.set(rel, fallos)
}

const malos = []        // fallos de ficheros fuera de la lista, o de la lista por encima de su tope
const avisos = []       // ficheros de la lista que ya tienen menos fallos que su tope
let tolerados = 0
for (const [rel, fallos] of fallosPorFichero) {
  const ex = EXCEPCIONES[rel]
  if (!ex) { for (const x of fallos) malos.push({ rel, ...x }); continue }
  const [tope, porque] = ex
  tolerados += Math.min(fallos.length, tope)
  if (fallos.length > tope) {
    malos.push({ rel, linea: 0, clase: `${fallos.length} fallos, el tope es ${tope}`, motivo: `${porque}: no se añaden más; las clases nuevas van con los tokens` })
    for (const x of fallos) malos.push({ rel, ...x })
  } else if (fallos.length < tope) avisos.push(`${rel}: tiene ${fallos.length} fallos y el tope dice ${tope}: baja el tope en EXCEPCIONES`)
}
for (const rel of Object.keys(EXCEPCIONES)) {
  if (!fallosPorFichero.has(rel)) avisos.push(`${rel}: ya no tiene fallos: quítalo de EXCEPCIONES`)
}
for (const a of avisos) console.warn(`  aviso: ${a}`)

if (!malos.length) {
  console.log(`check-tokens-ruta: ${mirados} ficheros de reparto, ${miradas} clases miradas, 0 fuera de los tokens (${tolerados} tolerados en ${Object.keys(EXCEPCIONES).length} pantallas de EXCEPCIONES)`)
  process.exit(0)
}
console.error(`check-tokens-ruta: ${malos.length} clase(s) fuera de los tokens del diseño compacto en ${mirados} ficheros de reparto\n`)
for (const x of malos) console.error(`  ${x.rel}:${x.linea}  ${x.clase}  →  ${x.motivo}`)
console.error('\nLos tokens están en frontend/tailwind.config.js (text-*, ruta-*) y en index.css (--r-*, .campo); las piezas, en pages/driver/piezas/.')
process.exit(1)
