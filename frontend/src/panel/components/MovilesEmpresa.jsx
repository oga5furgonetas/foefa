import { useCallback, useEffect, useMemo, useState } from 'react'
import { Smartphone, Loader2, Plus, Trash2, Search, ClipboardPaste, Check, AlertTriangle, X } from 'lucide-react'
import {
  getMoviles, anadirMoviles, editarMovil, borrarMovil, guardarMovilesDe, pegarMoviles,
} from '../api'
import { lista } from '../../lib/lista'

/* MÓVILES DE EMPRESA — la extensión de cada móvil del centro y quién lo lleva.

   Dani, 30-09-2026: «ábreme otra pestaña aparte de vehículos que sea de
   móviles: poner las extensiones de todos los móviles, asignarlos a cada uno
   y poder ponerle 2 por si uno se lleva otro». En su hoja la columna MÓVIL es
   la extensión (4114, 1117…) o «PROPIO». Como las furgonetas fijas: cada
   conductor tiene SU móvil y uno DE RESERVA. «Poner móviles» en la plantilla
   pone el suyo y, si ese día ya lo lleva otro de la hoja, el de reserva;
   nunca el mismo móvil a dos personas. Todo se guarda al elegirlo. */

const PROPIO = 'PROPIO'

function Ext({ e, apagada }) {
  return (
    <span className={`inline-flex min-w-[3.4rem] justify-center rounded-md bg-sky-500/15 px-2 py-0.5 font-mono text-[13px] font-bold text-sky-300 ${
      apagada ? 'opacity-50 line-through' : ''}`}>{e}</span>
  )
}

/* Pegar la tabla CONDUCTOR → MÓVIL de la hoja: primero se enseña lo que se
   ha entendido, línea a línea, y solo se aplica lo que casa sin duda. */
function Pegar({ center, onHecho, onCerrar }) {
  const [texto, setTexto] = useState('')
  const [previa, setPrevia] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const ver = async () => {
    setOcupado(true); setErr('')
    try { setPrevia(lista((await pegarMoviles(center, texto, false)).data?.lineas)) } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido leer.')
    } finally { setOcupado(false) }
  }
  const aplicar = async () => {
    setOcupado(true); setErr('')
    try {
      const r = await pegarMoviles(center, texto, true)
      onHecho(`Puestos ${r.data?.puestos ?? 0}` + (lista(r.data?.altas).length ? ` · móviles nuevos: ${r.data.altas.join(', ')}` : '') + '.')
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido aplicar.')
    } finally { setOcupado(false) }
  }
  const buenas = lista(previa).filter((x) => x.estado === 'ok')
  const ESTADO = { sin_ficha: 'no sé quién es: no se toca', sin_movil: 'sin móvil en la línea', repetido: 'ya salía más arriba' }
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <ClipboardPaste size={15} className="text-brand-400" />
        <h3 className="text-sm font-bold text-dark-100">Pegar la lista de tu hoja</h3>
        <button onClick={onCerrar} aria-label="Cerrar" className="ml-auto text-dark-500 hover:text-dark-200"><X size={16} /></button>
      </div>
      <p className="text-[12.5px] text-dark-400">
        Copia de tu Excel las columnas CONDUCTOR y MÓVIL (la de FURGO puede venir, se ignora). Una persona por línea; si
        pones dos móviles, el segundo es el de reserva. «PROPIO» si usa el suyo.
      </p>
      <textarea value={texto} onChange={(e) => { setTexto(e.target.value); setPrevia(null) }} rows={6}
        aria-label="Lista de conductores y móviles" placeholder={'ALEX FANDIÑO OTERO\t1117\nBORJA BLANCO GUZMAN\t4114\t4115\nALINNE SOARES\tPROPIO'}
        className="input w-full font-mono text-[12.5px]" />
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={ver} disabled={ocupado || !texto.trim()}
          className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40">
          {ocupado && !previa ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Ver qué entiendo
        </button>
        {previa && (
          <button onClick={aplicar} disabled={ocupado || !buenas.length}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40">
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aplicar {buenas.length}
          </button>
        )}
      </div>
      {previa && (
        <ul className="max-h-72 space-y-1 overflow-y-auto text-[12.5px]">
          {previa.map((x) => (
            <li key={x.linea} className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1 ${x.estado === 'ok' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
              <span className="text-dark-500">{x.linea}</span>
              <span className="font-semibold text-dark-100">{x.nombre}</span>
              {x.ficha && x.ficha.toUpperCase() !== x.nombre.toUpperCase() && <span className="text-dark-400">→ {x.ficha}</span>}
              {lista(x.moviles).map((m, k) => (
                <span key={k} className="flex items-center gap-1">{k === 1 && <span className="text-dark-500">reserva</span>}<Ext e={m} /></span>
              ))}
              {x.estado !== 'ok' && <span className="text-amber-300">{ESTADO[x.estado] || x.estado}</span>}
            </li>
          ))}
        </ul>
      )}
      {err && <p className="text-[12.5px] text-red-300">{err}</p>}
    </div>
  )
}

