import { useState } from 'react'
import { tx, useIdioma } from '../../lib/idioma'
import { temaGuardado, elegirTema, letraGrande, elegirLetra } from '../../lib/tema'
import { medirAccion } from '../../lib/analitica'

/* ASPECTO Y LETRA, EN AJUSTES DE LA APP DEL REPARTIDOR (17-10-2026). Antes el tema solo se cambiaba desde el panel de
   empresas y no había forma de agrandar la letra. «Claro» es el tema de siempre (el híbrido), «Oscuro» el de noche y
   «Automático» sigue al móvil. Se guarda en el móvil (lib/tema.js). */
const TEMAS = [['hibrido', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Automático']]

export default function AjustesMovil() {
  useIdioma()
  const [tema, setTema] = useState(() => { const t = temaGuardado(); return t === 'light' ? 'hibrido' : t })
  const [grande, setGrande] = useState(letraGrande)
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[14px] font-semibold text-dark-100">{tx('Aspecto')}</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={tx('Aspecto')}>
          {TEMAS.map(([k, t]) => (
            <button key={k} type="button" role="radio" aria-checked={tema === k}
              onClick={() => { setTema(k); elegirTema(k); medirAccion(`tema_${k}`) }}
              className={`rounded-xl border px-2 py-2.5 text-[13.5px] font-semibold ${tema === k ? 'border-brand-400 bg-brand-500/15 text-brand-200' : 'border-dark-700 text-dark-200'}`}>
              {tx(t)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-dark-400">{tx('Automático sigue al móvil: oscuro cuando el móvil está en modo oscuro.')}</p>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-[14px] font-semibold text-dark-100">{tx('Letra más grande')}</span>
          <span className="block text-[12px] leading-snug text-dark-400">{tx('Para leer mejor con sol o en la furgoneta.')}</span>
        </span>
        <input type="checkbox" checked={grande} aria-label={tx('Letra más grande')}
          onChange={(e) => { setGrande(e.target.checked); elegirLetra(e.target.checked); medirAccion(e.target.checked ? 'letra_grande' : 'letra_normal') }}
          className="h-5 w-5 shrink-0 accent-brand-500" />
      </label>
    </div>
  )
}
