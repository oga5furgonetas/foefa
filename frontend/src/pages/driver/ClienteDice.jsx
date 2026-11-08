/* diseño compacto */
import { tx } from '../../lib/idioma'

/* EL CLIENTE TE AYUDA ANTES DE LLEGAR (30-10-2026). Lo que el cliente contestó en su enlace de seguimiento (si
   estará, dónde dejarlo si no, el código del portal, una franja): el servidor lo guarda en la parada como
   `cliente_dice` y aquí se enseña en la tarjeta (MiRuta) y al llegar (Navegacion). Mismas claves que el servidor;
   los sitios, los mismos textos que «¿Dónde lo dejas?» de la hoja de entrega. Desde el diseño compacto (07-11-2026) la
   tarjeta y la hoja de la parada lo pintan con piezas/NotasPuerta, que toma de aquí el texto; el componente de antes
   (con su data-testid="cliente-dice") se quitó el 08-11-2026. */
const DEJAR = { buzon: 'En el buzón', porteria: 'En portería o recepción', vecino: 'Al vecino', seguro: 'En un lugar seguro', punto_recogida: 'En un punto de recogida' }

export function textoClienteDice(d) {
  if (!d) return ''
  const partes = []
  if (d.estare === 'si') partes.push(tx('Estará en casa'))
  else if (d.estare === 'no') partes.push(`${tx('No estará')}${DEJAR[d.dejar] ? ` · ${tx(DEJAR[d.dejar])}` : ''}`)
  else if (d.franja) partes.push(tx('Mejor de {a} a {b}', { a: d.franja[0], b: d.franja[1] }))
  if (d.portal) partes.push(`${tx('Portal')}: ${d.portal}`)
  if (d.nota) partes.push(`«${d.nota}»`)
  return partes.join(' · ')
}
