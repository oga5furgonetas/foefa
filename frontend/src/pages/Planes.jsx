import { useTitulo } from '../lib/titulo'
import { useEffect, useState } from 'react'
import { LANGS, useT } from '../i18n'
import { Check, ArrowRight } from 'lucide-react'
import { API_BASE } from '../lib/apiBase'
import { medirAccion } from '../lib/analitica'
import { BTN_SECUNDARIO, CabeceraSimple, useTemaWeb } from './portadaComun'
import { PLANES_EMPRESA, PLAN_REPARTO, DESCUENTOS_VOLUMEN, COMPLEMENTOS, REGLAS, MESES_ANUAL, PARADAS_GRATIS, promoGratis, fechaPromo, precioMes, precioVehiculo, descuentoVolumen, eur } from '../lib/precios'

/* Tarifa POR VEHÍCULO, con usuarios y conductores ilimitados. Los planes, los
   descuentos y los complementos viven en lib/precios.js (y su porqué, en
   docs/PRECIOS.md); los de verdad llegan de /billing/planes.
   IDENTIDAD (14-11-2026): la de la portada (tinta sobre papel, día por defecto y la noche con su paleta): los colores
   salen de las variables --ld-* de index.css; sin degradados, brillos, emojis ni rótulos en mayúsculas espaciadas. El
   color de cada plan (lib/precios.js) ya no pinta texto: en papel no se leía. */
