import { useState } from 'react'
import { ArrowRight, Camera, CheckCircle2, Gift, Loader2, MapPinned, Navigation, PackageCheck, Route, ShieldCheck, Smartphone } from 'lucide-react'
import { fechaRefPromo, eurosRef, BONO_CENT } from '../lib/precios'
import { useInvitacion } from '../lib/referido'
import { tx, useIdioma, locale } from '../lib/idioma'
import { MARCA } from '../marca'
import { medirAccion } from '../lib/analitica'
import { abrirDemoReparto } from '../lib/demoReparto'

/* /invita EN EL IDIOMA DEL MÓVIL (02-11-2026): el WhatsApp de la invitación llega traducido y la página a la que lleva
   estaba en español fijo, con la marca vieja y con el bono de antes (10 €; desde el 29-10 es BONO_CENT). Todo pasa por
   tx() (textosRutaB.js) y la marca sale de src/marca.js. PASOS en mayúsculas: así check-textos-ruta lee la lista y
   exige sus traducciones. */
const PASOS = [
  [Camera, 'Escanea o fotografía las etiquetas', 'La app intenta leer las direcciones y te ayuda a cargar los paquetes.'],
  [MapPinned, 'Ordena la ruta', 'Coloca las paradas en un orden práctico y consúltalas en el mapa.'],
  [Navigation, 'Sigue la ruta y registra entregas', 'Navega desde el móvil y marca cada parada al terminar.'],
]

/* La frase del premio, entera por tx(): lo que va [entre corchetes] sale en negrita y {euros}, el importe, grande;
   cada idioma los pone donde le toca. */
const resaltar = (texto, euros) => texto.split(/(\[[^\]]+\]|\{euros\})/).map((trozo, i) => {
  if (trozo === '{euros}') return <strong key={i} className="text-[20px] text-lime-200">{euros}</strong>
  const m = trozo.match(/^\[(.+)\]$/)
  return m ? <b key={i}>{m[1]}</b> : trozo
})

export default function Invita() {
  useIdioma()
  const invitacion = useInvitacion()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const code = new URLSearchParams(window.location.search).get('ref') || ''
  const destino = `/repartidores${code ? `?ref=${encodeURIComponent(code)}&utm_source=referido&utm_medium=landing&utm_campaign=driver_referral` : '?utm_source=referido&utm_medium=landing&utm_campaign=driver_referral'}`
  const recompensa = invitacion?.por_invitado
  async function probar() {
    medirAccion('invita_demo')
    setOcupado(true); setError('')
    try { await abrirDemoReparto() }
    catch (e) { setError(e?.message || tx('No se pudo abrir la demo. Comprueba tu conexión.')); setOcupado(false) }
  }
  return <main className="min-h-screen bg-[#080e12] px-4 py-7 text-white sm:py-12">
    <div className="mx-auto max-w-xl">
      <a href="/repartidores" className="text-sm font-bold tracking-wide text-emerald-300">{MARCA.nombre} <span className="font-normal text-dark-400">· {tx('rutas de reparto')}</span></a>
      <section className="relative mt-5 overflow-hidden rounded-[28px] border border-emerald-300/30 bg-gradient-to-br from-emerald-600 via-emerald-800 to-[#09130f] p-5 shadow-2xl shadow-emerald-950/40 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-10 h-48 w-48 rounded-full bg-lime-300/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-lime-100"><Gift size={14} /> {tx('Invitación de un repartidor')}</span>
          <h1 className="mt-5 text-[34px] font-black leading-[1.02] tracking-tight sm:text-[46px]">{tx('¿Tienes un colega que reparte sin una app para organizarse?')}</h1>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-emerald-50">{tx('Enséñale {marca}: puede probar cómo escanear paquetes, ordenar sus paradas y seguir la ruta desde el móvil.', { marca: MARCA.nombre })}</p>
          {recompensa ? <div className="mt-5 flex items-center gap-3 rounded-2xl border border-lime-200/30 bg-lime-200/10 p-3.5">
            <div className="rounded-xl bg-lime-300 p-2.5 text-emerald-950"><Gift size={22} /></div>
            <p className="text-[13px] leading-snug text-white">{resaltar(invitacion?.promo_hasta
              ? tx('Si se registra con este enlace y completa [20 entregas reales a direcciones distintas en al menos 2 días] durante sus primeros 30 días, quien te invitó gana {euros} (promoción para quien se registre hasta el {fecha}). Y tú, [{bono} de bienvenida] con esas mismas 20 entregas.', { fecha: fechaRefPromo(locale(), invitacion.promo_hasta), bono: eurosRef(BONO_CENT, locale()) })
              : tx('Si se registra con este enlace y completa [20 entregas reales a direcciones distintas en al menos 2 días] durante sus primeros 30 días, quien te invitó gana {euros}.'),
            eurosRef(recompensa, locale()))}</p>
          </div> : code ? <p className="mt-5 rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-emerald-50">{tx('Estamos comprobando el enlace de invitación…')}</p> : null}
          <a href={destino} onClick={() => medirAccion('invita_alta')} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3.5 text-[16px] font-extrabold text-emerald-950 shadow-lg shadow-black/25 active:scale-[.99]">
            {tx('Probar {marca} gratis', { marca: MARCA.nombre })} <ArrowRight size={19} />
          </a>
          <p className="mt-2 text-center text-[12px] text-emerald-100">{tx('Sin tarjeta · primero puedes ver cómo funciona')}</p>
          <button onClick={probar} disabled={ocupado} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/5 px-4 py-3 text-[14px] font-bold text-white disabled:opacity-60">
            {ocupado ? <Loader2 size={17} className="animate-spin" /> : <Route size={17} />} {tx('Ver demo con una ruta de ejemplo')}
          </button>
          {error && <p role="alert" className="mt-2 text-center text-sm text-red-200">{error}</p>}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-dark-800 bg-dark-900/70 p-5 sm:p-6">
        <h2 className="text-xl font-extrabold">{tx('Una ayuda práctica para el día de reparto')}</h2>
        <div className="mt-4 space-y-4">{PASOS.map(([Icon, title, text], i) => <div key={title} className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Icon size={19} /></div>
          <div><p className="font-bold text-dark-100">{i + 1}. {tx(title)}</p><p className="mt-0.5 text-[13px] leading-relaxed text-dark-400">{tx(text)}</p></div>
        </div>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-[12px] text-dark-300">
          <p className="flex items-center gap-2 rounded-xl bg-dark-950/70 p-3"><Smartphone size={16} className="shrink-0 text-emerald-300" /> {tx('Funciona desde el móvil')}</p>
          <p className="flex items-center gap-2 rounded-xl bg-dark-950/70 p-3"><PackageCheck size={16} className="shrink-0 text-emerald-300" /> {tx('No depende de una agencia')}</p>
          <p className="flex items-center gap-2 rounded-xl bg-dark-950/70 p-3"><CheckCircle2 size={16} className="shrink-0 text-emerald-300" /> {tx('Prueba una ruta de ejemplo')}</p>
          <p className="flex items-center gap-2 rounded-xl bg-dark-950/70 p-3"><ShieldCheck size={16} className="shrink-0 text-emerald-300" /> {tx('Tú añades tus paquetes')}</p>
        </div>
      </section>
      <p className="mx-auto mt-5 max-w-md text-center text-[11px] leading-relaxed text-dark-500">{tx('El premio se valida cuando la nueva cuenta completa el uso real indicado. No cuentan demos, cuentas duplicadas ni entregas de ejemplo.')} <a href="/terminos#invita-conductor" className="underline">{tx('Ver condiciones')}</a></p>
    </div>
  </main>
}
