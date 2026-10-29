/* ¿Estamos dentro de la app instalada desde Play Store? La marca la pone
   /app al arrancar (main.jsx). Dentro de la app de Play, Google obliga a
   cobrar con su propio sistema: ahí no se enseña ningún botón de pago con
   tarjeta (ni suscripción ni regalos). */
// Solo la de Play (com.flotadsp.flota). La del APK de la web (com.flotadsp.flota.web) cobra con Stripe.
export const DE_PLAY = /^android-app:\/\/com\.flotadsp\.flota\/?$/
export function enAppPlay() {
  try { return sessionStorage.getItem('flota_app') === '1' || DE_PLAY.test(document.referrer) } catch { return false }
}
