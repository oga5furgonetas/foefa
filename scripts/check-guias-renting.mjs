#!/usr/bin/env node
/**
 * Las guías de devolución de /devolucion-renting (frontend/src/lib/guiasRenting.js), comprobadas antes de publicar.
 *
 * Un número mal puesto en una de esas guías es un «no se cobra» que sí se cobra, y una conclusión mal sacada es un
 * «su guía dice que se factura» que la guía no dice. Por eso este comprobador mira:
 *  - LOS DATOS: cada documento es IGUAL, regla a regla, precio a precio, a su copia verificada contra el PDF
 *    (scripts/guias-renting/verificado/*.verificado.json, solo las que tienen "leido": true); tiene URL https, edición y
 *    fecha de lectura; cada regla, zona conocida, página dentro del documento, textos no vacíos y, si lleva medida,
 *    límite > 0 y unidad conocida;
 *  - EL RECORRIDO: cada regla sale UNA vez (pregunta, en la misma pregunta, «También mira» o aparte); la cifra de cada
 *    pregunta es la de su regla; un paso «se factura» tiene dónde lo diga el documento (en la regla o en una frase
 *    general de COBRO que alcance a ese tema), y nunca una regla que solo dice lo que acepta o que «no da importe»;
 *  - LA AYUDA PARA MEDIR: las medidas reales de cada objeto, el margen del 10 %, «casi» o «algo más de» según el lado,
 *    y que siempre diga que lo que queda cerca se mide con una regla;
 *  - LAS CUENTAS: qué respuesta cae en cada bloque del resultado y qué cuenta la cifra grande (resumen), las medidas
 *    como en la guía (medidaTexto) y qué reglas valen para cada vehículo (vale); y que el resultado use esas cuentas;
 *  - LAS PALABRAS: ninguna frase prohibida; en los alquileres, ni «guía» ni «perito»; en Europcar, nunca «precio fijo»;
 *    descripciones para buscadores de 155 caracteres como mucho;
 *  - y LA HUELLA de todo lo anterior: quien cambie algo a propósito (otra edición de una guía) la actualiza con
 *    `node scripts/check-guias-renting.mjs --huella`, la pega aquí y dice por qué.
 *
 * Uso: node scripts/check-guias-renting.mjs   (desde la raíz del repo; sale con 1 si algo falla)
 *      GUIAS_MODULO=<ruta> node scripts/check-guias-renting.mjs   (comprueba otra copia del módulo)
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// La huella de los datos y de cómo se enseñan (14-11-2026: las 9 guías leídas ese día, con los arreglos de la revisión).
// Tercera tanda (14-11-2026): Alphabet cobra cada cosa con SU página (lo de fuera, «Facturables» de las págs. 28 a 32
// con la condición de su pág. 6; el habitáculo, la 9; la carga, la 13 o la 16; la limpieza, la 20; las llaves, la 4 y
// la 6); las páginas escritas dentro del texto pasan a `paginaCobro`; frases de Ayvens, Alphabet y BMW reescritas para
// que no se contradigan con su etiqueta; la nota del testigo de BMW, sin repetir la regla. Ninguna cifra cambia.
const HUELLA = 'b71bbe06e6d254b5'

const RAIZ = process.cwd()
const MODULO = process.env.GUIAS_MODULO ? resolve(process.env.GUIAS_MODULO) : join(RAIZ, 'frontend', 'src', 'lib', 'guiasRenting.js')
if (!existsSync(MODULO)) {
  console.error('check-guias-renting: no encuentro frontend/src/lib/guiasRenting.js (lánzalo desde la raíz del repo)')
  process.exit(1)
}
const G = await import(pathToFileURL(MODULO).href)
const { DOCUMENTOS, AJUSTES, RECORRIDOS, COMPANIAS, ZONAS, TEMAS, COBRO, VIGENCIA, AUTOR, PRECIOS_APARTE, OBJETOS, MARGEN_AYUDA, LEIDA_EL } = G
const { regla, pasosDe, cobroDe, medidaTexto, ayudaParaMedir, resumen, vale } = G

const huella = createHash('sha256')
  .update(JSON.stringify({ DOCUMENTOS, AJUSTES, RECORRIDOS, COMPANIAS, TEMAS, COBRO, VIGENCIA, AUTOR, PRECIOS_APARTE, OBJETOS, MARGEN_AYUDA }))
  .digest('hex').slice(0, 16)
if (process.argv.includes('--huella')) { console.log(huella); process.exit(0) }

const fallos = []
const UNIDADES = new Set(['cm', 'mm', 'por_ciento', 'cm2', 'unidades'])
const SIS = new Set(['factura', 'fuera', 'sin_criterio'])
const lleno = (s) => typeof s === 'string' && s.trim().length > 0
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

if (!/^\d{4}-\d{2}-\d{2}$/.test(LEIDA_EL || '')) fallos.push('falta la fecha de lectura (LEIDA_EL)')

/* ── 1. Los datos, iguales a su copia verificada ─────────────────────────────────────────────────────────────── */
const VERIFICADO = join(RAIZ, 'scripts', 'guias-renting', 'verificado')
const FICHERO = {
  'ayvens-furgonetas': 'ayvens-leaseplan-furgonetas', 'ayvens-turismos': 'ayvens-leaseplan-turismos', alphabet: 'alphabet',
  vwfs: 'vwfs', bmw: 'bmw', athlon: 'athlon', arval: 'arval-furgonetas', hertz: 'hertz-alquiler', europcar: 'europcar-alquiler',
}
const CAMPOS = ['zona', 'dano', 'no_se_cobra', 'se_cobra', 'medida', 'maximo', 'condicion', 'aplica_a', 'pagina', 'cita']
for (const id of Object.keys(DOCUMENTOS)) {
  const f = join(VERIFICADO, `${FICHERO[id] || id}.verificado.json`)
  if (!FICHERO[id] || !existsSync(f)) { fallos.push(`${id}: no tiene copia verificada en scripts/guias-renting/verificado/`); continue }
  const j = JSON.parse(readFileSync(f, 'utf8'))
  const d = DOCUMENTOS[id]
  const q = `${id} (frente a ${FICHERO[id]}.verificado.json)`
  if (j.leido !== true) fallos.push(`${q}: la copia verificada no tiene "leido": true`)
  const [url, web] = String(j.url_leida || '').split(' ; ').map((x) => x.trim())
  if (d.url !== url) fallos.push(`${q}: la URL no es la leída`)
  if (web && d.web?.url !== web) fallos.push(`${q}: la URL de su web no es la leída`)
  if (d.nombre !== j.nombre_del_documento) fallos.push(`${q}: el nombre del documento no es el leído`)
  if (d.edicionLeida !== j.edicion) fallos.push(`${q}: la edición no es la leída`)
  if (d.paginas !== j.paginas) fallos.push(`${q}: el número de páginas no es el leído`)
  if (d.aplica_a !== j.aplica_a) fallos.push(`${q}: aplica_a no es el leído`)
  if (d.reglas.length !== j.reglas.length) fallos.push(`${q}: ${d.reglas.length} reglas y la copia tiene ${j.reglas.length}`)
  j.reglas.forEach((rj, i) => {
    for (const c of CAMPOS) if (!igual(d.reglas[i]?.[c], rj[c])) fallos.push(`${q}: regla ${i}, «${c}» distinto de lo verificado`)
  })
  const pj = (j.precios_publicados || []).map((p) => ({ concepto: p.concepto, importe: p.importe, pagina: p.pagina }))
  if (!igual(d.precios, pj)) fallos.push(`${q}: los precios no son los verificados`)
  if (!igual(d.proceso, j.proceso)) fallos.push(`${q}: el proceso no es el verificado`)
}
for (const n of existsSync(VERIFICADO) ? readdirSync(VERIFICADO) : []) {
  if (!Object.values(FICHERO).some((f) => `${f}.verificado.json` === n)) fallos.push(`scripts/guias-renting/verificado/${n}: no lo usa ningún documento`)
}

