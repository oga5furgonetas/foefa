import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Car, Users, Wand2, Check, Loader2, ChevronLeft, ChevronRight, X, Lightbulb, Search, Rows3, Plus, Info,
  Star, ChevronDown, ClipboardPaste, AlertTriangle,
} from 'lucide-react'
import {
  getAfinidad, guardarFijaConductor, guardarTratoFurgo, getPropuestaFijas, aplicarPropuestaFijas,
  getAQuien, getFilaAparcamiento, guardarFilaAparcamiento,
} from '../api'
import { useT } from '../../i18n'
import { useToast } from '../../lib/toast'
import { lista } from '../../lib/lista'

/* FURGONETAS FIJAS — quién lleva qué furgoneta, por centro.

   La usan los jefes de cada centro, no solo la oficina: tiene que leerse sin
   explicación. Por eso cada conductor sale como una frase («Ana · su
   furgoneta [placa] · de reserva [placa]») en vez de una hoja de cálculo, la
   matrícula se dibuja como una placa de verdad y cada interruptor dice lo que
   hace debajo, con palabras.

   Hoy casi nadie repite furgoneta (medido: en OGA5 el 29 % de las veces), así
   que la afinidad no se adivina: se FIJA aquí y la plantilla la pone sola cada
   mañana. El porqué de la puntuación está en backend/afinidad.py. Lo que un
   jefe cambia aquí o en la plantilla manda siempre; nada se cambia solo. */

const norm = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
const txt = (plantilla, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), plantilla)

function leer(clave, porDefecto) {
  try { const v = localStorage.getItem(clave); return v === null ? porDefecto : JSON.parse(v) } catch { return porDefecto }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin almacenamiento: da igual */ }
}

function hace(iso, t) {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return t('time.mago').replace('{n}', Math.max(min, 1))
  if (min < 48 * 60) return t('time.hago').replace('{n}', Math.round(min / 60))
  return t('time.dago').replace('{n}', Math.round(min / 1440))
}

/* La matrícula como es: placa blanca con la franja azul. Se reconoce de un
   vistazo, que es justo lo que hace falta a primera hora. */
export function Placa({ p, pequena, apagada }) {
  const n = norm(p)
  const texto = /^\d{4}[A-Z]{3}$/.test(n) ? `${n.slice(0, 4)} ${n.slice(4)}` : (p || '')
  return (
    <span className={`inline-flex items-stretch overflow-hidden rounded-[5px] border border-[#1f2937]/50 bg-white align-middle font-mono font-bold tracking-wider text-[#111827] shadow-sm ${
      pequena ? 'text-[10.5px]' : 'text-[13px]'} ${apagada ? 'opacity-55' : ''}`}>
      <span className={`flex items-end justify-center bg-[#1d4ed8] pb-px font-sans font-bold text-white ${pequena ? 'w-2.5 text-[6px]' : 'w-3.5 text-[7.5px]'}`}>E</span>
      <span className={pequena ? 'px-1 py-px' : 'px-1.5 py-0.5'}>{texto}</span>
    </span>
  )
}

function Iniciales({ nombre }) {
  const ini = String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[12px] font-bold text-brand-300">
      {ini}
    </span>
  )
}

function Interruptor({ id, on, onChange, disabled, titulo, ayuda }) {
  return (
    <div className={`flex items-start gap-3 ${disabled ? 'opacity-45' : ''}`}>
      <button id={id} type="button" role="switch" aria-checked={!!on} disabled={disabled} onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
          on ? 'bg-brand-400' : 'bg-dark-600'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[13px] font-semibold text-dark-100">{titulo}</span>
        {ayuda && <span className="mt-0.5 block text-[12px] leading-snug text-dark-400">{ayuda}</span>}
      </label>
    </div>
  )
}

function tonoNota(n) {
  if (n >= 7) return 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/50'
  if (n >= 4) return 'bg-amber-500/20 text-amber-300 ring-amber-400/50'
  return 'bg-red-500/20 text-red-300 ring-red-400/50'
}

