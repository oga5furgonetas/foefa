import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ScanLine, Camera, Loader2, Navigation, Phone, Check, X, Route, MapPin, Play, Square, Package,
  MessageCircle, Clock, Search, List, Pencil, ChevronDown, GripVertical, Map as MapaIcono, ArrowUp, ArrowDown, ArrowUpDown, Mic, ClipboardPaste, Trophy,
  Eye, PenLine, RotateCcw, HelpCircle, Share2, FileUp,
} from 'lucide-react'
import {
  repMiRuta, repZonasCarga, repEscanear, repEscanearLote, repLeerTicket, repNuevoPedido, repEstado, repOrdenar, repJornada, repPosicion,
  repMiOrden, repMiEditar, repMiQuitar, repEjemplo, repQuitarEjemplos, repPegarMiLista, repTrazado, repFachada, repGanancias,
} from '../../services/api'
import { hoyLocal } from '../../lib/fecha'
import { lista } from '../../lib/lista'
import { compressImage } from '../../lib/compressImage'
import { origen } from '../../marca'
import { leerTicketEnMovil, leerHojaEnMovil } from '../../lib/leerTicket'
import { textoParaPegar, csvAPegar } from '../../lib/hojaReparto'
import { lectorDeCodigos, leerCodigo } from '../../lib/codigos'
import { datosDeCodigos } from '../../lib/codigoEtiqueta'
import { buscarDirecciones } from '../../lib/direcciones'
import { invitar } from '../../lib/compartir'
import { medirAccion } from '../../lib/analitica'
import { compartirDia } from '../../lib/compartirDia'
import { fijarPais, importe, simboloMoneda, metodosCobro, paisActual } from '../../lib/region'
import { tx, useIdioma, locale, txError } from '../../lib/idioma'
import { salirDeLaDemoDeReparto } from '../../panel/auth'

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
/* DÓNDE SE DEJA (10-10-2026, como Circuit/Spoke): un toque en vez de escribirlo.
   El cliente lo ve en su enlace de seguimiento. Mismas claves que el servidor. */
const DONDE = [['mano', 'En mano'], ['vecino', 'Al vecino'], ['buzon', 'En el buzón'], ['porteria', 'En portería o recepción'], ['seguro', 'En un lugar seguro']]
const CON_QUIEN = ['mano', 'vecino', 'porteria']
const VACIO = { codigo: '', cliente: '', telefono: '', direccion: '', contenido: '', bultos: 1, notas: '', horario: '', prioridad: false, cobrar: '', tipo: 'entrega', hueco: '' }

/* El número para wa.me. En España, solo móviles (6 o 7 y nueve cifras): a
   un fijo no llega y un botón que abre WhatsApp para nada es peor que no
   tenerlo. Fuera de España (04-10-2026) no sabemos distinguir fijo de móvil:
   con prefijo internacional (+ o 00) tal cual; si no, se le pone el del país
   de la cuenta. Argentina pide un 9 tras el 54 en los móviles. */
export function movilWhatsApp(tel, pais = 'es', prefijo = '34') {
  const crudo = String(tel || '').trim()
  let d = crudo.replace(/\D/g, '')
  if (!d) return ''
  if (pais === 'es' || !pais) {
    d = d.replace(/^0034/, '').replace(/^34(?=\d{9}$)/, '')
    return /^[67]\d{8}$/.test(d) ? `34${d}` : ''
  }
  if (crudo.startsWith('+') || d.startsWith('00')) {
    d = d.replace(/^00/, '')
    return d.length >= 8 && d.length <= 15 ? d : ''
  }
  d = d.replace(/^0+/, '')
  if (d.length < 7 || d.length > 12) return ''
  if (pais === 'ar' && !d.startsWith('9')) d = `9${d}`
  return `${prefijo}${d}`
}
/* El mensaje lleva la hora estimada y el enlace de seguimiento (sin datos
   personales). Sin enlace, el mensaje de siempre. */
function mensaje(p, empresa) {
  const quien = empresa ? tx('el repartidor de {empresa}', { empresa }) : tx('el repartidor')
  const que = p.tipo === 'recogida' ? tx('a hacer la recogida') : tx('con su pedido')
  const cuando = p.eta ? tx(', llegada aproximada a las {hora}', { hora: p.eta }) : ''
  const enlace = p.seguimiento ? ` ${tx('Puede seguirlo aquí:')} ${origen()}/s/${p.seguimiento}` : ''
  return `${tx('Hola, soy {quien}. Voy de camino {que}', { quien, que })}${cuando}.${enlace}`
}
const euros = (n) => importe(n)

function minutosATexto(m) {
  const h = Math.floor(m / 60)
  return `${h ? `${h} h ` : ''}${m % 60} min`
}

// El mapa (Leaflet) pesa: solo se descarga si se abre la vista de mapa.
const MapaReparto = lazy(() => import('../../panel/components/MapaReparto'))
const SIN_ZONAS = []

/* Con qué navega cada uno: Google Maps o Waze. Se recuerda en el móvil. */
/* «En la app» guía aquí dentro (Navegacion.jsx); los otros dos abren su app. */
const NAVEGADORES = [['app', 'Esta app'], ['google', 'Google Maps'], ['waze', 'Waze']]
/* En China Google Maps y Waze no funcionan: allí se navega con Amap (高德) o
   Baidu (百度). Los dos abren su app con el destino puesto y aceptan las
   coordenadas del GPS tal cual (WGS-84), así que el punto no se desplaza. */
const NAVEGADORES_CHINA = [['app', 'Esta app'], ['amap', '高德地图'], ['baidu', '百度地图']]
// Por el PAÍS de la cuenta, no por el idioma: quien habla chino y reparte en
// España necesita Google Maps (Amap y Baidu solo cubren China).
export const enChina = (pais) => pais === 'cn'
const nombreNavegador = (nav) => ({ google: 'Google Maps', waze: 'Waze', amap: '高德地图', baidu: '百度地图' }[nav] || 'Google Maps')
const Navegacion = lazy(() => import('./Navegacion'))
function navegar(p, nav) {
  const nombre = encodeURIComponent(p.cliente || p.direccion || '')
  if (nav === 'amap') {
    return p.lat != null
      ? `https://uri.amap.com/navigation?to=${p.lng},${p.lat},${nombre}&mode=car&coordinate=wgs84&callnative=1`
      : `https://uri.amap.com/search?keyword=${encodeURIComponent(p.direccion || '')}&callnative=1`
  }
  if (nav === 'baidu') {
    return p.lat != null
      ? `https://api.map.baidu.com/direction?destination=latlng:${p.lat},${p.lng}|name:${nombre}&coord_type=wgs84&mode=driving&output=html&src=flota`
      : `https://api.map.baidu.com/geocoder?address=${encodeURIComponent(p.direccion || '')}&output=html&src=flota`
  }
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

// Metros entre dos puntos (para no repintar por un temblor del GPS).
const metrosEntre = (a, b) => {
  const r = Math.PI / 180
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(x))
}