/* ── 2. La forma de cada documento y su recorrido ───────────────────────────────────────────────────────────── */
const POSITIVO = /factur|cobr|coste|cargo|importe|€/i
const NEGATIVO = /no da (precio|importe)|sin importe|no publica precio|no dice qu[ée] se cobra|no da caso cobrable|no pone caso que se cobre|no dice importe/i
const PALABRAS_AYUDA = { menor: /: casi /, mayor: /: algo más de / }
for (const [id, d] of Object.entries(DOCUMENTOS)) {
  if (!/^https:\/\/\S+$/.test(d.url || '')) fallos.push(`${id}: la URL no es https`)
  if (d.web && !/^https:\/\/\S+$/.test(d.web.url || '')) fallos.push(`${id}: la URL de su web no es https`)
  if (!lleno(d.edicion)) fallos.push(`${id}: falta la edición`)
  if (!lleno(d.nombre) || !lleno(d.corto)) fallos.push(`${id}: falta el nombre del documento`)
  if (!COMPANIAS.some((c) => c.slug === d.compania)) fallos.push(`${id}: su compañía «${d.compania}» no está en COMPANIAS`)
  if (/sin fecha/i.test(d.edicion) && !lleno(VIGENCIA[id])) fallos.push(`${id}: no trae fecha y no tiene su aviso de vigencia (VIGENCIA)`)
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
  for (const [i, a] of Object.entries(AJUSTES[id] || {})) {
    if ('medida' in a || 'pagina' in a || 'maximo' in a) fallos.push(`${id}: el AJUSTE de la regla ${i} cambia una cifra (solo se ajustan textos)`)
    // `paginaCobro` no inventa una página: la nombra el texto verificado de esa regla o una frase de COBRO del documento.
    if ('paginaCobro' in a) {
      const n = a.paginaCobro
      const orig = d.reglas[i] || {}
      const enTexto = new RegExp(`(página|pág\\.|p\\.) ?${n}\\b`).test(`${orig.se_cobra} ${orig.no_se_cobra} ${orig.condicion} ${orig.maximo}`)
      // …y la frase de COBRO tiene que ser la del tema del paso donde sale esa regla (no otra página cualquiera).
      const paso = (RECORRIDOS[id]?.pasos || []).find((p) => [p.regla, ...(p.junto || []), ...p.tambien].includes(Number(i)))
      const enCobro = !!paso && (COBRO[id] || []).some((b) => b.pagina === n && b.temas.includes(paso.tema))
      if (!Number.isInteger(n) || n < 1 || n > d.paginas || n === orig.pagina) fallos.push(`${id}: el AJUSTE de la regla ${i} pone una página de cobro (${n}) que no vale`)
      else if (!enTexto && !enCobro) fallos.push(`${id}: el AJUSTE de la regla ${i} pone la página de cobro ${n}, y ni su texto verificado ni COBRO nombran esa página`)
    }
    for (const k of ['se_cobra', 'no_se_cobra']) if (typeof a[k] === 'string' && /\((página|p\.) ?\d+\)/.test(a[k]) && !/\(su pág\. \d+\)/.test(a[k])) fallos.push(`${id}: el AJUSTE de la regla ${i} deja una página escrita dentro del texto («${k}»): va en paginaCobro`)
  }
  for (const p of d.precios || []) if (!lleno(p.concepto) || !lleno(p.importe) || !(p.pagina >= 1 && p.pagina <= d.paginas)) fallos.push(`${id}: precio mal formado «${p.concepto}»`)

  const rec = RECORRIDOS[id]
  if (!rec) { fallos.push(`${id}: sin recorrido`); continue }
  const usadas = [...rec.pasos.flatMap((p) => [p.regla, ...(p.junto || []), ...p.tambien]), ...rec.aparte]
  usadas.forEach((i, k) => {
    if (!(i >= 0 && i < d.reglas.length)) fallos.push(`${id}: el recorrido apunta a la regla ${i}, que no existe`)
    if (usadas.indexOf(i) !== k) fallos.push(`${id}: la regla ${i} sale dos veces en el recorrido`)
  })
  d.reglas.forEach((_, i) => { if (!usadas.includes(i)) fallos.push(`${id}: la regla ${i} no sale en el recorrido`) })
  for (const b of COBRO[id] || []) {
    if (!POSITIVO.test(b.cita) || !(Number.isInteger(b.pagina) || lleno(b.fuente))) fallos.push(`${id}: una frase de COBRO no habla de cobro o no dice dónde está`)
    if (Number.isInteger(b.pagina) && (b.pagina < 1 || b.pagina > d.paginas)) fallos.push(`${id}: una frase de COBRO está en la página ${b.pagina}, fuera del documento`)
    if (b.apartado != null && (!lleno(b.apartado) || !/^Facturables?$/.test(b.cita))) fallos.push(`${id}: una frase de COBRO con apartado tiene que ser su rótulo «Facturables»`)
    if (b.aplica_a != null && !['turismo', 'furgoneta'].includes(b.aplica_a)) fallos.push(`${id}: una frase de COBRO con aplica_a «${b.aplica_a}»`)
    if ((b.condicion != null && !lleno(b.condicion)) || (b.condicionCorta != null && (!lleno(b.condicionCorta) || !b.condicion))) fallos.push(`${id}: una frase de COBRO con la condición vacía (o con la corta y sin la entera)`)
  }
  for (const p of rec.pasos) {
    const r = regla(id, p.regla)
    const q = `${id}, paso de la regla ${p.regla}`
    if (!SIS.has(p.si)) fallos.push(`${q}: «si» desconocido`)
    if (!(p.zona in ZONAS)) fallos.push(`${q}: zona desconocida`)
    if (!TEMAS.some(([t]) => t === p.tema)) fallos.push(`${q}: tema «${p.tema}» que no está en TEMAS`)
    if (!lleno(p.pregunta) || !p.pregunta.startsWith('¿') || !p.pregunta.endsWith('?')) fallos.push(`${q}: la pregunta no es una pregunta`)
    if (!lleno(p.hallazgo)) fallos.push(`${q}: no tiene hallazgo`)
    // La cifra de la pregunta es la de su regla (y en su unidad).
    if (r.medida && ['cm', 'mm', 'por_ciento'].includes(r.medida.unidad) && !p.pregunta.includes(medidaTexto(r.medida))) {
      fallos.push(`${q}: la pregunta no lleva la cifra de su regla («${medidaTexto(r.medida)}»)`)
    }
    // «Su guía dice que se factura» solo si el documento lo dice para ese caso (y para cada vehículo en que se pregunta).
    if (p.si === 'factura') {
      const vehiculos = COMPANIAS.flatMap((c) => Object.entries(c.documentos).filter(([vh, doc]) => doc === id && vale(r.aplica_a, vh)).map(([vh]) => vh))
      const enLaRegla = r.se_cobra != null && POSITIVO.test(`${r.se_cobra} ${r.cita}`) && !NEGATIVO.test(`${r.se_cobra} ${r.condicion || ''}`)
      if (r.se_cobra === null) fallos.push(`${q}: dice «se factura» pero la guía solo dice lo que acepta`)
      else for (const vh of vehiculos) {
        if (!enLaRegla && !cobroDe(id, p.tema, vh).length) fallos.push(`${q} (${vh}): dice «se factura» y el documento no habla de cobro para ese caso (ni en la regla ni en COBRO)`)
      }
    }
  }
}

