import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Loader2, Plus, ClipboardPaste, Route, Shuffle, RefreshCw, Trash2, MapPin, ShieldCheck,
  Settings2, Package, EyeOff, X, Truck,
} from 'lucide-react'
import {
  getRepartoAjustes, guardarRepartoAjustes, getRepartoPedidos, crearRepartoPedido,
  pegarRepartoPedidos, editarRepartoPedido, borrarRepartoPedido, repartirPorZonas,
  ordenarRutas, getRepartoVivo, getDrivers, enlaceSeguimiento, fotoEntrega,
} from '../api'
import { lista } from '../../lib/lista'
import { hoyLocal } from '../../lib/fecha'
import { useToast } from '../../lib/toast'
import MapaReparto, { colorConductor } from '../components/MapaReparto'
import { getAdmin } from '../auth'
import { origen } from '../../marca'
import QRCode from 'qrcode'
import { usePlan } from '../../lib/usePlan'
import { IDIOMAS, idioma, cambiarIdioma, useIdioma, tx } from '../../lib/idioma'
import MiRuta, { ElegirNavegador } from '../../pages/driver/MiRuta'
import AjustesMovil from '../../pages/driver/AjustesMovil'
import { fijarPais, importe, simboloMoneda } from '../../lib/region'

/* ── REPARTO A DOMICILIO Y A NEGOCIOS ────────────────────────────────────────
   Para quien reparte su propia mercancía: el súper que lleva la compra a casa,
   el distribuidor que sirve a talleres. Los pedidos entran de tres formas
   —los mete la oficina, los pega de su programa o los escanea el conductor al
   cargar— y aquí se ve qué lleva cada uno, en qué orden y por dónde va.

   LO LEGAL, A LA VISTA: los datos de los clientes son de la empresa. Si quien
   mira es la plataforma (entrando como la empresa), salen tapados; la
   ubicación de los conductores solo existe mientras ellos tienen la jornada
   empezada; y los datos personales se borran solos a los días que se elijan. */

const ESTADOS = {
  pendiente: ['Pendiente', 'bg-dark-700 text-dark-200'],
  en_ruta: ['En ruta', 'bg-sky-500/15 text-sky-300'],
  entregado: ['Entregado', 'bg-emerald-500/15 text-emerald-300'],
  fallido: ['No entregado', 'bg-red-500/15 text-red-300'],
}
const inp = 'w-full rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 text-[13px] text-dark-100 placeholder:text-dark-500 focus:border-brand-500 focus:outline-none'
const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 text-[12.5px] font-semibold text-dark-200 hover:border-dark-500 disabled:opacity-40'
const btnP = 'inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-[12.5px] font-semibold text-brand-tinta hover:bg-brand-600 disabled:opacity-40'

const VACIO = { codigo: '', cliente: '', telefono: '', direccion: '', contenido: '', bultos: 1, conductor_id: '', horario: '', prioridad: false, cobrar: '', tipo: 'entrega' }
// En la moneda del país de la cuenta (llega con los pedidos: datos.pais).
const euros = (n) => importe(n)
const METODO = { efectivo: 'efectivo', tarjeta: 'tarjeta', bizum: 'Bizum', transferencia: 'transferencia', pagado: 'pagado' }

/* La caja del repartidor: lo cobrado por método, para cuadrar al volver. */
function caja(r) {
  const c = r?.cobrado || {}
  const total = Object.values(c).reduce((a, b) => a + b, 0)
  if (!total && !r?.a_cobrar) return ''
  return ` · cobrado ${euros(total)}${r.a_cobrar ? ` de ${euros(r.a_cobrar)}` : ''}`
}

