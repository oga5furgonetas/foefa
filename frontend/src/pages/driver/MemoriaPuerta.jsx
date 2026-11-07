/* diseño compacto */
import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { tx, txError } from '../../lib/idioma'
import { repMiMemoria } from '../../services/api'
import { DONDE_CORTO } from '../../lib/dejar'
import Boton from './piezas/Boton'
import Campo from './piezas/Campo'
import { ChipOpcion } from './piezas/Chip'
import FilaChips from './piezas/FilaChips'
import Hoja from './piezas/Hoja'

/* LA MEMORIA DE LA CALLE (01-11-2026, docs/SIGUIENTE-NIVEL-01-11.md §3). Lo que se aprende de cada portal y vale para
   la próxima vez, para quien sea de la empresa: el código del portal, dónde dejarlo y cómo se entra. Lo trae el
   servidor por dirección (`memoria` en /reparto/mi-ruta, de la colección calle_memoria); se guarda desde la parada con
   «Guardar para la próxima» (POST /reparto/mis-pedidos/{id}/memoria); lo dice el briefing (lib/briefing.js). El
   portal que da el cliente en su enlace entra solo si no había. Caduca al año. La nativa tiene lo mismo en Hojas.kt. */
export const SITIOS = { mano: 'En mano', vecino: 'Al vecino', buzon: 'En el buzón', porteria: 'En portería o recepción', seguro: 'En un lugar seguro' }

/* «portal 1234, dejar en portería, entrada por el garaje»: lo que se pinta y lo que se dice. */
export function textoMemoria(m) {
  if (!m) return ''
  const partes = []
  if (m.portal) partes.push(tx('portal {c}', { c: m.portal }))
  if (m.dejar && SITIOS[m.dejar]) partes.push(tx('dejar {d}', { d: tx(SITIOS[m.dejar]).toLowerCase() }))
  if (m.acceso) partes.push(m.acceso)
  return partes.join(', ')
}

/* Lo que enseña la tarjeta de la parada, hasta que NotasPuerta lo sustituya (W2; lo quita F). Solo con los tokens del
   diseño compacto (07-11-2026): lo que hace, igual. */
export default function MemoriaPuerta({ m, onEditar, className = '' }) {
  const t = textoMemoria(m)
  if (!t) {
    return (
      <button type="button" onClick={onEditar}
        className={`inline-flex min-h-8 items-center gap-1 rounded-lg border border-dashed border-ruta-borde px-2 text-etiqueta text-dark-400 ${className}`}>
        <KeyRound size={14} aria-hidden="true" /> {tx('Guardar para la próxima')}
      </button>
    )
  }
  return (
    <button type="button" data-testid="memoria" onClick={onEditar}
      className={`flex w-full items-start gap-2 rounded-lg bg-dark-800 px-2 py-1 text-left text-sec text-dark-50 ${className}`}>
      <KeyRound size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{tx('Memoria de la puerta: {t}', { t })}</span>
    </button>
  )
}

/* LA HOJA (diseño compacto, 07-11-2026, §5.3), sobre piezas/Hoja: «Memoria de la puerta» con la dirección de subtítulo y
   «La ven tus compañeros · se borra al año» (la frase larga, en el «?»); el código del portal (si el cliente lo dio en su
   enlace, ya viene puesto), «¿Dónde?» con los chips cortos y «Cómo se entra» con su ejemplo; en el pie, «Guardar» y, si ya
   había algo, «Borrar». Lo que se guarda no cambia. El «atrás» del móvil lo pone la Hoja. */
export function MemoriaHoja({ p, onClose, onGuardado }) {
  const m = p.memoria || {}
  const [portal, setPortal] = useState(m.portal || p.cliente_dice?.portal || '')
  const [dejar, setDejar] = useState(m.dejar || '')
  const [acceso, setAcceso] = useState(m.acceso || '')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  async function guardar(borrar) {
    setOcupado(true)
    setError('')
    try {
      const { data } = await repMiMemoria(p.id, borrar ? {} : { portal: portal.trim(), dejar, acceso: acceso.trim() })
      onGuardado(data.memoria)
    } catch (e) {
      setError(txError(e, 'No se pudo guardar'))
      setOcupado(false)
    }
  }
  return (
    <Hoja titulo={tx('Memoria de la puerta')} subtitulo={p.direccion} onClose={onClose}
      ayuda={{ texto: tx('Lo verá quien venga a esta dirección, también un compañero. Se borra al año.') }}
      pie={(
        <div className="flex flex-col gap-2">
          <Boton variante="principal" icono={KeyRound} texto={tx('Guardar')} onClick={() => guardar(false)} cargando={ocupado}
            disabled={!(portal.trim() || dejar || acceso.trim())} className="w-full" />
          {textoMemoria(p.memoria) && (
            <Boton variante="texto" tono="peligro" texto={tx('Borrar')} onClick={() => guardar(true)} disabled={ocupado} className="w-full" />
          )}
        </div>
      )}>
      <p className="mt-2 text-sec text-dark-400">{tx('La ven tus compañeros · se borra al año')}</p>
      <p className="mt-3 mb-1 text-boton text-dark-50">{tx('Código del portal')}</p>
      <Campo icono={KeyRound} valor={portal} onChange={setPortal} ejemplo="1234" nombre={tx('Código del portal')} autoComplete="off" maxLength={40} />
      <p className="mt-3 text-boton text-dark-50">{tx('¿Dónde?')}</p>
      <FilaChips>
        {DONDE_CORTO.map(([k, t]) => (
          <ChipOpcion key={k} texto={tx(t)} seleccionado={dejar === k} onClick={() => setDejar(dejar === k ? '' : k)} />
        ))}
      </FilaChips>
      <p className="mt-2 mb-1 text-boton text-dark-50">{tx('Cómo se entra')}</p>
      <Campo valor={acceso} onChange={setAcceso} ejemplo={tx('Garaje, timbre 2, sin ascensor…')} nombre={tx('Cómo se entra')} autoComplete="off" maxLength={200} />
      {error && <p role="alert" className="mt-2 text-sec text-ruta-peligro-texto">{error}</p>}
    </Hoja>
  )
}
