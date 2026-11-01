import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ScanLine, Loader2, Check, List, Truck, Search } from 'lucide-react'
import { repEscanearCarga, repMiCargado } from '../../services/api'
import { tx, useIdioma, txError } from '../../lib/idioma'
import { decir, vozActiva } from '../../lib/voz'
import { huecoHablado } from '../../lib/briefing'
import { medirAccion } from '../../lib/analitica'
import { useAtras } from '../../lib/atras'

/* ── LA CARGA GUIADA (01-11-2026) ────────────────────────────────────────────
   En la nave, con la ruta ya ordenada: escaneas cada paquete y la app te dice en qué hueco de la furgoneta va (el
   servidor se lo puso a cada parada al ordenar: lo primero que se entrega, junto a la puerta por la que se carga; lo
   último, al fondo). Lo dice en grande y por voz, y cuenta cuántos van. Al llegar a cada parada, su ficha ya dice el
   hueco. Quien carga sin escanear tiene la lista por hueco con una casilla por paquete. Es la queja literal de las
   reseñas de Routal («en ruta no puedes ver qué paquetes entran en cada parada») y lo que Bettermile mide en 2-3 min
   por parada. Los huecos son los seis de siempre (`HUECOS` en MiRuta), con sus traducciones. */
export const HUECOS = ['Delante · izq', 'Delante · der', 'Medio · izq', 'Medio · der', 'Detrás · izq', 'Detrás · der']
const FILAS = [['Delante · izq', 'Delante · der'], ['Medio · izq', 'Medio · der'], ['Detrás · izq', 'Detrás · der']]