/* Alphabet: lo de fuera se factura por lo que pone bajo «Facturables» en sus págs. 28 a 32 (la 9 es la del habitáculo)
   y siempre con la condición de su pág. 6 a la vista, con sus palabras. */
{
  const FUERA = ['paragolpes', 'lunas', 'aranazos', 'rozaduras', 'abolladuras', 'pintura', 'retrovisores', 'llantas', 'neumaticos']
  for (const b of COBRO.alphabet || []) {
    if (!b.temas.some((t) => FUERA.includes(t))) continue
    if (!(b.pagina >= 28 && b.pagina <= 32)) fallos.push(`alphabet: lo de fuera se factura con una frase de su pág. ${b.pagina} (lo de fuera está en las págs. 28 a 32; la 9 es la del habitáculo)`)
    if (!/pág\. 6/.test(b.condicion || '') || !/En caso contrario, los daños exteriores serán facturados al cliente/.test(b.condicion || '')) fallos.push(`alphabet: el cobro de lo de fuera (pág. ${b.pagina}) no lleva a la vista la condición de su pág. 6`)
  }
}

for (const c of COMPANIAS) {
  if (!/^[a-z0-9-]+$/.test(c.slug)) fallos.push(`compañía «${c.slug}»: el slug no vale para una URL`)
  if (!lleno(c.descripcion) || c.descripcion.length > 155) fallos.push(`${c.slug}: la descripción para buscadores falta o pasa de 155 caracteres (${c.descripcion?.length})`)
  for (const [v, id] of Object.entries(c.documentos)) {
    if (!DOCUMENTOS[id]) fallos.push(`${c.slug}: documento «${id}» no existe`)
    else if (!pasosDe(id, v).length) fallos.push(`${c.slug}: su documento para ${v} no tiene ningún paso`)
  }
}

