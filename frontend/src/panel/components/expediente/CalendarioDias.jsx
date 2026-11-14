import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { diaLocal, isoDia, comoLista } from './formato'

/* «CADA DÍA, DESDE LA PRIMERA REVISIÓN» (14-11-2026): un cuadradito por día, en columnas de semana (de lunes a
   domingo), para que meses de revisiones se lean de un vistazo en vez de en una lista de cien filas. Los fines de
   semana se ven solos como dos filas claras. El estado de cada día lo da el servidor (`calendario`); un día del
   periodo que no venga se pinta como «sin fotos», que es lo único que se puede decir de él.
   EL TAMAÑO (tanda de diseño, 14-11): el lado de cada día sale del ancho útil y del número de semanas, para que el
   calendario ocupe la hoja: con un mes, casillas grandes (con un tope de 22 px); con un año, pequeñas pero a todo el
   ancho. Solo cuando ni con el lado mínimo (7 px) caben todas las semanas en una fila, se parte en FILAS iguales, y
   CADA fila lleva sus letras de los días y el mes de su primera semana: una segunda fila sin referencias no se lee.
   El ancho es el medido en pantalla, nunca más que el de un A4, y al imprimir el del A4: la hoja impresa sale igual
   desde el ordenador que desde el móvil.
   La leyenda dice cuántos días hay de cada estado; si el calendario es corto (le sobra sitio a la derecha), va a su
   lado y no debajo, para que no quede una mancha en la esquina con media hoja vacía. */

const ESTADOS = new Set(['revisada', 'sin_revisar', 'golpe'])
const MAX_DIAS = 3700   // diez años: un periodo más largo es un dato roto, no una furgoneta
const LADO_MAX = 22     // el cuadradito más grande (un periodo corto)
const LADO_MIN = 7      // el más chico antes de partir en filas
const LETRAS = 12 + 6   // la columna de las letras y su separación (expediente.css, .exp-cal-letras y .exp-cal-fila)
const ANCHO_A4 = 680    // lo que mide por dentro la hoja A4 con 14 mm de margen (≈ 688 px), con holgura
const LEYENDA = 200     // lo que necesita la leyenda en columna para ir al lado del calendario, con su aire

function semanasDel(desde, hasta, calendario) {
  const a = diaLocal(desde)
  const b = diaLocal(hasta)
  if (!a || !b || b < a) return []
  const estado = new Map()
  for (const d of comoLista(calendario)) {
    if (d && typeof d.fecha === 'string' && ESTADOS.has(d.estado)) estado.set(d.fecha, d.estado)
  }
  // Al lunes de la semana de `desde`.
  const inicio = new Date(a)
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7))
  const semanas = []
  let d = new Date(inicio)
  let n = 0
  while (d <= b && n < MAX_DIAS) {
    const semana = { dias: [], primero: null, empiezaMes: null }
    for (let k = 0; k < 7; k += 1) {
      const iso = isoDia(d)
      const dentro = d >= a && d <= b
      semana.dias.push(dentro ? { fecha: iso, estado: estado.get(iso) || 'sin_revisar' } : null)
      if (dentro && !semana.primero) semana.primero = new Date(d)
      if (dentro && d.getDate() === 1) semana.empiezaMes = new Date(d)
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      n += 1
    }
    semanas.push(semana)
  }
  return semanas
}

/* El lado y el hueco de una fila de `porFila` semanas en `util` px: el mayor lado entero que cabe, con el tope. Con
   cuadraditos chicos (menos de 10 px), el hueco baja a 1 px para que el día siga pesando más que el blanco. */
function medida(util, porFila) {
  const lado = (h) => Math.min(LADO_MAX, Math.floor((util + h) / porFila) - h)
  return lado(2) >= 10 ? { lado: lado(2), hueco: 2 } : { lado: lado(1), hueco: 1 }
}

/* Cuántas semanas por fila y de qué lado: una sola fila mientras el lado no baje del mínimo; si baja, dos filas
   iguales, tres… (nada de una última fila con dos semanas sueltas). Con varias filas, el lado baja hasta que todas
   juntas no midan más que una fila de casillas del tope: dos o tres años ocupan lo mismo que medio año y el primer golpe
   sigue cabiendo en la hoja 1 al imprimir (las columnas reparten igual el ancho entero). */
const ALTO_FILA = 14        // el rótulo del mes encima de cada fila
const ENTRE_FILAS = 10      // expediente.css, .exp-cal (gap)
const ALTO_MAX = ALTO_FILA + 7 * (LADO_MAX + 2)
function reparto(semanas, util) {
  for (let filas = 1; filas <= semanas; filas += 1) {
    const porFila = Math.ceil(semanas / filas)
    const m = medida(util, porFila)
    if (m.lado >= LADO_MIN || porFila === 1) {
      if (filas === 1) return { ...m, porFila }
      const porAltura = Math.floor(((ALTO_MAX + ENTRE_FILAS) / filas - ENTRE_FILAS - ALTO_FILA) / 7) - 1
      return { lado: Math.min(m.lado, Math.max(porAltura, LADO_MIN)), hueco: 1, porFila }
    }
  }
  return { ...medida(util, 1), porFila: 1 }
}

