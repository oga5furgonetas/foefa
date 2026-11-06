/* diseño compacto */
/* La etiqueta de estado (06-11-2026, §4): 24 de alto, radio 8, relleno 8, letra «etiqueta», icono de 14 opcional y una
   sola línea. No se toca. Tonos de §3.6: neutro (chip gris), marca (tinte), ok (relleno: el verde sobre su tinte no llega al
   4,5:1 de día), peligro (tinte) y aviso. El estado va con icono además del color. */
import icono from './icono'

const TONOS = {
  neutro: 'bg-dark-800 text-dark-400',
  marca: 'bg-ruta-marca-tinte text-ruta-marca-tinte-texto',
  ok: 'bg-ruta-ok text-white',
  peligro: 'bg-ruta-peligro/10 text-ruta-peligro-texto',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
}

export default function Etiqueta({ texto, tono = 'neutro', icono: Icono, titulo, className = '', testid, children }) {
  return (
    <span title={titulo} data-testid={testid}
      className={`inline-flex h-6 max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-etiqueta ${TONOS[tono] || TONOS.neutro} ${className}`}>
      {icono(Icono, 14, 'shrink-0')}
      <span className="truncate">{texto ?? children}</span>
    </span>
  )
}
