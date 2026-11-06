/* diseño compacto */
/* El botón sobre el mapa (06-11-2026, §4): 48 redondo, superficie con sombra (flota), icono de 24; activo, en marca
   («Seguirme»). Con `href` es un enlace. El zoom de la web es el de Leaflet, puesto a 48 desde su CSS (§5.7). */
import icono from './icono'

export default function BotonMapa({ icono: Icono, nombre, activo, onClick, href, className = '', testid, ...resto }) {
  const clases = `flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dark-900 shadow-md ${activo ? 'text-ruta-marca' : 'text-dark-50'} ${className}`
  const comunes = { className: clases, 'aria-label': nombre, title: nombre, 'data-testid': testid, ...resto }
  if (href) return <a href={href} onClick={onClick} {...comunes}>{icono(Icono, 24)}</a>
  return (
    <button type="button" onClick={onClick} aria-pressed={activo === undefined ? undefined : !!activo} {...comunes}>{icono(Icono, 24)}</button>
  )
}