function enFilas(semanas, porFila) {
  const out = []
  for (let i = 0; i < semanas.length; i += porFila) out.push(semanas.slice(i, i + porFila))
  return out
}

/* Lo que mide un rótulo a la letra del calendario (10 px); sin lienzo, una cuenta por letras. */
let lienzo = null
function anchoDe(texto) {
  try {
    if (!lienzo) lienzo = document.createElement('canvas').getContext('2d')
    lienzo.font = "10px 'Archivo Variable', Archivo, system-ui, sans-serif"
    return Math.ceil(lienzo.measureText(texto).width)
  } catch { return texto.length * 6 }
}

/* El mes encima de cada semana de una fila: donde empieza un mes y, en la primera semana de la fila, el mes en curso.
   El año, en el primer rótulo de la fila y cuando cambia. Cada rótulo cabe antes del siguiente (con 4 px de aire): si
   con el año no cabe, va sin él (y el año pasa al siguiente); el de la primera semana, si ni así cabe, no se pone. El
   último de la fila cabe antes del borde (`util`): si ni sin el año cabe, tampoco se pone (no saca la fila de la hoja). */
function rotulos(fila, col, texto, util) {
  const out = fila.map((s) => (s.empiezaMes ? { fecha: s.empiezaMes } : null))
  if (!out[0] && fila[0]?.primero) out[0] = { fecha: fila[0].primero, opcional: true }
  let anioVisto = null
  for (let i = 0; i < out.length; i += 1) {
    const r = out[i]
    if (!r) continue
    const j = out.findIndex((x, k) => k > i && x)
    const ultimo = j === -1
    const sitio = ultimo ? util - i * col : (j - i) * col - 4
    const anio = r.fecha.getFullYear()
    const conAnio = texto(r.fecha, true)
    const solo = texto(r.fecha, false)
    // La fila sin año todavía y sin sitio para él antes del siguiente rótulo: el siguiente se quita y el año va aquí
    // (una fila sin año no se lee; con meses de cuatro semanas en el móvil, «abr 2026» no cabe en una).
    const k = ultimo ? -1 : out.findIndex((x, q) => q > j && x)
    const sitio2 = k === -1 ? util - i * col : (k - i) * col - 4
    // El sitio del siguiente rótulo, por si el año puede ir en él (E3, tanda 5: así no se quita ningún mes).
    const sitioSig = ultimo ? 0 : k === -1 ? util - j * col : (k - j) * col - 4
    if (anio !== anioVisto && anchoDe(conAnio) <= sitio) { r.texto = conAnio; anioVisto = anio }
    /* El primer rótulo de la fila sin sitio para su año, pero con sitio sin él, y el siguiente con sitio para el suyo:
       este va sin año y el año va en el siguiente. Antes se quitaba el siguiente mes («nov 2025 · ene 2026»: faltaba
       diciembre); ahora se leen todos («nov · dic 2025 · ene 2026»). */
    else if (anioVisto === null && !ultimo && anchoDe(solo) <= sitio && anchoDe(texto(out[j].fecha, true)) <= sitioSig) {
      r.texto = solo
    }
    else if (anioVisto === null && !ultimo && anchoDe(conAnio) > sitio && anchoDe(conAnio) <= sitio2) {
      r.texto = conAnio; anioVisto = anio; out[j] = null
    }
    // Enero sin sitio para «ene 2025» (el calendario más chico): el año solo, que es lo que hace falta para leer la fila.
    else if (anio !== anioVisto && r.fecha.getMonth() === 0 && anchoDe(String(anio)) <= sitio) { r.texto = String(anio); anioVisto = anio }
    else if (anchoDe(solo) <= sitio || (!r.opcional && !ultimo)) r.texto = solo
    else out[i] = null
  }
  return out
}

/* Si la página se está imprimiendo: entonces manda el ancho del A4, no el de la pantalla. `beforeprint` llega antes de
   maquetar la hoja impresa (por eso el cambio va con flushSync); la consulta de medios cubre a quien imprime sin ese
   aviso (el PDF que saca un navegador sin ventana). */
