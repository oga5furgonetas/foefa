import { useState } from 'react'
import { Zap, Truck, Users, Building2, Loader2, ArrowRight } from 'lucide-react'
import { API_BASE, DRIVER_TOKEN_KEY } from '../services/api'
import { MARCA } from '../marca'

/* ── LA PRIMERA PANTALLA DE LA APP (04-10-2026) ──────────────────────────────
   Quien se baja la app de Play Store es, casi siempre, una persona que
   reparte. Antes la app le abría la pantalla de «entrar» pensada para la
   oficina de una empresa (Dani: «en Android es básicamente para usuarios
   propios… que pueda crear ya su propia ruta»). Aquí lo primero es decir qué
   eres, y el que reparte por su cuenta se crea la cuenta en tres campos. */

const OPCIONES = [
  { key: 'yo', icono: Truck, color: '#eab308', titulo: 'Repartir yo mismo',
    sub: 'Tengo mi furgoneta y mis paquetes. Quiero escanearlos, ordenar la ruta y entregar.',
    a: '/registro?sector=autonomo&plan=autonomo' },
  { key: 'empresa-rep', icono: Users, color: '#22c55e', titulo: 'Soy repartidor de una empresa',
    sub: 'Mi empresa ya usa Flota y me ha dado acceso. Entro con mi correo.',
    a: '/conductor?vista=ruta' },
  { key: 'empresa', icono: Building2, color: '#0ea5e9', titulo: 'Gestiono una empresa',
    sub: 'Supermercado, distribución, mensajería, paquetería… El panel de la oficina.',
    a: '/panel/login' },
]

export default function Empezar() {
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')

  // «Probar sin cuenta»: una ruta vacía y propia, que se borra al día siguiente.
  async function probar() {
    setOcupado(true); setErr('')
    try {
      const r = await fetch(`${API_BASE}/auth/demo-reparto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rol: 'autonomo' }),
      })
      const j = await r.json()
      if (!r.ok || !j.access_token) throw new Error(j.detail || 'No se pudo abrir la prueba')
      localStorage.setItem(DRIVER_TOKEN_KEY, j.access_token)
      localStorage.setItem('flota_driver', JSON.stringify(j.driver))
      window.location.href = '/conductor?vista=ruta'
    } catch (e) { setErr(e.message || 'Sin conexión'); setOcupado(false) }
  }

  return (
    <div className="flex min-h-screen flex-col bg-dark-950 px-5 py-8 text-dark-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600"><Zap size={18} className="text-white" /></div>
          <b className="text-[17px] text-dark-50">{MARCA.nombre}</b>
        </div>
        <h1 className="font-display text-[30px] font-extrabold leading-tight text-dark-50">¿Qué vas a hacer?</h1>
        <p className="mt-2 text-[14px] text-dark-400">Elige y te llevamos a lo tuyo. Tarda un minuto.</p>

        <div className="mt-6 flex flex-col gap-3">
          {OPCIONES.map((o) => (
            <a key={o.key} href={o.a}
              className="flex items-center gap-3.5 rounded-2xl border border-dark-700 bg-dark-900 p-4 active:scale-[.99]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${o.color}22` }}>
                <o.icono size={22} style={{ color: o.color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-dark-50">{o.titulo}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-dark-400">{o.sub}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-dark-500" />
            </a>
          ))}
        </div>

        <button onClick={probar} disabled={ocupado}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-dark-600 py-3.5 text-[14px] font-semibold text-dark-200 disabled:opacity-50">
          {ocupado && <Loader2 size={15} className="animate-spin" />} Probar sin cuenta
        </button>
        <p className="mt-1.5 text-center text-[11.5px] text-dark-500">Una ruta de prueba, solo tuya, que se borra mañana.</p>
        {err && <p className="mt-3 text-center text-[13px] text-red-300">{err}</p>}

        <p className="mt-auto pt-8 text-center text-[13px] text-dark-400">
          ¿Ya tienes cuenta? <a href="/panel/login" className="font-semibold text-brand-300">Entrar</a>
        </p>
      </div>
    </div>
  )
}
