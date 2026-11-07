/* diseño compacto */
/* La tarjeta de la siguiente parada (07-11-2026, §5.1 d de la especificación): superficie, borde de énfasis de 2, radio
   16, relleno 12; ~216 sin notas y 284 con todo. <section id="parada-<id>" aria-label="Siguiente parada">.
   - Arriba (todo abre la hoja de la parada, `onAbrir`): NumeroParada 40 · nombre (o dirección) en «titulo», una línea ·
     la hora a la derecha («boton» tabular; «+{n}» en peligro si llega tarde) · «›». La dirección en «texto», dos líneas
     como mucho. Una línea de etiquetas (tres como mucho y «+N»; `etiquetasDe`, que también usa la hoja) y, sin sitio, el
     chip «Sin situar · Situar» (`situar-parada`; «Buscando en el mapa…» mientras busca) o, con solo la calle, «Situar en
     el mapa»: abren «Situar la parada» como hoy (`onSituar`). Luego NotasPuerta, dos líneas.
   - Fila de 48: «▶ Ir» (tonal marca, ocupa el resto; `onIr` o `hrefIr`, la misma acción de siempre) + «Llamar» y
     «WhatsApp» de icono solo con teléfono (`hrefWhatsapp` solo con móvil; `hrefSms` en China) + «⋮»: «Escuchar» (nombre
     «Escuchar la siguiente parada»), «Ver la puerta» (situada y no aproximada; Street View con el rumbo que calcula el
     servidor, piezas/HojaParada useFachada), «Hueco», «Memoria de la puerta» y «Editar» (nombre «Editar parada: …»).
   - Fila de 52: FilaCierre («No recogido» / «Recogido» en las recogidas).
   Fuera el rótulo «SIGUIENTE PARADA», el teléfono escrito, «1 bulto», los chips-botón y los botones grises sin teléfono. */
import { ChevronRight, Eye, KeyRound, MessageCircle, Navigation, Package, Pencil, Phone, Volume2 } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'
import Etiqueta from './Etiqueta'
import FilaCierre from './FilaCierre'
import Menu from './Menu'
import NotasPuerta from './NotasPuerta'
import NumeroParada from './NumeroParada'
// Las etiquetas, el chip de situar y «Ver la puerta» viven en HojaParada (la hoja los enseña enteros); aquí, los mismos.
import { ChipSituar, enlacePuerta, etiquetasDe, useFachada } from './HojaParada'

/* Cuántas etiquetas caben en UNA línea de la tarjeta (tres como mucho, y sitio para «+N» si quedan más). La anchura se
   estima por los caracteres (12 px en negrita, ≈ 6 px cada uno, más el relleno y el icono) contra lo que queda libre en un
   móvil de 360 de ancho: no se mide, así que es lo mismo en cada pintado; el `overflow-hidden` de la línea es la red. */
const LIBRE = 296
const libreAhora = () => {
  if (typeof window === 'undefined') return LIBRE
  let escala = 1
  try { escala = Number(getComputedStyle(document.documentElement).getPropertyValue('--letra')) || 1 } catch { escala = 1 }
  return Math.min(LIBRE, window.innerWidth - 64) / escala   // la letra más grande ensancha cada etiqueta: se divide lo que cabe
}
const anchoDe = (e) => 20 + (e.icono ? 18 : 0) + String(e.texto).length * 6
function queCaben(etiquetas, libre) {
  const caben = []
  let usado = 0
  for (let i = 0; i < etiquetas.length && caben.length < 3; i += 1) {
    const w = anchoDe(etiquetas[i]) + (caben.length ? 8 : 0)
    const quedan = etiquetas.length - (i + 1)
    if (caben.length && usado + w + (quedan > 0 ? 44 : 0) > libre) break
    caben.push(etiquetas[i])
    usado += w
  }
  return caben
}

