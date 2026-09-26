import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Car, Users, Wand2, Check, Loader2, ArrowUp, ArrowDown, X, Lightbulb, Search, Rows3, Plus, Info,
} from 'lucide-react'
import {
  getAfinidad, guardarFijaConductor, guardarTratoFurgo, getPropuestaFijas, aplicarPropuestaFijas,
  getAQuien, getFilaAparcamiento, guardarFilaAparcamiento,
} from '../api'
import { useT } from '../../i18n'
import { useToast } from '../../lib/toast'
import { lista } from '../../lib/lista'

/* FURGONETAS FIJAS — quién lleva qué furgoneta, por centro.

   Hoy casi nadie repite furgoneta (medido: en OGA5 el 29 % de las veces), así
   que la afinidad no se adivina: se FIJA aquí —principal y secundaria— y la
   plantilla la pone sola cada mañana con «Poner furgonetas». El porqué de la
   puntuación y del reparto está en backend/afinidad.py.

   Lo que un jefe cambia aquí o en la plantilla manda siempre. Nada se cambia
   solo: las sugerencias y el reparto inicial se APLICAN con un clic. */

const plate = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

function hace(iso, t) {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return t('time.mago').replace('{n}', Math.max(min, 1))
  if (min < 48 * 60) return t('time.hago').replace('{n}', Math.round(min / 60))
  return t('time.dago').replace('{n}', Math.round(min / 1440))
}

function SelectFurgo({ id, value, furgos, onChange, exclude }) {
  const { t } = useT()
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value || null)}
      className="select w-28 px-1.5 py-1 font-mono text-[12px]">
      <option value="">{t('ff.ninguna')}</option>
      {furgos.filter((f) => f.id !== exclude).map((f) => (
        <option key={f.id} value={f.id}>{f.matricula}{f.operativa ? '' : ' ·'}</option>
      ))}
    </select>
  )
}