const AUTONOMO = { clave: 'autonomo', nombre: 'Repartidor', mensual: 9.99, anual: 99, dias_prueba: 7 }
const precioAnual = (p, n, tramos) => precioMes(p, n, tramos) * MESES_ANUAL
const ahorroAnual = (p, n, tramos) => precioMes(p, n, tramos) * (12 - MESES_ANUAL)
const V = (n) => `var(--ld-${n})`
const tarjeta = { background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 20 }
const campoNum = { width: 84, height: 44, background: V('surface'), border: `1px solid ${V('border-strong')}`, borderRadius: 10, padding: '0 10px', color: V('text'), fontSize: 16, fontWeight: 600, textAlign: 'center', fontFamily: 'IBM Plex Mono, ui-monospace, monospace' }

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
      if (!r.ok) throw new Error(j?.detail || 'No se pudo reservar')
      medirAccion('fundador_reservado')
      setDone(true)
      if (typeof j.left === 'number') setSlots(s => ({ ...(s || { total: 10 }), left: j.left }))
    } catch (e2) {
      setErr(e2.message)
    } finally { setBusy(false) }
  }

  if (slots && slots.left <= 0) return null   // agotadas: la oferta desaparece sola

  const inputS = { background: V('surface'), border: `1px solid ${V('border-strong')}`, borderRadius: 10, padding: '0 12px', height: 44, fontSize: 15, color: V('text'), outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'relative', background: V('surface'), border: `1.5px solid ${V('ambar')}`, borderRadius: 20, padding: '26px 28px', marginBottom: 36 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ minWidth: 260, flex: '1 1 320px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: V('ambar'), borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 700, color: '#10181A', marginBottom: 12 }}>
            Oferta fundador {slots && slots.left < slots.total ? `· quedan ${slots.left} de ${slots.total} plazas` : '· plazas limitadas'}
          </div>
          <h2 className="ld-titular" style={{ margin: '0 0 8px', fontSize: 26, lineHeight: 1.15 }}>
            El plan Pro a 6 € por vehículo, congelado 24 meses
          </h2>
          <p style={{ margin: 0, color: V('muted'), fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>
            Todo Pro (9 €/vehículo): delegaciones ilimitadas, qué furgoneta lleva cada uno, cuadrante y turnos, plantilla y exportación.
            Solo para las 10 primeras empresas, <b style={{ color: V('text') }}>sin subidas durante dos años</b>. Se suma al pago anual.
            Reservar es gratis y sin compromiso: te llamamos y lo activamos juntos.
          </p>
        </div>

        <div style={{ flex: '0 1 340px', minWidth: 280 }}>
          {done ? (
            <div style={{ border: `1px solid ${V('border-strong')}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: V('ok'), marginBottom: 4 }}>Plaza reservada</div>
              <div style={{ fontSize: 14, color: V('muted') }}>Te contactamos en menos de 24h para activarla. Sin compromiso.</div>
            </div>
          ) : open ? (
            <form onSubmit={reserve} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inputS} placeholder="Tu nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <input style={inputS} type="email" placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputS} placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input style={inputS} placeholder="Nº de vehículos" value={form.fleet_size} onChange={e => setForm(f => ({ ...f, fleet_size: e.target.value }))} />
              </div>
              {err && <div style={{ fontSize: 14, fontWeight: 600, color: V('warn') }}>{err}</div>}
              <button type="submit" disabled={busy} className={BTN_SECUNDARIO}>
                {busy ? 'Reservando…' : 'Confirmar reserva gratuita'}
              </button>
            </form>
          ) : (
            <button onClick={() => { medirAccion('fundador_abrir'); setOpen(true) }} className={`${BTN_SECUNDARIO} w-full`}>
              Reservar mi plaza fundador <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Planes() {
  useTitulo('Planes y precios')
  const { lang, setLang } = useT()
  const [tema] = useTemaWeb()
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

  return (
    <div className="ld-root font-sans antialiased" data-theme={tema} style={{ minHeight: '100vh' }}>
      <CabeceraSimple>
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Idioma / Language" style={{ height: 40, background: V('surface'), color: V('text'), border: `1px solid ${V('border-strong')}`, borderRadius: 10, padding: '0 10px', fontSize: 14 }}>
          {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <a href="/panel/login" className="inline-flex min-h-[44px] items-center px-1 text-[15px] font-medium text-[color:var(--ld-text)] underline-offset-4 hover:underline">Entrar</a>
      </CabeceraSimple>
      <div style={{ maxWidth: 1136, margin: '0 auto', padding: '48px 16px 80px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: V('accent'), marginBottom: 14 }}>14 días de prueba, sin tarjeta</p>
          <h1 className="ld-titular" style={{ fontSize: 'clamp(32px,5vw,52px)', margin: '0 auto 14px', lineHeight: 1.04, maxWidth: 820 }}>
            Se paga por vehículo. Usuarios y conductores, sin límite.
          </h1>
          <p style={{ color: V('muted'), fontSize: 17, maxWidth: 560, margin: '0 auto 24px' }}>
            Usuarios de oficina y conductores ilimitados en todos los planes. Sin instalar nada en las furgonetas.
            Mensual sin permanencia, o anual con 2 meses gratis.
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'center', background: V('surface'), border: `1px solid ${V('border-strong')}`, borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setBilling('monthly')}
              aria-pressed={billing === 'monthly'} style={{ minHeight: 40, padding: '0 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, background: billing === 'monthly' ? V('text') : 'transparent', color: billing === 'monthly' ? V('bg') : V('muted') }}>
              Mensual
            </button>
            <button onClick={() => setBilling('annual')}
              aria-pressed={billing === 'annual'} style={{ minHeight: 40, padding: '0 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, background: billing === 'annual' ? V('text') : 'transparent', color: billing === 'annual' ? V('bg') : V('muted') }}>
              Anual
              <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: billing === 'annual' ? V('bg') : V('ok') }}>pagas 10 meses</span>
            </button>
          </div>
        </div>

        <FounderOffer />

        {/* Cuántos vehículos tienes: el precio se calcula con TU flota */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ ...tarjeta, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center', padding: '14px 22px' }}>
            <label htmlFor="flota" style={{ fontSize: 15, color: V('text'), fontWeight: 600 }}>¿Cuántos vehículos tienes?</label>
            <input id="flota" type="range" min="5" max="400" step="5" value={furgonetas}
              onChange={(e) => setFurgonetas(Number(e.target.value))} style={{ width: 220, accentColor: 'var(--ld-text)' }} />
            <input type="number" min="1" max="5000" value={furgonetas} aria-label="Número de vehículos"
              onChange={(e) => setFurgonetas(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
              style={campoNum} />
            <span style={{ fontSize: 14, fontWeight: 600, color: pct ? V('ok') : V('muted') }}>
              {pct ? `−${pct} % por volumen` : `Desde ${tramos[0]?.desde || 50} vehículos, −${tramos[0]?.pct || 10} %`}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 20, marginBottom: 28 }}>
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
                  <div style={{ position: 'absolute', top: -13, left: 24, background: V('text'), borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: V('bg') }}>
                    Recomendado
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 4 }}>{p.nombre}</div>
                  <div style={{ fontSize: 14, color: V('muted'), marginBottom: 16 }}>{p.para}</div>
                  {aMedida ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 15, color: V('muted') }}>desde</span>
                        <span className="ld-titular" style={{ fontSize: 44 }}>{p.desde || 12}€</span>
                        <span style={{ color: V('muted'), fontSize: 15 }}>/vehículo</span>
                      </div>
                      <div style={{ fontSize: 14, color: V('muted'), marginTop: 4 }}>A medida: lo cerramos con vosotros</div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span className="ld-titular" style={{ fontSize: 44 }}>{eur(mostrado)}€</span>
                        <span style={{ color: V('muted'), fontSize: 15 }}>/mes</span>
                      </div>
                      <div style={{ fontSize: 14, color: V('muted'), marginTop: 4 }}>
                        {porVeh !== p.por_vehiculo
                          ? <><s>{eur(p.por_vehiculo)}€</s> <b style={{ color: V('ok') }}>{eur(porVeh)}€</b> por vehículo y mes</>
                          : <>{eur(p.por_vehiculo)}€ por vehículo y mes</>}
                        {minimo && <span> · mínimo {p.minimo_vehiculos}</span>}
                      </div>
                      {billing === 'annual' && (
                        <div style={{ fontSize: 14, color: V('ok'), fontWeight: 700, marginTop: 4 }}>
                          {eur(precioAnual(p, furgonetas, tramos))}€/año · ahorras {eur(ahorroAnual(p, furgonetas, tramos))}€
                        </div>
                      )}
                    </>
                  )}
                </div>

                <a href={aMedida ? '/contacto?asunto=Plan%20Empresa' : `/registro?plan=${p.clave}&billing=${billing}&flota=${furgonetas}`}
                  onClick={() => medirAccion('plan_elegir')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 12, fontWeight: 700, fontSize: 16,
                    textDecoration: 'none', marginBottom: 24,
                    background: p.recomendado ? V('firma') : 'transparent',
                    color: p.recomendado ? V('tinta-firma') : V('text'), border: p.recomendado ? '1.5px solid transparent' : `1.5px solid ${V('border-strong')}`,
                  }}>
                  {aMedida ? 'Hablamos →' : 'Empezar la prueba de 14 días →'}
                </a>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {(p.incluye || []).map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14.5, color: V('text2'), lineHeight: 1.45 }}>
                      <Check size={15} color="var(--ld-ok)" style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                    </li>
                  ))}
                  {(p.no_incluye || []).map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: V('muted') }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span> {f}
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
            <div id="reparto" style={{ ...tarjeta, padding: '26px 28px', marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: V('accent'), marginBottom: 6 }}>¿Repartís vuestra propia mercancía?</div>
                <h2 className="ld-titular" style={{ fontSize: 26, margin: '0 0 8px', lineHeight: 1.15 }}>Plan {reparto.nombre}: por repartidor, con las furgonetas incluidas</h2>
                <p style={{ margin: '0 0 16px', color: V('muted'), fontSize: 15, lineHeight: 1.6 }}>
                  Para el supermercado que lleva la compra a casa y el distribuidor que reparte a negocios. Se paga por repartidor que haya tenido pedidos en el mes; las furgonetas, las tiendas y los usuarios no se cobran.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <label htmlFor="repartidores" style={{ fontSize: 15, color: V('text'), fontWeight: 600 }}>¿Cuántos repartidores tenéis?</label>
                  <input id="repartidores" type="number" min="1" max="5000" value={repartidores} aria-label="Número de repartidores"
                    onChange={(e) => setRepartidores(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
                    style={campoNum} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="ld-titular" style={{ fontSize: 40 }}>{eur(mostradoRep)}€</span>
                  <span style={{ color: V('muted'), fontSize: 15 }}>/mes</span>
                </div>
                <div style={{ fontSize: 14, color: V('muted'), marginTop: 4 }}>
                  {porRep !== Number(reparto.por_repartidor)
                    ? <><s>{eur(reparto.por_repartidor)}€</s> <b style={{ color: V('ok') }}>{eur(porRep)}€</b> por repartidor activo y mes</>
                    : <>{eur(reparto.por_repartidor)}€ por repartidor activo y mes</>}
                  {repartidores < minRep && <span> · mínimo {minRep}</span>}
                </div>
                {billing === 'annual' && (
                  <div style={{ fontSize: 14, color: V('ok'), fontWeight: 700, marginTop: 4 }}>{eur(mesRep * MESES_ANUAL)}€/año · ahorras {eur(mesRep * (12 - MESES_ANUAL))}€</div>
                )}
                <a href={`/registro?sector=supermercado&plan=reparto&billing=${billing}&repartidores=${repartidores}`}
                  onClick={() => medirAccion('plan_elegir')}
                  className={`${BTN_SECUNDARIO} mt-4`}>
                  Empezar la prueba de 14 días →
                </a>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                {(reparto.incluye || []).map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14.5, color: V('text2'), lineHeight: 1.45 }}>
                    <Check size={15} color="var(--ld-ok)" style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                  </li>
                ))}
                {(reparto.no_incluye || []).map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: V('muted') }}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}

        {/* Complementos: paga más y obtén… */}
        <h2 className="ld-titular" style={{ fontSize: 30, margin: '56px 0 6px' }}>Complementos</h2>
        <p style={{ color: V('muted'), fontSize: 15, margin: '0 0 16px' }}>Se añaden a cualquier plan cuando os hagan falta.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14, marginBottom: 36 }}>
          {complementos.map((c) => (
            <div key={c.clave} style={{ ...tarjeta, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{c.nombre}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: V('accent'), marginBottom: 6 }}>{c.precio}</div>
              <div style={{ fontSize: 14, color: V('muted'), lineHeight: 1.5 }}>{c.que}</div>
            </div>
          ))}
        </div>

        {/* Lo que siempre se pregunta */}
        <h2 className="ld-titular" style={{ fontSize: 30, margin: '0 0 16px' }}>Cómo se cuenta</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginBottom: 36 }}>
          {REGLAS.map(([q, a]) => (
            <div key={q} style={{ ...tarjeta, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{q}</div>
              <div style={{ fontSize: 14.5, color: V('muted'), lineHeight: 1.55 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* El repartidor que va solo: otro producto, otra tarifa */}
        <div style={{ ...tarjeta, padding: '22px 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>¿Repartes tú solo?</div>
            <div style={{ fontSize: 15, color: V('muted') }}>
              La app de ruta para quien reparte por su cuenta: {('gratis_hasta' in autonomo ? !!autonomo.gratis_hasta : promoGratis())
                ? <><b>gratis y sin límite hasta el {fechaPromo('es-ES', autonomo.gratis_hasta || undefined)}</b>, sin tarjeta. Después, gratis hasta {autonomo.paradas_gratis || PARADAS_GRATIS} paradas al día; sin tope, {eur(autonomo.mensual)}€ al mes o {eur(autonomo.anual)}€ al año.</>
                : <><b>gratis hasta {autonomo.paradas_gratis || PARADAS_GRATIS} paradas al día</b>, sin tarjeta. Sin tope, {eur(autonomo.mensual)}€ al mes o {eur(autonomo.anual)}€ al año.</>}
            </div>
          </div>
          <a href="/repartidores" className={BTN_SECUNDARIO}>
            Ver la app de reparto →
          </a>
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ color: V('muted'), fontSize: 14 }}>
            Precios sin IVA. ¿Dudas? <a href="/contacto" style={{ color: V('accent'), fontWeight: 600 }}>Contacta con nosotros</a>.
          </p>
          {/* LSSI art. 10: el aviso legal accesible desde cada página pública. */}
          <p style={{ color: V('muted'), fontSize: 14, marginTop: 8 }}>
            {[['/aviso-legal', 'Aviso legal'], ['/privacidad', 'Privacidad'], ['/terminos', 'Términos'], ['/cookies', 'Cookies']].map(([h, t], i) => (
              <span key={h}>{i > 0 && ' · '}<a href={h} style={{ color: V('muted') }}>{t}</a></span>
            ))}
          </p>
        </div>
      </div>
    </div>
  )
}
