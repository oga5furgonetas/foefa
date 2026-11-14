import { selloDeFecha } from '../lib/sello'

/* EL SELLO DE FECHA DE UNA FOTO (14-11-2026), como el de una cámara: «13 NOV 2026 · 18:12 · Ana L.». Va DENTRO de la
   foto (un contenedor `relative`), abajo a la izquierda, y se queda oscuro con letra clara en cualquier tema porque va
   sobre la imagen. La fecha es la de llegada de la foto al servidor, no la del móvil. `.sello-foto` en index.css. */
export default function SelloFoto({ fecha, quien = '', corto = false, idioma = 'es', className = '' }) {
  const t = selloDeFecha(fecha, { corto, idioma })
  if (!t) return null
  return (
    <span className={`sello-foto ${className}`} data-testid="sello-foto">
      {t}
      {quien ? <em> · {quien}</em> : null}
    </span>
  )
}
