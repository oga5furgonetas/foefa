import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ScanLine, Camera, Loader2, Navigation, Phone, Check, X, Route, MapPin, Play, Square, Package,
  MessageCircle, Clock, Search, List, Map as MapaIcono, ArrowUp, ArrowDown, ArrowUpDown, Mic, ClipboardPaste, Trophy,
} from 'lucide-react'
import {
  repMiRuta, repEscanear, repLeerTicket, repNuevoPedido, repEstado, repOrdenar, repJornada, repPosicion,
  repMiOrden, repMiEditar, repPegarMiLista,
} from '../../services/api'
import { lista } from '../../lib/lista'
import { compressImage } from '../../lib/compressImage'
import { origen } from '../../marca'
import { leerTicketEnMovil } from '../../lib/leerTicket'

/* ── MI RUTA ────────────────────────────────────────────────────────────────
   Lo que hace el repartidor al cargar: escanea el código de la caja. Si el
   pedido ya está en la lista de la oficina, entra en su ruta con la dirección
   y lo que lleva; el segundo bulto del mismo pedido lo reconoce. Si no está
   (el ticket de caja no está en ningún sistema), una foto del ticket y la IA
   lee la dirección —si la empresa lo tiene activado—, o la escribe a mano.

   UBICACIÓN: solo entre «Empezar jornada» y «Terminar jornada», y la primera
   vez se le explica qué se ve, quién y cuánto dura (art. 90 LOPDGDD). Nada en
   segundo plano a escondidas: mientras se comparte, se dice arriba. */

const inp = 'w-full rounded-xl border border-dark-700 bg-dark-900 px-3 py-2.5 text-[15px] text-dark-50 placeholder:text-dark-500 focus:border-brand-500 focus:outline-none'
const MOTIVOS = ['No había nadie', 'Dirección incorrecta', 'Rechazado', 'Fuera de horario', 'Otro']
const VACIO = { codigo: '', cliente: '', telefono: '', direccion: '', contenido: '', bultos: 1, notas: '', horario: '', prioridad: false, cobrar: '', tipo: 'entrega', hueco: '' }

/* WhatsApp solo para móviles españoles (6 o 7 y nueve cifras): a un fijo no
   llega, y un botón que abre WhatsApp para nada es peor que no tenerlo. */
function movilWhatsApp(tel) {
  const d = String(tel || '').replace(/\D/g, '').replace(/^0034/, '').replace(/^34(?=\d{9}$)/, '')
  return /^[67]\d{8}$/.test(d) ? `34${d}` : ''
}
/* El mensaje lleva la hora estimada y el enlace de seguimiento (sin datos
   personales). Sin enlace, el mensaje de siempre. */
