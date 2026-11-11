import InicioReparto from './InicioReparto'
import { usePlan } from '../../lib/usePlan'
import { esReparto } from '../../lib/sector'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import {
  Truck, ClipboardList, BellRing, AlertTriangle, ShieldAlert, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardCheck, Wrench, Users, ListChecks, Store, HeartPulse,
} from 'lucide-react'
import { getDashboardStats, getItvAlerts, getDamageCosts, getStatsHoy, getReviewQueue, getEstadoFlota, getCentrosHoy } from '../api'
import casarCentro from '../casarCentro'
import { useT, LANG_LOCALE } from '../../i18n'
import { lista } from '../../lib/lista'
import { PageSkeleton } from '../components/Skeleton'
import Activacion from '../components/Activacion'
import Casilla from '../components/Casilla'
import { mercEstado } from '../../services/api'
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
// `centro` (11-11-2026, portal_inicio-1): con «Todos» las tarjetas mezclaban las naves sin decir de cuál es cada
// furgoneta; ahora lo dicen, y al tocarla se entra en Asignación con ESE centro ya elegido.
function SalidaCard({ s, onIr, t, centro }) {
  const sev = s.gravedad && SEV_KEYS[s.gravedad]
  const mal = s.gravedad === 'grave' || s.gravedad === 'critico'
  return (
    <button onClick={onIr}
      className={`group overflow-hidden rounded-xl border bg-dark-900/50 p-3 text-left transition-all hover:border-dark-600 hover:bg-dark-900 ${
        !s.revisada ? 'border-amber-500/30' : mal ? 'border-red-500/35' : 'border-dark-800'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[12px] font-bold tracking-wide text-dark-100">{s.matricula}</span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          {s.ruta && <span className="truncate font-mono text-[10.5px] text-dark-500">{s.ruta}</span>}
          {centro && <span className="shrink-0 rounded bg-dark-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-dark-300">{centro}</span>}
        </span>
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

/* ── CÓMO VA CADA CENTRO (11-11-2026, revisión de la flota propia: portal_inicio-6 y -2, historia-6, dia-10) ──
   Con «Todos», el Inicio sumaba las naves en una cifra: para saber cuál iba atrasada había que cambiar de nave arriba
   y mirar tres veces, y para saber si estaba la plantilla de hoy o el plan de horas de la semana, entrar en cada
   pantalla. Una fila por centro: sus salidas revisadas y si cada dato está y de cuándo es (sin ninguna cifra de
   Amazon). Cada dato lleva a su pantalla con ese centro ya elegido; el nombre del centro, al Inicio de ese centro.
   Solo salen los datos de pantallas que esta persona puede abrir (`puede`, la regla del menú). */
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
const TONO_DATO = {
  ok: 'border-emerald-500/30 text-emerald-300',
  falta: 'border-amber-500/40 bg-amber-500/5 text-amber-300',
  neutro: 'border-dark-700 text-dark-300',
}

/* La DNR llega con unos dos días de retraso: hasta 4 días sin subir es lo normal; más, se pinta en ámbar (11-11-2026,
   revisión: la de hace una semana salía en gris, igual que la de antes de ayer). El umbral lo puede afinar Dani. */
const DNR_DIAS_NORMAL = 4
const diasEntre = (desde, hasta) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000)

function ComoVaCadaCentro({ centers, datos, porCentro, hoyIso, puede, ir, t }) {
  /* En el móvil, cada centro va plegado en una línea con su resumen y sus datos se abren al tocarla (11-11-2026,
     revisión): abiertos, con una pastilla de 44 px por dato, dos centros ocupaban una pantalla entera y «El día de
     hoy» quedaba muy abajo. En el ordenador (sm: en adelante) se ven siempre, como antes. */
  const [abiertos, setAbiertos] = useState({})
  const filas = centers.map((c) => ({
    c,
    d: (datos || []).find((x) => casarCentro(x.centro, [c]) === c) || null,
    p: (porCentro || []).find((x) => casarCentro(x.centro, [c]) === c) || null,
  }))
  const viejo = (iso) => !iso || iso < hoyIso
  return (
    <section className="rise border-t border-white/[0.05] py-7" data-testid="como-va-cada-centro" style={{ animationDelay: '30ms' }}>
      <h2 className="text-[15px] font-semibold text-dark-100">{t('centros.hoy.titulo')}</h2>
      <p className="mt-1 text-[12.5px] text-dark-500">{t('centros.hoy.sub')}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {filas.map(({ c, d, p }) => {
          const datosC = [
            p && puede('/panel/asignacion') && {
              to: '/panel/asignacion',
              texto: p.salidas > 0 ? t('centros.hoy.salidas').replace('{n}', p.revisadas).replace('{t}', p.salidas) : t('centros.hoy.sin.salidas'),
              tono: p.salidas === 0 ? 'neutro' : p.revisadas === p.salidas ? 'ok' : 'falta',
            },
            d && puede('/panel/plantilla') && {
              to: '/panel/plantilla',
              texto: `${t('nav.template')}: ${d.plantilla
                ? (d.plantilla.por ? t('centros.hoy.guardada.por').replace('{n}', d.plantilla.por) : t('centros.hoy.guardada'))
                : t('centros.hoy.sin.guardar')}`,
              tono: d.plantilla ? 'ok' : 'falta',
            },
            d && puede('/panel/horas') && {
              to: '/panel/horas',
              texto: `${t('nav.horas')}: ${!d.horas ? t('centros.hoy.sin.plan')
                : d.horas.al_dia ? t('centros.hoy.esta.semana') : t('centros.hoy.semana.del').replace('{f}', ddmm(d.horas.semana))}`,
              tono: d.horas?.al_dia ? 'ok' : 'falta',
            },
            d && puede('/panel/diarios') && {
              to: '/panel/diarios',
              texto: `${t('nav.dnr')}: ${d.dnr_ultimo ? t('centros.hoy.ultimo').replace('{f}', ddmm(d.dnr_ultimo)) : t('centros.hoy.nada')}`,
              tono: d.dnr_ultimo && diasEntre(d.dnr_ultimo, hoyIso) <= DNR_DIAS_NORMAL ? 'neutro' : 'falta',
            },
            d && puede('/panel/cuadrante') && {
              to: '/panel/cuadrante',
              texto: `${t('nav.cuadrante')}: ${d.cuadrante_hasta ? t('centros.hoy.hasta').replace('{f}', ddmm(d.cuadrante_hasta)) : t('centros.hoy.nada')}`,
              tono: viejo(d.cuadrante_hasta) ? 'falta' : 'ok',
            },
            d && puede('/panel/cuadrante') && {
              to: '/panel/cuadrante',
              texto: `${t('centros.hoy.maximas')}: ${d.maximas_hasta ? t('centros.hoy.hasta').replace('{f}', ddmm(d.maximas_hasta)) : t('centros.hoy.nada')}`,
              tono: viejo(d.maximas_hasta) ? 'falta' : 'ok',
            },
          ].filter(Boolean)
          const porMirar = datosC.filter((x) => x.tono === 'falta').length
          const abierto = !!abiertos[c]
          return (
            <div key={c} className="rounded-xl border border-dark-800 bg-dark-900/40 p-3" data-centro={c}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => ir(c, '/panel')} aria-label={t('centros.hoy.entrar').replace('{c}', c)}
                  className="flex min-h-[44px] w-full min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1 text-left font-mono text-[15px] font-bold tracking-wide text-dark-50 hover:bg-white/[0.03]">
                  {c} <ChevronRight size={16} className="shrink-0 text-dark-500" />
                </button>
                {/* Solo en el móvil: el resumen de la fila, que abre y cierra sus datos. */}
                {datosC.length > 0 && (
                  <button type="button" aria-expanded={abierto} onClick={() => setAbiertos((a) => ({ ...a, [c]: !a[c] }))}
                    className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium sm:hidden ${TONO_DATO[porMirar ? 'falta' : 'ok']}`}>
                    {porMirar ? t('centros.hoy.por.mirar').replace('{n}', porMirar) : t('centros.hoy.al.dia')}
                    <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
              {datosC.length > 0 && (
                <div className={`mt-2 ${abierto ? 'grid' : 'hidden'} grid-cols-2 gap-2 sm:flex sm:flex-wrap`}>
                  {datosC.map((x, i) => (
                    <button key={i} type="button" onClick={() => ir(c, x.to)} data-tono={x.tono}
                      className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-left text-[12.5px] font-medium leading-snug transition-colors hover:bg-white/[0.04] ${TONO_DATO[x.tono]}`}>
                      {x.texto}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

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
/* Una empresa que reparte ve su reparto; las demás, la portada de flota. Va
   en una función aparte para no romper el orden de los hooks de la portada. */
export default function Dashboard() {
  const { billing } = usePlan()
  if (esReparto(billing?.sector)) return <InicioReparto sector={billing.sector} />
  return <DashboardFlota />
}

function DashboardFlota() {
  // `ve(ruta)`: la MISMA regla que el menú (PanelLayout). Una casilla de una pantalla que no puede abrir sería
  // una puerta que se cierra al tocarla.
  const { center, centers, setCenter, admin, ve } = useOutletContext?.() || {}
  const puede = (to) => (typeof ve === 'function' ? ve(to) : true)
  // «Todos» con más de un centro: es cuando hace falta decir de qué centro es cada cosa y llevar a él (11-11-2026).
  const todos = center === 'Todos' && (centers?.length || 0) > 1
  const [merc, setMerc] = useState(null)
  useEffect(() => {
    mercEstado().then(({ data }) => setMerc(data?.visible ? data : null)).catch(() => setMerc(null))
  }, [])
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
  // El estado de la flota (17-10-2026): cuántas furgonetas necesitan taller y la salud media. Sustituye a los
  // «daños abiertos» del libro, que contaban golpes sueltos; esto cuenta furgonetas, y por qué.
  const [ef, setEf] = useState(null)
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

  // Cómo va cada centro: solo con «Todos». Si falla (un servidor de antes), el bloque sale solo con las salidas.
  /* Se vuelve a pedir cada minuto, al mismo ritmo que /stats/hoy (11-11-2026, revisión): pedido una sola vez, si María
     guardaba la plantilla de OGA5 a las 7:20, el Inicio de Dani seguía diciendo «sin guardar hoy» hasta recargar (y
     de un día para otro, igual). Si una vez falla, se queda lo último bueno: un fallo suelto no borra lo que se sabía. */
  const [centrosHoy, setCentrosHoy] = useState(null)
  useEffect(() => {
    if (!todos) { setCentrosHoy(null); return undefined }
    let stop = false
    const cargar = () => getCentrosHoy().then((r) => { if (!stop && r.data) setCentrosHoy(r.data) }).catch(() => {})
    cargar()
    const iv = setInterval(cargar, 60000)
    return () => { stop = true; clearInterval(iv) }
  }, [todos])

  useEffect(() => {
    setData(null)
    setErr('')
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
      getEstadoFlota(center).catch(() => ({ data: null })),
    ]).then(([stats, alerts, estado]) => {
      const ra   = alerts.data
      setEf(estado?.data || null)
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
    { n: sinRevisar, label: t(sinRevisar === 1 ? 'ops.sinrevisar.1' : 'ops.sinrevisar'), why: t('ops.why.sinrevisar'),
      to: '/panel/asignacion', tono: 'amber' },
    { n: itvProximas.length, label: t('ops.itv.soon'), why: t('ops.why.itv.soon'),
      to: '/panel/vencimientos', tono: 'amber' },
    { n: itvSinFecha.length, label: t('ops.itv.nodate'), why: t('ops.why.itv.nodate'),
      to: '/panel/vencimientos', tono: 'dark' },
    { n: cola, label: t(cola === 1 ? 'ops.validate.1' : 'ops.validate'), why: t('ops.why.validate'),
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
  /* LA CIFRA GRANDE, SOBRE LAS SALIDAS (11-11-2026, portal_inicio-4). Con furgonetas de reserva que no salen, el
     porcentaje de toda la flota no llegaba nunca al 100 % aunque todo lo que salió estuviera revisado, y parecía que
     faltaba trabajo. Con salidas en el cuadrante, la cifra grande y la frase son «salidas revisadas X de Y»; lo de
     toda la flota va debajo, en pequeño. Sin cuadrante hoy, como antes. */
  const conSalidas = (hoy?.salidas?.total || 0) > 0
  const pctGrande = conSalidas ? Math.round((hoy.salidas.revisadas / hoy.salidas.total) * 100) : pctRev

  /* A QUÉ CENTRO LLEVAR, con «Todos» (11-11-2026, portal_inicio-1). Asignación y el checklist son de un centro: si
     solo hay UN centro con algo pendiente (o con salidas, o con ese turno), se elige ese y se entra; si hay varios,
     se entra sin elegir y la pantalla ofrece los centros ahí mismo. El centro de /stats/hoy se casa con las pastillas
     de arriba (puede venir escrito largo): uno que no case haría volver a «Todos» y el toque no serviría. */
  const porCentro = hoy?.por_centro || []
  const unico = (pred) => {
    if (!todos) return null
    const cs = [...new Set(porCentro.filter(pred).map((x) => casarCentro(x.centro, centers)).filter(Boolean))]
    return cs.length === 1 ? cs[0] : null
  }
  const centroAsignacion = unico((x) => x.salidas > x.revisadas) || unico((x) => x.salidas > 0)
  const centroChecklist = (tk) => unico((x) => (x.checklist || []).some((c) => c.turno === tk && c.hechas < c.total))
    || unico((x) => (x.checklist || []).some((c) => c.turno === tk))
  const irAlCentro = (c, to) => {
    if (c && setCenter) setCenter(c)
    if (to) navTop(to)
  }

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

  /* ── LAS CASILLAS (17-10-2026) ─────────────────────────────────────────────
     Dani: «cámbiame el dashboard y añade este estilo de iconos». Cada casilla lleva a su pantalla con su número;
     el globito es lo que no puede esperar (rojo) o conviene mirar hoy (naranja). Los textos son los mismos de
     la lista de decisiones de antes, así que siguen en los seis idiomas. */
  const semanaTotal = semana.reduce((a, d) => a + d.n, 0)
  const salidasHoy = hoy?.salidas?.total || 0
  // El turno que toca a esta hora (10-11-2026): por la tarde enseñaba siempre el de mañana. Las 15:00 son
  // el cierre del de mañana por defecto (turno_manana en _HORARIOS_DEF, server.py). Si solo hay uno, ese.
  const turnos = hoy?.checklist || []
  const turno = turnos.find((c) => c.turno === (new Date().getHours() >= 15 ? 'tarde' : 'manana')) || turnos[0]
  const abiertas = data.open_incidents || 0
  const urgentes = ef?.niveles?.urgente || 0
  const aTaller = urgentes + (ef?.niveles?.taller || 0)
  const ordenesAbiertas = (ef?.en_taller || []).filter((x) => x.orden).length
  const mercAviso = merc ? (merc.por_revisar || merc.sin_leer || 0) : 0
  const casillas = [
    { to: '/panel/vehiculos', icono: Truck, titulo: t('nav.vehicles'), detalle: fleet ? `${active} ${t('ops.of')} ${fleet} · ${t('ops.active.veh')}` : '' },
    // La que peor está, la siguiente…: el globito son las que no pueden esperar.
    { to: '/panel/estado-flota', icono: HeartPulse, titulo: t('nav.estadoFlota'), aviso: urgentes, tono: urgentes ? 'rojo' : aTaller ? 'ambar' : '',
      detalle: ef?.salud_media != null ? `${t('ef.salud.media')} ${ef.salud_media}/100${aTaller ? ` · ${aTaller} ${t('ef.a.taller')}` : ''}` : '' },
    { to: '/panel/revision', icono: CheckCircle2, titulo: t('nav.revision'), aviso: cola, avisoTono: 'ambar', tono: cola ? 'ambar' : '',
      detalle: `${cola} ${t(cola === 1 ? 'ops.validate.1' : 'ops.validate')}` },
    { to: '/panel/asignacion', centro: centroAsignacion, icono: ClipboardCheck, titulo: t('nav.assign'), aviso: sinRevisar, avisoTono: 'ambar', tono: sinRevisar ? 'ambar' : '',
      detalle: sinRevisar > 0 ? `${sinRevisar} ${t(sinRevisar === 1 ? 'ops.sinrevisar.1' : 'ops.sinrevisar')}` : salidasHoy ? `${salidasHoy} ${t('hoy.salidas')}` : '' },
    { to: '/panel/inspecciones', icono: ClipboardList, titulo: t('nav.inspections'), detalle: `${semanaTotal} · ${t('ops.week').toLowerCase()}` },
    { to: '/panel/vencimientos', icono: BellRing, titulo: t('nav.grp.expiry'), aviso: itvVencidas.length, tono: itvVencidas.length ? 'rojo' : '',
      detalle: itvVencidas.length ? `${itvVencidas.length} ${t(itvVencidas.length === 1 ? 'ops.itv.expired.1' : 'ops.itv.expired')}`
        : itvProximas.length ? `${itvProximas.length} ${t('ops.itv.soon')}` : '' },
    // «1 abiertas» en la foto del 10-11-2026: singular y plural.
    { to: '/panel/ordenes', icono: ShieldAlert, titulo: t('nav.ordenes'),
      detalle: ef ? `${ordenesAbiertas} ${t(ordenesAbiertas === 1 ? 'ops.ordenes.abierta' : 'ops.ordenes.abiertas')}` : '' },
    { to: '/panel/incidencias', icono: AlertTriangle, titulo: t('nav.incidents'), detalle: `${abiertas} ${t(abiertas === 1 ? 'ops.incidents.1' : 'ops.incidents')}` },
    { to: '/panel/talleres', icono: Wrench, titulo: t('nav.workshops'), detalle: `${inShop} ${t(inShop === 1 ? 'ops.workshop.1' : 'ops.workshop')}` },
    { to: '/panel/conductores', icono: Users, titulo: t('nav.drivers'), detalle: data.total_drivers != null ? String(data.total_drivers) : '' },
    ...(turno ? [{ to: '/panel/checklist-operativo', centro: centroChecklist(turno.turno), icono: ListChecks, titulo: t('nav.checklist'), detalle: `${turno.hechas}/${turno.total}` }] : []),
    // El mercadillo de repartidores, también para la oficina (solo si está abierto; lo decide el servidor).
    ...(merc ? [{ to: merc.por_revisar ? '/panel/admin?s=mercadillo' : '/mercadillo', siempre: true, icono: Store, titulo: 'Mercadillo',
      aviso: mercAviso, tono: 'brand',
      detalle: merc.por_revisar ? `${merc.por_revisar} por revisar` : merc.sin_leer ? `${merc.sin_leer} sin leer` : 'Vende lo que no uses' }] : []),
  ].filter((c) => c.siempre || puede(c.to.split('?')[0]))
  const irA = (to, centro) => (to.startsWith('/panel') ? irAlCentro(centro, to) : window.location.assign(to))

  const firstName = (admin?.name || '').trim().split(/\s+/)[0] || ''
  const availPct = fleet > 0 ? Math.round((active / fleet) * 100) : null

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
          {conSalidas ? (
            <><b className="font-semibold text-dark-50"><Count v={hoy.salidas.revisadas} /> {t('ops.of')} {hoy.salidas.total}</b>{' '}
              {t('hoy.brief.salidas')}
              {sinRevisar > 0 && (
                <> · <b className="font-semibold text-amber-300"><Count v={sinRevisar} /></b> {t(sinRevisar === 1 ? 'hoy.sinrevisar.1' : 'hoy.sinrevisar')}</>
              )}.
            </>
          ) : pctRev != null && fleet > 0 ? (
            <><b className="font-semibold text-dark-50"><Count v={hoy.revision.hechas} /> {t('ops.of')} {hoy.revision.flota}</b>{' '}
              {t('hoy.brief.rev')}
              {sinRevisar > 0 && (
                <> · <b className="font-semibold text-amber-300"><Count v={sinRevisar} /></b> {t(sinRevisar === 1 ? 'hoy.sinrevisar.1' : 'hoy.sinrevisar')}</>
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

      {/* Las casillas: cada una lleva a su pantalla, con su número y un globito si hay algo que hacer. */}
      <div className="rise mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" style={{ animationDelay: '20ms' }}>
        {casillas.map((c) => <Casilla key={c.to} {...c} onClick={() => irA(c.to, c.centro)} />)}
      </div>

      {todos && (
        <ComoVaCadaCentro centers={centers} datos={centrosHoy?.centros} porCentro={porCentro}
          hoyIso={centrosHoy?.dia || hoy?.dia || todayKey} puede={puede} ir={irAlCentro} t={t} />
      )}

      {fleet === 0 ? null : (
      <div>
      {/* ── 1 · EL DÍA DE HOY ───────────────────────────────────────────────
          Lo primero, porque es lo único que se mueve mientras miras la
          pantalla: cuánta flota tiene su revisión, quién sale, y lo que ha
          pasado hoy (golpes nuevos, incidencias, checklist de turno). */}
      {hoy && (hoy.revision.flota > 0 || conSalidas) && (
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
                  <Count v={pctGrande} />
                </span>
                <span className="text-lg font-medium text-dark-500">%</span>
              </div>
              {conSalidas ? (
                <>
                  <p className="mt-1 text-[13px] text-dark-400" data-testid="hoy-salidas-revisadas">
                    {t('hoy.salidas.rev.sub').replace('{n}', hoy.salidas.revisadas).replace('{t}', hoy.salidas.total)}
                  </p>
                  {hoy.revision.flota > 0 && (
                    <p className="mt-0.5 text-[11.5px] text-dark-500">
                      {t('hoy.revisados.sub').replace('{n}', hoy.revision.hechas).replace('{t}', hoy.revision.flota)}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-[13px] text-dark-500">
                  {t('hoy.revisados.sub').replace('{n}', hoy.revision.hechas).replace('{t}', hoy.revision.flota)}
                </p>
              )}
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
              style={{ width: `${pctGrande}%` }} />
          </div>

          {/* El checklist de cada turno, solo si ese turno existe hoy. */}
          {hoy.checklist.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {hoy.checklist.map((c) => (
                <button key={c.turno} onClick={() => irAlCentro(centroChecklist(c.turno), '/panel/checklist-operativo')}
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
            <button onClick={() => irAlCentro(centroAsignacion, '/panel/asignacion')}
              className="text-[12px] text-dark-500 transition-colors hover:text-dark-300">
              {t('dash.see.all')} →
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hoy.salidas.lista.slice(0, 12).map((x) => {
              const suCentro = todos ? casarCentro(x.center, centers) : null
              return (
                <SalidaCard key={x.vehicle_id} s={x} t={t} centro={suCentro}
                  onIr={() => irAlCentro(suCentro, '/panel/asignacion')} />
              )
            })}
          </div>
          {hoy.salidas.total > 12 && (
            <p className="mt-2.5 text-[11.5px] text-dark-500">
              {t('hoy.muro.mas').replace('{n}', hoy.salidas.total - 12)}
            </p>
          )}
        </section>
      )}

      {/* Lo de más detalle (gráficos, resumen y vencimientos), plegado: el inicio son las casillas y lo de hoy. */}
      <details className="group border-t border-white/[0.05] py-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-dark-100">
          <ChevronDown size={16} className="text-dark-500 transition-transform group-open:rotate-180" /> {t('ops.fleet.graphs')}
        </summary>
      {/* ── 2-bis · LA FLOTA, EN IMÁGENES ────────────────────────────────────
          Tres piezas y las tres con datos REALES. En el mockup de referencia
          había tarjetas con "↑5%" y curvas de tendencia: eso aquí no se puede
          calcular para casi ningún dato (no hay serie histórica de daños por
          semana), y una flecha verde inventada en una pantalla que se enseña a
          un cliente es lo peor que podríamos poner. Va lo que hay. */}
      <section className="rise py-5" style={{ animationDelay: '140ms' }}>
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
      </details>
      </div>
      )}
    </div>
  )
}
