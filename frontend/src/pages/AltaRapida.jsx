import { useState } from 'react'
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { API_BASE } from '../services/api'
import { saveSession } from '../panel/auth'
import { tx, useIdioma, txError } from '../lib/idioma'
import { medirAccion } from '../lib/analitica'
import { evento } from '../lib/metaPixel'
import { leerRef } from '../lib/referido'
import { regionDelMovil } from '../lib/region'
import { enAppPlay } from '../lib/enApp'

/* EL ALTA, DENTRO DE LA PORTADA (05-10-2026). Medido: 541 visitas de TikTok en 72 h, 1 clic en
   «Crear cuenta» y 0 altas: el camino «botón → otra pantalla → formulario» perdía a casi todos en el
   navegador interno de TikTok. Aquí el alta se hace sin salir: nombre, correo y contraseña, y a la
   app. Mismos datos, mismo aviso legal y mismo endpoint que /registro. */

const slugify = (s) => (s || '').toLowerCase().trim()
  .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
  .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)

const conEnlaces = (texto, hrefs) => texto.split(/(\[[^\]]+\])/).map((trozo, i) => {
  const m = trozo.match(/^\[(.+)\]$/)
  if (!m) return trozo
  return <a key={i} href={hrefs.shift()} target="_blank" rel="noreferrer" className="text-brand-300 underline">{m[1]}</a>
})

export default function AltaRapida({ dias = 7 }) {
  useIdioma()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [ver, setVer] = useState(false)
  const [acepto, setAcepto] = useState(false)
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [empezado, setEmpezado] = useState(false)
  const inicio = () => { if (!empezado) { setEmpezado(true); medirAccion('rep_form_inicio') } }

  async function enviar(e) {
    e.preventDefault()
    setErr('')
    if (!nombre.trim()) return setErr(tx('Dinos tu nombre.'))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr(tx('Introduce un email válido.'))
    if (pass.length < 8) return setErr(tx('La contraseña debe tener al menos 8 caracteres.'))
    if (!acepto) return setErr(tx('Debes aceptar los Términos y la Política de Privacidad para continuar.'))
    setOcupado(true)
    medirAccion('rep_alta')
    evento('Lead', { content_name: 'alta_en_portada' })
    try {
      const correo = email.trim().toLowerCase()
      const r = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: nombre.trim(), username: correo, password: pass,
          slug: `${slugify(nombre) || 'reparto'}-${Math.random().toString(36).slice(2, 6)}`,
          center: '', email: correo, plan: 'autonomo', sector: 'autonomo',
          ...(leerRef() ? { ref: leerRef() } : {}),
          desde_app: enAppPlay(), ...regionDelMovil(),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.access_token) {
        setErr(txError({ detail: j.detail }, 'No se pudo crear la cuenta. Prueba con otro correo.'))
        setOcupado(false); return
      }
      saveSession(j)
      try { localStorage.setItem('flota_plan', 'autonomo'); localStorage.setItem('flota_billing', 'monthly') } catch { /* nada */ }
      medirAccion('registro_ok')
      evento('CompleteRegistration', { content_name: 'autonomo', status: true })
      window.location.href = '/ruta'
    } catch {
      setErr(tx('Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.'))
      setOcupado(false)
    }
  }

  const campo = 'w-full rounded-xl border border-dark-700 bg-dark-900 px-3.5 py-3 text-[16px] text-dark-50 placeholder:text-dark-500'
  return (
    <form onSubmit={enviar} noValidate className="mt-4 space-y-2.5 rounded-3xl border border-brand-400/30 bg-brand-500/[.06] p-4" aria-label={tx('Crear mi cuenta gratis')}>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} onFocus={inicio} autoComplete="name" placeholder={tx('Tu nombre')}
        aria-label={tx('Tu nombre')} className={campo} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} onFocus={inicio} type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
        placeholder={tx('Tu correo')} aria-label={tx('Tu correo')} className={campo} />
      <div className="relative">
        <input value={pass} onChange={(e) => setPass(e.target.value)} onFocus={inicio} type={ver ? 'text' : 'password'} autoComplete="new-password"
          placeholder={tx('Contraseña')} aria-label={tx('Contraseña')} className={`${campo} pr-12`} />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? tx('Ocultar contraseña') : tx('Mostrar contraseña')}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-dark-400">{ver ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      <label className="flex cursor-pointer items-start gap-2 pt-1 text-[11.5px] leading-snug text-dark-400">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5" />
        <span>
          {conEnlaces(tx('Acepto los [Términos], el [Acuerdo de Encargo del Tratamiento] y la [Política de Privacidad].'), ['/terminos', '/encargo', '/privacidad'])}
          {' '}{tx('Prueba gratuita de {n} días — sin cobro durante la prueba. Al finalizar se cobra el plan {plan} ({precio} €/mes) salvo cancelación.', { n: dias, plan: tx('Repartidor'), precio: '9,99' })}
        </span>
      </label>
      {err && <p role="alert" className="text-[13px] text-red-300">{err}</p>}
      <button type="submit" disabled={ocupado}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 py-4 text-[17px] font-extrabold text-[#04121a] shadow-[0_12px_30px_-10px_rgba(20,231,216,.6)] active:scale-[.99] disabled:opacity-60">
        {ocupado ? <Loader2 size={19} className="animate-spin" /> : null} {tx('Crear mi cuenta gratis')} {!ocupado && <ArrowRight size={19} />}
      </button>
    </form>
  )
}
