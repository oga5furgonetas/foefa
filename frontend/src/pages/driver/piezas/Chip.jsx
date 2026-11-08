/* diseño compacto */
/* El chip de acción y el de opción (06-11-2026, §4): 32 visible y 48 de toque (la regla de index.css), radio 8, relleno 12,
   letra «boton», icono de 16. Tonos: neutro (contorno), marca (relleno) y aviso. El de opción (ChipOpcion) lleva
   `seleccionado`: el elegido va en relleno de marca y con aria-pressed. Con `href` es un enlace. */
import { Loader2 } from 'lucide-react'
import icono from './icono'

const TONOS = {
  neutro: 'border border-ruta-borde text-dark-50',
  marca: 'bg-brand-500 text-brand-tinta',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
}

export default function Chip({
  texto, icono: Icono, tono = 'neutro', seleccionado, onClick, href, nombre, cargando = false, disabled = false,
  className = '', testid, children, ...resto
}) {
  const clases = `inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-boton disabled:opacity-50 ${seleccionado ? TONOS.marca : TONOS[tono] || TONOS.neutro} ${className}`
  const dentro = (
    <>
      {cargando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icono(Icono, 16)}
      <span>{texto ?? children}</span>
    </>
  )
  const comunes = { className: clases, 'aria-label': nombre, title: nombre, 'data-testid': testid, ...resto }
  if (href && !disabled) return <a href={href} onClick={onClick} {...comunes}>{dentro}</a>
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={seleccionado === undefined ? undefined : !!seleccionado} {...comunes}>
      {dentro}
    </button>
  )
}

export function ChipOpcion({ seleccionado = false, ...props }) {
  return <Chip seleccionado={seleccionado} {...props} />
}