/* Filas en rejilla y no en tabla: en escritorio, una línea por móvil o por
   persona; en el móvil, dos. Con tabla, en el móvil el estado y la papelera
   se salían por la derecha y el aviso del compartido se estrujaba en una
   columna de dos palabras de ancho. */
const REJ_MOVIL = 'grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 sm:grid-cols-[4.5rem_9.5rem_minmax(8rem,1fr)_minmax(8rem,1fr)_5.5rem_1.25rem]'
const REJ_PERSONA = 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem] items-center gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_11rem_11rem_1rem]'
const CABECERA = 'px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-dark-500'

function FilaMovil({ m, onGuardar, onBorrar }) {
  const [numero, setNumero] = useState(m.numero || '')
  const [nota, setNota] = useState(m.nota || '')
  useEffect(() => { setNumero(m.numero || ''); setNota(m.nota || '') }, [m.numero, m.nota])
  const lleva = lista(m.de).map((x) => `${x.nombre}${x.como === 'reserva' ? ' (reserva)' : ''}`).join(' · ')
  // En escritorio el orden de las columnas lo ponen los sm:order-*; en el
  // móvil va arriba la extensión, quién lo lleva y los botones, y debajo los campos.
  return (
    <li className={`grid ${REJ_MOVIL} border-t border-dark-800/70 px-3 py-2 sm:py-1.5`}>
      <Ext e={m.extension} apagada={!m.activo} />
      <span className="min-w-0 truncate text-[12px] text-dark-300 sm:order-4" title={lleva || undefined}>
        {lleva || <span className="text-dark-500">nadie</span>}
      </span>
      <button onClick={() => onGuardar(m, { activo: !m.activo })} title={m.activo ? 'Darlo de baja: no se pone en la hoja' : 'Volver a usarlo'}
        className={`justify-self-start rounded-md px-2 py-0.5 text-[11px] font-semibold sm:order-5 ${m.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-dark-800 text-dark-400'}`}>
        {m.activo ? 'En uso' : 'De baja'}
      </button>
      <button onClick={() => onBorrar(m)} aria-label={`Quitar el ${m.extension}`} className="justify-self-end text-dark-500 hover:text-red-300 sm:order-6">
        <Trash2 size={14} />
      </button>
      <div className="col-span-4 grid grid-cols-2 gap-2 sm:contents">
        <input value={numero} onChange={(e) => setNumero(e.target.value)} aria-label={`Número del ${m.extension}`}
          onBlur={() => numero !== (m.numero || '') && onGuardar(m, { numero })} placeholder="número (opcional)"
          className="input w-full py-1 text-[12.5px] sm:order-2" />
        <input value={nota} onChange={(e) => setNota(e.target.value)} aria-label={`Nota del ${m.extension}`}
          onBlur={() => nota !== (m.nota || '') && onGuardar(m, { nota })} placeholder="nota (pantalla rota…)"
          className="input w-full py-1 text-[12.5px] sm:order-3" />
      </div>
    </li>
  )
}

