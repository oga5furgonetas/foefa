import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ScanLine, Camera, Loader2, Navigation, Phone, Check, X, Route, MapPin, Play, Square, Package,
  MessageCircle, Clock, Search, List, Pencil, ChevronDown, GripVertical, Map as MapaIcono, ArrowUp, ArrowDown, ArrowUpDown, Mic, ClipboardPaste, Trophy,
  Eye, PenLine, RotateCcw, HelpCircle, Share2, FileUp, Gift, WifiOff, Plus, FileText, Mail, CalendarClock, Lightbulb, History,
  AlertTriangle, CarFront, Truck, Volume2, ShieldCheck, Copy,
} from 'lucide-react'
import {
  repMiRuta, repZonasCarga, repEscanear, repEscanearLote, repLeerTicket, repNuevoPedido, repEstado, repOrdenar, repJornada, repPosicion,
  repMiOrden, repMiEditar, repMiQuitar, repEjemplo, repQuitarEjemplos, repPegarMiLista, repTrazado, repFachada, repGanancias,
  repTraerPrevias, repMisMarcas, repMisDirecciones, repFormasCodigo, repIncidencias, repZbe, getReferidos, repUbicar,
} from '../../services/api'
import { hoyLocal } from '../../lib/fecha'
import { lista } from '../../lib/lista'
import { compressImage } from '../../lib/compressImage'
import { origen } from '../../marca'
import { leerTicketEnMovil, leerHojaEnMovil } from '../../lib/leerTicket'
import { textoParaPegar, csvAPegar } from '../../lib/hojaReparto'
import { lectorDeCodigos, leerCodigo } from '../../lib/codigos'
import { datosDeCodigos, esCodigoSimple, formaCodigo } from '../../lib/codigoEtiqueta'
import { buscarDirecciones } from '../../lib/direcciones'
import { deUbicar, juntarSugerencias, alElegir, cambioEsAqui, estadoDeParada, punto as puntoDe } from '../../lib/situar'
import { invitar, enlaceInvitar } from '../../lib/compartir'
import { medirAccion } from '../../lib/analitica'
import { compartirDia } from '../../lib/compartirDia'
import { fijarPais, importe, simboloMoneda, metodosCobro, paisActual, distancia, unidades, KM_POR_MILLA } from '../../lib/region'
import { tx, useIdioma, locale, txError } from '../../lib/idioma'
import { salirDeLaDemoDeReparto, decodeToken } from '../../panel/auth'
import { eurosRef, fechaRefPromo, refCentActual, refPromoActiva, promoGratis, fechaPromo, BONO_CENT } from '../../lib/precios'
import { textoClienteDice } from './ClienteDice'
import { MemoriaHoja } from './MemoriaPuerta'
import { queIncidencia } from '../../panel/components/MapaReparto'
import { useAtras } from '../../lib/atras'
import { PedirAviso, mensajeAviso } from '../AvisoManana'
import CargaGuiada from './CargaGuiada'
import { decir, vozActiva } from '../../lib/voz'
import { textoBriefing } from '../../lib/briefing'
import { textoAvisoIa } from '../../lib/entregaIa'
import { Hoja as HojaPieza } from './piezas'
// El diseño compacto (07-11-2026, W2): las piezas de «Hoy» y de la hoja de la parada, una por línea.
import { ExternalLink, Info, MapPinOff } from 'lucide-react'
import Boton from './piezas/Boton'
import Cabecera from './piezas/Cabecera'
import Chip from './piezas/Chip'
import Campo from './piezas/Campo'
import Etiqueta from './piezas/Etiqueta'
import LineaEstado from './piezas/LineaEstado'
import AvisoFlotante from './piezas/AvisoFlotante'
import Promo from './piezas/Promo'
import ContenedorLista from './piezas/ContenedorLista'
import FilaParada from './piezas/FilaParada'
import Pastilla from './piezas/Pastilla'
import BotonMapa from './piezas/BotonMapa'
import ResumenDia from './piezas/ResumenDia'
import AvisoHueco from './piezas/AvisoHueco'
import TarjetaSiguiente from './piezas/TarjetaSiguiente'
import HojaParada from './piezas/HojaParada'
// W3, las hojas (07-11-2026): sus piezas en líneas propias; Boton, Campo, Chip, ContenedorLista y Etiqueta ya las importa W2.
import Aviso from './piezas/Aviso'
import { ChipOpcion } from './piezas/Chip'
import FilaChips from './piezas/FilaChips'
import NumeroParada from './piezas/NumeroParada'
import { DONDE_CORTO } from '../../lib/dejar'   // W3: «¿Dónde?» corto en los chips de «Prueba de entrega» (07-11-2026)
// W4, escanear y cargar (07-11-2026): Boton y NumeroParada ya los importan W2 y W3.
import LetraMax from './piezas/LetraMax'
// W6, la ficha de la parada y «Situar» (07-11-2026): sus piezas en líneas propias; Boton, Campo, Chip, FilaChips y Aviso ya los importan W2 y W3.
import { Banknote, Minus, Trash2, User } from 'lucide-react'
import FilaSugerencia from './piezas/FilaSugerencia'
import Segmentado from './piezas/Segmentado'

/* ── MI RUTA ────────────────────────────────────────────────────────────────
   Lo que hace el repartidor al cargar: escanea el código de la caja. Si el
   pedido ya está en la lista de la oficina, entra en su ruta con la dirección
   y lo que lleva; el segundo bulto del mismo pedido lo reconoce. Si no está
   (el ticket de caja no está en ningún sistema), una foto del ticket y la IA
   lee la dirección —si la empresa lo tiene activado—, o la escribe a mano.

   UBICACIÓN: solo entre «Empezar jornada» y «Terminar jornada», y la primera
   vez se le explica qué se ve, quién y cuánto dura (art. 90 LOPDGDD). Nada en
   segundo plano a escondidas: mientras se comparte, se dice arriba. */

/* SIN COBERTURA (17-10-2026). En un garaje, un sótano o un pueblo sin datos, «Entregado» daba «No se pudo
   guardar» y había que acordarse de repetirlo. Ahora el cambio se guarda en el móvil, la parada se ve hecha al
   momento y se envía sola cuando vuelve la red, con la hora a la que se hizo de verdad (`hecho_en`). Cada
   cambio lleva de quién es (empresa y usuario): en un móvil compartido no se manda nada con otra cuenta. Si
   no cabe la foto o la firma, se guarda la entrega sin ellas antes que perderla. */
const COLA = 'fds_cola_entregas'
const leerCola = () => { try { const c = JSON.parse(localStorage.getItem(COLA) || '[]'); return Array.isArray(c) ? c : [] } catch { return [] } }
const guardarCola = (c) => {
  try { if (c.length) localStorage.setItem(COLA, JSON.stringify(c)); else localStorage.removeItem(COLA); return true } catch { return false }
}
// (No «yo»: el componente ya tiene un estado `yo`, la posición, y lo taparía.)
const cuentaActual = () => { const t = decodeToken() || {}; return `${t.org_id || ''}:${t.sub || ''}` }
const deMi = (x) => x.quien === cuentaActual()

/* LA ÚLTIMA RUTA, EN EL MÓVIL (25-10-2026). Al abrir la app salía una rueda hasta que contestaba el servidor y,
   sin cobertura, «No se pudo cargar tu ruta»: lo que menos parece una app. Ahora sale al momento la ruta que
   había (la de esta cuenta y de hoy) y la del servidor la sustituye en cuanto llega. Sin cuenta reconocible
   (el portal de un conductor de empresa) o en la ruta de prueba, no se guarda. Al salir de la cuenta se borra
   (panel/auth.js, logout). */
export const COPIA_RUTA = 'fds_ruta_copia'
const copiaDeHoy = () => {
  try {
    const c = JSON.parse(localStorage.getItem(COPIA_RUTA) || 'null')
    return c && cuentaActual() !== ':' && c.quien === cuentaActual() && c.dia === hoyLocal() && c.data ? c : null
  } catch { return null }
}
const guardarCopia = (data) => {
  if (cuentaActual() === ':' || !data || data.prueba) return
  try { localStorage.setItem(COPIA_RUTA, JSON.stringify({ quien: cuentaActual(), dia: hoyLocal(), en: Date.now(), data })) } catch { /* lleno o privado */ }
}
// Sin respuesta del servidor (o la de una pasarela caída): eso es no tener red, no un «no» del servidor.
const sinRed = (e) => !e?.response || [502, 503, 504].includes(e.response.status)
const aplicarCola = (r, cola) => {
  if (!r || !cola.length) return r
  const por = new Map(cola.map((x) => [x.id, x]))
  return { ...r, pedidos: lista(r.pedidos).map((p) => {
    const x = por.get(p.id)
    return x ? { ...p, estado: x.estado, motivo: x.motivo || '', cerrado_en: x.estado === 'pendiente' ? null : x.hecho_en, sin_enviar: true } : p
  }) }
}
/* UN PUNTO RECIÉN PUESTO GANA (02-11-2026): si llega una carga de la ruta que salió antes de guardar el punto de
   «Situar la parada», se pinta el punto puesto (durante 2 min) y no la parada sin situar: la guía no vuelve a pedirlo.
   Con su `geo` («aprox» si era la calle sin el portal) y, si «Es aquí» la cambió (situar.js cambioEsAqui: otra calle,
   el CP y el pueblo que le faltaban…), su dirección (03-11-2026). */
const aplicarPuntos = (r, puntos) => {
  const vivos = Object.entries(puntos || {}).filter(([, x]) => Date.now() - x.t < 120000)
  if (!r || !vivos.length) return r
  const por = Object.fromEntries(vivos)
  return { ...r, pedidos: lista(r.pedidos).map((p) => {
    const x = por[p.id]
    if (!x || p.lat != null) return p
    return { ...p, lat: x.lat, lng: x.lng, geo: x.geo || 'manual', ...(x.direccion ? { direccion: x.direccion, cp: x.cp || '', localidad: x.localidad || '' } : {}) }
  }) }
}
const MOTIVOS = ['No había nadie', 'Dirección incorrecta', 'Rechazado', 'Fuera de horario', 'Otro']
/* DÓNDE SE DEJA (10-10-2026, como Circuit/Spoke): un toque en vez de escribirlo.
   El cliente lo ve en su enlace de seguimiento. Mismas claves que el servidor. */
const DONDE = [['mano', 'En mano'], ['vecino', 'Al vecino'], ['buzon', 'En el buzón'], ['porteria', 'En portería o recepción'], ['seguro', 'En un lugar seguro']]
const CON_QUIEN = ['mano', 'vecino', 'porteria']
const VACIO = { codigo: '', cliente: '', telefono: '', direccion: '', contenido: '', bultos: 1, notas: '', horario: '', prioridad: false, cobrar: '', tipo: 'entrega', hueco: '' }

/* LOS 2D QUE NO SE ENTIENDEN (25-10-2026): MRW, Nacex, CTT o Correos Express no publican qué llevan. De
   un código largo que no ha dado la dirección se manda solo su forma (letras → «a», cifras → «9»), una vez
   por forma: sin un dato de nadie, dice qué campos trae para aprender a leerlo. */
const formasMandadas = new Set()
function aprenderForma(valores, pais) {
  const formas = valores.filter((v) => v.length >= 20 && !esCodigoSimple(v)).map(formaCodigo).filter((f) => !formasMandadas.has(f))
  if (!formas.length) return
  formas.forEach((f) => formasMandadas.add(f))
  repFormasCodigo(formas.slice(0, 4), pais).catch(() => {})
}

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
const nombreNavegador = (nav) => ({ google: 'Google Maps', waze: 'Waze' }[nav] || 'Google Maps')
const Navegacion = lazy(() => import('./Navegacion'))
// «Situar la parada» (02-11-2026): también lleva Leaflet, así que solo se descarga al abrirla.
const SituarParada = lazy(() => import('./SituarParada'))
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
    (pos) => ok({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
    () => ok(null), { timeout: 8000, maximumAge: 60000 })
})

/* ATAJOS DEL HORARIO DEL CLIENTE (30-10-2026): un toque en vez de escribirlo. «Cierra a las 14:00» es lo que un
   repartidor con diez años de oficio hacía a mano: primero los comercios, luego la ruta normal. */
// Lo que se guarda va en forma neutra («9-14»: el servidor la lee igual que «de 9 a 14») y vale en cualquier idioma.
// Los rótulos, cortos desde el diseño compacto (07-11-2026, §5.9): «9–14», «16–20» y «Hasta 14:00»; lo que guardan, igual.
const ATAJOS_HORARIO = [['9–14', '9-14'], ['16–20', '16-20'], ['Hasta 14:00', '8-14']]
const FURGO = 'fds_furgo'
// El ejemplo de «pegar la lista», con direcciones de su país (30-10-2026).
const EJEMPLO_DIRECCIONES = {
  es: 'Calle Mayor 3, 28013 Madrid\nAvenida de la Constitución 12, Sevilla', en: '123 Main St, Springfield, IL 62704\n45 Oak Ave Apt 2B, Austin, TX 78701',
  us: '123 Main St, Springfield, IL 62704\n45 Oak Ave Apt 2B, Austin, TX 78701', gb: '12 High Street, London SW1A 1AA\n3 Station Road, Manchester M1 1AA',
  mx: 'Av. Insurgentes Sur 1602, Col. Crédito Constructor, 03940 CDMX\nCalle Hidalgo 245 Int. 3, Col. Centro, 64000 Monterrey',
  br: 'Rua das Flores, 123 - Apto 45, 01310-100 São Paulo\nAv. Brasil 2000, 20040-002 Rio de Janeiro', fr: '12 rue de la Paix, 75002 Paris\n8 avenue Jean Jaurès, 69007 Lyon',
  de: 'Hauptstraße 12, 10115 Berlin\nBahnhofstraße 3, 80335 München', it: 'Via Roma 12, 00184 Roma\nCorso Buenos Aires 5, 20124 Milano',
  pt: 'Rua Augusta 12, 1100-053 Lisboa\nRua de Santa Catarina 8, 4000-442 Porto', co: 'Carrera 7 # 32-16 Apto 501, Bogotá\nCalle 10 # 43-12, Medellín',
  ar: 'Av. Corrientes 1234, C1043AAZ Buenos Aires\nSan Martín 456, Córdoba', cl: 'Av. Providencia 1234, Providencia, Santiago\nCalle Prat 56, Valparaíso',
  pe: 'Av. Larco 345, Miraflores, Lima 15074', nl: 'Keizersgracht 123, 1015 CJ Amsterdam\nCoolsingel 40, 3011 AD Rotterdam',
}

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

/* ENSEÑAR CADA COSA EN SU MOMENTO (25-10-2026). Dani: «enseña cómo utilizar las cosas, que tengan sentido, cuándo y
   por qué». Un consejo al día como mucho, solo de lo que aún no usa y justo cuando le sirve; dice por qué y cómo, y
   «Entendido» lo quita para siempre. `cuando` mira la ruta de verdad: nada de consejos que no vienen a cuento. */
const CONSEJOS = [
  { id: 'ordenar', cuando: (e) => e.pendientes >= 3 && !e.ordenada, boton: 'Ordenar ahora',
    titulo: 'Deja que la app ponga el orden',
    texto: 'Pulsa «Ordenar ruta»: pone las paradas en el orden que menos tarda, respeta el horario de cada cliente y te dice a qué hora llegas a cada una.' },
  { id: 'hueco', cuando: (e) => e.pendientes >= 5 && e.entregados === 0 && !e.conHueco,
    titulo: 'Apunta dónde va cada paquete',
    texto: 'Al cargar, toca «¿Dónde va en la furgoneta?» en cada parada (delante, medio, detrás). Al llegar sabrás en qué hueco buscarlo sin revolver la carga.' },
  // 01-11-2026 (Dani: «una app de reparto con Google Maps no la va a pagar nadie»): el consejo ya no manda fuera; invita
  // a la guía de la app a quien eligió Google Maps o Waze.
  { id: 'guia_app', cuando: (e) => e.entregados >= 3 && e.pendientes > 0 && e.nav !== 'app',
    titulo: 'Prueba la guía de la app',
    texto: 'Pulsa «Ir con» → «Esta app»: te lleva hasta la puerta con voz, recalcula si te sales y al llegar marcas la entrega sin salir de la app.' },
]
// El consejo de hoy: el mismo todo el día (no salta de uno a otro) y ninguno más tras «Entendido».
function consejoDeHoy(fecha, estado) {
  const [dia, id] = lee('consejo_hoy', '|').split('|')
  if (dia === fecha) {
    const c = CONSEJOS.find((x) => x.id === id)
    return c && lee(`consejo_${c.id}`, '') !== 'visto' && c.cuando(estado) ? c : null
  }
  return CONSEJOS.find((c) => lee(`consejo_${c.id}`, '') !== 'visto' && c.cuando(estado)) || null
}
const guarda = (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: da igual */ } }
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const porOrden = (a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9)

/* ELEGIR UNA SUGERENCIA EN LA FICHA (de la lista o con «Es aquí» en «Situar la parada»): lo que cambia en el formulario.
   Su punto y su dirección con el piso escrito («2º B»: los buscadores no lo traen); de su historial, también el cliente y
   el teléfono, sin pisar lo que ya haya escrito. Una «Sin el portal» (la calle sin la casa) no pisa lo escrito, que
   lleva el número que hay que buscar en la puerta, y la ficha sigue diciendo «Calle encontrada, sin el portal», no
   «Sitio encontrado en el mapa» (02-11-2026, prueba en el emulador: «Rúa Real 999, 15003 A Coruña» pasaba a ser «Calle
   Real, 15003 A Coruña», en verde). `elegida_precision` vive en el formulario: al guardar, una «calle» se manda como
   "precision": "calle" con el punto (03-11-2026: el servidor la guarda «aprox», no como si fuera la puerta).
   UNA «OTRA CALLE» (03-11-2026, la regla de la app nativa): es otra calle, así que la dirección pasa a ser la suya,
   con el piso escrito, y nunca se queda lo escrito con el punto de otra calle («Rúa Brétema Mariñeira 23, 15011 A
   Coruña» con el punto de «Rúa Brétema, 15179 Oleiros», a 8 km).
   UNA SOLA REGLA (03-11-2026, el emulador y la revisión): lo decide situar.js alElegir con la dirección de la FICHA
   (no con lo buscado en «Situar la parada», que se puede haber corregido a «Rúa Brétema, Oleiros»), venga de donde
   venga la sugerencia, igual desde la lista que con «Es aquí». «Calle Real 85» para «Rúa Real 999» tampoco cambia el
   999 (es la calle, no la puerta), y una suya va con la precisión que dice el servidor. La dirección que cambia lleva
   el CP y la población de lo elegido; la que se queda, los suyos si lo elegido no los dice.
   EL SITIO DE LA FICHA (03-11-2026 de madrugada, la revisión): la regla mira también el CP y la población de la ficha
   mientras sigan escritos (escritoEn; situar.js mismoSitio: «Rúa Brétema, 15179 Oleiros» no es la calle de «Rúa
   Brétema 23, 15011 A Coruña»), y `lugar_elegido` dice que el CP y la población son los de lo elegido: al cambiar la
   dirección se quitan (conDireccionNueva). */
function conSugerencia(n, sg) {
  const el = alElegir(n.direccion, sg, escritoEn(n.direccion, n.cp), escritoEn(n.direccion, n.localidad))
  const igual = el.direccion === String(n.direccion || '').trim()
  return {
    direccion: el.direccion, cp: igual ? el.cp || n.cp || '' : el.cp, localidad: igual ? el.localidad || n.localidad || '' : el.localidad,
    lat: sg.lat, lng: sg.lng, geo_origen: 'sugerencia', elegida_precision: el.precision === 'calle' ? 'calle' : '', lugar_elegido: true,
    ...(sg.conocida ? { cliente: n.cliente || sg.cliente || '', telefono: n.telefono || sg.telefono || '' } : {}),
    ...(n.requiere_confirmar_direccion ? { direccion_confirmada: true } : {}),
  }
}
/** El CP o la población de la ficha para la regla, solo mientras sigan escritos en la dirección (como el cpConsulta de
 *  la app nativa, 03-11-2026): cambiado el pueblo a mano, no se compara con los de antes. */
const escritoEn = (texto, x) => (x && sinTildes(texto).includes(sinTildes(x)) ? x : '')
/* AL CAMBIAR LA DIRECCIÓN ESCRITA, TECLEANDO O DICTANDO (03-11-2026 de madrugada, la revisión; igual en la app nativa).
   Se tocaba «Rúa Real 5, 15179 Oleiros», se corregía a «Rúa Real 5, 15003 A Coruña» y solo se quitaba el punto: el
   alta llevaba el CP y la población de lo elegido (15179, Oleiros) y el servidor, que usa el CP que le llega antes que
   el del texto, buscaba la dirección nueva en Oleiros. Ahora se quita todo lo que vino con el punto o la sugerencia,
   venga de donde venga (la lista, «Situar la parada» con una sugerencia o puesto a mano en el mapa): el punto,
   geo_origen, la precisión, el CP y la población, y el servidor busca lo escrito. Los que no vinieron con ella (los de
   la etiqueta o los de la parada) se quedan, salvo que estuvieran escritos y ya no lo estén: cambiado el pueblo a
   mano, tampoco se busca con los de antes (como el cpConsulta de la app nativa). Lo mismo con la dirección que trae
   la foto del ticket o una de sus otras lecturas. */
