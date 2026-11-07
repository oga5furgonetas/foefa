/* diseño compacto */
/* Las notas de la puerta (07-11-2026, §4 de la especificación): una caja (tinte neutro, radio 8, relleno 8) con cada
   dato con su icono de 16 y letra «texto», sin prefijo a la vista. Orden: el cliente dice · memoria · notas · la última
   vez. En la tarjeta de la siguiente, dos líneas como mucho (`maxLineas={2}`: los datos van seguidos y la caja se corta);
   en la hoja de la parada, entero (cada dato en su línea). El prefijo («El cliente dice:», «Memoria de la puerta:», «La
   última vez (21 oct):») va solo para el lector de pantalla, y cada dato conserva su data-testid (cliente-dice, memoria,
   antes). La memoria sigue abriendo su hoja (`onMemoria`); sin memoria no sale nada: «Memoria de la puerta» está en el
   ⋮. Los textos salen de ClienteDice, MemoriaPuerta y AntesPuerta, sin cambiarlos. */
import { History, KeyRound, MessageSquareText, StickyNote } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import { textoClienteDice } from '../ClienteDice'
import { textoMemoria } from '../MemoriaPuerta'
import { partesAntes } from '../AntesPuerta'
import icono from './icono'

const CORTE = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' }

export default function NotasPuerta({ p, maxLineas = 0, onMemoria, className = '', testid }) {
  const dice = textoClienteDice(p?.cliente_dice)
  const memoria = textoMemoria(p?.memoria)
  const notas = p?.notas || ''
  const antes = partesAntes(p?.antes)
  if (!dice && !memoria && !notas && !antes) return null
  const seguidos = maxLineas > 0
  const dato = 'inline-flex max-w-full items-start gap-1 text-left'
  const Icono = (I, color = 'text-dark-400') => icono(I, 16, `mt-0.5 shrink-0 ${color}`)
  const datos = [
    dice && (
      <span key="dice" data-testid="cliente-dice" className={dato}>
        {Icono(MessageSquareText, 'text-ruta-ok-texto')}
        <span><span className="sr-only">{tx('El cliente dice')}: </span>{dice}</span>
      </span>
    ),
    memoria && (
      <button key="memoria" type="button" data-testid="memoria" onClick={onMemoria} className={`${dato} min-h-0 rounded`}>
        {Icono(KeyRound, 'text-ruta-marca')}
        <span><span className="sr-only">{tx('Memoria de la puerta')}: </span>{memoria}</span>
      </button>
    ),
    notas && (
      <span key="notas" className={dato}>
        {Icono(StickyNote)}
        <span><span className="sr-only">{tx('Notas: {x}', { x: '' })}</span>{notas}</span>
      </span>
    ),
    antes && (
      <span key="antes" data-testid="antes" className={`${dato} ${antes.fallo ? 'text-ruta-aviso-texto' : ''}`}>
        {Icono(History, antes.fallo ? 'text-ruta-aviso-texto' : 'text-dark-400')}
        <span>
          <span className="sr-only">{antes.frase}</span>
          <span aria-hidden="true">{antes.fecha} · {antes.corto}</span>
        </span>
      </span>
    ),
  ].filter(Boolean)
  return (
    <div data-testid={testid} className={`rounded-lg bg-dark-800 p-2 text-texto text-dark-50 ${className}`}>
      {seguidos
        ? <p className={`${CORTE[maxLineas] || CORTE[2]} [&>*+*]:before:px-1 [&>*+*]:before:text-dark-400 [&>*+*]:before:content-['·']`}>{datos}</p>
        : <div className="flex flex-col gap-1">{datos}</div>}
    </div>
  )
}