function FilaConductor({ c, moviles, suyoDe, onCambio, guardando }) {
  const activos = moviles.filter((m) => m.activo)
  const extDe = (id) => moviles.find((m) => m.id === id)
  const etiqueta = (m, excluir) => {
    const otros = lista(suyoDe[m.id]).filter((n) => n.id !== excluir)
    return `${m.extension}${!m.activo ? ' (de baja)' : ''}${otros.length ? ` · de ${otros.map((o) => o.nombre.split(' ')[0]).join(', ')}` : ''}`
  }
  const compartido = c.suyo && c.suyo !== PROPIO ? lista(suyoDe[c.suyo]).filter((o) => o.id !== c.id) : []
  const suyoM = c.suyo && c.suyo !== PROPIO ? extDe(c.suyo) : null
  const opciones = (actual) => {
    const vistos = new Set()
    const salida = []
    for (const m of [...activos, ...(actual && extDe(actual) && !extDe(actual).activo ? [extDe(actual)] : [])]) {
      if (!vistos.has(m.id)) { vistos.add(m.id); salida.push(m) }
    }
    return salida
  }
  // En el móvil, el nombre (y el aviso) en una línea y los dos móviles debajo.
  const titulo = 'mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-dark-500 sm:hidden'
  return (
    <li className={`grid ${REJ_PERSONA} border-t border-dark-800/70 px-3 py-2 sm:py-1.5`}>
      <div className="col-span-3 min-w-0 text-[12.5px] font-semibold text-dark-100 sm:col-span-1">
        {c.nombre}
        {compartido.length > 0 && (
          <span className="mt-0.5 flex items-start gap-1 text-[11px] font-normal text-amber-300">
            <AlertTriangle size={11} className="mt-[2px] shrink-0" />
            <span>
              El {suyoM?.extension} también es de {compartido.map((o) => o.nombre.split(' ')[0]).join(', ')}:
              si trabajan el mismo día, uno se lleva el de reserva.
            </span>
          </span>
        )}
      </div>
      <div className="min-w-0">
        <span className={titulo} aria-hidden="true">Su móvil</span>
        <select value={c.suyo || ''} disabled={guardando} aria-label={`Su móvil: ${c.nombre}`}
          onChange={(e) => onCambio(c, e.target.value || null, e.target.value === c.reserva ? null : c.reserva)}
          className="input w-full py-1 text-[12.5px]">
          <option value="">—</option>
          <option value={PROPIO}>Propio (el suyo)</option>
          {opciones(c.suyo).map((m) => <option key={m.id} value={m.id} disabled={!m.activo && m.id !== c.suyo}>{etiqueta(m, c.id)}</option>)}
        </select>
      </div>
      <div className="min-w-0">
        <span className={titulo} aria-hidden="true">De reserva</span>
        <select value={c.reserva || ''} disabled={guardando} aria-label={`De reserva: ${c.nombre}`}
          onChange={(e) => onCambio(c, c.suyo, e.target.value || null)}
          className="input w-full py-1 text-[12.5px]">
          <option value="">—</option>
          {opciones(c.reserva).filter((m) => m.id !== c.suyo).map((m) => (
            <option key={m.id} value={m.id} disabled={!m.activo && m.id !== c.reserva}>{etiqueta(m, c.id)}</option>
          ))}
        </select>
      </div>
      <span className="self-end pb-1.5 sm:self-center sm:pb-0">{guardando && <Loader2 size={13} className="animate-spin text-dark-400" />}</span>
    </li>
  )
}