function conDireccionNueva(n, direccion) {
  const antes = sinTildes(n.direccion)
  const ahora = sinTildes(direccion)
  const queda = (x) => (!x || n.lugar_elegido || (antes.includes(sinTildes(x)) && !ahora.includes(sinTildes(x))) ? '' : x)
  return { ...n, direccion, lat: null, lng: null, geo_origen: '', elegida_precision: '', lugar_elegido: false,
    cp: queda(n.cp), localidad: queda(n.localidad) }
}
/* LA PRECISIÓN DEL PUNTO ELEGIDO LLEGA AL SERVIDOR (03-11-2026, igual que la app nativa): el punto de una sugerencia
   que es solo la calle (o el de «Es aquí» sin haber movido la chincheta desde ella) va con "precision": "calle", y el
   servidor lo guarda «aprox»: al reabrir la parada no enseña «Ver la puerta» en el centro de la calle. Con el portal,
   o movida la chincheta, no va nada y queda «manual», como hasta ahora. */
const conPrecision = (precision) => (precision === 'calle' ? { precision: 'calle' } : {})

/* Dictar la dirección: el reconocimiento de voz del propio navegador (Chrome
   en Android lo tiene). Donde no existe, no sale el botón. */
const Reconocedor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

/* `referido` (02-11-2026): la respuesta de /referidos que la app del autónomo (RutaApp) ya pide al abrir; si no se pasa
   (el portal del conductor), se pide aquí solo cuando hace falta. */
/* `avisoApp`, `pantallaCompleta` y `pieApp` (07-11-2026, diseño compacto): el aviso de la cuenta que elige RutaApp (uno, en el
   hueco de aviso de «Hoy»), si la cabecera va fija y el mapa a pantalla completa (la app y el portal; el panel, no) y la
   línea final de la app («Invita y gana»), que se pinta al final de la lista si no hay promo de invitar a la vista. */