export default function TarjetaSiguiente({
  p, numero, juntas = 1, zbe = '', onAbrir, onIr, hrefIr, onLlamar, hrefWhatsapp, onWhatsapp, hrefSms, onSituar,
  onEscuchar, onHueco, onMemoria, onEditar, onFallar, onEntregar, ocupado = false, className = '',
}) {
  const n = numero ?? p.orden
  const num = n ?? '·'
  const nombre = p.cliente || p.direccion
  const tarde = p.tarde_min > 0
  const etiquetas = etiquetasDe(p, { juntas, zbe })
  const conChip = !!onSituar && (p.lat == null || p.geo === 'aprox')
  const visibles = queCaben(etiquetas, libreAhora() - (conChip ? 150 : 0))
  const demas = etiquetas.length - visibles.length
  const conPuerta = p.lat != null && p.geo !== 'aprox'
  const fachada = useFachada(p, conPuerta)
  const textoIr = <span className="max-[300px]:sr-only">{tx('Ir')}</span>
  const menu = [
    onEscuchar && { texto: tx('Escuchar'), nombre: tx('Escuchar la siguiente parada'), icono: Volume2, onClick: onEscuchar },
    conPuerta && { texto: tx('Ver la puerta'), icono: Eye, onClick: () => window.open(enlacePuerta(p, fachada), '_blank', 'noopener') },
    onHueco && { texto: tx('Hueco'), icono: Package, onClick: () => onHueco(p) },
    onMemoria && { texto: tx('Memoria de la puerta'), icono: KeyRound, onClick: () => onMemoria(p) },
    onEditar && { texto: tx('Editar'), nombre: `${tx('Editar parada')}: ${nombre}`, icono: Pencil, onClick: () => onEditar(p) },
  ].filter(Boolean)
  return (
    <section id={`parada-${p.id}`} aria-label={tx('Siguiente parada')} className={`rounded-2xl border-2 border-ruta-marca bg-dark-900 p-3 ${className}`}>
      <button type="button" onClick={() => onAbrir?.(p)} aria-label={`${tx('Ver la parada {n}', { n: num })}: ${nombre}`}
        className="flex w-full items-start gap-3 text-left">
        <NumeroParada n={n} tam="siguiente" estado="siguiente" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-titulo text-dark-50">{nombre}</span>
            <span className="flex shrink-0 items-center gap-1">
              {p.eta && (
                <span className={`text-boton tabular-nums ${tarde ? 'text-ruta-peligro-texto' : 'text-dark-400'}`}>
                  {p.eta}{tarde ? ` +${p.tarde_min}` : ''}
                </span>
              )}
              <ChevronRight size={20} className="text-dark-400" aria-hidden="true" />
            </span>
          </span>
          {p.cliente && <span className="line-clamp-2 block text-texto text-dark-400">{p.direccion}</span>}
        </span>
      </button>
      {/* UNA línea de etiquetas: las que caben (tres como mucho) y «+N»; con el chip de situar, a su lado. Las demás, en la hoja. */}
      {(visibles.length > 0 || conChip) && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            {visibles.map((e) => <Etiqueta key={e.texto} texto={e.texto} tono={e.tono} icono={e.icono} titulo={e.titulo} />)}
            {demas > 0 && <Etiqueta texto={`+${demas}`} />}
          </div>
          {conChip && <ChipSituar p={p} onSituar={onSituar} testid="situar-parada" />}
        </div>
      )}
      <NotasPuerta p={p} maxLineas={2} onMemoria={onMemoria ? () => onMemoria(p) : undefined} className="mt-2" />
      <div className="mt-3 flex items-center gap-2">
        {/* Con las cuatro acciones a 280 de ancho «Ir» se queda en 52: el texto pasa a solo-lector y queda el icono. */}
        {hrefIr
          ? <Boton variante="normal" icono={Navigation} texto={textoIr} href={hrefIr} target="_blank" rel="noreferrer" className="min-w-0 flex-1" />
          : <Boton variante="normal" icono={Navigation} texto={textoIr} onClick={() => onIr?.(p)} className="min-w-0 flex-1" />}
        {p.telefono && <Boton variante="icono" icono={Phone} tono="neutro" relleno nombre={tx('Llamar')} href={`tel:${p.telefono}`} onClick={onLlamar} />}
        {hrefSms && <Boton variante="icono" icono={MessageCircle} tono="ok" relleno nombre={tx('SMS')} href={hrefSms} />}
        {!hrefSms && hrefWhatsapp && <Boton variante="icono" icono={MessageCircle} tono="ok" relleno nombre="WhatsApp" href={hrefWhatsapp} target="_blank" rel="noreferrer" onClick={onWhatsapp} />}
        {menu.length > 0 && <Menu opciones={menu} relleno />}
      </div>
      <FilaCierre recogida={p.tipo === 'recogida'} onFallar={() => onFallar?.(p)} onEntregar={() => onEntregar?.(p)} disabled={ocupado} cargando={ocupado} apretado className="mt-2" />
    </section>
  )
}
