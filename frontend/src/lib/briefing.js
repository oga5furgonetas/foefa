/* EL BRIEFING DE LA PARADA (01-11-2026). Lo que el repartidor necesita oír antes de llegar, en una frase: la dirección,
   hasta qué hora, lo que dijo el cliente, en qué hueco de la furgoneta va, si hay que cobrar y la nota. Es lo que
   DispatchTrack vende a flotas como «Driver AI» y lo que Amazon está construyendo con las entradas de edificio;
   aquí sale de lo que la parada ya tiene. Puro: se prueba sin pantalla. */
import { tx } from './idioma'
import { importe } from './region'
import { textoClienteDice } from '../pages/driver/ClienteDice'

/* «Detrás · izq» → «detrás, a la izquierda» (lo que se dice, no lo que se pinta). */
export function huecoHablado(hueco) {
  const h = String(hueco || '')
  if (!h) return ''
  const [fila, lado] = h.split('·').map((s) => s.trim())
  const filas = { Delante: tx('delante'), Medio: tx('en medio'), Detrás: tx('detrás') }
  const lados = { izq: tx('a la izquierda'), der: tx('a la derecha') }
  if (!filas[fila]) return tx(h)
  return lados[lado] ? `${filas[fila]}, ${lados[lado]}` : filas[fila]
}

export function textoBriefing(p) {
  if (!p) return ''
  const partes = []
  partes.push(tx('Siguiente parada: {d}', { d: [p.cliente, p.direccion].filter(Boolean).join(', ') }))
  if (p.ventana_hasta) partes.push(tx('hasta las {h}', { h: p.ventana_hasta }))
  else if (p.horario) partes.push(p.horario)
  const dice = p.cliente_dice ? textoClienteDice(p.cliente_dice) : ''
  if (dice) partes.push(tx('el cliente dice: {t}', { t: dice }))
  if (p.hueco) partes.push(tx('en la furgoneta, {s}', { s: huecoHablado(p.hueco) }))
  if (p.bultos > 1) partes.push(tx('{n} bultos', { n: p.bultos }))
  if (Number(p.cobrar) > 0) partes.push(tx('cobro a la entrega: {i}', { i: importe(p.cobrar) }))
  if (p.notas) partes.push(tx('nota: {n}', { n: p.notas }))
  return partes.join('. ') + '.'
}
