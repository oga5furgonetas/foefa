import { useTitulo } from '../lib/titulo'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Package, CheckCircle2, Clock, XCircle, Truck, Phone, Check } from 'lucide-react'
import { API_BASE } from '../services/api'
import { tx, txError, useIdioma, locale } from '../lib/idioma'
import { textoClienteDice } from './driver/ClienteDice'

/* ── «¿CUÁNDO LLEGA MI PEDIDO?» ─────────────────────────────────────────────
   El enlace que el repartidor manda por WhatsApp. Dice el estado, la hora
   estimada y cuántas paradas quedan antes, y NADA más: ni la dirección, ni el
   nombre, ni dónde está el repartidor. El servidor ya no lo manda; esta página
   tampoco lo pediría. Caduca al día siguiente del reparto.

   EL CLIENTE TE AYUDA ANTES DE LLEGAR (30-10-2026): mientras el pedido está en
   camino, el cliente dice si estará, dónde dejarlo si no, el código del portal
   y una franja. Al repartidor le pagan por paquete entregado y una de cada
   cinco entregas falla a la primera (docs/NECESIDADES-REPARTIDOR-30-10.md):
   esto es lo que más fallos evita. Lo que contesta le salta al repartidor en
   su parada. Si no se pudo entregar, se ve que el repartidor llamó y esperó. */

const ESTADO = {
  pendiente: { icono: Truck, color: 'text-sky-300', texto: 'En reparto' },
  en_ruta: { icono: Truck, color: 'text-sky-300', texto: 'En reparto' },
  entregado: { icono: CheckCircle2, color: 'text-emerald-300', texto: 'Entregado' },
  fallido: { icono: XCircle, color: 'text-red-300', texto: 'No se ha podido entregar' },
}
// Dónde dejarlo si no estará: los mismos sitios que la hoja de entrega del repartidor, más el punto de recogida.
const DEJAR = [['buzon', 'En el buzón'], ['porteria', 'En portería o recepción'], ['vecino', 'Al vecino'], ['seguro', 'En un lugar seguro'], ['punto_recogida', 'En un punto de recogida']]
// De 7:00 a 21:00, de media en media hora.
const HORAS = Array.from({ length: 29 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const hora = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) }
const inp = 'w-full rounded-xl border border-dark-700 bg-dark-950 px-3 py-2.5 text-[15px] text-dark-50 placeholder:text-dark-500 focus:border-brand-500 focus:outline-none'

