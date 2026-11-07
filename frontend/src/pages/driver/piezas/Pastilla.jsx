/* diseño compacto */
/* La pastilla sobre el mapa (06-11-2026, §4): 32 visible y 48 de toque, redonda, letra «etiqueta» en UNA línea con «…»,
   sombra (flota) y los tonos de §3.6, opacos para que se lean sobre el mapa. Con `onClick` es un botón, con `href` un
   enlace («Google Maps ↗») y si no, solo texto («{km} · {t}»). `lineas` (opcional, W6, 07-11-2026, como el `maxLineas` de la
   nativa): con más de una línea (2 o 3) va con radio 16 y relleno de 8 arriba y abajo, porque la redonda recortaría las
   esquinas del texto; las de «Situar» («Sin conexión: …») no caben en una. */
import icono from './icono'

const LINEAS = { 2: 'line-clamp-2', 3: 'line-clamp-3' }

const TONOS = {
  neutro: 'bg-dark-900 text-dark-50',
  marca: 'bg-ruta-marca-tinte text-ruta-marca-tinte-texto',
  ok: 'bg-ruta-ok text-white',
  peligro: 'bg-ruta-peligro text-white',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
  // Solo para las capas del mapa (C/D, ZBE; «zona» de §3.6; W5, 07-11-2026): los morados de papel, opacos sobre el
  // mapa, que es claro con cualquier tema. Un tono más; lo que ya había no cambia.
  zona: 'bg-violet-100 text-violet-700',
}

export default function Pastilla({ texto, tono = 'neutro', icono: Icono, onClick, href, nombre, lineas = 1, className = '', testid, children, ...resto }) {
  const varias = lineas > 1
  const forma = varias ? 'min-h-8 rounded-2xl py-2' : 'h-8 rounded-full'
  const clases = `inline-flex max-w-full items-center gap-1 px-3 text-etiqueta shadow-md ${forma} ${TONOS[tono] || TONOS.neutro} ${className}`
  const dentro = (
    <>
      {icono(Icono, 16, 'shrink-0')}
      <span className={varias ? `min-w-0 text-left ${LINEAS[Math.min(lineas, 3)]}` : 'truncate'}>{texto ?? children}</span>
    </>
  )
  const comunes = { className: clases, 'aria-label': nombre, title: nombre, 'data-testid': testid, ...resto }
  if (href) return <a href={href} onClick={onClick} {...comunes}>{dentro}</a>
  if (onClick) return <button type="button" onClick={onClick} {...comunes}>{dentro}</button>
  return <span {...comunes}>{dentro}</span>
}
