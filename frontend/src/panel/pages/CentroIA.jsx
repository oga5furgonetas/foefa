import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Sparkles, Send, Loader2, Plus, MessageSquare, Check, X, AlertTriangle, Search, Archive, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  getCentroIAEstado, getConversacionesIA, nuevaConversacionIA, getConversacionIA, mensajeIA, propuestaIA,
  archivarConversacionIA,
} from '../api'
import { lista } from '../../lib/lista'
import { fechaHoraLocal } from '../../lib/fecha'

/* CENTRO DE IA (19-10-2026)
   ═══════════════════════════════════════════════════════════════════════════
   Dani: «añádeme en la app un centro de IA, así como tú, en el cual pueda hablar
   con ella y me resuelva cosas o haga cambios que le pida… como si estuviera
   hablando contigo». Claude Sonnet 5.5 por detrás (lo eligió él), para él y la
   oficina de su empresa.

   La IA mira los datos con herramientas y, cuando hay que cambiar algo, deja
   una PROPUESTA que aquí se confirma o se descarta con un botón: nunca cambia
   nada sola. La respuesta se piensa en el servidor y esta pantalla pregunta
   cada poco cómo va (los pasos que da se ven mientras tanto), así que si se
   recarga la página no se pierde nada. */

// Con el centro elegido arriba, si hay uno.
const sugerencias = (c) => {
  const en = c ? ` en ${c}` : ''
  return [
    `¿Hay alguien con dos fichas${en}?`,
    `¿Qué días de las próximas dos semanas no llegan a la máxima${en}?`,
    '¿Qué peticiones de días libres hay pendientes?',
    '¿Qué furgonetas están peor ahora mismo?',
    `Mañana nos piden 44 rutas${en}: ¿cómo cuadramos?`,
    '¿Cómo va la sincronización con la hoja de Google?',
  ]
}

/* Lo justo de formato para lo que escribe la IA: párrafos, listas, **negrita** y `código`. Sin HTML. */
function enLinea(t) {
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let ultimo = 0
  let m
  while ((m = re.exec(t))) {
    if (m.index > ultimo) out.push(t.slice(ultimo, m.index))
    const s = m[0]
    out.push(s.startsWith('**')
      ? <b key={m.index} className="font-semibold text-dark-50">{s.slice(2, -2)}</b>
      : <code key={m.index} className="rounded bg-dark-800 px-1 text-[0.92em]">{s.slice(1, -1)}</code>)
    ultimo = m.index + s.length
  }
  if (ultimo < t.length) out.push(t.slice(ultimo))
  return out
}

function TextoIA({ texto }) {
  const bloques = []
  let lista_ = null
  for (const linea of String(texto || '').split('\n')) {
    const l = linea.trimEnd()
    const vi = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (vi) {
      if (!lista_) { lista_ = { tipo: /^\s*\d/.test(l) ? 'ol' : 'ul', items: [] }; bloques.push(lista_) }
      lista_.items.push(vi[1])
      continue
    }
    lista_ = null
    if (!l.trim()) { bloques.push({ tipo: 'hueco' }); continue }
    const h = l.match(/^#{1,4}\s+(.*)$/)
    bloques.push(h ? { tipo: 'h', texto: h[1] } : { tipo: 'p', texto: l })
  }
  return (
    <div className="space-y-1.5 text-[14px] leading-relaxed text-dark-200">
      {bloques.map((b, i) => {
        if (b.tipo === 'hueco') return null
        if (b.tipo === 'h') return <p key={i} className="pt-1 font-semibold text-dark-50">{enLinea(b.texto)}</p>
        if (b.tipo === 'p') return <p key={i}>{enLinea(b.texto)}</p>
        const L = b.tipo === 'ol' ? 'ol' : 'ul'
        return (
          <L key={i} className={`space-y-0.5 pl-5 ${L === 'ol' ? 'list-decimal' : 'list-disc'}`}>
            {b.items.map((x, j) => <li key={j}>{enLinea(x)}</li>)}
          </L>
        )
      })}
    </div>
  )
}

const ESTADO_PROP = {
  pendiente: null,
  ejecutando: { txt: 'Haciéndolo…', cls: 'text-sky-300' },
  hecha: { txt: 'Hecho', cls: 'text-emerald-300' },
  descartada: { txt: 'Descartada', cls: 'text-dark-500' },
  fallida: { txt: 'No se ha podido', cls: 'text-red-300' },
}

function Propuesta({ p, onDecidir, ocupado }) {
  const est = ESTADO_PROP[p.estado]
  return (
    <div className="rounded-xl border border-brand-500/40 bg-brand-500/[0.06] p-3" data-testid="propuesta">
      <p className="text-[13.5px] font-bold text-dark-50">{p.titulo}</p>
      <ul className="mt-1.5 space-y-0.5 text-[13px] text-dark-300">
        {lista(p.lineas).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      {p.aviso && (
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-amber-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {p.aviso}
        </p>
      )}
      {p.estado === 'pendiente' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => onDecidir(p.id, 'confirmar')} disabled={ocupado}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50">
            <Check size={14} /> Confirmar
          </button>
          <button onClick={() => onDecidir(p.id, 'descartar')} disabled={ocupado}
            className="flex items-center gap-1.5 rounded-lg border border-dark-700 px-3 py-1.5 text-sm text-dark-300 hover:bg-dark-800 disabled:opacity-50">
            <X size={14} /> Descartar
          </button>
        </div>
      ) : est && (
        <p className={`mt-2 text-[12.5px] font-semibold ${est.cls}`}>
          {est.txt}{p.por ? ` · ${p.por}` : ''}{p.resultado?.error ? `: ${p.resultado.error}` : ''}
        </p>
      )}
    </div>
  )
}

