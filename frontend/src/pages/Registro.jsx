import { useTitulo } from '../lib/titulo'
import { useEffect, useState } from 'react'
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
import { tx, useIdioma, IDIOMAS, idioma, cambiarIdioma, locale } from '../lib/idioma'
import { Check, ArrowRight } from 'lucide-react'
import { MARCA, dominio } from '../marca'
import { BTN_PRIMARIO, BTN_SECUNDARIO, LogoMarca, useTemaWeb } from './portadaComun'
import { sugerenciaCorreo } from '../lib/correo'
import { PLANES_EMPRESA, PLAN_REPARTO, MESES_ANUAL, PARADAS_GRATIS, DIAS_PRUEBA_EMPRESA, promoGratis, fechaPromo, precioMes as precioMesPlan,
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

/* El plan que se enseña y el que se manda al alta, el mismo: una de las claves de PLAN_TARIFAS (server.py) o sus alias
   de siempre (_PLAN_ALIAS). Un plan que no existe (un enlace roto, `plan=xx`) no cae en Pro: cae en el de entrada, el
   del «Desde 5 €» de la portada (Esencial, `operacion`), o en Reparto si el sector reparte (como hace el servidor sin
   plan). Antes caía en Pro y mandaba «xx» al servidor, que lo guardaba tal cual. */
const ALIAS_PLAN = { basico: 'operacion', pro: 'completo', flota: 'completo' }
function planDelAlta(clave, sector) {
  const k = String(clave || '').trim().toLowerCase()
  if (!k) return ''
  const c = ALIAS_PLAN[k] || k
  if (PLANS.some((p) => p.key === c)) return c
  return PLAN_REPARTO.sectores.includes(sector) ? 'reparto' : 'operacion'
}

/* Euros en el idioma de la pantalla («60 €», «€60»), con su separador de miles: los mismos que /planes. */
function euros(n) {
  const dec = Number.isInteger(n) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' })
      .format(n).replace(/[\u00a0\u202f]/g, ' ')
  } catch { return `${n} €` }
}

/* ── Qué tipo de empresa (paso 0) ──
   Con esto la cuenta nace con las pantallas que le sirven: a un súper que lleva la compra a casa le sobra el cuadrante
   de una subcontrata de paquetería, y le falta el escaneo de tickets y la ruta. Las frases van aquí dentro (no en una
   lista suelta) para que scripts/check-textos-ruta.mjs vea cada tx(). */
function sectores() {
  return [
    { key: 'otra', name: tx('Flota de furgonetas'),
      sub: tx('Servicios técnicos, obra, alquiler, reparto…: la revisión diaria con fotos, los conductores, el taller y los vencimientos.') },
    { key: 'mensajeria', name: tx('Mensajería y paquetería'),
      sub: tx('Escaneo de bultos, rutas por tiempo con franjas y hora estimada, seguimiento para el cliente, cobro a la entrega, y turnos y cuadrante del equipo.') },
    { key: 'supermercado', name: tx('Supermercado o tienda con reparto a domicilio'),
      sub: tx('El ticket de caja a la ruta: el repartidor escanea, ve la dirección y qué lleva, la ruta se ordena sola y al cliente le mandas la hora por WhatsApp con un toque.') },
    { key: 'distribucion', name: tx('Distribución a negocios'),
      sub: tx('Reparto a talleres, bares u obras: escaneo de bultos por la mañana, zonas por repartidor, ruta ordenada y la oficina viendo por dónde va cada uno.') },
    // Sin tx(): esta tarjeta nombra a Amazon y solo la tiene en cuenta check-marca.mjs aquí (sus módulos son de España).
    { key: 'dsp_amazon', name: 'DSP de Amazon',
      sub: 'Plantilla del día, DNR diaria, horas (WHC), cuadrante y turnos, asignación de furgonetas, revisiones con foto, taller y vencimientos. Sin extensiones ni nada que toque los sistemas de Amazon.' },
    { key: 'autonomo', name: tx('Repartir yo mismo'),
      sub: tx('Tu furgoneta y tus paquetes: los escaneas o fotografías la etiqueta, la ruta se ordena sola, llamas o escribes al cliente desde cada parada y cobras si toca.') },
  ]
}

