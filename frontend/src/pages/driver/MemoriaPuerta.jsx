import { useState } from 'react'
import { KeyRound, X, Loader2 } from 'lucide-react'
import { tx, txError } from '../../lib/idioma'
import { repMiMemoria } from '../../services/api'
import { useAtras } from '../../lib/atras'

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

export default function MemoriaPuerta({ m, onEditar, className = '' }) {
  const t = textoMemoria(m)
  if (!t) {
    return (
      <button type="button" onClick={onEditar}
        className={`inline-flex items-center gap-1 rounded-lg border border-dashed border-dark-700 px-2 py-1 text-[12px] font-semibold text-dark-400 ${className}`}>
        <KeyRound size={12} /> {tx('Guardar para la próxima')}
      </button>
    )
  }
  return (
    <button type="button" data-testid="memoria" onClick={onEditar}
      className={`flex w-full items-start gap-1.5 rounded-lg bg-violet-500/10 px-2 py-1.5 text-left text-[12px] leading-snug text-violet-200 ${className}`}>
      <KeyRound size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{tx('Memoria de la puerta: {t}', { t })}</span>
    </button>
  )
}

/* La hoja: el código del portal (si el cliente lo dio en su enlace, ya viene puesto), dónde dejarlo y cómo se entra. */
export function MemoriaHoja({ p, onClose, onGuardado }) {
  const m = p.memoria || {}
  const [portal, setPortal] = useState(m.portal || p.cliente_dice?.portal || '')
  const [dejar, setDejar] = useState(m.dejar || '')
  const [acceso, setAcceso] = useState(m.acceso || '')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  useAtras(true, onClose)
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
  const inp = 'w-full rounded-xl border border-dark-700 bg-dark-900 px-3 py-2.5 text-[14px] text-dark-100 placeholder:text-dark-500'
  const titulo = tx('Para la próxima vez en esta puerta')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-dark-700 bg-dark-950 p-4 pb-8">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-bold text-dark-50">{titulo}</h2>
          <button onClick={onClose} className="rounded p-1 text-dark-400" aria-label={tx('Cerrar')}><X size={18} /></button>
        </div>
        <p className="mb-3 text-[12.5px] text-dark-400">{p.direccion} · {tx('Lo verá quien venga a esta dirección, también un compañero. Se borra al año.')}</p>
        <label className="mb-1 block text-[13px] text-dark-300" htmlFor="memoria-portal">{tx('Código del portal')}</label>
        <input id="memoria-portal" className={inp} value={portal} onChange={(e) => setPortal(e.target.value)} placeholder="1234" autoComplete="off" maxLength={40} />
        <p className="mb-1.5 mt-3 text-[13px] text-dark-300">{tx('¿Dónde lo dejas?')}</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(SITIOS).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={dejar === k} onClick={() => setDejar(dejar === k ? '' : k)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${dejar === k ? 'bg-brand-500 text-brand-tinta' : 'border border-dark-700 text-dark-200'}`}>{tx(t)}</button>
          ))}
        </div>
        <label className="mb-1 mt-3 block text-[13px] text-dark-300" htmlFor="memoria-acceso">{tx('Cómo se entra')}</label>
        <input id="memoria-acceso" className={inp} value={acceso} onChange={(e) => setAcceso(e.target.value)}
          placeholder={tx('«Entrada por el garaje», «timbre 2», «sin ascensor»…')} autoComplete="off" maxLength={200} />
        {error && <p role="alert" className="mt-2 text-[13px] text-red-300">{error}</p>}
        <button onClick={() => guardar(false)} disabled={ocupado || !(portal.trim() || dejar || acceso.trim())}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-brand-tinta disabled:opacity-50">
          {ocupado ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} {tx('Guardar para la próxima')}
        </button>
        {textoMemoria(p.memoria) && (
          <button onClick={() => guardar(true)} disabled={ocupado}
            className="mt-2 w-full rounded-xl border border-dark-600 py-3 text-[14px] font-semibold text-dark-300">{tx('Borrar lo guardado')}</button>
        )}
      </div>
    </div>
  )
}