export default function CargaGuiada({ pedidos, cargaPor = 'traseras', Escaner, onClose, onCambio }) {
  useIdioma()
  useAtras(true, onClose)
  const [vista, setVista] = useState('furgoneta')      // furgoneta | lista
  const [escaner, setEscaner] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [ultimo, setUltimo] = useState(null)           // lo último escaneado: { pedido, cargados, total }
  const [error, setError] = useState('')
  useEffect(() => { medirAccion('ruta_carga') }, [])

  const { porHueco, sinHueco } = useMemo(() => {
    const m = {}
    HUECOS.forEach((h) => { m[h] = [] })
    const sin = []
    pedidos.forEach((p) => { if (m[p.hueco]) m[p.hueco].push(p); else sin.push(p) })
    const orden = (a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9)
    Object.values(m).forEach((l) => l.sort(orden))
    sin.sort(orden)
    return { porHueco: m, sinHueco: sin }
  }, [pedidos])
  const cargados = pedidos.filter((p) => p.cargado_en).length
  const total = pedidos.length
  const faltan = total - cargados
  const lateral = cargaPor === 'lateral'
  // El orden de carga: la fila de la puerta primero (detrás con puertas traseras; delante con la lateral).
  const filasEnOrden = lateral ? FILAS : [...FILAS].reverse()

  async function escaneado(c) {
    const valores = (Array.isArray(c) ? c : [c]).map((v) => String(v || '').trim()).filter(Boolean)
    if (!valores.length) return
    setOcupado('escaneo'); setError('')
    try {
      const { data } = await repEscanearCarga(valores)
      if (!data.encontrado) {
        setError(tx('No es de tu ruta de hoy.'))
        if (navigator.vibrate) navigator.vibrate([60, 60, 60])
        return
      }
      setUltimo(data)
      if (navigator.vibrate) navigator.vibrate(80)
      if (vozActiva()) decir(data.pedido?.hueco ? huecoHablado(data.pedido.hueco) : tx('Sin hueco'))
      setCodigo('')
      onCambio?.()
    } catch (e) {
      setError(txError(e, 'No se ha podido'))
    } finally { setOcupado('') }
  }

  async function marcar(p, cargado) {
    setOcupado(`marca-${p.id}`); setError('')
    try { await repMiCargado(p.id, cargado); onCambio?.() } catch (e) { setError(txError(e, 'No se ha podido')) } finally { setOcupado('') }
  }

  const ordenUltimo = ultimo?.pedido?.orden ?? '–'
  const estadoEscaner = [tx('{a} de {b} cargados', { a: cargados, b: total }),
    ultimo?.pedido ? `${tx('Parada {n}', { n: ordenUltimo })} · ${ultimo.pedido.cliente || ultimo.pedido.direccion}\n${ultimo.pedido.hueco ? tx(ultimo.pedido.hueco) : tx('Sin hueco')}` : '',
    error].filter(Boolean).join('\n')

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-dark-950 text-dark-50" role="dialog" aria-label={tx('Cargar la furgoneta')}>
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={onClose} aria-label={tx('Volver')} className="rounded-lg p-2 text-dark-300 hover:bg-dark-800"><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-300">{tx('Cargar la furgoneta')}</p>
            <p className="text-[20px] font-bold leading-tight">{tx('Escanea y te digo dónde va')}</p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12.5px] font-bold text-emerald-200" aria-live="polite">
            {tx('{a} de {b} cargados', { a: cargados, b: total })}
          </span>
        </div>
        <p className="mb-3 text-[12.5px] text-dark-400">
          {tx('La ruta ya está ordenada: lo primero que se entrega va junto a la puerta y lo último, al fondo.')}
          {' '}{lateral ? tx('Cargas por la puerta lateral.') : tx('Cargas por las puertas traseras.')}
        </p>

        <div className="mb-3 flex gap-2">
          <button onClick={() => setVista('furgoneta')} className={`flex-1 rounded-xl py-2 text-[13px] font-semibold ${vista === 'furgoneta' ? 'bg-dark-800 text-dark-50' : 'text-dark-400'}`}>
            <Truck size={14} className="mr-1 inline" /> {tx('Furgoneta')}
          </button>
          <button onClick={() => setVista('lista')} className={`flex-1 rounded-xl py-2 text-[13px] font-semibold ${vista === 'lista' ? 'bg-dark-800 text-dark-50' : 'text-dark-400'}`}>
            <List size={14} className="mr-1 inline" /> {tx('Lista por hueco')}
          </button>
        </div>

        {vista === 'furgoneta' ? (
          <div className="rounded-3xl border border-dark-700 bg-dark-900 p-3">
            <div className="mb-2 rounded-xl bg-dark-800 py-1.5 text-center text-[11px] font-semibold text-dark-400">{tx('Cabina')}</div>
            {lateral && <p className="mb-1 text-[11px] font-semibold text-brand-300">← {tx('Puerta lateral')}</p>}
            {FILAS.map((fila) => (
              <div key={fila[0]} className="mb-2 grid grid-cols-2 gap-2">
                {fila.map((h) => {
                  const l = porHueco[h]
                  const c = l.filter((p) => p.cargado_en).length
                  const activo = ultimo?.pedido?.hueco === h
                  return (
                    <div key={h} data-hueco={h} className={`rounded-2xl border p-3 text-center ${activo ? 'border-emerald-400 bg-emerald-500/15' : l.length ? 'border-brand-400/40 bg-brand-500/10' : 'border-dark-700 bg-dark-950'}`}>
                      <p className="text-[12px] font-semibold text-dark-200">{tx(h)}</p>
                      <p className="text-[24px] font-bold leading-tight">{l.length}</p>
                      <p className="text-[11px] text-dark-400">{tx('{a} cargados', { a: c })}</p>
                    </div>
                  )
                })}
              </div>
            ))}
            <p className="text-center text-[11px] text-dark-400">
              {lateral ? tx('Lo de delante se entrega primero.') : `${tx('Puertas traseras')} ↓ · ${tx('Lo de detrás se entrega primero.')}`}
            </p>
            {sinHueco.length > 0 && (
              <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                {tx('{n} paradas sin hueco (sin ubicar o sin ordenar): salen en «Lista por hueco».', { n: sinHueco.length })}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {[...filasEnOrden.flat().map((h) => [h, porHueco[h]]), [tx('Sin hueco'), sinHueco]].filter(([, l]) => l.length).map(([h, l]) => (
              <section key={h} className="rounded-2xl border border-dark-700 bg-dark-900 p-3">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-brand-300">{HUECOS.includes(h) ? tx(h) : h} · {l.length}</p>
                <ul className="divide-y divide-dark-800">
                  {l.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <button onClick={() => marcar(p, !p.cargado_en)} disabled={ocupado === `marca-${p.id}`} role="checkbox" aria-checked={!!p.cargado_en}
                        aria-label={`${p.cliente || p.direccion}: ${tx('cargado')}`}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${p.cargado_en ? 'border-emerald-400 bg-emerald-500 text-[#052e16]' : 'border-dark-600 text-dark-500'}`}>
                        {ocupado === `marca-${p.id}` ? <Loader2 size={16} className="animate-spin" /> : p.cargado_en ? <Check size={18} /> : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{p.orden ? `${p.orden}. ` : ''}{p.cliente || p.direccion}</p>
                        <p className="truncate text-[12px] text-dark-400">{p.cliente ? p.direccion : ''}{p.bultos > 1 ? ` · ${tx('{n} bultos', { n: p.bultos })}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {ultimo?.pedido && (
          <div className="mt-3 rounded-2xl border-2 border-emerald-400 bg-dark-900 p-4" aria-live="polite">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">{tx('Escaneado')} · {tx('{a} de {b} cargados', { a: ultimo.cargados ?? cargados, b: ultimo.total ?? total })}</p>
            <p className="mt-1 text-[17px] font-bold leading-tight">{tx('Parada {n}', { n: ordenUltimo })} · {ultimo.pedido.cliente || ultimo.pedido.direccion}</p>
            <p className="mt-1 text-[26px] font-bold leading-tight text-emerald-200">→ {ultimo.pedido.hueco ? tx(ultimo.pedido.hueco) : tx('Sin hueco')}</p>
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-red-200">{error}</p>}

        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); escaneado(codigo) }}>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={tx('Escribe o pega un código')} aria-label={tx('Escribe o pega un código')}
            inputMode="text" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 text-[14px]" />
          <button type="submit" disabled={!codigo.trim() || ocupado === 'escaneo'} className="rounded-xl border border-dark-700 px-3 text-[13px] font-semibold text-dark-200 disabled:opacity-40">
            {ocupado === 'escaneo' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          </button>
        </form>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-dark-800 bg-dark-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          <button onClick={() => { setError(''); setEscaner(true) }} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-[15px] font-bold text-[#052e16]">
            <ScanLine size={18} /> {tx('Escanear para cargar')}
          </button>
          <button onClick={onClose} className="rounded-2xl border border-dark-700 px-4 py-3.5 text-[14px] font-semibold text-dark-200">
            {faltan > 0 ? tx('Salir ({n} faltan)', { n: faltan }) : tx('Todo cargado')}
          </button>
        </div>
      </div>

      {escaner && Escaner && <Escaner seguido onCodigo={escaneado} onClose={() => setEscaner(false)} estado={estadoEscaner} />}
    </div>
  )
}
