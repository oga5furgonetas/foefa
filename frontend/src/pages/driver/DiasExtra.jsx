import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Hand, Check, Undo2, CalendarPlus } from 'lucide-react'
import { getMisRefuerzos, apuntarmeRefuerzo, desapuntarmeRefuerzo } from '../../services/api'
import { lista } from '../../lib/lista'
import { Campana } from './PedirDias'

/* DÍAS EXTRA (18-10-2026). Dani: «para mañana nos hacen falta dos… a lo mejor tienen día libre; si quieren, que se
   postulen… para no forzar a nadie, que estén felices». Aquí sale lo que la oficina ha pedido para un día que TÚ
   libras según el cuadrante (a quien trabaja, está de vacaciones o de baja no le sale). Apuntarse no es trabajar:
   la oficina lo aprueba, y entonces entra en tus turnos. Es voluntario y puedes borrarte (si ya estaba aprobado,
   hasta el día antes). */

const fallo = (e, txt) => e?.response?.data?.detail || txt
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export default function DiasExtra({ onBack }) {
  const [datos, setDatos] = useState(null)
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [notas, setNotas] = useState({})

  const cargar = useCallback(() => {
    getMisRefuerzos().then(({ data }) => setDatos(data)).catch((e) => { setErr(fallo(e, 'No se pudo cargar.')); setDatos({ refuerzos: [] }) })
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function hacer(id, fn) {
    setOcupado(id); setErr('')
    try { await fn(); cargar() } catch (e) { setErr(fallo(e, 'No se pudo hacer.')) } finally { setOcupado('') }
  }

  const refuerzos = lista(datos?.refuerzos)

  return (
    <div className="min-h-screen bg-dark-950 px-4 py-6">
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[13px] text-dark-400">
          <ArrowLeft size={15} /> Volver
        </button>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-dark-50"><CalendarPlus size={22} className="text-brand-400" /> Días extra</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-dark-400">
          Días en los que la oficina necesita gente y tú libras. <b className="text-dark-200">Es voluntario</b>: si te apetece
          trabajar, apúntate; la oficina te confirma y entonces entra en tus turnos.
        </p>

        {err && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}

        <div className="mt-5 space-y-3">
          {!datos ? (
            <p className="flex items-center gap-2 text-[13px] text-dark-400"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
          ) : !refuerzos.length ? (
            <p className="rounded-2xl border border-dark-800 bg-dark-900/60 px-4 py-5 text-center text-[13.5px] text-dark-400">
              Ahora mismo no hace falta nadie en tus días libres. Si la oficina pide gente para un día que libras, te saldrá aquí.
            </p>
          ) : refuerzos.map((r) => (
            <section key={r.id} className="rounded-2xl border border-dark-700 bg-dark-900 p-4" aria-label={`Refuerzo del ${r.dia}`}>
              <p className="text-[17px] font-bold text-dark-50">{capital(r.dia)}</p>
              <p className="mt-0.5 text-[13px] text-dark-300">
                {r.center} · {r.quedan > 0 ? `${r.quedan === 1 ? 'queda 1 plaza' : `quedan ${r.quedan} plazas`}` : 'plazas cubiertas'}
              </p>
              {r.nota && <p className="mt-1.5 text-[13px] italic text-dark-400">«{r.nota}»</p>}
              {r.mi_estado === 'aprobado' ? (
                <div className="mt-3 space-y-2">
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-[13.5px] font-semibold text-emerald-300">
                    <Check size={16} /> Confirmado: ese día trabajas. Ya está en tus turnos.
                  </p>
                  <button onClick={() => hacer(r.id, () => desapuntarmeRefuerzo(r.id))} disabled={!!ocupado}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dark-700 py-2.5 text-[13px] font-semibold text-dark-300">
                    <Undo2 size={14} /> Al final no puedo
                  </button>
                </div>
              ) : r.mi_estado === 'pendiente' ? (
                <div className="mt-3 space-y-2">
                  <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-[13.5px] font-semibold text-amber-200">
                    Apuntado. La oficina te confirmará.
                  </p>
                  <button onClick={() => hacer(r.id, () => desapuntarmeRefuerzo(r.id))} disabled={!!ocupado}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dark-700 py-2.5 text-[13px] font-semibold text-dark-300">
                    <Undo2 size={14} /> Borrarme
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <input value={notas[r.id] || ''} maxLength={200} placeholder="Algo para la oficina (opcional)"
                    onChange={(e) => setNotas((n) => ({ ...n, [r.id]: e.target.value }))} aria-label="Nota para la oficina"
                    className="w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 text-[13.5px] text-dark-100 placeholder:text-dark-500" />
                  <button onClick={() => hacer(r.id, () => apuntarmeRefuerzo(r.id, notas[r.id] || ''))} disabled={!!ocupado}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta disabled:opacity-60">
                    {ocupado === r.id ? <Loader2 size={17} className="animate-spin" /> : <Hand size={17} />} Me apunto
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Para que el próximo «hacen falta» llegue al móvil sin tener que entrar a mirar. */}
        <Campana />
      </div>
    </div>
  )
}
