#!/usr/bin/env node
/**
 * Las guías de devolución de /devolucion-renting (frontend/src/lib/guiasRenting.js), comprobadas antes de publicar.
 *
 * Un número mal puesto en una de esas guías es un «no se cobra» que sí se cobra: por eso este comprobador mira que
 *  - cada documento tiene URL https, edición y fecha de lectura;
 *  - cada regla tiene una zona conocida, página ≥ 1 (y no más que las del documento), textos no vacíos y, si lleva
 *    medida, límite > 0 y unidad conocida;
 *  - cada regla sale UNA vez en el recorrido (pregunta, «También mira» o aparte), cada paso apunta a una regla que
 *    existe, y un paso que dice «su guía dice que se factura» tiene algo que la guía diga que se cobra;
 *  - ninguna frase de las prohibidas (en los datos y en las pantallas de la herramienta, sin contar comentarios);
 *  - y los datos no han cambiado respecto a la huella guardada: quien cambie una cifra a propósito (otra edición de
 *    una guía) la actualiza con `node scripts/check-guias-renting.mjs --huella` y pega la nueva aquí, diciendo por qué.
 *
 * Uso: node scripts/check-guias-renting.mjs   (sale con 1 si algo falla)
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

// La huella de DOCUMENTOS + AJUSTES + RECORRIDOS + COMPANIAS (14-11-2026: las 9 guías leídas ese día).
const HUELLA = '04f53517919032f3'

const RAIZ = process.cwd()
const MODULO = join(RAIZ, 'frontend', 'src', 'lib', 'guiasRenting.js')
if (!existsSync(MODULO)) {
  console.error('check-guias-renting: no encuentro frontend/src/lib/guiasRenting.js (lánzalo desde la raíz del repo)')
  process.exit(1)
}
const G = await import(pathToFileURL(MODULO).href)
const { DOCUMENTOS, AJUSTES, RECORRIDOS, COMPANIAS, ZONAS, LEIDA_EL, regla, pasosDe } = G

const huella = createHash('sha256').update(JSON.stringify({ DOCUMENTOS, AJUSTES, RECORRIDOS, COMPANIAS })).digest('hex').slice(0, 16)
if (process.argv.includes('--huella')) { console.log(huella); process.exit(0) }

const fallos = []
const UNIDADES = new Set(['cm', 'mm', 'por_ciento', 'cm2', 'unidades'])
const SIS = new Set(['factura', 'fuera', 'sin_criterio'])
const lleno = (s) => typeof s === 'string' && s.trim().length > 0

if (!/^\d{4}-\d{2}-\d{2}$/.test(LEIDA_EL || '')) fallos.push('falta la fecha de lectura (LEIDA_EL)')

for (const [id, d] of Object.entries(DOCUMENTOS)) {
  if (!/^https:\/\/\S+$/.test(d.url || '')) fallos.push(`${id}: la URL no es https`)
  if (d.web && !/^https:\/\/\S+$/.test(d.web.url || '')) fallos.push(`${id}: la URL de su web no es https`)
  if (!lleno(d.edicion)) fallos.push(`${id}: falta la edición`)
  if (!lleno(d.nombre) || !lleno(d.corto)) fallos.push(`${id}: falta el nombre del documento`)
  if (!COMPANIAS.some((c) => c.slug === d.compania)) fallos.push(`${id}: su compañía «${d.compania}» no está en COMPANIAS`)
  if (!d.reglas?.length) fallos.push(`${id}: sin reglas`)
  d.reglas.forEach((_, i) => {
    const r = regla(id, i)
    const q = `${id} regla ${i}`
    if (!(r.zona in ZONAS)) fallos.push(`${q}: zona desconocida «${r.zona}»`)
    if (!Number.isInteger(r.pagina) || r.pagina < 1 || r.pagina > d.paginas) fallos.push(`${q}: página ${r.pagina} fuera del documento (1-${d.paginas})`)
    for (const k of ['dano', 'no_se_cobra', 'cita']) if (!lleno(r[k])) fallos.push(`${q}: «${k}» vacío`)
    if (r.se_cobra !== null && !lleno(r.se_cobra)) fallos.push(`${q}: «se_cobra» vacío`)
    if (!['ambos', 'turismo', 'furgoneta'].includes(r.aplica_a)) fallos.push(`${q}: aplica_a «${r.aplica_a}»`)
    if (r.medida) {
      if (!(Number(r.medida.limite) > 0)) fallos.push(`${q}: límite de la medida no válido`)
      if (!UNIDADES.has(r.medida.unidad)) fallos.push(`${q}: unidad «${r.medida.unidad}» no válida`)
    }
  })
  for (const p of d.precios || []) if (!lleno(p.concepto) || !lleno(p.importe) || !(p.pagina >= 1 && p.pagina <= d.paginas)) fallos.push(`${id}: precio mal formado «${p.concepto}»`)

  const rec = RECORRIDOS[id]
  if (!rec) { fallos.push(`${id}: sin recorrido`); continue }
  const usadas = [...rec.pasos.flatMap((p) => [p.regla, ...p.tambien]), ...rec.aparte]
  usadas.forEach((i, k) => {
    if (!(i >= 0 && i < d.reglas.length)) fallos.push(`${id}: el recorrido apunta a la regla ${i}, que no existe`)
    if (usadas.indexOf(i) !== k) fallos.push(`${id}: la regla ${i} sale dos veces en el recorrido`)
  })
  d.reglas.forEach((_, i) => { if (!usadas.includes(i)) fallos.push(`${id}: la regla ${i} no sale en el recorrido`) })
  for (const p of rec.pasos) {
    if (!SIS.has(p.si)) fallos.push(`${id}: paso de la regla ${p.regla} con «si» desconocido`)
    if (!(p.zona in ZONAS)) fallos.push(`${id}: paso de la regla ${p.regla} con zona desconocida`)
    if (!lleno(p.pregunta) || !p.pregunta.startsWith('¿') || !p.pregunta.endsWith('?')) fallos.push(`${id}: la pregunta del paso ${p.regla} no es una pregunta`)
    if (!lleno(p.hallazgo)) fallos.push(`${id}: el paso ${p.regla} no tiene hallazgo`)
    if (p.si === 'factura' && regla(id, p.regla).se_cobra === null) fallos.push(`${id}: el paso ${p.regla} dice «se factura» pero la guía solo dice lo que acepta`)
  }
}

for (const c of COMPANIAS) {
  if (!/^[a-z0-9-]+$/.test(c.slug)) fallos.push(`compañía «${c.slug}»: el slug no vale para una URL`)
  for (const [v, id] of Object.entries(c.documentos)) {
    if (!DOCUMENTOS[id]) fallos.push(`${c.slug}: documento «${id}» no existe`)
    else if (!pasosDe(id, v).length) fallos.push(`${c.slug}: su documento para ${v} no tiene ningún paso`)
  }
}

/* Las frases que no se dicen nunca (reglas de verdad). En los datos solo las que serían una promesa nuestra (las
   guías pueden decir «sellado» o «firmado» de su libro de mantenimiento); en las pantallas, todas. */
