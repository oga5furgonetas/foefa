import { useEffect, useRef, useState } from 'react'
import { diaLocal, isoDia, comoLista } from './formato'

/* «CADA DÍA, DESDE LA PRIMERA REVISIÓN» (14-11-2026): un cuadradito por día, en columnas de semana (de lunes a
   domingo), para que meses de revisiones se lean de un vistazo en vez de en una lista de cien filas. Los fines de
   semana se ven solos como dos filas claras. El estado de cada día lo da el servidor (`calendario`); un día del
   periodo que no venga se pinta como «sin fotos», que es lo único que se puede decir de él.
   Con muchas semanas, el calendario se parte en FILAS que caben en el ancho de la hoja (medido; si aún no se ha
   medido, el de un A4), repartidas a partes iguales, y CADA fila lleva sus letras de los días y el mes de su primera
   semana: una segunda fila sin referencias no se lee. */

const ESTADOS = new Set(['revisada', 'sin_revisar', 'golpe'])
const MAX_DIAS = 3700   // diez años: un periodo más largo es un dato roto, no una furgoneta
const LADO = { grande: 16, medio: 12, chico: 9 }   // el cuadradito; entre semanas, 2 px (expediente.css)
const HUECO = 2
const LETRAS = 12 + 6   // la columna de las letras y su separación
const ANCHO_A4 = 680    // lo que mide por dentro la hoja A4 con 14 mm de margen (≈ 688 px), con holgura

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

/* Las semanas en filas de como mucho `porFila`, todas del mismo largo salvo la última (nada de una última fila con
   dos semanas sueltas). */
function enFilas(semanas, porFila) {
  const n = semanas.length
  const filas = Math.max(1, Math.ceil(n / Math.max(1, porFila)))
  const cada = Math.ceil(n / filas)
  const out = []
  for (let i = 0; i < n; i += cada) out.push(semanas.slice(i, i + cada))
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
   con el año no cabe, va sin él (y el año pasa al siguiente); el de la primera semana, si ni así cabe, no se pone. */
function rotulos(fila, col, texto) {
  const out = fila.map((s) => (s.empiezaMes ? { fecha: s.empiezaMes } : null))
  if (!out[0] && fila[0]?.primero) out[0] = { fecha: fila[0].primero, opcional: true }
  let anioVisto = null
  for (let i = 0; i < out.length; i += 1) {
    const r = out[i]
    if (!r) continue
    const j = out.findIndex((x, k) => k > i && x)
    const sitio = j === -1 ? Infinity : (j - i) * col - 4
    const anio = r.fecha.getFullYear()
    const conAnio = texto(r.fecha, true)
    const solo = texto(r.fecha, false)
    if (anio !== anioVisto && anchoDe(conAnio) <= sitio) { r.texto = conAnio; anioVisto = anio }
    else if (anchoDe(solo) <= sitio || !r.opcional) r.texto = solo
    else out[i] = null
  }
  return out
}

export default function CalendarioDias({ desde, hasta, calendario, locale, textos }) {
  const caja = useRef(null)
  const [ancho, setAncho] = useState(null)
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
  const tam = semanas.length <= 30 ? 'grande' : semanas.length <= 44 ? 'medio' : 'chico'
  const col = LADO[tam] + HUECO
  // El ancho de la hoja en pantalla y en el A4 es casi el mismo; nunca se pasa del A4, para que la hoja impresa no corte.
  const util = Math.min(ancho || ANCHO_A4, ANCHO_A4) - LETRAS
  const filas = enFilas(semanas, Math.floor((util + HUECO) / col))
  const etiqueta = { revisada: textos.revisada, sin_revisar: textos.sin, golpe: textos.golpe }
  return (
    <div className={`exp-cal exp-cal-${tam}`} data-testid="calendario" ref={caja}>
      {filas.map((fila, f) => {
        const mes = rotulos(fila, col, fmtMes)
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
  )
}
