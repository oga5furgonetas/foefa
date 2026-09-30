import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, X, Check, Ban, Sparkles, MessageSquare } from 'lucide-react'
import {
  cuadranteChatVer, cuadranteChat, cuadranteChatConfirmar, cuadranteChatCancelar,
} from '../api'
import { lista } from '../../lib/lista'

/* ── EL CHAT DEL CUADRANTE ─────────────────────────────────────────────────
   Dani: «ten en cuenta que Juanmi esta semana no puede», «recalibra, estos 3
   están de baja». Se escribe normal; el servidor lo convierte en órdenes (sin
   IA para lo de siempre, con IA si la frase es rara) y aquí se enseña
   «He entendido esto:» línea a línea. NADA se aplica hasta pulsar Confirmar,
   y cada línea se puede desmarcar antes. Lo que cambie el cuadrante vuelve
   como PROPUESTA a la tabla, que se acepta aparte. */

const EJEMPLOS = [
  'Juanmi esta semana no puede trabajar',
  'Dale libre a Taofik el sábado',
  'Kevin nunca puede los martes',
  'El viernes 9 ponme +3',
  '¿Quién libra el sábado?',
]

function Burbuja({ m, onConfirmar, onCancelar, ocupado }) {
  const [quitar, setQuitar] = useState(() => new Set())
  if (m.rol === 'usuario') {
    return (
      <div className="ml-8 self-end rounded-2xl rounded-br-md bg-brand-500/15 px-3 py-2 text-[13px] text-dark-100">
        {m.texto}
      </div>
    )
  }
  const lineas = lista(m.lineas)
  const acciones = lista(m.acciones)
  // Qué acción es cada línea: las de hablar (responder/preguntar) no tienen línea.
  const idxAccion = acciones
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !['responder', 'preguntar'].includes(a.accion))
    .map(({ i }) => i)
  const pregunta = acciones.find((a) => a.accion === 'preguntar')
  return (
    <div className="mr-6 space-y-2 rounded-2xl rounded-bl-md border border-dark-700 bg-dark-900 px-3 py-2.5 text-[13px] text-dark-200">
      {m.estado === 'pendiente' && lineas.length > 0 ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dark-500">He entendido esto:</p>
          <ul className="space-y-1">
            {lineas.map((l, k) => {
              const i = idxAccion[k]
              const fuera = quitar.has(i)
              return (
                <li key={k}>
                  <label className={`flex cursor-pointer items-start gap-2 ${fuera ? 'text-dark-500 line-through' : 'text-dark-100'}`}>
                    <input type="checkbox" checked={!fuera} disabled={ocupado}
                      onChange={() => setQuitar((s) => {
                        const n = new Set(s)
                        if (n.has(i)) n.delete(i); else n.add(i)
                        return n
                      })}
                      className="mt-0.5" />
                    <span>{l}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => onConfirmar(m, [...quitar])} disabled={ocupado || quitar.size >= lineas.length}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40">
              {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirmar
            </button>
            <button onClick={() => onCancelar(m)} disabled={ocupado}
              className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-300 hover:bg-dark-800 disabled:opacity-40">
              <Ban size={13} /> Cancelar
            </button>
          </div>
          <p className="text-[11px] text-dark-500">¿No es eso? Escríbelo de otra forma y te propongo otra cosa.</p>
        </>
      ) : (
        <p className="whitespace-pre-line">{m.texto || m.resumen || (pregunta && pregunta.texto) || '…'}</p>
      )}
      {pregunta && lista(pregunta.opciones).length > 0 && m.estado !== 'confirmada' && (
        <p className="text-[12px] text-dark-400">
          Puede ser: {lista(pregunta.opciones).map((o) => (typeof o === 'string' ? o : o.nombre)).join(' · ')}
        </p>
      )}
      {m.estado === 'confirmada' && (
        <div className="space-y-1 text-[12px]">
          {lista(m.hechas).map((h, k) => <p key={k} className="text-emerald-300">✓ {h}</p>)}
          {m.propuesta_id && <p className="text-dark-400">La propuesta está en la tabla: revísala y acéptala arriba.</p>}
          {m.error && <p className="text-amber-300">{m.error}</p>}
        </div>
      )}
      {m.estado === 'cancelada' && <p className="text-[12px] text-dark-500">Cancelado: no se ha cambiado nada.</p>}
      {lista(m.malas).length > 0 && (
        <p className="text-[11px] text-amber-300">No se aplicará: {lista(m.malas).join(' · ')}</p>
      )}
      {m.aviso && <p className="text-[11px] text-dark-500">{m.aviso}</p>}
      {m.fuente === 'ia' && <p className="flex items-center gap-1 text-[10.5px] text-dark-500"><Sparkles size={10} /> entendido con IA</p>}
    </div>
  )
}

export default function CuadranteChat({ center, desde, hasta, onAplicado, onCerrar }) {
  const [mensajes, setMensajes] = useState(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ocupado, setOcupado] = useState('')
  const [err, setErr] = useState('')
  const fondo = useRef(null)

  useEffect(() => {
    let vivo = true
    setMensajes(null)
    cuadranteChatVer(center)
      .then((r) => { if (vivo) setMensajes(lista(r.data?.mensajes)) })
      .catch(() => { if (vivo) setMensajes([]) })
    return () => { vivo = false }
  }, [center])

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: 'end' })
  }, [mensajes])

  const enviar = async (txt) => {
    const mensaje = (txt ?? texto).trim()
    if (!mensaje || enviando) return
    setEnviando(true); setErr('')
    setMensajes((ms) => [...(ms || []), { id: `yo-${Date.now()}`, rol: 'usuario', texto: mensaje }])
    setTexto('')
    try {
      const r = await cuadranteChat({ center, mensaje, desde, hasta })
      setMensajes((ms) => [...(ms || []), r.data])
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido enviar. Prueba otra vez.')
    } finally { setEnviando(false) }
  }

  const confirmar = async (m, quitar) => {
    setOcupado(m.id); setErr('')
    try {
      const r = await cuadranteChatConfirmar(m.id, quitar)
      setMensajes((ms) => (ms || []).map((x) => (x.id === m.id
        ? { ...x, estado: 'confirmada', hechas: r.data?.hechas, propuesta_id: r.data?.propuesta?.id, error: r.data?.error }
        : x)))
      onAplicado?.(r.data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido aplicar.')
    } finally { setOcupado('') }
  }

  const cancelar = async (m) => {
    setOcupado(m.id)
    try {
      await cuadranteChatCancelar(m.id)
      setMensajes((ms) => (ms || []).map((x) => (x.id === m.id ? { ...x, estado: 'cancelada' } : x)))
    } catch { /* se ve al recargar */ } finally { setOcupado('') }
  }

  /* Opaco: con `.card` (fondo al 70 %) se leía la tabla de debajo a través de
     los mensajes (30-09-2026, «se superpone texto por debajo»). */
  return (
    <aside className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-dark-700 bg-dark-900 shadow-2xl shadow-black/30">
      <header className="flex items-center gap-2 border-b border-dark-800 px-3 py-2.5">
        <MessageSquare size={15} className="text-brand-400" />
        <h2 className="text-sm font-bold text-dark-100">Asistente del cuadrante</h2>
        {onCerrar && (
          <button onClick={onCerrar} aria-label="Cerrar el chat" className="ml-auto text-dark-500 hover:text-dark-200">
            <X size={16} />
          </button>
        )}
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {mensajes === null ? (
          <div className="flex items-center gap-2 py-6 text-dark-400"><Loader2 size={15} className="animate-spin" /> Cargando…</div>
        ) : mensajes.length === 0 ? (
          <div className="space-y-2 text-[12.5px] text-dark-400">
            <p>Dime lo que haya que tener en cuenta y lo aplico al cuadrante. Por ejemplo:</p>
            {EJEMPLOS.map((e) => (
              <button key={e} onClick={() => enviar(e)}
                className="block w-full rounded-lg border border-dark-700 px-2.5 py-1.5 text-left text-dark-200 hover:bg-dark-800">
                «{e}»
              </button>
            ))}
          </div>
        ) : (
          mensajes.map((m) => (
            <Burbuja key={m.id} m={m} onConfirmar={confirmar} onCancelar={cancelar} ocupado={ocupado === m.id} />
          ))
        )}
        {enviando && (
          <div className="flex items-center gap-2 text-[12px] text-dark-500"><Loader2 size={13} className="animate-spin" /> Pensando…</div>
        )}
        <div ref={fondo} />
      </div>
      {err && <p className="px-3 pb-1 text-[12px] text-red-300">{err}</p>}
      <form className="flex items-end gap-2 border-t border-dark-800 p-2.5"
        onSubmit={(e) => { e.preventDefault(); enviar() }}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder="Escribe una orden o una pregunta…" aria-label="Mensaje para el asistente del cuadrante"
          className="min-h-[2.6rem] flex-1 resize-none rounded-lg border border-dark-700 bg-dark-900 px-2.5 py-1.5 text-[13px] text-dark-100 placeholder:text-dark-500" />
        <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar"
          className="btn-primary flex h-10 w-10 items-center justify-center disabled:opacity-40">
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </aside>
  )
}