/* ── 3. La ayuda para medir ──────────────────────────────────────────────────────────────────────────────────── */
const REALES = { moneda10: 19.75, moneda1: 23.25, moneda2: 25.75, 'tarjeta-corto': 54, 'tarjeta-largo': 85.6, 'folio-corto': 210, 'folio-largo': 297 }
if (!igual(Object.fromEntries(OBJETOS.map((o) => [o.id, o.mm])), REALES)) fallos.push('OBJETOS: las medidas de las monedas, la tarjeta o el folio no son las reales')
if (MARGEN_AYUDA !== 0.1) fallos.push(`MARGEN_AYUDA es ${MARGEN_AYUDA}: la ayuda solo vale a menos de un 10 % del límite`)
function revisarAyuda(paso, q) {
  const a = ayudaParaMedir(paso)
  if (!a) return null
  const m = paso.r.medida
  const lim = m.unidad === 'cm' ? m.limite * 10 : m.limite
  if (m.sentido !== 'hasta') fallos.push(`${q}: ayuda para medir en una regla que no es un tope («${m.sentido}»)`)
  if (Math.abs(a.objeto.mm - lim) / lim > 0.1) fallos.push(`${q}: la ayuda usa un objeto a más de un 10 % del límite`)
  const lado = a.objeto.mm < lim ? 'menor' : 'mayor'
  if (!PALABRAS_AYUDA[lado].test(a.texto)) fallos.push(`${q}: la ayuda no dice «${lado === 'menor' ? 'casi' : 'algo más de'}» (el objeto mide ${a.objeto.mm} mm y el límite ${lim} mm)`)
  if (!a.texto.includes(`${String(a.objeto.mm).replace('.', ',')} mm`) || !a.texto.includes(medidaTexto(m))) fallos.push(`${q}: la ayuda no dice la medida real o el límite`)
  if (!/mídelo con una regla/.test(a.texto)) fallos.push(`${q}: la ayuda no dice que lo que queda cerca se mide con una regla`)
  if (lado === 'mayor' && !/se queda un poco corto/.test(a.texto)) fallos.push(`${q}: con un objeto mayor que el límite, la ayuda no avisa de que algo un poco más corto también puede pasar`)
  return a
}
for (const c of COMPANIAS) for (const [v, id] of Object.entries(c.documentos)) pasosDe(id, v).forEach((p) => revisarAyuda(p, `${id} (${v}) paso de la regla ${p.regla}`))
{
  const caso = (limite, unidad, sentido = 'hasta', sujeto = 'el arañazo') => ({ sujeto, r: { medida: { que: 'largo', limite, unidad, sentido } } })
  const cinco = revisarAyuda(caso(5, 'cm'), 'ayuda de prueba (5 cm)')
  if (cinco?.objeto.id !== 'tarjeta-corto' || !/algo más de 5 cm/.test(cinco.texto)) fallos.push('ayuda de prueba: 5 cm debería medirse con el lado corto de la tarjeta («algo más de 5 cm»)')
  const dos = revisarAyuda(caso(2, 'cm'), 'ayuda de prueba (2 cm)')
  if (dos?.objeto.id !== 'moneda10' || !/casi 2 cm/.test(dos.texto)) fallos.push('ayuda de prueba: 2 cm debería medirse con la moneda de 10 céntimos («casi 2 cm»)')
  if (ayudaParaMedir(caso(10, 'mm', 'menos_de'))) fallos.push('ayuda de prueba: una regla «menos de» no lleva ayuda para medir')
  if (ayudaParaMedir(caso(10, 'cm'))) fallos.push('ayuda de prueba: 10 cm no queda cerca de ningún objeto y no debería llevar ayuda')
  if (ayudaParaMedir({ r: caso(2, 'cm').r })) fallos.push('ayuda de prueba: sin `sujeto` no hay ayuda')
}

