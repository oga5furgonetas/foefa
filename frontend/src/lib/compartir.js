import { tx, locale } from './idioma'
import { origen } from '../marca'
import { medirAccion } from './analitica'
import { getReferidos } from '../services/api'
import { promoGratis, fechaPromo, eurosRef } from './precios'

/* INVITAR A UN COMPAÑERO. Un toque abre el «compartir» del móvil (o WhatsApp)
   con el mensaje y su enlace (?ref=…). El importe sale del servidor porque las
   cuentas antiguas conservan la oferta de 5 €; el enlace lleva UTM para medir. */
export function enlaceInvitar(codigo) {
  return `${origen()}/invita?${codigo ? `ref=${encodeURIComponent(codigo)}&` : ''}utm_source=referido&utm_medium=compartir&utm_campaign=rep_invitar`
}

export function textoInvitar(codigo, porInvitado) {
  const premio = codigo && Number(porInvitado) > 0
    ? `\n\n${tx('Si te registras con mi enlace y completas 20 entregas a direcciones distintas en 2 días diferentes, repartidas durante el día y dentro de tus primeros 30 días, gano {euros}.', { euros: eurosRef(Number(porInvitado), locale()) })}`
    : ''
  // 10-10-2026: con la promoción, lo que engancha es «gratis y sin límite hasta el 31-12».
  if (promoGratis()) {
    return `${tx('Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Es gratis y sin límite hasta el {fecha}, solo registrarte:', { fecha: fechaPromo(locale()) })} ${enlaceInvitar(codigo)}${premio}`
  }
  const base = tx('Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Pruébala gratis, sin tarjeta:')
  const extra = codigo ? ` ${tx('Con mi enlace empiezas con 14 días gratis.')}` : ''
  return `${base}${extra} ${enlaceInvitar(codigo)}${premio}`
}

export async function invitar() {
  medirAccion('invitar')
  let referido = {}
  try { referido = (await getReferidos()).data || {} } catch { /* sin sesión o sin código: enlace normal */ }
  const codigo = referido.codigo || ''
  const texto = textoInvitar(codigo, referido.por_invitado)
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return }
  } catch { /* canceló el compartir: no pasa nada */ return }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
}
