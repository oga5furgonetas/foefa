import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2, Plus, ClipboardPaste, Wrench, Trash2, HelpCircle, Check, X,
  TrendingUp, TrendingDown, Calendar, AlertTriangle, Euro, Truck, Mail, Copy, FileText,
  Search,
} from 'lucide-react'
import {
  getGastos, crearGasto, borrarGasto, analizarGastos, importarGastos,
  ensenarProveedor, gastosDesdeTaller, getGastosBuzon,
} from '../api'
import { useToast } from '../../lib/toast'

/* GASTOS — de qué son las facturas que llegan, y cuánto sale al mes.

   Dos preguntas, y la segunda no se puede contestar sin la primera: «¿qué es
   esto?» y «¿cuánto gastamos al mes?». Por eso la pantalla empieza por el QUÉ
   —cada línea dice en cristiano qué es ese proveedor— y solo después suma.

   Lo que NO sabe qué es, lo DICE: hay una tarjeta de «no sé qué son estas» que
   se enseña arriba, porque una categoría adivinada cuelga la factura de la
   parte del negocio que no es y eso no se nota nunca (gotchas 6, 17 y 60).

   Los importes salen SOLO de lo apuntado aquí y de las órdenes de taller, que
   la app ya conoce. Ni un euro estimado: un número inventado en una pantalla
   de dinero es peor que no tener la pantalla. */

