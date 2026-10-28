import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Loader2, Mail } from 'lucide-react'
import { api } from '../../services/api'

export default function MiCorreoPersonal({ onBack }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get('/portal/mi-correo-personal')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ vinculado: false, email: null, pendiente: null }))
  }, [])

  async function enviar(e) {
    e.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const { data } = await api.post('/portal/mi-correo-personal', { email: email.trim() })
      if (data.vinculado) {
        setMessage(`Ese correo ya está verificado (${data.email}).`)
      } else {
        setMessage(`Te hemos enviado un enlace a ${data.email}. Ábrelo para confirmar el correo; caduca en 24 horas.`)
      }
      setEmail('')
      const latest = await api.get('/portal/mi-correo-personal')
      setStatus(latest.data)
    } catch (e2) {
      setError(e2?.response?.data?.detail || 'No se pudo enviar el enlace. Inténtalo de nuevo.')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-[100dvh] bg-dark-950 px-4 py-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-5 flex items-center gap-1.5 text-[13px] text-dark-400">
          <ArrowLeft size={15} /> Volver al portal
        </button>
        <div className="rounded-2xl border border-dark-800 bg-dark-900 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-3 text-brand-300"><Mail size={20} /></div>
            <div>
              <h1 className="text-lg font-bold text-dark-50">Correo de recuperación</h1>
              <p className="text-xs text-dark-400">Vincula un correo personal para entrar y recuperar tu acceso.</p>
            </div>
          </div>

          {status?.vinculado ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <Check size={16} /> Correo personal verificado
              </p>
              <p className="mt-1 text-sm text-dark-200">{status.email}</p>
              <p className="mt-2 text-xs leading-relaxed text-dark-400">
                Ya puedes iniciar sesión con tu correo de empresa o con este correo personal. Los códigos pedidos con el correo de empresa llegarán aquí.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[13px] leading-relaxed text-dark-300">
                Añade un correo personal al que sí tengas acceso. Te enviaremos un enlace para verificarlo; después podrás iniciar sesión también con esa dirección.
              </p>
              {status?.pendiente && (
                <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Pendiente de confirmar: {status.pendiente}
                </p>
              )}
              <form onSubmit={enviar} className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-dark-500">Tu correo personal</span>
                  <input type="email" required autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com"
                    className="w-full rounded-xl border border-dark-700 bg-dark-950 px-3.5 py-3 text-[15px] text-dark-50 outline-none focus:border-brand-500/60" />
                </label>
                {message && <p role="status" className="text-xs leading-relaxed text-emerald-300">{message}</p>}
                {error && <p role="alert" className="text-xs leading-relaxed text-red-300">{error}</p>}
                <button type="submit" disabled={busy || !email.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-brand-tinta disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {busy ? 'Enviando enlace…' : 'Verificar mi correo personal'}
                </button>
              </form>
              <button onClick={onBack} className="mt-3 w-full py-2 text-xs text-dark-500 hover:text-dark-300">
                Ahora no
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
