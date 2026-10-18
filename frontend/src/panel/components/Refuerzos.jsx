import { useCallback, useEffect, useRef, useState } from 'react'
import { Megaphone, Check, X, Loader2, Users, AlertTriangle, Minus, Plus, TrendingDown, Ban } from 'lucide-react'
import { getRefuerzos, crearRefuerzo, cambiarRefuerzo, anularRefuerzo, resolveShiftRequest, getFaltasRefuerzo } from '../api'
import { isoLocal } from '../../lib/fecha'
import { lista } from '../../lib/lista'

/* REFUERZOS (18-10-2026). Dani: «para mañana nos hacen falta dos… a lo mejor tienen día libre; si quieren, que se
   postulen, sin forzar a nadie… cómo nos llegaría y cómo lo aprobaríamos». La oficina publica el día y cuántos
   hacen falta; el servidor avisa SOLO a quien ese día libra según el cuadrante (N/T, L) y en su portal le sale
   «Días extra». Quien se apunta llega aquí (y a Peticiones) y se aprueba como cualquier día: entra en el
   cuadrante como EXTRA con candado. Al cubrirse se cierra solo y a los demás se les dan las gracias. */

const ESTADO = {
  abierto: { txt: 'Abierto', cls: 'bg-sky-500/15 text-sky-300' },
  cubierto: { txt: 'Cubierto', cls: 'bg-emerald-500/15 text-emerald-300' },
  anulado: { txt: 'Anulado', cls: 'bg-dark-800 text-dark-400' },
}
const PETICION = {
  pendiente: { txt: 'Esperando', cls: 'bg-amber-500/15 text-amber-300' },
  aprobado: { txt: 'Aprobado', cls: 'bg-emerald-500/15 text-emerald-300' },
  rechazado: { txt: 'No', cls: 'bg-dark-800 text-dark-400' },
}

const manana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoLocal(d) }
const diaTxt = (f) => {
  const d = new Date(`${f}T12:00:00`)
  return isNaN(d) ? f : d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' })
}
const fallo = (e, txt) => e?.response?.data?.detail || txt

