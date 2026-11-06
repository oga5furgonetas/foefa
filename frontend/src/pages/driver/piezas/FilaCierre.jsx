/* diseño compacto */
/* La fila que cierra una parada (06-11-2026, §4): «No entregado» (contorno peligro, sin icono) y «✓ Entregado» (relleno
   ok), de 52, con 8 de hueco y pesos 1 : 1,2; «No recogido» / «Recogido» en las recogidas. El texto pasa a dos líneas antes
   de cortarse. «Entregado» se llama exactamente así (lo buscan las pruebas): el icono no se lee. */
import { Check } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'

export default function FilaCierre({ recogida = false, onFallar, onEntregar, disabled = false, cargando = false, className = '', testid }) {
  return (
    <div data-testid={testid} className={`grid grid-cols-[1fr_1.2fr] gap-2 ${className}`}>
      <Boton variante="principal" contorno tono="peligro" onClick={onFallar} disabled={disabled || cargando}
        texto={recogida ? tx('No recogido') : tx('No entregado')} />
      <Boton variante="principal" tono="ok" icono={Check} onClick={onEntregar} disabled={disabled} cargando={cargando}
        texto={recogida ? tx('Recogido') : tx('Entregado')} />
    </div>
  )
}