export default function MiRuta({ onBack, embebido = false, alTerminar = null, referido: referidoDado, avisoApp = null, pantallaCompleta = false, pieApp = null,
  esperarBienvenida = false,   // W3 (07-11-2026): la bienvenida espera a que se cierre «Último paso: instala la app» (lo pasa RutaApp)
}) {
  useIdioma()
  const [ruta, setRuta] = useState(() => { const c = copiaDeHoy(); return c ? aplicarCola(c.data, leerCola().filter(deMi)) : null })
  // La ruta que se ve es la guardada en el móvil y el servidor no contesta: se dice de cuándo es.
  const [copiaSinRed, setCopiaSinRed] = useState(0)
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
  // LA ENTREGA VERIFICADA (01-11-2026): {p, ia} cuando la IA pide mirar la foto de entrega (repetirla o dejarla).
  const [revisar, setRevisar] = useState(null)
  // LA MEMORIA DE LA CALLE (01-11-2026): la parada cuya puerta se está apuntando («Guardar para la próxima»).
  const [memoriaDe, setMemoriaDe] = useState(null)
  // EL CLIENTE AVISADO (01-11-2026): la hoja «Avisar a todos por WhatsApp» y a quién se avisó hoy (se recuerda en el móvil).
  const [avisarTodos, setAvisarTodos] = useState(false)
  const [avisados, setAvisados] = useState(() => { try { return JSON.parse(localStorage.getItem(`avisados_${hoyLocal()}`) || '[]') } catch { return [] } })
  function marcarAvisado(id) {
    const c = [...new Set([...avisados, id])]
    setAvisados(c)
    try { localStorage.setItem(`avisados_${hoyLocal()}`, JSON.stringify(c)) } catch { /* sin sitio: se olvida al recargar */ }
  }
  const [encontrado, setEncontrado] = useState(null)
  const [anadida, setAnadida] = useState(null)   // la parada que acaba de entrar sola al escanear su etiqueta
  const [vista, setVista] = useState(() => lee('ruta_vista', 'lista'))
  const [nav, setNav] = useState(() => lee('ruta_nav2', 'app'))
  const [filtro, setFiltro] = useState('')
  const [reordenar, setReordenar] = useState(null)   // null | [ids] mientras se cambia a mano
  const [huecoDe, setHuecoDe] = useState(null)       // la parada a la que se le dice dónde va
  const [pegar, setPegar] = useState(null)           // null | {texto, n}
  const [tarifa, setTarifa] = useState(null)         // «Mi dinero hoy»: null | {parada, dia, km} (texto en €)
  /* LO QUE PIDE LA CALLE (30-10-2026, docs/NECESIDADES-REPARTIDOR-30-10.md): cortes y obras de la DGT y zonas de
     bajas emisiones cerca de la ruta; dónde dejaste la furgoneta; y el registro del intento en cada parada (a qué
     hora llegaste, llamaste y escribiste), que va con «Entregado» o «No entregado» y defiende al repartidor. */
  const [incidencias, setIncidencias] = useState(null)   // null | {incidencias, publicado, incompleto}
  const [zbe, setZbe] = useState(null)                   // null | {zonas, paradas, incompleto}
  const [furgo, setFurgo] = useState(() => { try { const f = JSON.parse(localStorage.getItem(FURGO) || 'null'); return f && Date.now() - f.t < 12 * 3600000 ? f : null } catch { return null } })
  const intentos = useRef({})                            // {id de parada: {llegada, llamada, whatsapp, llamadas}}
  const posEntrega = useRef(null)                        // {lat, lng, precision, t}: la posición del móvil al ir a entregar
  const [tour, setTour] = useState(-1)               // recorrido de bienvenida: -1 cerrado, 0..2 el paso
  const [bienvenida, setBienvenida] = useState(null)  // la primera vez: null | 'inicio' | 'luego'
  const [anadir, setAnadir] = useState(false)          // la hoja de «Añadir paradas» (botón «+»)
  const [verCapas, setVerCapas] = useState(false)      // la hoja «Lo que hay en tu ruta» del mapa (07-11-2026, diseño compacto)
  const [buscando, setBuscando] = useState(false)      // el buscador de la lista, detrás de 🔍 (07-11-2026, diseño compacto)
  // SU PROGRESO DE VERDAD (25-10-2026): entregas con la app y su mejor día (antes de hoy), para el récord y el
  // resumen. Lo de hoy se cuenta aquí mismo con las paradas, así no hace falta preguntar tras cada entrega.
  const [marcas, setMarcas] = useState(null)
  const [previasNo, setPreviasNo] = useState(false)    // «Ahora no» a las paradas de otros días
  // LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026): el código de «Invita y gana» de esta cuenta, pedido una sola
  // vez cuando hay una entrega real de hoy; false si no tiene (demo, suplantación o fuera del programa).
  const [referidoPropio, setReferidoPropio] = useState(null)
  // «Ahora no» a la tarjeta de invitar: el DÍA de ruta en que se pulsó (02-11-2026). Un sí/no la dejaba callada también
  // al día siguiente si la app seguía abierta; así vale solo ese día, como la clave `invitar_no_<fecha>`.
  const [invitarNo, setInvitarNo] = useState('')
  const [, setConsejoVisto] = useState(0)              // sube al pulsar «Entendido»: se vuelve a mirar
  const [escuchando, setEscuchando] = useState(false)
  const reconocedor = useRef(null)
  const dirInput = useRef(null)
  useEffect(() => guarda('ruta_vista', vista), [vista])
  useEffect(() => guarda('ruta_nav2', nav), [nav])
  // La app de navegación de fuera: la elegida, o la del país si guía esta app.
  const fuera = nav === 'app' ? 'google' : nav
  // Un navegador guardado que ya no existe (los de China, 29-10-2026): se vuelve a esta app.
  useEffect(() => { if (['amap', 'baidu'].includes(nav)) setNav('app') }, [nav])
  const [guiando, setGuiando] = useState(null)       // id de la parada a la que se guía; null = sin guía
  const [altoGuia, setAltoGuia] = useState(0)       // lo que mide el panel de la guía (0 sin guía): «Deshacer» y los avisos se ponen 8 por encima (07-11-2026)
  // 10-10-2026: se mide cuándo EMPIEZA a navegar (no cada parada), para el embudo del alta.
  const guiandoAntes = useRef(null)
  useEffect(() => {
    if (guiando && !guiandoAntes.current) medirAccion('ruta_navegar')
    guiandoAntes.current = guiando
  }, [guiando])
  /* SITUAR LA PARADA (02-11-2026; Dani: «el primer paquete que escaneo no encuentra la dirección y tiene que ir por
     Maps; eso es un pedazo de mierda, hazlo bien»). Una parada sin punto ya no abre Google Maps: abre «Situar la
     parada» (SituarParada), con lo que encuentra el servidor y nuestro mapa. `situando`: {id, luego, parada} para una
     de la ruta («guia»: al guardar el punto se guía hasta él; «lista»: se queda en la lista) o {ficha: true} desde la
     ficha de editar o añadir (el punto va al formulario y se guarda con él). */
  const [situando, setSituando] = useState(null)
  const [guardandoPunto, setGuardandoPunto] = useState(false)
  const [errorPunto, setErrorPunto] = useState('')
  const puntosNuevos = useRef({})                    // {id: {lat, lng, t}}: los recién puestos (aplicarPuntos)
  /* LA GUÍA NO SE SALTA UNA PARADA SIN SITUAR (02-11-2026): hecha la que se guiaba, va a la siguiente EN ORDEN; si esa
     no tiene punto, se cierra la guía y se abre «Situar la parada», y al ponerlo sigue guiando. Antes saltaba a la
     siguiente situada y la otra se quedaba atrás sin que nadie lo dijera. */
  useEffect(() => {
    if (!guiando || !ruta) return
    const abiertas = lista(ruta.pedidos).filter((p) => !['entregado', 'fallido'].includes(p.estado)).sort(porOrden)
    const s = abiertas.find((p) => p.id === guiando) || abiertas[0]
    if (s && s.lat == null) { setGuiando(null); setErrorPunto(''); setSituando({ id: s.id, luego: 'guia', parada: s }) }
  }, [guiando, ruta])
  const [abierta, setAbierta] = useState(null)       // la parada cuya hoja está abierta (07-11-2026: antes, la desplegada en la lista)
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
      const nuevo = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }
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
  /* LO QUE DICE LA DGT (30-10-2026): cortes y obras cerca de la ruta, con el mapa abierto; las ZBE que tocan la
     ruta, siempre (cada parada dentro lleva su chip). El servidor lo guarda en memoria: pedirlo es barato. */
  useEffect(() => {
    if (!firmaRuta || ruta?.prueba) return undefined
    let vivo = true
    repIncidencias().then(({ data }) => { if (vivo) setIncidencias(Array.isArray(data?.incidencias) ? data : { incidencias: [], incompleto: true }) })
      .catch(() => { if (vivo) setIncidencias({ incidencias: [], incompleto: true }) })
    return () => { vivo = false }
  }, [firmaRuta, ruta?.prueba])
  useEffect(() => {
    if (!firmaRuta || ruta?.prueba) return undefined
    let vivo = true
    repZbe().then(({ data }) => { if (vivo) setZbe(Array.isArray(data?.zonas) ? data : null) }).catch(() => { if (vivo) setZbe(null) })
    return () => { vivo = false }
  }, [firmaRuta, ruta?.prueba])
  // DÓNDE APARQUÉ: con la furgoneta marcada, la posición sigue (solo aquí) para decir a cuántos metros está.
  useEffect(() => {
    if (!furgo || vista === 'mapa' || !('geolocation' in navigator)) return undefined
    const id = navigator.geolocation.watchPosition((pos) => setYo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [furgo, vista])

  const [cola, setCola] = useState(() => leerCola().filter(deMi))
  const cargadaEn = useRef(0)                            // cuándo se pidió la ruta por última vez
  // `silencioso` (01-11-2026, revisión): el refresco automático no puede dejar la pantalla en «No se pudo cargar tu
  // ruta» por un 500 pasajero sin que nadie haya tocado nada; se calla y la siguiente vuelta lo arregla.
  const cargar = useCallback((silencioso = false) => {
    cargadaEn.current = Date.now()
    // Lo guardado sin cobertura y aún sin enviar se pinta encima de lo que dice el servidor.
    repMiRuta().then(({ data }) => { fijarPais(data?.pais); guardarCopia(data); setCopiaSinRed(0); setErr(''); setRuta(aplicarPuntos(aplicarCola(data, leerCola().filter(deMi)), puntosNuevos.current)) })
      .catch((e) => {
        const c = sinRed(e) ? copiaDeHoy() : null
        if (c) setCopiaSinRed(c.en)
        else if (silencioso !== true) setErr(txError(e, 'No se pudo cargar tu ruta'))
      })
  }, [])
  const conMarcas = !!ruta?.autonomo && !ruta?.prueba
  useEffect(() => {
    if (!conMarcas) return
    repMisMarcas().then(({ data }) => setMarcas(data)).catch(() => setMarcas(null))
  }, [conMarcas])
  /* LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026; Dani: «viralización… lo más barato posible»): el registro por
     anuncio cuesta 1,34 € y el que trae un compañero, 0 €, y quien acaba de entregar con la app es quien mejor la
     vende. Con una entrega real de hoy (las de ejemplo no) sale la tarjeta bajo la siguiente parada o, terminado el
     día, en el resumen. El código es el de /referidos (el mismo que usa Cuenta): la app del autónomo ya lo trae; si
     no, se pide UNA vez. Sin código (demo, suplantación, país sin programa) no sale: no se promete lo que no se puede
     pagar. */
  const referido = referidoDado !== undefined ? referidoDado : referidoPropio
  const invitarToca = conMarcas && lista(ruta?.pedidos).some((p) => p.estado === 'entregado' && !p.ejemplo)
    && lee(`invitar_no_${ruta?.fecha}`, '') !== '1'
  useEffect(() => {
    if (referidoDado !== undefined || !invitarToca || referidoPropio !== null) return
    getReferidos().then(({ data }) => setReferidoPropio(data?.codigo ? data : false)).catch(() => setReferidoPropio(false))
  }, [referidoDado, invitarToca, referidoPropio])
  /* LO QUE QUEDÓ DE OTROS DÍAS (25-10-2026): la ruta es la del día y lo que no se entregó (o se cargó de noche)
     dejaba de verse a las 00:00. Se ofrece traerlo; no se mueve nada sin que lo pida. */
  async function traerPrevias() {
    setOcupado('previas')
    try {
      const { data } = await repTraerPrevias()
      cargar()
      setAviso(data.traidas === 1 ? tx('1 parada pasada a hoy. Pulsa «Ordenar ruta» para ponerla en su sitio.')
        : tx('{n} paradas pasadas a hoy. Pulsa «Ordenar ruta» para ponerlas en su sitio.', { n: data.traidas }))
    } catch (e) { setAviso(txError(e, 'No se pudo')) } finally { setOcupado('') }
  }
  // Manda lo guardado en el móvil: al volver la red, cada 20 s mientras quede algo y al pulsar «Enviar ahora».
  const enviandoCola = useRef(false)
  const vaciarColaEntregas = useCallback(async () => {
    const mias = leerCola().filter(deMi)
    if (!mias.length || enviandoCola.current) return
    enviandoCola.current = true
    let enviadas = 0
    let rechazo = null
    try {
      for (const x of mias) {
        try {
          await repEstado(x.id, x.estado, x.motivo, { ...(x.datos || {}), hecho_en: x.hecho_en })
          enviadas += 1
        } catch (e) {
          if (sinRed(e)) break
          rechazo = rechazo || e                 // el servidor no lo acepta (ya no existe, ya no es suya): no se reintenta
        }
        guardarCola(leerCola().filter((y) => !(y.id === x.id && y.hecho_en === x.hecho_en)))
      }
    } finally { enviandoCola.current = false }
    setCola(leerCola().filter(deMi))
    if (rechazo) setAviso(txError(rechazo, 'Un cambio guardado sin cobertura no se pudo enviar'))
    else if (enviadas) setAviso(enviadas === 1 ? tx('Ya hay conexión: enviado lo que estaba guardado.') : tx('Ya hay conexión: enviados {n} cambios que estaban guardados.', { n: enviadas }))
    if (enviadas || rechazo) cargar()
  }, [cargar])
  useEffect(() => {
    vaciarColaEntregas()
    const t = setInterval(vaciarColaEntregas, 20000)
    window.addEventListener('online', vaciarColaEntregas)
    return () => { clearInterval(t); window.removeEventListener('online', vaciarColaEntregas) }
  }, [vaciarColaEntregas])
  useEffect(cargar, [cargar])
  // Al volver la cobertura, la ruta del servidor sustituye a la guardada en el móvil.
  useEffect(() => {
    window.addEventListener('online', cargar)
    return () => window.removeEventListener('online', cargar)
  }, [cargar])
  // «Tirar para actualizar» (RutaApp) avisa con este evento.
  useEffect(() => {
    window.addEventListener('fds-recargar-ruta', cargar)
    return () => window.removeEventListener('fds-recargar-ruta', cargar)
  }, [cargar])
  /* LA RUTA SE REFRESCA SOLA (01-11-2026): lo que contesta el cliente en su enlace («El cliente dice») tiene que
     verse en la siguiente parada sin tirar hacia abajo: al volver la pestaña a la vista y cada 90 s mientras se ve,
     si queda algo por entregar y hace ≥20 s de la última carga. Nunca con algo de camino (ocupado): la ruta del
     servidor volvería a pintar lo de antes. */
  const quedan = !!firmaRuta
  const refrescarSiToca = useCallback(() => {
    if (document.hidden || ocupado || Date.now() - cargadaEn.current < 20000) return
    cargar(true)
  }, [cargar, ocupado])
  useEffect(() => {
    if (!quedan) return undefined
    const t = setInterval(refrescarSiToca, 90000)
    document.addEventListener('visibilitychange', refrescarSiToca)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', refrescarSiToca) }
  }, [quedan, refrescarSiToca])

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
    if (!datos.completa) aprenderForma(valores, paisActual())
    medirAccion(foto ? 'ruta_escaneo' : 'ruta_codigo')
    setEscaner(false); setOcupado('buscar'); setAviso(''); setAnadida(null)
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
      /* LA ETIQUETA LO TRAE TODO (25-10-2026): SEUR/DPD, GLS o GS1 llevan en su código 2D la dirección exacta.
         Dani: «nada más lo escaneas, se te añade a la lista, sin esperar a la foto». Se guarda ya y «Corregir» abre
         la hoja; si el servidor no la acepta, la hoja de siempre con lo leído (el tope del plan gratis, su aviso). */
      if (datos.completa) {
        const { codigos, completa: _completa, ...campos } = datos
        try {
          const { data: p } = await repNuevoPedido({ ...VACIO, ...Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== '' && v != null)),
            codigo: codigo || datos.codigo, codigos, direccion: [datos.direccion, datos.cp, datos.localidad].filter(Boolean).join(', ') })
          medirAccion('ruta_parada_nueva')
          if (navigator.vibrate) navigator.vibrate(80)
          setCodigo('')
          if (carga) setCarga((n) => (n ? { ...n, n: n.n + 1 } : n))
          setAnadida(p)
          cargar()
          return
        } catch (e) {
          if (e?.response?.status === 402) { setAviso(txError(e, 'No se pudo guardar')); return }
        }
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
      // En una etiqueta logística, cifras aisladas pueden ser un tracking/peso leído como teléfono.
      // Solo las conservamos si la propia etiqueta las identifica como teléfono.
      if (!data.telefonoRotulado && /\b(?:cycle|ciclo|kg|kgs|weight|peso|tnw|awb|tracking|rastreo|shipment|envio)\b|\b[A-Z]{1,4}\d{6,}\b/i.test(data.texto || '')) data.telefono = ''
      const algo = data?.direccion || data?.telefono || data?.cliente
      if (!algo && !soloHuecos) setAviso(tx('No he podido leer el ticket. Prueba con más luz y el ticket recto, o escríbelo.'))
      setNuevo((n) => {
      const leido = Object.fromEntries(Object.entries(data || {}).filter(([k, v]) =>
        !['texto', 'alternativasDireccion', 'direccionAmbigua', 'telefonoRotulado'].includes(k) && v !== '' && v != null))
        const dir = [data?.direccion, data?.cp, data?.localidad].filter(Boolean).join(', ')
        if (soloHuecos) {
          return { ...n, ...Object.fromEntries(Object.entries(leido).filter(([k]) => !n?.[k] && k !== 'direccion' && k !== 'cp' && k !== 'localidad')),
            de_ticket: true, direccion: n?.direccion || dir,
            ...(n?.direccion ? {} : { requiere_confirmar_direccion: true, direccion_confirmada: false,
              alternativas_direccion: data?.alternativasDireccion || [] }) }
        }
      // Si lo leído cambia la dirección, fuera lo que vino con el punto o la sugerencia (conDireccionNueva, 03-11-2026).
      const base = dir && dir !== n?.direccion && (n?.lat != null || n?.lugar_elegido) ? conDireccionNueva(n, dir) : n
      return { ...base, ...leido, codigo: n?.codigo || data?.codigo || '', de_ticket: true, direccion: dir || n?.direccion || '',
        requiere_confirmar_direccion: true, direccion_confirmada: false,
        alternativas_direccion: data?.alternativasDireccion || [] }
      })
    } catch (e) { setAviso(txError(e, 'No se pudo leer el ticket')) } finally { setOcupado('') }
  }

  // «Cargar paquetes»: una foto tras otra, y al acabar «Montar ruta».
  const [carga, setCarga] = useState(null)   // null | {n}

  /* LA CARGA GUIADA Y EL BRIEFING POR VOZ (01-11-2026). Con la ruta ordenada, «Cargar la furgoneta» abre la pantalla que
     dice en qué hueco va cada paquete al escanearlo (el servidor se lo puso a cada parada al ordenar). Y cada vez que
     cambia la siguiente parada (se hizo la anterior, o se acaba de ordenar) se dice en una frase lo que hay que saber:
     dirección, hora, lo que dijo el cliente, el hueco, el cobro y la nota. Nunca al abrir la pantalla: el repartidor
     ya la ve. Misma preferencia que la guía por voz («guia_voz»). */
  const [cargaGuiada, setCargaGuiada] = useState(false)
  const briefingDe = useRef(null)            // id de la parada ya dicha; null = aún no se ha visto la ruta
  const briefingTrasOrdenar = useRef(false)  // acaba de ordenarse: se dice la primera aunque sea la misma de antes
  useEffect(() => {
    const sig = ruta?.activo ? lista(ruta.pedidos).filter((p) => !['entregado', 'fallido'].includes(p.estado)).sort(porOrden)[0] : null
    const id = sig?.id || null
    const antes = briefingDe.current
    const trasOrdenar = briefingTrasOrdenar.current
    briefingDe.current = id
    briefingTrasOrdenar.current = false
    if (!id || !ruta?.ruta?.fin) return
    if (!trasOrdenar && (antes === null || antes === id)) return
    if (vozActiva()) decir(textoBriefing(sig), { cola: true })
  }, [ruta])

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
            // Solo entra sola si el código trae calle Y dónde (CP, población o GPS); a medias, a revisar con su foto.
            direccion: datos.completa ? [datos.direccion, datos.cp, datos.localidad].filter(Boolean).join(', ') : '' } }
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
    if (!datos.completa) aprenderForma(valores, paisActual())
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
    if (nuevo.requiere_confirmar_direccion && !nuevo.direccion_confirmada) {
      setAviso(tx('Revisa lo leído del ticket antes de guardar.'))
      return
    }
    setOcupado('guardar')
    try {
      if (nuevo.id) {
        // Editar una parada que ya está en la ruta.
        const { id, ...campos } = nuevo
        await repMiEditar(id, { cliente: campos.cliente, telefono: campos.telefono, direccion: campos.direccion, contenido: campos.contenido,
          bultos: campos.bultos, horario: campos.horario || '', cobrar: campos.cobrar || '', tipo: campos.tipo || 'entrega',
          prioridad: !!campos.prioridad, hueco: campos.hueco || '', notas: campos.notas || '',
          ...(campos.lat != null ? { lat: campos.lat, lng: campos.lng, cp: campos.cp || '', localidad: campos.localidad || '',
            ...(campos.geo_origen ? { geo_origen: campos.geo_origen } : {}), ...conPrecision(campos.elegida_precision) } : {}) })
        delete puntosNuevos.current[id]   // lo que diga ahora el servidor de su dirección manda
        setNuevo(null); setQuitando(false); cargar(); setAviso(tx('✓ Cambios guardados'))
        return
      }
      // Con el punto elegido o puesto en el mapa va su origen (02-11-2026); sin punto, no. La precisión de la sugerencia
      // elegida (conSugerencia) va como "precision": "calle" solo si es la calle sin el portal (03-11-2026). La marca
      // de lo elegido (`lugar_elegido`) se queda en la ficha.
      const { elegida_precision: precisionElegida, lugar_elegido: _lugar, ...cuerpo } = nuevo
      const { data: creada } = await repNuevoPedido(cuerpo.lat != null ? { ...cuerpo, ...conPrecision(precisionElegida) } : { ...cuerpo, geo_origen: undefined })
      medirAccion('ruta_parada_nueva')
      setNuevo(null); setCodigo('')
      cargar()
      // Guardada sin sitio en el mapa (02-11-2026): se dice ya, con «Situar», y no al ir a navegar.
      const sinSitio = !!creada?.id && creada.lat == null && (creada.geo === 'no' || creada.geo === 'zona')
      if (carga) { setCarga({ n: carga.n + 1 }); setAviso('') } else if (sinSitio) { setAviso(''); setAnadida(creada) } else setAviso(tx('✓ Añadido a tu ruta'))
    } catch (e) { setAviso(txError(e, 'No se pudo guardar')) } finally { setOcupado('') }
  }

  /* QUITAR UNA PARADA: dos toques (el segundo confirma), para que un dedo
     torpe en el coche no borre una entrega. */
  const [quitando, setQuitando] = useState(false)

  /* SUGERENCIAS DE DIRECCIÓN al escribir en la hoja de una parada: al tocar
     una, la parada queda con su punto exacto en el mapa. Si se sigue
     escribiendo, el punto elegido se descarta (la dirección ya no es esa). */
  const [sugs, setSugs] = useState([])
  /* EL ESTADO DE LA DIRECCIÓN EN LA FICHA (02-11-2026): con lo leído de la etiqueta o mientras se escribe (con una
     pausa), se pregunta al servidor si la encuentra (POST /reparto/ubicar, que no guarda nada) y la ficha lo dice:
     «En el mapa», «Calle encontrada, sin el portal» o «No la encuentro: elige una sugerencia o sitúala en el mapa». Lo
     que encuentra va el primero en las sugerencias. Así se sabe ANTES de guardar, no al ir a navegar. `ubicada`:
     {texto, buscando} mientras se pregunta, o {texto, ...deUbicar()} con la respuesta; null si no hay qué decir. */
  const [ubicada, setUbicada] = useState(null)
  const textoDir = nuevo?.direccion || ''
  // El CP y la población de la parada para la regla, mientras sigan escritos (03-11-2026: situar.js mismoSitio).
  const cpFicha = escritoEn(textoDir, nuevo?.cp)
  const locFicha = escritoEn(textoDir, nuevo?.localidad)
  const tienePunto = nuevo?.lat != null
  const hayHoja = !!nuevo
  // Una parada de la ruta a la que no se le ha tocado la dirección: su estado es el SUYO (guardar el mismo texto no la
  // vuelve a buscar); si ya está situada, ni se pregunta. Sin punto, se pregunta igual, por las sugerencias.
  const sinCambiar = !!(nuevo?.id && textoDir === nuevo.direccion_original)
  const yaSituada = sinCambiar && !!nuevo?.punto_actual
  const yoRef = useRef(null)                         // la posición, sin repetir la búsqueda cada vez que se mueve
  yoRef.current = yo
  useEffect(() => {
    if (!hayHoja || tienePunto || textoDir.trim().length < 4) { setSugs([]); setUbicada(null); return undefined }
    const ctl = new AbortController()
    setUbicada(yaSituada ? null : { texto: textoDir, buscando: true })
    const t = setTimeout(async () => {
      /* LAS QUE YA CONOCE, PRIMERO (25-10-2026): de su propio historial, con su punto, el cliente y el teléfono de
         la última vez. La queja más repetida de Circuit: «metemos las mismas paradas cada día y no las recuerda».
         Desde el 02-11-2026, antes aún lo que encuentra el servidor. */
      const [srv, suyas, otras] = await Promise.all([
        yaSituada ? null : repUbicar(textoDir, { signal: ctl.signal }).then((r) => deUbicar(r.data)).catch(() => null),
        // `fuente` «suya» (03-11-2026): la regla las toma tal cual, con la precisión que dice el servidor (situar.js alElegir).
        ruta?.prueba ? [] : repMisDirecciones(textoDir).then((r) => lista(r.data?.direcciones).map((x) => ({ ...x, conocida: true, fuente: 'suya' })))
          .catch(() => []),
        // Sin servicio: se escribe la dirección entera y el servidor la sitúa. A Photon va sin el piso (C, 03-11-2026:
        // buscarDirecciones); lo que se quita, con lo escrito, y al servidor (repUbicar), tal cual.
        buscarDirecciones(textoDir, { cerca: yoRef.current || ruta?.base || null, pais: ruta?.pais || '', senal: ctl.signal }).catch(() => []),
      ])
      if (ctl.signal.aborted) return
      setUbicada(srv ? { texto: textoDir, ...srv } : null)
      // «Otra calle», con lo escrito en la ficha: es la dirección de la parada (03-11-2026), con su CP y su población.
      setSugs(juntarSugerencias(srv?.candidatos || [], suyas, otras, 6, textoDir, cpFicha, locFicha))
    }, 400)
    return () => { clearTimeout(t); ctl.abort() }
  }, [textoDir, cpFicha, locFicha, tienePunto, hayHoja, yaSituada, ruta?.base, ruta?.pais, ruta?.prueba])
  async function quitarParada() {
    if (!nuevo?.id) return
    if (!quitando) { setQuitando(true); return }
    setOcupado('guardar')
    try {
      await repMiQuitar(nuevo.id)
      setNuevo(null); setQuitando(false); setAbierta(null); cargar(); setAviso(tx('Parada quitada de tu ruta'))
    } catch (e) { setAviso(txError(e, 'No se pudo quitar')) } finally { setOcupado('') }
  }
  // «Quitar de la ruta» desde el ⋮ de la hoja de la parada (07-11-2026, diseño compacto, §5.2): la hoja ya ha preguntado
  // «¿Quitar esta parada?»; aquí, la misma llamada que al quitarla desde la ficha.
  async function quitarDeRuta(p) {
    if (!p?.id) return
    setOcupado('guardar')
    try {
      await repMiQuitar(p.id)
      setAbierta(null); cargar(); setAviso(tx('Parada quitada de tu ruta'))
    } catch (e) { setAviso(txError(e, 'No se pudo quitar')) } finally { setOcupado('') }
  }
  /* PARADAS DE EJEMPLO: para ver la app trabajando sin tener paquetes. */
  async function cargarEjemplo() {
    setOcupado('ejemplo'); medirAccion('ejemplo_cargar')
    try {
      await repEjemplo(await posicionAhora())
      cargar()
      setAviso(tx('Son paradas de ejemplo, a tu alrededor: pulsa «Ir» y míralo en acción. Quítalas cuando cargues las tuyas.'))
    } catch (e) { setAviso(txError(e, 'No se pudo preparar el ejemplo')) } finally { setOcupado('') }
  }
  /* LA PRIMERA VEZ (17-10-2026). Antes salía solo el recorrido de 3 pasos y su botón grande era «Verlo en acción
     con 3 paradas de ejemplo»: de las 14 altas del anuncio del 14-10 casi todas fueron al ejemplo y una sola metió
     una parada suya. Ahora, una pregunta: «¿Tienes ya tus paradas de hoy?». Sí → «¿Cómo te llegan?» (23-10-2026:
     antes iba directo a la foto de la etiqueta, y quien recibe la lista por WhatsApp o en una hoja no tenía camino;
     la única respuesta a «¿qué te frenó?» fue «no supe cómo usarla») y cada forma abre su herramienta. Todavía no →
     el aviso de mañana a las 8 y, si quiere, el ejemplo. Los 3 pasos siguen en «¿Cómo funciona?». Sale una vez
     (la misma marca que el recorrido). */
  const TOUR = 'fds_tour_ruta'
  useEffect(() => {
    if (!embebido || !ruta?.autonomo || lista(ruta.pedidos).length) return     // solo en la app de quien reparte solo
    if (esperarBienvenida) return     // «Último paso: instala la app» sigue abierto (07-11-2026): la bienvenida sale al cerrarse, no encima
    try { if (localStorage.getItem(TOUR)) return; localStorage.setItem(TOUR, '1') } catch { return }
    setBienvenida('inicio'); medirAccion('bienvenida_vista')
  }, [embebido, ruta?.autonomo, ruta?.pedidos, esperarBienvenida])
  // El aviso de la mañana, a la hora a la que carga (18-10-2026): ya pedido en este móvil, no se vuelve a ofrecer.
  let avisoPedido = false
  try { avisoPedido = localStorage.getItem('fds_aviso_manana') === 'si' } catch { avisoPedido = false }
  async function quitarEjemplos() {
    setOcupado('ejemplo')
    try { await repQuitarEjemplos(); cargar(); setAviso(tx('Ejemplos quitados. Ya puedes cargar tus paquetes.')) } catch (e) { setAviso(txError(e, 'No se pudo quitar')) } finally { setOcupado('') }
  }
  /* La herramienta de cada forma de recibir las paradas (FORMAS): etiquetas → la carga foto tras foto; una hoja en
     papel o una lista de WhatsApp/Excel → la caja de pegar (con la foto de la hoja); de una en una → a mano. Se
     mide cuál eligen (`carga_*`): es lo que dice qué repartidores llegan y qué herramienta hay que mimar. */
  function abrirForma(f) {
    medirAccion(`carga_${f}`)
    if (f === 'etiquetas') setCarga({ n: 0 })
    else if (f === 'hoja') setPegar({ texto: '', n: null, nota: tx('Pulsa «Foto de la hoja» y se leen todas las paradas de golpe.') })
    else if (f === 'lista') setPegar({ texto: '', n: null })
    else setNuevo({ ...VACIO })
  }
  const editar = (p) => {
    setQuitando(false)
    setNuevo({ ...VACIO, id: p.id, codigo: '', cliente: p.cliente || '', telefono: p.telefono || '', direccion: p.direccion || '',
      contenido: p.contenido || '', bultos: p.bultos || 1, notas: p.notas || '', tipo: p.tipo || 'entrega', prioridad: !!p.prioridad,
      cobrar: p.cobrar > 0 ? String(p.cobrar).replace('.', ',') : '', hueco: p.hueco || '',
      horario: p.ventana_desde ? `de ${p.ventana_desde} a ${p.ventana_hasta}` : '',
      // Su punto y su dirección de ahora (02-11-2026): la ficha dice si está en el mapa; la zona, para «Situar».
      direccion_original: p.direccion || '', punto_actual: p.lat != null ? { lat: p.lat, lng: p.lng, geo: p.geo } : null, geo_actual: p.geo || '',
      zona_lat: p.zona_lat ?? null, zona_lng: p.zona_lng ?? null })
  }

  const dataUrlDe = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob) })

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

  /* Manda el cambio de estado; sin cobertura, lo guarda en el móvil y lo pinta ya. Devuelve 'enviado' o
     'guardado'. Lo último que se hace con una parada manda: si se deshace algo que aún no ha salido del
     móvil, basta con olvidarlo; si se envía algo nuevo, lo guardado de antes para esa parada sobra. */
  async function enviarOGuardar(p, estado, motivo, datos) {
    const hecho_en = new Date().toISOString()
    const previa = leerCola()
    const enCola = previa.some((x) => x.id === p.id && deMi(x))
    const pintar = (c) => {
      setCola(c.filter(deMi))
      setRuta((r) => (r ? aplicarCola({ ...r, pedidos: lista(r.pedidos).map((x) => (x.id === p.id
        ? { ...x, estado, cerrado_en: estado === 'pendiente' ? null : hecho_en, sin_enviar: false } : x)) }, c.filter(deMi)) : r))
    }
    if (estado === 'pendiente' && enCola) {
      const c = previa.filter((x) => !(x.id === p.id && deMi(x)))
      guardarCola(c)
      pintar(c)
      return 'guardado'
    }
    try {
      const { data: r } = await repEstado(p.id, estado, motivo, { ...datos, hecho_en })
      // LA ENTREGA VERIFICADA (01-11-2026): si la IA pide mirar la foto, se pregunta ahí mismo (nunca bloquea).
      if (estado === 'entregado' && datos.foto && r?.entrega_ia?.nivel === 'revisar') setRevisar({ p: r, ia: r.entrega_ia })
      if (enCola) {
        const c = leerCola().filter((x) => !(x.id === p.id && deMi(x)))
        guardarCola(c)
        setCola(c.filter(deMi))
      }
      return 'enviado'
    } catch (e) {
      if (!sinRed(e)) throw e
      const entrada = { id: p.id, estado, motivo: motivo || '', datos, hecho_en, quien: cuentaActual() }
      let c = previa.filter((x) => !(x.id === p.id && deMi(x))).concat(entrada)
      let ok = guardarCola(c)
      if (!ok && (datos.foto || datos.firma)) {
        const { foto: _foto, firma: _firma, ...resto } = datos
        c = c.map((x) => (x === entrada ? { ...entrada, datos: resto } : x))
        ok = guardarCola(c)
      }
      if (!ok) throw e
      pintar(c)
      return 'guardado'
    }
  }

  /* EL REGISTRO DEL INTENTO (30-10-2026): a qué hora se llegó (lo dice la guía), se llamó y se escribió; con
     «No entregado» va al servidor y el cliente ve en su enlace que se llamó y se esperó. Y LA PUERTA APRENDIDA: la
     posición del móvil al ir a entregar, que el servidor guarda si es precisa y usa la próxima vez. */
  function apuntar(p, que) {
    const i = intentos.current[p.id] || (intentos.current[p.id] = { llamadas: 0 })
    i[que] = new Date().toISOString()
    if (que === 'llamada') i.llamadas += 1
  }
  function pedirPosicionEntrega() {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => { posEntrega.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy, t: Date.now() } },
      () => {}, { enableHighAccuracy: true, timeout: 6000, maximumAge: 20000 })
  }
  function extrasDeLaCalle(p, estado) {
    const r = {}
    const i = intentos.current[p.id]
    if (i && (i.llegada || i.llamada || i.whatsapp)) {
      const primero = [i.llegada, i.llamada, i.whatsapp].filter(Boolean).sort()[0]
      r.intento = { ...i, espera_s: Math.max(0, Math.min(3600, Math.round((Date.now() - new Date(primero).getTime()) / 1000))) }
    }
    const pos = posEntrega.current || ultimaPos.current
    if (estado === 'entregado' && pos && (!pos.t || Date.now() - pos.t < 120000) && pos.precision != null) {
      r.posicion = { lat: pos.lat, lng: pos.lng, precision: pos.precision }
    }
    return r
  }
  /* DÓNDE APARQUÉ (30-10-2026): el punto de la furgoneta al bajarte, para volver sin dar vueltas. Se queda en el
     móvil (no se envía) y se olvida a las 12 horas. */
  async function aparcarAqui(punto) {
    // Con un punto (mantener pulsado el mapa), ahí; si no, donde está el móvil.
    const p = punto?.lat != null ? punto : await posicionAhora()
    if (!p) { setAviso(tx('No llega la ubicación del móvil.')); return }
    const f = { lat: p.lat, lng: p.lng, t: Date.now() }
    setFurgo(f); guarda(FURGO, JSON.stringify(f))
  }
  function quitarFurgo() { setFurgo(null); try { localStorage.removeItem(FURGO) } catch { /* nada */ } }
  /* IR A UNA PARADA (02-11-2026): con su punto, nuestra guía o la app elegida en «Ir con»; sin punto, «Situar la
     parada» y, al ponerlo, a guiar. Nunca Google Maps sin que se pulse su enlace. */
  function abrirSituar(p, luego = 'lista') {
    if (!p) return
    medirAccion('ruta_situar')
    setErrorPunto('')
    setSituando({ id: p.id, luego, parada: p })
  }
  const abrirSituarFicha = () => { medirAccion('ruta_situar'); setErrorPunto(''); setSituando({ ficha: true }) }
  function irA(p) {
    if (!p) return
    if (p.lat == null) { abrirSituar(p, 'guia'); return }
    if (nav === 'app') setGuiando(p.id)
    else window.open(navegar(p, nav), '_blank', 'noopener')
  }
  // Tras «Es aquí», la app de fuera puede no abrirse (el navegador bloquea la ventana que no sale del mismo toque):
  // entonces, nuestra guía, que también tiene su botón.
  function abrirFuera(p) {
    let w = null
    try { w = window.open(navegar(p, nav), '_blank') } catch { w = null }
    if (w) { try { w.opener = null } catch { /* nada */ } } else setGuiando(p.id)
  }
  /* «ES AQUÍ» (02-11-2026). Desde la ficha, el punto va al formulario y se guarda con él (con una sugerencia, también
     su dirección, sin perder el piso). Desde la ruta se guarda ya, sin cambiar la dirección (editar con lat, lng y
     geo_origen) y, si venía de «Ir», se guía hasta él. Desde el 03-11-2026 va también su precisión («calle»: la de una
     sugerencia sin el portal bajo la chincheta, conPrecision), y una «Otra calle» cambia la dirección a la suya, con el
     piso escrito (como conSugerencia): nunca lo escrito con el punto de otra calle.
     LA MISMA REGLA QUE LA FICHA (03-11-2026, el emulador y la revisión): con la chincheta donde la puso una sugerencia,
     situar.js alElegir con la dirección GUARDADA de la parada, no con lo buscado en «Situar» ni con la marca de la
     lista (con la búsqueda corregida a «Rúa Brétema, Oleiros», «Rúa Brétema, 15179 Oleiros» no salía marcada y la
     parada se quedaba con su dirección y el punto de Oleiros). La precisión sale de ahí, y la dirección, el CP y la
     población van solo si cambian (situar.js cambioEsAqui, el esAqui de la app nativa: otra calle, el CP o el pueblo
     añadidos, una suya, lo elegido para una sin número o el mismo portal escrito como lo da la sugerencia). Movido el
     mapa (o «Mi ubicación»), solo el punto: «manual», sin precisión y sin tocar la dirección. Desde la tanda del
     03-11-2026 de madrugada, también con el CP y la población guardados (situar.js mismoSitio: la misma calle en otro
     pueblo es «Otra calle»). */
  async function ponerPunto({ lat, lng, origen, sugerencia }) {
    const s = situando
    if (!s) return
    if (s.ficha) {
      setNuevo((n) => (!n ? n : origen === 'sugerencia' && sugerencia ? { ...n, ...conSugerencia(n, { ...sugerencia, lat, lng }) }
        : { ...n, lat, lng, geo_origen: origen, elegida_precision: '', ...(n.requiere_confirmar_direccion ? { direccion_confirmada: true } : {}) }))
      setSituando(null)
      medirAccion(`ruta_situar_${origen}`)
      return
    }
    const p = lista(ruta?.pedidos).find((x) => x.id === s.id) || s.parada
    if (!p) { setSituando(null); return }
    const { precision, ...cambio } = cambioEsAqui(p.direccion, origen, sugerencia, p.cp, p.localidad)
    setGuardandoPunto(true); setErrorPunto('')
    try {
      const { data } = await repMiEditar(p.id, { lat, lng, ...(origen ? { geo_origen: origen } : {}), ...conPrecision(precision), ...cambio })
      const g = puntoDe(data?.lat, data?.lng)
      setSituando(null)
      if (!g || Math.abs(g[0] - lat) > 1e-4 || Math.abs(g[1] - lng) > 1e-4) {
        // Un servidor de antes no guarda el punto sin cambiar la dirección: al menos se va a ese punto, no a la dirección.
        if (s.luego === 'guia') {
          window.open(navegar({ ...p, lat, lng }, fuera), '_blank', 'noopener')
          setAviso(tx('No se ha podido guardar el punto en el servidor: se abre en {app}.', { app: nombreNavegador(fuera) }))
        } else setAviso(tx('No se ha podido guardar el punto en el servidor.'))
        return
      }
      const geo = data?.geo || (precision === 'calle' ? 'aprox' : 'manual')
      // Lo que guardó el servidor manda (el CP que saca de la dirección si no iba).
      const nueva = cambio.direccion ? { ...cambio, ...(data?.direccion ? { direccion: data.direccion, cp: data.cp ?? cambio.cp,
        localidad: data.localidad ?? cambio.localidad } : {}) } : {}
      puntosNuevos.current[p.id] = { lat: g[0], lng: g[1], geo, ...nueva, t: Date.now() }
      setRuta((r) => (r ? { ...r, pedidos: lista(r.pedidos).map((x) => (x.id === p.id
        ? { ...x, ...nueva, lat: g[0], lng: g[1], geo, zona_lat: null, zona_lng: null } : x)) } : r))
      medirAccion(`ruta_situar_${origen}`)
      if (s.luego === 'guia') {
        if (nav === 'app') setGuiando(p.id)
        else abrirFuera({ ...p, lat: g[0], lng: g[1] })
      } else setAviso(tx('✓ Parada situada en el mapa'))
      cargar(true)
    } catch (e) {
      setErrorPunto(sinRed(e) ? tx('Sin conexión: no se ha podido guardar el punto. Prueba otra vez con cobertura.') : txError(e, 'No se pudo guardar el punto'))
    } finally { setGuardandoPunto(false) }
  }
  /* EL MAPA QUE RESPONDE (30-10-2026): lo que se toca en las ventanas del mapa. Ir, llamar y abrir una parada;
     dejar la furgoneta donde se mantuvo pulsado; quitarla. */
  function accionMapa(accion, dato) {
    const p = dato?.id ? lista(ruta.pedidos).find((x) => x.id === dato.id) : null
    if (accion === 'navegar' && p) {
      irA(p)
    } else if (accion === 'abrir' && p) {
      setAbierta(p.id)
      setTimeout(() => document.getElementById(`parada-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    } else if (accion === 'llamar' && p) apuntar(p, 'llamada')
    else if (accion === 'aparcar' && dato?.lat != null) aparcarAqui(dato)
    else if (accion === 'quitar_furgo') quitarFurgo()
  }

  async function marcar(p, estado, motivo, pago, extra) {
    // Con importe a cobrar, antes de dar por entregado hay que decir cómo pagó.
    if (estado === 'entregado' && p.cobrar > 0 && !pago) { setCobro(p); return }
    // Y después, la prueba de entrega (foto y/o nota), que se puede saltar.
    if (estado === 'entregado' && !extra) { pedirPosicionEntrega(); setCobro(null); setPrueba({ p, pago: pago || null }); setNotaEntrega(''); setEntrega({ donde: '', recibe: '', firma: '', firmando: false }); return }
    setOcupado(p.id)
    try {
      const como = await enviarOGuardar(p, estado, motivo, { ...(pago || {}), ...(extra || {}), ...extrasDeLaCalle(p, estado) })
      medirAccion(estado === 'entregado' ? 'ruta_entregado' : 'ruta_no_entregado')
      setFallo(null); setCobro(null); setPrueba(null); setAbierta(null)
      setDeshacer({ p, estado })
      if (navigator.vibrate) navigator.vibrate(estado === 'entregado' ? 60 : [40, 60, 40])
      if (como === 'guardado') setAviso(tx('Sin cobertura: guardado en el móvil. Se envía solo cuando vuelva la conexión.'))
      else cargar()
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
        briefingTrasOrdenar.current = true
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
    try {
      const como = await enviarOGuardar(d.p, 'pendiente', '', {})
      setAviso(tx('Vuelve a tu ruta: {quien}', { quien: d.p.cliente || d.p.direccion }))
      if (como === 'enviado') cargar()
    } catch (e) {
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
      // Lo dictado cambia la dirección: fuera lo que vino con el punto o la sugerencia (conDireccionNueva, 03-11-2026).
      if (oido) setNuevo((n) => conDireccionNueva(n, oido))
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

  if (err) return <Marco onBack={onBack} embebido={embebido} pantallaCompleta={pantallaCompleta}><p className="text-texto text-ruta-peligro-texto">{err}</p></Marco>
  if (!ruta) return <Marco onBack={onBack} embebido={embebido} pantallaCompleta={pantallaCompleta}><div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-400" aria-hidden="true" /></div></Marco>
  if (!ruta.activo) return <Marco onBack={onBack} embebido={embebido} pantallaCompleta={pantallaCompleta}><p className="text-texto text-dark-400">{tx('Tu empresa no usa el reparto por aquí.')}</p></Marco>

  const pendientes = lista(ruta.pedidos).filter((p) => !['entregado', 'fallido'].includes(p.estado)).sort(porOrden)
  const hechos = lista(ruta.pedidos).filter((p) => ['entregado', 'fallido'].includes(p.estado))
  const total = pendientes.length + hechos.length
  const entregados = hechos.filter((p) => p.estado === 'entregado')
  // EL CLIENTE AVISADO (01-11-2026): las pendientes con móvil, y cuántas se avisaron hoy.
  const conTelefono = pendientes.filter((p) => movilWhatsApp(p.telefono, ruta.pais, ruta.prefijo))
  const avisadosHoy = conTelefono.filter((p) => avisados.includes(p.id)).length
  /* LA RUTA EN MARCHA (17-10-2026): lo que se usa cien veces al día es la siguiente parada y su «Entregado». Con paradas,
     añadir va en el botón «+» de la cabecera (en la app, el portal y el panel) y el bono en una línea. */
  const q = sinTildes(filtro.trim())
  const visibles = q
    ? pendientes.filter((p) => sinTildes([p.cliente, p.direccion, p.telefono, p.codigo, p.contenido, p.notas].join(' ')).includes(q))
    : pendientes
  const siguiente = pendientes[0]
  const porId = Object.fromEntries(pendientes.map((p) => [p.id, p]))
  // La guía va a la elegida y, hecha esa, a la siguiente EN ORDEN (02-11-2026); sin punto, a «Situar la parada».
  const sigGuia = guiando ? (porId[guiando] || pendientes[0] || null) : null
  const objetivo = sigGuia?.lat != null ? sigGuia : null
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
    // LAS FALLIDAS EN EL DINERO (30-10-2026): lo que no se cobra por no entregar; es lo que hace querer el enlace del cliente.
    const fallidas = hechos.length - entregados.length
    dinero = { bruto, gasolina, neto, porHora: horas >= 0.25 ? neto / horas : null, fallidas, perdido: (fallidas * gan.pago_parada) / 100 }
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
      // En millas se escribe por milla y se guarda por km (30-10-2026).
      await repGanancias({ pago_parada: aCent(tarifa.parada), pago_dia: aCent(tarifa.dia), coste_km: unidades() === 'mi' ? Math.round(aCent(tarifa.km) / KM_POR_MILLA) : aCent(tarifa.km), bizum: (tarifa.bizum || '').trim() })
      medirAccion('ruta_tarifa')
      setTarifa(null); cargar()
    } catch (e) { setAviso(txError(e, 'No se pudo guardar')) } finally { setOcupado('') }
  }

  // La tarjeta de invitar (02-11-2026), si toca hoy: bajo la siguiente parada o, terminado el día, en el resumen.
  const tarjetaInvitar = invitarToca && invitarNo !== ruta.fecha && referido ? (
    <TarjetaInvitar r={referido}
      onCerrar={() => { guarda(`invitar_no_${ruta.fecha}`, '1'); setInvitarNo(ruta.fecha); medirAccion('invitar_entrega_no') }}
      onCopiado={(ok) => setAviso(ok ? tx('Enlace copiado: pégalo en un WhatsApp o en el grupo de tus compañeros.') : tx('No se pudo copiar'))} />
  ) : null

  /* EL DISEÑO COMPACTO (07-11-2026, §5.1 de la especificación). El orden: Cabecera · LineaEstado · un Aviso · el resumen
     del día · [ruta vacía | ruta terminada | la siguiente] · Promo · «Por entregar» y la lista · «Hechas hoy» · la línea
     final de la app. Lo que hace cada botón y lo que se manda al servidor no cambia; solo cómo se ve y dónde está: las
     filas abren su hoja (HojaParada) en vez de desplegarse, «Escanear» y «+» van en la cabecera, el buscador detrás de
     🔍, Escuchar · Ver la puerta · Hueco · Memoria · Editar en el ⋮ de la tarjeta, lo de debajo del mapa en «Lo que hay
     en tu ruta», los avisos pasajeros se van solos y la tarjeta no se va al buscar. */
  const conParadas = total > 0
  const enMapa = !reordenar && vista === 'mapa' && pendientes.length > 0
  const soloMapa = enMapa && pantallaCompleta   // en la app y el portal, el mapa ocupa la pantalla; en el panel, 420 y la lista
  const abajoFlotante = embebido && pantallaCompleta ? 64 : 0   // las pestañas de la app; en el portal y el panel, el borde
  let fechaCorta = ''
  try { fechaCorta = new Date(`${ruta.fecha}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '') } catch { fechaCorta = '' }
  const cerrarAnadir = () => setAnadir(false)
  const abrirEscaner = () => { medirAccion('ruta_escaner'); cerrarAnadir(); setEscaner(true) }
  // Con la ruta vacía no salen «+» ni el mapa; «Escanear paquetes» sí (se llama así para no chocar con el «Escanear» del bloque).
  const acciones = (
    <>
      {pendientes.length > 0 && !reordenar && (
        <Boton variante="icono" icono={vista === 'mapa' ? List : MapaIcono} tono="neutro" nombre={vista === 'mapa' ? tx('Ver la lista') : tx('Ver el mapa')}
          onClick={() => setVista(vista === 'mapa' ? 'lista' : 'mapa')} />
      )}
      <Boton variante="icono" icono={ScanLine} tono="neutro" nombre={tx('Escanear paquetes')} onClick={abrirEscaner} />
      {conParadas && <Boton variante="icono" icono={Plus} tono="neutro" nombre={tx('Añadir paradas')} onClick={() => { medirAccion('ruta_anadir'); setAnadir(true) }} />}
    </>
  )
  const abrirTarifa = ruta.autonomo && gan
    ? () => setTarifa({ bizum: gan.bizum || '', parada: aEuros(gan.pago_parada), dia: aEuros(gan.pago_dia), km: aEuros(unidades() === 'mi' ? Math.round(gan.coste_km * KM_POR_MILLA) : gan.coste_km) || (simboloMoneda() === '€' ? '0,12' : '') })
    : null
  // EL DÍA EN UNA TARJETA (01-11-2026): a la primera, lo limpio por hora (si hay tarifa) y a qué hora acabó.
  const compartir = entregados.length >= 5 && pendientes.length === 0 ? () => {
    const ini = ruta.jornada?.empezada ? new Date(ruta.jornada.empezada).getTime() : 0
    const fin = ruta.jornada?.terminada ? new Date(ruta.jornada.terminada).getTime() : Date.now()
    const fallidas = hechos.filter((p) => p.estado === 'fallido').length
    const cierres = hechos.map((p) => p.cerrado_en).filter(Boolean).sort()
    compartirDia({ paradas: entregados.length, minutos: ini ? (fin - ini) / 60000 : 0, km: Number(ruta?.ruta?.km) || 0,
      aLaPrimera: Math.round((entregados.length / (entregados.length + fallidas)) * 100), porHora: dinero?.porHora ?? null,
      horaFin: cierres.length ? new Date(cierres[cierres.length - 1]).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '' })
      .then((r) => { if (r === 'descargado') setAviso(tx('Imagen descargada y texto copiado: pégalo donde quieras.')) })
      .catch(() => setAviso(tx('No se pudo preparar la imagen')))
  } : null
  // Con qué se va a cada parada: la guía de la app (botón) o el enlace a Google Maps / Waze; sin punto, «Situar la parada».
  const comoIr = (p, desdeFila = false) => (p.lat != null && nav !== 'app' ? { hrefIr: navegar(p, nav) } : { onIr: desdeFila ? (x) => setGuiando(x.id) : irA })
  const hrefWhatsappDe = (p) => { const m = movilWhatsApp(p.telefono, ruta.pais, ruta.prefijo); return m ? `https://wa.me/${m}?text=${encodeURIComponent(mensaje(p, ruta.empresa))}` : '' }
  const hrefSmsDe = (p) => (ruta.pais === 'cn' && p.telefono ? `sms:${p.telefono.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(mensaje(p, ruta.empresa))}` : '')
  const zbeDe = (p) => (zbe?.paradas?.[p.id] ? zbe.paradas[p.id].tipo || zbe.tipo || 'ZBE' : '')
  const sinSituar = pendientes.filter((p) => p.lat == null)
  const enLista = visibles.filter((p) => p.id !== siguiente?.id)
  const fallidas = hechos.filter((p) => p.estado === 'fallido').length
  const altoMapa = pantallaCompleta ? 'calc(100dvh - 56px - 64px - env(safe-area-inset-bottom) - 24px)' : 420
  /* AÑADIR PARADAS (§5.4): la rejilla de 2×2 («Escanear», «Foto etiqueta», «Lista u hoja» con puede_pegar, «A mano»), el
     código con «Buscar» y «Cargar paquetes» (el autónomo). Con la ruta vacía, a la vista; con paradas, en la hoja del «+». */
  const bloqueAnadir = (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="principal" icono={ScanLine} texto={tx('Escanear')} onClick={abrirEscaner} className="min-h-14" />
        {/* La etiqueta del paquete trae dirección y teléfono: con una foto entra en la ruta sin que nadie haya metido la
            lista antes. Es lo que usa el autónomo que carga sus paquetes y sale. */}
        <label className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ruta-marca px-3 py-2 text-center text-boton text-ruta-marca ${ocupado === 'ticket' ? 'opacity-50' : ''}`}>
          {ocupado === 'ticket' ? <Loader2 size={20} className="shrink-0 animate-spin" aria-hidden="true" /> : <Camera size={20} className="shrink-0" aria-hidden="true" />}
          <span>{tx('Foto etiqueta')}</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado === 'ticket'}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { cerrarAnadir(); setNuevo({ ...VACIO }); leerTicket(f) } }} />
        </label>
        {ruta.puede_pegar && (
          <Boton variante="normal" contorno tono="neutro" icono={ClipboardPaste} texto={tx('Lista u hoja')} onClick={() => { cerrarAnadir(); setPegar({ texto: '', n: null }) }} className="min-h-14" />
        )}
        <Boton variante="normal" contorno tono="neutro" icono={PenLine} texto={tx('A mano')} onClick={() => { cerrarAnadir(); setNuevo({ ...VACIO }) }} className="min-h-14" />
      </div>
      <div className="flex gap-2">
        <Campo valor={codigo} onChange={setCodigo} ejemplo={tx('Código')} inputMode="text" className="min-w-0 flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') { cerrarAnadir(); buscar(codigo) } }} />
        <Boton variante="icono" icono={Search} tono="neutro" relleno nombre={tx('Buscar')} onClick={() => { cerrarAnadir(); buscar(codigo) }}
          disabled={!codigo.trim() || ocupado === 'buscar'} cargando={ocupado === 'buscar'} />
      </div>
      {ruta.autonomo && <Boton variante="normal" tono="aviso" icono={Package} texto={tx('Cargar paquetes')} onClick={() => { cerrarAnadir(); setCarga({ n: 0 }) }} />}
    </div>
  )
  const bono = ruta.autonomo && ruta.bono && !soloMapa
    ? <Bono b={ruta.bono} total={total} soloEjemplo={total > 0 && lista(ruta.pedidos).every((p) => p.ejemplo)} />
    : null

  return (
    <Marco onBack={onBack} embebido={embebido} pantallaCompleta={pantallaCompleta} fecha={fechaCorta} acciones={acciones}>
      {/* JORNADA Y UBICACIÓN. El autónomo no tiene oficina que le siga: a él no se le pide compartir nada. */}
      {ruta.autonomo ? null : jornadaAbierta ? (
        <LineaEstado punto="ok" texto={tx('En jornada · la oficina ve tu ubicación')} accion={tx('Terminar')} onAccion={() => jornada('terminar')} />
      ) : (
        <Boton variante="normal" contorno tono="neutro" icono={Play} texto={ruta.jornada?.terminada ? tx('Volver a empezar la jornada') : tx('Empezar jornada')}
          onClick={() => (ruta.aviso_aceptado ? jornada('empezar') : setVerAviso(true))} disabled={ocupado === 'jornada'} className="w-full" />
      )}

      {/* UN SOLO AVISO, el primero que toque (§5.1 b): la recién añadida, lo guardado sin enviar, sin conexión, la placa
          que hoy no circula, lo de otros días, la ruta de prueba, los ejemplos, lo de la cuenta (RutaApp) y el consejo
          del día (25-10-2026: uno al día, de lo que aún no usa y cuando le sirve; «Entendido» lo quita para siempre). */}
      {!soloMapa && (() => {
        const c = consejoDeHoy(ruta.fecha, { pendientes: pendientes.length, entregados: entregados.length, nav,
          ordenada: !!ruta.ruta?.fin, conHueco: lista(ruta.pedidos).some((p) => p.hueco) })
        if (c && lee('consejo_hoy', '') !== `${ruta.fecha}|${c.id}`) guarda('consejo_hoy', `${ruta.fecha}|${c.id}`)
        const entendido = c ? () => { guarda(`consejo_${c.id}`, 'visto'); medirAccion(`consejo_${c.id}`); setConsejoVisto((n) => n + 1) } : null
        const placa = (incidencias?.avisos || []).find((a) => a.hoy === true)
        return (
          <AvisoHueco
            anadida={anadida ? { p: anadida, onEscanear: () => { setAnadida(null); setEscaner(true) }, onSituar: () => { abrirSituar(anadida); setAnadida(null) },
              onCorregir: () => { editar(anadida); setAnadida(null) }, onCerrar: () => setAnadida(null) } : null}
            sinEnviar={cola.length > 0 ? { n: cola.length, onEnviar: vaciarColaEntregas } : null}
            sinConexion={copiaSinRed > 0 ? { hora: new Date(copiaSinRed).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) } : null}
            placa={placa ? { url: placa.url } : null}
            previas={ruta.previas > 0 && !previasNo && lee(`previas_no_${ruta.fecha}`, '') !== '1'
              ? { n: ruta.previas, onTraer: traerPrevias, ocupado: ocupado === 'previas', onCerrar: () => { guarda(`previas_no_${ruta.fecha}`, '1'); setPreviasNo(true) } } : null}
            prueba={ruta.prueba ? { onYaTengo: () => { salirDeLaDemoDeReparto(); window.location.href = '/panel/login' } } : null}
            ejemplos={pendientes.some((p) => p.ejemplo) ? { onQuitar: quitarEjemplos, ocupado: ocupado === 'ejemplo' } : null}
            avisoApp={avisoApp}
            consejo={c ? { c, onAccion: () => { entendido(); ordenar() }, onEntendido: entendido } : null} />
        )
      })()}

      {/* EL RESUMEN DEL DÍA (§5.1 c): cuánto queda, a qué hora acabas, si vas tarde, y los chips de la ruta. */}
      {conParadas && !soloMapa && (
        <ResumenDia pendientes={pendientes.length} hechos={hechos.length} total={total} rr={ruta.ruta} retraso={retraso}
          onOrdenar={reordenar ? null : ordenar} ordenando={ocupado === 'ordenar'}
          cargar={!reordenar && !!ruta.ruta?.fin && pendientes.some((p) => !p.cargado_en) ? { a: pendientes.filter((p) => p.cargado_en).length, b: pendientes.length, onClick: () => setCargaGuiada(true) } : null}
          avisar={!reordenar && !!ruta.ruta?.fin && conTelefono.length > 0 ? { a: avisadosHoy, b: conTelefono.length, onClick: () => setAvisarTodos(true) } : null}
          dinero={dinero && abrirTarifa ? { texto: euros(dinero.neto), onClick: abrirTarifa } : null} sinTarifa={!dinero ? abrirTarifa : null}
          cobrado={cobradoHoy} furgo={pendientes.length > 0 ? furgo : null} yo={yo} onAparcar={ruta.autonomo || embebido ? aparcarAqui : null} onQuitarFurgo={quitarFurgo}
          record={entregados.length >= 10 && entregados.length > (marcas?.mejor || 0)} />
      )}

      {/* LA RUTA VACÍA (§5.1 h): la acción misma, las formas de meter las paradas, y el ejemplo como enlace (quien va al
          ejemplo no suele volver a lo suyo: 14-10). El conductor de empresa, la misma rejilla con su texto de hoy. */}
      {!conParadas && (
        <div className="rounded-xl border border-dashed border-ruta-borde p-3">
          <p className="text-titulo text-dark-50">{tx('Carga tus paradas de hoy')}</p>
          <p className="mb-3 text-sec text-dark-400">{ruta.autonomo ? tx('Escanea los paquetes o pega la lista') : tx('Escanea los bultos según los cargas y se irán poniendo aquí.')}</p>
          {bloqueAnadir}
          {ruta.autonomo && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4">
              <Boton variante="texto" icono={Play} texto={tx('Ver un ejemplo')} onClick={cargarEjemplo} disabled={ocupado === 'ejemplo'} cargando={ocupado === 'ejemplo'} />
              <Boton variante="texto" icono={HelpCircle} texto={tx('¿Cómo funciona?')} onClick={() => setTour(0)} />
            </div>
          )}
        </div>
      )}

      {/* FIN DE LA RUTA (§5.1 i): el resumen del día, como al cerrar un bloque. */}
      {conParadas && pendientes.length === 0 && <><Resumen hechos={hechos} ruta={ruta.ruta} marcas={marcas} invitacion={tarjetaInvitar} onCompartir={compartir} />{alTerminar}</>}

      {/* LA SIGUIENTE PARADA (§5.1 d): la única tarjeta; tocarla abre su hoja. Debajo, la invitación tras la primera
          entrega (02-11-2026), justo detrás de la tarjeta. */}
      {siguiente && !reordenar && !soloMapa && (
        <TarjetaSiguiente p={siguiente} numero={siguiente.orden ?? 1} juntas={enPuerta[clavePuerta(siguiente)] || 1} zbe={zbeDe(siguiente)}
          onAbrir={(p) => setAbierta(p.id)} {...comoIr(siguiente)}
          onLlamar={() => apuntar(siguiente, 'llamada')} hrefWhatsapp={hrefWhatsappDe(siguiente)} onWhatsapp={() => apuntar(siguiente, 'whatsapp')} hrefSms={hrefSmsDe(siguiente)}
          onSituar={(p) => abrirSituar(p)} onEscuchar={() => decir(textoBriefing(siguiente))}
          onHueco={(p) => setHuecoDe(p)} onMemoria={(p) => setMemoriaDe(p)} onEditar={editar}
          onFallar={(p) => setFallo(p)} onEntregar={(p) => marcar(p, 'entregado')} ocupado={ocupado === siguiente.id} />
      )}
      {siguiente && !reordenar && !soloMapa && tarjetaInvitar}

      {/* LA PROMO (§5.1 e), una a la vez: el bono de bienvenida (17-10-2026) mientras no haya invitación a la vista. */}
      {!tarjetaInvitar && bono}

      {/* CAMBIAR EL ORDEN A MANO: el repartidor conoce la zona mejor que nadie. Filas de 56 y el pie fijo. */}
      {reordenar && (
        <div className="rounded-xl bg-dark-900">
          <p className="px-3 pt-3 text-sec text-dark-400">{tx('Arrastra cada parada por el asa, o usa las flechas. Al guardar se recalculan las horas con tu orden.')}</p>
          <ol className="mt-2 divide-y divide-dark-800">
            {reordenar.map((id, i) => {
              const p = porId[id]
              if (!p) return null
              return (
                <li key={id} ref={(el) => { filasOrden.current[id] = el }}
                  className={`flex min-h-14 items-center gap-2 px-2 ${arrastrando === id ? 'bg-ruta-marca-tinte' : ''}`}>
                  <button type="button" onPointerDown={(e) => empezarArrastre(e, id)} aria-label={`${tx('Arrastrar')} ${p.cliente || p.direccion}`}
                    style={{ touchAction: 'none' }} className="flex h-12 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-dark-400 active:cursor-grabbing"><GripVertical size={20} aria-hidden="true" /></button>
                  <span className="w-6 shrink-0 text-center text-etiqueta tabular-nums text-ruta-marca">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-nombre text-dark-50">{p.cliente || p.direccion}</span>
                    {p.cliente && <span className="block truncate text-sec text-dark-400">{p.direccion}</span>}
                  </span>
                  <Boton variante="icono" icono={ArrowUp} tono="neutro" nombre={`${tx('Subir')} ${p.cliente || p.direccion}`} onClick={() => mover(i, -1)} disabled={i === 0} />
                  <Boton variante="icono" icono={ArrowDown} tono="neutro" nombre={`${tx('Bajar')} ${p.cliente || p.direccion}`} onClick={() => mover(i, 1)} disabled={i === reordenar.length - 1} />
                </li>
              )
            })}
          </ol>
          <div className="sticky bottom-0 grid grid-cols-[1fr_2fr] gap-2 rounded-b-xl border-t border-dark-800 bg-dark-900 p-3">
            <Boton variante="normal" contorno tono="neutro" texto={tx('Cancelar')} onClick={() => setReordenar(null)} />
            <Boton variante="normal" texto={tx('Guardar este orden')} onClick={guardarOrden} disabled={ocupado === 'orden'} cargando={ocupado === 'orden'} />
          </div>
        </div>
      )}

      {/* EL MAPA (§5.7): a pantalla completa bajo la cabecera (en el panel, 420). Encima, las píldoras de lo que hay por
          las calles y de lo que falta por situar, «Lo que hay en tu ruta» (ⓘ) y las próximas paradas en Google Maps. */}
      {enMapa && (
        <div className="relative isolate">
          <Suspense fallback={<div style={{ height: altoMapa }} className="flex items-center justify-center rounded-xl border border-dark-800"><Loader2 className="animate-spin text-dark-400" aria-hidden="true" /></div>}>
            <MapaReparto alto={altoMapa} base={yo ? null : ruta.base} yo={yo} trazado={trazado} zonas={verZonas ? zonas?.zonas || SIN_ZONAS : SIN_ZONAS}
              incidencias={incidencias?.incidencias || SIN_ZONAS} zbe={zbe?.zonas || SIN_ZONAS} furgo={furgo} onAccion={accionMapa}
              fuente={incidencias?.fuente || ''} tipoZona={zbe?.tipo || 'ZBE'}
              paradas={lista(ruta.pedidos).map((p, i) => ({
                id: p.id, lat: p.lat, lng: p.lng, estado: p.estado, motivo: p.motivo, orden: p.orden, color: '#0ea5e9', grande: siguiente?.id === p.id,
                etiqueta: p.orden ?? i + 1, titulo: p.cliente || p.direccion, sub: p.eta ? `≈ ${p.eta} · ${p.direccion}` : p.direccion,
                // Lo que enseña la ventana al tocar la chincheta (30-10-2026).
                telefono: p.telefono || '', tipo: p.tipo, prioridad: !!p.prioridad, cobrar: p.cobrar > 0 ? euros(p.cobrar) : null,
                puerta: p.geo === 'puerta', zbe: zbe?.paradas?.[p.id]?.nombre || null, zbeTipo: zbe?.paradas?.[p.id]?.tipo || zbe?.tipo || 'ZBE',
                dice: p.cliente_dice ? textoClienteDice(p.cliente_dice) : null,
              }))} />
          </Suspense>
          {/* Debajo del zoom de Leaflet (arriba a la izquierda: 10 + 96 de alto + 10 de hueco = 116); las capas van arriba a la
              derecha (MapaReparto). A la derecha del zoom, la píldora pisaba «C/D» a 360 y a 280 tapaba «C/D» y «DGT» (revisor,
              07-11-2026, hallazgo 2). */}
          <div className="absolute left-3 top-[116px] z-[1100] flex max-w-[55%] flex-col items-start gap-2">
            <Pastilla texto={trazado?.fuente === 'carreteras' ? `${distancia(trazado.km)} · ${minutosATexto(trazado.minutos)}` : trazado ? tx('Sin ruta por calles') : tx('Calculando el recorrido…')} />
            {sinSituar.length > 0 && (
              <Pastilla tono="aviso" icono={MapPinOff} texto={sinSituar.length === 1 ? tx('1 sin situar') : tx('{n} sin situar', { n: sinSituar.length })} onClick={() => abrirSituar(sinSituar[0])} />
            )}
          </div>
          <div className="absolute bottom-7 left-3 z-[1100] flex flex-col items-start gap-2">
            <BotonMapa icono={Info} nombre={tx('Lo que hay en tu ruta')} onClick={() => setVerCapas(true)} />
            {/* Las próximas paradas de golpe en Google Maps (hasta 4; Waze no admite varias). */}
            {enlaceVarias(pendientes) && (
              <Pastilla href={enlaceVarias(pendientes)} target="_blank" rel="noreferrer" icono={ExternalLink} texto="Google Maps"
                nombre={tx('Las próximas {n} paradas en Google Maps', { n: Math.min(4, pendientes.filter((p) => p.lat != null).length) })} />
            )}
          </div>
        </div>
      )}

      {/* «POR ENTREGAR» Y LA LISTA (§5.1 f): la cabecera de 40 con 🔍 (con más de 5), «A mano» (con más de 1) y, en el
          portal, «Ir con»; filas en una sola superficie que abren su hoja. El buscador filtra la lista, no la tarjeta. */}
      {conParadas && !reordenar && !soloMapa && pendientes.length > 0 && (pendientes.length > 1 || !embebido) && (
        <div>
          {buscando ? (
            <div className="flex items-center gap-2">
              <Campo valor={filtro} onChange={setFiltro} icono={Search} ejemplo={tx('Buscar')} nombre={tx('Buscar en la ruta')} className="min-w-0 flex-1" autoFocus />
              <Boton variante="icono" icono={X} tono="neutro" nombre={tx('Cerrar')} onClick={() => { setBuscando(false); setFiltro('') }} />
            </div>
          ) : (
            <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1">
              {pendientes.length > 1 && <h2 className="min-w-0 flex-1 text-etiqueta text-dark-400">{tx('Por entregar')} · {pendientes.length - 1}</h2>}
              {pendientes.length > 5 && <Boton variante="icono" icono={Search} tono="neutro" nombre={tx('Buscar en la ruta')} onClick={() => setBuscando(true)} />}
              {pendientes.length > 1 && <Chip icono={ArrowUpDown} texto={tx('A mano')} onClick={() => { setReordenar(pendientes.map((p) => p.id)); setVista('lista') }} />}
              {/* CON QUÉ NAVEGA (17-10-2026): en la app se elige en Ajustes; el portal del conductor lo sigue teniendo aquí. */}
              {!embebido && (
                <label className="flex min-w-0 max-w-full items-center gap-2 text-sec text-dark-400">
                  <span className="shrink-0">{tx('Ir con')}</span>
                  <select value={nav} onChange={(e) => setNav(e.target.value)} aria-label={tx('Navegador')} className="campo w-auto min-w-0 max-w-full py-1 text-boton">
                    {NAVEGADORES.map(([k, t]) => <option key={k} value={k}>{tx(t)}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          {q && enLista.length === 0 && <p className="py-4 text-center text-texto text-dark-400">{tx('Sin resultados')}</p>}
          {enLista.length > 0 && (
            <ContenedorLista className="mt-1">
              {enLista.map((p) => (
                <FilaParada key={p.id} p={p} numero={p.orden ?? pendientes.indexOf(p) + 1} juntas={enPuerta[clavePuerta(p)] || 1} zbe={zbeDe(p)}
                  onTocar={(x) => setAbierta(x.id)} onSituar={(x) => abrirSituar(x)} {...(p.lat != null ? comoIr(p, true) : {})} />
              ))}
            </ContenedorLista>
          )}
        </div>
      )}

      {/* LO HECHO HOY, Y CORREGIBLE (§5.1 g; 10-10-2026): abierto si hay fallidas; las fallidas conservan en la fila «Volver
          a intentarlo» y «Entregado»; «Corregir: no se entregó» y «Repetir la foto», en la hoja de la parada. */}
      {hechos.length > 0 && !soloMapa && (
        <details className="group" open={fallidas > 0}>
          {/* El texto va suelto en el summary (no en un span): así «Hechas hoy · 1» es el propio summary, el que lleva la zona de
              toque de 48 en el móvil, y tocarlo no lo intercepta nadie. */}
          <summary className="min-h-12 cursor-pointer list-none py-4 text-etiqueta text-dark-400 [&::-webkit-details-marker]:hidden">
            <ChevronDown size={18} className="mr-2 inline-block align-middle transition-transform group-open:rotate-180" aria-hidden="true" />
            {tx('Hechas hoy')} · {hechos.length}{fallidas > 0 && <span className="text-ruta-peligro-texto"> · {tx('{n} sin entregar', { n: fallidas })}</span>}
          </summary>
          <ContenedorLista>
            {hechos.map((p, i) => (
              <FilaParada key={p.id} p={p} numero={i + 1} onTocar={(x) => setAbierta(x.id)}
                extra={p.estado === 'fallido' ? (
                  <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                    <Boton variante="normal" contorno tono="marca" icono={RotateCcw} texto={tx('Volver a intentarlo')} onClick={() => marcar(p, 'pendiente', '')} disabled={ocupado === p.id} />
                    <Boton variante="normal" tono="ok" icono={Check} texto={p.tipo === 'recogida' ? tx('Recogido') : tx('Entregado')} onClick={() => marcar(p, 'entregado')} disabled={ocupado === p.id} />
                  </div>
                ) : null} />
            ))}
          </ContenedorLista>
        </details>
      )}

      {/* La línea final de la app («Invita y gana», RutaApp), solo sin la promo de invitar a la vista. */}
      {!soloMapa && !tarjetaInvitar && pieApp}

      {/* AÑADIR PARADAS, desde el «+» de la cabecera (§5.4; el título y el nombre no cambian: los buscan las pruebas). */}
      {anadir && conParadas && <Hoja titulo={tx('Añadir paradas')} onClose={cerrarAnadir}><div className="pt-2">{bloqueAnadir}</div></Hoja>}

      {/* LO QUE HAY EN TU RUTA (§5.7): lo que iba debajo del mapa, con sus textos. Las zonas de carga y descarga
          (13-10-2026, OpenStreetMap: solo las apuntadas, sin saber si están libres); los cortes y obras y las zonas de bajas
          emisiones (30-10-2026), de la fuente abierta de cada país (DGT, Bison Futé, NDW, WZDx; ZBE, ZFE, ULEZ…), con su fuente
          (donde no hay, el servidor contesta `aplica: false` y no se dice nada); y lo que dice la norma de la placa en su
          ciudad (rodízio, Hoy No Circula, pico y placa…). */}
      {verCapas && (
        <Hoja titulo={tx('Lo que hay en tu ruta')} onClose={() => setVerCapas(false)}>
          <div className="flex flex-col gap-2 pt-2 text-texto text-dark-50">
            <label className="flex min-h-12 items-center gap-2">
              <input type="checkbox" checked={verZonas} onChange={(e) => cambiarZonas(e.target.checked)} className="h-5 w-5 shrink-0 accent-brand-500" />
              <Etiqueta texto="C/D" />
              <span className="min-w-0">
                {tx('Zonas de carga y descarga')}
                {verZonas && zonas && (
                  <span className="text-dark-400">
                    {' '}· {zonas.zonas.length ? tx('{n} cerca de tus paradas', { n: zonas.zonas.length }) : tx('ninguna apuntada cerca')}
                    {zonas.incompleto ? ` ${tx('(no se han podido cargar todas)')}` : ''} · OpenStreetMap
                  </span>
                )}
              </span>
            </label>
            {incidencias?.aplica !== false && <p data-testid="dgt" className="flex flex-wrap items-center gap-x-1">
              <AlertTriangle size={18} className="shrink-0 text-ruta-aviso-texto" aria-hidden="true" /> {tx('Cortes y obras')}{incidencias?.fuente ? ` (${incidencias.fuente.split(' · ')[0]})` : ''}:{' '}
              <span className="text-dark-400">
                {incidencias == null ? '…' : incidencias.incidencias.length
                  ? `${incidencias.incidencias.length === 1 ? tx('1 cerca de tu ruta') : tx('{n} cerca de tu ruta', { n: incidencias.incidencias.length })} · ${queIncidencia(incidencias.incidencias[0].que)}${incidencias.incidencias[0].carretera ? ` · ${incidencias.incidencias[0].carretera}` : ''}${incidencias.incidencias[0].parada ? ` · ${tx('a {km} km de la parada {n}', { km: String(incidencias.incidencias[0].distancia_km).replace('.', ','), n: incidencias.incidencias[0].parada })}` : ''}`
                  : tx('ninguna cerca de tu ruta')}
                {incidencias?.incompleto ? ` ${tx('(no se han podido cargar)')}` : ''}
              </span>
            </p>}
            {incidencias?.avisos?.map((a) => (
              <p key={`${a.ciudad}-${a.titulo}`} data-testid="norma"
                className={`rounded-xl px-3 py-2 ${a.hoy === true ? 'bg-ruta-peligro/10 text-ruta-peligro-texto' : a.hoy === false && a.digitos?.length ? 'bg-ruta-ok/10 text-dark-50' : 'bg-ruta-aviso text-ruta-aviso-texto'}`}>
                <b>{a.ciudad} · {a.titulo}:</b> {a.texto}
                {a.hoy === true ? <b> {tx('Hoy tu placa no puede circular.')}</b> : a.hoy === false && a.digitos?.length ? ` ${tx('Tu placa sí puede circular hoy.')}` : ''}
                {' '}<a href={a.url} target="_blank" rel="noreferrer" className="underline">{tx('Fuente oficial')}</a>
              </p>
            ))}
            {zbe?.zonas?.length > 0 && (
              <p data-testid="zbe" className="text-dark-50">
                {tx('Zonas de bajas emisiones')}{zbe.fuente ? ` (${zbe.fuente})` : ''}: {zbe.zonas.map((z) => z.nombre).join(', ')}
                {Object.keys(zbe.paradas || {}).length ? ` · ${Object.keys(zbe.paradas).length === 1 ? tx('1 parada dentro') : tx('{n} paradas dentro', { n: Object.keys(zbe.paradas).length })}` : ''}
                {zbe.zonas[0].descripcion ? ` · ${zbe.zonas[0].descripcion}` : ''}
              </p>
            )}
          </div>
        </Hoja>
      )}

      {/* LA HOJA DE LA PARADA (§5.2): la de una fila o la tarjeta; sustituye a la tarjeta que se desplegaba en la lista. */}
      {abierta && (() => {
        const p = lista(ruta.pedidos).find((x) => x.id === abierta)
        if (!p) return null
        const hecha = ['entregado', 'fallido'].includes(p.estado)
        return (
          <HojaParada p={p} numero={hecha ? hechos.indexOf(p) + 1 : (p.orden ?? pendientes.indexOf(p) + 1)} juntas={enPuerta[clavePuerta(p)] || 1} zbe={zbeDe(p)}
            onClose={() => setAbierta(null)} {...comoIr(p)}
            onLlamar={() => apuntar(p, 'llamada')} hrefWhatsapp={hrefWhatsappDe(p)} onWhatsapp={() => apuntar(p, 'whatsapp')} hrefSms={hrefSmsDe(p)}
            onHueco={(x) => setHuecoDe(x)} onSituar={(x) => abrirSituar(x)} onEditar={editar} onMemoria={(x) => setMemoriaDe(x)} onQuitar={quitarDeRuta}
            onRevisar={(x) => setRevisar({ p: x, ia: x.entrega_ia })} onFallar={(x) => setFallo(x)} onEntregar={(x) => marcar(x, 'entregado')}
            onReintentar={(x) => marcar(x, 'pendiente', '')} ocupado={ocupado === p.id} />
        )
      })()}

      {/* LO PASAJERO (§5.1 b): se va solo a los 6 s; encima del «Deshacer» si coinciden. */}
      {aviso && <AvisoFlotante abajo={(altoGuia || abajoFlotante) + (deshacer ? 60 : 0)} texto={aviso} onCerrar={() => setAviso('')} />}   {/* 52 del «Deshacer» con su detalle + 8 de hueco */}

      {encontrado && (
        <Hoja titulo={tx('Este paquete va en la parada')} onClose={() => setEncontrado(null)}
          pie={<Boton variante="principal" icono={ScanLine} texto={tx('Escanear el siguiente')} className="w-full" onClick={() => { setEncontrado(null); setEscaner(true) }} />}>
          {/* Diseño compacto (07-11-2026, §5.5): el número de 80 en «paquete», los datos en «titulo» / «texto» / «sec»,
              «Sin número hasta ordenar» cuando aún no hay orden y «Escanear el siguiente» en el pie fijo. */}
          <div className="flex items-center gap-3 pt-2">
            <NumeroParada n={encontrado.orden} tam="paquete" estado="siguiente" />
            <div className="min-w-0">
              <p className="text-titulo text-dark-50">{encontrado.cliente || tx('Cliente')}</p>
              <p className="text-texto text-dark-50">{encontrado.direccion}</p>
              <p className="mt-1 text-sec text-dark-400">{tx('bulto {a} de {b}', { a: encontrado.escaneos, b: encontrado.bultos })}</p>
            </div>
          </div>
          {encontrado.orden == null && <p className="mt-2 text-sec text-ruta-aviso-texto">{tx('Sin número hasta ordenar')}</p>}
          <p className="mb-2 mt-4 text-boton text-dark-50">{tx('¿Dónde lo dejas en la furgoneta?')}</p>
          <HuecoRejilla valor={encontrado.hueco} ocupado={ocupado === `hueco-${encontrado.id}`} onElegir={(h) => ponerHueco(encontrado, h)} />
        </Hoja>
      )}

      {/* ¿DÓNDE VA EN LA FURGONETA? (diseño compacto, 07-11-2026, §5.3): el cliente de subtítulo, la rejilla y «Quitar» como
          botón de texto. Fuera «Al llegar sabrás dónde buscarlo.». */}
      {huecoDe && (
        <Hoja titulo={tx('¿Dónde va en la furgoneta?')} subtitulo={huecoDe.cliente || huecoDe.direccion} onClose={() => setHuecoDe(null)}>
          <HuecoRejilla className="mt-2" valor={huecoDe.hueco} ocupado={ocupado === `hueco-${huecoDe.id}`} onElegir={(h) => ponerHueco(huecoDe, h)} />
          {huecoDe.hueco && (
            <Boton variante="texto" texto={tx('Quitar')} onClick={() => ponerHueco(huecoDe, '')} className="mt-2 w-full" />
          )}
        </Hoja>
      )}

      {/* EL RECORRIDO DE LA PRIMERA VEZ (diseño compacto, 07-11-2026, §5.1 h): el título de cada paso a 18 y su línea; la
          principal («Siguiente», o «Ver un ejemplo» al final sin paradas) en el pie fijo. Los pasos y lo que hacen, igual. */}
      {tour >= 0 && (() => {
        const PASOS = [
          [ScanLine, tx('1. Mete tus paquetes'), tx('Escanea el código o haz una foto a la etiqueta: la dirección y el teléfono entran solos. También puedes escribirla o pegar una lista.')],
          [Route, tx('2. Ordena la ruta'), tx('Pulsa «Ordenar ruta»: la app pone las paradas en el orden que menos tardas, con el tráfico de cada hora y la hora de llegada a cada una.')],
          [Navigation, tx('3. Navega y entrega'), tx('Pulsa «Ir»: te lleva con voz a cada puerta. Al llegar, «Entregado» con foto o firma, y pasa a la siguiente.')],
        ]
        const [Icono, titulo, texto] = PASOS[tour]
        const ultimo = tour === PASOS.length - 1
        return (
          <Hoja titulo={tx('Así funciona')} onClose={() => setTour(-1)}
            pie={!ultimo ? (
              <Boton variante="principal" texto={tx('Siguiente')} onClick={() => setTour(tour + 1)} className="w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                {pendientes.length === 0 && (
                  <Boton variante="principal" icono={Play} texto={tx('Ver un ejemplo')} cargando={ocupado === 'ejemplo'}
                    onClick={() => { setTour(-1); medirAccion('tour_ejemplo'); cargarEjemplo() }} className="w-full" />
                )}
                <Boton variante="normal" tono="neutro" contorno texto={tx('Empezar con mis paquetes')} onClick={() => setTour(-1)} className="w-full" />
              </div>
            )}>
            <div className="mt-2 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ruta-marca-tinte text-ruta-marca-tinte-texto"><Icono size={20} aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-titulo text-dark-50">{titulo}</p>
                <p className="mt-1 text-texto text-dark-400">{texto}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1" aria-hidden="true">
              {PASOS.map((_, i) => <span key={i} className={`h-1 rounded-full ${i === tour ? 'w-6 bg-brand-500' : 'w-1 bg-dark-700'}`} />)}
            </div>
          </Hoja>
        )
      })()}
      {/* «MI DINERO HOY» (diseño compacto, 07-11-2026, §5.1 j): arriba lo que decía la caja de la cabecera (limpio en grande;
          lo ganado, la gasolina y por hora; en peligro, lo que no se cobra por no entregar); debajo, la tarifa de siempre con
          su párrafo en el «?», el diésel y el Bizum como ayuda de su campo, y «Guardar» en el pie. Lo que se guarda, igual. */}
      {tarifa && (
        <Hoja titulo={tx('Mi dinero hoy')} onClose={() => setTarifa(null)}
          ayuda={{ texto: tx('Pon cómo te pagan y la app te dice cuánto llevas ganado hoy, la gasolina y lo que te queda limpio.') }}
          pie={<Boton variante="principal" texto={tx('Guardar')} onClick={guardarTarifa} cargando={ocupado === 'tarifa'} disabled={!aCent(tarifa.parada) && !aCent(tarifa.dia)} className="w-full" />}>
          {dinero && (
            <div className="mt-2 rounded-xl bg-ruta-ok/10 px-3 py-2">
              <p className="text-sec text-dark-400">{tx('Limpio')}</p>
              <p className="text-cifra text-ruta-ok-texto">{euros(dinero.neto)}</p>
              <p className="text-sec text-dark-400">
                {tx('Llevas {a} · gasolina ≈ {b}', { a: euros(dinero.bruto), b: euros(dinero.gasolina) })}
                {dinero.porHora != null ? ` · ${tx('{c}/hora', { c: euros(dinero.porHora) })}` : ''}
              </p>
              {dinero.fallidas > 0 && (
                <p className="text-sec text-ruta-peligro-texto">
                  {dinero.fallidas === 1 ? tx('1 sin entregar = {euros} sin cobrar', { euros: euros(dinero.perdido) }) : tx('{n} sin entregar = {euros} sin cobrar', { n: dinero.fallidas, euros: euros(dinero.perdido) })}
                </p>
              )}
            </div>
          )}
          {[['parada', tx('Te pagan por cada entrega ({moneda})', { moneda: simboloMoneda() }), simboloMoneda() === '€' ? '1,10' : '0', ''],
            ['dia', tx('Fijo por día, si te pagan así ({moneda})', { moneda: simboloMoneda() }), '0', ''],
            ['km', tx(unidades() === 'mi' ? 'Gasolina por milla ({moneda})' : 'Gasolina por km ({moneda})', { moneda: simboloMoneda() }), simboloMoneda() === '€' ? '0,12' : '0',
              simboloMoneda() === '€' ? tx('Una furgoneta diésel gasta unos 0,10–0,15 € por km. Solo lo ves tú.') : tx(unidades() === 'mi' ? 'Pon lo que gasta tu vehículo por milla. Solo lo ves tú.' : 'Pon lo que gasta tu vehículo por km. Solo lo ves tú.')]].map(([k, t, ej, ayudaCampo]) => (
            <div key={k} className="mt-3">
              <p className="mb-1 text-boton text-dark-50">{t}</p>
              <Campo valor={tarifa[k]} ejemplo={ej} nombre={t} ayuda={ayudaCampo || undefined} inputMode="decimal"
                onChange={(v) => setTarifa({ ...tarifa, [k]: v.replace(/[^0-9.,]/g, '') })} />
            </div>
          ))}
          {/* LA PROPINA (01-11-2026): el Bizum del repartidor, que el cliente ve en su enlace cuando ya tiene el paquete. */}
          {paisActual() === 'es' && (
            <div className="mt-3">
              <p className="mb-1 text-boton text-dark-50">{tx('Tu móvil de Bizum, para la propina (opcional)')}</p>
              <Campo valor={tarifa.bizum || ''} ejemplo="612 345 678" nombre={tx('Tu móvil de Bizum, para la propina (opcional)')} inputMode="tel" autoComplete="off"
                ayuda={tx('Cuando el cliente ya tiene el paquete, su enlace le dice «¿Le invitas a un café?» con tu Bizum. Lo que te manden es un ingreso tuyo.')}
                onChange={(v) => setTarifa({ ...tarifa, bizum: v.replace(/[^0-9+ ]/g, '') })} />
            </div>
          )}
        </Hoja>
      )}
      {pegar && (
        <Hoja titulo={tx('Pegar una lista de direcciones')} onClose={() => setPegar(null)}
          ayuda={{ texto: tx('Una parada por línea (de un correo, un Excel, un WhatsApp…). Si hay columnas con cabecera (dirección, cliente, teléfono, horario…), se leen.') }}
          pie={pegar.n == null ? (
            <Boton variante="principal" className="w-full" onClick={() => pegarLista(false)} disabled={pegar.texto.trim().length < 5 || ocupado === 'pegar'}
              cargando={ocupado === 'pegar'} texto={ocupado === 'pegar' ? tx('Leyendo…') : tx('Revisar')} />
          ) : (
            <Boton variante="principal" tono="ok" className="w-full" onClick={() => pegarLista(true)} disabled={ocupado === 'pegar'} cargando={ocupado === 'pegar'}
              texto={ocupado === 'pegar' ? tx('Añadiendo…') : pegar.n === 1 ? tx('Añadir 1 parada a mi ruta') : tx('Añadir {n} paradas a mi ruta', { n: pegar.n })} />
          )}>
          {/* Diseño compacto (07-11-2026, §5.4): el párrafo, al «?»; la foto y el fichero en una fila de 48; la caja con su
              ejemplo de siempre; «Revisar» y luego «Añadir {n} paradas a mi ruta», en el pie fijo. */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <BotonFichero variante="normal" contorno icono={Camera} texto={ocupado === 'hoja' ? tx('Leyendo…') : tx('Foto de la hoja')} cargando={ocupado === 'hoja'}
              accept="image/*" capture="environment" onFichero={leerHoja} />
            <BotonFichero variante="normal" contorno tono="neutro" icono={FileUp} texto={tx('Abrir un fichero')}
              accept=".csv,.txt,.tsv,text/plain,text/csv,text/tab-separated-values,.xlsx,.xls,.pdf" onFichero={abrirFichero} />
          </div>
          {pegar.nota && <p role="status" className="mt-2 text-sec text-ruta-aviso-texto">{pegar.nota}</p>}
          <textarea className="campo mt-2 h-40 resize-none py-3 font-mono" value={pegar.texto} aria-label={tx('Lista de direcciones')}
            onChange={(e) => setPegar({ texto: e.target.value, n: null, nota: pegar.nota })}
            placeholder={EJEMPLO_DIRECCIONES[ruta?.pais] || EJEMPLO_DIRECCIONES.en} />
        </Hoja>
      )}

      {guiando && (!sigGuia || sigGuia.lat != null) && (
        <Suspense fallback={<div className="fixed inset-0 z-[45] flex items-center justify-center bg-dark-950"><Loader2 className="animate-spin text-dark-400" /></div>}>
          <Navegacion parada={objetivo} numero={objetivo?.orden ?? (objetivo ? pendientes.indexOf(objetivo) + 1 : null)}
            quedan={pendientes.length} onSalir={() => setGuiando(null)}
            onEntregar={(p) => marcar(p, 'entregado')} onNoEntregar={(p) => setFallo(p)}
            onEntregarVoz={(p) => marcar(p, 'entregado', undefined, undefined, {})} onDeshacer={deshacer ? deshacerUltima : null}
            enlaceFuera={(p) => navegar(p, fuera)} nombreFuera={nombreNavegador(fuera)}
            onLlegar={(p) => { apuntar(p, 'llegada'); pedirPosicionEntrega() }} onAlto={setAltoGuia} />
        </Suspense>
      )}

      {/* SITUAR LA PARADA (02-11-2026): la de la ruta, o la de la ficha abierta (su dirección, su punto y la zona que
          encontró el servidor). Google Maps, solo en su enlace pequeño, y desde la ficha ni eso. */}
      {situando && (() => {
        const enFicha = !!situando.ficha
        const aSituar = enFicha
          ? { direccion: nuevo?.direccion || '', cp: cpFicha, localidad: locFicha, cliente: nuevo?.cliente || '',
              lat: nuevo?.lat ?? nuevo?.punto_actual?.lat ?? null,
              lng: nuevo?.lng ?? nuevo?.punto_actual?.lng ?? null, zona_lat: ubicada?.zona?.[0] ?? nuevo?.zona_lat ?? null,
              zona_lng: ubicada?.zona?.[1] ?? nuevo?.zona_lng ?? null }
          : lista(ruta.pedidos).find((x) => x.id === situando.id) || situando.parada
        if (!aSituar) return null
        return (
          <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-dark-950"><Loader2 className="animate-spin text-dark-400" /></div>}>
            <SituarParada parada={aSituar} base={ruta.base} otras={pendientes.filter((x) => x.lat != null && x.id !== aSituar.id)}
              pais={ruta.pais || ''} historial={!ruta.prueba} enlaceFuera={enFicha ? '' : navegar(aSituar, fuera)} nombreFuera={nombreNavegador(fuera)}
              guardando={guardandoPunto} error={errorPunto} onCerrar={() => { setSituando(null); setErrorPunto('') }} onElegir={ponerPunto} />
          </Suspense>
        )
      })()}

      {/* «Deshacer» (§5.1 b): el aviso flotante de 8 s, con la siguiente debajo. */}
      {deshacer && (
        <AvisoFlotante abajo={altoGuia || abajoFlotante} accion={tx('Deshacer')} onAccion={deshacerUltima} onCerrar={() => setDeshacer(null)}
          texto={`${deshacer.estado === 'entregado' ? (deshacer.p.tipo === 'recogida' ? tx('Recogido') : tx('Entregado')) : tx('No entregado')} · ${deshacer.p.cliente || deshacer.p.direccion}`}
          detalle={siguiente && siguiente.id !== deshacer.p.id ? `${tx('Siguiente:')} ${siguiente.cliente || siguiente.direccion}${siguiente.eta ? ` ≈ ${siguiente.eta}` : ''}` : ''} />
      )}

      {escaner && <Escaner onCodigo={buscar} onClose={() => setEscaner(false)} />}
      {cargaGuiada && (
        <CargaGuiada pedidos={pendientes} cargaPor={ruta.ruta?.carga_por} Escaner={Escaner} onClose={() => setCargaGuiada(false)} onCambio={cargar} />
      )}
      {seguidos?.abierto && (
        <Escaner seguido onCodigo={escaneoSeguido} onClose={cerrarSeguidos} ultimo={seguidos.ultimo || ''}
          estado={seguidos.nuevos + seguidos.yaEstaban + seguidos.revisar.length === 0 ? '' : [tx('{n} añadidos', { n: seguidos.nuevos }),
            seguidos.yaEstaban ? tx('{n} ya estaban', { n: seguidos.yaEstaban }) : '',
            seguidos.revisar.length ? tx('{n} para revisar', { n: seguidos.revisar.length }) : '',
            seguidos.enCola ? `${seguidos.enCola} ${tx('en cola')}` : ''].filter(Boolean).join(' · ')} />
      )}

      {carga && !nuevo && !seguidos?.abierto && (
        <Hoja titulo={carga.n ? (carga.n > 1 ? tx('{n} paquetes cargados', { n: carga.n }) : tx('1 paquete cargado')) : tx('Cargar paquetes')} onClose={() => setCarga(null)}
          ayuda={{ texto: tx('Haz una foto a la etiqueta de cada paquete: se lee el código, la dirección y el teléfono. Al acabar, «Montar ruta».') }}
          pie={<Boton variante="principal" tono="ok" className="w-full" icono={carga.n || pendientes.length ? Route : undefined} disabled={ocupado === 'ordenar'}
            onClick={() => { setCarga(null); if (pendientes.length) ordenar() }} texto={carga.n || pendientes.length ? tx('Montar ruta y empezar') : tx('Cerrar')} />}>
          {/* Diseño compacto (07-11-2026, §5.4): el párrafo, al «?»; «Primer / Siguiente paquete» (52, marca), «Escanear
              seguidos» (48, contorno), «Revisar {n} paquetes sin dirección» (aviso, si los hay) y «Escribirlo a mano» (48);
              «Montar ruta y empezar» (52, ok), en el pie fijo. */}
          <div className="flex flex-col gap-2 pt-2">
            <BotonFichero variante="principal" icono={Camera} cargando={ocupado === 'ticket'} accept="image/*" capture="environment"
              texto={ocupado === 'ticket' ? tx('Leyendo…') : carga.n ? tx('Siguiente paquete') : tx('Primer paquete')}
              onFichero={(f) => { if (f) { setNuevo({ ...VACIO }); leerTicket(f) } }} />
            <Boton variante="normal" contorno icono={ScanLine} texto={tx('Escanear seguidos')}
              onClick={() => { medirAccion('ruta_escaner'); setSeguidos((s) => ({ nuevos: 0, yaEstaban: 0, revisar: s?.revisar || [], ultimo: '', abierto: true })) }} />
            {seguidos?.revisar?.length > 0 && (
              <Boton variante="normal" tono="aviso" texto={tx('Revisar {n} paquetes sin dirección', { n: seguidos.revisar.length })} onClick={revisarSiguiente} />
            )}
            <Boton variante="normal" contorno tono="neutro" texto={tx('Escribirlo a mano')} onClick={() => { setNuevo({ ...VACIO }) }} />
          </div>
        </Hoja>
      )}

      {/* LA FICHA DE LA PARADA (diseño compacto, 07-11-2026, §5.9, W6): «Nueva parada» / «Editar parada» sobre la Hoja común, con el pie
          fijo («Añadir a mi ruta» / «Guardar cambios», de 52) y, al editar, el ⋮ con «Quitar de la ruta» (antes, un botón de abajo con
          su «¿Seguro? Toca otra vez…»; ahora el diálogo «¿Quitar esta parada?», como en la nativa: el ⋮ es el primer toque y el botón del
          diálogo, el segundo, con la misma función de antes). A la vista: la foto de la etiqueta (solo al crear), la dirección con su
          estado en una línea, las sugerencias (cinco como mucho), el cliente y el teléfono; lo demás, tras «Más datos». Lo que hace cada
          campo y lo que se guarda, igual que antes. */}
      {nuevo && (
        <Hoja titulo={nuevo.id ? tx('Editar parada') : nuevo.codigo ? tx('El código {c} no está en la lista', { c: nuevo.codigo }) : tx('Nueva parada')}
          onClose={() => { setNuevo(null); setQuitando(false) }}
          menu={nuevo.id ? [{ texto: tx('Quitar de la ruta'), icono: Trash2, peligro: true, onClick: () => setQuitando(true) }] : undefined}
          pie={(
            <Boton variante="principal" className="w-full" texto={ocupado === 'guardar' ? tx('Guardando…') : nuevo.id ? tx('Guardar cambios') : tx('Añadir a mi ruta')}
              cargando={ocupado === 'guardar'} onClick={guardarNuevo}
              disabled={nuevo.direccion.trim().length < 4 || ocupado === 'guardar' || (nuevo.requiere_confirmar_direccion && !nuevo.direccion_confirmada)} />
          )}>
          <div className="flex flex-col gap-3 pt-2">
            {!nuevo.id && (
              <div>
                <BotonFichero variante="normal" tono="neutro" icono={Camera} className="w-full" accept="image/*" capture="environment" cargando={ocupado === 'ticket'}
                  texto={ocupado === 'ticket' ? tx('Leyendo…') : tx('Foto etiqueta')} onFichero={(f) => leerTicket(f)} />
                <p className="mt-1 px-3 text-sec text-dark-400">{ruta.ia_tickets ? tx('La foto no se guarda') : tx('Se lee en el móvil')}</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <Campo className="min-w-0 flex-1" inputRef={dirInput} icono={MapPin} valor={nuevo.direccion} ejemplo={tx('Dirección completa')} autoComplete="street-address" style={ELIPSIS}
                  onChange={(v) => setNuevo({ ...conDireccionNueva(nuevo, v), ...(nuevo.requiere_confirmar_direccion ? { direccion_confirmada: true } : {}) })} />
                <Boton variante="icono" relleno tono={escuchando ? 'peligro' : 'neutro'} icono={Mic} nombre={escuchando ? tx('Parar de dictar') : tx('Dictar la dirección')}
                  aria-pressed={escuchando} onClick={dictar} className={escuchando ? 'animate-pulse' : ''} />
              </div>
              {escuchando && <p className="text-sec font-semibold text-ruta-peligro-texto">{tx('Te escucho: di la dirección…')}</p>}
              {/* EL ESTADO DE LA DIRECCIÓN (02-11-2026): antes de guardar se sabe si la parada estará en el mapa y, si no,
                  se elige una sugerencia o se sitúa en nuestro mapa. Desde el diseño compacto, en UNA línea con «…» (el texto
                  entero sigue en la página y en el título) y su acción a la derecha: «Situar» (que sigue llamándose «Situar en
                  el mapa») o «Cambiar». Sus textos no cambian. */}
              {(() => {
                // Una sugerencia «Sin el portal» elegida sigue siendo la calle sin la casa (02-11-2026): «Calle encontrada».
                const st = nuevo.lat != null ? (nuevo.geo_origen === 'mapa' ? 'mano' : nuevo.elegida_precision === 'calle' ? 'calle' : 'elegida')
                  : sinCambiar ? (nuevo.punto_actual ? estadoDeParada(nuevo.punto_actual) : nuevo.geo_actual === 'pendiente' ? 'buscando' : 'no')
                    : ubicada && ubicada.texto === textoDir ? (ubicada.buscando ? 'buscando' : ubicada.estado) : null
                if (!st) return null
                const bien = st === 'elegida' || st === 'mano' || st === 'portal'
                const texto = st === 'elegida' ? tx('Sitio encontrado en el mapa') : st === 'mano' ? tx('Situada a mano en el mapa')
                  : st === 'portal' ? tx('En el mapa') : st === 'calle' ? tx('Calle encontrada, sin el portal')
                    : st === 'buscando' ? tx('Buscando la dirección…') : tx('No la encuentro: elige una sugerencia o sitúala en el mapa')
                return (
                  <div data-testid="estado-direccion" data-estado={st} role="status"
                    className={`flex min-h-10 items-center gap-2 text-texto ${bien ? 'text-ruta-ok-texto' : st === 'buscando' ? 'text-dark-400' : st === 'no' ? 'font-semibold text-ruta-aviso-texto' : 'text-ruta-aviso-texto'}`}>
                    {st === 'buscando' ? <Loader2 size={18} aria-hidden="true" className="shrink-0 animate-spin" /> : bien ? <Check size={18} aria-hidden="true" className="shrink-0" />
                      : st === 'no' ? <MapPinOff size={18} aria-hidden="true" className="shrink-0" /> : <MapPin size={18} aria-hidden="true" className="shrink-0" />}
                    <span className="min-w-0 flex-1 truncate" title={texto}>{texto}</span>
                    {(st === 'calle' || st === 'no') && (
                      <Boton variante="texto" texto={tx('Situar')} nombre={tx('Situar en el mapa')} onClick={abrirSituarFicha} className="shrink-0" />
                    )}
                    {(st === 'elegida' || st === 'mano') && (
                      <Boton variante="texto" texto={tx('Cambiar')} onClick={abrirSituarFicha} className="shrink-0" />
                    )}
                  </div>
                )
              })()}
              {sugs.length > 0 && (
                // Las sugerencias, sobre un fondo propio (más claro que la hoja) y cinco como mucho, en filas de 48 (FilaSugerencia).
                <ul className="divide-y divide-dark-700 overflow-hidden rounded-xl bg-dark-800" aria-label={tx('Direcciones sugeridas')}>
                  {sugs.slice(0, 5).map((sg) => (
                    <FilaSugerencia key={`${sg.direccion}|${sg.lat}|${sg.lng}`} s={sg} onElegir={(x) => {
                      // Su punto y su dirección con el piso escrito; de su historial, también el cliente y el teléfono
                      // (conSugerencia, antes de MiRuta).
                      setNuevo({ ...nuevo, ...conSugerencia(nuevo, x) })
                      setSugs([])
                    }} />
                  ))}
                </ul>
              )}
            </div>
            {/* Lo leído de una etiqueta se revisa antes de guardar: el texto sale UNA vez (con la casilla, si el servidor pide confirmar la
                dirección; si no, solo el aviso). Las otras lecturas de la dirección, para elegir una. */}
            {nuevo.requiere_confirmar_direccion ? (
              <div role="alert" className="rounded-xl bg-ruta-aviso px-3 py-2 text-texto text-ruta-aviso-texto">
                <label className="flex min-h-12 cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-6 w-6 shrink-0 accent-ruta-ok" checked={!!nuevo.direccion_confirmada}
                    onChange={(e) => setNuevo({ ...nuevo, direccion_confirmada: e.target.checked })} />
                  <span>{tx('Revisa lo leído del ticket antes de guardar.')}</span>
                </label>
                {nuevo.alternativas_direccion?.length > 1 && (
                  <div className="flex flex-col gap-2 pb-1 pt-1">
                    {nuevo.alternativas_direccion.map((a, i) => (
                      <button key={`${a.direccion}-${a.cp}-${i}`} type="button"
                        onClick={() => setNuevo({ ...conDireccionNueva(nuevo, [a.direccion, a.cp, a.localidad].filter(Boolean).join(', ')),
                          cp: a.cp || '', localidad: a.localidad || '', direccion_confirmada: true })}
                        className="min-h-12 rounded-lg border border-ruta-aviso-texto/40 px-3 py-2 text-left text-boton">
                        { [a.direccion, a.cp, a.localidad].filter(Boolean).join(', ') }
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : nuevo.de_ticket && <Aviso tono="aviso" icono={AlertTriangle} texto={tx('Revisa lo leído del ticket antes de guardar.')} />}
            {/* «Cliente» y «Teléfono», en dos columnas desde 360; en un móvil más estrecho, uno debajo del otro. */}
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <Campo icono={User} valor={nuevo.cliente} ejemplo={tx('Cliente')} style={ELIPSIS} onChange={(v) => setNuevo({ ...nuevo, cliente: v })} />
              <Campo icono={Phone} valor={nuevo.telefono} ejemplo={tx('Teléfono')} inputMode="tel" style={ELIPSIS} onChange={(v) => setNuevo({ ...nuevo, telefono: v })} />
            </div>
            <MasDatos nuevo={nuevo} setNuevo={setNuevo} />
          </div>
          {quitando && nuevo.id && (
            <Hoja titulo={tx('¿Quitar esta parada?')} onClose={() => setQuitando(false)}
              pie={(
                <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                  <Boton variante="normal" contorno tono="neutro" texto={tx('Cancelar')} onClick={() => setQuitando(false)} />
                  <Boton variante="principal" tono="peligro" texto={tx('Quitar de la ruta')} onClick={quitarParada}
                    cargando={ocupado === 'guardar'} disabled={ocupado === 'guardar'} />
                </div>
              )}>
              <p className="pt-2 text-texto text-dark-50">{tx('{n} sale de tu ruta de hoy.', { n: nuevo.cliente || nuevo.direccion })}</p>
            </Hoja>
          )}
        </Hoja>
      )}

      {/* LAS HOJAS DE ENTREGAR (diseño compacto, 07-11-2026, §5.3): todas sobre la Hoja común, con el título en una línea,
          la principal en el pie fijo y lo largo detrás del «?». Los pasos y lo que se manda al servidor no cambian. */}
      {/* COBRAR: «Cobrar {x}» con «¿Cómo ha pagado?» de subtítulo, los métodos en una rejilla de 3 de 48 (marcan el pago y
          abren la prueba, como siempre) y «No ha pagado» como botón de texto (su nombre sigue siendo el de antes). */}
      {cobro && (
        <Hoja titulo={tx('Cobrar {euros}', { euros: euros(cobro.cobrar) })} subtitulo={tx('¿Cómo ha pagado?')} onClose={() => setCobro(null)}>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {metodosCobro().map(([k, t]) => (
              <Boton key={k} variante="normal" tono="ok" texto={tx(t)} onClick={() => marcar(cobro, 'entregado', '', { metodo: k })} />
            ))}
          </div>
          <Boton variante="texto" tono="peligro" texto={tx('No ha pagado')} nombre={tx('No ha pagado: no lo entrego')}
            onClick={() => marcar(cobro, 'fallido', 'No ha pagado')} className="mt-3 w-full" />
        </Hoja>
      )}

      {/* PRUEBA DE ENTREGA: «¿Dónde?» con los chips cortos (no en las recogidas), «¿Quién lo recoge?» con el chip «Firma» al
          lado («Firmado» cuando ya está; tocarlo vuelve a firmar), «Nota» y la línea de la foto; en el pie, «Foto y entregar»
          y «Entregar sin foto». El párrafo de siempre, en el «?». */}
      {prueba && (
        <Hoja titulo={tx('Prueba de entrega')} onClose={() => setPrueba(null)}
          ayuda={{ texto: `${tx('Una foto del paquete donde lo dejas (en el portal, con el vecino…) evita discusiones después.')} ${tx('Sin personas en la foto.')} ${tx('Es opcional.')}` }}
          pie={(
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="principal" icono={Camera} texto={tx('Foto y entregar')} cargando={ocupado === 'foto'} disabled={!!ocupado} onClick={abrirFoto} />
              <Boton variante="principal" contorno tono="neutro" texto={tx('Entregar sin foto')} disabled={!!ocupado}
                onClick={() => marcar(prueba.p, 'entregado', '', prueba.pago || { sin_cobro: true }, datosEntrega())} />
            </div>
          )}>
          {/* La cámara: el input va escondido y lo abre «Foto y entregar» (abrirFoto). Pequeña a propósito: 640 px y calidad
              0,6 son ~40-70 KB, de sobra para ver dónde quedó, y cabe en el pedido sin fotos sueltas por ahí. */}
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!ocupado}
            onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (!f) return
              setOcupado('foto')
              try {
                const blob = await compressImage(f, 640, 0.6)
                const foto = await dataUrlDe(blob)
                await marcar(prueba.p, 'entregado', '', prueba.pago || { sin_cobro: true }, { foto, ...datosEntrega() })
              } catch { setAviso(tx('No se pudo guardar la foto')); setOcupado('') }
            }} />
          {prueba.p.tipo !== 'recogida' && (
            <>
              <p className="mt-2 text-boton text-dark-50">{tx('¿Dónde?')}</p>
              <FilaChips>
                {DONDE_CORTO.map(([k, t]) => (
                  <ChipOpcion key={k} texto={tx(t)} seleccionado={entrega.donde === k}
                    onClick={() => setEntrega({ ...entrega, donde: entrega.donde === k ? '' : k })} />
                ))}
              </FilaChips>
              {CON_QUIEN.includes(entrega.donde) && (entrega.firmando
                ? <Firma className="mt-2" onListo={(firma) => setEntrega({ ...entrega, firma, firmando: false })} onCancelar={() => setEntrega({ ...entrega, firmando: false })} />
                : (
                  <div className="mt-2 flex items-center gap-2">
                    <Campo className="min-w-0 flex-1" valor={entrega.recibe} ejemplo={tx('¿Quién lo recoge?')} autoComplete="off"
                      onChange={(v) => setEntrega({ ...entrega, recibe: v })} />
                    <Chip icono={entrega.firma ? Check : PenLine} texto={entrega.firma ? tx('Firmado') : tx('Firma')} seleccionado={!!entrega.firma}
                      onClick={() => setEntrega({ ...entrega, firmando: true })} />
                  </div>
                ))}
            </>
          )}
          <Campo className="mt-3" valor={notaEntrega} ejemplo={tx('Nota')} onChange={setNotaEntrega} />
          <p className="mt-2 text-sec text-dark-400">{tx('Foto del paquete, sin personas.')}</p>
        </Hoja>
      )}

      {/* AVISAR A TODOS POR WHATSAPP: «Su hora y su enlace, uno a uno» de subtítulo (la frase larga, en el «?»); filas de 56
          con el número, el nombre y «≈ 09:58 · 613 403 123»; a la derecha, el WhatsApp de icono o «✓ Avisado». */}
      {avisarTodos && (
        <Hoja titulo={tx('Avisar a todos por WhatsApp')} subtitulo={tx('Su hora y su enlace, uno a uno')} onClose={() => setAvisarTodos(false)}
          ayuda={{ texto: tx('Un WhatsApp a cada cliente con su hora aproximada y su enlace para seguirte. Se abre uno a uno: envía y vuelve.') }}>
          <ContenedorLista className="mt-2">
            {conTelefono.map((p) => {
              const hecho = avisados.includes(p.id)
              return (
                <li key={p.id} className="flex min-h-14 items-center gap-3 py-2 pl-3 pr-1">
                  <NumeroParada n={p.orden} tam="fila" estado={hecho ? 'hecha' : 'pendiente'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-nombre text-dark-50">{p.cliente || p.direccion}</span>
                    <span className="block truncate text-sec text-dark-400">{p.eta ? `≈ ${p.eta} · ` : ''}{p.telefono}</span>
                  </span>
                  {hecho
                    ? <Etiqueta tono="ok" icono={Check} texto={tx('Avisado')} className="mr-2" />
                    : <Boton variante="icono" relleno tono="ok" icono={MessageCircle} nombre="WhatsApp" target="_blank" rel="noreferrer"
                        href={`https://wa.me/${movilWhatsApp(p.telefono, ruta.pais, ruta.prefijo)}?text=${encodeURIComponent(mensaje(p, ruta.empresa))}`}
                        onClick={() => { marcarAvisado(p.id); apuntar(p, 'whatsapp') }} />}
                </li>
              )
            })}
          </ContenedorLista>
        </Hoja>
      )}

      {/* LA MEMORIA DE LA CALLE (01-11-2026): el código del portal, dónde dejar y cómo se entra, para la próxima vez. */}
      {memoriaDe && (
        <MemoriaHoja p={memoriaDe} onClose={() => setMemoriaDe(null)} onGuardado={(memoria) => {
          const id = memoriaDe.id
          setMemoriaDe(null)
          setRuta((r) => (r ? { ...r, pedidos: lista(r.pedidos).map((x) => (x.id === id ? { ...x, memoria: memoria || undefined } : x)) } : r))
          setAviso(memoria ? tx('Guardado para la próxima vez en esta puerta.') : tx('Borrado.'))
          cargar()
        }} />
      )}

      {/* LA ENTREGA VERIFICADA (01-11-2026): la IA ha mirado la foto y pide revisarla. Repetirla manda la nueva con la
          parada ya entregada (el servidor la vuelve a mirar); «Está bien así» la deja. Nunca bloquea. Diseño compacto
          (07-11-2026): el aviso de la IA tal cual y «Es tu prueba de entrega. ¿La repites?»; «Repetir la foto» en el pie. */}
      {revisar && (
        <Hoja titulo={tx('Mira la foto de entrega')} onClose={() => setRevisar(null)}
          ayuda={{ texto: tx('La foto es tu prueba si alguien dice que no le ha llegado. Puedes repetirla ahora o dejarla así.') }}
          pie={(
            <div className="flex flex-col gap-2">
              <Boton variante="principal" icono={Camera} texto={tx('Repetir la foto')} cargando={ocupado === 'foto'} disabled={!!ocupado} onClick={abrirFoto} className="w-full" />
              <Boton variante="normal" tono="neutro" contorno texto={tx('Está bien así')} onClick={() => setRevisar(null)} className="w-full" />
            </div>
          )}>
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!ocupado}
            onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (!f) return
              const p = revisar.p
              setOcupado('foto')
              try {
                const foto = await dataUrlDe(await compressImage(f, 640, 0.6))
                setRevisar(null)
                await marcar(p, 'entregado', '', p.cobrar > 0 ? { metodo: p.cobrado_metodo || 'pagado' } : { sin_cobro: true }, { foto })
              } catch { setAviso(tx('No se pudo guardar la foto')); setOcupado('') }
            }} />
          <Aviso tono="aviso" icono={AlertTriangle} texto={textoAvisoIa(revisar.ia)} className="mt-2" />
          <p className="mt-3 text-texto text-dark-50">{tx('Es tu prueba de entrega. ¿La repites?')}</p>
        </Hoja>
      )}

      {/* NO ENTREGADO: los cinco motivos en una rejilla de 2 × 48; un toque lo marca, como siempre. */}
      {fallo && (
        <Hoja titulo={fallo.tipo === 'recogida' ? tx('¿Por qué no se ha recogido?') : tx('¿Por qué no se ha entregado?')} onClose={() => setFallo(null)}>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MOTIVOS.map((m) => (
              <Boton key={m} variante="normal" tono="neutro" contorno texto={tx(m)} onClick={() => marcar(fallo, 'fallido', m)} />
            ))}
          </div>
        </Hoja>
      )}

      {/* EL AVISO DE LA JORNADA (art. 90 LOPDGDD): se queda entero; solo pasa a la Hoja, con el botón en el pie. */}
      {verAviso && (
        <Hoja titulo={tx('Antes de empezar: tu ubicación')} onClose={() => setVerAviso(false)}
          pie={<Boton variante="principal" texto={tx('Entendido, empezar jornada')} onClick={() => jornada('empezar', true)} disabled={ocupado === 'jornada'} className="w-full" />}>
          <div className="mt-2 space-y-2 text-texto text-dark-50">
            <p className="flex gap-2"><MapPin size={18} className="mt-0.5 shrink-0 text-ruta-marca" aria-hidden="true" />
              {tx('Mientras tengas la jornada empezada, la oficina de tu empresa verá en el mapa por dónde vas, para organizar el reparto y avisar a los clientes.')}</p>
            <p>{tx('Solo se comparte desde que pulses «Empezar jornada» hasta que pulses «Terminar». Fuera de la jornada no se guarda nada.')}</p>
            <p>{tx('Solo se guarda tu última posición mientras la jornada está empezada, y se borra a los 30 días; el recorrido no se guarda. Lo ve solo tu empresa, que es la responsable de estos datos; puedes pedirle acceso o explicaciones cuando quieras.')}</p>
          </div>
        </Hoja>
      )}
      {/* LA BIENVENIDA (diseño compacto, 07-11-2026, §5.1 h): la misma pregunta y los mismos caminos, con el título a 18 y
          los botones en el pie; espera a que se cierre «Último paso: instala la app» (esperarBienvenida). */}
      {bienvenida && (
        <Hoja titulo={tx('Te damos la bienvenida a FDS')} onClose={() => setBienvenida(null)}
          pie={bienvenida === 'inicio' ? (
            <div className="flex flex-col gap-2">
              <Boton variante="principal" icono={Package} texto={tx('Sí, cargarlas ahora')} onClick={() => { setBienvenida('como'); medirAccion('bienvenida_cargar') }} className="w-full" />
              <Boton variante="normal" tono="neutro" contorno texto={tx('Todavía no')} onClick={() => { setBienvenida('luego'); medirAccion('bienvenida_luego') }} className="w-full" />
            </div>
          ) : bienvenida === 'luego' ? (
            <div className="flex flex-col gap-2">
              <Boton variante="normal" tono="neutro" contorno icono={Play} texto={tx('Mientras, verlo en acción con 3 paradas de ejemplo')} cargando={ocupado === 'ejemplo'}
                onClick={() => { setBienvenida(null); medirAccion('tour_ejemplo'); cargarEjemplo() }} className="w-full" />
              <Boton variante="texto" texto={tx('Ver cómo funciona en 3 pasos')} onClick={() => { setBienvenida(null); setTour(0) }} className="w-full" />
            </div>
          ) : null}>
          {bienvenida === 'inicio' ? (<>
            <p className="mt-2 text-titulo text-dark-50">{tx('¿Tienes ya tus paradas de hoy?')}</p>
            <p className="mt-1 text-texto text-dark-400">{tx('En los paquetes, en una hoja o en una lista: la app las lee y ordena la ruta sola.')}</p>
            {ruta.bono && !ruta.bono.pagado && (
              <p className="mt-2 text-boton text-ruta-aviso-texto">🎁 {tx('Tu primera ruta real te da {euros}.', { euros: eurosRef(ruta.bono.cent, locale()) })}</p>
            )}
          </>) : bienvenida === 'como' ? (<>
            <p className="mt-2 text-titulo text-dark-50">{tx('¿Cómo te llegan las paradas?')}</p>
            <p className="mt-1 text-texto text-dark-400">{tx('Elige una y te abro justo esa herramienta.')}</p>
            <FormasDeCargar className="mt-3" puedePegar={!!ruta.puede_pegar} onElegir={(f) => { setBienvenida(null); abrirForma(f) }} />
          </>) : (<>
            <p className="mt-2 text-nombre text-dark-50">{tx('Sin problema. Cuando cargues la furgoneta, abre la app y haz una foto a cada etiqueta.')}</p>
            {/* Que sepa que le llega y lo busque (24-10-2026): el correo de la mañana entra sin contraseña aunque lo abra en otro navegador. */}
            <p className="mt-2 flex items-start gap-2 text-texto text-dark-400">
              <Mail size={18} className="mt-0.5 shrink-0 text-ruta-marca" aria-hidden="true" /> {tx('Por la mañana te llega un correo con un botón para entrar directo a tu ruta, sin contraseña.')}
            </p>
            {!avisoPedido && (
              <div className="mt-3">
                <PedirAviso horaInicial={ruta.aviso_hora} onHecho={(r, hora) => { setBienvenida(null); setAviso(mensajeAviso(r, hora)) }} />
              </div>
            )}
          </>)}
        </Hoja>
      )}
    </Marco>
  )
}

