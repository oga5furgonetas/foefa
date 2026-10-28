import { useEffect, useState } from 'react'
import { Check, Loader2, MailCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'

export default function VerificarCorreoConductor() {
  const token = window.location.hash.replace(/^#/, '').trim()
  const [state, setState] = useState(token ? 'ready' : 'error')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!window.location.hash) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  async function verify() {
    if (!token || state === 'loading') return
    setState('loading')
    try {
      const { data } = await api.post('/auth/driver-recovery/verify-link', { token })
      setEmail(data.email || ''); setState('success')
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo verificar el correo. Pide a la oficina que envíe otro enlace.')
      setState('error')
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-dark-950 px-4 py-10"
      style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))', paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
      <section className="w-full max-w-md rounded-2xl border border-dark-800 bg-dark-900 p-6 text-center shadow-2xl">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${state === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-brand-500/10 text-brand-300'}`}>
          {state === 'loading' && <Loader2 size={24} className="animate-spin" />}
          {state === 'success' && <MailCheck size={24} />}
          {state === 'error' && <XCircle size={24} />}
        </div>
        <h1 className="mt-5 text-xl font-bold text-dark-50">
          {state === 'ready' ? 'Confirma tu correo personal' : state === 'loading' ? 'Verificando correo' : state === 'success' ? 'Correo personal verificado' : 'No se pudo verificar'}
        </h1>
        {state === 'success' ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-dark-300">
              {email ? `${email} ya puede recibir los códigos para entrar en el portal del conductor.` : 'Tu correo personal ya puede recibir los códigos para entrar.'}
            </p>
            <p className="mt-2 text-xs text-dark-500">Puedes cerrar esta página y volver a FDS.</p>
            <Link to="/conductor" className="btn-primary mt-6 flex w-full items-center justify-center py-3">Ir al portal</Link>
          </>
        ) : state === 'ready' ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-dark-300">Confirma que puedes recibir mensajes en este correo. Solo se vinculará a tu acceso de conductor si tú pulsas el botón.</p>
            <button type="button" onClick={verify} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 py-3">
              <Check size={16} /> Confirmar correo personal
            </button>
            <p className="mt-3 text-xs text-dark-500">El enlace caduca en 24 horas y solo se puede usar una vez.</p>
          </>
        ) : state === 'error' ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-dark-300">{error || 'El enlace no es válido. Pide a la oficina que envíe otro.'}</p>
            <p className="mt-2 text-xs text-dark-500">Los enlaces caducan a las 24 horas y solo se pueden usar una vez.</p>
          </>
        ) : <p className="mt-2 text-sm text-dark-400">Un momento…</p>}
      </section>
    </main>
  )
}