function useImprimiendo() {
  const [imprimiendo, setImprimiendo] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const poner = (v) => { try { flushSync(() => setImprimiendo(v)) } catch { setImprimiendo(v) } }
    const antes = () => poner(true)
    const despues = () => poner(false)
    let mq = null
    try { mq = window.matchMedia('print') } catch { /* sin matchMedia */ }
    const cambio = (e) => setImprimiendo(e.matches)
    window.addEventListener('beforeprint', antes)
    window.addEventListener('afterprint', despues)
    mq?.addEventListener?.('change', cambio)
    return () => {
      window.removeEventListener('beforeprint', antes)
      window.removeEventListener('afterprint', despues)
      mq?.removeEventListener?.('change', cambio)
    }
  }, [])
  return imprimiendo
}

export default function CalendarioDias({ desde, hasta, calendario, locale, textos, cuantosDias }) {
  const caja = useRef(null)
  const [ancho, setAncho] = useState(null)
  const imprimiendo = useImprimiendo()
  const semanas = semanasDel(desde, hasta, calendario)
  const hay = semanas.length > 0
  useEffect(() => {
    const el = caja.current
    if (!hay || !el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hay])

  if (!hay) return null
  const fmtMes = (d, conAnio) => {
    try { return new Intl.DateTimeFormat(locale, conAnio ? { month: 'short', year: 'numeric' } : { month: 'short' }).format(d).replace(/\./g, '') } catch { return '' }
  }
  const fmtDia = (iso) => {
    try { return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(diaLocal(iso)) } catch { return iso }
  }
  // Las letras de lunes, miércoles y viernes a la izquierda, en el idioma del panel (2026-11-09 fue lunes).
  const letra = (k) => {
    try { return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 10, 9 + k)) } catch { return '' }
  }
  // El ancho del bloque: el medido (nunca más que el A4); al imprimir, el del A4.
  const total = imprimiendo ? ANCHO_A4 : Math.min(ancho || ANCHO_A4, ANCHO_A4)
  const util = total - LETRAS
  const { lado, hueco, porFila } = reparto(semanas.length, util)
  const col = lado + hueco
  const filas = enFilas(semanas, porFila)
  const anchoCal = LETRAS + Math.min(porFila, semanas.length) * col - hueco
  const alLado = filas.length === 1 && total - anchoCal >= LEYENDA
  /* Lo que mide de verdad cada columna de semana. Sin llegar al tope, las columnas reparten el ancho entero (el resto
     del redondeo va a los huecos y la fila llega al borde); con el tope, cada una mide lo suyo y nada más (unas pocas
     semanas repartidas por toda la hoja se leerían sueltas). */
  const tope = lado >= LADO_MAX
  const colReal = tope ? col : util / porFila
  const etiqueta = { revisada: textos.revisada, sin_revisar: textos.sin, golpe: textos.golpe }
  const cuenta = { revisada: 0, sin_revisar: 0, golpe: 0 }
  for (const s of semanas) for (const d of s.dias) if (d) cuenta[d.estado] += 1
  const estilo = {
    '--n': porFila, '--col': tope ? `${col}px` : 'minmax(0, 1fr)',
    '--c': `${lado}px`, '--h': `${hueco}px`, '--r': `${lado >= 16 ? 3 : lado >= 10 ? 2 : 1}px`,
  }
  return (
    <div className={`exp-cal-bloque${alLado ? ' exp-cal-bloque-lado' : ''}`} ref={caja}>
      <div className={`exp-cal${lado < 10 ? ' exp-cal-chico' : ''}`} data-testid="calendario" data-lado={lado}
        style={estilo}>
        {filas.map((fila, f) => {
          const mes = rotulos(fila, colReal, fmtMes, util)
          return (
            <div className="exp-cal-fila" key={f} data-testid="calendario-fila">
              <div className="exp-cal-letras" aria-hidden="true">
                <span />
                {[0, 1, 2, 3, 4, 5, 6].map((k) => <span key={k}>{k % 2 === 0 && k < 6 ? letra(k) : ''}</span>)}
              </div>
              <div className="exp-cal-semanas" role="list">
                {fila.map((s, i) => (
                  <div className="exp-cal-sem" key={i} role="listitem">
                    <span className="exp-cal-mes">{mes[i]?.texto || ''}</span>
                    {s.dias.map((d, k) => d
                      ? <i key={k} className={`exp-dia exp-dia-${d.estado}`} data-fecha={d.fecha} data-estado={d.estado}
                          title={`${fmtDia(d.fecha)} · ${etiqueta[d.estado]}`} />
                      : <i key={k} className="exp-dia exp-dia-fuera" />)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <ul className="exp-leyenda" data-testid="leyenda">
        {['revisada', 'sin_revisar', 'golpe'].map((e) => (
          <li key={e} className={`exp-ley-${e}`}>
            <span className="exp-ley-t">{etiqueta[e]}</span>
            {cuantosDias && <span className="exp-ley-n" data-testid={`dias-${e}`}>{cuantosDias(cuenta[e])}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