/* LAS FORMAS DE RECIBIR LAS PARADAS (23-10-2026): la pregunta de la primera vez y el hueco vacío de la ruta
   enseñan las mismas cuatro, cada una con su herramienta (abrirForma). Sin «pegar» (no es el admin de la
   cuenta) solo quedan las etiquetas y a mano. Diseño compacto (07-11-2026, §5.1 h): solo el título de cada una, en
   botones de 48 (la primera, en tinte de marca); las cuatro explicaciones se van. */
const FORMAS = [
  ['etiquetas', Camera, 'Etiquetas en los paquetes'],
  ['hoja', FileText, 'Una hoja de reparto en papel'],
  ['lista', ClipboardPaste, 'Una lista en WhatsApp, Excel o correo'],
  ['mano', PenLine, 'Me las dicen de una en una'],
]
function FormasDeCargar({ onElegir, puedePegar, className = '' }) {
  const formas = FORMAS.filter(([f]) => puedePegar || (f !== 'hoja' && f !== 'lista'))
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {formas.map(([f, Icono, titulo], i) => (
        <Boton key={f} variante="normal" tono={i === 0 ? 'marca' : 'neutro'} contorno={i !== 0} icono={Icono} texto={tx(titulo)} onClick={() => onElegir(f)} className="w-full" />
      ))}
    </div>
  )
}

