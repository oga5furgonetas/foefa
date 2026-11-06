/* diseño compacto */
/* El aviso pasajero (06-11-2026, §4): 48 de alto mínimo, radio 12, superficie inversa (la rampa al revés: clara de noche y
   oscura de día), letra «texto», una acción (con el color del texto, en negrita y subrayada: ningún color de marca se lee
   sobre las dos superficies inversas). Va abajo, 8 por encima de la barra de pestañas (`abajo` = 64; en el portal, 0; en la
   guía, el alto de su panel) y de la zona segura. Se va solo: a los 6 s, y a los 8 s si lleva «Deshacer». Si coinciden dos,
   quien los pinta pone el segundo 8 más arriba (`abajo`). role="status" y aria-live="polite". lib/toast.jsx (el panel) no
   se toca. */
import { useEffect, useRef } from 'react'

export default function AvisoFlotante({ texto, detalle, accion, onAccion, onCerrar, abajo = 64, duracion, className = '', testid, children }) {
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar
  const ms = duracion ?? (accion ? 8000 : 6000)
  // El reloj se reinicia con cada texto nuevo, no con cada repintado.
  useEffect(() => {
    const t = setTimeout(() => cerrar.current?.(), ms)
    return () => clearTimeout(t)
  }, [ms, texto])
  return (
    <div role="status" aria-live="polite" data-testid={testid}
      style={{ bottom: `calc(${abajo}px + env(safe-area-inset-bottom, 0px) + 8px)` }}
      className={`fixed inset-x-4 z-50 mx-auto flex min-h-12 max-w-md items-center gap-2 rounded-xl bg-dark-50 py-2 pl-3 pr-2 text-dark-950 shadow-md ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-texto font-semibold">{texto ?? children}</p>
        {detalle && <p className="text-sec">{detalle}</p>}
      </div>
      {accion && (
        <button type="button" onClick={onAccion} className="min-h-10 shrink-0 rounded-lg px-2 text-boton underline underline-offset-2">{accion}</button>
      )}
    </div>
  )
}
