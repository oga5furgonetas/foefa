/* diseño compacto */
/* Las notas de la puerta (07-11-2026, §4 de la especificación): una caja (tinte neutro, radio 8, relleno 8) con cada
   dato con su icono de 16 y letra «texto», sin prefijo a la vista. Orden: el cliente dice · memoria · notas · la última
   vez. En la tarjeta de la siguiente, dos líneas como mucho (`maxLineas={2}`: los dos primeros datos, cada uno en una
   línea con «…»); en la hoja de la parada, entero (cada dato en su sitio, hasta donde llegue). El prefijo («El cliente
   dice:», «Memoria de la puerta:», «La última vez (21 oct):») va solo para el lector de pantalla, y cada dato conserva su
   data-testid (cliente-dice, memoria, antes). La memoria sigue abriendo su hoja (`onMemoria`); sin memoria no sale nada:
   «Memoria de la puerta» está en el ⋮. Los textos salen de ClienteDice, MemoriaPuerta y AntesPuerta, sin cambiarlos.
   En la tarjeta (`maxLineas`), 4 de relleno arriba y abajo en vez de 8 (la hoja se queda con los 8): con la fila de acciones a 8
   de la caja, la tarjeta de 10-hoy pasa de 292 a 280, dentro de los 284 de §5.1 d (revisor, 07-11-2026, hallazgo 5). */
import { History, KeyRound, MessageSquareText, StickyNote } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import { textoClienteDice } from '../ClienteDice'
import { textoMemoria } from '../MemoriaPuerta'
import { partesAntes } from '../AntesPuerta'
import icono from './icono'

export default function NotasPuerta({ p, maxLineas = 0, onMemoria, className = '', testid }) {
  const dice = textoClienteDice(p?.cliente_dice)
  const memoria = textoMemoria(p?.memoria)
  const notas = p?.notas || ''
  const antes = partesAntes(p?.antes)
  if (!dice && !memoria && !notas && !antes) return null
  const una = maxLineas > 0   // en la tarjeta: un dato por línea, cortado con «…»
  const fila = `flex min-w-0 max-w-full ${una ? 'items-center' : 'items-start'} gap-1 text-left`
  const Icono = (I, color = 'text-dark-400') => icono(I, 16, `${una ? '' : 'mt-0.5 '}shrink-0 ${color}`)
  const texto = (t) => <span className={`min-w-0 ${una ? 'truncate' : ''}`}>{t}</span>
  const datos = [
    dice && (
      <span key="dice" data-testid="cliente-dice" className={fila}>
        {Icono(MessageSquareText, 'text-ruta-ok-texto')}
        {texto(<><span className="sr-only">{tx('El cliente dice')}: </span>{dice}</>)}
      </span>
    ),
    memoria && (
      <button key="memoria" type="button" data-testid="memoria" onClick={onMemoria} className={`${fila} w-full rounded`}>
        {Icono(KeyRound, 'text-ruta-marca')}
        {texto(<><span className="sr-only">{tx('Memoria de la puerta')}: </span>{memoria}</>)}
      </button>
    ),
    notas && (
      <span key="notas" className={fila}>
        {Icono(StickyNote)}
        {texto(<><span className="sr-only">{tx('Notas: {x}', { x: '' })}</span>{notas}</>)}
      </span>
    ),
    antes && (
      <span key="antes" data-testid="antes" className={`${fila} ${antes.fallo ? 'text-ruta-aviso-texto' : ''}`}>
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
      {una ? datos.slice(0, maxLineas) : datos}
    </div>
  )
}