function mensaje(p, empresa) {
  const quien = empresa ? `el repartidor de ${empresa}` : 'el repartidor'
  const que = p.tipo === 'recogida' ? 'a hacer la recogida' : 'con su pedido'
  const cuando = p.eta ? `, llegada aproximada a las ${p.eta}` : ''
  const enlace = p.seguimiento ? ` Puede seguirlo aquí: ${origen()}/s/${p.seguimiento}` : ''
  return `Hola, soy ${quien}. Voy de camino ${que}${cuando}.${enlace}`
}
const euros = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`

function minutosATexto(m) {
  const h = Math.floor(m / 60)
  return `${h ? `${h} h ` : ''}${m % 60} min`
}

// El mapa (Leaflet) pesa: solo se descarga si se abre la vista de mapa.
const MapaReparto = lazy(() => import('../../panel/components/MapaReparto'))

/* Con qué navega cada uno: Google Maps o Waze. Se recuerda en el móvil. */
const NAVEGADORES = [['google', 'Google Maps'], ['waze', 'Waze']]
function navegar(p, nav) {
  if (nav === 'waze') {
    return p.lat != null
      ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(p.direccion || '')}&navigate=yes`
  }
  return p.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.direccion || '')}`
}

/* DÓNDE VA EN LA FURGONETA (como el «package finder» de Circuit): al cargar
   se dice en qué zona se deja; al llegar a la parada se sabe dónde buscar. */
const HUECOS = ['Delante · izq', 'Delante · der', 'Medio · izq', 'Medio · der', 'Detrás · izq', 'Detrás · der']

const lee = (k, def) => { try { return localStorage.getItem(k) || def } catch { return def } }
const guarda = (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: da igual */ } }
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const porOrden = (a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9)

/* Dictar la dirección: el reconocimiento de voz del propio navegador (Chrome
   en Android lo tiene). Donde no existe, no sale el botón. */
const Reconocedor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export default function MiRuta({ onBack, embebido = false }) {
  const [ruta, setRuta] = useState(null)
  const [err, setErr] = useState('')
  const [aviso, setAviso] = useState('')
  const [escaner, setEscaner] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nuevo, setNuevo] = useState(null)
  const [ocupado, setOcupado] = useState('')
  const [verAviso, setVerAviso] = useState(false)
  const [fallo, setFallo] = useState(null)
  const [cobro, setCobro] = useState(null)
  // {p, pago}: la hoja de «foto de la entrega» antes de dar por entregado.
  const [prueba, setPrueba] = useState(null)
  const [notaEntrega, setNotaEntrega] = useState('')
  const [vista, setVista] = useState(() => lee('ruta_vista', 'lista'))
  const [nav, setNav] = useState(() => lee('ruta_nav', 'google'))
  const [filtro, setFiltro] = useState('')
  const [reordenar, setReordenar] = useState(null)   // null | [ids] mientras se cambia a mano
  const [huecoDe, setHuecoDe] = useState(null)       // la parada a la que se le dice dónde va
  const [pegar, setPegar] = useState(null)           // null | {texto, n}
  const [escuchando, setEscuchando] = useState(false)
  useEffect(() => guarda('ruta_vista', vista), [vista])
  useEffect(() => guarda('ruta_nav', nav), [nav])

  const cargar = useCallback(() => {
    repMiRuta().then(({ data }) => setRuta(data))
      .catch((e) => setErr(e?.response?.data?.detail || 'No se pudo cargar tu ruta'))
  }, [])
  useEffect(cargar, [cargar])

  const jornadaAbierta = !!(ruta?.jornada?.empezada && !ruta?.jornada?.terminada)

  // Mandar la posición SOLO con la jornada abierta, como mucho cada 45 s.
  useEffect(() => {
    if (!jornadaAbierta || !('geolocation' in navigator)) return undefined
    let ultima = 0
    const id = navigator.geolocation.watchPosition((pos) => {
      const ahora = Date.now()
      if (ahora - ultima < 45000) return
      ultima = ahora
      repPosicion(pos.coords.latitude, pos.coords.longitude).catch(() => {})
    }, () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [jornadaAbierta])

  async function jornada(accion, acepto) {
    setOcupado('jornada')
    try {
      await repJornada(accion, acepto)
      setVerAviso(false)
      cargar()
    } catch (e) {
      if (e?.response?.status === 428) setVerAviso(true)
      else setAviso(e?.response?.data?.detail || 'No se pudo')
    } finally { setOcupado('') }
  }

  async function buscar(c) {
    const cod = String(c || '').trim()
    if (!cod) return
    setEscaner(false); setOcupado('buscar'); setAviso('')
    try {
      const { data } = await repEscanear(cod)
      if (data.encontrado) {
        const p = data.pedido
        setAviso(`✓ ${p.cliente || p.direccion} · bulto ${p.escaneos} de ${p.bultos}${p.hueco ? ` · va ${p.hueco}` : ''}`)
        if (navigator.vibrate) navigator.vibrate(80)
        setCodigo('')
        cargar()
      } else {
        setNuevo({ ...VACIO, codigo: data.codigo })
      }
    } catch (e) { setAviso(e?.response?.data?.detail || 'No se pudo buscar') } finally { setOcupado('') }
  }

  /* El código de barras de la etiqueta, de la misma foto: así una foto da
     el código Y la dirección. Si el móvil no sabe leer códigos, nada. */
  async function codigoDeFoto(blob) {
    try {
      if (!('BarcodeDetector' in window)) return ''
      const soportados = await window.BarcodeDetector.getSupportedFormats()
      const quiero = ['code_128', 'ean_13', 'ean_8', 'qr_code', 'code_39', 'itf', 'upc_a', 'upc_e', 'data_matrix', 'codabar'].filter((f) => soportados.includes(f))
      const det = new window.BarcodeDetector({ formats: quiero })
      const bmp = await createImageBitmap(blob)
      const codigos = await det.detect(bmp)
      return codigos.find((c) => c.rawValue)?.rawValue || ''
    } catch { return '' }
  }

  async function leerTicket(file) {
    if (!file) return
    setOcupado('ticket')
    try {
      // Con IA en el servidor solo si la empresa la tiene permitida (clave de
      // pago); si no, se lee EN EL MÓVIL y la foto no sale de aquí.
      const blob = await compressImage(file, 1600, 0.85)
      const [data, codigoFoto] = await Promise.all([
        ruta?.ia_tickets
          ? repLeerTicket(new File([blob], 'ticket.jpg', { type: 'image/jpeg' })).then((r) => r.data)
          : leerTicketEnMovil(blob),
        codigoDeFoto(blob),
      ])
      if (codigoFoto && !data.codigo) data.codigo = codigoFoto
      const algo = data?.direccion || data?.telefono || data?.cliente
      if (!algo) setAviso('No he podido leer el ticket. Prueba con más luz y el ticket recto, o escríbelo.')
      setNuevo((n) => ({
        ...n, ...Object.fromEntries(Object.entries(data || {}).filter(([, v]) => v !== '' && v != null)),
        codigo: n?.codigo || data?.codigo || '', de_ticket: true,
        direccion: [data?.direccion, data?.cp, data?.localidad].filter(Boolean).join(', ') || n?.direccion || '',
      }))
    } catch (e) { setAviso(e?.response?.data?.detail || 'No se pudo leer el ticket') } finally { setOcupado('') }
  }

  // «Cargar paquetes»: una foto tras otra, y al acabar «Montar ruta».
  const [carga, setCarga] = useState(null)   // null | {n}

  async function guardarNuevo() {
    setOcupado('guardar')
    try {
      await repNuevoPedido(nuevo)
      setNuevo(null); setCodigo('')
      cargar()
      if (carga) { setCarga({ n: carga.n + 1 }); setAviso('') } else setAviso('✓ Añadido a tu ruta')
    } catch (e) { setAviso(e?.response?.data?.detail || 'No se pudo guardar') } finally { setOcupado('') }
  }

  async function marcar(p, estado, motivo, pago, extra) {
    // Con importe a cobrar, antes de dar por entregado hay que decir cómo pagó.
    if (estado === 'entregado' && p.cobrar > 0 && !pago) { setCobro(p); return }
    // Y después, la prueba de entrega (foto y/o nota), que se puede saltar.
    if (estado === 'entregado' && !extra) { setCobro(null); setPrueba({ p, pago: pago || null }); setNotaEntrega(''); return }
    setOcupado(p.id)
    try { await repEstado(p.id, estado, motivo, { ...(pago || {}), ...(extra || {}) }); setFallo(null); setCobro(null); setPrueba(null); cargar() } catch (e) {
      setAviso(e?.response?.data?.detail || 'No se pudo guardar')
    } finally { setOcupado('') }
  }

  async function ordenar() {
    setOcupado('ordenar')
    const fin = async (punto) => {
      try {
        const { data } = await repOrdenar(punto)
        const rr = data.ruta
        const n = data.ordenados
        const paradas = `${n} parada${n === 1 ? '' : 's'}`
        setAviso(rr?.fin
          ? `Ruta ordenada por tiempo: ${paradas}, acabas ≈ ${rr.fin}${rr.fuente === 'linea_recta' ? ' (sin servidor de rutas: calculada por distancia)' : ''}`
          : `Ruta ordenada: ${paradas}`)
        cargar()
      } catch (e) {
        setAviso(e?.response?.data?.detail || 'No se pudo ordenar')
      } finally { setOcupado('') }
    }
    if (!('geolocation' in navigator)) return fin(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => fin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => fin(null), { timeout: 8000, maximumAge: 60000 })
  }

  // Dónde estoy ahora (si el móvil lo dice en 8 s); si no, desde el almacén.
  const posicion = () => new Promise((ok) => {
    if (!('geolocation' in navigator)) { ok(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => ok({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => ok(null), { timeout: 8000, maximumAge: 60000 })
  })

  async function guardarOrden() {
    setOcupado('orden')
    try {
      const { data } = await repMiOrden(reordenar, await posicion())
      setReordenar(null)
      setAviso(data.ruta?.fin ? `Orden guardado. Con este orden acabas ≈ ${data.ruta.fin}` : 'Orden guardado')
      cargar()
    } catch (e) { setAviso(e?.response?.data?.detail || 'No se pudo guardar el orden') } finally { setOcupado('') }
  }

  function mover(i, d) {
    setReordenar((ids) => {
      const j = i + d
      if (j < 0 || j >= ids.length) return ids
      const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }

  async function ponerHueco(p, hueco) {
    setOcupado(`hueco-${p.id}`)
    try { await repMiEditar(p.id, { hueco }); setHuecoDe(null); cargar() } catch (e) {
      setAviso(e?.response?.data?.detail || 'No se pudo guardar')
    } finally { setOcupado('') }
  }

  function dictar() {
    if (!Reconocedor || escuchando) return
    const r = new Reconocedor()
    r.lang = 'es-ES'; r.interimResults = false; r.maxAlternatives = 1
    r.onresult = (ev) => {
      const dicho = ev.results?.[0]?.[0]?.transcript || ''
      if (dicho) setNuevo((n) => ({ ...n, direccion: dicho }))
    }
    r.onerror = (ev) => setAviso(ev.error === 'not-allowed' ? 'Dale permiso al micrófono para dictar.' : 'No te he entendido. Prueba otra vez o escríbelo.')
    r.onend = () => setEscuchando(false)
    setEscuchando(true)
    try { r.start() } catch { setEscuchando(false) }
  }

  async function pegarLista(confirmar) {
    setOcupado('pegar')
    try {
      const { data } = await repPegarMiLista(pegar.texto, confirmar)
      if (!confirmar) { setPegar({ ...pegar, n: data.n }); return }
      setPegar(null)
      const n = data.creados
      setAviso(`✓ ${n} parada${n === 1 ? '' : 's'} añadida${n === 1 ? '' : 's'}${data.repetidos ? ` (${data.repetidos} ya estaban)` : ''}. Se están situando en el mapa (≈ ${Math.max(1, n)} s); luego «Ordenar ruta».`)
      cargar()
      // Se van ubicando en el servidor a una por segundo: se recarga al acabar.
      setTimeout(cargar, Math.min(60, n + 3) * 1000)
    } catch (e) { setAviso(e?.response?.data?.detail || 'No se pudo leer la lista') } finally { setOcupado('') }
  }

  if (err) return <Marco onBack={onBack} embebido={embebido}><p className="text-red-300">{err}</p></Marco>
  if (!ruta) return <Marco onBack={onBack} embebido={embebido}><div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" /></div></Marco>
  if (!ruta.activo) return <Marco onBack={onBack} embebido={embebido}><p className="text-dark-400">Tu empresa no usa el reparto por aquí.</p></Marco>

  const pendientes = lista(ruta.pedidos).filter((p) => !['entregado', 'fallido'].includes(p.estado)).sort(porOrden)
  const hechos = lista(ruta.pedidos).filter((p) => ['entregado', 'fallido'].includes(p.estado))
  const total = pendientes.length + hechos.length
  const entregados = hechos.filter((p) => p.estado === 'entregado')
  const q = sinTildes(filtro.trim())
  const visibles = q
    ? pendientes.filter((p) => sinTildes([p.cliente, p.direccion, p.telefono, p.codigo, p.contenido, p.notas].join(' ')).includes(q))
    : pendientes
  const siguiente = pendientes[0]
  const porId = Object.fromEntries(pendientes.map((p) => [p.id, p]))

  return (
    <Marco onBack={onBack} embebido={embebido}>
      {/* JORNADA Y UBICACIÓN. El autónomo no tiene oficina que le siga: a él
          no se le pide compartir nada. */}
      {ruta.autonomo ? null : jornadaAbierta ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/[.07] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-[12.5px] text-emerald-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> En jornada · la oficina ve tu ubicación
          </span>
          <button onClick={() => jornada('terminar')} disabled={ocupado === 'jornada'}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-200">
            <Square size={12} /> Terminar
          </button>
        </div>
      ) : (
        <button onClick={() => (ruta.aviso_aceptado ? jornada('empezar') : setVerAviso(true))} disabled={ocupado === 'jornada'}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dark-700 bg-dark-900 py-3 text-[14px] font-semibold text-dark-100">
          <Play size={15} /> {ruta.jornada?.terminada ? 'Volver a empezar la jornada' : 'Empezar jornada'}
        </button>
      )}

      {/* ESCANEAR */}
      <div className="rounded-2xl border border-brand-400/40 bg-brand-500/[.08] p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEscaner(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-white active:scale-[.99]">
            <ScanLine size={19} /> Escanear
          </button>
          {/* La etiqueta del paquete trae dirección y teléfono: con una foto
              entra en la ruta sin que nadie haya metido la lista antes. Es lo
              que usa el autónomo que carga sus paquetes y sale. */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-400/60 py-3.5 text-[15px] font-bold text-brand-200 active:scale-[.99]">
            {ocupado === 'ticket' ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />} Foto etiqueta
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'ticket'}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setNuevo({ ...VACIO }); leerTicket(f) } }} />
          </label>
        </div>
        <div className="mt-2.5 flex gap-2">
          <input className={inp} value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="text"
            placeholder="o escribe el código" onKeyDown={(e) => e.key === 'Enter' && buscar(codigo)} />
          <button onClick={() => buscar(codigo)} disabled={!codigo.trim() || ocupado === 'buscar'}
            className="shrink-0 rounded-xl border border-dark-600 px-4 text-[14px] font-semibold text-dark-100 disabled:opacity-40">
            {ocupado === 'buscar' ? <Loader2 size={15} className="animate-spin" /> : 'Buscar'}
          </button>
        </div>
        <button onClick={() => setNuevo({ ...VACIO })} className="mt-2 text-[12.5px] font-semibold text-brand-300">
          + Añadir un pedido sin código
        </button>
        {ruta.autonomo && (
          <button onClick={() => setCarga({ n: 0 })}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/10 py-3 text-[14px] font-bold text-amber-200">
            <Package size={17} /> Cargar paquetes: uno tras otro
          </button>
        )}
        {ruta.puede_pegar && (
          <button onClick={() => setPegar({ texto: '', n: null })}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dark-600 py-2.5 text-[13.5px] font-semibold text-dark-100">
            <ClipboardPaste size={16} /> Pegar una lista de direcciones
          </button>
        )}
      </div>

      {aviso && (
        <button onClick={() => setAviso('')} className="mt-3 w-full rounded-xl border border-dark-700 bg-dark-900 px-3.5 py-2.5 text-left text-[13px] text-dark-100">
          {aviso}
        </button>
      )}

      {/* EL DÍA DE UN VISTAZO: cuántas van y cuánto falta. */}
      {total > 0 && (
        <div className="mt-4 rounded-2xl border border-dark-700 bg-dark-900 px-3.5 py-3" aria-label="Progreso del día">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] text-dark-300"><b className="text-[18px] text-dark-50">{hechos.length}</b> de {total} paradas</span>
            <span className="text-[12px] text-dark-400">
              {entregados.length} {entregados.length === 1 ? 'hecha' : 'hechas'}{hechos.length - entregados.length > 0 && ` · ${hechos.length - entregados.length} sin hacer`}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-dark-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((hechos.length / total) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* FIN DE LA RUTA: el resumen del día, como al cerrar un bloque. */}
      {total > 0 && pendientes.length === 0 && <Resumen hechos={hechos} ruta={ruta.ruta} />}

      {/* LA RUTA */}
      <div className="mb-2 mt-5 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-dark-50">{pendientes.length} por entregar</h2>
        {!reordenar && (
          <div className="flex gap-1.5">
            {pendientes.length > 1 && (
              <button onClick={() => { setReordenar(pendientes.map((p) => p.id)); setVista('lista') }}
                className="inline-flex items-center gap-1 rounded-lg border border-dark-700 px-2 py-1.5 text-[12.5px] font-semibold text-dark-200">
                <ArrowUpDown size={13} /> A mano
              </button>
            )}
            <button onClick={ordenar} disabled={!pendientes.length || ocupado === 'ordenar'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-dark-200 disabled:opacity-40">
              {ocupado === 'ordenar' ? <Loader2 size={13} className="animate-spin" /> : <Route size={13} />} Ordenar ruta
            </button>
          </div>
        )}
      </div>
      {ruta.ruta?.fin && pendientes.length > 0 && !reordenar && (
        <p className="mb-2 flex flex-wrap items-center gap-x-2 rounded-xl bg-dark-900 px-3 py-2 text-[12.5px] text-dark-300">
          <Clock size={13} className="text-brand-300" />
          <span>Acabas ≈ <b className="text-dark-50">{ruta.ruta.fin}</b></span>
          <span>· {minutosATexto(ruta.ruta.minutos)} · {ruta.ruta.km} km</span>
          <span className="text-dark-500">· {ruta.ruta.manual ? 'tu orden' : ruta.ruta.fuente === 'linea_recta' ? 'por distancia' : ruta.ruta.trafico ? 'con tráfico típico' : 'sin tráfico'}</span>
          {ruta.ruta.tarde > 0 && <span className="text-red-300">· {ruta.ruta.tarde} min tarde en alguna franja</span>}
        </p>
      )}

      {/* CAMBIAR EL ORDEN A MANO: el repartidor conoce la zona mejor que nadie. */}
      {reordenar && (
        <div className="rounded-2xl border border-brand-400/40 bg-dark-900 p-3">
          <p className="mb-2 text-[12.5px] text-dark-300">Sube o baja cada parada. Al guardar se recalculan las horas con tu orden.</p>
          <ol className="flex flex-col gap-1.5">
            {reordenar.map((id, i) => {
              const p = porId[id]
              if (!p) return null
              return (
                <li key={id} className="flex items-center gap-2 rounded-xl border border-dark-700 px-2.5 py-2">
                  <span className="w-6 text-center text-[13px] font-bold text-brand-200">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-dark-50">{p.cliente || p.direccion}</span>
                    {p.cliente && <span className="block truncate text-[12px] text-dark-400">{p.direccion}</span>}
                  </span>
                  <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${p.cliente || p.direccion}`}
                    className="rounded-lg border border-dark-700 p-2 text-dark-200 disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button onClick={() => mover(i, 1)} disabled={i === reordenar.length - 1} aria-label={`Bajar ${p.cliente || p.direccion}`}
                    className="rounded-lg border border-dark-700 p-2 text-dark-200 disabled:opacity-30"><ArrowDown size={15} /></button>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
            <button onClick={() => setReordenar(null)} className="rounded-xl border border-dark-600 py-2.5 text-[14px] text-dark-200">Cancelar</button>
            <button onClick={guardarOrden} disabled={ocupado === 'orden'}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
              {ocupado === 'orden' && <Loader2 size={15} className="animate-spin" />} Guardar este orden
            </button>
          </div>
        </div>
      )}

      {!reordenar && pendientes.length > 0 && (
        <div className="mb-2.5 flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-dark-700 p-0.5" role="group" aria-label="Vista">
            {[['lista', 'Lista', List], ['mapa', 'Mapa', MapaIcono]].map(([k, t, I]) => (
              <button key={k} onClick={() => setVista(k)} aria-pressed={vista === k}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12.5px] font-semibold ${vista === k ? 'bg-dark-700 text-dark-50' : 'text-dark-400'}`}>
                <I size={13} /> {t}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1 text-[12px] text-dark-400">
            Ir con
            <select value={nav} onChange={(e) => setNav(e.target.value)} aria-label="Navegador"
              className="rounded-lg border border-dark-700 bg-dark-900 px-1.5 py-1 text-[12.5px] text-dark-100">
              {NAVEGADORES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
        </div>
      )}

      {!reordenar && vista === 'mapa' && pendientes.length > 0 && (
        <div className="mb-3">
          <Suspense fallback={<div className="flex h-[340px] items-center justify-center rounded-xl border border-dark-700"><Loader2 className="animate-spin text-dark-500" /></div>}>
            <MapaReparto alto={340} base={ruta.base}
              paradas={lista(ruta.pedidos).map((p, i) => ({
                lat: p.lat, lng: p.lng, estado: p.estado, orden: p.orden, color: '#0ea5e9',
                etiqueta: p.orden ?? i + 1, titulo: p.cliente || p.direccion, sub: p.eta ? `≈ ${p.eta} · ${p.direccion}` : p.direccion,
              }))} />
          </Suspense>
          {pendientes.some((p) => p.lat == null) && (
            <p className="mt-1.5 text-[12px] text-amber-200/90">
              {pendientes.filter((p) => p.lat == null).length} sin situar en el mapa todavía (la dirección no se ha encontrado o se está buscando).
            </p>
          )}
        </div>
      )}

      {!reordenar && pendientes.length > 5 && (
        <div className="relative mb-2.5">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input className={`${inp} pl-9`} value={filtro} onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar cliente, calle, teléfono…" aria-label="Buscar en la ruta" />
        </div>
      )}

      {pendientes.length === 0 && total === 0 && (
        <p className="rounded-xl border border-dashed border-dark-700 px-4 py-6 text-center text-[13px] text-dark-400">
          {ruta.autonomo
            ? 'Escanea cada paquete o hazle una foto a la etiqueta: la dirección y el teléfono entran solos. Luego «Ordenar ruta».'
            : 'Escanea los bultos según los cargas y se irán poniendo aquí.'}
        </p>
      )}
      {q && visibles.length === 0 && <p className="py-4 text-center text-[13px] text-dark-400">Nada con «{filtro.trim()}» en las paradas pendientes.</p>}
      {!reordenar && (
      <div className="flex flex-col gap-2.5">
        {visibles.map((p, i) => {
          const esSiguiente = siguiente && p.id === siguiente.id
          return (
          <div key={p.id} className={`rounded-2xl border p-3.5 ${esSiguiente ? 'border-brand-400/70 bg-brand-500/[.07] shadow-lg shadow-brand-900/20' : 'border-dark-700 bg-dark-900'}`}>
            {esSiguiente && <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-300">Siguiente parada</p>}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[13px] font-bold text-white">{p.orden ?? i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={`${esSiguiente ? 'text-[17px]' : 'text-[15px]'} font-semibold text-dark-50`}>{p.cliente || 'Cliente'}</p>
                  {p.eta && <span className={`shrink-0 text-[13px] font-bold ${p.tarde_min ? 'text-red-300' : 'text-brand-200'}`}>≈ {p.eta}</span>}
                </div>
                {(p.prioridad || p.ventana_desde || p.tarde_min > 0 || p.tipo === 'recogida' || p.cobrar > 0) && (
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                    {p.prioridad && <span className="rounded bg-amber-500/15 px-1.5 font-bold text-amber-300">URGENTE</span>}
                    {p.tipo === 'recogida' && <span className="rounded bg-violet-500/15 px-1.5 font-bold text-violet-300">RECOGIDA</span>}
                    {p.cobrar > 0 && <span className="rounded bg-emerald-500/15 px-1.5 font-bold text-emerald-300">COBRAR {euros(p.cobrar)}</span>}
                    {p.ventana_desde && <span className="rounded bg-dark-800 px-1.5 text-dark-300">Horario {p.ventana_desde}–{p.ventana_hasta}</span>}
                    {p.tarde_min > 0 && <span className="rounded bg-red-500/15 px-1.5 text-red-300">llega {p.tarde_min} min tarde</span>}
                  </div>
                )}
                <p className={`${esSiguiente ? 'text-[14px]' : 'text-[13px]'} leading-snug text-dark-300`}>{p.direccion}</p>
                {p.telefono && <p className="text-[12.5px] text-dark-400">{p.telefono}</p>}
                {p.contenido && <p className="mt-1 flex items-start gap-1 text-[12.5px] text-dark-400"><Package size={13} className="mt-0.5 shrink-0" /> {p.contenido}</p>}
                <p className="mt-0.5 text-[11.5px] text-dark-500">
                  {p.bultos} bulto{p.bultos > 1 ? 's' : ''}{p.escaneos ? ` · ${p.escaneos} escaneado${p.escaneos > 1 ? 's' : ''}` : ''}
                  {p.lat == null && ' · sin ubicar en el mapa'}{p.notas && ` · ${p.notas}`}
                </p>
                <button onClick={() => setHuecoDe(p)}
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold ${p.hueco ? 'bg-sky-500/15 text-sky-200' : 'border border-dashed border-dark-700 text-dark-400'}`}>
                  <Package size={12} /> {p.hueco ? `En la furgoneta: ${p.hueco}` : '¿Dónde va en la furgoneta?'}
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <a href={navegar(p, nav)} target="_blank" rel="noreferrer"
                className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] ${esSiguiente ? 'bg-brand-500 font-bold text-white' : 'border border-dark-700 text-dark-200'}`}><Navigation size={16} /> Ir</a>
              {p.telefono
                ? <a href={`tel:${p.telefono}`} className="flex flex-col items-center gap-0.5 rounded-xl border border-dark-700 py-2 text-[11px] text-dark-200"><Phone size={16} /> Llamar</a>
                : <span className="flex flex-col items-center gap-0.5 rounded-xl border border-dark-800 py-2 text-[11px] text-dark-600"><Phone size={16} /> Sin teléfono</span>}
              {movilWhatsApp(p.telefono)
                ? <a href={`https://wa.me/${movilWhatsApp(p.telefono)}?text=${encodeURIComponent(mensaje(p, ruta.empresa))}`} target="_blank" rel="noreferrer"
                    className="flex flex-col items-center gap-0.5 rounded-xl border border-emerald-600/50 py-2 text-[11px] text-emerald-300"><MessageCircle size={16} /> WhatsApp</a>
                : <span className="flex flex-col items-center gap-0.5 rounded-xl border border-dark-800 py-2 text-[11px] text-dark-600"><MessageCircle size={16} /> —</span>}
            </div>
            <div className="mt-1.5 grid grid-cols-[1fr_2fr] gap-1.5">
              <button onClick={() => setFallo(p)} disabled={ocupado === p.id} className="flex items-center justify-center gap-1 rounded-xl border border-red-500/30 py-2.5 text-[13px] text-red-300"><X size={15} /> {p.tipo === 'recogida' ? 'No recogido' : 'No entregado'}</button>
              <button onClick={() => marcar(p, 'entregado')} disabled={ocupado === p.id} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-[14px] font-semibold text-white">
                {ocupado === p.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {p.tipo === 'recogida' ? 'Recogido' : 'Entregado'}
              </button>
            </div>
          </div>
          )
        })}
      </div>
      )}
      {hechos.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] text-dark-400">{hechos.length} hechos hoy</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {hechos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-dark-800 px-3 py-2 text-[12.5px]">
                <span className="truncate text-dark-300">{p.cliente || p.direccion}</span>
                <span className={`shrink-0 ${p.estado === 'entregado' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {p.estado === 'entregado' ? `Entregado${p.cobrado_importe ? ` · ${euros(p.cobrado_importe)}` : ''}` : `No · ${p.motivo || ''}`}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {huecoDe && (
        <Hoja titulo="¿Dónde va en la furgoneta?" onClose={() => setHuecoDe(null)}>
          <p className="mb-3 text-[13px] text-dark-400">{huecoDe.cliente || huecoDe.direccion}. Al llegar sabrás dónde buscarlo.</p>
          <HuecoRejilla valor={huecoDe.hueco} ocupado={ocupado === `hueco-${huecoDe.id}`} onElegir={(h) => ponerHueco(huecoDe, h)} />
          {huecoDe.hueco && (
            <button onClick={() => ponerHueco(huecoDe, '')} className="mt-3 w-full rounded-xl border border-dark-600 py-2.5 text-[13.5px] text-dark-200">Quitar</button>
          )}
        </Hoja>
      )}

      {pegar && (
        <Hoja titulo="Pegar una lista de direcciones" onClose={() => setPegar(null)}>
          <p className="mb-2 text-[13px] text-dark-400">
            Una parada por línea (de un correo, un Excel, un WhatsApp…). Si hay columnas con cabecera (dirección, cliente, teléfono, horario…), se leen.
          </p>
          <textarea className={`${inp} h-40 font-mono text-[13px]`} value={pegar.texto} aria-label="Lista de direcciones"
            onChange={(e) => setPegar({ texto: e.target.value, n: null })}
            placeholder={'Calle Mayor 3, 28013 Madrid\nAvenida de la Constitución 12, Sevilla'} />
          {pegar.n == null ? (
            <button onClick={() => pegarLista(false)} disabled={pegar.texto.trim().length < 5 || ocupado === 'pegar'}
              className="mt-3 w-full rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-white disabled:opacity-40">
              {ocupado === 'pegar' ? 'Leyendo…' : 'Revisar'}
            </button>
          ) : (
            <button onClick={() => pegarLista(true)} disabled={ocupado === 'pegar'}
              className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-[15px] font-bold text-white disabled:opacity-40">
              {ocupado === 'pegar' ? 'Añadiendo…' : `Añadir ${pegar.n} parada${pegar.n === 1 ? '' : 's'} a mi ruta`}
            </button>
          )}
        </Hoja>
      )}

      {escaner && <Escaner onCodigo={buscar} onClose={() => setEscaner(false)} />}

      {carga && !nuevo && (
        <Hoja titulo={carga.n ? `${carga.n} paquete${carga.n > 1 ? 's' : ''} cargado${carga.n > 1 ? 's' : ''}` : 'Cargar paquetes'} onClose={() => setCarga(null)}>
          <p className="mb-3 text-[13px] text-dark-400">
            Haz una foto a la etiqueta de cada paquete: se lee el código, la dirección y el teléfono. Al acabar, «Montar ruta».
          </p>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-[16px] font-bold text-white">
            {ocupado === 'ticket' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {ocupado === 'ticket' ? 'Leyendo…' : carga.n ? 'Siguiente paquete' : 'Primer paquete'}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'ticket'}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setNuevo({ ...VACIO }); leerTicket(f) } }} />
          </label>
          <button onClick={() => { setNuevo({ ...VACIO }) }} className="mt-2 w-full rounded-xl border border-dark-600 py-3 text-[14px] font-semibold text-dark-100">
            Escribirlo a mano
          </button>
          <button onClick={() => { setCarga(null); if (pendientes.length) ordenar() }} disabled={ocupado === 'ordenar'}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-3.5 text-[15px] font-bold text-white disabled:opacity-50">
            {carga.n || pendientes.length ? <><Route size={16} className="mr-1 inline" /> Montar ruta y empezar</> : 'Cerrar'}
          </button>
        </Hoja>
      )}

      {nuevo && (
        <Hoja titulo={nuevo.codigo ? `El código ${nuevo.codigo} no está en la lista` : 'Pedido nuevo'} onClose={() => setNuevo(null)}>
          <label className="mb-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-white">
            {ocupado === 'ticket' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {ocupado === 'ticket' ? 'Leyendo el ticket…' : 'Foto del ticket'}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'ticket'}
              onChange={(e) => { leerTicket(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <p className="mb-3 text-center text-[11.5px] text-dark-500">
            {ruta.ia_tickets ? 'Lo lee la IA y la foto no se guarda.' : 'Se lee en tu móvil: la foto no se envía a ningún sitio. La primera vez tarda un poco.'}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input className={inp} placeholder="Dirección completa" value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} />
              {Reconocedor && (
                <button type="button" onClick={dictar} aria-label="Dictar la dirección"
                  className={`shrink-0 rounded-xl border px-3 ${escuchando ? 'animate-pulse border-red-400 text-red-300' : 'border-dark-600 text-dark-200'}`}>
                  <Mic size={18} />
                </button>
              )}
            </div>
            <input className={inp} placeholder="Cliente" value={nuevo.cliente} onChange={(e) => setNuevo({ ...nuevo, cliente: e.target.value })} />
            <input className={inp} placeholder="Teléfono" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
            <input className={inp} placeholder="Qué lleva" value={nuevo.contenido} onChange={(e) => setNuevo({ ...nuevo, contenido: e.target.value })} />
            <input className={inp} placeholder="Horario del cliente (ej. de 10 a 12)" value={nuevo.horario || ''} onChange={(e) => setNuevo({ ...nuevo, horario: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inp} inputMode="decimal" placeholder="A cobrar (€)" value={nuevo.cobrar || ''} onChange={(e) => setNuevo({ ...nuevo, cobrar: e.target.value })} />
              <select className={inp} value={nuevo.tipo || 'entrega'} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} aria-label="Tipo de parada">
                <option value="entrega">Entrega</option>
                <option value="recogida">Recogida</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-[14px] text-dark-200">
              <input type="checkbox" checked={!!nuevo.prioridad} onChange={(e) => setNuevo({ ...nuevo, prioridad: e.target.checked })} /> Urgente
            </label>
            <div className="flex items-center gap-2 text-[13px] text-dark-300">
              Bultos <input className={`${inp} w-20`} type="number" min="1" max="99" value={nuevo.bultos} onChange={(e) => setNuevo({ ...nuevo, bultos: e.target.value })} />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] text-dark-300">¿Dónde lo dejas en la furgoneta? <span className="text-dark-500">(opcional)</span></p>
              <HuecoRejilla valor={nuevo.hueco} onElegir={(h) => setNuevo({ ...nuevo, hueco: nuevo.hueco === h ? '' : h })} />
            </div>
          </div>
          {nuevo.de_ticket && <p className="mt-2 text-[12px] text-amber-200/90">Revisa lo leído del ticket antes de guardar.</p>}
          <button onClick={guardarNuevo} disabled={nuevo.direccion.trim().length < 4 || ocupado === 'guardar'}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-[15px] font-bold text-white disabled:opacity-40">
            {ocupado === 'guardar' ? 'Guardando…' : 'Añadir a mi ruta'}
          </button>
        </Hoja>
      )}

      {cobro && (
        <Hoja titulo={`Cobrar ${euros(cobro.cobrar)}`} onClose={() => setCobro(null)}>
          <p className="mb-3 text-[13px] text-dark-400">¿Cómo ha pagado?</p>
          <div className="grid grid-cols-3 gap-2">
            {[['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['bizum', 'Bizum']].map(([k, t]) => (
              <button key={k} onClick={() => marcar(cobro, 'entregado', '', { metodo: k })}
                className="rounded-xl bg-emerald-600 py-3.5 text-[15px] font-bold text-white">{t}</button>
            ))}
          </div>
          <button onClick={() => marcar(cobro, 'fallido', 'No ha pagado')}
            className="mt-3 w-full rounded-xl border border-red-500/30 py-3 text-[14px] text-red-300">No ha pagado: no lo entrego</button>
        </Hoja>
      )}

      {prueba && (
        <Hoja titulo="Prueba de entrega" onClose={() => setPrueba(null)}>
          <p className="mb-3 text-[13px] text-dark-400">
            Una foto del paquete donde lo dejas (en el portal, con el vecino…) evita discusiones después.
            <b className="text-dark-200"> Sin personas en la foto.</b> Es opcional.
          </p>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-white">
            {ocupado === 'foto' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {ocupado === 'foto' ? 'Guardando…' : 'Hacer foto y entregar'}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!ocupado}
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (!f) return
                setOcupado('foto')
                try {
                  // Pequeña a propósito: 640 px y calidad 0,6 son ~40-70 KB, de sobra
                  // para ver dónde quedó, y cabe en el pedido sin fotos sueltas por ahí.
                  const blob = await compressImage(f, 640, 0.6)
                  const foto = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob) })
                  await marcar(prueba.p, 'entregado', '', prueba.pago || { sin_cobro: true }, { foto, nota: notaEntrega })
                } catch { setAviso('No se pudo guardar la foto'); setOcupado('') }
              }} />
          </label>
          <input className={`${inp} mt-2`} placeholder="Nota (opcional): «al vecino del 2º», «en el buzón»…" value={notaEntrega}
            onChange={(e) => setNotaEntrega(e.target.value)} />
          <button onClick={() => marcar(prueba.p, 'entregado', '', prueba.pago || { sin_cobro: true }, { nota: notaEntrega })}
            disabled={!!ocupado}
            className="mt-3 w-full rounded-xl border border-dark-600 py-3 text-[14px] font-semibold text-dark-100">
            Entregar sin foto
          </button>
        </Hoja>
      )}

      {fallo && (
        <Hoja titulo={fallo.tipo === 'recogida' ? '¿Por qué no se ha recogido?' : '¿Por qué no se ha entregado?'} onClose={() => setFallo(null)}>
          <div className="flex flex-col gap-2">
            {MOTIVOS.map((m) => (
              <button key={m} onClick={() => marcar(fallo, 'fallido', m)}
                className="rounded-xl border border-dark-700 bg-dark-900 py-3 text-[14px] text-dark-100">{m}</button>
            ))}
          </div>
        </Hoja>
      )}

      {verAviso && (
        <Hoja titulo="Antes de empezar: tu ubicación" onClose={() => setVerAviso(false)}>
          <div className="space-y-2 text-[13.5px] leading-relaxed text-dark-300">
            <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-300" />
              Mientras tengas la <b className="text-dark-100">jornada empezada</b>, la oficina de tu empresa verá en el mapa por dónde vas, para organizar el reparto y avisar a los clientes.</p>
            <p>Solo se comparte desde que pulses «Empezar jornada» hasta que pulses «Terminar». Fuera de la jornada no se guarda nada.</p>
            <p>El recorrido se borra a los 30 días. Lo ve solo tu empresa, que es la responsable de estos datos; puedes pedirle acceso o explicaciones cuando quieras.</p>
          </div>
          <button onClick={() => jornada('empezar', true)} disabled={ocupado === 'jornada'}
            className="mt-4 w-full rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-white">
            Entendido, empezar jornada
          </button>
        </Hoja>
      )}
    </Marco>
  )
}

function Marco({ onBack, children, embebido }) {
  // Dentro del panel (el autónomo) va sin pantalla completa ni botón de volver.
  if (embebido) return <div className="mx-auto max-w-md">{children}</div>
  return (
    <div className="min-h-screen bg-dark-950 px-4 py-5">
      <div className="mx-auto max-w-md">
        <header className="mb-4 flex items-center gap-3">
          <button onClick={onBack} className="rounded-lg border border-dark-700 p-2 text-dark-400" aria-label="Volver"><ArrowLeft size={16} /></button>
          <h1 className="font-display text-[22px] font-bold text-dark-50">Mi ruta</h1>
        </header>
        {children}
      </div>
    </div>
  )
}

/* La furgoneta vista desde arriba, la cabina delante: seis zonas. */
function HuecoRejilla({ valor, onElegir, ocupado = false }) {
  return (
    <div className="rounded-2xl border border-dark-700 p-2" role="group" aria-label="Zona de la furgoneta">
      <p className="mb-1 text-center text-[10.5px] uppercase tracking-wider text-dark-500">Cabina</p>
      <div className="grid grid-cols-2 gap-1.5">
        {HUECOS.map((h) => (
          <button key={h} type="button" onClick={() => onElegir(h)} disabled={ocupado} aria-pressed={valor === h}
            className={`rounded-lg py-2.5 text-[13px] font-semibold disabled:opacity-50 ${valor === h ? 'bg-sky-500 text-white' : 'border border-dark-700 bg-dark-900 text-dark-200'}`}>
            {h}
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-[10.5px] uppercase tracking-wider text-dark-500">Puertas</p>
    </div>
  )
}

/* El cierre del día: lo hecho, lo que no y lo cobrado por cada vía. Solo
   cuenta lo que hay en las paradas; nada inventado. */
function Resumen({ hechos, ruta }) {
  const ok = hechos.filter((p) => p.estado === 'entregado')
  const no = hechos.filter((p) => p.estado === 'fallido')
  const cobros = {}
  ok.forEach((p) => { if (p.cobrado_importe) cobros[p.cobrado_metodo || 'otro'] = (cobros[p.cobrado_metodo || 'otro'] || 0) + Number(p.cobrado_importe) })
  const horas = hechos.map((p) => p.cerrado_en).filter(Boolean).sort()
  const durMin = horas.length > 1 ? Math.round((new Date(horas[horas.length - 1]) - new Date(horas[0])) / 60000) : 0
  const NOMBRE = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum', pagado: 'Ya pagado', otro: 'Otro' }
  return (
    <div className="mt-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/[.07] p-4" aria-label="Resumen del día">
      <p className="flex items-center gap-2 text-[16px] font-bold text-emerald-200"><Trophy size={18} /> Ruta terminada</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-dark-900 py-2.5"><p className="text-[22px] font-bold text-dark-50">{ok.length}</p><p className="text-[11.5px] text-dark-400">hechas</p></div>
        <div className="rounded-xl bg-dark-900 py-2.5"><p className={`text-[22px] font-bold ${no.length ? 'text-red-300' : 'text-dark-50'}`}>{no.length}</p><p className="text-[11.5px] text-dark-400">sin hacer</p></div>
      </div>
      {Object.keys(cobros).length > 0 && (
        <div className="mt-3 text-[13px] text-dark-200">
          <p className="mb-1 font-semibold">Cobrado</p>
          {Object.entries(cobros).map(([m, v]) => (
            <p key={m} className="flex justify-between"><span className="text-dark-400">{NOMBRE[m] || m}</span><span>{euros(v)}</span></p>
          ))}
          <p className="mt-1 flex justify-between border-t border-dark-700 pt-1 font-bold"><span>Total</span><span>{euros(Object.values(cobros).reduce((a, b) => a + b, 0))}</span></p>
        </div>
      )}
      <p className="mt-3 text-[12px] text-dark-400">
        {durMin > 0 && <>De la primera a la última parada: {minutosATexto(durMin)}. </>}
        {ruta?.km ? <>Ruta planificada: {ruta.km} km.</> : null}
      </p>
      {no.length > 0 && <p className="mt-1 text-[12px] text-dark-400">Las no hechas siguen en «hechos hoy» con su motivo.</p>}
    </div>
  )
}

function Hoja({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-dark-700 bg-dark-950 p-4 pb-8">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-bold text-dark-50">{titulo}</h2>
          <button onClick={onClose} className="rounded p-1 text-dark-400" aria-label="Cerrar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* EL ESCÁNER: la cámara trasera y el lector de códigos del propio navegador
   (BarcodeDetector, en Chrome de Android). Sin librerías ni nada que salga
   del móvil. Donde no existe (iPhone), se dice y se escribe el código o se
   hace la foto del ticket. */
function Escaner({ onCodigo, onClose }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  // Por referencia: si fuera dependencia del efecto, cada repintado de la
  // pantalla de debajo cerraría y volvería a abrir la cámara.
  const avisa = useRef(onCodigo)
  avisa.current = onCodigo

  useEffect(() => {
    let parar = false
    let stream = null
    let temporizador = null
    async function arrancar() {
      if (!('BarcodeDetector' in window)) {
        setError('Este móvil no sabe leer códigos desde el navegador. Escribe el código o haz la foto del ticket.')
        return
      }
      try {
        const soportados = await window.BarcodeDetector.getSupportedFormats()
        const quiero = ['code_128', 'ean_13', 'ean_8', 'qr_code', 'code_39', 'itf', 'upc_a', 'upc_e', 'data_matrix', 'codabar']
        const detector = new window.BarcodeDetector({ formats: quiero.filter((f) => soportados.includes(f)) })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (parar) { stream.getTracks().forEach((t) => t.stop()); return }
        video.current.srcObject = stream
        await video.current.play()
        const mirar = async () => {
          if (parar) return
          try {
            const codigos = await detector.detect(video.current)
            if (codigos.length && codigos[0].rawValue) {
              if (navigator.vibrate) navigator.vibrate(60)
              avisa.current(codigos[0].rawValue)
              return
            }
          } catch { /* un fotograma malo: se sigue */ }
          temporizador = setTimeout(mirar, 250)
        }
        mirar()
      } catch {
        setError('No se pudo abrir la cámara. Dale permiso en el navegador o escribe el código.')
      }
    }
    arrancar()
    return () => {
      parar = true
      clearTimeout(temporizador)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Escanear">
      <div className="flex items-center justify-between p-4">
        <span className="text-[15px] font-semibold text-white">Apunta al código de la caja</span>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white" aria-label="Cerrar"><X size={18} /></button>
      </div>
      {error ? <p className="px-6 py-10 text-center text-[14px] text-white/80">{error}</p> : (
        <div className="relative flex-1">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-2xl border-2 border-white/70" />
        </div>
      )}
    </div>
  )
}