function Nota({ id, valor, onChange }) {
  const { t } = useT()
  return (
    <div id={id} role="group" aria-label={t('ff.ed.nota')} className="flex flex-wrap gap-1">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button key={n} type="button" aria-pressed={valor === n} onClick={() => onChange(n)}
          className={`h-8 w-8 rounded-md text-[13px] font-bold tabular-nums transition ${
            valor === n ? `ring-1 ${tonoNota(n)}` : 'bg-white/[0.04] text-dark-400 hover:bg-white/[0.08] hover:text-dark-100'}`}>
          {n}
        </button>
      ))}
      <button type="button" aria-pressed={valor == null} onClick={() => onChange(null)}
        className={`h-8 rounded-md px-2.5 text-[12px] transition ${valor == null ? 'bg-white/[0.08] font-semibold text-dark-100' : 'text-dark-500 hover:text-dark-200'}`}>
        {t('ff.ed.sinNota')}
      </button>
    </div>
  )
}

function Dialogo({ titulo, onClose, children, pie }) {
  const { t } = useT()
  const ref = useRef(null)
  // El cierre por ref: con él en las dependencias, el efecto se repetía en cada
  // repintado y devolvía el foco al diálogo, quitándoselo a la casilla pulsada.
  const cerrar = useRef(onClose)
  useEffect(() => { cerrar.current = onClose }, [onClose])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') cerrar.current() }
    document.addEventListener('keydown', k)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', k)
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-dark-700 bg-dark-900 shadow-2xl shadow-black/50 focus:outline-none sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-dark-800 px-5 py-4">
          <h3 className="font-display text-[17px] font-semibold text-dark-50">{titulo}</h3>
          <button type="button" onClick={onClose} aria-label={t('ff.dlg.cerrar')} className="rounded-md p-1 text-dark-500 hover:bg-white/[0.06] hover:text-dark-100"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="border-t border-dark-800 px-5 py-3">{pie}</div>}
      </div>
    </div>
  )
}

