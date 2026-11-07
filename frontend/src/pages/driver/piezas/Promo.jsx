/* diseño compacto */
/* La promo (06-11-2026, §4): una a la vez, justo debajo de la tarjeta de la siguiente. 48 de alto mínimo, radio 12, tinte
   ok o aviso, icono de 20 + letra «boton» en una línea y, a la derecha, la cifra («3/20») o un botón de icono (`accion`,
   un elemento). Barra de 2 si hay `progreso` (de 0 a 1); la pista («ruta vacía», «lo estamos revisando») en «sec» debajo.
   Tocarla (`onTocar`) abre su Ayuda con las condiciones; `onCerrar` pone la ✕ («Ahora no»). El texto va en tinta y el
   verde solo en el icono y la barra: el verde sobre su tinte no llega al 4,5:1 de día. */
import { X } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'
import icono from './icono'

const TONOS = { ok: 'bg-ruta-ok/10 text-dark-50', aviso: 'bg-ruta-aviso text-ruta-aviso-texto' }
const ICONO = { ok: 'text-ruta-ok-texto', aviso: 'text-ruta-aviso-texto' }
const BARRA = { ok: 'bg-ruta-ok', aviso: 'bg-ruta-aviso-texto' }

export default function Promo({
  texto, icono: Icono, tono = 'ok', cifra, progreso, pista, onTocar, nombre, accion, onCerrar, nombreCerrar, className = '', testid, children,
}) {
  const t = tono in TONOS ? tono : 'ok'
  const Fila = onTocar ? 'button' : 'div'
  const pct = progreso == null ? null : Math.max(0, Math.min(100, Math.round(progreso * 100)))
  return (
    <div data-testid={testid} className={`rounded-xl ${TONOS[t]} ${className}`}>
      {/* Con un botón a la derecha (✕, acción) el de 48 ya trae su aire; solo con la cifra («3/20»), 12 como a la izquierda (08-11-2026). */}
      <div className={`flex min-h-12 items-center gap-1 ${accion || onCerrar ? 'pr-1' : 'pr-3'}`}>
        <Fila type={onTocar ? 'button' : undefined} onClick={onTocar} aria-label={onTocar ? nombre : undefined}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 pl-3 text-left">
          {icono(Icono, 20, `shrink-0 ${ICONO[t]}`)}
          <span className="min-w-0 flex-1 truncate text-boton">{texto ?? children}</span>
          {cifra != null && <span className="shrink-0 text-boton tabular-nums">{cifra}</span>}
        </Fila>
        {accion}
        {onCerrar && <Boton variante="icono" icono={X} tono={t === 'aviso' ? 'aviso' : 'neutro'} nombre={nombreCerrar || tx('Cerrar')} onClick={onCerrar} />}
      </div>
      {pct != null && (
        <div className="mx-3 mb-2 h-0.5 overflow-hidden rounded bg-dark-50/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className={`h-full rounded ${BARRA[t]}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {pista && <p className="px-3 pb-2 text-sec text-dark-400">{pista}</p>}
    </div>
  )
}
