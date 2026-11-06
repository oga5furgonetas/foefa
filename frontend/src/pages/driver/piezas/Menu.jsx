/* diseño compacto */
/* El menú de «Más opciones» (⋮) (06-11-2026, §4): un botón de icono de 48 que despliega filas de 48 con icono de 20 y
   letra «boton», de 200 de ancho mínimo. Lo que borra va en peligro (y con su diálogo de siempre, que pone quien lo usa).
   Escape y tocar fuera lo cierran; role="menu". `opciones` = [{ texto, icono, onClick, peligro, nombre, testid }]. */
import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'
import icono from './icono'

export default function Menu({ opciones = [], nombre, icono: Icono = MoreVertical, tono = 'neutro', relleno = false, className = '', testid }) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef(null)
  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])
  const titulo = nombre || tx('Más opciones')
  return (
    <div ref={raiz} className={`relative ${className}`} data-testid={testid}>
      <Boton variante="icono" icono={Icono} tono={tono} nombre={titulo} relleno={relleno} onClick={() => setAbierto((v) => !v)} aria-haspopup="menu" aria-expanded={abierto} />
      {abierto && (
        <div role="menu" aria-label={titulo} className="absolute right-0 top-full z-30 mt-1 min-w-52 overflow-hidden rounded-xl border border-dark-800 bg-dark-900 py-1 shadow-md">
          {opciones.filter(Boolean).map((o) => (
            <button key={o.texto} type="button" role="menuitem" aria-label={o.nombre} data-testid={o.testid}
              onClick={() => { setAbierto(false); o.onClick?.() }}
              className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-boton ${o.peligro ? 'text-ruta-peligro-texto' : 'text-dark-50'}`}>
              {icono(o.icono, 20, 'shrink-0')}
              <span className="min-w-0 flex-1">{o.texto}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
