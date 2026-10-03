import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Loader2, ShoppingBag, Tag, CheckCircle2, AlertTriangle, Minus, Plus } from 'lucide-react'
import { API_BASE } from '../lib/apiBase'
import { normalizarDetalle } from '../services/api'
import { MARCA } from '../marca'

/* LA TIENDA PUBLICA, sin cuenta ni sesion — el enlace fijo que se manda por
   WhatsApp o email (mismo patron que /taller/t/:token), y el que se anuncia.
   Una prenda cada vez, sin cesta: el backend ya resuelve una compra por
   llamada (tienda_publica_comprar), y aqui no hace falta mas para vender una
   camiseta desde un enlace.

   03-10-2026, para el anuncio de FDs: el nombre de la marca (no «Tienda» + la
   plataforma), la FOTO de cada prenda —antes era una lista de nombres— y el
   10 % de primera compra, que va por el correo. El correo es OPCIONAL: sin el
   se compra igual a precio completo y Stripe lo pide en su pantalla. */

const http = axios.create({ baseURL: API_BASE, timeout: 30000 })
http.interceptors.response.use((r) => r, (e) => {
  if (e?.response?.data) e.response.data = normalizarDetalle(e.response.data)
  return Promise.reject(e)
})

const eur = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`
const correoValido = (c) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)

function Pie() {
  return (
    <div className="mt-10 border-t border-slate-200 pt-4 text-center text-[11.5px] text-slate-400">
      <Link to="/aviso-legal" className="hover:text-slate-600">Aviso legal</Link>
      <span className="mx-2">·</span>
      <Link to="/terminos" className="hover:text-slate-600">Condiciones</Link>
      <span className="mx-2">·</span>
      <Link to="/privacidad" className="hover:text-slate-600">Privacidad</Link>
    </div>
  )
}

export default function TiendaPublica() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const cupon = params.get('cupon') || ''
  const pago = params.get('pago')
  const [datos, setDatos] = useState(null)
  const [err, setErr] = useState('')
  const [abierta, setAbierta] = useState(null)     // {prenda, talla, cantidad}
  const [correo, setCorreo] = useState('')
  const [comprando, setComprando] = useState(false)

  useEffect(() => {
    http.get(`/tienda/publico/${token}`)
      .then((r) => setDatos(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || 'Ese enlace no es válido'))
  }, [token])

  function precioDe(p, talla) {
    return (p.precio || 0) + ((p.tallas_grandes || []).includes(talla) ? (p.recargo_talla || 0) : 0)
  }

  async function comprar() {
    if (!abierta) return
    const c = correo.trim()
    if (c && !correoValido(c)) { setErr('Ese correo no parece correcto. Revísalo o déjalo en blanco.'); return }
    setComprando(true); setErr('')
    try {
      const { data } = await http.post(`/tienda/publico/${token}/comprar`, {
        prenda: abierta.prenda.id, talla: abierta.talla, cantidad: abierta.cantidad,
        ...(c ? { email: c } : {}),
        ...(cupon ? { cupon } : {}),
      })
      if (data?.url) window.location.href = data.url
      else setErr('No se ha podido abrir el pago. Inténtalo en un minuto.')
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se ha podido abrir el pago. Inténtalo en un minuto.')
    } finally { setComprando(false) }
  }

  if (err && !datos) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-sm text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-amber-500" />
          <p className="text-slate-700">{err}</p>
        </div>
      </div>
    )
  }
  if (!datos) {
    return <div className="flex min-h-screen items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-400" /></div>
  }
  if (pago === 'ok') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-sm text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
          <h1 className="text-xl font-bold text-slate-900">¡Pedido hecho!</h1>
          <p className="mt-2 text-sm text-slate-600">Te llegará la confirmación por correo. Gracias por comprar.</p>
        </div>
      </div>
    )
  }
  if (!datos.abierta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <p className="text-slate-500">La tienda está cerrada ahora mismo.</p>
      </div>
    )
  }

  const nombre = datos.nombre || `Tienda ${MARCA.nombre}`
  const pct = Math.round((datos.descuento_pct || 0) * 100)
  const foto = (p) => `${API_BASE}/tienda/publico/${token}/foto/${p.id}?v=${p.foto_ver}`

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center gap-2.5">
          <ShoppingBag size={22} className="text-slate-900" />
          <div>
            <h1 className="font-display text-2xl font-bold leading-none tracking-tight text-slate-900">{nombre}</h1>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Edición limitada</p>
          </div>
        </div>
        {cupon ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
            <Tag size={15} /> Tienes un cupón de bienvenida aplicado — se descuenta al pagar, mientras siga vigente.
          </div>
        ) : pct > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm text-white">
            <Tag size={15} className="shrink-0" />
            <span><b>-{pct} % en tu primera compra.</b> Pon tu correo al comprar y se descuenta al pagar.</span>
          </div>
        )}
        {pago === 'no' && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">
            El pago se canceló. Puedes intentarlo de nuevo cuando quieras.
          </div>
        )}
        {datos.prendas.length === 0 ? (
          <p className="text-slate-500">No hay prendas a la venta ahora mismo.</p>
        ) : (
          <div className="space-y-4">
            {datos.prendas.map((p) => {
              const activa = abierta?.prenda?.id === p.id
              return (
                <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200">
                  {p.foto_ver && (
                    <img src={foto(p)} alt={p.nombre} loading="lazy"
                      className="aspect-square w-full bg-slate-50 object-cover" />
                  )}
                  <div className="p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{p.nombre}</div>
                        <div className="text-xs text-slate-500">
                          {eur(p.precio)}{p.quedan != null ? ` · quedan ${p.quedan}` : ''}
                        </div>
                      </div>
                      {!activa && (
                        <button onClick={() => { setAbierta({ prenda: p, talla: p.tallas[0] || '', cantidad: 1 }); setErr('') }}
                          disabled={p.quedan === 0}
                          className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                          {p.quedan === 0 ? 'Agotado' : 'Comprar'}
                        </button>
                      )}
                    </div>
                    {activa && (
                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                        <div className="flex flex-wrap gap-1.5">
                          {p.tallas.map((t) => (
                            <button key={t} onClick={() => setAbierta((a) => ({ ...a, talla: t }))}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${abierta.talla === t ? 'bg-slate-900 text-white ring-slate-900' : 'text-slate-600 ring-slate-300'}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setAbierta((a) => ({ ...a, cantidad: Math.max(1, a.cantidad - 1) }))}
                            aria-label="Una menos" className="rounded-lg p-1.5 text-slate-700 ring-1 ring-slate-300"><Minus size={14} /></button>
                          <span className="cifra w-6 text-center font-semibold text-slate-900">{abierta.cantidad}</span>
                          <button onClick={() => setAbierta((a) => ({ ...a, cantidad: Math.min(5, a.cantidad + 1) }))}
                            aria-label="Una más" className="rounded-lg p-1.5 text-slate-700 ring-1 ring-slate-300"><Plus size={14} /></button>
                          <span className="ml-auto font-semibold text-slate-900">{eur(precioDe(p, abierta.talla) * abierta.cantidad)}</span>
                        </div>
                        <div>
                          <label htmlFor="correo-compra" className="text-xs font-medium text-slate-600">
                            Tu correo {pct > 0 && !cupon ? `(para tu -${pct} % de primera compra y el recibo)` : '(para el recibo)'}
                          </label>
                          <input id="correo-compra" type="email" inputMode="email" autoComplete="email"
                            value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tucorreo@gmail.com"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[15px] text-slate-900" />
                          {pct > 0 && !cupon && (
                            <p className="mt-1 text-[11.5px] text-slate-500">
                              Si es tu primera compra con ese correo, el -{pct} % se aplica en la pantalla de pago.
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setAbierta(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-300">Cancelar</button>
                          <button onClick={comprar} disabled={comprando}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            {comprando ? <Loader2 size={14} className="animate-spin" /> : null} Ir a pagar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {err && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}
        <Pie />
      </div>
    </div>
  )
}
