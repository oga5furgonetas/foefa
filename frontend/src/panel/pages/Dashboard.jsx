import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import {
  Truck, ClipboardList, BellRing, AlertTriangle, ShieldAlert, CheckCircle2, ChevronRight,
} from 'lucide-react'
import { getDashboardStats, getItvAlerts, getDamageCosts, getStatsHoy, getReviewQueue, getDanosPendientes } from '../api'
import { useT, LANG_LOCALE } from '../../i18n'
import { lista } from '../../lib/lista'
import { PageSkeleton } from '../components/Skeleton'
import Activacion from '../components/Activacion'
import { hoyLocal, isoLocal } from '../../lib/fecha'

/* ── helpers ── */
function greeting(t) {
  const h = new Date().getHours()
  // De madrugada es «buenas noches»: a las 2:00 decía «buenos días».
  if (h >= 6 && h < 13) return t('greet.morning')
  if (h >= 13 && h < 20) return t('greet.afternoon')
  return t('greet.evening')
}
function fmtDate(locale) {
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}
function fmtRelative(iso, t) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return t('time.now')
  if (m < 60) return t('time.mago').replace('{n}', m)
  const h = Math.floor(m / 60)
  if (h < 24) return t('time.hago').replace('{n}', h)
  return t('time.dago').replace('{n}', Math.floor(h / 24))
}

/* Contador natural: los números no aparecen, cuentan (easing cúbico, ~700 ms).
   Con prefers-reduced-motion el valor es instantáneo. */
function useCountUp(value, ms = 700) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const target = Number(value) || 0
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // Garantía de aterrizaje: si el navegador throttlea rAF (pestaña en segundo
    // plano, ahorro de batería), el valor final se fija igualmente.
    const land = setTimeout(() => setN(target), ms + 80)
    return () => { cancelAnimationFrame(raf); clearTimeout(land) }
  }, [value, ms])
  return n
}
function Count({ v }) { return <>{useCountUp(v)}</> }

/* Cifra suelta de la franja de hoy. En rojo SOLO cuando hay algo que hacer:
   un cero en rojo entrena a ignorar el color, y entonces el día que hay un
   missing de verdad tampoco se mira. */
function Mini({ n, label, alerta }) {
  if (n == null) return null
  return (
    <div>
      <div className={`font-display text-[22px] font-semibold leading-none tracking-[-0.02em] ${
        alerta ? 'text-red-300' : 'text-dark-100'}`}>
        <Count v={n} />
      </div>
      <div className="mt-1 text-[11.5px] text-dark-500">{label}</div>
    </div>
  )
}

/* ── ANILLO ───────────────────────────────────────────────────────────────────
   Donut en SVG puro: sin librería de gráficos, sin peso extra en el bundle y
   sin dependencias que mantener. Un `stroke-dasharray` sobre un círculo hace
   exactamente lo mismo que una librería para este caso. */
/* ── TARJETA DE CIFRA ─────────────────────────────────────────────────────────
   La fila de arriba: lo que hay que saber sin leer nada más.

   `serie` es OPCIONAL y sólo se pasa cuando existe de verdad. En el mockup de
   referencia las cinco tarjetas llevaban curva y un "↑5%", pero de casi ninguno
   de esos datos hay histórico (no se guarda una foto diaria del score ni de los
   daños), así que esas curvas serían dibujos. Aquí sólo lleva curva la única
   que tiene serie real: las inspecciones por día. */
