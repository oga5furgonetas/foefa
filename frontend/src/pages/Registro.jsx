import { useState } from 'react'
import { enAppPlay } from '../lib/enApp'
import { evento } from '../lib/metaPixel'
import { regionDelMovil } from '../lib/region'

import { API_BASE } from '../services/api'
import { medirAccion } from '../lib/analitica'
import { saveSession } from '../panel/auth'
import { useT, LANGS } from '../i18n'
import { Check, Zap, Package, ShoppingCart, Warehouse, Truck, User, Send } from 'lucide-react'
import { MARCA, dominio } from '../marca'

function slugify(s) {
  return (s || '').toLowerCase().trim()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

/* Tarifa POR FURGONETA — misma fuente que /planes y que el backend.
   Si cambias esto, cambialo tambien en PLAN_TARIFAS de server.py. */
const PLANS = [
  {
    // Precio FIJO al mes, no por vehículo: una persona con su furgoneta. Se
    // elige solo al marcar «Repartidor autónomo»; no sale en el selector.
    key: 'autonomo', name: 'Repartidor', color: '#eab308', mensual: 9.99, minimo: 0, porVehiculo: 0,
    popular: false, soloSector: 'autonomo', diasPrueba: 7, who: 'Repartes tú mismo',
    feats: ['Escanear paquetes o foto de la etiqueta: dirección y teléfono solos',
            'Ruta ordenada por tiempo, con franjas y hora estimada',
            'Llamar y WhatsApp al cliente desde cada parada',
            'Cobro a la entrega, recogidas y prueba de entrega con foto',
            'Enlace de seguimiento para tus clientes',
            'Tu furgoneta: inspecciones, taller, ITV y seguro'],
    no: ['Equipo de repartidores (eso es el plan Mensajería)'],
  },
  {
    key: 'operacion', name: 'Operación', color: '#64748b',
    porVehiculo: 5, minimo: 20, popular: false,
    who: 'Una sede',
    feats: ['Inspecciones con foto y análisis de daños por IA',
            'Histórico de daños por vehículo',
            'Reparaciones: taller, coste real y cierre',
            'Avisos de mantenimiento e ITV',
            'Portal del conductor', 'Chat de la sede'],
    no: ['Asignación diaria y turnos', 'Informe pericial firmado', 'Exportar datos', 'Varias sedes'],
  },
  {
    key: 'completo', name: 'Completo', color: '#fb923c',
    porVehiculo: 8, minimo: 20, popular: true,
    who: 'Varias sedes',
    feats: ['Todo lo de Operación, sin límite de sedes',
            'Asignación diaria y cuadrante de turnos',
            'Informe pericial firmado y cadena de custodia',
            'Exportar datos'],
    no: [],
  },
]

/* Lo que paga al mes esa flota. Pagando un año se pagan 10 meses. */
const MESES_ANUAL = 10
const precioMes = (p, furgonetas) =>
  p.mensual ?? p.porVehiculo * Math.max(Number(furgonetas) || 0, p.minimo)
const annualM = (p, furgonetas) => Math.round(precioMes(p, furgonetas) * MESES_ANUAL / 12)
const annualSave = (p, furgonetas) => precioMes(p, furgonetas) * (12 - MESES_ANUAL)

/* ── Qué tipo de empresa (paso 0) ──
   Con esto la cuenta nace con las pantallas que le sirven: a un súper que
   lleva la compra a casa le sobra el cuadrante de una subcontrata de
   paquetería, y le falta el escaneo de tickets y la ruta. */
const SECTORES = [
  { key: 'autonomo', icon: User, color: '#eab308', name: 'Repartir yo mismo',
    sub: 'Tu furgoneta y tus paquetes: los escaneas o fotografías la etiqueta, la ruta se ordena sola, llamas o escribes al cliente desde cada parada y cobras si toca. 7 días gratis.' },
  { key: 'dsp_amazon', icon: Package, color: '#fb923c', name: 'DSP de Amazon',
    sub: 'Plantilla del día, DNR diaria, horas (WHC), cuadrante y turnos, asignación de furgonetas, inspecciones con foto e IA, taller y vencimientos. Todo lo de una DSP, sin extensiones ni nada que toque los sistemas de Amazon.' },
  { key: 'mensajeria', icon: Send, color: '#f472b6', name: 'Mensajería y paquetería',
    sub: 'Escaneo de bultos, rutas por tiempo con franjas y hora estimada, seguimiento para el cliente, cobro a la entrega, y turnos y cuadrante del equipo.' },
  { key: 'supermercado', icon: ShoppingCart, color: '#22c55e', name: 'Supermercado o tienda con reparto a domicilio',
    sub: 'El ticket de caja a la ruta: el repartidor escanea, ve la dirección y qué lleva, la ruta se ordena sola y el cliente recibe la hora por WhatsApp.' },
  { key: 'distribucion', icon: Warehouse, color: '#0ea5e9', name: 'Distribución a negocios',
    sub: 'Reparto a talleres, bares u obras: escaneo de bultos por la mañana, zonas por repartidor, ruta ordenada y la oficina viendo por dónde va cada uno.' },
  { key: 'otra', icon: Truck, color: '#a855f7', name: 'Otra flota',
    sub: 'Servicios técnicos, obra, alquiler…: vehículos, conductores, taller y vencimientos.' },
]

function SectorPicker({ onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(1100px 560px at 72% -12%,rgba(14,165,233,.10),transparent),#0b0d10', color: '#eef1f6', fontFamily: 'Inter Variable,Inter,system-ui,sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#eef1f6', marginBottom: 36 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#fb923c,#ea6800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={15} color="white" /></div>
          <b style={{ fontSize: 15 }}>{MARCA.nombre}</b>
        </a>
        <h1 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 900, margin: '0 0 8px', textAlign: 'center' }}>¿Qué vas a hacer con {MARCA.nombre}?</h1>
        <p style={{ color: '#8b94a3', fontSize: 15, margin: '0 0 26px', textAlign: 'center' }}>Así te preparamos las pantallas que vas a usar. Podrás añadir o quitar cosas después.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          {SECTORES.map((s) => (
            <button key={s.key} onClick={() => onSelect(s.key)} style={{ textAlign: 'left', background: '#13161b', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '18px 18px', cursor: 'pointer', color: '#eef1f6' }}>
              <s.icon size={22} color={s.color} />
              <div style={{ fontWeight: 800, fontSize: 15, margin: '10px 0 4px' }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: '#8b94a3', lineHeight: 1.5 }}>{s.sub}</div>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, color: '#8b94a3', fontSize: 13 }}>
          ¿Ya tienes cuenta? <a href="/panel/login" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}>Acceder</a>
        </div>
      </div>
    </div>
  )
}