/* EL BONO DE BIENVENIDA: cuánto le falta para los 10 € de su primera ruta de verdad (20 entregas reales
   en 2 días distintos; lo cuenta el servidor con la misma vara que «Invita y gana»). Ganado, se celebra
   tres días y lleva a la cartera. Desde el diseño compacto (07-11-2026, §5.1 e) es una Promo de una línea: «{euros} por
   tu primera ruta real» con «{a}/{b} · {d} de {e} días», la barra de 2 y la pista debajo; tocarla abre las condiciones. */
function Bono({ b, total, soloEjemplo }) {
  const [ver, setVer] = useState(false)
  const euros = eurosRef(b.cent, locale())
  if (b.pagado) {
    const reciente = b.nuevo || (b.pagado_en && Date.now() - new Date(b.pagado_en).getTime() < 3 * 86400000)
    if (!reciente) return null
    return (
      <Promo tono="ok" icono={Trophy} testid="bono-ganado" texto={tx('¡Has ganado {euros}!', { euros })}
        pista={tx('Ya están en tu cartera. Invita a un compañero y gana {euros} más.', { euros })}
        onTocar={() => window.dispatchEvent(new Event('fds-ir-cuenta'))} />
    )
  }
  const objetivo = b.objetivo || 20
  const diasObjetivo = b.dias_objetivo || 2
  const hechas = Math.min(b.entregas || 0, objetivo)
  const dias = Math.min(b.dias || 0, diasObjetivo)
  const pista = b.revisar ? tx('Lo estamos revisando. Te avisamos por correo.')
    : soloEjemplo ? tx('Las paradas de ejemplo no cuentan: quítalas y mete las tuyas.')
      : total === 0 ? tx('Empieza con los paquetes de hoy: foto a la etiqueta de cada uno, aquí abajo.') : ''
  // Los días («1 de 2 días») bajan a la línea de la pista en cuanto hay avance: junto a «{a}/{b}» cortaban el texto a 360.
  const dosLineas = [hechas > 0 || dias > 0 ? tx('{a} de {b} días', { a: dias, b: diasObjetivo }) : '', pista].filter(Boolean).join(' · ')
  return (
    <>
      <Promo tono="aviso" icono={Gift} testid="bono" texto={tx('{euros} por tu primera ruta real', { euros })}
        cifra={`${hechas}/${objetivo}`} progreso={hechas / objetivo} pista={dosLineas}
        onTocar={() => setVer(true)} />
      {ver && (
        <Hoja titulo={tx('{euros} por tu primera ruta real', { euros })} onClose={() => setVer(false)}>
          <p className="pt-2 text-texto text-dark-50">{tx('Haz {n} entregas con la app en {d} días distintos y son tuyos. Hasta el {fecha}.', { n: objetivo, d: diasObjetivo, fecha: fechaRefPromo(locale(), b.hasta) })}</p>
          <p className="mt-2 text-texto text-dark-400">{tx('{a} de {b} entregas', { a: hechas, b: objetivo })} · {tx('{a} de {b} días', { a: dias, b: diasObjetivo })}</p>
        </Hoja>
      )}
    </>
  )
}

