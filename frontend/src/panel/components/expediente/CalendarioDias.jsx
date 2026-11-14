import { diaLocal, isoDia, comoLista } from './formato'

/* «CADA DÍA, DESDE LA PRIMERA REVISIÓN» (14-11-2026): un cuadradito por día, en columnas de semana (de lunes a
   domingo), para que meses de revisiones se lean de un vistazo en vez de en una lista de cien filas. Los fines de
   semana se ven solos como dos filas claras. El estado de cada día lo da el servidor (`calendario`); un día del
   periodo que no venga se pinta como «sin fotos», que es lo único que se puede decir de él. Con muchas semanas, las
   columnas pasan a la línea siguiente (flex-wrap) en vez de salirse de la hoja. */

const ESTADOS = new Set(['revisada', 'sin_revisar', 'golpe'])
const MAX_DIAS = 3700   // diez años: un periodo más largo es un dato roto, no una furgoneta

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
    const semana = { dias: [], mes: null }
    for (let k = 0; k < 7; k += 1) {
      const iso = isoDia(d)
      const dentro = d >= a && d <= b
      semana.dias.push(dentro ? { fecha: iso, estado: estado.get(iso) || 'sin_revisar' } : null)
      // El mes encima de la semana donde empieza; la primera semana solo si no hay un día 1 justo detrás (se pisarían).
      if (dentro && !semana.mes && (d.getDate() === 1 || (semanas.length === 0 && a.getDate() <= 14))) semana.mes = new Date(d)
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      n += 1
    }
    semanas.push(semana)
  }
  return semanas
}

export default function CalendarioDias({ desde, hasta, calendario, locale, textos }) {
  const semanas = semanasDel(desde, hasta, calendario)
  if (!semanas.length) return null
  const fmtMes = (d, conAnio) => {
    try { return new Intl.DateTimeFormat(locale, conAnio ? { month: 'short', year: 'numeric' } : { month: 'short' }).format(d) } catch { return '' }
  }
  const fmtDia = (iso) => {
    try { return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(diaLocal(iso)) } catch { return iso }
  }
  // Las letras de lunes, miércoles y viernes a la izquierda, en el idioma del panel (2026-11-09 fue lunes).
  const letra = (k) => {
    try { return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 10, 9 + k)) } catch { return '' }
  }
  const tam = semanas.length <= 30 ? 'grande' : semanas.length <= 44 ? 'medio' : 'chico'
  let anioVisto = null
  const etiqueta = { revisada: textos.revisada, sin_revisar: textos.sin, golpe: textos.golpe }
  return (
    <div className={`exp-cal exp-cal-${tam}`} data-testid="calendario">
      <div className="exp-cal-letras" aria-hidden="true">
        <span />
        {[0, 1, 2, 3, 4, 5, 6].map((k) => <span key={k}>{k % 2 === 0 && k < 6 ? letra(k) : ''}</span>)}
      </div>
      <div className="exp-cal-semanas" role="list">
        {semanas.map((s, i) => {
          let mes = ''
          if (s.mes) {
            // El año, en la primera etiqueta y cuando cambia (enero); en las demás, solo el mes.
            const anio = s.mes.getFullYear()
            mes = fmtMes(s.mes, anio !== anioVisto).replace(/\./g, '')
            anioVisto = anio
          }
          return (
            <div className="exp-cal-sem" key={i} role="listitem">
              <span className="exp-cal-mes">{mes}</span>
              {s.dias.map((d, k) => d
                ? <i key={k} className={`exp-dia exp-dia-${d.estado}`} data-fecha={d.fecha} data-estado={d.estado}
                    title={`${fmtDia(d.fecha)} · ${etiqueta[d.estado]}`} />
                : <i key={k} className="exp-dia exp-dia-fuera" />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
