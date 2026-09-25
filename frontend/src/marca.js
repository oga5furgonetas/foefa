/* LA MARCA, EN UN SOLO SITIO.

   El producto se vende a cualquier empresa con flota, así que su nombre no
   puede estar escrito en cuarenta pantallas: el día que cambie, se cambia aquí
   y en ningún sitio más. `scripts/check-marca.mjs` vigila que no vuelva a
   colarse un nombre escrito a mano.

   EL DOMINIO NO SE ESCRIBE. Los enlaces que se mandan (portal del conductor,
   del taller, de empleo) salen de `origen()`, que es la dirección desde la que
   se está usando la app. Así funciona igual en producción, en pruebas y en el
   dominio propio de cada cliente, sin compilar otra vez. */

export const MARCA = {
  nombre: 'Flotia',
  // Lo que acompaña al nombre en la pestaña del navegador y al compartir.
  lema: 'Gestión de flotas con IA',
  // Cómo se llama al asistente dentro de la app («@flotia, …»).
  ia: 'Flotia IA',
  // Correo de contacto. Vacío hasta tener dominio propio: las pantallas que lo
  // necesitan enseñan el formulario de contacto en su lugar.
  correo: '',
}

/** La dirección desde la que se sirve la app, sin barra final. */
export function origen() {
  if (typeof window === 'undefined' || !window.location) return ''
  return window.location.origin.replace(/\/+$/, '')
}

/** El dominio que se enseña (sin «https://»), p. ej. en la maqueta de navegador. */
export function dominio() {
  return origen().replace(/^https?:\/\//, '') || 'app'
}
