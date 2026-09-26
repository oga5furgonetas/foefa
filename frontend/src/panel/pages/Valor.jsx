import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Check, X, Radio } from 'lucide-react'
import {
  getValorEstado, getValorOportunidades, getValorSeguras, getValorApuestas,
  apuntarApuestaValor, apuntarApuestaValorAMano, liquidarApuestaValor, getValorAprendizaje,
} from '../api'
import { useToast } from '../../lib/toast'

/* VALOR — dónde una casa paga más de lo que vale un resultado, y cuánto meter.

   SOLO la ve Dani: el menú la enseña únicamente al super-admin, la ruta echa
   a cualquier otro y el servidor contesta 403 a todo el que no sea él
   (`require_valor`). Aquí no hay datos de la flota, ni los de aquí van a Mongo.

   Es la misma pantalla que valor/pantalla.html, con el estilo del panel. La
   orden va arriba y en cristiano —«Métele 40 € a que gana el Betis en Bet365»—
   y el porqué, plegado debajo: lo primero que hace falta saber es qué hacer. */

const eur = (x) => `${(Number(x) || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`
const pct = (x) => `${x > 0 ? '+' : ''}${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
const cuota = (x) => Number(x).toFixed(2).replace('.', ',')
const cuando = (iso) => new Date(iso).toLocaleString('es-ES', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})
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
const lista = (x) => (Array.isArray(x) ? x : [])
const hace = (iso) => {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`
}

const PESTANAS = [
  ['seguras', 'Seguras'], ['valor', 'Valor'], ['vivo', 'En vivo'],
  ['apuestas', 'Mis apuestas'], ['aprende', 'Aprendizaje'],
]

