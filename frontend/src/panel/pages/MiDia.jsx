import { useEffect, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { verMatricula } from '../../lib/matricula'
import { Camera, AlertTriangle, ClipboardCheck, BellRing, CheckCircle2, ChevronRight, Users } from 'lucide-react'
import { getDailyAssignment, getInspections, getIncidents, getItvAlerts, getFaltasRefuerzo } from '../api'
import { canSee } from '../auth'
import { PageSkeleton } from '../components/Skeleton'
import ElegirNave from '../components/ElegirNave'
import { hoyLocal, horaLocal, isoLocal, fechaEs } from '../../lib/fecha'

/* ── Torre de control "Mi día" ────────────────────────────────────────────────
   La pantalla de las 8:00 del jefe de turno: todo lo urgente de HOY en un solo
   sitio, ordenado por prioridad. Compone endpoints existentes (cero backend). */
export default function MiDia() {
  const { center, centers } = useOutletContext()
  const { t } = useT()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const today = hoyLocal()
  /* Con "Todos" arriba, la pantalla se quedaba en blanco pidiendo elegir un
     centro: el jefe de turno entraba a las 8:00 y se encontraba un aviso en
     vez de su día. El cuadrante es por centro, así que se enseña el primero
     (el principal) y se dice cuál es; cambiarlo sigue estando arriba. */
  const defaulted = center === 'Todos'
  const centro = defaulted ? (centers?.[0] || '') : center
  const noCenter = !centro
  /* LOS PRÓXIMOS DÍAS POR DEBAJO DE LA MÁXIMA (11-11-2026, revisión de la flota propia, historia-5). Es lo que más
     preocupa al jefe de nave a primera hora y ya lo calcula el servidor para Turnos → Refuerzos; aquí solo se avisa
     (hoy, mañana y pasado) y se lleva allí: pedir refuerzo avisa a conductores y se hace allí, con su explicación.
     Solo para quien puede ver Turnos. Un 400/403 o un servidor que no lo conozca: la pantalla sigue como antes. */
  const verFaltas = canSee('turnos')

  useEffect(() => {
    if (noCenter) return
    setData(null); setErr('')
    Promise.all([
      getDailyAssignment(centro, today).catch(() => ({ data: null })),
      getInspections({ center: centro, date_from: today, date_to: today, limit: 500 }).catch(() => ({ data: [] })),
      // Por centro y solo abiertas: antes pedía todas las incidencias de todos
      // los centros y las contaba como "abiertas" (56 con 40 abiertas).
      getIncidents({ status: 'open', center: centro }).catch(() => ({ data: [] })),
      getItvAlerts(centro).catch(() => ({ data: [] })),
      verFaltas ? getFaltasRefuerzo(centro, 3).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
    ]).then(([da, insp, inc, itv, fal]) => {
      const doc = Array.isArray(da.data) ? da.data[0] : da.data
      // Hasta pasado mañana, mirado también aquí: si un servidor diera más días, la tarjeta no crece.
      const pasado = new Date(); pasado.setDate(pasado.getDate() + 2)
      const hasta = isoLocal(pasado)
      setData({
        slots: Array.isArray(doc?.slots) ? doc.slots : [],
        insps: Array.isArray(insp.data) ? insp.data : [],
        incidents: Array.isArray(inc.data) ? inc.data : [],
        itv: Array.isArray(itv.data) ? itv.data : [],
        faltas: fal.data?.con_maximas && Array.isArray(fal.data?.faltas)
          ? fal.data.faltas.filter((f) => f && Number(f.falta) > 0 && String(f.date || '') <= hasta)
          : [],
      })
    }).catch(() => setErr(t('dash.error')))
  }, [centro]) // eslint-disable-line

  if (noCenter) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="rise mb-5 font-display text-[clamp(28px,3.4vw,42px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">{t('midia.title')}</h1>
        <ElegirNave texto={t('midia.pick.center')} />
      </div>
    )
  }
  if (err) return <p className="text-red-400">{err}</p>
  if (!data) return <PageSkeleton kpis={3} rows={6} />

  // Cruce: conductores con furgo asignada hoy que aún NO han subido inspección
  const doneDrivers = new Set(data.insps.map((i) => i.driver_id).filter(Boolean))
  const pending = data.slots.filter((s) => s.driver_id && s.vehicle_id && !doneDrivers.has(s.driver_id))
  const withDamage = data.insps.filter((i) => (i.analysis?.new_damages || []).length > 0)
  const unassigned = data.slots.filter((s) => s.vehicle_id && !s.driver_id)
  // Sin cuadrante de hoy no se sabe nada: ni quién falta por inspeccionar ni
  // si hay furgonetas sin conductor. Antes salía "Todas asignadas ✓" sobre
  // cero filas, que es un tranquilizador falso (medido: OGA5 sin cuadrante
  // el 02-09-2026 y la pantalla en verde).
  const sinCuadrante = data.slots.length === 0
  // Vencidas y a ≤ 15 días van juntas porque las dos piden cita YA; el chip
  // dice cuál es cuál en vez de enseñar "-621d".
  const itvSoon = data.itv.filter((a) => a.days_left != null && a.days_left <= 15)
  // Con gente faltando en los próximos días no está «todo en orden» (historia-5).
  const allClear = !sinCuadrante && pending.length === 0 && withDamage.length === 0 && itvSoon.length === 0
    && data.faltas.length === 0

  const Section = ({ icon: Icon, tone, title, count, to, children }) => (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <Link to={to} className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold"><Icon size={15} /> {title}
          <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs">{count}</span>
        </span>
        <ChevronRight size={14} className="opacity-60" />
      </Link>
      {children}
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="rise">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-brand-400/80">{centro}
          {/* Con la tarjeta de los otros centros justo debajo, «cámbialo arriba» sobra y la contradice (11-11-2026). */}
          {defaulted && !(centers?.length > 1) && <span className="ml-2 normal-case tracking-normal text-dark-500">· {t('midia.default.center')}</span>}
        </p>
        <h1 className="mt-2 font-display text-[clamp(28px,3.4vw,42px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">{t('midia.title')}</h1>
        {/* Solo la primera letra en mayúscula: `capitalize` ponía «17 De Septiembre». */}
        <p className="mt-3 text-[13.5px] text-dark-500">{(() => { const f = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); return f.charAt(0).toUpperCase() + f.slice(1) })()}</p>
      </header>

      {/* Con «Todos» se enseña el primer centro; los demás, a un toque ahí mismo (11-11-2026, portal_inicio-9):
          antes había que subir al selector de arriba para ver DGA1. */}
      {/* Solo los OTROS centros: el que ya se está viendo no se ofrece (era un botón igual que los demás). */}
      {defaulted && centers?.length > 1 && (
        <ElegirNave texto={t('midia.default.pick').replace('{c}', centro)} centers={centers.filter((c) => c !== centro)} />
      )}

      {allClear && (
        <div className="card flex items-center gap-3 border-emerald-500/20 bg-emerald-500/5 p-5 text-emerald-300">
          <CheckCircle2 size={22} /> <span className="font-semibold">{t('midia.all.clear')}</span>
        </div>
      )}

      {sinCuadrante && (
        <Section icon={ClipboardCheck} count="—" to="/panel/asignacion"
          tone="border-amber-500/25 bg-amber-500/5 text-amber-200"
          title={t('midia.no.roster')}>
          <p className="text-xs opacity-80">{t('midia.no.roster.why')}</p>
        </Section>
      )}

      {/* Toda la tarjeta lleva a Turnos → Refuerzos de esta nave (el `?centro=` lo elige arriba). Sin botón «Pedir»:
          pedir avisa a los conductores, y un toque equivocado aquí no puede mandar nada (historia-5). */}
      {data.faltas.length > 0 && (
        <Link to={`/panel/turnos?vista=refuerzos&centro=${encodeURIComponent(centro)}`} data-testid="midia-faltan"
          className="block rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-amber-200">
          <span className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold"><Users size={15} /> {t('midia.short.title')}
              <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs">{data.faltas.length}</span>
            </span>
            <ChevronRight size={14} className="opacity-60" />
          </span>
          <span className="block space-y-1">
            {data.faltas.map((f) => (
              <span key={f.date} data-testid="midia-falta" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-black/20 px-3 py-1.5 text-sm">
                <span className="font-semibold first-letter:uppercase">{f.dia || fechaEs(f.date)}</span>
                <span className="text-xs opacity-80">
                  {t('midia.short.row').replace('{m}', f.maximo).replace('{r}', f.en_ruta)}
                  {f.bajan > 0 && <> {t('midia.short.others').replace('{n}', f.bajan)}</>}
                </span>
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
                  {t('midia.short.missing').replace('{n}', f.falta)}
                </span>
                <span className="text-xs opacity-80">
                  {f.refuerzo
                    ? t('midia.short.asked').replace('{a}', f.refuerzo.aprobados ?? 0).replace('{p}', f.refuerzo.plazas ?? 0)
                    : !f.pueden ? t('midia.short.nobody')
                      : f.pueden === 1 ? t('midia.short.can.one') : t('midia.short.can').replace('{n}', f.pueden)}
                </span>
              </span>
            ))}
          </span>
          {data.faltas.some((f) => !f.refuerzo && f.pueden > 0) && (
            <span className="mt-2 block text-xs opacity-80">{t('midia.short.go')}</span>
          )}
        </Link>
      )}

      {pending.length > 0 && (
        <Section icon={Camera} count={pending.length} to="/panel/asignacion"
          tone="border-amber-500/25 bg-amber-500/5 text-amber-200"
          title={t('midia.pending.insp')}>
          <div className="space-y-1">
            {pending.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-1.5 text-sm">
                <span className="font-medium">{s.driver_name || '—'}</span>
                <span className="font-mono text-xs text-amber-300/80">{s.vehicle_plate || s.vehicle_id}</span>
              </div>
            ))}
            {pending.length > 10 && <p className="px-1 text-xs opacity-70">+{pending.length - 10} más…</p>}
          </div>
        </Section>
      )}

      {withDamage.length > 0 && (
        <Section icon={AlertTriangle} count={withDamage.length} to="/panel/revision"
          tone="border-red-500/25 bg-red-500/5 text-red-200"
          title={t('midia.new.damage')}>
          <div className="space-y-1">
            {withDamage.slice(0, 6).map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-1.5 text-sm">
                <span>{(i.analysis?.new_damages || []).map((d) => d.part).filter(Boolean).slice(0, 2).join(', ') || t('midia.damage')}</span>
                <span className="text-xs opacity-70">{horaLocal(i.created_at)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {itvSoon.length > 0 && (
        <Section icon={BellRing} count={itvSoon.length} to="/panel/avisos-itv"
          tone="border-orange-500/25 bg-orange-500/5 text-orange-200"
          title={t('midia.itv.soon')}>
          <div className="flex flex-wrap gap-2">
            {itvSoon.slice(0, 8).map((a, i) => (
              <span key={i} className={`rounded-full px-2.5 py-1 text-xs font-mono ${a.days_left < 0 ? 'bg-red-500/20 text-red-200' : 'bg-black/25'}`}>
                {verMatricula(a.license_plate || a.vehicle_plate)} · {a.days_left < 0
                  ? t('midia.itv.expired.chip').replace('{n}', -a.days_left)
                  : a.days_left === 0 ? 'vence hoy' : a.days_left === 1 ? 'vence mañana' : `en ${a.days_left} días`}
              </span>
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Section icon={ClipboardCheck} count={sinCuadrante ? '—' : unassigned.length} to="/panel/asignacion"
          tone="border-dark-700 bg-dark-900 text-dark-200" title={t('midia.unassigned')}>
          <p className="text-xs text-dark-500">{sinCuadrante ? t('midia.no.roster') : unassigned.length === 0 ? t('midia.all.assigned') : t('midia.go.assign')}</p>
        </Section>
        <Section icon={AlertTriangle} count={data.incidents.length} to="/panel/incidencias"
          tone="border-dark-700 bg-dark-900 text-dark-200" title={t('midia.open.inc')}>
          <p className="text-xs text-dark-500">{data.incidents.length === 0 ? t('midia.no.inc') : t('midia.review.inc')}</p>
        </Section>
      </div>
    </div>
  )
}
