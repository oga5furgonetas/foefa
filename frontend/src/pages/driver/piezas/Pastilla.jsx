/* diseño compacto */
/* La pastilla sobre el mapa (06-11-2026, §4): 32 visible y 48 de toque, redonda, letra «etiqueta» en UNA línea con «…»,
   sombra (flota) y los tonos de §3.6, opacos para que se lean sobre el mapa. Con `onClick` es un botón, con `href` un
   enlace («Google Maps ↗») y si no, solo texto («{km} · {t}»). */
import icono from './icono'

const TONOS = {
  neutro: 'bg-dark-900 text-dark-50',
  marca: 'bg-ruta-marca-tinte text-ruta-marca-tinte-texto',
  ok: 'bg-ruta-ok text-white',
  peligro: 'bg-ruta-peligro text-white',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
}

export default function Pastilla({ texto, tono = 'neutro', icono: Icono, onClick, href, nombre, className = '', testid, children, ...resto }) {
  const clases = `inline-flex h-8 max-w-full items-center gap-1 rounded-full px-3 text-etiqueta shadow-md ${TONOS[tono] || TONOS.neutro} ${className}`
  const dentro = (
    <>
      {icono(Icono, 16, 'shrink-0')}
      <span className="truncate">{texto ?? children}</span>
    </>
  )
  const comunes = { className: clases, 'aria-label': nombre, title: nombre, 'data-testid': testid, ...resto }
  if (href) return <a href={href} onClick={onClick} {...comunes}>{dentro}</a>
  if (onClick) return <button type="button" onClick={onClick} {...comunes}>{dentro}</button>
  return <span {...comunes}>{dentro}</span>
}
