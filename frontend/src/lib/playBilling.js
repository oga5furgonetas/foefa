/* COBRO CON GOOGLE PLAY DESDE LA WEB (04-10-2026)
   Dentro de la app de Play, la web habla con Google Play con dos APIs del
   navegador: Digital Goods (precios y compras que ya tiene la cuenta de
   Google) y PaymentRequest (pagar). La app Android (PagoActivity) elige la
   oferta de prueba gratis y liga la compra a `cuenta`; el servidor la
   comprueba con Google antes de activar nada. */

const METODO = 'https://play.google.com/billing'

export async function servicioPlay() {
  if (typeof window === 'undefined' || !('getDigitalGoodsService' in window)) return null
  try { return await window.getDigitalGoodsService(METODO) } catch { return null }
}

/* «P7D» -> 7, «P1W» -> 7, «P1M» -> 30 (aprox., solo para el texto). */
export function diasDePeriodo(iso) {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(String(iso || ''))
  if (!m) return 0
  return (+m[1] || 0) * 365 + (+m[2] || 0) * 30 + (+m[3] || 0) * 7 + (+m[4] || 0)
}

export function textoPrecio(price) {
  if (!price?.value) return ''
  try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: price.currency || 'EUR' }).format(Number(price.value)) } catch { return `${price.value} ${price.currency || ''}` }
}

/* Los productos con su precio de Google (el que de verdad se cobra, con
   impuestos del país del comprador). */
export async function detallesPlay(servicio, ids) {
  const lista = await servicio.getDetails(ids)
  return Object.fromEntries((lista || []).map((d) => [d.itemId, {
    id: d.itemId, precio: textoPrecio(d.price), periodo: d.subscriptionPeriod || '',
    diasPrueba: diasDePeriodo(d.freeTrialPeriod),
  }]))
}

/* Abre el pago de Google. Devuelve la respuesta de PaymentRequest (hay que
   llamar a .complete() después de comprobar la compra en el servidor). */
export async function pagarConPlay(sku, cuenta) {
  const req = new PaymentRequest(
    [{ supportedMethods: METODO, data: { sku, cuenta } }],
    { total: { label: 'Total', amount: { currency: 'EUR', value: '0' } } },
  )
  return req.show()
}

export async function comprasPlay(servicio) {
  try { return (await servicio.listPurchases()) || [] } catch { return [] }
}
