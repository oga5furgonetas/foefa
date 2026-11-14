import { useTitulo } from '../lib/titulo'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { API_BASE } from '../lib/apiBase'
import { medirAccion } from '../lib/analitica'
import { tx, useIdioma, locale } from '../lib/idioma'
import { ANCHO, BTN_PRIMARIO, BTN_SECUNDARIO, CabeceraPortada, ENLACE, Pie, useTemaWeb } from './portadaComun'
import { PLANES_EMPRESA, PLAN_REPARTO, DESCUENTOS_VOLUMEN, COMPLEMENTOS, REGLAS, MESES_ANUAL, PARADAS_GRATIS, DIAS_PRUEBA_EMPRESA, promoGratis, fechaPromo, precioMes, precioVehiculo, descuentoVolumen } from '../lib/precios'

/* Tarifa POR VEHÍCULO, con usuarios y conductores ilimitados. Los planes, los
   descuentos y los complementos viven en lib/precios.js (y su porqué, en
   docs/PRECIOS.md); los de verdad llegan de /billing/planes.
   IDENTIDAD (14-11-2026): la de la portada (tinta sobre papel, día por defecto y la noche con su paleta): los colores
   salen de las variables --ld-* de index.css; sin degradados, brillos, emojis ni rótulos en mayúsculas espaciadas.
   COMPOSICIÓN (tanda 4, 14-11-2026): una hoja de tarifas, no la plantilla de tarjetas. Los planes, en columnas separadas
   por reglas de 1 px, con las filas alineadas entre columnas (subgrid: el nombre, el precio, el botón y lo que lleva
   empiezan a la misma altura); el recomendado, con una regla de tinta de 2 px encima, sin insignia; las cifras en Plex
   Mono tabular; lo que lleva cada plan, una lista con reglas; la oferta fundador, una línea de texto (el ámbar es para
   avisar, no para vender); complementos y «Cómo se cuenta», listas de dos columnas con reglas, como las preguntas de
   la portada. La cabecera, la de la portada (portadaComun.jsx).
   IDIOMA (14-11-2026): la página ENTERA va por tx(), con el mismo idioma y el mismo selector que la portada (el del
   pie). Lo que incluye cada plan, los complementos y «Cómo se cuenta» son las frases fijas de lib/precios.js (las mismas,
   letra a letra, que manda /billing/planes): se traducen por esa frase, con sus 5 idiomas en lib/textosRutaA.js. Una
   frase que el servidor cambie y aquí no tenga traducción sale en español, nunca un hueco (lo vigila planes.spec.js). */
const AUTONOMO = { clave: 'autonomo', nombre: 'Repartidor', mensual: 9.99, anual: 99, dias_prueba: 7 }
const precioAnual = (p, n, tramos) => precioMes(p, n, tramos) * MESES_ANUAL
const ahorroAnual = (p, n, tramos) => precioMes(p, n, tramos) * (12 - MESES_ANUAL)
/* El alta de una empresa desde la cabecera: la de flota (como la portada), con el plan de entrada. */
const ALTA_EMPRESA = '/registro?sector=otra&plan=operacion'

/* Las piezas de la hoja, en clases. */
const REGLA = 'border-[color:var(--ld-border)]'
const CIFRA = 'font-mono font-medium tabular-nums tracking-[-0.02em] text-[color:var(--ld-text)]'
const MUTED = 'text-[color:var(--ld-muted)]'
const CAMPO_N = 'h-11 w-[5.5rem] rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-2 text-center font-mono text-[1rem] font-semibold tabular-nums text-[color:var(--ld-text)] focus:border-[color:var(--ld-text)] focus:outline-none'
const H2 = 'ld-titular text-[1.75rem] leading-[1.08] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[2.25rem]'
/* Las secciones de dos columnas (el título a la izquierda, la lista a la derecha), como las de la portada. */
const SECCION = 'grid gap-6 border-t border-[color:var(--ld-border)] py-12 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16'

