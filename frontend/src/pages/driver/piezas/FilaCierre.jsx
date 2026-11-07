/* diseño compacto */
/* La fila que cierra una parada (06-11-2026, §4): «No entregado» (contorno peligro, sin icono) y «✓ Entregado» (relleno
   ok), de 52, con 8 de hueco y pesos 1 : 1,2; «No recogido» / «Recogido» en las recogidas. El texto pasa a dos líneas antes
   de cortarse. «Entregado» se llama exactamente así (lo buscan las pruebas): el icono no se lee. */
import { Check } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'

/* Las columnas se pueden encoger (`minmax(0, …)`) y, con 300 o menos de ancho (280 es un móvil de 360 al 130 % de zoom), los
   dos botones van uno debajo del otro: con «Letra más grande» «No entregado» y «Entregado» no cabían lado a lado, el
   pie de la hoja ensanchaba la hoja entera y la ✕ y la hora se salían de la pantalla (07-11-2026, W2).
   `apretado` (opcional, 07-11-2026, W2): relleno de 12 a los lados en vez de 16, para la tarjeta de la siguiente: a 360 de
   ancho «No entregado» ocupa 137 con el de 16 y el botón mide 132 (pasaba a dos líneas y la tarjeta crecía 10). */
export default function FilaCierre({ recogida = false, onFallar, onEntregar, disabled = false, cargando = false, apretado = false, className = '', testid }) {
  const ajuste = apretado ? '!px-3' : ''
  return (
    <div data-testid={testid} className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 max-[300px]:grid-cols-1 ${className}`}>
      <Boton variante="principal" contorno tono="peligro" onClick={onFallar} disabled={disabled || cargando} className={ajuste}
        texto={recogida ? tx('No recogido') : tx('No entregado')} />
      <Boton variante="principal" tono="ok" icono={Check} onClick={onEntregar} disabled={disabled} cargando={cargando} className={ajuste}
        texto={recogida ? tx('Recogido') : tx('Entregado')} />
    </div>
  )
}
