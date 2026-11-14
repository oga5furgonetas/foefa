import { useTitulo } from '../lib/titulo'
import { useEffect, useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { API_BASE } from '../lib/apiBase'
import { medirAccion } from '../lib/analitica'
import { tx, useIdioma, locale } from '../lib/idioma'
import { BTN_SECUNDARIO, CabeceraSimple, Pie, useTemaWeb } from './portadaComun'
import { PLANES_EMPRESA, PLAN_REPARTO, DESCUENTOS_VOLUMEN, COMPLEMENTOS, REGLAS, MESES_ANUAL, PARADAS_GRATIS, DIAS_PRUEBA_EMPRESA, promoGratis, fechaPromo, precioMes, precioVehiculo, descuentoVolumen } from '../lib/precios'

/* Tarifa POR VEHÍCULO, con usuarios y conductores ilimitados. Los planes, los
   descuentos y los complementos viven en lib/precios.js (y su porqué, en
   docs/PRECIOS.md); los de verdad llegan de /billing/planes.
   IDENTIDAD (14-11-2026): la de la portada (tinta sobre papel, día por defecto y la noche con su paleta): los colores
   salen de las variables --ld-* de index.css; sin degradados, brillos, emojis ni rótulos en mayúsculas espaciadas. El
   color de cada plan (lib/precios.js) ya no pinta texto: en papel no se leía. Las letras, en rem: crecen con el tamaño
   de letra del navegador.
   IDIOMA (14-11-2026): la página ENTERA va por tx(), con el mismo idioma y el mismo selector que la portada (el del
   pie). Lo que incluye cada plan, los complementos y «Cómo se cuenta» son las frases fijas de lib/precios.js (las mismas,
   letra a letra, que manda /billing/planes): se traducen por esa frase, con sus 5 idiomas en lib/textosRutaA.js. Una
   frase que el servidor cambie y aquí no tenga traducción sale en español, nunca un hueco (lo vigila planes.spec.js). */
const AUTONOMO = { clave: 'autonomo', nombre: 'Repartidor', mensual: 9.99, anual: 99, dias_prueba: 7 }
const precioAnual = (p, n, tramos) => precioMes(p, n, tramos) * MESES_ANUAL
const ahorroAnual = (p, n, tramos) => precioMes(p, n, tramos) * (12 - MESES_ANUAL)
const V = (n) => `var(--ld-${n})`
const rem = (px) => `${px / 16}rem`
const tarjeta = { background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 20 }
const campoNum = { width: rem(84), minHeight: rem(44), background: V('surface'), border: `1px solid ${V('border-strong')}`, borderRadius: 10, padding: '0 10px', color: V('text'), fontSize: rem(16), fontWeight: 600, textAlign: 'center', fontFamily: 'IBM Plex Mono, ui-monospace, monospace' }

/* Euros en el idioma de la pantalla: «50 €» en español, «€50» en inglés, con el separador de miles de cada uno. */
function euros(n) {
  const dec = Number.isInteger(n) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' })
      .format(n).replace(/[\u00a0\u202f]/g, ' ')
  } catch { return `${n} €` }
}