/* ── 4. Las cuentas ──────────────────────────────────────────────────────────────────────────────────────────── */
{
  const pasos = ['factura', 'fuera', 'sin_criterio', 'factura', 'fuera', 'sin_criterio'].map((si) => ({ si }))
  const r = resumen(pasos, ['si', 'si', 'si', 'no', 'nose', 'no'])
  const n = (k) => r[k].length
  if (n('factura') !== 1 || n('fuera') !== 1 || n('sinCriterio') !== 1 || n('no') !== 2 || n('noSe') !== 1) fallos.push('resumen: las respuestas no caen en su bloque')
  if (r.cifra !== 2) fallos.push(`resumen: la cifra grande debe contar «se factura» y «no lo acepta» (2) y da ${r.cifra}`)
  if (resumen(pasos, pasos.map(() => 'no')).cifra !== 0) fallos.push('resumen: con todo «No» la cifra no es 0')
  for (const c of COMPANIAS) for (const [v, id] of Object.entries(c.documentos)) {
    const ps = pasosDe(id, v)
    const todo = resumen(ps, ps.map(() => 'si'))
    if (todo.cifra !== ps.filter((p) => p.si !== 'sin_criterio').length) fallos.push(`resumen ${id} (${v}): con todo «Sí» la cifra no cuenta lo que se factura y lo que no acepta`)
  }
}
if (medidaTexto({ limite: 1.6, unidad: 'mm' }) !== '1,6 mm' || medidaTexto({ limite: 0.5, unidad: 'cm' }) !== '0,5 cm' || medidaTexto({ limite: 25, unidad: 'por_ciento' }) !== '25 %') {
  fallos.push('medidaTexto: las medidas no se enseñan como en la guía («1,6 mm», «0,5 cm», «25 %»)')
}
if (vale('turismo', 'furgoneta') || vale('furgoneta', 'turismo') || !vale('ambos', 'turismo') || !vale('furgoneta', 'furgoneta')) fallos.push('vale: una regla de un vehículo vale para el otro')
for (const c of COMPANIAS) for (const [v, id] of Object.entries(c.documentos)) {
  for (const p of pasosDe(id, v)) for (const r of [p.r, ...p.con, ...p.mas]) if (!vale(r.aplica_a, v)) fallos.push(`${id} (${v}): sale una regla de otro vehículo`)
}

