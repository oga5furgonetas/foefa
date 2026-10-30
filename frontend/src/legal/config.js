import { MARCA, origen } from '../marca'
// === DATOS DEL RESPONSABLE ===
// Los rellena la empresa que presta el servicio. Mientras estén vacíos, las
// páginas legales lo DICEN en vez de inventar un CIF o una dirección: un aviso
// legal con datos falsos es peor que uno incompleto.
export const COMPANY = {
  // Titular (LSSI art. 10): hasta que exista la sociedad, el promotor como persona física
  // (Dani, 10-10-2026). Cuando se constituya: la razón social y su CIF.
  legalName: 'Daniel Lampón Vieites',
  personaFisica: true,
  brand: MARCA.nombre,
  cif: '45957087M',  // NIF del titular (Dani lo dio para publicarlo el 10-10-2026); el CIF cuando haya sociedad
  address: 'Loureiros, 31, 15704 Santiago de Compostela (A Coruña)',
  registry: '',
  contactEmail: MARCA.correo,
  privacyEmail: MARCA.correo,
  website: origen(),
  jurisdiction: 'España',
  governingLaw: 'legislación española',
  effectiveDate: '2026-06-20',
}

// Proveedores que tratan datos en tu nombre (encargados del tratamiento).
import { hayPixel } from '../lib/metaPixel'

// 10-10-2026: faltaban Stripe (cobra el plan Repartidor), Google Play (cobra dentro de su app),
// Resend (manda los correos) y TikTok (su píxel); sobraba Lemon Squeezy, que no está activo.
// `purposeEn` / `countryEn`: lo mismo en inglés, para las páginas legales en inglés (30-10-2026, fuera de España).
export const PROCESSORS = [
  ...(hayPixel() ? [
    { name: 'Meta Platforms Ireland Ltd.', purpose: 'Medir los anuncios de Facebook e Instagram (píxel), solo si lo aceptas en el aviso de cookies', country: 'Irlanda (UE) / EEUU (DPF)',
      purposeEn: 'Measuring Facebook and Instagram ads (pixel), only if you accept it in the cookie notice', countryEn: 'Ireland (EU) / USA (DPF)' },
    { name: 'TikTok Technology Limited', purpose: 'Medir los anuncios de TikTok (píxel), solo si lo aceptas en el aviso de cookies', country: 'Irlanda (UE)',
      purposeEn: 'Measuring TikTok ads (pixel), only if you accept it in the cookie notice', countryEn: 'Ireland (EU)' },
  ] : []),
  { name: 'Stripe Payments Europe, Ltd.', purpose: 'Cobro de la suscripción con tarjeta (los datos de la tarjeta no pasan por nosotros)', country: 'Irlanda (UE)',
    purposeEn: 'Charging the subscription by card (card details never pass through us)', countryEn: 'Ireland (EU)' },
  { name: 'Google Ireland Ltd. (Google Play)', purpose: 'Cobro de la suscripción si la contratas dentro de la app de Google Play', country: 'Irlanda (UE)',
    purposeEn: 'Charging the subscription if you buy it inside the Google Play app', countryEn: 'Ireland (EU)' },
  { name: 'Resend', purpose: 'Envío de correos de la cuenta (bienvenida, avisos, recuperar contraseña)', country: 'EEUU',
    purposeEn: 'Sending account emails (welcome, notices, password recovery)', countryEn: 'USA' },
  { name: 'Cloudflare, Inc.', purpose: 'Hosting de la web y CDN', country: 'EEUU/UE (DPF)', purposeEn: 'Web hosting and CDN', countryEn: 'USA/EU (DPF)' },
  { name: 'Fly.io (Fly.dev)', purpose: 'Hosting del backend (API)', country: 'EEUU/UE', purposeEn: 'Backend (API) hosting', countryEn: 'USA/EU' },
  { name: 'MongoDB Atlas', purpose: 'Base de datos', country: 'UE', purposeEn: 'Database', countryEn: 'EU' },
  { name: 'Cloudflare R2', purpose: 'Almacenamiento de imágenes', country: 'EEUU/UE (DPF)', purposeEn: 'Image storage', countryEn: 'USA/EU (DPF)' },
  { name: 'Google (Gemini / Vertex AI)', purpose: 'Análisis de imágenes (IA)', country: 'EEUU/UE (DPF)', purposeEn: 'Image analysis (AI)', countryEn: 'USA/EU (DPF)' },
  { name: 'OpenStreetMap Foundation', purpose: 'Ubicar direcciones de entrega en el mapa (solo la dirección, sin nombre ni teléfono) y teselas del mapa', country: 'Reino Unido (adecuación UE)',
    purposeEn: 'Locating delivery addresses on the map (the address only, no name or phone) and map tiles', countryEn: 'United Kingdom (EU adequacy)' },
  { name: 'komoot GmbH (buscador Photon, datos de OpenStreetMap)', purpose: 'Segundo intento para ubicar una dirección de entrega que el anterior no encuentra (solo la dirección, sin nombre ni teléfono)', country: 'Alemania (UE)',
    purposeEn: 'Second attempt at locating a delivery address the previous one cannot find (the address only, no name or phone)', countryEn: 'Germany (EU)' },
  { name: 'FOSSGIS e.V. (servidor de rutas de OpenStreetMap)', purpose: 'Calcular tiempos por carretera entre paradas (solo coordenadas, sin nombres ni teléfonos)', country: 'Alemania (UE)',
    purposeEn: 'Calculating road travel times between stops (coordinates only, no names or phones)', countryEn: 'Germany (EU)' },
]