export default function SeguimientoPedido() {
  useTitulo(tx('Tu pedido'))
  useIdioma()
  const { token } = useParams()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  // La respuesta del cliente.
  const [editando, setEditando] = useState(false)
  const [estare, setEstare] = useState('')
  const [dejar, setDejar] = useState('')
  const [desde, setDesde] = useState('16:00')
  const [hasta, setHasta] = useState('18:00')
  const [portal, setPortal] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState('')

  useEffect(() => {
    let vivo = true
    const leer = () => fetch(`${API_BASE}/seguimiento/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!vivo) return
        if (r.ok) { setD(j); setErr('') } else setErr(txError(j, 'Este enlace no es válido.'))
      })
      .catch(() => vivo && setErr(tx('Sin conexión. Inténtalo de nuevo en un momento.')))
    leer()
    const t = setInterval(leer, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [token])

  const listo = estare === 'si' || (estare === 'no' && dejar) || (estare === 'franja' && hasta > desde)
  async function enviar() {
    setEnviando(true); setFallo('')
    try {
      const r = await fetch(`${API_BASE}/seguimiento/${encodeURIComponent(token)}/respuesta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estare, dejar: estare === 'no' ? dejar : '', franja_desde: estare === 'franja' ? desde : '',
          franja_hasta: estare === 'franja' ? hasta : '', portal: portal.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setFallo(txError(j, 'No se pudo enviar. Inténtalo de nuevo.')); return }
      setD((x) => ({ ...x, respuesta: j.cliente_dice, franja: j.cliente_dice?.franja || x?.franja }))
      setEditando(false)
    } catch { setFallo(tx('No se pudo enviar. Inténtalo de nuevo.')) } finally { setEnviando(false) }
  }
  function cambiar() {
    const r = d?.respuesta || {}
    setEstare(r.estare || ''); setDejar(r.dejar || ''); setPortal(r.portal || '')
    if (r.franja) { setDesde(r.franja[0]); setHasta(r.franja[1]) }
    setEditando(true)
  }

  const e = ESTADO[d?.estado] || ESTADO.pendiente
  const recogida = d?.tipo === 'recogida'
  const enCamino = d && (d.estado === 'pendiente' || d.estado === 'en_ruta')
  const chip = (activo) => `rounded-xl border px-2 py-2.5 text-[13.5px] font-semibold ${activo ? 'border-brand-400 bg-brand-500/15 text-brand-200' : 'border-dark-700 text-dark-200'}`
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark-950 px-4 py-10 text-dark-100">
      <meta name="robots" content="noindex" />
      <div className="w-full max-w-sm rounded-3xl border border-dark-700 bg-dark-900 p-6 text-center">
        {!d && !err && <Loader2 className="mx-auto animate-spin text-dark-500" />}
        {err && <><Package className="mx-auto text-dark-500" /><p className="mt-3 text-[15px] text-dark-300">{err}</p></>}
        {d && (
          <>
            {d.empresa && <p className="text-[13px] font-semibold uppercase tracking-wider text-dark-400">{d.empresa}</p>}
            <e.icono size={40} className={`mx-auto mt-4 ${e.color}`} />
            <h1 className="mt-3 text-[22px] font-bold text-dark-50">
              {tx(recogida && e.texto === 'Entregado' ? 'Recogido' : recogida && e.texto === 'En reparto' ? 'Recogida en camino' : e.texto)}
            </h1>
            {enCamino && (
              <div className="mt-4 space-y-2 text-[15px]">
                {d.eta && <p className="flex items-center justify-center gap-2"><Clock size={16} className="text-brand-300" /> {tx('Llegada aproximada:')} <b className="text-dark-50">{d.eta}</b></p>}
                {d.paradas_antes > 0 && <p className="text-dark-300">{d.paradas_antes > 1 ? tx('Quedan {n} paradas antes de la tuya.', { n: d.paradas_antes }) : tx('Queda 1 parada antes de la tuya.')}</p>}
                {d.paradas_antes === 0 && d.eta && <p className="font-semibold text-emerald-300">{tx('¡Eres la siguiente parada!')}</p>}
                {d.franja && <p className="text-[13px] text-dark-400">{tx('Tu horario: de {a} a {b}', { a: d.franja[0], b: d.franja[1] })}</p>}
                {!d.eta && <p className="text-dark-400">{tx('Aún no tiene hora: el repartidor todavía está preparando la ruta.')}</p>}
              </div>
            )}
            {/* Dónde quedó, sin nombres ni fotos (10-10-2026). */}
            {d.estado === 'entregado' && d.dejado && <p className="mt-3 text-[15px] text-dark-200">{tx(d.dejado)}</p>}
            {d.estado === 'fallido' && <p className="mt-3 text-[14px] text-dark-300">{tx('La tienda se pondrá en contacto contigo para volver a intentarlo.')}</p>}
            {/* El registro del intento: que se vea que se llamó y se esperó. */}
            {d.estado === 'fallido' && d.intento && (d.intento.llegada || d.intento.llamada) && (
              <p data-testid="intento" className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-dark-300">
                <Phone size={13} className="shrink-0 text-dark-400" />
                {d.intento.llamada ? tx('El repartidor llamó a las {hora}', { hora: hora(d.intento.llamada) }) : tx('El repartidor llegó a las {hora}', { hora: hora(d.intento.llegada) })}
                {d.intento.espera_s >= 60 ? ` ${tx('y esperó {n} min', { n: Math.round(d.intento.espera_s / 60) })}` : ''}
              </p>
            )}

            {/* EL CLIENTE TE AYUDA ANTES DE LLEGAR: lo que contestó, o el formulario. */}
            {enCamino && d.puede_contestar && d.respuesta && !editando && (
              <div data-testid="respuesta" className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/[.07] p-4 text-left">
                <p className="flex items-start gap-2 text-[14px] leading-snug text-emerald-100">
                  <Check size={16} className="mt-0.5 shrink-0" /> <span><b>{tx('Gracias. El repartidor ya lo sabe:')}</b> {textoClienteDice(d.respuesta)}</span>
                </p>
                <button type="button" onClick={cambiar} className="mt-2 text-[13px] font-semibold text-brand-300 underline underline-offset-2">{tx('Cambiar')}</button>
              </div>
            )}
            {enCamino && d.puede_contestar && (!d.respuesta || editando) && (
              <div data-testid="formulario" className="mt-5 rounded-2xl border border-brand-400/30 bg-brand-500/[.06] p-4 text-left">
                <p className="text-[15px] font-bold text-dark-50">{tx('¿Estarás en casa?')}</p>
                <p className="mt-0.5 text-[12.5px] text-dark-400">{tx('Ayuda al repartidor y evita una segunda visita.')}</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={tx('¿Estarás en casa?')}>
                  {[['si', 'Sí'], ['no', 'No estaré'], ['franja', 'Otra hora']].map(([k, t]) => (
                    <button key={k} type="button" role="radio" aria-checked={estare === k} onClick={() => setEstare(k)} className={chip(estare === k)}>{tx(t)}</button>
                  ))}
                </div>
                {estare === 'no' && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[13px] text-dark-300">{tx('¿Dónde lo dejamos?')}</p>
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tx('¿Dónde lo dejamos?')}>
                      {DEJAR.map(([k, t]) => (
                        <button key={k} type="button" role="radio" aria-checked={dejar === k} onClick={() => setDejar(k)}
                          className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${dejar === k ? 'border-brand-400 bg-brand-500/15 text-brand-200' : 'border-dark-700 text-dark-200'}`}>{tx(t)}</button>
                      ))}
                    </div>
                  </div>
                )}
                {estare === 'franja' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-[12px] text-dark-400">{tx('Desde las')}
                      <select value={desde} onChange={(ev) => setDesde(ev.target.value)} className={`${inp} mt-1`}>{HORAS.map((h) => <option key={h} value={h}>{h}</option>)}</select>
                    </label>
                    <label className="text-[12px] text-dark-400">{tx('Hasta las')}
                      <select value={hasta} onChange={(ev) => setHasta(ev.target.value)} className={`${inp} mt-1`}>{HORAS.map((h) => <option key={h} value={h}>{h}</option>)}</select>
                    </label>
                  </div>
                )}
                <input className={`${inp} mt-3`} value={portal} maxLength={120} onChange={(ev) => setPortal(ev.target.value)}
                  placeholder={tx('Código del portal o instrucciones (opcional)')} aria-label={tx('Código del portal o instrucciones (opcional)')} />
                {fallo && <p role="alert" className="mt-2 text-[13px] text-red-300">{fallo}</p>}
                <button type="button" onClick={enviar} disabled={!listo || enviando}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta disabled:opacity-40">
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {tx('Enviar')}
                </button>
              </div>
            )}
            <p className="mt-6 text-[11px] leading-snug text-dark-500">
              {tx('La hora es una estimación y puede variar con el tráfico. Esta página no muestra datos personales ni la ubicación del repartidor, y deja de funcionar al día siguiente.')}
            </p>
          </>
        )}
      </div>
      {/* 11-10-2026: quien recibe el paquete a veces también reparte. Discreto, sin datos de nadie. */}
      {d && (
        <a href="/repartidores?utm_source=seguimiento&utm_medium=pie" className="mt-4 block text-center text-[12.5px] text-dark-400 underline-offset-2 hover:underline">
          {tx('¿Repartes? Ordena tu ruta gratis con {app}', { app: 'FDS' })} →
        </a>
      )}
    </div>
  )
}