/* CON QUÉ NAVEGA (17-10-2026). En la app de quien reparte solo se elige en Ajustes: encima de la lista de paradas
   solo estorbaba. El portal del conductor lo sigue teniendo encima de la lista. Se guarda en el móvil. */
export function ElegirNavegador() {
  useIdioma()
  const [nav, setNav] = useState(() => lee('ruta_nav2', 'app'))
  useEffect(() => guarda('ruta_nav2', nav), [nav])
  return (
    <label className="flex items-center justify-between gap-3 text-[14px] font-semibold text-dark-100">
      <span className="flex items-center gap-1.5"><Navigation size={15} /> {tx('Navegar con')}</span>
      <select value={nav} onChange={(e) => setNav(e.target.value)} aria-label={tx('Navegador')}
        className="rounded-xl border border-dark-700 bg-dark-950 px-3 py-2 text-[14px] text-dark-50">
        {NAVEGADORES.map(([k, t]) => <option key={k} value={k}>{tx(t)}</option>)}
      </select>
    </label>
  )
}

/* EL MARCO (diseño compacto, 07-11-2026, §5.1 a): la Cabecera común («Hoy» y la fecha corta en la app; «Mi ruta» con ←
   en el portal) con «Ver el mapa», «Escanear paquetes» y «+»; fija con `pantallaCompleta` (la app y el portal), sin fijar
   en el panel de escritorio. Entre bloques, 12. */
