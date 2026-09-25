import { useEffect, useState } from 'react'
import { Loader2, Target, TrendingUp, Info } from 'lucide-react'
import { getScorecardHoy } from '../api'

/* ── TU SCORECARD ESTA SEMANA, DIA A DIA ─────────────────────────────────────
   «Hoy es lunes, vas bien en esto y esto; tienes 99,54 % de DCR y ya tienes los
   puntos de DCR... el miércoles: ahora estás en Fair, pero si consigues X en
   cada cosa eres Fantastic.» (Dani, 21-09-2026)

   Sale de `/scorecard/hoy`, que suma lo que llega cada día: el DCR de Cortex,
   los defectos DSC de los reportes y las horas fichadas. SOLO eso puntúa como
   «medido». Lo que no llega a diario (FICO, mentor, VSA, CC...) sale aparte como
   REFERENCIA de la última scorecard, con su semana, y solo alimenta una
   PROYECCIÓN que se dice como lo que es: un supuesto, con su margen de error.
   Nada de esto se calcula aquí: el servidor manda los puntos y el cliente los
   pinta (gotcha 54). */

const TIER_CLS = {
  'Fantastic Plus': 'bg-emerald-500/15 text-emerald-300',
  Fantastic: 'bg-emerald-500/15 text-emerald-300',
  Great: 'bg-sky-500/15 text-sky-300',
  Fair: 'bg-amber-500/15 text-amber-300',
  Poor: 'bg-red-500/15 text-red-300',
}
const BARRA_CLS = {
  'Fantastic Plus': 'bg-emerald-400', Fantastic: 'bg-emerald-400', Great: 'bg-sky-400',
  Fair: 'bg-amber-400', Poor: 'bg-red-400',
}

/* Por qué no hay dato, en lenguaje de oficina. */
const SIN_DATO = {
  dcr: 'Hace falta al menos un día cerrado con paquetes de Cortex.',
  dsc_dpmo: 'Amazon clasifica los defectos 2-4 días tarde: un día reciente sin ninguno no cuenta como perfecto.',
  whc: 'Se lee del plan de horas que llega de Cortex.',
}

const fmt = (v, unit) => {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (unit === 'DPMO') return `${Math.round(n)} DPMO`
  if (unit === '%') return `${n.toFixed(2).replace('.', ',')} %`
  return String(Number(n.toFixed(2))).replace('.', ',')
}
const pts = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(1).replace('.', ','))
const fechaCorta = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return y ? new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : iso
}

