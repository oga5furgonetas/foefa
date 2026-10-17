import { ChevronRight } from 'lucide-react'

/* LA CASILLA DEL PANEL (17-10-2026). Dani: «ordénamelo en cuadraditos que clique y entre, igual que ven los
   conductores». La misma en el Inicio y en Negocio: icono, nombre, lo justo y un globito cuando hay algo que
   hacer —rojo si no puede esperar, naranja si conviene mirarlo—. */
const BORDE = { brand: 'border-brand-500/40', ambar: 'border-amber-400/50', rojo: 'border-red-500/60' }
const ICONO = { brand: 'bg-brand-500/15 text-brand-300', ambar: 'bg-amber-400/15 text-amber-300', rojo: 'bg-red-500/15 text-red-300' }
const GLOBO = { rojo: 'bg-red-500 text-white', ambar: 'bg-amber-400 text-black' }

export default function Casilla({ icono: Icono, titulo, detalle, aviso, avisoTono = 'rojo', tono, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={detalle ? `${titulo}. ${detalle}` : titulo}
      className={`card relative flex min-h-[124px] flex-col justify-between border p-4 text-left transition hover:border-brand-500/50 active:scale-[.98] ${BORDE[tono] || 'border-dark-700'}`}>
      {aviso > 0 && (
        <span className={`absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold ${GLOBO[avisoTono] || GLOBO.rojo}`}>{aviso}</span>
      )}
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${ICONO[tono] || 'bg-dark-800 text-dark-300'}`}><Icono size={20} /></span>
      <span className="mt-3 block">
        <span className="flex items-center gap-1 text-[15px] font-semibold leading-tight text-dark-50">{titulo} <ChevronRight size={14} className="shrink-0 text-dark-500" /></span>
        {detalle && <span className="mt-0.5 block text-[12.5px] leading-snug text-dark-400">{detalle}</span>}
      </span>
    </button>
  )
}
