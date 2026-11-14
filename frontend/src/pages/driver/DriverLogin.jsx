import { useRef, useState } from 'react'
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { driverLookup, DRIVER_TOKEN_KEY, ENLACE_CADUCADO, currentSlug } from '../../services/api'
import { api } from '../../services/api'
import { useToast } from '../../lib/toast'
import { useT } from '../../i18n'
import { BTN_PRIMARIO } from '../portadaComun'
import {
  MarcoEntrada, TITULO, TEXTO, NOTA, ETIQUETA, CAMPO, CAMPO_CODIGO, ENLACE, FUERTE, ERROR, AVISO, AVISO_TITULO, AVISO_TEXTO,
  ABAJO, ENLACE_NOTA,
} from '../entradaComun'

/* LA ENTRADA DEL CONDUCTOR CON SU CORREO (14-11-2026; tercera tanda, A9).
   UN formulario: el correo, la contraseña (si la tiene) y «Entrar». Con la contraseña escrita entra con ella; con la
   contraseña en blanco le mandamos un código de seis cifras al correo y se lo pedimos. Así:
   · quien entra cada día con correo + contraseña + Intro no nota nada (y el gestor de contraseñas del móvil sigue
     rellenando los dos campos: `username` y `current-password`, dentro de un <form>);
   · quien no tiene contraseña no se topa con un «correo o contraseña incorrectos»: lo dice la línea de debajo.
   La versión anterior adivinaba con qué entraba cada teléfono (`fds_dr_metodo`) y, el primer día, a quien entraba con
   contraseña le mandaba un código que no había pedido. Ya no se adivina nada.
   Quien entró con su enlace personal y se quedó sin sesión (el dueño renovó el enlace, o caducó) no tiene por qué tener
   correo: a él se le dice que pida el enlace otra vez, y el formulario queda como salida secundaria.
   Quien entra con código no tiene que elegir contraseña (el servidor contesta `configurar_cuenta: false`); quien entra
   con la contraseña inicial de la empresa, sí, como siempre. Con la identidad nueva: papel, una acción principal. */

const leerMarca = (almacen, clave) => { try { return almacen.getItem(clave) === '1' } catch { return false } }

