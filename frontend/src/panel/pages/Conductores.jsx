import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useT } from '../../i18n'
import { lista } from '../../lib/lista'
import { verTelefono } from '../../lib/telefono'
import ImportarConductores from '../components/ImportarConductores'
import ImportarMoviles from '../components/ImportarMoviles'
import { useEscape } from '../../lib/useEscape'
import { usePlan } from '../../lib/usePlan'
import {
  Loader2, Search, Plus, X, Pencil, UserCheck, FileSpreadsheet, Phone, Mail, IdCard, Car,
  MapPin, FileText, Building2, Save, Camera, Trophy, TrendingUp, TrendingDown, Minus, Flame,
  BarChart2, ChevronDown, ChevronUp, AlertCircle, Lock, LockOpen, Eye, EyeOff, ShieldCheck,
  Share2, Smartphone, ArrowRightLeft, KeyRound, MoreHorizontal, UserMinus, RotateCcw,
} from 'lucide-react'
import {
  getDrivers, createDriver, updateDriver, deleteDriver, uploadDriverPhoto, programarTraslado, cancelarTraslado,
  getDriversBajas, reactivarConductor, getDriversApp,
  getDriversScoring, getScoringLeaderboard, getDriverAccounts, setDriverPassword,
  getDriverRecoveryEmail, setDriverRecoveryEmail, removeDriverRecoveryEmail,
  generarAccesosConductores, previaAccesosConductores, getContrasenaInicial, setContrasenaInicial,
  deleteDriverAccount,
  getDriversDuplicados, fusionarConductores, separarConductores, repasarFusiones,
} from '../api'
import { MARCA } from '../../marca'
import { DIAS_AVISO_CARNET, diasHastaCarnet, fechaCarnet, textoDiasCarnet } from '../../lib/carnet'

const EMPTY = {
  name: '', dni: '', phone: '', movil_personal: '', email: '', driver_id: '', transporter_id: '',
  license_number: '', license_expiry: '', contrato: '', nivel: '', center: '', alojamiento: '', notas: '',
}

// Sin centro, la ficha sale en la lista de TODOS los centros (así nadie la
// pierde de vista) y marcada, para que se le ponga el suyo.
const sinCentro = (d) => !String(d?.center || '').trim()

/* LO QUE LE FALTA A UNA FICHA (11-11-2026, tanda 2, E2 / equipo-7). Para encontrar a quien no tiene centro, correo,
   ID de reparto o acceso había que abrir las fichas una a una. Cada falta es un filtro de un toque encima de la
   lista y, en el móvil, una etiqueta en la tarjeta. El ID de reparto solo cuenta si la empresa usa la DNR o las horas
   (la misma regla que enseña el campo en la ficha), y el acceso solo si se sabe quién tiene cuenta. */
const FALTAS = [
  { id: 'centro', clave: 'drv.f.sinCentro', falta: (d) => sinCentro(d) },
  { id: 'correo', clave: 'drv.f.sinCorreo', falta: (d) => !String(d?.email || '').trim() },
  { id: 'reparto', clave: 'drv.f.sinId', falta: (d) => !String(d?.transporter_id || '').trim(), soloReparto: true },
  { id: 'acceso', clave: 'drv.f.sinAcceso', falta: (d, cuentas) => !cuentas.includes(d.id), soloCuentas: true },
  // Quién no tiene la app de Android (11-11-2026, tanda 3, equipo-5): solo si el servidor ha dicho quién la tiene.
  // No es «sin acceso» (eso es la cuenta con contraseña): se puede tener cuenta y usar solo la web.
  { id: 'app', clave: 'drv.f.sinApp', falta: (d, _cuentas, app) => !app?.conductores?.[d.id], soloApp: true },
]
const faltasQueCuentan = ({ conIdReparto, cuentasOk, appOk = false }) =>
  FALTAS.filter((f) => (!f.soloReparto || conIdReparto) && (!f.soloCuentas || cuentasOk) && (!f.soloApp || appOk))

/* LA APP DE CADA UNO (11-11-2026, equipo-5): «2.4.6 · hoy», «2.4.3 · hace 9 días». Versión y día, sin la hora. */
const versionTupla = (v) => (String(v || '').match(/\d+/g) || []).slice(0, 4).map(Number)
function versionMenor(a, b) {
  const x = versionTupla(a)
  const y = versionTupla(b)
  if (!x.length || !y.length) return false
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0)
  }
  return false
}
function cuandoApp(iso) {
  const f = iso ? new Date(iso) : null
  if (!f || Number.isNaN(f.getTime())) return ''
  const hoy = new Date()
  const n = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - new Date(f.getFullYear(), f.getMonth(), f.getDate())) / 864e5)
  if (n <= 0) return 'hoy'
  if (n === 1) return 'ayer'
  return `hace ${n} días`
}
const diaApp = (iso) => {
  const f = iso ? new Date(iso) : null
  return !f || Number.isNaN(f.getTime()) ? ''
    : `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`
}

function initials(n) {
  return (n || '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
const PALETTE = [
  'from-violet-500 to-indigo-600', 'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-600',    'from-sky-400 to-blue-600',
]
function avatarGrad(name) {
  let h = 0; for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

const NIVEL = { pleno: ['Pleno','bg-emerald-500/15 text-emerald-300'], L1: ['L1','bg-sky-500/15 text-sky-300'], L2: ['L2','bg-amber-500/15 text-amber-300'], L3: ['L3','bg-red-500/15 text-red-300'] }
const CONTRATO = { empresa: ['Empresa','bg-brand-500/15 text-brand-300'], ett: ['ETT','bg-purple-500/15 text-purple-300'] }

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ driver, size = 10 }) {
  const sz = `h-${size} w-${size}`
  const txt = size >= 16 ? 'text-2xl' : size >= 12 ? 'text-lg' : 'text-xs'
  return driver.photo_url
    ? <img src={driver.photo_url} alt="" className={`${sz} rounded-full object-cover`} />
    : <div className={`${sz} shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br ${avatarGrad(driver.name)} ${txt} font-bold text-white shadow-md`}>{initials(driver.name)}</div>
}

// ── Helpers scoring ───────────────────────────────────────────────────────────
const NOW = new Date()
const CUR_MONTH = NOW.getMonth() + 1
const CUR_YEAR  = NOW.getFullYear()
const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Score gauge SVG circular ──────────────────────────────────────────────────
function ScoreRing({ score, size = 80, stroke = 7 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = score == null ? 0 : Math.min(100, Math.max(0, score)) / 100
  const dash = circ * pct
  const color = score == null ? '#374151'
    : score >= 85 ? '#10b981'
    : score >= 65 ? '#3b82f6'
    : score >= 40 ? '#f59e0b'
    : '#ef4444'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1f2937" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .6s cubic-bezier(.4,0,.2,1)' }} />
    </svg>
  )
}

function ScoreDisplay({ score, size = 80 }) {
  const { t } = useT()
  const label = score == null ? '—'
    : score >= 85 ? t('drv.score.excellent')
    : score >= 65 ? t('drv.score.good')
    : score >= 40 ? t('drv.score.fair')
    : t('drv.score.improve')
  const color = score == null ? 'text-dark-500'
    : score >= 85 ? 'text-emerald-400'
    : score >= 65 ? 'text-blue-400'
    : score >= 40 ? 'text-amber-400'
    : 'text-red-400'
  const numSize = size >= 100 ? 'text-2xl' : 'text-lg'
  const lblSize = size >= 100 ? 'text-[10px]' : 'text-[9px]'
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <ScoreRing score={score} size={size} stroke={size >= 100 ? 9 : 7} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${numSize} font-black tabular-nums leading-none ${color}`}>{score ?? '—'}</span>
        <span className={`${lblSize} font-medium text-dark-500 leading-tight mt-0.5`}>{label}</span>
      </div>
    </div>
  )
}

function TrendIcon({ trend, size = 12 }) {
  if (!trend || trend === 'sin_datos') return null
  if (trend === 'mejorando')  return <TrendingUp size={size} className="text-emerald-400" />
  if (trend === 'empeorando') return <TrendingDown size={size} className="text-red-400" />
  return <Minus size={size} className="text-dark-500" />
}

function PillarBars({ s }) {
  const bars = [
    { label: '📋', v: s.compliance,  max: 30, color: '#38bdf8' },
    { label: '⏰', v: s.punctuality, max: 15, color: '#a78bfa' },
    { label: '📸', v: s.evidence,    max: 15, color: '#22d3ee' },
    { label: '🔍', v: s.honesty,     max: 15, color: '#2dd4bf' },
    { label: '🛡️', v: s.conservation,max: 25, color: '#34d399' },
  ]
  return (
    <div className="flex gap-1 items-end h-10">
      {bars.map(b => {
        const pct = Math.round((b.v / b.max) * 100)
        return (
          <div key={b.label} className="flex flex-col items-center gap-0.5 flex-1">
            <div className="w-full rounded-sm overflow-hidden bg-dark-800" style={{ height: 28 }}>
              <div className="w-full rounded-sm transition-all duration-500"
                style={{ height: `${pct}%`, background: b.color, marginTop: `${100-pct}%` }} />
            </div>
            <span className="text-[8px] leading-none">{b.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function InspCount({ count }) {
  const { t } = useT()
  return <div className="text-[10px] text-dark-500 mt-0.5">{count} {t('drv.inspections')}</div>
}

// ── Podio top-3 ───────────────────────────────────────────────────────────────
function PodiumCard({ d, position, size = 90 }) {
  const HEIGHT = { 1: 'pt-0', 2: 'pt-8', 3: 'pt-16' }
  const GLOW   = { 1: 'shadow-amber-500/20', 2: 'shadow-slate-400/10', 3: 'shadow-orange-700/10' }
  const BORDER = { 1: 'border-amber-400/40', 2: 'border-slate-400/30', 3: 'border-orange-700/30' }
  const MEDAL  = { 1: '🥇', 2: '🥈', 3: '🥉' }
  const STREAK_COLOR = !d.clean_streak || d.clean_streak < 3 ? 'text-dark-500'
    : d.clean_streak >= 10 ? 'text-amber-400' : 'text-orange-400'
  return (
    <div className={`flex flex-col items-center ${HEIGHT[position]}`}>
      <div className={`w-full rounded-2xl border ${BORDER[position]} bg-dark-900 p-4 shadow-xl ${GLOW[position]} flex flex-col items-center gap-2`}>
        <span className="text-3xl">{MEDAL[position]}</span>
        {/* Avatar initials */}
        <div className={`h-12 w-12 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br ${avatarGrad(d.name)} text-sm font-bold text-white shadow-md`}>
          {(d.name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <ScoreDisplay score={d.total} size={size} />
        <div className="text-center">
          <div className="font-bold text-sm text-white leading-tight truncate max-w-[120px]">{d.name}</div>
          <InspCount count={d.inspections_count} />
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <TrendIcon trend={d.trend} size={11} />
          {d.clean_streak >= 3 && (
            <span className={`flex items-center gap-0.5 font-bold ${STREAK_COLOR}`}>
              <Flame size={10} />{d.clean_streak}
            </span>
          )}
        </div>
        {d.compliance != null && <PillarBars s={d} />}
      </div>
    </div>
  )
}

// ── Lista completa ────────────────────────────────────────────────────────────
function DriverRow({ s, rank, showCenter, expanded, onToggle }) {
  const { t } = useT()
  const rankColor = rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-orange-600' : 'text-dark-500'
  const barColor  = (s.total ?? 0) >= 85 ? 'bg-emerald-500' : (s.total ?? 0) >= 65 ? 'bg-brand-500' : (s.total ?? 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <>
      <tr className="border-b border-dark-800/50 hover:bg-dark-800/30 cursor-pointer transition-colors" onClick={onToggle}>
        <td className={`py-3 pl-4 w-8 font-bold text-sm tabular-nums ${rankColor}`}>{rank}</td>
        <td className="py-3 pl-2 pr-4">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-dark-100 text-sm truncate max-w-[160px]">{s.name}</span>
            {s.prize_eligible === false && (
              <span className="shrink-0 rounded-full bg-dark-800 px-1.5 py-0.5 text-[9px] font-semibold text-dark-300" title="No elegible para el premio del mes: pocos días asignados">
                no elegible
              </span>
            )}
          </div>
          {showCenter && <div className="text-[10px] text-dark-500">{s.center}</div>}
        </td>
        <td className="py-3 px-3">
          {/* Barra de puntuación + número */}
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-2 rounded-full bg-dark-800 overflow-hidden">
              <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${s.total ?? 0}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums text-dark-200 w-7 text-right">{s.total ?? '—'}</span>
          </div>
        </td>
        <td className="py-3 px-2 text-center">
          <TrendIcon trend={s.trend} size={13} />
        </td>
        <td className="py-3 px-2 text-center">
          {s.clean_streak >= 3 && (
            <span className={`flex items-center justify-center gap-0.5 text-xs font-bold ${s.clean_streak >= 10 ? 'text-amber-400' : s.clean_streak >= 5 ? 'text-orange-400' : 'text-dark-500'}`}>
              <Flame size={11} />{s.clean_streak}
            </span>
          )}
        </td>
        <td className="py-3 pr-3 text-dark-500 text-right">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-dark-800/50">
          <td colSpan={6} className="px-4 pb-4 pt-2 bg-dark-900/40">
            {/* Barras de pilares */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {[
                { l: '📋 Cumpl.', v: s.compliance,  max: 30, c: 'bg-sky-500' },
                { l: '⏰ Puntual.', v: s.punctuality,max: 15, c: 'bg-violet-500' },
                { l: '📸 Evidencia', v: s.evidence, max: 15, c: 'bg-cyan-500' },
                { l: '🔍 Honest.', v: s.honesty,    max: 15, c: 'bg-teal-500' },
                { l: '🛡️ Conserv.', v: s.conservation,max: 25, c: 'bg-emerald-500' },
              ].map(b => (
                <div key={b.l}>
                  <div className="flex justify-between text-[9px] text-dark-500 mb-0.5">
                    <span>{b.l}</span><span className="tabular-nums">{b.v}/{b.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-dark-800 overflow-hidden">
                    <div className={`h-full rounded-full ${b.c}`} style={{ width: `${(b.v/b.max)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-[11px] text-dark-500">
              <span>{s.inspections_count} {t('drv.insp.month')}</span>
              {s.days_assigned > 0 && <span>{s.days_assigned} {t('drv.days.assigned')}</span>}
              {s.damage_rate != null && <span>{t('drv.damage.rate')} <b className="text-dark-300">{s.damage_rate.toFixed(2)}</b>{t('drv.per.insp')}</span>}
              {s.clean_streak > 0 && <span className="text-orange-400 font-semibold flex items-center gap-0.5"><Flame size={10} />{s.clean_streak} {t('drv.clean.streak')}</span>}
            </div>
            {s.delta_events?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.delta_events.map((e, j) => (
                  <span key={j} className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    e.to_sev === 'critico' ? 'bg-red-500/15 text-red-300' :
                    e.to_sev === 'grave' ? 'bg-orange-500/15 text-orange-300' :
                    'bg-amber-500/15 text-amber-300'}`}>
                    {e.to_sev} · {e.part}
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

/* ── FICHAS DUPLICADAS ─────────────────────────────────────────────────────
   Una importación con el nombre escrito distinto (un espacio de más, en
   minúsculas) da de alta a la misma persona dos veces. No es cosmético: el
   cuadrante apunta a una ficha y el acceso al portal resuelve por correo y cae
   en la otra, y el conductor ve «no tienes vehículo asignado» teniéndolo. */
function SaludFichas({ onCambio }) {
  const [dups, setDups] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [err, setErr] = useState('')
  const [hecho, setHecho] = useState('')
  const [elegida, setElegida] = useState({})   // email -> id que se conserva

  const cargar = () => {
    getDriversDuplicados().then((r) => setDups(r.data)).catch(() => setErr('No se pudieron cargar las fichas duplicadas.'))
  }
  useEffect(cargar, [])

  /* REPASAR LO YA FUSIONADO. Hace falta aunque fusionar este bien: una
     inspeccion creada DESPUES de la fusion —alguien que entro con la ficha
     vieja antes de que se le cerrara— vuelve a quedarse colgando de ella. Y
     hasta hoy la fusion no repuntaba ni los kilometros ni los apoyos: quedaban
     55 apuntes y 14 inspecciones sueltas. Es idempotente: si no hay nada que
     mover, no mueve. */
  const repasar = async () => {
    setOcupado('repaso'); setErr(''); setHecho('')
    try {
      const { data } = await repasarFusiones()
      const n = Object.values(data.movidos || {}).reduce((a, b) => a + b, 0)
      setHecho(n
        ? `Repuntados ${n} documentos que colgaban de fichas ya fusionadas.`
        : 'Nada que repuntar: no queda nada colgando de una ficha fusionada.')
      cargar(); onCambio?.()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudo repasar.')
    } finally { setOcupado('') }
  }

  const fusionar = async (grupo) => {
    const conservar = elegida[grupo.email] || grupo.sugerida
    const absorber = grupo.fichas.filter((f) => f.id !== conservar).map((f) => f.id)
    setOcupado(grupo.email); setErr('')
    try {
      await fusionarConductores({ conservar, absorber })
      cargar(); onCambio?.()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudo fusionar.')
    } finally { setOcupado('') }
  }

  /* «NO ES LA MISMA PERSONA» (11-11-2026). Una ficha de baja y una activa con el mismo correo pueden ser la misma
     persona dada de alta dos veces… o alguien que se fue y otra persona a la que se dio de alta con su buzón. Para el
     servidor son siempre la misma, y quien se fue seguía entrando como la nueva. Solo la oficina lo sabe: con esto, la
     de baja deja de entrar con ese correo. Solo junto a las de baja de un grupo con UNA activa (un servidor sin
     `activa` no enseña el botón). */
  const separar = async (grupo, f) => {
    const activas = grupo.fichas.filter((x) => x.activa === true)
    if (activas.length !== 1) return
    const queda = activas[0]
    if (!window.confirm(`¿${f.nombre} es OTRA persona que ${queda.nombre}?

Su ficha (dada de baja) dejará de entrar con el correo ${grupo.email}: el correo se queda solo en la de ${queda.nombre}.
Aceptar: separarlas. Cancelar: no hacer nada.`)) return
    setOcupado(`sep:${f.id}`); setErr(''); setHecho('')
    try {
      await separarConductores({ queda: queda.id, ceden: [f.id] })
      setHecho(`${f.nombre} ya no entra con ${grupo.email}.`)
      cargar(); onCambio?.()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudieron separar.')
    } finally { setOcupado('') }
  }

  if (!dups) return <div className="flex items-center gap-2 text-dark-400"><Loader2 className="animate-spin" size={18} /> …</div>

  return (
    <div className="space-y-6">
      {err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}
      {hecho && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{hecho}</p>}

      {/* ── Duplicadas ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-[15px] font-bold text-dark-100">
          Fichas duplicadas
          {dups.total > 0 && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11.5px] font-bold text-amber-300">{dups.fichas_de_mas} de más</span>}
        </h2>
        <p className="mb-3 max-w-[70ch] text-[13px] text-dark-400">
          Se emparejan por <b className="text-dark-200">correo</b>, nunca por nombre: dos
          tocayos distintos acabarían mezclados y uno auditando la furgoneta del otro.
          Se conserva la ficha con más historial y la otra se marca fusionada — no se
          borra, así que se puede deshacer.
        </p>
        <button onClick={repasar} disabled={ocupado === 'repaso'}
          className="mb-3 rounded-lg border border-dark-700 px-3 py-1.5 text-[12.5px] text-dark-300 hover:border-dark-500 disabled:opacity-50">
          {ocupado === 'repaso' ? 'Repasando…' : 'Repasar las ya fusionadas'}
        </button>
        {dups.total === 0 ? (
          <div className="card p-6 text-center text-[13.5px] text-dark-400">Ninguna. Todas las fichas son de personas distintas.</div>
        ) : (
          <div className="space-y-2">
            {dups.grupos.map((g) => {
              const conservar = elegida[g.email] || g.sugerida
              return (
                <div key={g.email} className="card p-3">
                  <p className="mb-2 font-mono text-[12px] text-dark-500">{g.email}</p>
                  <div className="space-y-1">
                    {g.fichas.map((f) => (
                      <label key={f.id}
                        className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                          f.id === conservar ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-dark-800 hover:border-dark-700'}`}>
                        <input type="radio" name={`c-${g.email}`} checked={f.id === conservar}
                          onChange={() => setElegida((e) => ({ ...e, [g.email]: f.id }))}
                          className="accent-emerald-500" />
                        <span className="font-semibold text-dark-100">{f.nombre}</span>
                        <span className="text-dark-500">
                          {f.inspecciones} insp · {f.asignaciones} asign · {f.turnos} turnos · {f.peticiones} pet.
                        </span>
                        {f.id === conservar && <span className="ml-auto text-[12px] font-semibold text-emerald-400">se conserva</span>}
                        {f.activa === false && g.fichas.filter((x) => x.activa === true).length === 1 && (
                          <button type="button" data-testid="separar-ficha"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); separar(g, f) }}
                            disabled={!!ocupado}
                            className={`${f.id === conservar ? '' : 'ml-auto '}rounded-lg border border-dark-700 px-2.5 py-1 text-[12px] text-dark-300 hover:border-dark-500 disabled:opacity-50`}>
                            {ocupado === `sep:${f.id}` ? 'Separando…' : 'No es la misma persona'}
                          </button>
                        )}
                      </label>
                    ))}
                  </div>
                  <button onClick={() => fusionar(g)} disabled={ocupado === g.email}
                    className="mt-2 rounded-lg bg-brand-500/20 px-3 py-1.5 text-[13px] font-semibold text-brand-200 hover:bg-brand-500/30 disabled:opacity-50">
                    {ocupado === g.email ? 'Fusionando…' : `Fusionar ${g.fichas.length} fichas en una`}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Vista scoring unificada (ranking + lista) ─────────────────────────────────