/* Euros en el idioma de la pantalla: «50 €» en español, «€50» en inglés, con el separador de miles de cada uno. */
function euros(n) {
  const dec = Number.isInteger(n) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' })
      .format(n).replace(/[\u00a0\u202f]/g, ' ')
  } catch { return `${n} €` }
}

/* Un importe en Plex Mono con el «€» y el espacio en la letra de la casa: en mono, el espacio y el símbolo ocupan lo
   que una cifra y el importe se leía «200  €». El texto sigue siendo el mismo («200 €»). */
function enMono(texto) {
  return String(texto).split(/(€| )/).filter(Boolean).map((t, i) => (t === '€' || t === ' '
    ? <span key={i} className="font-sans font-semibold">{t}</span> : t))
}

/* Lo que lleva un plan y lo que no: dos listas con reglas, sin ✓ ni ✕ (lo que no lleva va aparte y en gris). */
function LoQueLleva({ incluye = [], noIncluye = [], testid }) {
  return (
    <div className="min-w-0">
      <p className={`text-[0.8125rem] font-semibold ${MUTED}`}>{tx('Incluye')}</p>
      <ul data-testid={testid} className={`mt-2 border-t ${REGLA}`}>
        {incluye.map((f) => (
          <li key={f} className={`border-b ${REGLA} py-2.5 text-[0.9375rem] leading-snug text-[color:var(--ld-text2)]`}>{tx(f)}</li>
        ))}
      </ul>
      {noIncluye.length > 0 && <>
        <p className={`mt-6 text-[0.8125rem] font-semibold ${MUTED}`}>{tx('No incluye')}</p>
        <ul className={`mt-2 border-t ${REGLA}`}>
          {noIncluye.map((f) => (
            <li key={f} className={`border-b ${REGLA} py-2 text-[0.875rem] leading-snug ${MUTED}`}>{tx(f)}</li>
          ))}
        </ul>
      </>}
    </div>
  )
}

/* ── Oferta fundador (06-10-2026): Pro a 6 € por vehículo, congelado 24 meses, para las
   10 primeras empresas. No se suma al descuento por volumen; sí al anual. Antes era
   «Completo a 5 € para siempre»: nadie había reservado, se cambió sin faltar a nadie.
   La reserva no cobra: guarda el contacto y avisa por Telegram para cerrar la venta.
   Tanda 4: una línea de texto bajo los planes, entre dos reglas; sin caja ámbar ni insignia. ── */