function Cifra({ icono: Icono, n, label, sub, color, serie, onIr, alerta }) {
  const max = serie ? Math.max(1, ...serie) : 1
  const pts = serie && serie.length > 1
    ? serie.map((v, i) => `${(i / (serie.length - 1)) * 100},${28 - (v / max) * 24}`).join(' ')
    : null
  return (
    <button onClick={onIr} disabled={!onIr}
      className={`group overflow-hidden rounded-2xl border border-dark-800 bg-dark-900/40 p-4 text-left transition-all ${
        onIr ? 'hover:border-dark-600 hover:bg-dark-900' : 'cursor-default'}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: color + '1f' }}>
          <Icono size={14} style={{ color }} />
        </span>
        <span className="truncate text-[12px] font-medium text-dark-400">{label}</span>
      </div>
      <div className={`mt-2.5 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] ${
        alerta ? 'text-red-300' : 'text-dark-50'}`}>
        <Count v={n} />
      </div>
      {sub && <div className="mt-1 text-[11px] text-dark-500">{sub}</div>}
      {pts && (
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-2 h-7 w-full">
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.85" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </button>
  )
}

function Anillo({ segmentos, centro, sub, size = 132 }) {
  const R = (size - 14) / 2
  const C = 2 * Math.PI * R
  const total = segmentos.reduce((a, s) => a + s.n, 0) || 1
  let acc = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="11" />
        {segmentos.map((s) => {
          const frac = s.n / total
          const el = (
            <circle key={s.k} cx={size / 2} cy={size / 2} r={R} fill="none"
              stroke={s.color} strokeWidth="11" strokeLinecap="butt"
              strokeDasharray={`${frac * C} ${C}`}
              strokeDashoffset={-acc * C}
              style={{ transition: 'stroke-dasharray .7s ease' }} />
          )
          acc += frac
          return s.n > 0 ? el : null
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em] text-dark-50">{centro}</span>
        {sub && <span className="mt-1 text-[10.5px] text-dark-500">{sub}</span>}
      </div>
    </div>
  )
}

/* Barras de los últimos 7 días. También SVG-libre: divs con altura relativa.
   El día de hoy va marcado porque es el único sobre el que aún se puede
   actuar. */
function Barras({ dias }) {
  const max = Math.max(1, ...dias.map((d) => d.n))
  /* ALTURA EN PÍXELES, no en %. Con `height: X%` dentro de un contenedor cuya
     altura la decide flexbox, el navegador no tiene contra qué resolver el
     porcentaje y las barras salían con altura CERO: el panel enseñaba "321
     inspecciones" y debajo un hueco vacío. Con píxeles calculados no hay
     ambigüedad posible. */
  const ALTO = 84
  return (
    <div className="flex items-end gap-1.5" style={{ height: ALTO + 22 }}>
      {dias.map((d, i) => (
        <div key={d.key} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[10px] font-semibold tabular-nums text-dark-400">
            {d.n > 0 ? d.n : ''}
          </span>
          <div className={`w-full rounded-t transition-all duration-700 ${
            i === dias.length - 1 ? 'bg-brand-400/80' : 'bg-brand-500/35 group-hover:bg-brand-500/60'}`}
            style={{ height: Math.max(2, Math.round((d.n / max) * ALTO)) }} />
          <span className="text-[9.5px] uppercase tracking-wide text-dark-500">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ── MURO DE SALIDAS ──────────────────────────────────────────────────────────
   Una tarjeta por vehículo del cuadrante de hoy: quién lo lleva y si ya tiene
   su revisión de salida. Una furgoneta que sale sin fotos es un golpe que
   luego no se puede atribuir a nadie, así que las pendientes van primero y en
   ámbar. Se pincha y lleva a Asignación, donde se ve el día entero. */
function SalidaCard({ s, onIr, t }) {
  const sev = s.gravedad && SEV_KEYS[s.gravedad]
  const mal = s.gravedad === 'grave' || s.gravedad === 'critico'
  return (
    <button onClick={onIr}
      className={`group overflow-hidden rounded-xl border bg-dark-900/50 p-3 text-left transition-all hover:border-dark-600 hover:bg-dark-900 ${
        !s.revisada ? 'border-amber-500/30' : mal ? 'border-red-500/35' : 'border-dark-800'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[12px] font-bold tracking-wide text-dark-100">{s.matricula}</span>
        {s.ruta && <span className="truncate font-mono text-[10.5px] text-dark-500">{s.ruta}</span>}
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-dark-400">
        {s.conductor || t('dh.sinConductor')}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10.5px]">
        {!s.revisada ? (
          <span className="font-semibold text-amber-300">{t('hoy.pendiente')}</span>
        ) : sev ? (
          <span className={`rounded-full px-2 py-0.5 font-semibold ${sev.bg} ${sev.text}`}>{t(sev.key)}</span>
        ) : (
          <span className="text-emerald-400/90">{t('hoy.revisada')}</span>
        )}
      </div>
    </button>
  )
}

