import { useCallback, useEffect, useState } from 'react'
import { Route, History, Settings2, UserCircle2, Loader2, CheckCircle2, XCircle, Package, Euro } from 'lucide-react'
import MiRuta from './driver/MiRuta'
import { Ajustes } from '../panel/pages/Reparto'
import { getRepartoPedidos, getRepartoEstadisticas, getOrgBilling, canjearRegalo, playVerificar } from '../panel/api'
import { enAppPlay } from '../lib/enApp'
import { servicioPlay, comprasPlay } from '../lib/playBilling'
import { isAuthed } from '../panel/auth'
import { Cuenta, Muro } from './RutaCuenta'
import { useToast } from '../lib/toast'
import { lista } from '../lib/lista'
import { hoyLocal, fechaEs } from '../lib/fecha'

/* ── LA APP DE QUIEN REPARTE SOLO (04-10-2026) ───────────────────────────────
   No es el panel de una empresa pequeña: es otro producto, como Circuit o
   Flex. Dani: «no es lógico que a una empresa le cobremos 300 y a un autónomo
   10 por tener lo mismo». Aquí solo hay reparto: su ruta de hoy, lo que lleva
   hecho, cómo se calcula la ruta y su cuenta. Sin vehículos, taller,
   inspecciones, equipo ni asistente de IA. Si entra al panel, se le trae aquí. */

