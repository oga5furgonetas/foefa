#!/usr/bin/env node
/**
 * EL DISEÑO COMPACTO (06-11-2026, §7.2 de la especificación): el guardarraíl de la app nativa, para que no vuelva a
 * crecer. Mira TODOS los .kt de la app (app-android/app/src/main/java: las pantallas de reparto, el portal, las piezas y
 * el tema), sin marca (08-11-2026; antes solo los que llevaban «// diseño compacto» en sus tres primeras líneas, y una
 * pantalla nueva sin ella se colaba) y falla si hay:
 *  - `fontSize =`: la letra la ponen los tokens de ui/Tema.kt (el único peso encima de un token es el del número);
 *  - `Color(0x…)` fuera de ui/Tema.kt: los colores salen de Paleta (los `0xFF….toInt()` de los dibujos del mapa se quedan);
 *  - `surfaceContainerLowest`: las tarjetas van en surfaceContainerLow (de noche, las de Lowest parecen agujeros);
 *  - un `.height(N.dp)` de 40 a 69: lo que lleva texto va con heightIn(min = …), o con la letra grande se recorta.
 * Mira el código SIN comentarios. ui/Tema.kt es el único sitio con tamaños de letra y colores a mano (y el que define
 * el surfaceContainerLowest del tema): a él solo se le mira la altura fija. Traducciones.kt es generado y no cuenta.
 *
 * EXCEPCIONES: pantallas que el diseño no rediseñó (§2: «les llega solo el tema») y que aún no cumplen, con cuántas líneas
 * tienen hoy y por qué. El número es un tope: si la pantalla se pasa, el checker falla; si baja, avisa para bajar el tope.
 * Una pantalla nueva no entra aquí: se monta con las piezas de ui/Componentes.kt y los tokens de ui/Tema.kt.
 *
 * Uso: node scripts/check-tokens-nativa.mjs   (sale con 1 si encuentra algo)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const KOTLIN = join(RAIZ, 'app-android', 'app', 'src', 'main', 'java')
const TEMA = 'com/flotadsp/fds/ui/Tema.kt'

const REGLAS = [
  { re: /\bfontSize\s*=/, que: 'fontSize = (la letra la pone el token, ui/Tema.kt)', salvoTema: true },
  { re: /\bColor\(0x/, que: 'Color(0x…) a mano (va en Paleta, ui/Tema.kt)', salvoTema: true },
  { re: /\bsurfaceContainerLowest\b/, que: 'surfaceContainerLowest (las tarjetas van en surfaceContainerLow)', salvoTema: true },
  { re: /\.height\(\s*(?:4\d|5\d|6\d)(?:\.0+)?\.dp\s*\)/, que: 'altura fija de 40 a 69 (heightIn(min = …) en lo que lleva texto)' },
]

/* Pantallas que el diseño compacto no rediseñó, con su tope de líneas de hoy y por qué (a 0, se quita la línea). Pasarlo a
   surfaceContainerLow cambia el color de la tarjeta, y eso no es de este checker: se hará cuando se rediseñe la pantalla. */
const EXCEPCIONES = {
  'com/flotadsp/fds/ui/acceso/AvisosConductorNativo.kt': [1, 'las tarjetas de los avisos del portal: surfaceContainerLowest a surfaceContainerLow cambia su color'],
}

function ficherosKt(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficherosKt(p, out)
    else if (n.endsWith('.kt') && n !== 'Traducciones.kt') out.push(p)
  }
  return out.sort()
}

/** Los comentarios, en blanco (las líneas se conservan para dar el número bueno). */
function sinComentarios(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length))
}

let mirados = 0
const porFichero = new Map()
for (const f of ficherosKt(KOTLIN)) {
  const rel = relative(KOTLIN, f).replace(/\\/g, '/')
  mirados += 1
  const hallados = []
  sinComentarios(readFileSync(f, 'utf8')).split('\n').forEach((l, i) => {
    for (const { re, que, salvoTema } of REGLAS) {
      if (salvoTema && rel === TEMA) continue
      if (re.test(l)) hallados.push(`${rel}:${i + 1}  ${que}\n      ${l.trim().slice(0, 140)}`)
    }
  })
  if (hallados.length) porFichero.set(rel, hallados)
}

if (!mirados) {
  console.error('check-tokens-nativa: no se ha encontrado ningún .kt en ' + KOTLIN)
  process.exit(1)
}
const malos = []
const avisos = []
let tolerados = 0
for (const [rel, hallados] of porFichero) {
  const ex = EXCEPCIONES[rel]
  if (!ex) { malos.push(...hallados); continue }
  const [tope, porque] = ex
  tolerados += Math.min(hallados.length, tope)
  if (hallados.length > tope) malos.push(`${rel}  ${hallados.length} líneas, el tope es ${tope} (${porque}): no se añaden más`, ...hallados)
  else if (hallados.length < tope) avisos.push(`${rel}: tiene ${hallados.length} líneas y el tope dice ${tope}: baja el tope en EXCEPCIONES`)
}
for (const rel of Object.keys(EXCEPCIONES)) {
  if (!porFichero.has(rel)) avisos.push(`${rel}: ya no tiene líneas fuera de los tokens: quítalo de EXCEPCIONES`)
}
for (const a of avisos) console.warn(`  aviso: ${a}`)

if (!malos.length) {
  console.log(`check-tokens-nativa: ${mirados} ficheros .kt, sin tamaños de letra, colores a mano, surfaceContainerLowest ni alturas fijas (${tolerados} línea(s) tolerada(s) en ${Object.keys(EXCEPCIONES).length} pantalla(s) de EXCEPCIONES)`)
  process.exit(0)
}
console.error(`check-tokens-nativa: ${malos.length} línea(s) fuera de los tokens en ${mirados} ficheros .kt\n`)
for (const h of malos) console.error('  ' + h)
process.exit(1)
