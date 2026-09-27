import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Check, X, Radio, History, PauseCircle } from 'lucide-react'
import {
  getValorEstado, getValorOportunidades, getValorSeguras, getValorApuestas,
  apuntarApuestaValor, apuntarApuestaValorAMano, liquidarApuestaValor, getValorAprendizaje,
  getValorHistorial, getValorCasas, guardarValorCasas,
} from '../api'
import { useToast } from '../../lib/toast'

/* VALOR — dónde una casa paga más de lo que vale un resultado, y cuánto meter.

   SOLO la ve Dani: el menú la enseña únicamente al super-admin, la ruta echa
   a cualquier otro y el servidor contesta 403 a todo el que no sea él
   (`require_valor`). Aquí no hay datos de la flota, ni los de aquí van a Mongo.

   Cada aviso responde en un vistazo, en este orden: qué y dónde, a qué cuota
   contra cuál debería estar, DE CUÁNDO SON LOS DATOS y hasta cuándo vale, y
   cuánto meter. Un +10 % con datos de hace 18 minutos no puede parecer lo
   mismo que un +7 % recién leído: la edad va a la misma altura que la ventaja.
   Lo que ya no vale se queda a la vista, marcado (CADUCADA / CUOTA CAMBIADA),
   en vez de desaparecer sin más. El detalle matemático, plegado en «Por qué». */

const eur = (x) => `${(Number(x) || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`
const pct = (x) => `${x > 0 ? '+' : ''}${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
const pctSin = (x) => `${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
const cuota = (x) => Number(x).toFixed(2).replace('.', ',')
const num = (s) => Number(String(s ?? '').replace(',', '.'))
const cuando = (iso) => new Date(iso).toLocaleString('es-ES', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})
const hora = (iso, seg = false) => (iso ? new Date(iso).toLocaleTimeString('es-ES', {
  hour: '2-digit', minute: '2-digit', ...(seg ? { second: '2-digit' } : {}),
}) : '—')
const lista = (x) => (Array.isArray(x) ? x : [])
const minutos = (ms) => Math.max(0, Math.round(ms / 60000))
const hace = (iso, ahora = Date.now()) => {
  if (!iso) return ''
  const min = Math.round((ahora - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`
}

// Se lee detrás de «Métele 20 € a…»: «a que gana Betis», «al empate», «a más de 2.5».
const SEL = { empate: 'l empate', mas: ' más de', menos: ' menos de',
              si: ' que marcan los dos', no: ' que no marcan los dos' }
function seleccion(mercado, linea, sel, local, visitante) {
  let t = SEL[sel] || ` ${sel}`
  if (sel === 'local') t = ` que gana ${local}`
  if (sel === 'visitante') t = ` que gana ${visitante}`
  if (mercado === 'totales') t += ` ${String(linea).replace('.', ',')}`
  if (mercado === 'handicap') {
    const l = sel === 'local' ? linea : -linea
    t += ` (${l > 0 ? '+' : ''}${String(l).replace('.', ',')})`
  }
  return t
}

/* El reloj de la pantalla: las señales caducan solas mientras se miran. */
function useAhora(cada = 15000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cada)
    return () => clearInterval(t)
  }, [cada])
  return ahora
}

/* El estado de una señal AHORA: el servidor lo da al cargar, y aquí caduca
   sola cuando pasa su hora sin esperar a la siguiente carga. */
function estadoDe(o, ahora) {
  const e = o.estado || 'valida'
  if (e === 'valida' && o.valida_hasta && Date.parse(o.valida_hasta) <= ahora) {
    return { estado: 'caducada', motivo: 'Sus cuotas ya tienen demasiados minutos: no se sabe si siguen ahí.' }
  }
  return { estado: e, motivo: o.motivo || '' }
}

/* Las fuentes de cuotas, con su estado. Una pantalla sin chollos tiene que
   decir si es que no los hay o que no está leyendo nada. */
const FUENTES = [
  ['the_odds_api', 'The Odds API', 'créditos', 'crédito'], ['oddspapi', 'OddsPapi', 'peticiones', 'petición'],
  ['api_football', 'API-Football', 'llamadas', 'llamada'],
]
const cadaCuanto = (min) => (min < 120 ? `${min} min` : `${Math.round(min / 60)} h`)

function estadoFuente(est, k, d) {
  if (!est.claves?.[k]) return ['bg-amber-400', 'sin clave']
  if (!est.escaneando) return ['bg-dark-600', 'clave puesta · buscador apagado']
  if (d?.error) return ['bg-red-400', `la última lectura falló: ${d.error}`]
  if (d?.ultima) return ['bg-emerald-400', `leída ${hace(d.ultima)}`]
  if (d?.sin_partido) return ['bg-dark-600', 'sin partidos en 24 h: no gasta']
  return ['bg-dark-600', 'esperando su primera lectura']
}

function Fuentes({ est }) {
  const det = Object.fromEntries(lista(est.fuentes_detalle).map((f) => [f.nombre, f]))
  return (
    <div className="flex flex-wrap gap-2">
      {FUENTES.map(([k, nombre]) => {
        const [color, texto] = estadoFuente(est, k, det[k])
        return (
          <span key={k} className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[12px] text-dark-300">
            <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
            <b className="whitespace-nowrap font-semibold text-dark-100">{nombre}</b> {texto}
          </span>
        )
      })}
    </div>
  )
}

const PESTANAS = [
  ['valor', 'Valor'], ['vivo', 'En vivo'], ['seguras', 'Seguras'],
  ['apuestas', 'Mis apuestas'], ['aprende', 'Aprendizaje'], ['datos', 'Datos'],
]

function Chip({ children, tono, title }) {
  const color = {
    valor: 'bg-sky-500/15 text-sky-300', vivo: 'bg-red-500/15 text-red-300',
    segura: 'bg-emerald-500/15 text-emerald-300', mejor: 'bg-brand-500/20 text-brand-200',
    fallo: 'bg-amber-500/15 text-amber-300', valida: 'bg-emerald-500/15 text-emerald-300',
    caducada: 'bg-red-500/15 text-red-300', gris: 'bg-white/[0.06] text-dark-300',
  }[tono]
  return <span title={title} className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider ${color}`}>{children}</span>
}

function Aviso({ children }) {
  return <div className="mt-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[12.5px] leading-snug text-amber-300">{children}</div>
}

function Dato({ etiqueta, children, tono = 'text-dark-50' }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-dark-500">{etiqueta}</dt>
      <dd className={`mt-0.5 font-display text-[19px] font-semibold tabular-nums leading-tight ${tono}`}>{children}</dd>
    </div>
  )
}