// Dónde estoy ahora (si el móvil lo dice en 8 s); si no, null y se sale del almacén.
const posicionAhora = () => new Promise((ok) => {
  if (!('geolocation' in navigator)) { ok(null); return }
  navigator.geolocation.getCurrentPosition(
    (pos) => ok({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => ok(null), { timeout: 8000, maximumAge: 60000 })
})

/* Las próximas paradas de golpe en Google Maps: hasta 3 intermedias y la
   cuarta de destino (más no lo abren todos los móviles). Waze no admite
   varias paradas, por eso este botón es solo de Google Maps. */
function enlaceVarias(paradas) {
  const ps = paradas.filter((p) => p.lat != null).slice(0, 4)
  if (ps.length < 2) return ''
  const ll = (p) => `${p.lat},${p.lng}`
  const dest = ps[ps.length - 1]
  const medio = ps.slice(0, -1).map(ll).join('|')
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${ll(dest)}&waypoints=${encodeURIComponent(medio)}`
}

// Misma puerta: mismas coordenadas a ~10 m o, sin ellas, la misma dirección escrita.
const clavePuerta = (p) => (p.lat != null ? `${Number(p.lat).toFixed(4)},${Number(p.lng).toFixed(4)}` : sinTildes(p.direccion).replace(/\s+/g, ' ').trim())
const aMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }

const lee = (k, def) => { try { return localStorage.getItem(k) || def } catch { return def } }
const guarda = (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: da igual */ } }
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const porOrden = (a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9)

/* Dictar la dirección: el reconocimiento de voz del propio navegador (Chrome
   en Android lo tiene). Donde no existe, no sale el botón. */
const Reconocedor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export default function MiRuta({ onBack, embebido = false }) {
  useIdioma()
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
  const [entrega, setEntrega] = useState({ donde: '', recibe: '', firma: '', firmando: false })
  const [encontrado, setEncontrado] = useState(null)
  const [vista, setVista] = useState(() => lee('ruta_vista', 'lista'))
  const [nav, setNav] = useState(() => lee('ruta_nav2', 'app'))
  const [filtro, setFiltro] = useState('')
  const [reordenar, setReordenar] = useState(null)   // null | [ids] mientras se cambia a mano
  const [huecoDe, setHuecoDe] = useState(null)       // la parada a la que se le dice dónde va
  const [pegar, setPegar] = useState(null)           // null | {texto, n}
  const [tarifa, setTarifa] = useState(null)         // «Mi dinero hoy»: null | {parada, dia, km} (texto en €)
  const [tour, setTour] = useState(-1)               // recorrido de bienvenida: -1 cerrado, 0..2 el paso
  const [escuchando, setEscuchando] = useState(false)
  const reconocedor = useRef(null)
  const dirInput = useRef(null)
  useEffect(() => guarda('ruta_vista', vista), [vista])
  useEffect(() => guarda('ruta_nav2', nav), [nav])
  // La app de navegación de fuera: la elegida, o la del país si guía esta app.
  const fuera = nav === 'app' ? (enChina(ruta?.pais) ? 'amap' : 'google') : nav
  // Lo elegido en otro país no vale aquí (Google en China, Amap fuera): se vuelve a esta app.
  useEffect(() => {
    if (!ruta) return
    const china = enChina(ruta.pais)
    if ((china && ['google', 'waze'].includes(nav)) || (!china && ['amap', 'baidu'].includes(nav))) setNav('app')
  }, [ruta, nav])
  const [guiando, setGuiando] = useState(null)       // id de la parada a la que se guía; null = sin guía
  // 10-10-2026: se mide cuándo EMPIEZA a navegar (no cada parada), para el embudo del alta.
  const guiandoAntes = useRef(null)
  useEffect(() => {
    if (guiando && !guiandoAntes.current) medirAccion('ruta_navegar')
    guiandoAntes.current = guiando
  }, [guiando])
  const [abierta, setAbierta] = useState(null)       // la parada desplegada (además de la siguiente)
  const [deshacer, setDeshacer] = useState(null)     // {p, estado} recién cerrada, para volver atrás
  const [trazado, setTrazado] = useState(null)
  const [yo, setYo] = useState(null)
  // El reloj de la pantalla, para «vas X min por detrás»: cada minuto basta.
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setAhora(new Date()), 60000); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!deshacer) return undefined
    const id = setTimeout(() => setDeshacer(null), 8000)
    return () => clearTimeout(id)
  }, [deshacer])

  // El recorrido por las calles, solo con el mapa abierto y cuando cambia el
  // orden o la lista de lo que queda (no en cada repintado).
  const firmaRuta = ruta ? lista(ruta.pedidos).filter((p) => !['entregado', 'fallido'].includes(p.estado)).sort(porOrden)
    .map((p) => `${p.id}:${p.lat ?? ''}`).join('|') : ''
  /* EL PUNTO AZUL SE MUEVE CONTIGO (como Google Maps, Circuit o Amazon Flex):
     mientras el mapa está abierto se sigue la posición del móvil; esa posición
     solo se pinta aquí. Si te alejas más de 150 m de donde se calculó el
     camino (y han pasado 30 s), se recalcula desde donde estás, y la línea
     deja de incluir lo ya recorrido. */
  const ultimaPos = useRef(null)
  const origenTrazado = useRef(null)
  const [recalcular, setRecalcular] = useState(0)
  useEffect(() => {
    if (vista !== 'mapa' || !('geolocation' in navigator)) return undefined
    const id = navigator.geolocation.watchPosition((pos) => {
      const nuevo = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      ultimaPos.current = nuevo
      setYo((a) => (!a || metrosEntre(a, nuevo) > 8 ? nuevo : a))
      const o = origenTrazado.current
      if (o && metrosEntre(o, nuevo) > 150 && Date.now() - o.t > 30000) {
        origenTrazado.current = { ...nuevo, t: Date.now() }
        setRecalcular((n) => n + 1)
      }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })
    return () => { navigator.geolocation.clearWatch(id); ultimaPos.current = null }
  }, [vista])

  useEffect(() => {
    if (vista !== 'mapa' || !firmaRuta) return undefined
    let vivo = true
    ;(async () => {
      const aqui = ultimaPos.current || await posicionAhora()
      if (!vivo) return
      setYo(aqui)
      origenTrazado.current = aqui ? { ...aqui, t: Date.now() } : null
      try {
        const { data } = await repTrazado(aqui)
        if (vivo) setTrazado(data)
      } catch { if (vivo) setTrazado({ fuente: 'linea_recta', linea: [] }) }
    })()
    return () => { vivo = false }
  }, [vista, firmaRuta, recalcular])

  /* ZONAS DE CARGA Y DESCARGA (13-10-2026), con el mapa abierto y el interruptor
     puesto (se recuerda en el móvil). Salen de OpenStreetMap: solo las que alguien
     ha apuntado, y sin saber si están libres. */
  const [verZonas, setVerZonas] = useState(() => { try { return localStorage.getItem('ruta_zonas_carga') !== '0' } catch { return true } })
  const [zonas, setZonas] = useState(null)   // null | {zonas, incompleto}
  useEffect(() => {
    if (vista !== 'mapa' || !verZonas || !firmaRuta) return undefined
    let vivo = true
    repZonasCarga().then(({ data }) => { if (vivo) setZonas(Array.isArray(data?.zonas) ? data : { zonas: [], incompleto: true }) })
      .catch(() => { if (vivo) setZonas({ zonas: [], incompleto: true }) })
    return () => { vivo = false }
  }, [vista, verZonas, firmaRuta])
  function cambiarZonas(v) {
    setVerZonas(v)
    try { localStorage.setItem('ruta_zonas_carga', v ? '1' : '0') } catch { /* sin almacenamiento */ }
  }

  const cargar = useCallback(() => {
    repMiRuta().then(({ data }) => { fijarPais(data?.pais); setRuta(data) })
      .catch((e) => setErr(txError(e, 'No se pudo cargar tu ruta')))
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
      else setAviso(txError(e, 'No se pudo'))
    } finally { setOcupado('') }
  }

  /* ESCANEAR Y YA (10-10-2026): si el paquete está en la lista, sale su parada;
     si no, con el MISMO gesto se lee la etiqueta (el fotograma en el que se leyó
     el código) y se rellena la parada nueva.
     TODOS LOS CÓDIGOS DE LA ETIQUETA (13-10-2026): llega la lista de lo leído
     (la barra y los 2D). Del 2D sale la dirección si la trae, sea GS1, UPS o
     separada por «|» (lib/codigoEtiqueta.js); lo que falte lo completa la foto. */
  async function buscar(c, foto) {
    const valores = (Array.isArray(c) ? c : [c]).map((v) => String(v || '').trim()).filter(Boolean)
    if (!valores.length) return
    const datos = datosDeCodigos(valores, paisActual())
    medirAccion(foto ? 'ruta_escaneo' : 'ruta_codigo')
    setEscaner(false); setOcupado('buscar'); setAviso('')
    try {
      // El paquete puede estar en la lista con cualquiera de sus códigos (la barra o el del bulto).
      let data = null
      let codigo = ''   // el principal, como lo guarda el servidor
      data = (await repEscanear(datos.codigos.length ? datos.codigos : valores)).data
      codigo = data.codigo || ''
      if (data.encontrado) {
        const p = data.pedido
        setAviso(`✓ ${p.cliente || p.direccion} · ${tx('bulto {a} de {b}', { a: p.escaneos, b: p.bultos })}${p.hueco ? ` · ${tx('va {sitio}', { sitio: tx(p.hueco) })}` : ''}`)
        // EL BUSCADOR DE PAQUETES (como Circuit): con el paquete en la mano, qué parada es, en grande.
        if (p.estado !== 'entregado' && p.estado !== 'fallido') setEncontrado(p)
        if (navigator.vibrate) navigator.vibrate(80)
        setCodigo('')
        cargar()
        return
      }
      if (datos.direccion) {
        const { codigos: _c, completa: _completa, ...campos } = datos
        setNuevo({ ...VACIO, ...Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== '' && v != null)), codigo, de_ticket: true,
          direccion: [datos.direccion, datos.cp, datos.localidad].filter(Boolean).join(', ') })
        // El código no lo traía todo (sin teléfono o sin población): la foto pone lo que falta, sin pisar lo leído.
        if (foto && (!datos.completa || !datos.telefono)) { setOcupado(''); await leerTicket(foto, true); return }
      } else {
        setNuevo({ ...VACIO, codigo })
        if (foto) { setOcupado(''); await leerTicket(foto); return }
      }
    } catch (e) { setAviso(txError(e, 'No se pudo buscar')) } finally { setOcupado('') }
  }

  /* El código de barras de la etiqueta, de la misma foto: así una foto da
     el código Y la dirección. Si el móvil no sabe leer códigos, nada. */
  async function codigoDeFoto(blob) {
    try { return await leerCodigo(await createImageBitmap(blob)) } catch { return '' }
  }

  /* `soloHuecos`: los datos ya vienen del código de la etiqueta (exactos); la
     foto solo rellena lo que falte, nunca los cambia por lo que lea el OCR. */
  async function leerTicket(file, soloHuecos = false) {
    if (!file) return
    medirAccion('ruta_foto_etiqueta')
    setOcupado('ticket')
    try {
      // Con IA en el servidor solo si la empresa la tiene permitida (clave de
      // pago); si no, se lee EN EL MÓVIL y la foto no sale de aquí.
      const blob = await compressImage(file, 1600, 0.85)
      const [data, codigoFoto] = await Promise.all([
        ruta?.ia_tickets
          // Si la IA no contesta (saturada, sin saldo), se lee en el móvil en vez de dar error.
          ? repLeerTicket(new File([blob], 'ticket.jpg', { type: 'image/jpeg' })).then((r) => r.data).catch(() => leerTicketEnMovil(blob, paisActual()))
          : leerTicketEnMovil(blob, paisActual()),
        codigoDeFoto(blob),
      ])
      if (codigoFoto && !data.codigo) data.codigo = codigoFoto
      const algo = data?.direccion || data?.telefono || data?.cliente
      if (!algo && !soloHuecos) setAviso(tx('No he podido leer el ticket. Prueba con más luz y el ticket recto, o escríbelo.'))
      setNuevo((n) => {
        const leido = Object.fromEntries(Object.entries(data || {}).filter(([, v]) => v !== '' && v != null))
        const dir = [data?.direccion, data?.cp, data?.localidad].filter(Boolean).join(', ')
        if (soloHuecos) {
          return { ...n, ...Object.fromEntries(Object.entries(leido).filter(([k]) => !n?.[k] && k !== 'direccion' && k !== 'cp' && k !== 'localidad')),
            de_ticket: true, direccion: n?.direccion || dir }
        }
        return { ...n, ...leido, codigo: n?.codigo || data?.codigo || '', de_ticket: true, direccion: dir || n?.direccion || '' }
      })
    } catch (e) { setAviso(txError(e, 'No se pudo leer el ticket')) } finally { setOcupado('') }
  }

  // «Cargar paquetes»: una foto tras otra, y al acabar «Montar ruta».
  const [carga, setCarga] = useState(null)   // null | {n}

  /* ESCANEAR SEGUIDOS (13-10-2026). Con 80 paquetes, abrir la cámara, revisar
     y guardar cada uno es lo que hacía abandonar. Ahora la cámara no se cierra:
     el paquete cuya etiqueta trae en sus códigos la dirección completa entra
     solo (es el dato de la empresa, no un OCR); el que ya estaba en la lista
     se cuenta; los demás se guardan con su foto y se revisan al acabar, uno a
     uno, con la hoja de siempre. */
  const [seguidos, setSeguidos] = useState(null)   // null | {abierto, nuevos, yaEstaban, revisar: [{valores, foto}], ultimo}
  const colaEscaneoRef = useRef([])
  const envioEscaneoRef = useRef(null)
  const temporizadorEscaneoRef = useRef(null)

  async function vaciarColaEscaneo() {
    if (envioEscaneoRef.current) return envioEscaneoRef.current
    const trabajo = (async () => {
      while (colaEscaneoRef.current.length) {
        const lote = colaEscaneoRef.current.splice(0, 20)
        const paquetes = lote.map(({ valores, datos }) => {
          const codigos = datos.codigos?.length ? datos.codigos : valores
          const { codigos: _c, completa: _completa, ...campos } = datos
          return { codigos, datos: { ...Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== '' && v != null)),
            codigo: datos.codigo || codigos[0] || '', de_ticket: true,
            direccion: datos.direccion ? [datos.direccion, datos.cp, datos.localidad].filter(Boolean).join(', ') : '' } }
        })
        try {
          const { data } = await repEscanearLote(paquetes)
          let nuevos = 0; let existentes = 0; const revisar = []
          ;(data.items || []).forEach((item, i) => {
            if (item.estado === 'nuevo') nuevos += 1
            else if (item.estado === 'existente' || item.estado === 'repetido') existentes += 1
            else revisar.push({ valores: lote[i].valores, foto: lote[i].foto })
          })
          if (nuevos) setCarga((c) => c ? { ...c, n: c.n + nuevos } : c)
          if (nuevos) medirAccion('ruta_parada_nueva')
          setSeguidos((s) => s ? ({ ...s, nuevos: s.nuevos + nuevos, yaEstaban: s.yaEstaban + existentes,
            revisar: [...s.revisar, ...revisar], ultimo: revisar.length ? tx('Para revisar al acabar') : (nuevos ? `+ ${nuevos} ${tx('paradas añadidas')}` : `✓ ${existentes} ${tx('ya estaban')}`), enCola: colaEscaneoRef.current.length }) : s)
        } catch {
          setSeguidos((s) => s ? ({ ...s, revisar: [...s.revisar, ...lote.map(({ valores, foto }) => ({ valores, foto }))],
            ultimo: tx('Para revisar al acabar'), enCola: colaEscaneoRef.current.length }) : s)
        }
      }
    })()
    envioEscaneoRef.current = trabajo
    try { await trabajo } finally {
      // El candado pertenece a esta promesa; una tanda concurrente no debe borrar el siguiente candado.
      if (envioEscaneoRef.current === trabajo) envioEscaneoRef.current = null
    }
  }

  async function escaneoSeguido(valores, foto) {
    const datos = datosDeCodigos(valores, paisActual())
    medirAccion('ruta_escaneo')
    colaEscaneoRef.current.push({ valores, foto, datos })
    setSeguidos((s) => s ? ({ ...s, enCola: colaEscaneoRef.current.length, ultimo: tx('Paquete leído; guardando lote') }) : s)
    clearTimeout(temporizadorEscaneoRef.current)
    if (colaEscaneoRef.current.length >= 20) await vaciarColaEscaneo()
    else temporizadorEscaneoRef.current = setTimeout(() => { vaciarColaEscaneo() }, 650)
  }

  async function cerrarSeguidos() {
    clearTimeout(temporizadorEscaneoRef.current)
    await vaciarColaEscaneo()
    setSeguidos((s) => (s ? { ...s, abierto: false, enCola: 0 } : s))
    cargar()
  }

  // El siguiente de los dudosos, con la hoja de siempre (lee la foto si el código no traía la dirección).
  function revisarSiguiente() {
    const [primero, ...resto] = seguidos?.revisar || []
    if (!primero) return
    setSeguidos((s) => ({ ...s, revisar: resto }))
    buscar(primero.valores, primero.foto)
  }

  async function guardarNuevo() {
    setOcupado('guardar')
    try {
      if (nuevo.id) {
        // Editar una parada que ya está en la ruta.
        const { id, ...campos } = nuevo
        await repMiEditar(id, { cliente: campos.cliente, telefono: campos.telefono, direccion: campos.direccion, contenido: campos.contenido,
          bultos: campos.bultos, horario: campos.horario || '', cobrar: campos.cobrar || '', tipo: campos.tipo || 'entrega',
          prioridad: !!campos.prioridad, hueco: campos.hueco || '', notas: campos.notas || '',
          ...(campos.lat != null ? { lat: campos.lat, lng: campos.lng, cp: campos.cp || '', localidad: campos.localidad || '' } : {}) })
        setNuevo(null); setQuitando(false); cargar(); setAviso(tx('✓ Cambios guardados'))
        return
      }
      await repNuevoPedido(nuevo)
      medirAccion('ruta_parada_nueva')
      setNuevo(null); setCodigo('')
      cargar()
      if (carga) { setCarga({ n: carga.n + 1 }); setAviso('') } else setAviso(tx('✓ Añadido a tu ruta'))
    } catch (e) { setAviso(txError(e, 'No se pudo guardar')) } finally { setOcupado('') }
  }

  /* QUITAR UNA PARADA: dos toques (el segundo confirma), para que un dedo
     torpe en el coche no borre una entrega. */
  const [quitando, setQuitando] = useState(false)
  const [masCarga, setMasCarga] = useState(false)   // «Más formas de añadir» abierto

  /* SUGERENCIAS DE DIRECCIÓN al escribir en la hoja de una parada: al tocar
     una, la parada queda con su punto exacto en el mapa. Si se sigue
     escribiendo, el punto elegido se descarta (la dirección ya no es esa). */
  const [sugs, setSugs] = useState([])
  const textoDir = nuevo?.direccion || ''
  const tienePunto = nuevo?.lat != null
  const hayHoja = !!nuevo
  useEffect(() => {
    if (!hayHoja || tienePunto || textoDir.trim().length < 4) { setSugs([]); return undefined }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const lista2 = await buscarDirecciones(textoDir, { cerca: yo || ruta?.base || null, pais: ruta?.pais || '', senal: ctl.signal })
        if (!ctl.signal.aborted) setSugs(lista2)
      } catch { /* sin servicio: se escribe la dirección entera y el servidor la sitúa */ }
    }, 350)
    return () => { clearTimeout(t); ctl.abort() }
  }, [textoDir, tienePunto, hayHoja, yo, ruta?.base, ruta?.pais])
  async function quitarParada() {
    if (!nuevo?.id) return
    if (!quitando) { setQuitando(true); return }
    setOcupado('guardar')
    try {
      await repMiQuitar(nuevo.id)
      setNuevo(null); setQuitando(false); setAbierta(null); cargar(); setAviso(tx('Parada quitada de tu ruta'))
    } catch (e) { setAviso(txError(e, 'No se pudo quitar')) } finally { setOcupado('') }
  }
  /* PARADAS DE EJEMPLO: para ver la app trabajando sin tener paquetes. */
  async function cargarEjemplo() {
    setOcupado('ejemplo'); medirAccion('ejemplo_cargar')
    try {
      await repEjemplo(await posicionAhora())
      cargar()
      setAviso(tx('Son paradas de ejemplo, a tu alrededor: pulsa «Empezar a navegar» y míralo en acción. Quítalas cuando cargues las tuyas.'))
    } catch (e) { setAviso(txError(e, 'No se pudo preparar el ejemplo')) } finally { setOcupado('') }
  }
  // La primera vez que quien reparte solo abre su ruta vacía, el recorrido sale solo (una vez).
  const TOUR = 'fds_tour_ruta'
  useEffect(() => {
    if (!ruta?.autonomo || lista(ruta.pedidos).length) return
    try { if (localStorage.getItem(TOUR)) return; localStorage.setItem(TOUR, '1') } catch { return }
    setTour(0); medirAccion('tour_visto')
  }, [ruta?.autonomo, ruta?.pedidos])
  async function quitarEjemplos() {
    setOcupado('ejemplo')
    try { await repQuitarEjemplos(); cargar(); setAviso(tx('Ejemplos quitados. Ya puedes cargar tus paquetes.')) } catch (e) { setAviso(txError(e, 'No se pudo quitar')) } finally { setOcupado('') }
  }
  const editar = (p) => {
    setQuitando(false)
    setNuevo({ ...VACIO, id: p.id, codigo: '', cliente: p.cliente || '', telefono: p.telefono || '', direccion: p.direccion || '',
      contenido: p.contenido || '', bultos: p.bultos || 1, notas: p.notas || '', tipo: p.tipo || 'entrega', prioridad: !!p.prioridad,
      cobrar: p.cobrar > 0 ? String(p.cobrar).replace('.', ',') : '', hueco: p.hueco || '',
      horario: p.ventana_desde ? `de ${p.ventana_desde} a ${p.ventana_hasta}` : '' })
  }

  // Lo que acompaña a «Entregado»: la nota, dónde quedó, quién lo recogió y su firma.
  function datosEntrega() {
    const d = { nota: notaEntrega }
    if (entrega.donde) d.donde = entrega.donde
    if (CON_QUIEN.includes(entrega.donde)) {
      if (entrega.recibe.trim()) d.recibe = entrega.recibe.trim()
      if (entrega.firma) d.firma = entrega.firma
    }
    return d
  }

  async function marcar(p, estado, motivo, pago, extra) {
    // Con importe a cobrar, antes de dar por entregado hay que decir cómo pagó.
    if (estado === 'entregado' && p.cobrar > 0 && !pago) { setCobro(p); return }
    // Y después, la prueba de entrega (foto y/o nota), que se puede saltar.
    if (estado === 'entregado' && !extra) { setCobro(null); setPrueba({ p, pago: pago || null }); setNotaEntrega(''); setEntrega({ donde: '', recibe: '', firma: '', firmando: false }); return }
    setOcupado(p.id)
    try {
      await repEstado(p.id, estado, motivo, { ...(pago || {}), ...(extra || {}) })
      medirAccion(estado === 'entregado' ? 'ruta_entregado' : 'ruta_no_entregado')
      setFallo(null); setCobro(null); setPrueba(null); setAbierta(null)
      setDeshacer({ p, estado })
      if (navigator.vibrate) navigator.vibrate(estado === 'entregado' ? 60 : [40, 60, 40])
      cargar()
    } catch (e) {
      setAviso(txError(e, 'No se pudo guardar'))
    } finally { setOcupado('') }
  }

  async function ordenar() {
    medirAccion('ruta_ordenar')
    setOcupado('ordenar')
    const fin = async (punto) => {
      try {
        const { data } = await repOrdenar(punto)
        const rr = data.ruta
        const n = data.ordenados
        const paradas = n === 1 ? tx('1 parada') : tx('{n} paradas', { n })
        setAviso(rr?.fin
          ? `${tx('Ruta ordenada por tiempo: {paradas}, acabas ≈ {fin}', { paradas, fin: rr.fin })}${rr.fuente === 'linea_recta' ? ` ${tx('(sin servidor de rutas: calculada por distancia)')}` : ''}`
          : tx('Ruta ordenada: {paradas}', { paradas }))
        cargar()
      } catch (e) {
        setAviso(txError(e, 'No se pudo ordenar'))
      } finally { setOcupado('') }
    }
    if (!('geolocation' in navigator)) return fin(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => fin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => fin(null), { timeout: 8000, maximumAge: 60000 })
  }

  async function deshacerUltima() {
    const d = deshacer
    if (!d) return
    setDeshacer(null)
    try { await repEstado(d.p.id, 'pendiente'); setAviso(tx('Vuelve a tu ruta: {quien}', { quien: d.p.cliente || d.p.direccion })); cargar() } catch (e) {
      setAviso(txError(e, 'No se pudo deshacer'))
    }
  }

  async function guardarOrden() {
    setOcupado('orden')
    try {
      const { data } = await repMiOrden(reordenar, await posicionAhora())
      setReordenar(null)
      setAviso(data.ruta?.fin ? tx('Orden guardado. Con este orden acabas ≈ {fin}', { fin: data.ruta.fin }) : tx('Orden guardado'))
      cargar()
    } catch (e) { setAviso(txError(e, 'No se pudo guardar el orden')) } finally { setOcupado('') }
  }

  /* ARRASTRAR PARA REORDENAR (con el dedo o el ratón): se agarra el asa de una
     parada y se suelta donde toca; las demás se van apartando. Las flechas
     siguen ahí para quien prefiera tocar. */
  const filasOrden = useRef({})
  const [arrastrando, setArrastrando] = useState(null)
  function empezarArrastre(e, id) {
    e.preventDefault()
    setArrastrando(id)
    const mueve = (ev) => {
      const y = ev.clientY
      setReordenar((ids) => {
        if (!ids) return ids
        const desde = ids.indexOf(id)
        let hasta = desde
        ids.forEach((otro, k) => {
          const el = filasOrden.current[otro]
          if (!el || otro === id) return
          const r = el.getBoundingClientRect()
          const medio = r.top + r.height / 2
          if (k < desde && y < medio) hasta = Math.min(hasta, k)
          if (k > desde && y > medio) hasta = Math.max(hasta, k)
        })
        if (hasta === desde) return ids
        const n = ids.filter((x) => x !== id)
        n.splice(hasta, 0, id)
        return n
      })
    }
    const suelta = () => {
      window.removeEventListener('pointermove', mueve)
      window.removeEventListener('pointerup', suelta)
      window.removeEventListener('pointercancel', suelta)
      setArrastrando(null)
    }
    window.addEventListener('pointermove', mueve)
    window.addEventListener('pointerup', suelta)
    window.addEventListener('pointercancel', suelta)
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
    try {
      await repMiEditar(p.id, { hueco }); setHuecoDe(null); cargar()
      setEncontrado((e) => (e && e.id === p.id ? { ...e, hueco } : e))
    } catch (e) {
      setAviso(txError(e, 'No se pudo guardar'))
    } finally { setOcupado('') }
  }

  /* DICTAR (10-10-2026). No funcionaba: la web tenía el micrófono prohibido en
     su cabecera (Permissions-Policy). Ahora se ve lo que va entendiendo mientras
     hablas y, si el móvil no deja dictar aquí (iPhone instalado, navegador de
     TikTok…), te lleva al campo para usar el micrófono del teclado, que va siempre. */
  const usaElTeclado = () => {
    setAviso(tx('Toca la dirección y usa el micrófono de tu teclado 🎤 para dictarla.'))
    dirInput.current?.focus()
  }
  function dictar() {
    if (escuchando) { reconocedor.current?.stop(); return }
    if (!Reconocedor) { usaElTeclado(); return }
    const r = new Reconocedor()
    reconocedor.current = r
    let oido = ''
    r.lang = locale(); r.interimResults = true; r.continuous = false; r.maxAlternatives = 1
    r.onresult = (ev) => {
      oido = Array.from(ev.results).map((x) => x[0]?.transcript || '').join(' ').trim()
      if (oido) setNuevo((n) => ({ ...n, direccion: oido, lat: null, lng: null }))
    }
    r.onerror = (ev) => {
      if (ev.error === 'no-speech') setAviso(tx('No te he oído. Toca el micrófono y di la dirección.'))
      else if (ev.error === 'aborted') return
      else usaElTeclado()
    }
    r.onend = () => { setEscuchando(false); reconocedor.current = null }
    setAviso('')
    setEscuchando(true)
    try { r.start() } catch { setEscuchando(false); usaElTeclado() }
  }

  /* LA HOJA DE REPARTO EN UNA FOTO (13-10-2026): se lee en el móvil y lo que son
     paradas va a la caja, con cabecera, para revisarlo antes de añadir. */
  async function leerHoja(file) {
    if (!file) return
    medirAccion('ruta_foto_hoja')
    setOcupado('hoja')
    try {
      const { paradas } = await leerHojaEnMovil(file, paisActual())
      if (!paradas.length) {
        setPegar((p) => ({ ...p, nota: tx('No he encontrado direcciones en la foto. Prueba con la hoja plana, recta y con luz, o pega la lista.') }))
        return
      }
      setPegar({ texto: textoParaPegar(paradas), n: null,
        nota: tx('He leído {n} paradas. Revísalas (cada línea: código; cliente; dirección; teléfono) y pulsa «Revisar».', { n: paradas.length }) })
    } catch (e) { setPegar((p) => ({ ...p, nota: txError(e, 'No se pudo leer la foto') })) } finally { setOcupado('') }
  }

  /* Un fichero de texto o CSV (lo que exportan muchos programas de reparto). Un
     Excel de verdad no se lee aquí: se copian sus celdas y se pegan. */
  async function abrirFichero(file) {
    if (!file) return
    medirAccion('ruta_fichero')
    if (/\.(xlsx?|ods|pdf)$/i.test(file.name)) {
      setPegar((p) => ({ ...p, nota: tx('Ese fichero no se puede abrir aquí. Ábrelo, selecciona las filas, copia y pégalas en la caja.') }))
      return
    }
    const texto = csvAPegar(await file.text())
    setPegar({ texto, n: null, nota: '' })
  }

  async function pegarLista(confirmar) {
    setOcupado('pegar')
    try {
      const { data } = await repPegarMiLista(pegar.texto, confirmar)
      if (!confirmar) { setPegar({ ...pegar, n: data.n }); return }
      setPegar(null)
      const n = data.creados
      setAviso(`✓ ${n === 1 ? tx('1 parada añadida') : tx('{n} paradas añadidas', { n })}${data.repetidos ? ` ${tx('({n} ya estaban)', { n: data.repetidos })}` : ''}. ${tx('Se están situando en el mapa (≈ {s} s); luego «Ordenar ruta».', { s: Math.max(1, n) })}`)
      cargar()
      // Se van ubicando en el servidor a una por segundo: se recarga al acabar.
      setTimeout(cargar, Math.min(60, n + 3) * 1000)
    } catch (e) { setAviso(txError(e, 'No se pudo leer la lista')) } finally { setOcupado('') }
  }

  if (err) return <Marco onBack={onBack} embebido={embebido}><p className="text-red-300">{err}</p></Marco>
  if (!ruta) return <Marco onBack={onBack} embebido={embebido}><div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" /></div></Marco>
  if (!ruta.activo) return <Marco onBack={onBack} embebido={embebido}><p className="text-dark-400">{tx('Tu empresa no usa el reparto por aquí.')}</p></Marco>

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
  const objetivo = guiando ? (porId[guiando]?.lat != null ? porId[guiando] : pendientes.find((p) => p.lat != null) || null) : null
  const enPuerta = {}
  pendientes.forEach((p) => { const k = clavePuerta(p); if (k) enPuerta[k] = (enPuerta[k] || 0) + 1 })
  // Retraso: solo con hora prevista de HOY y la parada siguiente aún sin hacer.
  const etaSig = siguiente && ruta.fecha === hoyLocal() ? aMin(siguiente.eta) : null
  const retraso = etaSig != null ? Math.max(0, ahora.getHours() * 60 + ahora.getMinutes() - etaSig) : 0
  const cobradoHoy = entregados.reduce((a, p) => a + (Number(p.cobrado_importe) || 0), 0)
  /* «MI DINERO HOY» (11-10-2026). Lo que lleva ganado con su tarifa, la gasolina de lo que lleva
     hecho (km de la ruta × parte hecha × €/km) y el neto; por hora si ha empezado la jornada. */
  const gan = ruta?.ganancias
  let dinero = null
  if (gan && (gan.pago_parada || gan.pago_dia)) {
    const bruto = (entregados.length * gan.pago_parada + (entregados.length ? gan.pago_dia : 0)) / 100
    const km = (Number(ruta?.ruta?.km) || 0) * (total ? hechos.length / total : 0)
    const gasolina = (gan.coste_km * km) / 100
    const neto = bruto - gasolina
    const empezo = ruta?.jornada?.empezada ? new Date(ruta.jornada.empezada).getTime() : 0
    const horas = empezo ? (Date.now() - empezo) / 3600000 : 0
    dinero = { bruto, gasolina, neto, porHora: horas >= 0.25 ? neto / horas : null }
  }
  const aEuros = (c) => (c ? String(c / 100).replace('.', ',') : '')
  // «2.500» o «1,500» (miles, como se escribe en Colombia, Chile o Argentina) son 2500 y 1500, no 2,5.
  const aCent = (t) => {
    const s = String(t || '').trim()
    const n = /^[1-9]\d{0,2}([.,]\d{3})+$/.test(s) ? Number(s.replace(/[.,]/g, '')) : Number(s.replace(',', '.'))
    return Math.round((n || 0) * 100)
  }
  async function guardarTarifa() {
    setOcupado('tarifa')
    try {
      await repGanancias({ pago_parada: aCent(tarifa.parada), pago_dia: aCent(tarifa.dia), coste_km: aCent(tarifa.km) })
      medirAccion('ruta_tarifa')
      setTarifa(null); cargar()
    } catch (e) { setAviso(txError(e, 'No se pudo guardar')) } finally { setOcupado('') }
  }

  return (
    <Marco onBack={onBack} embebido={embebido}>
      {/* JORNADA Y UBICACIÓN. El autónomo no tiene oficina que le siga: a él
          no se le pide compartir nada. */}
      {ruta.autonomo ? null : jornadaAbierta ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/[.07] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-[12.5px] text-emerald-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {tx('En jornada · la oficina ve tu ubicación')}
          </span>
          <button onClick={() => jornada('terminar')} disabled={ocupado === 'jornada'}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-200">
            <Square size={12} /> {tx('Terminar')}
          </button>
        </div>
      ) : (
        <button onClick={() => (ruta.aviso_aceptado ? jornada('empezar') : setVerAviso(true))} disabled={ocupado === 'jornada'}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dark-700 bg-dark-900 py-3 text-[14px] font-semibold text-dark-100">
          <Play size={15} /> {ruta.jornada?.terminada ? tx('Volver a empezar la jornada') : tx('Empezar jornada')}
        </button>
      )}

      {/* LA PRUEBA SIN CUENTA: se dice que lo es y cómo quedársela. */}
      {ruta.prueba && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/[.08] px-3.5 py-2.5">
          <span className="text-[12.5px] leading-snug text-amber-100">{tx('Ruta de prueba con paradas de ejemplo. Se borra mañana.')}</span>
          <div className="flex shrink-0 flex-col items-stretch gap-1.5">
            <a href="/registro?sector=autonomo&plan=autonomo" className="rounded-lg bg-amber-400 px-3 py-1.5 text-center text-[12.5px] font-bold text-[#1a1300]">{tx('Crear mi cuenta')}</a>
            {/* Quien ya tiene cuenta tiene que poder SALIR de la demo (Dani Brao, 05-10). */}
            <button type="button" onClick={() => { salirDeLaDemoDeReparto(); window.location.href = '/panel/login' }}
              className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-[12px] font-semibold text-amber-100">{tx('Ya tengo cuenta')}</button>
          </div>
        </div>
      )}

      {/* LA CABECERA DEL DÍA: lo primero que se ve. Cuánto llevas, cuánto
          queda, a qué hora acabas y si vas tarde respecto a lo previsto. */}
      {total > 0 && (
        <Cabecera fecha={ruta.fecha} hechos={hechos.length} total={total} entregados={entregados.length}
          pendientes={pendientes.length} rr={ruta.ruta} retraso={retraso} cobrado={cobradoHoy}
          dinero={dinero} onTarifa={ruta.autonomo && gan ? () => setTarifa({ parada: aEuros(gan.pago_parada), dia: aEuros(gan.pago_dia), km: aEuros(gan.coste_km) || (simboloMoneda() === '€' ? '0,12' : '') }) : null}
          onCompartir={entregados.length >= 5 && pendientes.length === 0 ? () => {
            const ini = ruta.jornada?.empezada ? new Date(ruta.jornada.empezada).getTime() : 0
            const fin = ruta.jornada?.terminada ? new Date(ruta.jornada.terminada).getTime() : Date.now()
            compartirDia({ paradas: entregados.length, minutos: ini ? (fin - ini) / 60000 : 0, km: Number(ruta?.ruta?.km) || 0 })
              .then((r) => { if (r === 'descargado') setAviso(tx('Imagen descargada y texto copiado: pégalo donde quieras.')) })
              .catch(() => setAviso(tx('No se pudo preparar la imagen')))
          } : null}
          fueraHorario={pendientes.filter((p) => p.tarde_min > 0).length}
          onGuiar={nav === 'app' && pendientes.some((p) => p.lat != null) ? () => setGuiando(pendientes.find((p) => p.lat != null).id) : null}
          onCorregir={!pendientes.some((p) => p.lat != null) && pendientes.some((p) => p.geo === 'no')
            ? () => editar(pendientes.find((p) => p.geo === 'no')) : null} />
      )}

      {/* ESCANEAR */}
      <div className="rounded-2xl border border-brand-400/40 bg-brand-500/[.08] p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { medirAccion('ruta_escaner'); setEscaner(true) }}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-brand-tinta active:scale-[.99]">
            <ScanLine size={19} /> {tx('Escanear')}
          </button>
          {/* La etiqueta del paquete trae dirección y teléfono: con una foto
              entra en la ruta sin que nadie haya metido la lista antes. Es lo
              que usa el autónomo que carga sus paquetes y sale. */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-400/60 py-3.5 text-[15px] font-bold text-brand-200 active:scale-[.99]">
            {ocupado === 'ticket' ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />} {tx('Foto etiqueta')}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'ticket'}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setNuevo({ ...VACIO }); leerTicket(f) } }} />
          </label>
        </div>
        {total > 0 && (
          <button onClick={() => setMasCarga((v) => !v)} aria-expanded={masCarga}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold text-brand-300">
            {tx('Más formas de añadir')} <ChevronDown size={14} className={masCarga ? 'rotate-180' : ''} />
          </button>
        )}
        {(total === 0 || masCarga) && (<>
        <div className="mt-2.5 flex gap-2">
          <input className={inp} value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="text"
            placeholder={tx('o escribe el código')} onKeyDown={(e) => e.key === 'Enter' && buscar(codigo)} />
          <button onClick={() => buscar(codigo)} disabled={!codigo.trim() || ocupado === 'buscar'}
            className="shrink-0 rounded-xl border border-dark-600 px-4 text-[14px] font-semibold text-dark-100 disabled:opacity-40">
            {ocupado === 'buscar' ? <Loader2 size={15} className="animate-spin" /> : tx('Buscar')}
          </button>
        </div>
        <button onClick={() => setNuevo({ ...VACIO })} className="mt-2 text-[12.5px] font-semibold text-brand-300">
          + {tx('Añadir un pedido sin código')}
        </button>
        {ruta.autonomo && (
          <button onClick={() => setCarga({ n: 0 })}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/10 py-3 text-[14px] font-bold text-amber-200">
            <Package size={17} /> {tx('Cargar paquetes: uno tras otro')}
          </button>
        )}
        {ruta.puede_pegar && (
          <button onClick={() => setPegar({ texto: '', n: null })}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dark-600 py-2.5 text-[13.5px] font-semibold text-dark-100">
            <ClipboardPaste size={16} /> {tx('Pegar una lista de direcciones')}
          </button>
        )}
              </>)}
      </div>

      {aviso && (
        <button onClick={() => setAviso('')} className="mt-3 w-full rounded-xl border border-dark-700 bg-dark-900 px-3.5 py-2.5 text-left text-[13px] text-dark-100">
          {aviso}
        </button>
      )}

      {/* FIN DE LA RUTA: el resumen del día, como al cerrar un bloque. */}
      {total > 0 && pendientes.length === 0 && <Resumen hechos={hechos} ruta={ruta.ruta} />}

      {/* LA RUTA */}
      <div className="mb-2 mt-5 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-dark-50">{tx('{n} por entregar', { n: pendientes.length })}</h2>
        {!reordenar && (
          <div className="flex gap-1.5">
            {pendientes.length > 1 && (
              <button onClick={() => { setReordenar(pendientes.map((p) => p.id)); setVista('lista') }}
                className="inline-flex items-center gap-1 rounded-lg border border-dark-700 px-2 py-1.5 text-[12.5px] font-semibold text-dark-200">
                <ArrowUpDown size={13} /> {tx('A mano')}
              </button>
            )}
            <button onClick={ordenar} disabled={!pendientes.length || ocupado === 'ordenar'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dark-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-dark-200 disabled:opacity-40">
              {ocupado === 'ordenar' ? <Loader2 size={13} className="animate-spin" /> : <Route size={13} />} {tx('Ordenar ruta')}
            </button>
          </div>
        )}
      </div>
      {/* CAMBIAR EL ORDEN A MANO: el repartidor conoce la zona mejor que nadie. */}
      {reordenar && (
        <div className="rounded-2xl border border-brand-400/40 bg-dark-900 p-3">
          <p className="mb-2 text-[12.5px] text-dark-300">{tx('Arrastra cada parada por el asa, o usa las flechas. Al guardar se recalculan las horas con tu orden.')}</p>
          <ol className="flex flex-col gap-1.5">
            {reordenar.map((id, i) => {
              const p = porId[id]
              if (!p) return null
              return (
                <li key={id} ref={(el) => { filasOrden.current[id] = el }}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${arrastrando === id ? 'border-brand-400 bg-brand-500/10 shadow-lg' : 'border-dark-700'}`}>
                  <button type="button" onPointerDown={(e) => empezarArrastre(e, id)} aria-label={`${tx('Arrastrar')} ${p.cliente || p.direccion}`}
                    style={{ touchAction: 'none' }} className="-ml-1 shrink-0 cursor-grab rounded-lg p-1.5 text-dark-400 active:cursor-grabbing"><GripVertical size={18} /></button>
                  <span className="w-6 text-center text-[13px] font-bold text-brand-200">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-dark-50">{p.cliente || p.direccion}</span>
                    {p.cliente && <span className="block truncate text-[12px] text-dark-400">{p.direccion}</span>}
                  </span>
                  <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`${tx('Subir')} ${p.cliente || p.direccion}`}
                    className="rounded-lg border border-dark-700 p-2 text-dark-200 disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button onClick={() => mover(i, 1)} disabled={i === reordenar.length - 1} aria-label={`${tx('Bajar')} ${p.cliente || p.direccion}`}
                    className="rounded-lg border border-dark-700 p-2 text-dark-200 disabled:opacity-30"><ArrowDown size={15} /></button>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
            <button onClick={() => setReordenar(null)} className="rounded-xl border border-dark-600 py-2.5 text-[14px] text-dark-200">{tx('Cancelar')}</button>
            <button onClick={guardarOrden} disabled={ocupado === 'orden'}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-[14px] font-bold text-brand-tinta disabled:opacity-50">
              {ocupado === 'orden' && <Loader2 size={15} className="animate-spin" />} {tx('Guardar este orden')}
            </button>
          </div>
        </div>
      )}

      {!reordenar && pendientes.length > 0 && (
        <div className="mb-2.5 flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-dark-700 p-0.5" role="group" aria-label={tx('Vista')}>
            {[['lista', 'Lista', List], ['mapa', 'Mapa', MapaIcono]].map(([k, t, I]) => (
              <button key={k} onClick={() => setVista(k)} aria-pressed={vista === k}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12.5px] font-semibold ${vista === k ? 'bg-dark-700 text-dark-50' : 'text-dark-400'}`}>
                <I size={13} /> {tx(t)}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1 text-[12px] text-dark-400">
            {tx('Ir con')}
            <select value={nav} onChange={(e) => setNav(e.target.value)} aria-label={tx('Navegador')}
              className="rounded-lg border border-dark-700 bg-dark-900 px-1.5 py-1 text-[12.5px] text-dark-100">
              {(enChina(ruta.pais) ? NAVEGADORES_CHINA : NAVEGADORES).map(([k, t]) => <option key={k} value={k}>{tx(t)}</option>)}
            </select>
          </label>
        </div>
      )}

      {!reordenar && vista === 'mapa' && pendientes.length > 0 && (
        <div className="mb-3">
          <Suspense fallback={<div className="flex h-[420px] items-center justify-center rounded-xl border border-dark-700"><Loader2 className="animate-spin text-dark-500" /></div>}>
            <MapaReparto alto={420} base={yo ? null : ruta.base} yo={yo} trazado={trazado} zonas={verZonas ? zonas?.zonas || SIN_ZONAS : SIN_ZONAS}
              paradas={lista(ruta.pedidos).map((p, i) => ({
                lat: p.lat, lng: p.lng, estado: p.estado, orden: p.orden, color: '#0ea5e9', grande: siguiente?.id === p.id,
                etiqueta: p.orden ?? i + 1, titulo: p.cliente || p.direccion, sub: p.eta ? `≈ ${p.eta} · ${p.direccion}` : p.direccion,
              }))} />
          </Suspense>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-dark-400">
            {trazado?.fuente === 'carreteras'
              ? <><span className="inline-block h-1 w-5 rounded bg-sky-600" /> {tx('Por las calles:')} <b className="text-dark-200">{String(trazado.km).replace('.', ',')} km</b> · {tx('{t} conduciendo (sin contar paradas)', { t: minutosATexto(trazado.minutos) })}</>
              : trazado ? tx('Sin servidor de rutas ahora: rayas rectas entre paradas.') : tx('Calculando el recorrido…')}
          </p>
          <label className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-dark-300">
            <input type="checkbox" checked={verZonas} onChange={(e) => cambiarZonas(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            <span className="rounded bg-violet-600 px-1 text-[9px] font-extrabold leading-4 text-white">C/D</span>
            {tx('Zonas de carga y descarga')}
            {verZonas && zonas && (
              <span className="text-dark-400">
                · {zonas.zonas.length ? tx('{n} cerca de tus paradas', { n: zonas.zonas.length }) : tx('ninguna apuntada cerca')}
                {zonas.incompleto ? ` ${tx('(no se han podido cargar todas)')}` : ''} · OpenStreetMap
              </span>
            )}
          </label>
          {pendientes.some((p) => p.lat == null) && (
            <p className="mt-1 text-[12px] text-amber-200/90">
              {tx('{n} sin situar en el mapa todavía (la dirección no se ha encontrado o se está buscando).', { n: pendientes.filter((p) => p.lat == null).length })}
            </p>
          )}
          {!enChina(ruta.pais) && enlaceVarias(pendientes) && (
            <a href={enlaceVarias(pendientes)} target="_blank" rel="noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/10 py-3 text-[14px] font-bold text-sky-200">
              <Navigation size={16} /> {tx('Las próximas {n} paradas en Google Maps', { n: Math.min(4, pendientes.filter((p) => p.lat != null).length) })}
            </a>
          )}
        </div>
      )}

      {!reordenar && pendientes.length > 5 && (
        <div className="relative mb-2.5">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input className={`${inp} pl-9`} value={filtro} onChange={(e) => setFiltro(e.target.value)}
            placeholder={tx('Buscar cliente, calle, teléfono…')} aria-label={tx('Buscar en la ruta')} />
        </div>
      )}

      {pendientes.length === 0 && total === 0 && (
        <div className="rounded-xl border border-dashed border-dark-700 px-4 py-5 text-center">
          {ruta.autonomo && (
            <button onClick={() => setTour(0)} className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-300 underline underline-offset-2">
              <HelpCircle size={15} /> {tx('¿Cómo funciona?')}
            </button>
          )}
          <p className="text-[13px] text-dark-400">
            {ruta.autonomo
              ? tx('Escanea cada paquete o hazle una foto a la etiqueta: la dirección y el teléfono entran solos. Luego «Ordenar ruta».')
              : tx('Escanea los bultos según los cargas y se irán poniendo aquí.')}
          </p>
          {ruta.autonomo && (
            <button onClick={cargarEjemplo} disabled={ocupado === 'ejemplo'}
              className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/10 py-3 text-[14px] font-bold text-fuchsia-200 disabled:opacity-60">
              {ocupado === 'ejemplo' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {tx('Verlo en acción con 3 paradas de ejemplo')}
            </button>
          )}
        </div>
      )}
      {pendientes.some((p) => p.ejemplo) && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/[.07] px-3 py-2">
          <span className="text-[12.5px] leading-snug text-fuchsia-100">{tx('Estas paradas son de ejemplo.')}</span>
          <button onClick={quitarEjemplos} disabled={ocupado === 'ejemplo'}
            className="shrink-0 rounded-lg border border-fuchsia-400/50 px-2.5 py-1.5 text-[12px] font-bold text-fuchsia-100">{tx('Quitar los ejemplos')}</button>
        </div>
      )}
      {q && visibles.length === 0 && <p className="py-4 text-center text-[13px] text-dark-400">{tx('Nada con «{q}» en las paradas pendientes.', { q: filtro.trim() })}</p>}
      {/* LAS PARADAS. La siguiente, entera y destacada; las demás, en una
          línea (número, cliente, calle, hora) y se despliegan al tocarlas:
          con 80 paradas, una lista de tarjetas enormes no hay quien la lleve. */}
      {!reordenar && (
      <div className="flex flex-col gap-2">
        {visibles.map((p, i) => {
          const esSiguiente = siguiente && p.id === siguiente.id
          const juntas = enPuerta[clavePuerta(p)] || 1
          const etiquetas = (
            <>
              {p.ejemplo && <span className="rounded bg-fuchsia-500/15 px-1.5 font-bold text-fuchsia-300">{tx('EJEMPLO')}</span>}
              {p.prioridad && <span className="rounded bg-amber-500/15 px-1.5 font-bold text-amber-300">{tx('URGENTE')}</span>}
              {p.tipo === 'recogida' && <span className="rounded bg-violet-500/15 px-1.5 font-bold text-violet-300">{tx('RECOGIDA')}</span>}
              {p.cobrar > 0 && <span className="rounded bg-emerald-500/15 px-1.5 font-bold text-emerald-300">{tx('COBRAR')} {euros(p.cobrar)}</span>}
              {p.ventana_desde && <span className="rounded bg-dark-800 px-1.5 text-dark-300">{tx('Horario')} {p.ventana_desde}–{p.ventana_hasta}</span>}
              {p.tarde_min > 0 && <span className="rounded bg-red-500/15 px-1.5 text-red-300">{tx('llega {n} min tarde', { n: p.tarde_min })}</span>}
              {juntas > 1 && <span className="rounded bg-sky-500/15 px-1.5 font-semibold text-sky-300">{tx('{n} paradas en esta puerta', { n: juntas })}</span>}
            </>
          )
          const hayEtiquetas = p.ejemplo || p.prioridad || p.tipo === 'recogida' || p.cobrar > 0 || p.ventana_desde || p.tarde_min > 0 || juntas > 1
          if (!esSiguiente && abierta !== p.id) {
            return (
              <div key={p.id} className="flex items-stretch gap-1 rounded-2xl border border-dark-800 bg-dark-900/70">
                <button onClick={() => setAbierta(p.id)} aria-label={`${tx('Ver la parada {n}', { n: p.orden ?? i + 1 })}: ${p.cliente || p.direccion}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-brand-400/50 px-1.5 text-[12.5px] font-bold text-brand-200">{p.orden ?? i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-dark-50">{p.cliente || p.direccion}</span>
                      {p.eta && <span className={`shrink-0 text-[12.5px] font-semibold ${p.tarde_min ? 'text-red-300' : 'text-dark-300'}`}>{p.eta}</span>}
                    </span>
                    {p.cliente && <span className="block truncate text-[12.5px] text-dark-400">{p.direccion}</span>}
                    {(hayEtiquetas || p.hueco) && (
                      <span className="mt-1 flex flex-wrap gap-1 text-[10.5px]">
                        {etiquetas}
                        {p.hueco && <span className="rounded bg-sky-500/15 px-1.5 text-sky-200">{tx(p.hueco)}</span>}
                      </span>
                    )}
                  </span>
                </button>
                {nav === 'app' && p.lat != null ? (
                  <button onClick={() => setGuiando(p.id)} aria-label={`${tx('Ir a')} ${p.cliente || p.direccion}`}
                    className="flex w-12 shrink-0 items-center justify-center border-l border-dark-800 text-brand-300"><Navigation size={17} /></button>
                ) : (
                  <a href={navegar(p, nav === 'app' ? (enChina(ruta.pais) ? 'amap' : 'google') : nav)} target="_blank" rel="noreferrer" aria-label={`${tx('Ir a')} ${p.cliente || p.direccion}`}
                    className="flex w-12 shrink-0 items-center justify-center border-l border-dark-800 text-dark-300"><Navigation size={17} /></a>
                )}
              </div>
            )
          }
          return (
          <div key={p.id} className={`rounded-2xl border p-3.5 ${esSiguiente ? 'border-brand-400/70 bg-gradient-to-b from-brand-500/[.12] to-dark-900 shadow-lg shadow-black/20' : 'border-dark-600 bg-dark-900'}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className={`text-[11px] font-bold uppercase tracking-wider ${esSiguiente ? 'text-brand-300' : 'text-dark-400'}`}>{esSiguiente ? tx('Siguiente parada') : tx('Parada {n}', { n: p.orden ?? i + 1 })}</p>
              {!esSiguiente && <button onClick={() => setAbierta(null)} className="text-[12px] font-semibold text-dark-400">{tx('Plegar')}</button>}
            </div>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex items-center justify-center rounded-full bg-brand-500 px-1.5 font-bold text-brand-tinta ${esSiguiente ? 'h-9 min-w-9 text-[15px]' : 'h-7 min-w-7 text-[13px]'}`}>{p.orden ?? i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={`${esSiguiente ? 'text-[18px]' : 'text-[15px]'} font-bold leading-tight text-dark-50`}>{p.cliente || tx('Cliente')}</p>
                  {p.eta && <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[13px] font-bold ${p.tarde_min ? 'bg-red-500/15 text-red-300' : 'bg-brand-500/15 text-brand-200'}`}>≈ {p.eta}</span>}
                </div>
                {hayEtiquetas && <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">{etiquetas}</div>}
                <p className={`${esSiguiente ? 'text-[14.5px]' : 'text-[13px]'} mt-0.5 leading-snug text-dark-200`}>{p.direccion}</p>
                {p.telefono && <p className="text-[12.5px] text-dark-400">{p.telefono}</p>}
                {p.contenido && <p className="mt-1 flex items-start gap-1 text-[12.5px] text-dark-400"><Package size={13} className="mt-0.5 shrink-0" /> {p.contenido}</p>}
                <p className="mt-0.5 text-[11.5px] text-dark-500">
                  {p.bultos > 1 ? tx('{n} bultos', { n: p.bultos }) : tx('1 bulto')}{p.escaneos ? ` · ${p.escaneos > 1 ? tx('{n} escaneados', { n: p.escaneos }) : tx('1 escaneado')}` : ''}
                  {p.lat == null && ` · ${tx('sin ubicar en el mapa')}`}{p.geo === 'aprox' && ` · ${tx('ubicación aproximada (la calle)')}`}{p.notas && ` · ${p.notas}`}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button onClick={() => setHuecoDe(p)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold ${p.hueco ? 'bg-sky-500/15 text-sky-200' : 'border border-dashed border-dark-700 text-dark-400'}`}>
                    <Package size={12} /> {p.hueco ? tx('En la furgoneta: {sitio}', { sitio: tx(p.hueco) }) : tx('¿Dónde va en la furgoneta?')}
                  </button>
                  {/* VER LA PUERTA antes de llegar: solo si la dirección está situada en su portal
                      (no «aproximada», que es solo la calle) y fuera de China (sin Street View). */}
                  {p.lat != null && p.geo !== 'aprox' && ruta.pais !== 'cn' && <VerPuerta p={p} />}
                  <button onClick={() => editar(p)} aria-label={`${tx('Editar parada')}: ${p.cliente || p.direccion}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-dark-700 px-2 py-1 text-[12px] font-semibold text-dark-200">
                    <Pencil size={12} /> {tx('Editar')}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {nav === 'app' && p.lat != null ? (
                <button onClick={() => setGuiando(p.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] ${esSiguiente ? 'bg-brand-500 font-bold text-brand-tinta' : 'border border-dark-700 text-dark-200'}`}><Navigation size={16} /> {tx('Ir')}</button>
              ) : (
                <a href={navegar(p, nav === 'app' ? (enChina(ruta.pais) ? 'amap' : 'google') : nav)} target="_blank" rel="noreferrer"
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] ${esSiguiente ? 'bg-brand-500 font-bold text-brand-tinta' : 'border border-dark-700 text-dark-200'}`}><Navigation size={16} /> {tx('Ir')}</a>
              )}
              {p.telefono
                ? <a href={`tel:${p.telefono}`} className="flex flex-col items-center gap-0.5 rounded-xl border border-dark-700 py-2 text-[11px] text-dark-200"><Phone size={16} /> {tx('Llamar')}</a>
                : <span className="flex flex-col items-center gap-0.5 rounded-xl border border-dark-800 py-2 text-[11px] text-dark-600"><Phone size={16} /> {tx('Sin teléfono')}</span>}
              {ruta.pais === 'cn' ? (p.telefono
                ? <a href={`sms:${p.telefono.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(mensaje(p, ruta.empresa))}`}
                    className="flex flex-col items-center gap-0.5 rounded-xl border border-emerald-600/50 py-2 text-[11px] text-emerald-300"><MessageCircle size={16} /> {tx('SMS')}</a>
                : <span className="flex flex-col items-center gap-0.5 rounded-xl border border-dark-800 py-2 text-[11px] text-dark-600"><MessageCircle size={16} /> —</span>)
              : movilWhatsApp(p.telefono, ruta.pais, ruta.prefijo)
                ? <a href={`https://wa.me/${movilWhatsApp(p.telefono, ruta.pais, ruta.prefijo)}?text=${encodeURIComponent(mensaje(p, ruta.empresa))}`} target="_blank" rel="noreferrer"
                    className="flex flex-col items-center gap-0.5 rounded-xl border border-emerald-600/50 py-2 text-[11px] text-emerald-300"><MessageCircle size={16} /> WhatsApp</a>
                : <span className="flex flex-col items-center gap-0.5 rounded-xl border border-dark-800 py-2 text-[11px] text-dark-600"><MessageCircle size={16} /> —</span>}
            </div>
            <div className="mt-1.5 grid grid-cols-[1fr_2fr] gap-1.5">
              <button onClick={() => setFallo(p)} disabled={ocupado === p.id} className="flex items-center justify-center gap-1 rounded-xl border border-red-500/30 py-3 text-[13px] text-red-300"><X size={15} /> {p.tipo === 'recogida' ? tx('No recogido') : tx('No entregado')}</button>
              <button onClick={() => marcar(p, 'entregado')} disabled={ocupado === p.id} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-3 text-[15px] font-bold text-white active:scale-[.99]">
                {ocupado === p.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />} {p.tipo === 'recogida' ? tx('Recogido') : tx('Entregado')}
              </button>
            </div>
          </div>
          )
        })}
      </div>
      )}
      {/* LO HECHO HOY, Y CORREGIBLE (10-10-2026): un «no entregado» se puede
          volver a intentar (vuelve a la ruta) o dar por entregado si al final se
          entregó; un entregado por error, pasarlo a no entregado. Si hay
          incidencias, la lista sale abierta. */}
      {hechos.length > 0 && (
        <details className="mt-4" open={hechos.some((p) => p.estado === 'fallido')}>
          <summary className="cursor-pointer text-[13px] text-dark-400">
            {tx('{n} hechos hoy', { n: hechos.length })}
            {hechos.some((p) => p.estado === 'fallido') && <span className="text-red-300"> · {tx('{n} sin entregar', { n: hechos.filter((p) => p.estado === 'fallido').length })}</span>}
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {hechos.map((p) => (
              <div key={p.id} className={`rounded-xl border px-3 py-2 text-[12.5px] ${p.estado === 'fallido' ? 'border-red-500/30 bg-red-500/[.05]' : 'border-dark-800'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-dark-200">{p.cliente || p.direccion}</span>
                  <span className={`shrink-0 ${p.estado === 'entregado' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {p.estado === 'entregado' ? `${tx('Entregado')}${p.cobrado_importe ? ` · ${euros(p.cobrado_importe)}` : ''}` : `${tx('No')} · ${p.motivo ? tx(p.motivo) : ''}`}
                  </span>
                </div>
                {p.estado === 'fallido' ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button onClick={() => marcar(p, 'pendiente', '')} disabled={ocupado === p.id}
                      className="flex items-center justify-center gap-1 rounded-lg border border-brand-400/50 py-2 text-[12.5px] font-semibold text-brand-200">
                      <RotateCcw size={13} /> {tx('Volver a intentarlo')}
                    </button>
                    <button onClick={() => marcar(p, 'entregado')} disabled={ocupado === p.id}
                      className="flex items-center justify-center gap-1 rounded-lg bg-emerald-700 py-2 text-[12.5px] font-bold text-white">
                      <Check size={13} /> {p.tipo === 'recogida' ? tx('Recogido') : tx('Entregado')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setFallo(p)} disabled={ocupado === p.id}
                    className="mt-1 text-[11.5px] font-semibold text-dark-400 underline underline-offset-2">{tx('Corregir: no se entregó')}</button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {encontrado && (
        <Hoja titulo={tx('Este paquete va en la parada')} onClose={() => setEncontrado(null)}>
          <div className="flex items-center gap-4">
            <span className="flex h-20 min-w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-500 px-3 text-[40px] font-extrabold text-brand-tinta">{encontrado.orden ?? '—'}</span>
            <div className="min-w-0">
              <p className="text-[18px] font-bold leading-tight text-dark-50">{encontrado.cliente || tx('Cliente')}</p>
              <p className="mt-0.5 text-[14px] leading-snug text-dark-200">{encontrado.direccion}</p>
              <p className="mt-1 text-[12.5px] text-dark-400">{tx('bulto {a} de {b}', { a: encontrado.escaneos, b: encontrado.bultos })}</p>
            </div>
          </div>
          {encontrado.orden == null && <p className="mt-3 text-[12.5px] text-amber-200">{tx('Aún sin número: pulsa «Ordenar ruta» y tendrá su parada.')}</p>}
          <p className="mb-1.5 mt-4 text-[13px] text-dark-300">{tx('¿Dónde lo dejas en la furgoneta?')}</p>
          <HuecoRejilla valor={encontrado.hueco} ocupado={ocupado === `hueco-${encontrado.id}`} onElegir={(h) => ponerHueco(encontrado, h)} />
          <button onClick={() => { setEncontrado(null); setEscaner(true) }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta">
            <ScanLine size={18} /> {tx('Escanear el siguiente')}
          </button>
        </Hoja>
      )}

      {huecoDe && (
        <Hoja titulo={tx('¿Dónde va en la furgoneta?')} onClose={() => setHuecoDe(null)}>
          <p className="mb-3 text-[13px] text-dark-400">{huecoDe.cliente || huecoDe.direccion}. {tx('Al llegar sabrás dónde buscarlo.')}</p>
          <HuecoRejilla valor={huecoDe.hueco} ocupado={ocupado === `hueco-${huecoDe.id}`} onElegir={(h) => ponerHueco(huecoDe, h)} />
          {huecoDe.hueco && (
            <button onClick={() => ponerHueco(huecoDe, '')} className="mt-3 w-full rounded-xl border border-dark-600 py-2.5 text-[13.5px] text-dark-200">{tx('Quitar')}</button>
          )}
        </Hoja>
      )}

      {tour >= 0 && (() => {
        const PASOS = [
          [ScanLine, tx('1. Mete tus paquetes'), tx('Escanea el código o haz una foto a la etiqueta: la dirección y el teléfono entran solos. También puedes escribirla o pegar una lista.')],
          [Route, tx('2. Ordena la ruta'), tx('Pulsa «Ordenar ruta»: la app pone las paradas en el orden que menos tardas, con el tráfico de cada hora y la hora de llegada a cada una.')],
          [Navigation, tx('3. Navega y entrega'), tx('Pulsa «Empezar a navegar»: te lleva con voz a cada puerta. Al llegar, «Entregado» con foto o firma, y pasa a la siguiente.')],
        ]
        const [Icono, titulo, texto] = PASOS[tour]
        const ultimo = tour === PASOS.length - 1
        return (
          <Hoja titulo={tx('Así funciona')} onClose={() => setTour(-1)}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300"><Icono size={22} /></span>
              <div>
                <p className="text-[17px] font-bold text-dark-50">{titulo}</p>
                <p className="mt-1 text-[14px] leading-snug text-dark-300">{texto}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
              {PASOS.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === tour ? 'w-6 bg-brand-400' : 'w-1.5 bg-dark-600'}`} />)}
            </div>
            {!ultimo ? (
              <button onClick={() => setTour(tour + 1)} className="mt-4 w-full rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta">{tx('Siguiente')}</button>
            ) : (
              <>
                {pendientes.length === 0 && (
                  <button onClick={() => { setTour(-1); medirAccion('tour_ejemplo'); cargarEjemplo() }} disabled={ocupado === 'ejemplo'}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta">
                    <Play size={16} /> {tx('Verlo en acción con 3 paradas de ejemplo')}
                  </button>
                )}
                <button onClick={() => setTour(-1)} className="mt-2 w-full rounded-xl border border-dark-700 py-2.5 text-[14px] font-semibold text-dark-200">{tx('Empezar con mis paquetes')}</button>
              </>
            )}
          </Hoja>
        )
      })()}
      {tarifa && (
        <Hoja titulo={tx('Mi dinero hoy')} onClose={() => setTarifa(null)}>
          <p className="mb-3 text-[13px] text-dark-400">{tx('Pon cómo te pagan y la app te dice cuánto llevas ganado hoy, la gasolina y lo que te queda limpio.')}</p>
          {[['parada', tx('Te pagan por cada entrega ({moneda})', { moneda: simboloMoneda() }), simboloMoneda() === '€' ? '1,10' : '0'],
            ['dia', tx('Fijo por día, si te pagan así ({moneda})', { moneda: simboloMoneda() }), '0'],
            ['km', tx('Gasolina por km ({moneda})', { moneda: simboloMoneda() }), simboloMoneda() === '€' ? '0,12' : '0']].map(([k, t, ej]) => (
            <label key={k} className="mb-2.5 block">
              <span className="mb-1 block text-[13px] font-semibold text-dark-200">{t}</span>
              <input className={inp} inputMode="decimal" value={tarifa[k]} placeholder={ej}
                onChange={(e) => setTarifa({ ...tarifa, [k]: e.target.value.replace(/[^0-9.,]/g, '') })} />
            </label>
          ))}
          <p className="mb-3 text-[12px] text-dark-500">{simboloMoneda() === '€' ? tx('Una furgoneta diésel gasta unos 0,10–0,15 € por km. Solo lo ves tú.') : tx('Pon lo que gasta tu vehículo por km. Solo lo ves tú.')}</p>
          <button onClick={guardarTarifa} disabled={ocupado === 'tarifa' || (!aCent(tarifa.parada) && !aCent(tarifa.dia))}
            className="w-full rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta disabled:opacity-40">
            {ocupado === 'tarifa' ? tx('Guardando…') : tx('Guardar')}
          </button>
        </Hoja>
      )}
      {pegar && (
        <Hoja titulo={tx('Pegar una lista de direcciones')} onClose={() => setPegar(null)}>
          <p className="mb-2 text-[13px] text-dark-400">
            {tx('Una parada por línea (de un correo, un Excel, un WhatsApp…). Si hay columnas con cabecera (dirección, cliente, teléfono, horario…), se leen.')}
          </p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-400/60 py-2.5 text-[13.5px] font-bold text-brand-200">
              {ocupado === 'hoja' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {ocupado === 'hoja' ? tx('Leyendo…') : tx('Foto de la hoja')}
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'hoja'}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; leerHoja(f) }} />
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dark-600 py-2.5 text-[13.5px] font-semibold text-dark-100">
              <FileUp size={16} /> {tx('Abrir un fichero')}
              <input type="file" accept=".csv,.txt,.tsv,text/plain,text/csv,text/tab-separated-values,.xlsx,.xls,.pdf" className="hidden" aria-label={tx('Abrir un fichero')}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; abrirFichero(f) }} />
            </label>
          </div>
          {pegar.nota && <p role="status" className="mb-2 text-[12.5px] text-amber-200/90">{pegar.nota}</p>}
          <textarea className={`${inp} h-40 font-mono text-[13px]`} value={pegar.texto} aria-label={tx('Lista de direcciones')}
            onChange={(e) => setPegar({ texto: e.target.value, n: null, nota: pegar.nota })}
            placeholder={'Calle Mayor 3, 28013 Madrid\nAvenida de la Constitución 12, Sevilla'} />
          {pegar.n == null ? (
            <button onClick={() => pegarLista(false)} disabled={pegar.texto.trim().length < 5 || ocupado === 'pegar'}
              className="mt-3 w-full rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta disabled:opacity-40">
              {ocupado === 'pegar' ? tx('Leyendo…') : tx('Revisar')}
            </button>
          ) : (
            <button onClick={() => pegarLista(true)} disabled={ocupado === 'pegar'}
              className="mt-3 w-full rounded-xl bg-emerald-700 py-3 text-[15px] font-bold text-white disabled:opacity-40">
              {ocupado === 'pegar' ? tx('Añadiendo…') : pegar.n === 1 ? tx('Añadir 1 parada a mi ruta') : tx('Añadir {n} paradas a mi ruta', { n: pegar.n })}
            </button>
          )}
        </Hoja>
      )}

      {guiando && (
        <Suspense fallback={<div className="fixed inset-0 z-[45] flex items-center justify-center bg-dark-950"><Loader2 className="animate-spin text-dark-400" /></div>}>
          <Navegacion parada={objetivo} numero={objetivo?.orden ?? (objetivo ? pendientes.indexOf(objetivo) + 1 : null)}
            quedan={pendientes.length} onSalir={() => setGuiando(null)}
            onEntregar={(p) => marcar(p, 'entregado')} onNoEntregar={(p) => setFallo(p)}
            onEntregarVoz={(p) => marcar(p, 'entregado', undefined, undefined, {})} onDeshacer={deshacer ? deshacerUltima : null}
            enlaceFuera={(p) => navegar(p, fuera)} nombreFuera={nombreNavegador(fuera)} />
        </Suspense>
      )}

      {deshacer && (
        <div className="fixed inset-x-0 bottom-20 z-[46] flex justify-center px-4" role="status">
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-dark-600 bg-dark-800 px-4 py-3 shadow-2xl">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${deshacer.estado === 'entregado' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
              {deshacer.estado === 'entregado' ? <Check size={16} /> : <X size={16} />}
            </span>
            <span className="min-w-0 flex-1 text-[13px] leading-tight text-dark-100">
              <b className="block truncate">{deshacer.estado === 'entregado' ? (deshacer.p.tipo === 'recogida' ? tx('Recogido') : tx('Entregado')) : tx('No entregado')} · {deshacer.p.cliente || deshacer.p.direccion}</b>
              {siguiente && siguiente.id !== deshacer.p.id && <span className="block truncate text-dark-400">{tx('Siguiente:')} {siguiente.cliente || siguiente.direccion}{siguiente.eta ? ` ≈ ${siguiente.eta}` : ''}</span>}
            </span>
            <button onClick={deshacerUltima} className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-bold text-brand-300">{tx('Deshacer')}</button>
          </div>
        </div>
      )}

      {escaner && <Escaner onCodigo={buscar} onClose={() => setEscaner(false)} />}
      {seguidos?.abierto && (
        <Escaner seguido onCodigo={escaneoSeguido} onClose={cerrarSeguidos}
          estado={seguidos.nuevos + seguidos.yaEstaban + seguidos.revisar.length === 0 ? '' : [tx('{n} añadidos', { n: seguidos.nuevos }),
            seguidos.yaEstaban ? tx('{n} ya estaban', { n: seguidos.yaEstaban }) : '',
            seguidos.revisar.length ? tx('{n} para revisar', { n: seguidos.revisar.length }) : '',
            seguidos.enCola ? `${seguidos.enCola} ${tx('en cola')}` : ''].filter(Boolean).join(' · ')
            + (seguidos.ultimo ? `\n${seguidos.ultimo}` : '')} />
      )}

      {carga && !nuevo && !seguidos?.abierto && (
        <Hoja titulo={carga.n ? (carga.n > 1 ? tx('{n} paquetes cargados', { n: carga.n }) : tx('1 paquete cargado')) : tx('Cargar paquetes')} onClose={() => setCarga(null)}>
          <p className="mb-3 text-[13px] text-dark-400">
            {tx('Haz una foto a la etiqueta de cada paquete: se lee el código, la dirección y el teléfono. Al acabar, «Montar ruta».')}
          </p>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-[16px] font-bold text-brand-tinta">
            {ocupado === 'ticket' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {ocupado === 'ticket' ? tx('Leyendo…') : carga.n ? tx('Siguiente paquete') : tx('Primer paquete')}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'ticket'}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setNuevo({ ...VACIO }); leerTicket(f) } }} />
          </label>
          <button onClick={() => { medirAccion('ruta_escaner'); setSeguidos((s) => ({ nuevos: 0, yaEstaban: 0, revisar: s?.revisar || [], ultimo: '', abierto: true })) }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-400/60 py-3 text-[14px] font-bold text-brand-200">
            <ScanLine size={17} /> {tx('Escanear seguidos')}
          </button>
          {seguidos?.revisar?.length > 0 && (
            <button onClick={revisarSiguiente} className="mt-2 w-full rounded-xl border border-amber-400/60 bg-amber-500/10 py-3 text-[14px] font-bold text-amber-200">
              {tx('Revisar {n} paquetes sin dirección', { n: seguidos.revisar.length })}
            </button>
          )}
          <button onClick={() => { setNuevo({ ...VACIO }) }} className="mt-2 w-full rounded-xl border border-dark-600 py-3 text-[14px] font-semibold text-dark-100">
            {tx('Escribirlo a mano')}
          </button>
          <button onClick={() => { setCarga(null); if (pendientes.length) ordenar() }} disabled={ocupado === 'ordenar'}
            className="mt-3 w-full rounded-xl bg-emerald-700 py-3.5 text-[15px] font-bold text-white disabled:opacity-50">
            {carga.n || pendientes.length ? <><Route size={16} className="mr-1 inline" /> {tx('Montar ruta y empezar')}</> : tx('Cerrar')}
          </button>
        </Hoja>
      )}

      {nuevo && (
        <Hoja titulo={nuevo.id ? tx('Editar parada') : nuevo.codigo ? tx('El código {c} no está en la lista', { c: nuevo.codigo }) : tx('Pedido nuevo')} onClose={() => { setNuevo(null); setQuitando(false) }}>
          {!nuevo.id && <>
          <label className="mb-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta">
            {ocupado === 'ticket' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {ocupado === 'ticket' ? tx('Leyendo el ticket…') : tx('Foto del ticket')}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'ticket'}
              onChange={(e) => { leerTicket(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <p className="mb-3 text-center text-[11.5px] text-dark-500">
            {ruta.ia_tickets ? tx('Lo lee la IA y la foto no se guarda.') : tx('Se lee en tu móvil: la foto no se envía a ningún sitio. La primera vez tarda un poco.')}
          </p>
          </>}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input ref={dirInput} className={inp} placeholder={escuchando ? tx('Te escucho: di la dirección…') : tx('Dirección completa')} value={nuevo.direccion} autoComplete="street-address"
                onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value, lat: null, lng: null })} />
              <button type="button" onClick={dictar} aria-label={escuchando ? tx('Parar de dictar') : tx('Dictar la dirección')} aria-pressed={escuchando}
                className={`shrink-0 rounded-xl border px-3 ${escuchando ? 'animate-pulse border-red-400 bg-red-500/15 text-red-300' : 'border-dark-600 text-dark-200'}`}>
                <Mic size={18} />
              </button>
            </div>
            {escuchando && <p className="-mt-1 text-[12px] font-semibold text-red-300">{tx('Te escucho: di la dirección…')}</p>}
            {sugs.length > 0 && (
              <ul className="-mt-1 overflow-hidden rounded-xl border border-dark-700 bg-dark-900" aria-label={tx('Direcciones sugeridas')}>
                {sugs.map((sg) => (
                  <li key={sg.direccion}>
                    <button type="button" onClick={() => { setNuevo({ ...nuevo, direccion: sg.direccion, cp: sg.cp, localidad: sg.localidad, lat: sg.lat, lng: sg.lng }); setSugs([]) }}
                      className="flex w-full items-center gap-2 border-b border-dark-800 px-3 py-2.5 text-left text-[14px] text-dark-100 last:border-0 active:bg-dark-800">
                      <MapPin size={15} className="shrink-0 text-brand-300" /> <span className="min-w-0 flex-1 truncate">{sg.direccion}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {nuevo.lat != null && <p className="-mt-1 flex items-center gap-1 text-[12px] text-emerald-300"><Check size={13} /> {tx('Sitio encontrado en el mapa')}</p>}
            <input className={inp} placeholder={tx('Cliente')} value={nuevo.cliente} onChange={(e) => setNuevo({ ...nuevo, cliente: e.target.value })} />
            <input className={inp} placeholder={tx('Teléfono')} inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
            <input className={inp} placeholder={tx('Qué lleva')} value={nuevo.contenido} onChange={(e) => setNuevo({ ...nuevo, contenido: e.target.value })} />
            <input className={inp} placeholder={tx('Horario del cliente (ej. de 10 a 12)')} value={nuevo.horario || ''} onChange={(e) => setNuevo({ ...nuevo, horario: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inp} inputMode="decimal" placeholder={tx('A cobrar ({moneda})', { moneda: simboloMoneda() })} value={nuevo.cobrar || ''} onChange={(e) => setNuevo({ ...nuevo, cobrar: e.target.value })} />
              <select className={inp} value={nuevo.tipo || 'entrega'} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} aria-label={tx('Tipo de parada')}>
                <option value="entrega">{tx('Entrega')}</option>
                <option value="recogida">{tx('Recogida')}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-[14px] text-dark-200">
              <input type="checkbox" checked={!!nuevo.prioridad} onChange={(e) => setNuevo({ ...nuevo, prioridad: e.target.checked })} /> {tx('Urgente')}
            </label>
            <div className="flex items-center gap-2 text-[13px] text-dark-300">
              {tx('Bultos')} <input className={`${inp} w-20`} type="number" min="1" max="99" value={nuevo.bultos} onChange={(e) => setNuevo({ ...nuevo, bultos: e.target.value })} />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] text-dark-300">{tx('¿Dónde lo dejas en la furgoneta?')} <span className="text-dark-500">{tx('(opcional)')}</span></p>
              <HuecoRejilla valor={nuevo.hueco} onElegir={(h) => setNuevo({ ...nuevo, hueco: nuevo.hueco === h ? '' : h })} />
            </div>
          </div>
          {nuevo.de_ticket && <p className="mt-2 text-[12px] text-amber-200/90">{tx('Revisa lo leído del ticket antes de guardar.')}</p>}
          <button onClick={guardarNuevo} disabled={nuevo.direccion.trim().length < 4 || ocupado === 'guardar'}
            className="mt-3 w-full rounded-xl bg-emerald-700 py-3 text-[15px] font-bold text-white disabled:opacity-40">
            {ocupado === 'guardar' ? tx('Guardando…') : nuevo.id ? tx('Guardar cambios') : tx('Añadir a mi ruta')}
          </button>
          {nuevo.id && (
            <button onClick={quitarParada} disabled={ocupado === 'guardar'}
              className={`mt-2 w-full rounded-xl border py-3 text-[14px] font-semibold ${quitando ? 'border-red-400 bg-red-500/15 text-red-200' : 'border-red-500/30 text-red-300'}`}>
              {quitando ? tx('¿Seguro? Toca otra vez para quitarla') : tx('Quitar esta parada')}
            </button>
          )}
        </Hoja>
      )}

      {cobro && (
        <Hoja titulo={`${tx('Cobrar')} ${euros(cobro.cobrar)}`} onClose={() => setCobro(null)}>
          <p className="mb-3 text-[13px] text-dark-400">{tx('¿Cómo ha pagado?')}</p>
          <div className="grid grid-cols-3 gap-2">
            {metodosCobro().map(([k, t]) => (
              <button key={k} onClick={() => marcar(cobro, 'entregado', '', { metodo: k })}
                className="rounded-xl bg-emerald-700 py-3.5 text-[15px] font-bold text-white">{tx(t)}</button>
            ))}
          </div>
          <button onClick={() => marcar(cobro, 'fallido', 'No ha pagado')}
            className="mt-3 w-full rounded-xl border border-red-500/30 py-3 text-[14px] text-red-300">{tx('No ha pagado: no lo entrego')}</button>
        </Hoja>
      )}

      {prueba && (
        <Hoja titulo={tx('Prueba de entrega')} onClose={() => setPrueba(null)}>
          {prueba.p.tipo !== 'recogida' && (
            <div className="mb-3">
              <p className="mb-1.5 text-[13px] text-dark-300">{tx('¿Dónde lo dejas?')}</p>
              <div className="flex flex-wrap gap-1.5">
                {DONDE.map(([k, t]) => (
                  <button key={k} type="button" aria-pressed={entrega.donde === k}
                    onClick={() => setEntrega({ ...entrega, donde: entrega.donde === k ? '' : k })}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${entrega.donde === k ? 'bg-brand-500 text-brand-tinta' : 'border border-dark-700 text-dark-200'}`}>{tx(t)}</button>
                ))}
              </div>
              {CON_QUIEN.includes(entrega.donde) && (
                <div className="mt-2 space-y-2">
                  <input className={inp} placeholder={tx('¿Quién lo recoge? (opcional)')} value={entrega.recibe} autoComplete="off"
                    onChange={(e) => setEntrega({ ...entrega, recibe: e.target.value })} />
                  {entrega.firmando
                    ? <Firma onListo={(firma) => setEntrega({ ...entrega, firma, firmando: false })} onCancelar={() => setEntrega({ ...entrega, firmando: false })} />
                    : (
                      <button type="button" onClick={() => setEntrega({ ...entrega, firmando: true })}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-semibold ${entrega.firma ? 'bg-emerald-500/15 text-emerald-200' : 'border border-dark-600 text-dark-100'}`}>
                        {entrega.firma ? <Check size={16} /> : <PenLine size={16} />} {entrega.firma ? tx('Firmado · repetir') : tx('Que firme en la pantalla')}
                      </button>
                    )}
                </div>
              )}
            </div>
          )}
          <p className="mb-3 text-[13px] text-dark-400">
            {tx('Una foto del paquete donde lo dejas (en el portal, con el vecino…) evita discusiones después.')}
            <b className="text-dark-200"> {tx('Sin personas en la foto.')}</b> {tx('Es opcional.')}
          </p>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-brand-tinta">
            {ocupado === 'foto' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {ocupado === 'foto' ? tx('Guardando…') : tx('Hacer foto y entregar')}
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
                  await marcar(prueba.p, 'entregado', '', prueba.pago || { sin_cobro: true }, { foto, ...datosEntrega() })
                } catch { setAviso(tx('No se pudo guardar la foto')); setOcupado('') }
              }} />
          </label>
          <input className={`${inp} mt-2`} placeholder={tx('Nota (opcional): «al vecino del 2º», «en el buzón»…')} value={notaEntrega}
            onChange={(e) => setNotaEntrega(e.target.value)} />
          <button onClick={() => marcar(prueba.p, 'entregado', '', prueba.pago || { sin_cobro: true }, datosEntrega())}
            disabled={!!ocupado}
            className="mt-3 w-full rounded-xl border border-dark-600 py-3 text-[14px] font-semibold text-dark-100">
            {tx('Entregar sin foto')}
          </button>
        </Hoja>
      )}

      {fallo && (
        <Hoja titulo={fallo.tipo === 'recogida' ? tx('¿Por qué no se ha recogido?') : tx('¿Por qué no se ha entregado?')} onClose={() => setFallo(null)}>
          <div className="flex flex-col gap-2">
            {MOTIVOS.map((m) => (
              <button key={m} onClick={() => marcar(fallo, 'fallido', m)}
                className="rounded-xl border border-dark-700 bg-dark-900 py-3 text-[14px] text-dark-100">{tx(m)}</button>
            ))}
          </div>
        </Hoja>
      )}

      {verAviso && (
        <Hoja titulo={tx('Antes de empezar: tu ubicación')} onClose={() => setVerAviso(false)}>
          <div className="space-y-2 text-[13.5px] leading-relaxed text-dark-300">
            <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-300" />
              {tx('Mientras tengas la jornada empezada, la oficina de tu empresa verá en el mapa por dónde vas, para organizar el reparto y avisar a los clientes.')}</p>
            <p>{tx('Solo se comparte desde que pulses «Empezar jornada» hasta que pulses «Terminar». Fuera de la jornada no se guarda nada.')}</p>
            <p>{tx('El recorrido se borra a los 30 días. Lo ve solo tu empresa, que es la responsable de estos datos; puedes pedirle acceso o explicaciones cuando quieras.')}</p>
          </div>
          <button onClick={() => jornada('empezar', true)} disabled={ocupado === 'jornada'}
            className="mt-4 w-full rounded-xl bg-brand-500 py-3 text-[15px] font-bold text-brand-tinta">
            {tx('Entendido, empezar jornada')}
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
          <button onClick={onBack} className="rounded-lg border border-dark-700 p-2 text-dark-400" aria-label={tx('Volver')}><ArrowLeft size={16} /></button>
          <h1 className="font-display text-[22px] font-bold text-dark-50">{tx('Mi ruta')}</h1>
        </header>
        {children}
      </div>
    </div>
  )
}

/* LA CABECERA DEL DÍA: anillo de progreso, lo que queda y a qué hora se
   acaba. «Vas X min por detrás» compara la hora de ahora con la prevista
   para la parada siguiente; solo sale si de verdad va más de 5 min tarde. */
/* `onCorregir` (06-10-2026): a Arturo no le salía «Empezar a navegar» y no sabía por qué. Su
   única parada no estaba en el mapa (la dirección no se encontró) y sin un punto no hay
   adónde guiar; el aviso quedaba abajo, debajo del mapa. Ahora lo dice aquí y lleva a
   corregirla: al escribirla salen sugerencias, y elegir una la sitúa. */
function Cabecera({ fecha, hechos, total, entregados, pendientes, rr, retraso, cobrado, fueraHorario, onGuiar, onCorregir, dinero, onTarifa, onCompartir }) {
  const pct = total ? hechos / total : 0
  const R = 26
  const L = 2 * Math.PI * R
  let dia = ''
  try { dia = new Date(`${fecha}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }) } catch { dia = '' }
  return (
    <section aria-label={tx('Progreso del día')}
      className="mb-3 overflow-hidden rounded-3xl border border-brand-400/30 bg-gradient-to-br from-brand-500/[.18] via-dark-900 to-dark-900 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="relative h-[68px] w-[68px] shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" className="stroke-dark-700" />
            <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
              className="stroke-brand-400 transition-all duration-700" strokeDasharray={L} strokeDashoffset={L * (1 - pct)} />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <b className="text-[17px] text-dark-50">{hechos}</b>
            <span className="text-[10.5px] text-dark-400">{tx('de {n}', { n: total })}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {dia && <p className="text-[11.5px] font-semibold uppercase tracking-wider text-brand-300">{dia}</p>}
          <p className="text-[19px] font-bold leading-tight text-dark-50">
            {pendientes ? (pendientes === 1 ? tx('Queda 1 parada') : tx('Quedan {n} paradas', { n: pendientes })) : tx('Todo hecho')}
          </p>
          {pendientes > 0 && rr?.fin && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-dark-300">
              <Clock size={12} className="text-brand-300" /> {tx('Acabas ≈')} <b className="text-dark-50">{rr.fin}</b>
              {rr.km ? <span>· {String(rr.km).replace('.', ',')} km</span> : null}
              {rr.minutos ? <span>· {minutosATexto(rr.minutos)}</span> : null}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">{entregados === 1 ? tx('1 hecha') : tx('{n} hechas', { n: entregados })}</span>
        {hechos - entregados > 0 && <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-300">{tx('{n} sin hacer', { n: hechos - entregados })}</span>}
        {cobrado > 0 && <span className="rounded-full bg-dark-800 px-2 py-0.5 text-dark-200">{tx('Cobrado')} {euros(cobrado)}</span>}
        {pendientes > 0 && rr?.fin && (
          <span className="rounded-full bg-dark-800 px-2 py-0.5 text-dark-400">
            {rr.manual ? tx('tu orden') : rr.fuente === 'linea_recta' ? tx('por distancia') : rr.trafico ? tx('con tráfico típico') : tx('sin tráfico')}
          </span>
        )}
        {fueraHorario > 0 && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">{tx('{n} fuera de su horario', { n: fueraHorario })}</span>}
        {pendientes > 0 && retraso > 5 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">{tx('Vas {t} por detrás de lo previsto', { t: minutosATexto(retraso) })}</span>}
      </div>
      {dinero && (
        <button onClick={onTarifa} aria-label={tx('Mi dinero hoy')}
          className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/[.08] px-3 py-2 text-left">
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-300">{tx('Mi dinero hoy')}</span>
            <span className="block text-[12.5px] text-dark-300">
              {tx('Llevas {a} · gasolina ≈ {b}', { a: euros(dinero.bruto), b: euros(dinero.gasolina) })}
              {dinero.porHora != null ? ` · ${tx('{c}/hora', { c: euros(dinero.porHora) })}` : ''}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[10.5px] text-dark-400">{tx('Limpio')}</span>
            <b className="text-[19px] leading-none text-emerald-200">{euros(dinero.neto)}</b>
          </span>
        </button>
      )}
      {onCompartir && (
        <button onClick={onCompartir} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-[15px] font-bold text-white">
          <Share2 size={17} /> {tx('Comparte tu día')}
        </button>
      )}
      {!dinero && onTarifa && (
        <button onClick={onTarifa} className="mt-3 w-full rounded-2xl border border-dashed border-emerald-400/40 px-3 py-2 text-[12.5px] font-semibold text-emerald-200">
          💶 {tx('¿Cuánto llevas ganado hoy? Pon tu tarifa')}
        </button>
      )}
      {onGuiar && (
        <button onClick={onGuiar}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-[16px] font-bold text-brand-tinta shadow-lg shadow-brand-500/20 active:scale-[.99]">
          <Navigation size={18} /> {tx('Empezar a navegar')}
        </button>
      )}
      {!onGuiar && onCorregir && (
        <div role="status" className="mt-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-[13px] leading-snug text-amber-100">{tx('No encontramos la dirección en el mapa, así que todavía no se puede navegar. Corrígela y elige una de las sugerencias.')}</p>
          <button onClick={onCorregir} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500/25 py-2.5 text-[14px] font-bold text-amber-100">
            <Pencil size={15} /> {tx('Corregir la dirección')}
          </button>
        </div>
      )}
    </section>
  )
}

/* VER LA PUERTA (10-10-2026). Street View desde la calle de la dirección y
   mirando a la casa (el servidor calcula el punto y el rumbo). El enlace existe
   desde el principio, apuntando a la casa; en cuanto llega el rumbo, se afina:
   así nunca es un botón muerto ni lo bloquea el navegador como ventana emergente. */
function VerPuerta({ p }) {
  const [vista, setVista] = useState(null)
  useEffect(() => {
    let vivo = true
    repFachada(p.id).then(({ data }) => { if (vivo) setVista(data) }).catch(() => {})
    return () => { vivo = false }
  }, [p.id, p.lat, p.lng])
  const v = vista || { lat: p.lat, lng: p.lng, rumbo: null }
  const href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat},${v.lng}`
    + (v.rumbo != null ? `&heading=${v.rumbo}&pitch=5&fov=75` : '')
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-dark-700 px-2 py-1 text-[12px] font-semibold text-dark-200">
      <Eye size={12} /> {tx('Ver la puerta')}
    </a>
  )
}

/* LA FIRMA CON EL DEDO (10-10-2026). Fondo blanco y trazo negro, como en
   papel; sale un PNG pequeño (480×160) que se guarda en el pedido. */
function Firma({ onListo, onCancelar }) {
  const lienzo = useRef(null)
  const trazo = useRef(null)
  const [vacia, setVacia] = useState(true)
  const limpiar = () => {
    const ctx = lienzo.current.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 480, 160)
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    setVacia(true)
  }
  useEffect(limpiar, [])
  const punto = (e) => {
    const r = lienzo.current.getBoundingClientRect()
    return [(e.clientX - r.left) * (480 / r.width), (e.clientY - r.top) * (160 / r.height)]
  }
  const empezar = (e) => { e.preventDefault(); lienzo.current.setPointerCapture?.(e.pointerId); trazo.current = punto(e) }
  const mover = (e) => {
    if (!trazo.current) return
    const ctx = lienzo.current.getContext('2d')
    const [x, y] = punto(e)
    ctx.beginPath(); ctx.moveTo(...trazo.current); ctx.lineTo(x, y); ctx.stroke()
    trazo.current = [x, y]
    setVacia(false)
  }
  const soltar = () => { trazo.current = null }
  return (
    <div>
      <canvas ref={lienzo} width={480} height={160} aria-label={tx('Firma aquí con el dedo')}
        onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar}
        className="block aspect-[3/1] w-full touch-none rounded-xl bg-white" />
      <p className="mt-1 text-center text-[11.5px] text-dark-500">{tx('Firma aquí con el dedo')}</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <button type="button" onClick={onCancelar} className="rounded-xl border border-dark-700 py-2 text-[13px] text-dark-300">{tx('Cancelar')}</button>
        <button type="button" onClick={limpiar} className="rounded-xl border border-dark-700 py-2 text-[13px] text-dark-200">{tx('Borrar')}</button>
        <button type="button" disabled={vacia} onClick={() => onListo(lienzo.current.toDataURL('image/png'))}
          className="rounded-xl bg-emerald-700 py-2 text-[13px] font-bold text-white disabled:opacity-40">{tx('Listo')}</button>
      </div>
    </div>
  )
}

/* La furgoneta vista desde arriba, la cabina delante: seis zonas. */
function HuecoRejilla({ valor, onElegir, ocupado = false }) {
  return (
    <div className="rounded-2xl border border-dark-700 p-2" role="group" aria-label={tx('Zona de la furgoneta')}>
      <p className="mb-1 text-center text-[10.5px] uppercase tracking-wider text-dark-500">{tx('Cabina')}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {HUECOS.map((h) => (
          <button key={h} type="button" onClick={() => onElegir(h)} disabled={ocupado} aria-pressed={valor === h}
            className={`rounded-lg py-2.5 text-[13px] font-semibold disabled:opacity-50 ${valor === h ? 'bg-sky-500 text-white' : 'border border-dark-700 bg-dark-900 text-dark-200'}`}>
            {tx(h)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-[10.5px] uppercase tracking-wider text-dark-500">{tx('Puertas')}</p>
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
  const NOMBRE = { efectivo: tx('Efectivo'), tarjeta: tx('Tarjeta'), bizum: 'Bizum', pix: 'Pix', transferencia: tx('Transferencia'), pagado: tx('Ya pagado'), otro: tx('Otro') }
  return (
    <div className="mt-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/[.07] p-4" aria-label={tx('Resumen del día')}>
      <p className="flex items-center gap-2 text-[16px] font-bold text-emerald-200"><Trophy size={18} /> {tx('Ruta terminada')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-dark-900 py-2.5"><p className="text-[22px] font-bold text-dark-50">{ok.length}</p><p className="text-[11.5px] text-dark-400">{tx('hechas')}</p></div>
        <div className="rounded-xl bg-dark-900 py-2.5"><p className={`text-[22px] font-bold ${no.length ? 'text-red-300' : 'text-dark-50'}`}>{no.length}</p><p className="text-[11.5px] text-dark-400">{tx('sin hacer')}</p></div>
      </div>
      {Object.keys(cobros).length > 0 && (
        <div className="mt-3 text-[13px] text-dark-200">
          <p className="mb-1 font-semibold">{tx('Cobrado')}</p>
          {Object.entries(cobros).map(([m, v]) => (
            <p key={m} className="flex justify-between"><span className="text-dark-400">{NOMBRE[m] || m}</span><span>{euros(v)}</span></p>
          ))}
          <p className="mt-1 flex justify-between border-t border-dark-700 pt-1 font-bold"><span>{tx('Total')}</span><span>{euros(Object.values(cobros).reduce((a, b) => a + b, 0))}</span></p>
        </div>
      )}
      <button onClick={invitar}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 py-2.5 text-[13.5px] font-bold text-emerald-200">
        <MessageCircle size={15} /> {tx('Invitar a un compañero')}
      </button>
      <p className="mt-3 text-[12px] text-dark-400">
        {durMin > 0 && <>{tx('De la primera a la última parada: {t}.', { t: minutosATexto(durMin) })} </>}
        {ruta?.km ? <>{tx('Ruta planificada: {km} km.', { km: ruta.km })}</> : null}
      </p>
      {no.length > 0 && <p className="mt-1 text-[12px] text-dark-400">{tx('Las no hechas siguen en «hechos hoy» con su motivo.')}</p>}
    </div>
  )
}

function Hoja({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-dark-700 bg-dark-950 p-4 pb-8">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-bold text-dark-50">{titulo}</h2>
          <button onClick={onClose} className="rounded p-1 text-dark-400" aria-label={tx('Cerrar')}><X size={18} /></button>
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
/* El fotograma de la cámara en el momento de leer el código: la etiqueta entera. */
async function fotograma(v) {
  try {
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    if (!c.width || !c.height) return null
    c.getContext('2d').drawImage(v, 0, 0)
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92))
  } catch { return null }
}

/* `seguido` (13-10-2026): la cámara no se cierra tras cada paquete; los que ya
   se han leído no se repiten y `estado` se enseña abajo («12 añadidos…»). */
function Escaner({ onCodigo, onClose, seguido = false, estado = '' }) {
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
    const vistos = new Set()
    async function arrancar() {
      let detector
      try { detector = await lectorDeCodigos() } catch {
        setError(tx('Este móvil no sabe leer códigos desde el navegador. Escribe el código o haz la foto del ticket.'))
        return
      }
      try {
        // Con resolución alta: el mismo fotograma sirve después para leer la dirección.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        if (parar) { stream.getTracks().forEach((t) => t.stop()); return }
        video.current.srcObject = stream
        await video.current.play()
        const leer = async () => (await detector.detect(video.current)).map((c) => c.rawValue).filter(Boolean)
        const mirar = async () => {
          if (parar) return
          try {
            let leidos = (await leer()).filter((v) => !vistos.has(v))
            if (leidos.length) {
              // Una etiqueta lleva varios códigos (la barra y uno o dos 2D, el de GLS con la
              // dirección aparte) y no siempre se ven en el mismo fotograma: medio segundo más.
              const juntos = new Set(leidos)
              for (let i = 0; i < 2 && !parar; i += 1) {
                await new Promise((ok) => setTimeout(ok, 160))
                try { (await leer()).forEach((v) => { if (!vistos.has(v)) juntos.add(v) }) } catch { /* fotograma malo */ }
              }
              leidos = [...juntos]
              const foto = await fotograma(video.current)
              if (navigator.vibrate) navigator.vibrate(60)
              if (!seguido) { avisa.current(leidos, foto); return }
              leidos.forEach((v) => vistos.add(v))
              await avisa.current(leidos, foto)
              temporizador = setTimeout(mirar, 120)   // breve margen para cambiar de paquete
              return
            }
          } catch { /* un fotograma malo: se sigue */ }
          temporizador = setTimeout(mirar, 250)
        }
        mirar()
      } catch {
        setError(tx('No se pudo abrir la cámara. Dale permiso en el navegador o escribe el código.'))
      }
    }
    arrancar()
    return () => {
      parar = true
      clearTimeout(temporizador)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [seguido])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={tx('Escanear')}>
      <div className="flex items-center justify-between p-4">
        <span className="text-[15px] font-semibold text-white">{tx('Apunta a la etiqueta, con el código dentro del recuadro')}</span>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white" aria-label={tx('Cerrar')}><X size={18} /></button>
      </div>
      {error ? <p className="px-6 py-10 text-center text-[14px] text-white/80">{error}</p> : (
        <div className="relative flex-1">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-2xl border-2 border-white/70" />
          {seguido && (
            <p role="status" aria-live="polite" className="absolute inset-x-4 bottom-6 whitespace-pre-line rounded-xl bg-black/70 px-4 py-3 text-center text-[15px] font-semibold text-white">
              {estado || tx('Pasa las etiquetas una tras otra')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