const PESTANAS = [
  ['hoy', 'Hoy', Route], ['historial', 'Historial', History], ['ajustes', 'Ajustes', Settings2], ['cuenta', 'Cuenta', UserCircle2],
]
const euros = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`

export default function RutaApp() {
  const toast = useToast()
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem('ruta_tab') || 'hoy' } catch { return 'hoy' }
  })
  useEffect(() => { try { sessionStorage.setItem('ruta_tab', tab) } catch { /* nada */ } }, [tab])

  // El estado del pago manda qué se ve: sin pagar (o sin la tarjeta de la
  // prueba), «Hoy» y «Ajustes» enseñan el muro; historial y cuenta, siempre.
  const [billing, setBilling] = useState(null)
  const [regaloNuevo, setRegaloNuevo] = useState(null)
  const recargar = useCallback(() => getOrgBilling().then(({ data }) => setBilling(data)).catch(() => setBilling({})), [])
  useEffect(() => {
    if (!isAuthed()) return
    const q = new URLSearchParams(window.location.search)
    const limpiar = () => window.history.replaceState(null, '', '/ruta')
    // Un regalo pendiente (del enlace /regalo/… o de ?canjear=): se canjea
    // ANTES de mirar el pago, para no enseñar el muro a quien ya lo tiene.
    let pendiente = q.get('canjear') || ''
    try { pendiente = pendiente || sessionStorage.getItem('regalo_pendiente') || '' } catch { /* nada */ }
    const canje = pendiente
      ? canjearRegalo(pendiente).then(({ data }) => toast.success(data?.mensaje || 'Regalo aplicado'))
        .catch((e) => toast.error(e?.response?.data?.detail || 'No se pudo canjear el regalo'))
        .finally(() => { try { sessionStorage.removeItem('regalo_pendiente') } catch { /* nada */ } })
      : Promise.resolve()
    canje.then(recargar)
    if (q.get('regalo') === 'cancelado') { toast.error('Pago del regalo cancelado'); limpiar() } else if (q.get('regalo')) {
      setRegaloNuevo(q.get('regalo')); setTab('cuenta'); limpiar()
    }
    if (q.get('pago') === 'ok') {
      // El webhook de Stripe tarda unos segundos: se mira varias veces.
      let n = 0
      const t = setInterval(() => { n += 1; recargar(); if (n >= 8) clearInterval(t) }, 3000)
      toast.success('Tarjeta añadida. Activando tu cuenta…')
      limpiar()
      return () => clearInterval(t)
    }
    if (q.get('pago') === 'cancelado') limpiar()
    if (pendiente || q.get('canjear')) limpiar()
    return undefined
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const bloqueado = !!billing?.bloqueo

  // Dentro de la app: si la cuenta de Google ya tiene la suscripción (reinstaló,
  // cambió de móvil) y aquí no consta, se comprueba y se liga. Una vez.
  const [restaurado, setRestaurado] = useState(false)
  useEffect(() => {
    if (restaurado || !billing?.play?.listo || billing.pago_proveedor === 'play' || !enAppPlay()) return
    setRestaurado(true)
    ;(async () => {
      const srv = await servicioPlay()
      if (!srv) return
      const nuestras = (await comprasPlay(srv)).filter((c) => billing.play.productos?.[c.itemId] && c.purchaseToken)
      for (const c of nuestras) {
        try { await playVerificar(c.purchaseToken); recargar(); return } catch { /* de otra cuenta o caducada: se ignora */ }
      }
    })()
  }, [billing, restaurado, recargar])

  if (!isAuthed()) { window.location.replace('/empezar'); return null }

  return (
    <div className="flex min-h-screen flex-col bg-dark-950 text-dark-100">
      {billing?.status === 'trial' && !billing.bloqueo && !billing.falta_tarjeta && billing.days_left != null && billing.days_left <= 3 && tab !== 'cuenta' && (
        <button onClick={() => setTab('cuenta')}
          className="flex w-full items-center justify-center gap-1.5 bg-amber-500/15 px-4 py-2 text-[13px] font-semibold text-amber-200">
          Quedan {billing.days_left} día{billing.days_left === 1 ? '' : 's'} de prueba · Ver mi plan
        </button>
      )}
      <main className="flex-1 px-4 pb-24 pt-4">
        {(tab === 'hoy' || tab === 'ajustes') && bloqueado
          ? <Muro billing={billing} toast={toast} recargar={recargar} irACuenta={() => setTab('cuenta')} />
          : <>
            {tab === 'hoy' && <MiRuta embebido onBack={() => {}} />}
            {tab === 'ajustes' && <div className="mx-auto max-w-md"><Ajustes conductores={[]} toast={toast} autonomo /></div>}
          </>}
        {tab === 'historial' && <Historial />}
        {tab === 'cuenta' && <Cuenta billing={billing} recargar={recargar} toast={toast} resaltarRegalo={regaloNuevo} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-dark-800 bg-dark-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Secciones">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {PESTANAS.map(([k, t, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex flex-col items-center gap-1 pb-2 pt-2 text-[11px] font-semibold transition-colors ${tab === k ? 'text-brand-200' : 'text-dark-500'}`}
              aria-current={tab === k ? 'page' : undefined}>
              {/* La pestaña activa, en una píldora: se ve de un vistazo dónde estás. */}
              <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all ${tab === k ? 'bg-brand-500/20' : ''}`}>
                <I size={20} strokeWidth={tab === k ? 2.4 : 2} />
              </span>
              {t}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

/* Lo que llevas hecho: por día, con entregas, no entregados, cobros y km. */
function Historial() {
  const [est, setEst] = useState(null)
  const [dia, setDia] = useState(null)
  const [pedidos, setPedidos] = useState(null)
  useEffect(() => { getRepartoEstadisticas(30).then(({ data }) => setEst(data)).catch(() => setEst({ por_dia: [] })) }, [])
  useEffect(() => {
    if (!dia) return
    setPedidos(null)
    getRepartoPedidos(dia).then(({ data }) => setPedidos(data)).catch(() => setPedidos({ pedidos: [] }))
  }, [dia])
  if (!est) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" /></div>
  const dias = lista(est.por_dia).filter((d) => d.total > 0).reverse()
  const hoy = hoyLocal()
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-[22px] font-bold text-dark-50">Historial</h1>
      <p className="mb-4 text-[12.5px] text-dark-400">
        Últimos 30 días: {est.total} paradas, {est.entregados} entregadas
        {est.tasa_entrega != null ? ` (${est.tasa_entrega} % a la primera)` : ''}.
      </p>
      {dias.length === 0 && <p className="rounded-xl border border-dashed border-dark-700 px-4 py-8 text-center text-[13px] text-dark-400">Aún no hay repartos. Hoy empieza en «Hoy».</p>}
      <div className="flex flex-col gap-2">
        {dias.map((d) => (
          <button key={d.fecha} onClick={() => setDia(dia === d.fecha ? null : d.fecha)}
            className={`rounded-2xl border p-3.5 text-left ${dia === d.fecha ? 'border-brand-500/60 bg-brand-500/10' : 'border-dark-700 bg-dark-900'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-dark-50">{d.fecha === hoy ? 'Hoy' : fechaEs(d.fecha)}</span>
              <span className="text-[12.5px] text-dark-400">{d.entregados}/{d.total} entregados{d.fallidos ? ` · ${d.fallidos} no` : ''}</span>
            </div>
            {dia === d.fecha && (
              pedidos === null ? <Loader2 size={16} className="mt-3 animate-spin text-dark-500" /> : <Dia datos={pedidos} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function Dia({ datos }) {
  const ps = lista(datos?.pedidos)
  const ruta = lista(datos?.conductores)[0]?.ruta
  const cobrado = ps.reduce((a, p) => a + (Number(p.cobrado_importe) || 0), 0)
  return (
    <div className="mt-3 space-y-1.5 text-[12.5px]">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-dark-300">
        <span className="flex items-center gap-1"><Package size={13} /> {ps.length} paradas</span>
        {ruta?.km ? <span>{ruta.km} km</span> : null}
        {ruta?.minutos ? <span>{Math.floor(ruta.minutos / 60)} h {ruta.minutos % 60} min</span> : null}
        {cobrado > 0 && <span className="flex items-center gap-1 text-emerald-300"><Euro size={13} /> {euros(cobrado)} cobrados</span>}
      </div>
      <ul className="divide-y divide-dark-800 rounded-xl border border-dark-800">
        {ps.map((p) => (
          <li key={p.id} className="flex items-start gap-2 px-3 py-2">
            {p.estado === 'entregado' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              : p.estado === 'fallido' ? <XCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                : <Package size={14} className="mt-0.5 shrink-0 text-dark-500" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-dark-100">{p.cliente || p.direccion || 'Pedido'}</span>
              <span className="block truncate text-[11.5px] text-dark-500">
                {p.direccion && p.cliente ? `${p.direccion} · ` : ''}{p.eta ? `≈ ${p.eta}` : ''}{p.motivo ? ` · ${p.motivo}` : ''}
                {p.cobrado_importe ? ` · ${euros(p.cobrado_importe)} ${p.cobrado_metodo || ''}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
