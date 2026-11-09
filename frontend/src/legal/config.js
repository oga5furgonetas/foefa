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

// Proveedores que tratan datos por encargo nuestro, con contrato (los encargados del tratamiento; en el Encargo, los
// subencargados).
import { hayPixel } from '../lib/metaPixel'
import { sinPagos } from '../lib/plataforma'

// 10-10-2026: faltaban Stripe (cobra el plan Repartidor), Google Play (cobra dentro de su app),
// Resend (manda los correos) y TikTok (su píxel); sobraba Lemon Squeezy, que no está activo.
// `purposeEn` / `countryEn`: lo mismo en inglés, para las páginas legales en inglés (30-10-2026, fuera de España).
// 02-11-2026 (revisiones del servidor y de la app): Meta ya no es solo el píxel, también lo que le manda nuestro servidor
// con el mismo permiso (Privacidad.jsx lo detalla); y CartoCiudad, que ubica las direcciones de España desde el
// geocodificador nuevo (backend/geocodificador.py). El Encargo pide avisar 15 días antes de un subencargado nuevo, pero
// todas las cuentas de empresa son de Dani («Solo las mías», 03-11-2026): CartoCiudad vale ya para todas. Con una
// empresa de fuera, ese aviso antes de cada subencargado nuevo (para eso sigue CARTOCIUDAD_EMPRESAS_DESDE en el servidor).
// 03-11-2026: Google, por el geocodificador de Android (android.location.Geocoder, que con Google Play services es el
// servicio de Google), que usa la app 2.4.5 (ui/hoy/GeoMovil.kt) cuando nuestro servidor no encuentra la dirección; y
// Fly.io, que desde el 23-10-2026 aloja también la base de datos.
// 03-11-2026 (tanda de «Situar la parada»: lo que hace el código de verdad, repasado en el servidor, la web y la app).
// Google: la app no le pregunta solo lo que el servidor no encuentra, sino cada dirección que se escribe en la ficha o
// se busca en «Situar la parada», las paradas sin situar y el punto bajo la chincheta (FichaParada.kt, SituarPantalla.kt,
// RutaVM.kt). Photon: también la web y la app mientras se escribe, con la posición redondeada a unos 1 km. Atlas ya es
// solo la copia de antes de mudar la base a Fly. Faltaban Brevo (respaldo de Resend y campañas), Telegram (el formulario
// de contacto y los avisos del panel), los avisos al móvil (Firebase y el servicio de avisos del navegador), OpenFreeMap
// (el mapa de la guía nativa) y, en R2, las copias de seguridad; y Gemini no solo mira fotos. Overpass no va: solo
// recibe, desde el servidor, cuadrados de unos 5 km sin nada de nadie. Los subencargados nuevos valen ya: todas las
// cuentas de empresa son de Dani («Solo las mías»). `nameEn`: el nombre en inglés cuando el de aquí lleva español.
// 03-11-2026 (tercera tanda; el revisor: la lista salía bajo frases que no eran ciertas para todos: «todos con garantías
// RGPD», «encargados del tratamiento bajo contrato», transferencias «al amparo del DPF o Cláusulas Contractuales Tipo»).
// Ahora van separados, cada uno con su frase (LEGAL_NOTES, la misma en Privacidad, Encargo y Seguridad, y en inglés):
//   · PROCESSORS: los que tratan datos por encargo nuestro, con contrato;
//   · MAP_SERVICES: los servicios de mapas y de búsqueda de direcciones a los que se pregunta SIN contrato, bajo sus
//     condiciones de uso; cada línea dice qué reciben, nunca nombres ni teléfonos. Se añade el respaldo de rutas (el
//     demo público de OSRM, _REP_RUTAS_RESPALDO en el servidor), que no estaba; de él no consta dónde está;
//   · Telegram SALE de la lista: no es un encargado nuestro. Lo conecta cada empresa en su panel con su propio bot
//     (POST /telegram/config), y lo que FDS manda por Telegram por su cuenta ya no lleva datos de nadie (el aviso del
//     formulario de contacto, las alertas de entrar, la reserva fundador, la facturación y los errores: server.py);
//   · el servicio de avisos del navegador, tampoco: lo elige el navegador y el aviso le llega cifrado.
// Las «DPF» de la columna del país son de empresas de EEUU adheridas al EU-US Data Privacy Framework; las de EEUU sin
// esa marca (Resend, Fly.io) irían por Cláusulas Contractuales Tipo: no se puede comprobar desde aquí.
export const PROCESSORS = [
  ...(hayPixel() ? [
    { name: 'Meta Platforms Ireland Ltd.', purpose: 'Medir los anuncios de Facebook e Instagram, solo si lo aceptas en el aviso de cookies: su píxel en la web y, desde nuestro servidor, el alta, la primera entrada en la app y la primera ruta (con el correo cifrado)', country: 'Irlanda (UE) / EEUU (DPF)',
      purposeEn: 'Measuring Facebook and Instagram ads, only if you accept it in the cookie notice: its pixel on the website and, from our server, the sign-up, the first time the app is opened and the first route (with the hashed email)', countryEn: 'Ireland (EU) / USA (DPF)' },
    { name: 'TikTok Technology Limited', purpose: 'Medir los anuncios de TikTok (píxel), solo si lo aceptas en el aviso de cookies', country: 'Irlanda (UE)',
      purposeEn: 'Measuring TikTok ads (pixel), only if you accept it in the cookie notice', countryEn: 'Ireland (EU)' },
  ] : []),
  { name: 'Stripe Payments Europe, Ltd.', purpose: 'Cobro de la suscripción con tarjeta (los datos de la tarjeta no pasan por nosotros)', country: 'Irlanda (UE)',
    purposeEn: 'Charging the subscription by card (card details never pass through us)', countryEn: 'Ireland (EU)' },
  { name: 'Google Ireland Ltd. (Google Play)', purpose: 'Cobro de la suscripción si la contratas dentro de la app de Google Play', country: 'Irlanda (UE)',
    purposeEn: 'Charging the subscription if you buy it inside the Google Play app', countryEn: 'Ireland (EU)' },
  { name: 'Resend', purpose: 'Envío de correos de la cuenta (bienvenida, avisos, recuperar contraseña)', country: 'EEUU',
    purposeEn: 'Sending account emails (welcome, notices, password recovery)', countryEn: 'USA' },
  { name: 'Brevo', purpose: 'Envío de correos: los mismos que Resend cuando este ya no puede ese día, y las campañas por correo a candidatos de empleo', country: 'Francia (UE)',
    purposeEn: 'Sending emails: the same ones as Resend when it can no longer send that day, and email campaigns to job applicants', countryEn: 'France (EU)' },
  { name: 'Cloudflare, Inc.', purpose: 'Hosting de la web y CDN', country: 'EEUU/UE (DPF)', purposeEn: 'Web hosting and CDN', countryEn: 'USA/EU (DPF)' },
  { name: 'Fly.io (Fly.dev)', purpose: 'Hosting del backend (API) y de la base de datos', country: 'EEUU/UE', purposeEn: 'Backend (API) and database hosting', countryEn: 'USA/EU' },
  { name: 'MongoDB Atlas', purpose: 'Copia antigua de la base de datos (hasta el 23-10-2026), pendiente de borrar', country: 'UE',
    purposeEn: 'Old copy of the database (until 23-10-2026), pending deletion', countryEn: 'EU' },
  { name: 'Cloudflare R2', purpose: 'Almacenamiento de imágenes y de las copias de seguridad diarias (cifradas)', country: 'EEUU/UE (DPF)',
    purposeEn: 'Storage of images and of the daily backups (encrypted)', countryEn: 'USA/EU (DPF)' },
  { name: 'Google (Gemini / Vertex AI)', purpose: 'Inteligencia artificial: analizar fotos (inspecciones, cuentakilómetros y, en el reparto, tickets y fotos de entrega, con la dirección y el cliente de la parada), leer los cuadrantes y las listas que se suben, y el asistente, con los datos de la flota que necesita para contestar (como nombres y turnos de los conductores)', country: 'EEUU/UE (DPF)',
    purposeEn: 'Artificial intelligence: analysing photos (inspections, odometers and, in deliveries, tickets and delivery photos, with the stop’s address and customer), reading the rosters and lists that are uploaded, and the assistant, with the fleet data it needs to answer (such as drivers’ names and shifts)', countryEn: 'USA/EU (DPF)' },
  { name: 'Google (Firebase Cloud Messaging)', purpose: 'Los avisos al instante de la app de Android, cuando están activados: el identificador del móvil para los avisos y cada aviso (su título y su texto)', country: 'EEUU/UE (DPF)',
    purposeEn: 'Instant notifications in the Android app, when turned on: the phone’s notification identifier and each notice (its title and text)', countryEn: 'USA/EU (DPF)' },
]
  // En la app de iPhone (09-11-2026) no hay cobros: ni Stripe ni Google Play salen como encargados (docs/APP_STORE.md).
  .filter((p) => !(sinPagos() && ['Stripe Payments Europe, Ltd.', 'Google Ireland Ltd. (Google Play)'].includes(p.name)))

