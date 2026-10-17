import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2, Package, CheckCircle2, Clock, XCircle, AlertTriangle, Truck, MapPin, Users, Route, ArrowRight, Zap,
} from 'lucide-react'
import { getRepartoPedidos, getRepartoEstadisticas, getRepartoVivo, getRepartoAjustes, getDrivers } from '../api'
import { lista } from '../../lib/lista'
import { hoyLocal } from '../../lib/fecha'
import TarjetaMercadillo from '../components/TarjetaMercadillo'

/* ── EL INICIO DE UNA EMPRESA QUE REPARTE (03-10-2026) ───────────────────────
   Un súper o un distribuidor abre el panel para saber UNA cosa: cómo va el
   reparto de hoy. No le sirven la disponibilidad de furgonetas por centro ni
   los cierres de turno de la portada de flota. Aquí, en este orden:
   · lo que tiene que hacer ahora (sin repartidor, sin ordenar, llegará tarde);
   · cuántos pedidos van y cómo van, con cada repartidor;
   · las dos últimas semanas y por qué no se entrega.
   Lo que falta por configurar sale ARRIBA, como la primera tarea: sin almacén
   la ruta no tiene de dónde salir. */

function Cifra({ icono: I, valor, texto, tono = 'text-dark-50', sub }) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
      <div className="flex items-center gap-1.5 text-[12px] text-dark-400"><I size={14} /> {texto}</div>
      <div className={`mt-1 font-display text-[30px] font-bold leading-none tabular-nums ${tono}`}>{valor}</div>
      {sub && <div className="mt-1 text-[11.5px] text-dark-500">{sub}</div>}
    </div>
  )
}

