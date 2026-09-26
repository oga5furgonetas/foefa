import { useMemo, useState } from 'react'
import { Loader2, Check, AlertTriangle, RotateCcw } from 'lucide-react'
import { analizarMoviles, aplicarMoviles } from '../api'
import SubirFichero from './SubirFichero'
import Pasos from './Pasos'

/* MÓVILES PERSONALES DESDE LA AGENDA DEL TELÉFONO.
   Se sube lo que exporta el móvil (.vcf) o el CSV de Google Contactos; el
   servidor lo empareja por nombre con las fichas y aquí se revisa ANTES de
   guardar. La agenda no se guarda: trae a toda la familia de quien la exporta,
   y del fichero solo se conservan los móviles que confirmes. Nunca se marca
   solo lo dudoso (dos personas con el mismo número, o cambiar uno ya escrito). */

export default function ImportarMoviles({ alTerminar }) {
  const [prev, setPrev] = useState(null)
  const [marcados, setMarcados] = useState({})   // driver_id -> true
  const [elegido, setElegido] = useState({})     // driver_id -> número elegido
  const [estado, setEstado] = useState('')
  const [err, setErr] = useState('')
  const [hecho, setHecho] = useState(null)

  const reiniciar = () => { setPrev(null); setMarcados({}); setElegido({}); setErr(''); setHecho(null) }

  const elegir = async (f) => {
    setPrev(null); setHecho(null); setErr(''); setEstado('leyendo')
    try {
      const fd = new FormData()
      fd.append('file', f)
      const { data } = await analizarMoviles(fd)
      setPrev(data)
      // Solo se marca lo seguro: número nuevo y que no lo comparta nadie.
      const m = {}
      ;(data.propuestas || []).forEach((p) => { if (p.estado === 'nuevo' && !p.compartido) m[p.driver_id] = true })
      setMarcados(m); setElegido({})
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudo leer el fichero.')
    } finally { setEstado('') }
  }

  const props = prev?.propuestas || []
  const nMarcados = useMemo(() => props.filter((p) => marcados[p.driver_id]).length, [props, marcados])

  const guardar = async () => {
    setEstado('guardando'); setErr('')
    try {
      const items = props.filter((p) => marcados[p.driver_id])
        .map((p) => ({ driver_id: p.driver_id, movil: elegido[p.driver_id] || p.movil }))
      const { data } = await aplicarMoviles({ items })
      setHecho(data); setPrev(null)
      alTerminar?.()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudo guardar.')
    } finally { setEstado('') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pasos actual={hecho ? 2 : prev ? 1 : 0} />
        {(prev || hecho) && (
          <button onClick={reiniciar} className="inline-flex items-center gap-1 text-[12px] text-dark-500 hover:text-dark-300">
            <RotateCcw size={12} /> Otro fichero
          </button>
        )}
      </div>

      {err && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {err}
        </p>
      )}

      {!prev && !hecho && (
        <>
          <SubirFichero onFile={elegir} ocupado={estado === 'leyendo'}
            accept=".vcf,.csv,.xlsx,.xls"
            titulo="Suelta aquí la agenda de tu móvil"
            pie=".vcf · .csv" />
          <div className="space-y-1 text-[12px] leading-snug text-dark-500">
            <p><b className="text-dark-400">Android:</b> Contactos → ⋮ → Ajustes → Exportar contactos → «Archivo .vcf».
              O en contacts.google.com → Exportar → «vCard» o «CSV de Google».</p>
            <p><b className="text-dark-400">iPhone:</b> en icloud.com/contacts → selecciona todos (⌘/Ctrl + A) → ⚙ → «Exportar vCard».</p>
            <p>El fichero <b className="text-dark-400">no se guarda</b>: se lee, se empareja por nombre con las fichas y se
              descarta. Solo se guardan los móviles que confirmes, y solo de conductores.</p>
          </div>
        </>
      )}

      {hecho && (
        <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-emerald-200">
            <Check size={17} /> {hecho.aplicados} {hecho.aplicados === 1 ? 'móvil guardado' : 'móviles guardados'}
          </p>
          {(hecho.rechazados || []).length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[12.5px] text-amber-300">
              {hecho.rechazados.map((r, i) => (
                <li key={i}>No se guardó {r.nombre || r.driver_id}: {r.motivo}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12.5px] text-emerald-300/80">
            Sirven para reconocerles cuando escriben por WhatsApp. El teléfono de la ficha no se ha tocado.
          </p>
        </div>
      )}

      {prev && (
        <>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[[prev.total_contactos, 'contactos leídos'],
              [props.length, 'a revisar'],
              [prev.ya_estaban, 'ya lo tenían'],
              [prev.faltan, 'conductores sin móvil']].map(([n, l]) => (
              <div key={l} className="rounded-lg bg-white/[0.03] py-2.5">
                <div className="text-[20px] font-semibold tabular-nums text-dark-50">{n}</div>
                <div className="text-[11px] text-dark-500">{l}</div>
              </div>
            ))}
          </div>
          <p className="text-[12px] leading-snug text-dark-500">
            {prev.sin_ficha} contactos no son conductores (no se guarda nada de ellos)
            {prev.ambiguos > 0 && ` · ${prev.ambiguos} encajan con dos conductores y no se proponen`}
            {prev.sin_movil > 0 && ` · ${prev.sin_movil} sin móvil`}.
          </p>

          {props.length === 0 ? (
            <p className="rounded-lg bg-white/[0.03] px-3 py-3 text-[13px] text-dark-400">
              No hay nada nuevo que guardar.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-dark-800">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-dark-900/60 text-[10.5px] uppercase tracking-wide text-dark-500">
                    <tr>
                      <th className="w-8 px-3 py-1.5" />
                      <th className="px-3 py-1.5 text-left font-semibold">Conductor</th>
                      <th className="px-3 py-1.5 text-left font-semibold">En tu agenda</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Móvil</th>
                      <th className="px-3 py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800/60">
                    {props.map((p) => (
                      <tr key={p.driver_id} className={marcados[p.driver_id] ? '' : 'opacity-70'}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" className="accent-emerald-500"
                            aria-label={`Guardar el móvil de ${p.nombre}`}
                            checked={!!marcados[p.driver_id]}
                            onChange={(e) => setMarcados((m) => ({ ...m, [p.driver_id]: e.target.checked }))} />
                        </td>
                        <td className="px-3 py-1.5 text-dark-200">
                          {p.nombre}
                          {p.centro && <span className="ml-1.5 text-[11px] text-dark-500">{p.centro}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-dark-400">{p.contacto}</td>
                        <td className="px-3 py-1.5 tabular-nums text-dark-300">
                          {p.otros?.length ? (
                            <select value={elegido[p.driver_id] || p.movil} className="input py-0.5 text-[12.5px]"
                              onChange={(e) => setElegido((m) => ({ ...m, [p.driver_id]: e.target.value }))}>
                              {[p.movil, ...p.otros].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          ) : p.movil}
                        </td>
                        <td className="px-3 py-1.5 text-[11px]">
                          {p.compartido && (
                            <span className="text-amber-300">número repetido en otra persona: revísalo</span>
                          )}
                          {!p.compartido && p.estado === 'cambia' && (
                            <span className="text-amber-300">ya tenía {p.actual}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-dark-500">
                  Marcados solo los nuevos y seguros. Lo que cambia un móvil ya escrito, o repite un número, va sin marcar.
                </p>
                <button onClick={guardar} disabled={estado === 'guardando' || nMarcados === 0}
                  className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40">
                  {estado === 'guardando' && <Loader2 size={14} className="animate-spin" />}
                  Guardar {nMarcados} {nMarcados === 1 ? 'móvil' : 'móviles'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
