import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { API_BASE } from '../services/api'
import { saveSession } from '../panel/auth'
import { marcarRecienAlta } from '../lib/instalar'
import { tx, useIdioma, txError } from '../lib/idioma'

/* /pase?p=… (10-10-2026): la otra punta del pase al móvil. Llega aquí Chrome
   (desde el navegador de TikTok) o el móvil que ha escaneado el QR del
   ordenador; canjea el pase por la sesión y sigue en la app, donde le espera el
   paso de instalarla. El pase se quita de la dirección antes de nada. */
export default function PaseMovil() {
  useIdioma()
  const [error, setError] = useState('')
  useEffect(() => {
    const pase = new URLSearchParams(window.location.search).get('p') || ''
    window.history.replaceState(null, '', '/pase')
    if (!pase) { window.location.replace('/login'); return }
    fetch(`${API_BASE}/auth/pase-movil/canjear`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pase }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.access_token) throw j
        saveSession(j)
        marcarRecienAlta()
        window.location.replace('/ruta')
      })
      .catch((j) => setError(txError({ detail: j?.detail }, 'El enlace ha caducado. Entra con tu correo y tu contraseña.')))
  }, [])
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-950 px-6 text-center text-dark-100">
      {error ? (
        <div className="max-w-sm">
          <p className="text-[15px] leading-snug">{error}</p>
          <a href="/login" className="mt-5 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-[14.5px] font-bold text-brand-tinta">{tx('Entrar')}</a>
        </div>
      ) : <Loader2 size={28} className="animate-spin text-brand-300" aria-label={tx('Entrando…')} />}
    </div>
  )
}