function ScoringView({ center }) {
  const { t } = useT()
  const [data, setData]   = useState(null)
  const [lb, setLb]       = useState(null)
  const [month, setMonth] = useState(CUR_MONTH)
  const [year, setYear]   = useState(CUR_YEAR)
  const [expanded, setExpanded] = useState(null)
  const [centerTab, setCenterTab] = useState(null)   // null = primer centro disponible

  useEffect(() => {
    setData(null); setLb(null)
    Promise.all([
      getDriversScoring(month, year),
      getScoringLeaderboard(month, year),
    ]).then(([rd, rl]) => {
      setData(rd.data)
      setLb(rl.data)
    }).catch(() => { setData({ scores: [] }); setLb({ leaderboard: {}, center_stats: {} }) })
  }, [month, year])

  // Centros disponibles
  const availableCenters = useMemo(() => {
    const s = new Set()
    if (center !== 'Todos') return [center]
    ;(data?.scores || []).forEach(d => d.center && s.add(d.center))
    return [...s].sort()
  }, [data, center])

  const activeCtr = centerTab ?? availableCenters[0] ?? null

  useEffect(() => { setCenterTab(null) }, [center])

  const scores = useMemo(() => {
    const all = data?.scores || []
    const filtered = activeCtr ? all.filter(s => s.center === activeCtr) : all
    return filtered
  }, [data, activeCtr])

  // Los que optan al premio van PRIMERO en la clasificación: con la misma
  // nota, alguien con tres días salía #2 por delante de quien trabajó el mes
  // entero. Dentro de cada grupo se respeta el orden del servidor.
  const conDatos = scores.filter(s => !s.insufficient)
  const ranked   = [...conDatos.filter(s => s.prize_eligible !== false),
                    ...conDatos.filter(s => s.prize_eligible === false)]
  const unranked = scores.filter(s => s.insufficient)
  // El PODIO solo admite elegibles para el premio (≥35% de días asignados):
  // nadie gana el mes con 3 días buenos. La lista completa muestra a todos.
  const top3     = ranked.filter(s => s.prize_eligible !== false).slice(0, 3)

  const stats = lb?.center_stats?.[activeCtr] || {}

  const monthPicker = (
    <select className="select text-xs py-1 px-2" value={`${year}-${month}`}
      onChange={e => { const [y,m] = e.target.value.split('-'); setYear(+y); setMonth(+m) }}>
      {Array.from({ length: 6 }, (_, i) => {
        const d = new Date(CUR_YEAR, CUR_MONTH - 1 - i, 1)
        const yy = d.getFullYear(); const mm = d.getMonth() + 1
        return <option key={i} value={`${yy}-${mm}`}>{MONTHS_ES[d.getMonth()]} {yy}</option>
      })}
    </select>
  )

  // Tarjeta PNG del podio para compartir en el grupo de WhatsApp del equipo.
  // Marketing orgánico: la marca se pasea por los grupos cada lunes.
  async function sharePodium() {
    if (top3.length === 0) return
    const c = document.createElement('canvas')
    c.width = 1000; c.height = 1000
    const x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, 0, 1000)
    g.addColorStop(0, '#0b0d10'); g.addColorStop(1, '#171b22')
    x.fillStyle = g; x.fillRect(0, 0, 1000, 1000)
    x.textAlign = 'center'
    x.font = '900 58px Arial'; x.fillStyle = '#fb923c'
    x.fillText('🏆 RANKING DEL MES', 500, 120)
    x.font = '600 32px Arial'; x.fillStyle = '#8b94a3'
    x.fillText(`${MONTHS_ES[month - 1]} ${year}${activeCtr ? ' · ' + activeCtr : ''}`, 500, 175)
    const medals = ['🥇', '🥈', '🥉']
    top3.forEach((d, i) => {
      const y = 330 + i * 190
      x.fillStyle = i === 0 ? 'rgba(251,146,60,.10)' : 'rgba(255,255,255,.04)'
      x.fillRect(80, y - 95, 840, 155)
      x.textAlign = 'left'
      x.font = '700 64px Arial'; x.fillText(medals[i], 110, y)
      x.fillStyle = '#eef1f6'; x.font = '800 46px Arial'
      x.fillText((d.name || '—').slice(0, 18), 215, y - 12)
      x.fillStyle = '#8b94a3'; x.font = '600 27px Arial'
      x.fillText(`${d.inspections_count} inspecciones · 🔥 racha ${d.clean_streak || 0}`, 215, y + 32)
      x.textAlign = 'right'; x.fillStyle = '#fb923c'; x.font = '900 72px Arial'
      x.fillText(String(d.total), 895, y + 8)
      x.textAlign = 'left'
    })
    x.textAlign = 'center'; x.fillStyle = '#64748b'; x.font = '600 27px Arial'
    x.fillText(`${MARCA.nombre} · ${MARCA.lema}`, 500, 940)

    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    const file = new File([blob], `ranking-${MARCA.nombre.toLowerCase()}.png`, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ranking del mes — ${MARCA.nombre}` })
        return
      }
    } catch { /* usuario canceló el share: no descargar encima */ return }
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u; a.download = `ranking-${MARCA.nombre.toLowerCase()}.png`; a.click()
    setTimeout(() => URL.revokeObjectURL(u), 5000)
  }

  if (!data) return (
    <div className="flex items-center gap-2 py-16 text-dark-400 justify-center">
      <Loader2 size={18} className="animate-spin" /> {t('drv.ranking.loading')}
    </div>
  )

  return (
    <div>
      {/* Header con mes y tabs de centro */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          <span className="font-bold text-base">{t('drv.ranking.title')}</span>
          {stats.avg_score != null && (
            <span className="text-xs text-dark-500 ml-2">{t('drv.ranking.avg')} <span className="text-dark-300 font-semibold">{stats.avg_score}</span></span>
          )}
          {data?.prize_min_days != null && (
            <span className="ml-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400"
              title="Para optar al premio: al menos el 35% de los días del mes con asignación en el cuadrante. Los daños marcados como falso positivo en Revisión Rápida no penalizan.">
              🏆 Premio: mín. {data.prize_min_days} días asignados
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={sharePodium} disabled={top3.length === 0}
            className="btn-secondary flex items-center gap-1.5 px-2.5 py-1 text-xs disabled:opacity-40"
            title="Genera una imagen del podio para compartir en WhatsApp">
            <Share2 size={13} /> Compartir
          </button>
          {monthPicker}
        </div>
      </div>

      {/* Tabs por centro (si hay varios) */}
      {availableCenters.length > 1 && (
        <div className="flex gap-0 border-b border-dark-800 mb-6 overflow-x-auto">
          {availableCenters.map(c => (
            <button key={c} onClick={() => { setCenterTab(c); setExpanded(null) }}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeCtr === c ? 'border-brand-400 text-brand-300' : 'border-transparent text-dark-500 hover:text-dark-300'
              }`}>{c}</button>
          ))}
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="py-16 text-center text-dark-500">
          <Trophy size={40} className="mx-auto mb-3 text-dark-700" />
          <p className="font-medium">{t('drv.ranking.no.data')} — {MONTHS_ES[month-1]} {year}</p>
          <p className="text-xs text-dark-500 mt-1">{t('drv.ranking.min.insp')}</p>
        </div>
      ) : (
        <>
          {/* ── PODIO TOP 3 ── */}
          {top3.length > 0 && (
            <div className="mb-8">
              <div className="grid gap-3"
                style={{ gridTemplateColumns: top3.length === 3 ? '1fr 1fr 1fr' : top3.length === 2 ? '1fr 1fr' : '1fr' }}>
                {/* Reordenar: plata-oro-bronce para efecto podio real */}
                {(() => {
                  const ordered = top3.length === 3
                    ? [top3[1], top3[0], top3[2]]   // plata izquierda, oro centro, bronce derecha
                    : top3
                  return ordered.map(d => d && (
                    <PodiumCard key={d.driver_id} d={d} position={d.position} size={top3.length >= 2 ? 100 : 120} />
                  ))
                })()}
              </div>
            </div>
          )}

          {/* ── LISTA COMPLETA ── */}
          <div className="rounded-xl border border-dark-800 overflow-hidden">
            <div className="bg-dark-900/60 px-4 py-2.5 border-b border-dark-800 flex items-center gap-2">
              <BarChart2 size={13} className="text-dark-500" />
              <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">{t('drv.ranking.full')}</span>
              <span className="ml-auto text-xs text-dark-500">{ranked.length} clasificados</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 text-[10px] text-dark-500 uppercase tracking-wider">
                  <th className="py-2 pl-4 text-left w-8">#</th>
                  <th className="py-2 pl-2 text-left">{t('drv.col.driver')}</th>
                  <th className="py-2 px-3 text-left">{t('drv.col.score')}</th>
                  <th className="py-2 px-2 text-center">{t('drv.col.trend')}</th>
                  <th className="py-2 px-2 text-center">{t('drv.col.streak')}</th>
                  <th className="py-2 pr-3 w-6" />
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, i) => (
                  <DriverRow key={s.driver_id} s={s} rank={i+1} showCenter={center === 'Todos' && !activeCtr}
                    expanded={expanded === s.driver_id}
                    onToggle={() => setExpanded(expanded === s.driver_id ? null : s.driver_id)} />
                ))}
              </tbody>
            </table>
            {unranked.length > 0 && (
              <div className="border-t border-dark-800 px-4 py-2 text-[11px] text-dark-500 flex items-center gap-1.5">
                <AlertCircle size={11} /> {unranked.length} {t('drv.col.no.data')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
/* ── TABLA DE CONDUCTORES ───────────────────────────────────────────────────
   Era una rejilla de fichas de cuatro en cuatro. Con doscientas personas eso
   son cincuenta filas de tarjetas y, sobre todo, no hay forma de BUSCAR a
   alguien: el ojo tiene que barrer en zigzag en vez de bajar una columna.

   Ordena por columna, y los nombres con `localeCompare` en español porque
   están escritos en MAYÚSCULAS, minúsculas y Mixtas: un `sort()` normal manda
   todas las minúsculas detrás de todas las mayúsculas y la lista parece
   aleatoria (gotcha 23). */
/* QUIEN ENTRA AL PORTAL SIN CONTRASEÑA
   ═══════════════════════════════════════════════════════════════════════════
   Un conductor SIN cuenta entra solo con su correo: `driver-lookup` le da el
   token en el sitio. La contraseña es opcional y añade una barrera.

   Ojo con el texto, que estuvo mal media hora: decir «no pueden entrar» era
   FALSO —entran perfectamente— y en el panel de Dani habria acusado a sus 202
   conductores de estar bloqueados. Un aviso que miente gasta la confianza en
   todos los demas.

   La oficina establece una contraseña temporal común; cada conductor la
   cambia obligatoriamente en su primer acceso.

   SOLO LA NAVE ELEGIDA Y SOLO A QUIEN NO TIENE LA SUYA (10-11-2026, revisión de la flota propia, equipo-1): pisaba a
   todos los conductores de todas las naves, también a los ~25 de OGA5 que ya usan la app con su contraseña. Ahora se
   aplica a la nave de arriba («Todos» = todas) y, salvo que se marque la casilla, se respeta a quien ya se puso la
   suya. La confirmación dice a cuántos y de qué naves con lo que cuenta el servidor (la previa), no con la lista. */
function AvisoAccesos({ list, center, onHecho }) {
  const [dando, setDando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [claveTemporal, setClaveTemporal] = useState('')
  const [hecho, setHecho] = useState(null)
  const [error, setError] = useState('')
  const [incluirPropias, setIncluirPropias] = useState(false)
  /* LA PREVIA, CON LO QUE SE PIDIÓ (corrección del 10-11-2026, R7/R39/R41). Se guarda para qué centro y casilla se
     pidió: mientras no llega la de lo que hay en pantalla, se dice «Calculando…» y no se puede aplicar (antes enseñaba
     la cifra de antes y dejaba aplicar). Si falla, tampoco: un panel nuevo contra un servidor viejo, sin previa, le
     cambiaba la contraseña a todos. Que la previa responda bien es la prueba de que el servidor entiende el centro. */
  const [reintento, setReintento] = useState(0)
  const pedida = `${center || ''}|${incluirPropias}|${reintento}`
  const [respuesta, setRespuesta] = useState(null)   // { pedida, data } o { pedida, error: true }

  useEffect(() => {
    let vivo = true
    previaAccesosConductores(center, incluirPropias)
      .then(({ data }) => {
        if (!vivo) return
        setRespuesta(data && typeof data.actualizadas === 'number' ? { pedida, data } : { pedida, error: true })
      })
      .catch(() => { if (vivo) setRespuesta({ pedida, error: true }) })
    return () => { vivo = false }
  }, [center, incluirPropias, pedida])

  const vigente = respuesta && respuesta.pedida === pedida ? respuesta : null
  const previa = vigente?.data || null   // { actualizadas, naves, respetadas, sin_email, cuentas_inactivas, sin_centro_fuera }
  const previaFallo = !!vigente?.error

  const deCentro = center && center !== 'Todos' ? center : 'todos los centros'
  const naves = Object.entries(previa?.naves || {}).map(([n, k]) => `${n} (${k})`).join(', ')

  // Plegarlo es cosa de quien mira: se recuerda en este navegador y vuelve si
  // cambia el número (hay gente nueva sin contraseña).
  const [plegado, setPlegado] = useState(false)
  // El «sin correo» de los afectados (los de la nave, sin el buscador), que es lo que cuenta el servidor.
  const sinCorreo = previa?.sin_email || 0
  const conCorreo = list.filter((d) => (d.email || '').trim()).length

  const claveAviso = `aviso_accesos_${conCorreo}`
  useEffect(() => {
    try { setPlegado(localStorage.getItem('aviso_accesos') === claveAviso) } catch { /* sin almacén */ }
  }, [claveAviso])
  const plegar = () => {
    setPlegado(true)
    try { localStorage.setItem('aviso_accesos', claveAviso) } catch { /* sin almacén */ }
  }

  const dar = async () => {
    if (claveTemporal.length < 8) {
      setError('La contraseña temporal debe tener al menos 8 caracteres.')
      return
    }
    setDando(true); setError('')
    try {
      const r = await generarAccesosConductores(claveTemporal, center, incluirPropias)
      setClaveTemporal('')
      setHecho(r.data)
      onHecho()
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo. Reintenta.')
    }
    setDando(false)
  }

  if (hecho) {
    return (
      <div className="mb-4 rounded-xl border border-lime-500/30 bg-lime-500/5 p-4">
        <p className="text-sm font-semibold text-lime-300">
          {hecho.actualizadas} {hecho.actualizadas === 1 ? 'conductor ya tiene' : 'conductores ya tienen'} acceso temporal
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-amber-200">
          Entran con su correo de empresa y la contraseña temporal que acabas de establecer. El portal les obligará a crear una contraseña propia antes de continuar.
        </p>
        {/* A cuántos se les respetó la suya lo dice ya el `aviso` del servidor (11-11-2026, G7), que es lo que lee
            también la pantalla vieja: aquí no se repite. */}
        <p className="mt-1 text-[12.5px] leading-relaxed text-dark-400">{hecho.aviso}</p>
        {hecho.sin_email > 0 && (
          <p className="mt-1 text-[12.5px] text-amber-300">
            {hecho.sin_email} se han quedado fuera por no tener correo. Ponles uno en su ficha y vuelve a pulsar.
          </p>
        )}
        {hecho.cuentas_inactivas > 0 && (
          <p className="mt-1 text-[12.5px] text-amber-300">
            {hecho.cuentas_inactivas} cuenta(s) desactivada(s) no se han cambiado. La oficina debe revisarlas.
          </p>
        )}
      </div>
    )
  }

  if (!conCorreo) return null

  if (confirmar) {
    return (
      <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
        <p className="text-[13px] font-semibold text-amber-200">
          Antes de seguir: esto cambia cómo entran
        </p>
        {/* A CUÁNTOS Y DE QUÉ NAVES, contado por el servidor con la misma regla con la que lo aplica. */}
        <div data-testid="previa-temporal" className="mt-2 rounded-lg border border-amber-500/25 bg-dark-950/60 px-3 py-2 text-[12.5px] leading-relaxed">
          {previa ? (
            <>
              <p className="font-semibold text-amber-100">
                Se cambiará a {previa.actualizadas} {previa.actualizadas === 1 ? 'conductor' : 'conductores'}
                {naves ? `: ${naves}` : ''}.
              </p>
              {!incluirPropias && previa.respetadas > 0 && (
                <p className="text-dark-300">
                  A {previa.respetadas} que ya se {previa.respetadas === 1 ? 'ha puesto la suya se le respeta' : 'han puesto la suya se les respeta'}.
                </p>
              )}
              {incluirPropias && (
                <p className="text-amber-300">Incluye a quien ya se había puesto la suya: tendrá que volver a crearla.</p>
              )}
              {previa.sin_email > 0 && (
                <p className="text-dark-400">{previa.sin_email} sin correo se quedan fuera.</p>
              )}
              {previa.cuentas_inactivas > 0 && (
                <p className="text-dark-400">{previa.cuentas_inactivas} con el acceso desactivado no se tocan.</p>
              )}
              {/* Los «sin centro» salen en la lista de este centro, pero no son de él: no se tocan, y se dice (R40/R42).
                 Lo de «aplícala con «Todos»» solo si no se está ya en «Todos» y «Todos» de verdad los incluiría (un
                 usuario limitado a sus centros no puede); un servidor viejo no manda `con_todos_entran` (S7, 10-11-2026). */}
              {previa.sin_centro_fuera > 0 && (
                <p className="text-amber-300">
                  {previa.sin_centro_fuera} sin centro no se incluyen: ponles su centro en la ficha
                  {center && center !== 'Todos' && previa.con_todos_entran !== false ? ' o aplícala con «Todos»' : ''}.
                </p>
              )}
            </>
          ) : previaFallo ? (
            <p className="flex flex-wrap items-center gap-2 text-amber-300">
              No se ha podido calcular a quién afecta.
              {/* 44 px en el móvil (11-11-2026, segunda revisión de la tanda 2): sin previa no se puede aplicar, así que
                  es el botón que hay que pulsar. Igual desde `sm`. */}
              <button onClick={() => setReintento((n) => n + 1)}
                className="min-h-[44px] rounded-lg bg-dark-800 px-2.5 py-1 font-semibold text-dark-200 hover:bg-dark-700 sm:min-h-0">Reintentar</button>
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-dark-400">
              <Loader2 size={12} className="animate-spin" /> Calculando a quién afecta…
            </p>
          )}
        </div>
        {/* Lo que se toca, de 44 px en el móvil también aquí (11-11-2026, revisión de la tanda 2); igual desde `sm`. */}
        <label className="mt-2 flex min-h-[44px] items-center gap-2 text-[12.5px] text-dark-300 sm:min-h-0 sm:items-start">
          <input type="checkbox" checked={incluirPropias} onChange={(e) => setIncluirPropias(e.target.checked)}
            className="mt-0.5" />
          <span>Cambiársela también a quien ya se ha puesto la suya</span>
        </label>
        <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-dark-300">
          <li>· Se asignará la misma contraseña temporal a los conductores activos con correo de {deCentro}{incluirPropias ? '' : ' que todavía no se han puesto la suya'}.</li>
          <li>· Sus contraseñas actuales dejarán de funcionar. Las cuentas de acceso desactivadas no se tocarán.</li>
          <li>· Al entrar con su correo de empresa, cada conductor tendrá que cambiarla obligatoriamente. Después podrá añadir un correo personal de recuperación.</li>
          <li>· Cualquier persona que conozca la contraseña temporal podría entrar con el correo de un conductor hasta que este la cambie. Comunícala únicamente a los conductores.</li>
        </ul>
        <label className="mt-3 block text-[12px] font-medium text-dark-300" htmlFor="clave-temporal-conductores">
          Contraseña temporal común
        </label>
        <input id="clave-temporal-conductores" type="password" autoComplete="new-password"
          value={claveTemporal} onChange={(e) => setClaveTemporal(e.target.value)}
          placeholder="Escribe la contraseña temporal" minLength={8} maxLength={128}
          className="mt-1 min-h-[44px] w-full max-w-sm rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 text-sm text-dark-100 outline-none focus:border-amber-400 sm:min-h-0" />
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Sin la previa de lo que hay en pantalla (calculando o fallida), no se aplica: ver arriba. */}
          <button onClick={dar} disabled={dando || !previa || previa.actualizadas === 0}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-2 text-[12.5px] font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50 sm:min-h-0">
            {dando ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
            {dando ? 'Aplicando…' : previa ? `Aplicar contraseña temporal a ${previa.actualizadas}` : 'Aplicar contraseña temporal'}
          </button>
          <button onClick={() => setConfirmar(false)}
            className="min-h-[44px] px-3 py-2 text-[12.5px] text-dark-400 hover:text-dark-200 sm:min-h-0">Dejarlo como está</button>
        </div>
        {error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}
      </div>
    )
  }

  // UNA LÍNEA, y se puede plegar. Era un párrafo fijo encima de la lista todos
  // los días; la explicación larga queda en el «?» y en la confirmación.
  if (plegado) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dark-800 bg-dark-900/60 px-3 py-2 text-[12.5px]">
      <Lock size={13} className="shrink-0 text-dark-500" />
      {/* Un mínimo de ancho (11-11-2026, tanda 2, E1): en el móvil el botón largo lo aplastaba a una palabra por
          línea; ahora, si no cabe al lado, el botón baja a la línea siguiente. En el ordenador cabe todo como antes. */}
      <span className="min-w-[min(15rem,calc(100%_-_2rem))] flex-1 text-dark-300">
        Contraseña temporal común: se aplica a {deCentro}
        {sinCorreo > 0 && <> · <span className="text-amber-300">{sinCorreo} sin correo</span></>}
        <span className="ml-1.5 cursor-help text-dark-500"
          title={`Es una sola contraseña para todos los conductores de ${deCentro}, y cada uno tiene que cambiarla al entrar. Por defecto solo se les pone a quienes todavía no se han puesto la suya; antes de aplicarla se dice a cuántos.`
            + (sinCorreo > 0 ? ` Los ${sinCorreo} sin correo no pueden entrar de ninguna forma hasta ponérselo en su ficha.` : '')}>(?)</span>
      </span>
      <button onClick={() => setConfirmar(true)}
        className="min-h-[44px] rounded-lg bg-dark-800 px-2.5 py-1 font-semibold text-dark-200 hover:bg-dark-700 sm:min-h-0">
        Establecer contraseña temporal común
      </button>
      <button onClick={plegar} aria-label="Ocultar este aviso"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-dark-500 hover:text-dark-300 sm:min-h-0 sm:min-w-0">
        <X size={13} />
      </button>
    </div>
  )
}


/* LA CONTRASEÑA INICIAL DE LOS NUEVOS (30-10-2026, Dani: «que cada vez que creemos una cuenta tenga por
   defecto una contraseña y, cuando entren, les salte cambiarla; hoy se la he tenido que poner yo a mano»).
   La define la oficina una vez; cada conductor que se da de alta con correo (uno a uno o importando) entra
   la primera vez con ella y la app le obliga a elegir la suya. El servidor guarda solo el hash: aquí nunca
   se enseña, solo si la hay, desde cuándo y quién la puso. Sin permiso o sin respuesta, no se pinta nada. */
function ContrasenaInicial() {
  const [estado, setEstado] = useState(null) // { definida, desde, por }
  const [editar, setEditar] = useState(false)
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    getContrasenaInicial().then(({ data }) => setEstado(data)).catch(() => setEstado(null))
  }, [])

  async function guardar() {
    if (clave.length < 8) { setError('La contraseña inicial debe tener al menos 8 caracteres.'); return }
    setOcupado(true); setError(''); setAviso('')
    try {
      const { data } = await setContrasenaInicial(clave)
      setEstado(data); setClave(''); setEditar(false)
      setAviso('Guardada. Cada conductor nuevo con correo entrará con ella la primera vez y tendrá que cambiarla.')
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo guardar. Reintenta.')
    }
    setOcupado(false)
  }

  async function quitar() {
    if (!window.confirm('¿Quitar la contraseña inicial? Los conductores nuevos ya no tendrán acceso hasta que les pongas una a mano.')) return
    setOcupado(true); setError(''); setAviso('')
    try {
      const { data } = await setContrasenaInicial('')
      setEstado(data); setAviso('Quitada.')
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo quitar. Reintenta.')
    }
    setOcupado(false)
  }

  if (!estado) return null
  const desde = estado.desde
    ? new Date(estado.desde).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''
  return (
    <div className="mb-3 rounded-xl border border-dark-800 bg-dark-900/60 px-3 py-2 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <KeyRound size={13} className="shrink-0 text-dark-500" />
        {/* El mismo mínimo de ancho que el aviso de la temporal (11-11-2026, tanda 2, E1). */}
        <span className="min-w-[min(15rem,calc(100%_-_2rem))] flex-1 text-dark-300">
          Contraseña inicial de los conductores nuevos:{' '}
          {estado.definida
            ? <span className="text-lime-300">definida{desde ? ` desde el ${desde}` : ''}{estado.por ? ` por ${estado.por}` : ''}</span>
            : <span className="text-amber-300">sin definir</span>}
          <span className="ml-1.5 cursor-help text-dark-500"
            title="Cada conductor que des de alta con correo (uno a uno o importando) entra la primera vez con esta contraseña y la app le obliga a elegir la suya. Aquí nunca se enseña: el servidor solo guarda el hash.">(?)</span>
        </span>
        {!editar && (
          <button onClick={() => { setEditar(true); setAviso('') }}
            className="min-h-[44px] rounded-lg bg-dark-800 px-2.5 py-1 font-semibold text-dark-200 hover:bg-dark-700 sm:min-h-0">
            {estado.definida ? 'Cambiarla' : 'Definirla'}
          </button>
        )}
        {!editar && estado.definida && (
          <button onClick={quitar} disabled={ocupado}
            className="min-h-[44px] px-2 py-1 text-dark-400 hover:text-dark-200 disabled:opacity-50 sm:min-h-0">Quitarla</button>
        )}
      </div>
      {editar && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') guardar() }}
            placeholder="Contraseña inicial (mínimo 8 caracteres)" minLength={8} maxLength={128}
            aria-label="Contraseña inicial de los conductores nuevos"
            className="min-h-[44px] w-full max-w-xs rounded-lg border border-dark-700 bg-dark-950 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-brand-400 sm:min-h-0" />
          {/* 44 px en el móvil, como «Cambiarla» (11-11-2026, revisión de la tanda 2); igual desde `sm`. */}
          <button onClick={guardar} disabled={ocupado} className="btn-primary flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 text-[12.5px] sm:min-h-0">
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} Guardar
          </button>
          <button onClick={() => { setEditar(false); setClave(''); setError('') }}
            className="min-h-[44px] px-2 py-1 text-dark-400 hover:text-dark-200 sm:min-h-0">Cancelar</button>
        </div>
      )}
      {error && <p className="mt-1.5 text-[12px] text-red-300">{error}</p>}
      {aviso && <p className="mt-1.5 text-[12px] text-lime-300">{aviso}</p>}
    </div>
  )
}