// Los servicios de mapas y de búsqueda de direcciones a los que se pregunta sin contrato, bajo sus condiciones de uso
// (03-11-2026): sin contrato de encargo con ellos. Cada línea dice qué reciben; ninguno, nombres ni teléfonos.
export const MAP_SERVICES = [
  { name: 'CartoCiudad (CNIG / Instituto Geográfico Nacional)', nameEn: 'CartoCiudad (CNIG / Spain’s National Geographic Institute)',
    purpose: 'Ubicar direcciones de entrega en España: solo la dirección, sin nombre ni teléfono', country: 'España (UE)',
    purposeEn: 'Locating delivery addresses in Spain: the address only, no name or phone', countryEn: 'Spain (EU)' },
  { name: 'Google (geocodificador de Android, Google Play services)', nameEn: 'Google (Android geocoder, Google Play services)',
    purpose: 'En la app de Android, sin nombres ni teléfonos (el móvil le pregunta directamente, con su IP): las direcciones de entrega que se escriben en la ficha o se buscan en «Situar la parada» y las de las paradas que nuestro servidor no sitúa, con una zona de unos 40 km alrededor de donde se reparte para buscar primero cerca; y, en «Situar la parada», el punto del mapa, para decir qué dirección hay (tras pulsar «Mi ubicación», o si se abre sin otro punto de partida, es la posición del móvil)', country: 'EEUU/UE (DPF)',
    purposeEn: 'In the Android app, with no names or phones (the phone asks it directly, with its IP): the delivery addresses typed in the stop form or searched for in “Place the stop” and those of the stops our server cannot place, with an area of about 40 km around where deliveries are made to search nearby first; and, in “Place the stop”, the point on the map, to tell which address is there (after tapping “My location”, or if it opens with no other starting point, it is the phone’s position)', countryEn: 'USA/EU (DPF)' },
  { name: 'OpenStreetMap Foundation', purpose: 'Ubicar direcciones en el mapa, sin nombres ni teléfonos: las de entrega que los demás no encuentran (con una zona amplia alrededor del punto de salida) y, en el panel, la dirección escrita o la posición desde la que se buscan talleres y empresas de alquiler cercanos; y las teselas del mapa de la web y de la app, que el navegador o el móvil le piden directamente (le llegan la zona que se ve y la IP)', country: 'Reino Unido (adecuación UE)',
    purposeEn: 'Locating addresses on the map, with no names or phones: delivery addresses the others cannot find (with a wide area around the starting point) and, in the panel, the typed address or the position from which nearby workshops and rental companies are searched; and the map tiles of the website and the app, which the browser or the phone requests directly from it (it receives the area on screen and the IP)', countryEn: 'United Kingdom (EU adequacy)' },
  { name: 'OpenFreeMap (Hyperknot Software Kft.)', purpose: 'El mapa de la guía en la app de Android: el móvil le pide directamente las teselas de la zona que se ve (le llega su IP, como en cualquier petición); sin nombres, teléfonos ni direcciones', country: 'Hungría (UE)',
    purposeEn: 'The guidance map in the Android app: the phone requests the tiles of the area on screen directly from it (it receives the phone’s IP, as with any request); no names, phones or addresses', countryEn: 'Hungary (EU)' },
  { name: 'komoot GmbH (buscador Photon, datos de OpenStreetMap)', nameEn: 'komoot GmbH (Photon search, OpenStreetMap data)',
    purpose: 'Buscar direcciones de entrega, sin nombres ni teléfonos: la web y la app le preguntan directamente mientras se escribe una dirección (el texto, la IP del dispositivo y, para ordenar los resultados, la posición del móvil o de la zona donde se reparte, redondeada a unos 1 km), y nuestro servidor, cuando CartoCiudad no da el portal (fuera de España, antes que nadie): la dirección y, para ordenar, el centro de su código postal o el punto de salida, también redondeado a unos 1 km', country: 'Alemania (UE)',
    purposeEn: 'Searching for delivery addresses, with no names or phones: the website and the app query it directly while an address is typed (the text, the device’s IP and, to sort the results, the position of the phone or of the delivery area, rounded to about 1 km), and our server, when CartoCiudad does not give the street number (outside Spain, before anyone else): the address and, to sort, the centre of its postcode or the starting point, also rounded to about 1 km', countryEn: 'Germany (EU)' },
  { name: 'FOSSGIS e.V. (servidor de rutas de OpenStreetMap)', nameEn: 'FOSSGIS e.V. (OpenStreetMap routing server)',
    purpose: 'Calcular tiempos por carretera entre paradas y el punto de la calle más cercano a cada casa (solo coordenadas, sin nombres ni teléfonos)', country: 'Alemania (UE)',
    purposeEn: 'Calculating road travel times between stops and the point of the street nearest to each house (coordinates only, no names or phones)', countryEn: 'Germany (EU)' },
  { name: 'Servidor público de demostración de OSRM (router.project-osrm.org)', nameEn: 'OSRM public demo server (router.project-osrm.org)',
    purpose: 'Solo si el de FOSSGIS no contesta: lo mismo que a él (solo coordenadas, sin nombres ni teléfonos)', country: 'no consta dónde está',
    purposeEn: 'Only if the FOSSGIS one does not answer: the same as it (coordinates only, no names or phones)', countryEn: 'its location is not stated' },
]