/* Lo que cuesta repartir uno mismo, lo mismo que dicen la portada de repartidores, la app y los anuncios. */
const ofertaAutonomo = () => (promoGratis()
  ? tx('Gratis y sin límite hasta el {fecha}, sin tarjeta.', { fecha: fechaPromo(locale()) })
  : tx('Gratis hasta {n} paradas al día, sin tarjeta.', { n: PARADAS_GRATIS }))

/* La cabecera de los dos selectores y del formulario de empresa: la marca (a la portada) y el idioma, el MISMO selector y
   en el mismo orden que el pie de las páginas públicas. Cambia a la vez el idioma de la web (tx) y el del panel (t). */
function CabeceraAlta({ elegirIdioma, lang, href = '/' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <a href={href} className="inline-flex items-center gap-2.5 text-[color:var(--ld-text)]">
        <LogoMarca size={28} />
        <span className="text-[1.125rem] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
      </a>
      <label htmlFor="alta-idioma" className="sr-only">Idioma / Language</label>
      <select id="alta-idioma" value={lang} onChange={(e) => elegirIdioma(e.target.value)} aria-label="Idioma / Language"
        className="h-10 rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-2.5 text-[0.875rem] font-semibold text-[color:var(--ld-text)]">
        {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  )
}

/* «Ir al panel» en «Cuenta creada»: un enlace de texto, con su zona de toque de 44 px. */
const ENLACE_PANEL = 'inline-flex min-h-[44px] items-center text-[0.9375rem] font-semibold text-[color:var(--ld-text)] underline decoration-[color:var(--ld-border-strong)] underline-offset-4 hover:decoration-[color:var(--ld-text)]'

/* «¿Ya tienes cuenta? Entrar», al pie de los dos selectores. */
function YaTienesCuenta() {
  return (
    <p className="mt-8 text-center text-[0.9375rem] text-[color:var(--ld-muted)]">
      {tx('¿Ya tienes cuenta?')} <a href="/panel/login" className="font-semibold text-[color:var(--ld-accent)] underline-offset-4 hover:underline">{tx('Entrar')}</a>
    </p>
  )
}

/* IDENTIDAD (14-11-2026): los dos selectores con la de la portada de la que se viene (tinta sobre papel, o la noche si se
   eligió en el pie): una lista con reglas finas en vez de tarjetas con icono, sin degradados ni brillos; el cian, solo en
   el botón del plan recomendado. Antes: fondo oscuro con halo, rótulos de color en mayúsculas y «2 meses gratis». */
function SectorPicker({ onSelect, tema, lang, elegirIdioma }) {
  return (
    <div role="main" className="ld-root min-h-screen font-sans antialiased" data-theme={tema} data-testid="alta-sectores">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-6">
        <CabeceraAlta lang={lang} elegirIdioma={elegirIdioma} />
        <h1 className="ld-titular mt-12 text-[2rem] leading-[1.08] text-[color:var(--ld-text)] [text-wrap:balance] sm:text-[2.5rem]">{tx('¿Qué vas a hacer con {marca}?', { marca: MARCA.nombre })}</h1>
        <p className="mt-3 max-w-[560px] text-[1.0625rem] leading-relaxed text-[color:var(--ld-muted)]">{tx('Así te preparamos las pantallas que vas a usar. Podrás añadir o quitar cosas después.')}</p>
        <ul className="mt-8 border-b border-[color:var(--ld-border)]">
          {sectores().map((s) => (
            <li key={s.key} className="border-t border-[color:var(--ld-border)]">
              <button type="button" onClick={() => onSelect(s.key)} data-sector={s.key}
                className="group flex w-full items-center gap-4 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ld-text)]">
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.125rem] font-bold leading-snug text-[color:var(--ld-text)]">{s.name}</span>
                  <span className="mt-1 block text-[0.9688rem] leading-relaxed text-[color:var(--ld-text2)]">
                    {s.sub}{s.key === 'autonomo' && <> <b className="font-semibold text-[color:var(--ld-text)]">{ofertaAutonomo()}</b></>}
                  </span>
                </span>
                <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-[color:var(--ld-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--ld-text)]" />
              </button>
            </li>
          ))}
        </ul>
        <YaTienesCuenta />
      </div>
    </div>
  )
}