/* Las frases del resultado, leídas en voz alta: ninguna se contradice con su etiqueta. Bajo «no lo acepta», nunca «no
   lo dice expresamente» ni «solo dice lo que acepta»; «no acepta:» nunca pegado a una frase que dice lo que pasa; nunca
   «acepta: nada»; y el titular con 0 no dice «se facturan» de un documento que no dice cobrar nada. */
for (const f of ['noAceptaDe', 'titularDe', 'paginaCobroDe', 'sinTolerancia']) if (typeof G[f] !== 'function') fallos.push(`guiasRenting.js no tiene ${f}(): el resultado no puede decir bien lo que no acepta`)
if (typeof G.noAceptaDe === 'function' && typeof G.titularDe === 'function') for (const c of COMPANIAS) for (const [vh, id] of Object.entries(c.documentos)) {
  const v = G.vozDe(id)
  const ps = pasosDe(id, vh)
  for (const p of ps.filter((x) => x.si === 'fuera')) {
    for (const r of [p.r, ...p.con]) {
      const x = G.noAceptaDe(r, v)
      if (/no lo dice expresamente|solo dice lo que acepta|no dice qu[ée] se cobra/i.test(x.texto)) fallos.push(`${id} (${vh}), regla ${r.indice}: bajo «no lo acepta» sale «${x.texto.slice(0, 60)}…»`)
    }
  }
  const t0 = G.titularDe(ps, resumen(ps, ps.map(() => 'no')), v)
  if (/se facturan?$/.test(t0) && !ps.some((p) => p.si === 'factura')) fallos.push(`${id} (${vh}): con todo «No», el titular dice «${t0}» y el documento no dice cobrar nada`)
}
for (const id of Object.keys(DOCUMENTOS)) {
  const v = G.vozDe(id)
  DOCUMENTOS[id].reglas.forEach((_, i) => {
    const r = regla(id, i)
    const no = G.enLinea(G.cobraDe(r, v))
    const si = G.enLinea(G.aceptaDe(r, v))
    if (/no aceptan?: (si [^;]*?, (la entrega|se podría|el vehículo no se puede|alphabet factura|pueden dar lugar)|con |hay que |no da importe|el exceso|los elementos perdidos)/i.test(no)) fallos.push(`${id} regla ${i}: «${no.slice(0, 60)}…» se contradice con su etiqueta`)
    if (/aceptan?: (nada|ninguno|no lo dice)/i.test(si)) fallos.push(`${id} regla ${i}: «${si.slice(0, 60)}…» se contradice con su etiqueta`)
  })
}