/* ── Oferta fundador (06-10-2026): Pro a 6 € por vehículo, congelado 24 meses, para las
   10 primeras empresas. No se suma al descuento por volumen; sí al anual. Antes era
   «Completo a 5 € para siempre»: nadie había reservado, se cambió sin faltar a nadie.
   La reserva no cobra: guarda el contacto y avisa por Telegram para cerrar la venta. ── */
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

  const inputS = { background: V('surface'), border: `1px solid ${V('border-strong')}`, borderRadius: 10, padding: '0 12px', minHeight: rem(44), fontSize: rem(15), color: V('text'), outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'relative', background: V('surface'), border: `1.5px solid ${V('ambar')}`, borderRadius: 20, padding: '26px 28px', marginBottom: 36 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ minWidth: 260, flex: '1 1 320px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: V('ambar'), borderRadius: 6, padding: '4px 10px', fontSize: rem(13), fontWeight: 700, color: '#10181A', marginBottom: 12 }}>
            {slots && slots.left < slots.total
              ? tx('Oferta fundador · quedan {n} de {total} plazas', { n: slots.left, total: slots.total })
              : tx('Oferta fundador · plazas limitadas')}
          </div>
          <h2 className="ld-titular" style={{ margin: '0 0 8px', fontSize: rem(26), lineHeight: 1.15 }}>
            {tx('El plan Pro a {precio} por vehículo, congelado 24 meses', { precio: euros(6) })}
          </h2>
          <p style={{ margin: 0, color: V('muted'), fontSize: rem(15), lineHeight: 1.6, maxWidth: 520 }}>
            {tx('Todo Pro ({precio}/vehículo): sedes ilimitadas, qué furgoneta lleva cada uno, cuadrante y turnos, plantilla y exportación.', { precio: euros(9) })}{' '}
            {tx('Solo para las 10 primeras empresas, sin subidas durante dos años. Se suma al pago anual.')}{' '}
            {tx('Reservar no cuesta nada ni te compromete: te llamamos y lo activamos juntos.')}
          </p>
        </div>

        <div style={{ flex: '0 1 340px', minWidth: 260 }}>
          {done ? (
            <div role="status" style={{ border: `1px solid ${V('border-strong')}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: rem(16), fontWeight: 800, color: V('ok'), marginBottom: 4 }}>{tx('Plaza reservada')}</div>
              <div style={{ fontSize: rem(14), color: V('muted') }}>{tx('Te contactamos en menos de 24 horas para activarla. Sin compromiso.')}</div>
            </div>
          ) : open ? (
            <form onSubmit={reserve} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inputS} aria-label={tx('Tu nombre')} placeholder={`${tx('Tu nombre')} *`} maxLength={120} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <input style={inputS} type="email" aria-label={tx('Correo')} placeholder={`${tx('Correo')} *`} maxLength={254} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputS} aria-label={tx('Teléfono')} placeholder={tx('Teléfono')} maxLength={30} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input style={inputS} aria-label={tx('Número de vehículos')} placeholder={tx('Número de vehículos')} maxLength={10} value={form.fleet_size} onChange={e => setForm(f => ({ ...f, fleet_size: e.target.value }))} />
              </div>
              {err && <div role="alert" style={{ fontSize: rem(14), fontWeight: 600, color: V('warn') }}>{err}</div>}
              <button type="submit" disabled={busy} className={BTN_SECUNDARIO}>
                {busy ? tx('Reservando…') : tx('Confirmar la reserva')}
              </button>
            </form>
          ) : (
            <button onClick={() => { medirAccion('fundador_abrir'); setOpen(true) }} className={`${BTN_SECUNDARIO} w-full`}>
              {tx('Reservar mi plaza fundador')} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
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
  const sufijo = { color: V('muted'), fontSize: rem(15) }
  const fechaFin = (() => { try { return fechaPromo(locale(), autonomo.gratis_hasta || undefined) } catch { return '' } })()
  const conPromo = 'gratis_hasta' in autonomo ? !!autonomo.gratis_hasta : promoGratis()
  const paradas = autonomo.paradas_gratis || PARADAS_GRATIS

  return (
    <div className="ld-root font-sans antialiased" data-theme={tema} style={{ minHeight: '100vh' }}>
      <CabeceraSimple>
        <a href="/panel/login" className="inline-flex min-h-[44px] items-center px-1 text-[0.9375rem] font-medium text-[color:var(--ld-text)] underline-offset-4 hover:underline">{tx('Entrar')}</a>
      </CabeceraSimple>
      <div style={{ maxWidth: 1136, margin: '0 auto', padding: '48px 16px 64px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: rem(15), fontWeight: 600, color: V('accent'), marginBottom: 14 }}>{tx('{n} días de prueba, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}</p>
          <h1 className="ld-titular" style={{ fontSize: 'clamp(2rem,5vw,3.25rem)', margin: '0 auto 14px', lineHeight: 1.04, maxWidth: 820 }}>
            {tx('Se paga por vehículo. Usuarios y conductores, sin límite.')}
          </h1>
          <p style={{ color: V('muted'), fontSize: rem(17), maxWidth: 560, margin: '0 auto 24px' }}>
            {tx('Usuarios de oficina y conductores ilimitados en todos los planes. Sin instalar nada en las furgonetas. Pago mensual sin permanencia, o anual pagando {meses} meses.', { meses: MESES_ANUAL })}
          </p>

          <div role="group" aria-label={tx('Pago')} style={{ display: 'inline-flex', alignItems: 'center', background: V('surface'), border: `1px solid ${V('border-strong')}`, borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setBilling('monthly')}
              aria-pressed={billing === 'monthly'} style={{ minHeight: rem(40), padding: '0 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: rem(15), background: billing === 'monthly' ? V('text') : 'transparent', color: billing === 'monthly' ? V('bg') : V('muted') }}>
              {tx('Mensual')}
            </button>
            <button onClick={() => setBilling('annual')}
              aria-pressed={billing === 'annual'} style={{ minHeight: rem(40), padding: '0 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: rem(15), display: 'flex', alignItems: 'center', gap: 8, background: billing === 'annual' ? V('text') : 'transparent', color: billing === 'annual' ? V('bg') : V('muted') }}>
              {tx('Anual')}
              <span style={{ fontSize: rem(13), fontWeight: 700, whiteSpace: 'nowrap', color: billing === 'annual' ? V('bg') : V('ok') }}>{tx('pagas {meses} meses', { meses: MESES_ANUAL })}</span>
            </button>
          </div>
        </div>

        <FounderOffer />

        {/* Cuántos vehículos tienes: el precio se calcula con TU flota */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ ...tarjeta, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center', padding: '14px 22px' }}>
            <label htmlFor="flota" style={{ fontSize: rem(15), color: V('text'), fontWeight: 600 }}>{tx('¿Cuántos vehículos tienes?')}</label>
            <input id="flota" type="range" min="5" max="400" step="5" value={furgonetas}
              onChange={(e) => setFurgonetas(Number(e.target.value))} style={{ width: 220, maxWidth: '100%', accentColor: 'var(--ld-text)' }} />
            <input type="number" min="1" max="5000" value={furgonetas} aria-label={tx('Número de vehículos')}
              onChange={(e) => setFurgonetas(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
              style={campoNum} />
            <span style={{ fontSize: rem(14), fontWeight: 600, color: pct ? V('ok') : V('muted') }}>
              {pct ? tx('−{pct} % por volumen', { pct }) : tx('Desde {n} vehículos, −{pct} %', { n: tramos[0]?.desde || 50, pct: tramos[0]?.pct || 10 })}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(290px,100%),1fr))', gap: 20, marginBottom: 12 }}>
          {planes.map((p) => {
            const aMedida = !p.por_vehiculo
            const mes = precioMes(p, furgonetas, tramos)
            const mostrado = billing === 'annual' ? Math.round(precioAnual(p, furgonetas, tramos) / 12) : mes
            const minimo = furgonetas < p.minimo_vehiculos
            const porVeh = aMedida ? 0 : precioVehiculo(p, furgonetas, tramos)
            return (
              <div key={p.clave} style={{
                ...tarjeta,
                border: p.recomendado ? `2px solid ${V('text')}` : tarjeta.border,
                padding: '28px 24px', position: 'relative', display: 'flex', flexDirection: 'column',
              }}>
                {p.recomendado && (
                  <div style={{ position: 'absolute', top: -13, left: 24, background: V('text'), borderRadius: 6, padding: '3px 10px', fontSize: rem(13), fontWeight: 700, whiteSpace: 'nowrap', color: V('bg') }}>
                    {tx('Recomendado')}
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: rem(22), fontWeight: 800, letterSpacing: '-.01em', marginBottom: 4 }}>{nombrePlan(p)}</div>
                  <div style={{ fontSize: rem(14), color: V('muted'), marginBottom: 16 }}>{tx(p.para)}</div>
                  {aMedida ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={sufijo}>{tx('desde')}</span>
                        <span className="ld-titular" style={{ fontSize: rem(44) }}>{euros(p.desde || 12)}</span>
                        <span style={sufijo}>{tx('/vehículo')}</span>
                      </div>
                      <div style={{ fontSize: rem(14), color: V('muted'), marginTop: 4 }}>{tx('A medida: lo cerramos con vosotros')}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                        <span className="ld-titular" style={{ fontSize: rem(44) }}>{euros(mostrado)}</span>
                        <span style={sufijo}>{tx('/mes')}</span>
                      </div>
                      <div style={{ fontSize: rem(14), color: V('muted'), marginTop: 4 }}>
                        {porVeh !== p.por_vehiculo
                          ? <><s>{euros(p.por_vehiculo)}</s> <b style={{ color: V('ok') }}>{euros(porVeh)}</b> {tx('por vehículo y mes')}</>
                          : <>{euros(p.por_vehiculo)} {tx('por vehículo y mes')}</>}
                        {minimo && <span> · {tx('mínimo {n}', { n: p.minimo_vehiculos })}</span>}
                      </div>
                      {billing === 'annual' && (
                        <div style={{ fontSize: rem(14), color: V('ok'), fontWeight: 700, marginTop: 4 }}>
                          {tx('{precio}/año · ahorras {ahorro}', { precio: euros(precioAnual(p, furgonetas, tramos)), ahorro: euros(ahorroAnual(p, furgonetas, tramos)) })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <a href={aMedida ? '/contacto?asunto=Plan%20Empresa' : `/registro?plan=${p.clave}&billing=${billing}&flota=${furgonetas}`}
                  onClick={() => medirAccion('plan_elegir')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: rem(52), padding: '6px 16px', textAlign: 'center', borderRadius: 12, fontWeight: 700, fontSize: rem(16),
                    textDecoration: 'none', marginBottom: 24,
                    background: p.recomendado ? V('firma') : 'transparent',
                    color: p.recomendado ? V('tinta-firma') : V('text'), border: p.recomendado ? '1.5px solid transparent' : `1.5px solid ${V('border-strong')}`,
                  }}>
                  {aMedida ? tx('Hablamos') : tx('Empezar la prueba de {n} días', { n: DIAS_PRUEBA_EMPRESA })} <ArrowRight size={16} aria-hidden="true" />
                </a>

                <ul data-testid="plan-incluye" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {(p.incluye || []).map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: rem(14.5), color: V('text2'), lineHeight: 1.45 }}>
                      <Check size={15} color="var(--ld-ok)" style={{ flexShrink: 0, marginTop: 2 }} /> {tx(f)}
                    </li>
                  ))}
                  {(p.no_incluye || []).map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: rem(14), color: V('muted'), lineHeight: 1.45 }}>
                      <span aria-hidden="true" style={{ fontSize: rem(14), lineHeight: 1.45, flexShrink: 0 }}>✕</span> {tx(f)}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Reparto: súper y distribución pagan por repartidor activo, con las furgonetas incluidas */}
        {(() => {
          const mesRep = precioMes(reparto, repartidores, tramos)
          const porRep = precioVehiculo(reparto, repartidores, tramos)
          const minRep = reparto.minimo_repartidores || 0
          const mostradoRep = billing === 'annual' ? Math.round(mesRep * MESES_ANUAL / 12) : mesRep
          return (
            <div id="reparto" style={{ ...tarjeta, padding: '26px 28px', marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 24, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: rem(15), fontWeight: 600, color: V('accent'), marginBottom: 6 }}>{tx('¿Repartís vuestra propia mercancía?')}</div>
                <h2 className="ld-titular" style={{ fontSize: rem(26), margin: '0 0 8px', lineHeight: 1.15 }}>{tx('Plan {plan}: por repartidor, con las furgonetas incluidas', { plan: nombrePlan(reparto) })}</h2>
                <p style={{ margin: '0 0 16px', color: V('muted'), fontSize: rem(15), lineHeight: 1.6 }}>
                  {tx('Para el supermercado que lleva la compra a casa y el distribuidor que reparte a negocios. Se paga por repartidor que haya tenido pedidos en el mes; las furgonetas, las tiendas y los usuarios no se cobran.')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <label htmlFor="repartidores" style={{ fontSize: rem(15), color: V('text'), fontWeight: 600 }}>{tx('¿Cuántos repartidores tenéis?')}</label>
                  <input id="repartidores" type="number" min="1" max="5000" value={repartidores} aria-label={tx('Número de repartidores')}
                    onChange={(e) => setRepartidores(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
                    style={campoNum} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                  <span className="ld-titular" style={{ fontSize: rem(40) }}>{euros(mostradoRep)}</span>
                  <span style={sufijo}>{tx('/mes')}</span>
                </div>
                <div style={{ fontSize: rem(14), color: V('muted'), marginTop: 4 }}>
                  {porRep !== Number(reparto.por_repartidor)
                    ? <><s>{euros(reparto.por_repartidor)}</s> <b style={{ color: V('ok') }}>{euros(porRep)}</b> {tx('por repartidor activo y mes')}</>
                    : <>{euros(reparto.por_repartidor)} {tx('por repartidor activo y mes')}</>}
                  {repartidores < minRep && <span> · {tx('mínimo {n}', { n: minRep })}</span>}
                </div>
                {billing === 'annual' && (
                  <div style={{ fontSize: rem(14), color: V('ok'), fontWeight: 700, marginTop: 4 }}>{tx('{precio}/año · ahorras {ahorro}', { precio: euros(mesRep * MESES_ANUAL), ahorro: euros(mesRep * (12 - MESES_ANUAL)) })}</div>
                )}
                <a href={`/registro?sector=supermercado&plan=reparto&billing=${billing}&repartidores=${repartidores}`}
                  onClick={() => medirAccion('plan_elegir')}
                  className={`${BTN_SECUNDARIO} mt-4`}>
                  {tx('Empezar la prueba de {n} días', { n: DIAS_PRUEBA_EMPRESA })} <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                {(reparto.incluye || []).map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: rem(14.5), color: V('text2'), lineHeight: 1.45 }}>
                    <Check size={15} color="var(--ld-ok)" style={{ flexShrink: 0, marginTop: 2 }} /> {tx(f)}
                  </li>
                ))}
                {(reparto.no_incluye || []).map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: rem(14), color: V('muted'), lineHeight: 1.45 }}>
                    <span aria-hidden="true" style={{ fontSize: rem(14), lineHeight: 1.45, flexShrink: 0 }}>✕</span> {tx(f)}
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}

        {/* Complementos: paga más y obtén… */}
        <h2 className="ld-titular" style={{ fontSize: rem(30), margin: '56px 0 6px' }}>{tx('Complementos')}</h2>
        <p style={{ color: V('muted'), fontSize: rem(15), margin: '0 0 16px' }}>{tx('Se añaden a cualquier plan cuando os hagan falta.')}</p>
        <div data-testid="planes-complementos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(250px,100%),1fr))', gap: 14, marginBottom: 36 }}>
          {complementos.map((c) => (
            <div key={c.clave} style={{ ...tarjeta, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: rem(16), fontWeight: 700, marginBottom: 4 }}>{tx(c.nombre)}</div>
              <div style={{ fontSize: rem(14), fontWeight: 700, color: V('accent'), marginBottom: 6 }}>{tx(c.precio)}</div>
              <div style={{ fontSize: rem(14), color: V('muted'), lineHeight: 1.5 }}>{tx(c.que)}</div>
            </div>
          ))}
        </div>

        {/* Lo que siempre se pregunta */}
        <h2 className="ld-titular" style={{ fontSize: rem(30), margin: '0 0 16px' }}>{tx('Cómo se cuenta')}</h2>
        <div data-testid="planes-reglas" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 14, marginBottom: 36 }}>
          {REGLAS.map(([q, a]) => (
            <div key={q} style={{ ...tarjeta, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: rem(16), fontWeight: 700, marginBottom: 6 }}>{tx(q)}</div>
              <div style={{ fontSize: rem(14.5), color: V('muted'), lineHeight: 1.55 }}>{tx(a)}</div>
            </div>
          ))}
        </div>

        {/* El repartidor que va solo: otro producto, otra tarifa */}
        <div style={{ ...tarjeta, padding: '22px 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontSize: rem(16), fontWeight: 700, marginBottom: 4 }}>{tx('¿Repartes tú solo?')}</div>
            <div style={{ fontSize: rem(15), color: V('muted') }}>
              {conPromo
                ? tx('La app de ruta para quien reparte por su cuenta: sin límite hasta el {fecha}, sin tarjeta. Después, sin pagar hasta {n} paradas al día; sin tope, {mes} al mes o {ano} al año.', { fecha: fechaFin, n: paradas, mes: euros(autonomo.mensual), ano: euros(autonomo.anual) })
                : tx('La app de ruta para quien reparte por su cuenta: sin pagar hasta {n} paradas al día, sin tarjeta. Sin tope, {mes} al mes o {ano} al año.', { n: paradas, mes: euros(autonomo.mensual), ano: euros(autonomo.anual) })}
            </div>
          </div>
          <a href="/repartidores" className={BTN_SECUNDARIO}>
            {tx('Ver la app de reparto')} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <p style={{ marginTop: 40, textAlign: 'center', color: V('muted'), fontSize: rem(14) }}>
          {tx('Precios sin IVA.')} <a href="/contacto" style={{ color: V('accent'), fontWeight: 600 }}>{tx('¿Dudas? Escríbenos')}</a>
        </p>
      </div>
      {/* El pie de la portada: el idioma (el mismo selector), día o noche, y el aviso legal (LSSI art. 10). */}
      <Pie lang={lang} tema={tema} setTema={setTema} />
    </div>
  )
}
