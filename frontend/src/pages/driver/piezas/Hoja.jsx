/* diseño compacto */
/* La hoja que sube desde abajo (06-11-2026, §4): radio 16 arriba, cabecera de 48 (título «titulo» en una línea, subtítulo
   «sec» opcional, «?» y ⋮ si hacen falta, ✕ de 48), cuerpo desplazable con 16 a los lados y pie fijo con separador, relleno
   12 y la zona segura. Alto máximo, el 92 % de la pantalla (dvh). Se cierra con atrás (useAtras), con ✕ o deslizando la
   cabecera hacia abajo. `ayuda` = { titulo, texto } abre la explicación larga en otra hoja encima (así la frase se muda al
   «?» con su misma clave); `menu` son las opciones del ⋮ (Menu). role="dialog" con el título de nombre: las pruebas lo
   buscan así, y la ✕ se llama «Cerrar». */
import { useRef, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import { useAtras } from '../../../lib/atras'
import Boton from './Boton'
import Menu from './Menu'

export default function Hoja({ titulo, subtitulo, onClose, ayuda, menu, pie, children, className = '', testid }) {
  useAtras(true, onClose)   // el «atrás» del móvil cierra la hoja, no la app
  const [verAyuda, setVerAyuda] = useState(false)
  const toque = useRef(null)
  // Deslizar la cabecera hacia abajo (más de 80 px) la cierra; un toque no.
  const alTocar = (e) => { toque.current = e.touches?.[0]?.clientY ?? null }
  const alSoltar = (e) => {
    const y0 = toque.current
    toque.current = null
    const y1 = e.changedTouches?.[0]?.clientY
    if (y0 != null && y1 != null && y1 - y0 > 80) onClose?.()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label={titulo} data-testid={testid}>
      <div className={`flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-dark-900 ${className}`}>
        <div className="relative flex min-h-12 shrink-0 items-center gap-1 pl-4 pr-1" onTouchStart={alTocar} onTouchEnd={alSoltar}>
          <span className="absolute left-1/2 top-1 h-1 w-8 -translate-x-1/2 rounded-full bg-dark-700" aria-hidden="true" />
          <div className="min-w-0 flex-1 py-2">
            <h2 className="truncate text-titulo text-dark-50">{titulo}</h2>
            {subtitulo && <p className="truncate text-sec text-dark-400">{subtitulo}</p>}
          </div>
          {ayuda && <Boton variante="icono" icono={HelpCircle} tono="neutro" nombre={tx('Ayuda')} onClick={() => setVerAyuda(true)} />}
          {menu && <Menu opciones={menu} />}
          <Boton variante="icono" icono={X} tono="neutro" nombre={tx('Cerrar')} onClick={onClose} />
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto px-4 ${pie ? 'pb-4' : 'pb-[max(16px,env(safe-area-inset-bottom))]'}`}>{children}</div>
        {pie && <div className="shrink-0 border-t border-dark-800 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{pie}</div>}
      </div>
      {verAyuda && (
        <Hoja titulo={ayuda.titulo || titulo} onClose={() => setVerAyuda(false)}>
          <div className="whitespace-pre-line pt-2 text-texto text-dark-50">{ayuda.texto}</div>
        </Hoja>
      )}
    </div>
  )
}
