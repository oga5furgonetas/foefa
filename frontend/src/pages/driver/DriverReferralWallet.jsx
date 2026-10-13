import { useEffect, useState } from 'react'
import { Copy, Gift, Loader2, Wallet } from 'lucide-react'
import { getDriverReferidos, retirarDriverReferidos } from '../../services/api'

const euros = (centimos) => `${((Number(centimos) || 0) / 100).toFixed(2).replace('.', ',').replace(',00', '')} €`

export default function DriverReferralWallet() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [titular, setTitular] = useState('')
  const [metodo, setMetodo] = useState('')
  const [destino, setDestino] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargar = () => getDriverReferidos()
    .then(({ data: d }) => {
      setData(d)
      setMetodo((actual) => actual && d.metodos?.includes(actual) ? actual : (d.metodos || [])[0] || '')
      setError('')
    })
    .catch((e) => setError(e?.response?.data?.detail || 'No se pudo cargar tu cartera ahora.'))

  useEffect(() => { cargar() }, [])

  async function compartir() {
    if (!data?.enlace) return
    const mensaje = `Estoy usando Flota para organizar repartos. Pruébala gratis: ${data.enlace}\n\nSi te registras con mi enlace y completas 20 entregas reales en 2 días distintos, repartidas durante cada jornada y dentro de tus primeros 30 días, yo gano ${euros(data.por_invitado)}. Es una invitación personal; no está vinculada a mi empresa.`
    try {
      if (navigator.share) await navigator.share({ title: 'Prueba Flota para tus repartos', text: mensaje })
      else {
        await navigator.clipboard.writeText(mensaje)
        setCopiado(true); setTimeout(() => setCopiado(false), 2200)
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setError('No se pudo abrir el menú para compartir. Copia el enlace directamente.')
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(data.enlace)
      setCopiado(true); setTimeout(() => setCopiado(false), 2200)
    } catch { setError('No se pudo copiar el enlace. Mantén pulsado para seleccionarlo.') }
  }

  async function solicitar(e) {
    e.preventDefault(); setOcupado(true); setAviso(''); setError('')
    try {
      await retirarDriverReferidos({ titular, metodo, destino })
      setAviso('Solicitud enviada. La revisaremos y te avisaremos por email.')
      setAbierto(false); setTitular(''); setDestino(''); await cargar()
    } catch (err) { setError(err?.response?.data?.detail || 'No se pudo solicitar el pago.') }
    finally { setOcupado(false) }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-700 via-emerald-800 to-dark-950 p-4 shadow-lg shadow-emerald-950/30" aria-label="Invita a probar Flota">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-lime-300/15 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="rounded-xl bg-white/15 p-2.5 text-lime-200"><Gift size={20} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-lime-200">Invita · comparte · gana</p>
          <h2 className="mt-0.5 text-[18px] font-extrabold text-white">Tu próximo reparto puede traer premio</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-emerald-50">
            Comparte Flota con otros repartidores. Ganas <strong className="text-lime-200">{euros(data?.por_invitado ?? 250)}</strong> cuando se registren con tu enlace y completen 20 entregas reales en al menos 2 días dentro de sus primeros 30 días.
          </p>
        </div>
      </div>

      {data ? <>
        <div className="relative mt-3 flex items-center justify-between rounded-xl border border-white/15 bg-dark-950/75 px-3 py-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-400">Tu cartera individual</p>
            <p className="text-[24px] font-extrabold leading-tight text-lime-200">{euros(data.saldo)}</p>
          </div>
          <p className="text-right text-[11px] leading-snug text-dark-300">{data.invitados} invitado{data.invitados === 1 ? '' : 's'} · {data.premiados} válido{data.premiados === 1 ? '' : 's'}<br />Retira desde {euros(data.retirada_min)}</p>
        </div>
        <div className="mt-2">
          <div className="h-2 overflow-hidden rounded-full bg-dark-950/80"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-all" style={{ width: `${Math.min(100, (Number(data.saldo || 0) / Number(data.retirada_min || 3000)) * 100)}%` }} /></div>
          <p className="mt-1 text-[10.5px] text-emerald-100">{data.saldo >= data.retirada_min ? '¡Ya puedes solicitar tu cobro!' : `Te faltan ${euros(data.retirada_min - data.saldo)} para solicitarlo`} · {data.metodos?.includes('bizum') ? 'Bizum o transferencia' : 'Métodos de cobro disponibles'}{data.metodos?.includes('paypal') ? ' o PayPal' : ''}</p>
        </div>
        {data.enlace && <p className="mt-2 break-all rounded-lg bg-dark-950/50 px-2.5 py-2 text-[11px] text-dark-400">{data.enlace}</p>}
        <div className="mt-2 flex gap-2">
          <button onClick={compartir} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 py-3 text-[14px] font-extrabold text-emerald-950 shadow-md shadow-black/20 active:scale-[.99]">
            <Gift size={16} /> Invitar y ganar {euros(data.por_invitado)}
          </button>
          <button onClick={copiar} aria-label="Copiar enlace" className="rounded-xl border border-emerald-500/40 px-3 text-emerald-200" title="Copiar enlace">
            <Copy size={16} />
          </button>
        </div>
        {copiado && <p className="mt-1.5 text-center text-[12px] text-emerald-300">Copiado: ya puedes compartirlo</p>}
        <button onClick={() => setAbierto((v) => !v)} disabled={data.saldo < (data.retirada_min || 1000) || data.pendiente}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold ${data.saldo >= data.retirada_min && !data.pendiente ? 'bg-white text-emerald-950 shadow-md' : 'border border-white/15 text-dark-200 disabled:opacity-70'}`}>
          <Wallet size={16} /> {data.pendiente ? 'Cobro solicitado · en revisión' : data.saldo < (data.retirada_min || 3000) ? `Retirar desde ${euros(data.retirada_min)}` : 'Elegir método y solicitar cobro'}
        </button>
        {abierto && <form onSubmit={solicitar} className="mt-3 space-y-2 rounded-xl border border-dark-700 bg-dark-950/60 p-3">
          <label className="block text-[11px] text-dark-400">Nombre y apellidos del titular
            <input required minLength={5} value={titular} onChange={(e) => setTitular(e.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 text-[13px] text-dark-100" />
          </label>
          <label className="block text-[11px] text-dark-400">Método de cobro
            <select required value={metodo} onChange={(e) => setMetodo(e.target.value)} className="mt-1 w-full rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 text-[13px] text-dark-100">
              {data.metodos?.includes('bizum') && <option value="bizum">Bizum</option>}
              {data.metodos?.includes('iban') && <option value="iban">Transferencia bancaria (IBAN)</option>}
              {data.metodos?.includes('paypal') && <option value="paypal">PayPal</option>}
            </select>
          </label>
          <label className="block text-[11px] text-dark-400">{metodo === 'bizum' ? 'Móvil de Bizum' : metodo === 'iban' ? 'IBAN' : 'Email de PayPal'}
            <input required value={destino} onChange={(e) => setDestino(e.target.value)} autoComplete="off" inputMode={metodo === 'bizum' ? 'tel' : 'text'} className="mt-1 w-full rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 text-[13px] text-dark-100" />
          </label>
          <button disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
            {ocupado && <Loader2 size={14} className="animate-spin" />} Enviar solicitud de pago
          </button>
        </form>}
        {(data.retiradas || []).length > 0 && <div className="mt-3 border-t border-dark-700 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-500">Solicitudes de pago</p>
          <ul className="mt-1 space-y-1 text-[11px] text-dark-400">
            {data.retiradas.slice(0, 3).map((r) => <li key={r.id}>{euros(r.importe)} · {r.estado} · {String(r.creada || '').slice(0, 10)}{r.motivo ? ` · ${r.motivo}` : ''}</li>)}
          </ul>
        </div>}
      </> : !error && <div className="mt-3 h-9 animate-pulse rounded-xl bg-dark-800/60" />}
      {aviso && <p className="mt-2 text-[12px] text-emerald-300">{aviso}</p>}
      {error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}
      {error && !data && <button onClick={cargar} className="mt-1 text-[12px] text-emerald-300 underline">Reintentar</button>}
      <p className="relative mt-2 text-[10.5px] leading-relaxed text-dark-300">Al llegar a {euros(data?.retirada_min || 3000)}, pulsa el botón de cobro, elige {data?.metodos?.includes('bizum') ? 'Bizum o transferencia (IBAN)' : 'PayPal'} y añade los datos del titular. Revisamos la solicitud antes de enviar el pago. Tu enlace y saldo son personales, independientes de tu empresa. <a href="/terminos#invita-conductor" target="_blank" rel="noreferrer" className="text-lime-200 underline">Ver condiciones</a>.</p>
    </section>
  )
}