export default function MovilesEmpresa({ center }) {
  const noCenter = !center || center === 'Todos'
  const [datos, setDatos] = useState(null)
  const [err, setErr] = useState('')
  const [aviso, setAviso] = useState('')
  const [nuevas, setNuevas] = useState('')
  const [anadiendo, setAnadiendo] = useState(false)
  const [busca, setBusca] = useState('')
  const [soloSin, setSoloSin] = useState(false)
  const [pegar, setPegar] = useState(false)
  const [guardando, setGuardando] = useState({})

  const cargar = useCallback(async () => {
    if (noCenter) return
    try {
      const r = await getMoviles(center)
      setDatos(r.data); setErr('')
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se han podido cargar los móviles.')
      setDatos((d) => d || { moviles: [], conductores: [] })
    }
  }, [center, noCenter])
  useEffect(() => { setDatos(null); cargar() }, [cargar])

  const moviles = lista(datos?.moviles)
  const conductores = lista(datos?.conductores)
  // Quién tiene cada móvil como SUYO (para avisar de los compartidos).
  const suyoDe = useMemo(() => {
    const m = {}
    for (const c of conductores) if (c.suyo && c.suyo !== PROPIO) (m[c.suyo] = m[c.suyo] || []).push({ id: c.id, nombre: c.nombre })
    return m
  }, [conductores])

  if (noCenter) return <p className="card p-5 text-dark-300">Elige un centro arriba: los móviles van por centro.</p>
  if (!datos) return <div className="card flex items-center gap-2 p-6 text-dark-400"><Loader2 size={16} className="animate-spin" /> Cargando los móviles…</div>

  const anadir = async () => {
    setAnadiendo(true); setErr(''); setAviso('')
    try {
      const r = await anadirMoviles(center, nuevas)
      const a = lista(r.data?.anadidas), rep = lista(r.data?.repetidas), mal = lista(r.data?.malas)
      setAviso([a.length ? `Añadidos: ${a.join(', ')}` : '', rep.length ? `ya estaban: ${rep.join(', ')}` : '',
        mal.length ? `no son extensiones: ${mal.join(', ')}` : ''].filter(Boolean).join(' · ') + '.')
      setNuevas('')
      await cargar()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se han podido añadir.')
    } finally { setAnadiendo(false) }
  }
  const guardarMovil = async (m, cambios) => {
    setErr('')
    try { await editarMovil(m.id, cambios); await cargar() } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido guardar.')
    }
  }
  const quitar = async (m) => {
    const lleva = lista(m.de)
    if (!window.confirm(`¿Quitar el móvil ${m.extension}?` + (lleva.length ? ` Lo tiene${lleva.length > 1 ? 'n' : ''} ${lleva.map((x) => x.nombre).join(', ')}: se les quita.` : ''))) return
    setErr('')
    try { await borrarMovil(m.id); await cargar() } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido quitar.')
    }
  }
  const cambiar = async (c, suyo, reserva) => {
    setGuardando((g) => ({ ...g, [c.id]: true })); setErr('')
    // Al momento en pantalla; si el servidor dice que no, se vuelve a lo que había.
    setDatos((d) => ({ ...d, conductores: lista(d?.conductores).map((x) => (x.id === c.id ? { ...x, suyo, reserva } : x)) }))
    try {
      await guardarMovilesDe(c.id, center, suyo, reserva)
      await cargar()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido guardar.')
      await cargar()
    } finally { setGuardando((g) => { const n = { ...g }; delete n[c.id]; return n }) }
  }

  const q = busca.trim().toLowerCase()
  const visibles = conductores.filter((c) => (!q || c.nombre.toLowerCase().includes(q)) && (!soloSin || !c.suyo))
  const conMovil = conductores.filter((c) => c.suyo).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Smartphone size={18} className="text-sky-300" />
        <p className="text-[13px] text-dark-300">
          <b className="text-dark-100">{moviles.length}</b> móviles en {center} · <b className="text-dark-100">{conMovil}</b> de {conductores.length} conductores
          con móvil. En la plantilla, «Poner móviles» pone el suyo y, si ese día ya lo lleva otro, el de reserva.
        </p>
        {!pegar && (
          <button onClick={() => setPegar(true)} className="btn-secondary ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <ClipboardPaste size={13} /> Pegar la lista de tu hoja
          </button>
        )}
      </div>
      {aviso && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-300">{aviso}</p>}
      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">{err}</p>}
      {pegar && <Pegar center={center} onCerrar={() => setPegar(false)}
        onHecho={async (txt) => { setPegar(false); setAviso(txt); await cargar() }} />}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-dark-800 px-3 py-2.5">
          <h3 className="text-sm font-bold text-dark-100">Los móviles</h3>
          <form className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto" onSubmit={(e) => { e.preventDefault(); if (nuevas.trim()) anadir() }}>
            <input value={nuevas} onChange={(e) => setNuevas(e.target.value)} aria-label="Extensiones nuevas"
              placeholder="Extensiones: 4114 1117 4864…" className="input min-w-0 flex-1 py-1 text-[12.5px] sm:w-64 sm:flex-none" />
            <button type="submit" disabled={anadiendo || !nuevas.trim()}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40">
              {anadiendo ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Añadir
            </button>
          </form>
        </div>
        {moviles.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-dark-400">
            Todavía no hay móviles en {center}. Escribe sus extensiones arriba (todas de una vez, separadas por espacios) o pega
            la lista de tu hoja. Mientras no haya ninguno, «Poner móviles» sigue usando el teléfono de la ficha.
          </p>
        ) : (
          <>
            <div className={`hidden ${REJ_MOVIL} ${CABECERA} sm:grid`} aria-hidden="true">
              <span>Extensión</span><span>Número</span><span>Nota</span><span>Lo lleva</span><span>Estado</span><span />
            </div>
            <ul>{moviles.map((m) => <FilaMovil key={m.id} m={m} onGuardar={guardarMovil} onBorrar={quitar} />)}</ul>
          </>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-dark-800 px-3 py-2.5">
          <h3 className="text-sm font-bold text-dark-100">Quién lleva cada uno</h3>
          <label className="ml-auto flex items-center gap-1.5 text-[12px] text-dark-400">
            <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} /> Solo sin móvil
          </label>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-dark-500" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar conductor" placeholder="Buscar…"
              className="input w-44 py-1 pl-7 text-[12.5px]" />
          </div>
        </div>
        {moviles.length === 0 && (
          <p className="px-4 pt-3 text-[12.5px] text-amber-300">Añade primero los móviles; «Propio» ya se puede poner.</p>
        )}
        <div className={`hidden ${REJ_PERSONA} ${CABECERA} sm:grid`} aria-hidden="true">
          <span>Conductor</span><span>Su móvil</span><span>De reserva</span><span />
        </div>
        <ul>
          {visibles.map((c) => (
            <FilaConductor key={c.id} c={c} moviles={moviles} suyoDe={suyoDe} onCambio={cambiar} guardando={!!guardando[c.id]} />
          ))}
        </ul>
        {visibles.length === 0 && (
          <p className="px-4 py-4 text-[12.5px] text-dark-500">
            {conductores.length ? 'Nadie con ese filtro.' : `No hay conductores activos en ${center}.`}
          </p>
        )}
      </section>
    </div>
  )
}
