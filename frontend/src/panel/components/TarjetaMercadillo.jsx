import { useEffect, useState } from 'react'
import { Store, ChevronRight } from 'lucide-react'
import { mercEstado } from '../../services/api'

/* EL MERCADILLO, PARA LA OFICINA (17-10-2026). Dani: «a los perfiles de oficina también, un recuadro por si
   quieren ver el mercadillo o vender algo». Sale en el inicio del panel solo si el mercadillo está abierto (lo
   decide el servidor) y lleva a /mercadillo, donde cada persona de oficina vende y escribe con su usuario. */
export default function TarjetaMercadillo({ className = '' }) {
  const [m, setM] = useState(null)
  useEffect(() => {
    let vivo = true
    mercEstado().then(({ data }) => { if (vivo) setM(data?.visible ? data : null) }).catch(() => {})
    return () => { vivo = false }
  }, [])
  if (!m) return null
  const sinLeer = m.sin_leer || 0
  // Para Dani: si hay anuncios por revisar, la tarjeta lleva a aprobarlos.
  const porRevisar = m.por_revisar || 0
  return (
    <a href={porRevisar ? '/panel/admin?s=mercadillo' : '/mercadillo'} className={`card flex items-center gap-3 p-4 transition hover:border-brand-500/40 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300"><Store size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-dark-50">
          Mercadillo de repartidores{m.abierto === false && <span className="ml-2 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">Vista previa</span>}
        </span>
        <span className="block text-[13px] text-dark-400">
          {porRevisar > 0 ? `Tienes ${porRevisar} anuncio${porRevisar > 1 ? 's' : ''} por revisar` : sinLeer > 0 ? `Tienes ${sinLeer} mensaje${sinLeer > 1 ? 's' : ''} sin leer` : '¿Tienes algo que no usas? Véndelo o mira lo que venden los compañeros.'}
        </span>
      </span>
      {(porRevisar || sinLeer) > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[12px] font-bold text-white">{porRevisar || sinLeer}</span>}
      <ChevronRight size={18} className="shrink-0 text-dark-500" />
    </a>
  )
}
