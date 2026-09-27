import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Loader2, Clock, AlertTriangle, CircleCheck, Info, ChevronDown, ChevronUp,
  Trash2, RefreshCw, Lock, CalendarX2,
} from 'lucide-react'
import { whcAnalizar, getWhcPlan, deleteWhcPlan, getWhcEstado } from '../api'
import { lista } from '../../lib/lista'
import { useOrden } from '../../lib/orden'
import ThOrden from '../components/ThOrden'
import { fechaHoraLocal } from '../../lib/fecha'

/* ── HORAS DE LA SEMANA (WHC) ────────────────────────────────────────────────
   Amazon dice quién se pasó de horas en el informe de excepciones, cuando la
   semana ya cerró. Aquí se ve con la semana abierta, pegando el plan del
   portal, y se sabe cuánto margen le queda a cada uno ANTES de que se pase.

   En Flota el plan entra PEGADO (copiar y pegar la programación de la semana):
   no hay extensión que lo lea sola. Es la pantalla de FlotaDSP sin la lectura
   automática.

   QUÉ AFIRMA Y QUÉ NO:
   · «Ya pasado» es solo lo CERRADO. El total del portal cuenta también el
     bloque en curso; quien va a media ruta sale aparte, «se pasa hoy si
     acaba», que es a quien todavía se le puede cortar el día.
   · Lo diario (bloques largos) es un AVISO de riesgo, nunca un incumplimiento:
     Amazon calcula la excepción diaria sobre lo FICHADO, que no viene en el plan.
   · El porcentaje de Amazon solo sale con su hoja de excepciones. Sin ella se
     dice «no se sabe», no un 100 % inventado. */

const hm = (m) => (m === null || m === undefined ? '—'
  : `${Math.floor(Math.abs(m) / 60)}h ${String(Math.abs(m) % 60).padStart(2, '0')}m`)
const signo = (m) => (m < 0 ? `−${hm(m)}` : hm(m))

/* EL LÍMITE NO SE ELIGE: 54 h 30 min a la semana, el mismo para todos los
   centros, o dos centros con la misma gente salen con resultados distintos. */
const LIMITE_H = 54.5