export default function Refuerzos({ center, puedeAprobar, onCambio }) {
  const [datos, setDatos] = useState(null)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [nuevo, setNuevo] = useState({ date: manana(), plazas: 2, nota: '' })
  const [ocupado, setOcupado] = useState('')
  const [rechazando, setRechazando] = useState(null)      // {id, motivo}
  const [faltas, setFaltas] = useState(null)              // días que no llegan a la máxima
  const sinCentro = !center || center === 'Todos'
  // Con una referencia y no como dependencia: si la pantalla de arriba pasa una función nueva en cada render,
  // cargar se rehacía en bucle.
  const avisar = useRef(onCambio)
  avisar.current = onCambio

  const cargar = useCallback(() => {
    if (!sinCentro) getFaltasRefuerzo(center).then(({ data }) => setFaltas(data)).catch(() => setFaltas(null))
    getRefuerzos(center)
      .then(({ data }) => { setDatos(data); avisar.current?.(lista(data?.refuerzos).reduce((n, r) => n + (r.pasado ? 0 : r.pendientes || 0), 0)) })
      .catch((e) => setErr(fallo(e, 'No se pudieron cargar los refuerzos.')))
  }, [center, sinCentro])
  useEffect(() => { cargar() }, [cargar])

  async function hacer(clave, fn, mensaje) {
    setOcupado(clave); setErr(''); setOk('')
    try {
      const r = await fn()
      if (mensaje) setOk(typeof mensaje === 'function' ? mensaje(r) : mensaje)
      cargar()
      return true
    } catch (e) {
      setErr(fallo(e, 'No se pudo hacer.'))
      return false
    } finally { setOcupado('') }
  }

  const publicar = () => hacer('crear', () => crearRefuerzo({ center, ...nuevo, plazas: Number(nuevo.plazas) }),
    ({ data }) => `Publicado. Se ha avisado a ${data.avisados} ${data.avisados === 1 ? 'persona que libra' : 'personas que libran'} ese día.`)
    .then((bien) => bien && setNuevo({ date: manana(), plazas: 2, nota: '' }))

  /* LANZAR LOS DÍAS QUE FALTAN (18-10-2026). Dani: «si el lunes me cogen una baja y suspendo a 3, bajan mis
     capacidades respecto a las máximas… que se automatice y yo le dé a lanzar». El servidor dice qué días no llegan a
     la máxima y cuántos podrían cubrirlo; aquí se pide con un clic (uno o todos). Nada se publica solo. */
  const pendientesDeLanzar = lista(faltas?.faltas).filter((f) => !f.refuerzo && f.pueden > 0)
  async function lanzar(items) {
    setOcupado('lanzar'); setErr(''); setOk('')
    let hechos = 0
    let avisados = 0
    const fallidos = []
    for (const f of items) {
      try {
        const { data } = await crearRefuerzo({ center, date: f.date, plazas: Math.min(20, f.falta), nota: '' })
        hechos += 1
        avisados += data.avisados || 0
      } catch (e) { fallidos.push(`${f.dia}: ${fallo(e, 'no se pudo')}`) }
    }
    if (hechos) setOk(`${hechos === 1 ? 'Pedido 1 día' : `Pedidos ${hechos} días`}. Se ha avisado a ${avisados} ${avisados === 1 ? 'persona' : 'personas'} que libran y pueden.`)
    if (fallidos.length) setErr(fallidos.join(' · '))
    setOcupado('')
    cargar()
  }

  const refuerzos = lista(datos?.refuerzos)
  const proximos = refuerzos.filter((r) => !r.pasado)
  const pasados = refuerzos.filter((r) => r.pasado)

  return (
    <div className="space-y-4">
      {puedeAprobar && !sinCentro && faltas?.dias && (
        <div className="card p-4" data-testid="faltas">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-dark-100"><TrendingDown size={16} /> Días que no llegan a la máxima</h2>
            {pendientesDeLanzar.length > 1 && (
              <button onClick={() => lanzar(pendientesDeLanzar)} disabled={!!ocupado}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[12.5px] font-bold text-brand-tinta disabled:opacity-50">
                {ocupado === 'lanzar' ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />} Pedir todos ({pendientesDeLanzar.length})
              </button>
            )}
          </div>
          <p className="mb-2 text-[12.5px] leading-relaxed text-dark-400">
            Próximos {faltas.dias} días, contando quién sale a ruta en el cuadrante (bajas, suspensiones y libres ya restados).
            «Pueden» son los que libran ese día y la ley y su nota del cuadrante les dejan trabajarlo (nunca 7 días seguidos
            ni más de lo que admite su semana).
          </p>
          {!faltas.con_maximas ? (
            <p className="text-[13px] text-dark-500">No hay máximas puestas para estos días: ponlas en el Cuadrante para poder comparar.</p>
          ) : !lista(faltas.faltas).length ? (
            <p className="text-[13px] text-emerald-300">Todos los días llegan a su máxima.</p>
          ) : (
            <div className="divide-y divide-dark-800 overflow-hidden rounded-lg border border-dark-800">
              {faltas.faltas.map((f) => (
                <div key={f.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
                  <span className="w-28 font-semibold capitalize text-dark-100">{f.dia}</span>
                  <span className="text-dark-400">máxima <b className="tabular-nums text-dark-200">{f.maximo}</b> · en ruta <b className="tabular-nums text-dark-200">{f.en_ruta}</b></span>
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[12px] font-semibold text-red-300">faltan {f.falta}</span>
                  <span className={`text-[12px] ${f.pueden ? 'text-dark-400' : 'text-amber-300'}`}>
                    {f.pueden ? `${f.pueden} ${f.pueden === 1 ? 'puede' : 'pueden'} apuntarse` : 'nadie puede (trabajan o lo impide la ley)'}
                  </span>
                  <span className="ml-auto">
                    {f.refuerzo ? (
                      <span className="text-[12px] text-sky-300">Pedido: {f.refuerzo.aprobados}/{f.refuerzo.plazas} aprobados</span>
                    ) : f.pueden ? (
                      <button onClick={() => lanzar([f])} disabled={!!ocupado}
                        className="flex items-center gap-1 rounded-lg bg-brand-500/15 px-2.5 py-1.5 text-xs font-semibold text-brand-300 hover:bg-brand-500/25 disabled:opacity-50">
                        <Megaphone size={13} /> Pedir {Math.min(20, f.falta)}
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {puedeAprobar && (
        <div className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-dark-100"><Megaphone size={16} /> Pedir refuerzos</h2>
          <p className="mb-3 text-[12.5px] leading-relaxed text-dark-400">
            Solo lo ve —y le llega un aviso— quien ese día <b className="text-dark-200">libra</b> según el cuadrante (N/T o L) y
            puede trabajarlo: nunca a quien trabaja, está de vacaciones, de baja o suspendido, ni a quien se pasaría de 6 días
            seguidos o de lo que admite su semana. Es voluntario: quien quiere se apunta y tú decides a quién apruebas.
          </p>
          {sinCentro ? (
            <p className="text-[13px] text-amber-300">Elige un centro arriba: el refuerzo es para una nave.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] font-semibold text-dark-300">Día
                <input type="date" value={nuevo.date} min={isoLocal(new Date())} onChange={(e) => setNuevo((n) => ({ ...n, date: e.target.value }))}
                  className="mt-1 block rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[13px] text-dark-100" />
              </label>
              <label className="text-[12px] font-semibold text-dark-300">Hacen falta
                <input type="number" min={1} max={20} value={nuevo.plazas} onChange={(e) => setNuevo((n) => ({ ...n, plazas: e.target.value }))}
                  className="mt-1 block w-20 rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[13px] text-dark-100" />
              </label>
              <label className="min-w-[200px] flex-1 text-[12px] font-semibold text-dark-300">Nota (opcional)
                <input value={nuevo.nota} maxLength={200} placeholder="Ej.: salida a las 9:00, ruta de tarde…"
                  onChange={(e) => setNuevo((n) => ({ ...n, nota: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[13px] text-dark-100" />
              </label>
              <button onClick={publicar} disabled={ocupado === 'crear' || !nuevo.date || !(Number(nuevo.plazas) >= 1)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-bold text-brand-tinta disabled:opacity-50">
                {ocupado === 'crear' ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />} Publicar y avisar
              </button>
            </div>
          )}
        </div>
      )}

      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}
      {ok && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">{ok}</p>}

      {!datos ? (
        <p className="flex items-center gap-2 text-[13px] text-dark-400"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
      ) : !proximos.length ? (
        <p className="card p-4 text-[13px] text-dark-400">No hay refuerzos pedidos para los próximos días.</p>
      ) : proximos.map((r) => {
        const e = ESTADO[r.estado] || ESTADO.abierto
        return (
          <div key={r.id} className="card p-4" data-testid="refuerzo">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold capitalize text-dark-50">{diaTxt(r.date)}</h3>
              <span className="text-[12.5px] text-dark-400">{r.center}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${e.cls}`}>{e.txt}</span>
              <span className="ml-auto flex items-center gap-1 text-[13px] text-dark-200">
                <Users size={14} />
                <span><b className="tabular-nums">{r.aprobados}</b>/{r.plazas} aprobados
                  {!!r.pendientes && <span className="text-amber-300"> · {r.pendientes} esperando</span>}</span>
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-dark-400">
              {r.nota ? <>«{r.nota}» · </> : null}avisadas {r.avisados} personas al publicarlo · hoy libran {r.libran_ahora}
            </p>
            {puedeAprobar && r.estado !== 'anulado' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="text-dark-400">Plazas:</span>
                <button aria-label="Una plaza menos" disabled={!!ocupado || r.plazas <= Math.max(1, r.aprobados)}
                  onClick={() => hacer(`p-${r.id}`, () => cambiarRefuerzo(r.id, { plazas: r.plazas - 1 }))}
                  className="rounded-md border border-dark-700 p-1 text-dark-200 disabled:opacity-40"><Minus size={13} /></button>
                <b className="w-5 text-center tabular-nums text-dark-100">{r.plazas}</b>
                <button aria-label="Una plaza más" disabled={!!ocupado || r.plazas >= 20}
                  onClick={() => hacer(`p-${r.id}`, () => cambiarRefuerzo(r.id, { plazas: r.plazas + 1 }))}
                  className="rounded-md border border-dark-700 p-1 text-dark-200 disabled:opacity-40"><Plus size={13} /></button>
                <button disabled={!!ocupado || r.aprobados > 0}
                  title={r.aprobados > 0 ? 'Hay gente aprobada: desaprueba primero a cada uno, con su motivo' : ''}
                  onClick={() => hacer(`a-${r.id}`, () => anularRefuerzo(r.id), 'Refuerzo anulado. A quien esperaba se le han dado las gracias.')}
                  className="ml-auto rounded-md px-2 py-1 font-semibold text-dark-400 hover:text-red-300 disabled:opacity-40">Ya no hace falta</button>
              </div>
            )}
            <div className="mt-3 divide-y divide-dark-800 overflow-hidden rounded-lg border border-dark-800">
              {!r.apuntados.length && <p className="px-3 py-2.5 text-[12.5px] text-dark-500">Aún no se ha apuntado nadie.</p>}
              {r.apuntados.map((a) => {
                const p = PETICION[a.status] || PETICION.pendiente
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
                    <span className="font-semibold text-dark-100">{a.driver_name}</span>
                    <span className="text-[12px] text-dark-500">{a.dias_semana} día{a.dias_semana === 1 ? '' : 's'} más esa semana</span>
                    {a.nota && <span className="text-[12px] italic text-dark-400">«{a.nota}»</span>}
                    {a.no_puede && (
                      <span className="flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11.5px] text-red-300">
                        <Ban size={12} /> No se puede aprobar: {a.no_puede.toLowerCase()}
                      </span>
                    )}
                    {a.ya_no_libra && (
                      <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11.5px] text-amber-300">
                        <AlertTriangle size={12} /> El cuadrante ya no le pone libre ese día
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.cls}`}>{p.txt}</span>
                    {a.status === 'rechazado' && a.motivo_respuesta && <span className="text-[11.5px] text-dark-500">{a.motivo_respuesta}</span>}
                    {puedeAprobar && a.status === 'pendiente' && rechazando?.id !== a.id && (
                      <span className="ml-auto flex gap-1.5">
                        <button disabled={!!ocupado || !!a.no_puede} title={a.no_puede || ''} onClick={() => hacer(`ok-${a.id}`, () => resolveShiftRequest(a.id, 'aprobar'), `${a.driver_name}: aprobado. Ya está en el cuadrante como EXTRA.`)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25">
                          {ocupado === `ok-${a.id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprobar
                        </button>
                        <button disabled={!!ocupado} onClick={() => setRechazando({ id: a.id, motivo: '' })}
                          className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25">
                          <X size={13} /> No
                        </button>
                      </span>
                    )}
                    {rechazando?.id === a.id && (
                      <span className="flex w-full items-center gap-1.5">
                        <input autoFocus value={rechazando.motivo} maxLength={300} placeholder="Motivo (lo lee el conductor)"
                          onChange={(e) => setRechazando((x) => ({ ...x, motivo: e.target.value }))}
                          className="min-w-0 flex-1 rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[12.5px] text-dark-100" />
                        <button disabled={rechazando.motivo.trim().length < 3 || !!ocupado}
                          onClick={() => hacer(`no-${a.id}`, () => resolveShiftRequest(a.id, 'rechazar', rechazando.motivo.trim()), 'Contestado.').then(() => setRechazando(null))}
                          className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-40">Enviar</button>
                        <button onClick={() => setRechazando(null)} className="rounded-lg px-2 py-1.5 text-xs text-dark-400">Cancelar</button>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {!!pasados.length && (
        <details className="card p-4 text-[13px]">
          <summary className="cursor-pointer font-semibold text-dark-300">Últimos 7 días ({pasados.length})</summary>
          <ul className="mt-2 space-y-1 text-dark-400">
            {pasados.map((r) => (
              <li key={r.id}><span className="capitalize">{diaTxt(r.date)}</span> · {r.aprobados}/{r.plazas} cubiertas · {(ESTADO[r.estado] || ESTADO.abierto).txt}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
