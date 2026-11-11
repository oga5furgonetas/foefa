/* diseño compacto */
/* La etiqueta de un hecho (11-11-2026, «Mis DNR», V5: «es como demasiado texto»): icono + una a tres palabras («Puerta»,
   «Sin llamada», «Foto borrosa») en un tono con significado. Hermana de Etiqueta, con dos diferencias: el texto SALTA de
   línea en vez de cortarse con «…» (en alemán y en francés, a 360 px y con «Letra más grande», no puede perderse nada), y
   lleva su frase larga («Lo marcaste en la puerta») como texto para el lector de pantalla y como `title`: lo corto se ve,
   lo largo se lee. Radio 8, relleno 8, letra «etiqueta», icono de 14, 24 de alto mínimo. Tonos:
     dato  → gris, sin juicio (dónde lo marcó);
     bien  → gris con el icono en verde (el verde sobre su tinte no llega al 4,5:1 de día: el color va en el icono);
     fallo → tinte y texto de peligro (lo que le hizo fallar);
     aviso → el ámbar de aviso. */
import icono from './icono'

const TONOS = {
  dato: 'bg-dark-800 text-dark-50',
  bien: 'bg-dark-800 text-dark-50',
  fallo: 'bg-ruta-peligro/10 text-ruta-peligro-texto',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
}
const ICONO = { dato: 'text-dark-400', bien: 'text-ruta-ok-texto', fallo: 'text-ruta-peligro-texto', aviso: 'text-ruta-aviso-texto' }

export default function EtiquetaHecho({ texto, frase, tono = 'dato', icono: Icono, className = '', testid }) {
  const t = tono in TONOS ? tono : 'dato'
  return (
    <span title={frase} data-testid={testid} data-tono={t}
      className={`inline-flex min-h-6 max-w-full items-start gap-1 rounded-lg px-2 py-0.5 text-etiqueta ${TONOS[t]} ${className}`}>
      {icono(Icono, 14, `mt-0.5 shrink-0 ${ICONO[t]}`)}
      <span aria-hidden={frase ? 'true' : undefined} data-corto="" className="min-w-0 break-words">{texto}</span>
      {frase && <span className="sr-only">{frase}</span>}
    </span>
  )
}
