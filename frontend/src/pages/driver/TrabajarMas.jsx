import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Hand, Check, Undo2, CalendarPlus, BadgeCheck, AlertTriangle } from 'lucide-react'
import { getTrabajarMas, solicitarTrabajarMas, desapuntarmeRefuerzo, cancelarMisPeticiones } from '../../services/api'
import { lista } from '../../lib/lista'
import { Campana } from './PedirDias'

/* TRABAJAR MÁS (24-10-2026). Antes «Días extra», que solo enseñaba lo que la oficina pedía a mano. Dani: «haz más
   visible los días que vamos por debajo, para que no lo pidan por donde pone libres sino un apartado que sea pedir
   trabajar más… "hay 3 vacantes, ¿la quieres? solicítala"; y si la aprobamos, que se quede como extra y ellos
   tengan constancia de que son extra».
   Aquí sale cada día que no llega a la máxima (o en el que la oficina ha pedido gente) y que TÚ libras y puedes
   trabajar: a quien trabaja, está de vacaciones o se pasaría de 6 días seguidos no le sale. Solicitar no es
   trabajar: la oficina lo confirma y entonces queda en tus turnos como EXTRA. Abajo, «Tus días extra», con quién
   y cuándo te lo confirmó: la constancia. */

const fallo = (e, txt) => e?.response?.data?.detail || txt
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const vacantesTxt = (n) => (n === 1 ? '1 vacante' : `${n} vacantes`)
// «18/10 a las 21:40»: cuándo se confirmó, en hora local.
const cuando = (iso) => {
  const d = new Date(iso || '')
  return isNaN(d) ? '' : `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}

export default function TrabajarMas({ onBack }) {
  const [datos, setDatos] = useState(null)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [notas, setNotas] = useState({})
  const [soltando, setSoltando] = useState('')       // el día extra que está a un toque de soltar

  const cargar = useCallback(() => {
    getTrabajarMas().then(({ data }) => setDatos(data))
      .catch((e) => { setErr(fallo(e, 'No se pudo cargar.')); setDatos({ vacantes: [], extras: [] }) })
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function hacer(clave, fn, mensaje) {
    setOcupado(clave); setErr(''); setOk('')
    try {
      const r = await fn()
      const no = lista(r?.data?.no)
      if (no.length) setErr(`No se pudo: ${no[0].motivo}`)
      else if (mensaje) setOk(mensaje)
      setSoltando('')
      cargar()
    } catch (e) { setErr(fallo(e, 'No se pudo hacer.')) } finally { setOcupado('') }
  }

  const vacantes = lista(datos?.vacantes)
  const extras = lista(datos?.extras)
  const proximos = extras.filter((x) => !x.pasado)
  const pasados = extras.filter((x) => x.pasado)

  return (
    <div className="min-h-screen bg-dark-950 px-4 py-6">
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[13px] text-dark-400">
          <ArrowLeft size={15} /> Volver
        </button>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-dark-50"><CalendarPlus size={22} className="text-emerald-400" /> Trabajar más</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-dark-400">
          Días en los que nos falta gente y tú libras. <b className="text-dark-200">Es voluntario</b>: solicita el que quieras
          y la oficina te confirma. Si te lo aprueban, queda en tus turnos como <b className="text-amber-300">EXTRA</b>.
        </p>

        {datos?.plazas > 0 && (
          <p className="mt-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/[.08] px-4 py-3 text-[14px] font-semibold text-emerald-200" role="status">
            Hay {vacantesTxt(datos.plazas)} en {datos.dias === 1 ? '1 día' : `${datos.dias} días`} que libras.
          </p>
        )}
        {err && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}
        {ok && <p className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">{ok}</p>}

        <div className="mt-4 space-y-3">
          {!datos ? (
            <p className="flex items-center gap-2 text-[13px] text-dark-400"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
          ) : !vacantes.length ? (
            <p className="rounded-2xl border border-dark-800 bg-dark-900/60 px-4 py-5 text-center text-[13.5px] text-dark-400">
              Ahora mismo no falta nadie en los días que libras. Cuando falte gente un día que libras, te saldrá aquí.
            </p>
          ) : vacantes.map((v) => (
            <section key={v.date} className={`rounded-2xl border p-4 ${v.mi_estado ? 'border-dark-700 bg-dark-900' : 'border-emerald-500/30 bg-dark-900'}`}
              aria-label={`Vacante del ${v.dia}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[17px] font-bold text-dark-50">{capital(v.dia)}</p>
                {!v.mi_estado && (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-300">{vacantesTxt(v.quedan)}</span>
                )}
              </div>
              {v.de_la_oficina && <p className="mt-0.5 text-[12.5px] text-dark-400">Lo ha pedido la oficina</p>}
              {v.nota && <p className="mt-1.5 text-[13px] italic text-dark-400">«{v.nota}»</p>}
              {v.mi_estado === 'pendiente' ? (
                <div className="mt-3 space-y-2">
                  <p className="flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2.5 text-[13.5px] font-semibold text-sky-200">
                    <Check size={16} /> Solicitado. La oficina te confirmará.
                  </p>
                  <button onClick={() => hacer(v.date, () => desapuntarmeRefuerzo(v.refuerzo_id), 'Solicitud retirada.')} disabled={!!ocupado}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dark-700 py-2.5 text-[13px] font-semibold text-dark-300">
                    <Undo2 size={14} /> Retirar la solicitud
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <input value={notas[v.date] || ''} maxLength={200} placeholder="Algo para la oficina (opcional)"
                    onChange={(e) => setNotas((n) => ({ ...n, [v.date]: e.target.value }))} aria-label="Nota para la oficina"
                    className="w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 text-[13.5px] text-dark-100 placeholder:text-dark-500" />
                  <button onClick={() => hacer(v.date, () => solicitarTrabajarMas(v.date, notas[v.date] || ''), 'Solicitado. Te avisamos cuando la oficina lo confirme.')}
                    disabled={!!ocupado}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[15px] font-bold text-dark-950 disabled:opacity-60">
                    {ocupado === v.date ? <Loader2 size={17} className="animate-spin" /> : <Hand size={17} />} Solicitar este día
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* LA CONSTANCIA. Cada día extra aprobado, con quién y cuándo lo confirmó, y si el cuadrante lo sigue
            diciendo: si la oficina cambió la celda después, se dice aquí en vez de enseñar un «EXTRA» que ya no es. */}
        {datos && !!extras.length && (
          <div className="mt-7">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-dark-100"><BadgeCheck size={17} className="text-amber-300" /> Tus días extra</h2>
            <div className="mt-2.5 space-y-2" data-testid="dias-extra">
              {proximos.map((x) => (
                <div key={x.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/[.06] p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-200">EXTRA</span>
                    <span className="text-[15px] font-bold text-dark-50">{capital(x.dia)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-dark-300">
                    Confirmado{x.confirmado_por ? ` por ${x.confirmado_por}` : ''}{cuando(x.confirmado_en) ? ` el ${cuando(x.confirmado_en)}` : ''}.
                  </p>
                  {!x.en_cuadrante && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-amber-300">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> La oficina ha cambiado después tu turno de ese día: míralo en «Mis turnos» o pregunta.
                    </p>
                  )}
                  {x.puede_soltar && (soltando === x.id ? (
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={() => hacer(`s-${x.id}`, () => cancelarMisPeticiones([x.id]), 'Hecho. La oficina ya lo sabe.')} disabled={!!ocupado}
                        className="flex-1 rounded-xl bg-red-500/15 py-2 text-[13px] font-semibold text-red-300">
                        {ocupado === `s-${x.id}` ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Sí, no puedo ir'}
                      </button>
                      <button onClick={() => setSoltando('')} className="rounded-xl px-3 py-2 text-[13px] text-dark-400">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setSoltando(x.id)} disabled={!!ocupado}
                      className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-dark-400">
                      <Undo2 size={13} /> Al final no puedo
                    </button>
                  ))}
                </div>
              ))}
              {!!pasados.length && (
                <details className="rounded-2xl border border-dark-800 bg-dark-900/60 px-3.5 py-3 text-[13px]">
                  <summary className="cursor-pointer font-semibold text-dark-300">Anteriores ({pasados.length})</summary>
                  <ul className="mt-2 space-y-1.5 text-dark-400">
                    {pasados.map((x) => (
                      <li key={x.id} className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/15 px-1 text-[10px] font-bold text-amber-300">EXTRA</span>
                        <span>{capital(x.dia)}</span>
                        {x.confirmado_por && <span className="text-dark-500">· {x.confirmado_por}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Para que la próxima vacante llegue al móvil sin tener que entrar a mirar. */}
        <Campana />
      </div>
    </div>
  )
}
