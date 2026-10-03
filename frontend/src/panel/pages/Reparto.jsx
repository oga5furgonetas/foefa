import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Loader2, Plus, ClipboardPaste, Route, Shuffle, RefreshCw, Trash2, MapPin, ShieldCheck,
  Settings2, Package, EyeOff, X,
} from 'lucide-react'
import {
  getRepartoAjustes, guardarRepartoAjustes, getRepartoPedidos, crearRepartoPedido,
  pegarRepartoPedidos, editarRepartoPedido, borrarRepartoPedido, repartirPorZonas,
  ordenarRutas, getRepartoVivo, getDrivers,
} from '../api'
import { lista } from '../../lib/lista'
import { hoyLocal } from '../../lib/fecha'
import { useToast } from '../../lib/toast'
import MapaReparto, { colorConductor } from '../components/MapaReparto'

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
const btnP = 'inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-40'

const VACIO = { codigo: '', cliente: '', telefono: '', direccion: '', contenido: '', bultos: 1, conductor_id: '' }

export default function Reparto() {
  const { center } = useOutletContext() || {}
  const toast = useToast()
  const [pestana, setPestana] = useState('hoy')
  const [fecha, setFecha] = useState(hoyLocal())
  const [datos, setDatos] = useState(null)
  const [conductores, setConductores] = useState([])
  const [vivos, setVivos] = useState([])
  const [filtro, setFiltro] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [nuevo, setNuevo] = useState(null)
  const [pegado, setPegado] = useState(null)

  const cargar = useCallback(() => {
    getRepartoPedidos(fecha).then(({ data }) => setDatos(data))
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

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold text-dark-50">Reparto</h1>
          <p className="text-[12.5px] text-dark-400">Pedidos del día, quién los lleva, en qué orden y por dónde va cada conductor.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-dark-700 bg-dark-900 p-1">
          {[['hoy', 'Pedidos', Package], ['ajustes', 'Zonas y ajustes', Settings2]].map(([k, t, I]) => (
            <button key={k} onClick={() => setPestana(k)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${pestana === k ? 'bg-dark-700 text-dark-50' : 'text-dark-400'}`}>
              <I size={14} /> {t}
            </button>
          ))}
        </div>
      </header>

      {pestana === 'ajustes' ? <Ajustes conductores={conductores} toast={toast} /> : (
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
            <button className={btn} disabled={!!ocupado || tapado}
              onClick={() => accion('zonas', () => repartirPorZonas(fecha), (d) => `${d.asignados} pedidos asignados por zona`)}>
              {ocupado === 'zonas' ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />} Repartir por zonas
            </button>
            <button className={btn} disabled={!!ocupado || tapado}
              onClick={() => accion('ordenar', () => ordenarRutas(fecha), (d) => `${d.ordenados} paradas ordenadas en ${d.conductores} rutas`)}>
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
                    sub={`${r.entregados}/${r.total} entregados${r.fallidos ? ` · ${r.fallidos} fallidos` : ''}${r.km ? ` · ${r.km} km` : ''}`}
                    vivo={vivos.some((v) => v.conductor_id === r.conductor_id)} />
                ))}
              </div>

              <MapaReparto paradas={paradas} base={datos.base} vivos={vivosMapa} />

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
                        <th className="px-3 py-2">Lleva</th><th className="px-3 py-2">Conductor</th><th className="px-3 py-2">Estado</th><th /></tr>
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

      {nuevo && (
        <Ventana titulo="Añadir pedido" onClose={() => setNuevo(null)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inp} placeholder="Código del ticket o pedido (opcional)" value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })} />
            <input className={inp} placeholder="Cliente o negocio" value={nuevo.cliente} onChange={(e) => setNuevo({ ...nuevo, cliente: e.target.value })} />
            <input className={`${inp} sm:col-span-2`} placeholder="Dirección completa (calle, número, piso, CP y población)" value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} />
            <input className={inp} placeholder="Teléfono" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
            <input className={inp} type="number" min="1" max="99" placeholder="Bultos" value={nuevo.bultos} onChange={(e) => setNuevo({ ...nuevo, bultos: e.target.value })} />
            <input className={`${inp} sm:col-span-2`} placeholder="Qué lleva (3 cajas, agua, leche…)" value={nuevo.contenido} onChange={(e) => setNuevo({ ...nuevo, contenido: e.target.value })} />
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
function Ajustes({ conductores, toast }) {
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
      })
      setA({ ...a, base: data.base, portal_activo: data.portal_activo })
      toast.success('Guardado')
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo guardar') } finally { setGuardando(false) }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-dark-50"><MapPin size={15} /> Almacén o tienda</h2>
          <p className="mb-2 text-[12px] text-dark-400">De aquí salen las rutas: se ordenan empezando por el punto más cercano a esta dirección.</p>
          <input className={inp} value={a.base_direccion} onChange={(e) => setA({ ...a, base_direccion: e.target.value })}
            placeholder="Avda. de Montero Ríos 1, 15001 A Coruña" />
          {a.base?.lat != null && <p className="mt-1 text-[11px] text-emerald-300">Ubicado en el mapa ✓</p>}
        </section>

        <section className="rounded-xl border border-dark-700 bg-dark-900 p-4">
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
        </section>

        <section className="space-y-3 rounded-xl border border-dark-700 bg-dark-900 p-4">
          <label className="flex items-start gap-2.5 text-[13px] text-dark-200">
            <input type="checkbox" className="mt-1" checked={a.portal !== false} onChange={(e) => setA({ ...a, portal: e.target.checked })} />
            <span><b>«Mi ruta» en el móvil de los conductores</b><br />
              <span className="text-[12px] text-dark-400">Escanean los bultos al cargar, ven su ruta en orden y marcan las entregas.</span></span>
          </label>
          <label className={`flex items-start gap-2.5 text-[13px] text-dark-200 ${a.ia_disponible ? '' : 'opacity-60'}`}>
            <input type="checkbox" className="mt-1" disabled={!a.ia_disponible} checked={!!a.ia_tickets && !!a.ia_disponible}
              onChange={(e) => setA({ ...a, ia_tickets: e.target.checked })} />
            <span><b>Leer el ticket con IA</b> cuando el código no está en la lista<br />
              <span className="text-[12px] text-dark-400">
                {a.ia_disponible
                  ? 'La foto se envía al proveedor de IA solo para leer dirección, teléfono y contenido, y no se guarda. Actívalo si tu empresa lo acepta como responsable de esos datos; si no, el conductor la escribe a mano.'
                  : 'Todavía no disponible: se activará cuando la IA funcione con un contrato que garantice que no se usan tus datos para entrenarla. Mientras, el conductor escribe la dirección a mano.'}
              </span></span>
          </label>
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

      <aside className="h-fit rounded-xl border border-emerald-500/25 bg-emerald-500/[.05] p-4 text-[12.5px] leading-relaxed text-dark-300">
        <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-emerald-200"><ShieldCheck size={15} /> Cómo se protegen los datos</h2>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Los datos de tus clientes son <b>de tu empresa</b>. La plataforma los guarda por encargo tuyo y no los ve: si soporte entra en tu cuenta, salen tapados.</li>
          <li>Cada conductor ve <b>solo sus pedidos</b>, con lo justo para entregar (dirección, teléfono y qué lleva).</li>
          <li>La <b>ubicación del conductor</b> solo se comparte entre «Empezar jornada» y «Terminar jornada», después de que él lea y acepte el aviso. Fuera de la jornada no se guarda nada, y el recorrido se borra a los 30 días.</li>
          <li>Los datos de clientes se borran solos a los días que elijas.</li>
          <li>Las direcciones se ubican en el mapa con OpenStreetMap, enviando solo la dirección, nunca el nombre ni el teléfono.</li>
          <li>Tu empresa debe informar a sus clientes de que el reparto lo gestiona con esta herramienta (en su política de privacidad), y a sus conductores de la ubicación en jornada.</li>
        </ul>
      </aside>
    </div>
  )
}
