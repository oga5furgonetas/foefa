/* diseño compacto */
/* La hoja de la parada (07-11-2026, §5.2 de la especificación): sale al tocar una fila o la tarjeta y sustituye a la
   tarjeta que se desplegaba en la lista. Sobre la Hoja común (role="dialog" con el nombre de la parada): el número, la
   dirección en dos líneas y la hora; una fila de chips de acción que se desliza («Ir», «Llamar», «WhatsApp», «Ver la
   puerta», «Hueco» o el hueco puesto con el nombre «En la furgoneta: {sitio}», «Sin situar · Situar»); las etiquetas sin
   el tope de 3; los datos en FilaDato sin «Teléfono:», «Código:», «Lleva:», «Horario:», «Motivo:» ni «Valoración del
   cliente:» a la vista (sí para el lector de pantalla); las notas de la puerta enteras; lo que dijo la IA de la foto con
   «Repetir la foto» al lado; y la valoración del cliente. El ⋮: «Editar» (pendientes) · «Memoria de la puerta» · «Quitar
   de la ruta» (peligro, pendientes, con su diálogo). El pie fijo: pendiente → FilaCierre; entregada → «Corregir: no se
   entregó» (abre los motivos); fallida → «Volver a intentarlo» + «✓ Entregado». Lo que hace cada botón es lo de siempre:
   llega de MiRuta. `useFachada` y `enlacePuerta` son el «Ver la puerta» de antes (Street View desde la calle mirando a la
   casa; el enlace existe desde el principio y se afina al llegar el rumbo), que también usa la tarjeta. */
import { useEffect, useState } from 'react'
import { AlertTriangle, Banknote, Check, Clock, Eye, KeyRound, MapPin, MapPinOff, MessageCircle, Navigation, Package, Pencil, Phone, RotateCcw, ScanLine, ShieldCheck, Star, Trash2, XCircle } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import { importe } from '../../../lib/region'
import { repFachada } from '../../../services/api'
import { textoAvisoIa } from '../../../lib/entregaIa'
import Boton from './Boton'
import Chip from './Chip'
import Etiqueta from './Etiqueta'
import FilaChips from './FilaChips'
import FilaCierre from './FilaCierre'
import FilaDato from './FilaDato'
import Hoja from './Hoja'
import NotasPuerta from './NotasPuerta'
import NumeroParada from './NumeroParada'

/* Las etiquetas de una parada pendiente, en el orden de §5.1 d (la tarjeta enseña tres y «+N»; la hoja, todas): Cobrar
   {x} · {a}–{b} con reloj · Urgente · Recogida · Puerta conocida · {n} en esta puerta · Sin el portal · ZBE · {n} bultos ·
   el hueco puesto («📦 Detrás · izq») · Ejemplo. */
export function etiquetasDe(p, { juntas = 1, zbe = '' } = {}) {
  const e = []
  if (p.cobrar > 0) e.push({ texto: tx('Cobrar {euros}', { euros: importe(p.cobrar) }), tono: 'aviso', icono: Banknote })
  if (p.ventana_desde) e.push({ texto: `${p.ventana_desde}–${p.ventana_hasta || ''}`, tono: 'neutro', icono: Clock })
  if (p.prioridad) e.push({ texto: tx('Urgente'), tono: 'aviso', icono: AlertTriangle })
  if (p.tipo === 'recogida') e.push({ texto: tx('Recogida'), tono: 'neutro', icono: Package })
  if (p.geo === 'puerta') e.push({ texto: tx('Puerta conocida'), tono: 'ok', icono: Check })
  if (juntas > 1) e.push({ texto: tx('{n} en esta puerta', { n: juntas }), tono: 'neutro' })
  if (p.lat != null && p.geo === 'aprox') e.push({ texto: tx('Sin el portal'), tono: 'aviso', icono: MapPin })
  if (zbe) e.push({ texto: zbe, tono: 'neutro' })
  if (p.bultos > 1) e.push({ texto: tx('{n} bultos', { n: p.bultos }), tono: 'neutro', icono: Package })
  if (p.hueco) e.push({ texto: tx(p.hueco), tono: 'neutro', icono: Package, titulo: tx('En la furgoneta: {sitio}', { sitio: tx(p.hueco) }) })
  if (p.ejemplo) e.push({ texto: tx('Ejemplo'), tono: 'neutro' })
  return e
}

/* SIN SITUAR (02-11-2026): un toque abre «Situar la parada»; con solo la calle, se puede afinar la puerta. */
export function ChipSituar({ p, onSituar, testid }) {
  if (p.lat == null) {
    return (
      <Chip tono="aviso" icono={MapPinOff} testid={testid} onClick={() => onSituar(p)}
        texto={`${p.geo === 'pendiente' ? tx('Buscando en el mapa…') : tx('Sin situar')} · ${tx('Situar')}`} />
    )
  }
  if (p.geo === 'aprox') return <Chip tono="neutro" icono={MapPin} texto={tx('Situar en el mapa')} onClick={() => onSituar(p)} />
  return null
}