/* UNA TARJETA POR CONDUCTOR EN EL MÓVIL (11-11-2026, tanda 2, E1 / equipo-9). La tabla mide 760 px como mínimo y en el
   móvil había que deslizar de lado para ver el teléfono. Debajo de `sm` va esto: el nombre y su centro; el teléfono, a
   un toque para llamar (aparte de la tarjeta, que abre la ficha: un enlace dentro de un botón no vale); y lo que le
   falta. El ordenador sigue con la tabla. */
/* Desde cuándo está de baja (11-11-2026, equipo-6): la fecha si se sabe, o que la sacó la hoja de Google. */
function bajaTexto(d) {
  if (d?.desactivada_por === 'hoja') return 'la sacó la hoja de Google'
  // `baja_en` va en UTC: el día, el de aquí (una baja a las 00:30 es de ese día, no del anterior).
  const f = d?.baja_en ? new Date(d.baja_en) : null
  if (!f || Number.isNaN(f.getTime())) return 'de baja'
  return `de baja desde ${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`
}

function TarjetaConductor({ d, accounts, cuentasOk, conIdReparto, datoOrden, deBaja = false, appInfo = null, onAbrir }) {
  const { t } = useT()
  // De una baja no se dice lo que le falta: no se va a completar (11-11-2026, equipo-6).
  const faltan = deBaja ? [] : faltasQueCuentan({ conIdReparto, cuentasOk, appOk: !!appInfo })
    .filter((f) => f.id !== 'centro' && f.falta(d, accounts, appInfo))
  const tel = String(d.phone || '').replace(/[^\d+]/g, '')
  return (
    <li className={`flex items-stretch border-b border-dark-800/50 last:border-0 ${deBaja ? 'opacity-70' : ''}`}>
      <button type="button" onClick={() => onAbrir(d)} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left active:bg-dark-800/60">
        <Avatar driver={d} size={8} />
        <span className="min-w-0 flex-1">
          {/* En dos líneas si hace falta, no cortado con «…» (11-11-2026, revisión de la tanda 2): a 390 px caben unas
              28 letras y un nombre compuesto con dos apellidos («MARÍA DEL CARMEN FERNÁNDEZ RODRÍGUEZ») se perdía. */}
          <span className="line-clamp-2 break-words text-[13.5px] font-semibold text-dark-100">{String(d.name || '').replace(/\s+/g, ' ').trim()}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] text-dark-400">
            {sinCentro(d)
              ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300">sin centro</span>
              : <span>{d.center}</span>}
            {tel && <span className="cifra text-dark-400">· {verTelefono(d.phone)}</span>}
            {datoOrden && <DatoDeOrden d={d} col={datoOrden} nombre={t(COLUMNA_ORDEN[datoOrden])} />}
            {d.traslado?.centro && (
              <span className="whitespace-nowrap rounded-full bg-sky-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-sky-300">
                → {d.traslado.centro} {fechaCorta(d.traslado.desde).slice(0, 5)}
              </span>
            )}
            {faltan.map((f) => (
              <span key={f.id} className="whitespace-nowrap rounded-full bg-dark-800 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300">{t(f.clave)}</span>
            ))}
            {/* La app sin actualizar, también en el móvil (11-11-2026, equipo-5): «sin app» va entre las faltas. */}
            {appInfo && versionMenor(appInfo.conductores?.[d.id]?.app, appInfo.ultima) && (
              <span data-testid="tarjeta-app-vieja" title={`Hay una versión más nueva: ${appInfo.ultima}`}
                className="whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300">
                app {appInfo.conductores[d.id].app}
              </span>
            )}
            {deBaja && (
              <span data-testid="baja-desde" className="whitespace-nowrap rounded-full bg-dark-800 px-2 py-0.5 text-[10.5px] font-semibold text-dark-300">{bajaTexto(d)}</span>
            )}
          </span>
        </span>
      </button>
      {/* El número se lee en la tarjeta; el botón redondo llama. Así el nombre tiene casi todo el ancho. */}
      {tel ? (
        <a href={`tel:${tel}`} aria-label={`${t('drv.llamar')} ${verTelefono(d.phone)}`} title={t('drv.llamar')}
          className="my-auto mr-2 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 active:bg-brand-500/30">
          <Phone size={17} />
        </a>
      ) : (
        <span className="flex shrink-0 items-center pr-3 text-[11px] text-dark-500">{t('drv.f.sinTel')}</span>
      )}
    </li>
  )
}

