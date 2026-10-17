import { useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { tx, useIdioma } from '../lib/idioma'
import { pushSupported, enablePush } from '../lib/push'
import { medirAccion } from '../lib/analitica'

/* AVISO DE LA MAÑANA (11-10-2026). Medido: casi todos se dan de alta (de noche, en fin de semana) y no
   vuelven el día que reparten. Se les ofrece UN aviso a las 8:00 de su hora, de lunes a sábado, solo si
   ese día aún no han metido paquetes (lo manda el servidor: _aviso_manana_vuelta). Se pregunta una vez:
   si dice que no, no se vuelve a preguntar. */
const CLAVE = 'fds_aviso_manana'

export default function AvisoManana({ toast }) {
  useIdioma()
  const [ver, setVer] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    try {
      if (pushSupported() && Notification.permission === 'default' && !localStorage.getItem(CLAVE)) setVer(true)
    } catch { /* sin almacenamiento o sin avisos: no se ofrece */ }
    // Contestado en la bienvenida de la ruta (MiRuta): esta tarjeta ya no hace falta.
    const ya = () => setVer(false)
    window.addEventListener('fds-aviso-manana', ya)
    return () => window.removeEventListener('fds-aviso-manana', ya)
  }, [])
  if (!ver) return null
  const cerrar = (v) => { try { localStorage.setItem(CLAVE, v) } catch { /* nada */ } setVer(false) }

  async function activar() {
    setOcupado(true)
    medirAccion('aviso_manana_si')
    const r = await enablePush()
    setOcupado(false)
    if (r === 'ok') { toast?.success(tx('Listo: te aviso a las 8:00 los días que aún no tengas paquetes.')); cerrar('si') }
    else if (r === 'denied') { toast?.error(tx('El móvil no ha dado permiso para avisos. Puedes activarlo en los ajustes del navegador.')); cerrar('denegado') }
    else { toast?.error(tx('No se han podido activar los avisos en este móvil.')); cerrar('error') }
  }

  return (
    <div className="mx-auto mb-3 max-w-md rounded-2xl border border-sky-400/30 bg-sky-500/[.08] px-3.5 py-3" role="region" aria-label={tx('Aviso por la mañana')}>
      <p className="flex items-start gap-2 text-[13.5px] font-semibold leading-snug text-sky-100">
        <Bell size={17} className="mt-0.5 shrink-0" /> {tx('¿Te aviso por la mañana para cargar tu ruta?')}
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-dark-300">{tx('Un aviso a las 8:00, de lunes a sábado, solo si aún no has metido paquetes.')}</p>
      <div className="mt-2.5 flex gap-2">
        <button onClick={activar} disabled={ocupado}
          className="flex items-center gap-1.5 rounded-xl bg-sky-700 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
          {ocupado && <Loader2 size={14} className="animate-spin" />} {tx('Sí, avísame')}
        </button>
        <button onClick={() => { medirAccion('aviso_manana_no'); cerrar('no') }}
          className="rounded-xl border border-dark-600 px-3.5 py-2 text-[13px] font-semibold text-dark-200">{tx('No, gracias')}</button>
      </div>
    </div>
  )
}
