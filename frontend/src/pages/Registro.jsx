import { useTitulo } from '../lib/titulo'
import { useState } from 'react'
import { enAppPlay } from '../lib/enApp'
import { evento, anunciosAceptados, cookiesMeta } from '../lib/metaPixel'
import { leerRef, useInvitacion } from '../lib/referido'
import { regionDelMovil } from '../lib/region'
import { sinPagos, detalleSinPagos } from '../lib/plataforma'

import { API_BASE } from '../services/api'
import { medirAccion } from '../lib/analitica'
import { saveSession } from '../panel/auth'
import { marcarRecienAlta } from '../lib/instalar'
import { useT, LANGS } from '../i18n'
import { tx, useIdioma, IDIOMAS, cambiarIdioma, locale } from '../lib/idioma'
import { Check, Package, ShoppingCart, Warehouse, Truck, User, Send } from 'lucide-react'
import { MARCA, dominio } from '../marca'
import { BTN_PRIMARIO, BTN_SECUNDARIO, LogoMarca } from './portadaComun'
import { sugerenciaCorreo } from '../lib/correo'
import { PLANES_EMPRESA, PLAN_REPARTO, MESES_ANUAL, PARADAS_GRATIS, promoGratis, fechaPromo, precioMes as precioMesPlan, eur,
  refPromoActiva, fechaRefPromo, eurosRef, BONO_CENT } from '../lib/precios'

function slugify(s) {
  return (s || '').toLowerCase().trim()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

/* Tarifa POR VEHÍCULO — misma fuente que /planes (lib/precios.js) y que el backend
   (PLAN_TARIFAS de server.py; el porqué, en docs/PRECIOS.md). */
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
            'Navegación con voz dentro de la app, parada a parada'],
    // Sin furgoneta, taller ni equipo: la app de ruta no tiene panel de flota (SECTORES_REGISTRO).
    no: ['Equipo de repartidores y flota (para eso están los planes de empresa)'],
  },
  {
    // Reparto: súper y distribución pagan por repartidor activo, con sus furgonetas
    // incluidas. Solo sale en esos sectores (con Pro al lado, por si quieren la flota entera).
    key: 'reparto', name: PLAN_REPARTO.nombre, color: PLAN_REPARTO.color, porVehiculo: 0,
    porRepartidor: PLAN_REPARTO.por_repartidor, minimo: PLAN_REPARTO.minimo_repartidores,
    popular: false, soloSectores: PLAN_REPARTO.sectores, who: PLAN_REPARTO.para,
    feats: PLAN_REPARTO.incluye, no: PLAN_REPARTO.no_incluye,
  },
  // Esencial y Pro: los mismos que /planes (lib/precios.js). Empresa se cierra hablando.
  ...PLANES_EMPRESA.filter((p) => p.por_vehiculo).map((p) => ({
    key: p.clave, name: p.nombre, color: p.color, porVehiculo: p.por_vehiculo, minimo: p.minimo_vehiculos,
    popular: !!p.recomendado, who: p.para, feats: p.incluye, no: p.no_incluye,
  })),
]

/* Lo que paga al mes esa flota (con mínimo y descuento por volumen). Pagando un año se pagan 10 meses. */
const precioMes = (p, unidades) =>
  p.mensual ?? precioMesPlan(p.porRepartidor
    ? { por_repartidor: p.porRepartidor, minimo_repartidores: p.minimo }
    : { por_vehiculo: p.porVehiculo, minimo_vehiculos: p.minimo }, unidades)
const annualM = (p, furgonetas) => Math.round(precioMes(p, furgonetas) * MESES_ANUAL / 12)
const annualSave = (p, furgonetas) => precioMes(p, furgonetas) * (12 - MESES_ANUAL)

/* ── Qué tipo de empresa (paso 0) ──
   Con esto la cuenta nace con las pantallas que le sirven: a un súper que
   lleva la compra a casa le sobra el cuadrante de una subcontrata de
   paquetería, y le falta el escaneo de tickets y la ruta. */
const SECTORES = [
  { key: 'autonomo', icon: User, color: '#eab308', name: 'Repartir yo mismo',
    sub: 'Tu furgoneta y tus paquetes: los escaneas o fotografías la etiqueta, la ruta se ordena sola, llamas o escribes al cliente desde cada parada y cobras si toca.' },
  { key: 'dsp_amazon', icon: Package, color: '#fb923c', name: 'DSP de Amazon',
    sub: 'Plantilla del día, DNR diaria, horas (WHC), cuadrante y turnos, asignación de furgonetas, inspecciones con foto e IA, taller y vencimientos. Todo lo de una DSP, sin extensiones ni nada que toque los sistemas de Amazon.' },
  { key: 'mensajeria', icon: Send, color: '#f472b6', name: 'Mensajería y paquetería',
    sub: 'Escaneo de bultos, rutas por tiempo con franjas y hora estimada, seguimiento para el cliente, cobro a la entrega, y turnos y cuadrante del equipo.' },
  { key: 'supermercado', icon: ShoppingCart, color: '#22c55e', name: 'Supermercado o tienda con reparto a domicilio',
    sub: 'El ticket de caja a la ruta: el repartidor escanea, ve la dirección y qué lleva, la ruta se ordena sola y al cliente le mandas la hora por WhatsApp con un toque.' },
  { key: 'distribucion', icon: Warehouse, color: '#0ea5e9', name: 'Distribución a negocios',
    sub: 'Reparto a talleres, bares u obras: escaneo de bultos por la mañana, zonas por repartidor, ruta ordenada y la oficina viendo por dónde va cada uno.' },
  { key: 'otra', icon: Truck, color: '#a855f7', name: 'Otra flota',
    sub: 'Servicios técnicos, obra, alquiler…: vehículos, conductores, taller y vencimientos.' },
]

