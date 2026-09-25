import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Search, Send, ArrowLeft, Check, CheckCheck, AlertTriangle, MessageCircle, Clock } from 'lucide-react'
import {
  getConversaciones, getConversacion, marcarConversacionLeida, responderConversacion,
} from '../api'
import { horaLocal, diaMesLocal } from '../../lib/fecha'

/* CONVERSACIONES DE WHATSAPP.
   Lo que escriben los conductores y talleres, y lo que la app les ha mandado
   (avisos, pre-DNR), juntos y por hora. Se puede contestar con texto libre SOLO
   dentro de las 24 h siguientes a su último mensaje: es una regla de WhatsApp y
   el servidor la vuelve a comprobar, pero aquí se dice antes de que escribas. */

const TIPO = { conductor: 'Conductor', taller: 'Taller' }

function quien(c) { return c.nombre || `+${c.telefono}` }

/* Hoy → la hora; otro día → el día. Se compone a mano (gotcha 11). */
function cuando(iso) {
  if (!iso) return ''
  // `diaMesLocal` acepta cualquier instante: con `Date.now()` sale el dia LOCAL
  // de hoy, sin pasar por toISOString (que en Espana da el dia de ayer de 0 a 2).
  return diaMesLocal(iso) === diaMesLocal(Date.now()) ? horaLocal(iso) : diaMesLocal(iso)
}

/* Las marcas de un mensaje NUESTRO: enviado, entregado, leído o fallido. */
function Marca({ m }) {
  if (m.estado === 'fallido' || m.estado === 'failed') {
    return <span title={m.error || 'No llegó'} className="inline-flex items-center gap-0.5 text-red-300"><AlertTriangle size={11} /> no llegó</span>
  }
  if (m.estado === 'read') return <span title="Leído" className="text-sky-300"><CheckCheck size={13} /></span>
  if (m.estado === 'delivered') return <span title="Entregado" className="text-dark-400"><CheckCheck size={13} /></span>
  return <span title="Enviado" className="text-dark-500"><Check size={13} /></span>
}