/* ── Selector de plan (paso 1) ── */
function PlanPicker({ onSelect, furgonetas }) {
  const { lang, setLang } = useT()
  const [billing, setBilling] = useState('monthly')

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(1100px 560px at 72% -12%,rgba(14,165,233,.10),transparent),#0b0d10', color: '#eef1f6', fontFamily: 'Inter Variable,Inter,system-ui,sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#eef1f6' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#fb923c,#ea6800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={15} color="white" /></div>
            <b style={{ fontSize: 15 }}>{MARCA.nombre}</b>
          </a>
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={sel}>
            {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-block', background: 'rgba(14,165,233,.12)', border: '1px solid rgba(14,165,233,.3)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: '#38bdf8', marginBottom: 14 }}>
            ✨ 14 días gratis · sin tarjeta
          </div>
          <h1 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, margin: '0 0 10px' }}>Elige tu plan para empezar</h1>
          <p style={{ color: '#8b94a3', fontSize: 15, margin: '0 0 22px' }}>Los 14 días de prueba son completamente gratis. Sin cobro hasta que decidas continuar.</p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#13161b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setBilling('monthly')} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: billing === 'monthly' ? '#1e293b' : 'transparent', color: billing === 'monthly' ? '#eef1f6' : '#64748b', transition: 'all .2s' }}>
              Mensual
            </button>
            <button onClick={() => setBilling('annual')} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, background: billing === 'annual' ? '#1e293b' : 'transparent', color: billing === 'annual' ? '#eef1f6' : '#64748b', transition: 'all .2s' }}>
              Anual
              <span style={{ background: 'rgba(52,211,153,.15)', color: '#34d399', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>2 meses gratis</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 20 }}>
          {PLANS.filter((p) => !p.soloSector).map((p) => {
            const mes = precioMes(p, furgonetas)
            const price = billing === 'annual' ? annualM(p, furgonetas) : mes
            const save = annualSave(p, furgonetas)
            return (
              <div key={p.key} style={{
                background: p.popular ? 'linear-gradient(145deg,#0f172a,#0c1929)' : '#13161b',
                border: p.popular ? `2px solid ${p.color}` : '1px solid rgba(255,255,255,.08)',
                borderRadius: 18, padding: '24px 20px', position: 'relative', display: 'flex', flexDirection: 'column',
                boxShadow: p.popular ? `0 0 32px ${p.color}20` : 'none',
                cursor: 'pointer', transition: 'transform .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {p.popular && (
                  <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: p.color, borderRadius: 20, padding: '3px 12px', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    Recomendado
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{p.who}</div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: 38, fontWeight: 900 }}>{price}€</span>
                  <span style={{ color: '#64748b', fontSize: 13 }}>/mes</span>
                  {billing === 'annual' && <span style={{ marginLeft: 6, fontSize: 12, color: '#475569', textDecoration: 'line-through' }}>{mes}€</span>}
                </div>
                {/* El precio es por furgoneta: sin esta línea, «200 €/mes» parecía
                    una cuota fija y chocaba con el «desde 5 €» de la portada. */}
                <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 10 }}>
                  {p.porVehiculo}€ por vehículo · con {Math.max(furgonetas, p.minimo)} vehículos
                  {furgonetas < p.minimo && ` (mínimo ${p.minimo})`}
                </div>

                {billing === 'annual' && (
                  <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, marginBottom: 4 }}>{precioMes(p, furgonetas) * MESES_ANUAL}€/año · ahorras {save}€</div>
                )}

                <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {p.feats.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#cbd3e0' }}>
                      <Check size={12} color={p.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                  {p.no.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#3b4456' }}>
                      <span>✕</span> {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onSelect(p.key, billing)}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 10, border: p.popular ? 'none' : `1.5px solid ${p.color}`,
                    cursor: 'pointer', fontWeight: 800, fontSize: 14,
                    background: p.popular ? `linear-gradient(135deg,${p.color},${p.color}cc)` : 'transparent',
                    color: p.popular ? '#fff' : p.color,
                  }}
                >
                  Empezar con {p.name} →
                </button>
              </div>
            )
          })}
        </div>

        {/* Nota upgrade */}
        <div style={{ background: 'rgba(14,165,233,.06)', border: '1px solid rgba(14,165,233,.15)', borderRadius: 12, padding: '12px 18px', textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, color: '#64748b' }}>
            🔄 Puedes cambiar de plan en cualquier momento — solo pagarás la diferencia proporcional a los días restantes
          </span>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, color: '#8b94a3', fontSize: 13 }}>
          ¿Ya tienes cuenta? <a href="/panel/login" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}>Acceder</a>
        </div>
      </div>
    </div>
  )
}

