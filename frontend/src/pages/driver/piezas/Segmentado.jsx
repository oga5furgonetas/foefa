/* diseño compacto */
/* El segmentado (06-11-2026, §4): 40 de alto y 48 de toque, radio 12, letra «boton»; el elegido en relleno de marca.
   role="group" con `nombre` y aria-pressed en cada opción. `opciones` = [{ valor, texto, icono }]. */
import icono from './icono'

export default function Segmentado({ opciones = [], valor, onChange, nombre, className = '', testid }) {
  return (
    <div role="group" aria-label={nombre} data-testid={testid} className={`flex min-h-10 rounded-xl border border-ruta-borde p-0.5 ${className}`}>
      {opciones.map((o) => {
        const elegido = o.valor === valor
        return (
          <button key={o.valor} type="button" onClick={() => onChange?.(o.valor)} aria-pressed={elegido}
            className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg px-2 text-boton ${elegido ? 'bg-brand-500 text-brand-tinta' : 'text-dark-50'}`}>
            {icono(o.icono, 16, 'shrink-0')}
            <span>{o.texto}</span>
          </button>
        )
      })}
    </div>
  )
}