function Tier({ t }) {
  if (!t) return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-dark-800 text-dark-400">sin dato</span>
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TIER_CLS[t] || 'bg-dark-800 text-dark-300'}`}>{t}</span>
}

export default function ScorecardHoy({ center }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [cargando, setCargando] = useState(false)
  const sinCentro = !center || center === 'Todos'

  useEffect(() => {
    if (sinCentro) { setD(null); setErr(''); return undefined }
    let vivo = true
    const cargar = () => {
      if (!vivo || document.hidden) return
      setCargando(true)
      getScorecardHoy(center)
        .then((r) => {
          if (!vivo) return
          // Una respuesta que no tiene la forma esperada (un servidor viejo, un
          // fallo a medias) NO puede tumbar el panel entero: se trata como error.
          const x = r.data
          if (x && x.semana && Array.isArray(x.metricas) && x.nota && Array.isArray(x.titulares)
              && Array.isArray(x.sin_dato)) { setD(x); setErr('') }
          else setErr('La scorecard de la semana ha devuelto algo que no entiendo.')
        })
        .catch((e) => { if (vivo) setErr(e?.response?.data?.detail || 'No se ha podido calcular la scorecard de la semana.') })
        .finally(() => { if (vivo) setCargando(false) })
    }
    cargar()
    const id = setInterval(cargar, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', cargar)
    return () => { vivo = false; clearInterval(id); document.removeEventListener('visibilitychange', cargar) }
  }, [center, sinCentro])

  const titulo = (
    <h2 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-dark-500">
      <Target size={12} /> Tu scorecard esta semana
      {d && <span className="font-normal normal-case tracking-normal text-dark-500">
        · semana {d.semana.numero} ({fechaCorta(d.semana.domingo)} – {fechaCorta(d.semana.sabado)}) · día {d.dia_semana} de 7
      </span>}
      {cargando && <Loader2 size={11} className="animate-spin" />}
    </h2>
  )

  if (sinCentro) {
    return (
      <section className="rise border-t border-white/[0.05] py-7">
        {titulo}
        <p className="mt-3 text-[12.5px] text-dark-400">Elige una nave arriba para ver cómo va su scorecard esta semana.</p>
      </section>
    )
  }
  if (err && !d) {
    return (
      <section className="rise border-t border-white/[0.05] py-7">
        {titulo}
        <p className="mt-3 text-[12.5px] text-dark-400">{err}</p>
      </section>
    )
  }
  if (!d) return null

  const n = d.nota
  const pr = d.proyeccion
  const esc = d.escenarios || {}
  const sig = esc.siguiente
  // LO MEDIDO y LA REFERENCIA van en listas distintas: lo segundo no es de
  // esta semana y no puede parecerlo (el CC de hace nueve semanas puntuaba
  // como si fuera de hoy).
  const medidas = d.metricas.filter((m) => m.valor !== null).sort((a, b) => b.peso - a.peso)
  const referencias = d.metricas.filter((m) => m.valor === null && m.ref).sort((a, b) => b.peso - a.peso)
  const sinDato = d.sin_dato.filter((s) => !s.referencia)
  const semRef = pr && pr.semanas_referencia && pr.semanas_referencia.length
    ? pr.semanas_referencia[pr.semanas_referencia.length - 1] : null

  return (
    <section className="rise border-t border-white/[0.05] py-7" style={{ animationDelay: '30ms' }}>
      {titulo}

      {/* LO MEDIDO ESTA SEMANA. Solo DCR, DSC y horas llegan cada día: eso es lo
          que puntúa. El resto se enseña abajo como referencia, sin mezclar. */}
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-[11px] text-dark-500">Medido esta semana</div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="cifra text-[24px] font-semibold text-dark-50">{pts(n.puntos)}</span>
            <span className="cifra text-[13px] text-dark-400">de {pts(n.puntos_posibles)} pts posibles</span>
          </div>
          <div className="text-[11px] text-dark-500">
            {n.cobertura_medida_hoy} % del peso de la scorecard
          </div>
        </div>
        {pr && (
          <div>
            <div className="text-[11px] text-dark-500">Proyección</div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[22px] font-semibold text-dark-50">
                {pr.tier_min === pr.tier_max ? pr.tier : `entre ${pr.tier_min} y ${pr.tier_max}`}
              </span>
              <span className="cifra text-[13px] text-dark-400">~{pts(pr.score)} ± {pts(pr.margen)} pts</span>
            </div>
            <div className="max-w-[46ch] text-[11px] text-dark-500">
              {pr.supuesto ? `Suponiendo que ${pr.supuesto}.` : 'Con casi todo medido.'}
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 max-w-[80ch] text-[12px] leading-relaxed text-dark-400">
        {d.dias_cerrados === 0 ? 'Todavía no hay ningún día cerrado.'
          : `${d.dias_cerrados} ${d.dias_cerrados === 1 ? 'día cerrado' : 'días cerrados'} de 7`}
        {d.confianza === 'baja' && ': con tan pocos días, un mal reparto mueve mucho la nota.'}
        {!pr && ' Sin una scorecard tuya de referencia no proyecto una nota: se enseña solo lo medido.'}
      </p>

      {d.titulares.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {d.titulares.map((t) => (
            <li key={t.key} className="flex items-start gap-2 text-[12.5px] leading-snug text-dark-200">
              <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${BARRA_CLS[t.tier] || 'bg-dark-500'}`} />
              {t.texto}
            </li>
          ))}
        </ul>
      )}

      {/* CADA RAMA: valor, tier y los puntos que lleva de los que vale. */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
        {medidas.map((m) => {
          const pc = m.peso ? Math.max(0, Math.min(100, ((m.puntos || 0) / m.peso) * 100)) : 0
          return (
            <div key={m.key} className="grid grid-cols-[minmax(0,1.4fr)_auto] items-center gap-x-3 gap-y-1 border-t border-white/[0.05] px-3 py-2 first:border-0 sm:grid-cols-[minmax(0,1.6fr)_7rem_6rem_minmax(0,1.2fr)]">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] text-dark-100">{m.label}</div>
                <div className="text-[10.5px] text-dark-500">
                  medido esta semana{m.provisional ? ' · provisional' : ''}
                  {m.cota_alta !== null && m.cota_alta !== undefined && (
                    <> · Amazon: hasta {fmt(m.cota_alta, m.unit)}{m.tier_posible ? ` (${m.tier_posible})` : ''}</>
                  )}
                </div>
              </div>
              <div className="cifra text-right text-[12.5px] font-semibold text-dark-100 sm:text-left">{fmt(m.valor, m.unit)}</div>
              <div className="hidden sm:block"><Tier t={m.tier} /></div>
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-baseline justify-between text-[10.5px] text-dark-400">
                  <span className="sm:hidden"><Tier t={m.tier} /></span>
                  <span className="cifra ml-auto">{m.puntos === null ? '—' : pts(m.puntos)} / {pts(m.peso)} pts</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-dark-800">
                  <div className={`h-full rounded-full ${BARRA_CLS[m.tier] || 'bg-dark-600'}`} style={{ width: `${pc}%` }} />
                </div>
              </div>
            </div>
          )
        })}
        {medidas.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-dark-400">Todavía no hay nada medido esta semana.</div>
        )}
      </div>

      {/* LA REFERENCIA: lo que NO llega cada día. Es de la ultima scorecard, con
          su semana, y no puntua: solo alimenta la proyeccion. */}
      {referencias.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">
            Referencia · no se mide a diario, no cuenta como medido
          </div>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-dashed border-white/[0.08]">
            {referencias.map((m) => (
              <div key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-white/[0.05] px-3 py-1.5 text-[12px] first:border-0">
                <span className="min-w-0 flex-1 truncate text-dark-300">{m.label}</span>
                <span className="cifra text-dark-300">{fmt(m.ref.valor, m.unit)}</span>
                <Tier t={m.ref.tier} />
                <span className="text-[10.5px] text-dark-500">semana {m.ref.semana}</span>
                <span className="cifra w-24 text-right text-[10.5px] text-dark-500">~{pts(m.ref.puntos)} / {pts(m.peso)} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LO QUE NO TIENE NI DATO NI REFERENCIA, con el motivo. */}
      {sinDato.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sinDato.map((s) => (
            <span key={s.key} title={SIN_DATO[s.key] || 'No llega a diario y no hay ninguna scorecard tuya con este dato.'}
              className="rounded-lg bg-dark-800 px-2 py-1 text-[11px] text-dark-400">
              {s.label.replace(/\s*\(.*\)/, '')} · sin dato aún ({pts(s.peso)} pts)
            </span>
          ))}
        </div>
      )}

      {/* ¿QUE HACE FALTA? Solo sobre la PROYECCION, y diciendo que es un supuesto:
          «ahora estas en X» seria falso con el 37 % del peso a medir. */}
      {pr && (sig || esc.si_todo_fantastic) && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-dark-100">
            <TrendingUp size={13} className="text-brand-400" /> Qué necesitas para subir
          </div>
          {sig && (
            <div className="mt-2 text-[12.5px] leading-relaxed text-dark-300">
              {pr.supuesto ? 'Con ese supuesto' : 'Ahora mismo'} estás {pr.tier_min === pr.tier_max ? 'en' : 'alrededor de'} <Tier t={pr.tier} /> (~{pts(pr.score)} pts). Para <Tier t={sig.tier} /> (desde {sig.desde} pts) te
              faltan <b className="text-dark-100">{pts(sig.faltan)}</b> puntos de nota
              {sig.alcanzable_con_lo_medido ? '. Lo más rentable:' : ' y con una sola rama no basta: hay que mover varias.'}
            </div>
          )}
          {!sig && (
            <div className="mt-2 text-[12.5px] leading-relaxed text-dark-300">
              {pr.supuesto ? 'Con ese supuesto' : 'Ahora mismo'} estás en <Tier t={pr.tier} /> (~{pts(pr.score)} pts), que es el tier más alto:
              lo que toca es mantener lo que llevas.
            </div>
          )}
          {sig && (
            <ul className="mt-2 space-y-1">
              {(sig.plan.length ? sig.plan : sig.palancas.slice(0, 3)).map((p) => (
                <li key={p.key} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="text-dark-100">{p.label.replace(/\s*\(.*\)/, '')}</span>
                  <span className="cifra text-dark-400">{fmt(p.de, p.unit)} → {fmt(p.a, p.unit)} ({p.a_tier})</span>
                  <span className="cifra font-semibold text-emerald-300">+{pts(p.puntos)} pts</span>
                  {!p.medida && <span className="text-[10.5px] text-dark-500">referencia: hoy no se mide</span>}
                </li>
              ))}
            </ul>
          )}
          {esc.si_todo_fantastic && (
            <p className="mt-2 text-[12px] text-dark-400">
              Si todo lo que va por debajo llegara a su objetivo: <b className="text-dark-100">{pts(esc.si_todo_fantastic.score)} pts</b>{' '}
              (<Tier t={esc.si_todo_fantastic.tier} />).
            </p>
          )}
          {semRef !== null && (
            <p className="mt-1.5 text-[11px] text-dark-500">La referencia es de la semana {semRef}: si desde entonces algo ha cambiado, la proyección también.</p>
          )}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-dark-500">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          Es una estimación, no la nota de Amazon. El modelo se ha calibrado contra 86 scorecards reales: el error típico es de unos 3 puntos y el 84 % de las semanas queda dentro de ±5.
          {d.umbrales_de_tu_nave
            ? ` Umbrales de tu nave${d.umbrales_semana ? `, de su scorecard de la semana ${d.umbrales_semana}` : ''}${d.umbrales_publicados_en_codigo ? ' (Amazon los cambia por temporada: sube la última scorecard y se ajustan)' : ''}.`
            : ' Los umbrales no son todavía los de tu nave (sube una scorecard suya y se afinan).'}
          {d.ultima_oficial && ` Última oficial subida: semana ${d.ultima_oficial.week}, ${d.ultima_oficial.overall_tier} (${pts(d.ultima_oficial.overall_score)}).`}
        </span>
      </p>
    </section>
  )
}
