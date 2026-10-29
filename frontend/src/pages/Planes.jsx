import { useTitulo } from '../lib/titulo'
import { useEffect, useState } from 'react'
import { LANGS, useT } from '../i18n'
import { Check, ArrowRight } from 'lucide-react'
import { API_BASE } from '../lib/apiBase'
import { medirAccion } from '../lib/analitica'
import { MARCA } from '../marca'
import { PLANES_EMPRESA, PLAN_REPARTO, DESCUENTOS_VOLUMEN, COMPLEMENTOS, REGLAS, MESES_ANUAL, PARADAS_GRATIS, promoGratis, fechaPromo, precioMes, precioVehiculo, descuentoVolumen, eur } from '../lib/precios'

/* Tarifa POR VEHÍCULO, con usuarios y conductores ilimitados. Los planes, los
   descuentos y los complementos viven en lib/precios.js (y su porqué, en
   docs/PRECIOS.md); los de verdad llegan de /billing/planes. */
const AUTONOMO = { clave: 'autonomo', nombre: 'Repartidor', mensual: 9.99, anual: 99, dias_prueba: 7 }
const precioAnual = (p, n, tramos) => precioMes(p, n, tramos) * MESES_ANUAL
const ahorroAnual = (p, n, tramos) => precioMes(p, n, tramos) * (12 - MESES_ANUAL)
const tarjeta = { background: '#13161b', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20 }

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

  const inputS = { background: '#0b0d10', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#eef1f6', outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(145deg,rgba(245,158,11,.10),rgba(249,115,22,.05)), #13161b', border: '1.5px solid rgba(245,158,11,.35)', borderRadius: 20, padding: '26px 28px', marginBottom: 36, boxShadow: '0 0 50px rgba(245,158,11,.08)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ minWidth: 260, flex: '1 1 320px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,.15)', borderRadius: 99, padding: '4px 12px', fontSize: 11, fontWeight: 800, color: '#fbbf24', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            ⭐ Oferta fundador {slots && slots.left < slots.total ? `· quedan ${slots.left} de ${slots.total} plazas` : '· plazas limitadas'}
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>
            El plan Pro a <span style={{ color: '#fbbf24' }}>6 € por vehículo, congelado 24 meses</span>
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.6, maxWidth: 520 }}>
            Todo Pro (9 €/vehículo): delegaciones ilimitadas, quién causa los golpes, cuadrante y turnos, plantilla y exportación.
            Solo para las 10 primeras empresas, <b style={{ color: '#cbd3e0' }}>sin subidas durante dos años</b>. Se suma al pago anual.
            Reservar es gratis y sin compromiso: te llamamos y lo activamos juntos.
          </p>
        </div>

        <div style={{ flex: '0 1 340px', minWidth: 280 }}>
          {done ? (
            <div style={{ background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', marginBottom: 4 }}>Plaza reservada</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Te contactamos en menos de 24h para activarla. Sin compromiso.</div>
            </div>
          ) : open ? (
            <form onSubmit={reserve} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inputS} placeholder="Tu nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <input style={inputS} type="email" placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputS} placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input style={inputS} placeholder="Nº de vehículos" value={form.fleet_size} onChange={e => setForm(f => ({ ...f, fleet_size: e.target.value }))} />
              </div>
              {err && <div style={{ fontSize: 12, color: '#f87171' }}>{err}</div>}
              <button type="submit" disabled={busy} style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 11, padding: '12px 0', fontSize: 14, fontWeight: 900, color: '#0b0d10', cursor: 'pointer', opacity: busy ? .6 : 1 }}>
                {busy ? 'Reservando…' : 'Confirmar reserva gratuita'}
              </button>
            </form>
          ) : (
            <button onClick={() => { medirAccion('fundador_abrir'); setOpen(true) }} style={{ width: '100%', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 12, padding: '15px 24px', fontSize: 15, fontWeight: 900, color: '#0b0d10', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 30px rgba(245,158,11,.25)' }}>
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
    <div style={{ minHeight: '100vh', background: 'radial-gradient(1100px 560px at 72% -12%,rgba(20,231,216,.10),transparent),#0b0d10', color: '#eef1f6', fontFamily: 'Inter Variable,Inter,system-ui,sans-serif', padding: '20px 16px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#eef1f6' }}>
            <img src="/favicon.svg" alt="" width="32" height="32" style={{ borderRadius: 9 }} />
            <b style={{ fontSize: 16 }}>{MARCA.nombre}</b>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ background: '#13161b', color: '#e7ebf2', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '6px 10px', fontSize: 13 }}>
              {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <a href="/panel/login" style={{ color: '#8b94a3', fontSize: 13, textDecoration: 'none' }}>Entrar</a>
          </div>
        </nav>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(20,231,216,.12)', border: '1px solid rgba(20,231,216,.3)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: '#14E7D8', marginBottom: 16, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            ✨ 14 días gratis · sin tarjeta
          </div>
          <h1 style={{ fontSize: 'clamp(28px,5vw,44px)', fontWeight: 900, margin: '0 0 12px', lineHeight: 1.1 }}>
            Se paga por vehículo. La gente, gratis.
          </h1>
          <p style={{ color: '#8b94a3', fontSize: 16, maxWidth: 560, margin: '0 auto 24px' }}>
            Usuarios de oficina y conductores ilimitados en todos los planes. Sin instalar nada en las furgonetas.
            Mensual sin permanencia, o anual con 2 meses gratis.
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#13161b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 4, gap: 4 }}>
            <button onClick={() => setBilling('monthly')}
              style={{ padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: billing === 'monthly' ? '#1e293b' : 'transparent', color: billing === 'monthly' ? '#eef1f6' : '#64748b' }}>
              Mensual
            </button>
            <button onClick={() => setBilling('annual')}
              style={{ padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, background: billing === 'annual' ? '#1e293b' : 'transparent', color: billing === 'annual' ? '#eef1f6' : '#64748b' }}>
              Anual
              <span style={{ background: 'rgba(52,211,153,.15)', color: '#34d399', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>2 meses gratis</span>
            </button>
          </div>
        </div>

        <FounderOffer />

        {/* Cuántos vehículos tienes: el precio se calcula con TU flota */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ ...tarjeta, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center', padding: '14px 22px' }}>
            <label htmlFor="flota" style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>¿Cuántos vehículos tienes?</label>
            <input id="flota" type="range" min="5" max="400" step="5" value={furgonetas}
              onChange={(e) => setFurgonetas(Number(e.target.value))} style={{ width: 220, accentColor: '#14E7D8' }} />
            <input type="number" min="1" max="5000" value={furgonetas} aria-label="Número de vehículos"
              onChange={(e) => setFurgonetas(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
              style={{ width: 80, background: '#0b0d10', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '8px 10px', color: '#eef1f6', fontSize: 15, fontWeight: 800, textAlign: 'center' }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: pct ? '#34d399' : '#64748b' }}>
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
                background: p.recomendado ? 'linear-gradient(145deg,#0f172a,#0c1929)' : '#13161b',
                border: p.recomendado ? `2px solid ${p.color}` : tarjeta.border,
                padding: '28px 24px', position: 'relative', display: 'flex', flexDirection: 'column',
                boxShadow: p.recomendado ? `0 0 40px ${p.color}22` : 'none',
              }}>
                {p.recomendado && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: p.color, borderRadius: 20, padding: '3px 14px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', color: '#0b0d10' }}>
                    Recomendado
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{p.nombre}</div>
                  <div style={{ fontSize: 13, color: '#8b94a3', marginBottom: 16 }}>{p.para}</div>
                  {aMedida ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 15, color: '#8b94a3' }}>desde</span>
                        <span style={{ fontSize: 44, fontWeight: 900 }}>{p.desde || 12}€</span>
                        <span style={{ color: '#8b94a3', fontSize: 14 }}>/vehículo</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#8b94a3', marginTop: 4 }}>A medida: lo cerramos con vosotros</div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 44, fontWeight: 900 }}>{eur(mostrado)}€</span>
                        <span style={{ color: '#8b94a3', fontSize: 14 }}>/mes</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#8b94a3', marginTop: 4 }}>
                        {porVeh !== p.por_vehiculo
                          ? <><s>{eur(p.por_vehiculo)}€</s> <b style={{ color: '#34d399' }}>{eur(porVeh)}€</b> por vehículo y mes</>
                          : <>{eur(p.por_vehiculo)}€ por vehículo y mes</>}
                        {minimo && <span style={{ color: '#64748b' }}> · mínimo {p.minimo_vehiculos}</span>}
                      </div>
                      {billing === 'annual' && (
                        <div style={{ fontSize: 12, color: '#34d399', fontWeight: 700, marginTop: 4 }}>
                          {eur(precioAnual(p, furgonetas, tramos))}€/año · ahorras {eur(ahorroAnual(p, furgonetas, tramos))}€
                        </div>
                      )}
                    </>
                  )}
                </div>

                <a href={aMedida ? '/contacto?asunto=Plan%20Empresa' : `/registro?plan=${p.clave}&billing=${billing}&flota=${furgonetas}`}
                  onClick={() => medirAccion('plan_elegir')}
                  style={{
                    display: 'block', textAlign: 'center', padding: '12px 0', borderRadius: 12, fontWeight: 800, fontSize: 14,
                    textDecoration: 'none', marginBottom: 24,
                    background: p.recomendado ? `linear-gradient(135deg,${p.color},${p.color}cc)` : 'transparent',
                    color: p.recomendado ? '#0b0d10' : p.color, border: p.recomendado ? 'none' : `1.5px solid ${p.color}`,
                  }}>
                  {aMedida ? 'Hablamos →' : 'Empezar 14 días gratis →'}
                </a>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {(p.incluye || []).map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#cbd5e1', lineHeight: 1.45 }}>
                      <Check size={14} color={p.color} style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                    </li>
                  ))}
                  {(p.no_incluye || []).map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
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
            <div id="reparto" style={{ ...tarjeta, border: `1.5px solid ${reparto.color}55`, padding: '26px 28px', marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: reparto.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>¿Repartís vuestra propia mercancía?</div>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.2 }}>Plan {reparto.nombre}: por repartidor, con las furgonetas incluidas</h2>
                <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                  Para el supermercado que lleva la compra a casa y el distribuidor que reparte a negocios. Se paga por repartidor que haya tenido pedidos en el mes; las furgonetas, las tiendas y los usuarios no se cobran.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <label htmlFor="repartidores" style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>¿Cuántos repartidores tenéis?</label>
                  <input id="repartidores" type="number" min="1" max="5000" value={repartidores} aria-label="Número de repartidores"
                    onChange={(e) => setRepartidores(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
                    style={{ width: 80, background: '#0b0d10', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '8px 10px', color: '#eef1f6', fontSize: 15, fontWeight: 800, textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 40, fontWeight: 900 }}>{eur(mostradoRep)}€</span>
                  <span style={{ color: '#8b94a3', fontSize: 14 }}>/mes</span>
                </div>
                <div style={{ fontSize: 12, color: '#8b94a3', marginTop: 4 }}>
                  {porRep !== Number(reparto.por_repartidor)
                    ? <><s>{eur(reparto.por_repartidor)}€</s> <b style={{ color: '#34d399' }}>{eur(porRep)}€</b> por repartidor activo y mes</>
                    : <>{eur(reparto.por_repartidor)}€ por repartidor activo y mes</>}
                  {repartidores < minRep && <span style={{ color: '#64748b' }}> · mínimo {minRep}</span>}
                </div>
                {billing === 'annual' && (
                  <div style={{ fontSize: 12, color: '#34d399', fontWeight: 700, marginTop: 4 }}>{eur(mesRep * MESES_ANUAL)}€/año · ahorras {eur(mesRep * (12 - MESES_ANUAL))}€</div>
                )}
                <a href={`/registro?sector=supermercado&plan=reparto&billing=${billing}&repartidores=${repartidores}`}
                  onClick={() => medirAccion('plan_elegir')}
                  style={{ display: 'inline-block', marginTop: 16, padding: '12px 22px', borderRadius: 12, fontWeight: 800, fontSize: 14, textDecoration: 'none', background: `linear-gradient(135deg,${reparto.color},${reparto.color}cc)`, color: '#0b0d10' }}>
                  Empezar 14 días gratis →
                </a>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                {(reparto.incluye || []).map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#cbd5e1', lineHeight: 1.45 }}>
                    <Check size={14} color={reparto.color} style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                  </li>
                ))}
                {(reparto.no_incluye || []).map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}

        {/* Complementos: paga más y obtén… */}
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: '40px 0 6px' }}>Complementos</h2>
        <p style={{ color: '#8b94a3', fontSize: 14, margin: '0 0 16px' }}>Se añaden a cualquier plan cuando os hagan falta.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14, marginBottom: 36 }}>
          {complementos.map((c) => (
            <div key={c.clave} style={{ ...tarjeta, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{c.nombre}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#14E7D8', marginBottom: 6 }}>{c.precio}</div>
              <div style={{ fontSize: 12.5, color: '#8b94a3', lineHeight: 1.5 }}>{c.que}</div>
            </div>
          ))}
        </div>

        {/* Lo que siempre se pregunta */}
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 16px' }}>Cómo se cuenta</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginBottom: 36 }}>
          {REGLAS.map(([q, a]) => (
            <div key={q} style={{ ...tarjeta, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{q}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* El repartidor que va solo: otro producto, otra tarifa */}
        <div style={{ ...tarjeta, padding: '22px 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>¿Repartes tú solo?</div>
            <div style={{ fontSize: 15, color: '#cbd5e1' }}>
              La app de ruta para quien reparte por su cuenta: {('gratis_hasta' in autonomo ? !!autonomo.gratis_hasta : promoGratis())
                ? <><b>gratis y sin límite hasta el {fechaPromo('es-ES', autonomo.gratis_hasta || undefined)}</b>, sin tarjeta. Después, gratis hasta {autonomo.paradas_gratis || PARADAS_GRATIS} paradas al día; sin tope, {eur(autonomo.mensual)}€ al mes o {eur(autonomo.anual)}€ al año.</>
                : <><b>gratis hasta {autonomo.paradas_gratis || PARADAS_GRATIS} paradas al día</b>, sin tarjeta. Sin tope, {eur(autonomo.mensual)}€ al mes o {eur(autonomo.anual)}€ al año.</>}
            </div>
          </div>
          <a href="/repartidores" style={{ padding: '11px 22px', borderRadius: 12, border: '1.5px solid #eab308', color: '#eab308', fontWeight: 800, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Ver la app de reparto →
          </a>
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: 13 }}>
            Precios sin IVA. ¿Dudas? <a href="/contacto" style={{ color: '#0FC2BC', textDecoration: 'none' }}>Contacta con nosotros</a>.
          </p>
          {/* LSSI art. 10: el aviso legal accesible desde cada página pública. */}
          <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
            {[['/aviso-legal', 'Aviso legal'], ['/privacidad', 'Privacidad'], ['/terminos', 'Términos'], ['/cookies', 'Cookies']].map(([h, t], i) => (
              <span key={h}>{i > 0 && ' · '}<a href={h} style={{ color: '#64748b' }}>{t}</a></span>
            ))}
          </p>
        </div>
      </div>
    </div>
  )
}
