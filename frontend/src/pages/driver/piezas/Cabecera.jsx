/* diseño compacto */
/* La cabecera de cada pantalla de la app de reparto (06-11-2026, §4): 56 de alto, el título «titulo» en una línea con el
   subtítulo «sec» gris al lado (la fecha corta de la ruta, por ejemplo), ← o ✕ de 48 si hay `onVolver`, y hasta tres
   botones de icono de 48 en `acciones`. Sin logo. En la app va fija arriba (`fija`: sticky; la zona segura del iPhone ya la
   suma index.css); en el panel de escritorio, sin fijar. */
import { ArrowLeft, X } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'

export default function Cabecera({ titulo, subtitulo, onVolver, cerrar = false, acciones, fija = false, className = '', testid, children }) {
  return (
    <header data-testid={testid}
      className={`flex min-h-14 shrink-0 items-center gap-1 bg-dark-950 pr-1 ${onVolver ? 'pl-1' : 'pl-4'} ${fija ? 'sticky top-0 z-20' : ''} ${className}`}>
      {onVolver && <Boton variante="icono" icono={cerrar ? X : ArrowLeft} tono="neutro" nombre={cerrar ? tx('Cerrar') : tx('Volver')} onClick={onVolver} />}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h1 className="truncate text-titulo text-dark-50">{titulo}</h1>
        {subtitulo && <span className="truncate text-sec text-dark-400">{subtitulo}</span>}
      </div>
      {children}
      {acciones && <div className="flex shrink-0 items-center">{acciones}</div>}
    </header>
  )
}