function FounderOffer() {
  const [slots, setSlots] = useState(null)          // { total, left }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', fleet_size: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/founder/slots`).then(r => r.json()).then(setSlots).catch(() => {})
  }, [])

  async function reserve(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch(`${API_BASE}/founder/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(typeof j?.detail === 'string' && j.detail.trim() ? tx(j.detail) : tx('No se pudo reservar'))
      medirAccion('fundador_reservado')
      setDone(true)
      if (typeof j.left === 'number') setSlots(s => ({ ...(s || { total: 10 }), left: j.left }))
    } catch (e2) {
      setErr(e2.message)
    } finally { setBusy(false) }
  }

  if (slots && slots.left <= 0) return null   // agotadas: la oferta desaparece sola

  const campo = 'h-11 w-full min-w-0 rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-3 text-[0.9375rem] text-[color:var(--ld-text)] focus:border-[color:var(--ld-text)] focus:outline-none'

  return (
    <div data-testid="planes-fundador" className={`mt-10 border-t ${REGLA} pb-4 pt-6`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <p className="text-[1.0625rem] leading-snug text-[color:var(--ld-text)]">
            <b className="font-bold">
              {slots && slots.left < slots.total
                ? tx('Oferta fundador · quedan {n} de {total} plazas', { n: slots.left, total: slots.total })
                : tx('Oferta fundador · plazas limitadas')}.
            </b>{' '}
            {tx('El plan Pro a {precio} por vehículo, congelado 24 meses', { precio: euros(6) })}.
          </p>
          <p className={`mt-1.5 max-w-[760px] text-[0.9062rem] leading-relaxed ${MUTED}`}>
            {tx('Todo Pro ({precio}/vehículo): sedes ilimitadas, qué furgoneta lleva cada uno, cuadrante y turnos, plantilla y exportación.', { precio: euros(9) })}{' '}
            {tx('Solo para las 10 primeras empresas, sin subidas durante dos años. Se suma al pago anual.')}{' '}
            {tx('Reservar no cuesta nada ni te compromete: te llamamos y lo activamos juntos.')}
          </p>
        </div>
        {!open && !done && (
          <button type="button" onClick={() => { medirAccion('fundador_abrir'); setOpen(true) }} className={`${ENLACE} shrink-0 gap-1.5 self-start lg:-mt-2.5`}>
            {tx('Reservar mi plaza fundador')} <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {done ? (
        <div role="status" className="mt-5 flex items-start gap-3">
          <span aria-hidden="true" className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--ld-ok)]" />
          <p><b className="font-bold text-[color:var(--ld-text)]">{tx('Plaza reservada')}</b>{' '}
            <span className={MUTED}>{tx('Te contactamos en menos de 24 horas para activarla. Sin compromiso.')}</span></p>
        </div>
      ) : open && (
        <form onSubmit={reserve} className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <input className={campo} aria-label={tx('Tu nombre')} placeholder={`${tx('Tu nombre')} *`} maxLength={120} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input className={campo} type="email" aria-label={tx('Correo')} placeholder={`${tx('Correo')} *`} maxLength={254} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input className={campo} aria-label={tx('Teléfono')} placeholder={tx('Teléfono')} maxLength={30} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <input className={campo} aria-label={tx('Número de vehículos')} placeholder={tx('Número de vehículos')} maxLength={10} value={form.fleet_size} onChange={e => setForm(f => ({ ...f, fleet_size: e.target.value }))} />
          <button type="submit" disabled={busy} className={`${BTN_SECUNDARIO} !min-h-[2.75rem] sm:col-span-2 lg:col-span-1`}>
            {busy ? tx('Reservando…') : tx('Confirmar la reserva')}
          </button>
          {err && <p role="alert" className="text-[0.875rem] font-semibold text-[color:var(--ld-warn)] sm:col-span-2 lg:col-span-5">{err}</p>}
        </form>
      )}
    </div>
  )
}

export default function Planes() {
  const lang = useIdioma()
  useTitulo(tx('Planes y precios'))
  const [tema, setTema] = useTemaWeb()
  useEffect(() => { try { document.documentElement.lang = lang } catch { /* nada */ } }, [lang])
  const [billing, setBilling] = useState('monthly') // 'monthly' | 'annual'
  /* El visitante escribe cuántos vehículos tiene y ve SU precio, ya con el
     descuento por volumen. Una tabla de planes obliga a hacer cuentas; esto no. */
  const [furgonetas, setFurgonetas] = useState(40)
  const [planes, setPlanes] = useState(PLANES_EMPRESA)
  const [tramos, setTramos] = useState(DESCUENTOS_VOLUMEN)
  const [complementos, setComplementos] = useState(COMPLEMENTOS)
  const [autonomo, setAutonomo] = useState(AUTONOMO)
  // Reparto va aparte: su unidad es el repartidor, no la furgoneta del deslizador de arriba.
  const [reparto, setReparto] = useState(PLAN_REPARTO)
  const [repartidores, setRepartidores] = useState(5)

  useEffect(() => {
    // Los precios mandan desde el backend. Si no responde, se quedan los de
    // respaldo: la página de precios nunca puede aparecer sin precios.
    fetch(`${API_BASE}/billing/planes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const lista = Array.isArray(d?.planes) ? d.planes : []
        setPlanes(PLANES_EMPRESA.map((f) => {
          const s = lista.find((p) => p.clave === f.clave)
          return s ? { ...f, ...s, desde: f.desde ?? d?.desde_empresa, color: f.color } : f
        }))
        const aut = lista.find((p) => p.clave === 'autonomo')
        if (aut) setAutonomo({ ...AUTONOMO, ...aut })
        const rep = lista.find((p) => p.clave === 'reparto')
        if (rep) setReparto({ ...PLAN_REPARTO, ...rep, color: PLAN_REPARTO.color })
        if (Array.isArray(d?.descuentos_volumen) && d.descuentos_volumen.length) setTramos(d.descuentos_volumen)
        if (Array.isArray(d?.complementos) && d.complementos.length) setComplementos(d.complementos)
      })
      .catch(() => { /* respaldo local */ })
  }, [])

  const pct = descuentoVolumen(furgonetas, tramos)
  const nombrePlan = (p) => tx(p.nombre)
  const fechaFin = (() => { try { return fechaPromo(locale(), autonomo.gratis_hasta || undefined) } catch { return '' } })()
  const conPromo = 'gratis_hasta' in autonomo ? !!autonomo.gratis_hasta : promoGratis()
  const paradas = autonomo.paradas_gratis || PARADAS_GRATIS
  const pestana = (activa) => `inline-flex min-h-[2.5rem] items-center gap-2 rounded-[9px] px-4 text-[0.9375rem] font-bold ${activa ? 'bg-[color:var(--ld-text)] text-[color:var(--ld-bg)]' : `${MUTED} hover:text-[color:var(--ld-text)]`}`

  return (
    <div className="ld-root min-h-screen font-sans antialiased" data-theme={tema} data-testid="planes">
      <CabeceraPortada alta={`${ALTA_EMPRESA}&flota=${furgonetas}`} actual="/planes" />
      {/* role=main y no <main>: el panel pinta `main` con su tema (index.css) y aquí no va. */}
      <div role="main" className={`${ANCHO} pb-16 pt-10 sm:pt-14`}>

        {/* ── La cabeza: el titular a la izquierda; a la derecha, con qué se calcula la hoja (tus vehículos y el pago) ── */}
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-end lg:gap-16">
          <div>
            <p className="text-[0.9375rem] font-semibold text-[color:var(--ld-accent)]">{tx('{n} días de prueba, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}</p>
            <h1 className="ld-titular mt-3 max-w-[720px] text-[2.25rem] leading-[1.02] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[3.25rem]">
              {tx('Se paga por vehículo. Usuarios y conductores, sin límite.')}
            </h1>
            <p className={`mt-4 max-w-[600px] text-[1.0625rem] leading-relaxed ${MUTED}`}>
              {tx('Usuarios de oficina y conductores ilimitados en todos los planes. Sin instalar nada en las furgonetas. Pago mensual sin permanencia, o anual pagando {meses} meses.', { meses: MESES_ANUAL })}
            </p>
          </div>

          <div className={`border-t ${REGLA} pt-5 lg:border-t-0 lg:pt-0`}>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="flota" className="text-[0.9375rem] font-semibold text-[color:var(--ld-text)]">{tx('¿Cuántos vehículos tienes?')}</label>
              <input type="number" min="1" max="5000" value={furgonetas} aria-label={tx('Número de vehículos')}
                onChange={(e) => setFurgonetas(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} className={CAMPO_N} />
            </div>
            <input id="flota" type="range" min="5" max="400" step="5" value={furgonetas}
              onChange={(e) => setFurgonetas(Number(e.target.value))} className="mt-3 w-full accent-[color:var(--ld-text)]" />
            <p className={`mt-1 text-[0.875rem] font-semibold ${pct ? 'text-[color:var(--ld-ok)]' : MUTED}`}>
              {pct ? tx('−{pct} % por volumen', { pct }) : tx('Desde {n} vehículos, −{pct} %', { n: tramos[0]?.desde || 50, pct: tramos[0]?.pct || 10 })}
            </p>
            <div role="group" aria-label={tx('Pago')} className="mt-5 inline-flex items-center gap-1 rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] p-1">
              <button type="button" onClick={() => setBilling('monthly')} aria-pressed={billing === 'monthly'} className={pestana(billing === 'monthly')}>{tx('Mensual')}</button>
              <button type="button" onClick={() => setBilling('annual')} aria-pressed={billing === 'annual'} className={pestana(billing === 'annual')}>
                {tx('Anual')}
                <span className={`whitespace-nowrap text-[0.8125rem] ${billing === 'annual' ? '' : 'text-[color:var(--ld-ok)]'}`}>{tx('pagas {meses} meses', { meses: MESES_ANUAL })}</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── La hoja: tres columnas con reglas. Cada columna ocupa cuatro filas de la rejilla de fuera (subgrid), así el
            nombre, el precio, el botón y las listas de las tres empiezan a la misma altura. En el móvil, una debajo de
            otra, separadas por la regla. ── */}
        <div data-testid="planes-hoja" className={`mt-12 grid border-t ${REGLA} lg:grid-cols-3 lg:grid-rows-[repeat(4,auto)]`}>
          {planes.map((p, i) => {
            const aMedida = !p.por_vehiculo
            const mes = precioMes(p, furgonetas, tramos)
            const mostrado = billing === 'annual' ? Math.round(precioAnual(p, furgonetas, tramos) / 12) : mes
            const minimo = furgonetas < p.minimo_vehiculos
            const porVeh = aMedida ? 0 : precioVehiculo(p, furgonetas, tramos)
            return (
              <section key={p.clave} data-plan={p.clave} data-recomendado={p.recomendado ? 'si' : undefined} aria-labelledby={`plan-${p.clave}`}
                className={`relative grid content-start gap-y-5 py-8 lg:row-span-4 lg:grid-rows-subgrid lg:px-7 ${i ? `border-t ${REGLA} lg:border-l lg:border-t-0` : 'lg:pl-0'} ${i === planes.length - 1 ? 'lg:pr-0' : ''}`}>
                {/* El recomendado: una regla de tinta de 2 px encima de su columna, sobre la de 1 px de la hoja. */}
                {p.recomendado && <span aria-hidden="true" data-testid="plan-regla-recomendado" className="absolute inset-x-0 -top-px h-[2px] bg-[color:var(--ld-text)]" />}
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 id={`plan-${p.clave}`} className="text-[1.5rem] font-extrabold tracking-[-0.02em] text-[color:var(--ld-text)]">{nombrePlan(p)}</h2>
                    {p.recomendado && <span className="text-[0.8125rem] font-semibold text-[color:var(--ld-text)]">{tx('Recomendado')}</span>}
                  </div>
                  <p className={`mt-1 text-[0.9375rem] ${MUTED}`}>{tx(p.para)}</p>
                </div>

                <div>
                  {aMedida ? (<>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-[0.9375rem] ${MUTED}`}>{tx('desde')}</span>
                      <span className={`${CIFRA} text-[2.5rem] leading-none`}>{enMono(euros(p.desde || 12))}</span>
                      <span className={`text-[0.9375rem] ${MUTED}`}>{tx('/vehículo')}</span>
                    </p>
                    <p className={`mt-2 text-[0.875rem] ${MUTED}`}>{tx('A medida: lo cerramos con vosotros')}</p>
                  </>) : (<>
                    <p className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className={`${CIFRA} text-[2.5rem] leading-none`}>{enMono(euros(mostrado))}</span>
                      <span className={`text-[0.9375rem] ${MUTED}`}>{tx('/mes')}</span>
                    </p>
                    <p className={`mt-2 text-[0.875rem] ${MUTED}`}>
                      {porVeh !== p.por_vehiculo
                        ? <><s className="font-mono tabular-nums">{enMono(euros(p.por_vehiculo))}</s> <b className="font-mono font-semibold tabular-nums text-[color:var(--ld-ok)]">{enMono(euros(porVeh))}</b> {tx('por vehículo y mes')}</>
                        : <><span className="font-mono tabular-nums text-[color:var(--ld-text)]">{enMono(euros(p.por_vehiculo))}</span> {tx('por vehículo y mes')}</>}
                      {minimo && <span> · {tx('mínimo {n}', { n: p.minimo_vehiculos })}</span>}
                    </p>
                    {billing === 'annual' && (
                      <p className="mt-1 text-[0.875rem] font-semibold text-[color:var(--ld-ok)]">
                        {tx('{precio}/año · ahorras {ahorro}', { precio: euros(precioAnual(p, furgonetas, tramos)), ahorro: euros(ahorroAnual(p, furgonetas, tramos)) })}
                      </p>
                    )}
                  </>)}
                </div>

                <a href={aMedida ? '/contacto?asunto=Plan%20Empresa' : `/registro?plan=${p.clave}&billing=${billing}&flota=${furgonetas}`}
                  onClick={() => medirAccion('plan_elegir')}
                  className={`${p.recomendado ? BTN_PRIMARIO : BTN_SECUNDARIO} w-full self-start whitespace-normal text-center`}>
                  {aMedida ? tx('Hablamos') : tx('Empezar la prueba de {n} días', { n: DIAS_PRUEBA_EMPRESA })} <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
                </a>

                <LoQueLleva incluye={p.incluye || []} noIncluye={p.no_incluye || []} testid="plan-incluye" />
              </section>
            )
          })}
        </div>

        <FounderOffer />

        {/* Reparto: súper y distribución pagan por repartidor activo, con las furgonetas incluidas */}
        {(() => {
          const mesRep = precioMes(reparto, repartidores, tramos)
          const porRep = precioVehiculo(reparto, repartidores, tramos)
          const minRep = reparto.minimo_repartidores || 0
          const mostradoRep = billing === 'annual' ? Math.round(mesRep * MESES_ANUAL / 12) : mesRep
          return (
            <section id="reparto" className={`mt-10 ${SECCION}`}>
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold text-[color:var(--ld-accent)]">{tx('¿Repartís vuestra propia mercancía?')}</p>
                <h2 className={`${H2} mt-2`}>{tx('Plan {plan}: por repartidor, con las furgonetas incluidas', { plan: nombrePlan(reparto) })}</h2>
                <p className={`mt-3 text-[0.9688rem] leading-relaxed ${MUTED}`}>
                  {tx('Para el supermercado que lleva la compra a casa y el distribuidor que reparte a negocios. Se paga por repartidor que haya tenido pedidos en el mes; las furgonetas, las tiendas y los usuarios no se cobran.')}
                </p>
              </div>
              <div className="grid min-w-0 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor="repartidores" className="text-[0.9375rem] font-semibold text-[color:var(--ld-text)]">{tx('¿Cuántos repartidores tenéis?')}</label>
                    <input id="repartidores" type="number" min="1" max="5000" value={repartidores} aria-label={tx('Número de repartidores')}
                      onChange={(e) => setRepartidores(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} className={CAMPO_N} />
                  </div>
                  <p className={`mt-5 flex flex-wrap items-baseline gap-x-1.5 border-t ${REGLA} pt-5`}>
                    <span className={`${CIFRA} text-[2.5rem] leading-none`}>{enMono(euros(mostradoRep))}</span>
                    <span className={`text-[0.9375rem] ${MUTED}`}>{tx('/mes')}</span>
                  </p>
                  <p className={`mt-2 text-[0.875rem] ${MUTED}`}>
                    {porRep !== Number(reparto.por_repartidor)
                      ? <><s className="font-mono tabular-nums">{enMono(euros(reparto.por_repartidor))}</s> <b className="font-mono font-semibold tabular-nums text-[color:var(--ld-ok)]">{enMono(euros(porRep))}</b> {tx('por repartidor activo y mes')}</>
                      : <><span className="font-mono tabular-nums text-[color:var(--ld-text)]">{enMono(euros(reparto.por_repartidor))}</span> {tx('por repartidor activo y mes')}</>}
                    {repartidores < minRep && <span> · {tx('mínimo {n}', { n: minRep })}</span>}
                  </p>
                  {billing === 'annual' && (
                    <p className="mt-1 text-[0.875rem] font-semibold text-[color:var(--ld-ok)]">{tx('{precio}/año · ahorras {ahorro}', { precio: euros(mesRep * MESES_ANUAL), ahorro: euros(mesRep * (12 - MESES_ANUAL)) })}</p>
                  )}
                  <a href={`/registro?sector=supermercado&plan=reparto&billing=${billing}&repartidores=${repartidores}`}
                    onClick={() => medirAccion('plan_elegir')}
                    className={`${BTN_SECUNDARIO} mt-6 w-full whitespace-normal text-center sm:w-auto`}>
                    {tx('Empezar la prueba de {n} días', { n: DIAS_PRUEBA_EMPRESA })} <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
                  </a>
                </div>
                <LoQueLleva incluye={reparto.incluye || []} noIncluye={reparto.no_incluye || []} />
              </div>
            </section>
          )
        })()}

        {/* Complementos: dos columnas con reglas, como las preguntas de la portada. */}
        <section className={SECCION}>
          <div>
            <h2 className={H2}>{tx('Complementos')}</h2>
            <p className={`mt-3 text-[0.9688rem] leading-relaxed ${MUTED}`}>{tx('Se añaden a cualquier plan cuando os hagan falta.')}</p>
          </div>
          <ul data-testid="planes-complementos" className={`border-b ${REGLA}`}>
            {complementos.map((c) => (
              <li key={c.clave} className={`grid gap-1.5 border-t ${REGLA} py-5 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-8`}>
                <div>
                  <p className="text-[1.0625rem] font-bold leading-snug text-[color:var(--ld-text)]">{tx(c.nombre)}</p>
                  <p className="mt-1 text-[0.9062rem] font-semibold leading-snug text-[color:var(--ld-text2)]">{tx(c.precio)}</p>
                </div>
                <p className="text-[0.9688rem] leading-relaxed text-[color:var(--ld-text2)]">{tx(c.que)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Lo que siempre se pregunta */}
        <section className={SECCION}>
          <h2 className={H2}>{tx('Cómo se cuenta')}</h2>
          <dl data-testid="planes-reglas" className={`border-b ${REGLA}`}>
            {REGLAS.map(([q, a]) => (
              <div key={q} className={`grid gap-1.5 border-t ${REGLA} py-5 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-8`}>
                <dt className="text-[1.0625rem] font-bold leading-snug text-[color:var(--ld-text)]">{tx(q)}</dt>
                <dd className="text-[0.9688rem] leading-relaxed text-[color:var(--ld-text2)]">{tx(a)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* El repartidor que va solo: otro producto, otra tarifa. Una fila con su regla, como en la portada. */}
        <div className={`grid gap-4 border-t ${REGLA} py-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10`}>
          <div>
            <p className="text-[1.0625rem] font-bold text-[color:var(--ld-text)]">{tx('¿Repartes tú solo?')}</p>
            <p className={`mt-1 max-w-[760px] text-[0.9688rem] leading-relaxed ${MUTED}`}>
              {conPromo
                ? tx('La app de ruta para quien reparte por su cuenta: sin límite hasta el {fecha}, sin tarjeta. Después, sin pagar hasta {n} paradas al día; sin tope, {mes} al mes o {ano} al año.', { fecha: fechaFin, n: paradas, mes: euros(autonomo.mensual), ano: euros(autonomo.anual) })
                : tx('La app de ruta para quien reparte por su cuenta: sin pagar hasta {n} paradas al día, sin tarjeta. Sin tope, {mes} al mes o {ano} al año.', { n: paradas, mes: euros(autonomo.mensual), ano: euros(autonomo.anual) })}
            </p>
          </div>
          <a href="/repartidores" className={`${BTN_SECUNDARIO} w-full md:w-auto`}>
            {tx('Ver la app de reparto')} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <p className={`border-t ${REGLA} pt-6 text-[0.875rem] ${MUTED}`}>
          {tx('Precios sin IVA.')} <a href="/contacto" className="font-semibold text-[color:var(--ld-accent)] underline-offset-4 hover:underline">{tx('¿Dudas? Escríbenos')}</a>
        </p>
      </div>
      {/* El pie de la portada: el idioma (el mismo selector), día o noche, y el aviso legal (LSSI art. 10). */}
      <Pie lang={lang} tema={tema} setTema={setTema} />
    </div>
  )
}
