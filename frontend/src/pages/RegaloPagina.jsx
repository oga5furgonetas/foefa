import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Gift, Loader2, Route, Navigation, ScanLine, XCircle } from 'lucide-react'
import { API_BASE } from '../services/api'
import { isAuthed } from '../panel/auth'
import { MARCA } from '../marca'
import { tx, useIdioma } from '../lib/idioma'

/* ── EL ENLACE DEL REGALO ────────────────────────────────────────────────────
   Lo abre quien recibe el regalo por WhatsApp o correo. Dice qué le han
   regalado y le lleva a darse de alta (o a su cuenta) con el código guardado:
   la app lo canjea sola al entrar. No enseña quién lo regala. */

export default function RegaloPagina() {
  useIdioma()
  const { codigo } = useParams()
  const [d, setD] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/regalo/${encodeURIComponent(codigo || '')}`)
      .then((r) => r.json()).then(setD).catch(() => setD({ estado: 'error' }))
  }, [codigo])

  function usar(destino) {
    try { sessionStorage.setItem('regalo_pendiente', codigo) } catch { /* nada */ }
    window.location.href = destino
  }

  const que = d?.meses === 12 ? tx('1 año') : d?.meses > 1 ? tx('{n} meses', { n: d.meses }) : d?.meses ? tx('1 mes') : ''
  const malo = {
    canjeado: tx('Este regalo ya se ha usado.'),
    caducado: tx('Este regalo ha caducado.'),
    no_existe: tx('Este enlace de regalo no es válido.'),
    error: tx('Sin conexión. Inténtalo de nuevo en un momento.'),
  }[d?.estado]
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-950 px-4 py-10">
      <div className="w-full max-w-sm text-center">
        {!d ? <Loader2 className="mx-auto animate-spin text-dark-500" /> : malo ? (
          <div className="rounded-3xl border border-dark-700 bg-dark-900 p-6">
            <XCircle size={40} className="mx-auto text-red-300" />
            <p className="mt-3 text-[16px] font-semibold text-dark-100">{malo}</p>
            <a href="/empezar" className="mt-5 inline-block text-[14px] font-semibold text-brand-300">{tx('Conocer {marca}', { marca: MARCA.nombre })}</a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-b from-violet-500/[.18] via-dark-900 to-dark-900 p-6 shadow-2xl shadow-black/30">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/25 text-violet-200"><Gift size={34} /></div>
            <p className="mt-4 text-[13px] font-semibold uppercase tracking-wider text-violet-200">{tx('Te han hecho un regalo')}</p>
            <h1 className="mt-1 text-[26px] font-extrabold leading-tight text-dark-50">{tx('{que} de {marca}', { que, marca: MARCA.nombre })}</h1>
            <p className="mt-2 text-[14px] leading-snug text-dark-300">{tx('La app para quien reparte: tu ruta ordenada, navegación paso a paso y cada entrega apuntada.')}</p>
            <ul className="mx-auto mt-4 max-w-[260px] space-y-2 text-left text-[13.5px] text-dark-200">
              <li className="flex items-center gap-2"><ScanLine size={16} className="text-brand-300" /> {tx('Foto a la etiqueta y entra la dirección')}</li>
              <li className="flex items-center gap-2"><Route size={16} className="text-brand-300" /> {tx('Ruta ordenada por tiempo')}</li>
              <li className="flex items-center gap-2"><Navigation size={16} className="text-brand-300" /> {tx('Te guía hasta cada puerta')}</li>
            </ul>
            <p className="mt-4 text-[12px] text-dark-400">{tx('Sin tarjeta: no se te cobrará nada por este regalo.')}</p>
            {isAuthed() ? (
              <button onClick={() => usar('/ruta')} className="mt-5 w-full rounded-2xl bg-violet-500 py-3.5 text-[16px] font-bold text-white">{tx('Activar mi regalo')}</button>
            ) : (
              <>
                <button onClick={() => usar('/registro?sector=autonomo')} className="mt-5 w-full rounded-2xl bg-violet-500 py-3.5 text-[16px] font-bold text-white">{tx('Crear mi cuenta y activarlo')}</button>
                <button onClick={() => usar('/login')} className="mt-2 w-full rounded-2xl border border-dark-600 py-3 text-[14px] font-semibold text-dark-100">{tx('Ya tengo cuenta')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
