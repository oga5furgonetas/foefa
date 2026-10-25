#!/usr/bin/env node
/**
 * Texto VISIBLE que nombra otra plataforma o la marca escrita a mano.
 *
 * El producto se vende a cualquier empresa con flota. Un «Pegar roster de
 * Amazon» o un «FlotaDSP» escrito a mano en una pantalla es lo primero que ve
 * un cliente que no es de reparto, y le dice que el producto no es para él.
 * La marca sale de `src/marca.js`; aquí no puede aparecer escrita.
 *
 * Mira el código SIN comentarios (los comentarios son notas de historia y
 * pueden nombrar lo que haga falta). Las excepciones van en PERMITIDO con su
 * motivo.
 *
 * Uso: node scripts/check-marca.mjs   (sale con 1 si encuentra algo)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const SRC = join(RAIZ, 'frontend', 'src')
// OGA5/DGA1/DGA2 son las naves de Dani: como ejemplo en un campo, le dicen a
// un súper o a un taller que el producto es de paquetería (03-10-2026).
const PATRON = /flotadsp|\bamazon\b|\bcortex\b|\bdsps?\b|\bdnr\b|scorecard|\bwiniw\b|transporter id|\boga5\b|\bdga[12]\b/i

/* Menciones legítimas: [fichero, trozo de la línea, por qué]. */
const PERMITIDO = [
  ['pages/Repartidores.jsx', "['paquetería', '", 'portada de repartidores: a quien sirve en cada pais (uso descriptivo; la propia pagina avisa de que son marcas ajenas, sin relacion)'],
  ['lib/apiBase.js', 'ennuestrodominio', 'regex tecnica del dominio donde se sirve la app (no es texto visible)'],
  ['lib/enApp.js', 'de_play', 'identificador tecnico del paquete de Play (no es texto visible)'],
  ['lib/instalar.js', 'nuestra_app', 'identificadores tecnicos de los paquetes de Android: Play, APK y China (no es texto visible)'],
  ['panel/components/TiendaPrendas.jsx', 'camiseta oga5', 'la tienda de ropa es del dueño (solo super-admin)'],
  // En el ALTA se pregunta a qué se dedica la empresa y una opción es ser DSP
  // de Amazon (lo pidió Dani el 03-10-2026): es nombrar al cliente del
  // cliente, un uso descriptivo. Solo en esa tarjeta.
  ['pages/Registro.jsx', 'dsp de amazon', 'tarjeta del sector en el alta'],
  ['pages/Registro.jsx', 'plantilla del d', 'descripción de la tarjeta DSP de Amazon: nombra sus módulos (DNR, WHC)'],
  ['panel/pages/Gastos.jsx', 'amazon', 'compras en Amazon como proveedor de material: es un comercio, no la plataforma'],
  ['panel/pages/Tienda.jsx', 'amazon', 'comparativa de precios de la tienda con Amazon como comercio'],
  // «dsp» es el VALOR interno del tipo de cuenta de un cliente (account_type) y
  // el nombre de un campo que manda el backend. Nadie lo lee en pantalla;
  // cambiarlo obligaria a migrar datos sin ganar nada.
  ['panel/pages/Negocio.jsx', "account_type: 'dsp'", 'valor interno del tipo de cuenta'],
  ['panel/pages/Negocio.jsx', '${x.dsp}', 'campo del backend con el nombre de la empresa'],
  // La DNR diaria es el modulo para quien reparte PARA Amazon (lo pidio Dani el
  // 26-09-2026 para su flota). No va en el estandar: una empresa que no reparte
  // para Amazon no lo ve salvo que se le active. Nombrar Amazon es su tema.
  ['panel/pages/Diarios.jsx', '*', 'modulo de DNR de Amazon, solo para quien lo tiene activado'],
  ['panel/components/AvisoIdAmazon.jsx', '*', 'parte de la DNR diaria'],
  // Horas (WHC), el mismo caso: lo pidio Dani el 27-09-2026 para su flota y no
  // va en el estandar. Se pega el plan del portal de Amazon.
  ['panel/pages/Horas.jsx', '*', 'modulo de horas (WHC) de Amazon, solo para quien lo tiene activado'],
  ['panel/ayudaFichas.js', 'portal de amazon abre la programaci', 'ficha de ayuda de Horas'],
  ['panel/ayudaFichas.js', 'tu whc de amazon exacto', 'ficha de ayuda de Horas'],
  ['panel/pages/Usuarios.jsx', "['diarios', 'nav.dnr']", 'casilla de permiso de la DNR diaria (el nombre del menú)'],
  ['panel/ayudaFichas.js', '(dnr), por conductor', 'ficha de ayuda de la DNR diaria'],
  ['panel/ayudaFichas.js', 'descarga el daily report (.html)', 'ficha de ayuda de la DNR diaria'],
  ['panel/ayudaFichas.js', 'cada dnr se cuelga', 'ficha de ayuda de la DNR diaria'],
  ['panel/ayudaFichas.js', 'amazon rellena la columna dsc', 'ficha de ayuda de la DNR diaria'],
  ['panel/PanelLayout.jsx', "'nav.dnr'", 'entrada de menu de la DNR diaria'],
  ['i18nDict.js', "'nav.dnr'", 'nombre del menu de la DNR diaria'],
  ['i18nZh.js', "'nav.dnr'", 'nombre del menu de la DNR diaria, en chino'],
]

function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.(jsx?|mjs)$/.test(n)) out.push(p)
  }
  return out
}

function sinComentarios(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length))
}

const hallados = []
for (const f of ficheros(SRC)) {
  if (f.endsWith('marca.js')) continue
  const rel = relative(SRC, f).replace(/\\/g, '/')
  const lineas = sinComentarios(readFileSync(f, 'utf8')).split('\n')
  lineas.forEach((l, i) => {
    const m = l.match(PATRON)
    if (!m) return
    if (PERMITIDO.some(([fi, trozo]) => rel === fi && (trozo === '*' || l.toLowerCase().includes(trozo)))) return
    hallados.push(`${rel}:${i + 1}  ${l.trim().slice(0, 150)}`)
  })
}

if (!hallados.length) {
  console.log('check-marca: ningún texto visible nombra otra plataforma ni la marca a mano')
  process.exit(0)
}
console.error(`check-marca: ${hallados.length} línea(s)\n`)
for (const h of hallados) console.error('  ' + h)
process.exit(1)
