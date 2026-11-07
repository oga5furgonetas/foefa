/* diseño compacto */
/* El aviso pasajero (06-11-2026, §4): 48 de alto mínimo, radio 12, superficie inversa (la rampa al revés: clara de noche y
   oscura de día), letra «texto», una acción (con el color del texto, en negrita y subrayada: ningún color de marca se lee
   sobre las dos superficies inversas). Va abajo, 8 por encima de la barra de pestañas (`abajo` = 64; en el portal, 0; en la
   guía, el alto de su panel) y de la zona segura. Se va solo: a los 6 s, y a los 8 s si lleva «Deshacer». Si coinciden dos,
   quien los pinta pone el segundo más arriba (`apilado`). role="status" y aria-live="polite". lib/toast.jsx (el panel) no
   se toca.
   Arreglos del 07-11-2026 (revisor, hallazgos 4 y 11):
   - z-[70], por encima de las hojas (z-50), de la guía (z-[45]) y de «Situar» (z-[60]): con z-50 y pintado antes que ellas, una
     hoja abierta lo cubría y el error de «Añadir a mi ruta» (el tope del plan gratis) no se veía. Y con una hoja abierta sube
     por encima de su pie fijo (`[data-hoja-pie]`, lo mide al salir cada aviso): en el portal, sin barra de pestañas, caía justo
     encima de su botón principal.
   - `zonaSegura` (por defecto sí): quien ya mide su base con la zona segura dentro (el panel de la guía, `pb-[max(12px,
     env(safe-area-inset-bottom))]`) pasa `false`, o en iPhone la zona se contaba dos veces y el aviso quedaba unos 34 px más alto.
   - `apilado`: lo que se suma encima de la base (el «Deshacer» de debajo, 60), aparte, para que el pie de la hoja no los junte. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/* Lo que mide el pie fijo de las hojas abiertas, el más alto: una hoja dentro de otra («¿Quitar esta parada?» sobre la de la parada)
   deja su pie ANTES que el de la de debajo en el documento, así que «el último» no es el de encima; se libra el mayor. 0 sin hoja
   o sin pie. */
function altoPieHoja() {
  let alto = 0
  for (const pie of document.querySelectorAll('[data-hoja-pie]')) alto = Math.max(alto, Math.ceil(pie.getBoundingClientRect().height))
  return alto
}

export default function AvisoFlotante({ texto, detalle, accion, onAccion, onCerrar, abajo = 64, apilado = 0, zonaSegura = true, duracion, className = '', testid, children }) {
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar
  const ms = duracion ?? (accion ? 8000 : 6000)
  // El reloj se reinicia con cada texto nuevo, no con cada repintado.
  useEffect(() => {
    const t = setTimeout(() => cerrar.current?.(), ms)
    return () => clearTimeout(t)
  }, [ms, texto])
  const [pie, setPie] = useState(0)
  useLayoutEffect(() => { setPie(altoPieHoja()) }, [texto])
  const zona = zonaSegura ? 'env(safe-area-inset-bottom, 0px)' : '0px'
  return (
    <div role="status" aria-live="polite" data-testid={testid}
      style={{ bottom: `calc(max(${abajo}px + ${zona}, ${pie}px) + ${apilado}px + 8px)` }}
      className={`fixed inset-x-4 z-[70] mx-auto flex min-h-12 max-w-md items-center gap-2 rounded-xl bg-dark-50 py-2 pl-3 pr-2 text-dark-950 shadow-md ${className}`}>
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
