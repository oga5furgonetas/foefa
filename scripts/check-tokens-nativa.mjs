#!/usr/bin/env node
/**
 * EL DISEÑO COMPACTO (06-11-2026, §7.2 de la especificación): el guardarraíl de la app nativa, para que no vuelva a
 * crecer. Mira los .kt de app-android que llevan «// diseño compacto» en sus tres primeras líneas (cada parte marca
 * los ficheros que termina; la parte F quita la marca y pasa a mirar todas las pantallas de reparto) y falla si hay:
 *  - `fontSize =`: la letra la ponen los tokens de ui/Tema.kt (el único peso encima de un token es el del número);
 *  - `Color(0x…)` fuera de ui/Tema.kt: los colores salen de Paleta (los `0xFF….toInt()` de los dibujos del mapa se quedan);
 *  - `surfaceContainerLowest`: las tarjetas van en surfaceContainerLow (de noche, las de Lowest parecen agujeros);
 *  - un `.height(N.dp)` de 40 a 69: lo que lleva texto va con heightIn(min = …), o con la letra grande se recorta.
 * Mira el código SIN comentarios. ui/Tema.kt es el único sitio con tamaños de letra y colores a mano (y el que define
 * el surfaceContainerLowest del tema): a él solo se le mira la altura fija. Traducciones.kt es generado y no cuenta.
 *
 * Uso: node scripts/check-tokens-nativa.mjs   (sale con 1 si encuentra algo)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const KOTLIN = join(RAIZ, 'app-android', 'app', 'src', 'main', 'java')
const TEMA = 'com/flotadsp/fds/ui/Tema.kt'
const MARCA = /^\s*\/\/\s*diseño compacto\s*$/

const REGLAS = [
  { re: /\bfontSize\s*=/, que: 'fontSize = (la letra la pone el token, ui/Tema.kt)', salvoTema: true },
  { re: /\bColor\(0x/, que: 'Color(0x…) a mano (va en Paleta, ui/Tema.kt)', salvoTema: true },
  { re: /\bsurfaceContainerLowest\b/, que: 'surfaceContainerLowest (las tarjetas van en surfaceContainerLow)', salvoTema: true },
  { re: /\.height\(\s*(?:4\d|5\d|6\d)(?:\.0+)?\.dp\s*\)/, que: 'altura fija de 40 a 69 (heightIn(min = …) en lo que lleva texto)' },
]

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

const marcados = []
const hallados = []
for (const f of ficherosKt(KOTLIN)) {
  const texto = readFileSync(f, 'utf8')
  if (!texto.split('\n', 3).some((l) => MARCA.test(l))) continue
  const rel = relative(KOTLIN, f).replace(/\\/g, '/')
  marcados.push(rel)
  const lineas = sinComentarios(texto).split('\n')
  lineas.forEach((l, i) => {
    for (const { re, que, salvoTema } of REGLAS) {
      if (salvoTema && rel === TEMA) continue
      if (re.test(l)) hallados.push(`${rel}:${i + 1}  ${que}\n      ${l.trim().slice(0, 140)}`)
    }
  })
}

if (!marcados.length) {
  console.error('check-tokens-nativa: ningún .kt lleva la marca «// diseño compacto»')
  process.exit(1)
}
if (!hallados.length) {
  console.log(`check-tokens-nativa: ${marcados.length} fichero(s) con la marca, sin tamaños de letra, colores a mano, surfaceContainerLowest ni alturas fijas`)
  process.exit(0)
}
console.error(`check-tokens-nativa: ${hallados.length} línea(s) en ${marcados.length} fichero(s) marcados\n`)
for (const h of hallados) console.error('  ' + h)
process.exit(1)
