/* EL VEHÍCULO VISTO DESDE ARRIBA (/devolucion-renting, 14-11-2026). Turismo y furgoneta, de línea, con un solo grosor,
   como un plano: se ven los asientos (sin techo) para que «interior» y «zona de carga» tengan dónde marcarse. El frente,
   arriba. La zona de la pregunta se rellena con el cian de la marca (la única cosa en cian del paso); lo demás, en
   tinta y papel con las variables --ld-* (día y noche). Cada pieza es una forma con nombre: `ZONAS_DIBUJO` dice cuáles
   se rellenan para cada zona de las guías. viewBox 120 × 240. */

const ESPEJO = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(120 - Number(x)).toFixed(1).replace(/\.0$/, '')} ${y}`)

/* Las piezas de cada vehículo. Las del lado izquierdo se dibujan y se reflejan para el derecho. */
const TURISMO = {
  cuerpo: 'M34 13 Q60 7 86 13 Q98 17 98 34 L98 206 Q98 224 86 228 Q60 233 34 228 Q22 224 22 206 L22 34 Q22 17 34 13 Z',
  paragolpes: ['M23 30 Q23 17 34 13 Q60 7 86 13 Q97 17 97 30 Q60 23 23 30 Z', 'M23 211 Q60 217 97 211 Q97 224 86 228 Q60 233 34 228 Q23 224 23 211 Z'],
  capo: 'M23 30 Q60 23 97 30 L95 72 Q60 64 25 72 Z',
  parabrisas: 'M27 74 Q60 65 93 74 L87 95 Q60 89 33 95 Z',
  habitaculo: 'M33 95 Q60 89 87 95 L87 166 Q60 171 33 166 Z',
  luneta: 'M33 166 Q60 171 87 166 L92 185 Q60 191 28 185 Z',
  maletero: 'M28 185 Q60 191 92 185 L97 211 Q60 217 23 211 Z',
  lateral: 'M22 36 L25 72 L33 95 L33 166 L28 185 L22 206 Z',
  ventanilla: 'M33.5 99 L37 100 L37 161 L33.5 162 Z',
  salpicadero: 'M33 95 Q60 89 87 95 L87 101 Q60 95 33 101 Z',
  asientos: ['M38 104 h18 v20 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 Z', 'M64 104 h18 v20 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 Z', 'M38 138 h44 v18 a3 3 0 0 1 -3 3 h-38 a3 3 0 0 1 -3 -3 Z'],
  volante: 'M41 101 h12',
  retrovisor: 'M22 80 L14 78 Q11 83 13 88 L22 88 Z',
  rueda: ['M14 42 L22 42 L22 68 L14 68 Q12 68 12 66 L12 44 Q12 42 14 42 Z', 'M14 174 L22 174 L22 200 L14 200 Q12 200 12 198 L12 176 Q12 174 14 174 Z'],
  faro: 'M25 25 Q27 18 37 15 L39 21 Q31 23 26.5 28.5 Z',
  piloto: 'M24 211 L36 214 L36 220 Q28 220 25 216 Z',
  carga: null,
  mampara: null,
}

const FURGONETA = {
  cuerpo: 'M30 9 Q60 5 90 9 Q100 11 100 24 L100 224 Q100 231 93 232 L27 232 Q20 231 20 224 L20 24 Q20 11 30 9 Z',
  paragolpes: ['M21 20 Q21 11 30 9 Q60 5 90 9 Q99 11 99 20 Q60 14 21 20 Z', 'M20 224 L100 224 Q100 231 93 232 L27 232 Q20 231 20 224 Z'],
  capo: 'M21 20 Q60 14 99 20 L98 40 Q60 34 22 40 Z',
  parabrisas: 'M23 42 Q60 35 97 42 L92 60 Q60 55 28 60 Z',
  habitaculo: 'M28 60 Q60 55 92 60 L92 88 L28 88 Z',
  luneta: null,
  maletero: null,
  lateral: 'M20 26 L23 42 L28 60 L28 88 L31 92 L31 218 L20 224 Z',
  ventanilla: 'M28.5 62 L32 62.5 L32 86 L28.5 86 Z',
  salpicadero: 'M28 60 Q60 55 92 60 L92 66 Q60 61 28 66 Z',
  asientos: ['M33 68 h19 v17 a3 3 0 0 1 -3 3 h-13 a3 3 0 0 1 -3 -3 Z', 'M68 68 h19 v17 a3 3 0 0 1 -3 3 h-13 a3 3 0 0 1 -3 -3 Z'],
  volante: 'M36 66 h13',
  retrovisor: 'M20 60 L11 58.5 Q8 64 10 69 L20 69 Z',
  rueda: ['M13 30 L20 30 L20 56 L13 56 Q11 56 11 54 L11 32 Q11 30 13 30 Z', 'M13 180 L20 180 L20 206 L13 206 Q11 206 11 204 L11 182 Q11 180 13 180 Z'],
  faro: 'M22.5 18 Q24 11.5 33 10 L34.5 15.5 Q27.5 16.5 24 20.5 Z',
  piloto: 'M21 206 L25 206 L25 220 L21 220 Z',
  carga: 'M24 92 L96 92 L96 218 L24 218 Z',
  mampara: 'M24 90 H96',
}

/* Qué piezas se rellenan para cada zona de las guías. */
export const ZONAS_DIBUJO = {
  carroceria: ['capo', 'lateral', 'maletero'],
  pintura: ['capo', 'lateral', 'maletero'],
  paragolpes: ['paragolpes'],
  faros_y_pilotos: ['faro', 'piloto'],
  lunas: ['parabrisas', 'luneta', 'ventanilla'],
  retrovisores: ['retrovisor'],
  llantas: ['rueda'],
  neumaticos: ['rueda'],
  zona_de_carga: ['carga', 'maletero'],
  interior: ['habitaculo'],
  documentacion_y_llaves: ['salpicadero'],
  limpieza: ['habitaculo', 'carga', 'maletero'],
  mecanica: ['capo'],
  otros: [],
}

/* Las formas de una pieza, con las del lado derecho ya reflejadas. */
function formas(v, pieza) {
  const d = v[pieza]
  if (!d) return []
  const lista = Array.isArray(d) ? d : [d]
  const lados = ['lateral', 'ventanilla', 'retrovisor', 'rueda', 'faro', 'piloto'].includes(pieza)
  return lados ? [...lista, ...lista.map(ESPEJO)] : lista
}

/**
 * @param {'turismo'|'furgoneta'} tipo
 * @param {string} zona  una de ZONAS_DIBUJO (o nada: el vehículo sin marcar)
 * @param {string[]} piezas  las piezas que se marcan, si no son las de su zona (p. ej. sin el capó cuando la regla no vale en él)
 * @param {number} ancho en px (el alto sale solo: 2 × ancho)
 */
export default function Vehiculo({ tipo = 'furgoneta', zona = null, piezas = null, ancho = 112, titulo, className = '' }) {
  const v = tipo === 'turismo' ? TURISMO : FURGONETA
  const marcadas = new Set(piezas || ZONAS_DIBUJO[zona] || [])
  const relleno = (p) => (marcadas.has(p) ? 'var(--dv-marca)' : null)
  const linea = { fill: 'none', stroke: 'var(--ld-text)', strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }
  const fina = { ...linea, strokeWidth: 1, stroke: 'var(--dv-trazo-suave)' }
  const pinta = (pieza, base, estilo = linea, extra = {}) => formas(v, pieza).map((d, i) => (
    <path key={`${pieza}${i}`} d={d} {...estilo} fill={relleno(pieza) || base} {...extra} />
  ))
  return (
    <svg viewBox="0 0 120 240" width={ancho} height={ancho * 2} role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : true}
      aria-label={titulo || undefined} className={`shrink-0 ${className}`} style={{ '--dv-marca': '#14E7D8', '--dv-cristal': 'var(--ld-surface2)', '--dv-trazo-suave': 'var(--ld-muted)' }} data-zona={zona || ''}>
      {/* El cuerpo, en papel. */}
      <path d={v.cuerpo} {...linea} fill={relleno('cuerpo') || 'var(--ld-surface)'} />
      {pinta('capo', 'none')}
      {pinta('maletero', 'none')}
      {pinta('carga', 'none', fina)}
      {pinta('habitaculo', 'none', fina)}
      {pinta('lateral', 'none', { ...linea, stroke: 'none' })}
      {pinta('salpicadero', 'none', { ...linea, stroke: 'none' })}
      {pinta('parabrisas', 'var(--dv-cristal)')}
      {pinta('luneta', 'var(--dv-cristal)')}
      {pinta('ventanilla', 'var(--dv-cristal)', fina)}
      {pinta('asientos', 'none', fina)}
      {pinta('volante', 'none', fina)}
      {pinta('mampara', 'none', linea)}
      {pinta('paragolpes', 'var(--ld-surface)')}
      {pinta('faro', 'var(--ld-surface)')}
      {pinta('piloto', 'var(--ld-surface)')}
      {pinta('rueda', 'var(--ld-text)')}
      {/* El retrovisor, después de la rueda: así nunca queda tapado. */}
      {pinta('retrovisor', 'var(--ld-surface)')}
      {/* La puerta corredera de la furgoneta, en discontinua, y la línea de las puertas traseras. */}
      {tipo === 'furgoneta' && <>
        <path d="M96 104 V150" {...fina} strokeDasharray="3 3" />
        <path d="M60 218 V232" {...linea} />
      </>}
      {/* El contorno, otra vez encima: así ninguna zona rellena tapa la línea. */}
      <path d={v.cuerpo} {...linea} fill="none" />
    </svg>
  )
}
