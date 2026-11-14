import { useState } from 'react'
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { driverLookup, DRIVER_TOKEN_KEY, currentSlug } from '../../services/api'
import { api } from '../../services/api'
import { useToast } from '../../lib/toast'
import { useT } from '../../i18n'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../portadaComun'
import {
  MarcoEntrada, TITULO, TEXTO, NOTA, ETIQUETA, CAMPO, CAMPO_CODIGO, ENLACE, FUERTE, AVISO, AVISO_TITULO, AVISO_TEXTO,
} from '../entradaComun'

/* LA ENTRADA DEL CONDUCTOR CON SU CORREO (14-11-2026, CONTRATO-ALTA §2).
   El botón principal es «Recibir un código»: casi nadie tiene contraseña el primer día, y el «Continuar» de antes le
   pedía una que no existía («Email o contraseña incorrectos»). La contraseña queda como segunda opción. Quien entra
   cada día con la suya no pierde nada: este teléfono recuerda con qué entró la última vez (`fds_dr_metodo`) y, si fue
   con contraseña, la pone delante. Quien entra con código no tiene que elegir contraseña (el servidor contesta
   `configurar_cuenta: false`); quien entra con la contraseña inicial de la empresa, sí, como siempre.
   Con la identidad nueva: papel, una acción principal, sin brillos detrás. */