/* POR QUÉ SE PUEDE ORDENAR EN EL MÓVIL: por lo mismo que en la tabla (11-11-2026, tercera revisión de la tanda 2, M1).
   Antes de las tarjetas, el móvil deslizaba la tabla de lado y ordenaba tocando cualquier cabecera; dejar solo nombre,
   centro y teléfono le quitaba algo que tenía. Las siete columnas, en el orden de la tabla, con la clave de su nombre.
   Las cuatro que la tarjeta no enseña (alojamiento, correo, contrato y nivel), al elegirlas, la tarjeta las enseña en su
   línea de datos (DatoDeOrden): sin eso la lista cambiaba de orden sin ninguna pista de por qué. */
const COLUMNA_ORDEN = { name: 'drv.o.nombre', center: 'drv.o.centro', alojamiento: 'drv.o.alojamiento', phone: 'drv.o.telefono',
  email: 'drv.o.correo', contrato: 'drv.o.contrato', nivel: 'drv.o.nivel' }
const NO_SALE_EN_TARJETA = ['alojamiento', 'email', 'contrato', 'nivel']

/* El dato por el que se ordena, con el mismo texto que la celda de la tabla: la etiqueta de contrato o de nivel, el
   correo o el alojamiento tal cual, y «—» si la ficha no lo tiene. Discreto, como el teléfono. El correo puede partirse
   detrás de la «@» y, si aun así no cabe, por donde haga falta; el alojamiento, en dos líneas como mucho (entero en el
   `title`). Así nada empuja la tarjeta de lado a 360 px. */