function Marco({ onBack, children, embebido, pantallaCompleta = false, fecha = '', acciones = null }) {
  // En la app, de borde a borde (el contenedor de RutaApp lleva 16 a los lados); la clase va en la propia cabecera para
  // que la fija se pegue a lo largo de toda la columna, no solo dentro de una caja de su alto.
  const cabecera = (
    <Cabecera titulo={embebido ? tx('Hoy') : tx('Mi ruta')} onVolver={embebido ? undefined : onBack} acciones={acciones} fija={pantallaCompleta}
      subtitulo={fecha ? <span className={embebido ? '' : 'max-[300px]:hidden'}>{fecha}</span> : ''}
      className={embebido && pantallaCompleta ? '-mx-4' : ''} />
  )
  // Dentro del panel (el autónomo) va sin pantalla completa ni botón de volver.
  if (embebido) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3">
        {cabecera}
        {children}
      </div>
    )
  }
  return (
    <div className="min-h-[100dvh] bg-dark-950 pb-6">
      <div className="mx-auto flex max-w-md flex-col gap-3">
        {cabecera}
        <div className="flex flex-col gap-3 px-4">{children}</div>
      </div>
    </div>
  )
}

/* Abre la cámara de la hoja en la que está el botón (diseño compacto, 07-11-2026): «Foto y entregar» y «Repetir la foto»
   son piezas (Boton) en el pie, y el input de la foto va escondido en el cuerpo de la misma hoja. */
