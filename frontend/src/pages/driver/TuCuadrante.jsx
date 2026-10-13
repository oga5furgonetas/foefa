import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, Clock3, RefreshCw, Sparkles } from 'lucide-react'
import { getMyShifts } from '../../services/api'
import { lista } from '../../lib/lista'

const ESTILO = {
  trabaja: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  extra: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  libre: 'border-dark-700 bg-dark-800/70 text-dark-300',
  previsto: 'border-violet-400/40 bg-violet-400/15 text-violet-200',
  aprobado: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
  aviso: 'border-rose-400/40 bg-rose-400/15 text-rose-200',
}

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function TuCuadrante({ onBack }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const cargar = useCallback(async () => {
    setError('')
    try {
      const r = await getMyShifts()
      setDatos({ periodo: r.data?.cuadrante || null, turnos: lista(r.data?.shifts) })
    } catch {
      setError('No se pudo cargar tu cuadrante. Comprueba la conexión e inténtalo de nuevo.')
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const filas = useMemo(() => {
    if (!datos?.periodo?.desde || !datos?.periodo?.hasta) return []
    const porFecha = new Map(datos.turnos.map((s) => [s.date, s]))
    const inicio = new Date(`${datos.periodo.desde}T12:00:00`)
    const fin = new Date(`${datos.periodo.hasta}T12:00:00`)
    const out = []
    for (const d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      out.push({ fecha, turno: porFecha.get(fecha) || null })
    }
    return out
  }, [datos])

  const fechaBonita = (f, opciones) => new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', opciones)
  const titulo = (datos?.periodo?.desde && datos?.periodo?.hasta)
    ? `${fechaBonita(datos.periodo.desde, { day: 'numeric', month: 'long' })} – ${fechaBonita(datos.periodo.hasta, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : ''
  const huecos = filas.length ? (new Date(`${filas[0].fecha}T12:00:00`).getDay() + 6) % 7 : 0
  const resumen = filas.reduce((acc, { turno }) => {
    if (turno?.type === 'trabaja') acc.trabaja += 1
    if (turno?.type === 'libre') acc.libre += 1
    if (turno?.type === 'extra') acc.extra += 1
    return acc
  }, { trabaja: 0, libre: 0, extra: 0 })

  return (
    <main className="min-h-screen bg-dark-950 pb-10">
      <header className="sticky top-0 z-40 border-b border-dark-800/70 bg-dark-950/95 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={onBack} className="btn-ghost p-1.5" aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-bold text-dark-50">
              <CalendarDays size={17} className="text-brand-300" /> Tu cuadrante
            </h1>
            {titulo && <p className="mt-0.5 text-xs capitalize text-dark-400">{titulo}</p>}
          </div>
          <button onClick={cargar} className="btn-ghost ml-auto p-2" aria-label="Actualizar cuadrante">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-5">
        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        {!datos && !error && <div className="flex items-center gap-2 py-8 text-dark-400"><RefreshCw className="animate-spin" size={18} /> Cargando tu cuadrante…</div>}
        {datos && !datos.periodo && (
          <div className="rounded-2xl border border-dark-800 bg-dark-900/60 px-5 py-8 text-center">
            <CalendarDays className="mx-auto mb-3 text-dark-400" size={28} />
            <p className="text-sm font-medium text-dark-200">Todavía no hay un cuadrante publicado para ti.</p>
            <p className="mt-1 text-xs text-dark-400">Cuando esté disponible, aparecerá aquí.</p>
          </div>
        )}
        {datos?.periodo && <>
          <div className="relative overflow-hidden rounded-2xl border border-brand-400/20 bg-dark-900/70 p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-400/10 blur-3xl" />
            <div className="relative flex items-start gap-3">
              <div className="rounded-xl border border-brand-400/25 bg-brand-400/10 p-2.5 text-brand-300"><CalendarDays size={20} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-dark-50">Tu planificación</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200"><Check size={11} /> Publicada</span>
                </div>
                <p className="mt-1 text-sm capitalize text-dark-300">{titulo}</p>
              </div>
              <Sparkles className="mt-1 hidden text-brand-300/70 sm:block" size={17} />
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-dark-700/70 pt-3">
              <div className="rounded-xl bg-sky-400/10 px-3 py-2"><p className="text-lg font-bold tabular-nums text-sky-200">{resumen.trabaja}</p><p className="text-[11px] text-dark-400">Días de trabajo</p></div>
              <div className="rounded-xl bg-dark-800/60 px-3 py-2"><p className="text-lg font-bold tabular-nums text-dark-200">{resumen.libre}</p><p className="text-[11px] text-dark-400">Días libres</p></div>
              <div className="rounded-xl bg-emerald-400/10 px-3 py-2"><p className="text-lg font-bold tabular-nums text-emerald-200">{resumen.extra}</p><p className="text-[11px] text-dark-400">Extras</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-dark-800 bg-dark-900/45 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <div><h2 className="text-sm font-semibold capitalize text-dark-100">{fechaBonita(datos.periodo.desde, { month: 'long', year: 'numeric' })}</h2><p className="mt-0.5 text-[11px] text-dark-400">Tus turnos de cada día</p></div>
              <Clock3 size={17} className="text-dark-400" />
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={`Cuadrante de ${titulo}`}>
              {DIAS.map((dia, i) => <div key={dia} className={`pb-1 text-center text-[10px] font-bold uppercase tracking-wide ${i > 4 ? 'text-brand-300/80' : 'text-dark-400'}`}>{dia}</div>)}
              {Array.from({ length: huecos }, (_, i) => <div key={`hueco-${i}`} aria-hidden="true" />)}
              {filas.map(({ fecha, turno }) => {
                const tipo = turno?.type
                const cod = turno?.cod || (tipo === 'trabaja' ? 'Trabaja' : tipo === 'libre' ? 'Libre' : tipo === 'extra' ? 'Extra' : '')
                const clase = ESTILO[tipo] || 'border-dark-700/80 bg-dark-800/40 text-dark-400'
                const dia = new Date(`${fecha}T12:00:00`).getDate()
                const finDeSemana = [0, 6].includes(new Date(`${fecha}T12:00:00`).getDay())
                return (
                  <div key={fecha} aria-label={`${fechaBonita(fecha, { weekday: 'long', day: 'numeric', month: 'long' })}: ${cod || 'Sin dato'}`} title={`${fechaBonita(fecha, { weekday: 'long', day: 'numeric', month: 'long' })}${cod ? ` · ${cod}` : ' · Sin dato'}${turno?.hora ? ` · ${turno.hora}` : ''}`} className={`flex min-h-[62px] flex-col items-center justify-center rounded-xl border px-0.5 py-1 sm:min-h-[76px] sm:rounded-2xl ${clase} ${finDeSemana ? 'ring-1 ring-inset ring-brand-400/10' : ''}`}>
                    <span className="text-[10px] font-medium opacity-75 sm:text-[11px]">{dia}</span>
                    <span className="mt-1 max-w-full truncate px-0.5 text-[10px] font-bold leading-tight sm:text-xs">{cod || '—'}</span>
                    {turno?.hora && <span className="mt-1 text-[9px] opacity-75 sm:text-[10px]">{turno.hora}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11px] text-dark-400" aria-label="Leyenda de turnos">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-sky-300" /> Trabajo</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-dark-500" /> Libre</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-300" /> Extra</span>
            <span className="text-dark-500">— Sin dato: el archivo no indica turno para ese día.</span>
          </div>
        </>}
      </section>
    </main>
  )
}
