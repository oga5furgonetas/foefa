import { MARCA, origen } from '../marca'
// === DATOS DEL RESPONSABLE ===
// Los rellena la empresa que presta el servicio. Mientras estén vacíos, las
// páginas legales lo DICEN en vez de inventar un CIF o una dirección: un aviso
// legal con datos falsos es peor que uno incompleto.
export const COMPANY = {
  legalName: MARCA.nombre,   // razón social cuando se constituya la sociedad
  brand: MARCA.nombre,
  cif: '',           // rellenar cuando se constituya la sociedad
  address: '',       // rellenar cuando haya sede
  registry: '',
  contactEmail: MARCA.correo,
  privacyEmail: MARCA.correo,
  website: origen(),
  jurisdiction: 'España',
  governingLaw: 'legislación española',
  effectiveDate: '2026-06-20',
}

// Proveedores que tratan datos en tu nombre (encargados del tratamiento).
export const PROCESSORS = [
  { name: 'Cloudflare, Inc.', purpose: 'Hosting de la web y CDN', country: 'EEUU/UE (DPF)' },
  { name: 'Fly.io (Fly.dev)', purpose: 'Hosting del backend (API)', country: 'EEUU/UE' },
  { name: 'MongoDB Atlas', purpose: 'Base de datos', country: 'UE' },
  { name: 'Cloudflare R2', purpose: 'Almacenamiento de imágenes', country: 'EEUU/UE (DPF)' },
  { name: 'Google (Gemini / Vertex AI)', purpose: 'Análisis de imágenes (IA)', country: 'EEUU/UE (DPF)' },
  { name: 'OpenStreetMap Foundation', purpose: 'Ubicar direcciones de entrega en el mapa (solo la dirección, sin nombre ni teléfono) y teselas del mapa', country: 'Reino Unido (adecuación UE)' },
  { name: 'FOSSGIS e.V. (servidor de rutas de OpenStreetMap)', purpose: 'Calcular tiempos por carretera entre paradas (solo coordenadas, sin nombres ni teléfonos)', country: 'Alemania (UE)' },
  { name: 'Lemon Squeezy', purpose: 'Pagos (Merchant of Record), facturación', country: 'EEUU/UE (DPF)' },
]
