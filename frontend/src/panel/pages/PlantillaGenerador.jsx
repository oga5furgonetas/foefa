import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, Loader2, AlertCircle, X, CheckCircle2,
  Download, RotateCcw, Plus, ChevronDown, ChevronUp, Trash2, FolderOpen,
  Copy, ClipboardPaste, Car, Info, ClipboardCheck, Wand2, AlertTriangle,
} from 'lucide-react'
import { getToken } from '../auth'
import { getPlantillas, downloadPlantilla, deletePlantilla, getVehicles, plantillaDesdeAsignacion, plantillaFurgos } from '../api'
import FurgonetasFijas from '../components/FurgonetasFijas'
import { API_BASE as API } from '../../lib/apiBase'
import { useT, LANG_LOCALE } from '../../i18n'
import { lista } from '../../lib/lista'

/* La plantilla del día: la hoja de salida (ruta, conductor, móvil, vehículo y
   horas) que la oficina monta cada mañana. Viene de FlotaDSP, donde dos
   personas la editaban a la vez cada día; por eso se guarda celda a celda y
   nunca la hoja entera (ver los comentarios de `mandar` y `guardarCelda`). */

async function apiFetch(path, opts = {}) {
  const resp = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) },
  })
  if (!resp.ok) {
    let msg = `Error ${resp.status}`
    try {
      const j = await resp.json()
      const d = j.detail
      if (typeof d === 'string') msg = d
      else if (Array.isArray(d)) msg = d.map(x => x?.msg || JSON.stringify(x)).join(' · ')
      else if (d) msg = d.message || d.msg || JSON.stringify(d)
    } catch { /* sin cuerpo */ }
    throw new Error(msg)
  }
  return resp
}

/* Preferencias de la pantalla por centro (tramo de salida, columnas). Solo es
   comodidad: sin almacenamiento del navegador, se usan los valores por defecto. */
function leerPref(clave, porDefecto) {
  try { const v = localStorage.getItem(clave); return v === null ? porDefecto : JSON.parse(v) } catch { return porDefecto }
}
function guardarPref(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* nada */ }
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── Agrupar plantillas por mes ── */
function groupByMonth(plantillas, t, locale) {
  const map = {}
  for (const p of plantillas) {
    let label = t('pg.sinFecha')
    try {
      const d = p.date?.includes('/') ? p.date : p.date?.split('-').reverse().join('/')
      const [, mm, yyyy] = (d || '').split('/')
      if (mm && yyyy) {
        const raw = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
        label = raw.charAt(0).toUpperCase() + raw.slice(1)
      }
    } catch { /* fecha rara: sin fecha */ }
    if (!map[label]) map[label] = []
    map[label].push(p)
  }
  return map
}

