/* diseño compacto */
/* Los botones de la app de reparto (06-11-2026, §4 de la especificación): una pieza, cuatro variantes.
   - principal: 52 de alto mínimo, letra «nombre», icono de 20; tonos marca (tinta oscura), ok y peligro (blanco);
     `cargando` pone el círculo. Con `contorno`, solo el borde («Entregar sin foto», «Escanear seguidos»).
   - normal: 48, letra «boton»; tonal o de contorno (borde de control); tonos marca, neutro, peligro, aviso y ok.
   - icono: 48×48 con icono de 24, tonal (`relleno`) o sin fondo; el nombre es obligatorio (aria-label y title).
   - texto: 40 visible y 48 de toque (la regla de index.css); marca, o peligro si borra.
   Radio 12 en todo (nada de píldoras) y sin altura fija: el texto pasa a dos líneas antes de cortarse. Con `href` es un
   enlace. El texto visible va dentro del nombre accesible: si se pone `nombre`, que contenga lo que se ve. */
import { Loader2 } from 'lucide-react'
import icono from './icono'

const RELLENO = {
  marca: 'bg-brand-500 text-brand-tinta',
  ok: 'bg-ruta-ok text-white',
  peligro: 'bg-ruta-peligro text-white',
  neutro: 'bg-dark-800 text-dark-50',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
}
const TONAL = {
  marca: 'bg-ruta-marca-tinte text-ruta-marca-tinte-texto',
  ok: 'bg-ruta-ok text-white',
  peligro: 'bg-ruta-peligro/10 text-ruta-peligro-texto',
  neutro: 'bg-dark-800 text-dark-50',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
}
const CONTORNO = {
  marca: 'border border-ruta-marca text-ruta-marca',
  ok: 'border border-ruta-ok text-ruta-ok-texto',
  peligro: 'border border-ruta-peligro/60 text-ruta-peligro-texto',
  neutro: 'border border-ruta-borde text-dark-50',
  aviso: 'border border-ruta-aviso-texto/60 text-ruta-aviso-texto',
}
const TEXTO = {
  marca: 'text-ruta-marca',
  ok: 'text-ruta-ok-texto',
  peligro: 'text-ruta-peligro-texto',
  neutro: 'text-dark-50',
  aviso: 'text-ruta-aviso-texto',
}

const FORMA = {
  principal: 'min-h-13 gap-2 rounded-xl px-4 py-2 text-nombre',
  normal: 'min-h-12 gap-2 rounded-xl px-4 py-2 text-boton',
  icono: 'h-12 w-12 shrink-0 rounded-xl',
  texto: 'min-h-10 gap-1 rounded-lg px-2 text-boton',
}
const ICONO = { principal: 20, normal: 20, icono: 24, texto: 20 }

function colores(variante, tono, contorno, relleno) {
  const t = tono in TEXTO ? tono : 'marca'
  if (variante === 'icono') return relleno ? TONAL[t] : TEXTO[t]
  if (variante === 'texto') return TEXTO[t]
  if (contorno) return CONTORNO[t]
  return variante === 'principal' ? RELLENO[t] : TONAL[t]
}

export default function Boton({
  variante = 'normal', tono = 'marca', contorno = false, relleno = false, icono: Icono, texto, children, nombre,
  cargando = false, disabled = false, href, onClick, className = '', type = 'button', testid, ...resto
}) {
  const forma = FORMA[variante] || FORMA.normal
  /* DESACTIVADO (14-11-2026, M7, el mismo de todo el producto): el hueco y la tinta apagada, nunca el color de su tono
     lavado al 50 %, que parecía roto. Cargando no cuenta: sigue con su color y la rueda (no ha dejado de valer). */
  const apagado = disabled && !cargando
  const color = !apagado ? colores(variante, tono, contorno, relleno)
    : variante === 'texto' || (variante === 'icono' && !relleno) ? 'text-dark-400'
      : contorno ? 'border border-ruta-borde text-dark-400' : 'bg-dark-800 text-dark-400'
  const clases = `inline-flex items-center justify-center text-center disabled:cursor-not-allowed ${forma} ${color} ${className}`
  const tam = ICONO[variante] || 20
  const dentro = (
    <>
      {cargando ? <Loader2 size={tam} className="shrink-0 animate-spin" aria-hidden="true" /> : icono(Icono, tam, 'shrink-0')}
      {variante !== 'icono' && (texto ?? children) != null && <span className="min-w-0">{texto ?? children}</span>}
    </>
  )
  const comunes = { className: clases, 'aria-label': nombre, title: variante === 'icono' ? nombre : undefined, 'data-testid': testid, 'aria-busy': cargando || undefined, ...resto }
  if (href && !disabled) return <a href={href} onClick={onClick} {...comunes}>{dentro}</a>
  return <button type={type} onClick={onClick} disabled={disabled || cargando} {...comunes}>{dentro}</button>
}
