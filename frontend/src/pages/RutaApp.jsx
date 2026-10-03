import { useEffect, useState } from 'react'
import { Route, History, Settings2, UserCircle2, Loader2, LogOut, CheckCircle2, XCircle, Package, Euro } from 'lucide-react'
import MiRuta from './driver/MiRuta'
import { Ajustes } from '../panel/pages/Reparto'
import TrialBanner from '../panel/TrialBanner'
import { getRepartoPedidos, getRepartoEstadisticas, getOrgBilling, stripePortal } from '../panel/api'
import { getAdmin, isAuthed, logout } from '../panel/auth'
import { useToast } from '../lib/toast'
import { lista } from '../lib/lista'
import { hoyLocal, fechaEs } from '../lib/fecha'
import { MARCA } from '../marca'

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

  if (!isAuthed()) { window.location.replace('/empezar'); return null }

  return (
    <div className="flex min-h-screen flex-col bg-dark-950 text-dark-100">
      <TrialBanner />
      <main className="flex-1 px-4 pb-24 pt-4">
        {tab === 'hoy' && <MiRuta embebido onBack={() => {}} />}
        {tab === 'historial' && <Historial />}
        {tab === 'ajustes' && <div className="mx-auto max-w-md"><Ajustes conductores={[]} toast={toast} autonomo /></div>}
        {tab === 'cuenta' && <Cuenta toast={toast} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-dark-800 bg-dark-950/95 backdrop-blur" aria-label="Secciones">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {PESTANAS.map(([k, t, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${tab === k ? 'text-brand-300' : 'text-dark-500'}`}
              aria-current={tab === k ? 'page' : undefined}>
              <I size={20} /> {t}
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

/* La cuenta: plan, prueba o suscripción, y salir. */
function Cuenta({ toast }) {
  const [billing, setBilling] = useState(null)
  const admin = getAdmin()
  useEffect(() => { getOrgBilling().then(({ data }) => setBilling(data)).catch(() => setBilling({})) }, [])
  const estado = billing?.status
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-[22px] font-bold text-dark-50">Tu cuenta</h1>
      <div className="mt-4 rounded-2xl border border-dark-700 bg-dark-900 p-4 text-[13.5px]">
        <p className="text-[15px] font-semibold text-dark-50">{admin?.name || '—'}</p>
        {!billing ? <Loader2 size={16} className="mt-2 animate-spin text-dark-500" /> : (
          <p className="mt-1 text-dark-400">
            Plan <b className="text-dark-200">Repartidor</b>, 9,99 €/mes.{' '}
            {estado === 'trial' && (billing.days_left != null
              ? `Prueba gratis: quedan ${billing.days_left} día${billing.days_left === 1 ? '' : 's'}.`
              : 'En prueba gratis.')}
            {estado === 'active' && 'Suscripción activa.'}
            {estado === 'suspended' && 'Suscripción pausada: hay un pago pendiente.'}
          </p>
        )}
        {billing?.pago_proveedor === 'stripe' && billing?.stripe_customer !== null && estado === 'active' && (
          <button className="mt-3 w-full rounded-xl border border-dark-600 py-2.5 text-[13.5px] font-semibold text-dark-100"
            onClick={async () => {
              try { const { data } = await stripePortal(); if (data?.url) window.location.href = data.url } catch (e) {
                toast.error(e?.response?.data?.detail || 'No se pudo abrir el portal de pagos')
              }
            }}>Tarjeta, facturas y cancelar</button>
        )}
      </div>
      <div className="mt-4 rounded-2xl border border-dark-700 bg-dark-900 p-4 text-[12.5px] leading-relaxed text-dark-400">
        <p>Tus datos y los de tus clientes son tuyos: cada repartidor ve solo lo suyo, la foto de la etiqueta se lee en tu móvil y los datos de los clientes se borran solos a los días que fijes en Ajustes.</p>
        <p className="mt-2"><a href="/privacidad" className="text-brand-300">Privacidad</a> · <a href="/terminos" className="text-brand-300">Términos</a> · <a href={`mailto:${MARCA.correo}`} className="text-brand-300">{MARCA.correo}</a></p>
      </div>
      <button onClick={() => { logout(); window.location.href = '/empezar' }}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dark-700 py-3 text-[14px] font-semibold text-dark-300">
        <LogOut size={15} /> Cerrar sesión
      </button>
    </div>
  )
}