/* Lo que cuesta repartir uno mismo, lo mismo que dicen la portada de repartidores, la app y los anuncios. Ponía
   «7 días gratis» (la prueba de antes) mientras todo lo demás decía «gratis y sin límite hasta el 31 de diciembre». */
const ofertaAutonomo = () => (promoGratis()
  ? `Gratis y sin límite hasta el ${fechaPromo()}, sin tarjeta.`
  : `Gratis hasta ${PARADAS_GRATIS} paradas al día, sin tarjeta.`)

function SectorPicker({ onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(1100px 560px at 72% -12%,rgba(14,165,233,.10),transparent),#0b0d10', color: '#eef1f6', fontFamily: 'Inter Variable,Inter,system-ui,sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#eef1f6', marginBottom: 36 }}>
          <img src="/favicon.svg" alt="" width="30" height="30" style={{ borderRadius: 8 }} />
          <b style={{ fontSize: 15 }}>{MARCA.nombre}</b>
        </a>
        <h1 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 900, margin: '0 0 8px', textAlign: 'center' }}>¿Qué vas a hacer con {MARCA.nombre}?</h1>
        <p style={{ color: '#8b94a3', fontSize: 15, margin: '0 0 26px', textAlign: 'center' }}>Así te preparamos las pantallas que vas a usar. Podrás añadir o quitar cosas después.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          {SECTORES.map((s) => (
            <button key={s.key} onClick={() => onSelect(s.key)} style={{ textAlign: 'left', background: '#13161b', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '18px 18px', cursor: 'pointer', color: '#eef1f6' }}>
              <s.icon size={22} color={s.color} />
              <div style={{ fontWeight: 800, fontSize: 15, margin: '10px 0 4px' }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: '#8b94a3', lineHeight: 1.5 }}>
                {s.sub}{s.key === 'autonomo' && <> <b style={{ color: '#eab308' }}>{ofertaAutonomo()}</b></>}
              </div>
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
function PlanPicker({ onSelect, furgonetas, setFurgonetas, repartidores, setRepartidores, sector }) {
  const { lang, setLang } = useT()
  const [billing, setBilling] = useState('monthly')
  // Súper y distribución ven Reparto (recomendado) y Pro; a ellos Esencial (mínimo 10
  // furgonetas) les cobraría furgonetas que no tienen. El resto, Esencial y Pro.
  const reparteSector = PLAN_REPARTO.sectores.includes(sector)
  const visibles = PLANS.filter((p) => !p.soloSector
    && (p.soloSectores ? p.soloSectores.includes(sector) : !(reparteSector && p.key === 'operacion')))
  const destacado = (p) => (reparteSector ? p.key === 'reparto' : p.popular)
  const campoN = { width: 72, background: '#0b0d10', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '7px 8px', color: '#eef1f6', fontSize: 14, fontWeight: 800, textAlign: 'center' }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(1100px 560px at 72% -12%,rgba(14,165,233,.10),transparent),#0b0d10', color: '#eef1f6', fontFamily: 'Inter Variable,Inter,system-ui,sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#eef1f6' }}>
            <img src="/favicon.svg" alt="" width="30" height="30" style={{ borderRadius: 8 }} />
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

        {/* Cuántos sois: el precio se calcula con lo vuestro, no con una flota tipo */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
          {reparteSector && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#cbd5e1', fontWeight: 600 }}>
              ¿Cuántos repartidores tenéis?
              <input type="number" min="1" max="5000" value={repartidores} aria-label="Número de repartidores" style={campoN}
                onChange={(e) => setRepartidores(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} />
            </label>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#cbd5e1', fontWeight: 600 }}>
            {reparteSector ? '¿Y furgonetas?' : '¿Cuántos vehículos tienes?'}
            <input type="number" min="1" max="5000" value={furgonetas} aria-label="Número de vehículos" style={campoN}
              onChange={(e) => setFurgonetas(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} />
          </label>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 20 }}>
          {visibles.map((p) => {
            const n = p.porRepartidor ? repartidores : furgonetas
            const pop = destacado(p)
            const mes = precioMes(p, n)
            const price = billing === 'annual' ? annualM(p, n) : mes
            const save = annualSave(p, n)
            return (
              <div key={p.key} style={{
                background: pop ? 'linear-gradient(145deg,#0f172a,#0c1929)' : '#13161b',
                border: pop ? `2px solid ${p.color}` : '1px solid rgba(255,255,255,.08)',
                borderRadius: 18, padding: '24px 20px', position: 'relative', display: 'flex', flexDirection: 'column',
                boxShadow: pop ? `0 0 32px ${p.color}20` : 'none',
                cursor: 'pointer', transition: 'transform .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {pop && (
                  <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: p.color, borderRadius: 20, padding: '3px 12px', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', color: '#0b0d10' }}>
                    Recomendado
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{p.who}</div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: 38, fontWeight: 900 }}>{eur(price)}€</span>
                  <span style={{ color: '#64748b', fontSize: 13 }}>/mes</span>
                  {billing === 'annual' && <span style={{ marginLeft: 6, fontSize: 12, color: '#475569', textDecoration: 'line-through' }}>{eur(mes)}€</span>}
                </div>
                {/* El precio es por furgoneta: sin esta línea, «200 €/mes» parecía
                    una cuota fija y chocaba con el «desde 5 €» de la portada. */}
                <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 10 }}>
                  {p.porRepartidor
                    ? <>{p.porRepartidor}€ por repartidor activo · con {Math.max(n, p.minimo)} repartidores{n < p.minimo && ` (mínimo ${p.minimo})`} · furgonetas incluidas</>
                    : <>{p.porVehiculo}€ por vehículo · con {Math.max(n, p.minimo)} vehículos{n < p.minimo && ` (mínimo ${p.minimo})`}</>}
                </div>

                {billing === 'annual' && (
                  <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, marginBottom: 4 }}>{eur(mes * MESES_ANUAL)}€/año · ahorras {eur(save)}€</div>
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
                    width: '100%', padding: '11px 0', borderRadius: 10, border: pop ? 'none' : `1.5px solid ${p.color}`,
                    cursor: 'pointer', fontWeight: 800, fontSize: 14,
                    background: pop ? `linear-gradient(135deg,${p.color},${p.color}cc)` : 'transparent',
                    color: pop ? '#0b0d10' : p.color,
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
  useTitulo(tx('Crear mi cuenta'))
  const { t, lang, setLang } = useT()
  // Quien reparte solo sigue el idioma de su app (7 idiomas, chino incluido).
  const idiomaApp = useIdioma()
  const params = new URLSearchParams(window.location.search)
  const paramPlan = params.get('plan') || ''
  const paramBilling = params.get('billing') || 'monthly'
  // La calculadora de /planes manda el tamaño en la URL (flota o repartidores). Si alguien
  // entra directo, 40 es una flota típica de DSP; un súper empieza con 5 repartidores y 5 furgonetas.
  const esSectorReparto = PLAN_REPARTO.sectores.includes(params.get('sector') || '')
  const [furgonetas, setFurgonetas] = useState(Math.max(1, Number(params.get('flota')) || (esSectorReparto ? 5 : 40)))
  const [repartidores, setRepartidores] = useState(Math.max(1, Number(params.get('repartidores')) || 5))

  /* EN LA APP DE IPHONE (09-11-2026) SOLO SE CREA LA CUENTA DE QUIEN REPARTE, y sin una palabra de planes, prueba, precios,
     tope, bonos ni invitaciones (Apple: 2.1(b) y 3.1.1; docs/APP_STORE.md). Ni el selector de sectores ni el de planes de
     empresa salen, y el alta no manda ningún código de invitación. */
  const enIOS = sinPagos()
  const [sector, setSector] = useState(enIOS ? 'autonomo' : (params.get('sector') || ''))
  const [verPass, setVerPass] = useState(false)
  const invitacion = useInvitacion()
  // Quien reparte solo tiene un único plan: con ?sector=autonomo (el regalo, /cn)
  // no se le enseñan los planes de empresa.
  const [selectedPlan, setSelectedPlan] = useState(enIOS ? 'autonomo' : (paramPlan || (params.get('sector') === 'autonomo' ? 'autonomo' : '')))
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
  // Un nombre que no da letras (chino, árabe…) no deja identificador: se
  // propone uno para que nadie se atasque en «la URL debe tener 3 letras».
  const [sufijo] = useState(() => `empresa-${Math.random().toString(36).slice(2, 6)}`)
  const [done, setDone] = useState(false)
  // Solo si el servidor dice que el correo de bienvenida ha salido de verdad (CONTRATO-ALTA §4.1).
  const [correoEnviado, setCorreoEnviado] = useState(false)

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
    return <PlanPicker furgonetas={furgonetas} setFurgonetas={setFurgonetas} repartidores={repartidores}
      setRepartidores={setRepartidores} sector={sector} onSelect={(key, billing) => {
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
  // Reparto se cuenta por repartidores; los demás, por furgonetas.
  const nUnid = planInfo.porRepartidor ? repartidores : furgonetas
  const displayPrice = billingMode === 'annual'
    ? annualM(planInfo, nUnid) : precioMes(planInfo, nUnid)
  const yearSave = annualSave(planInfo, nUnid)

  function onOrg(v) { setOrg(v); if (!slugTouched) setSlug(slugify(v) || (v.trim() ? sufijo : '')) }

  const soloYo = sector === 'autonomo'
  // Los textos que ve quien reparte solo, en el idioma de su app; el alta de
  // empresa sigue con los suyos.
  const tt = (texto, vars) => (soloYo ? tx(texto, vars)
    : texto.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m)))
  // «Acepto los [Términos], el [Acuerdo…] y la [Política…].»: los [ ] son enlaces, en orden.
  const conEnlaces = (texto, hrefs) => texto.split(/(\[[^\]]+\])/).map((trozo, i) => {
    const m = trozo.match(/^\[(.+)\]$/)
    if (!m) return trozo
    const href = hrefs.shift()
    return <a key={i} href={href} target="_blank" rel="noreferrer" style={{ color: soloYo ? '#0ea5e9' : 'var(--ld-accent)' }}>{m[1]}</a>
  })

  async function submit() {
    setErr('')
    const s = soloYo ? `${slugify(org) || 'reparto'}-${Math.random().toString(36).slice(2, 6)}` : slugify(slug)
    const usuario = soloYo ? email.trim().toLowerCase() : user.trim()
    if (!org.trim()) return setErr(soloYo ? tt('Dinos tu nombre.') : 'Indica el nombre de tu empresa.')
    if (s.length < 3) return setErr('La URL de tu empresa debe tener al menos 3 caracteres (a-z, 0-9).')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setErr(tt('Introduce un email válido.'))
    if (usuario.length < 3) return setErr('El usuario debe tener al menos 3 caracteres.')
    if (pass.length < 8) return setErr(tt('La contraseña debe tener al menos 8 caracteres.'))
    if (!soloYo && pass !== pass2) return setErr(tt('Las contraseñas no coinciden.'))
    if (!accept) return setErr(tt('Debes aceptar los Términos y la Política de Privacidad para continuar.'))
    setBusy(true)
    try {
      const r = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: org.trim(), username: usuario, password: pass,
          slug: s, center: center.trim(), email: email.trim().toLowerCase(),
          plan: selectedPlan, sector,
          ...(!enIOS && sector === 'autonomo' && leerRef() ? { ref: leerRef() } : {}),
          // Desde la app de Play no se pide tarjeta con Stripe (Google cobra con lo suyo).
          desde_app: enAppPlay(),
          // Desde la app del iPhone (09-11-2026) el servidor no manda ningún correo con plan, prueba ni precios; en la web y en
          // Android no se manda nada nuevo.
          ...(enIOS ? { desde_ios: true } : {}),
          ...regionDelMovil(),
          // Medición de anuncios desde el servidor (02-11-2026): lo que contestó al aviso de cookies y, solo si aceptó,
          // las cookies del píxel (lib/metaPixel.js).
          anuncios: anunciosAceptados(), ...cookiesMeta(),
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.access_token) {
        const detalle = detalleSinPagos(j, r.status)?.detail   // en el iPhone, lo que hable de planes o pagos sale neutro
        setErr((typeof detalle === 'string' && (soloYo ? tt(detalle) : detalle)) || (soloYo ? tt('No se pudo crear la cuenta. Prueba con otro correo.') : 'No se pudo crear la cuenta. Prueba con otro usuario o URL.'))
        setBusy(false); return
      }
      saveSession(j)   // le faltaba admin_role; una sola función lo guarda todo
      localStorage.setItem('flota_plan', selectedPlan)
      localStorage.setItem('flota_billing', billingMode)
      medirAccion('registro_ok')
      evento('CompleteRegistration', { content_name: sector || 'alta', status: true }, j.meta_event_id)   // el id del servidor: un alta, una conversión
      if (soloYo) marcarRecienAlta()   // la app de ruta le pide instalarla antes de nada
      setCorreoEnviado(j.correo_bienvenida === true)
      setDone(true)
    } catch { setErr(tt('Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.')); setBusy(false) }
  }

  /* LA PANTALLA FINAL DE UNA EMPRESA (14-11-2026, CONTRATO-ALTA §4.2), con la identidad nueva. Antes decía «¡Cuenta
     creada!» con un 📧, «verificar tu email después» (no hay nada que verificar) y «Hemos enviado un email…» aunque no
     se enviara; y llevaba a Importaciones. Ahora: lo que es verdad y el arranque, que son cuatro pasos. Quien reparte
     solo (y las empresas que reparten, que van a su reparto) sigue con la suya. */
  if (done && !soloYo) {
    const pasos = ['alta.p1.titulo', 'alta.p2.titulo', 'alta.p3.titulo', 'alta.p4.titulo']
    return (
      <div role="main" className="ld-root min-h-screen font-sans text-[17px] antialiased" data-theme="light" data-testid="alta-cuenta-creada">
        <div className="mx-auto w-full max-w-[520px] px-4 pb-16 pt-6">
          <span className="inline-flex items-center gap-2.5">
            <LogoMarca size={28} />
            <span className="text-[18px] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
          </span>
          <h1 className="mt-12 text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em]">{t('alta.reg.creada')}</h1>
          <p className="mt-2 text-[15px] text-[color:var(--ld-muted)]">
            {t('alta.reg.plan').replace('{plan}', planInfo.name).replace('{n}', diasPrueba)}
          </p>
          {correoEnviado && (
            <p className="mt-4 text-[16px] leading-relaxed text-[color:var(--ld-text2)]" data-testid="alta-correo-enviado">
              {t('alta.reg.correo')} <b className="font-semibold text-[color:var(--ld-text)]">{email.trim().toLowerCase()}</b>.
            </p>
          )}
          {reparte ? (
            <div className="mt-10">
              <button type="button" className={`${BTN_PRIMARIO} w-full`} onClick={() => { window.location.href = '/panel/reparto' }}>
                {t('alta.reg.reparto')}
              </button>
            </div>
          ) : (
            <>
              <p className="mt-6 text-[17px] leading-relaxed text-[color:var(--ld-text2)]">{t('alta.reg.pasos')}</p>
              <ol className="mt-4 border-t border-[color:var(--ld-border)]">
                {pasos.map((k, i) => (
                  <li key={k} className="flex items-baseline gap-4 border-b border-[color:var(--ld-border)] py-3">
                    <span className="w-5 font-mono text-[14px] tabular-nums text-[color:var(--ld-muted)]">{i + 1}</span>
                    <span className="text-[17px] font-semibold">{t(k)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" className={`${BTN_PRIMARIO} sm:flex-1`} onClick={() => { window.location.href = '/panel/arranque' }}>
                  {t('alta.reg.empezar')}
                </button>
                <button type="button" className={`${BTN_SECUNDARIO} sm:flex-1`} onClick={() => { window.location.href = '/panel' }}>
                  {t('alta.reg.irPanel')}
                </button>
              </div>
            </>
          )}
          {reparte && (
            <button type="button" className={`mt-3 ${BTN_SECUNDARIO} w-full`} onClick={() => { window.location.href = '/panel' }}>
              {t('alta.reg.irPanel')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Pantalla de confirmación de quien reparte solo
  if (done) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 440 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{tt('¡Cuenta creada!')}</h2>
          {/* En la app de iPhone (09-11-2026) la píldora con el plan no sale: ni «Plan Repartidor» ni «gratis hasta…». */}
          {!enIOS && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${planInfo.color}18`, border: `1px solid ${planInfo.color}40`, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: planInfo.color, margin: '0 0 16px' }}>
            {/* Quien reparte solo no tiene «7 días»: lo que dice su plan (03-11-2026, el vídeo para Apple: aquí «7 días
                gratis» y en la cuenta «Gratis sin límite hasta el 31 de diciembre»). */}
            {soloYo && promoGratis()
              ? tt('Plan {plan} · gratis hasta el {fecha}', { plan: tt(planInfo.name), fecha: fechaPromo(locale()) })
              : soloYo
              ? tt('Plan {plan} · gratis hasta {p} paradas al día', { plan: tt(planInfo.name), p: PARADAS_GRATIS })
              : tt('Plan {plan} · {n} días gratis', { plan: tt(planInfo.name), n: diasPrueba })}
          </div>}
          {/* Desde la app de iPhone (09-11-2026) el servidor no manda correo de bienvenida (`desde_ios`, register_dsp): no se dice que sí.
              Y en la web, solo si el servidor dice que ha salido (`correo_bienvenida`, 14-11-2026): sin el servicio de correo no sale. */}
          {!enIOS && correoEnviado && <p style={{ color: '#8b94a3', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>
            {tt('Hemos enviado un email de bienvenida a')} <b style={{ color: '#0ea5e9' }}>{email}</b>.
          </p>}
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 22 }}>{tt('Ya puedes escanear tus primeros paquetes.')}</p>
          <button style={{ ...btn, marginTop: 0 }} onClick={() => { window.location.href = '/ruta' }}>
            {tt('Empezar mi ruta →')}
          </button>
        </div>
      </div>
    )
  }

  // Una empresa, en papel; quien reparte solo, con el aspecto de su app (los dos juegos, al final del fichero).
  const S = soloYo ? OSCURO : PAPEL
  return (
    <div style={S.wrap} className={soloYo ? undefined : 'ld-root font-sans antialiased'} data-theme={soloYo ? undefined : 'light'}>
      <div style={soloYo ? { ...S.card, maxWidth: 440 } : S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: soloYo ? 18 : 28 }}>
          <a href={soloYo ? '/empezar' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, color: S.texto, textDecoration: 'none' }}>
            {soloYo
              ? <img src="/favicon.svg" alt="" width="34" height="34" style={{ borderRadius: 10 }} />
              : <LogoMarca size={28} />}
            <b style={{ fontSize: soloYo ? 17 : 18, fontWeight: soloYo ? 700 : 800 }}>{soloYo ? MARCA.app : MARCA.nombre}</b>
          </a>
          <div style={{ marginLeft: 'auto' }}>
            {soloYo ? (
              <select value={idiomaApp} onChange={(e) => cambiarIdioma(e.target.value)} style={S.sel} aria-label="Idioma / Language">
                {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <select value={lang} onChange={(e) => setLang(e.target.value)} style={S.sel} aria-label="Idioma / Language">
                {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            )}
          </div>
        </div>
        {!soloYo && (
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 18px' }}>{t('alta.reg.titulo')}</h1>
        )}
        {/* QUIEN REPARTE SOLO VE PRIMERO QUE ES GRATIS (10-10-2026). Medido: desde la app,
            «Repartir yo mismo» → este formulario → se iban sin enviarlo; lo primero que leían
            era «Repartidor 9,99 €/mes» y lo de gratis estaba en la letra pequeña. */}
        {enIOS ? null : soloYo ? (
          <div style={{ background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 19, color: '#eef1f6', lineHeight: 1.25 }}>{promoGratis()
              ? tt('Gratis y sin límite hasta el {fecha} · sin tarjeta', { fecha: fechaPromo(locale()) })
              : tt('Gratis hasta {n} paradas al día · sin tarjeta', { n: PARADAS_GRATIS })}</div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 5 }}>
              {promoGratis()
                ? tt('Después, gratis hasta {n} paradas al día, o sin tope por {precio} €/mes.', { n: PARADAS_GRATIS, precio: displayPrice.toFixed(2).replace('.', ',') })
                : tt('Sin tope: {precio} €/mes, y los {n} primeros días ya van sin tope.', { precio: displayPrice.toFixed(2).replace('.', ','), n: diasPrueba })}
            </div>
            {/* 17-10-2026: el bono, también aquí, que es donde se decide. */}
            {refPromoActiva() && (
              <div data-testid="registro-bono" style={{ fontSize: 13.5, fontWeight: 700, color: '#fcd34d', marginTop: 9, lineHeight: 1.35 }}>
                🎁 {tt('Y {euros} para ti con tu primera ruta real (20 entregas en 2 días), hasta el {fecha}.', { euros: eurosRef(BONO_CENT, locale()), fecha: fechaRefPromo(locale()) })}
              </div>
            )}
          </div>
        ) : (
        /* El plan elegido, en una línea con su regla: el nombre, lo que cuesta y la prueba. Sin cajas tintadas. */
        <div style={{ borderTop: '1px solid var(--ld-border)', borderBottom: '1px solid var(--ld-border)', padding: '12px 0', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{tt('Plan elegido')}: {tt(planInfo.name)}</div>
            <div style={{ fontSize: 14, color: S.gris, marginTop: 2 }}>
              {precioFijo
                ? tt('{precio} €/mes, todo incluido · {n} días gratis', { precio: displayPrice.toFixed(2).replace('.', ','), n: diasPrueba })
                : billingMode === 'annual'
                  ? `${displayPrice}€/mes · ${precioMes(planInfo, nUnid) * MESES_ANUAL}€/año · ahorras ${yearSave}€`
                  : `${displayPrice}€/mes${planInfo.porRepartidor ? ` · con ${Math.max(nUnid, planInfo.minimo)} repartidores activos` : ''}`
              }
              {` · ${t('alta.reg.prueba').replace('{n}', diasPrueba)}`}
            </div>
          </div>
          {!planInfo.soloSector && <button
            onClick={() => setSelectedPlan('')}
            style={{ background: 'transparent', border: `1.5px solid ${S.borde}`, color: S.texto, fontSize: 14, fontWeight: 700, padding: '0 14px', height: 40, borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}
          >
            Cambiar
          </button>}
        </div>
        )}

        {!enIOS && soloYo && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)', borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: '#34d399', marginBottom: 16 }}>
          ✓ {tt('Gratis · sin tarjeta · hoy 0 €')}
        </div>}

        {soloYo && invitacion && (
          <div style={{ marginBottom: 6, padding: '9px 12px', borderRadius: 10, background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.35)', color: '#ddd6fe', fontSize: 13, fontWeight: 600 }}>
            🎁 {tt('Te ha invitado un compañero: {n} días gratis', { n: invitacion.dias })}
          </div>
        )}
        <label style={S.lbl}>{soloYo ? tt('Tu nombre') : t('reg.company')}</label>
        <input style={S.inp} value={org} onChange={(e) => onOrg(e.target.value)} placeholder={soloYo ? 'Pepe' : 'Transportes Pérez SL'} />

        {!soloYo && <>
        {/* La dirección de verdad: el portal donde también pueden entrar los conductores con su correo. */}
        <label style={S.lbl}>{t('reg.url')}</label>
        <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${S.borde}`, borderRadius: 12, background: S.fondoCampo, overflow: 'hidden' }}>
          <span style={{ padding: '12px 0 12px 14px', color: S.gris, fontSize: 14, whiteSpace: 'nowrap', fontFamily: 'IBM Plex Mono, ui-monospace, monospace' }} data-testid="reg-url-prefijo">{dominio()}/conductor#</span>
          <input style={{ ...S.inp, border: 'none', paddingLeft: 1, minWidth: 0, fontFamily: 'IBM Plex Mono, ui-monospace, monospace', fontSize: 15 }} value={slug}
            onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)) }} placeholder="transportes-perez" aria-label={t('reg.url')} />
        </div>
        <div style={S.hint}>{t('reg.urlhint')}</div>
        </>}

        {/* Con varias naves se escriben todas: el plan de una sola se queda
            con la primera. Sin esto la segunda nave no se podía dar de alta. */}
        {sector !== 'autonomo' && <>
        <label style={S.lbl}>{selectedPlan === 'operacion' ? t('reg.center') : 'Tus sedes'}</label>
        <input style={S.inp} value={center} onChange={(e) => setCenter(e.target.value)}
          placeholder={reparte ? 'Tienda centro' : selectedPlan === 'operacion' ? 'Norte' : 'Norte, Sur, Este'} />
        {selectedPlan !== 'operacion' && <div style={S.hint}>Sepáralos con comas. Podrás añadir más después.</div>}
        </>}

        <label style={S.lbl}>{soloYo ? tt('Tu correo') : 'Email de contacto'}</label>
        <input style={S.inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={soloYo ? 'tu@correo.com' : 'admin@tuempresa.com'} autoComplete="email" />
        {sugerenciaCorreo(email) && (
          <button type="button" onClick={() => setEmail(sugerenciaCorreo(email))}
            style={{ ...S.hint, display: 'block', color: S.aviso, fontSize: 13, fontWeight: 600, textDecoration: 'underline', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            {tt('¿Querías decir {correo}?', { correo: sugerenciaCorreo(email) })}
          </button>
        )}

        {!soloYo && <>
        <label style={S.lbl}>{t('login.user')}</label>
        <input style={S.inp} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
        </>}
        {soloYo && <div style={S.hint}>{tt('Entrarás con tu correo y esta contraseña.')}</div>}

        <label style={S.lbl}>{soloYo ? tt('Contraseña') : t('login.pass')}</label>
        <input style={S.inp} type={soloYo && verPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => soloYo && e.key === 'Enter' && submit()} autoComplete="new-password" />
        {soloYo && (
          <button type="button" onClick={() => setVerPass((v) => !v)}
            style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: 13, fontWeight: 600, padding: '8px 0 0', cursor: 'pointer' }}>
            {verPass ? tt('Ocultar contraseña') : tt('Mostrar contraseña')}
          </button>
        )}

        {!soloYo && <>
        <label style={S.lbl}>{tt('Repetir contraseña')}</label>
        <input
          style={{ ...S.inp, borderColor: pass2 && pass !== pass2 ? S.fallo : S.borde }}
          type="password" value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoComplete="new-password"
          placeholder={tt('Repite la contraseña')}
        />
        {pass2 && pass !== pass2 && (
          <div style={{ color: S.fallo, fontSize: 13, marginTop: 4, fontWeight: 600 }}>{tt('Las contraseñas no coinciden')}</div>
        )}
        </>}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: soloYo ? 16 : 20, fontSize: soloYo ? 12 : 13.5, color: S.gris, lineHeight: 1.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} style={{ marginTop: soloYo ? 2 : 3 }} />
          <span>
            {conEnlaces(tt('Acepto los [Términos], el [Acuerdo de Encargo del Tratamiento] y la [Política de Privacidad].'), ['/terminos', '/encargo', '/privacidad'])}
            {' '}{enIOS ? null : soloYo && promoGratis()
              ? tt('Gratis y sin límite hasta el {fecha}. Después sigues gratis con hasta {p} paradas al día; sin tarjeta no se cobra nunca. Sin tope: plan {plan} ({precio} €/mes).', {
                fecha: fechaPromo(locale()), p: PARADAS_GRATIS, plan: tt(planInfo.name), precio: displayPrice.toFixed(2).replace('.', ',') })
              : soloYo
              // Quien reparte solo: después de la prueba sigue gratis con tope (10-10-2026).
              ? tt('{n} días sin tope y gratis. Después sigues gratis con hasta {p} paradas al día; sin tarjeta no se cobra nunca. Sin tope: plan {plan} ({precio} €/mes).', {
                n: diasPrueba, p: PARADAS_GRATIS, plan: tt(planInfo.name), precio: displayPrice.toFixed(2).replace('.', ',') })
              : tt('Prueba gratuita de {n} días. Hoy no se cobra nada y sin tarjeta no se cobra nunca: al acabar eliges si seguir con el plan {plan} ({precio} €/mes).', {
                n: diasPrueba, plan: tt(planInfo.name), precio: precioFijo ? displayPrice.toFixed(2).replace('.', ',') : displayPrice })}
          </span>
        </label>

        <button
          style={{ ...S.btn, opacity: busy ? .6 : 1, cursor: busy ? 'wait' : 'pointer' }}
          disabled={busy}
          onClick={submit}
        >
          {busy ? tt('Creando cuenta…') : enIOS ? tt('Crear mi cuenta') : tt('Crear cuenta con plan {plan}', { plan: tt(planInfo.name) })}
        </button>

        {err && (
          <div role="alert" style={soloYo
            ? { color: '#f87171', fontSize: 13, marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.25)', textAlign: 'center' }
            : { color: S.fallo, fontSize: 15, fontWeight: 600, marginTop: 14 }}>
            {err}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, color: S.gris, fontSize: soloYo ? 13 : 15 }}>
          {soloYo ? tt('¿Ya tienes cuenta?') : t('reg.have')} <a href="/panel/login" style={{ color: S.enlace, textDecoration: 'none', fontWeight: 600 }}>{soloYo ? tt('Entrar') : t('login.btn')}</a>
        </div>
      </div>
    </div>
  )
}

// ESTILO DE LA APP (23-10-2026): el alta es donde se decide la gente; iba en naranja y con el idioma flotando
// encima del formulario. Ahora va con los colores de la app de reparto (cian de la marca sobre fondo oscuro).
const wrap = { minHeight: '100vh', background: 'radial-gradient(900px 480px at 50% -10%,rgba(20,231,216,.10),transparent),#070a0e', color: '#eef1f6', fontFamily: 'inherit', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px 32px', position: 'relative' }
const card = { width: '100%', maxWidth: 440, background: '#0f1318', border: '1px solid rgba(255,255,255,.08)', borderRadius: 22, padding: '20px 18px 22px', boxShadow: '0 30px 60px -40px rgba(0,0,0,.8)' }
const lbl = { display: 'block', fontSize: 13, color: '#aeb7c4', margin: '14px 0 6px', fontWeight: 600 }
const inp = { width: '100%', padding: '13px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', background: '#070a0e', color: '#eef1f6', fontSize: 16, boxSizing: 'border-box', outline: 'none' }
const hint = { fontSize: 11, color: '#8b94a3', marginTop: 5 }
const btn = { width: '100%', marginTop: 20, padding: 15, border: 'none', borderRadius: 16, background: 'linear-gradient(135deg,#2ee8dc,#0ea5b7)', color: '#04121a', fontSize: 16.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 12px 30px -10px rgba(20,231,216,.6)' }
const sel = { background: '#0f1318', color: '#e7ebf2', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '7px 10px', fontSize: 13, fontWeight: 600 }

/* DOS ASPECTOS PARA EL MISMO FORMULARIO (14-11-2026). Quien reparte solo sigue con el de su app (oscuro, el cian de la
   marca). Una empresa, con la identidad nueva de la portada de la que viene: tinta sobre papel, el cian solo en el
   botón de crear la cuenta, sin degradados ni brillos. Los colores del papel salen de las variables `--ld-*`
   (index.css, `.ld-root`). Lo que hace el formulario es el mismo en los dos. */
const OSCURO = {
  wrap, card, lbl, inp, hint, btn, sel,
  texto: '#eef1f6', gris: '#8b94a3', suave: '#64748b', enlace: '#0ea5e9', aviso: '#fbbf24', fallo: '#f87171',
  borde: 'rgba(255,255,255,.12)', fondoCampo: '#0e1116',
}
const PAPEL = {
  wrap: { minHeight: '100vh', background: 'var(--ld-bg)', color: 'var(--ld-text)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px 40px' },
  card: { width: '100%', maxWidth: 480 },
  lbl: { display: 'block', fontSize: 15, color: 'var(--ld-text)', margin: '18px 0 6px', fontWeight: 600 },
  inp: { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--ld-border-strong)', background: 'var(--ld-surface)', color: 'var(--ld-text)', fontSize: 16, boxSizing: 'border-box', outline: 'none' },
  hint: { fontSize: 13.5, color: 'var(--ld-muted)', marginTop: 6, lineHeight: 1.45 },
  btn: { width: '100%', marginTop: 24, height: 52, padding: '0 22px', border: 'none', borderRadius: 12, background: 'var(--ld-firma)', color: 'var(--ld-tinta-firma)', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  sel: { background: 'var(--ld-surface)', color: 'var(--ld-text)', border: '1px solid var(--ld-border-strong)', borderRadius: 10, padding: '8px 10px', fontSize: 14, fontWeight: 600, minHeight: 40 },
  texto: 'var(--ld-text)', gris: 'var(--ld-muted)', suave: 'var(--ld-muted)', enlace: 'var(--ld-accent)', aviso: 'var(--ld-mid)', fallo: 'var(--ld-warn)',
  borde: 'var(--ld-border-strong)', fondoCampo: 'var(--ld-surface)',
}