function Chip({ children, tono }) {
  const color = {
    valor: 'bg-sky-500/15 text-sky-300', vivo: 'bg-rose-500/15 text-rose-300',
    segura: 'bg-emerald-500/15 text-emerald-300', mejor: 'bg-brand-500/20 text-brand-200',
    fallo: 'bg-amber-500/15 text-amber-300',
  }[tono]
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider ${color}`}>{children}</span>
}

function Aviso({ children }) {
  return <div className="mt-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[12.5px] leading-snug text-amber-300">{children}</div>
}

/* «La he metido»: la cuota y el importe reales pueden no ser los sugeridos
   (la casa te la acepta a otra, o metes menos). Se pregunta aquí mismo, con
   lo sugerido ya escrito: casi siempre es darle a Apuntar. */
function LaHeMetido({ o, alApuntar }) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [c, setC] = useState(cuota(o.cuota))
  const [imp, setImp] = useState(String(o.importe || ''))
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState(false)

  async function apuntar(e) {
    e.preventDefault()
    setEnviando(true)
    try {
      await apuntarApuestaValor({ oportunidad_id: o.id, cuota: c, importe: imp })
      setHecho(true)
      setAbierto(false)
      toast.success('Apuntada en Mis apuestas')
      alApuntar()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo apuntar')
    } finally {
      setEnviando(false)
    }
  }

  if (hecho) return <div className="mt-3 flex items-center gap-1.5 text-[12.5px] text-emerald-300"><Check size={14} /> Apuntada</div>
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-primary mt-3 px-3.5 py-1.5 text-[12.5px]">
        La he metido
      </button>
    )
  }
  return (
    <form onSubmit={apuntar} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-[11px] uppercase tracking-wider text-dark-500">
        Cuota que te han dado
        <input id={`cuota-${o.id}`} value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal"
               className="input mt-1 w-28 normal-case tracking-normal" required />
      </label>
      <label className="text-[11px] uppercase tracking-wider text-dark-500">
        Cuánto has metido (€)
        <input id={`importe-${o.id}`} value={imp} onChange={(e) => setImp(e.target.value)} inputMode="decimal"
               className="input mt-1 w-28 normal-case tracking-normal" required />
      </label>
      <button type="submit" disabled={enviando} className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[12.5px]">
        {enviando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apuntar
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="btn-ghost px-2.5 py-2 text-[12.5px]" aria-label="Cancelar">
        <X size={14} />
      </button>
    </form>
  )
}

function TarjetaValor({ o, primera, alApuntar }) {
  const vivo = !!o.en_vivo
  const deDiez = Math.round(o.prob_justa * 10)
  const acierto = Math.round(o.prob_justa * 100)
  const motivos = lista(o.motivos)
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tono={primera ? 'mejor' : vivo ? 'vivo' : 'valor'}>
          {primera ? 'LA MEJOR AHORA' : vivo ? 'EN VIVO' : 'VALOR'}{primera && vivo ? ' · EN VIVO' : ''}
        </Chip>
        {o.fallo && o.fallo !== 'valor' && <Chip tono="fallo">{String(o.fallo).toUpperCase()}</Chip>}
      </div>
      <div className="mt-2 text-[12.5px] text-dark-400">
        {o.local} – {o.visitante} · {o.liga} · {vivo ? 'en juego' : cuando(o.inicio)}
      </div>
      <p className="mt-1 font-display text-[18px] font-semibold leading-snug text-dark-50">
        {o.importe > 0
          ? <>Métele <span className="tabular-nums">{eur(o.importe)}</span> a{seleccion(o.mercado, o.linea, o.seleccion, o.local, o.visitante)} en <b>{o.casa}</b></>
          : <>Hoy no metas nada a{seleccion(o.mercado, o.linea, o.seleccion, o.local, o.visitante)} en <b>{o.casa}</b></>}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-dark-200">
        Está a <b className="tabular-nums text-dark-50">{cuota(o.cuota)}</b> y debería estar
        a <b className="tabular-nums text-dark-50">{cuota(1 / o.prob_justa)}</b>.
        Sale {deDiez} de cada 10 veces ({acierto} %). Ventaja <b className="text-emerald-300">{pct(o.ev)}</b>:
        a la larga, {eur(o.importe * o.ev)} por cada apuesta como esta.
      </p>
      {motivos.length > 0 && (
        <details open={primera} className="mt-2 text-[12.5px] text-dark-400">
          <summary className="cursor-pointer select-none text-dark-300">Por qué</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-snug">
            {motivos.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </details>
      )}
      {lista(o.avisos).map((a, i) => <Aviso key={i}>{a}</Aviso>)}
      <LaHeMetido o={o} alApuntar={alApuntar} />
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

function MisApuestas({ apuestas, alCambiar }) {
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
      <ApuntarAMano alApuntar={alCambiar} />
      <p className="text-[12.5px] leading-relaxed text-dark-400">
        El beneficio de pocas apuestas es casi todo suerte. El número que dice si el método funciona es
        el <b className="text-dark-200">CLV</b>: si tu cuota fue mejor que la justa al empezar el partido.
        Positivo tras 100-200 apuestas = funciona.
      </p>
      {apuestas.length === 0
        ? <div className="card p-8 text-center text-[13px] text-dark-400">Aún no has apuntado ninguna apuesta.</div>
        : (
          <div className="card overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-dark-500">
                  <th className="px-3 py-2">Apuesta</th><th className="px-2 py-2 text-right">Cuota</th>
                  <th className="px-2 py-2 text-right">Importe</th><th className="px-2 py-2 text-right">CLV</th>
                  <th className="px-3 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {apuestas.map((a) => (
                  <tr key={a.id} className="border-t border-dark-800/70 align-top">
                    <td className="px-3 py-2">
                      {a.descripcion
                        ? <><div className="text-dark-100">{a.descripcion}</div><div className="text-[11.5px] text-dark-500">{a.casa} · apuntada a mano</div></>
                        : <><div className="text-dark-100">{a.local} – {a.visitante}</div>
                            <div className="text-[11.5px] text-dark-500">A{seleccion(a.mercado, a.linea, a.seleccion, a.local, a.visitante)} · {a.casa}</div></>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-dark-100">{cuota(a.cuota)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-dark-100">{eur(a.importe)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-dark-300">{a.clv == null ? '—' : pct(a.clv)}</td>
                    <td className="px-3 py-2">
                      {a.resultado === 'pendiente'
                        ? (
                          <div className="flex flex-wrap gap-1">
                            {[['ganada', 'Ganada'], ['perdida', 'Perdida'], ['nula', 'Nula']].map(([k, t]) => (
                              <button key={k} type="button" disabled={ocupada === a.id} onClick={() => liquidar(a.id, k)}
                                      className="btn-secondary px-2 py-1 text-[11.5px]">{t}</button>
                            ))}
                          </div>
                        )
                        : <span className={a.resultado === 'ganada' ? 'text-emerald-300' : a.resultado === 'perdida' ? 'text-rose-300' : 'text-dark-400'}>
                            {a.resultado}
                          </span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

const ESTADO_SEG = {
  apagado: ['text-rose-300', 'Apagado: no bate el cierre'],
  'de confianza': ['text-emerald-300', 'De confianza'],
  aprendiendo: ['text-dark-400', 'Aprendiendo'],
  neutro: ['text-dark-400', 'Sin decidir'],
}

function Aprendizaje({ datos }) {
  const segs = lista(datos?.segmentos)
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-dark-400">
        Cada aviso, lo apuestes o no, se compara con la cuota justa al empezar el partido.
        Con {datos?.minimo ?? 30} avisos o más de un mismo tipo, lo que no bate el cierre se <b className="text-dark-200">apaga solo</b> y
        lo que sí se marca <b className="text-dark-200">de confianza</b>. No aprende de ganar o perder partidos sueltos: eso es suerte.
      </p>
      {segs.length === 0
        ? <div className="card p-8 text-center text-[13px] text-dark-400">Aún no hay partidos cerrados con los que aprender.</div>
        : (
          <div className="card overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-dark-500">
                  <th className="px-3 py-2">Casa</th><th className="px-2 py-2">Cuota</th>
                  <th className="px-2 py-2 text-right">Avisos</th><th className="px-2 py-2 text-right">CLV</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {segs.map((g, i) => {
                  const [cls, txt] = ESTADO_SEG[g.estado] || ESTADO_SEG.neutro
                  return (
                    <tr key={i} className="border-t border-dark-800/70 align-top">
                      <td className="px-3 py-2">
                        <div className="text-dark-100">{g.casa}</div>
                        <div className="text-[11.5px] text-dark-500">{g.mercado} · {g.momento} · {g.fallo}</div>
                      </td>
                      <td className="px-2 py-2 text-dark-300">{g.rango}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-dark-100">{g.n}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-dark-100">{g.clv_medio == null ? '—' : pct(g.clv_medio)}</td>
                      <td className={`px-3 py-2 ${cls}`}>{txt}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

export default function Valor() {
  const [pestana, setPestana] = useState('valor')
  const [datos, setDatos] = useState(null)
  const [aprende, setAprende] = useState(null)
  const [error, setError] = useState('')
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
  /* Cada 20 s con la pestaña a la vista. No cada 5 como el original: el
     escáner lee cada pocas horas con los cupos gratis, y mientras escribes una
     apuesta a mano no se repinta nada. */
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return
      const foco = document.activeElement
      if (foco && foco.closest && foco.closest('form')) return
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
  const cuenta = { seguras: datos.seguras.length, valor: datos.valor.length, vivo: datos.vivo.length }
  const pestanas = PESTANAS.filter(([k]) => k !== 'seguras' || cuenta.seguras > 0)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-display text-[19px] font-semibold tracking-tight text-dark-50">Valor</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-dark-400">
            <span>Beneficio <b className={`tabular-nums ${b.beneficio >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{eur(b.beneficio)}</b></span>
            <span>Esperado <b className="tabular-nums text-dark-100">{eur(b.beneficio_esperado)}</b></span>
            <span>CLV <b className="tabular-nums text-dark-100">{b.clv_medio == null ? '—' : pct(b.clv_medio)}</b></span>
            <span>Pendientes <b className="tabular-nums text-dark-100">{b.pendientes ?? 0}</b></span>
            <span>Banca <b className="tabular-nums text-dark-100">{eur(est.banca)}</b></span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-dark-500">
          <Radio size={13} className={est.escaneando ? 'text-emerald-400' : 'text-dark-600'} />
          {est.escaneando
            ? <>Buscando en {lista(est.fuentes).join(', ') || 'ninguna fuente (faltan las claves)'}{est.ultima_vuelta ? ` · última lectura ${hace(est.ultima_vuelta)}` : ' · aún sin leer'}</>
            : 'El buscador está apagado: solo se ve lo que ya había y lo que apuntes a mano.'}
          {est.ultimo_error ? <span className="text-amber-300"> · la última vuelta falló ({est.ultimo_error})</span> : null}
        </div>
        {est.frenado && (
          <Aviso>Freno: hoy llevas {eur(-est.resultado_hoy)} perdidos (tope {eur(est.freno_dia)}). No metas más hasta mañana.</Aviso>
        )}
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

      {pestana === 'apuestas' && <MisApuestas apuestas={datos.apuestas} alCambiar={carga} />}
      {pestana === 'aprende' && (aprende
        ? <Aprendizaje datos={aprende} />
        : <div className="flex justify-center p-10 text-dark-400"><Loader2 className="animate-spin" /></div>)}
      {(pestana === 'valor' || pestana === 'vivo' || pestana === 'seguras') && (
        datos[pestana].length === 0
          ? <div className="card p-10 text-center text-[13px] text-dark-400">{VACIO[pestana]}</div>
          : (
            <div className="space-y-3">
              {datos[pestana].map((x, i) => (pestana === 'seguras'
                ? <TarjetaSegura key={x.id} g={x} />
                : <TarjetaValor key={x.id} o={x} primera={i === 0} alApuntar={carga} />))}
            </div>
          )
      )}
      <p className="pb-4 text-[11.5px] leading-snug text-dark-500">
        Cada apuesta sigue pudiendo perderse (4 de cada 10 a cuota 1,65): lo que gana es la suma, a la larga.
      </p>
    </div>
  )
}