const eur = (n) =>
  n == null ? '—' : `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const eurCorto = (n) =>
  n == null ? '—' : `${Math.round(Number(n)).toLocaleString('es-ES')} €`

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const mesTexto = (m) => (m ? `${MES_CORTO[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}` : '')
/* En el eje va solo el mes; el ano se pone en enero y en la primera columna,
   que es donde de verdad hace falta. Con «sep 26» debajo de cada barra, a
   375 px la etiqueta parte en dos lineas y el grafico deja de leerse. */
const mesEje = (m, i) => (i === 0 || m.slice(5, 7) === '01' ? mesTexto(m) : MES_CORTO[Number(m.slice(5, 7)) - 1])
/* La fecha se compone a mano desde el texto ISO: `new Date(...).toLocaleDateString`
   sobre un 'YYYY-MM-DD' lo interpreta en UTC y corre el día en España (gotcha 11). */
const diaTexto = (f) => (f && f.length >= 10 ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : '—')

/* Un color por categoría, dentro de la familia de la marca. No se usa el color
   SOLO: cada barra lleva su nombre y su cifra al lado (gotcha 22). */
const COLOR = {
  flota: 'bg-brand-500', combustible: 'bg-amber-500', taller: 'bg-orange-500',
  seguros: 'bg-sky-500', peajes: 'bg-teal-500', personal: 'bg-violet-500',
  impuestos: 'bg-rose-500', software: 'bg-indigo-500', telefonia: 'bg-cyan-500',
  nave: 'bg-emerald-500', material: 'bg-lime-500', servicios: 'bg-fuchsia-500',
  otros: 'bg-dark-600',
}
const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Tile({ icon: Icon, valor, etiqueta, pie, acento }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-dark-500">
        <Icon size={12} /> {etiqueta}
      </div>
      <div className={`mt-1 font-display text-[21px] font-semibold tabular-nums leading-none ${acento || 'text-dark-50'}`}>
        {valor}
      </div>
      {pie && <div className="mt-1 text-[11.5px] leading-snug text-dark-500">{pie}</div>}
    </div>
  )
}

/* Barras por mes, apiladas por categoría. Sin librería: son doce números y un
   div por mes pesa muchísimo menos que cargar un motor de gráficas. */
function Meses({ meses, cats }) {
  const max = Math.max(1, ...meses.map((m) => m.importe))
  const nombre = Object.fromEntries(cats.map((c) => [c.clave, c.nombre]))
  /* A 375 px doce columnas no caben y el grafico se desplaza: sin esto, el mes
     que importa —el de ahora, que es el ultimo— queda FUERA de la pantalla y
     lo primero que se ve al abrir son meses vacios de hace un ano. */
  const carril = useRef(null)
  useEffect(() => {
    const el = carril.current
    if (el) { el.scrollLeft = el.scrollWidth }
  }, [meses])
  return (
    <div ref={carril} className="flex items-end gap-1 overflow-x-auto pb-1 sm:gap-1.5">
      {meses.map((m, i) => {
        const trozos = Object.entries(m.cats || {}).sort((a, b) => b[1] - a[1])
        return (
          <div key={m.mes} className="flex min-w-[24px] flex-1 flex-col items-center gap-1">
            <span className="whitespace-nowrap text-[10px] tabular-nums text-dark-500">{m.importe > 0 ? eurCorto(m.importe) : ''}</span>
            <div
              className="flex w-full flex-col-reverse justify-end overflow-hidden rounded-t-[3px] bg-dark-800/60"
              style={{ height: `${Math.max(3, (m.importe / max) * 104)}px` }}
              title={trozos.map(([k, v]) => `${nombre[k] || k}: ${eur(v)}`).join(' · ') || 'Sin gastos apuntados'}
            >
              {trozos.map(([k, v]) => (
                <div key={k} className={COLOR[k] || COLOR.otros} style={{ height: `${(v / m.importe) * 100}%` }} />
              ))}
            </div>
            <span className="whitespace-nowrap text-[10px] text-dark-500">{mesEje(m.mes, i)}</span>
          </div>
        )
      })}
    </div>
  )
}

/* Enseñarle qué es un proveedor que no reconoce. Se aprende para siempre Y se
   aplica hacia atrás: si no, la pantalla seguiría preguntando por algo que
   acabas de explicarle, que es la forma más rápida de que dejes de corregirla. */
function Ensenar({ proveedor, cats, onHecho, onCerrar }) {
  const [cat, setCat] = useState('')
  const [que, setQue] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const guardar = async () => {
    if (!cat) return
    setBusy(true)
    try {
      const r = await ensenarProveedor({ clave: proveedor, proveedor, categoria: cat, que_es: que })
      toast.success(r.data.arreglados > 1
        ? `Apuntado. He arreglado ${r.data.arreglados} facturas de golpe.`
        : 'Apuntado. No te lo vuelvo a preguntar.')
      onHecho()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-brand-500/30 bg-brand-500/[0.06] p-3">
      <p className="text-[12.5px] font-semibold text-dark-100">¿Qué es «{proveedor}»?</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <select
          value={cat} onChange={(e) => setCat(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] text-dark-100"
        >
          <option value="">Elige a qué pertenece…</option>
          {cats.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
        </select>
        <input
          value={que} onChange={(e) => setQue(e.target.value)}
          placeholder="Y en una frase, qué es (opcional)"
          className="min-w-0 flex-[2] rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] text-dark-100 placeholder:text-dark-500"
        />
        <div className="flex gap-2">
          <button
            onClick={guardar} disabled={!cat || busy}
            className="flex items-center gap-1 rounded-md btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-40"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
          </button>
          <button onClick={onCerrar} className="rounded-md border border-dark-700 px-2 py-1.5 text-dark-400" aria-label="Cerrar">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* Pegar el extracto del banco. Analizar y guardar son DOS pasos a propósito:
   una línea mal partida es un importe mal leído, y un importador que guarda a
   ciegas es el que nadie vuelve a usar después del primer susto. */
function Pegar({ cats, onHecho, onCerrar }) {
  const [texto, setTexto] = useState('')
  const [prev, setPrev] = useState(null)
  const [busy, setBusy] = useState('')
  const toast = useToast()

  const analizar = async () => {
    setBusy('leer')
    try {
      const r = await analizarGastos({ texto })
      setPrev(r.data)
      if (r.data.aviso) toast.error(r.data.aviso)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No he podido leerlo')
    } finally { setBusy('') }
  }

  const guardar = async () => {
    const filas = (prev?.filas || []).filter((f) => f.marcada)
    if (!filas.length) return
    setBusy('guardar')
    try {
      const r = await importarGastos({ filas })
      toast.success(`${r.data.guardados} facturas apuntadas (${eur(r.data.suma)}).`)
      onHecho()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar')
    } finally { setBusy('') }
  }

  const marcar = (i, v) => setPrev((p) => ({
    ...p, filas: p.filas.map((f, j) => (j === i ? { ...f, marcada: v } : f)),
  }))
  const cambiar = (i, campo, v) => setPrev((p) => ({
    ...p, filas: p.filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)),
  }))

  const marcadas = (prev?.filas || []).filter((f) => f.marcada)
  const suma = marcadas.reduce((a, f) => a + Number(f.importe || 0), 0)

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-dark-100">Pegar del banco o de una lista de facturas</h2>
        <button onClick={onCerrar} className="text-dark-500 hover:text-dark-300" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
      {!prev && (
        <>
          <textarea
            value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
            placeholder={'Una línea por factura. Por ejemplo:\n20/09/2026  RECIBO FLY.IO INC  -57,30\n19/09/2026  AYVENS ESPANA SAU  -1.842,90'}
            className="w-full rounded-md border border-dark-700 bg-dark-900 px-2.5 py-2 font-mono text-[12px] text-dark-100 placeholder:text-dark-500"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11.5px] leading-snug text-dark-500">
              Leo la fecha, el importe y de quién es. Lo que no reconozca te lo pregunto.
            </p>
            <button
              onClick={analizar} disabled={texto.trim().length < 4 || busy === 'leer'}
              className="flex shrink-0 items-center gap-1.5 rounded-md btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-40"
            >
              {busy === 'leer' ? <Loader2 size={13} className="animate-spin" /> : <ClipboardPaste size={13} />} Leerlo
            </button>
          </div>
        </>
      )}

      {prev && (
        <>
          <p className="mb-2 text-[12px] text-dark-400">
            {prev.resumen.lineas} líneas · {prev.resumen.gastos} gastos
            {prev.resumen.ingresos > 0 && <> · <b className="text-emerald-300">{prev.resumen.ingresos} son dinero que ENTRA</b>, desmarcados</>}
            {prev.resumen.repetidos > 0 && <> · <b className="text-amber-300">{prev.resumen.repetidos} ya estaban</b>, desmarcados</>}
            {prev.resumen.sin_reconocer > 0 && <> · {prev.resumen.sin_reconocer} sin reconocer</>}
          </p>
          <div className="-mx-3.5 max-h-[50vh] overflow-auto px-3.5">
            <table className="w-full text-[12px]">
              <tbody>
                {prev.filas.map((f, i) => (
                  <tr key={i} className={`border-b border-dark-900/70 last:border-0 ${f.marcada ? '' : 'opacity-45'}`}>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        type="checkbox" checked={!!f.marcada} onChange={(e) => marcar(i, e.target.checked)}
                        className="h-4 w-4 accent-brand-500" aria-label={`Apuntar ${f.proveedor}`}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        type="date" value={f.fecha} onChange={(e) => cambiar(i, 'fecha', e.target.value)}
                        className="rounded border border-dark-700 bg-dark-800 px-1 py-0.5 text-[11.5px] text-dark-200"
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <div className="font-medium text-dark-100">{f.proveedor}</div>
                      <div className="text-[11px] leading-snug text-dark-500">
                        {f.que_es || (f.ingreso ? 'Parece dinero que entra, no un gasto' : 'No sé qué es: elige la categoría')}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <select
                        value={f.categoria} onChange={(e) => cambiar(i, 'categoria', e.target.value)}
                        className="max-w-[150px] rounded border border-dark-700 bg-dark-800 px-1 py-0.5 text-[11.5px] text-dark-200"
                      >
                        {cats.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 text-right align-top font-semibold tabular-nums text-dark-100">{eur(f.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12.5px] text-dark-300">
              Se apuntan <b className="text-dark-50">{marcadas.length}</b> · {eur(suma)}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPrev(null)} className="rounded-md border border-dark-700 px-3 py-1.5 text-[12.5px] text-dark-300">
                Volver
              </button>
              <button
                onClick={guardar} disabled={!marcadas.length || busy === 'guardar'}
                className="flex items-center gap-1.5 rounded-md btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-40"
              >
                {busy === 'guardar' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Apuntarlas
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* EL BUZON: que las facturas entren solas.

   Se miro primero la API de cada proveedor y la respuesta fue que no sirve:
   Fly.io no publica `invoices` en su GraphQL —se introspecciono el esquema
   entero el 20-09-2026— y Cloudflare tampoco. Pero todas las facturas llegan
   por correo, asi que la puerta es un buzon. Esta tarjeta existe para decir
   UNA cosa: donde hay que pegar esa direccion. Sin eso, el buzon esta montado
   y no entra nada, que es igual que no tenerlo. */
function Buzon({ buzon, porRevisar, onIr }) {
  const [copiado, setCopiado] = useState(false)
  if (!buzon?.direccion) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(buzon.direccion)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* Sin permiso del portapapeles no pasa nada: la direccion esta a la
         vista y se puede escribir a mano. Un error aqui no ayuda a nadie. */
    }
  }

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-3.5">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-200">
        <Mail size={14} /> Que lleguen solas
      </div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-dark-400">
        Pon esta direccion como correo de facturacion en Fly.io, MongoDB Atlas,
        Cloudflare, Stripe o donde sea. La factura entra aqui sola, con su PDF, y
        te digo de que es. Si algo falla, el correo se reenvia a tu Gmail: no se pierde.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-dark-900/60 px-2.5 py-1.5 font-mono text-[13px] text-emerald-200">
          {buzon.direccion}
        </code>
        <button
          onClick={copiar}
          className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/40 px-2.5 py-1.5 text-[12px] font-medium text-emerald-300"
        >
          {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] text-dark-500">
        {buzon.recibidos > 0
          ? `Han entrado ${buzon.recibidos} ${buzon.recibidos === 1 ? 'factura' : 'facturas'} por aqui.`
          : 'Todavia no ha entrado ninguna.'}
        {porRevisar > 0 && (
          <>
            {' '}
            <button onClick={onIr} className="underline decoration-dotted underline-offset-2 text-amber-300">
              {porRevisar} sin importe: mirala
            </button>
          </>
        )}
      </p>
    </div>
  )
}

function Alta({ cats, onHecho, onCerrar }) {
  const [f, setF] = useState({ fecha: hoyISO(), proveedor: '', importe: '', categoria: '', concepto: '', matricula: '' })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const guardar = async () => {
    setBusy(true)
    try {
      const r = await crearGasto(f)
      toast.success(r.data.ya_estaba ? 'Esa ya estaba apuntada.' : `Apuntado: ${eur(r.data.gasto.importe)}.`)
      onHecho()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo apuntar')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-dark-100">Apuntar una factura</h2>
        <button onClick={onCerrar} className="text-dark-500 hover:text-dark-300" aria-label="Cerrar"><X size={16} /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] uppercase tracking-wider text-dark-500">
          Fecha
          <input type="date" value={f.fecha} onChange={set('fecha')} max={hoyISO()}
            className="mt-1 w-full rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] normal-case tracking-normal text-dark-100" />
        </label>
        <label className="text-[11px] uppercase tracking-wider text-dark-500">
          De quién
          <input value={f.proveedor} onChange={set('proveedor')} placeholder="Northgate, Repsol…"
            className="mt-1 w-full rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] normal-case tracking-normal text-dark-100 placeholder:text-dark-500" />
        </label>
        <label className="text-[11px] uppercase tracking-wider text-dark-500">
          Importe
          <input value={f.importe} onChange={set('importe')} inputMode="decimal" placeholder="1.842,90"
            className="mt-1 w-full rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] normal-case tracking-normal tabular-nums text-dark-100 placeholder:text-dark-500" />
        </label>
        <label className="text-[11px] uppercase tracking-wider text-dark-500">
          Categoría
          <select value={f.categoria} onChange={set('categoria')}
            className="mt-1 w-full rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] normal-case tracking-normal text-dark-100">
            <option value="">La averiguo yo</option>
            {cats.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="text-[11px] uppercase tracking-wider text-dark-500 sm:col-span-2 lg:col-span-3">
          Concepto (opcional)
          <input value={f.concepto} onChange={set('concepto')} placeholder="Qué pone en la factura"
            className="mt-1 w-full rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] normal-case tracking-normal text-dark-100 placeholder:text-dark-500" />
        </label>
        <label className="text-[11px] uppercase tracking-wider text-dark-500">
          Matrícula (opcional)
          <input value={f.matricula} onChange={set('matricula')} placeholder="1234ABC"
            className="mt-1 w-full rounded-md border border-dark-700 bg-dark-800 px-2 py-1.5 text-[12.5px] normal-case tracking-normal uppercase text-dark-100 placeholder:text-dark-500" />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={guardar} disabled={busy || !f.proveedor || !f.importe}
          className="flex items-center gap-1.5 rounded-md btn-primary px-3.5 py-1.5 text-[12.5px] disabled:opacity-40">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Apuntar
        </button>
      </div>
    </div>
  )
}

export default function Gastos() {
  const [d, setD] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [meses, setMeses] = useState(12)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [panel, setPanel] = useState('')          // 'alta' | 'pegar'
  const [ensenando, setEnsenando] = useState('')
  const [busyTaller, setBusyTaller] = useState(false)
  const [buzon, setBuzon] = useState(null)
  const toast = useToast()

  const cargar = async (conSpinner = false) => {
    if (conSpinner) setCargando(true)
    try {
      const r = await getGastos({ meses, categoria: cat, q })
      setD(r.data)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudieron cargar los gastos')
    } finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [meses, cat, q])   // eslint-disable-line react-hooks/exhaustive-deps
  /* El buzon se pide una vez: la direccion no cambia, y volver a pedirla en
     cada filtro serian tres llamadas por letra escrita en el buscador. */
  useEffect(() => {
    getGastosBuzon().then((r) => setBuzon(r.data)).catch(() => {})
  }, [])

  const traerTaller = async () => {
    setBusyTaller(true)
    try {
      const r = await gastosDesdeTaller()
      toast.success(r.data.nuevos
        ? `${r.data.nuevos} reparaciones traídas de las órdenes de taller.`
        : 'Ya estaban todas: las órdenes de taller con importe final ya figuran aquí.')
      cargar()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo')
    } finally { setBusyTaller(false) }
  }

  const borrar = async (g) => {
    if (!window.confirm(`¿Borrar ${g.proveedor} de ${diaTexto(g.fecha)} (${eur(g.importe)})?`)) return
    try {
      await borrarGasto(g.id)
      cargar()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo borrar')
    }
  }

  const r = d?.resumen
  const cats = d?.categorias || []
  /* Lo que sale todos los meses: el compromiso fijo. Solo cuenta lo visto en
     dos meses o más — con una medida no se puede decir que algo se repita. */
  const fijos = useMemo(() => (r?.fijos || []).filter((f) => f.meses >= 2), [r])
  const compromiso = useMemo(() => fijos.reduce((a, f) => a + f.tipico, 0), [fijos])
  const faltan = fijos.filter((f) => f.falta_este_mes)
  const saltos = fijos.filter((f) => f.salto_pct)

  if (cargando && !d) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-dark-500" /></div>
  }

  const vacio = d && d.total_apuntados === 0

  return (
    <div className="space-y-3">
      {/* Cabecera. En móvil los botones caen debajo y a ancho completo: en la
          barra van apretados y se falla el toque (se comprueba a 375 px). */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-[19px] font-semibold tracking-tight text-dark-50">Gastos</h1>
          <p className="text-[12px] text-dark-500">
            De qué son las facturas que llegan y cuánto sale al mes. Esta pantalla es solo tuya.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={() => setPanel(panel === 'pegar' ? '' : 'pegar')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-dark-700 px-3 py-2 text-[12.5px] font-medium text-dark-200 sm:flex-none"
          >
            <ClipboardPaste size={14} /> Pegar del banco
          </button>
          <button
            onClick={() => setPanel(panel === 'alta' ? '' : 'alta')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md btn-primary px-3 py-2 text-[12.5px] sm:flex-none"
          >
            <Plus size={14} /> Apuntar factura
          </button>
        </div>
      </div>

      {panel === 'alta' && <Alta cats={cats} onHecho={() => { setPanel(''); cargar() }} onCerrar={() => setPanel('')} />}
      {panel === 'pegar' && <Pegar cats={cats} onHecho={() => { setPanel(''); cargar() }} onCerrar={() => setPanel('')} />}

      <Buzon
        buzon={buzon?.buzon} porRevisar={buzon?.por_revisar || 0}
        onIr={() => { setCat(''); setQ('') }}
      />

      {vacio && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
          <Euro size={22} className="mx-auto text-dark-500" />
          <p className="mt-2 text-[13.5px] font-semibold text-dark-100">Todavía no hay ninguna factura apuntada</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-snug text-dark-500">
            La forma rápida es pegar el extracto del banco: leo la fecha, el importe y de quién es,
            y te digo qué es cada cosa. Lo que no reconozca te lo pregunto una vez y no vuelvo a preguntarlo.
          </p>
          <button
            onClick={traerTaller} disabled={busyTaller}
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-md border border-dark-700 px-3 py-1.5 text-[12.5px] text-dark-200"
          >
            {busyTaller ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />}
            Traer los importes de las órdenes de taller
          </button>
        </div>
      )}

      {!vacio && r && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile
              icon={Calendar} etiqueta={`Este mes (${mesTexto(r.mes_actual)})`} valor={eur(r.este_mes)}
              acento={r.este_mes > r.media_mensual && r.media_mensual > 0 ? 'text-amber-300' : undefined}
              pie={r.media_mensual > 0
                ? `La media son ${eurCorto(r.media_mensual)} (${r.meses_con_datos} meses con datos)`
                : 'Aún no hay meses anteriores con los que comparar'}
            />
            <Tile
              icon={r.este_mes >= r.mes_anterior ? TrendingUp : TrendingDown}
              etiqueta="Mes anterior" valor={eur(r.mes_anterior)}
              pie={r.mes_anterior > 0
                ? `${r.este_mes >= r.mes_anterior ? '+' : ''}${Math.round(((r.este_mes - r.mes_anterior) / r.mes_anterior) * 100)} % este mes`
                : 'Sin nada apuntado ese mes'}
            />
            <Tile
              icon={Euro} etiqueta="Fijo todos los meses" valor={eur(compromiso)}
              pie={fijos.length ? `${fijos.length} proveedores que se repiten` : 'Aún no se repite ninguno'}
            />
            <Tile
              icon={Truck} etiqueta="Por furgoneta y mes"
              valor={r.furgonetas && r.meses_con_datos
                ? eur(r.categorias.filter((c) => c.por_furgo_eur).reduce((a, c) => a + c.importe, 0) / r.furgonetas / Math.max(1, r.meses_con_datos))
                : '—'}
              pie={r.furgonetas ? `Solo lo de flota entre ${r.furgonetas} furgonetas activas` : 'Sin furgonetas activas'}
            />
          </div>

          {/* Lo que no sabe qué es. Arriba del todo: es la pregunta con la que
              nació la pantalla, y escondida abajo no la contestaría nadie. */}
          {d.por_saber.length > 0 && (
            <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.05] p-3.5">
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-dark-100">
                <HelpCircle size={14} className="text-brand-400" />
                No sé de qué son estas ({eur(r.sin_clasificar)})
              </div>
              <p className="mt-0.5 text-[11.5px] text-dark-500">
                Dime qué es cada una y lo aprendo: te lo arreglo también en las que ya están apuntadas.
              </p>
              <div className="mt-2 space-y-1.5">
                {d.por_saber.map((p) => (
                  <div key={p.proveedor}>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-dark-900/50 px-2.5 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-dark-200">{p.proveedor}</span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-dark-500">{p.veces}×</span>
                      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-dark-100">{eur(p.importe)}</span>
                      <button
                        onClick={() => setEnsenando(ensenando === p.proveedor ? '' : p.proveedor)}
                        className="shrink-0 rounded border border-brand-500/40 px-2 py-0.5 text-[11.5px] font-medium text-brand-300"
                      >
                        Decirlo
                      </button>
                    </div>
                    {ensenando === p.proveedor && (
                      <div className="mt-1.5">
                        <Ensenar
                          proveedor={p.proveedor} cats={cats}
                          onHecho={() => { setEnsenando(''); cargar() }}
                          onCerrar={() => setEnsenando('')}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(faltan.length > 0 || saltos.length > 0) && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3.5">
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-200">
                <AlertTriangle size={14} /> Cosas que mirar
              </div>
              <ul className="mt-1.5 space-y-1 text-[12.5px] text-dark-300">
                {faltan.map((f) => (
                  <li key={`f-${f.proveedor}`}>
                    <b className="text-dark-100">{f.proveedor}</b> no ha llegado este mes.
                    Suele ser {eur(f.tipico)} y se ha visto en {f.meses} meses (el último, {mesTexto(f.ultimo_mes)}).
                  </li>
                ))}
                {saltos.map((f) => (
                  <li key={`s-${f.proveedor}`}>
                    <b className="text-dark-100">{f.proveedor}</b>: este mes {eur(f.importe_mes)},
                    un {f.salto_pct > 0 ? '+' : ''}{f.salto_pct} % sobre los {eur(f.tipico)} de siempre
                    ({f.veces} facturas).
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-dark-100">Cuánto por mes</h2>
              <div className="flex gap-1">
                {[6, 12, 24].map((m) => (
                  <button
                    key={m} onClick={() => setMeses(m)}
                    className={`rounded px-2 py-0.5 text-[11.5px] ${meses === m ? 'bg-brand-500/20 text-brand-200' : 'text-dark-500 hover:text-dark-300'}`}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
            </div>
            <Meses meses={r.meses} cats={cats} />
            {!r.cuadra && (
              <p className="mt-2 text-[11.5px] text-amber-300">
                Ojo: el desglose por categorías no suma el total. Avísame, es un fallo mío.
              </p>
            )}
          </div>

          {/* QUE FURGONETA TE CUESTA DINERO. El dato ya estaba —las ordenes de
              taller entran con su matricula— y es la pregunta que se hace un
              dueno de flota. Solo se pinta si hay algo: una lista vacia en una
              pantalla de dinero solo ocupa sitio. */}
          {(r.vehiculos || []).length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-dark-100">Qué furgoneta te cuesta dinero</h2>
                <span className="text-[11.5px] text-dark-500">
                  Solo lo que lleva matrícula: {r.vehiculos.length} de {r.furgonetas} furgonetas
                </span>
              </div>
              <div className="space-y-1">
                {r.vehiculos.slice(0, 10).map((v) => (
                  <button
                    key={v.matricula} onClick={() => { setQ(v.matricula); setCat('') }}
                    className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/[0.03]"
                  >
                    <span className="shrink-0 font-mono text-[12.5px] text-dark-100">{v.matricula}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-dark-500">{v.que}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-dark-500">{v.veces}×</span>
                    <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-dark-50">{eur(v.importe)}</span>
                    <Search size={11} className="shrink-0 text-dark-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <h2 className="mb-2 text-[13px] font-semibold text-dark-100">En qué se va</h2>
              <div className="space-y-1.5">
                {r.categorias.map((c) => (
                  <button
                    key={c.clave} onClick={() => setCat(cat === c.clave ? '' : c.clave)}
                    className={`block w-full rounded-md px-2 py-1.5 text-left transition-colors ${cat === c.clave ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-dark-200">{c.nombre}</span>
                      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-dark-50">{eur(c.importe)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-dark-800">
                      <div className={`h-full ${COLOR[c.clave] || COLOR.otros}`} style={{ width: `${c.pct}%` }} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-dark-500">
                      {String(c.pct).replace('.', ',')} % del total
                      {c.por_furgo_eur != null && ` · ${eur(c.por_furgo_eur)} por furgoneta`}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <h2 className="text-[13px] font-semibold text-dark-100">Lo que sale todos los meses</h2>
              <p className="mb-2 text-[11.5px] text-dark-500">
                Lo visto en dos meses o más. El importe es el típico, no el último.
              </p>
              {fijos.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-dark-500">
                  Todavía no hay nada que se repita en dos meses distintos.
                </p>
              ) : (
                <div className="space-y-1">
                  {fijos.slice(0, 12).map((f) => (
                    <div key={f.proveedor} className="flex items-baseline justify-between gap-2 border-b border-dark-900/70 py-1 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] text-dark-200">{f.proveedor}</div>
                        {f.que_es && <div className="truncate text-[11px] text-dark-500">{f.que_es}</div>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[12.5px] font-semibold tabular-nums text-dark-100">{eur(f.tipico)}</div>
                        <div className={`text-[10.5px] ${f.falta_este_mes ? 'text-amber-300' : 'text-dark-500'}`}>
                          {f.falta_este_mes ? 'este mes no' : `${f.meses} meses`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
              <h2 className="text-[13px] font-semibold text-dark-100">
                Todas las facturas
                <span className="ml-1.5 font-normal text-dark-500">
                  {cat ? `· ${cats.find((c) => c.clave === cat)?.nombre}` : ''} {d.gastos.length} de {d.total_apuntados}
                </span>
              </h2>
              <div className="flex w-full gap-2 sm:w-auto">
                <input
                  value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
                  className="min-w-0 flex-1 rounded-md border border-dark-700 bg-dark-800 px-2 py-1 text-[12.5px] text-dark-100 placeholder:text-dark-500 sm:w-40 sm:flex-none"
                />
                {cat && (
                  <button onClick={() => setCat('')} className="shrink-0 rounded-md border border-dark-700 px-2 py-1 text-[12px] text-dark-300">
                    Quitar filtro
                  </button>
                )}
                <button
                  onClick={traerTaller} disabled={busyTaller}
                  title="Trae el importe final de las órdenes de taller"
                  className="flex shrink-0 items-center gap-1 rounded-md border border-dark-700 px-2 py-1 text-[12px] text-dark-300"
                >
                  {busyTaller ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />} Taller
                </button>
              </div>
            </div>

            {d.gastos.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-dark-500">Nada con ese filtro.</p>
            ) : (
              <ul className="divide-y divide-dark-900/70">
                {d.gastos.map((g) => (
                  <li key={g.id} className="flex items-start gap-2.5 px-3.5 py-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COLOR[g.categoria] || COLOR.otros}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[13px] font-medium text-dark-100">{g.proveedor}</span>
                        {g.origen === 'taller' && (
                          <span className="shrink-0 rounded bg-dark-800 px-1 text-[10px] text-dark-400">de una orden</span>
                        )}
                        {g.origen === 'correo' && (
                          <span className="shrink-0 rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-300">llegó sola</span>
                        )}
                        {/* No se ha sabido leer el total: se DICE. Una factura
                            apuntada a 0 € que nadie mira es peor que una que
                            pide que la mires. */}
                        {g.revisar && (
                          <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] text-amber-300">sin importe</span>
                        )}
                      </div>
                      <div className="truncate text-[11.5px] leading-snug text-dark-500">
                        {g.que_es || g.concepto || cats.find((c) => c.clave === g.categoria)?.nombre}
                        {g.matricula && ` · ${g.matricula}`}
                      </div>
                      {/* Lo que vino en otra moneda dice a QUE cambio y de QUE
                          DIA: el del BCE de hoy sobre una factura de la semana
                          pasada no es exacto, y eso se tiene que poder ver. */}
                      {g.moneda && g.moneda !== 'EUR' && g.importe_original != null && (
                        <div className="text-[11px] text-dark-500">
                          {g.importe_original} {g.moneda} al cambio del BCE
                          {g.cambio_dia ? ` del ${diaTexto(g.cambio_dia)}` : ''}
                        </div>
                      )}
                      {g.adjunto?.url && (
                        <a
                          href={g.adjunto.url} target="_blank" rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-brand-300 underline decoration-dotted underline-offset-2"
                        >
                          <FileText size={11} /> {g.adjunto.nombre}
                        </a>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[13px] font-semibold tabular-nums text-dark-50">{eur(g.importe)}</div>
                      <div className="text-[11px] tabular-nums text-dark-500">{diaTexto(g.fecha)}</div>
                    </div>
                    <button
                      onClick={() => borrar(g)} aria-label={`Borrar ${g.proveedor}`}
                      className="mt-0.5 shrink-0 rounded p-1 text-dark-500 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="px-1 pb-2 text-[11.5px] leading-snug text-dark-500">
            Esto es lo apuntado aquí, no la contabilidad: lo que no esté puesto no sale en los totales.
            Las reparaciones con importe final salen solas de las órdenes de taller.
          </p>
        </>
      )}
    </div>
  )
}