function Conductores({ datos, recargar }) {
  const { t } = useT()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filas, setFilas] = useState(datos.conductores)
  useEffect(() => { setFilas(datos.conductores) }, [datos.conductores])
  const furgos = datos.furgos

  async function cambiar(c, campo, valor) {
    const antes = filas
    setFilas((fs) => fs.map((x) => (x.id === c.id ? { ...x, fija: { ...x.fija, [campo]: valor } } : x)))
    try {
      await guardarFijaConductor(c.id, { [campo]: valor })
      if (campo === 'titular' || campo === 'principal') recargar()
    } catch (e) {
      setFilas(antes)
      toast.error(e?.response?.data?.detail || 'No se pudo guardar')
    }
  }

  const sugeridos = filas.filter((c) => c.sugerencia)
  const vistas = filas.filter((c) => !q || c.nombre.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-3">
      {sugeridos.length > 0 && (
        <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-brand-200">
            <Lightbulb size={14} /> {t('ff.sugerencias')} ({sugeridos.length})
          </div>
          <ul className="space-y-1">
            {sugeridos.slice(0, 12).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-[12.5px] text-dark-200">
                <b className="text-dark-100">{c.nombre}</b>
                {t('ff.sugTexto').replace('{p}', c.sugerencia.matricula).replace('{v}', c.sugerencia.veces).replace('{d}', c.sugerencia.de)}
                <button type="button" onClick={() => cambiar(c, 'principal', c.sugerencia.furgo)}
                  className="rounded-md border border-brand-400/40 px-2 py-0.5 text-[11.5px] font-semibold text-brand-200 hover:bg-brand-500/15">
                  {t('ff.sugHacer')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="relative max-w-xs">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
        <input id="ff-buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ff.buscar')}
          className="input py-1.5 pl-8 text-[12.5px]" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-dark-500">
              <th className="px-3 py-2">{t('ff.col.conductor')}</th>
              <th className="px-2 py-2 text-right">{t('ff.col.dias')}</th>
              <th className="px-2 py-2">{t('ff.col.principal')}</th>
              <th className="px-2 py-2" title={t('ff.titularTip')}>{t('ff.col.titular')}</th>
              <th className="px-2 py-2">{t('ff.col.secundaria')}</th>
              <th className="px-2 py-2" title={t('ff.sinAutoTip')}>{t('ff.col.sinAuto')}</th>
              <th className="px-2 py-2" title={t('ff.respTip')}>{t('ff.col.resp')}</th>
              <th className="px-2 py-2" title={t('ff.golpesTip')}>{t('ff.col.golpes')}</th>
              <th className="px-3 py-2">{t('ff.col.ultima')}</th>
            </tr>
          </thead>
          <tbody>
            {vistas.map((c) => (
              <tr key={c.id} className="border-t border-dark-800/70">
                <td className="px-3 py-1.5 text-dark-100">{c.nombre}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-dark-300">{c.dias_30}</td>
                <td className="px-2 py-1.5">
                  <SelectFurgo id={`ff-p-${c.id}`} value={c.fija.principal} furgos={furgos} exclude={c.fija.secundaria}
                    onChange={(v) => cambiar(c, 'principal', v)} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="checkbox" id={`ff-t-${c.id}`} checked={!!c.fija.titular} disabled={!c.fija.principal}
                    onChange={(e) => cambiar(c, 'titular', e.target.checked)} className="h-3.5 w-3.5 accent-brand-500"
                    aria-label={t('ff.col.titular')} />
                </td>
                <td className="px-2 py-1.5">
                  <SelectFurgo id={`ff-s-${c.id}`} value={c.fija.secundaria} furgos={furgos} exclude={c.fija.principal}
                    onChange={(v) => cambiar(c, 'secundaria', v)} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="checkbox" id={`ff-a-${c.id}`} checked={!!c.fija.sin_auto}
                    onChange={(e) => cambiar(c, 'sin_auto', e.target.checked)} className="h-3.5 w-3.5 accent-brand-500"
                    aria-label={t('ff.col.sinAuto')} />
                </td>
                <td className="px-2 py-1.5">
                  <select id={`ff-r-${c.id}`} value={c.fija.responsabilidad ?? ''} title={t('ff.respTip')}
                    onChange={(e) => cambiar(c, 'responsabilidad', e.target.value === '' ? null : Number(e.target.value))}
                    className="select w-16 px-1.5 py-1 text-[12px] tabular-nums">
                    <option value="">—</option>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 tabular-nums text-dark-300" title={t('ff.golpesTip')}>
                  <span className={c.cuidado.seguros ? 'text-rose-300' : ''}>{c.cuidado.seguros}</span>
                  <span className="text-dark-600"> · </span>
                  <span className={c.cuidado.posibles ? 'text-amber-300' : ''}>{c.cuidado.posibles}</span>
                  <span className="ml-1 text-[11px] text-dark-500">/ {c.cuidado.dias} {t('ff.dias')}</span>
                </td>
                <td className="px-3 py-1.5 font-mono text-dark-400">{c.ultima || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-dark-500">{t('ff.golpesTip')}</p>
    </div>
  )
}

function Furgonetas({ datos, center, recargar }) {
  const { t } = useT()
  const toast = useToast()
  const [aQuien, setAQuien] = useState(null)       // { furgo, matricula, candidatos, cargando }
  const nombre = useMemo(() => Object.fromEntries(datos.conductores.map((c) => [c.id, c.nombre])), [datos.conductores])

  async function trato(f, v) {
    try { await guardarTratoFurgo(f.id, v); recargar() } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo guardar') }
  }
  async function verAQuien(f) {
    setAQuien({ furgo: f.id, matricula: f.matricula, candidatos: [], cargando: true })
    try {
      const r = await getAQuien(center, f.id)
      setAQuien({ furgo: f.id, matricula: f.matricula, candidatos: lista(r.data?.candidatos), cargando: false })
    } catch (e) {
      setAQuien(null)
      toast.error(e?.response?.data?.detail || 'No se pudo calcular')
    }
  }
  async function darsela(cid) {
    try {
      await guardarFijaConductor(cid, { principal: aQuien.furgo, titular: true })
      toast.success(t('ff.guardado'))
      setAQuien(null)
      recargar()
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo guardar') }
  }

  return (
    <div className="space-y-3">
      {aQuien && (
        <div className="card p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-dark-100">{t('ff.aQuien')} <span className="font-mono">{aQuien.matricula}</span></div>
            <button type="button" onClick={() => setAQuien(null)} className="text-dark-500 hover:text-dark-200" aria-label="Cerrar"><X size={14} /></button>
          </div>
          <p className="mb-2 text-[12px] text-dark-400">{t('ff.aQuienSub')}</p>
          {aQuien.cargando ? <Loader2 size={16} className="animate-spin text-dark-400" /> : (
            <ul className="divide-y divide-dark-800/70">
              {aQuien.candidatos.map((c) => (
                <li key={c.conductor} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[12.5px]">
                  <span className="min-w-[10rem] flex-1 text-dark-100">{c.nombre}</span>
                  {c.responsabilidad != null && <span className="tabular-nums text-brand-200">{t('ff.nota')} {c.responsabilidad}</span>}
                  <span className="tabular-nums text-dark-300">{c.dias} {t('ff.dias')}</span>
                  <span className="tabular-nums text-dark-300">{c.golpes_seguros} {t('ff.seguros')} · {c.golpes_posibles} {t('ff.posibles')}</span>
                  {c.tiene_fija && <span className="text-[11px] text-dark-500">{t('ff.tieneFija')}</span>}
                  <button type="button" onClick={() => darsela(c.conductor)} className="btn-primary px-2.5 py-1 text-[11.5px]">{t('ff.darsela')}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-dark-500">
              <th className="px-3 py-2">{t('ff.col.matricula')}</th>
              <th className="px-2 py-2">{t('ff.col.estado')}</th>
              <th className="px-2 py-2">{t('ff.col.trato')}</th>
              <th className="px-2 py-2">{t('ff.col.duenos')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {datos.furgos.map((f) => (
              <tr key={f.id} className="border-t border-dark-800/70 align-top">
                <td className="px-3 py-1.5 font-mono text-dark-100">{f.matricula}</td>
                <td className="px-2 py-1.5">
                  <span className={f.operativa ? 'text-emerald-300' : 'text-amber-300'}>
                    {f.operativa ? t('ff.estado.activa') : f.bloqueada ? t('ff.estado.bloqueada') : t('ff.estado.taller')}
                  </span>
                  {f.valor_por && <div className="text-[11px] text-dark-500">{f.valor_por}</div>}
                </td>
                <td className="px-2 py-1.5">
                  <select id={`ff-trato-${f.id}`} value={f.trato || ''} onChange={(e) => trato(f, e.target.value)}
                    className="select w-36 px-1.5 py-1 text-[12px]">
                    <option value="">{t('ff.trato.normal')}</option>
                    <option value="nueva">{t('ff.trato.nueva')}</option>
                    <option value="reparada">{t('ff.trato.reparada')}</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 text-dark-200">
                  {f.principal_de.length === 0 ? <span className="text-dark-500">—</span>
                    : f.principal_de.map((cid) => (
                      <div key={cid}>{nombre[cid] || cid}{f.titular === cid && <span className="ml-1 text-[11px] text-brand-300">({t('ff.titularDe')})</span>}</div>
                    ))}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button type="button" onClick={() => verAQuien(f)} className="btn-ghost px-2 py-1 text-[11.5px] text-brand-300">{t('ff.aQuien')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilaAparcamiento({ datos, center }) {
  const { t } = useT()
  const toast = useToast()
  const [filas, setFilas] = useState(null)
  const [meta, setMeta] = useState({})
  const [pegado, setPegado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const placas = useMemo(() => datos.furgos.map((f) => f.matricula).filter(Boolean), [datos.furgos])

  useEffect(() => {
    getFilaAparcamiento(center)
      .then((r) => { setFilas(lista(r.data?.filas).map(lista)); setMeta(r.data || {}) })
      .catch(() => setFilas([]))
  }, [center])
  if (!filas) return <Loader2 size={16} className="animate-spin text-dark-400" />

  const puestas = new Set(filas.flat().map(plate))
  const sueltas = placas.filter((p) => !puestas.has(plate(p)))
  const mueve = (n, i, d) => setFilas((fs) => fs.map((f, k) => {
    if (k !== n) return f
    const x = [...f]
    const j = i + d
    if (j < 0 || j >= x.length) return f
    ;[x[i], x[j]] = [x[j], x[i]]
    return x
  }))
  function leerPegado() {
    /* Se buscan las matrículas CONOCIDAS dentro de cada línea sin espacios ni
       guiones, en el orden en que aparecen. Partir por espacios perdía las
       escritas como «1234 ABC», que es como se escriben casi siempre. */
    const conocidas = [...new Map(placas.map((p) => [plate(p), p]))]
    const nuevas = pegado.split('\n').map((l) => {
      const n = plate(l)
      return conocidas.map(([k, p]) => [n.indexOf(k), p]).filter(([i]) => i >= 0)
        .sort((a, b) => a[0] - b[0]).map(([, p]) => p)
    }).filter((f) => f.length)
    if (nuevas.length) { setFilas(nuevas); setPegado('') }
  }
  async function guardar() {
    setGuardando(true)
    try {
      const r = await guardarFilaAparcamiento(center, filas.filter((f) => f.length))
      setMeta({ actualizado_en: r.data?.actualizado_en })
      toast.success(t('ff.guardado'))
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar')
    } finally { setGuardando(false) }
  }

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[12.5px] text-dark-400">{t('ff.filaSub')}</p>
      {meta.actualizado_en && (
        <p className="text-[12px] text-dark-500">{t('ff.apuntada')} {hace(meta.actualizado_en, t)}{meta.actualizado_por ? ` · ${meta.actualizado_por}` : ''}</p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {filas.map((f, n) => (
          <div key={n} className="card w-44 shrink-0 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-dark-200">
              {t('ff.filaN')} {n + 1}
              <button type="button" onClick={() => setFilas((fs) => fs.filter((_, k) => k !== n))} className="text-dark-500 hover:text-dark-200" aria-label={t('ff.vaciar')}><X size={13} /></button>
            </div>
            <div className="mb-1 text-[10.5px] uppercase tracking-wider text-dark-500">↑ {t('ff.delante')}</div>
            <ol className="space-y-1">
              {f.map((p, i) => (
                <li key={p} className="flex items-center gap-1 rounded bg-dark-800/60 px-1.5 py-1 font-mono text-[12px] text-dark-100">
                  <span className="w-4 text-right text-[10.5px] text-dark-500">{i + 1}</span>
                  <span className="flex-1">{p}</span>
                  <button type="button" onClick={() => mueve(n, i, -1)} className="text-dark-500 hover:text-dark-200" aria-label="Subir"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => mueve(n, i, 1)} className="text-dark-500 hover:text-dark-200" aria-label="Bajar"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => setFilas((fs) => fs.map((x, k) => (k === n ? x.filter((y) => y !== p) : x)))} className="text-dark-500 hover:text-rose-300" aria-label="Quitar"><X size={12} /></button>
                </li>
              ))}
            </ol>
            {sueltas.length > 0 && (
              <select id={`ff-fila-add-${n}`} value="" onChange={(e) => e.target.value && setFilas((fs) => fs.map((x, k) => (k === n ? [...x, e.target.value] : x)))}
                className="select mt-1.5 w-full px-1.5 py-1 font-mono text-[12px]">
                <option value="">+ …</option>
                {sueltas.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setFilas((fs) => [...fs, []])}
          className="flex w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-dark-700 text-[12px] text-dark-400 hover:border-dark-500 hover:text-dark-200">
          <Plus size={16} /> {t('ff.addFila')}
        </button>
      </div>
      {sueltas.length > 0 && filas.length > 0 && (
        <p className="text-[11.5px] text-dark-500">{t('ff.porAparcar')}: <span className="font-mono">{sueltas.join(' ')}</span></p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <textarea id="ff-fila-pegar" value={pegado} onChange={(e) => setPegado(e.target.value)} rows={3}
          placeholder={t('ff.pegarTip')} className="input font-mono text-[12px]" />
        <div className="flex gap-2 sm:flex-col">
          <button type="button" onClick={leerPegado} disabled={!pegado.trim()} className="btn-secondary px-3 py-1.5 text-[12.5px]">{t('ff.leerPegado')}</button>
          <button type="button" onClick={guardar} disabled={guardando} className="btn-primary flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t('ff.guardarFila')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Propuesta({ center, alAplicar, cerrar }) {
  const { t } = useT()
  const toast = useToast()
  const [datos, setDatos] = useState(null)
  const [marcadas, setMarcadas] = useState(new Set())
  const [aplicando, setAplicando] = useState(false)
  useEffect(() => {
    getPropuestaFijas(center)
      .then((r) => { const ps = lista(r.data?.propuestas); setDatos(ps); setMarcadas(new Set(ps.map((p) => p.conductor))) })
      .catch((e) => { toast.error(e?.response?.data?.detail || 'No se pudo calcular'); cerrar() })
  }, [center]) // eslint-disable-line react-hooks/exhaustive-deps

  async function aplicar() {
    setAplicando(true)
    try {
      const cambios = datos.filter((p) => marcadas.has(p.conductor))
        .map((p) => ({ conductor: p.conductor, principal: p.principal, secundaria: p.secundaria, titular: p.titular }))
      const r = await aplicarPropuestaFijas(cambios)
      toast.success(`${r.data?.aplicadas ?? cambios.length} ${t('ff.aplicadas')}. ${t('ff.propuestaAplicada')}`)
      alAplicar()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo aplicar')
    } finally { setAplicando(false) }
  }

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-dark-100"><Wand2 size={14} /> {t('ff.propuesta')}</div>
        <button type="button" onClick={cerrar} className="text-dark-500 hover:text-dark-200" aria-label="Cerrar"><X size={14} /></button>
      </div>
      <p className="mb-2 max-w-3xl text-[12px] text-dark-400">{t('ff.propuestaSub')}</p>
      {!datos ? <Loader2 size={16} className="animate-spin text-dark-400" />
        : datos.length === 0 ? <p className="text-[12.5px] text-dark-400">{t('ff.sinPropuesta')}</p> : (
          <>
            <div className="max-h-[26rem] overflow-y-auto">
              <table className="w-full text-[12.5px]">
                <tbody>
                  {datos.map((p) => (
                    <tr key={p.conductor} className="border-t border-dark-800/70">
                      <td className="py-1 pr-2">
                        <input type="checkbox" id={`ff-prop-${p.conductor}`} checked={marcadas.has(p.conductor)} className="h-3.5 w-3.5 accent-brand-500"
                          onChange={(e) => setMarcadas((s) => { const n = new Set(s); if (e.target.checked) n.add(p.conductor); else n.delete(p.conductor); return n })}
                          aria-label={p.nombre} />
                      </td>
                      <td className="py-1 pr-2 text-dark-100">{p.nombre}</td>
                      <td className="py-1 pr-2 font-mono text-dark-100">{p.principal_matricula}{p.titular && <span className="ml-1 font-sans text-[11px] text-brand-300">({t('ff.titularDe')})</span>}</td>
                      <td className="py-1 pr-2 font-mono text-dark-400">{p.secundaria_matricula || '—'}</td>
                      <td className="py-1 pr-2 text-[11.5px] text-dark-400">{p.motivo}{p.comparte_con.length > 0 && ` · ${t('ff.comparteCon')} ${p.comparte_con.join(', ')}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={aplicar} disabled={aplicando || marcadas.size === 0}
              className="btn-primary mt-3 flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px]">
              {aplicando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t('ff.aplicar')} ({marcadas.size})
            </button>
          </>
        )}
    </div>
  )
}

export default function FurgonetasFijas({ center }) {
  const { t } = useT()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('conductores')
  const [proponiendo, setProponiendo] = useState(false)
  const noCenter = !center || center === 'Todos'

  const cargar = useCallback(async () => {
    try {
      const r = await getAfinidad(center)
      setDatos({ ...r.data, conductores: lista(r.data?.conductores), furgos: lista(r.data?.furgos) })
      setError('')
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo cargar')
    }
  }, [center])
  useEffect(() => { if (!noCenter) { setDatos(null); cargar() } }, [cargar, noCenter])

  if (noCenter) return <div className="card p-8 text-center text-[13px] text-dark-400">{t('ff.elegirCentro')}</div>
  if (error && !datos) return <div className="card p-8 text-center text-[13px] text-dark-400">{error}</div>
  if (!datos) return <div className="flex justify-center p-12 text-dark-400"><Loader2 className="animate-spin" /></div>

  const r = datos.resumen || {}
  const TABS = [['conductores', 'ff.tab.conductores', Users], ['furgos', 'ff.tab.furgos', Car], ['fila', 'ff.tab.fila', Rows3]]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[12.5px] text-dark-400">{t('ff.sub')}</p>
        <button type="button" onClick={() => setProponiendo(true)} className="btn-secondary flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
          <Wand2 size={13} /> {t('ff.propuesta')}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-dark-400">
        <span>{t('ff.tab.conductores')} <b className="tabular-nums text-dark-100">{r.conductores ?? 0}</b></span>
        <span>{t('ff.col.principal')} <b className="tabular-nums text-dark-100">{r.con_principal ?? 0}</b></span>
        <span>{t('ff.col.sinAuto')} <b className="tabular-nums text-dark-100">{r.sin_auto ?? 0}</b></span>
        <span>{t('ff.estado.activa')} <b className="tabular-nums text-dark-100">{r.operativas ?? 0}</b></span>
      </div>
      <p className="flex items-start gap-1.5 text-[12px] text-dark-500">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>{datos.cuidado_activo ? t('ff.cuidadoOn') : t('ff.cuidadoOff')}{datos.cuidado_motivo}</span>
      </p>
      {proponiendo && <Propuesta center={center} cerrar={() => setProponiendo(false)} alAplicar={() => { setProponiendo(false); cargar() }} />}
      <nav className="flex gap-1 overflow-x-auto border-b border-dark-800">
        {TABS.map(([k, key, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors ${
              tab === k ? 'border-brand-400 font-semibold text-dark-50' : 'border-transparent text-dark-400 hover:text-dark-200'}`}>
            <Icon size={13} /> {t(key)}
          </button>
        ))}
      </nav>
      {tab === 'conductores' && <Conductores datos={datos} recargar={cargar} />}
      {tab === 'furgos' && <Furgonetas datos={datos} center={center} recargar={cargar} />}
      {tab === 'fila' && <FilaAparcamiento datos={datos} center={center} />}
    </div>
  )
}
