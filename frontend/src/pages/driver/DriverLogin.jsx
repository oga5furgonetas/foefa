import { useState } from 'react'
import { Loader2, LogIn, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { driverLookup, DRIVER_TOKEN_KEY, currentSlug } from '../../services/api'
import { api } from '../../services/api'
import { useToast } from '../../lib/toast'
import { useT } from '../../i18n'
import { MARCA } from '../../marca'

export default function DriverLogin({ onLogin }) {
  const toast = useToast()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState('email') // 'email' | 'code' | 'password'
  const [currentDriver, setCurrentDriver] = useState(null)
  const [busy, setBusy] = useState(false)
  const [orgName] = useState('')

  const urlCenter = (new URLSearchParams(window.location.search).get('c') || '').toUpperCase()

  /* Si ha llegado aqui porque se le caduco la sesion, hay que decirselo. Sin
     esto aparece de golpe en la pantalla de entrada sin saber por que, y lo
     normal es pensar que la aplicacion se ha roto. */
  const [caducada] = useState(() => {
    try {
      const hay = sessionStorage.getItem('driver_sesion_caducada') === '1'
      if (hay) sessionStorage.removeItem('driver_sesion_caducada')
      return hay
    } catch {
      return false
    }
  })

  // El selector de estación se quitó a propósito: se alimentaba de la lista
  // pública de conductores. La estación la resuelve el servidor con el email.

  const handleEmailSubmit = async () => {
    if (!email) return toast.warning(t('dr.introEmail'))
    setBusy(true)
    try {
      await driverLookup(email.trim())
      setCurrentDriver({ email: email.trim() })
      setStep('code')
    } catch (ex) {
      const msg = ex?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : t('dr.eLogin'))
    }
    setBusy(false)
  }

  const handleCodeSubmit = async () => {
    if (!/^\d{6}$/.test(code.trim())) return toast.warning(t('dr.codeSixWarn'))
    setBusy(true)
    try {
      const r = await api.post('/auth/driver-code/verify', { email: email.trim(), code: code.trim() })
      const d = r.data || {}
      localStorage.setItem(DRIVER_TOKEN_KEY, d.access_token)
      onLogin({ id: d.id, name: d.name, email: email.trim(), center: d.center })
      toast.success(`${t('dr.bienvenido')}, ${d.name}`)
    } catch (ex) {
      toast.error(ex?.response?.status === 429 ? (ex?.response?.data?.detail || t('dr.codeInvalid')) : t('dr.codeInvalid'))
    } finally { setBusy(false) }
  }

  const handleResend = async () => {
    setBusy(true)
    try {
      await driverLookup(email.trim())
      setCode('')
      toast.success(t('dr.codeSent'))
    } catch (ex) { toast.error(ex?.response?.data?.detail || 'No se pudo solicitar otro código.') }
    finally { setBusy(false) }
  }

  const handlePasswordSubmit = async () => {
    if (!password) return toast.warning(t('dr.introPass'))
    setBusy(true)
    try {
      /* Slug opcional: el acceso por correo ya resuelve la empresa en backend. */
      const r = await api.post('/auth/driver-login',
        { email: email.trim(), password, slug: currentSlug() })
      if (r.data?.access_token) localStorage.setItem(DRIVER_TOKEN_KEY, r.data.access_token)
      onLogin({
        ...currentDriver,
        name: r.data?.name || currentDriver.name,
        center: r.data?.center || currentDriver.center,
      })
      toast.success(`${t('dr.bienvenido')}, ${r.data?.name || currentDriver.name}`)
    } catch (ex) {
      const msg = ex?.response?.data?.detail || t('dr.ePass')
      toast.error(msg)
    }
    setBusy(false)
  }

  const displayCenter = urlCenter

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-dark-950 px-4"
         style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {caducada && (
          <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3">
            <p className="text-[13.5px] font-semibold text-amber-200">{t('dr.caducada')}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-200/70">{t('dr.caducada.sub')}</p>
          </div>
        )}
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-xl shadow-brand-500/30">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-dark-50">{t('dr.portal')}</h1>
          <p className="mt-1 text-sm text-dark-400">{orgName || MARCA.nombre}</p>
          {displayCenter && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-400">
              {t('dr.estacion')} {displayCenter}
            </span>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-dark-800 bg-dark-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-sm">

          {/* Paso 1: email */}
          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="label">{t('dr.email')}</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                  placeholder={t('dr.emailPh')}
                  autoFocus
                  autoComplete="email"
                />
                <p className="mt-1.5 text-xs leading-relaxed text-dark-500">{t('dr.recoveryHint')}</p>
              </div>

              <button
                onClick={handleEmailSubmit}
                disabled={busy || !email}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base"
              >
                {busy
                  ? <><Loader2 size={16} className="animate-spin" /> {t('dr.verificando')}</>
                  : <><LogIn size={16} /> {t('dr.continuar')}</>}
              </button>
            </div>
          )}

          {/* Paso 2: contraseña */}
          {step === 'code' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-dark-800/60 px-4 py-3 text-sm text-dark-200">
                <p>{t('dr.codeInfo')}</p>
                <p className="mt-2 text-xs text-dark-400">Cuenta consultada: <strong className="break-all text-dark-200">{email}</strong></p>
              </div>
              <div>
                <label className="label" htmlFor="driver-code">{t('dr.codeLabel')}</label>
                <input id="driver-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  className="input text-center text-xl tracking-[0.35em]" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                  autoComplete="one-time-code" autoFocus />
              </div>
              <button onClick={handleCodeSubmit} disabled={busy || code.length !== 6}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base">
                {busy ? <><Loader2 size={16} className="animate-spin" /> {t('dr.verificando')}</> : <><LogIn size={16} /> Entrar</>}
              </button>
              <button type="button" onClick={() => { setStep('password'); setPassword('') }}
                className="flex w-full items-center justify-center text-xs text-dark-400 hover:text-dark-200">
                {t('dr.usePassword')}
              </button>
              <button type="button" disabled={busy} onClick={handleResend}
                className="flex w-full items-center justify-center text-xs text-dark-500 hover:text-dark-300">
                {t('dr.codeResend')}
              </button>
              <button type="button" onClick={() => { setStep('email'); setCode(''); setPassword(''); setCurrentDriver(null) }}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-dark-500 hover:text-dark-300">
                <ArrowLeft size={12} /> Cambiar correo
              </button>
            </div>
          )}

          {/* Paso 2: contraseña */}
          {step === 'password' && (
            <div className="space-y-4">
              {/* Info del conductor */}
              <div className="rounded-xl bg-dark-800/60 px-4 py-3 flex items-center gap-3">
                <Lock size={16} className="text-brand-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-dark-100">{t('dr.passwordAccess')}</div>
                  <div className="text-xs text-dark-500">{email}</div>
                </div>
              </div>

              <div>
                <label className="label">{t('dr.password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                    placeholder={t('dr.passwordPh')}
                    autoFocus
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handlePasswordSubmit}
                disabled={busy || !password}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base"
              >
                {busy
                  ? <><Loader2 size={16} className="animate-spin" /> {t('dr.verificando')}</>
                  : <><LogIn size={16} /> {t('dr.acceder')}</>}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setPassword(''); setCurrentDriver(null) }}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-dark-500 hover:text-dark-300 transition-colors"
              >
                <ArrowLeft size={12} /> {t('dr.cambiarEmail')}
              </button>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-dark-800 bg-dark-950/60 p-3 text-center text-xs text-dark-500">
            {t('dr.soloRegistrados')}
            <br />{t('dr.problemas')}
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/login" className="text-xs text-dark-500 hover:text-dark-400 transition">
            {t('dr.eresAdmin')}
          </a>
        </div>
      </div>
    </div>
  )
}
