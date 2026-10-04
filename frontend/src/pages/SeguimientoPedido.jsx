import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Package, CheckCircle2, Clock, XCircle, Truck } from 'lucide-react'
import { API_BASE } from '../services/api'
import { tx } from '../lib/idioma'

/* ── «¿CUÁNDO LLEGA MI PEDIDO?» ─────────────────────────────────────────────
   El enlace que el repartidor manda por WhatsApp. Dice el estado, la hora
   estimada y cuántas paradas quedan antes, y NADA más: ni la dirección, ni el
   nombre, ni dónde está el repartidor. El servidor ya no lo manda; esta página
   tampoco lo pediría. Caduca al día siguiente del reparto. */

const ESTADO = {
  pendiente: { icono: Truck, color: 'text-sky-300', texto: 'En reparto' },
  en_ruta: { icono: Truck, color: 'text-sky-300', texto: 'En reparto' },
  entregado: { icono: CheckCircle2, color: 'text-emerald-300', texto: 'Entregado' },
  fallido: { icono: XCircle, color: 'text-red-300', texto: 'No se ha podido entregar' },
}

export default function SeguimientoPedido() {
  const { token } = useParams()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let vivo = true
    const leer = () => fetch(`${API_BASE}/seguimiento/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!vivo) return
        if (r.ok) { setD(j); setErr('') } else setErr(j.detail || tx('Este enlace no es válido.'))
      })
      .catch(() => vivo && setErr(tx('Sin conexión. Inténtalo de nuevo en un momento.')))
    leer()
    const t = setInterval(leer, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [token])

  const e = ESTADO[d?.estado] || ESTADO.pendiente
  const recogida = d?.tipo === 'recogida'
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-950 px-4 py-10 text-dark-100">
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
            {(d.estado === 'pendiente' || d.estado === 'en_ruta') && (
              <div className="mt-4 space-y-2 text-[15px]">
                {d.eta && <p className="flex items-center justify-center gap-2"><Clock size={16} className="text-brand-300" /> {tx('Llegada aproximada:')} <b className="text-dark-50">{d.eta}</b></p>}
                {d.paradas_antes > 0 && <p className="text-dark-300">{d.paradas_antes > 1 ? tx('Quedan {n} paradas antes de la tuya.', { n: d.paradas_antes }) : tx('Queda 1 parada antes de la tuya.')}</p>}
                {d.paradas_antes === 0 && d.eta && <p className="font-semibold text-emerald-300">{tx('¡Eres la siguiente parada!')}</p>}
                {d.franja && <p className="text-[13px] text-dark-400">{tx('Tu horario: de {a} a {b}', { a: d.franja[0], b: d.franja[1] })}</p>}
                {!d.eta && <p className="text-dark-400">{tx('Aún no tiene hora: el repartidor todavía está preparando la ruta.')}</p>}
              </div>
            )}
            {d.estado === 'fallido' && <p className="mt-3 text-[14px] text-dark-300">{tx('La tienda se pondrá en contacto contigo para volver a intentarlo.')}</p>}
            <p className="mt-6 text-[11px] leading-snug text-dark-500">
              {tx('La hora es una estimación y puede variar con el tráfico. Esta página no muestra datos personales ni la ubicación del repartidor, y deja de funcionar al día siguiente.')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