const abrirFoto = (e) => e.currentTarget.closest('[role="dialog"]')?.querySelector('input[type="file"]')?.click()

/* LA FIRMA CON EL DEDO (10-10-2026). Fondo blanco y trazo negro, como en
   papel; sale un PNG pequeño (480×160) que se guarda en el pedido. Diseño compacto (07-11-2026): los botones, a 48. */
function Firma({ onListo, onCancelar, className = '' }) {
  const lienzo = useRef(null)
  const trazo = useRef(null)
  const [vacia, setVacia] = useState(true)
  const limpiar = () => {
    const ctx = lienzo.current.getContext('2d')
    ctx.fillStyle = 'rgb(255, 255, 255)'; ctx.fillRect(0, 0, 480, 160)
    ctx.strokeStyle = 'rgb(17, 17, 17)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
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
    <div className={className}>
      <canvas ref={lienzo} width={480} height={160} aria-label={tx('Firma aquí con el dedo')}
        onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar}
        className="block aspect-[3/1] w-full touch-none rounded-xl bg-white" />
      <p className="mt-1 text-center text-sec text-dark-400">{tx('Firma aquí con el dedo')}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Boton variante="normal" tono="neutro" contorno texto={tx('Cancelar')} onClick={onCancelar} />
        <Boton variante="normal" tono="neutro" contorno texto={tx('Borrar')} onClick={limpiar} />
        <Boton variante="normal" tono="ok" texto={tx('Listo')} disabled={vacia} onClick={() => onListo(lienzo.current.toDataURL('image/png'))} />
      </div>
    </div>
  )
}

/* La furgoneta vista desde arriba, la cabina delante: seis zonas. Diseño compacto (07-11-2026, §5.3): celdas de 48 con
   radio 8, «Cabina» y «Puertas» en «sec» y la elegida en relleno de marca (fuera el azul cielo). */
function HuecoRejilla({ valor, onElegir, ocupado = false, className = '' }) {
  return (
    <div className={`rounded-xl border border-dark-800 p-2 ${className}`} role="group" aria-label={tx('Zona de la furgoneta')}>
      <p className="mb-1 text-center text-sec text-dark-400">{tx('Cabina')}</p>
      <div className="grid grid-cols-2 gap-2">
        {HUECOS.map((h) => (
          <button key={h} type="button" onClick={() => onElegir(h)} disabled={ocupado} aria-pressed={valor === h}
            className={`min-h-12 rounded-lg px-2 text-boton disabled:opacity-50 ${valor === h ? 'bg-brand-500 text-brand-tinta' : 'border border-ruta-borde bg-dark-900 text-dark-50'}`}>
            {tx(h)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-sec text-dark-400">{tx('Puertas')}</p>
    </div>
  )
}

/* «Más datos» de la ficha de la parada (diseño compacto, 07-11-2026, §5.9, W6): cerrado, salvo que algo de dentro ya tenga datos
   (al editar una parada, o lo leído de una etiqueta); si llegan datos de fuera con él cerrado se abre, y desde ahí se abre y se cierra
   a mano. Dentro: «Qué lleva» y «Horario» con sus atajos (3 chips que se deslizan), «¿Dónde va en la furgoneta?», «Bultos − 1 +» con el
   interruptor «Urgente» (una fila de 48) y «Entrega | Recogida» con «A cobrar». Lo que guarda cada campo es lo de siempre (`nuevo`). */
const ELIPSIS = { textOverflow: 'ellipsis' }   // el ejemplo y lo escrito de los campos de la ficha acaban en «…», no cortados
const conMasDatos = (n) => !!(n.contenido || n.horario || n.hueco || Number(n.bultos) !== 1 || n.prioridad || (n.tipo || 'entrega') !== 'entrega' || n.cobrar)
function MasDatos({ nuevo, setNuevo }) {
  const tiene = conMasDatos(nuevo)
  const [abierto, setAbierto] = useState(tiene)
  useEffect(() => { if (tiene) setAbierto(true) }, [tiene])
  const poner = (campos) => setNuevo({ ...nuevo, ...campos })
  const bultos = Math.min(99, Math.max(1, Number(nuevo.bultos) || 1))
  return (
    <div>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex min-h-12 w-full items-center justify-between text-left text-boton text-dark-50">
        {tx('Más datos')}
        <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-dark-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="flex flex-col gap-3 pt-1">
          <Campo icono={Package} valor={nuevo.contenido} ejemplo={tx('Qué lleva')} style={ELIPSIS} onChange={(v) => poner({ contenido: v })} />
          <div className="flex flex-col gap-2">
            <Campo icono={Clock} valor={nuevo.horario || ''} ejemplo={tx('Horario del cliente (ej. de 10 a 12)')} style={ELIPSIS} onChange={(v) => poner({ horario: v })} />
            <FilaChips testid="atajos-horario">
              {ATAJOS_HORARIO.map(([t, h]) => (
                <ChipOpcion key={t} texto={tx(t)} seleccionado={nuevo.horario === h} onClick={() => poner({ horario: nuevo.horario === h ? '' : h })} />
              ))}
            </FilaChips>
          </div>
          <div>
            <p className="mb-2 text-etiqueta text-dark-400">{tx('¿Dónde va en la furgoneta?')}</p>
            <HuecoRejilla valor={nuevo.hueco} onElegir={(h) => poner({ hueco: nuevo.hueco === h ? '' : h })} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="group" aria-label={tx('Bultos')} className="flex min-h-12 items-center gap-2">
              <span className="text-texto text-dark-50">{tx('Bultos')}</span>
              <Boton variante="icono" relleno tono="neutro" icono={Minus} nombre={tx('Uno menos')} disabled={bultos <= 1} onClick={() => poner({ bultos: bultos - 1 })} />
              <span className="min-w-6 text-center text-nombre tabular-nums text-dark-50">{bultos}</span>
              <Boton variante="icono" relleno tono="neutro" icono={Plus} nombre={tx('Uno más')} disabled={bultos >= 99} onClick={() => poner({ bultos: bultos + 1 })} />
            </div>
            {/* «Urgente»: un interruptor (la casilla de 13 px se fue) en una fila de 48. El <input> sigue siendo una casilla, con su rol, y
                cubre toda la fila sin verse: el toque es de 48 y el foco del teclado sale en el interruptor. */}
            <label className="relative flex min-h-12 cursor-pointer items-center gap-2 text-texto text-dark-50">
              {tx('Urgente')}
              <input type="checkbox" role="switch" className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" checked={!!nuevo.prioridad} onChange={(e) => poner({ prioridad: e.target.checked })} />
              <span aria-hidden="true"
                className="relative h-6 w-10 shrink-0 rounded-full border border-ruta-borde bg-dark-800 transition-colors after:absolute after:left-[3px] after:top-1/2 after:h-4 after:w-4 after:-translate-y-1/2 after:rounded-full after:bg-ruta-borde after:transition-transform peer-checked:border-ruta-ok peer-checked:bg-ruta-ok peer-checked:after:translate-x-4 peer-checked:after:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-ruta-enfasis" />
            </label>
          </div>
          <div className="grid grid-cols-1 items-center gap-2 min-[400px]:grid-cols-2">
            <Segmentado nombre={tx('Tipo de parada')} valor={nuevo.tipo || 'entrega'} onChange={(v) => poner({ tipo: v })}
              opciones={[{ valor: 'entrega', texto: tx('Entrega') }, { valor: 'recogida', texto: tx('Recogida') }]} />
            <Campo icono={Banknote} inputMode="decimal" valor={nuevo.cobrar || ''} ejemplo={tx('A cobrar ({moneda})', { moneda: simboloMoneda() })} style={ELIPSIS} onChange={(v) => poner({ cobrar: v })} />
          </div>
        </div>
      )}
    </div>
  )
}

/* LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026, Dani: «que empiecen a descargarla masivamente… lo más barato
   posible»). Nada más entregar la primera real de hoy, una Promo discreta (diseño compacto, 07-11-2026, §5.1 e): «Gana
   {euros} por compañero» con el WhatsApp ya escrito, corto y en su idioma, con su enlace y su código, y ✕ «Ahora no»
   (hasta mañana). Tocar el texto abre las condiciones (el importe y las condiciones los dice el servidor) con «Invitar por
   WhatsApp» y «Copiar el enlace» para el grupo de compañeros. */
function textoInvitarCorto(codigo) {
  const gratis = promoGratis() ? ` ${tx('Es gratis y sin límite hasta el {fecha}.', { fecha: fechaPromo(locale()) })}` : ''
  // El bono del invitado (lo que le convence a él), mientras dure: el mismo que anuncia compartir.js.
  const bono = refPromoActiva() ? ` ${tx('Tu primera ruta real te da {euros}.', { euros: eurosRef(BONO_CENT, locale()) })}` : ''
  return `${tx('Reparto con FDS: me ordena la ruta y me guía hasta cada puerta.')}${gratis}${bono} ${enlaceInvitar(codigo)}`
}
function TarjetaInvitar({ r, onCerrar, onCopiado }) {
  const [ver, setVer] = useState(false)
  const euros = eurosRef(Number(r.por_invitado) || refCentActual(), locale())
  const enlace = enlaceInvitar(r.codigo)
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(textoInvitarCorto(r.codigo))}`
  async function copiar() {
    medirAccion('invitar_entrega_copiar')
    try { await navigator.clipboard.writeText(enlace); onCopiado(true) } catch { onCopiado(false) }
  }
  return (
    <>
      <Promo tono="ok" icono={Gift} testid="invitar-entrega" texto={tx('Gana {euros} por compañero', { euros })} onTocar={() => setVer(true)}
        accion={<Boton variante="icono" icono={MessageCircle} tono="ok" relleno nombre={tx('Invitar por WhatsApp')} href={whatsapp} target="_blank" rel="noreferrer" onClick={() => medirAccion('invitar_entrega_whatsapp')} />}
        onCerrar={onCerrar} nombreCerrar={tx('Ahora no')} />
      {ver && (
        <Hoja titulo={tx('Invitar a un compañero')} onClose={() => setVer(false)}
          pie={(
            <div className="flex flex-col gap-2">
              <Boton variante="principal" tono="ok" icono={MessageCircle} texto={tx('Invitar por WhatsApp')} href={whatsapp} target="_blank" rel="noreferrer" onClick={() => medirAccion('invitar_entrega_whatsapp')} />
              <Boton variante="normal" contorno tono="neutro" icono={Copy} texto={tx('Copiar el enlace')} onClick={copiar} />
            </div>
          )}>
          <p className="pt-2 text-nombre text-dark-50">{tx('Gana {euros} por cada compañero que reparta con FDS', { euros })}</p>
          <p className="mt-1 text-texto text-dark-400">{tx('Lo cobras cuando haga {n} entregas en {d} días distintos.', { n: r.entregas_cartera ?? 20, d: r.dias_distintos ?? 2 })}</p>
        </Hoja>
      )}
    </>
  )
}

/* El cierre del día (diseño compacto, 07-11-2026, §5.1 i): plano con tinte ok, «✓ Ruta terminada», las tres cifras
   (hechas · sin hacer · cobrado; con más de una vía de cobro, una fila por vía), «{duración} · {km}», las marcas, «Comparte
   tu día» (con 5 o más) y la invitación. Solo cuenta lo que hay en las paradas; nada inventado. `invitacion` (02-11-2026):
   la tarjeta de invitar del día, en el lugar del botón de siempre. */
function Resumen({ hechos, ruta, marcas = null, invitacion = null, onCompartir = null }) {
  const ok = hechos.filter((p) => p.estado === 'entregado')
  const no = hechos.filter((p) => p.estado === 'fallido')
  const cobros = {}
  ok.forEach((p) => { if (p.cobrado_importe) cobros[p.cobrado_metodo || 'otro'] = (cobros[p.cobrado_metodo || 'otro'] || 0) + Number(p.cobrado_importe) })
  const horas = hechos.map((p) => p.cerrado_en).filter(Boolean).sort()
  const durMin = horas.length > 1 ? Math.round((new Date(horas[horas.length - 1]) - new Date(horas[0])) / 60000) : 0
  const NOMBRE = { efectivo: tx('Efectivo'), tarjeta: tx('Tarjeta'), bizum: 'Bizum', pix: 'Pix', transferencia: tx('Transferencia'), pagado: tx('Ya pagado'), otro: tx('Otro') }
  const cobrado = Object.values(cobros).reduce((a, b) => a + b, 0)
  const cifra = (valor, etiqueta, clase = 'text-dark-50') => (
    <div className="rounded-xl bg-dark-900 px-1 py-2 text-center">
      <p className={`break-words text-cifra tabular-nums ${clase}`}>{valor}</p>
      <p className="text-sec text-dark-400">{etiqueta}</p>
    </div>
  )
  const detalle = [durMin > 0 ? minutosATexto(durMin) : '', ruta?.km ? distancia(ruta.km) : ''].filter(Boolean).join(' · ')
  return (
    <section className="rounded-xl bg-ruta-ok/10 p-3" aria-label={tx('Resumen del día')}>
      <p className="flex items-center gap-2 text-titulo text-dark-50"><Check size={20} className="shrink-0 text-ruta-ok-texto" aria-hidden="true" /> {tx('Ruta terminada')}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {cifra(ok.length, tx('hechas'))}
        {cifra(no.length, tx('sin hacer'), no.length ? 'text-ruta-peligro-texto' : 'text-dark-50')}
        {cifra(euros(cobrado), tx('Cobrado'))}
      </div>
      {Object.keys(cobros).length > 1 && (
        <div className="mt-2 text-texto text-dark-50">
          {Object.entries(cobros).map(([m, v]) => (
            <p key={m} className="flex justify-between"><span className="text-dark-400">{NOMBRE[m] || m}</span><span className="tabular-nums">{euros(v)}</span></p>
          ))}
        </div>
      )}
      {detalle && <p className="mt-2 text-sec text-dark-400">{detalle}</p>}
      {/* SU PROGRESO (25-10-2026): solo lo que ha hecho él, contado por el servidor; lo de hoy, con las paradas. */}
      {marcas && (
        <div data-testid="marcas" className="mt-2 text-texto text-dark-50">
          {ok.length >= 10 && ok.length > (marcas.mejor || 0)
            ? <p className="font-semibold text-ruta-aviso-texto">🏆 {tx('¡Tu mejor día!')}</p>
            : marcas.mejor > 0 && <p>{tx('Tu mejor día: {n} entregas.', { n: marcas.mejor })}</p>}
          <p>{tx('Llevas {n} entregas con FDS.', { n: (marcas.total || 0) - (marcas.hoy || 0) + ok.length })}</p>
        </div>
      )}
      {onCompartir && <Boton variante="normal" tono="ok" icono={Share2} texto={tx('Comparte tu día')} onClick={onCompartir} className="mt-3 w-full" />}
      {invitacion ? <div className="mt-3">{invitacion}</div> : (
        <Boton variante="normal" contorno tono="ok" icono={MessageCircle} texto={tx('Invitar a un compañero')} onClick={invitar} className="mt-3 w-full" />
      )}
    </section>
  )
}

/* La hoja común (diseño compacto, 06-11-2026): la pinta piezas/Hoja (cabecera de 48, cuerpo desplazable, pie fijo si se
   le pasa `pie`, «?» con `ayuda` y ⋮ con `menu`). Sigue aquí para que las hojas de este fichero no cambien de nombre. */
function Hoja(props) {
  return <HojaPieza {...props} />
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

/* Un botón que abre el selector de ficheros (diseño compacto, 07-11-2026): la pieza Boton y, escondido, el <input type=file>
   de siempre, con el texto de nombre accesible (las pruebas lo buscan con getByLabel). Al elegir se vacía el input, para
   poder repetir el mismo fichero. `onFichero` recibe el fichero (o nada, si se canceló), como los onChange de antes. */
function BotonFichero({ texto, accept, capture, onFichero, disabled = false, cargando = false, ...resto }) {
  const entrada = useRef(null)
  return (
    <>
      <Boton texto={texto} disabled={disabled} cargando={cargando} onClick={() => entrada.current?.click()} {...resto} />
      <input ref={entrada} type="file" accept={accept} capture={capture} className="hidden" aria-label={texto} disabled={disabled || cargando}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onFichero(f) }} />
    </>
  )
}

/* `seguido` (13-10-2026): la cámara no se cierra tras cada paquete; los que ya
   se han leído no se repiten y lo de abajo cuenta lo que va.
   Diseño compacto (07-11-2026, §5.5): arriba, la ✕ de 48 con fondo (negro al 40 %, a la izquierda como en la nativa) y la
   píldora «Apunta al código» (negro al 60 %), con la zona segura; abajo, escaneando seguidos, una barra (radio 16, relleno 12,
   negro al 90 %) con lo que haya que contar: `ultimo` (lo último leído, 14/600, dos líneas), `grande` (el hueco o la parada,
   en «cifra» verde), `aviso` (un error de quien escanea: sustituye a lo anterior, con su icono) y `estado` (el contador, en
   «sec»), y el botón «Listo» de 48; en reposo, solo «Listo». La pantalla es negra en los tres temas, así que los colores van
   con clases que index.css NO aclara ni oscurece para el papel (text-green-300 y text-rose-400, no los emerald y red de 200 a
   400: en los temas día e híbrido se vuelven verde y rojo oscuros y sobre negro no se leen) y el botón es el tonal de marca. */
function Escaner({ onCodigo, onClose, seguido = false, estado = '', ultimo = '', grande = '', aviso = '' }) {
  useAtras(true, onClose)
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
        setError(tx('Este móvil no lee códigos: escribe el código'))
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
        setError(tx('Sin permiso de cámara'))
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={tx('Escanear')}>
      <div className="relative flex-1">
        {error ? <p className="px-4 pt-20 text-center text-texto">{error}</p> : (
          <>
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            {/* El recuadro, igual; con `border-white opacity-70` y no `border-white/70`, que index.css aclara en los temas día e híbrido. */}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-2xl border-2 border-white opacity-70" />
          </>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-2 pt-[max(8px,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} aria-label={tx('Cerrar')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/40">
            <X size={24} aria-hidden="true" />
          </button>
          {!error && (
            <span className="inline-flex h-8 min-w-0 items-center rounded-full bg-black/60 px-3 text-etiqueta"><span className="truncate">{tx('Apunta al código')}</span></span>
          )}
          <span className="w-12 shrink-0" aria-hidden="true" />
        </div>
        {seguido && (
          <div className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] flex items-end gap-2 rounded-2xl bg-black/90 p-3">
            <div role="status" aria-live="polite" className="min-w-0 flex-1">
              {aviso ? (
                <p className="flex items-start gap-2 text-boton text-rose-400">
                  <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{aviso}</span>
                </p>
              ) : (
                <>
                  {ultimo && <p className="line-clamp-2 text-boton">{ultimo}</p>}
                  {grande && <p className="text-cifra text-green-300">{grande}</p>}
                </>
              )}
              {estado && <LetraMax as="p" className="text-sec tabular-nums text-white/80">{estado}</LetraMax>}
            </div>
            <Boton variante="normal" texto={tx('Listo')} onClick={onClose} className="shrink-0" />
          </div>
        )}
      </div>
    </div>
  )
}