const METODO = 'fds_dr_metodo'
const leerMetodo = () => { try { return localStorage.getItem(METODO) === 'clave' ? 'clave' : 'codigo' } catch { return 'codigo' } }
const guardarMetodo = (m) => { try { localStorage.setItem(METODO, m) } catch { /* modo privado */ } }


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
  const [metodo] = useState(leerMetodo)

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

  const pedirCodigo = async () => {
    if (!email.trim()) return toast.warning(t('dr.introEmail'))
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

  const irAContrasena = () => {
    if (!email.trim()) return toast.warning(t('dr.introEmail'))
    setCurrentDriver({ email: email.trim() })
    setPassword('')
    setStep('password')
  }

  const handleCodeSubmit = async () => {
    if (!/^\d{6}$/.test(code.trim())) return toast.warning(t('dr.codeSixWarn'))
    setBusy(true)
    try {
      const r = await api.post('/auth/driver-code/verify', { email: email.trim(), code: code.trim() })
      const d = r.data || {}
      localStorage.setItem(DRIVER_TOKEN_KEY, d.access_token)
      guardarMetodo('codigo')
      // Con código no se obliga a elegir contraseña (CONTRATO-ALTA §2): la elegirá si quiere, desde su cuenta.
      onLogin({ id: d.id, name: d.name, email: email.trim(), center: d.center, configurar_cuenta: false })
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
    } catch (ex) { toast.error(ex?.response?.data?.detail || t('alta.dr.eReenviar')) }
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
      guardarMetodo('clave')
      /* El `id` también (11-11-2026): sin él la inspección mandaba driver_id "undefined". */
      onLogin({
        ...currentDriver,
        id: r.data?.id || currentDriver.id,
        name: r.data?.name || currentDriver.name,
        center: r.data?.center || currentDriver.center,
        // Con la contraseña inicial de la empresa o una temporal, sigue teniendo que elegir la suya.
        configurar_cuenta: !!r.data?.configurar_cuenta,
      })
      toast.success(`${t('dr.bienvenido')}, ${r.data?.name || currentDriver.name}`)
    } catch (ex) {
      const msg = ex?.response?.data?.detail || t('dr.ePass')
      toast.error(msg)
    }
    setBusy(false)
  }

  const volverAlCorreo = () => { setStep('email'); setCode(''); setPassword(''); setCurrentDriver(null) }
  const conClave = metodo === 'clave'
  const principal = conClave ? irAContrasena : pedirCodigo
  const Girando = <Loader2 size={17} className="animate-spin" aria-hidden="true" />

  return (
    <MarcoEntrada>
      {caducada && (
        <div className={`mt-6 ${AVISO}`}>
          <p className={AVISO_TITULO}>{t('dr.caducada')}</p>
          <p className={AVISO_TEXTO}>{t('dr.caducada.sub')}</p>
        </div>
      )}

      <h1 className={TITULO}>{t('dr.portal')}</h1>
      {urlCenter && (
        <p className={`mt-2 ${NOTA}`}>{t('dr.estacion')} <span className={`font-mono ${FUERTE}`}>{urlCenter}</span></p>
      )}

      {/* Paso 1: el correo */}
      {step === 'email' && (
        <div className="mt-6">
          <label className={ETIQUETA} htmlFor="dr-correo">{t('dr.email')}</label>
          <input id="dr-correo" type="email" className={CAMPO} value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && principal()}
            placeholder={t('dr.emailPh')} autoFocus autoComplete="email" />
          <p className={`mt-2 ${NOTA}`}>{t(conClave ? 'alta.dr.hintClave' : 'alta.dr.hint')}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={principal} disabled={busy || !email} className={`${BTN_PRIMARIO} w-full`}>
              {busy ? <>{Girando} {t('dr.verificando')}</> : t(conClave ? 'alta.dr.conClave' : 'alta.dr.codigo')}
            </button>
            <button type="button" onClick={conClave ? pedirCodigo : irAContrasena} disabled={busy || !email} className={`${BTN_SECUNDARIO} w-full`}>
              {t(conClave ? 'alta.dr.codigo' : 'alta.dr.conClave')}
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: el código que le ha llegado */}
      {step === 'code' && (
        <div className="mt-6">
          <p className={TEXTO}>{t('dr.codeInfo')}</p>
          <p className={`mt-2 ${NOTA}`}>{t('alta.dr.cuenta')} <strong className={`break-all ${FUERTE}`}>{email}</strong></p>
          <label className={`mt-6 ${ETIQUETA}`} htmlFor="driver-code">{t('dr.codeLabel')}</label>
          <input id="driver-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
            className={`${CAMPO} ${CAMPO_CODIGO}`} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
            autoComplete="one-time-code" autoFocus />
          <button type="button" onClick={handleCodeSubmit} disabled={busy || code.length !== 6} className={`mt-6 ${BTN_PRIMARIO} w-full`}>
            {busy ? <>{Girando} {t('dr.verificando')}</> : t('alta.dr.entrar')}
          </button>
          <div className="mt-3 flex flex-col items-center">
            <button type="button" disabled={busy} onClick={handleResend} className={ENLACE}>{t('dr.codeResend')}</button>
            <button type="button" onClick={() => { setStep('password'); setPassword('') }} className={ENLACE}>{t('dr.usePassword')}</button>
            <button type="button" onClick={volverAlCorreo} className={ENLACE}><ArrowLeft size={15} aria-hidden="true" /> {t('alta.dr.cambiarCorreo')}</button>
          </div>
        </div>
      )}

      {/* Paso 2: la contraseña */}
      {step === 'password' && (
        <div className="mt-6">
          <p className={NOTA}>{t('dr.passwordAccess')} · <span className={`break-all ${FUERTE}`}>{email}</span></p>
          <label className={`mt-4 ${ETIQUETA}`} htmlFor="dr-clave">{t('dr.password')}</label>
          <div className="relative">
            <input id="dr-clave" type={showPassword ? 'text' : 'password'} className={`${CAMPO} pr-12`} value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder={t('dr.passwordPh')} autoFocus autoComplete="current-password" />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              aria-label={t(showPassword ? 'alta.dr.ocultar' : 'alta.dr.mostrar')}
              className={`absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center ${ENLACE}`}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button type="button" onClick={handlePasswordSubmit} disabled={busy || !password} className={`mt-6 ${BTN_PRIMARIO} w-full`}>
            {busy ? <>{Girando} {t('dr.verificando')}</> : t('dr.acceder')}
          </button>
          <div className="mt-3 flex flex-col items-center">
            <button type="button" disabled={busy} onClick={pedirCodigo} className={ENLACE}>{t('alta.dr.codigoMejor')}</button>
            <button type="button" onClick={volverAlCorreo} className={ENLACE}><ArrowLeft size={15} aria-hidden="true" /> {t('dr.cambiarEmail')}</button>
          </div>
        </div>
      )}

      <p className={`mt-10 border-t border-[color:var(--ld-border)] pt-4 ${NOTA}`}>
        {t('dr.soloRegistrados')} {t('dr.problemas')}
      </p>
      <a href="/login" className={ENLACE}>{t('dr.eresAdmin')}</a>
    </MarcoEntrada>
  )
}

