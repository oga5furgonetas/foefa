/* diseño compacto */
/* El resumen del día (07-11-2026, §5.1 c de la especificación): plano, ~110 de alto, <section aria-label="Progreso del
   día">. Línea 1 («nombre»): «Quedan {n} paradas» / «Queda 1 parada» / «Todo hecho» y, con más de 5 min de retraso, la
   etiqueta en peligro «+{n} min». Línea 2 («sec»): «Acabas ≈ {fin} · {km}» (de noche, con salida programada, «Sales a
   las {h} ·» delante); sin los minutos. La barra de 4 en marca, «{a} de {b} hechas». Y una fila de chips en orden fijo,
   solo las que tocan: «Ordenar ruta» (relleno mientras no está ordenada y hay 2 o más; con más de 15 min de retraso y 2
   o más pasa a «Reordenar», en aviso, con el nombre «Reordenar desde aquí»), «Cargar {a}/{b}» (nombre «Cargar la
   furgoneta»), «Avisar {a}/{b}» (nombre «Avisar a todos por WhatsApp»), «💶 {limpio}» o «Pon tu tarifa» (nombre «Mi
   dinero hoy»), la etiqueta «Cobrado {x}», la furgoneta («Aparcada aquí», o «Furgoneta a {m} m» + ✕ «Quitar») y la
   etiqueta ok «🏆 ¡Récord de entregas!» el día que se bate. Lo que hace cada chip es lo de siempre: quien lo pinta le
   pasa su función. Fuera el anillo, la fecha, «de {n}», «{n} hechas», «con tráfico típico» y «Tu récord». */
import { Banknote, CarFront, MessageCircle, Route, Truck } from 'lucide-react'
import { tx } from '../../../lib/idioma'
import { distancia, importe } from '../../../lib/region'
import Boton from './Boton'
import Chip from './Chip'
import Etiqueta from './Etiqueta'
import FilaChips from './FilaChips'

function minutosATexto(m) {
  const h = Math.floor(m / 60)
  return `${h ? `${h} h ` : ''}${m % 60} min`
}
// Metros entre dos puntos, para «Furgoneta a {m} m».
const metrosEntre = (a, b) => {
  const r = Math.PI / 180
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(x))
}

export default function ResumenDia({
  pendientes = 0, hechos = 0, total = 0, rr = null, retraso = 0,
  onOrdenar, ordenando = false,
  cargar = null,            // { a, b, onClick }: con la ruta ordenada y paquetes sin cargar
  avisar = null,            // { a, b, onClick }: con la ruta ordenada y clientes con móvil
  dinero = null,            // { texto, onClick }: «💶 {limpio}»; o sinTarifa, «Pon tu tarifa»
  sinTarifa = null,         // () => abre «Mi dinero hoy» al autónomo sin tarifa
  cobrado = 0,
  furgo = null, yo = null, onAparcar = null, onQuitarFurgo = null,
  record = false,
  className = '',
}) {
  const ordenada = !!rr?.fin
  const reordenar = retraso > 15 && pendientes > 1 && !!onOrdenar
  const pct = total ? Math.round((hechos / total) * 100) : 0
  const linea2 = pendientes > 0 && rr?.fin
    ? `${rr.programada && rr.salida ? `${tx('Sales a las {h}', { h: rr.salida })} · ` : ''}${tx('Acabas ≈')} ${rr.fin}${rr.km ? ` · ${distancia(rr.km)}` : ''}`
    : ''
  return (
    <section aria-label={tx('Progreso del día')} className={className}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-nombre text-dark-50">
          {pendientes ? (pendientes === 1 ? tx('Queda 1 parada') : tx('Quedan {n} paradas', { n: pendientes })) : tx('Todo hecho')}
        </p>
        {pendientes > 0 && retraso > 5 && <Etiqueta tono="peligro" texto={`+${minutosATexto(retraso)}`} />}
      </div>
      {linea2 && <p className="text-sec text-dark-400">{linea2}</p>}
      <div role="progressbar" aria-label={tx('{a} de {b} hechas', { a: hechos, b: total })} aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechos}
        className="mt-2 h-1 overflow-hidden rounded bg-dark-800">
        <div className="h-full rounded bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      {(onOrdenar || cargar || avisar || dinero || sinTarifa || cobrado > 0 || onAparcar || furgo || record) && (
        <FilaChips className="mt-1">
          {onOrdenar && (reordenar
            ? <Chip tono="aviso" icono={Route} texto={tx('Reordenar')} nombre={tx('Reordenar desde aquí')} testid="reordenar" onClick={onOrdenar} cargando={ordenando} disabled={ordenando} />
            : <Chip tono={!ordenada && pendientes >= 2 ? 'marca' : 'neutro'} icono={Route} texto={tx('Ordenar ruta')} onClick={onOrdenar} cargando={ordenando} disabled={ordenando || !pendientes} />)}
          {cargar && <Chip icono={Truck} texto={`${tx('Cargar')} ${cargar.a}/${cargar.b}`} nombre={tx('Cargar la furgoneta')} onClick={cargar.onClick} />}
          {avisar && <Chip icono={MessageCircle} texto={`${tx('Avisar')} ${avisar.a}/${avisar.b}`} nombre={tx('Avisar a todos por WhatsApp')} onClick={avisar.onClick} />}
          {dinero && <Chip icono={Banknote} texto={dinero.texto} nombre={tx('Mi dinero hoy')} onClick={dinero.onClick} />}
          {!dinero && sinTarifa && <Chip icono={Banknote} texto={tx('Pon tu tarifa')} onClick={sinTarifa} />}
          {cobrado > 0 && <Etiqueta texto={`${tx('Cobrado')} ${importe(cobrado)}`} />}
          {/* DÓNDE APARQUÉ (30-10-2026): el punto de la furgoneta al bajarte; los metros mientras andas; un toque abre el
              camino a pie. Se queda en el móvil, no se envía. */}
          {furgo ? (<>
            <Chip icono={CarFront} testid="furgo" href={`https://www.google.com/maps/dir/?api=1&destination=${furgo.lat},${furgo.lng}&travelmode=walking`} target="_blank" rel="noreferrer"
              texto={yo?.lat != null ? tx('Furgoneta a {m} m', { m: Math.round(metrosEntre(yo, furgo)) }) : tx('Furgoneta aparcada')} />
            {onQuitarFurgo && <Boton variante="texto" tono="neutro" texto={tx('Quitar')} onClick={onQuitarFurgo} className="shrink-0" />}
          </>) : onAparcar && pendientes > 0 && (
            <Chip icono={CarFront} texto={tx('Aparcada aquí')} testid="aparcar" onClick={onAparcar} />
          )}
          {record && <Etiqueta tono="ok" testid="record" texto={`🏆 ${tx('¡Récord de entregas!')}`} />}
        </FilaChips>
      )}
    </section>
  )
}