// Las frases que van con las listas (03-11-2026), las mismas en las tres páginas: cada una, cierta para CADA línea.
export const LEGAL_NOTES = {
  es: {
    mapServices: 'Para situar las direcciones, calcular los trayectos y dibujar el mapa se pregunta a estos servicios bajo sus condiciones de uso, sin contrato de encargo con ellos. Reciben solo lo que dice cada línea (la dirección buscada, la zona del mapa o una posición y, cuando les pregunta directamente el móvil o el navegador, su IP), nunca nombres ni teléfonos. Están en la UE salvo Google (adherida al DPF), la OpenStreetMap Foundation (Reino Unido, con decisión de adecuación) y el respaldo de OSRM, del que no consta dónde está.',
    telegram: 'Solo si una empresa los activa en su panel con su propio bot, los avisos y resúmenes de su panel (inspecciones con enlaces a las fotos, depósito y mantenimiento, checklist, taller) van a su grupo de Telegram, y pueden llevar nombres de conductores, matrículas y lo que escribe el taller. Lo conecta la empresa, con su cuenta y bajo las condiciones de Telegram (Telegram Messenger Inc., fuera de la UE); no es un encargado nuestro. Nuestros avisos internos por Telegram no llevan datos personales.',
    browserPush: 'Solo si los activas, cada aviso llega a tu navegador a través del servicio de avisos que usa ese navegador (el de Google, Mozilla, Apple o Microsoft), cifrado de forma que ese servicio no puede leer lo que dice, y bajo sus condiciones; ese servicio lo pone el navegador, no nosotros.',
    transfers: 'Cuando alguno de los encargados trata datos fuera del Espacio Económico Europeo, la transferencia se ampara, según el caso, en el EU-US Data Privacy Framework (solo las empresas de EEUU adheridas a él, las marcadas «DPF»), en una decisión de adecuación de la Comisión Europea o en Cláusulas Contractuales Tipo.',
  },
  en: {
    mapServices: 'To locate addresses, calculate journeys and draw the map, these services are queried under their terms of use, with no processing agreement with them. They receive only what each line says (the address searched for, the map area or a position and, when the phone or the browser asks them directly, its IP), never names or phones. They are in the EU except Google (certified under the DPF), the OpenStreetMap Foundation (United Kingdom, with an adequacy decision) and the OSRM fallback, whose location is not stated.',
    telegram: 'Only if a company turns them on in its panel with its own bot, the notices and summaries from its panel (inspections with links to the photos, fuel and maintenance, checklist, workshop) go to its Telegram group, and may include drivers’ names, number plates and what the workshop writes. The company connects it, with its own account and under Telegram’s terms (Telegram Messenger Inc., outside the EU); it is not our processor. Our own internal Telegram notices carry no personal data.',
    browserPush: 'Only if you turn them on, each notice reaches your browser through the push service that browser uses (Google’s, Mozilla’s, Apple’s or Microsoft’s), encrypted so that the service cannot read what it says, and under its terms; that service is provided by the browser, not by us.',
    transfers: 'Where any of the processors processes data outside the European Economic Area, the transfer relies, as the case may be, on the EU-US Data Privacy Framework (only US companies certified under it, those marked “DPF”), on an adequacy decision of the European Commission or on Standard Contractual Clauses.',
  },
}
