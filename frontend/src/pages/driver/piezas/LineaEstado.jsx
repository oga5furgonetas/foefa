/* diseño compacto */
/* La línea de estado que no se cierra (06-11-2026, §4): 40 de alto, letra «texto», un punto de color o un icono y una
   acción de texto. La jornada del conductor de empresa («● En jornada · la oficina ve tu ubicación» + «Terminar») y
   «Viendo a {nombre}» + «Volver a mi cuenta». */
import Boton from './Boton'
import icono from './icono'

const PUNTOS = { ok: 'bg-ruta-ok', aviso: 'bg-ruta-aviso-texto', peligro: 'bg-ruta-peligro', marca: 'bg-brand-500', neutro: 'bg-dark-400' }

export default function LineaEstado({ texto, punto, icono: Icono, accion, onAccion, nombre, className = '', testid, children }) {
  return (
    <div data-testid={testid} className={`flex min-h-10 items-center gap-2 px-1 text-texto text-dark-50 ${className}`}>
      {punto && <span className={`h-2 w-2 shrink-0 rounded-full ${PUNTOS[punto] || PUNTOS.neutro}`} aria-hidden="true" />}
      {icono(Icono, 18, 'shrink-0 text-dark-400')}
      <span className="min-w-0 flex-1">{texto ?? children}</span>
      {accion && <Boton variante="texto" tono="marca" texto={accion} nombre={nombre} onClick={onAccion} className="shrink-0" />}
    </div>
  )
}