/* «2 h 10 min · 18 km · acaba 13:40», o nada si la ruta aún no se ordenó. */
function manana(f) {
  const d = new Date(`${f}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function resumenRuta(r) {
  const ruta = r?.ruta
  if (!ruta?.minutos) return r?.km ? ` · ${r.km} km` : ''
  const h = Math.floor(ruta.minutos / 60)
  const m = ruta.minutos % 60
  return ` · ${h ? `${h} h ` : ''}${m} min · ${ruta.km} km · acaba ${ruta.fin}${ruta.tarde ? ` · ${ruta.tarde} min tarde` : ''}`
}

function Llegada({ p }) {
  const franja = p.ventana_desde && `${p.ventana_desde}–${p.ventana_hasta}`
  return (
    <div className="text-[12px]">
      {p.eta ? <b className={p.tarde_min ? 'text-red-300' : 'text-dark-100'}>≈ {p.eta}</b> : <span className="text-dark-500">—</span>}
      {p.prioridad && <span className="ml-1.5 rounded bg-amber-500/15 px-1 text-[10px] font-bold text-amber-300">URGENTE</span>}
      {p.tipo === 'recogida' && <span className="ml-1.5 rounded bg-violet-500/15 px-1 text-[10px] font-bold text-violet-300">RECOGIDA</span>}
      {p.cobrar > 0 && (
        <div className={`text-[11px] ${p.cobrado_metodo ? 'text-emerald-300' : 'text-dark-400'}`}>
          {p.cobrado_metodo ? `cobrado ${euros(p.cobrado_importe)} · ${METODO[p.cobrado_metodo] || p.cobrado_metodo}` : `a cobrar ${euros(p.cobrar)}`}
        </div>
      )}
      {franja && <div className="text-[11px] text-dark-500">franja {franja}</div>}
      {p.tarde_min > 0 && <div className="text-[11px] text-red-300">{p.tarde_min} min tarde</div>}
      {p.espera_min > 0 && <div className="text-[11px] text-dark-500">espera {p.espera_min} min</div>}
    </div>
  )
}

// Dónde dejó el repartidor el paquete (mismas claves que el servidor, reparto.DONDE_ENTREGA).
const DONDE_ENTREGA = { mano: 'En mano', vecino: 'Al vecino', buzon: 'En el buzón', porteria: 'En portería o recepción', seguro: 'En un lugar seguro' }

export default function Reparto() {
  const { center } = useOutletContext() || {}
  const toast = useToast()
  const { billing } = usePlan()
  const autonomo = billing?.sector === 'autonomo'
  const [pestana, setPestana] = useState(null)
  // El autónomo es la oficina y el repartidor: lo primero, su ruta.
  const vista = pestana || (autonomo ? 'ruta' : 'hoy')
  const [fecha, setFecha] = useState(hoyLocal())
  const [datos, setDatos] = useState(null)
  const [conductores, setConductores] = useState([])
  const [vivos, setVivos] = useState([])
  const [filtro, setFiltro] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [nuevo, setNuevo] = useState(null)
  const [pegado, setPegado] = useState(null)
  const [foto, setFoto] = useState(null)   // {foto, nota, cuando, cliente}

  const cargar = useCallback(() => {
    getRepartoPedidos(fecha).then(({ data }) => { fijarPais(data?.pais); setDatos(data) })
      .catch((e) => toast.error(e?.response?.data?.detail || 'No se pudieron cargar los pedidos'))
  }, [fecha, toast])
  useEffect(cargar, [cargar])
  useEffect(() => {
    getDrivers(center).then(({ data }) => setConductores(lista(data?.drivers ?? data)
      .filter((d) => d.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)))))
      .catch(() => {})
  }, [center])

  // Mientras se ubican las direcciones pegadas, se vuelve a mirar sola.
  useEffect(() => {
    if (!datos?.sin_ubicar) return undefined
    const t = setTimeout(cargar, 8000)
    return () => clearTimeout(t)
  }, [datos, cargar])

  // Los conductores en directo: solo hoy, cada 30 s.
  const esHoy = fecha === hoyLocal()
  useEffect(() => {
    if (!esHoy) { setVivos([]); return undefined }
    let vivo = true
    const leer = () => getRepartoVivo().then(({ data }) => vivo && setVivos(lista(data?.conductores))).catch(() => {})
    leer()
    const t = setInterval(leer, 30000)
    return () => { vivo = false; clearInterval(t) }
  }, [esHoy])

  const resumen = lista(datos?.conductores)
  const colorDe = useMemo(() => {
    const m = {}
    resumen.forEach((r, i) => { m[r.conductor_id] = r.conductor_id ? colorConductor(i) : '#64748b' })
    return m
  }, [resumen])
  const pedidos = useMemo(() => lista(datos?.pedidos)
    .filter((p) => filtro === null || (p.conductor_id || '') === filtro)
    .sort((a, b) => String(a.conductor_nombre).localeCompare(String(b.conductor_nombre))
      || (a.orden ?? 9999) - (b.orden ?? 9999)), [datos, filtro])
  const paradas = useMemo(() => pedidos.map((p) => ({
    lat: p.lat, lng: p.lng, estado: p.estado, orden: p.orden, color: colorDe[p.conductor_id || ''],
    etiqueta: p.orden ?? '·', titulo: p.cliente || p.direccion, sub: p.contenido,
  })), [pedidos, colorDe])
  const vivosMapa = useMemo(() => vivos.map((v) => ({ ...v, color: colorDe[v.conductor_id] || '#0ea5e9' })), [vivos, colorDe])

  async function accion(nombre, fn, ok) {
    setOcupado(nombre)
    try { const r = await fn(); if (ok) toast.success(ok(r.data)); cargar() } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo hacer')
    } finally { setOcupado('') }
  }

  async function guardarNuevo() {
    await accion('nuevo', () => crearRepartoPedido({ ...nuevo, fecha }), () => 'Pedido añadido')
    setNuevo(null)
  }

  async function previsualizar() {
    setOcupado('pegar')
    try {
      const { data } = await pegarRepartoPedidos({ texto: pegado.texto, fecha })
      setPegado({ ...pegado, filas: lista(data?.filas) })
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo leer') } finally { setOcupado('') }
  }
  async function confirmarPegado() {
    await accion('pegar', () => pegarRepartoPedidos({ texto: pegado.texto, fecha, confirmar: true }),
      (d) => `${d.creados} pedidos añadidos${d.repetidos ? ` · ${d.repetidos} ya estaban` : ''}. Ubicando direcciones…`)
    setPegado(null)
  }

  const tapado = datos && datos.ve_datos === false

  async function copiarEnlace(p) {
    try {
      const { data } = await enlaceSeguimiento(p.id)
      const url = `${window.location.origin}/s/${data.token}`
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado: el cliente ve la hora estimada, sin datos personales')
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo copiar el enlace') }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold text-dark-50">Reparto</h1>
          <p className="text-[12.5px] text-dark-400">Pedidos del día, quién los lleva, en qué orden y por dónde va cada conductor.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-dark-700 bg-dark-900 p-1">
          {[...(autonomo ? [['ruta', 'Mi ruta', Route]] : []),
            ['hoy', autonomo ? 'Mapa y pedidos' : 'Pedidos', Package],
            ['ajustes', autonomo ? 'Ajustes' : 'Zonas y ajustes', Settings2]].map(([k, t, I]) => (
            <button key={k} onClick={() => setPestana(k)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${vista === k ? 'bg-dark-700 text-dark-50' : 'text-dark-400'}`}>
              <I size={14} /> {t}
            </button>
          ))}
        </div>
      </header>

      {vista === 'ruta' ? <MiRuta embebido onBack={() => setPestana('hoy')} />
        : vista === 'ajustes' ? <Ajustes conductores={conductores} toast={toast} autonomo={autonomo} /> : (
        <>
          {tapado && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[.07] px-3.5 py-3 text-[12.5px] text-amber-200">
              <EyeOff size={15} className="mt-0.5 shrink-0" />
              Estás viendo esta empresa desde la plataforma. Los datos de sus clientes y la ubicación de sus
              conductores son suyos: salen tapados y no se pueden tocar.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value || hoyLocal())}
              style={{ width: 170 }} className={inp} aria-label="Día del reparto" />
            <button className={btnP} disabled={tapado} onClick={() => setNuevo({ ...VACIO })}><Plus size={14} /> Añadir pedido</button>
            <button className={btn} disabled={tapado} onClick={() => setPegado({ texto: '', filas: null })}><ClipboardPaste size={14} /> Pegar lista</button>
            {!autonomo && <button className={btn} disabled={!!ocupado || tapado}
              onClick={() => accion('zonas', () => repartirPorZonas(fecha), (d) => `${d.asignados} pedidos asignados por zona`)}>
              {ocupado === 'zonas' ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />} Repartir por zonas
            </button>}
            <button className={btn} disabled={!!ocupado || tapado}
              onClick={() => accion('ordenar', () => ordenarRutas(fecha), (d) => `${d.ordenados} paradas ordenadas por tiempo en ${d.conductores} rutas${(d.rutas || []).some((r) => r.fuente === 'linea_recta') ? ' (sin servidor de rutas: por distancia)' : ''}`)}>
              {ocupado === 'ordenar' ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />} Ordenar rutas
            </button>
            <button className={btn} onClick={cargar} aria-label="Recargar"><RefreshCw size={14} /></button>
            {datos?.sin_ubicar > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-dark-400">
                <Loader2 size={13} className="animate-spin" /> Ubicando {datos.sin_ubicar} direcciones…
              </span>
            )}
          </div>

          {!datos ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" /></div> : (
            <>
              <div className="flex flex-wrap gap-2">
                <Chip activo={filtro === null} onClick={() => setFiltro(null)} color="#94a3b8"
                  titulo="Todos" sub={`${lista(datos.pedidos).length} pedidos`} />
                {resumen.map((r) => (
                  <Chip key={r.conductor_id || 'sin'} activo={filtro === (r.conductor_id || '')}
                    onClick={() => setFiltro(filtro === (r.conductor_id || '') ? null : (r.conductor_id || ''))}
                    color={colorDe[r.conductor_id || '']}
                    titulo={r.conductor_id ? r.nombre : 'Sin conductor'}
                    sub={`${r.entregados}/${r.total} entregados${r.fallidos ? ` · ${r.fallidos} fallidos` : ''}${resumenRuta(r)}${caja(r)}`}
                    vivo={vivos.some((v) => v.conductor_id === r.conductor_id)} />
                ))}
              </div>

              <MapaReparto paradas={paradas} base={datos.base} vivos={vivosMapa} />
              <p className="-mt-2 text-right text-[10.5px] text-dark-500">
                Tiempos por carretera: OSRM (FOSSGIS) con datos de © OpenStreetMap · tráfico típico por hora, no en tiempo real ·{' '}
                <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer" className="underline">corregir el mapa</a>
              </p>

              {pedidos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-dark-700 px-4 py-10 text-center text-[13px] text-dark-400">
                  No hay pedidos este día. Añádelos a mano, pega la lista de tu programa, o deja que los
                  conductores los escaneen al cargar desde su móvil (portal del conductor → «Mi ruta»).
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-dark-700">
                  <table className="w-full min-w-[820px] text-left text-[12.5px]">
                    <thead className="bg-dark-900 text-[11px] uppercase tracking-wide text-dark-500">
                      <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Pedido</th><th className="px-3 py-2">Dirección</th>
                        <th className="px-3 py-2">Lleva</th><th className="px-3 py-2">Llega</th><th className="px-3 py-2">Conductor</th><th className="px-3 py-2">Estado</th><th /></tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800">
                      {pedidos.map((p) => (
                        <tr key={p.id} className="align-top">
                          <td className="px-3 py-2">
                            <span className="inline-block h-5 min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5 text-white"
                              style={{ background: colorDe[p.conductor_id || ''] }}>{p.orden ?? '·'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-dark-100">{p.cliente || '—'}</div>
                            <div className="text-dark-500">{p.codigo || 'sin código'}{p.telefono ? ` · ${p.telefono}` : ''}</div>
                          </td>
                          <td className="px-3 py-2 text-dark-200">
                            {p.direccion}
                            <div className="text-[11px] text-dark-500">
                              {p.zona && `${p.zona} · `}
                              {p.geo === 'no' ? <span className="text-amber-300">sin ubicar en el mapa</span>
                                : p.geo === 'pendiente' ? 'ubicando…' : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-dark-300">{p.contenido || '—'}<div className="text-[11px] text-dark-500">{p.bultos} bulto{p.bultos > 1 ? 's' : ''}{p.escaneos ? ` · ${p.escaneos} escaneado${p.escaneos > 1 ? 's' : ''}` : ''}</div></td>
                          <td className="whitespace-nowrap px-3 py-2"><Llegada p={p} /></td>
                          <td className="px-3 py-2">
                            <select className={`${inp} py-1.5`} value={p.conductor_id || ''} disabled={tapado}
                              aria-label="Conductor"
                              onChange={(e) => accion('c', () => editarRepartoPedido(p.id, { conductor_id: e.target.value }))}>
                              <option value="">Sin conductor</option>
                              {/* El suyo aunque no salga en la lista (otro centro, de baja):
                                  sin esto el selector decía «Sin conductor» y mentía. */}
                              {p.conductor_id && !conductores.some((c) => c.id === p.conductor_id) && (
                                <option value={p.conductor_id}>{p.conductor_nombre || 'Otro conductor'}</option>
                              )}
                              {conductores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADOS[p.estado]?.[1] || ''}`}>{ESTADOS[p.estado]?.[0] || p.estado}</span>
                            {p.motivo && <div className="mt-1 text-[11px] text-dark-500">{p.motivo}</div>}
                            {p.reintento > 0 && <div className="mt-1 text-[11px] text-dark-500">{p.reintento}º intento</div>}
                            {p.entrega_donde && <div className="mt-1 text-[11px] text-dark-300">{DONDE_ENTREGA[p.entrega_donde] || ''}</div>}
                            {p.entrega_nota && <div className="mt-1 text-[11px] text-dark-400">«{p.entrega_nota}»</div>}
                            {p.tiene_foto && !tapado && (
                              <button className="mt-1 block text-[11.5px] font-semibold text-brand-300"
                                onClick={async () => {
                                  try { const { data } = await fotoEntrega(p.id); setFoto({ ...data, cliente: p.cliente || p.direccion }) } catch { toast.error('No se pudo abrir la foto') }
                                }}>Ver prueba de entrega</button>
                            )}
                            {p.estado === 'fallido' && !tapado && (
                              <button className="mt-1 block text-[11.5px] font-semibold text-brand-300"
                                onClick={() => accion('r', () => editarRepartoPedido(p.id, { fecha: manana(fecha) }), () => 'Pasado a mañana')}>
                                Reintentar mañana
                              </button>
                            )}
                            {['pendiente', 'en_ruta'].includes(p.estado) && !tapado && (
                              <button className="mt-1 block text-[11.5px] font-semibold text-dark-400 hover:text-brand-300"
                                onClick={() => copiarEnlace(p)}>Copiar enlace para el cliente</button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button className="rounded p-1 text-dark-500 hover:text-red-300" aria-label="Borrar pedido" disabled={tapado}
                              onClick={() => window.confirm('¿Borrar este pedido?') && accion('b', () => borrarRepartoPedido(p.id), () => 'Borrado')}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {foto && (
        <Ventana titulo={`Entrega · ${foto.cliente}`} onClose={() => setFoto(null)}>
          {foto.foto && <img src={foto.foto} alt="Prueba de entrega" className="mx-auto max-h-[70vh] rounded-lg" />}
          {(foto.donde || foto.recibe) && (
            <p className="mt-2 text-[13px] text-dark-200">{[foto.donde, foto.recibe && `Lo recoge: ${foto.recibe}`].filter(Boolean).join(' · ')}</p>
          )}
          {foto.firma && <img src={foto.firma} alt="Firma" className="mt-2 w-full max-w-xs rounded-lg bg-white" />}
          {foto.nota && <p className="mt-2 text-[13px] text-dark-200">«{foto.nota}»</p>}
          {foto.cuando && <p className="mt-1 text-[11.5px] text-dark-500">{new Date(foto.cuando).toLocaleString('es-ES')}</p>}
        </Ventana>
      )}

      {nuevo && (
        <Ventana titulo="Añadir pedido" onClose={() => setNuevo(null)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inp} placeholder="Código del ticket o pedido (opcional)" value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })} />
            <input className={inp} placeholder="Cliente o negocio" value={nuevo.cliente} onChange={(e) => setNuevo({ ...nuevo, cliente: e.target.value })} />
            <input className={`${inp} sm:col-span-2`} placeholder="Dirección completa (calle, número, piso, CP y población)" value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} />
            <input className={inp} placeholder="Teléfono" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
            <input className={inp} type="number" min="1" max="99" placeholder="Bultos" value={nuevo.bultos} onChange={(e) => setNuevo({ ...nuevo, bultos: e.target.value })} />
            <input className={`${inp} sm:col-span-2`} placeholder="Qué lleva (3 cajas, agua, leche…)" value={nuevo.contenido} onChange={(e) => setNuevo({ ...nuevo, contenido: e.target.value })} />
            <input className={inp} placeholder="Horario del cliente (ej. de 10 a 12)" value={nuevo.horario} onChange={(e) => setNuevo({ ...nuevo, horario: e.target.value })} />
            <label className="flex items-center gap-2 text-[13px] text-dark-200">
              <input type="checkbox" checked={nuevo.prioridad} onChange={(e) => setNuevo({ ...nuevo, prioridad: e.target.checked })} /> Urgente (congelados, medicinas…)
            </label>
            <input className={inp} inputMode="decimal" placeholder={`A cobrar en la entrega (${simboloMoneda()})`} value={nuevo.cobrar} onChange={(e) => setNuevo({ ...nuevo, cobrar: e.target.value })} />
            <select className={inp} value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} aria-label="Tipo de parada">
              <option value="entrega">Entrega</option>
              <option value="recogida">Recogida (envases, devolución)</option>
            </select>
            <select className={`${inp} sm:col-span-2`} value={nuevo.conductor_id} onChange={(e) => setNuevo({ ...nuevo, conductor_id: e.target.value })} aria-label="Conductor">
              <option value="">Conductor: el de su zona (o ninguno)</option>
              {conductores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex justify-end">
            <button className={btnP} disabled={ocupado === 'nuevo' || nuevo.direccion.trim().length < 4} onClick={guardarNuevo}>
              {ocupado === 'nuevo' && <Loader2 size={14} className="animate-spin" />} Guardar
            </button>
          </div>
        </Ventana>
      )}

      {pegado && (
        <Ventana titulo="Pegar la lista del día" onClose={() => setPegado(null)}>
          <p className="mb-2 text-[12px] text-dark-400">
            Copia de tu programa o de Excel y pega aquí. Si la primera fila tiene títulos (Código, Cliente,
            Dirección, Teléfono, Lleva, Bultos…) se leen por nombre; si no, se espera ese orden separado por
            tabuladores o «;». Una línea con solo la dirección también vale.
          </p>
          <textarea className={`${inp} h-40 font-mono text-[12px]`} value={pegado.texto}
            onChange={(e) => setPegado({ texto: e.target.value, filas: null })}
            placeholder={'Código;Cliente;Dirección;Teléfono;Lleva\n0012345;Ana López;Rúa Real 5, 2ºB, 15003 A Coruña;600111222;3 cajas y agua'} />
          {pegado.filas && (
            <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-dark-700 text-[12px]">
              {pegado.filas.map((f, i) => (
                <div key={i} className="border-b border-dark-800 px-3 py-1.5 text-dark-300">
                  <b className="text-dark-100">{f.cliente || '—'}</b> · {f.direccion}{f.contenido ? ` · ${f.contenido}` : ''}{f.codigo ? ` · ${f.codigo}` : ''}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button className={btn} disabled={!pegado.texto.trim() || ocupado === 'pegar'} onClick={previsualizar}>Ver qué entiende</button>
            <button className={btnP} disabled={!pegado.filas?.length || ocupado === 'pegar'} onClick={confirmarPegado}>
              {ocupado === 'pegar' && <Loader2 size={14} className="animate-spin" />} Añadir {pegado.filas?.length || ''} pedidos
            </button>
          </div>
        </Ventana>
      )}
    </div>
  )
}

function Chip({ activo, onClick, color, titulo, sub, vivo }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${activo ? 'border-brand-500 bg-brand-500/10' : 'border-dark-700 bg-dark-900'}`}>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span>
        <span className="block text-[12.5px] font-semibold text-dark-100">{titulo}{vivo && <span className="ml-1.5 text-[10px] font-bold text-emerald-300">● EN RUTA</span>}</span>
        <span className="block text-[11px] text-dark-500">{sub}</span>
      </span>
    </button>
  )
}

function Ventana({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full max-w-xl rounded-2xl border border-dark-700 bg-dark-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-dark-50">{titulo}</h2>
          <button onClick={onClose} className="rounded p-1 text-dark-400" aria-label="Cerrar"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── ZONAS Y AJUSTES ─────────────────────────────────────────────────────── */
export function Ajustes({ conductores, toast, autonomo }) {
  const lang = useIdioma()
  const [a, setA] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    getRepartoAjustes().then(({ data }) => setA({
      ...data,
      base_direccion: data?.base?.direccion || '',
      zonas: lista(data?.zonas).map((z) => ({ ...z, cps: lista(z.cps).join(', '), palabras: lista(z.palabras).join(', ') })),
    })).catch(() => setA({ zonas: [], base_direccion: '', dias_conservar: 30, portal: true }))
  }, [])

  if (!a) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" /></div>
  const zona = (i, cambios) => setA({ ...a, zonas: a.zonas.map((z, j) => (j === i ? { ...z, ...cambios } : z)) })

  async function guardar() {
    setGuardando(true)
    try {
      const { data } = await guardarRepartoAjustes({
        base_direccion: a.base_direccion, zonas: a.zonas, ia_tickets: !!a.ia_tickets,
        dias_conservar: a.dias_conservar, portal: a.portal !== false,
        hora_salida: a.hora_salida, min_parada: a.min_parada, min_bulto: a.min_bulto,
        volver: !!a.volver, trafico: a.trafico !== false,
        ...(a.pais ? { pais: a.pais, zona_horaria: a.zona_horaria } : {}),
      })
      setA({ ...a, base: data.base, portal_activo: data.portal_activo })
      toast.success('Guardado')
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo guardar') } finally { setGuardando(false) }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {a.paises && (
          <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
            <h2 className="mb-1 text-[14px] font-bold text-dark-50">País y hora</h2>
            <p className="mb-2 text-[12px] text-dark-400">Las direcciones se buscan en este país y las horas de llegada van en esta zona horaria.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inp} aria-label="País" value={a.pais || 'es'}
                onChange={(e) => setA({ ...a, pais: e.target.value, zona_horaria: (a.paises[e.target.value]?.zonas || [])[0] })}>
                {Object.entries(a.paises).sort((x, y) => x[1].nombre.localeCompare(y[1].nombre, 'es')).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
              <select className={inp} aria-label="Zona horaria" value={a.zona_horaria || ''}
                onChange={(e) => setA({ ...a, zona_horaria: e.target.value })}>
                {(a.paises[a.pais || 'es']?.zonas || []).map((z) => <option key={z} value={z}>{z.split('/').pop().replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </section>
        )}
        {autonomo && (
          <section className="space-y-3 rounded-xl border border-dark-700 bg-dark-900 p-4">
            <label className="flex items-center justify-between gap-3 text-[14px] font-semibold text-dark-100">
              🌐 {tx('Idioma')}
              <select value={lang || idioma()} onChange={(e) => cambiarIdioma(e.target.value)} aria-label={tx('Idioma')}
                className="rounded-xl border border-dark-700 bg-dark-950 px-3 py-2 text-[14px] text-dark-50">
                {Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <ElegirNavegador />
            <div className="border-t border-dark-700 pt-3"><AjustesMovil /></div>
          </section>
        )}
        <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-dark-50"><MapPin size={15} /> {autonomo ? 'Desde dónde sales' : 'Almacén o tienda'}</h2>
          <p className="mb-2 text-[12px] text-dark-400">{autonomo ? 'Tu nave, almacén o casa: la ruta se ordena desde aquí (o desde donde estés al pulsar «Montar ruta»).' : 'De aquí salen las rutas: se ordenan empezando por el punto más cercano a esta dirección.'}</p>
          <input className={inp} value={a.base_direccion} onChange={(e) => setA({ ...a, base_direccion: e.target.value })}
            placeholder="Avda. de Montero Ríos 1, 15001 A Coruña" />
          {a.base?.lat != null && <p className="mt-1 text-[11px] text-emerald-300">Ubicado en el mapa ✓</p>}
        </section>

        {!autonomo && <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <h2 className="mb-1 text-[14px] font-bold text-dark-50">Zonas</h2>
          <p className="mb-3 text-[12px] text-dark-400">
            Cada repartidor con su zona. Un pedido cae en una zona por su código postal o por una palabra de la
            dirección (calle, barrio, pueblo). Con «Repartir por zonas» cada pedido va al conductor de su zona.
          </p>
          <div className="space-y-2">
            {a.zonas.map((z, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-dark-700 p-2.5 sm:grid-cols-[1fr_1fr_auto]">
                <input className={inp} placeholder="Nombre de la zona" value={z.nombre} onChange={(e) => zona(i, { nombre: e.target.value })} />
                <select className={inp} value={z.conductor_id || ''} onChange={(e) => zona(i, { conductor_id: e.target.value })} aria-label="Conductor de la zona">
                  <option value="">Sin conductor fijo</option>
                  {conductores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="rounded p-2 text-dark-500 hover:text-red-300" aria-label="Quitar zona"
                  onClick={() => setA({ ...a, zonas: a.zonas.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                <input className={inp} placeholder="Códigos postales: 15001, 15003" value={z.cps} onChange={(e) => zona(i, { cps: e.target.value })} />
                <input className={`${inp} sm:col-span-2`} placeholder="Calles o barrios: Montero Ríos, Orzán" value={z.palabras} onChange={(e) => zona(i, { palabras: e.target.value })} />
              </div>
            ))}
          </div>
          <button className={`${btn} mt-2`} onClick={() => setA({ ...a, zonas: [...a.zonas, { nombre: '', conductor_id: '', cps: '', palabras: '' }] })}>
            <Plus size={14} /> Añadir zona
          </button>
        </section>}

        <section className="space-y-3 rounded-xl border border-dark-700 bg-dark-900 p-4">
          <h2 className="text-[14px] font-bold text-dark-50">Cómo se calcula la ruta</h2>
          <p className="text-[12px] text-dark-400">
            Se ordena por el TIEMPO que se tarda por carretera, contando el tráfico típico de cada hora, el rato en
            cada portal y el horario de cada cliente. Cada parada lleva su hora estimada de llegada.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-dark-200">
            <label className="flex items-center gap-2">Salida a las
              <input type="time" style={{ width: 110 }} className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-dark-100"
                value={a.hora_salida || '09:00'} onChange={(e) => setA({ ...a, hora_salida: e.target.value })} /></label>
            <label className="flex items-center gap-2">Minutos en cada parada
              <input type="number" min="1" max="30" style={{ width: 64 }} className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-dark-100"
                value={a.min_parada ?? 4} onChange={(e) => setA({ ...a, min_parada: e.target.value })} /></label>
            <label className="flex items-center gap-2">+ por cada bulto de más
              <input type="number" min="0" max="10" style={{ width: 64 }} className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-dark-100"
                value={a.min_bulto ?? 1} onChange={(e) => setA({ ...a, min_bulto: e.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2.5 text-[13px] text-dark-200">
            <input type="checkbox" checked={a.trafico !== false} onChange={(e) => setA({ ...a, trafico: e.target.checked })} />
            Contar el tráfico típico de cada hora (horas punta de mañana, mediodía y tarde)
          </label>
          <label className="flex items-center gap-2.5 text-[13px] text-dark-200">
            <input type="checkbox" checked={!!a.volver} onChange={(e) => setA({ ...a, volver: e.target.checked })} />
            La ruta termina volviendo al almacén
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-dark-700 bg-dark-900 p-4">
          {!autonomo && <label className="flex items-start gap-2.5 text-[13px] text-dark-200">
            <input type="checkbox" className="mt-1" checked={a.portal !== false} onChange={(e) => setA({ ...a, portal: e.target.checked })} />
            <span><b>«Mi ruta» en el móvil de los conductores</b><br />
              <span className="text-[12px] text-dark-400">Escanean los bultos al cargar, ven su ruta en orden y marcan las entregas.</span></span>
          </label>}
          {/* A quien reparte solo no se le enseña desactivada (17-10-2026): le hablaba de «el conductor» y le decía
              que escribe la dirección a mano, cuando la foto a la etiqueta ya se lee en su móvil. */}
          {(!autonomo || a.ia_disponible) && <label className={`flex items-start gap-2.5 text-[13px] text-dark-200 ${a.ia_disponible ? '' : 'opacity-60'}`}>
            <input type="checkbox" className="mt-1" disabled={!a.ia_disponible} checked={!!a.ia_tickets && !!a.ia_disponible}
              onChange={(e) => setA({ ...a, ia_tickets: e.target.checked })} />
            <span><b>Leer el ticket con IA</b> cuando el código no está en la lista<br />
              <span className="text-[12px] text-dark-400">
                {a.ia_disponible
                  ? 'La foto se envía al proveedor de IA solo para leer dirección, teléfono y contenido, y no se guarda. Actívalo si tu empresa lo acepta como responsable de esos datos; si no, el conductor la escribe a mano.'
                  : 'Todavía no disponible: se activará cuando la IA funcione con un contrato que garantice que no se usan tus datos para entrenarla. Mientras, el conductor escribe la dirección a mano.'}
              </span></span>
          </label>}
          <label className="block text-[13px] text-dark-200">
            <span className="flex flex-wrap items-center gap-2">
              <b>Borrar los datos de los clientes a los</b>
              <input type="number" min="1" max="90" style={{ width: 80 }}
                className="rounded-lg border border-dark-700 bg-dark-900 px-2 py-1 text-[13px] text-dark-100 focus:border-brand-500 focus:outline-none"
                value={a.dias_conservar ?? 30} onChange={(e) => setA({ ...a, dias_conservar: e.target.value })} />
              <b>días</b>
            </span>
            <span className="mt-1 block text-[12px] text-dark-400">Pasado ese plazo se borran nombre, teléfono, dirección y contenido; quedan los números para las estadísticas.</span>
          </label>
        </section>

        <button className={btnP} onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 size={14} className="animate-spin" />} Guardar ajustes
        </button>
      </div>

      <div className="space-y-4">
      {!autonomo && <PortalRepartidores />}
      {!autonomo && <aside className="h-fit rounded-xl border border-emerald-500/25 bg-emerald-500/[.05] p-4 text-[12.5px] leading-relaxed text-dark-300">
        <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-emerald-200"><ShieldCheck size={15} /> Cómo se protegen los datos</h2>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Los datos de tus clientes son <b>de tu empresa</b>. La plataforma los guarda por encargo tuyo y no los ve: si soporte entra en tu cuenta, salen tapados.</li>
          <li>Cada conductor ve <b>solo sus pedidos</b>, con lo justo para entregar (dirección, teléfono y qué lleva).</li>
          <li>La <b>ubicación del conductor</b> solo se comparte entre «Empezar jornada» y «Terminar jornada», después de que él lea y acepte el aviso. Fuera de la jornada no se guarda nada, y el recorrido se borra a los 30 días.</li>
          <li>Los datos de clientes se borran solos a los días que elijas.</li>
          <li>Las direcciones se ubican en el mapa con OpenStreetMap, enviando solo la dirección, nunca el nombre ni el teléfono.</li>
          <li>Tu empresa debe informar a sus clientes de que el reparto lo gestiona con esta herramienta (en su política de privacidad), y a sus conductores de la ubicación en jornada.</li>
        </ul>
      </aside>}
      </div>
    </div>
  )
}

/* EL ENLACE PARA LOS REPARTIDORES. Sin esto la oficina no sabe cómo llegan
   ellos a «Mi ruta»: se les pasa este enlace (o el QR) por WhatsApp, entran
   con el correo que tengan en su ficha de Conductores, y listo. */
function PortalRepartidores() {
  const slug = getAdmin()?.slug
  const enlace = `${origen()}/conductor${slug ? `/${slug}` : ''}`
  const [qr, setQr] = useState('')
  useEffect(() => { QRCode.toDataURL(enlace, { margin: 1, width: 132 }).then(setQr).catch(() => setQr('')) }, [enlace])
  const texto = `Para el reparto, entra aquí desde el móvil con tu correo: ${enlace}`
  return (
    <section className="rounded-xl border border-dark-700 bg-dark-900 p-4 text-[12.5px] text-dark-300">
      <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-dark-50"><Truck size={15} /> Tus repartidores, al móvil</h2>
      <ol className="mb-3 list-decimal space-y-1 pl-4">
        <li>Dalos de alta en <a href="/panel/conductores" className="text-brand-300">Conductores</a> con su correo.</li>
        <li>Pásales este enlace; entran con ese correo y les sale «Mi ruta».</li>
      </ol>
      <div className="flex items-center gap-3">
        {qr && <img src={qr} alt="QR del portal de repartidores" width={96} height={96} className="rounded bg-white p-1" />}
        <div className="min-w-0">
          <code className="block break-all text-[11.5px] text-dark-200">{enlace}</code>
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"
            className="mt-2 inline-block rounded-lg bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white">Enviar por WhatsApp</a>
        </div>
      </div>
    </section>
  )
}
