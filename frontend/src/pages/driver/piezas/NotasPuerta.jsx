/* diseño compacto */
/* Las notas de la puerta (07-11-2026, §4 de la especificación): una caja (tinte neutro, radio 8, relleno 8) con cada
   dato con su icono de 16 y letra «texto», sin prefijo a la vista. Orden: el cliente dice · memoria · notas · la última
   vez. En la tarjeta de la siguiente, dos líneas como mucho (`maxLineas={2}`: los dos primeros datos, cada uno en una
   línea con «…»); en la hoja de la parada, entero (cada dato en su sitio, hasta donde llegue). El prefijo («El cliente
   dice:», «Memoria de la puerta:», «La última vez (21 oct):») va solo para el lector de pantalla, y cada dato conserva su
   data-testid (cliente-dice, memoria, antes). La memoria sigue abriendo su hoja (`onMemoria`); sin memoria no sale nada:
   «Memoria de la puerta» está en el ⋮. Los textos salen de ClienteDice, MemoriaPuerta y AntesPuerta, sin cambiarlos.
   En la tarjeta (`maxLineas`), 4 de relleno arriba y abajo en vez de 8 (la hoja se queda con los 8): con la fila de acciones a 8
   de la caja, la tarjeta de 10-hoy pasa de 292 a 280, dentro de los 284 de §5.1 d (revisor, 07-11-2026, hallazgo 5).
   LO QUE DICE EL CLIENTE, PRIMERO (RW, 08-11-2026): en una sola línea cortada con «…» el portal salía a medias («Portal: 45…»).
   Ahora, en la tarjeta, lo que dice el cliente puede ocupar las DOS líneas (lo que se corta es el final, la nota libre; el portal
   queda a la vista). Si no las necesita, el siguiente dato va en la segunda, como antes; si las ocupa, los demás se quedan en
   la hoja de la parada y la tarjeta sigue en sus 284. Cuántas líneas ocupa se mide en pantalla (con el ancho y la letra de
   ahora) y se repite si cambian. En la hoja no cambia nada: ya lo enseña entero. */
import { useLayoutEffect, useRef, useState } from 'react'
import { History, KeyRound, MessageSquareText, StickyNote } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import { textoClienteDice } from '../ClienteDice'
import { textoMemoria } from '../MemoriaPuerta'
import { partesAntes } from '../AntesPuerta'
import icono from './icono'

/* ¿Lo que dice el cliente ocupa las dos líneas? Una línea mide su `line-height`: más de una y media es que hay dos. Se mide al
   pintar (antes de que el navegador dibuje, así que no parpadea) y se repite si cambia su tamaño: el giro del móvil, la letra
   más grande o la fuente al terminar de cargar. */
function useOcupaDos(ref, activo, clave) {
  const [dos, setDos] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!activo || !el) { setDos(false); return undefined }
    const medir = () => {
      const estilo = getComputedStyle(el)
      const linea = parseFloat(estilo.lineHeight) || parseFloat(estilo.fontSize) * 1.43
      setDos(el.getBoundingClientRect().height > linea * 1.5)
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return undefined
    const vigia = new ResizeObserver(medir)
    vigia.observe(el)
    return () => vigia.disconnect()
  }, [ref, activo, clave])
  return dos
}

export default function NotasPuerta({ p, maxLineas = 0, onMemoria, className = '', testid }) {
  const dice = textoClienteDice(p?.cliente_dice)
  const memoria = textoMemoria(p?.memoria)
  const notas = p?.notas || ''
  const antes = partesAntes(p?.antes)
  const una = maxLineas > 0   // en la tarjeta: un dato por línea, cortado con «…»; lo que dice el cliente, hasta dos
  const refDice = useRef(null)
  const ocupaDos = useOcupaDos(refDice, una && !!dice, dice)
  if (!dice && !memoria && !notas && !antes) return null
  // `arriba`: el icono sobre la primera línea (lo que puede ocupar dos); si no, centrado con su línea única.
  const fila = (arriba) => `flex min-w-0 max-w-full ${arriba ? 'items-start' : 'items-center'} gap-1 text-left`
  const Icono = (I, color = 'text-dark-400', arriba = !una) => icono(I, 16, `${arriba ? 'mt-0.5 ' : ''}shrink-0 ${color}`)
  const texto = (t, ref, clase = una ? 'truncate' : '') => <span ref={ref} className={`min-w-0 ${clase}`}>{t}</span>
  const datos = [
    dice && (
      <span key="dice" data-testid="cliente-dice" className={fila(true)}>
        {Icono(MessageSquareText, 'text-ruta-ok-texto', true)}
        {texto(<><span className="sr-only">{tx('El cliente dice')}: </span>{dice}</>, refDice, una ? 'line-clamp-2' : '')}
      </span>
    ),
    memoria && (
      <button key="memoria" type="button" data-testid="memoria" onClick={onMemoria} className={`${fila(!una)} w-full rounded`}>
        {Icono(KeyRound, 'text-ruta-marca')}
        {texto(<><span className="sr-only">{tx('Memoria de la puerta')}: </span>{memoria}</>)}
      </button>
    ),
    notas && (
      <span key="notas" className={fila(!una)}>
        {Icono(StickyNote)}
        {texto(<><span className="sr-only">{tx('Notas: {x}', { x: '' })}</span>{notas}</>)}
      </span>
    ),
    antes && (
      <span key="antes" data-testid="antes" className={`${fila(!una)} ${antes.fallo ? 'text-ruta-aviso-texto' : ''}`}>
        {Icono(History, antes.fallo ? 'text-ruta-aviso-texto' : 'text-dark-400')}
        {texto(<>
          <span className="sr-only">{antes.frase}</span>
          <span aria-hidden="true">{antes.fecha}: {antes.corto}</span>
        </>)}
      </span>
    ),
  ].filter(Boolean)
  return (
    <div data-testid={testid} className={`flex flex-col gap-1 rounded-lg bg-dark-800 ${una ? 'px-2 py-1' : 'p-2'} text-texto text-dark-50 ${className}`}>
      {una ? datos.slice(0, ocupaDos ? 1 : maxLineas) : datos}
    </div>
  )
}