function Guia() {
  const { t } = useT()
  const [oculta, setOculta] = useState(() => leer('ff.guia.oculta', false))
  const cambiar = (v) => { setOculta(v); guardar('ff.guia.oculta', v) }
  if (oculta) {
    return (
      <button type="button" onClick={() => cambiar(false)} className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-300 hover:underline">
        <Info size={13} /> {t('ff.guia.ver')}
      </button>
    )
  }
  const pasos = [['ff.guia.1t', 'ff.guia.1d'], ['ff.guia.2t', 'ff.guia.2d'], ['ff.guia.3t', 'ff.guia.3d']]
  return (
    <section className="rounded-2xl border border-brand-500/20 bg-brand-500/[0.05] p-4" aria-label={t('ff.guia.titulo')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-brand-300">{t('ff.guia.titulo')}</h3>
        <button type="button" onClick={() => cambiar(true)} className="rounded-md px-2 py-0.5 text-[12px] font-semibold text-brand-300 hover:bg-brand-500/10">{t('ff.guia.ocultar')}</button>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {pasos.map(([ti, de], i) => (
          <li key={ti} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-400 text-[13px] font-bold" style={{ color: 'rgb(var(--brand-tinta))' }}>{i + 1}</span>
            <div>
              <div className="text-[14px] font-semibold text-dark-50">{t(ti)}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-dark-300">{t(de)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function SelectFurgo({ id, value, furgos, exclude, nombreDe, onChange }) {
  const { t } = useT()
  const orden = [...furgos].sort((a, b) => (b.operativa - a.operativa) || a.matricula.localeCompare(b.matricula))
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value || null)} className="select w-full py-1.5 text-[13px]">
      <option value="">{t('ff.ninguna')}</option>
      {orden.filter((f) => f.id !== exclude).map((f) => {
        const de = f.principal_de.map((c) => nombreDe[c]).filter(Boolean)
        return (
          <option key={f.id} value={f.id}>
            {f.matricula}{f.operativa ? '' : ` (${f.bloqueada ? t('ff.estado.bloqueada') : t('ff.estado.taller')})`}{de.length ? ` · ${de[0]}${de.length > 1 ? ` +${de.length - 1}` : ''}` : ''}
          </option>
        )
      })}
    </select>
  )
}

/* Un conductor: la frase de arriba siempre a la vista y, al abrirlo, todo lo
   que se puede tocar con su explicación al lado. */
function Conductor({ c, furgos, placaDe, furgoDe, nombreDe, abierto, abrir, cambiar, guardadoEn }) {
  const { t } = useT()
  const f = c.fija
  const comparten = f.principal ? (furgoDe[f.principal]?.principal_de || []).filter((x) => x !== c.id) : []
  return (
    <li className={`rounded-xl border transition ${abierto ? 'border-brand-500/40 bg-white/[0.03]' : 'border-dark-800 hover:border-dark-700'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3">
        <div className="flex min-w-[12rem] flex-1 items-center gap-3">
          <Iniciales nombre={c.nombre} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-dark-50">{c.nombre}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-dark-400">
              <span>{txt(t('ff.diasMes'), { n: c.dias_30 })}</span>
              {f.responsabilidad != null && (
                <span className={`rounded px-1.5 font-semibold ${tonoNota(f.responsabilidad)}`}>{txt(t('ff.notaN'), { n: f.responsabilidad })}</span>
              )}
              {(c.cuidado.seguros > 0 || c.cuidado.posibles > 0) && (
                <span title={t('ff.golpesTip')} className={c.cuidado.seguros > 0 ? 'text-red-300' : 'text-amber-300'}>
                  {txt(t('ff.golpesCorto'), { s: c.cuidado.seguros, p: c.cuidado.posibles })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.sin_auto ? (
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-dark-300">{t('ff.aManoChip')}</span>
          ) : f.principal ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-dark-500">{t('ff.suFurgo')}</span>
                <Placa p={placaDe[f.principal]} apagada={!furgoDe[f.principal]?.operativa} />
                {f.titular && <Star size={13} className="fill-amber-400 text-amber-400" aria-label={t('ff.col.titular')} />}
              </span>
              {f.secundaria && (
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-dark-500">{t('ff.reserva')}</span>
                  <Placa p={placaDe[f.secundaria]} pequena apagada={!furgoDe[f.secundaria]?.operativa} />
                </span>
              )}
            </>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[12px] font-semibold text-amber-300">{t('ff.filtro.sinFurgo')}</span>
          )}
          {guardadoEn && <span className="flex items-center gap-1 text-[12px] text-emerald-300"><Check size={13} /> {t('ff.guardado')}</span>}
          <button type="button" onClick={abrir} aria-expanded={abierto}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-300 hover:bg-brand-500/10">
            {abierto ? t('ff.listo') : t('ff.editar')} <ChevronDown size={14} className={`transition ${abierto ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {c.sugerencia && !f.sin_auto && (
        <div className="mx-3.5 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-500/[0.07] px-3 py-2 text-[12.5px] text-dark-200">
          <Lightbulb size={14} className="shrink-0 text-brand-300" />
          {(() => {
            const [antes, despues = ''] = txt(t('ff.sugLleva'), { v: c.sugerencia.veces, d: c.sugerencia.de }).split('{p}')
            return <span className="flex flex-wrap items-center gap-1.5">{antes.trim()} <Placa p={c.sugerencia.matricula} pequena /> {despues.trim()}</span>
          })()}
          <button type="button" onClick={() => cambiar(c, { principal: c.sugerencia.furgo })}
            className="ml-auto rounded-md bg-brand-400 px-2.5 py-1 text-[12px] font-semibold" style={{ color: 'rgb(var(--brand-tinta))' }}>
            {t('ff.asignar')}
          </button>
        </div>
      )}

      {abierto && (
        <div className="grid gap-5 border-t border-dark-800 px-3.5 py-4 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label htmlFor={`ff-p-${c.id}`} className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-dark-400">{t('ff.suFurgo')}</label>
              <SelectFurgo id={`ff-p-${c.id}`} value={f.principal} furgos={furgos} exclude={f.secundaria} nombreDe={nombreDe}
                onChange={(v) => cambiar(c, { principal: v })} />
              {comparten.length > 0 && (
                <p className="mt-1 text-[12px] text-dark-400">{t('ff.ed.comparte')} {comparten.map((x) => nombreDe[x] || '?').join(', ')}</p>
              )}
            </div>
            <div>
              <label htmlFor={`ff-s-${c.id}`} className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-dark-400">{t('ff.reserva')}</label>
              <SelectFurgo id={`ff-s-${c.id}`} value={f.secundaria} furgos={furgos} exclude={f.principal} nombreDe={nombreDe}
                onChange={(v) => cambiar(c, { secundaria: v })} />
            </div>
            <Interruptor id={`ff-t-${c.id}`} on={f.titular} disabled={!f.principal} onChange={(v) => cambiar(c, { titular: v })}
              titulo={t('ff.ed.titular')} ayuda={t('ff.ed.titularAyuda')} />
            <Interruptor id={`ff-a-${c.id}`} on={f.sin_auto} onChange={(v) => cambiar(c, { sin_auto: v })}
              titulo={t('ff.ed.sinAuto')} ayuda={t('ff.ed.sinAutoAyuda')} />
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-dark-400">{t('ff.ed.nota')}</div>
              <Nota id={`ff-r-${c.id}`} valor={f.responsabilidad} onChange={(v) => cambiar(c, { responsabilidad: v })} />
              <p className="mt-1.5 text-[12px] leading-snug text-dark-400">{t('ff.ed.notaAyuda')}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-dark-400">{t('ff.ed.datos')}</div>
              <p className="mt-1 text-[13px] text-dark-100">
                {txt(t('ff.ed.datosTxt'), { d: c.cuidado.dias, s: c.cuidado.seguros, p: c.cuidado.posibles })}
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-dark-500">{t('ff.golpesTip')}</p>
              {c.ultima && <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-dark-400">{t('ff.col.ultima')}: <Placa p={c.ultima} pequena /></p>}
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function Conductores({ datos, placaDe, furgoDe, nombreDe, recargar }) {
  const { t } = useT()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [abierto, setAbierto] = useState(null)
  const [guardado, setGuardado] = useState(null)
  const [filas, setFilas] = useState(datos.conductores)
  useEffect(() => { setFilas(datos.conductores) }, [datos.conductores])

  async function cambiar(c, cambios) {
    const antes = filas
    setFilas((fs) => fs.map((x) => (x.id === c.id ? { ...x, fija: { ...x.fija, ...cambios },
      sugerencia: 'principal' in cambios ? null : x.sugerencia } : x)))
    try {
      await guardarFijaConductor(c.id, cambios)
      setGuardado(c.id)
      setTimeout(() => setGuardado((g) => (g === c.id ? null : g)), 1800)
      if ('titular' in cambios || 'principal' in cambios) recargar()
    } catch (e) {
      setFilas(antes)
      toast.error(e?.response?.data?.detail || 'No se pudo guardar')
    }
  }

  const cuenta = {
    todos: filas.length,
    sinFurgo: filas.filter((c) => !c.fija.principal && !c.fija.sin_auto).length,
    sugerencia: filas.filter((c) => c.sugerencia && !c.fija.sin_auto).length,
    sinNota: filas.filter((c) => c.fija.responsabilidad == null).length,
  }
  const pasa = (c) => (filtro === 'sinFurgo' ? !c.fija.principal && !c.fija.sin_auto
    : filtro === 'sugerencia' ? c.sugerencia && !c.fija.sin_auto
      : filtro === 'sinNota' ? c.fija.responsabilidad == null : true)
  const vistas = filas.filter((c) => pasa(c) && (!q || c.nombre.toLowerCase().includes(q.toLowerCase())))
  const FILTROS = [['todos', 'ff.filtro.todos'], ['sinFurgo', 'ff.filtro.sinFurgo'], ['sugerencia', 'ff.filtro.sugerencia'], ['sinNota', 'ff.filtro.sinNota']]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input id="ff-buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ff.buscar')} className="input py-2 pl-9 text-[13px]" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map(([k, key]) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
                filtro === k ? 'bg-brand-400 font-semibold' : 'bg-white/[0.05] text-dark-300 hover:bg-white/[0.09]'}`}
              style={filtro === k ? { color: 'rgb(var(--brand-tinta))' } : undefined}>
              {t(key)} <span className="tabular-nums opacity-70">{cuenta[k]}</span>
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {vistas.map((c) => (
          <Conductor key={c.id} c={c} furgos={datos.furgos} placaDe={placaDe} furgoDe={furgoDe} nombreDe={nombreDe}
            abierto={abierto === c.id} abrir={() => setAbierto((a) => (a === c.id ? null : c.id))}
            cambiar={cambiar} guardadoEn={guardado === c.id} />
        ))}
      </ul>
    </div>
  )
}

const ESTADO = (f, t) => (f.operativa
  ? ['bg-emerald-500/15 text-emerald-300', t('ff.estado.activa')]
  : f.bloqueada ? ['bg-red-500/15 text-red-300', t('ff.estado.bloqueada')] : ['bg-amber-500/15 text-amber-300', t('ff.estado.taller')])

function Furgonetas({ datos, center, nombreDe, recargar }) {
  const { t } = useT()
  const toast = useToast()
  const [aQuien, setAQuien] = useState(null)       // { furgo, matricula, candidatos, cargando }

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

  const TRATOS = [['', 'ff.trato.normal'], ['nueva', 'ff.trato.nueva'], ['reparada', 'ff.trato.reparada']]
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {datos.furgos.map((f) => {
          const [tono, estado] = ESTADO(f, t)
          return (
            <li key={f.id} className="flex flex-col gap-3 rounded-xl border border-dark-800 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <Placa p={f.matricula} apagada={!f.operativa} />
                <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tono}`}>{estado}</span>
              </div>
              <div className="text-[12.5px]">
                <div className="text-[11px] uppercase tracking-wider text-dark-500">{t('ff.f.principalDe')}</div>
                {f.principal_de.length === 0
                  ? <div className="text-dark-500">{t('ff.f.nadie')}</div>
                  : (
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-dark-100">
                      {f.principal_de.map((cid) => (
                        <span key={cid} className="flex items-center gap-1">
                          {nombreDe[cid] || '?'}{f.titular === cid && <Star size={11} className="fill-amber-400 text-amber-400" aria-label={t('ff.col.titular')} />}
                        </span>
                      ))}
                    </div>
                  )}
                {f.secundaria_de.length > 0 && (
                  <div className="mt-1 text-dark-400">{t('ff.f.reservaDe')} {f.secundaria_de.map((cid) => nombreDe[cid] || '?').join(', ')}</div>
                )}
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-dark-500">{t('ff.col.trato')}</div>
                <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5" role="group" aria-label={t('ff.col.trato')}>
                  {TRATOS.map(([v, key]) => (
                    <button key={v || 'normal'} type="button" aria-pressed={(f.trato || '') === v} onClick={() => trato(f, v)}
                      className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
                        (f.trato || '') === v ? 'bg-dark-700 font-semibold text-dark-50 shadow-sm' : 'text-dark-400 hover:text-dark-100'}`}>
                      {t(key)}
                    </button>
                  ))}
                </div>
                {f.valor_por && !f.trato && <p className="mt-1 text-[11.5px] text-dark-500">{f.valor_por}</p>}
              </div>
              <button type="button" onClick={() => verAQuien(f)}
                className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-brand-500/30 px-3 py-1.5 text-[12.5px] font-semibold text-brand-300 hover:bg-brand-500/10">
                <Users size={14} /> {t('ff.f.aQuien')}
              </button>
            </li>
          )
        })}
      </ul>

      {aQuien && (
        <Dialogo titulo={txt(t('ff.dlg.aQuienT'), { p: aQuien.matricula })} onClose={() => setAQuien(null)}>
          <p className="mb-3 text-[12.5px] leading-snug text-dark-400">{t('ff.aQuienSub')}</p>
          {aQuien.cargando ? <Loader2 size={18} className="animate-spin text-dark-400" /> : (
            <ul className="space-y-1.5">
              {aQuien.candidatos.map((c, i) => (
                <li key={c.conductor} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                  <span className="w-5 text-right text-[12px] font-bold tabular-nums text-dark-500">{i + 1}</span>
                  <Iniciales nombre={c.nombre} />
                  <div className="min-w-[10rem] flex-1">
                    <div className="text-[13.5px] font-semibold text-dark-50">{c.nombre}</div>
                    <div className="flex flex-wrap gap-x-2 text-[12px] text-dark-400">
                      {c.responsabilidad != null && <span className={`rounded px-1.5 font-semibold ${tonoNota(c.responsabilidad)}`}>{txt(t('ff.notaN'), { n: c.responsabilidad })}</span>}
                      <span>{c.dias} {t('ff.dias')}</span>
                      <span>{c.golpes_seguros || c.golpes_posibles ? txt(t('ff.golpesCorto'), { s: c.golpes_seguros, p: c.golpes_posibles }) : t('ff.sinGolpes')}</span>
                      {c.tiene_fija && <span>· {t('ff.tieneFija')}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => darsela(c.conductor)} className="btn-primary px-3 py-1.5 text-[12.5px]">{t('ff.darsela')}</button>
                </li>
              ))}
            </ul>
          )}
        </Dialogo>
      )}
    </>
  )
}

/* La fila de aparcamiento dibujada como el patio: asfalto, la salida a la
   izquierda y las furgonetas pegadas una detrás de otra. */
function FilaAparcamiento({ datos, center }) {
  const { t } = useT()
  const toast = useToast()
  const [filas, setFilas] = useState(null)
  const [meta, setMeta] = useState({})
  const [pegado, setPegado] = useState('')
  const [verPegar, setVerPegar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const placas = useMemo(() => datos.furgos.map((f) => f.matricula).filter(Boolean), [datos.furgos])

  useEffect(() => {
    getFilaAparcamiento(center)
      .then((r) => { setFilas(lista(r.data?.filas).map(lista)); setMeta(r.data || {}) })
      .catch(() => setFilas([]))
  }, [center])
  if (!filas) return <Loader2 size={18} className="animate-spin text-dark-400" />

  const puestas = new Set(filas.flat().map(norm))
  const sueltas = placas.filter((p) => !puestas.has(norm(p)))
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
    const conocidas = [...new Map(placas.map((p) => [norm(p), p]))]
    const nuevas = pegado.split('\n').map((l) => {
      const n = norm(l)
      return conocidas.map(([k, p]) => [n.indexOf(k), p]).filter(([i]) => i >= 0)
        .sort((a, b) => a[0] - b[0]).map(([, p]) => p)
    }).filter((f) => f.length)
    if (nuevas.length) { setFilas(nuevas); setPegado(''); setVerPegar(false) }
  }
  async function guardarFilas() {
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
      <p className="max-w-3xl text-[13px] leading-relaxed text-dark-300">{t('ff.filaSub')}</p>
      {meta.actualizado_en && (
        <p className="text-[12px] text-dark-500">{t('ff.apuntada')} {hace(meta.actualizado_en, t)}{meta.actualizado_por ? ` · ${meta.actualizado_por}` : ''}</p>
      )}
      <div className="overflow-x-auto rounded-2xl bg-[#262e34] p-3 sm:p-4">
        {filas.length === 0 && <p className="px-1 py-6 text-center text-[13px] text-[#b9c4c9]">{t('ff.fila.vacia')}</p>}
        {filas.map((f, n) => (
          <div key={n} className="flex min-w-max items-center gap-2 border-b-2 border-dashed border-[#e3ad12]/70 py-3 last:border-b-0">
            <div className="flex w-16 shrink-0 flex-col items-start gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#d7dee2]">{t('ff.filaN')} {n + 1}</span>
              <button type="button" onClick={() => setFilas((fs) => fs.filter((_, k) => k !== n))} aria-label={t('ff.aria.quitarFila')}
                className="text-[11px] text-[#9aa7ad] hover:text-white">{t('ff.aria.quitar')}</button>
            </div>
            <span className="flex shrink-0 items-center gap-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#e3ad12]"><ChevronLeft size={13} /> {t('ff.fila.salida')}</span>
            {f.map((p, i) => (
              <div key={p} className="flex shrink-0 flex-col items-center gap-1">
                <div className="rounded-md bg-[#f4f6f7] px-2 py-1.5 shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]">
                  <span className="block text-center font-mono text-[12.5px] font-bold text-[#15212a]">{p}</span>
                </div>
                <div className="flex items-center gap-0.5 text-[#9aa7ad]">
                  <button type="button" onClick={() => mueve(n, i, -1)} disabled={i === 0} aria-label={t('ff.aria.adelante')} className="rounded p-0.5 hover:text-white disabled:opacity-30"><ChevronLeft size={13} /></button>
                  <button type="button" onClick={() => setFilas((fs) => fs.map((x, k) => (k === n ? x.filter((y) => y !== p) : x)))} aria-label={t('ff.aria.quitar')} className="rounded p-0.5 hover:text-[#ff8a7d]"><X size={12} /></button>
                  <button type="button" onClick={() => mueve(n, i, 1)} disabled={i === f.length - 1} aria-label={t('ff.aria.atras')} className="rounded p-0.5 hover:text-white disabled:opacity-30"><ChevronRight size={13} /></button>
                </div>
              </div>
            ))}
            {sueltas.length > 0 && (
              <select id={`ff-fila-add-${n}`} value="" aria-label={t('ff.fila.anadir')}
                onChange={(e) => e.target.value && setFilas((fs) => fs.map((x, k) => (k === n ? [...x, e.target.value] : x)))}
                className="shrink-0 rounded-md border border-dashed border-[#9aa7ad]/60 bg-transparent px-2 py-1.5 font-mono text-[12px] text-[#d7dee2] focus:outline-none">
                <option value="">{t('ff.fila.anadir')}</option>
                {sueltas.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFilas((fs) => [...fs, []])} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
          <Plus size={14} /> {t('ff.addFila')}
        </button>
        <button type="button" onClick={() => setVerPegar((v) => !v)} className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
          <ClipboardPaste size={14} /> {t('ff.fila.pegarAbrir')}
        </button>
        <button type="button" onClick={guardarFilas} disabled={guardando} className="btn-primary ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px]">
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('ff.guardarFila')}
        </button>
      </div>
      {verPegar && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <textarea id="ff-fila-pegar" value={pegado} onChange={(e) => setPegado(e.target.value)} rows={3}
            placeholder={t('ff.pegarTip')} className="input font-mono text-[12.5px]" />
          <button type="button" onClick={leerPegado} disabled={!pegado.trim()} className="btn-secondary self-start px-3 py-2 text-[12.5px]">{t('ff.leerPegado')}</button>
        </div>
      )}
      {sueltas.length > 0 && filas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-dark-400">
          <span>{t('ff.porAparcar')}:</span>
          {sueltas.map((p) => <Placa key={p} p={p} pequena />)}
        </div>
      )}
    </div>
  )
}

function Propuesta({ center, cerrar, alAplicar }) {
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

  const pie = datos && datos.length > 0 && (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setMarcadas(new Set(datos.map((p) => p.conductor)))} className="btn-ghost px-2.5 py-1 text-[12px]">{t('ff.dlg.todos')}</button>
      <button type="button" onClick={() => setMarcadas(new Set())} className="btn-ghost px-2.5 py-1 text-[12px]">{t('ff.dlg.ninguno')}</button>
      <button type="button" onClick={aplicar} disabled={aplicando || marcadas.size === 0}
        className="btn-primary ml-auto flex items-center gap-1.5 px-4 py-2 text-[13px]">
        {aplicando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {txt(t('ff.dlg.aplicarN'), { n: marcadas.size })}
      </button>
    </div>
  )
  return (
    <Dialogo titulo={t('ff.dlg.propT')} onClose={cerrar} pie={pie}>
      {!datos ? <Loader2 size={18} className="animate-spin text-dark-400" />
        : datos.length === 0 ? <p className="text-[13px] text-dark-400">{t('ff.sinPropuesta')}</p> : (
          <>
            <p className="mb-3 text-[13px] leading-snug text-dark-300">
              {txt(t('ff.dlg.propResumen'), { n: datos.length })} {t('ff.propuestaAyuda')}
            </p>
            <ul className="divide-y divide-dark-800">
              {datos.map((p) => {
                const on = marcadas.has(p.conductor)
                return (
                  <li key={p.conductor}>
                    <label htmlFor={`ff-prop-${p.conductor}`} className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${on ? '' : 'opacity-50'}`}>
                      <input type="checkbox" id={`ff-prop-${p.conductor}`} checked={on} className="h-4 w-4 accent-brand-500"
                        onChange={(e) => setMarcadas((s) => { const n = new Set(s); if (e.target.checked) n.add(p.conductor); else n.delete(p.conductor); return n })} />
                      <span className="min-w-[9rem] flex-1 text-[13.5px] font-semibold text-dark-50">{p.nombre}</span>
                      <span className="flex items-center gap-1.5">
                        <Placa p={p.principal_matricula} />
                        {p.titular && <Star size={12} className="fill-amber-400 text-amber-400" aria-label={t('ff.col.titular')} />}
                        {p.secundaria_matricula && <><span className="text-[11px] text-dark-500">{t('ff.reserva')}</span><Placa p={p.secundaria_matricula} pequena /></>}
                      </span>
                      <span className="w-full pl-7 text-[12px] text-dark-400">
                        {p.motivo}{p.comparte_con.length > 0 && ` · ${t('ff.comparteCon')} ${p.comparte_con.join(', ')}`}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
    </Dialogo>
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

  const mapas = useMemo(() => {
    const furgos = datos?.furgos || []
    return {
      placaDe: Object.fromEntries(furgos.map((f) => [f.id, f.matricula])),
      furgoDe: Object.fromEntries(furgos.map((f) => [f.id, f])),
      nombreDe: Object.fromEntries((datos?.conductores || []).map((c) => [c.id, c.nombre.split(' ').slice(0, 2).join(' ')])),
    }
  }, [datos])

  if (noCenter) return <div className="card p-10 text-center text-[14px] text-dark-300">{t('ff.elegirCentro')}</div>
  if (error && !datos) return <div className="card p-10 text-center text-[14px] text-dark-300">{error}</div>
  if (!datos) return <div className="flex justify-center p-14 text-dark-400"><Loader2 className="animate-spin" /></div>

  const r = datos.resumen || {}
  const conFurgo = datos.conductores.filter((c) => c.fija.principal).length
  const sinFurgo = datos.conductores.filter((c) => !c.fija.principal && !c.fija.sin_auto).length
  const total = datos.conductores.length
  const pct = total ? Math.round((100 * conFurgo) / total) : 0
  const noOperativas = datos.furgos.filter((f) => !f.operativa).length
  const TABS = [['conductores', 'ff.tab.conductores', Users, total], ['furgos', 'ff.tab.furgos', Car, datos.furgos.length],
    ['fila', 'ff.tab.fila', Rows3, null]]
  return (
    <div className="space-y-4">
      <Guia />

      <section className="card flex flex-wrap items-center gap-x-6 gap-y-4 p-4 sm:p-5">
        <div className="min-w-[14rem] flex-1">
          <div className="font-display text-[20px] font-semibold tracking-tight text-dark-50">
            {txt(t('ff.progreso'), { n: conFurgo, t: total })}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-dark-400">
            {sinFurgo > 0 && <span className="font-semibold text-amber-300">{sinFurgo} {t('ff.chip.sinFurgo')}</span>}
            <span><b className="tabular-nums text-dark-100">{r.operativas ?? 0}</b> {t('ff.chip.operativas')}</span>
            {noOperativas > 0 && <span><b className="tabular-nums text-dark-100">{noOperativas}</b> {t('ff.chip.taller')}</span>}
          </div>
        </div>
        <div className="flex max-w-xs flex-col items-start gap-1.5">
          <button type="button" onClick={() => setProponiendo(true)}
            className={`${pct < 50 ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2 px-4 py-2 text-[13px]`}>
            <Wand2 size={15} /> {t('ff.propuestaCorta')}
          </button>
          <p className="text-[12px] leading-snug text-dark-400">{t('ff.propuestaAyuda')}</p>
        </div>
      </section>

      <p className="flex items-start gap-2 text-[12.5px] leading-snug text-dark-400" title={datos.cuidado_motivo}>
        {datos.cuidado_activo ? <Check size={14} className="mt-0.5 shrink-0 text-emerald-300" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-dark-500" />}
        <span>{datos.cuidado_activo ? t('ff.golpesAvisoOn') : t('ff.golpesAviso')}</span>
      </p>

      <nav className="flex gap-1 overflow-x-auto border-b border-dark-800" role="tablist">
        {TABS.map(([k, key, Icon, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition ${
              tab === k ? 'border-brand-400 text-dark-50' : 'border-transparent text-dark-500 hover:text-dark-200'}`}>
            <Icon size={15} /> {t(key)}
            {n != null && <span className="rounded-full bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-dark-400">{n}</span>}
          </button>
        ))}
      </nav>

      {tab === 'conductores' && <Conductores datos={datos} {...mapas} recargar={cargar} />}
      {tab === 'furgos' && <Furgonetas datos={datos} center={center} nombreDe={mapas.nombreDe} recargar={cargar} />}
      {tab === 'fila' && <FilaAparcamiento datos={datos} center={center} />}

      {proponiendo && <Propuesta center={center} cerrar={() => setProponiendo(false)} alAplicar={() => { setProponiendo(false); cargar() }} />}
    </div>
  )
}