/* ── Selector de plan (paso 1) ── Los planes y sus frases, los de /planes (lib/precios.js), traducidos igual. */
function PlanPicker({ onSelect, furgonetas, setFurgonetas, repartidores, setRepartidores, sector, tema, lang, elegirIdioma }) {
  const [billing, setBilling] = useState('monthly')
  // Súper y distribución ven Reparto (recomendado) y Pro; a ellos Esencial (mínimo 10
  // furgonetas) les cobraría furgonetas que no tienen. El resto, Esencial y Pro.
  const reparteSector = PLAN_REPARTO.sectores.includes(sector)
  const visibles = PLANS.filter((p) => !p.soloSector
    && (p.soloSectores ? p.soloSectores.includes(sector) : !(reparteSector && p.key === 'operacion')))
  const destacado = (p) => (reparteSector ? p.key === 'reparto' : p.popular)
  const campoN = 'h-11 w-[5.5rem] rounded-[10px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] px-2 text-center font-mono text-[1rem] font-semibold text-[color:var(--ld-text)] focus:border-[color:var(--ld-text)] focus:outline-none'
  const etiquetaN = 'flex items-center gap-3 text-[0.9375rem] font-semibold text-[color:var(--ld-text)]'
  const pestana = (activa) => `min-h-[2.5rem] rounded-[9px] px-5 text-[0.9375rem] font-bold ${activa ? 'bg-[color:var(--ld-text)] text-[color:var(--ld-bg)]' : 'text-[color:var(--ld-muted)] hover:text-[color:var(--ld-text)]'}`

  return (
    <div role="main" className="ld-root min-h-screen font-sans antialiased" data-theme={tema} data-testid="alta-planes">
      <div className="mx-auto w-full max-w-[960px] px-4 pb-16 pt-6">
        <CabeceraAlta lang={lang} elegirIdioma={elegirIdioma} />

        <div className="mt-12 text-center">
          <p className="text-[0.9375rem] font-semibold text-[color:var(--ld-accent)]">{tx('{n} días de prueba, sin tarjeta.', { n: DIAS_PRUEBA_EMPRESA })}</p>
          <h1 className="ld-titular mt-3 text-[2rem] leading-[1.08] text-[color:var(--ld-text)] sm:text-[2.5rem]">{tx('Elige tu plan')}</h1>
          <p className="mx-auto mt-3 max-w-[520px] text-[1.0625rem] leading-relaxed text-[color:var(--ld-muted)]">{tx('Hoy no se cobra nada. Al acabar la prueba eliges si seguir.')}</p>

          <div role="group" aria-label={tx('Pago')} className="mt-6 inline-flex items-center gap-1 rounded-[12px] border border-[color:var(--ld-border-strong)] bg-[color:var(--ld-surface)] p-1">
            <button type="button" aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')} className={pestana(billing === 'monthly')}>{tx('Mensual')}</button>
            <button type="button" aria-pressed={billing === 'annual'} onClick={() => setBilling('annual')} className={`${pestana(billing === 'annual')} inline-flex items-center gap-2`}>
              {tx('Anual')}
              <span className={`whitespace-nowrap text-[0.8125rem] ${billing === 'annual' ? '' : 'text-[color:var(--ld-ok)]'}`}>{tx('pagas {meses} meses', { meses: MESES_ANUAL })}</span>
            </button>
          </div>
        </div>

        {/* Cuántos sois: el precio se calcula con lo vuestro, no con una flota tipo */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3">
          {reparteSector && (
            <label className={etiquetaN}>
              {tx('¿Cuántos repartidores tienes?')}
              <input type="number" min="1" max="5000" value={repartidores} aria-label={tx('Número de repartidores')} className={campoN}
                onChange={(e) => setRepartidores(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} />
            </label>
          )}
          <label className={etiquetaN}>
            {reparteSector ? tx('¿Y furgonetas?') : tx('¿Cuántos vehículos tienes?')}
            <input type="number" min="1" max="5000" value={furgonetas} aria-label={tx('Número de vehículos')} className={campoN}
              onChange={(e) => setFurgonetas(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} />
          </label>
        </div>

        <div className="mt-8 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
          {visibles.map((p) => {
            const n = p.porRepartidor ? repartidores : furgonetas
            const pop = destacado(p)
            const mes = precioMes(p, n)
            const precio = billing === 'annual' ? annualM(p, n) : mes
            return (
              <div key={p.key} data-plan={p.key}
                className={`relative flex flex-col rounded-[20px] bg-[color:var(--ld-surface)] px-6 pb-6 pt-7 ${pop ? 'border-2 border-[color:var(--ld-text)]' : 'border border-[color:var(--ld-border)]'}`}>
                {pop && (
                  <span className="absolute -top-[13px] left-6 whitespace-nowrap rounded-[6px] bg-[color:var(--ld-text)] px-2.5 py-[3px] text-[0.8125rem] font-bold text-[color:var(--ld-bg)]">{tx('Recomendado')}</span>
                )}
                <p className="text-[1.375rem] font-extrabold tracking-[-0.01em] text-[color:var(--ld-text)]">{tx(p.name)}</p>
                <p className="mt-1 text-[0.875rem] text-[color:var(--ld-muted)]">{tx(p.who)}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-x-1">
                  <span className="ld-titular text-[2.5rem] leading-none tabular-nums text-[color:var(--ld-text)]">{euros(precio)}</span>
                  <span className="text-[0.9375rem] text-[color:var(--ld-muted)]">{tx('/mes')}</span>
                  {billing === 'annual' && <s className="ml-2 text-[0.875rem] text-[color:var(--ld-muted)]">{euros(mes)}</s>}
                </p>
                {/* El precio es por furgoneta: sin esta línea, «200 €/mes» parecía una cuota fija y chocaba con el «Desde 5 €»
                    de la portada. */}
                <p className="mt-1.5 text-[0.875rem] text-[color:var(--ld-muted)]">
                  {p.porRepartidor
                    ? tx('{precio} por repartidor activo · con {n} repartidores · furgonetas incluidas', { precio: euros(p.porRepartidor), n: Math.max(n, p.minimo) })
                    : tx('{precio} por vehículo · con {n} vehículos', { precio: euros(p.porVehiculo), n: Math.max(n, p.minimo) })}
                  {n < p.minimo && <> · {tx('mínimo {n}', { n: p.minimo })}</>}
                </p>
                {billing === 'annual' && (
                  <p className="mt-1 text-[0.875rem] font-bold text-[color:var(--ld-ok)]">
                    {tx('{precio}/año · ahorras {ahorro}', { precio: euros(mes * MESES_ANUAL), ahorro: euros(annualSave(p, n)) })}
                  </p>
                )}
                <button type="button" onClick={() => onSelect(p.key, billing)} className={`${pop ? BTN_PRIMARIO : BTN_SECUNDARIO} mt-5 w-full`}>
                  {tx('Empezar con {plan}', { plan: tx(p.name) })} →
                </button>
                <ul className="mt-5 flex flex-1 flex-col gap-2">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[0.9062rem] leading-snug text-[color:var(--ld-text2)]">
                      <Check size={15} aria-hidden="true" className="mt-[3px] shrink-0 text-[color:var(--ld-ok)]" /> {tx(f)}
                    </li>
                  ))}
                  {p.no.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[0.875rem] leading-snug text-[color:var(--ld-muted)]">
                      <span aria-hidden="true" className="w-[15px] shrink-0 text-center">✕</span> {tx(f)}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <YaTienesCuenta />
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
  const [selectedPlan, setSelectedPlan] = useState(enIOS ? 'autonomo'
    : (planDelAlta(paramPlan, params.get('sector') || '') || (params.get('sector') === 'autonomo' ? 'autonomo' : '')))
  const [billingMode, setBillingMode] = useState(paramBilling)
  // Día o noche: la que se eligió en el pie de la portada (fds_tema_web). Quien reparte solo sigue con el de su app.
  const [tema] = useTemaWeb()

  /* UN SOLO IDIOMA EN TODO EL ALTA (14-11-2026). La portada y /planes guardan el suyo (fds_idioma, tx) y el panel el
     suyo (flota_lang, t); el alta usa los dos, así que al llegar se igualan: manda el que eligió la persona en el pie de
     la portada; si no eligió ninguno, el del panel, si lo tiene guardado. Y el selector de arriba cambia los dos. En la
     app de iPhone, y para quien reparte solo (su app tiene su idioma), no se toca nada. */
  const elegirIdioma = (l) => { cambiarIdioma(l); if (LANGS[l]) setLang(l) }
  useEffect(() => {
    if (enIOS || sector === 'autonomo') return
    let publico = null
    let panel = null
    try { publico = localStorage.getItem('fds_idioma'); panel = localStorage.getItem('flota_lang') } catch { /* modo privado */ }
    if (publico && LANGS[publico]) { if (publico !== lang) setLang(publico) } else if (panel && LANGS[panel] && panel !== idioma()) cambiarIdioma(panel)
  // Solo al llegar: después, el selector cambia los dos a la vez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    return <SectorPicker tema={tema} lang={idiomaApp} elegirIdioma={elegirIdioma} onSelect={(k) => {
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
      setRepartidores={setRepartidores} sector={sector} tema={tema} lang={idiomaApp} elegirIdioma={elegirIdioma} onSelect={(key, billing) => {
      setSelectedPlan(key)
      setBillingMode(billing)
      // Se conserva lo que traía la URL (utm_source de un anuncio): sin eso el
      // alta no sabría de qué campaña viene.
      const q = new URLSearchParams(window.location.search)
      q.set('sector', sector); q.set('plan', key); q.set('billing', billing)
      window.history.replaceState({}, '', `/registro?${q}`)
    }} />
  }

  const planInfo = PLANS.find(p => p.key === selectedPlan) || PLANS.find(p => p.key === 'operacion')
  const diasPrueba = planInfo.diasPrueba || 14
  const precioFijo = planInfo.mensual != null
  // Reparto se cuenta por repartidores; los demás, por furgonetas.
  const nUnid = planInfo.porRepartidor ? repartidores : furgonetas
  const displayPrice = billingMode === 'annual'
    ? annualM(planInfo, nUnid) : precioMes(planInfo, nUnid)
  const yearSave = annualSave(planInfo, nUnid)

  function onOrg(v) { setOrg(v); if (!slugTouched) setSlug(slugify(v) || (v.trim() ? sufijo : '')) }

  const soloYo = sector === 'autonomo'
  // Los textos del alta, en el idioma de la web: el de la app para quien reparte solo; para una empresa, el mismo que el
  // del panel (se igualan al llegar, arriba). Antes la empresa los veía siempre en español.
  const tt = tx
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
    if (!org.trim()) return setErr(soloYo ? tt('Dinos tu nombre.') : tx('Pon el nombre de tu empresa.'))
    if (s.length < 3) return setErr(tx('La dirección del portal tiene que tener al menos 3 letras o números.'))
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setErr(soloYo ? tt('Introduce un email válido.') : tx('Pon un correo válido.'))
    if (usuario.length < 3) return setErr(tx('El usuario debe tener al menos 3 caracteres'))
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
        setErr((typeof detalle === 'string' && tt(detalle)) || (soloYo ? tt('No se pudo crear la cuenta. Prueba con otro correo.') : tx('No se pudo crear la cuenta. Prueba con otro usuario o con otra dirección del portal.')))
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
      <div role="main" className="ld-root min-h-screen font-sans text-[17px] antialiased" data-theme={tema} data-testid="alta-cuenta-creada">
        <div className="mx-auto w-full max-w-[520px] px-4 pb-16 pt-6">
          <span className="inline-flex items-center gap-2.5">
            <LogoMarca size={28} />
            <span className="text-[18px] font-extrabold tracking-[-0.01em]">{MARCA.nombre}</span>
          </span>
          <h1 className="mt-12 text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em]">{t('alta.reg.creada')}</h1>
          <p className="mt-2 text-[15px] text-[color:var(--ld-muted)]">
            {t('alta.reg.plan').replace('{plan}', tx(planInfo.name)).replace('{n}', diasPrueba)}
          </p>
          {/* El correo, entero y en su propia línea (tanda 4): dentro de la frase se partía por el guion
              («transportes- / perez.es»). Si no cabe en el ancho, se corta letra a letra, nunca por el guion. */}
          {correoEnviado && (
            <p className="mt-4 text-[16px] leading-relaxed text-[color:var(--ld-text2)]" data-testid="alta-correo-enviado">
              {t('alta.reg.correo')}
              <b className="mt-0.5 block break-all font-mono text-[15px] font-medium text-[color:var(--ld-text)]" data-testid="alta-correo">{email.trim().toLowerCase()}</b>
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
              {/* «Empezar» es la acción; «Ir al panel», un enlace de texto debajo (tanda 4): pesaban lo mismo. */}
              <div className="mt-8 flex flex-col items-start gap-2">
                <button type="button" className={`${BTN_PRIMARIO} w-full sm:w-auto sm:min-w-[220px]`} onClick={() => { window.location.href = '/panel/arranque' }}>
                  {t('alta.reg.empezar')}
                </button>
                <a href="/panel" className={ENLACE_PANEL} data-testid="alta-ir-panel">{t('alta.reg.irPanel')}</a>
              </div>
            </>
          )}
          {reparte && (
            <a href="/panel" className={`mt-2 ${ENLACE_PANEL}`} data-testid="alta-ir-panel">{t('alta.reg.irPanel')}</a>
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
  /* COMPOSICIÓN DEL ALTA DE UNA EMPRESA (tanda 4, 14-11-2026): el idioma, al pie (no en una caja encima del título); los
     campos en dos grupos con su regla y su subtítulo («Tu empresa» / «Tu acceso»); y, desde 1024 px, a la derecha, los
     cuatro pasos que vienen después (los de «Cuenta creada» y el arranque, con sus mismas palabras). Lo que se envía no
     cambia. Quien reparte solo (y la app de iPhone, que solo da de alta a quien reparte) sigue exactamente igual. Las
     empresas que reparten van a su reparto, no al arranque: a ellas no se les enseñan esos pasos. */
  const conPasos = !soloYo && !reparte
  const grupo = (texto, id) => (
    <h2 id={id} style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: S.texto, borderTop: '1px solid var(--ld-border)', paddingTop: 16, margin: '32px 0 2px' }}>{texto}</h2>
  )
  const formulario = (
      <div style={soloYo ? { ...S.card, maxWidth: 440 } : S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: soloYo ? 18 : 28 }}>
          <a href={soloYo ? '/empezar' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, color: S.texto, textDecoration: 'none' }}>
            {soloYo
              ? <img src="/favicon.svg" alt="" width="34" height="34" style={{ borderRadius: 10 }} />
              : <LogoMarca size={28} />}
            <b style={{ fontSize: soloYo ? 17 : 18, fontWeight: soloYo ? 700 : 800 }}>{soloYo ? MARCA.app : MARCA.nombre}</b>
          </a>
          {soloYo && (
            <div style={{ marginLeft: 'auto' }}>
              <select value={idiomaApp} onChange={(e) => cambiarIdioma(e.target.value)} style={S.sel} aria-label="Idioma / Language">
                {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
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
        <div style={{ borderTop: '1px solid var(--ld-border)', padding: '12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{tt('Plan elegido')}: {tt(planInfo.name)}</div>
            <div style={{ fontSize: 14, color: S.gris, marginTop: 2 }}>
              {precioFijo
                ? tt('{precio} €/mes, todo incluido · {n} días gratis', { precio: displayPrice.toFixed(2).replace('.', ','), n: diasPrueba })
                : billingMode === 'annual'
                  ? tx('{precio} al mes · {anual} al año · ahorras {ahorro}', { precio: euros(displayPrice), anual: euros(precioMes(planInfo, nUnid) * MESES_ANUAL), ahorro: euros(yearSave) })
                  : planInfo.porRepartidor
                    ? tx('{precio} al mes · con {n} repartidores activos', { precio: euros(displayPrice), n: Math.max(nUnid, planInfo.minimo) })
                    : tx('{precio} al mes', { precio: euros(displayPrice) })
              }
              {` · ${t('alta.reg.prueba').replace('{n}', diasPrueba)}`}
            </div>
          </div>
          {!planInfo.soloSector && <button
            onClick={() => setSelectedPlan('')}
            style={{ background: 'transparent', border: `1.5px solid ${S.borde}`, color: S.texto, fontSize: 14, fontWeight: 700, padding: '0 14px', height: 40, borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}
          >
            {tx('Cambiar')}
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
        {!soloYo && grupo(tx('Tu empresa'), 'alta-grupo-empresa')}
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

        {/* Con varias sedes se escriben todas: el plan de una sola se queda
            con la primera. Sin esto la segunda sede no se podía dar de alta. */}
        {sector !== 'autonomo' && <>
        <label style={S.lbl} htmlFor="alta-sede">{selectedPlan === 'operacion' ? tx('Tu sede') : tx('Tus sedes')}</label>
        <input id="alta-sede" style={S.inp} value={center} onChange={(e) => setCenter(e.target.value)}
          placeholder={reparte ? tx('Tienda centro') : selectedPlan === 'operacion' ? tx('Norte') : tx('Norte, Sur, Este')} />
        {selectedPlan !== 'operacion' && <div style={S.hint}>{tx('Sepáralas con comas. Podrás añadir más después.')}</div>}
        </>}

        <label style={S.lbl}>{soloYo ? tt('Tu correo') : tx('Correo de contacto')}</label>
        <input style={S.inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={soloYo ? 'tu@correo.com' : 'admin@tuempresa.com'} autoComplete="email" />
        {sugerenciaCorreo(email) && (
          <button type="button" onClick={() => setEmail(sugerenciaCorreo(email))}
            style={{ ...S.hint, display: 'block', color: S.aviso, fontSize: 13, fontWeight: 600, textDecoration: 'underline', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            {tt('¿Querías decir {correo}?', { correo: sugerenciaCorreo(email) })}
          </button>
        )}

        {!soloYo && <>
        {grupo(tx('Tu acceso'), 'alta-grupo-acceso')}
        <label style={S.lbl}>{t('login.user')}</label>
        <input style={S.inp} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
        </>}
        {soloYo && <div style={S.hint}>{tt('Entrarás con tu correo y esta contraseña.')}</div>}

        <label style={S.lbl}>{soloYo ? tt('Contraseña') : t('login.pass')}</label>
        <input style={S.inp} type={soloYo && verPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => soloYo && e.key === 'Enter' && submit()} autoComplete="new-password"
          /* Las dos contraseñas con su pista (tanda 5, U7): antes solo la llevaba «Repetir». */
          placeholder={tt('Al menos 8 caracteres')} data-testid="reg-clave" />
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
              // Una empresa: la prueba, sin «gratis» de reclamo, y el importe como en todo el recorrido («60 € al mes»).
              : tx('{n} días de prueba. Hoy no se cobra nada y sin tarjeta no se cobra nunca: al acabar eliges si seguir con el plan {plan} ({precio} al mes).', {
                n: diasPrueba, plan: tx(planInfo.name), precio: euros(displayPrice) })}
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

        {/* El idioma, al pie: el mismo selector y en el mismo orden que el pie de la portada; cambia la web y el panel a la vez. */}
        {!soloYo && (
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--ld-border)' }}>
            <select value={idiomaApp} onChange={(e) => elegirIdioma(e.target.value)} style={S.sel} aria-label="Idioma / Language" data-testid="alta-idioma-pie">
              {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
      </div>
  )

  return (
    <div style={S.wrap} className={soloYo ? undefined : 'ld-root font-sans antialiased'} data-theme={soloYo ? undefined : tema} data-testid={soloYo ? undefined : 'alta-empresa'}>
      {conPasos ? (
        <div className="grid w-full max-w-[480px] lg:max-w-[1040px] lg:grid-cols-[480px_minmax(0,1fr)] lg:gap-24">
          {formulario}
          <PasosDespues t={t} />
        </div>
      ) : formulario}
    </div>
  )
}

/* Desde 1024 px, junto al formulario de una empresa: lo que viene después de crear la cuenta, con las mismas palabras que
   «Cuenta creada» y que el arranque del panel (alta.p1-p4 en i18nDict.js). En el móvil no sale: lo dice «Cuenta creada». */
function PasosDespues({ t }) {
  return (
    <aside aria-labelledby="alta-despues" className="hidden lg:block" data-testid="alta-pasos-despues">
      <div className="sticky top-8 pt-[76px]">
        <h2 id="alta-despues" className="text-[1.0625rem] font-bold text-[color:var(--ld-text)]">{tx('Después de crear la cuenta')}</h2>
        <p className="mt-1 text-[0.9688rem] leading-relaxed text-[color:var(--ld-muted)]">{t('alta.reg.pasos')}</p>
        <ol className="mt-5 border-t border-[color:var(--ld-border)]">
          {['alta.p1.titulo', 'alta.p2.titulo', 'alta.p3.titulo', 'alta.p4.titulo'].map((k, i) => (
            <li key={k} className="flex items-baseline gap-4 border-b border-[color:var(--ld-border)] py-3.5">
              <span className="w-5 font-mono text-[0.875rem] tabular-nums text-[color:var(--ld-muted)]">{i + 1}</span>
              <span className="text-[1.0625rem] font-semibold text-[color:var(--ld-text)]">{t(k)}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
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
