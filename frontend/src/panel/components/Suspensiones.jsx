import { useCallback, useEffect, useState } from 'react'
import { UserX, Loader2, Undo2, Info } from 'lucide-react'
import { getSuspensiones, crearSuspension, levantarSuspension } from '../api'
import { isoLocal } from '../../lib/fecha'
import { lista } from '../../lib/lista'

/* SUSPENSIONES (18-10-2026). Dani: «suspender a alguien: si trabaja 5 días la semana que viene, que le pueda suspender en
   su cuadrante y en el nuestro para que no trabaje, y escoger de qué día a qué día». Cada día del rango pasa a «SUSP»
   con candado en el cuadrante (el mismo que ven la rejilla, el Cuadrante y «Mis turnos»); no se tocan vacaciones, bajas
   ni días ya concedidos. Mientras dura no audita, no le llegan refuerzos y nada puede volver a ponerle a trabajar esos
   días sin levantarla. Al levantarla, lo que faltaba vuelve a como estaba. El motivo lo ve solo la oficina. */

const manana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoLocal(d) }
const fecha = (f) => {
  const d = new Date(`${f}T12:00:00`)
  return isNaN(d) ? f : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' })
}
const fallo = (e, txt) => e?.response?.data?.detail || txt
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export default function Suspensiones({ center, drivers, puede }) {
  const [datos, setDatos] = useState(null)
  const [err, setErr] = useState('')
  const [hecho, setHecho] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [form, setForm] = useState({ driver_id: '', desde: manana(), hasta: manana(), motivo: '' })
  const [confirmar, setConfirmar] = useState(null)        // id de la que se va a levantar

  const cargar = useCallback(() => {
    getSuspensiones(center).then(({ data }) => setDatos(data)).catch((e) => setErr(fallo(e, 'No se pudieron cargar las suspensiones.')))
  }, [center])
  useEffect(() => { cargar() }, [cargar])

  const conductores = lista(drivers)
  const nombreDe = (id) => conductores.find((d) => d.id === id)?.name || ''
  const listo = form.driver_id && form.desde && form.hasta && form.hasta >= form.desde && form.motivo.trim().length >= 4

  async function suspender() {
    setOcupado('crear'); setErr(''); setHecho(null)
    try {
      const { data } = await crearSuspension({ ...form, motivo: form.motivo.trim() })
      setHecho({ ...data, nombre: nombreDe(form.driver_id) })
      setForm({ driver_id: '', desde: manana(), hasta: manana(), motivo: '' })
      cargar()
    } catch (e) { setErr(fallo(e, 'No se pudo suspender.')) } finally { setOcupado('') }
  }
  async function levantar(id) {
    setOcupado(id); setErr(''); setHecho(null)
    try {
      const { data } = await levantarSuspension(id)
      setHecho({ levantada: true, dias: data.dias_devueltos })
      setConfirmar(null)
      cargar()
    } catch (e) { setErr(fallo(e, 'No se pudo levantar.')) } finally { setOcupado('') }
  }

  const todas = lista(datos?.suspensiones)
  const vivas = todas.filter((s) => s.estado === 'activa' && (s.en_curso || s.por_venir))
  const pasadas = todas.filter((s) => !(s.estado === 'activa' && (s.en_curso || s.por_venir)))

  return (
    <div className="space-y-4">
      {puede && (
        <div className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-dark-100"><UserX size={16} /> Suspender</h2>
          <p className="mb-3 text-[12.5px] leading-relaxed text-dark-400">
            Esos días pasan a <b className="text-dark-200">«SUSP»</b> en el cuadrante, con candado: lo ve él en «Mis turnos», no puede
            hacer la auditoría ni le llegan refuerzos. Las vacaciones, bajas y días ya concedidos no se tocan.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1 text-[12px] font-semibold text-dark-300">Conductor
              <select value={form.driver_id} onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[13px] text-dark-100">
                <option value="">Elige…</option>
                {conductores.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-semibold text-dark-300">Desde
              <input type="date" value={form.desde} min={isoLocal(new Date())}
                onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value, hasta: f.hasta < e.target.value ? e.target.value : f.hasta }))}
                className="mt-1 block rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[13px] text-dark-100" />
            </label>
            <label className="text-[12px] font-semibold text-dark-300">Hasta (incluido)
              <input type="date" value={form.hasta} min={form.desde} onChange={(e) => setForm((f) => ({ ...f, hasta: e.target.value }))}
                className="mt-1 block rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[13px] text-dark-100" />
            </label>
          </div>
          <label className="mt-2 block text-[12px] font-semibold text-dark-300">Motivo (lo ve solo la oficina)
            <input value={form.motivo} maxLength={300} placeholder="Ej.: sanción comunicada por carta el 15-10"
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-dark-700 bg-dark-950 px-2 py-1.5 text-[13px] text-dark-100" />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={suspender} disabled={!listo || ocupado === 'crear'}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/80 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-40">
              {ocupado === 'crear' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />} Suspender esos días
            </button>
            <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-dark-500">
              <Info size={13} className="mt-0.5 shrink-0" /> Esto lo pone en el cuadrante. La sanción se comunica por escrito como marque el convenio.
            </p>
          </div>
        </div>
      )}

      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}
      {hecho && (hecho.levantada ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
          Suspensión levantada: {plural(hecho.dias, 'día vuelve', 'días vuelven')} a como estaban en el cuadrante.
        </p>
      ) : (
        <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] leading-relaxed text-emerald-300">
          <b>{hecho.nombre}</b> suspendido: {plural(hecho.dias_trabajo.length, 'día de trabajo pasa', 'días de trabajo pasan')} a SUSP
          {hecho.dias_libres.length ? ` (y ${plural(hecho.dias_libres.length, 'día que ya libraba', 'días que ya libraba')})` : ''}.
          {!!hecho.respetados.length && <> No se han tocado: {hecho.respetados.map((r) => `${fecha(r.date)} (${r.etiqueta})`).join(', ')}.</>}
          {!!hecho.extras_contestados && <> {plural(hecho.extras_contestados, 'día extra que tenía esas fechas se le ha contestado', 'días extra que tenía esas fechas se le han contestado')}.</>}
        </div>
      ))}

      {!datos ? (
        <p className="flex items-center gap-2 text-[13px] text-dark-400"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
      ) : !vivas.length ? (
        <p className="card p-4 text-[13px] text-dark-400">No hay nadie suspendido ahora ni más adelante.</p>
      ) : (
        <div className="card divide-y divide-dark-800 overflow-hidden p-0">
          {vivas.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-[13px]" data-testid="suspension">
              <span className="font-semibold text-dark-100">{s.driver_name}</span>
              <span className="text-dark-300">del {fecha(s.desde)} al {fecha(s.hasta)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.en_curso ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {s.en_curso ? 'En curso' : 'Empieza más adelante'}
              </span>
              <span className="w-full text-[12px] text-dark-500">«{s.motivo}» · {s.creado_por}
                {!!lista(s.respetados).length && ` · sin tocar: ${lista(s.respetados).map((r) => `${fecha(r.date)} (${r.etiqueta})`).join(', ')}`}</span>
              {puede && (confirmar === s.id ? (
                <span className="flex w-full items-center gap-2">
                  <span className="text-[12.5px] text-dark-300">
                    {s.en_curso ? 'Los días que faltan desde hoy vuelven a como estaban; lo ya cumplido se queda.' : 'Todos sus días vuelven a como estaban.'}
                  </span>
                  <button onClick={() => levantar(s.id)} disabled={!!ocupado}
                    className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300">
                    {ocupado === s.id ? <Loader2 size={13} className="animate-spin" /> : 'Sí, levantar'}
                  </button>
                  <button onClick={() => setConfirmar(null)} className="rounded-lg px-2 py-1.5 text-xs text-dark-400">Cancelar</button>
                </span>
              ) : (
                <button onClick={() => setConfirmar(s.id)} className="ml-auto flex items-center gap-1 rounded-lg border border-dark-700 px-2.5 py-1.5 text-xs font-semibold text-dark-200">
                  <Undo2 size={13} /> Levantar
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {!!pasadas.length && (
        <details className="card p-4 text-[13px]">
          <summary className="cursor-pointer font-semibold text-dark-300">Terminadas o levantadas (30 días) · {pasadas.length}</summary>
          <ul className="mt-2 space-y-1 text-dark-400">
            {pasadas.map((s) => (
              <li key={s.id}>{s.driver_name} · del {fecha(s.desde)} al {fecha(s.hasta)} · {s.estado === 'levantada' ? `levantada por ${s.levantada_por}` : 'cumplida'}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