export default function Horas() {
  const { center } = useOutletContext()
  const [texto, setTexto] = useState('')
  /* VACÍA, no 0: quien no la toca no está afirmando «cero excepciones». */
  const [excepciones, setExcepciones] = useState('')
  const [estado, setEstado] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [err, setErr] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [guardado, setGuardado] = useState(null)
  const [editando, setEditando] = useState(false)

  const cargarEstado = useCallback(() => {
    getWhcEstado().then(({ data }) => setEstado(data)).catch(() => {})
  }, [])
  useEffect(cargarEstado, [cargarEstado])

  const analizar = useCallback(async (txt, exc) => {
    const cuerpo = txt ?? texto
    const e = exc ?? excepciones
    setCargando(true); setErr(''); setDatos(null)
    try {
      const r = await whcAnalizar({
        texto: cuerpo, limite_horas: LIMITE_H,
        ...(e === '' || e == null ? {} : { excepciones: Number(e) }),
        center,
      })
      setDatos(r.data)
      setEditando(false)
      if (r.data?.guardado) {
        setGuardado({ updated_at: new Date().toISOString() })
        cargarEstado()
      }
    } catch (x) {
      setErr(x?.response?.data?.detail || 'No se ha podido leer ese texto.')
    } finally { setCargando(false) }
  }, [texto, excepciones, center, cargarEstado])

  // Al entrar se recupera el plan de ESTA semana del centro y se analiza solo.
  useEffect(() => {
    let vivo = true
    setDatos(null); setGuardado(null); setTexto(''); setEditando(false)
    if (!center || center === 'Todos') return undefined
    getWhcPlan(center).then(({ data }) => {
      if (!vivo || !data?.hay || !data.texto) return
      setGuardado(data)
      setTexto(data.texto)
      const exc = data.excepciones == null ? '' : data.excepciones
      setExcepciones(exc)
      analizar(data.texto, exc)
    }).catch(() => {})
    return () => { vivo = false }
  }, [center]) // eslint-disable-line react-hooks/exhaustive-deps

  const borrar = async () => {
    if (!center || center === 'Todos') return
    if (!window.confirm(`¿Borrar el plan guardado de esta semana de ${center}?`)) return
    try { await deleteWhcPlan(center) } catch { /* se ve al recargar */ }
    setGuardado(null); setTexto(''); setDatos(null); setEditando(true); cargarEstado()
  }

  const { orden, pulsar, ordenar } = useOrden()
  const filas = useMemo(() => ordenar(lista(datos?.conductores)), [datos, ordenar])
  const r = datos?.resumen
  const propio = datos?.whc_propio
  const mostrarPegar = !guardado || editando || !datos

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        {center && center !== 'Todos' && (
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-brand-400/80">{center}</p>
        )}
        <h1 className="mt-1 font-display text-[clamp(26px,3vw,36px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">
          Horas de la semana
        </h1>
        <p className="mt-2 max-w-[70ch] text-[13px] text-dark-400">
          Cuántas horas lleva cada conductor con la semana todavía abierta, y quién se va a pasar
          de {LIMITE_H.toString().replace('.', ',')} h antes de que pase.
        </p>

        {estado?.naves?.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
            {estado.naves.map((n) => (
              <span key={n.centro}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 ring-1 ${
                  n.al_dia ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
                    : 'bg-amber-500/10 text-amber-300 ring-amber-500/25'}`}>
                {n.al_dia ? <CircleCheck size={12} /> : <CalendarX2 size={12} />}
                <b>{n.centro}</b>
                {n.al_dia ? `al día${n.conductores ? ` · ${n.conductores} conductores` : ''}`
                  : !n.semana ? 'sin plan todavía'
                  : n.semanas_atras === 1 ? 'el último es de la semana pasada'
                  : `el último es de hace ${n.semanas_atras} semanas`}
              </span>
            ))}
          </div>
        )}
        {estado?.como_se_arregla && (
          <p className="mt-2 max-w-[74ch] rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
            {estado.como_se_arregla}
          </p>
        )}
      </header>

      <section className="card p-4">
        {mostrarPegar && (
          <>
            <label htmlFor="horas-plan" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-dark-500">
              Pega aquí el plan de la semana
            </label>
            <textarea id="horas-plan" value={texto} onChange={(e) => setTexto(e.target.value)} rows={7}
              placeholder="En el portal, abre la programación de la semana del centro, Ctrl+A, Ctrl+C y pega aquí tal cual, con los bloques de cada conductor."
              className="w-full rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 font-mono text-xs text-dark-100 placeholder:text-dark-500" />
          </>
        )}
        <div className={`${mostrarPegar ? 'mt-3 ' : ''}flex flex-wrap items-center gap-3`}>
          <span className="flex items-center gap-1.5 rounded-lg bg-dark-800 px-2.5 py-1 text-xs text-dark-300">
            <Lock size={12} className="text-dark-500" />
            Límite semanal <span className="cifra font-semibold text-dark-100">54 h 30 min</span>
          </span>
          <label htmlFor="horas-excepciones" className="flex items-center gap-2 text-xs text-dark-400">
            Excepciones que marcó Amazon
            <input id="horas-excepciones" type="number" value={excepciones} min={0} max={200}
              placeholder="?"
              onChange={(e) => setExcepciones(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-16 rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-sm text-dark-100" />
          </label>
          {mostrarPegar ? (
            <button onClick={() => analizar()} disabled={cargando || texto.trim().length < 40}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
              Ver cómo vamos
            </button>
          ) : (
            <>
              <button onClick={() => analizar()} disabled={cargando}
                className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-3 py-2 text-xs text-dark-300 hover:bg-dark-800 disabled:opacity-40">
                {cargando ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />} Recalcular
              </button>
              <button onClick={() => { setEditando(true); setTexto('') }}
                className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-3 py-2 text-xs text-dark-300 hover:bg-dark-800">
                <RefreshCw size={13} /> Pegar uno nuevo
              </button>
              <button onClick={borrar}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">
                <Trash2 size={13} /> Borrar
              </button>
              <span className="text-[11px] text-dark-500">guardado {fechaHoraLocal(guardado.updated_at)}</span>
            </>
          )}
          {err && <span className="text-xs text-red-300">{err}</span>}
        </div>
        {center === 'Todos' && mostrarPegar && (
          <p className="mt-2 text-[11px] text-dark-500">
            Con «Todos» elegido, el centro se saca de la cabecera del plan. Si no la trae, elige el centro arriba.
          </p>
        )}
      </section>

      {cargando && !datos && (
        <div className="flex items-center gap-2 py-8 text-dark-400"><Loader2 size={16} className="animate-spin" /> Leyendo el plan…</div>
      )}

      {datos && (
        <>
          {datos.aviso_guardado && (
            <div className="card border-amber-500/30 bg-amber-500/5 p-4 text-[12.5px] leading-relaxed text-amber-200/90">
              <b className="text-amber-200">No se ha guardado este pegado.</b> {datos.aviso_guardado}
            </div>
          )}
          {!datos.guardado && !datos.aviso_guardado && (
            <div className="card border-amber-500/30 bg-amber-500/5 p-3 text-[12.5px] text-amber-200/90">
              Analizado pero <b>sin guardar</b>: el plan no dice de qué centro es. Elige el centro arriba y dale otra vez.
            </div>
          )}

          {/* CÓMO VAMOS: lo primero que se lee. */}
          <section className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">
                Cómo vamos{datos.centro ? ` · ${datos.centro}` : ''}
                {datos.semana_del_plan ? ` · semana del ${datos.semana_del_plan.slice(8)}/${datos.semana_del_plan.slice(5, 7)}` : ''}
              </h2>
              {datos.ritmo && (
                <span className="text-[11px] text-dark-500">
                  día {datos.ritmo.dia_semana} de 7{!datos.ritmo.dia_leido_del_plan && ' (deducido de hoy)'}
                </span>
              )}
            </div>
            {propio && (
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className={`text-4xl font-bold tabular-nums ${propio.incumplen === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {propio.porcentaje == null ? '—' : `${String(propio.porcentaje).replace('.', ',')} %`}
                </span>
                <span className="text-[13px] text-dark-300">
                  {propio.conductores - propio.incumplen} de {propio.conductores} conductores sin pasarse
                  de {String(Math.round(propio.limite_semanal_min / 60 * 10) / 10).replace('.', ',')} h a la semana ni de {Math.round(propio.limite_bloque_min / 60)} h de jornada
                </span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['ya pasados (horas cerradas)', r.superan, 'bg-red-500/15 text-red-300'],
                ['se pasan hoy si acaban la ruta', r.pasaran_hoy, 'bg-orange-500/15 text-orange-300'],
                ['en peligro por ritmo', datos.ritmo?.peligro, 'bg-amber-500/15 text-amber-200'],
                ['al límite (menos de 3 h)', r.al_limite, 'bg-amber-500/10 text-amber-200'],
                ['con una jornada de 11 h o más', r.bloque_pasado, 'bg-orange-500/10 text-orange-300'],
              ].filter(([, n]) => n > 0).map(([lab, n, cls]) => (
                <span key={lab} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${cls}`}>{n} {lab}</span>
              ))}
              {!r.superan && !r.pasaran_hoy && !datos.ritmo?.peligro && !r.al_limite && !r.bloque_pasado && (
                <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  nadie se pasa ni va justo
                </span>
              )}
              <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-dark-400">{r.total} conductores en el plan</span>
            </div>

            {/* El porcentaje de Amazon: solo con su hoja de excepciones. */}
            {datos.whc && (
              <div className="mt-4 border-t border-dark-800 pt-3 text-[12.5px] text-dark-400">
                {datos.whc.porcentaje == null ? (
                  <p>
                    <b className="text-dark-200">WHC de Amazon: todavía no se sabe.</b> Sale con su hoja de
                    excepciones; escribe arriba cuántas te marcó y el número pasa a ser exacto. Con{' '}
                    {datos.whc.conductores_con_actividad} conductores, cada excepción cuesta{' '}
                    <b className="text-dark-200">{String(datos.whc.coste_por_excepcion).replace('.', ',')} puntos</b>.
                  </p>
                ) : (
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <b className="text-dark-200">WHC de Amazon:</b>
                    <span className={`text-lg font-bold tabular-nums ${datos.whc.porcentaje >= 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {String(datos.whc.porcentaje).replace('.', ',')} %
                    </span>
                    <span className="rounded bg-dark-800 px-1.5 py-0.5 text-[11px] font-semibold text-dark-200">
                      {datos.whc.tier || 'tier sin confirmar'}
                    </span>
                    <span>
                      {datos.whc.conductores_con_actividad - datos.whc.excepciones} de {datos.whc.conductores_con_actividad} cumpliendo
                      · una más y te quedas en {String(datos.whc.porcentaje_si_una_mas).replace('.', ',')} %
                    </span>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* A QUIÉN MIRAR HOY: van mal de ritmo, primero quien sigue en ruta. */}
          {!!datos.ritmo?.avisos?.length && (
            <section className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">A quién mirar hoy</h2>
                <span className="text-[11px] text-dark-500">
                  a estas alturas, como mucho {datos.ritmo.bloques_ref} jornadas = {hm(datos.ritmo.horas_ref_min)}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {datos.ritmo.avisos.map((a, i) => (
                  <li key={`${a.nombre}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dark-800 py-1.5 text-xs first:border-0 first:pt-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {a.trabajando_ahora && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
                          title="Tiene un bloque en curso: está en ruta ahora. Todavía se le puede cortar el día." />
                      )}
                      <span className="truncate text-dark-200">{a.nombre}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                      <span className="text-dark-300">{hm(a.trabajado)}</span>
                      <span className="w-[4.5rem] text-right text-orange-300">{a.exceso > 0 ? `+${hm(a.exceso)}` : ''}</span>
                      <span className={`w-[8rem] text-right ${a.proyeccion_pasa ? 'font-semibold text-red-300' : 'text-dark-500'}`}>
                        {a.bloques_restantes > 0 ? `acabaría en ${hm(a.proyeccion)}` : ''}
                        {a.bloques_leidos != null && a.bloques_hechos > a.bloques_leidos && (
                          <span className="ml-1 text-dark-500" title="El plan trae filas sin horario: las horas son del portal, el reparto en días es aproximado.">~</span>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-dark-800 pt-2 text-[11px] text-dark-500">
                El punto azul: está en ruta ahora. «Acabaría en» supone que trabaja los días que le quedan
                hasta 6 jornadas de {hm(9 * 60)}: es una proyección, no un dato.
              </p>
            </section>
          )}

          {r.no_cuadran > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 text-xs text-amber-200">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              {r.no_cuadran} {r.no_cuadran === 1 ? 'conductor no cuadra' : 'conductores no cuadran'}: su total no
              coincide con sus bloques. Seguramente falta parte del pegado; de ellos no se afirma ninguna jornada.
            </div>
          )}

          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-dark-800 text-[11px] uppercase tracking-wide text-dark-500">
                    <ThOrden campo="nombre" orden={orden} pulsar={pulsar} className="px-4 py-2.5 text-left">Conductor</ThOrden>
                    <ThOrden campo="trabajado" orden={orden} pulsar={pulsar} className="px-3 py-2.5 text-right">Horas</ThOrden>
                    <ThOrden campo="margen_semanal" orden={orden} pulsar={pulsar} className="px-3 py-2.5 text-right">Le quedan</ThOrden>
                    <ThOrden campo="dias_trabajados" orden={orden} pulsar={pulsar} className="px-3 py-2.5 text-center">Jornadas</ThOrden>
                    <th className="px-4 py-2.5 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                  {filas.map((c, i) => {
                    const abierta = abierto === i
                    const largos = c.riesgo_diario?.length || 0
                    return (
                      <Fragment key={`${c.nombre}-${i}`}>
                        <tr onClick={() => setAbierto(abierta ? null : i)} className="cursor-pointer hover:bg-dark-800/40">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 font-medium text-dark-100">
                              {largos > 0
                                ? (abierta ? <ChevronUp size={12} className="text-dark-500" /> : <ChevronDown size={12} className="text-dark-500" />)
                                : <span className="w-3" />}
                              {c.trabajando_ahora && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" title="En ruta ahora" />
                              )}
                              {c.nombre}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-dark-300">
                            {hm(c.trabajado)}
                            {c.pasara_hoy && (
                              <span className="block text-[10px] text-dark-500">{hm(c.cerrado)} cerradas</span>
                            )}
                            {c.trabajado_origen === 'bloques' && (
                              <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-300"
                                title="El pegado no traía la línea de horas de este conductor: el total está sumado desde sus bloques.">
                                de bloques
                              </span>
                            )}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                            c.supera_semanal ? 'text-red-300' : c.pasara_hoy ? 'text-orange-300' : c.al_limite ? 'text-amber-300' : 'text-emerald-300'}`}>
                            {signo(c.margen_semanal)}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-dark-500">{c.dias_trabajados}</td>
                          <td className="px-4 py-2.5">
                            {c.supera_semanal ? (
                              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">Pasado</span>
                            ) : c.pasara_hoy ? (
                              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-300"
                                title={`Lleva ${hm(c.cerrado)} cerradas; con la ruta de hoy entera pasaría del límite.`}>
                                Se pasa hoy si acaba
                              </span>
                            ) : c.al_limite ? (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Al límite</span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] text-emerald-400/80"><CircleCheck size={11} /> Con margen</span>
                            )}
                            {largos > 0 && (
                              <span className="ml-2 text-[10px] text-dark-500">· {largos} {largos === 1 ? 'jornada larga' : 'jornadas largas'}</span>
                            )}
                          </td>
                        </tr>
                        {abierta && largos > 0 && (
                          <tr className="bg-dark-900/50">
                            <td colSpan={5} className="px-4 py-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dark-500">
                                Jornadas de 10 h o más: riesgo, no incumplimiento
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {c.riesgo_diario.map((b, j) => (
                                  <span key={j} className="rounded-lg bg-dark-800 px-2.5 py-1 text-[11px] text-dark-200">
                                    {b.inicio}{b.fin ? ` – ${b.fin}` : ''} · <b>{hm(b.minutos)}</b>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-xl border border-dark-800 bg-dark-900/50 p-3.5">
            <Info size={14} className="mt-0.5 shrink-0 text-dark-500" />
            <p className="text-[11px] leading-relaxed text-dark-500">
              «Pasado» cuenta solo las horas de jornadas ya cerradas. {datos.aviso_diario}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
