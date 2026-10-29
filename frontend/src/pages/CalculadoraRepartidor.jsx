import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Calculator } from 'lucide-react'
import { medirAccion } from '../lib/analitica'
import { promoGratis } from '../lib/precios'

/* «¿CUÁNTO GANA UN REPARTIDOR AUTÓNOMO?» (11-10-2026)
   Una calculadora que se busca mucho en Google y que no hay que pagar para que llegue gente: el
   repartidor mete sus paradas, lo que le pagan y sus gastos, y ve lo que le queda al mes, al día y
   por hora. Abajo, la app que le ayuda a hacer más paradas en las mismas horas. Todo orientativo:
   antes de impuestos, y sin cifras de mercado inventadas (cada uno pone las suyas). */

const num = (t) => Number(String(t ?? '').replace(',', '.')) || 0
const eur = (n) => `${(Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`

const CAMPOS = [
  ['paradas', 'Paradas entregadas al día', '100', 'numeric'],
  ['pago', 'Te pagan por cada parada (€)', '1,10', 'decimal'],
  ['dias', 'Días que trabajas al mes', '22', 'numeric'],
  ['horas', 'Horas de trabajo al día', '9', 'decimal'],
  ['km', 'Kilómetros al día', '120', 'numeric'],
  ['coste_km', 'Gasto por km: gasóleo y desgaste (€)', '0,15', 'decimal'],
  ['fijos', 'Gastos fijos al mes: cuota de autónomo, seguro, furgoneta, gestoría… (€)', '600', 'numeric'],
]

const PREGUNTAS = [
  ['¿Cómo se cobra en el reparto de paquetería como autónomo?',
    'Depende de la empresa o la agencia: lo más habitual es cobrar por paquete o parada entregada, y hay quien cobra un fijo por día o por ruta. Lo que te quede depende de cuántas paradas haces, de los kilómetros y de tus gastos fijos: por eso esta calculadora te deja poner los tuyos.'],
  ['¿Qué gastos tiene un repartidor autónomo?',
    'Los del día (gasóleo, peajes, desgaste de ruedas y frenos) y los del mes: la cuota de autónomo (depende de tus ingresos), el seguro, la letra o el renting de la furgoneta, el móvil y la gestoría si la tienes. Los impuestos (IRPF e IVA) van aparte y esta calculadora no los descuenta.'],
  ['¿Cómo hacer más paradas en las mismas horas?',
    'Cargando la furgoneta en el orden de la ruta, juntando las paradas del mismo portal, ordenando la ruta por tiempo (no solo por distancia) y avisando antes a quien suele no estar. Una app de rutas hace casi todo eso sola.'],
]

export default function CalculadoraRepartidor() {
  const [v, setV] = useState(() => Object.fromEntries(CAMPOS.map(([k, , ej]) => [k, ej])))
  const medido = useRef(false)
  const r = useMemo(() => {
    const factura = num(v.paradas) * num(v.pago) * num(v.dias)
    const rodar = num(v.km) * num(v.coste_km) * num(v.dias)
    const neto = factura - rodar - num(v.fijos)
    const horas = num(v.horas) * num(v.dias)
    return { factura, rodar, fijos: num(v.fijos), neto, dia: num(v.dias) ? neto / num(v.dias) : 0, hora: horas ? neto / horas : 0 }
  }, [v])
  const cambiar = (k, t) => {
    if (!medido.current) { medido.current = true; medirAccion('calc_uso') }
    setV((x) => ({ ...x, [k]: t.replace(/[^0-9.,]/g, '') }))
  }
  // Diez paradas más al día en las mismas horas: lo que da ordenar bien la ruta.
  const extra = 10 * num(v.pago) * num(v.dias)

  return (
    <div className="min-h-screen bg-dark-950 px-5 pb-12 pt-6 text-dark-100">
      <div className="mx-auto max-w-xl">
        <a href="/repartidores?utm_source=calculadora&utm_medium=cabecera" className="mb-5 flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" width="36" height="36" className="rounded-xl" />
          <b className="text-[17px] text-dark-50">FDS</b>
        </a>
        <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-brand-300">Para repartidores autónomos</p>
        <h1 className="mt-1.5 font-display text-[30px] font-extrabold leading-[1.08] text-dark-50">¿Cuánto gana un repartidor autónomo?</h1>
        <p className="mt-2 text-[15px] leading-snug text-dark-300">
          Pon tus paradas, lo que te pagan y tus gastos, y mira lo que te queda al mes, al día y por hora. Con tus números, no con los de nadie.
        </p>

        <section aria-label="Calculadora" className="mt-5 rounded-3xl border border-dark-700 bg-dark-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-dark-50"><Calculator size={17} className="text-brand-300" /> Tus números</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {CAMPOS.map(([k, t, , modo]) => (
              <label key={k} className={k === 'fijos' ? 'sm:col-span-2' : ''}>
                <span className="mb-1 block text-[12.5px] font-semibold text-dark-300">{t}</span>
                <input value={v[k]} onChange={(e) => cambiar(k, e.target.value)} inputMode={modo} aria-label={t}
                  className="w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 text-[16px] text-dark-50" />
              </label>
            ))}
          </div>
        </section>

        <section aria-label="Resultado" className="mt-4 rounded-3xl border border-emerald-400/30 bg-emerald-500/[.08] p-4">
          <p className="text-[12px] font-bold uppercase tracking-wider text-emerald-300">Te queda al mes</p>
          <p className="mt-1 text-[34px] font-extrabold leading-none text-emerald-200">{eur(r.neto)}</p>
          <p className="mt-1 text-[13px] text-dark-300">{eur(r.dia)} al día · {eur(r.hora)} por hora</p>
          <dl className="mt-3 space-y-1 text-[13.5px]">
            <div className="flex justify-between"><dt className="text-dark-300">Facturas</dt><dd className="font-semibold text-dark-50">{eur(r.factura)}</dd></div>
            <div className="flex justify-between"><dt className="text-dark-300">Gasóleo y desgaste</dt><dd className="font-semibold text-dark-50">− {eur(r.rodar)}</dd></div>
            <div className="flex justify-between"><dt className="text-dark-300">Gastos fijos</dt><dd className="font-semibold text-dark-50">− {eur(r.fijos)}</dd></div>
          </dl>
          <p className="mt-3 text-[11.5px] leading-snug text-dark-400">Orientativo y antes de impuestos (IRPF e IVA van aparte). Tus gastos pueden variar.</p>
        </section>

        <section className="mt-5 rounded-3xl border border-brand-400/30 bg-brand-500/[.07] p-4">
          <h2 className="text-[18px] font-bold text-dark-50">Con 10 paradas más al día ganarías {eur(extra)} más al mes</h2>
          <p className="mt-1.5 text-[14px] leading-snug text-dark-300">
            FDS ordena tu ruta por tiempo, lee la etiqueta con una foto y te lleva con voz hasta cada puerta. Y lleva la cuenta de lo que ganas cada día.
            {promoGratis() ? ' Gratis y sin límite hasta el 31 de diciembre, sin tarjeta.' : ' Gratis para empezar, sin tarjeta.'}
          </p>
          <a href="/repartidores?utm_source=calculadora&utm_medium=cta" onClick={() => medirAccion('calc_cta')}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 py-3.5 text-[16px] font-extrabold text-[#04121a]">
            Probar FDS gratis <ArrowRight size={18} />
          </a>
        </section>

        <section className="mt-7 space-y-5">
          {PREGUNTAS.map(([q, a]) => (
            <div key={q}>
              <h2 className="text-[16px] font-bold text-dark-50">{q}</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-dark-300">{a}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
