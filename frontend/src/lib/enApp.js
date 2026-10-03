/* ¿Estamos dentro de la app instalada desde Play Store? La marca la pone
   /app al arrancar (main.jsx). Dentro de la app de Play, Google obliga a
   cobrar con su propio sistema: ahí no se enseña ningún botón de pago con
   tarjeta (ni suscripción ni regalos). */
export function enAppPlay() {
  try { return sessionStorage.getItem('flota_app') === '1' || /^android-app:\/\//.test(document.referrer) } catch { return false }
}