const PROHIBIDAS_DATOS = /te lo cobrar[áa]n|no te lo pueden cobrar|te ahorras|ahorrar[áa]s/i
const PROHIBIDAS_PANTALLA = /te lo cobrar[áa]n|no te lo pueden cobrar|te ahorras|ahorrar[áa]s|certificad|inmutable|aut[ée]ntic|verificad|sin discusi[óo]n|v[áa]lido ante un juez|nadie m[áa]s lo tiene|\bgratis\b/i
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const datos = sinComentarios(readFileSync(MODULO, 'utf8'))
const m = datos.match(PROHIBIDAS_DATOS)
if (m) fallos.push(`guiasRenting.js: frase prohibida «${m[0]}»`)

const pantallas = [join(RAIZ, 'frontend', 'src', 'pages', 'DevolucionRenting.jsx'),
  join(RAIZ, 'frontend', 'functions', 'devolucion-renting.js'), join(RAIZ, 'frontend', 'functions', 'devolucion-renting', '[compania].js')]
const piezas = join(RAIZ, 'frontend', 'src', 'pages', 'devolucion')
if (existsSync(piezas)) for (const n of readdirSync(piezas)) if (/\.jsx?$/.test(n)) pantallas.push(join(piezas, n))
for (const f of pantallas) {
  if (!existsSync(f)) { fallos.push(`no existe ${relative(RAIZ, f)}`); continue }
  const t = sinComentarios(readFileSync(f, 'utf8'))
  const x = t.match(PROHIBIDAS_PANTALLA)
  if (x) fallos.push(`${relative(RAIZ, f).replace(/\\/g, '/')}: frase prohibida «${x[0]}»`)
}

if (huella !== HUELLA) fallos.push(`los datos de las guías han cambiado (huella ${huella}, guardada ${HUELLA}). Si es a propósito, actualiza HUELLA en este fichero y di qué cambió.`)

const nReglas = Object.values(DOCUMENTOS).reduce((s, d) => s + d.reglas.length, 0)
if (fallos.length) {
  console.error(`check-guias-renting: ${fallos.length} fallo(s)\n`)
  for (const f of fallos) console.error('  ' + f)
  process.exit(1)
}
console.log(`check-guias-renting: ${Object.keys(DOCUMENTOS).length} documentos de ${COMPANIAS.length} compañías, ${nReglas} reglas, todo en su sitio (huella ${huella})`)
