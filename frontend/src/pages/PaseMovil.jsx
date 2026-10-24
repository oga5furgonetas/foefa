import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { API_BASE } from '../services/api'
import { saveSession } from '../panel/auth'
import { marcarRecienAlta } from '../lib/instalar'
import { tx, useIdioma, txError } from '../lib/idioma'

/* /pase?p=… (10-10-2026): la otra punta del pase al móvil. Llega aquí Chrome
   (desde el navegador de TikTok) o el móvil que ha escaneado el QR del
   ordenador; canjea el pase por la sesión y sigue en la app, donde le espera el
   paso de instalarla. El pase se quita de la dirección antes de nada.
   DESDE LOS CORREOS (24-10-2026): /pase?ir=ruta&utm_…#p=… — el pase va tras «#»
   (no llega al servidor ni a la analítica) y `ir` dice dónde seguir: su ruta o
   su cuenta. Las utm se quedan para saber qué correo le trajo. */
const DESTINOS = { ruta: '/ruta', cuenta: '/ruta?tab=cuenta' }

export default function PaseMovil() {
  useIdioma()
  const [error, setError] = useState('')
  const [destino] = useState(() => {
    const ir = new URLSearchParams(window.location.search).get('ir')
    return DESTINOS[ir] || ''
  })
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const pase = new URLSearchParams(window.location.hash.slice(1)).get('p') || q.get('p') || ''
    const utm = [...q].filter(([k]) => k.startsWith('utm_'))
    const resto = new URLSearchParams(utm).toString()
    window.history.replaceState(null, '', `/pase${resto ? `?${resto}` : ''}`)
    if (!pase) { window.location.replace(destino ? `/login?next=${encodeURIComponent(destino)}` : '/login'); return }
    fetch(`${API_BASE}/auth/pase-movil/canjear`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pase }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.access_token) throw j
        saveSession(j)
        if (!destino) { marcarRecienAlta(); window.location.replace('/ruta'); return }
        window.location.replace(resto ? `${destino}${destino.includes('?') ? '&' : '?'}${resto}` : destino)
      })
      .catch((j) => setError(txError({ detail: j?.detail }, 'El enlace ha caducado. Entra con tu correo y tu contraseña.')))
  }, [destino])
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-950 px-6 text-center text-dark-100">
      {error ? (
        <div className="max-w-sm">
          <p className="text-[15px] leading-snug">{error}</p>
          <a href={`/login?next=${encodeURIComponent(destino || '/ruta')}`}
            className="mt-5 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-[14.5px] font-bold text-brand-tinta">{tx('Entrar')}</a>
        </div>
      ) : <Loader2 size={28} className="animate-spin text-brand-300" aria-label={tx('Entrando…')} />}
    </div>
  )
}
