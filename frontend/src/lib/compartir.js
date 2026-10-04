import { tx } from './idioma'
import { origen } from '../marca'
import { medirAccion } from './analitica'
import { getReferidos } from '../services/api'

/* INVITAR A UN COMPAÑERO (05-10-2026). Quien reparte conoce a otros que
   reparten: el mejor anuncio es que se la enseñe él. Un toque abre el
   «compartir» del móvil (o WhatsApp) con el mensaje y SU enlace de invitación
   (?ref=…): el amigo empieza con 14 días y, cuando la use de verdad (5
   entregas), quien invita gana un mes. El enlace lleva utm_source=referido
   para medir cuántos llegan por aquí. */
export function enlaceInvitar(codigo) {
  return `${origen()}/repartidores?${codigo ? `ref=${encodeURIComponent(codigo)}&` : ''}utm_source=referido&utm_medium=compartir&utm_campaign=rep_invitar`
}

export function textoInvitar(codigo) {
  const base = tx('Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Pruébala gratis, sin tarjeta:')
  const extra = codigo ? ` ${tx('Con mi enlace empiezas con 14 días gratis.')}` : ''
  return `${base}${extra} ${enlaceInvitar(codigo)}`
}

export async function invitar() {
  medirAccion('invitar')
  let codigo = ''
  try { codigo = (await getReferidos()).data?.codigo || '' } catch { /* sin sesión o sin código: enlace normal */ }
  const texto = textoInvitar(codigo)
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return }
  } catch { /* canceló el compartir: no pasa nada */ return }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
}