export default function Conversaciones() {
  const [lista, setLista] = useState(null)
  const [q, setQ] = useState('')
  const [tel, setTel] = useState('')
  const [hilo, setHilo] = useState(null)
  const [texto, setTexto] = useState('')
  const [envio, setEnvio] = useState(false)
  const [err, setErr] = useState('')
  const caja = useRef(null)     // el scroll de los mensajes
  const abajo = useRef(true)      // ¿estaba abajo del todo? solo entonces se sigue el hilo

  const cargarLista = useCallback(() => {
    getConversaciones(q.trim())
      .then((r) => setLista(r.data?.conversaciones || []))
      .catch(() => setLista((l) => l || []))
  }, [q])

  /* Si falla NO se vacía: se deja lo último bueno (un hilo en blanco parece
     «no ha escrito nadie» y es justo lo que se mira aquí). */
  const cargarHilo = useCallback((t) => {
    if (!t) return
    getConversacion(t).then((r) => {
      // Se compara el hilo ENTERO: un acuse (entregado -> leido) cambia un
      // mensaje del medio, no solo el ultimo.
      setHilo((h) => (JSON.stringify(h) === JSON.stringify(r.data) ? h : r.data))
      if (r.data.mensajes.some((m) => m.sentido === 'entrante' && !m.leido)) {
        marcarConversacionLeida(t).then(cargarLista).catch(() => {})
      }
    }).catch(() => {})
  }, [cargarLista])

  useEffect(() => { cargarLista() }, [cargarLista])
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) { cargarLista(); if (tel) cargarHilo(tel) } }, 12000)
    return () => clearInterval(id)
  }, [cargarLista, cargarHilo, tel])

  const abrir = (t) => { setTel(t); setHilo(null); setErr(''); setTexto(''); abajo.current = true; cargarHilo(t) }

  // Se mueve SOLO la caja de mensajes: `scrollIntoView` arrastraba tambien la
  // pagina entera y la cabecera se iba de la pantalla al llegar un mensaje.
  useEffect(() => {
    const el = caja.current
    if (el && abajo.current) el.scrollTop = el.scrollHeight
  }, [hilo?.mensajes?.length, tel])

  const enviar = async () => {
    const t = texto.trim()
    if (!t || envio) return
    setEnvio(true); setErr('')
    try {
      const r = await responderConversacion(tel, t)
      if (r.data?.ok) { setTexto(''); abajo.current = true } else setErr(`No salió: ${r.data?.error || 'sin detalle'}`)
      cargarHilo(tel); cargarLista()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudo enviar.')
    } finally { setEnvio(false) }
  }

  const v = hilo?.ventana
  let diaAnterior = ''

  return (
    <div className="space-y-4">
      <div>
        <h1 className="rise font-display text-[clamp(26px,3vw,36px)] font-semibold leading-none tracking-[-0.03em] text-dark-50">Conversaciones</h1>
        <p className="mt-1 text-xs text-dark-500">
          WhatsApp del número de la empresa: lo que escriben conductores y talleres, y lo que la app les manda.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[320px_1fr]" style={{ minHeight: '60vh' }}>
        {/* ── Lista ── */}
        <div className={`card flex max-h-[75vh] flex-col overflow-hidden ${tel ? 'hidden md:flex' : ''}`}>
          <div className="relative border-b border-dark-800 p-2.5">
            <Search size={14} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-dark-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona o texto"
              aria-label="Buscar conversación"
              className="input w-full py-2 pl-8 text-[13px]" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {!lista ? (
              <div className="p-6 text-center"><Loader2 className="mx-auto animate-spin text-dark-500" size={18} /></div>
            ) : lista.length === 0 ? (
              <p className="p-6 text-center text-[13px] leading-relaxed text-dark-500">
                {q ? 'Nada coincide.' : 'Aún no hay conversaciones. Aparecerán aquí cuando la app mande un aviso o alguien escriba al número.'}
              </p>
            ) : lista.map((c) => (
              <button key={c.telefono} onClick={() => abrir(c.telefono)}
                className={`flex w-full items-start gap-2.5 border-b border-dark-800/60 px-3 py-2.5 text-left transition hover:bg-white/[0.03] ${
                  tel === c.telefono ? 'bg-white/[0.05]' : ''}`}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                  <MessageCircle size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[13.5px] ${c.no_leidos ? 'font-semibold text-dark-50' : 'text-dark-200'}`}>{quien(c)}</span>
                    <span className="shrink-0 text-[11px] text-dark-500">{cuando(c.ultimo_at)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] text-dark-400">
                      {c.ultimo_sentido === 'saliente' && <span className="text-dark-500">Tú: </span>}
                      {c.ultimo_texto}
                    </span>
                    {c.no_leidos > 0 && (
                      <span className="shrink-0 rounded-full bg-emerald-700 px-1.5 text-[11px] font-semibold text-white">{c.no_leidos}</span>
                    )}
                  </span>
                  {c.tipo && <span className="text-[10.5px] uppercase tracking-wide text-dark-500">{TIPO[c.tipo] || c.tipo}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Hilo ── */}
        <div className={`card flex max-h-[75vh] flex-col overflow-hidden ${tel ? '' : 'hidden md:flex'}`}>
          {!tel ? (
            <div className="m-auto p-8 text-center text-[13px] text-dark-500">
              <MessageCircle className="mx-auto mb-2 text-dark-500" size={26} />
              Elige una conversación.
            </div>
          ) : !hilo ? (
            <div className="m-auto p-8"><Loader2 className="animate-spin text-dark-500" size={18} /></div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-dark-800 px-3 py-2.5">
                <button onClick={() => { setTel(''); setHilo(null) }} aria-label="Volver a la lista"
                  className="rounded-lg p-1.5 text-dark-400 hover:bg-white/[0.05] md:hidden"><ArrowLeft size={16} /></button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-dark-100">{hilo.nombre || `+${hilo.telefono}`}</div>
                  <div className="text-[11.5px] text-dark-500">
                    +{hilo.telefono}{hilo.tipo && ` · ${TIPO[hilo.tipo] || hilo.tipo}`}
                  </div>
                </div>
              </div>

              <div ref={caja} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
                onScroll={(e) => { const el = e.currentTarget; abajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
                {hilo.mensajes.length === 0 && <p className="py-6 text-center text-[13px] text-dark-500">Sin mensajes.</p>}
                {hilo.mensajes.map((m) => {
                  const dia = diaMesLocal(m.at)
                  const cab = dia !== diaAnterior
                  diaAnterior = dia
                  const mio = m.sentido === 'saliente'
                  return (
                    <div key={m.id + m.at}>
                      {cab && <div className="my-2 text-center text-[11px] text-dark-500">{dia}</div>}
                      <div className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug ${
                          mio ? 'rounded-br-md bg-emerald-600/25 text-dark-100' : 'rounded-bl-md bg-white/[0.06] text-dark-100'}`}>
                          {m.texto}
                          <div className={`mt-0.5 flex items-center gap-1.5 text-[10.5px] ${mio ? 'justify-end text-dark-500' : 'text-dark-500'}`}>
                            {mio && m.tipo === 'plantilla' && <span className="rounded bg-white/[0.06] px-1">aviso</span>}
                            <span>{horaLocal(m.at)}</span>
                            {mio && <Marca m={m} />}
                          </div>
                          {mio && m.error && (m.estado === 'fallido' || m.estado === 'failed') && (
                            <div className="mt-0.5 text-[11px] text-red-300">{m.error}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-dark-800 p-2.5">
                {v && !v.abierta ? (
                  <p className="flex items-start gap-1.5 text-[12px] leading-snug text-dark-500">
                    <Clock size={13} className="mt-0.5 shrink-0" />
                    {v.ultimo_entrante
                      ? 'Han pasado más de 24 h desde su último mensaje: WhatsApp solo deja mandarle plantillas (los avisos automáticos) hasta que escriba de nuevo.'
                      : 'Aún no ha escrito: hasta que lo haga, WhatsApp solo deja mandarle plantillas (los avisos automáticos).'}
                  </p>
                ) : (
                  <>
                    {err && <p role="alert" className="mb-1.5 text-[12px] text-red-300">{err}</p>}
                    <div className="flex items-end gap-2">
                      <textarea value={texto} rows={1} onChange={(e) => setTexto(e.target.value)}
                        aria-label="Escribe tu respuesta" placeholder="Escribe una respuesta…"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                        className="input max-h-32 min-h-[38px] flex-1 resize-none py-2 text-[13.5px]" />
                      <button onClick={enviar} disabled={envio || !texto.trim()} aria-label="Enviar"
                        className="btn-primary flex h-[38px] items-center gap-1.5 px-3.5 text-sm disabled:opacity-40">
                        {envio ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                    {v?.cierra_en && (
                      <p className="mt-1 text-[11px] text-dark-500">Puedes contestar hasta las {horaLocal(v.cierra_en)}.</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