function Tarea({ to, icono: I, texto, accion, tono = 'border-amber-500/30 bg-amber-500/[.06] text-amber-200' }) {
  return (
    <Link to={to} className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] ${tono}`}>
      <span className="flex items-center gap-2"><I size={15} className="shrink-0" /> {texto}</span>
      <span className="flex shrink-0 items-center gap-1 font-semibold">{accion} <ArrowRight size={13} /></span>
    </Link>
  )
}

export default function InicioReparto({ sector }) {
  const [hoy, setHoy] = useState(null)
  const [est, setEst] = useState(null)
  const [vivos, setVivos] = useState([])
  const [aj, setAj] = useState(null)
  const [nRep, setNRep] = useState(null)
  const autonomo = sector === 'autonomo'

  useEffect(() => {
    let vivo = true
    const cargar = () => {
      getRepartoPedidos(hoyLocal()).then(({ data }) => vivo && setHoy(data)).catch(() => vivo && setHoy({ pedidos: [], conductores: [] }))
      getRepartoVivo().then(({ data }) => vivo && setVivos(lista(data?.conductores))).catch(() => {})
    }
    cargar()
    getRepartoEstadisticas(14).then(({ data }) => setEst(data)).catch(() => setEst(null))
    getRepartoAjustes().then(({ data }) => setAj(data)).catch(() => setAj({}))
    getDrivers().then(({ data }) => setNRep(lista(data?.drivers ?? data).filter((d) => d.active !== false).length)).catch(() => setNRep(null))
    // Cada minuto: es lo que cambia mientras se mira.
    const t = setInterval(cargar, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  const ps = lista(hoy?.pedidos)
  const n = useMemo(() => {
    const c = { total: ps.length, entregados: 0, fallidos: 0, pendientes: 0, sinRep: 0, sinOrden: 0, tarde: 0, urgentes: 0, bultos: 0 }
    for (const p of ps) {
      c.bultos += Number(p.bultos) || 1
      if (p.estado === 'entregado') c.entregados++
      else if (p.estado === 'fallido') c.fallidos++
      else {
        c.pendientes++
        if (!p.conductor_id) c.sinRep++
        else if (p.orden == null) c.sinOrden++
        if (p.tarde_min > 0) c.tarde++
        if (p.prioridad) c.urgentes++
      }
    }
    return c
  }, [ps])

  if (!hoy) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-dark-500" /></div>

  const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const maxDia = Math.max(1, ...lista(est?.por_dia).map((d) => d.total))
  const maxMotivo = Math.max(1, ...lista(est?.motivos).map((m) => m.n))

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(24px,3vw,32px)] font-bold text-dark-50">El reparto de hoy</h1>
          <p className="text-[13px] capitalize text-dark-400">{fecha}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/panel/reparto" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-[13px] font-semibold text-brand-tinta">
            {autonomo ? <><Route size={15} /> Mi ruta</> : <><Package size={15} /> Pedidos y mapa</>}
          </Link>
        </div>
      </header>

      {/* El mercadillo de repartidores (17-10-2026): solo si está abierto. */}
      <TarjetaMercadillo />

      {/* LO QUE TOCA HACER */}
      <div className="space-y-2">
        {aj && !aj.base?.lat && (
          <Tarea to="/panel/reparto" icono={MapPin} texto={autonomo ? 'Pon desde dónde sales cada día: la ruta se ordena desde ahí.' : 'Pon la dirección del almacén o la tienda: las rutas salen de ahí.'} accion="Ponerla" />
        )}
        {!autonomo && nRep === 0 && (
          <Tarea to="/panel/conductores" icono={Users} texto="Da de alta a tus repartidores (con su correo) para que tengan «Mi ruta» en el móvil." accion="Dar de alta" />
        )}
        {!autonomo && aj && lista(aj.zonas).length === 0 && nRep > 0 && (
          <Tarea to="/panel/reparto" icono={MapPin} texto="Crea las zonas de cada repartidor para repartir los pedidos con un clic." accion="Crear zonas" tono="border-dark-700 bg-dark-900 text-dark-200" />
        )}
        {n.sinRep > 0 && <Tarea to="/panel/reparto" icono={Users} texto={`${n.sinRep} pedido${n.sinRep > 1 ? 's' : ''} sin repartidor.`} accion="Repartir" />}
        {n.sinOrden > 0 && <Tarea to="/panel/reparto" icono={Route} texto={`${n.sinOrden} parada${n.sinOrden > 1 ? 's' : ''} sin ordenar en la ruta.`} accion="Ordenar" />}
        {n.tarde > 0 && (
          <Tarea to="/panel/reparto" icono={Clock} texto={`${n.tarde} pedido${n.tarde > 1 ? 's' : ''} llegará${n.tarde > 1 ? 'n' : ''} fuera del horario del cliente.`}
            accion="Revisar" tono="border-red-500/30 bg-red-500/[.06] text-red-200" />
        )}
        {n.urgentes > 0 && <Tarea to="/panel/reparto" icono={Zap} texto={`${n.urgentes} urgente${n.urgentes > 1 ? 's' : ''} sin entregar.`} accion="Ver" />}
      </div>

      {/* EL DÍA EN CIFRAS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra icono={Package} texto="Pedidos hoy" valor={n.total} sub={`${n.bultos} bultos`} />
        <Cifra icono={CheckCircle2} texto="Entregados" valor={n.entregados} tono="text-emerald-300"
          sub={n.total ? `${Math.round((100 * n.entregados) / n.total)} % del día` : null} />
        <Cifra icono={Clock} texto="Por entregar" valor={n.pendientes} />
        <Cifra icono={XCircle} texto="No entregados" valor={n.fallidos} tono={n.fallidos ? 'text-red-300' : 'text-dark-50'} />
      </div>

      {/* CADA REPARTIDOR */}
      {!autonomo && lista(hoy.conductores).length > 0 && (
        <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-dark-50"><Truck size={15} /> Cada repartidor</h2>
          <div className="space-y-3">
            {lista(hoy.conductores).map((r) => {
              const hechos = r.entregados + r.fallidos
              const enRuta = vivos.some((v) => v.conductor_id === r.conductor_id)
              return (
                <div key={r.conductor_id || 'sin'}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="font-semibold text-dark-100">
                      {r.conductor_id ? r.nombre : 'Sin repartidor'}
                      {enRuta && <span className="ml-2 text-[10.5px] font-bold text-emerald-300">● EN RUTA</span>}
                    </span>
                    <span className="text-dark-400">
                      {r.entregados} de {r.total} entregados{r.fallidos ? ` · ${r.fallidos} no` : ''}
                      {r.ruta?.fin ? ` · acaba ≈ ${r.ruta.fin}` : ''}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-dark-800" role="img"
                    aria-label={`${r.entregados} entregados, ${r.fallidos} no entregados, ${r.total - hechos} por entregar`}>
                    <div className="h-full bg-emerald-500" style={{ width: `${(100 * r.entregados) / Math.max(1, r.total)}%` }} />
                    {r.fallidos > 0 && <div className="ml-0.5 h-full bg-red-400" style={{ width: `${(100 * r.fallidos) / Math.max(1, r.total)}%` }} />}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] text-dark-500"><span className="text-emerald-300">■</span> entregado · <span className="text-red-300">■</span> no entregado · gris: por entregar</p>
        </section>
      )}

      {/* LAS DOS ÚLTIMAS SEMANAS */}
      {est && est.total > 0 && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[14px] font-bold text-dark-50">Pedidos por día · 14 días</h2>
              <span className="text-[12px] text-dark-400">
                {est.tasa_entrega != null ? <>Se entrega a la primera el <b className="text-dark-100">{est.tasa_entrega} %</b></> : 'Aún sin entregas cerradas'}
              </span>
            </div>
            <div className="flex h-36 items-end gap-1.5">
              {lista(est.por_dia).map((d) => (
                <div key={d.fecha} className="group relative flex h-full flex-1 flex-col justify-end"
                  title={`${d.fecha.slice(8)}/${d.fecha.slice(5, 7)}: ${d.total} pedidos, ${d.entregados} entregados, ${d.fallidos} no`}>
                  <div className="w-full rounded-t bg-sky-500/80 transition group-hover:bg-sky-400" style={{ height: `${(100 * d.total) / maxDia}%`, minHeight: d.total ? 3 : 0 }} />
                  <span className="mt-1 text-center text-[9.5px] text-dark-500">{Number(d.fecha.slice(8))}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-dark-50"><AlertTriangle size={15} /> Por qué no se entrega</h2>
            {lista(est.motivos).length === 0 ? <p className="text-[12.5px] text-dark-400">Ningún pedido sin entregar en estos días.</p> : (
              <div className="space-y-2">
                {lista(est.motivos).map((m) => (
                  <div key={m.motivo}>
                    <div className="flex justify-between text-[12.5px]"><span className="text-dark-200">{m.motivo}</span><b className="tabular-nums text-dark-100">{m.n}</b></div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-dark-800"><div className="h-full rounded-full bg-red-400/80" style={{ width: `${(100 * m.n) / maxMotivo}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* LA FLOTA, A UN CLIC: lo de siempre, pero detrás del reparto. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Tarea to="/panel/vehiculos" icono={Truck} texto="Vehículos e inspecciones" accion="Abrir" tono="border-dark-700 bg-dark-900 text-dark-200" />
        <Tarea to="/panel/vencimientos" icono={Clock} texto="ITV, seguro y renting" accion="Abrir" tono="border-dark-700 bg-dark-900 text-dark-200" />
        <Tarea to="/panel/incidencias" icono={AlertTriangle} texto="Golpes y averías" accion="Abrir" tono="border-dark-700 bg-dark-900 text-dark-200" />
      </div>
    </div>
  )
}