/* ── Formulario de registro (paso 2) ── */
export default function Registro() {
  const { t, lang, setLang } = useT()
  const params = new URLSearchParams(window.location.search)
  const paramPlan = params.get('plan') || ''
  const paramBilling = params.get('billing') || 'monthly'
  // La calculadora de /planes manda el tamaño de flota en la URL. Si
  // alguien entra directo, 40 es una flota tipica de DSP.
  const furgonetas = Math.max(1, Number(params.get('flota')) || 40)

  const [sector, setSector] = useState(params.get('sector') || '')
  const [selectedPlan, setSelectedPlan] = useState(paramPlan)
  const [billingMode, setBillingMode] = useState(paramBilling)

  const [org, setOrg] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setTouched] = useState(false)
  const [center, setCenter] = useState('')
  const [email, setEmail] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [accept, setAccept] = useState(false)
  const [done, setDone] = useState(false)

  const reparte = ['supermercado', 'distribucion', 'autonomo', 'mensajeria'].includes(sector)
  if (!sector) {
    return <SectorPicker onSelect={(k) => {
      setSector(k)
      const q = new URLSearchParams(window.location.search)
      q.set('sector', k)
      // El autónomo no elige plan: tiene el suyo, fijo al mes.
      if (k === 'autonomo') { setSelectedPlan('autonomo'); q.set('plan', 'autonomo') }
      window.history.replaceState({}, '', `/registro?${q}`)
    }} />
  }

  // Si no hay plan en URL, mostramos el picker primero
  if (!selectedPlan) {
    return <PlanPicker furgonetas={furgonetas} onSelect={(key, billing) => {
      setSelectedPlan(key)
      setBillingMode(billing)
      // Se conserva lo que traía la URL (utm_source de un anuncio): sin eso el
      // alta no sabría de qué campaña viene.
      const q = new URLSearchParams(window.location.search)
      q.set('sector', sector); q.set('plan', key); q.set('billing', billing)
      window.history.replaceState({}, '', `/registro?${q}`)
    }} />
  }

  const planInfo = PLANS.find(p => p.key === selectedPlan) || PLANS.find(p => p.key === 'completo')
  const diasPrueba = planInfo.diasPrueba || 14
  const precioFijo = planInfo.mensual != null
  const displayPrice = billingMode === 'annual'
    ? annualM(planInfo, furgonetas) : precioMes(planInfo, furgonetas)
  const yearSave = annualSave(planInfo, furgonetas)

  function onOrg(v) { setOrg(v); if (!slugTouched) setSlug(slugify(v)) }

  const soloYo = sector === 'autonomo'

  async function submit() {
    setErr('')
    const s = soloYo ? `${slugify(org) || 'reparto'}-${Math.random().toString(36).slice(2, 6)}` : slugify(slug)
    const usuario = soloYo ? email.trim().toLowerCase() : user.trim()
    if (!org.trim()) return setErr(soloYo ? 'Dinos tu nombre.' : 'Indica el nombre de tu empresa.')
    if (s.length < 3) return setErr('La URL de tu empresa debe tener al menos 3 caracteres (a-z, 0-9).')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setErr('Introduce un email válido.')
    if (usuario.length < 3) return setErr('El usuario debe tener al menos 3 caracteres.')
    if (pass.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres.')
    if (pass !== pass2) return setErr('Las contraseñas no coinciden.')
    if (!accept) return setErr('Debes aceptar los Términos y la Política de Privacidad para continuar.')
    setBusy(true)
    try {
      const r = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: org.trim(), username: usuario, password: pass,
          slug: s, center: center.trim(), email: email.trim().toLowerCase(),
          plan: selectedPlan, sector,
          // Desde la app de Play no se pide tarjeta con Stripe (Google cobra con lo suyo).
          desde_app: enAppPlay(),
          ...regionDelMovil(),
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.access_token) {
        setErr(j.detail || 'No se pudo crear la cuenta. Prueba con otro usuario o URL.')
        setBusy(false); return
      }
      saveSession(j)   // le faltaba admin_role; una sola función lo guarda todo
      localStorage.setItem('flota_plan', selectedPlan)
      localStorage.setItem('flota_billing', billingMode)
      medirAccion('registro_ok')
      evento('CompleteRegistration', { content_name: sector || 'alta', status: true })
      setDone(true)
    } catch { setErr('Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.'); setBusy(false) }
  }

  // Pantalla de confirmación
  if (done) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 440 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>¡Cuenta creada!</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${planInfo.color}18`, border: `1px solid ${planInfo.color}40`, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: planInfo.color, margin: '0 0 16px' }}>
            Plan {planInfo.name} · {diasPrueba} días gratis
          </div>
          <p style={{ color: '#8b94a3', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>
            Hemos enviado un email de bienvenida a <b style={{ color: '#0ea5e9' }}>{email}</b>.
          </p>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 22 }}>
            {soloYo ? 'Ya puedes escanear tus primeros paquetes.' : 'Puedes acceder ahora y verificar tu email después.'}
          </p>
          {/* El primer paso de verdad es traer lo que ya tiene: se le lleva
              directo, y el panel queda a un clic. */}
          {reparte ? (
            <button style={{ ...btn, marginTop: 0 }} onClick={() => { window.location.href = soloYo ? '/ruta' : '/panel/reparto' }}>
              {soloYo ? 'Empezar mi ruta →' : 'Preparar el reparto →'}
            </button>
          ) : (
            <button style={{ ...btn, marginTop: 0 }} onClick={() => { window.location.href = '/panel/importaciones' }}>
              Traer mis vehículos y conductores →
            </button>
          )}
          {!soloYo && <button onClick={() => { window.location.href = '/panel' }}
            style={{ marginTop: 10, background: 'none', border: 'none', color: '#8b94a3', fontSize: 13, cursor: 'pointer' }}>
            Ir al panel
          </button>}
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ position: 'absolute', top: 18, right: 18 }}>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={sel}>
          {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div style={{ ...card, maxWidth: 440 }}>
        {/* Plan elegido — cabecera */}
        <div style={{ background: `${planInfo.color}10`, border: `1px solid ${planInfo.color}35`, borderRadius: 14, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: planInfo.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Plan elegido</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#eef1f6' }}>{planInfo.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {precioFijo
                ? `${displayPrice.toFixed(2).replace('.', ',')} €/mes, todo incluido · ${diasPrueba} días gratis`
                : billingMode === 'annual'
                  ? `${displayPrice}€/mes · ${precioMes(planInfo, furgonetas) * MESES_ANUAL}€/año · ahorras ${yearSave}€`
                  : `${displayPrice}€/mes`
              }
            </div>
          </div>
          {!planInfo.soloSector && <button
            onClick={() => setSelectedPlan('')}
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#8b94a3', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
          >
            Cambiar
          </button>}
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)', borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: '#34d399', marginBottom: 16 }}>
          ✓ {diasPrueba} días gratis · sin tarjeta · cancela cuando quieras
        </div>

        <label style={lbl}>{soloYo ? 'Tu nombre' : t('reg.company')}</label>
        <input style={inp} value={org} onChange={(e) => onOrg(e.target.value)} placeholder={soloYo ? 'Pepe' : 'Transportes Pérez SL'} />

        {!soloYo && <>
        <label style={lbl}>{t('reg.url')}</label>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, background: '#0e1116', overflow: 'hidden' }}>
          <span style={{ padding: '11px 2px 11px 12px', color: '#8b94a3', fontSize: 13, whiteSpace: 'nowrap' }}>{dominio()}/</span>
          <input style={{ ...inp, border: 'none', paddingLeft: 2 }} value={slug}
            onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)) }} placeholder="transportes-perez" />
        </div>
        <div style={hint}>{t('reg.urlhint')}</div>
        </>}

        {/* Con varias naves se escriben todas: el plan de una sola se queda
            con la primera. Sin esto la segunda nave no se podía dar de alta. */}
        {sector !== 'autonomo' && <>
        <label style={lbl}>{selectedPlan === 'operacion' ? t('reg.center') : 'Tus sedes'}</label>
        <input style={inp} value={center} onChange={(e) => setCenter(e.target.value)}
          placeholder={reparte ? 'Tienda centro' : selectedPlan === 'operacion' ? 'Norte' : 'Norte, Sur, Este'} />
        {selectedPlan !== 'operacion' && <div style={hint}>Sepáralos con comas. Podrás añadir más después.</div>}
        </>}

        <label style={lbl}>Email de contacto</label>
        <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@tuempresa.com" autoComplete="email" />

        {!soloYo && <>
        <label style={lbl}>{t('login.user')}</label>
        <input style={inp} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
        </>}
        {soloYo && <div style={hint}>Entrarás con tu correo y esta contraseña.</div>}

        <label style={lbl}>{t('login.pass')}</label>
        <input style={inp} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />

        <label style={lbl}>Repetir contraseña</label>
        <input
          style={{ ...inp, borderColor: pass2 && pass !== pass2 ? 'rgba(248,113,113,.6)' : 'rgba(255,255,255,.12)' }}
          type="password" value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoComplete="new-password"
          placeholder="Repite la contraseña"
        />
        {pass2 && pass !== pass2 && (
          <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>Las contraseñas no coinciden</div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, fontSize: 12, color: '#8b94a3', lineHeight: 1.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            Acepto los <a href="/terminos" target="_blank" style={{ color: '#0ea5e9' }}>Términos</a>, el <a href="/encargo" target="_blank" style={{ color: '#0ea5e9' }}>Acuerdo de Encargo del Tratamiento</a> y la <a href="/privacidad" target="_blank" style={{ color: '#0ea5e9' }}>Política de Privacidad</a>.
            {' '}Prueba gratuita de {diasPrueba} días — sin cobro durante la prueba. Al finalizar se cobra el plan {planInfo.name} ({precioFijo ? displayPrice.toFixed(2).replace('.', ',') : displayPrice} €/mes) salvo cancelación.
          </span>
        </label>

        <button
          style={{ ...btn, opacity: busy ? .6 : 1, cursor: busy ? 'wait' : 'pointer' }}
          disabled={busy}
          onClick={submit}
        >
          {busy ? 'Creando cuenta…' : `Crear cuenta con plan ${planInfo.name}`}
        </button>

        {err && (
          <div style={{ color: '#f87171', fontSize: 13, marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.25)', textAlign: 'center' }}>
            {err}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, color: '#8b94a3', fontSize: 13 }}>
          {t('reg.have')} <a href="/panel/login" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}>{t('login.btn')}</a>
        </div>
      </div>
    </div>
  )
}

const wrap = { minHeight: '100vh', background: 'radial-gradient(1100px 560px at 72% -12%,rgba(14,165,233,.10),transparent),#0b0d10', color: '#eef1f6', fontFamily: 'Inter Variable,Inter,system-ui,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }
const card = { width: '100%', maxWidth: 420, background: '#13161b', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: '24px 22px' }
const lbl = { display: 'block', fontSize: 12, color: '#8b94a3', margin: '12px 0 5px', fontWeight: 600 }
const inp = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: '#0e1116', color: '#eef1f6', fontSize: 14, boxSizing: 'border-box' }
const hint = { fontSize: 11, color: '#8b94a3', marginTop: 5 }
const btn = { width: '100%', marginTop: 20, padding: 13, border: 'none', borderRadius: 11, background: 'linear-gradient(135deg,#fb923c,#ea6800)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }
const sel = { background: '#13161b', color: '#e7ebf2', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '7px 10px', fontSize: 13, fontWeight: 600 }