/* Los pasos (consultas) seguidos se juntan en una línea plegable: interesan mientras piensa, luego estorban. */
function Pasos({ pasos, vivos }) {
  const [abierto, setAbierto] = useState(false)
  if (vivos) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-dark-400">
        <Loader2 size={13} className="animate-spin" /> {pasos[pasos.length - 1]?.texto || 'Pensando…'}
      </div>
    )
  }
  return (
    <div className="text-[12px] text-dark-500">
      <button onClick={() => setAbierto((a) => !a)} className="flex items-center gap-1 hover:text-dark-300">
        <Search size={12} /> {pasos.length} {pasos.length === 1 ? 'consulta' : 'consultas'}
        {abierto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {abierto && <ul className="mt-1 space-y-0.5 pl-4">{pasos.map((p, i) => <li key={i}>{p.texto}</li>)}</ul>}
    </div>
  )
}

export default function CentroIA() {
  const { center } = useOutletContext() || {}
  const [estadoIA, setEstadoIA] = useState(null)
  const [convs, setConvs] = useState([])
  const [actual, setActual] = useState(null)       // la conversación abierta, entera
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState('')
  const [verLista, setVerLista] = useState(false)  // en el móvil, la lista de conversaciones va plegada
  const abajo = useRef(null)

  const cargarLista = useCallback(() => {
    getConversacionesIA().then(({ data }) => setConvs(lista(data?.conversaciones))).catch(() => {})
  }, [])
  const cargarEstado = useCallback(() => {
    getCentroIAEstado().then(({ data }) => setEstadoIA(data)).catch((e) => setErr(e?.response?.data?.detail || 'No se ha podido abrir el Centro de IA.'))
  }, [])
  useEffect(() => { cargarEstado(); cargarLista() }, [cargarEstado, cargarLista])

  const abrir = useCallback(async (id) => {
    setErr('')
    try { const { data } = await getConversacionIA(id); setActual(data); setVerLista(false) }
    catch (e) { setErr(e?.response?.data?.detail || 'No se ha podido abrir la conversación.') }
  }, [])

  // Mientras piensa, se pregunta cada poco cómo va.
  const pensando = actual?.estado === 'pensando'
  useEffect(() => {
    if (!pensando) return undefined
    const t = setInterval(async () => {
      try {
        const { data } = await getConversacionIA(actual.id)
        setActual(data)
        if (data.estado !== 'pensando') { cargarEstado(); cargarLista() }
      } catch { /* la siguiente vuelta lo intenta otra vez */ }
    }, 1500)
    return () => clearInterval(t)
  }, [pensando, actual?.id, cargarEstado, cargarLista])

  useEffect(() => { abajo.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [actual?.vista?.length])

  async function enviar(t) {
    const msg = (t ?? texto).trim()
    if (!msg || enviando || pensando) return
    setEnviando(true); setErr('')
    try {
      let conv = actual
      if (!conv) { const { data } = await nuevaConversacionIA(); conv = data }
      await mensajeIA(conv.id, msg, center && center !== 'Todos' ? center : '')
      setTexto('')
      const { data } = await getConversacionIA(conv.id)
      setActual(data)
      cargarLista()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido enviar.')
    } finally { setEnviando(false) }
  }

  async function decidir(pid, accion) {
    if (!actual) return
    setEnviando(true); setErr('')
    try {
      await propuestaIA(actual.id, pid, accion)
      const { data } = await getConversacionIA(actual.id)
      setActual(data)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido.')
    } finally { setEnviando(false) }
  }

  async function archivar(id) {
    try { await archivarConversacionIA(id) } catch { /* ya no estaba */ }
    if (actual?.id === id) setActual(null)
    cargarLista()
  }

  // La vista, con los pasos seguidos juntos.
  const items = []
  for (const v of lista(actual?.vista)) {
    const ultimo = items[items.length - 1]
    if (v.tipo === 'paso' && ultimo?.tipo === 'pasos') ultimo.pasos.push(v)
    else if (v.tipo === 'paso') items.push({ tipo: 'pasos', pasos: [v] })
    else items.push(v)
  }
  const sinClave = estadoIA && !estadoIA.configurada

  return (
    <div className="mx-auto flex h-[calc(100dvh-12rem)] max-w-6xl gap-4 md:h-[calc(100dvh-7rem)]" data-testid="centro-ia">
      {/* Conversaciones */}
      <aside className={`${verLista ? 'flex' : 'hidden'} w-full shrink-0 flex-col gap-2 md:flex md:w-64`}>
        <button onClick={() => { setActual(null); setVerLista(false) }}
          className="btn-primary flex items-center justify-center gap-2 px-3 py-2 text-sm">
          <Plus size={15} /> Conversación nueva
        </button>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {convs.map((c) => (
            <div key={c.id} className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-[13px] ${actual?.id === c.id ? 'bg-dark-800 text-dark-50' : 'text-dark-300 hover:bg-dark-800/60'}`}>
              <button onClick={() => abrir(c.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate">{c.titulo}</span>
                <span className="block text-[11px] text-dark-500">{fechaHoraLocal(c.actualizado_en)}</span>
              </button>
              <button onClick={() => archivar(c.id)} title="Quitar de la lista" aria-label="Quitar de la lista"
                className="shrink-0 rounded p-1 text-dark-500 opacity-0 hover:text-dark-200 group-hover:opacity-100">
                <Archive size={13} />
              </button>
            </div>
          ))}
          {!convs.length && <p className="px-2 text-[12.5px] text-dark-500">Aún no hay conversaciones.</p>}
        </div>
      </aside>

      {/* Chat */}
      <section className={`${verLista ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col rounded-2xl border border-dark-800 bg-dark-900/50 md:flex`}>
        <header className="flex flex-wrap items-center gap-2 border-b border-dark-800 px-4 py-3">
          <button onClick={() => setVerLista(true)} className="rounded-lg p-1 text-dark-400 md:hidden" aria-label="Conversaciones">
            <MessageSquare size={18} />
          </button>
          <Sparkles size={18} className="text-brand-400" />
          <h1 className="font-display text-[17px] font-bold text-dark-50">Centro de IA</h1>
          <span className="text-[12px] text-dark-500">{estadoIA?.modelo || ''}</span>
          {estadoIA && (
            <span className="ml-auto text-[12px] text-dark-500" title="Lo gastado hoy en la IA por ti">
              Hoy: {Number(estadoIA.gastado_hoy_usd || 0).toFixed(2)} $ de {Number(estadoIA.tope_diario_usd || 0).toFixed(0)} $
            </span>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {sinClave && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
              Falta poner la clave de Anthropic en el servidor. Cuando esté, ya se puede hablar con la IA.
            </p>
          )}
          {!actual?.vista?.length && (
            <div className="mx-auto max-w-xl space-y-4 pt-6 text-center">
              <Sparkles size={28} className="mx-auto text-brand-400" />
              <p className="text-[15px] text-dark-200">
                Pregúntale lo que quieras de la flota, el cuadrante o la gente. Mira los datos de verdad y, si hay que
                cambiar algo, te lo deja preparado para que lo confirmes con un botón: nunca cambia nada sola.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {sugerencias(center && center !== 'Todos' ? center : '').map((s) => (
                  <button key={s} onClick={() => enviar(s)} disabled={enviando || sinClave}
                    className="rounded-full border border-dark-700 px-3 py-1.5 text-[12.5px] text-dark-300 hover:bg-dark-800 disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {items.map((v, i) => {
            if (v.tipo === 'usuario') {
              return (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-500/15 px-3.5 py-2 text-[14px] text-dark-100">{v.texto}</p>
                </div>
              )
            }
            if (v.tipo === 'pasos') return <Pasos key={i} pasos={v.pasos} vivos={pensando && i === items.length - 1} />
            if (v.tipo === 'propuesta') {
              const p = actual?.propuestas?.[v.id]
              return p ? <Propuesta key={i} p={p} onDecidir={decidir} ocupado={enviando || pensando} /> : null
            }
            if (v.tipo === 'aviso') {
              return (
                <p key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {v.texto}
                </p>
              )
            }
            return <TextoIA key={i} texto={v.texto} />
          })}
          {pensando && items[items.length - 1]?.tipo !== 'pasos' && (
            <div className="flex items-center gap-2 text-[12.5px] text-dark-400"><Loader2 size={13} className="animate-spin" /> Pensando…</div>
          )}
          <div ref={abajo} />
        </div>

        {err && <p className="mx-4 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}
        <form onSubmit={(e) => { e.preventDefault(); enviar() }} className="flex items-end gap-2 border-t border-dark-800 p-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} disabled={sinClave}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder={pensando ? 'Pensando… espera a que conteste' : 'Escribe lo que necesitas…'}
            aria-label="Mensaje para la IA"
            className="max-h-40 min-h-[42px] flex-1 resize-none rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 text-[14px] text-dark-100 placeholder:text-dark-500 focus:border-brand-500 focus:outline-none" />
          <button type="submit" disabled={!texto.trim() || enviando || pensando || sinClave} aria-label="Enviar"
            className="btn-primary flex h-[42px] items-center gap-1.5 px-3.5 disabled:opacity-50">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </section>
    </div>
  )
}
