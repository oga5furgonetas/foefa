/* LA MARCA, EN UN SOLO SITIO.

   El producto se vende a cualquier empresa con flota, así que su nombre no
   puede estar escrito en cuarenta pantallas: el día que cambie, se cambia aquí
   y en ningún sitio más. `scripts/check-marca.mjs` vigila que no vuelva a
   colarse un nombre escrito a mano.

   EL DOMINIO NO SE ESCRIBE. Los enlaces que se mandan (portal del conductor,
   del taller, de empleo) salen de `origen()`, que es la dirección desde la que
   se está usando la app. Así funciona igual en producción, en pruebas y en el
   dominio propio de cada cliente, sin compilar otra vez.

   LA ÚNICA EXCEPCIÓN (09-11-2026): dentro de la app de iPhone la web no se sirve
   desde un dominio, sino desde `capacitor://localhost`, y un enlace así (el de
   seguimiento que el repartidor manda al cliente por WhatsApp, el portal del
   conductor…) no abre fuera de la app. Allí `origen()` da la dirección pública de
   la web: `VITE_WEB_ORIGIN` al compilar (app-ios.yml) y, si no se da, la de
   producción. En la web y en Android, la de siempre. */

import { esAppIOS } from './lib/plataforma'

// La web pública, para los enlaces que salen de la app de iPhone (https://flotadsp.com: docs/ESTADO.md, desplegar.yml).
const WEB_PUBLICA = String(import.meta.env?.VITE_WEB_ORIGIN || 'https://flotadsp.com').trim().replace(/\/+$/, '')
// El origen de Capacitor (iOS: capacitor://localhost; ionic: y file: en otras versiones) no es una dirección que abra fuera.
const PROTOCOLOS_DE_LA_APP = /^(?:capacitor|ionic|file):$/

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

/** La dirección desde la que se sirve la app, sin barra final; dentro de la app de iPhone, la de la web pública. */
export function origen() {
  if (typeof window === 'undefined' || !window.location) return ''
  if (PROTOCOLOS_DE_LA_APP.test(window.location.protocol || '') || esAppIOS()) return WEB_PUBLICA
  return window.location.origin.replace(/\/+$/, '')
}

/** El dominio que se enseña (sin «https://»), p. ej. en la maqueta de navegador. */
export function dominio() {
  return origen().replace(/^https?:\/\//, '') || 'app'
}
