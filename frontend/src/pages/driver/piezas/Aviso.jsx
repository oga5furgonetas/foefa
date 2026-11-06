/* diseño compacto */
/* El aviso de «Hoy» (06-11-2026, §4): uno a la vez. 48 de alto mínimo, radio 12, relleno 12/8, icono de 18 + texto (una
   o dos líneas) + una acción de texto + ✕ de 48 con el nombre que toque («Ahora no», «Entendido»). Con dos acciones, van
   en una segunda línea. Tonos neutro, aviso, peligro y ok; role="status". `acciones` = [{ texto, onClick, nombre }], o
   `accion` + `onAccion` para una sola. Lo pasajero no va aquí: va al AvisoFlotante. */
import { X } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import Boton from './Boton'
import icono from './icono'

const TONOS = {
  neutro: 'bg-dark-800 text-dark-50',
  aviso: 'bg-ruta-aviso text-ruta-aviso-texto',
  peligro: 'bg-ruta-peligro/10 text-ruta-peligro-texto',
  ok: 'bg-ruta-ok/10 text-dark-50',
}
const ICONO = { neutro: 'text-dark-400', aviso: 'text-ruta-aviso-texto', peligro: 'text-ruta-peligro-texto', ok: 'text-ruta-ok-texto' }
// El tono de la acción y de la ✕: el verde sobre el tinte ok no llega al 4,5:1 de día, así que ahí van en tinta.
const ACCION = { neutro: 'marca', aviso: 'aviso', peligro: 'peligro', ok: 'neutro' }

export default function Aviso({
  texto, tono = 'neutro', icono: Icono, accion, onAccion, acciones, onCerrar, nombreCerrar, className = '', testid, children,
}) {
  const t = tono in TONOS ? tono : 'neutro'
  const lista = (acciones || (accion ? [{ texto: accion, onClick: onAccion }] : [])).filter(Boolean)
  const botones = lista.map((a) => (
    <Boton key={a.texto} variante="texto" tono={ACCION[t]} texto={a.texto} nombre={a.nombre} onClick={a.onClick} testid={a.testid} className="shrink-0 font-semibold" />
  ))
  const dos = lista.length > 1
  return (
    <div role="status" data-testid={testid} className={`flex min-h-12 items-center gap-2 rounded-xl pl-3 pr-1 ${TONOS[t]} ${className}`}>
      {icono(Icono, 18, `shrink-0 ${ICONO[t]}`)}
      <div className="min-w-0 flex-1 py-2">
        <p className="text-texto">{texto}</p>
        {children}
        {dos && <div className="mt-1 flex flex-wrap gap-2">{botones}</div>}
      </div>
      {!dos && botones}
      {onCerrar && <Boton variante="icono" icono={X} tono={ACCION[t]} nombre={nombreCerrar || tx('Cerrar')} onClick={onCerrar} />}
    </div>
  )
}
