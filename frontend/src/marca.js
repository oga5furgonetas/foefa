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
  // 29-10-2026, Dani: «unifica todo a FDS». Una sola marca en la web, el panel, la app y los correos.
  nombre: 'FDS',
  // La app de reparto (la de Google Play y la portada): el mismo nombre.
  app: 'FDS',
  // Lo que acompaña al nombre en la pestaña del navegador y al compartir.
  lema: 'La app de reparto y el panel de tu flota',
  // Cómo se llama al asistente dentro de la app («@flota, …»).
  ia: 'FDS IA',
  // Correo de contacto (03-10-2026, Dani). Cloudflare Email Routing lo
  // reenvía al Gmail de Dani: el MX de flotadsp.com apunta a Cloudflare.
  correo: 'contacto@flotadsp.com',
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