/* VER LA PUERTA (10-10-2026). Street View desde la calle de la dirección y mirando a la casa (el servidor calcula el
   punto y el rumbo). El enlace existe desde el principio, apuntando a la casa; en cuanto llega el rumbo, se afina: así
   nunca es un botón muerto ni lo bloquea el navegador como ventana emergente. */
export function useFachada(p, activa = true) {
  const [vista, setVista] = useState(null)
  useEffect(() => {
    if (!activa || !p || p.lat == null) return undefined
    let vivo = true
    repFachada(p.id).then(({ data }) => { if (vivo) setVista(data) }).catch(() => {})
    return () => { vivo = false }
  }, [activa, p?.id, p?.lat, p?.lng])   // eslint-disable-line react-hooks/exhaustive-deps
  return vista
}
export function enlacePuerta(p, vista) {
  const v = vista || { lat: p.lat, lng: p.lng, rumbo: null }
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat},${v.lng}` + (v.rumbo != null ? `&heading=${v.rumbo}&pitch=5&fov=75` : '')
}

/* Un dato sin su etiqueta a la vista: la frase entera («Teléfono: 613 403 123») para el lector de pantalla. */
const dato = (frase, visible) => (
  <>
    <span className="sr-only">{frase}</span>
    <span aria-hidden="true">{visible}</span>
  </>
)

export default function HojaParada({
  p, numero, juntas = 1, zbe = '', onClose, onIr, hrefIr, onLlamar, hrefWhatsapp, onWhatsapp, hrefSms, onHueco, onSituar,
  onEditar, onMemoria, onQuitar, onRevisar, onFallar, onEntregar, onReintentar, ocupado = false, testid,
}) {
  const [confirmar, setConfirmar] = useState(false)
  const hecha = p.estado === 'entregado' || p.estado === 'fallido'
  const n = numero ?? p.orden
  const nombre = p.cliente || tx('Cliente')
  const conPuerta = p.lat != null && p.geo !== 'aprox'
  const fachada = useFachada(p, conPuerta)
  const etiquetas = hecha ? [] : etiquetasDe(p, { juntas, zbe })
  const estadoNumero = p.estado === 'entregado' ? 'hecha' : p.estado === 'fallido' ? 'fallida' : 'siguiente'
  const menu = [
    !hecha && onEditar && { texto: tx('Editar'), nombre: `${tx('Editar parada')}: ${p.cliente || p.direccion}`, icono: Pencil, onClick: () => onEditar(p) },
    onMemoria && { texto: tx('Memoria de la puerta'), icono: KeyRound, onClick: () => onMemoria(p) },
    !hecha && onQuitar && { texto: tx('Quitar de la ruta'), icono: Trash2, peligro: true, onClick: () => setConfirmar(true) },
  ].filter(Boolean)
  const bultos = [p.contenido, p.bultos > 1 ? tx('{n} bultos', { n: p.bultos }) : '',
    p.escaneos ? (p.escaneos > 1 ? tx('{n} escaneados', { n: p.escaneos }) : tx('1 escaneado')) : ''].filter(Boolean).join(' · ')
  const estrellas = p.estado === 'entregado' && p.valoracion?.estrellas > 0 ? p.valoracion.estrellas : 0
  const ia = p.estado === 'entregado' ? p.entrega_ia : null
  let pie = null
  if (!hecha) pie = <FilaCierre recogida={p.tipo === 'recogida'} onFallar={() => onFallar?.(p)} onEntregar={() => onEntregar?.(p)} disabled={ocupado} cargando={ocupado} />
  else if (p.estado === 'entregado') pie = <Boton variante="normal" contorno tono="peligro" texto={tx('Corregir: no se entregó')} onClick={() => onFallar?.(p)} disabled={ocupado} className="w-full" />
  else {
    pie = (
      <div className="grid grid-cols-[1fr_1.2fr] gap-2">
        <Boton variante="normal" contorno tono="marca" icono={RotateCcw} texto={tx('Volver a intentarlo')} onClick={() => onReintentar?.(p)} disabled={ocupado} />
        <Boton variante="principal" tono="ok" icono={Check} texto={p.tipo === 'recogida' ? tx('Recogido') : tx('Entregado')} onClick={() => onEntregar?.(p)} disabled={ocupado} cargando={ocupado} />
      </div>
    )
  }
  return (
    <Hoja titulo={nombre} onClose={onClose} menu={menu.length ? menu : undefined} pie={pie} testid={testid}>
      <div className="flex items-start gap-3 pt-1">
        <NumeroParada n={n} tam="siguiente" estado={estadoNumero} />
        <p className="min-w-0 flex-1 line-clamp-2 text-texto text-dark-50">{p.direccion}</p>
        {!hecha && p.eta && <span className={`shrink-0 text-boton tabular-nums ${p.tarde_min > 0 ? 'text-ruta-peligro-texto' : 'text-dark-400'}`}>{p.eta}{p.tarde_min > 0 ? ` +${p.tarde_min}` : ''}</span>}
      </div>
      <FilaChips className="mt-2">
        {!hecha && (hrefIr
          ? <Chip tono="marca" icono={Navigation} texto={tx('Ir')} href={hrefIr} target="_blank" rel="noreferrer" />
          : <Chip tono="marca" icono={Navigation} texto={tx('Ir')} onClick={() => onIr?.(p)} />)}
        {p.telefono && <Chip icono={Phone} texto={tx('Llamar')} href={`tel:${p.telefono}`} onClick={onLlamar} />}
        {hrefSms && <Chip icono={MessageCircle} texto={tx('SMS')} href={hrefSms} />}
        {!hrefSms && hrefWhatsapp && <Chip icono={MessageCircle} texto="WhatsApp" href={hrefWhatsapp} target="_blank" rel="noreferrer" onClick={onWhatsapp} />}
        {conPuerta && <Chip icono={Eye} texto={tx('Ver la puerta')} href={enlacePuerta(p, fachada)} target="_blank" rel="noreferrer" />}
        {!hecha && onHueco && (p.hueco
          ? <Chip icono={Package} texto={`📦 ${tx(p.hueco)}`} nombre={tx('En la furgoneta: {sitio}', { sitio: tx(p.hueco) })} onClick={() => onHueco(p)} />
          : <Chip icono={Package} texto={tx('Hueco')} onClick={() => onHueco(p)} />)}
        {!hecha && onSituar && <ChipSituar p={p} onSituar={onSituar} />}
      </FilaChips>
      {etiquetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {etiquetas.map((e) => <Etiqueta key={e.texto} texto={e.texto} tono={e.tono} icono={e.icono} titulo={e.titulo} />)}
        </div>
      )}
      {(p.telefono || p.codigo) && (
        <div className="mt-2 grid grid-cols-2 gap-x-2">
          {p.telefono && <FilaDato icono={Phone} texto={dato(tx('Teléfono: {x}', { x: p.telefono }), p.telefono)} />}
          {p.codigo && <FilaDato icono={ScanLine} texto={dato(tx('Código: {x}', { x: p.codigo }), p.codigo)} />}
        </div>
      )}
      {bultos && <FilaDato icono={Package} texto={dato(tx('Lleva: {x}', { x: bultos }), bultos)} />}
      {p.ventana_desde && <FilaDato icono={Clock} texto={dato(tx('Horario: de {a} a {b}', { a: p.ventana_desde, b: p.ventana_hasta || '' }), `${p.ventana_desde}–${p.ventana_hasta || ''}`)} />}
      {p.lat == null && !onSituar && <FilaDato icono={MapPin} texto={tx('Sin situar')} />}
      <NotasPuerta p={p} onMemoria={onMemoria ? () => onMemoria(p) : undefined} className="mt-2" />
      {/* LA ENTREGA VERIFICADA (01-11-2026): lo que dijo la IA de la foto; con aviso, se puede repetir. */}
      {ia?.nivel === 'verificada' && <FilaDato icono={ShieldCheck} texto={tx('Entrega verificada por IA')} className="mt-1 text-ruta-ok-texto" />}
      {ia?.nivel === 'revisar' && (
        <div className="mt-1 flex items-start gap-2">
          <FilaDato icono={AlertTriangle} texto={textoAvisoIa(ia)} className="min-w-0 flex-1 text-ruta-aviso-texto" />
          {onRevisar && <Boton variante="texto" tono="aviso" texto={tx('Repetir la foto')} onClick={() => onRevisar(p)} className="shrink-0" />}
        </div>
      )}
      {ia?.nivel === 'parcial' && ia.aviso && <FilaDato icono={AlertTriangle} texto={textoAvisoIa(ia)} className="mt-1" />}
      {/* LA VALORACIÓN DEL CLIENTE (01-11-2026): lo que puso en su enlace. */}
      {estrellas > 0 && (
        <FilaDato icono={Star} texto={dato(tx('Valoración del cliente: {e}', { e: estrellas === 1 ? tx('1 estrella') : tx('{n} estrellas', { n: estrellas }) }),
          <span className="text-ruta-aviso-texto">{'★'.repeat(estrellas)}{'☆'.repeat(5 - estrellas)} <span className="text-sec text-dark-400">{tx('el cliente')}</span></span>)} />
      )}
      {p.estado === 'fallido' && <FilaDato icono={XCircle} texto={dato(tx('Motivo: {x}', { x: p.motivo ? tx(p.motivo) : tx('No entregado') }), p.motivo ? tx(p.motivo) : tx('No entregado'))} className="text-ruta-peligro-texto" />}
      {confirmar && (
        <Hoja titulo={tx('¿Quitar esta parada?')} onClose={() => setConfirmar(false)}
          pie={(
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="normal" contorno tono="neutro" texto={tx('Cancelar')} onClick={() => setConfirmar(false)} />
              <Boton variante="principal" tono="peligro" icono={Trash2} texto={tx('Quitar de la ruta')} onClick={() => { setConfirmar(false); onQuitar(p) }} disabled={ocupado} />
            </div>
          )}>
          <p className="pt-2 text-texto text-dark-50">{tx('{n} sale de tu ruta de hoy.', { n: p.cliente || p.direccion })}</p>
        </Hoja>
      )}
    </Hoja>
  )
}