/* «La he metido»: se abre con lo detectado ya escrito (cuota e importe) y se
   cambia solo lo que haya cambiado. Lo que se apunta es la APUESTA; la señal
   no se toca. Con la cuota que se escriba se recalcula la ventaja: si la casa
   te la ha bajado hasta dejarla sin valor, se ve antes de confirmar. */
function ModalApuesta({ o, aunCaducada: aunCaducadaIni, motivo, onClose, alApuntar }) {
  const toast = useToast()
  const [c, setC] = useState(cuota(o.cuota))
  const [imp, setImp] = useState(String(o.importe_max ?? o.importe ?? ''))
  const [limitada, setLimitada] = useState(false)
  const [aunCaducada, setAunCaducada] = useState(!!aunCaducadaIni)
  const [aviso, setAviso] = useState(motivo || '')
  const [enviando, setEnviando] = useState(false)
  const ref = useRef(null)
  const cerrar = useRef(onClose)
  useEffect(() => { cerrar.current = onClose }, [onClose])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') cerrar.current() }
    document.addEventListener('keydown', k)
    ref.current?.querySelector('input')?.focus()
    return () => document.removeEventListener('keydown', k)
  }, [])

  const cReal = num(c)
  const evReal = cReal > 1 ? o.prob_justa * cReal - 1 : null
  const tope = o.importe_max ?? o.importe
  const pasa = tope != null && num(imp) > tope

  async function apuntar(e) {
    e.preventDefault()
    setEnviando(true)
    try {
      await apuntarApuestaValor({ oportunidad_id: o.id, cuota: c, importe: imp, limitada, aun_caducada: aunCaducada })
      toast.success('Apuntada en Mis apuestas')
      alApuntar()
      onClose()
    } catch (err) {
      if (err?.response?.status === 409) {
        setAunCaducada(true)
        setAviso(err.response.data?.detail || 'Esa señal ya no vale.')
      } else {
        toast.error(err?.response?.data?.detail || 'No se pudo apuntar')
      }
    } finally {
      setEnviando(false)
    }
  }

  // Al <body>: dentro de la tarjeta heredaría su transparencia (las caducadas se
  // ven apagadas). Y por encima de la burbuja del asistente (z-95), que en el
  // móvil tapaba «Cancelar».
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <form ref={ref} onSubmit={apuntar} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
            aria-label="Apuntar la apuesta"
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-dark-700 bg-dark-900 p-5 shadow-2xl shadow-black/50 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[17px] font-semibold text-dark-50">La he metido</h3>
            <p className="mt-0.5 text-[12.5px] text-dark-400">
              A{seleccion(o.mercado, o.linea, o.seleccion, o.local, o.visitante)} en <b className="text-dark-200">{o.casa}</b> · {o.local} – {o.visitante}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-dark-500 hover:bg-white/[0.06] hover:text-dark-100"><X size={16} /></button>
        </div>
        {aunCaducada && (
          <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-[12.5px] leading-snug text-red-300">
            <b>Esta señal ya no vale.</b> {aviso} Si la metiste igualmente, se apunta marcada como «fuera de plazo».
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-dark-500">
            Cuota que te dieron
            <input id={`valor-cuota-${o.id}`} value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal"
                   className="input mt-1 w-full text-[16px] normal-case tracking-normal" required />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-dark-500">
            Cuánto metiste (€)
            <input id={`valor-importe-${o.id}`} value={imp} onChange={(e) => setImp(e.target.value)} inputMode="decimal"
                   className="input mt-1 w-full text-[16px] normal-case tracking-normal" required />
          </label>
        </div>
        <p className="mt-1.5 text-[11.5px] text-dark-500">Detectada a {cuota(o.cuota)}; sugeridos {eur(tope ?? 0)}.</p>
        {evReal != null && (
          <p className={`mt-2 text-[13px] font-medium ${evReal >= 0.02 ? 'text-emerald-300' : evReal > 0 ? 'text-amber-300' : 'text-red-300'}`}>
            Con {cuota(cReal)}: {evReal > 0 ? `ventaja ${pct(evReal)}` : `ya no hay ventaja (${pct(evReal)})`}
            {evReal > 0 && evReal < 0.02 ? ' · muy poca' : ''}
          </p>
        )}
        {pasa && (
          <p className="mt-1 text-[12.5px] text-amber-300">
            Pasas lo sugerido: el tope es {eur(tope)} (2 % de la banca por apuesta y 4 % por partido).
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-[13px] text-dark-200">
          <input id={`valor-limitada-${o.id}`} type="checkbox" checked={limitada} onChange={(e) => setLimitada(e.target.checked)} />
          La casa no me dejó meter lo que quería
        </label>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={enviando} className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[14px]">
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {aunCaducada ? 'Apuntar igualmente' : 'Confirmar'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2.5 text-[14px]">Cancelar</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

const METODOS = { proporcional: 'Proporcional', aditivo: 'Aditivo', potencia: 'Potencia', shin: 'Shin' }

/* «Por qué»: los datos con los que se decidió, para poder auditarla. */
function PorQue({ o, abierto }) {
  const [hist, setHist] = useState(null)
  const [cargando, setCargando] = useState(false)
  const det = o.detalle || {}
  const metodos = Object.entries(det.por_metodo || {})
  const prudente = metodos.length ? Math.min(...metodos.map(([, p]) => p)) : null
  const refs = Object.entries(det.referencias || {})
  const otras = Object.entries(det.otras || {}).sort((a, b) => b[1] - a[1])

  async function verHistorial() {
    setCargando(true)
    try {
      setHist((await getValorHistorial(o.id)).data)
    } catch {
      setHist({ lecturas: [], error: true })
    } finally {
      setCargando(false)
    }
  }

  return (
    <details open={abierto} className="mt-3 text-[12.5px] text-dark-400">
      <summary className="cursor-pointer select-none font-medium text-dark-300">Por qué</summary>
      <div className="mt-2 space-y-3">
        {lista(o.motivos).length > 0 && (
          <ul className="list-disc space-y-1 pl-5 leading-snug">
            {lista(o.motivos).map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
        {(refs.length > 0 || otras.length > 0) && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {refs.map(([casa, v]) => (
              <div key={casa} className="contents">
                <dt className="text-dark-500">Referencia</dt>
                <dd className="tabular-nums text-dark-200">{casa} {cuota(v)} (con margen)</dd>
              </div>
            ))}
            <dt className="text-dark-500">{o.casa}</dt>
            <dd className="tabular-nums font-semibold text-dark-100">{cuota(o.cuota)}</dd>
            {otras.length > 0 && (
              <>
                <dt className="text-dark-500">Otras casas</dt>
                <dd className="tabular-nums text-dark-200">{otras.map(([c, v]) => `${c} ${cuota(v)}`).join(' · ')}</dd>
              </>
            )}
          </dl>
        )}
        {metodos.length > 0 && (
          <div>
            <div className="text-dark-500">Probabilidad justa (sin el margen de la casa), por método:</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {metodos.map(([m, p]) => (
                <span key={m} className={`rounded-md px-2 py-0.5 tabular-nums ${p === prudente ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.04] text-dark-300'}`}>
                  {METODOS[m] || m} {pctSin(p)}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[11.5px] text-dark-500">Se usa la más baja (la más prudente): cuota justa {cuota(1 / o.prob_justa)}.</div>
          </div>
        )}
        <div className="text-[11.5px] leading-relaxed text-dark-500">
          Cuota de {o.casa} leída a las {hora(o.ts_cuota, true)} · referencia a las {hora(o.ts_referencia, true)}
          {o.fuente ? ` · fuente: ${o.fuente}` : ''} · detectada a las {hora(o.detectada, true)}
          {o.estado === 'valida' && o.valida_hasta ? ` · vale hasta las ${hora(o.valida_hasta)}` : ''}
        </div>
        <div>
          {!hist && (
            <button type="button" onClick={verHistorial} disabled={cargando}
                    className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-300 hover:underline">
              {cargando ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />} Historial de la señal
            </button>
          )}
          {hist && (
            lista(hist.lecturas).length === 0
              ? <div className="text-dark-500">{hist.error ? 'No se pudo cargar.' : 'No hay más lecturas guardadas de esta selección.'}</div>
              : (
                <div>
                  <div className="text-dark-500">Lo leído de esta selección (sin inventar nada entre lectura y lectura):</div>
                  <ol className="mt-1 max-h-48 space-y-0.5 overflow-y-auto tabular-nums">
                    {lista(hist.lecturas).slice(-40).map((l, i) => (
                      <li key={i} className={l.referencia ? 'text-dark-400' : 'text-dark-100'}>
                        {new Date(l.ts).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {' — '}{l.casa} {cuota(l.cuota)}
                      </li>
                    ))}
                  </ol>
                </div>
              )
          )}
        </div>
      </div>
    </details>
  )
}

function TarjetaValor({ o, destacada, frenado, ahora, alApuntar }) {
  const [modal, setModal] = useState(null)
  const vivo = !!o.en_vivo
  const { estado, motivo } = estadoDe(o, ahora)
  const valida = estado === 'valida'
  const importe = o.importe_max ?? o.importe
  const quedan = o.valida_hasta ? minutos(Date.parse(o.valida_hasta) - ahora) : null
  const acierto = Math.round(o.prob_justa * 100)
  const sel = seleccion(o.mercado, o.linea, o.seleccion, o.local, o.visitante)
  const avisos = lista(o.avisos).filter((a) => !String(a).startsWith('FRENO'))
  return (
    <article className={`card p-4 ${valida ? '' : 'opacity-75'}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {destacada && <Chip tono="mejor" title="La de más ventaja entre las que valen ahora">DESTACADA</Chip>}
        {valida
          ? <Chip tono="valida">VÁLIDA{quedan != null ? ` · ${quedan < 1 ? 'menos de 1 min' : `${quedan} min más`}` : ''}</Chip>
          : <Chip tono="caducada">{estado === 'cambiada' ? 'CUOTA CAMBIADA' : 'CADUCADA'}</Chip>}
        {vivo && <Chip tono="vivo">EN VIVO</Chip>}
        {o.fallo && o.fallo !== 'valor' && <Chip tono="fallo">{String(o.fallo).toUpperCase()}</Chip>}
      </div>
      <div className="mt-2 text-[12.5px] text-dark-400">
        {o.local} – {o.visitante} · {o.liga} · {vivo ? 'en juego' : cuando(o.inicio)}
      </div>
      <p className="mt-1 font-display text-[18px] font-semibold leading-snug text-dark-50">
        {valida && importe > 0 && !frenado
          ? <>Métele <span className="tabular-nums">{eur(importe)}</span> a{sel} en <b>{o.casa}</b></>
          : <>A{sel} en <b>{o.casa}</b></>}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Dato etiqueta="Cuota">{cuota(o.cuota)}</Dato>
        <Dato etiqueta="Justa" tono="text-dark-200">{cuota(1 / o.prob_justa)}</Dato>
        <Dato etiqueta="Ventaja" tono="text-emerald-300">{pct(o.ev)}</Dato>
      </dl>
      <p className="mt-2 text-[12.5px] text-dark-300">
        Sale {Math.round(o.prob_justa * 10)} de cada 10 ({acierto} %) · <b className={valida ? 'text-dark-100' : 'text-red-300'}>
          datos {hace(o.ts_cuota || o.detectada, ahora)}</b>
      </p>
      {valida ? (
        frenado
          ? <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-300">Recomendaciones pausadas por el freno: hoy no se apuesta.</div>
          : importe > 0
            ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12.5px] text-dark-400">
                  {o.ya_apostado > 0 && <>Ya llevas {eur(o.ya_apostado)} en este partido; caben {eur(importe)} más. </>}
                  A la larga: {eur(importe * o.ev)} por apuesta como esta.
                </div>
                <button type="button" onClick={() => setModal({ aunCaducada: false })}
                        className="btn-primary px-5 py-2.5 text-[14px]">La he metido</button>
              </div>
            )
            : <div className="mt-3 text-[12.5px] text-dark-400">No cabe más en este partido: ya tienes el 4 % de la banca en juego ({eur(o.ya_apostado)}).</div>
      ) : (
        <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-[13px] leading-snug text-red-300">
          <b>No apostar.</b> {motivo}
          <button type="button" onClick={() => setModal({ aunCaducada: true, motivo })}
                  className="ml-1.5 text-[12px] text-dark-400 underline hover:text-dark-200">¿La metiste igualmente? Apúntala</button>
        </div>
      )}
      {avisos.map((a, i) => <Aviso key={i}>{a}</Aviso>)}
      <PorQue o={o} abierto={destacada && valida} />
      {modal && <ModalApuesta o={o} aunCaducada={modal.aunCaducada} motivo={modal.motivo}
                              onClose={() => setModal(null)} alApuntar={alApuntar} />}
    </article>
  )
}

function TarjetaSegura({ g }) {
  return (
    <article className="card p-4">
      <Chip tono="segura">SEGURA{g.en_vivo ? ' · EN VIVO' : ''}</Chip>
      <div className="mt-2 text-[12.5px] text-dark-400">
        {g.local} – {g.visitante} · {g.liga} · {g.en_vivo ? 'en juego' : cuando(g.inicio)}
      </div>
      {lista(g.patas).map((p, i) => (
        <p key={i} className="mt-1 text-[15px] font-semibold text-dark-50">
          Mete <span className="tabular-nums">{eur(p.importe)}</span> a{seleccion(g.mercado, g.linea, p.seleccion, g.local, g.visitante)} en <b>{p.casa}</b> a {cuota(p.cuota)}
        </p>
      ))}
      <p className="mt-1.5 text-[13.5px] text-dark-200">
        Ganas <b className="text-emerald-300">{eur(g.beneficio)}</b> pase lo que pase ({pct(g.rendimiento)}).
      </p>
      {lista(g.avisos).map((a, i) => <Aviso key={i}>{a}</Aviso>)}
    </article>
  )
}

const VACIO = {
  seguras: 'Ahora mismo no hay ninguna segura. Salen pocas y duran poco.',
  valor: 'Ahora mismo no hay ninguna apuesta que merezca la pena. Mejor no apostar que meter por meter.',
  vivo: 'Nada en vivo ahora mismo.',
}

function ApuntarAMano({ alApuntar }) {
  const toast = useToast()
  const vacio = { descripcion: '', casa: '', cuota: '', importe: '' }
  const [f, setF] = useState(vacio)
  const [enviando, setEnviando] = useState(false)
  const cambia = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    try {
      await apuntarApuestaValorAMano(f)
      setF(vacio)
      toast.success('Apuntada')
      alApuntar()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo apuntar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form id="valor-manual" onSubmit={enviar} className="card p-4">
      <div className="text-[13px] font-semibold text-dark-100">Apuntar una apuesta</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem_6rem_6rem_auto]">
        <input id="valor-descripcion" value={f.descripcion} onChange={cambia('descripcion')} className="input"
               placeholder="Qué: «Sevilla gana al Getafe»" maxLength={200} required />
        <input id="valor-casa" value={f.casa} onChange={cambia('casa')} className="input" placeholder="Casa" maxLength={40} required />
        <input id="valor-cuota" value={f.cuota} onChange={cambia('cuota')} className="input" placeholder="Cuota" inputMode="decimal" required />
        <input id="valor-importe" value={f.importe} onChange={cambia('importe')} className="input" placeholder="€" inputMode="decimal" required />
        <button type="submit" disabled={enviando} className="btn-primary flex items-center justify-center gap-1.5 text-[12.5px]">
          {enviando && <Loader2 size={14} className="animate-spin" />} Apuntar
        </button>
      </div>
    </form>
  )
}

/* Lo que hay en juego ahora: el total y cada partido contra su tope del 4 %. */
function Exposicion({ expo, banca }) {
  const partidos = lista(expo?.partidos)
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-dark-100">En juego ahora</h2>
        <span className="text-[13px] text-dark-300">
          <b className="tabular-nums text-dark-50">{eur(expo?.total)}</b>
          {expo?.pct != null && <> · {pctSin(expo.pct)} de la banca</>}
        </span>
      </div>
      {partidos.length === 0
        ? <p className="mt-1 text-[12.5px] text-dark-500">Nada pendiente.</p>
        : (
          <ul className="mt-2 space-y-2">
            {partidos.map((p, i) => {
              const tope = (expo.tope_evento || 0.04) * banca
              const lleno = p.evento_id ? Math.min(1, p.importe / tope) : null
              return (
                <li key={i} className="text-[12.5px]">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-dark-200">{p.partido}</span>
                    <span className="tabular-nums text-dark-300">
                      {eur(p.importe)} · {pctSin(p.pct || 0)}{p.queda != null && <> · caben {eur(p.queda)} más</>}
                    </span>
                  </div>
                  {lleno != null && (
                    <div className="mt-1 h-1.5 rounded-full bg-white/[0.06]">
                      <div className={`h-1.5 rounded-full ${lleno >= 1 ? 'bg-red-400' : 'bg-brand-400'}`} style={{ width: `${lleno * 100}%` }} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
    </section>
  )
}

function MisApuestas({ apuestas, expo, banca, alCambiar }) {
  const toast = useToast()
  const [ocupada, setOcupada] = useState(null)

  async function liquidar(id, resultado) {
    setOcupada(id)
    try {
      await liquidarApuestaValor(id, resultado)
      alCambiar()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="space-y-3">
      <Exposicion expo={expo} banca={banca} />
      <ApuntarAMano alApuntar={alCambiar} />
      <p className="text-[12.5px] leading-relaxed text-dark-400">
        El beneficio de pocas apuestas es casi todo suerte. El número que dice si el método funciona es
        el <b className="text-dark-200">CLV</b>: si tu cuota fue mejor que la justa al empezar el partido.
      </p>
      {apuestas.length === 0
        ? <div className="card p-8 text-center text-[13px] text-dark-400">Aún no has apuntado ninguna apuesta.</div>
        : (
          <ul className="card divide-y divide-dark-800/70">
            {apuestas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 text-[12.5px]">
                <div className="min-w-0 flex-1">
                  {a.descripcion
                    ? <><div className="text-dark-100">{a.descripcion}</div><div className="text-[11.5px] text-dark-500">{a.casa} · apuntada a mano</div></>
                    : <><div className="text-dark-100">{a.local} – {a.visitante}</div>
                        <div className="text-[11.5px] text-dark-500">A{seleccion(a.mercado, a.linea, a.seleccion, a.local, a.visitante)} · {a.casa}</div></>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.cuota_senal != null && Math.abs(a.cuota_senal - a.cuota) > 1e-9 && (
                      <Chip tono="gris" title="Lo que detectó el sistema y lo que te dieron">avisó a {cuota(a.cuota_senal)}</Chip>
                    )}
                    {a.fuera_de_plazo ? <Chip tono="caducada">FUERA DE PLAZO</Chip> : null}
                    {a.limitada ? <Chip tono="fallo" title="Marcaste que la casa no te dejó meter lo que querías">LIMITADA</Chip> : null}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-dark-100">{eur(a.importe)} a {cuota(a.cuota)}</div>
                  <div className="text-[11.5px] text-dark-500">CLV {a.clv == null ? '—' : pct(a.clv)}</div>
                </div>
                <div className="w-full sm:w-auto">
                  {a.resultado === 'pendiente'
                    ? (
                      <div className="flex flex-wrap gap-1">
                        {[['ganada', 'Ganada'], ['perdida', 'Perdida'], ['nula', 'Nula']].map(([k, t]) => (
                          <button key={k} type="button" disabled={ocupada === a.id} onClick={() => liquidar(a.id, k)}
                                  className="btn-secondary px-2.5 py-1.5 text-[12px]">{t}</button>
                        ))}
                      </div>
                    )
                    : <span className={a.resultado === 'ganada' ? 'text-emerald-300' : a.resultado === 'perdida' ? 'text-red-300' : 'text-dark-400'}>
                        {a.resultado}
                      </span>}
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

/* Una gráfica pequeña, a mano: una sola escala para marcas y rótulos. */
function Grafica({ puntos, barras = false, etiqueta }) {
  if (puntos.length < 2) {
    return <div className="rounded-lg bg-white/[0.03] p-4 text-center text-[12px] text-dark-500">{etiqueta}: aún hay pocos datos.</div>
  }
  const W = 320
  const H = 110
  const P = 22
  const ys = puntos.map((p) => p.y)
  const min = Math.min(0, ...ys)
  const max = Math.max(0, ...ys)
  const alto = max - min || 1
  const y = (v) => P / 2 + (H - P) * (1 - (v - min) / alto)
  const x = (i) => P + ((W - P * 1.5) * i) / Math.max(1, puntos.length - 1)
  const ancho = Math.max(2, (W - P * 1.5) / puntos.length - 2)
  return (
    <figure className="rounded-lg bg-white/[0.03] p-2">
      <figcaption className="px-1 text-[11px] font-semibold uppercase tracking-wider text-dark-500">{etiqueta}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label={etiqueta}>
        <line x1={P} x2={W - P / 2} y1={y(0)} y2={y(0)} className="stroke-dark-600" strokeDasharray="3 3" />
        <text x={2} y={y(0) + 3} className="fill-dark-500" fontSize="9">0</text>
        <text x={2} y={y(max) + 3} className="fill-dark-500" fontSize="9">{pctSin(max)}</text>
        {min < 0 && <text x={2} y={y(min) + 3} className="fill-dark-500" fontSize="9">{pctSin(min)}</text>}
        {barras
          ? puntos.map((p, i) => (
            <rect key={i} x={x(i) - ancho / 2} width={ancho} y={Math.min(y(p.y), y(0))} height={Math.max(1, Math.abs(y(p.y) - y(0)))}
                  className={p.y >= 0 ? 'fill-emerald-400' : 'fill-red-400'}><title>{`${p.t}: ${pct(p.y)}`}</title></rect>
          ))
          : <polyline fill="none" strokeWidth="2" className="stroke-brand-400"
                      points={puntos.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} />}
      </svg>
    </figure>
  )
}

const ESTADO_SEG = {
  aprendiendo: ['gris', 'MUESTRA INSUFICIENTE', 'Menos de {n} avisos cerrados: aún no se decide nada.'],
  'de confianza': ['valida', 'BATE EL CIERRE', 'Bate la cuota de cierre con claridad.'],
  apagado: ['caducada', 'NO BATE EL CIERRE', 'No bate el cierre: sus avisos ya no salen.'],
  neutro: ['gris', 'SIN DECIDIR', 'Con muestra, pero sin diferencia clara con el cierre.'],
}

function Aprendizaje({ datos }) {
  const segs = lista(datos?.segmentos)
  const r = datos?.resumen || {}
  const minimo = datos?.minimo ?? 30
  const limites = lista(datos?.limitaciones).filter((l) => l.apuestas > 0)
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-dark-400">
        Cada aviso, lo apuestes o no, se compara con la cuota justa al empezar el partido (CLV). Con {minimo} avisos
        o más de un mismo tipo, lo que no bate el cierre se <b className="text-dark-200">apaga solo</b> y lo que sí se
        marca. No aprende de ganar o perder partidos sueltos: eso es suerte.
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Dato etiqueta="CLV medio" tono={r.clv_medio > 0 ? 'text-emerald-300' : 'text-dark-50'}>{r.clv_medio == null ? '—' : pct(r.clv_medio)}</Dato>
        <Dato etiqueta="CLV mediano">{r.clv_mediana == null ? '—' : pct(r.clv_mediana)}</Dato>
        <Dato etiqueta="Bate el cierre">{r.pct_bate == null ? '—' : pctSin(r.pct_bate)}</Dato>
        <Dato etiqueta="Avisos cerrados">{r.avisos ?? 0}</Dato>
      </dl>
      <div className="grid gap-2 sm:grid-cols-2">
        <Grafica etiqueta="CLV acumulado" puntos={lista(r.acumulado).map((p) => ({ y: p.clv, t: p.fecha }))} />
        <Grafica etiqueta="CLV medio por semana" barras puntos={lista(r.semanas).map((s) => ({ y: s.clv_medio, t: `${s.semana} (${s.n})` }))} />
      </div>
      {segs.length === 0
        ? <div className="card p-8 text-center text-[13px] text-dark-400">Aún no hay partidos cerrados con los que aprender.</div>
        : (
          <ul className="card divide-y divide-dark-800/70">
            {segs.map((g, i) => {
              const [tono, txt, expl] = ESTADO_SEG[g.estado] || ESTADO_SEG.neutro
              return (
                <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-[12.5px]">
                  <div className="min-w-0">
                    <div className="text-dark-100">{g.casa} · <span className="text-dark-400">{g.mercado} · cuota {g.rango}</span></div>
                    <div className="text-[11.5px] text-dark-500">{g.momento} · {g.fallo}</div>
                    <div className="mt-1 tabular-nums text-dark-300">
                      {g.n} avisos · {g.apuestas ?? 0} apostados · CLV {g.clv_medio == null ? '—' : pct(g.clv_medio)}
                      {g.clv_mediana != null && <> (mediana {pct(g.clv_mediana)})</>}
                      {g.pct_bate != null && <> · bate el cierre {pctSin(g.pct_bate)}</>}
                    </div>
                  </div>
                  <span title={expl.replace('{n}', minimo)}><Chip tono={tono}>{txt}</Chip></span>
                </li>
              )
            })}
          </ul>
        )}
      {limites.length > 0 && (
        <section className="card p-4">
          <h2 className="text-[13px] font-semibold text-dark-100">Casas que no te dejaron meter lo que querías</h2>
          <p className="mt-0.5 text-[11.5px] text-dark-500">Es lo que tú marcaste al apuntar; no quiere decir que la casa te haya limitado.</p>
          <ul className="mt-2 space-y-1 text-[12.5px] text-dark-300">
            {limites.map((l) => (
              <li key={l.casa}>
                <b className="text-dark-100">{l.casa}</b>: {l.apuestas} apuestas · {l.limitadas} con menos de lo que querías
                {l.ultima_limitada && <> (última el {new Date(l.ultima_limitada).toLocaleDateString('es-ES')})</>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/* Salud de datos: de dónde sale cada cuota, cuándo se leyó, cuándo se vuelve
   a leer y cuánto cupo queda. Lo que la API no dice, se dice que no lo dice. */
function SaludFuentes({ est }) {
  const det = Object.fromEntries(lista(est.fuentes_detalle).map((f) => [f.nombre, f]))
  const uso = est.uso || {}
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {FUENTES.map(([k, nombre, unidad, una]) => {
        const d = det[k] || {}
        const u = uso[k] || {}
        const [color, texto] = estadoFuente(est, k, d)
        const gastado = d.gastado ?? u.gastado ?? 0
        const periodo = d.periodo_dias >= 2 ? `${Math.round(d.periodo_dias)} días` : 'el día'
        return (
          <section key={k} className="card p-4 text-[12.5px]">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
              <h2 className="font-semibold text-dark-50">{nombre}</h2>
            </div>
            <p className="mt-1 text-dark-400">{texto}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-dark-300">
              <dt className="text-dark-500">Leído</dt><dd>{d.leido || '—'}{d.cuotas != null && ` · ${d.cuotas} cuotas, ${d.partidos} partidos`}</dd>
              <dt className="text-dark-500">Próxima</dt>
              <dd>{d.sin_partido ? 'cuando haya partido en 24 h' : d.proxima ? hora(d.proxima) : '—'}</dd>
              <dt className="text-dark-500">Partido</dt><dd>{d.proximo_partido ? cuando(d.proximo_partido) : '—'}</dd>
              <dt className="text-dark-500">Ritmo</dt><dd>{d.cada_min ? `cada ${cadaCuanto(d.cada_min)}` : '—'}</dd>
              <dt className="text-dark-500">Gastado</dt>
              <dd className="tabular-nums">{d.cupo ? `${gastado} de ${d.cupo} ${unidad} en ${periodo}` : `${gastado} ${unidad} en 30 días`}</dd>
              <dt className="text-dark-500">Queda</dt>
              <dd className="tabular-nums">{d.cupo_restante != null ? `${d.cupo_restante} (lo dice la API)` : 'la API no lo dice'}</dd>
              <dt className="text-dark-500">Señales</dt>
              <dd className="tabular-nums">{u.senales ?? 0} en 30 días{gastado > 0 && u.senales != null ? ` · ${(u.senales / gastado).toLocaleString('es-ES', { maximumFractionDigits: 2 })} por ${una}` : ''}</dd>
            </dl>
            {d.cupo > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                <div className={`h-1.5 rounded-full ${gastado / d.cupo > 0.85 ? 'bg-red-400' : 'bg-brand-400'}`}
                     style={{ width: `${Math.min(100, (gastado / d.cupo) * 100)}%` }} />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* Tus casas: solo se recomienda donde apuestas. Las demás se leen igual, para comparar. */
function TusCasas() {
  const toast = useToast()
  const [datos, setDatos] = useState(null)
  const [marcadas, setMarcadas] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getValorCasas().then((r) => {
      setDatos(r.data)
      setMarcadas(r.data.apostables == null ? '*' : new Set(r.data.apostables))
    }).catch(() => setDatos({ error: true }))
  }, [])

  if (!datos) return <div className="card flex justify-center p-6 text-dark-400"><Loader2 className="animate-spin" /></div>
  if (datos.error) return <div className="card p-4 text-[12.5px] text-dark-400">No se pudieron cargar tus casas.</div>
  const vistas = Object.fromEntries(lista(datos.vistas).map((v) => [v.casa, v]))
  const todas = [...new Set([...lista(datos.sugeridas), ...Object.keys(vistas), ...lista(datos.apostables)])]
    .filter((c) => c !== 'pinnacle').sort()
  const todasMarcadas = marcadas === '*'
  const cambiar = (c) => setMarcadas((m) => {
    const s = new Set(m === '*' ? todas : m)
    if (s.has(c)) s.delete(c)
    else s.add(c)
    return s
  })

  async function guardar() {
    setGuardando(true)
    try {
      const r = await guardarValorCasas(todasMarcadas ? '*' : [...marcadas])
      setMarcadas(r.data.apostables == null ? '*' : new Set(r.data.apostables))
      toast.success('Guardado: se aplica desde la próxima lectura')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold text-dark-100">Tus casas</h2>
      <p className="mt-0.5 text-[12px] leading-snug text-dark-400">
        Solo se te recomiendan apuestas en las marcadas. Las demás se siguen leyendo para comparar. Pinnacle es la
        referencia: no se apuesta ahí.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {todas.map((c) => {
          const on = todasMarcadas || marcadas.has(c)
          const v = vistas[c]
          return (
            <button key={c} type="button" onClick={() => cambiar(c)} aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${on
                      ? 'border-brand-400/60 bg-brand-500/15 text-dark-50' : 'border-dark-700 text-dark-400 hover:text-dark-200'}`}>
              {on && <Check size={12} className="-mt-0.5 mr-1 inline" />}{c}
              {v && <span className="ml-1 text-[11px] text-dark-500">· {v.cuotas}</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando || (!todasMarcadas && marcadas.size === 0)}
                className="btn-primary flex items-center gap-1.5 px-4 py-2 text-[13px]">
          {guardando && <Loader2 size={14} className="animate-spin" />} Guardar
        </button>
        <button type="button" onClick={() => setMarcadas('*')} className="text-[12.5px] text-dark-400 underline hover:text-dark-200">
          Todas las casas
        </button>
        <span className="text-[11.5px] text-dark-500">El número es cuántas cuotas se han leído de esa casa esta semana.</span>
      </div>
    </section>
  )
}

function Datos({ est }) {
  return (
    <div className="space-y-3">
      <SaludFuentes est={est} />
      <TusCasas />
      <p className="text-[11.5px] leading-relaxed text-dark-500">
        Las fuentes gratis dan pocas lecturas al mes: el buscador las gasta donde hay partido (más a menudo con
        partido a menos de 3 h, menos si falta un día, casi nada si no hay) y nunca más de 3 veces la parte de un
        día en un solo día.
      </p>
    </div>
  )
}

function Freno({ est }) {
  const perdido = -est.resultado_hoy
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
      <PauseCircle className="mt-0.5 shrink-0 text-red-300" size={22} />
      <div className="text-[13px] leading-snug text-red-200">
        <div className="font-display text-[16px] font-bold tracking-wide text-red-300">RECOMENDACIONES PAUSADAS</div>
        <div className="mt-1 tabular-nums">
          Pérdida de hoy: <b>−{eur(perdido)}</b> ({est.banca ? pctSin(perdido / est.banca) : '—'} de la banca).
          Límite: −{eur(est.freno_dia)}.
        </div>
        <div className="mt-1 text-red-300/90">
          No se recomienda nada hasta mañana. Las cuotas se siguen leyendo, pero no se dan como apuesta:
          si no ves avisos, no es que el buscador haya fallado.
        </div>
      </div>
    </div>
  )
}

export default function Valor() {
  const [pestana, setPestana] = useState('valor')
  const [datos, setDatos] = useState(null)
  const [aprende, setAprende] = useState(null)
  const [error, setError] = useState('')
  const ahora = useAhora()
  const pestanaRef = useRef(pestana)
  useEffect(() => { pestanaRef.current = pestana }, [pestana])

  const carga = useCallback(async () => {
    try {
      const [est, v, vv, s, a] = await Promise.all([
        getValorEstado(), getValorOportunidades(false), getValorOportunidades(true),
        getValorSeguras(), getValorApuestas()])
      setDatos({
        estado: est.data || {}, valor: lista(v.data?.items), vivo: lista(vv.data?.items),
        seguras: lista(s.data?.items), apuestas: lista(a.data?.items), balance: a.data?.balance || {},
      })
      if (pestanaRef.current === 'aprende') setAprende((await getValorAprendizaje()).data)
      setError('')
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo cargar')
    }
  }, [])

  useEffect(() => { carga() }, [carga])
  useEffect(() => {
    if (pestana === 'aprende') getValorAprendizaje().then((r) => setAprende(r.data)).catch(() => {})
  }, [pestana])
  /* Cada 20 s con la pestaña a la vista. Mientras escribes (un formulario o la
     ventana de «La he metido» con el foco dentro) no se repinta nada. */
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return
      const foco = document.activeElement
      if (foco && foco.closest && (foco.closest('form') || foco.closest('[role="dialog"]'))) return
      carga()
    }, 20000)
    return () => clearInterval(t)
  }, [carga])

  if (!datos && !error) {
    return <div className="flex justify-center p-16 text-dark-400"><Loader2 className="animate-spin" /></div>
  }
  if (!datos) return <div className="card p-10 text-center text-[13px] text-dark-400">No se pudo cargar: {error}</div>

  const b = datos.balance
  const est = datos.estado
  const expo = est.exposicion || {}
  const validas = (xs) => xs.filter((o) => estadoDe(o, ahora).estado === 'valida').length
  const cuenta = { seguras: datos.seguras.length, valor: validas(datos.valor), vivo: validas(datos.vivo) }
  const pestanas = PESTANAS.filter(([k]) => k !== 'seguras' || cuenta.seguras > 0)
  const primeraValida = (xs) => xs.findIndex((o) => estadoDe(o, ahora).estado === 'valida')

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-3">
        <h1 className="font-display text-[19px] font-semibold tracking-tight text-dark-50">Valor</h1>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Dato etiqueta="Banca">{eur(est.banca)}</Dato>
          <Dato etiqueta="Hoy" tono={est.resultado_hoy >= 0 ? 'text-emerald-300' : 'text-red-300'}>
            {est.resultado_hoy > 0 ? '+' : ''}{eur(est.resultado_hoy)}
          </Dato>
          <Dato etiqueta="En juego">
            {eur(expo.total)}{expo.pct != null && <span className="ml-1 text-[12px] font-normal text-dark-400">{pctSin(expo.pct)}</span>}
          </Dato>
          <Dato etiqueta="CLV de tus apuestas">{b.clv_medio == null ? '—' : pct(b.clv_medio)}</Dato>
        </dl>
        {est.freno_usado != null && !est.frenado && est.freno_usado > 0 && (
          <div className="text-[12px] text-dark-400">
            Freno del día: llevas perdido el {pctSin(est.freno_usado)} de lo que se permite perder hoy.
            <div className="mt-1 h-1.5 rounded-full bg-white/[0.06]">
              <div className={`h-1.5 rounded-full ${est.freno_usado > 0.75 ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, est.freno_usado * 100)}%` }} />
            </div>
          </div>
        )}
        {est.frenado && <Freno est={est} />}
        <div className="flex items-center gap-1.5 text-[12px] text-dark-500">
          <Radio size={13} className={est.escaneando ? 'text-emerald-400' : 'text-dark-600'} />
          {est.escaneando
            ? <>Buscador en marcha{est.ultima_vuelta ? ` · última lectura ${hace(est.ultima_vuelta, ahora)}` : ' · aún sin leer'}</>
            : 'El buscador está apagado: solo se ve lo que ya había y lo que apuntes a mano.'}
          {est.ultimo_error ? <span className="text-amber-300"> · la última vuelta falló ({est.ultimo_error})</span> : null}
        </div>
        <Fuentes est={est} />
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-dark-800" aria-label="Secciones de Valor">
        {pestanas.map(([k, t]) => (
          <button key={k} type="button" onClick={() => setPestana(k)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors ${
                    pestana === k ? 'border-brand-400 font-semibold text-dark-50' : 'border-transparent text-dark-400 hover:text-dark-200'}`}>
            {t}
            {k in cuenta && <span className="ml-1.5 rounded-full bg-dark-800 px-1.5 text-[11px] tabular-nums text-dark-300">{cuenta[k]}</span>}
          </button>
        ))}
      </nav>

      {pestana === 'apuestas' && <MisApuestas apuestas={datos.apuestas} expo={expo} banca={est.banca} alCambiar={carga} />}
      {pestana === 'aprende' && (aprende
        ? <Aprendizaje datos={aprende} />
        : <div className="flex justify-center p-10 text-dark-400"><Loader2 className="animate-spin" /></div>)}
      {pestana === 'datos' && <Datos est={est} />}
      {(pestana === 'valor' || pestana === 'vivo' || pestana === 'seguras') && (
        datos[pestana].length === 0
          ? <div className="card p-10 text-center text-[13px] text-dark-400">{VACIO[pestana]}</div>
          : (
            <div className="space-y-3">
              {pestana !== 'seguras' && cuenta[pestana] === 0 && (
                <div className="card p-4 text-center text-[13px] text-dark-400">
                  Ninguna vale ahora mismo. Debajo, las de la última hora que ya no valen, para que veas qué pasó.
                </div>
              )}
              {datos[pestana].map((x, i) => (pestana === 'seguras'
                ? <TarjetaSegura key={x.id} g={x} />
                : <TarjetaValor key={x.id} o={x} destacada={i === primeraValida(datos[pestana])}
                                frenado={!!est.frenado} ahora={ahora} alApuntar={carga} />))}
            </div>
          )
      )}
      <p className="pb-4 text-[11.5px] leading-snug text-dark-500">
        Cada apuesta sigue pudiendo perderse (4 de cada 10 a cuota 1,65): lo que gana es la suma, a la larga.
      </p>
    </div>
  )
}