export default function DriverLogin({ onLogin }) {
  const toast = useToast()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'code'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const claveRef = useRef(null)

  const urlCenter = (new URLSearchParams(window.location.search).get('c') || '').toUpperCase()

  /* Si ha llegado aquí porque se le caducó la sesión, hay que decírselo: sin esto aparece de golpe en la pantalla de
     entrada sin saber por qué, y lo normal es pensar que la aplicación se ha roto. */
  const [caducada] = useState(() => {
    const hay = leerMarca(sessionStorage, 'driver_sesion_caducada')
    try { sessionStorage.removeItem('driver_sesion_caducada') } catch { /* modo privado */ }
    return hay
  })
  // La del enlace se queda en el teléfono hasta que vuelve a entrar: recargar no le devuelve a «entra con tu correo».
  const [conEnlace] = useState(() => leerMarca(localStorage, ENLACE_CADUCADO))
  const [verFormulario, setVerFormulario] = useState(!conEnlace)

  const entrado = (datos) => {
    try { localStorage.removeItem(ENLACE_CADUCADO); localStorage.removeItem('fds_dr_metodo') } catch { /* modo privado */ }
    onLogin(datos)
  }

  const pedirCodigo = async () => {
    setBusy(true)
    try {
      await driverLookup(email.trim())
      setCode('')
      setStep('code')
    } catch (ex) {
      const msg = ex?.response?.data?.detail
      setError(typeof msg === 'string' && msg ? msg : t('dr.eLogin'))
    }
    setBusy(false)
  }

  const entrarConClave = async (clave) => {
    setBusy(true)
    try {
      /* Slug opcional: el acceso por correo ya resuelve la empresa en el servidor. */
      const r = await api.post('/auth/driver-login', { email: email.trim(), password: clave, slug: currentSlug() })
      if (r.data?.access_token) localStorage.setItem(DRIVER_TOKEN_KEY, r.data.access_token)
      /* El `id` también (11-11-2026): sin él la inspección mandaba driver_id "undefined". */
      entrado({
        email: email.trim(),
        id: r.data?.id,
        name: r.data?.name,
        center: r.data?.center,
        // Con la contraseña inicial de la empresa o una temporal, sigue teniendo que elegir la suya.
        configurar_cuenta: !!r.data?.configurar_cuenta,
      })
      toast.success(`${t('dr.bienvenido')}, ${r.data?.name || ''}`)
    } catch (ex) {
      // El error de siempre (el servidor no da pistas) y, debajo del campo, la misma línea de siempre.
      const msg = ex?.response?.data?.detail
      setError(typeof msg === 'string' && msg ? msg : t('dr.ePass'))
    }
    setBusy(false)
  }

  /* INTRO EN EL CORREO, CON LA CONTRASEÑA VACÍA, NO MANDA NADA (14-11-2026): lleva el cursor a la contraseña. Era la
     costumbre de siempre (correo, Intro, contraseña) y mandaba un código por correo que nadie había pedido. Intro otra
     vez con la contraseña vacía, o «Entrar», sí lo manda; con la contraseña escrita (a mano o el gestor de contraseñas),
     Intro entra como siempre. La contraseña se lee también del campo: la que pone el gestor puede no haber avisado aún. */
  const claveEscrita = () => password || claveRef.current?.value || ''
  const alIntroEnElCorreo = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent?.isComposing || claveEscrita() || !email.trim()) return
    e.preventDefault()
    claveRef.current?.focus()
  }

  // Intro en la contraseña (o con ella escrita, en el correo) hace lo mismo que el botón (es un <form>).
  const enviar = (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!email.trim()) { setError(t('dr.introEmail')); return }
    const clave = claveEscrita()
    if (clave) entrarConClave(clave)
    else pedirCodigo()
  }

  const handleCodeSubmit = async (e) => {
    e?.preventDefault()
    if (busy) return
    if (!/^\d{6}$/.test(code.trim())) { setError(t('dr.codeSixWarn')); return }
    setBusy(true); setError('')
    try {
      const r = await api.post('/auth/driver-code/verify', { email: email.trim(), code: code.trim() })
      const d = r.data || {}
      localStorage.setItem(DRIVER_TOKEN_KEY, d.access_token)
      // Con código no se obliga a elegir contraseña: la elegirá si quiere, desde su cuenta.
      entrado({ id: d.id, name: d.name, email: email.trim(), center: d.center, configurar_cuenta: false })
      toast.success(`${t('dr.bienvenido')}, ${d.name}`)
    } catch (ex) {
      setError(ex?.response?.status === 429 ? (ex?.response?.data?.detail || t('dr.codeInvalid')) : t('dr.codeInvalid'))
    } finally { setBusy(false) }
  }

  const handleResend = async () => {
    setBusy(true); setError('')
    try {
      await driverLookup(email.trim())
      setCode('')
      toast.success(t('dr.codeSent'))
    } catch (ex) { setError(ex?.response?.data?.detail || t('alta.dr.eReenviar')) }
    finally { setBusy(false) }
  }

  const volverAlFormulario = (conClave) => {
    setStep('form'); setCode(''); setError('')
    if (conClave) setTimeout(() => claveRef.current?.focus(), 0)
  }
  const Girando = <Loader2 size={17} className="animate-spin" aria-hidden="true" />

  return (
    <MarcoEntrada testid="entrada-conductor">
      {!verFormulario ? (
        /* Entró con su enlace y se ha quedado sin sesión: lo suyo es pedir el enlace otra vez. */
        <section className="flex flex-1 flex-col" aria-labelledby="dr-titulo">
          <h1 id="dr-titulo" className={TITULO}>{t('alta.dr.enlaceTitulo')}</h1>
          <p className={`mt-3 ${TEXTO}`} data-testid="dr-enlace-caducado">{t('alta.dr.enlaceTexto')}</p>
          <div className={ABAJO}>
            <button type="button" className={ENLACE} onClick={() => setVerFormulario(true)}>{t('alta.dr.tengoCorreo')}</button>
          </div>
        </section>
      ) : (
        <>
          {caducada && !conEnlace && (
            <div className={`mt-6 ${AVISO}`}>
              <p className={AVISO_TITULO}>{t('dr.caducada')}</p>
              <p className={AVISO_TEXTO}>{t('dr.caducada.sub')}</p>
            </div>
          )}

          <h1 className={TITULO}>{t('dr.portal')}</h1>
          {urlCenter && (
            <p className={`mt-2 ${NOTA}`}>{t('dr.estacion')} <span className={`font-mono ${FUERTE}`}>{urlCenter}</span></p>
          )}

          {step === 'form' && (
            <form className="mt-6" onSubmit={enviar} noValidate>
              <label className={ETIQUETA} htmlFor="dr-correo">{t('dr.email')}</label>
              <input id="dr-correo" name="email" type="email" inputMode="email" className={CAMPO} value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={alIntroEnElCorreo}
                placeholder={t('dr.emailPh')} autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} />

              <label className={`mt-5 ${ETIQUETA}`} htmlFor="dr-clave">{t('dr.password')}</label>
              <div className="relative">
                <input id="dr-clave" ref={claveRef} name="password" type={showPassword ? 'text' : 'password'} className={`${CAMPO} pr-12`}
                  value={password} onChange={(e) => { setPassword(e.target.value); setError('') }}
                  autoComplete="current-password" aria-describedby="dr-clave-pista" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  aria-label={t(showPassword ? 'alta.dr.ocultar' : 'alta.dr.mostrar')}
                  className={`absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center ${ENLACE}`}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              <p id="dr-clave-pista" className={`mt-2 ${NOTA}`}>{t('alta.dr.pista')}</p>

              {error && <p role="alert" className={`mt-4 ${ERROR}`} data-testid="dr-error">{error}</p>}

              <button type="submit" disabled={busy} aria-busy={busy || undefined} className={`mt-6 ${BTN_PRIMARIO} w-full`}>
                {busy ? <>{Girando} {t('dr.verificando')}</> : t('alta.dr.entrar')}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form className="mt-6" onSubmit={handleCodeSubmit} noValidate>
              <p className={TEXTO}>{t('dr.codeInfo')}</p>
              <p className={`mt-2 ${NOTA}`}>{t('alta.dr.cuenta')} <strong className={`break-all ${FUERTE}`}>{email}</strong></p>
              <label className={`mt-6 ${ETIQUETA}`} htmlFor="driver-code">{t('dr.codeLabel')}</label>
              <input id="driver-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                className={`${CAMPO} ${CAMPO_CODIGO}`} value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                autoComplete="one-time-code" autoFocus />
              {error && <p role="alert" className={`mt-4 ${ERROR}`} data-testid="dr-error">{error}</p>}
              <button type="submit" disabled={busy || code.length !== 6} aria-busy={busy || undefined} className={`mt-6 ${BTN_PRIMARIO} w-full`}>
                {busy ? <>{Girando} {t('dr.verificando')}</> : t('alta.dr.entrar')}
              </button>
              <div className="mt-3 flex flex-col items-center">
                <button type="button" disabled={busy} onClick={handleResend} className={ENLACE}>{t('dr.codeResend')}</button>
                <button type="button" onClick={() => volverAlFormulario(true)} className={ENLACE}>{t('dr.usePassword')}</button>
                <button type="button" onClick={() => volverAlFormulario(false)} className={ENLACE}><ArrowLeft size={15} aria-hidden="true" /> {t('alta.dr.cambiarCorreo')}</button>
              </div>
            </form>
          )}

          {/* Debajo, en voz baja: nada aquí compite con «Entrar» (cuarta tanda, C4). La entrada de la oficina, un enlace
              de texto normal, sin flecha ni negrita. */}
          <div className={`mt-10 border-t border-[color:var(--ld-border)] pt-4 ${NOTA}`}>
            <p>{t('dr.soloRegistrados')} {t('dr.problemas')}</p>
            <a href="/login" className={ENLACE_NOTA}>{t('dr.eresAdmin')}</a>
          </div>
        </>
      )}
    </MarcoEntrada>
  )
}
