/* diseño compacto */
import { History } from 'lucide-react'
import { tx, locale } from '../../lib/idioma'

/* LA ÚLTIMA VEZ EN ESA PUERTA (17-10-2026). Si en los últimos 90 días se repartió en esta dirección y se dejó
   en portería o al vecino, se apuntó una nota («el portero no funciona») o no había nadie, la parada de hoy lo
   recuerda: lo calcula el servidor (`antes` en /reparto/mi-ruta, reparto.ultima_vez). Lo usan la tarjeta de
   la parada (MiRuta) y la pantalla de llegada (Navegacion). Desde el diseño compacto (07-11-2026) la tarjeta y la
   hoja de la parada lo pintan con piezas/NotasPuerta, que toma de aquí la frase (`partesAntes`). */
const SITIO = { mano: 'En mano', vecino: 'Al vecino', buzon: 'En el buzón', porteria: 'En portería o recepción', seguro: 'En un lugar seguro' }

const fechaCorta = (f) => {
  const d = new Date(`${f}T12:00:00`)
  return Number.isNaN(d.getTime()) ? f : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

/* La frase de siempre («La última vez (21 oct): En portería o recepción · «timbre roto»») y sus trozos: la fecha, lo
   corto que se enseña sin el prefijo (NotasPuerta) y si aquella vez no se pudo entregar. */
export function partesAntes(a) {
  if (!a) return null
  const fecha = fechaCorta(a.fecha)
  const nota = a.nota ? `«${a.nota}»` : ''
  const fallo = a.estado === 'fallido'
  const motivo = a.motivo ? tx(a.motivo) : '—'
  const como = [a.donde && SITIO[a.donde] ? tx(SITIO[a.donde]) : '', nota].filter(Boolean).join(' · ')
  const frase = fallo
    ? `${tx('La última vez ({fecha}) no se pudo: {motivo}', { fecha, motivo })}${nota ? ` · ${nota}` : ''}`
    : tx('La última vez ({fecha}): {como}', { fecha, como })
  const corto = fallo ? [motivo, nota].filter(Boolean).join(' · ') : como
  return { fecha, fallo, frase, corto }
}

export default function AntesPuerta({ a, className = '' }) {
  const partes = partesAntes(a)
  if (!partes) return null
  return (
    <p data-testid="antes" className={`flex items-start gap-2 rounded-lg px-2 py-1 text-sec ${partes.fallo ? 'bg-ruta-aviso text-ruta-aviso-texto' : 'bg-dark-800 text-dark-50'} ${className}`}>
      <History size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{partes.frase}</span>
    </p>
  )
}
