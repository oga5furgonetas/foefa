/* diseño compacto */
/* Una sugerencia de dirección, en la ficha de la parada y en «Situar la parada» (W6, 07-11-2026, §5.9 y §5.10): fila de 48
   como mínimo con el icono de 18 (↺ si ya estuvo allí), la dirección en «texto» (dos líneas como mucho) y, debajo, en «sec»,
   «Ya estuviste aquí · 4 veces» (con el cliente si `conCliente`), «Otra calle» (en peligro) o «Sin el portal» (aviso). Es el
   <li> de una lista (el <ul> lo pone quien la usa, con su nombre «Direcciones sugeridas»); toda la fila es el botón. Los textos
   y su orden son los de siempre: solo cambian las medidas y los colores (como en la nativa, `FilaSugerencia` de FichaParada.kt).
   `s` = {direccion, conocida, veces, cliente, otraCalle, precision, …} (lib/situar.js); `onElegir(s)`. */
import { History, MapPin } from 'lucide-react'
import { tx } from '../../../lib/idioma'

export default function FilaSugerencia({ s, onElegir, conCliente = true, className = '' }) {
  return (
    <li>
      <button type="button" onClick={() => onElegir(s)}
        className={`flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left active:bg-dark-700 ${className}`}>
        {s.conocida ? <History size={18} aria-hidden="true" className="shrink-0 text-dark-400" /> : <MapPin size={18} aria-hidden="true" className="shrink-0 text-dark-400" />}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-texto text-dark-50">{s.direccion}</span>
          {s.conocida ? (
            <span className="block truncate text-sec text-dark-400">
              {tx('Ya estuviste aquí')} · {s.veces === 1 ? tx('1 vez') : tx('{n} veces', { n: s.veces })}{conCliente && s.cliente ? ` · ${s.cliente}` : ''}
            </span>
          ) : s.otraCalle ? (
            // No es la escrita (03-11-2026, como la app nativa): va al final y se dice, en peligro.
            <span className="block text-sec font-semibold text-ruta-peligro-texto">{tx('Otra calle')}</span>
          ) : s.precision === 'calle' ? <span className="block text-sec text-ruta-aviso-texto">{tx('Sin el portal')}</span> : null}
        </span>
      </button>
    </li>
  )
}
