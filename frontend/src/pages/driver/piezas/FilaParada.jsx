/* diseño compacto */
/* La fila de una parada en la lista de «Hoy» y en «Hechas hoy» (06-11-2026, §4): 56 de alto mínimo (≈ 60), relleno
   12/8, el número de 32, el nombre («nombre», una línea) con la hora a la derecha («etiqueta», tabular, gris; «10:05 +8»
   en peligro si llega tarde) y, debajo, la dirección («texto» gris, una línea) con UNA etiqueta como mucho (gana: sin
   situar > cobrar > urgente > recogida > horario > «N en esta puerta» > puerta conocida > ZBE > hueco > ejemplo). Hecha:
   el número de hecha y «11:02 · Entregado · 24,50 €» (ok) o «11:02 · {motivo}» (peligro) en «etiqueta» tabular, como la
   nativa (07-11-2026), con la etiqueta de la IA si la
   hay («Verificada por IA» / «Revisar la foto»); `extra` deja debajo lo que la web conserva en la fila («Volver a
   intentarlo» / «Entregado» en las fallidas). Toda la fila es un botón («Ver la parada {n}: …») que abre la hoja de la
   parada; a la derecha, solo en la web, el botón de icono de siempre («Ir a {cliente}» / «Situar: {cliente}»), si se le
   pasa `onIr`, `hrefIr` u `onSituar`. Sin estado propio: vale para rutas de 300 paradas. */
import { AlertTriangle, Banknote, Check, Clock, MapPin, MapPinOff, Navigation, Package, ShieldCheck } from 'lucide-react'
import { tx, locale } from '../../../lib/idioma'
import { importe } from '../../../lib/region'
import Boton from './Boton'
import Etiqueta from './Etiqueta'
import NumeroParada from './NumeroParada'

const horaDe = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}

/* La etiqueta que gana en una fila pendiente, o ninguna. */
function etiquetaDe(p, juntas, zbe) {
  if (p.lat == null) return { texto: p.geo === 'pendiente' ? tx('Buscando en el mapa…') : tx('Sin situar'), tono: 'aviso', icono: MapPinOff }
  // «Cobrar» + el importe, como MiRuta.jsx y la nativa (07-11-2026): «Cobrar {euros}» es la clave de retirar dinero de la cartera.
  if (p.cobrar > 0) return { texto: `${tx('Cobrar')} ${importe(p.cobrar)}`, tono: 'aviso', icono: Banknote }
  if (p.prioridad) return { texto: tx('Urgente'), tono: 'aviso', icono: AlertTriangle }
  if (p.tipo === 'recogida') return { texto: tx('Recogida'), tono: 'neutro', icono: Package }
  if (p.ventana_desde) return { texto: `${p.ventana_desde}–${p.ventana_hasta || ''}`, tono: 'neutro', icono: Clock }
  if (juntas > 1) return { texto: tx('{n} en esta puerta', { n: juntas }), tono: 'neutro' }
  if (p.geo === 'puerta') return { texto: tx('Puerta conocida'), tono: 'ok', icono: Check }
  if (zbe) return { texto: zbe, tono: 'neutro' }
  if (p.hueco) return { texto: tx(p.hueco), tono: 'neutro', icono: Package }
  if (p.ejemplo) return { texto: tx('Ejemplo'), tono: 'neutro' }
  return null
}

/* La segunda línea de una hecha: la hora y lo que pasó. */
function estadoDe(p) {
  const h = horaDe(p.cerrado_en)
  const antes = h ? `${h} · ` : ''
  if (p.estado === 'entregado') {
    const que = p.tipo === 'recogida' ? tx('Recogido') : tx('Entregado')
    return { texto: `${antes}${que}${p.cobrado_importe ? ` · ${importe(p.cobrado_importe)}` : ''}`, ok: true }
  }
  const motivo = p.motivo ? tx(p.motivo) : (p.tipo === 'recogida' ? tx('No recogido') : tx('No entregado'))
  return { texto: `${antes}${motivo}`, ok: false }
}

function etiquetaIa(p) {
  if (p.estado !== 'entregado') return null
  if (p.entrega_ia?.nivel === 'verificada') return { texto: tx('Verificada por IA'), tono: 'ok', icono: ShieldCheck }
  if (p.entrega_ia?.nivel === 'revisar') return { texto: tx('Revisar la foto'), tono: 'aviso', icono: AlertTriangle }
  return null
}

export default function FilaParada({ p, numero, juntas = 1, zbe = '', onTocar, onIr, hrefIr, onSituar, extra, className = '', testid }) {
  const hecha = p.estado === 'entregado' || p.estado === 'fallido'
  const n = numero ?? p.orden
  const num = n ?? '·'
  const nombre = p.cliente || p.direccion
  const etiqueta = hecha ? etiquetaIa(p) : etiquetaDe(p, juntas, zbe)
  const estado = hecha ? estadoDe(p) : null
  const tarde = !hecha && p.tarde_min > 0
  let derecha = null
  if (!hecha && p.lat == null && onSituar) {
    derecha = <Boton variante="icono" icono={MapPin} tono="aviso" nombre={`${tx('Situar')}: ${nombre}`} onClick={() => onSituar(p)} className="self-center" />
  } else if (!hecha && p.lat != null && (hrefIr || onIr)) {
    derecha = hrefIr
      ? <Boton variante="icono" icono={Navigation} tono="marca" nombre={`${tx('Ir a')} ${nombre}`} href={hrefIr} target="_blank" rel="noreferrer" className="self-center" />
      : <Boton variante="icono" icono={Navigation} tono="marca" nombre={`${tx('Ir a')} ${nombre}`} onClick={() => onIr(p)} className="self-center" />
  }
  return (
    <li id={`parada-${p.id}`} data-testid={testid} className={`flex flex-col ${className}`}>
      <div className="flex items-stretch">
        <button type="button" onClick={() => onTocar?.(p)} aria-label={`${tx('Ver la parada {n}', { n: num })}: ${nombre}`}
          className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left ${derecha ? 'pr-1' : 'pr-3'}`}>
          <NumeroParada n={num} tam="fila" estado={hecha ? (p.estado === 'entregado' ? 'hecha' : 'fallida') : 'pendiente'} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-nombre text-dark-50">{nombre}</span>
              {!hecha && p.eta && (
                <span className={`shrink-0 text-etiqueta tabular-nums ${tarde ? 'text-ruta-peligro-texto' : 'text-dark-400'}`}>
                  {p.eta}{tarde ? ` +${p.tarde_min}` : ''}
                </span>
              )}
            </span>
            <span className="flex items-center justify-between gap-2">
              {hecha
                ? <span className={`truncate text-etiqueta tabular-nums ${estado.ok ? 'text-ruta-ok-texto' : 'text-ruta-peligro-texto'}`}>{estado.texto}</span>
                : <span className="truncate text-texto text-dark-400">{p.cliente ? p.direccion : ''}</span>}
              {etiqueta && <Etiqueta texto={etiqueta.texto} tono={etiqueta.tono} icono={etiqueta.icono} />}
            </span>
          </span>
        </button>
        {derecha}
      </div>
      {extra && <div className="pb-2 pl-14 pr-3">{extra}</div>}
    </li>
  )
}
