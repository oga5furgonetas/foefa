import { History } from 'lucide-react'
import { tx, locale } from '../../lib/idioma'

/* LA ÚLTIMA VEZ EN ESA PUERTA (17-10-2026). Si en los últimos 90 días se repartió en esta dirección y se dejó
   en portería o al vecino, se apuntó una nota («el portero no funciona») o no había nadie, la parada de hoy lo
   recuerda: lo calcula el servidor (`antes` en /reparto/mi-ruta, reparto.ultima_vez). Lo usan la tarjeta de
   la parada (MiRuta) y la pantalla de llegada (Navegacion). */
const SITIO = { mano: 'En mano', vecino: 'Al vecino', buzon: 'En el buzón', porteria: 'En portería o recepción', seguro: 'En un lugar seguro' }

const fechaCorta = (f) => {
  const d = new Date(`${f}T12:00:00`)
  return Number.isNaN(d.getTime()) ? f : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

export default function AntesPuerta({ a, className = '' }) {
  if (!a) return null
  const fecha = fechaCorta(a.fecha)
  const nota = a.nota ? `«${a.nota}»` : ''
  const fallo = a.estado === 'fallido'
  const texto = fallo
    ? tx('La última vez ({fecha}) no se pudo: {motivo}', { fecha, motivo: a.motivo ? tx(a.motivo) : '—' })
    : tx('La última vez ({fecha}): {como}', { fecha, como: [a.donde && SITIO[a.donde] ? tx(SITIO[a.donde]) : '', nota].filter(Boolean).join(' · ') })
  return (
    <p data-testid="antes" className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[12px] leading-snug ${fallo ? 'bg-amber-500/10 text-amber-100' : 'bg-sky-500/10 text-sky-100'} ${className}`}>
      <History size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{texto}{fallo && nota ? ` · ${nota}` : ''}</span>
    </p>
  )
}