/* ── 5. Las palabras ─────────────────────────────────────────────────────────────────────────────────────────── */
const PROHIBIDAS_DATOS = /te lo cobrar[áa]n|no te lo pueden cobrar|te ahorras|ahorrar[áa]s/i
const PROHIBIDAS_PANTALLA = /te lo cobrar[áa]n|no te lo pueden cobrar|te ahorras|ahorrar[áa]s|certificad|inmutable|aut[ée]ntic|verificad|sin discusi[óo]n|v[áa]lido ante un juez|nadie m[áa]s lo tiene|\bgratis\b|precio fijo|Cada compañía de renting publica/i
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const datos = sinComentarios(readFileSync(MODULO, 'utf8'))
const m = datos.match(PROHIBIDAS_DATOS)
if (m) fallos.push(`guiasRenting.js: frase prohibida «${m[0]}»`)
for (const c of COMPANIAS.filter((x) => x.tipo === 'alquiler')) {
  for (const { id } of G.documentosDe(c)) {
    DOCUMENTOS[id].reglas.forEach((_, i) => {
      const r = regla(id, i)
      for (const k of ['no_se_cobra', 'se_cobra', 'condicion']) {
        if (/\b(la|su|sus) gu[íi]a\b|perito/i.test(r[k] || '')) fallos.push(`${id} regla ${i}: «${k}» habla de guía o de perito, y es un alquiler`)
        if (/precio fijo/i.test(r[k] || '')) fallos.push(`${id} regla ${i}: «${k}» dice «precio fijo»`)
      }
    })
    for (const t of [c.aviso, ...Object.values(DOCUMENTOS[id].proceso).flat()]) if (/\b(la|su|sus) gu[íi]a\b|perito/i.test(t || '')) fallos.push(`${c.slug}: su aviso o su proceso hablan de guía o de perito, y es un alquiler`)
  }
}

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
const resultado = join(piezas, 'Resultado.jsx')
if (existsSync(resultado) && !/\bresumen\(/.test(readFileSync(resultado, 'utf8'))) fallos.push('Resultado.jsx no usa resumen() de guiasRenting.js: la cifra grande se cuenta allí y en ningún otro sitio')

/* Las descripciones de las funciones de Pages (lo que lee Google). */
try {
  const fn = await import(pathToFileURL(join(RAIZ, 'frontend', 'functions', 'devolucion-renting.js')).href)
  if (!lleno(fn.DESCRIPCION) || fn.DESCRIPCION.length > 155) fallos.push(`functions/devolucion-renting.js: la descripción pasa de 155 caracteres (${fn.DESCRIPCION?.length})`)
} catch (e) { fallos.push(`functions/devolucion-renting.js no carga fuera del navegador: ${e.message}`) }

if (huella !== HUELLA) fallos.push(`los datos de las guías o cómo se enseñan han cambiado (huella ${huella}, guardada ${HUELLA}). Si es a propósito, actualiza HUELLA en este fichero y di qué cambió.`)

const nReglas = Object.values(DOCUMENTOS).reduce((s, d) => s + d.reglas.length, 0)
if (fallos.length) {
  console.error(`check-guias-renting: ${fallos.length} fallo(s)\n`)
  for (const f of fallos) console.error('  ' + f)
  process.exit(1)
}
console.log(`check-guias-renting: ${Object.keys(DOCUMENTOS).length} documentos de ${COMPANIAS.length} compañías, ${nReglas} reglas iguales a su copia verificada, recorridos, ayuda para medir y cuentas en su sitio (huella ${huella})`)