function DatoDeOrden({ d, col, nombre }) {
  if (col === 'contrato' || col === 'nivel') {
    const [l, c] = (col === 'nivel' ? NIVEL : CONTRATO)[d[col]] || []
    return c
      ? <span data-testid="dato-orden" title={nombre} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${c}`}>{l}</span>
      : <span data-testid="dato-orden" title={nombre} className="text-dark-500">· —</span>
  }
  const v = d[col] || ''
  if (!v) return <span data-testid="dato-orden" title={nombre} className="text-dark-500">· —</span>
  if (col === 'email') {
    // Se parte detrás de la «@» y de cada «.», no en mitad de una palabra; el «·» de delante va pegado (espacio duro)
    // para no quedarse solo en una línea.
    const trozos = v.replace(/[@.]/g, (c) => `${c}\n`).split('\n')
    return (
      <span data-testid="dato-orden" title={`${nombre}: ${v}`} className="min-w-0 max-w-full text-dark-500 [overflow-wrap:anywhere]">
        {'· '}{trozos.flatMap((x, i) => (i ? [<wbr key={i} />, x] : [x]))}
      </span>
    )
  }
  return (
    <span data-testid="dato-orden" title={`${nombre}: ${v}`} className="line-clamp-2 min-w-0 max-w-full text-dark-500 [overflow-wrap:anywhere]">· {v}</span>
  )
}

// Pantalla estrecha (por debajo de `sm`, 640 px): sigue al giro del móvil y al tamaño de la ventana.
const ESTRECHO = '(max-width: 639.98px)'
function useEstrecho() {
  const [si, setSi] = useState(() => { try { return window.matchMedia(ESTRECHO).matches } catch { return false } })
  useEffect(() => {
    let mq
    try { mq = window.matchMedia(ESTRECHO) } catch { return undefined }
    const cambia = () => setSi(mq.matches)
    cambia()
    mq.addEventListener?.('change', cambia)
    return () => mq.removeEventListener?.('change', cambia)
  }, [])
  return si
}

function TablaConductores({ list, accounts, cuentasOk = false, conIdReparto = false, deBaja = false, appInfo = null, onAbrir }) {
  const { t } = useT()
  const estrecho = useEstrecho()
  const [orden, setOrden] = useState({ col: 'name', asc: true })
  const datoOrden = NO_SALE_EN_TARJETA.includes(orden.col) ? orden.col : null

  const filas = useMemo(() => {
    const { col, asc } = orden
    // Recortado: 18 fichas guardan el nombre con espacios delante («  Karim…»)
    // y salían las primeras de la lista, antes que las de la A.
    const txt = (d) => String(d?.[col] ?? '').trim()
    const ms = [...list].sort((a, b) => {
      const r = txt(a).localeCompare(txt(b), 'es', { sensitivity: 'base', numeric: true })
      return asc ? r : -r
    })
    return ms
  }, [list, orden])

  const Cab = ({ col, children, alinea = 'text-left' }) => (
    <th className={`px-2 py-2 ${alinea} text-[10px] font-medium uppercase tracking-wider text-dark-500`}>
      <button
        onClick={() => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : true }))}
        className={`inline-flex items-center gap-1 hover:text-dark-300 ${orden.col === col ? 'text-dark-300' : ''}`}>
        {children}
        {orden.col === col && <span className="text-[8px]">{orden.asc ? '▲' : '▼'}</span>}
      </button>
    </th>
  )

  return (
    <div className="card overflow-hidden">
      {/* Una cosa u otra, no las dos escondidas: así cada nombre está una sola vez en la página. */}
      {estrecho ? (
      <>
      {/* ORDENAR TAMBIÉN EN EL MÓVIL (11-11-2026, revisión de la tanda 2). Con la tabla se ordenaba tocando su cabecera
          (por centro, para tener juntos a los de cada nave con «Todos»; por contrato…); las tarjetas no tienen cabecera,
          así que lo mismo va en un selector y un botón de sentido, sobre el mismo `orden` que usa la tabla. */}
      <div className="flex items-center gap-2 border-b border-dark-800 px-3 py-1.5 text-[12.5px] text-dark-400">
        <label htmlFor="orden-conductores">{t('drv.ordenarPor')}</label>
        <select id="orden-conductores" value={orden.col} onChange={(e) => setOrden({ col: e.target.value, asc: true })}
          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-dark-700 bg-dark-950 px-2 text-[13px] text-dark-100">
          {Object.entries(COLUMNA_ORDEN).map(([col, clave]) => <option key={col} value={col}>{t(clave)}</option>)}
        </select>
        <button type="button" onClick={() => setOrden((o) => ({ ...o, asc: !o.asc }))}
          aria-label={orden.asc ? t('drv.ordenAZ') : t('drv.ordenZA')} title={t('drv.ordenVuelta')}
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border border-dark-700 text-dark-300">
          {orden.asc ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      <ul aria-label="Conductores">
        {filas.map((d) => (
          <TarjetaConductor key={d.id} d={d} accounts={accounts} cuentasOk={cuentasOk} conIdReparto={conIdReparto}
            datoOrden={datoOrden} deBaja={deBaja} appInfo={appInfo} onAbrir={onAbrir} />
        ))}
      </ul>
      </>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="sticky top-0 z-10 bg-dark-900">
            <tr className="border-b border-dark-800">
              <th className="w-8 px-2 py-2"></th>
              <Cab col="name">Nombre</Cab>
              <Cab col="center">Centro</Cab>
              <Cab col="alojamiento">Alojamiento</Cab>
              <Cab col="phone">Teléfono</Cab>
              <Cab col="email">Correo</Cab>
              <Cab col="contrato">Contrato</Cab>
              <Cab col="nivel">Nivel</Cab>
              {/* «Acceso» y no «PIN» (10-11-2026): no hay ningún PIN; dice si tiene cuenta con contraseña. */}
              <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-dark-500">Acceso</th>
              {appInfo && <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-dark-500">App</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((d) => {
              const [nl, nc] = NIVEL[d.nivel] || []
              const [cl, cc] = CONTRATO[d.contrato] || []
              const hasAcc = accounts.includes(d.id)
              return (
                <tr key={d.id} onClick={() => onAbrir(d)}
                  className={`float-row cursor-pointer border-b border-dark-800/50 last:border-0 ${deBaja ? 'opacity-70' : ''}`}>
                  <td className="px-2 py-1"><Avatar driver={d} size={7} /></td>
                  <td className="max-w-[220px] truncate px-2 py-1 font-medium text-dark-100">
                    {deBaja ? <span>{String(d.name || '').replace(/\s+/g, ' ').trim()}</span> : String(d.name || '').replace(/\s+/g, ' ').trim()}
                    {deBaja && <span data-testid="baja-desde" className="block truncate text-[11px] font-normal text-dark-500">{bajaTexto(d)}</span>}
                  </td>
                  <td className="px-2 py-1 text-dark-400">
                    {sinCentro(d)
                      ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">sin centro</span>
                      : d.center}
                    {d.traslado?.centro && (
                      <span title={`Pasa a ${d.traslado.centro} el ${fechaCorta(d.traslado.desde)}`}
                        className="ml-1.5 whitespace-nowrap rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        → {d.traslado.centro} {fechaCorta(d.traslado.desde).slice(0, 5)}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[150px] truncate px-2 py-1 text-dark-500">{d.alojamiento || '—'}</td>
                  <td className="cifra px-2 py-1 text-dark-400">
                    {d.phone ? verTelefono(d.phone) : '—'}
                  </td>
                  <td className="max-w-[210px] truncate px-2 py-1 text-dark-500">{d.email || '—'}</td>
                  <td className="whitespace-nowrap px-2 py-1">
                    {cc ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cc}`}>{cl}</span>
                        : <span className="text-dark-500">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    {nc ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${nc}`}>{nl}</span>
                        : <span className="text-dark-500">—</span>}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {hasAcc ? <Lock size={11} className="inline text-lime-400" title="Tiene acceso al portal" />
                            : <span className="text-dark-700">—</span>}
                  </td>
                  {appInfo && <td className="whitespace-nowrap px-2 py-1"><CeldaApp info={appInfo.conductores?.[d.id]} ultima={appInfo.ultima} /></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
      <p className="border-t border-dark-800 px-3 py-1.5 text-[11px] text-dark-500">
        {filas.length} {deBaja ? 'de baja' : filas.length === 1 ? 'conductor' : 'conductores'} · pulsa {estrecho ? 'uno' : 'una fila'} para abrir la ficha
      </p>
    </div>
  )
}


export default function Conductores() {
  const { center, centers } = useOutletContext()
  const { t } = useT()
  const [drivers, setDrivers] = useState(null)
  const [accounts, setAccounts] = useState([]) // driver_ids que tienen contraseña
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [verImportar, setVerImportar] = useState(false) // null | { driver: obj|null }
  const [verMoviles, setVerMoviles] = useState(false)
  const [verMas, setVerMas] = useState(false)          // el menú «Más» del móvil
  const [filtro, setFiltro] = useState(null)           // id de FALTAS o null
  // Si se sabe quién tiene cuenta: sin esa lista, «sin acceso» diría que nadie la tiene.
  const [cuentasOk, setCuentasOk] = useState(false)
  const { modulos } = usePlan()
  const conIdReparto = !Array.isArray(modulos) || modulos.includes('diarios') || modulos.includes('horas')
  // /panel/conductores?importar=1 abre directamente la importación.
  const [paramsImp] = useSearchParams()
  useEffect(() => { if (paramsImp.get('importar')) setVerImportar(true) }, [paramsImp])
  const [tab, setTab] = useState('directorio') // directorio | ranking | scoring
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep-link desde la paleta de comandos: /panel/conductores?open=<id>
  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && drivers) {
      const d = drivers.find((x) => x.id === openId)
      if (d) setModal({ driver: d })
      /* Una ficha de OTRA nave (11-11-2026, equipo-11: «Abrir» desde Incorporaciones o los Carnets): se busca entre
         todas las que ve quien la pide, como «ya tiene ficha» en el alta. Si no la ve, no se abre nada (como antes). */
      else {
        getDrivers('Todos').then((r) => {
          const f = lista(r.data).find((x) => x.id === openId)
          if (f) setModal({ driver: f })
        }).catch(() => {})
      }
      setSearchParams({}, { replace: true })
    }
  }, [drivers]) // eslint-disable-line

  // LAS FICHAS DE BAJA (11-11-2026, tanda 3, equipo-6): null = el servidor no las da (uno viejo): ni chip ni lista.
  const [bajas, setBajas] = useState(null)
  const [verBajas, setVerBajas] = useState(false)
  const [aviso, setAviso] = useState('')
  // QUIÉN TIENE LA APP (11-11-2026, equipo-5): null = no se sabe (servidor viejo o error): ni columna ni filtro.
  const [appInfo, setAppInfo] = useState(null)
  async function load() {
    getDriversBajas(center)
      .then((r) => setBajas(Array.isArray(r.data) ? r.data.filter((x) => x && x.id) : null))
      .catch(() => setBajas(null))
    getDriversApp(center)
      .then((r) => {
        const c = r.data?.conductores
        setAppInfo(c && typeof c === 'object' && !Array.isArray(c) ? { conductores: c, ultima: r.data.ultima || null } : null)
      })
      .catch(() => setAppInfo(null))
    try {
      const [rd, ra] = await Promise.all([getDrivers(center), getDriverAccounts()])
      setDrivers(lista(rd.data))
      setAccounts((lista(ra.data)).map(a => a.driver_id))
      setCuentasOk(true)
    } catch {
      try { const r = await getDrivers(center); setDrivers(lista(r.data)) } catch { setDrivers([]) }
      setAccounts([]); setCuentasOk(false)
    }
  }
  useEffect(() => { setDrivers(null); setModal(null); load() }, [center]) // eslint-disable-line

  // Se busca también por nº de empleado y teléfono, y sin tildes: «nunez»
  // encuentra a «NÚÑEZ». Lo mismo en la lista de bajas.
  const buscar = useMemo(() => {
    const plano = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const b = plano(q).trim()
    return (arr) => (arr || [])
      .filter(d => !b || [d.name, d.email, d.center, d.driver_id, d.transporter_id, d.phone, d.movil_personal]
        .some(v => plano(v).includes(b)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
  }, [q])
  const vivos = useMemo(() => buscar(drivers), [buscar, drivers])
  const bajasVistas = useMemo(() => buscar(bajas), [buscar, bajas])
  const enBajas = verBajas && Array.isArray(bajas)
  const list = enBajas ? bajasVistas : vivos

  // Los filtros de un toque, contados sobre lo que deja el buscador: el número es lo que se ve al pulsarlo.
  const faltas = useMemo(() => (enBajas ? [] : faltasQueCuentan({ conIdReparto, cuentasOk, appOk: !!appInfo }))
    .map((f) => ({ ...f, n: list.filter((d) => f.falta(d, accounts, appInfo)).length })),
  [list, accounts, conIdReparto, cuentasOk, enBajas, appInfo])
  const filtroVivo = faltas.find((f) => f.id === filtro) || null
  const vistos = filtroVivo ? list.filter((d) => filtroVivo.falta(d, accounts, appInfo)) : list
  const conChipBajas = enBajas || (Array.isArray(bajas) && bajas.length > 0)

  /* «Ya tiene ficha»: se abre esa ficha. Puede no estar en la lista que se ve
     (otro centro): se busca entre todas las que puede ver quien da de alta. */
  async function abrirExistente(d) {
    let ficha = (drivers || []).find((x) => x.id === d.abrir_id)
    if (!ficha) {
      try { ficha = lista((await getDrivers('Todos')).data).find((x) => x.id === d.abrir_id) } catch { /* abajo */ }
    }
    if (!ficha) {
      window.alert(`${d.mensaje}\n\nNo tienes acceso a ese centro: pide a quien lo lleve que la edite.`)
      return
    }
    setModal({ driver: ficha })
  }

  async function handleSave(id, data) {
    if (id) {
      const r = await updateDriver(id, data)
      /* Cambiada la nave desde «Editar» con un cambio programado a OTRA (11-11-2026, equipo-8): ese sigue en pie. */
      const tp = r?.data?.traslado_pendiente
      if (tp?.centro) {
        window.alert(`Ojo: tenía programado pasar a ${tp.centro}${tp.desde ? ` el ${fechaCorta(tp.desde)}` : ''}. Ese cambio sigue programado; si ya no vale, cancélalo en «Cambio de centro».`)
      }
    } else {
      try {
        await createDriver(data)
      } catch (e) {
        const d = e?.response?.data?.detalle
        /* Ya tiene ficha ACTIVA (mismo correo o mismo ID de reparto). Antes
           solo salía el aviso y la ficha no aparecía en la lista si estaba sin
           centro: parecía que no se podía guardar. Ahora se va a ella. */
        if (e?.response?.status === 409 && d?.abrir_id) {
          if (window.confirm(`${d.mensaje}\n\nAceptar: abrir su ficha para revisarla o completarla.`)) {
            await abrirExistente(d)
            setDrivers(null); load()
            return
          }
          throw e
        }
        /* Alguien que vuelve tras una baja: el servidor ofrece su ficha de
           siempre en vez de crear otra y partir su historial en dos. */
        if (e?.response?.status !== 409 || !d?.reactivar_id) throw e
        /* «Otra persona» en un SEGUNDO paso (11-11-2026): antes el «Cancelar» del primero ya creaba la ficha nueva, y
           mucha gente pulsa Cancelar para no hacer nada. Ahora el servidor, además, le quita el correo a la ficha de
           baja (deja de entrar con él): pulsarlo sin querer le cerraría la cuenta a la misma persona. */
        if (window.confirm(`${d.mensaje}

Aceptar: reactivar su ficha (conserva inspecciones, turnos e historial).
Cancelar: ver otras opciones.`)) {
          const { password: _pw, ...resto } = data
          await updateDriver(d.reactivar_id, { ...resto, active: true })
        } else if (window.confirm(`¿Es OTRA persona con el mismo correo?

La ficha dada de baja dejará de entrar con este correo.
Aceptar: crear una ficha nueva.
Cancelar: no hacer nada.`)) {
          await createDriver(data, { nueva: true })
        } else {
          setModal(null)
          return
        }
      }
    }
    setModal(null); setDrivers(null); load()
  }
  /* «Dar de baja» y no «Eliminar» (11-11-2026, equipo-6): el servidor nunca borraba, daba de baja. */
  async function handleDelete(d) {
    if (!confirm(`¿Dar de baja a ${d.name}? Deja de salir en las listas y no podrá volver a entrar en la app. Se conservan sus inspecciones, turnos e historial y se puede reactivar desde «Bajas».`)) return
    await deleteDriver(d.id); setModal(null); setDrivers(null); load()
  }

  /* REACTIVAR UNA BAJA (11-11-2026, equipo-6). Si su ID de reparto ya lo tiene otra ficha viva, se pregunta si se
     reactiva sin él; si su correo ya lo tiene otra activa, no se puede (serían dos para la misma persona): se abre esa. */
  async function reactivar(d) {
    try {
      await reactivarConductor(d.id)
    } catch (e) {
      const det = e?.response?.data?.detalle
      if (e?.response?.status !== 409 || !det?.abrir_id) throw e
      if (det.conflicto === 'id_reparto') {
        if (!window.confirm(`${det.mensaje}\n\nAceptar: reactivar a ${d.name} SIN ese ID de reparto (pónselo bueno en su ficha).\nCancelar: no hacer nada.`)) return
        await reactivarConductor(d.id, { quitar_id: true })
      } else {
        if (window.confirm(`${det.mensaje}\n\nNo se reactiva: serían dos fichas activas con el mismo correo.\nAceptar: abrir esa ficha.`)) {
          await abrirExistente(det)
        }
        return
      }
    }
    setModal(null)
    setAviso(`${d.name} vuelve a estar activo. Entra con la contraseña que tuviera; el correo personal de recuperación se quitó al darle de baja y, si lo usaba, hay que volver a ponérselo.`)
    setDrivers(null); load()
  }

  const TABS = [
    { id: 'directorio', label: t('drv.title') },
    // `corto`: lo que dice en el móvil, para que las tres quepan en una línea (11-11-2026, revisión de la tanda 2).
    { id: 'ranking',    label: `🏆 ${t('sc.ranking')}`, corto: `🏆 ${t('drv.tabRanking')}` },
    // Pestaña y no entrada de menú: es mantenimiento que se hace de vez en
    // cuando, no una tarea del día.
    { id: 'fichas',     label: 'Fichas duplicadas', corto: t('drv.tabDuplicadas') },
  ]

  return (
    <div>
      {/* Header */}
      {/* Con el menú «Más» abierto, la cabecera por encima de lo que viene debajo (la animación de entrada la hace
          su propia capa y, sin esto, las pestañas tapaban el menú). */}
      <header className={`rise mb-6 ${verMas ? 'relative z-30' : ''}`}>
        {center && center !== 'Todos' && (
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-brand-400/80">{center}</p>
        )}
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-[clamp(28px,3.4vw,42px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">
            {t('drv.title')}{drivers && <span className="text-dark-500"> · {(drivers || []).length}</span>}
          </h1>
          {tab === 'directorio' && (
            /* EN EL MÓVIL SALTA DE LÍNEA (11-11-2026, tanda 2, E1 / equipo-9): era una fila fija de ~600 px que se
               salía de la pantalla. Debajo de `sm`, el buscador va a todo el ancho y «Importar» y «Móviles personales»
               van dentro de «Más»; en el ordenador sigue todo en una fila, como antes. */
            <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  className="min-h-[44px] w-full rounded-xl border border-white/[0.07] bg-white/[0.02] py-2.5 pl-10 pr-3 text-[13.5px] text-dark-50 placeholder:text-dark-500 transition-all duration-300 hover:border-white/[0.12] focus:border-brand-500/50 focus:bg-white/[0.045] focus:outline-none focus:ring-[3px] focus:ring-brand-500/15 sm:min-h-0 sm:w-56"
                  placeholder={t('drv.search')} value={q} onChange={e => setQ(e.target.value)}
                />
              </div>
              {/* Importar va ANTES de «añadir»: quien llega el primer día no
                  quiere teclear cincuenta fichas, quiere subir su Excel. */}
              <button onClick={() => setVerImportar((v) => !v)}
                className="hidden items-center gap-1.5 rounded-xl border border-dark-700 px-3.5 py-2.5 text-[13.5px] font-semibold text-dark-300 hover:border-dark-600 hover:text-dark-100 sm:flex">
                <FileSpreadsheet size={15} /> {t('drv.importar')}
              </button>
              <button onClick={() => setVerMoviles((v) => !v)}
                title="Pon los móviles personales desde la agenda de tu teléfono: los WhatsApp personales van a ese número."
                className="hidden items-center gap-1.5 rounded-xl border border-dark-700 px-3.5 py-2.5 text-[13.5px] font-semibold text-dark-300 hover:border-dark-600 hover:text-dark-100 sm:flex">
                <Smartphone size={15} /> {t('drv.moviles')}
              </button>
              {/* «Más», solo en el móvil: las dos de arriba, en un menú. */}
              <div className="relative sm:hidden">
                <button onClick={() => setVerMas((v) => !v)} aria-expanded={verMas} aria-haspopup="menu"
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-dark-700 px-3.5 text-[13.5px] font-semibold text-dark-300">
                  <MoreHorizontal size={16} /> {t('drv.mas')}
                </button>
                {verMas && (
                  <>
                    <button aria-label="Cerrar" tabIndex={-1} onClick={() => setVerMas(false)} className="fixed inset-0 z-30 cursor-default" />
                    <div role="menu" className="absolute left-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-dark-700 bg-dark-900 py-1 shadow-xl">
                      <button role="menuitem" onClick={() => { setVerMas(false); setVerImportar((v) => !v) }}
                        className="flex min-h-[44px] w-full items-center gap-2 px-3.5 text-left text-[13.5px] font-semibold text-dark-200 active:bg-dark-800">
                        <FileSpreadsheet size={15} /> {t('drv.importar')}
                      </button>
                      <button role="menuitem" onClick={() => { setVerMas(false); setVerMoviles((v) => !v) }}
                        className="flex min-h-[44px] w-full items-center gap-2 px-3.5 text-left text-[13.5px] font-semibold text-dark-200 active:bg-dark-800">
                        <Smartphone size={15} /> {t('drv.moviles')}
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setModal({ driver: null })}
                className="group relative flex min-h-[44px] flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all duration-300 [text-shadow:0_1px_1px_rgba(0,0,0,0.15)] hover:-translate-y-px hover:shadow-xl hover:shadow-brand-500/30 hover:brightness-110 active:translate-y-0 active:scale-[0.98] sm:min-h-0 sm:flex-none"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                <Plus size={15} /> {t('drv.add')}
              </button>
            </div>
          )}
        </div>
      </header>

      {verImportar && (
        <div className="card mb-5 p-5">
          {/* Al terminar solo se recarga la lista: cerrarlo escondia el
              resultado antes de poder leerlo. */}
          <ImportarConductores center={center} alTerminar={() => load()} />
        </div>
      )}

      {verMoviles && (
        <div className="card mb-5 p-5">
          <ImportarMoviles alTerminar={() => load()} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-dark-800 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`min-h-[44px] px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px sm:min-h-0 sm:px-4 ${
              tab === t.id
                ? 'border-brand-400 text-brand-300'
                : 'border-transparent text-dark-500 hover:text-dark-300'
            }`}>
            {t.corto ? <><span className="sm:hidden">{t.corto}</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
          </button>
        ))}
      </div>

      {/* Directorio */}
      {tab === 'directorio' && (
        !drivers
          ? <div className="flex items-center gap-2 py-16 text-dark-400"><Loader2 size={18} className="animate-spin" /> {t('ui.loading')}</div>
          : list.length === 0 && q && drivers.length > 0 && !enBajas
            ? <div className="rounded-2xl border border-dashed border-dark-700 py-12 text-center">
                <p className="font-medium text-dark-300">Nadie coincide con «{q}»</p>
                <p className="mt-1 text-sm text-dark-500">Se busca por nombre, correo, sede, nº de empleado y teléfono.</p>
                <button onClick={() => setQ('')} className="btn-ghost mt-4 px-3 py-1.5 text-sm">Borrar búsqueda</button>
              </div>
          : list.length === 0 && !enBajas
            ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dark-700 px-6 py-20 text-center">
                <UserCheck size={44} className="mb-4 text-dark-500" />
                <p className="text-base font-semibold text-dark-100">{t('drv.empty')}{center !== 'Todos' ? ` en ${center}` : ''}</p>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-dark-400">
                  Trae tu lista de Excel: se reconoce cada columna, eliges la sede y
                  cada conductor recibe su acceso al portal para hacer las auditorías desde el móvil.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => setVerImportar(true)} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
                    <FileSpreadsheet size={14} /> {t('drv.importar')}
                  </button>
                  <button onClick={() => setModal({ driver: null })} className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm">
                    <Plus size={14} /> {t('drv.add')}
                  </button>
                </div>
              </div>
            : <div className="flex flex-col">
                {/* EN EL MÓVIL, LOS AVISOS DE CONTRASEÑAS DEBAJO DE LA LISTA (11-11-2026, revisión de la tanda 2): son
                    ajustes de vez en cuando y, encima, ocupaban media pantalla: al abrir Conductores no se veía ningún
                    conductor sin bajar. En el ordenador siguen arriba, como siempre.
                    Se pintan UNA vez y los baja el CSS (`order-last`), no dos copias según el ancho (11-11-2026, segunda
                    revisión): al girar el móvil se desmontaba una y se montaba la otra vacía, y se perdía el resultado de
                    aplicar la temporal o la clave a medio escribir. */}
                <div className="order-last mt-3 sm:order-none sm:mt-0">
                  <ContrasenaInicial />
                  <AvisoAccesos list={list} center={center} onHecho={load} />
                </div>
                {centers.length > 1 && list.some(sinCentro) && (
                  <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[12.5px] text-amber-200">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>
                      <b>{list.filter(sinCentro).length}</b> {list.filter(sinCentro).length === 1 ? 'ficha no tiene' : 'fichas no tienen'} centro:
                      salen en todos los centros hasta que se les ponga el suyo. Ábrelas y elige su centro.
                    </span>
                  </div>
                )}
                {aviso && (
                  <div role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-[12.5px] text-emerald-200">
                    <span className="min-w-0 flex-1">{aviso}</span>
                    <button onClick={() => setAviso('')} aria-label="Cerrar" className="shrink-0 text-emerald-300/70 hover:text-emerald-200"><X size={14} /></button>
                  </div>
                )}
                {/* Solo los que tienen a alguien (o el que está puesto, para poder quitarlo). «Bajas», al final. */}
                {(faltas.some((f) => f.n > 0 || f.id === filtro) || conChipBajas) && (
                  <div role="group" aria-label={t('drv.filtros')} className="mb-3 flex flex-wrap items-center gap-2">
                    {faltas.filter((f) => f.n > 0 || f.id === filtro).map((f) => (
                      <button key={f.id} aria-pressed={filtro === f.id}
                        title={f.id === 'app' ? t('drv.f.sinAppAyuda') : undefined}
                        onClick={() => setFiltro((x) => (x === f.id ? null : f.id))}
                        className={`min-h-[44px] rounded-full border px-3 text-[12.5px] font-semibold sm:min-h-0 sm:py-1 ${filtro === f.id
                          ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                          : 'border-dark-700 text-dark-300 hover:border-dark-600 hover:text-dark-100'}`}>
                        {t(f.clave)} ({f.n})
                      </button>
                    ))}
                    {filtro && (
                      <button onClick={() => setFiltro(null)}
                        className="min-h-[44px] px-2 text-[12.5px] text-dark-400 hover:text-dark-200 sm:min-h-0 sm:py-1">
                        {t('drv.f.quitar')}
                      </button>
                    )}
                    {conChipBajas && (
                      <button aria-pressed={enBajas} onClick={() => { setFiltro(null); setVerBajas((v) => !v) }}
                        title="Las fichas dadas de baja: se pueden abrir y reactivar"
                        className={`min-h-[44px] rounded-full border px-3 text-[12.5px] font-semibold sm:min-h-0 sm:py-1 ${enBajas
                          ? 'border-dark-400/60 bg-dark-700/60 text-dark-100'
                          : 'border-dark-700 text-dark-400 hover:border-dark-600 hover:text-dark-200'}`}>
                        Bajas ({bajasVistas.length})
                      </button>
                    )}
                  </div>
                )}
                {filtro === 'app' && filtroVivo && (
                  <p data-testid="ayuda-sin-app" className="mb-3 text-[12.5px] text-dark-400">{t('drv.f.sinAppAyuda')}</p>
                )}
                {enBajas && (
                  <p data-testid="aviso-bajas" className="mb-3 text-[12.5px] text-dark-400">
                    Fichas dadas de baja: no salen en las listas ni entran en la app. Abre una para reactivarla.
                    Pulsa otra vez «Bajas» para volver a las activas.
                  </p>
                )}
                <TablaConductores list={vistos} accounts={enBajas ? [] : accounts} cuentasOk={cuentasOk && !enBajas}
                  conIdReparto={conIdReparto && !enBajas} deBaja={enBajas} appInfo={enBajas ? null : appInfo}
                  onAbrir={(d) => setModal({ driver: d, deBaja: enBajas })} />
              </div>
      )}

      {/* Ranking + scoring unificado */}
      {tab === 'ranking' && <ScoringView center={center} />}

      {tab === 'fichas' && <SaludFichas onCambio={load} />}

      {/* Modal */}
      {modal && (
        <DriverModal
          driver={modal.driver}
          centers={centers}
          centroInicial={center && center !== 'Todos' ? center : (centers.length === 1 ? centers[0] : '')}
          hasAccount={accounts.includes(modal.driver?.id)}
          deBaja={!!modal.deBaja}
          appInfo={modal.deBaja ? null : appInfo}
          onReactivar={reactivar}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
          onAccountChange={load}
        />
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function DriverModal({ driver, centers, centroInicial = '', hasAccount, deBaja = false, appInfo = null, onReactivar, onSave, onDelete, onClose, onAccountChange }) {
  const { t } = useT()
  useEscape(onClose)
  const { modulos } = usePlan()
  const isNew = !driver
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState(driver ? { ...driver } : { ...EMPTY, center: centroInicial })
  // El ID de reparto solo tiene sentido para quien usa la DNR diaria o las
  // horas; a una empresa que no los tiene no se le enseña un campo que no usa.
  // Si la ficha ya lo trae, se ve siempre.
  const conIdReparto = !Array.isArray(modulos) || modulos.includes('diarios') || modulos.includes('horas')
    || !!driver?.transporter_id
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(driver?.photo_url || null)
  const [err, setErr] = useState('')
  const photoRef = useRef()

  // Gestión de contraseña
  const [pwSection, setPwSection] = useState(false)
  const [pwValue, setPwValue] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwShow, setPwShow] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const [pwOk, setPwOk] = useState('')
  const [recoveryStatus, setRecoveryStatus] = useState(null)
  const [recoveryValue, setRecoveryValue] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [recoveryError, setRecoveryError] = useState('')

  // Una ficha de baja se ve en solo lectura (11-11-2026, equipo-6): ni editar ni accesos, solo «Reactivar».
  const [reBusy, setReBusy] = useState(false)
  const [reErr, setReErr] = useState('')
  async function handleReactivar() {
    setReBusy(true); setReErr('')
    try { await onReactivar?.(driver) }
    catch (ex) { setReErr(ex?.response?.data?.detail || 'No se ha podido reactivar.') }
    finally { setReBusy(false) }
  }

  useEffect(() => {
    if (!driver?.id || deBaja) return
    getDriverRecoveryEmail(driver.id)
      .then(({ data }) => setRecoveryStatus(data))
      .catch(() => setRecoveryStatus(null))
  }, [driver?.id, deBaja])

  async function handleSetRecoveryEmail(e) {
    e.preventDefault()
    setRecoveryBusy(true); setRecoveryError(''); setRecoveryMessage('')
    try {
      const { data } = await setDriverRecoveryEmail(driver.id, recoveryValue.trim())
      setRecoveryMessage(data.vinculado
        ? `Ese correo ya estaba verificado (${data.email}).`
        : `Enlace de verificación enviado a ${data.email}. Caduca en 24 horas.`)
      setRecoveryValue('')
      const status = await getDriverRecoveryEmail(driver.id)
      setRecoveryStatus(status.data)
    } catch (ex) {
      setRecoveryError(ex?.response?.data?.detail || 'No se pudo enviar la verificación.')
    } finally { setRecoveryBusy(false) }
  }

  async function handleRemoveRecoveryEmail() {
    if (!confirm(`¿Desvincular el correo personal de ${driver.name}?`)) return
    setRecoveryBusy(true); setRecoveryError(''); setRecoveryMessage('')
    try {
      await removeDriverRecoveryEmail(driver.id)
      setRecoveryStatus({ vinculado: false, email: null, pendiente: null })
      setRecoveryMessage('Correo personal desvinculado.')
    } catch (ex) {
      setRecoveryError(ex?.response?.data?.detail || 'No se pudo desvincular el correo.')
    } finally { setRecoveryBusy(false) }
  }

  async function handleSetPassword() {
    setPwErr(''); setPwOk('')
    // 8, como la inicial y la temporal (10-11-2026); el servidor también lo pide ya.
    if (pwValue.length < 8) { setPwErr('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pwValue !== pwConfirm) { setPwErr('Las contraseñas no coinciden.'); return }
    setPwBusy(true)
    try {
      await setDriverPassword(driver.id, pwValue)
      setPwOk('Contraseña guardada. El conductor debe usarla en su próximo acceso.')
      setPwValue(''); setPwConfirm('')
      onAccountChange()
    } catch (ex) {
      setPwErr(ex?.response?.data?.detail || 'Error al guardar la contraseña.')
    }
    setPwBusy(false)
  }

  async function handleRemovePassword() {
    /* LA VERDAD DE CÓMO ENTRA (10-11-2026, equipo-12): quitarle la contraseña no le cierra el acceso. Sin cuenta
       entra con un código a su correo o con la contraseña inicial de la empresa, si la hay (_entrar_con_la_inicial). */
    if (!confirm(`¿Quitar la contraseña de ${driver.name}? No le cierra el acceso: podrá entrar con un código que le llega a su correo o con la contraseña inicial de la empresa, si está definida.`)) return
    setPwBusy(true); setPwErr(''); setPwOk('')
    try {
      await deleteDriverAccount(driver.id)
      setPwOk('Contraseña quitada. Entrará con un código a su correo o con la contraseña inicial de la empresa, si está definida.')
      onAccountChange()
    } catch (ex) {
      setPwErr(ex?.response?.data?.detail || 'Error al eliminar la cuenta.')
    }
    setPwBusy(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function cancel() { if (isNew) onClose(); else { setForm({ ...driver }); setEditing(false); setErr('') } }

  async function submit(e) {
    e.preventDefault()
    if (!form.name?.trim()) { setErr('El nombre es obligatorio.'); return }
    setBusy(true); setErr('')
    try { await onSave(driver?.id || null, form) }
    catch (ex) {
      setErr(ex?.response?.data?.detail || 'Error al guardar.'); setBusy(false)
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file || !driver?.id) return
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
    setPhotoBusy(true)
    try {
      const r = await uploadDriverPhoto(driver.id, file)
      setForm(f => ({ ...f, photo_url: r.data.photo_url }))
    } catch { setErr('Error subiendo la foto.') }
    finally { setPhotoBusy(false) }
  }

  const [nl, nc] = NIVEL[driver?.nivel] || []
  const [cl, cc] = CONTRATO[driver?.contrato] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel — mitad de pantalla */}
      <div
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl border border-dark-700 bg-dark-900 shadow-2xl shadow-black/50 overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-800 px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Avatar clickable para cambiar foto */}
            {driver && (
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="group relative shrink-0"
                title="Cambiar foto"
                disabled={photoBusy}
              >
                <div className="h-10 w-10 overflow-hidden rounded-full">
                  {previewUrl
                    ? <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                    : <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${avatarGrad(driver.name)} text-sm font-bold text-white`}>{initials(driver.name)}</div>}
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {photoBusy ? <Loader2 size={14} className="animate-spin text-white" /> : <Camera size={14} className="text-white" />}
                </div>
              </button>
            )}
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <div>
              <h2 className="font-bold text-dark-50">
                {isNew ? t('drv.new') : driver.name}
              </h2>
              {driver?.center && !editing && (
                <p className="text-xs text-dark-500 flex items-center gap-1 mt-0.5"><MapPin size={10} />{driver.center}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && !editing && !deBaja && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg bg-dark-800 px-3 py-1.5 text-xs font-semibold text-dark-200 hover:bg-dark-700 transition-colors"
              >
                <Pencil size={12} /> {t('ui.edit')}
              </button>
            )}
            {/* «Dar de baja» y no «Eliminar» (11-11-2026, equipo-6): no se borra nada y se puede reactivar. */}
            {!isNew && !deBaja && (
              <button
                onClick={() => onDelete(driver)}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 p-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors sm:px-2.5"
                title="Dar de baja" aria-label="Dar de baja"
              >
                <UserMinus size={14} /> <span className="hidden sm:inline">Dar de baja</span>
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-dark-400 hover:bg-dark-800 hover:text-dark-200 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Vista detalle ── */}
          {!editing && driver && (
            <div className="p-6">
              {deBaja && (
                <div data-testid="ficha-de-baja" className="mb-5 rounded-xl border border-dark-700 bg-dark-800/50 px-4 py-3">
                  <p className="text-sm font-semibold text-dark-100">Ficha dada de baja · {bajaTexto(driver)}{driver.baja_por ? ` (por ${driver.baja_por})` : ''}</p>
                  <p className="mt-1 text-xs text-dark-400">
                    No sale en las listas ni puede entrar en la app. Al reactivarla vuelve con sus inspecciones, turnos e historial.
                  </p>
                  <button type="button" onClick={handleReactivar} disabled={reBusy}
                    className="mt-3 flex min-h-[44px] items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-bold text-brand-tinta disabled:opacity-50 sm:min-h-0 sm:py-2">
                    {reBusy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reactivar
                  </button>
                  {reErr && <p className="mt-2 text-xs text-red-400">{reErr}</p>}
                </div>
              )}
              {/* Tags */}
              {(cc || nc) && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {cc && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cc}`}>{cl}</span>}
                  {nc && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${nc}`}>{nl}</span>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <Detail icon={IdCard}    label="DNI / NIE"        value={driver.dni} />
                <Detail icon={Phone}     label="Teléfono"         value={driver.phone} />
                <Detail icon={Phone}     label="Móvil personal"   value={driver.movil_personal} />
                <Detail icon={Mail}      label="Email"            value={driver.email} span={2} />
                <Detail icon={Car}       label="Nº carnet"        value={driver.license_number} />
                <CaducaCarnet fecha={driver.license_expiry} />
                {appInfo && <LineaApp info={appInfo.conductores?.[driver.id]} ultima={appInfo.ultima} />}
                <Detail icon={FileText}  label="Nº de empleado"   value={driver.driver_id} mono />
                <Detail icon={IdCard}    label="ID de reparto"    value={driver.transporter_id} mono />
                <Detail icon={MapPin}    label="Centro"           value={driver.center} />
                <Detail icon={Building2} label="Alojamiento"      value={driver.alojamiento} />
                {driver.notas && (
                  <div className="col-span-2 rounded-xl bg-dark-800/60 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Notas</div>
                    <p className="text-sm text-dark-200 whitespace-pre-wrap">{driver.notas}</p>
                  </div>
                )}
              </div>

              {!deBaja && <CambioCentro driver={driver} centers={centers} onCambio={onAccountChange} />}
              <HistorialCentros historial={driver.historial_centros} />

              {!deBaja && <div className="mt-6 rounded-xl border border-dark-800 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-dark-100">Correo personal de acceso</h3>
                    <p className="mt-1 text-xs text-dark-500">
                      Confirma esta dirección con el conductor por un canal fiable: quien verifique este correo podrá entrar en su ficha. El correo de empresa seguirá identificándola.
                    </p>
                  </div>
                  {recoveryStatus?.vinculado && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-400">Verificado</span>}
                </div>
                {recoveryStatus?.email && <p className="mt-3 text-sm text-dark-200">{recoveryStatus.email}</p>}
                {recoveryStatus?.pendiente && <p className="mt-3 text-xs text-amber-300">Pendiente de confirmar: {recoveryStatus.pendiente}</p>}
                <form onSubmit={handleSetRecoveryEmail} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input className="input min-w-0 flex-1" type="email" required value={recoveryValue}
                    onChange={e => setRecoveryValue(e.target.value)}
                    placeholder="correo.personal@gmail.com" autoComplete="email" />
                  <button type="submit" disabled={recoveryBusy || !recoveryValue.trim()}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-brand-tinta disabled:opacity-50">
                    {recoveryBusy ? 'Enviando…' : recoveryStatus?.vinculado ? 'Cambiar correo' : 'Enviar verificación'}
                  </button>
                </form>
                {recoveryStatus?.vinculado && <button type="button" onClick={handleRemoveRecoveryEmail} disabled={recoveryBusy}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 disabled:opacity-50">Desvincular correo personal</button>}
                {recoveryMessage && <p className="mt-2 text-xs text-emerald-400">{recoveryMessage}</p>}
                {recoveryError && <p className="mt-2 text-xs text-red-400">{recoveryError}</p>}
              </div>}

              {/* ── Acceso con contraseña ── */}
              {driver.email && !deBaja && (
                <div className="mt-6 rounded-xl border border-dark-800 overflow-hidden">
                  <button
                    onClick={() => { setPwSection(v => !v); setPwErr(''); setPwOk('') }}
                    className="flex w-full items-center justify-between px-4 py-3 hover:bg-dark-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {hasAccount
                        ? <ShieldCheck size={15} className="text-emerald-400" />
                        : <LockOpen size={15} className="text-dark-500" />}
                      <span className="text-sm font-semibold text-dark-200">Acceso con contraseña</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${hasAccount ? 'bg-emerald-500/15 text-emerald-400' : 'bg-dark-800 text-dark-300'}`}>
                        {hasAccount ? 'Activado' : 'Sin contraseña'}
                      </span>
                    </div>
                    <span className="text-xs text-dark-500">{pwSection ? '▲' : '▼'}</span>
                  </button>

                  {pwSection && (
                    <div className="border-t border-dark-800 px-4 py-4 space-y-3 bg-dark-950/40">
                      <p className="text-xs text-dark-500">
                        {hasAccount
                          ? 'El conductor debe introducir su email y contraseña para acceder al portal. Puedes cambiarla o eliminarla aquí.'
                          : 'Sin contraseña propia, el conductor entra con un código que le llega a su correo o con la contraseña inicial de la empresa, si está definida (y la app le obliga a elegir la suya). Aquí puedes ponerle una temporal.'}
                      </p>

                      {hasAccount && (
                        <button
                          onClick={handleRemovePassword}
                          disabled={pwBusy}
                          className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <LockOpen size={12} /> Quitar contraseña
                        </button>
                      )}

                      <div>
                        <Label>{hasAccount ? 'Nueva contraseña' : 'Establecer contraseña'}</Label>
                        <div className="relative">
                          <input
                            type={pwShow ? 'text' : 'password'}
                            className="input w-full pr-10"
                            value={pwValue}
                            onChange={e => setPwValue(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                            autoComplete="new-password"
                          />
                          <button type="button" onClick={() => setPwShow(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300">
                            {pwShow ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label>Confirmar contraseña</Label>
                        <input
                          type={pwShow ? 'text' : 'password'}
                          className="input w-full"
                          value={pwConfirm}
                          onChange={e => setPwConfirm(e.target.value)}
                          placeholder="Repite la contraseña"
                          autoComplete="new-password"
                        />
                      </div>

                      {pwErr && <p className="text-xs text-red-400">{pwErr}</p>}
                      {pwOk  && <p className="text-xs text-emerald-400">{pwOk}</p>}

                      <button
                        onClick={handleSetPassword}
                        disabled={pwBusy || !pwValue || !pwConfirm}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-brand-tinta hover:bg-brand-600 disabled:opacity-50 transition-colors"
                      >
                        {pwBusy ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                        {hasAccount ? 'Cambiar contraseña' : 'Guardar contraseña'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Formulario ── */}
          {editing && (
            <form id="driver-form" onSubmit={submit} className="p-6">
              {err && <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{err}</p>}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nombre completo *</Label>
                  <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre Apellido" autoFocus />
                </div>

                <div>
                  <Label>Centro</Label>
                  <select className="select w-full" value={form.center || ''} onChange={e => set('center', e.target.value)}>
                    <option value="">— Sin asignar —</option>
                    {centers.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {!form.center && centers.length > 1 && (
                    <p className="mt-1 text-[11px] leading-snug text-amber-300">
                      Sin centro sale en la lista de todos los centros, marcada. Mejor elige el suyo.
                    </p>
                  )}
                  {/* El cambio desde aquí queda apuntado (11-11-2026, equipo-8): solo se dice si ya tenía nave. */}
                  {!isNew && String(driver?.center || '').trim()
                    && String(form.center || '').trim().toUpperCase() !== String(driver.center).trim().toUpperCase() && (
                    <p data-testid="aviso-cambio-centro" className="mt-1 text-[11px] leading-snug text-dark-500">
                      Se apunta en su historial de centros. Para que cambie un día concreto, usa «Cambio de centro».
                    </p>
                  )}
                </div>

                <div>
                  <Label>Alojamiento</Label>
                  <input className="input w-full" value={form.alojamiento || ''} onChange={e => set('alojamiento', e.target.value)} placeholder="Nombre del alojamiento" />
                </div>

                <div>
                  <Label>Tipo de contrato</Label>
                  <select className="select w-full" value={form.contrato || ''} onChange={e => set('contrato', e.target.value)}>
                    <option value="">—</option>
                    <option value="empresa">Empresa</option>
                    <option value="ett">ETT</option>
                  </select>
                </div>

                <div>
                  <Label>Nivel</Label>
                  <select className="select w-full" value={form.nivel || ''} onChange={e => set('nivel', e.target.value)}>
                    <option value="">—</option>
                    <option value="pleno">Pleno</option>
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                  </select>
                </div>

                <div>
                  <Label>DNI / NIE</Label>
                  <input className="input w-full" value={form.dni || ''} onChange={e => set('dni', e.target.value)} placeholder="12345678A o X1234567A" />
                </div>

                <div>
                  <Label>Teléfono</Label>
                  <input className="input w-full" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+34 600 000 000" />
                </div>

                {/* El teléfono de arriba puede ser el de empresa, que cambia de
                    mano. Este es el suyo: si escribe por WhatsApp desde aquí, se
                    le reconoce igual. */}
                <div>
                  <Label>Móvil personal</Label>
                  <input className="input w-full" value={form.movil_personal || ''} onChange={e => set('movil_personal', e.target.value)} placeholder="+34 600 000 000" />
                  <p className="mt-1 text-[11px] leading-snug text-dark-500">
                    Si es distinto del de empresa. Sirve para reconocerle cuando escribe por WhatsApp.
                  </p>
                </div>

                <div className="col-span-2">
                  <Label>Email</Label>
                  <input className="input w-full" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="conductor@email.com" />
                </div>

                <div>
                  <Label>Nº carnet conducir</Label>
                  <input className="input w-full" value={form.license_number || ''} onChange={e => set('license_number', e.target.value)} />
                </div>

                {/* La caducidad del carnet (11-11-2026, historia-10): avisa en la ficha y en Vencimientos → Carnets. */}
                <div>
                  <Label>Carnet caduca el</Label>
                  <input className="input w-full" type="date" aria-label="Carnet caduca el" value={form.license_expiry || ''}
                    onChange={e => set('license_expiry', e.target.value)} />
                </div>

                <div>
                  <Label>Nº de empleado</Label>
                  <input className="input w-full font-mono" value={form.driver_id || ''} onChange={e => set('driver_id', e.target.value)} placeholder="Opcional" />
                </div>

                {conIdReparto && (
                  <div>
                    <Label>ID de reparto</Label>
                    <input className="input w-full font-mono uppercase" value={form.transporter_id || ''}
                      onChange={e => set('transporter_id', e.target.value.replace(/\s+/g, '').toUpperCase())}
                      placeholder="A2S2HK9FC8JOUX" />
                    <p className="mt-1 text-[11px] leading-snug text-dark-500">
                      El de los informes diarios. Con él, cada conductor ve en su portal los informes que le tocan: comprueba que es el suyo.
                    </p>
                  </div>
                )}


                <div className="col-span-2">
                  <Label>Notas internas</Label>
                  <textarea className="input w-full resize-none" rows={3} value={form.notas || ''} onChange={e => set('notas', e.target.value)} placeholder="Observaciones, preferencias, información adicional…" />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {editing && (
          <div className="flex items-center justify-between border-t border-dark-800 px-6 py-4">
            <button type="button" onClick={cancel} className="rounded-lg bg-dark-800 px-4 py-2 text-sm font-semibold text-dark-300 hover:bg-dark-700 transition-colors">
              {t('ui.cancel')}
            </button>
            <button
              type="submit"
              form="driver-form"
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-brand-tinta shadow-lg shadow-brand-500/25 hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {busy ? t('ui.saving') : t('ui.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* CAMBIO DE CENTRO PROGRAMADO: la ficha pasa a otro centro un día concreto y
   lo cambia el servidor ese día (Fran Gil, de DGA1 a OGA5 el 05-10-2026). Así
   sigue en las listas de su centro mientras trabaja allí y nadie tiene que
   acordarse. Si el día ya ha llegado, se cambia en el acto. */
const fechaCorta = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
const mananaIso = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function CambioCentro({ driver, centers, onCambio }) {
  const [traslado, setTraslado] = useState(driver.traslado || null)
  const [centroActual, setCentroActual] = useState(driver.center || '')
  const [abierto, setAbierto] = useState(false)
  const otros = lista(centers).filter((c) => c && c !== 'Todos' && c.toUpperCase() !== String(centroActual).toUpperCase())
  const [centro, setCentro] = useState('')
  const [desde, setDesde] = useState(mananaIso)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [aviso, setAviso] = useState('')
  if (!traslado && !otros.length) return null
  const elegido = centro || otros[0] || ''

  const programar = async () => {
    setBusy(true); setErr(''); setAviso('')
    try {
      const r = await programarTraslado(driver.id, elegido, desde)
      if (r.data?.aplicado) {
        setCentroActual(elegido); setTraslado(null)
        setAviso(`Cambiado: ya está en ${elegido}.`)
      } else {
        setTraslado(r.data?.traslado || { centro: elegido, desde })
        setAviso('')
      }
      setAbierto(false)
      onCambio?.()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido programar.')
    } finally { setBusy(false) }
  }
  const cancelar = async () => {
    setBusy(true); setErr('')
    try {
      await cancelarTraslado(driver.id)
      setTraslado(null); setAviso('Cambio de centro cancelado.')
      onCambio?.()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido cancelar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-6 rounded-xl border border-dark-800 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <ArrowRightLeft size={15} className="text-sky-300" />
        <span className="text-sm font-semibold text-dark-200">Cambio de centro</span>
        {traslado ? (
          <>
            <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
              Pasa a {traslado.centro} el {fechaCorta(traslado.desde)}
            </span>
            <button onClick={cancelar} disabled={busy}
              className="ml-auto text-xs font-semibold text-red-300 hover:text-red-200 disabled:opacity-40">Cancelar</button>
          </>
        ) : !abierto && (
          <button onClick={() => setAbierto(true)}
            className="ml-auto text-xs font-semibold text-brand-400 hover:text-brand-300">Programar…</button>
        )}
      </div>
      {traslado && (
        <p className="mt-1 text-xs text-dark-500">
          Hasta ese día sigue en {centroActual || 'su centro'}; ese día la ficha cambia sola
          {traslado.por ? ` (lo programó ${traslado.por})` : ''}.
        </p>
      )}
      {!traslado && abierto && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-dark-400">Pasa a
            <select value={elegido} onChange={(e) => setCentro(e.target.value)} aria-label="Centro al que pasa"
              className="input py-1.5 text-sm">
              {otros.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-dark-400">Desde el día
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Día del cambio"
              className="input py-1.5 text-sm" />
          </label>
          <button onClick={programar} disabled={busy || !elegido || !desde}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-40">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />} Programar
          </button>
          <button onClick={() => setAbierto(false)} className="px-2 py-2 text-xs text-dark-400 hover:text-dark-200">Cerrar</button>
        </div>
      )}
      {aviso && <p className="mt-2 text-xs text-emerald-300">{aviso}</p>}
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </div>
  )
}

/* HISTORIAL DE CENTRO (11-11-2026, tanda 3, equipo-8): de qué nave a qué nave ha pasado y cuándo, lo más nuevo
   primero. Lo apuntan el cambio programado y, desde ahora, «Editar». Sin entradas (o con un servidor viejo, que no lo
   manda) no sale nada. */
function HistorialCentros({ historial }) {
  const [todas, setTodas] = useState(false)
  const filas = lista(historial).filter((h) => h && typeof h === 'object')
    .sort((a, b) => String(b.aplicado_en || b.desde || '').localeCompare(String(a.aplicado_en || a.desde || '')))
  if (!filas.length) return null
  const vistas = todas ? filas : filas.slice(0, 5)
  return (
    <div data-testid="historial-centros" className="mt-3 rounded-xl border border-dark-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <ArrowRightLeft size={15} className="text-dark-500" />
        <span className="text-sm font-semibold text-dark-200">Historial de centro</span>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-dark-400">
        {vistas.map((h, i) => (
          <li key={`${h.aplicado_en || h.desde || ''}-${i}`}>
            <span className="font-semibold text-dark-200">{h.de || 'sin centro'} → {h.a || 'sin centro'}</span>
            {h.desde && <> el {fechaCorta(String(h.desde).slice(0, 10))}</>}
            {h.programado_por && (h.como === 'ficha'
              ? ` · cambiado en la ficha por ${h.programado_por}`
              : ` · programado por ${h.programado_por}`)}
          </li>
        ))}
      </ul>
      {filas.length > 5 && (
        <button type="button" onClick={() => setTodas((v) => !v)}
          className="mt-1 text-xs font-semibold text-brand-400 hover:text-brand-300">
          {todas ? 'Ver menos' : `Ver más (${filas.length - 5})`}
        </button>
      )}
    </div>
  )
}

/* «Carnet caduca» en la ficha (11-11-2026, historia-10): rojo si ya caducó, ámbar si caduca en 30 días o menos. */
function CaducaCarnet({ fecha }) {
  const n = diasHastaCarnet(fecha)
  if (n === null) return null
  const color = n < 0 ? 'text-red-300' : n <= DIAS_AVISO_CARNET ? 'text-amber-300' : 'text-dark-100'
  return (
    <div data-testid="carnet-caduca">
      <div className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Carnet caduca</div>
      <div className={`flex flex-wrap items-center gap-x-2 text-sm font-medium ${color}`}>
        <Car size={13} className="shrink-0 text-dark-500" />
        <span className="cifra">{fechaCarnet(fecha)}</span>
        {n <= DIAS_AVISO_CARNET && <span className="text-xs font-semibold">· {textoDiasCarnet(n)}</span>}
      </div>
    </div>
  )
}

/* La versión de la app y cuándo se abrió, en ámbar si hay una más nueva publicada (11-11-2026, equipo-5). */
function LineaApp({ info, ultima }) {
  const vieja = info && versionMenor(info.app, ultima)
  return (
    <div data-testid="linea-app" className="col-span-2">
      <div className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">App de Android</div>
      <div className={`flex items-center gap-2 text-sm font-medium ${!info ? 'text-dark-400' : vieja ? 'text-amber-300' : 'text-dark-100'}`}>
        <Smartphone size={13} className="shrink-0 text-dark-500" />
        {info
          ? `App ${MARCA.nombre} ${info.app || ''}${diaApp(info.visto) ? ` · abierta el ${diaApp(info.visto)}` : ''}${vieja ? ` · hay una más nueva (${ultima})` : ''}`
          : 'No tiene la app abierta en ningún Android'}
      </div>
    </div>
  )
}

function CeldaApp({ info, ultima }) {
  if (!info) return <span className="text-dark-700">—</span>
  const vieja = versionMenor(info.app, ultima)
  return (
    <span data-testid="celda-app" title={vieja ? `Hay una versión más nueva: ${ultima}` : undefined}
      className={`cifra text-[12px] ${vieja ? 'text-amber-300' : 'text-dark-400'}`}>
      {info.app || '¿?'}{cuandoApp(info.visto) ? ` · ${cuandoApp(info.visto)}` : ''}
    </span>
  )
}

function Detail({ icon: Icon, label, value, span = 1, mono }) {
  if (!value) return null
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <div className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">{label}</div>
      <div className={`flex items-center gap-2 ${mono ? 'font-mono text-sm text-dark-300' : 'text-sm font-medium text-dark-100'}`}>
        <Icon size={13} className="shrink-0 text-dark-500" />
        {value}
      </div>
    </div>
  )
}

function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-medium text-dark-400">{children}</label>
}