/* ── Historial de plantillas ── */
function Historial({ center }) {
  const { t, lang } = useT()
  const locale = LANG_LOCALE[lang] || 'es-ES'
  const [open, setOpen] = useState(false)
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const noCenter = !center || center === 'Todos'

  const load = useCallback(async () => {
    if (noCenter) return
    setLoading(true)
    try {
      const res = await getPlantillas(center)
      setPlantillas(lista(res.data))
    } catch { setPlantillas([]) }
    finally { setLoading(false) }
  }, [center, noCenter])

  useEffect(() => { if (open) load() }, [open, load])

  async function handleDownload(p) {
    try {
      const res = await downloadPlantilla(p.id)
      descargarBlob(res.data, p.filename || 'plantilla.xlsx')
    } catch (e) { alert(`${t('pg.eDescargar')}: ${e.message}`) }
  }

  async function handleDelete(p) {
    if (!confirm(`${t('pg.confirmDel')} ${p.date}?`)) return
    setDeleting(p.id)
    try { await deletePlantilla(p.id); setPlantillas(ps => ps.filter(x => x.id !== p.id)) }
    catch (e) { alert(`Error: ${e.message}`) }
    finally { setDeleting(null) }
  }

  const grouped = groupByMonth(plantillas, t, locale)

  return (
    <div className="mb-6 rounded-xl border border-dark-700 bg-dark-900/60">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-brand-400" />
          <span className="text-sm font-semibold text-dark-100">{t('pg.histTitulo')}</span>
          {!noCenter && <span className="rounded-full bg-dark-700 px-2 py-0.5 text-[11px] text-dark-200">{center}</span>}
        </div>
        {open ? <ChevronUp size={15} className="text-dark-500" /> : <ChevronDown size={15} className="text-dark-500" />}
      </button>

      {open && (
        <div className="border-t border-dark-700 px-4 pb-4 pt-3">
          {noCenter ? (
            <p className="text-sm text-dark-500">{t('pg.eligeCentroHist')}</p>
          ) : loading ? (
            <div className="flex items-center gap-2 py-4 text-dark-400">
              <Loader2 size={15} className="animate-spin" /> {t('pg.cargando')}
            </div>
          ) : plantillas.length === 0 ? (
            <p className="py-4 text-center text-sm text-dark-500">
              {t('pg.sinPlantillas1')} <b>{center}</b>. {t('pg.sinPlantillas2')}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-400">{month}</div>
                  <div className="flex flex-col gap-1">
                    {items.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-dark-800 bg-dark-900 px-3 py-2 hover:border-dark-700">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-dark-100">{p.date}</span>
                          <span className="ml-2 text-xs text-dark-500">{t('pg.semana')} {p.week}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => handleDownload(p)}
                            className="btn-ghost flex items-center gap-1 px-2 py-1 text-xs text-dark-300 hover:text-brand-300">
                            <Download size={13} /> {t('pg.descargar')}
                          </button>
                          <button onClick={() => handleDelete(p)} disabled={deleting === p.id} aria-label={t('pg.borrar')}
                            className="btn-ghost p-1.5 text-dark-500 hover:text-red-400 disabled:opacity-40">
                            {deleting === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const CAMPO_KEY = {
  ruta: 'pg.col.ruta', conductor: 'pg.col.conductor', movil: 'pg.col.movil', furgo: 'pg.col.furgo',
  h_llegada: 'pg.col.llegada', h_bajada: 'pg.col.carga', h_salida: 'pg.col.salida', observaciones: 'pg.col.obs',
}
const TRAMOS = [0, 10, 15, 20, 30]

/* ── Componente principal ── */
export default function PlantillaGenerador() {
  const { center } = useOutletContext()
  const { t } = useT()

  const [rutasList, setRutasList] = useState([])
  const [vehList, setVehList] = useState([])
  const [vehText, setVehText] = useState('')
  const [rutasText, setRutasText] = useState('')
  const [step, setStep] = useState('upload')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [aviso, setAviso] = useState('')
  const [data, setData] = useState(null)
  // Avisos de la validación contra la empresa (nombre mal leído, matrícula que
  // no existe, hora imposible). Se recalculan solos al editar.
  const [avisos, setAvisos] = useState([])
  const [conAsignacion, setConAsignacion] = useState(false)
  const [redSet, setRedSet] = useState(new Set())
  const [yellowSet, setYellowSet] = useState(new Set())
  const [pinkSet, setPinkSet] = useState(new Set())
  const [markedSet, setMarkedSet] = useState(new Set())
  const [sharedDraft, setSharedDraft] = useState(null) // { id, revision, updated_by }
  const celdaTimers = useRef({})
  const celdaEnFoco = useRef(null)
  const focoTimer = useRef(null)
  const metaTimer = useRef(null)
  const [sharedNote, setSharedNote] = useState('')
  // Tras "Nueva plantilla" NO nos re-unimos al borrador compartido: el
  // auto-unirse re-enganchaba el borrador viejo y el botón parecía roto.
  const suppressJoin = useRef(false)

  const [copiedHours, setCopiedHours] = useState(null)
  // Pestaña: la plantilla del día, o quién lleva qué furgoneta (se recuerda).
  const [vista, setVista] = useState(() => leerPref('plantilla.vista', 'plantilla'))
  function cambiarVista(v) { setVista(v); guardarPref('plantilla.vista', v) }
  // «Poner furgonetas»: lo que propuso el servidor (backend/afinidad.py). Las
  // marcas de «puesta sola» son de esta pantalla: a quien edita a la vez le
  // llega la matrícula, no la marca.
  const [furgosIA, setFurgosIA] = useState(null)      // { opciones, conflictos, mover, sin_nombre, ... }
  const [autoPuestas, setAutoPuestas] = useState({})  // fila -> { tipo, motivos }
  const [poniendo, setPoniendo] = useState(false)
  const [ponerNota, setPonerNota] = useState('')
  const noCenter = !center || center === 'Todos'

  // Cada centro trabaja a su manera: el tramo de salida y si usa las columnas
  // de llegada y carga se recuerdan por centro.
  const [hideNY, setHideNY] = useState(false)
  const [tramo, setTramo] = useState(0)
  useEffect(() => {
    setHideNY(!!leerPref(`plantilla.ocultarLlegada.${center}`, false))
    setTramo(Number(leerPref(`plantilla.tramo.${center}`, 0)) || 0)
  }, [center])
  function cambiarHideNY(v) { setHideNY(v); guardarPref(`plantilla.ocultarLlegada.${center}`, v) }
  function cambiarTramo(v) { setTramo(v); guardarPref(`plantilla.tramo.${center}`, v) }

  // La ruta que el SERVIDOR tiene en cada fila, que es con lo que se guarda una celda.
  const rutasServidor = useRef([])

  function applySharedDraft(draft) {
    const s = draft?.state
    if (!s?.rows) return
    // La referencia con la que se guarda una celda no puede salir de lo que hay
    // en pantalla: al escribir en la celda de la RUTA, lo de pantalla ya es el
    // texto nuevo y el servidor sigue con el viejo, así que no casaban y cada
    // tecla devolvía un 409 «las filas han cambiado». La celda de la ruta no se
    // guardaba NUNCA (76 veces en FlotaDSP entre el 02 y el 19-09-2026).
    rutasServidor.current = s.rows.map((r) => r?.ruta)
    // Las celdas con un guardado pendiente no se tocan: su versión del
    // servidor llega medio segundo tarde y borraría las últimas letras. Forma
    // funcional de `setData` A PROPÓSITO: esto lo llama un temporizador.
    setData(prev => {
      const pend = Object.keys(celdaTimers.current)
      const rows = (pend.length && prev?.rows?.length)
        ? s.rows.map((r, i) => {
            const mios = {}
            for (const k of pend) {
              const [fila, campo] = k.split(':')
              if (Number(fila) === i && prev.rows[i] && campo in prev.rows[i]) mios[campo] = prev.rows[i][campo]
            }
            return Object.keys(mios).length ? { ...r, ...mios } : r
          })
        : s.rows
      return { week: s.week, date: s.date, rows }
    })
    setRedSet(new Set(s.red_routes || [])); setYellowSet(new Set(s.yellow_routes || []))
    setPinkSet(new Set(s.pink_furgos || [])); setMarkedSet(new Set(s.marked_conductors || []))
    setSharedDraft({ id: draft.id, revision: draft.revision, updated_by: draft.updated_by })
    setSharedNote(`${t('pg.compartida')} ${draft.updated_by || t('pg.otroUsuario')}`)
    setStep('preview')
  }

  // Al abrir el mismo centro en otro equipo, se une al borrador reciente.
  useEffect(() => {
    if (noCenter || step !== 'upload' || suppressJoin.current) return
    apiFetch(`/tools/plantilla-compartida?center=${encodeURIComponent(center)}`)
      .then(r => r.json()).then(d => { if (d?.id) applySharedDraft(d) }).catch(() => {})
  }, [center, noCenter, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambiar de centro reactiva el auto-unirse (la supresión era para ESTE centro).
  useEffect(() => { suppressJoin.current = false }, [center])

  // Los cambios de los demás aparecen solos cada 2,5 s.
  useEffect(() => {
    if (!sharedDraft?.id) return
    const id = setInterval(async () => {
      try {
        const d = await (await apiFetch(`/tools/plantilla-compartida/${sharedDraft.id}`)).json()
        if (d.revision > sharedDraft.revision) applySharedDraft(d)
      } catch { /* sin red: al siguiente intento */ }
    }, 2500)
    return () => clearInterval(id)
  }, [sharedDraft?.id, sharedDraft?.revision]) // eslint-disable-line react-hooks/exhaustive-deps

  /* AQUÍ NO SE GUARDA NUNCA LA HOJA ENTERA. Guardar una celda devuelve la
     revisión nueva y el cliente se la queda sin recargar los datos: con la
     revisión al día y los datos viejos, un guardado completo pasaba la
     comprobación y borraba lo de la otra persona con un 200 limpio
     (reproducido en FlotaDSP el 04-09-2026). Cada cambio manda SOLO lo que ha
     cambiado, y las operaciones del servidor son de las que no pueden pisarse. */
  const mandar = useCallback(async (ruta, opciones) => {
    if (!sharedDraft?.id) return null
    try {
      const r = await apiFetch(`/tools/plantilla-compartida/${sharedDraft.id}${ruta}`, opciones)
      const saved = await r.json()
      if (saved?.state?.rows) applySharedDraft(saved)
      else setSharedDraft(p => p && ({ ...p, revision: saved.revision, updated_by: saved.updated_by }))
      setSharedNote(t('pg.sync'))
      return saved
    } catch {
      // 409: las filas se movieron. Se recarga y se sigue desde ahí.
      try {
        const d = await (await apiFetch(`/tools/plantilla-compartida/${sharedDraft.id}`)).json()
        if (d?.id) applySharedDraft(d)
      } catch { setSharedNote(t('pg.conflicto')) }
      return null
    }
  }, [sharedDraft?.id, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const json = (cuerpo) => ({
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  })

  // Vehículos que pueden salir hoy en el centro
  const [furgosDisp, setFurgosDisp] = useState([])
  useEffect(() => {
    if (noCenter) return
    getVehicles(center)
      .then(r => {
        const plates = lista(r.data)
          // Fuera los que están en taller y los bloqueados con el candado de su ficha.
          .filter(v => (v.status === 'active' || v.status === 'activo') && !v.bloqueada)
          .map(v => (v.license_plate || v.id || '').replace(/\s/g, '').toUpperCase())
          .filter(Boolean)
          .sort()
        setFurgosDisp(plates)
      })
      .catch(() => {})
  }, [center, noCenter])

  // Un pastel por hora de salida distinta, para ver las tandas de un vistazo.
  const waveColorMap = useMemo(() => {
    const PALETA = ['#DBEAFE', '#DCFCE7', '#FEF3C7', '#FFE4E6', '#EDE9FE', '#ECFDF5']
    if (!data?.rows) return {}
    const times = [...new Set(data.rows.map(r => (r.h_salida || '').trim()).filter(Boolean))].sort()
    return Object.fromEntries(times.map((h, i) => [h, PALETA[i % PALETA.length]]))
  }, [data])
  const refRutas = useRef()
  const refVeh = useRef()

  function addFiles(files, setter) {
    const items = Array.from(files).filter(f => f.type.startsWith('image/'))
      .map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setter(prev => [...prev, ...items])
    setErr('')
  }
  function removeFile(idx, setter) { setter(prev => prev.filter((_, i) => i !== idx)) }

  function reset() {
    // Cierra el borrador compartido para TODOS los dispositivos.
    suppressJoin.current = true
    const draftId = sharedDraft?.id
    if (draftId) apiFetch(`/tools/plantilla-compartida/${draftId}`, { method: 'DELETE' }).catch(() => {})
    setRutasList([]); setVehList([]); setVehText(''); setRutasText('')
    setStep('upload'); setData(null); setAviso('')
    setRedSet(new Set()); setYellowSet(new Set()); setPinkSet(new Set()); setMarkedSet(new Set())
    setCopiedHours(null); setErr('')
    setSharedDraft(null); setSharedNote('')
  }

  // La hoja nueva se comparte con el resto del centro en cuanto existe.
  async function empezar(datos) {
    setData(datos)
    setRedSet(new Set()); setYellowSet(new Set()); setPinkSet(new Set()); setMarkedSet(new Set())
    setStep('preview')
    if (noCenter) return
    try {
      const shared = await (await apiFetch('/tools/plantilla-compartida', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ center, state: { ...datos, red_routes: [], yellow_routes: [], pink_furgos: [], marked_conductors: [] } }),
      })).json()
      suppressJoin.current = false
      rutasServidor.current = (datos.rows || []).map(r => r?.ruta)
      setSharedDraft({ id: shared.id, revision: shared.revision, updated_by: shared.updated_by })
      setSharedNote(t('pg.creada'))
    } catch (e) { setErr(e?.message || t('pg.eDesconocido')) }
  }

  const hayRutas = rutasList.length > 0 || rutasText.trim().length > 0
  const hayVeh = vehList.length > 0 || vehText.trim().length > 0

  async function extraer() {
    if (!hayVeh) return
    setLoading(true); setErr(''); setAviso('')
    try {
      const fd = new FormData()
      vehList.forEach(f => fd.append('vehiculos', f.file))
      rutasList.forEach(f => fd.append('rutas', f.file))
      if (vehText.trim()) fd.append('vehiculos_texto', vehText.trim())
      if (rutasText.trim()) fd.append('rutas_texto', rutasText.trim())
      fd.append('redondeo', String(tramo))
      const resp = await apiFetch('/tools/plantilla-extraer', { method: 'POST', body: fd })
      const j = await resp.json()
      if (j.sin_ia) setAviso(t('pg.sinIA'))
      if (!j.rows?.length) { setErr(t('pg.nadaLeido')); setLoading(false); return }
      await empezar(j)
    } catch (e) { setErr(e?.message || t('pg.eDesconocido')) }
    setLoading(false)
  }

  async function desdeAsignacion() {
    if (noCenter) return
    setLoading(true); setErr(''); setAviso('')
    try {
      const r = await plantillaDesdeAsignacion(center)
      if (!r.data?.rows?.length) { setErr(t('pg.sinAsig')); setLoading(false); return }
      await empezar(r.data)
    } catch (e) { setErr(e?.response?.data?.detail || e?.message || t('pg.eDesconocido')) }
    setLoading(false)
  }

  function enBlanco() {
    empezar({ week: '', date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      rows: [{ ruta: '', conductor: '', movil: '', furgo: '', h_salida: '', h_bajada: '', h_llegada: '', observaciones: '' }] })
  }

  async function descargar() {
    setLoading(true); setErr('')
    try {
      const resp = await apiFetch('/tools/plantilla-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: data.rows,
          red_routes: [...redSet],
          yellow_routes: [...yellowSet],
          pink_furgos: [...pinkSet],
          marked_conductors: [...markedSet],
          week: data.week,
          date: data.date,
          hide_nave_yard: hideNY,
          save: !noCenter,
          center: noCenter ? '' : center,
        }),
      })
      const blob = await resp.blob()
      const cd = resp.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="?([^"]+)"?/)
      descargarBlob(blob, m?.[1] || 'plantilla.xlsx')
      setStep('done')
    } catch (e) { setErr(e?.message || t('pg.eExcel')) }
    setLoading(false)
  }

  /* Una marca de color viaja sola con `$addToSet`/`$pull`: dos personas
     marcando cosas distintas no pueden pisarse. */
  function toggle(set, setter, key, tipo) {
    if (!key) return
    const activo = !set.has(key)
    setter(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
    if (tipo) mandar('/marca', json({ tipo, valor: key, activo }))
  }

  /* Cada celda viaja sola (`PATCH …/celda`): dos personas solo chocan si
     tocan LA MISMA celda; en todo lo demás los dos cambios conviven. */
  function guardarCelda(rowIdx, field, value, rutaRef) {
    if (!sharedDraft?.id) return
    const clave = `${rowIdx}:${field}`
    clearTimeout(celdaTimers.current[clave])
    celdaTimers.current[clave] = setTimeout(async () => {
      try {
        const r = await apiFetch(`/tools/plantilla-compartida/${sharedDraft.id}/celda`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fila: rowIdx, campo: field, valor: value, ruta_ref: rutaRef }),
        })
        const saved = await r.json()
        // La celda recién escrita está protegida: su temporizador sigue
        // registrado hasta el `finally` de abajo.
        if (saved?.state?.rows) applySharedDraft(saved)
        else setSharedDraft(p => p && ({ ...p, revision: saved.revision, updated_by: saved.updated_by }))
        setSharedNote(t('pg.sync'))
      } catch {
        // Las filas se movieron (alguien añadió o quitó una): se recarga.
        try {
          const d = await (await apiFetch(`/tools/plantilla-compartida/${sharedDraft.id}`)).json()
          if (d?.id) applySharedDraft(d)
        } catch { setSharedNote(t('pg.conflicto')) }
      } finally { delete celdaTimers.current[clave] }
    }, 500)
  }

  function editCell(rowIdx, field, value) {
    if (field !== '_paste_hours') {
      guardarCelda(rowIdx, field, value, rutasServidor.current[rowIdx] ?? data?.rows?.[rowIdx]?.ruta)
      celdaEnFoco.current = { fila: rowIdx, campo: field }
      clearTimeout(focoTimer.current)
      focoTimer.current = setTimeout(() => { celdaEnFoco.current = null }, 3000)
    }
    setData(prev => ({
      ...prev,
      rows: prev.rows.map((r, i) => {
        if (i !== rowIdx) return r
        if (field === '_paste_hours') return { ...r, h_salida: value.h_salida || r.h_salida, h_llegada: value.h_llegada || r.h_llegada, h_bajada: value.h_bajada || r.h_bajada }
        return { ...r, [field]: value }
      }),
    }))
    if (field === '_paste_hours') {
      for (const h of ['h_salida', 'h_llegada', 'h_bajada']) {
        if (value[h]) guardarCelda(rowIdx, h, value[h], rutasServidor.current[rowIdx] ?? data?.rows?.[rowIdx]?.ruta)
      }
    }
  }
  // Lo único que le importa al reparto de furgonetas: quién, cuál y a qué hora sale.
  const firmaFurgos = useMemo(() => (data?.rows || [])
    .map(r => `${r.conductor || ''}|${r.furgo || ''}|${r.h_salida || ''}`).join('\n'), [data?.rows])

  async function pedirFurgos(completar) {
    const r = await plantillaFurgos({
      center, completar,
      rows: (data?.rows || []).map(r => ({ conductor: r.conductor, furgo: r.furgo, h_salida: r.h_salida })),
    })
    return r.data || {}
  }

  /* «Poner furgonetas»: solo se rellenan las celdas VACÍAS y solo con lo que
     el servidor marca para aplicar (principal o secundaria; con «Completar»,
     también las libres). Se escribe celda a celda como una persona, así que
     quien edita a la vez lo ve igual. */
  async function ponerFurgonetas(completar) {
    if (noCenter || !data?.rows) return
    setPoniendo(true); setPonerNota('')
    try {
      const j = await pedirFurgos(completar)
      const nuevas = {}
      let n = 0
      for (const p of lista(j.propuestas)) {
        if (!p.aplicar || (data.rows[p.fila]?.furgo || '').trim()) continue
        editCell(p.fila, 'furgo', p.furgo)
        nuevas[p.fila] = { tipo: p.tipo, motivos: lista(p.motivos) }
        n++
      }
      setAutoPuestas(prev => ({ ...prev, ...nuevas }))
      setFurgosIA(j)
      setPonerNota(n ? `${n} ${t('pg.ff.puestas')}` : t('pg.ff.ningunaNueva'))
    } catch (e) {
      setPonerNota(e?.response?.data?.detail || 'No se pudo calcular')
    } finally { setPoniendo(false) }
  }

  function editFurgo(i, v) {
    editCell(i, 'furgo', v)
    setAutoPuestas(prev => { if (!(i in prev)) return prev; const n = { ...prev }; delete n[i]; return n })
  }

  // Las sugerencias del desplegable y los avisos de la fila, al día tras cada cambio.
  useEffect(() => {
    if (step !== 'preview' || noCenter || !data?.rows?.length) return
    let vivo = true
    const tm = setTimeout(() => {
      pedirFurgos(false).then(j => { if (vivo) setFurgosIA(j) }).catch(() => {})
    }, 1500)
    return () => { vivo = false; clearTimeout(tm) }
  }, [firmaFurgos, step, center]) // eslint-disable-line react-hooks/exhaustive-deps

  function editMeta(field, value) {
    setData(prev => ({ ...prev, [field]: value }))
    clearTimeout(metaTimer.current)
    metaTimer.current = setTimeout(() => mandar('/meta', json({ [field]: value })), 500)
  }

  // Validar contra lo que la empresa ya sabe, medio segundo después del último cambio.
  useEffect(() => {
    if (step !== 'preview' || !data?.rows) return
    let vivo = true
    const tm = setTimeout(async () => {
      try {
        const resp = await apiFetch('/tools/plantilla-validar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: data.rows, center: noCenter ? '' : center, date: data.date }),
        })
        const j = await resp.json()
        if (!vivo) return
        setAvisos(j.avisos || [])
        setConAsignacion(!!j.con_asignacion)
      } catch { /* sin validación no se bloquea nada */ }
    }, 600)
    return () => { vivo = false; clearTimeout(tm) }
  }, [data?.rows, data?.date, step]) // eslint-disable-line react-hooks/exhaustive-deps
  const conAviso = new Set(avisos.map(a => `${a.fila}:${a.campo}`))

  /* Añadir y quitar filas mueven los ÍNDICES, de los que se fía el guardado
     por celda: van al servidor y la versión buena vuelve de allí. */
  async function addRow() {
    setAutoPuestas({})
    setData(prev => ({
      ...prev,
      rows: [...prev.rows, { ruta: '', conductor: '', movil: '', furgo: '', h_salida: '', h_bajada: '', h_llegada: '', observaciones: '' }],
    }))
    await mandar('/fila', { method: 'POST' })
  }

  async function removeRow(idx) {
    setAutoPuestas({})
    const ref = rutasServidor.current[idx] ?? data?.rows?.[idx]?.ruta ?? ''
    setData(prev => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))
    await mandar(`/fila/${idx}?ruta_ref=${encodeURIComponent(ref || '')}`, { method: 'DELETE' })
  }

  const cabeceras = [t('pg.col.ruta'), t('pg.col.conductor'), t('pg.col.movil'), t('pg.col.furgo'),
    ...(hideNY ? [] : [t('pg.col.llegada'), t('pg.col.carga')]), t('pg.col.salida'), t('pg.col.obs'), '', '', '']

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="rise font-display text-[clamp(26px,3vw,36px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">
            {t('pg.titulo')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-dark-400">{t('pg.sub')}</p>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="btn-ghost flex shrink-0 items-center gap-1.5 text-xs text-dark-400">
            <RotateCcw size={13} /> {t('pg.nueva')}
          </button>
        )}
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-dark-800">
        {[['plantilla', 'pg.tab.plantilla', FileSpreadsheet], ['fijas', 'pg.tab.fijas', Car]].map(([k, key, Icon]) => (
          <button key={k} type="button" onClick={() => cambiarVista(k)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors ${
              vista === k ? 'border-brand-400 font-semibold text-dark-50' : 'border-transparent text-dark-400 hover:text-dark-200'}`}>
            <Icon size={13} /> {t(key)}
          </button>
        ))}
      </nav>
      {vista === 'fijas' ? <FurgonetasFijas center={center} /> : (<>
      <Historial center={center} />

      {/* ── PASO 1: traer los datos ── */}
      {step === 'upload' && (
        <>
          {!noCenter && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-dark-700 bg-dark-900/60 px-4 py-3">
              <ClipboardCheck size={16} className="shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-dark-100">{t('pg.desdeAsig')}</p>
                <p className="text-xs text-dark-500">{t('pg.desdeAsigDesc')}</p>
              </div>
              <button onClick={desdeAsignacion} disabled={loading} className="btn-ghost text-xs text-brand-300 disabled:opacity-40">
                {t('pg.usarAsig')}
              </button>
              <button onClick={enBlanco} disabled={loading} className="btn-ghost text-xs text-dark-300 disabled:opacity-40">
                {t('pg.enBlanco')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <MultiDropZone
                label={t('pg.dzPlat')}
                hint={t('pg.dzPlatHint')}
                items={vehList}
                onAdd={files => addFiles(files, setVehList)}
                onRemove={i => removeFile(i, setVehList)}
                inputRef={refVeh}
                required
              />
              <PasteBox value={vehText} onChange={setVehText} abierto
                placeholder={'Rodriguez Arias, Andrea\t7906NFX\nLuis Gómez Vidal\t0116 MBP'} />
            </div>
            <div>
              <MultiDropZone
                label={t('pg.dzRutas')}
                hint={t('pg.dzRutasHint')}
                items={rutasList}
                onAdd={files => addFiles(files, setRutasList)}
                onRemove={i => removeFile(i, setRutasList)}
                inputRef={refRutas}
                optional
              />
              <PasteBox value={rutasText} onChange={setRutasText}
                placeholder={'R12\tANDREA RODRIGUEZ\t10:20\nR13\tLUIS GOMEZ\t10:40'} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-dark-400">
            <label htmlFor="pg-tramo">{t('pg.redondeo')}</label>
            <select id="pg-tramo" value={tramo} onChange={e => cambiarTramo(Number(e.target.value))}
              className="rounded border border-dark-600 bg-dark-800 px-2 py-1 text-xs text-dark-100 focus:border-brand-500 focus:outline-none">
              {TRAMOS.map(n => <option key={n} value={n}>{n ? `${t('pg.tramosDe')} ${n} min` : t('pg.redondeoNo')}</option>)}
            </select>
          </div>

          {hayVeh && (
            <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${hayRutas ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-amber-500/20 bg-amber-500/5 text-amber-300'}`}>
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>{hayRutas ? t('pg.infoCompleto') : t('pg.infoSolo')}</span>
            </div>
          )}

          {err && <ErrBanner msg={err} />}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            {noCenter && <p className="text-xs text-amber-400">{t('pg.avisoCentro')}</p>}
            <div className="ml-auto">
              <button onClick={extraer} disabled={!hayVeh || loading} className="btn-primary flex items-center gap-2 disabled:opacity-40">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> {t('pg.analizando')}</>
                  : <><FileSpreadsheet size={16} /> {hayRutas ? t('pg.extraerCompleto') : t('pg.extraerPlat')}</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── PASO 2: tabla editable ── */}
      {step === 'preview' && data && (
        <>
          {sharedNote && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {sharedNote}
            </div>
          )}
          {aviso && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
              <Info size={13} className="mt-0.5 shrink-0" /> {aviso}
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="pg-semana" className="text-xs text-dark-400">{t('pg.semana')}</label>
              <input id="pg-semana" value={data.week ?? ''} onChange={e => editMeta('week', e.target.value)}
                className="w-16 rounded border border-dark-600 bg-dark-800 px-2 py-1 text-center text-xs font-bold text-brand-200 focus:border-brand-500 focus:outline-none" />
              <label htmlFor="pg-fecha" className="text-xs text-dark-400">{t('pg.fecha')}</label>
              <input id="pg-fecha" value={data.date ?? ''} onChange={e => editMeta('date', e.target.value)}
                className="w-28 rounded border border-dark-600 bg-dark-800 px-2 py-1 text-center text-xs focus:border-brand-500 focus:outline-none" />
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => ponerFurgonetas(false)} disabled={poniendo || noCenter} title={t('pg.ff.ponerTip')}
                className="btn-primary flex items-center gap-1.5 px-3 py-1 text-xs disabled:opacity-40">
                {poniendo ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} {t('pg.ff.poner')}
              </button>
              <button type="button" onClick={() => ponerFurgonetas(true)} disabled={poniendo || noCenter} title={t('pg.ff.completarTip')}
                className="btn-ghost px-2 py-1 text-xs text-dark-300 disabled:opacity-40">
                {t('pg.ff.completar')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-dark-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-flex gap-0.5">
                  {['#DBEAFE', '#DCFCE7', '#FEF3C7'].map((c, i) => (
                    <span key={i} className="h-3 w-3 rounded-sm border border-gray-300" style={{ background: c }} />
                  ))}
                </span>
                {t('pg.legOla')}
              </span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-yellow-300 bg-[#FFF2CC]" /> {t('pg.legAmarillo')}</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-red-400 bg-red-500" /> {t('pg.legRojo')}</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-pink-300 bg-pink-200" /> {t('pg.legRosa')}</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-orange-200 bg-[#FCE4D6]" /> {t('pg.legNaranja')}</span>
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-dark-300">
                <input type="checkbox" checked={!hideNY} onChange={e => cambiarHideNY(!e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
                {t('pg.colNY')}
              </label>
            </div>
          </div>

          {copiedHours && (
            <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs">
              <ClipboardPaste size={13} className="shrink-0 text-brand-400" />
              <span className="font-medium text-brand-300">
                {t('pg.horasCopiadas')} <b>{copiedHours.h_llegada || '—'}</b> {t('pg.llegada')} · <b>{copiedHours.h_bajada || '—'}</b> {t('pg.bajada')} · <b>{copiedHours.h_salida || '—'}</b> {t('pg.salida')}
              </span>
              <button
                onClick={() => {
                  setData(prev => ({
                    ...prev,
                    rows: prev.rows.map(r => ({
                      ...r,
                      h_llegada: copiedHours.h_llegada || r.h_llegada,
                      h_bajada: copiedHours.h_bajada || r.h_bajada,
                      h_salida: copiedHours.h_salida || r.h_salida,
                    })),
                  }))
                  // Solo las tres horas: lo que haya escrito la otra persona en
                  // el resto de columnas no se toca.
                  mandar('/horas', json({
                    h_llegada: copiedHours.h_llegada || '', h_bajada: copiedHours.h_bajada || '',
                    h_salida: copiedHours.h_salida || '',
                  }))
                }}
                className="ml-auto rounded bg-brand-500/20 px-2 py-0.5 font-semibold text-brand-300 transition hover:bg-brand-500/40">
                {t('pg.pegarTodos')}
              </button>
              <button onClick={() => setCopiedHours(null)} aria-label={t('pg.borrar')} className="text-dark-500 hover:text-dark-200">
                <X size={13} />
              </button>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-amber-200">
                <AlertCircle size={14} /> {avisos.length} {t('pg.avisos.titulo')}
                {conAsignacion && <span className="text-[11px] font-normal text-amber-300/70">· {t('pg.avisos.asignacion')}</span>}
              </div>
              <ul className="space-y-1">
                {avisos.slice(0, 30).map((a, k) => (
                  <li key={k} className="flex flex-wrap items-center gap-2 text-[12px] text-dark-200">
                    <span className="cifra rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-dark-400">{t('pg.fila')} {a.fila + 1}</span>
                    <span className="text-dark-400">{CAMPO_KEY[a.campo] ? t(CAMPO_KEY[a.campo]) : a.campo}</span>
                    <span>{a.texto}</span>
                    {a.sugerencia && (
                      <button onClick={() => editCell(a.fila, a.campo, a.sugerencia)}
                        className="rounded-md border border-amber-400/40 px-2 py-0.5 text-[11.5px] font-semibold text-amber-200 hover:bg-amber-500/15">
                        {t('pg.avisos.aplicar')} «{a.sugerencia}»
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {avisos.length === 0 && data.rows.length > 0 && (
            <p className="mb-3 flex items-center gap-1.5 text-[12px] text-emerald-300"><CheckCircle2 size={13} /> {t('pg.avisos.ok')}</p>
          )}
          <AvisosFurgos info={furgosIA} nota={ponerNota} filas={data.rows} />
          <div className="overflow-x-auto rounded-xl border border-dark-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#FFD966] text-black">
                  {cabeceras.map((h, i) => (
                    <th key={i} className="whitespace-nowrap border border-[#BFBFBF] px-2 py-1.5 text-center font-bold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => {
                  const rowKey = (row.ruta || row.conductor || String(i)).toUpperCase()
                  const isRed = redSet.has(rowKey)
                  const isYellow = !isRed && yellowSet.has(rowKey)
                  const isPink = !!row.furgo && pinkSet.has(row.furgo.toUpperCase())
                  const isMarked = !!row.conductor && markedSet.has(row.conductor.toUpperCase())
                  const rowBg = isRed ? 'bg-red-600' : isYellow ? 'bg-[#FFF2CC]' : 'bg-white'
                  const textCl = isRed ? 'text-white' : 'text-gray-900'
                  const waveColor = (!isRed && !isYellow && row.h_salida) ? (waveColorMap[row.h_salida.trim()] || null) : null
                  const anillo = (campo) => (conAviso.has(`${i}:${campo}`) ? 'ring-2 ring-amber-500 rounded' : '')

                  return (
                    <tr key={i} className={`border-t border-[#BFBFBF] ${rowBg}`}>
                      <td className="border border-[#BFBFBF] px-1 py-0.5">
                        <EditCell value={row.ruta} onChange={v => editCell(i, 'ruta', v)} extraCls={`text-center font-bold ${textCl}`} label={t('pg.col.ruta')} />
                      </td>
                      <td className={`border border-[#BFBFBF] px-1 py-0.5 ${isMarked && !isRed ? 'bg-[#FCE4D6]' : ''}`}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggle(markedSet, setMarkedSet, (row.conductor || '').toUpperCase(), 'marked_conductors')}
                            title={t('pg.tMarcar')} aria-label={t('pg.tMarcar')}
                            className={`h-3.5 w-3.5 shrink-0 rounded-sm border transition ${isMarked ? 'border-orange-500 bg-orange-300' : 'border-gray-300 hover:border-orange-400'}`} />
                          <EditCell value={row.conductor} onChange={v => editCell(i, 'conductor', v)} label={t('pg.col.conductor')}
                            extraCls={`min-w-[140px] ${isMarked && !isRed ? 'font-semibold text-orange-900' : textCl} ${anillo('conductor')}`} />
                        </div>
                      </td>
                      <td className="border border-[#BFBFBF] px-1 py-0.5">
                        <EditCell value={row.movil} onChange={v => editCell(i, 'movil', v)} extraCls={`text-center ${textCl}`} label={t('pg.col.movil')} />
                      </td>
                      <td className={`border border-[#BFBFBF] px-1 py-0.5 ${isPink && !isRed ? 'bg-pink-200' : ''} ${anillo('furgo')}`}>
                        <FurgoCell
                          value={row.furgo}
                          onChange={v => editFurgo(i, v)}
                          opciones={lista(furgosIA?.opciones?.[String(i)])}
                          auto={autoPuestas[i]}
                          isPink={isPink && !isRed}
                          furgosDisp={furgosDisp}
                          usedFurgos={data.rows.filter((_, ri) => ri !== i).map(r => (r.furgo || '').toUpperCase()).filter(Boolean)}
                          onTogglePink={() => toggle(pinkSet, setPinkSet, (row.furgo || '').toUpperCase(), 'pink_furgos')}
                          textCl={textCl}
                        />
                      </td>
                      {!hideNY && (<>
                        <td className="border border-[#BFBFBF] px-1 py-0.5" style={waveColor ? { background: waveColor } : {}}>
                          <EditCell value={row.h_llegada} onChange={v => editCell(i, 'h_llegada', v)} extraCls={`text-center font-mono ${textCl} ${anillo('h_llegada')}`} label={t('pg.col.llegada')} />
                        </td>
                        <td className="border border-[#BFBFBF] px-1 py-0.5" style={waveColor ? { background: waveColor } : {}}>
                          <EditCell value={row.h_bajada} onChange={v => editCell(i, 'h_bajada', v)} extraCls={`text-center font-mono ${textCl} ${anillo('h_bajada')}`} label={t('pg.col.carga')} />
                        </td>
                      </>)}
                      <td className="border border-[#BFBFBF] px-1 py-0.5" style={waveColor ? { background: waveColor } : {}}>
                        <EditCell value={row.h_salida} onChange={v => editCell(i, 'h_salida', v)} extraCls={`text-center font-mono ${textCl} ${anillo('h_salida')}`} label={t('pg.col.salida')} />
                      </td>
                      <td className="border border-[#BFBFBF] px-1 py-0.5">
                        <EditCell value={row.observaciones} onChange={v => editCell(i, 'observaciones', v)} extraCls={`min-w-[100px] ${textCl}`} label={t('pg.col.obs')} />
                      </td>
                      <td className="border border-[#BFBFBF] px-1 py-0.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => toggle(yellowSet, setYellowSet, rowKey, 'yellow_routes')}
                            title={t('pg.tAmarilla')} aria-label={t('pg.tAmarilla')}
                            className={`h-3.5 w-3.5 rounded-sm border transition ${isYellow ? 'border-yellow-500 bg-yellow-300' : 'border-gray-300 hover:border-yellow-400'}`} />
                          <button onClick={() => toggle(redSet, setRedSet, rowKey, 'red_routes')}
                            title={t('pg.tRoja')} aria-label={t('pg.tRoja')}
                            className={`h-3.5 w-3.5 rounded-sm border transition ${isRed ? 'border-red-300 bg-red-500' : 'border-gray-300 hover:border-red-400'}`} />
                        </div>
                      </td>
                      <td className="border border-[#BFBFBF] px-1 py-0.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => setCopiedHours({ h_salida: row.h_salida, h_llegada: row.h_llegada, h_bajada: row.h_bajada })}
                            title={t('pg.tCopiar')} aria-label={t('pg.tCopiar')}
                            className="rounded p-0.5 text-gray-400 transition hover:text-blue-500">
                            <Copy size={11} />
                          </button>
                          {copiedHours && (
                            <button onClick={() => editCell(i, '_paste_hours', copiedHours)}
                              title={t('pg.tPegar')} aria-label={t('pg.tPegar')}
                              className="rounded p-0.5 text-gray-400 transition hover:text-brand-500">
                              <ClipboardPaste size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="border border-[#BFBFBF] px-1 py-0.5 text-center">
                        <button onClick={() => removeRow(i)} aria-label={t('pg.quitarFila')} title={t('pg.quitarFila')}
                          className="text-gray-400 transition hover:text-red-500">
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2">
            <button onClick={addRow} className="btn-ghost flex items-center gap-1.5 text-xs text-dark-400 hover:text-brand-300">
              <Plus size={13} /> {t('pg.addFila')}
            </button>
          </div>

          {err && <ErrBanner msg={err} />}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-dark-500">
              {redSet.size > 0 && <span><span className="font-semibold text-red-400">{redSet.size} {t('pg.enRojo')}</span> {[...redSet].join(', ')}</span>}
              {yellowSet.size > 0 && <span><span className="font-semibold text-yellow-400">{yellowSet.size} {t('pg.enAmarillo')}</span> {[...yellowSet].join(', ')}</span>}
              {pinkSet.size > 0 && <span><span className="font-semibold text-pink-400">{pinkSet.size} {t('pg.furgoRosa')}</span> {[...pinkSet].join(', ')}</span>}
              {redSet.size === 0 && yellowSet.size === 0 && pinkSet.size === 0 && (
                <span>{t('pg.sinMarcas')} — {data.rows.length} {t('pg.conductores')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {noCenter && <span className="text-xs text-amber-400">{t('pg.sinCentro')}</span>}
              <button onClick={descargar} disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-40">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> {t('pg.generando')}</>
                  : <><Download size={16} /> {!noCenter ? t('pg.descargarGuardar') : t('pg.descargar')}</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── PASO 3: descargada ── */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-12 text-center">
          <CheckCircle2 size={36} className="text-emerald-400" />
          <p className="text-lg font-semibold text-emerald-300">{!noCenter ? t('pg.descargadaGuardada') : t('pg.descargada')}</p>
          {!noCenter && <p className="text-sm text-dark-400">{t('pg.disponibleEn')} <b className="text-dark-200">{center}</b>.</p>}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button onClick={() => setStep('preview')} className="btn-ghost flex items-center gap-2 text-sm">
              {t('pg.volverHoja')}
            </button>
            <button onClick={reset} className="btn-primary flex items-center gap-2">
              <RotateCcw size={15} /> {t('pg.otra')}
            </button>
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}

/* Lo que dijo «Poner furgonetas»: cuántas puso, qué nombres no reconoce y, con
   la fila de aparcamiento apuntada, qué furgoneta tapa a cuál y qué hay que mover. */
function AvisosFurgos({ info, nota, filas }) {
  const { t } = useT()
  const sinNombre = lista(info?.sin_nombre)
  const mover = lista(info?.mover)
  const conflictos = lista(info?.conflictos)
  const vieja = !!info?.fila_actualizada && (Date.now() - new Date(info.fila_actualizada).getTime()) > 20 * 3600 * 1000
  if (!nota && !sinNombre.length && !mover.length && !conflictos.length && !vieja) return null
  return (
    <div className="mb-3 space-y-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-3 text-[12.5px] text-dark-200">
      {nota && <div className="flex items-center gap-1.5 font-semibold text-sky-200"><Wand2 size={13} /> {nota}</div>}
      {sinNombre.length > 0 && (
        <div>{t('pg.ff.sinNombre')} <span className="text-dark-100">{sinNombre.map(i => filas[i]?.conductor).filter(Boolean).join(' · ')}</span></div>
      )}
      {vieja && <div className="text-amber-200">{t('pg.ff.filaVieja')}</div>}
      {mover.map((m, k) => (
        <div key={`m${k}`} className="flex items-center gap-1.5 text-amber-200">
          <AlertTriangle size={13} /> {t('pg.ff.mover')} <b className="font-mono">{m.furgo}</b> {t('pg.ff.antesDe')} {m.antes_de}
        </div>
      ))}
      {conflictos.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-200"><AlertTriangle size={13} /> {t('pg.ff.conflictos')}</div>
          <ul className="space-y-0.5">
            {conflictos.slice(0, 20).map((c, k) => (
              <li key={k}>
                {t('ff.filaN')} {c.fila + 1}: <b className="font-mono">{c.tapa}</b>{' '}
                {c.motivo === 'no_sale' ? t('pg.ff.noSale') : t('pg.ff.saleDespues').replace('{h}', c.hora_tapa)}{' '}
                {t('pg.ff.tapaA')} <b className="font-mono">{c.a}</b> {t('pg.ff.queSale')} {c.hora}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const COLOR_AUTO = { principal: 'bg-brand-400', secundaria: 'bg-sky-400', historial: 'bg-gray-400', libre: 'bg-gray-300' }
const TIPO_KEY = {
  principal: 'pg.ff.tipo.principal', secundaria: 'pg.ff.tipo.secundaria',
  historial: 'pg.ff.tipo.historial', libre: 'pg.ff.tipo.libre',
}

function FurgoCell({ value, onChange, isPink, furgosDisp, usedFurgos, onTogglePink, textCl, opciones = [], auto }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    // Con el dedo, `mousedown` no siempre llega: `pointerdown` vale para los dos.
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  const used = new Set(usedFurgos)
  const available = furgosDisp.filter(f => !used.has(f))
  const occupied = furgosDisp.filter(f => used.has(f))
  // Las mejores para ESTE conductor (principal, secundaria, las que más ha
  // llevado), con el porqué; solo las que siguen libres.
  const paraEste = opciones.filter(o => o?.furgo && !used.has(String(o.furgo).toUpperCase()) && furgosDisp.includes(String(o.furgo).toUpperCase()))

  return (
    <div ref={ref} className="relative flex items-center gap-0.5">
      {auto && (
        <span title={`${t(TIPO_KEY[auto.tipo] || TIPO_KEY.libre)}${auto.motivos?.length ? ': ' + auto.motivos.join(' · ') : ''}`}
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR_AUTO[auto.tipo] || 'bg-gray-300'}`} />
      )}
      <input value={value || ''} onChange={e => onChange(e.target.value)} aria-label={t('pg.col.furgo')}
        className={`w-20 rounded bg-transparent px-1 py-0.5 text-center font-mono transition focus:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-yellow-400/60 ${isPink ? 'text-pink-900' : textCl}`} />
      <div className="flex shrink-0 items-center gap-0.5">
        {furgosDisp.length > 0 && (
          <button onClick={() => setOpen(v => !v)} title={t('pg.tVerFurgos')} aria-label={t('pg.tVerFurgos')}
            className={`rounded p-0.5 transition ${open ? 'text-brand-400' : 'text-gray-300 hover:text-brand-400'}`}>
            <Car size={11} />
          </button>
        )}
        <button onClick={onTogglePink} title={t('pg.tRosa')} aria-label={t('pg.tRosa')}
          className={`h-3 w-3 rounded-sm border transition ${isPink ? 'border-pink-500 bg-pink-300' : 'border-gray-300 hover:border-pink-400'}`} />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-60 overflow-y-auto rounded-lg border border-dark-600 bg-dark-900 text-xs shadow-xl">
          {paraEste.length > 0 && (
            <>
              <div className="bg-dark-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                {t('pg.ff.paraEste')}
              </div>
              {paraEste.map(o => (
                <button key={`p${o.furgo}`} onClick={() => { onChange(o.furgo); setOpen(false) }}
                  className="flex w-full flex-col px-3 py-1.5 text-left transition hover:bg-brand-500/10">
                  <span className="font-mono text-dark-100">{o.furgo}</span>
                  {o.motivo && <span className="text-[10.5px] leading-snug text-dark-400">{o.motivo}</span>}
                </button>
              ))}
            </>
          )}
          {available.length > 0 && (
            <>
              <div className="bg-dark-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                {t('pg.disponibles')} ({available.length})
              </div>
              {available.map(f => (
                <button key={f} onClick={() => { onChange(f); setOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-dark-100 transition hover:bg-emerald-500/10 hover:text-emerald-300">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" /> {f}
                </button>
              ))}
            </>
          )}
          {occupied.length > 0 && (
            <>
              <div className="border-t border-dark-700 bg-dark-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                {t('pg.yaAsignadas')} ({occupied.length})
              </div>
              {occupied.map(f => (
                <button key={f} onClick={() => { onChange(f); setOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-dark-500 transition hover:bg-amber-500/10 hover:text-amber-300">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" /> {f}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EditCell({ value, onChange, extraCls, label }) {
  return (
    <input value={value || ''} onChange={e => onChange(e.target.value)} aria-label={label}
      className={[
        'w-full rounded bg-transparent px-1 py-0.5 transition focus:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-yellow-400/60',
        extraCls || '',
      ].join(' ')} />
  )
}

function ErrBanner({ msg }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <AlertCircle size={15} className="mt-0.5 shrink-0" /> {msg}
    </div>
  )
}

/* Pegar es lo que se usa de verdad a primera hora: en la lista obligatoria la
   caja sale abierta, sin tener que buscarla. */
function PasteBox({ value, onChange, placeholder, abierto }) {
  const { t } = useT()
  const [open, setOpen] = useState(!!abierto)
  if (!open && !value) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-brand-400 hover:text-brand-300">
        {t('pg.pegaTexto')}
      </button>
    )
  }
  return (
    <div className="mt-2">
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={5}
        aria-label={t('pg.pegaTexto')}
        className="w-full rounded-lg border border-dark-700 bg-dark-900/60 px-3 py-2 font-mono text-xs text-dark-100 placeholder-dark-600 outline-none focus:border-brand-500" />
      <div className="mt-1 flex items-center justify-between text-[11px] text-dark-500">
        <span>{t('pg.pegaHint')}</span>
        {value && <button type="button" onClick={() => onChange('')} className="text-dark-400 hover:text-red-400">{t('pg.borrar')}</button>}
      </div>
    </div>
  )
}

function MultiDropZone({ label, hint, items, onAdd, onRemove, inputRef, optional, required }) {
  const { t } = useT()
  const [over, setOver] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-dark-200">{label}</p>
        {required && <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-400">{t('pg.requerido')}</span>}
        {optional && <span className="rounded-full bg-dark-700 px-1.5 py-0.5 text-[10px] text-dark-200">{t('pg.opcional')}</span>}
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <div key={i} className="relative h-20 w-20 flex-shrink-0">
              <img src={it.preview} alt="" className="h-20 w-20 rounded-lg border border-dark-600 object-cover" />
              <button onClick={() => onRemove(i)} aria-label={t('pg.borrar')}
                className="absolute -right-1.5 -top-1.5 rounded-full border border-dark-600 bg-dark-700 p-0.5 text-dark-300 hover:text-white">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        className={`flex h-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${over ? 'border-brand-400 bg-brand-500/10' : 'border-dark-600 bg-dark-900 hover:border-brand-500/50'}`}
      >
        <div className="flex items-center gap-2 text-dark-500">
          <Upload size={18} />
          <span className="text-xs">{items.length > 0 ? t('pg.masCapturas') : t('pg.arrastra')}</span>
        </div>
        {items.length === 0 && <span className="mt-1 px-4 text-center text-[10px] text-dark-500">{hint}</span>}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { onAdd(e.target.files); e.target.value = '' }} />
      </div>
    </div>
  )
}
