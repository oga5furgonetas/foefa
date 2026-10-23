import { useState } from 'react'
import { Users, Building2, ArrowRight, ChevronDown, Check, Apple } from 'lucide-react'
import { MARCA } from '../marca'
import { tx, useIdioma, IDIOMAS, cambiarIdioma, locale } from '../lib/idioma'
import { medirAccion } from '../lib/analitica'
import { esIphone } from '../lib/instalar'
import { evento } from '../lib/metaPixel'
import { PARADAS_GRATIS, promoGratis, fechaPromo } from '../lib/precios'

/* ── LA PRIMERA PANTALLA DE LA APP (04-10-2026) ──────────────────────────────
   Quien se baja la app de Play Store es, casi siempre, una persona que
   reparte. Antes la app le abría la pantalla de «entrar» pensada para la
   oficina de una empresa (Dani: «en Android es básicamente para usuarios
   propios… que pueda crear ya su propia ruta»). Aquí lo primero es decir qué
   eres, y el que reparte por su cuenta se crea la cuenta en tres campos. */

// Lo de empresas va plegado: quien se baja la app casi siempre reparte por su cuenta.
const OPCIONES_EMPRESA = [
  { key: 'empresa-rep', icono: Users, color: '#22c55e', titulo: 'Soy repartidor de una empresa',
    sub: 'Mi empresa ya usa Flota y me ha dado acceso. Entro con mi correo.',
    a: '/conductor?vista=ruta' },
  { key: 'empresa', icono: Building2, color: '#0ea5e9', titulo: 'Gestiono una empresa',
    sub: 'Supermercado, distribución, mensajería, paquetería… El panel de la oficina.',
    a: '/panel/login' },
]

export default function Empezar() {
  const lang = useIdioma()
  const [empresa, setEmpresa] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-dark-950 px-5 py-8 text-dark-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" width="36" height="36" className="rounded-xl" />
          <b className="text-[17px] text-dark-50">{MARCA.app}</b>
          <select value={lang} onChange={(e) => cambiarIdioma(e.target.value)} aria-label="Idioma / Language"
            className="ml-auto rounded-lg border border-dark-700 bg-dark-900 px-2 py-1.5 text-[13px] text-dark-100">
            {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-brand-300">{tx('Para quien reparte solo')}</p>
        <h1 className="mt-2 font-display text-[32px] font-extrabold leading-[1.05] text-dark-50">{tx('Tu ruta de reparto, ordenada sola.')}</h1>
        <p className="mt-3 text-[15px] leading-snug text-dark-300">{tx('Haz una foto a la etiqueta o escanea el paquete: la app ordena las paradas por tiempo y te lleva con voz hasta cada puerta.')}</p>

        <a href="/registro?sector=autonomo&plan=autonomo" onClick={() => { medirAccion('rep_alta'); evento('Lead', { content_name: 'crear_cuenta_app' }) }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 py-4 text-[17px] font-extrabold text-[#04121a] shadow-[0_12px_30px_-10px_rgba(20,231,216,.6)] active:scale-[.99]">
          {tx('Crear mi cuenta gratis')} <ArrowRight size={18} />
        </a>
        <ul className="mt-3 space-y-1 text-[13px] text-dark-300">
          {promoGratis() ? (<>
            <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Gratis y sin límite hasta el {fecha}', { fecha: fechaPromo(locale()) })}</li>
            <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Después, gratis hasta {n} paradas al día, o sin tope por 9,99 €/mes', { n: PARADAS_GRATIS })}</li>
            <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Sin tarjeta: te registras y empiezas ya')}</li>
          </>) : (<>
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Gratis para siempre hasta {n} paradas al día', { n: PARADAS_GRATIS })}</li>
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Sin tope: 9,99 €/mes o 99 €/año, con 7 días de prueba')}</li>
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {tx('Sin tarjeta: la prueba empieza ya y hoy no pagas nada')}</li>
          </>)}
        </ul>

        <a href="/panel/login"
          className="mt-5 flex w-full items-center justify-center rounded-2xl border border-dark-600 py-3.5 text-[15.5px] font-bold text-dark-100 active:scale-[.99]">
          {tx('Ya tengo cuenta')} · {tx('Entrar')}
        </a>
        {esIphone() && (
          <a href="/iphone" className="mt-3 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-brand-300">
            <Apple size={15} /> {tx('¿iPhone? Así se instala y se usa')}
          </a>
        )}


        <div className="mt-auto pt-8">
          <button onClick={() => setEmpresa((v) => !v)} aria-expanded={empresa}
            className="mx-auto flex items-center gap-1.5 text-[13.5px] font-semibold text-dark-400">
            {tx('Soy de una empresa')} <ChevronDown size={15} className={empresa ? 'rotate-180' : ''} />
          </button>
          {empresa && (
            <div className="mt-3 flex flex-col gap-2.5">
              {OPCIONES_EMPRESA.map((o) => (
                <a key={o.key} href={o.a}
                  className="flex items-center gap-3.5 rounded-2xl border border-dark-700 bg-dark-900 p-3.5 active:scale-[.99]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${o.color}22` }}>
                    <o.icono size={20} style={{ color: o.color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-dark-50">{tx(o.titulo)}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-dark-400">{tx(o.sub)}</span>
                  </span>
                  <ArrowRight size={17} className="shrink-0 text-dark-500" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