const SEV_KEYS = {
  sin_danos: { key: 'sev.sin_danos', color: '#34d399', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  leve:      { key: 'sev.leve',      color: '#fbbf24', bg: 'bg-yellow-500/15',  text: 'text-yellow-300' },
  moderado:  { key: 'sev.moderado',  color: '#fb923c', bg: 'bg-orange-500/15',  text: 'text-orange-300' },
  grave:     { key: 'sev.grave',     color: '#f87171', bg: 'bg-red-500/15',     text: 'text-red-300' },
  critico:   { key: 'sev.critico',   color: '#ef4444', bg: 'bg-red-600/20',     text: 'text-red-400' },
}
const SEV_ORDER = ['sin_danos', 'leve', 'moderado', 'grave', 'critico']

/* ── ITV Alerts ── */
function ItvAlerts({ items }) {
  const nav = useNavigate()
  const { t, lang } = useT()
  const locale = LANG_LOCALE[lang] || 'es-ES'
  if (!items?.length) return (
    <div className="flex flex-col items-center gap-2 py-8 text-dark-500">
      <CheckCircle2 size={24} />
      <span className="text-sm">{t('dash.no.itv')}</span>
    </div>
  )
  return (
    <div className="space-y-1">
      {items.slice(0, 6).map((a, i) => {
        const daysLeft = a.days_until_expiry ?? a.days_left
        const urgent = daysLeft != null && daysLeft <= 7
        const plate = a.license_plate || a.vehicle_plate || '—'
        return (
          <div
            key={a.id || i}
            onClick={() => nav('/panel/avisos-itv')}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-dark-700/40"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${urgent ? 'bg-red-500/15' : 'bg-amber-500/10'}`}>
              <ShieldAlert size={14} className={urgent ? 'text-red-400' : 'text-amber-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-dark-100">{plate}</div>
              <div className="mt-0.5 text-[11px] text-dark-500 truncate">
                {a.itv_expiry || a.expiry_date
                  ? `${t('itv.expires')} ${new Date(a.itv_expiry || a.expiry_date).toLocaleDateString(locale)}`
                  : t('itv.pending')}
              </div>
            </div>
            {daysLeft != null && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${urgent ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {daysLeft <= 0 ? t('itv.vencida') : `${daysLeft}d`}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main ── */
export default function Dashboard() {
  const { center, admin } = useOutletContext?.() || {}
  const { t, lang } = useT()
  const locale = LANG_LOCALE[lang] || 'es-ES'
  const [data,   setData]   = useState(null)
  const [itv,    setItv]    = useState([])
  const [costs,  setCosts]  = useState(null)
  const [err,    setErr]    = useState('')

  // € de daños nuevos (mes actual vs anterior) — carga independiente, no bloquea
  useEffect(() => {
    setCosts(null)
    getDamageCosts(center).then(r => setCosts(r.data)).catch(() => {})
  }, [center])

  /* EL DÍA DE LA FLOTA, en vivo: cuadrante, revisiones, checklist, golpes e
     incidencias de hoy (/stats/hoy) más la cola de revisión. Se refresca cada
     minuto: es lo único de la portada que cambia mientras la miras. */
  const [hoy, setHoy] = useState(null)
  const [cola, setCola] = useState(0)
  // Daños abiertos en el libro (los que aún no tienen orden de taller). Es el
  // número que pide una decisión; el de "críticos/graves en todas las
  // inspecciones" era un histórico de meses que no cambiaba nada hoy.
  const [danos, setDanos] = useState(null)
  const navTop = useNavigate()
  useEffect(() => {
    let stop = false
    setHoy(null)
    const load = () => Promise.all([
      getStatsHoy(center).catch(() => ({ data: null })),
      getReviewQueue(center).catch(() => ({ data: [] })),
    ]).then(([h, q]) => {
      if (stop) return
      setHoy(h.data || null)
      setCola(lista(q.data).length || (q.data?.items || []).length || 0)
    })
    load()
    const iv = setInterval(load, 60000)
    return () => { stop = true; clearInterval(iv) }
  }, [center])

  useEffect(() => {
    setData(null)
    setErr('')
    const isCentered = center && center !== 'Todos'
    Promise.all([
      getDashboardStats(center),
      /* Ya NO se pide /vehicles/last-inspections. Ese endpoint devuelve un MAPA
         {vehicle_id: fecha} para el semáforo de la lista de vehículos, no una
         lista de inspecciones: el dashboard lo interpretaba como lista y el
         resultado era SIEMPRE vacío, así que el panel "Actividad reciente"
         nunca pudo enseñar nada — con 41 inspecciones ese mismo día. Se ha
         quitado el panel y con él la petición, que además se hacía en cada
         carga para nada. */
      getItvAlerts(center).catch(() => ({ data: [] })),
      getDanosPendientes(isCentered ? { center } : {}).catch(() => ({ data: null })),
    ]).then(([stats, alerts, dp]) => {
      const ra   = alerts.data
      setDanos(dp?.data || null)
      const itvList    = Array.isArray(ra)  ? ra  : (ra?.items  || ra?.alerts       || [])

      /* Los contadores vienen ya acotados al centro desde /stats/dashboard
         (02-09-2026). Antes el backend ignoraba el centro y esto los
         recalculaba en el navegador a partir de /vehicles… filtrando por
         `status === 'workshop'`, un valor que no existe (el real es 'taller'):
         con OGA5 seleccionado salía "En taller 0 · 100 % de disponibilidad"
         teniendo 9 furgonetas en el taller. Un filtro por un valor que no
         existe no da error, da cero (gotcha 33). Y de paso se ahorran dos
         peticiones por carga, una de ellas el listado entero de furgonetas. */
      setData(stats.data)
      // /alerts/itv tambien viene acotado al centro desde el servidor.
      setItv(itvList)
    }).catch(() => setErr(t('dash.error')))
  }, [center])

  if (err) return <p className="text-red-400 p-4">{err}</p>
  if (!data) return <PageSkeleton kpis={4} rows={6} />

  const fleet = data.total_vehicles || 0
  const inShop = data.vehicles_in_workshop || 0
  const active = fleet - inShop
  const breakdown = data.severity_breakdown || {}
  const critCount = (breakdown.grave || 0) + (breakdown.critico || 0)
  const todayKey = hoyLocal()
  const todayInsp = data.weekly_activity?.[todayKey]?.inspecciones || 0
  /* La ITV en tres cajones, porque no son lo mismo: vencida (no puede salir),
     próxima (pedir cita) y SIN FECHA (no se sabe). Antes las 79 iban juntas
     como "vencidas o inminentes" y 57 eran simplemente desconocidas: el
     aviso exageraba, y un aviso que exagera deja de leerse (gotcha 41). */
  const itvVencidas = itv.filter((a) => a.status === 'caducada')
  /* `urgente` (7 días o menos) TAMBIÉN es próxima. Contando solo `proxima`,
     las ITV que caducaban esa misma semana —las que más urgen— no salían en
     el dashboard (16-09-2026). El backend reparte en caducada / urgente /
     proxima / sin_fecha. */
  const itvProximas = itv.filter((a) => a.status === 'proxima' || a.status === 'urgente')
  const itvSinFecha = itv.filter((a) => a.status === 'sin_fecha')

  const fleetSub = `${fleet} ${t('chart.total')} · ${inShop} ${t('dash.workshop').toLowerCase()}`
  const workshopSub = fleet > 0 ? `${Math.round((inShop/fleet)*100)}${t('dash.workshop.sub')}` : undefined
  const inspSub = `${data.total_inspections} ${t('dash.insptoday.sub')}`
  const itvSub = data.open_incidents
    ? `${data.open_incidents} ${t('dash.incidents.open')}`
    : t('dash.incidents.none')

  /* ── LO QUE PIDE UNA DECISIÓN, ORDENADO POR LO QUE CUESTA NO HACERLO ──────
     Antes esto era una lista plana donde "31 incidencias abiertas" —un backlog
     de semanas— pesaba lo mismo que "5 ITV vencidas", que es no poder circular
     legalmente. Y encima se repetía entera abajo como "tu trabajo de hoy", con
     los mismos números.

     Ahora cada línea lleva por qué importa, y van en este orden:
       1. ITV vencida  → la furgoneta no puede salir. Es lo único que para la
          operación de mañana.
       2. Salidas sin revisar → sin fotos de salida, un golpe que aparezca a
          la vuelta no se puede atribuir a nadie. Se arregla HOY o no se arregla.
       3. Inspecciones por validar → daños sin peritar es dinero sin reclamar.
       4. Incidencias / taller → importan, pero aguantan a mañana. */
  const sinRevisar = hoy ? hoy.salidas.total - hoy.salidas.revisadas : 0
  const decisiones = [
    { n: itvVencidas.length, label: t(itvVencidas.length === 1 ? 'ops.itv.expired.1' : 'ops.itv.expired'), why: t('ops.why.itv'),
      to: '/panel/vencimientos', tono: 'red' },
    { n: sinRevisar, label: t('ops.sinrevisar'), why: t('ops.why.sinrevisar'),
      to: '/panel/asignacion', tono: 'amber' },
    { n: itvProximas.length, label: t('ops.itv.soon'), why: t('ops.why.itv.soon'),
      to: '/panel/vencimientos', tono: 'amber' },
    { n: itvSinFecha.length, label: t('ops.itv.nodate'), why: t('ops.why.itv.nodate'),
      to: '/panel/vencimientos', tono: 'dark' },
    { n: cola, label: t('ops.validate'), why: t('ops.why.validate'),
      to: '/panel/revision', tono: 'amber' },
    { n: data.open_incidents || 0, label: t(data.open_incidents === 1 ? 'ops.incidents.1' : 'ops.incidents'), why: t('ops.why.incidents'),
      to: '/panel/incidencias', tono: 'dark' },
    { n: inShop, label: t(inShop === 1 ? 'ops.workshop.1' : 'ops.workshop'), why: t('ops.why.workshop'),
      to: '/panel/talleres', tono: 'dark' },
  ].filter((u) => u.n > 0)
  // Sólo cuenta como "urgente" lo que no aguanta a mañana. Meter el backlog en
  // ese número lo volvía enorme siempre y, por tanto, inútil.
  const urgentTotal = decisiones.filter((d) => d.tono !== 'dark')
    .reduce((a, u) => a + u.n, 0)

  /* Cuánta flota lleva ya su revisión de hoy. Sin vehículos (empresa recién
     creada) no hay porcentaje: un «0 %» diría que se ha dejado trabajo sin hacer. */
  const pctRev = hoy?.revision?.flota
    ? Math.round((hoy.revision.hechas / hoy.revision.flota) * 100) : null

  /* Los 7 últimos días de inspecciones, del backend (`weekly_activity`). El día
     de hoy va el último y es el único marcado: es sobre el que aún se actúa. */
  const semana = (() => {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = isoLocal(d)          // en UTC el dia se corria (gotcha 11)
      out.push({
        key,
        label: i === 0 ? t('chart.today') : d.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3),
        n: data.weekly_activity?.[key]?.inspecciones || 0,
      })
    }
    return out
  })()

  const firstName = (admin?.name || '').trim().split(/\s+/)[0] || ''
  const availPct = fleet > 0 ? Math.round((active / fleet) * 100) : null
  const totalSev = SEV_ORDER.reduce((a, k) => a + (breakdown?.[k] || 0), 0)
  const okPct = totalSev ? Math.round(((breakdown?.sin_danos || 0) / totalSev) * 100) : 100

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Héroe editorial: la tipografía ES la interfaz ── */}
      <header className="rise pb-8 pt-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-dark-500">
          {fmtDate(locale)}{center && center !== 'Todos' ? ` · ${center}` : ''}
        </p>
        <h1 className="mt-2 font-display text-[clamp(30px,4.2vw,48px)] font-semibold leading-[1.05] tracking-[-0.03em] text-dark-50">
          {greeting(t)}{firstName ? `, ${firstName}` : ''}.
        </h1>
        {/* La frase de arriba contesta "¿cómo va el día?" en una línea: cuánta
            flota lleva su revisión de salida y cuántas salen sin ella. */}
        <p className="mt-3 max-w-2xl text-[16.5px] leading-relaxed text-dark-400">
          {pctRev != null && fleet > 0 ? (
            <><b className="font-semibold text-dark-50"><Count v={hoy.revision.hechas} /> {t('ops.of')} {hoy.revision.flota}</b>{' '}
              {t('hoy.brief.rev')}
              {sinRevisar > 0 && (
                <> · <b className="font-semibold text-amber-300"><Count v={sinRevisar} /></b> {t('hoy.sinrevisar')}</>
              )}.
            </>
          ) : fleet === 0
            /* Sin una sola furgoneta, «la flota está en orden» es mentira: no
               hay flota. Una empresa recien registrada lo leia el primer dia. */
            ? t('ops.brief.empty')
            : urgentTotal > 0
            ? (<><b className="font-semibold text-dark-50"><Count v={urgentTotal} /></b> {t('ops.brief.items')}.</>)
            : t('ops.brief.calm')}
          {availPct != null && (
            <> <b className="font-semibold text-dark-50"><Count v={availPct} />%</b> {t('ops.avail')}.</>
          )}
        </p>
      </header>

      {/* Guía de activación: se pinta sola mientras falte algún paso y
          desaparece cuando la flota ya está en marcha. Sustituye al estado
          vacío de antes, que solo sabía decir "importa vehículos". */}
      <Activacion />

      {/* ── FILA DE CIFRAS ───────────────────────────────────────────────────
          Lo que hay que saber de un vistazo, a cualquier hora del día. Antes
          arriba no había NADA hasta que empezaba la operación: a las 6:45 de la
          mañana el panel se abría prácticamente vacío. */}
      {fleet > 0 && (
        /* Cinco cifras: o las cinco en fila o de dos en dos con la última a lo
           ancho. Con tres columnas quedaba un hueco al final de la segunda fila
           que parecía una tarjeta que no había cargado. */
        <div className="rise mb-2 grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1" style={{ animationDelay: '20ms' }}>
          <Cifra icono={Truck} color="#60a5fa" n={active} label={t('ops.active.veh')}
            sub={`${t('ops.of')} ${fleet}`} onIr={() => navTop('/panel/vehiculos')} />
          <Cifra icono={ClipboardList} color="#34d399" n={semana.reduce((a, d) => a + d.n, 0)}
            label={t('ops.inspections')} sub={t('ops.week')}
            serie={semana.map((d) => d.n)} onIr={() => navTop('/panel/inspecciones')} />
          <Cifra icono={AlertTriangle} color="#fbbf24" n={data.open_incidents || 0}
            label={t('ops.incidents')} sub={t('ops.open')} onIr={() => navTop('/panel/incidencias')} />
          <Cifra icono={ShieldAlert} color="#f87171" n={danos?.total ?? 0}
            label={t('ops.damage.open')}
            sub={t((danos?.furgonetas_graves ?? 0) === 1 ? ((danos?.graves ?? 0) === 1 ? 'ops.damage.open.sub.1' : 'ops.damage.open.sub.v1') : 'ops.damage.open.sub').replace('{g}', danos?.graves ?? 0).replace('{v}', danos?.furgonetas_graves ?? 0)}
            alerta={(danos?.graves || 0) > 0}
            onIr={() => navTop('/panel/ordenes')} />
          <Cifra icono={BellRing} color="#fb923c" n={itvVencidas.length + itvProximas.length} label={t('ops.itv.due')}
            sub={itvSinFecha.length ? t('ops.itv.nodate.sub').replace('{n}', itvSinFecha.length) : t('nav.expiries')}
            alerta={itvVencidas.length > 0} onIr={() => navTop('/panel/vencimientos')} />
        </div>
      )}

      {fleet === 0 ? null : (
      <div>
      {/* ── 1 · EL DÍA DE HOY ───────────────────────────────────────────────
          Lo primero, porque es lo único que se mueve mientras miras la
          pantalla: cuánta flota tiene su revisión, quién sale, y lo que ha
          pasado hoy (golpes nuevos, incidencias, checklist de turno). */}
      {hoy && hoy.revision.flota > 0 && (
        <section className="rise border-t border-white/[0.05] py-7" style={{ animationDelay: '40ms' }}>
          <h2 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-dark-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {t('hoy.titulo')}
          </h2>

          <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[46px] font-semibold leading-none tracking-[-0.03em] text-dark-50">
                  <Count v={pctRev} />
                </span>
                <span className="text-lg font-medium text-dark-500">%</span>
              </div>
              <p className="mt-1 text-[13px] text-dark-500">
                {t('hoy.revisados.sub').replace('{n}', hoy.revision.hechas).replace('{t}', hoy.revision.flota)}
              </p>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {hoy.salidas.total > 0 && <Mini n={hoy.salidas.total} label={t('hoy.salidas')} />}
              {hoy.salidas.total > 0 && <Mini n={sinRevisar} label={t('hoy.sinrevisar')} alerta={sinRevisar > 0} />}
              <Mini n={hoy.golpes.n} label={t('hoy.golpes')} alerta={hoy.golpes.n > 0} />
              <Mini n={hoy.incidencias.nuevas} label={t('hoy.incid')} alerta={hoy.incidencias.graves > 0} />
            </div>
          </div>

          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-emerald-400/80 transition-all duration-700"
              style={{ width: `${pctRev}%` }} />
          </div>

          {/* El checklist de cada turno, solo si ese turno existe hoy. */}
          {hoy.checklist.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {hoy.checklist.map((c) => (
                <button key={c.turno} onClick={() => navTop('/panel/checklist-operativo')}
                  className="rounded-xl border border-dark-800 bg-dark-900/40 px-4 py-3 text-left transition-colors hover:border-dark-600">
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="font-medium text-dark-300">{t(c.turno === 'manana' ? 'hoy.turno.manana' : 'hoy.turno.tarde')}</span>
                    <span className="tabular-nums text-dark-400">{c.hechas}/{c.total}</span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${c.hechas === c.total ? 'bg-emerald-400/80' : 'bg-brand-400/70'}`}
                      style={{ width: `${Math.round((c.hechas / c.total) * 100)}%` }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 1-bis · LAS SALIDAS DE HOY ───────────────────────────────────────
          Cada vehículo del cuadrante, con lo que hay que mirar primero: las
          que salen sin revisión y las que vuelven con el peor daño. */}
      {hoy?.salidas?.lista?.length > 0 && (
        <section className="rise border-t border-white/[0.05] py-7" style={{ animationDelay: '70ms' }}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-dark-100">
              {t('hoy.muro')}
              <span className="ml-2 text-[13px] font-normal tabular-nums text-dark-500">{hoy.salidas.total}</span>
            </h2>
            <button onClick={() => navTop('/panel/asignacion')}
              className="text-[12px] text-dark-500 transition-colors hover:text-dark-300">
              {t('dash.see.all')} →
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hoy.salidas.lista.slice(0, 12).map((x) => (
              <SalidaCard key={x.vehicle_id} s={x} t={t} onIr={() => navTop('/panel/asignacion')} />
            ))}
          </div>
          {hoy.salidas.total > 12 && (
            <p className="mt-2.5 text-[11.5px] text-dark-500">
              {t('hoy.muro.mas').replace('{n}', hoy.salidas.total - 12)}
            </p>
          )}
        </section>
      )}

      {/* ── 2 · DECISIONES ───────────────────────────────────────────────────
          Una sola lista, ordenada por lo que cuesta NO hacerlo, y cada línea
          dice por qué importa. Antes eran dos secciones con los mismos
          números repetidos y sin explicar ninguna. */}
      {decisiones.length > 0 && (
        <section className="rise border-t border-white/[0.05] py-7" style={{ animationDelay: '100ms' }}>
          <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-dark-100">
            {t('ops.decisions')}
            {urgentTotal > 0 && (
              <span className="text-[13px] font-normal tabular-nums text-red-400/90">
                (<Count v={urgentTotal} /> {t('ops.cannot.wait')})
              </span>
            )}
          </h2>
          <div className="mt-2">
            {decisiones.map((u) => (
              <button key={u.label} onClick={() => navTop(u.to)}
                className="float-row group -mx-4 flex w-[calc(100%+2rem)] items-start gap-3 rounded-xl px-4 py-3 text-left">
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                  u.tono === 'red' ? 'bg-red-400' : u.tono === 'amber' ? 'bg-amber-400' : 'bg-dark-600'}`} />
                <span className="min-w-0">
                  <span className="block text-[14.5px] text-dark-200">
                    <b className="font-semibold tabular-nums text-dark-50"><Count v={u.n} /></b> {u.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-dark-500">{u.why}</span>
                </span>
                <ChevronRight size={15} className="ml-auto mt-1 shrink-0 text-dark-500 transition-transform group-hover:translate-x-0.5 group-hover:text-dark-300" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── 2-bis · LA FLOTA, EN IMÁGENES ────────────────────────────────────
          Tres piezas y las tres con datos REALES. En el mockup de referencia
          había tarjetas con "↑5%" y curvas de tendencia: eso aquí no se puede
          calcular para casi ningún dato (no hay serie histórica de daños por
          semana), y una flecha verde inventada en una pantalla que se enseña a
          un cliente es lo peor que podríamos poner. Va lo que hay. */}
      <section className="rise border-t border-white/[0.05] py-7" style={{ animationDelay: '140ms' }}>
        <h2 className="mb-4 text-[15px] font-semibold text-dark-100">{t('ops.fleet.state')}</h2>
        <div className="grid gap-5 lg:grid-cols-3">

          {/* Disponibilidad: cuántas furgonetas pueden salir mañana. */}
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-dark-500">{t('ops.availability')}</p>
            <div className="flex items-center gap-5">
              <Anillo size={124}
                centro={`${availPct ?? 0}%`} sub={t('ops.ready')}
                segmentos={[
                  { k: 'ok', n: active, color: '#34d399' },
                  { k: 'shop', n: inShop, color: '#fbbf24' },
                ]} />
              <div className="space-y-2 text-[12.5px]">
                <p className="flex items-center gap-2 text-dark-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {t('ops.ready')} <b className="ml-auto tabular-nums text-dark-100">{active}</b>
                </p>
                <p className="flex items-center gap-2 text-dark-300">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {t('dash.workshop')} <b className="ml-auto tabular-nums text-dark-100">{inShop}</b>
                </p>
                <p className="flex items-center gap-2 text-dark-500">
                  <span className="h-2 w-2 rounded-full bg-dark-600" />
                  {t('nav.drivers')} <b className="ml-auto tabular-nums text-dark-300">{data.total_drivers}</b>
                </p>
              </div>
            </div>
          </div>

          {/* Severidad de los daños. Se dice CLARAMENTE que es el acumulado de
              todas las inspecciones, no de esta semana: es lo que hay, y
              etiquetarlo como semanal sería mentir. */}
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-dark-500">{t('ops.damage.split')}</p>
            <div className="flex items-center gap-5">
              <Anillo size={124}
                centro={data.total_inspections?.toLocaleString(locale) ?? '—'}
                sub={t('ops.inspections')}
                segmentos={SEV_ORDER.map((k) => ({ k, n: breakdown?.[k] || 0, color: SEV_KEYS[k].color }))} />
              <div className="space-y-1.5 text-[12px]">
                {SEV_ORDER.map((k) => (
                  <p key={k} className="flex items-center gap-2 text-dark-400">
                    <span className="h-2 w-2 rounded-full" style={{ background: SEV_KEYS[k].color }} />
                    {t(SEV_KEYS[k].key)}
                    <b className="ml-auto tabular-nums text-dark-200">{breakdown?.[k] || 0}</b>
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Actividad real de los últimos 7 días. */}
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-dark-500">{t('ops.week')}</p>
            <p className="mb-4 text-[12.5px] text-dark-500">
              <b className="text-dark-100">{semana.reduce((a, d) => a + d.n, 0)}</b> {t('ops.inspections')}
            </p>
            <Barras dias={semana} locale={locale} />
          </div>
        </div>
      </section>

      {/* ── 3 · LA FLOTA, EN UNA LÍNEA ───────────────────────────────────── */}
      <section className="rise border-t border-white/[0.05] py-7" style={{ animationDelay: '160ms' }}>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-dark-100">
          <span className="text-emerald-400">●</span> {t('ops.control')}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-dark-400">
          <b className="font-semibold text-dark-100"><Count v={active} /></b> {t('ops.active.veh')}
          <span className="mx-2 text-dark-700">·</span>
          <b className="font-semibold text-dark-100"><Count v={data.total_drivers} /></b> {t('nav.drivers').toLowerCase()}
          <span className="mx-2 text-dark-700">·</span>
          <b className="font-semibold text-dark-100"><Count v={todayInsp} /></b> {t('ops.insp.today')}
          {costs && costs.month_eur > 0 && (
            <><span className="mx-2 text-dark-700">·</span>
            <b className={`font-semibold ${costs.prev_month_eur && costs.month_eur < costs.prev_month_eur ? 'text-emerald-400' : 'text-amber-300'}`}>{Math.round(costs.month_eur).toLocaleString('es-ES')} €</b> {t('ops.damage.month')}</>
          )}
        </p>
        {costs && (costs.month_real_eur > 0 || costs.en_taller > 0 || costs.sin_gestionar > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
            {costs.month_real_eur > 0 && (
              <span className="text-dark-400">
                <b className="font-semibold text-emerald-300">{Math.round(costs.month_real_eur).toLocaleString('es-ES')} €</b> {t('eur.real')}
              </span>
            )}
            {costs.sin_gestionar > 0 && (
              <span className="text-amber-300/90">{t('eur.unmanaged').replace('{n}', costs.sin_gestionar)}</span>
            )}
          </div>
        )}
      </section>

      {/* ── Próximos vencimientos (ancho completo) ── */}
      {itv.length > 0 && (
        <section className="rise border-t border-white/[0.05] py-7" style={{ animationDelay: '260ms' }}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-dark-100">{t('ops.upcoming')}</h2>
            <button onClick={() => navTop('/panel/vencimientos')} className="text-[12px] text-dark-500 transition-colors hover:text-dark-300">
              {t('dash.see.all')} →
            </button>
          </div>
          <ItvAlerts items={itv} />
        </section>
      )}
      </div>
      )}
    </div>
  )
}
