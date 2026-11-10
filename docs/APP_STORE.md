# FDS en el App Store de Apple (iPhone)

> Dani (30-10-2026): «¿cómo hacemos ahora para ponerla en Apple? Móntala y después dime los pasos y la ponemos».
> Montada el 30-10-2026. Lo que hace falta de Dani está en «Pasos de Dani»; lo técnico, debajo.

## Qué es la app de iPhone

La **misma web** del repartidor (`frontend/`, la de flotadsp.com) envuelta con **Capacitor** en una app nativa de
iPhone (`frontend/ios/`): abre directamente en la app del repartidor (`/ruta`), con la cámara para escanear y leer
etiquetas, la ubicación para ordenar la ruta y el mapa, y todo lo demás tal cual está en la web. No es la app
nativa de Android (esa es Kotlin, en `app-android/`): en iPhone se va por el camino corto para estar en la tienda
cuanto antes; cuando tenga usuarios se decide si merece una nativa.

Lo que la app de iPhone NO lleva (y por qué):
- **Nada de suscripciones, planes ni pagos** (reglas 2.1(b) y 3.1.1 de Apple: su pago dentro de la app, con el 15-30 % de
  comisión, y rechazan las apps que mencionan una suscripción sin sus productos enviados o que la desbloquean con códigos):
  en el iPhone no se vende, no se menciona y no se desbloquea nada con pagos. Ni el plan, ni la prueba con días, ni los
  precios, ni «gratis hasta…», ni el tope de paradas, ni los códigos de regalo o promocionales, ni los cupones, ni los
  bonos o «Invita y gana», ni los enlaces a pagar o a «Ver mi plan»: la app es gratuita para quien reparte y nada la
  limita ni la vende allí. Todo eso sigue igual en la web y en Android. Desde el rechazo del 09-11-2026 es una regla de
  todo el código (`sinPagos()`, abajo «RECHAZADA otra vez la 2.4.1»).
- **Avisos al móvil (push)**: la web los manda por Web Push, que dentro de la app de iPhone no funciona. Hace falta
  APNs (certificado de Apple + plugin): tanda 2.
- **Manos libres por voz**: Safari dentro de la app no tiene reconocimiento de voz. La app lo esconde sola.
- Botón de Google Play, «instalar la app» y los pasos de «añadir a pantalla de inicio»: dentro de la app no salen.

Desde Windows **no se puede compilar para iPhone** (hace falta Xcode, solo en Mac). Lo compila un Mac de GitHub:
`.github/workflows/app-ios.yml` compila siempre para el simulador (sin firma: si está en verde, el proyecto está
bien) y, cuando están los secretos de Apple, archiva, firma y **sube a App Store Connect** (TestFlight). El paso a
revisión y a la tienda es un botón en App Store Connect. Cada subida lleva el número de build del run (único, como
pide Apple) y la versión `APP_VERSION` del workflow (2.4.1).

## Sin iPhone (Dani no tiene): qué cambia

Nada de lo de abajo necesita un iPhone: el alta, la clave y la app en App Store Connect son páginas web (desde el
Android o el PC). Lo que sí cambia:
- **Apple ID**: si no tienes, se crea en https://appleid.apple.com (la verificación en dos pasos puede ir por SMS al
  número del Android). Con ese Apple ID se hace el alta de desarrollador en la web.
- **Probarla**: el Mac de GitHub la arranca en un simulador de iPhone en cada compilación y guarda la pantalla
  (artefacto «iphone-simulador» del run), así se ve que abre de verdad; la cámara y la ubicación no se pueden probar
  en el simulador. Para una prueba real antes de enviarla a revisión, un iPhone prestado 10 minutos (algún repartidor
  de OGA5/DGA1 lo tendrá): se instala desde TestFlight con un **enlace público** (App Store Connect → TestFlight →
  External Testing → Public link; Apple revisa el build para pruebas externas en menos de un día) sin dar de alta a nadie.
- **Las capturas de la ficha** ya están hechas desde la propia app a tamaño de iPhone 6,7" (1290×2796):
  `frontend/ios/listing/capturas/es-ES` y `en-US` (se regeneran con `node e2e/capturas-app-store.mjs <carpeta> es|en`
  con `vite preview --port 4174` en marcha; el generador simula la app de iPhone —`window.Capacitor`—, así la página del
  cliente (06) sale sin «Ordena tu ruta gratis»; con `cliente` al final sale solo la 06). Apple las admite en JPEG.

## Pasos de Dani (una vez)

1. **Cuenta de desarrollador de Apple** (99 $/año): https://developer.apple.com/programs/enroll/ con tu Apple ID
   (desde cualquier navegador; con iPhone también vale la app «Apple Developer»). Como persona física va en horas o
   1-2 días; como empresa pide número D-U-N-S y tarda semanas. Para empezar, persona física (se puede pasar a
   empresa después). Pide foto del DNI y el pago.
2. **El identificador de la app**: en https://developer.apple.com/account → Certificates, Identifiers & Profiles →
   Identifiers → «+» → App IDs → App → Description `FDS`, Bundle ID **explícito** `com.flotadsp.fds`. Sin
   capacidades extra (se añaden cuando haga falta: push).
3. **La clave de la API de App Store Connect** (para que GitHub pueda firmar y subir): en
   https://appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API → «+» → nombre
   `GitHub`, acceso **Admin** (hace falta para que Xcode cree los certificados). Apunta el **Issuer ID** (arriba),
   el **Key ID** y **descarga el .p8** (solo se puede bajar UNA vez).
4. **El Team ID**: https://developer.apple.com/account → Membership details → Team ID (10 letras y números).
5. **Los cuatro secretos en GitHub**: https://github.com/oga5furgonetas/foefa/settings/secrets/actions → New
   repository secret: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` y `ASC_API_KEY_P8` (abre el .p8 con el bloc
   de notas y pega TODO el contenido, con las líneas BEGIN y END).
6. **La app en App Store Connect**: My Apps → «+» → New App: plataforma iOS, nombre **FDS**, idioma principal
   Español (España), Bundle ID `com.flotadsp.fds`, SKU `fds`, acceso completo.
7. **Lanzar la subida**: en GitHub → Actions → «App iPhone (App Store)» → Run workflow. En 15-20 minutos el build
   aparece en App Store Connect → TestFlight (puede tardar unos minutos más en «procesarse»). Instálala en tu iPhone
   con la app TestFlight para probarla.
8. **La ficha** (App Store Connect → la app → App Store → la versión 2.4.1):
   - Nombre `FDS` · Subtítulo (30 letras) `Ruta de reparto y entregas` · Categoría Business (secundaria Navigation).
   - Descripción: la de Play, `app-android/play-listing/es-ES/full.txt` (y las de en-US, pt-BR, fr-FR, it-IT, de-DE
     para esos idiomas). Palabras clave (100 letras): `reparto,repartidor,ruta,entregas,paquetes,mensajería,escanear,
     etiqueta,navegación`. Texto promocional (170): el `short.txt`.
   - URL de soporte `https://flotadsp.com` · URL de privacidad `https://flotadsp.com/privacidad`.
   - **Capturas**: obligatorias de iPhone 6,7" (1290×2796) o 6,9" (1320×2868); con TestFlight en tu iPhone, captura
     Hoy, el mapa, una parada, Ajustes y Cuenta (como las de Play). Al ser solo iPhone no pide las de iPad.
   - **App Privacy** (cuestionario): se recogen Ubicación precisa (función de la app), Correo (cuenta), Fotos o
     vídeos (contenido que sube el usuario: etiquetas), Identificadores de usuario (cuenta), Datos de uso (analítica
     propia, no vinculada). Nada para publicidad ni se vende a terceros. Clasificación de edad: 4+.
   - **Información de revisión**: Apple entra con una cuenta de prueba: crea una en la web (p. ej. `apple@flotadsp.com`
     con unas paradas de ejemplo cargadas) y pon usuario y contraseña ahí, con una nota: «App para repartidores
     autónomos: escanea paquetes, ordena la ruta y navega. Para probar: entrar y pulsar "Ver un ejemplo" (carga
     3 paradas de muestra). Usa la cuenta de prueba de estas notas y no crees otra.» (Sin una palabra de planes ni de
     pagos: la app no los tiene, ver abajo. Lo de no crear otra cuenta: cada alta es una cuenta más en producción y, con
     un servidor sin `desde_ios`, manda la bienvenida estándar con la prueba.)
   - Selecciona el build de TestFlight, «Guardar» y **«Enviar a revisión»**. La primera revisión suele tardar 1-3 días.
9. Cada vez que se toque `frontend/` en `main`, el workflow vuelve a compilar y, con los secretos, sube otro build;
   para publicarlo, en App Store Connect se crea la versión nueva, se elige el build y se envía a revisión.

## Hecho el 30-10-2026 por la tarde (con Dani en el teclado solo para lo legal)

- Cuenta de desarrollador pagada y activa (Team ID `NTB3DX7S23`), App ID `com.flotadsp.fds` registrado, clave de la API
  «GitHub» (Admin; Key ID `69L4YQTS65`, Issuer ID `3355c0c6-1478-4646-bcfc-7cc818d424cf`), los cuatro secretos en GitHub
  (el .p8 metido con `secreto_github.py` desde la descarga, sin pasar por ninguna pantalla; copia en
  `C:\Users\dlvie\.flota-apple-AuthKey_69L4YQTS65.p8`). Los términos de App Store Connect y el acceso a la API los
  aceptó Dani en su Chrome (el modo auto no deja aceptar nada legal en nombre de otro).
- La app en App Store Connect se llama **«FDS: ruta de reparto»** (el nombre «FDS» a secas ya lo usa otra app; Apple
  exige nombres únicos), SKU `fds`, idioma principal español (España), id de app `6828952622`.
- **`scripts/app_store_connect.py`** (con la clave; `pip install pyjwt cryptography`): `apps`, `version 2.4.1`,
  `ficha` (nombre, subtítulo, descripción, palabras clave y URLs en los 7 idiomas de `frontend/ios/listing/`, y las
  categorías Business + Navigation), `capturas` (las de `listing/capturas/<idioma>` como iPhone 6,7") y `edad`
  (clasificación 4+). Todo eso está YA puesto en la versión 2.4.1.
- Esa misma tarde: el cuestionario de **App Privacy** publicado y el precio (gratis) y la disponibilidad (175 países) en el
  Chrome de Dani; la **cuenta de prueba** `apple@flotadsp.com` (contraseña solo en `~/.flota-apple-review-account.txt`), el
  teléfono y las notas en la información de revisión (`revision`); el build 9 (2.4.1) subido a las 18:06, procesado a las
  18:10 y adjunto a la versión (`adjuntar`): la versión está «En preparación para el envío» con todo relleno.
- Esa noche (Dani: «mándala tú»): tres órdenes más en el script: `copyright` (el copyright de la versión, obligatorio para
  enviar, y que se publique sola al aprobarla: ejecutado), `derechos` (derechos sobre el contenido: no usa contenido de
  terceros) y `enviar` (el envío a revisión por la API: crea el envío, mete la versión y lo manda). `derechos` y la
  condición de comerciante son DECLARACIONES y el modo auto no las hace en nombre de Dani (las bloqueó): las hace él en
  App Store Connect → Información de la app: «Derechos sobre el contenido → Editar → no contiene contenido de terceros»
  y «Reglamento de Servicios Digitales → Configurar → Soy un comerciante sujeto al DSA» (una dirección, un teléfono y un
  correo que Apple MUESTRA en la ficha y verifica con un código; sin esto Apple no distribuye en España ni en el resto
  de la UE). Después, `python scripts/app_store_connect.py enviar` (o «Añadir a revisión» → «Enviar a revisión de apps»
  en la web). La revisión suele tardar 1-3 días. Hecho el 30-10 a las 19:03: Dani marcó «No» en derechos (el Guardar lo pulsó
  Claude en su pestaña) y `enviar` → WAITING_FOR_REVIEW; se publica sola al aprobarla. La condición de comerciante (DSA) la hizo Dani a la vez (Negocio → Cumplimiento: «Reglamento de
  Servicios Digitales · 27 países · Activo»). Nada pendiente en Apple hasta que conteste.

## La firma en el Mac de GitHub: manual, con certificado y perfil propios (30-10-2026, tarde)

La firma automática con la clave de la API no sirve sin un iPhone registrado en la cuenta: al archivar, Xcode pide un
perfil de desarrollo y falla con «Your team has no devices» (y si se le fuerza la identidad de distribución,
«conflicting provisioning settings»). Así que se firma a mano, como hacen los CI de verdad:
- `python scripts/app_store_connect.py certificado`: crea la clave privada y la CSR en el PC, Apple firma el certificado
  **Apple Distribution** por la API y queda `~/.flota-apple-dist.p12` (contraseña en `~/.flota-apple-dist-p12.txt`,
  base64 en `~/.flota-apple-dist.p12.b64`). Apple admite 2-3 certificados de distribución por equipo: no repetir sin
  borrar el anterior en developer.apple.com → Certificates.
- `python scripts/app_store_connect.py perfil`: el perfil **FDS App Store** (App Store, `com.flotadsp.fds`, con ese
  certificado) en `~/.flota-apple-FDS-App-Store.mobileprovision` (+ `.b64`). Caducan el 30-10-2027.
- Tres secretos más en GitHub: `IOS_DIST_P12_B64` (el `.p12.b64`), `IOS_DIST_P12_PASSWORD` (el `.txt`) e
  `IOS_PROFILE_B64` (el `.mobileprovision.b64`). El target App lleva en Release `CODE_SIGN_STYLE = Manual`,
  `Apple Distribution` y ese perfil (`project.pbxproj`); el workflow importa el certificado en un llavero propio,
  instala el perfil, archiva y exporta con `signingStyle manual` y sube con la clave de la API.
- Hecho ese día desde la API, sin Xcode: certificado `652QMHW2NZ` y perfil `61c5577a-…`. Los secretos del certificado
  los tuvo que meter Dani (el modo auto bloqueó escribirlos desde aquí).

- **Xcode 26**: desde octubre de 2026 Apple solo admite builds hechos con el SDK de iOS 26; el workflow elige el Xcode 26 más nuevo del Mac de GitHub (`/Applications/Xcode_26*.app`). Con todo eso, el build 9 (2.4.1) subió el 30-10 a las 18:06 (run 41094495278) y Apple lo procesó en cuatro minutos; `python scripts/app_store_connect.py builds` dice cuándo está procesado y `adjuntar` lo pone en la versión (hecho ese día).

## Por si la revisión pone pegas (lo típico)

- «Minimum functionality / es una web» (4.2): la app escanea con la cámara, usa la ubicación, funciona sin red
  (cola de entregas) y guía con voz: explicarlo en las notas de revisión si lo dicen.
- «Pagos fuera de la app» (3.1.1) y «referencias a suscripción» (2.1(b)): dentro del iPhone no hay nada de pagos: ni botón
  de pagar, ni plan, ni prueba, ni precios, ni códigos de regalo, ni bonos (ver abajo, «RECHAZADA otra vez la 2.4.1»).
- «Falta Sign in with Apple» (4.8): solo lo exigen si la app ofrece entrar con Google/Facebook; FDS entra con correo
  y contraseña, así que no aplica.
- Permisos: cada uno lleva su explicación en `Info.plist` (cámara, fotos, ubicación mientras se usa, micrófono).
- Cifrado: `ITSAppUsesNonExemptEncryption = false` (solo HTTPS), para que no pida el cuestionario de exportación.

## Lo técnico (dónde está cada cosa)

- `frontend/capacitor.config.json`: `appId com.flotadsp.fds`, `appName FDS`, la web compilada en `dist`, fondo y
  barra de estado del color de la app, pantalla de arranque sin rueda.
- `frontend/ios/App/`: el proyecto de Xcode que genera Capacitor (`npx cap add ios`). Tocado a mano: `Info.plist`
  (permisos, solo vertical, sin cifrado, región es), `project.pbxproj` (solo iPhone, versión 2.4.1), los iconos
  (`Assets.xcassets`, generados con `node scripts/generar-iconos-ios.mjs` desde `public/favicon.svg`: icono de
  1024 sin transparencia y pantalla de arranque de 2732). `App/App/public` (la web copiada) y `Pods` no van a git.
- `frontend/src/lib/plataforma.js`: `esAppNativa()` / `esAppIOS()` (Capacitor deja `window.Capacitor` solo dentro
  de la app), `arrancarEnLaApp()` (de `/` a `/ruta` al abrir) y `barraNativa()` (la barra de estado a juego con el
  tema, con el plugin StatusBar), y `sinPagos()` (= `esAppIOS()`): la pregunta que esconde en el iPhone todo lo de planes,
  pagos, regalos, bonos e invitaciones. `lib/instalar.js` da la app por instalada dentro de la nativa (sin «instalar»).
- El servidor admite el origen `capacitor://localhost` en CORS siempre (`server.py`): sin eso el iPhone no podría
  ni entrar.
- Para compilar en local hace falta un Mac: `cd frontend && npm ci && VITE_API_URL=https://flota-backend.fly.dev/api
  npm run build && npx cap sync ios && npx cap open ios` (abre Xcode; con tu cuenta de Apple en Xcode → firma
  automática → Product → Archive → Distribute).

## RECHAZADA la 2.4.1 (Apple, 31-10-2026 a las 18:18): qué piden y qué contestar

Visto en App Store Connect el 01-11 durante la auditoría (nadie lo había mirado): **«2.1.0 Performance: App
Completeness — Guideline 2.1 Information Needed»**. No es un fallo de la app: Apple pide MÁS INFORMACIÓN antes de
revisarla, y lo pide a toda app nueva. Enviada el 30-10 a las 19:02 por el usuario de API del CI (build 9, 2.4.1).
Ojo: hasta hoy cada push que tocaba la web compilaba y SUBÍA otra build a App Store Connect (`app-ios.yml` se
lanzaba con `frontend/src/**`); desde el 01-11 solo se lanza a mano o al tocar `frontend/ios/**`.

Lo que hay que meter en **App Store Connect → la versión → Información para el equipo de revisión → Notas**, y
volver a enviar («Volver a enviar a revisión de apps» en el envío rechazado):

1. **Un vídeo grabado en un iPhone físico** con el iOS más reciente: abrir la app, entrar (o la demo), escanear una
   etiqueta, ordenar la ruta, marcar una entrega con foto, **y borrar la cuenta** (Cuenta → Borrar mi cuenta: Apple
   lo exige y lo graba). Dani no tiene iPhone: lo graba alguien de confianza con TestFlight (la build 9 sirve), o se
   compra/presta uno un día. Sin este vídeo no la revisan.
2. **Una cuenta de prueba para el revisor** (usuario y contraseña en «Información de inicio de sesión»), de cada
   tipo de cuenta que exista en la app: repartidor autónomo y conductor de empresa. Las crea Dani en producción
   (`/registro` con sector autónomo; un conductor en una empresa de prueba) y NO se borran mientras dure la revisión.
3. Pegar en Notas (en inglés) el texto de abajo, rellenando los huecos.

```
PURPOSE AND AUDIENCE
FDS is a delivery-route app for self-employed parcel couriers and for the drivers of small delivery companies in
Spain, Portugal and Latin America. The courier scans the parcel labels (or photographs the paper delivery sheet),
the app geocodes the addresses and orders the route by time windows and distance, guides stop by stop (voice,
hands-free), records proof of delivery (photo, signature, cash-on-delivery) and shows the day's earnings.
Company drivers use the same app for their daily vehicle inspection with photos and to see their shifts.

HOW TO ACCESS
- Self-employed courier: log in with: user <USUARIO_PRUEBA_AUTONOMO> / password <CLAVE>. On the route screen tap
  "Ver un ejemplo" to load a sample route with 3 stops.
- Company driver: log in with: <CORREO_CONDUCTOR_PRUEBA> / password <CLAVE> (company "<NOMBRE EMPRESA PRUEBA>").
- Registration: "Crear mi cuenta" → name, e-mail, password. Please use the test accounts above instead of creating a
  new one.
- Account deletion: Cuenta → "Borrar mi cuenta" (asks for the password; deletes the account and its data).

EXTERNAL SERVICES
Our own API (https://flota-backend.fly.dev), OpenStreetMap/Photon/Nominatim and CartoCiudad (geocoding and maps),
OSRM (route times), Google ML Kit (on-device barcode and text recognition), Firebase Cloud Messaging (push,
Android only), Google Gemini (reads the text of a photographed delivery sheet; no personal data is stored by the
provider).

REGIONAL DIFFERENCES
The app works the same in every region. Currency and traffic/road-work feeds follow the country of the route
(Spain: DGT; other countries: none or public feeds). No feature is region-locked.

NO REGULATED CONTENT
No regulated industry, no third-party protected material, no user-generated public content (deliveries are
visible only to the courier and, for company drivers, to their own company).

RECORDING
The attached video was recorded on <MODELO DE IPHONE>, iOS <VERSIÓN>, and shows launch, demo route, scanning,
delivery with photo, registration, login and account deletion.
```

### El mensaje para «Responder al equipo de revisión de apps» (01-11-2026)

Lo que falta para poder contestar: iniciar sesión en App Store Connect (la sesión del Chrome caducó; solo Dani), el
vídeo en un iPhone físico, y **que la build que se reenvíe lleve el «Borrar mi cuenta»** (la web lo tiene desde el
01-11, commit `c5ad1d9`; hay que lanzar «App iPhone (App Store)» a mano para que salga la build 10 con esa web). El
texto, para pegar tal cual y rellenar los huecos:

```
Thank you for the review. Here is the requested information (also added to the App Review notes):

1. Screen recording: <ENLACE O ADJUNTO del vídeo grabado en un iPhone físico con iOS 26.x>. It shows launch, the
   no-login demo route, scanning a label, ordering the route, a delivery with photo, registration, login and
   account deletion (Cuenta → "Borrar mi cuenta").
2. Purpose and audience: FDS is a delivery-route app for self-employed parcel couriers and for the drivers of
   small delivery companies (Spain, Portugal, Latin America). The courier scans parcel labels or photographs the
   paper delivery sheet; the app orders the stops by time windows and distance, guides stop by stop (voice,
   hands-free), records proof of delivery (photo, signature, cash on delivery) and shows the day's earnings.
3. Access: test accounts: courier <USUARIO> / <CLAVE>; company driver <CORREO> / <CLAVE>. On the route screen,
   "Ver un ejemplo" loads a sample route with 3 stops. Registration: "Crear mi cuenta" (name, e-mail, password).
   Account deletion: Cuenta → "Borrar mi cuenta" (asks for the password).
4. External services: our own API (flota-backend.fly.dev); OpenStreetMap, Photon, Nominatim and CartoCiudad
   (geocoding/maps); OSRM (route times); Google ML Kit on device (barcode/text); Firebase Cloud Messaging
   (Android only); Google Gemini (reads a photographed delivery sheet; no personal data retained by the provider).
5. Regional differences: none. Currency and road-works feeds follow the country of the route (Spain: DGT).
6. No regulated industry, no third-party protected material, no public user-generated content.
```

## Tanda 2 (cuando esté en la tienda)

- Avisos al móvil con APNs (`@capacitor/push-notifications` + certificado/clave APNs en el servidor).
- Si algún día se vende algo dentro del iPhone: solo con el pago de Apple (StoreKit, suscripción mensual y anual) o, en
  la UE, el enlace externo con las condiciones del DMA, y con sus productos enviados a revisión ANTES que el binario.
  Mientras tanto, la app de iPhone no menciona ni vende nada con pagos (sección de abajo).
- Compartir la ubicación en segundo plano para «Seguirme» con la pantalla apagada (hoy, solo con la app abierta).
- Capturas por idioma y la ficha en en/pt/fr/it/de (las de Play valen).

## Rechazo del 09-11-2026: RECHAZADA otra vez la 2.4.1 (2.1(b) y 3.1.1), y la app de iPhone sin una palabra de pagos

Apple revisó la **2.4.1 (build 16)** el 09-11-2026 (iPad Air 11" M3) y la rechazó otra vez (Centro de resolución, envío
`22b9c401-a224-4e23-b1ff-5670fcc0adef`, mensaje de las 15:28), esta vez por dos motivos de pagos:
- **2.1(b) Performance - App Completeness**: «la app incluye referencias a suscripción, pero los productos de compra dentro
  de la app no se han enviado a revisión». Sus salidas: enviar los productos de compra, o quitar las referencias.
- **3.1.1 Business - Payments - In-App Purchase**: «la app usa códigos promocionales para desbloquear la suscripción» (el
  cuadro «¿Te han regalado la app? · Código de regalo · Canjear» de la pestaña Cuenta). Salida: quitar eso y cualquier otra
  cosa que desbloquee funciones sin pasar por la App Store.

**Decisión: se quita.** La app de iPhone es gratuita para quien reparte y nada la limita ni la vende allí. No se envían
productos de compra. La regla de arriba («en el iPhone no se vende nada») ya escondía la compra en `RutaCuenta.jsx`, pero
Apple seguía viendo referencias: la tarjeta del plan, los días de prueba, el tope, el código de regalo, «Invita y gana»…

### Qué se esconde en la app de iPhone (y dónde)
Todo detrás de `sinPagos()` (`frontend/src/lib/plataforma.js`, = `esAppIOS()`: `window.Capacitor` solo existe dentro de la
app). Fuera del iPhone (web, Android, PWA) no cambia nada.
- **Cuenta** (`RutaCuenta.jsx`): sin la tarjeta del plan («Plan Repartidor», prueba, días que quedan, tope, regalo, precios),
  sin Suscribirte / Regala / Gestionar, sin el código de regalo («Canjear») y sin «Invita y gana» (saldo, bono, regalo de
  saldo, QR, cobro por Bizum o PayPal); sin la frase «los pagos los procesa Stripe». Quedan el acceso, el mercadillo, el
  idioma, la privacidad, cerrar sesión y borrar la cuenta. `Muro` no existe: nada bloquea.
- **Hoy** (`RutaApp.jsx`, `MiRuta.jsx`): sin los avisos «Quedan N días de prueba · Ver mi plan», «Gratis: N paradas al día ·
  Quitar el tope» y «+N € en tu cartera»; sin la línea «Gana N € por cada compañero»; sin el bono de bienvenida (tarjeta,
  hoja y bienvenida); sin la tarjeta de invitar tras la primera entrega ni el botón «Invitar a un compañero» del cierre
  del día; sin muro (prueba terminada, falta la tarjeta, regalo acabado, pago pendiente). La dirección (`?canjear=`,
  `?regalo=`, `?regalo_propio=`, `?pago=ok`) ya no canjea ni cobra. «Comparte tu día» sale sin QR, sin enlace de invitación
  y sin «pruébala gratis» (`lib/compartirDia.js`); `invitar()` no hace nada.
- **Alta, acceso y entrada** (`Registro.jsx`, `Login.jsx`, `Empezar.jsx`): solo se crea la cuenta de quien reparte, sin
  selector de sectores ni de planes de empresa, sin cartel de gratis/precio/bono, sin «Te ha invitado un compañero», sin
  «Crear cuenta con plan X», sin la píldora del plan, sin mandar ningún código de invitación (`lib/referido.js`); el botón
  dice «Crear mi cuenta». La entrada sin la lista «Gratis y sin límite… / sin tope: X €/mes» y sin la guía de Safari.
- **Portal del conductor** (`DriverPortal.jsx`, `InspectionFlow.jsx`, `InspectionDone.jsx`): sin «Comparte y gana»
  (cartera), sin «Ropa del equipo» (precios y pago), sin las ofertas patrocinadas ni los «incentivos» de la auditoría.
- **Panel de la empresa**: sin la franja de prueba/plan con su botón de pagar (`TrialBanner.jsx`), sin «Plan y suscripción»
  ni «Ver planes» en Configuración, sin «Facturación» en Perfil y sin «Cómo se factura» (precios) en la ficha de la furgoneta.
  Las pantallas del dueño del producto (Negocio, con planes y cobros, la tienda de ropa, la analítica y los gastos; solo las
  ve el super-admin) no existen en el iPhone: ni en el menú ni por la dirección (llevan al panel).
- **Textos legales** (`legal/`, en español y en inglés): los Términos sin las cláusulas de suscripción, prueba, pagos,
  regalos, «Invita y gana», bono y cartera, y con el §8 diciendo «limitada al máximo que permita la ley» (to the maximum
  extent permitted by law) en vez de «al importe pagado por el cliente en los 12 meses anteriores»; la Privacidad sin
  «Invita y gana», cartera, pagos ni «datos de facturación»; las Cookies sin Stripe ni `flota_plan`; Seguridad, Aviso legal
  y Encargo sin «pagos» ni «suscripción» y el Aviso legal sin «el acceso a la página web pública es gratuito»; Stripe y
  Google Play fuera de la lista de encargados y sin «Google Play services» (la línea del geocodificador de Android pasa a
  llamarse «Google (geocodificador de Android)»).
- **Páginas de la web que en el iPhone no existen** (`main.jsx`, `SoloWeb`; llevan a la app del repartidor): la portada (`/`),
  `/planes`, `/regalo/…`, `/invita`, `/repartidores`, `/calculadora-repartidor`, `/iphone`, `/empleo/prioridad`,
  `/peritaje-tecnico` y `/t/…` (la tienda). En la candidatura de empleo y en el seguimiento del cliente, sin «Invita y
  gana», promociones, ropa ni «ordena tu ruta gratis».
- **Errores del servidor** (`txError`, `services/api.js`, `HABLA_DE_PAGOS` en `lib/plataforma.js`): lo que mande el servidor
  sobre plan (singular o plural), suscripción, prueba con días, tope, cuota, regalo, bono, cartera, retirada, enlaces de
  invitación, promoción, Stripe, PayPal o Google Play, y cualquier 402, sale como «No se ha podido completar. Inténtalo de
  nuevo más tarde.» (o el texto por defecto de la pantalla). La expresión sale de clasificar con `ast` los 1.221
  `HTTPException` de `server.py` (1.219 con texto, 898 distintos): los 66 que hablan de pagos se neutralizan y los legítimos (credenciales,
  validaciones, enlaces caducados, el cobro de un cliente en una entrega, el «plano» del parking, «Pega el plan de la
  semana») salen tal cual. «Mándanos una idea» y la respuesta del correo «¿Qué tal te va?» pasan el error entero a
  `txError` (así vale también el código HTTP).
- **Alta y correos del servidor** (T4): el alta manda `desde_ios: true` (`Registro.jsx`, `AltaRapida.jsx`; solo dentro de la
  app: en la web y en Android el cuerpo es el de siempre). El servidor (`register_dsp`) guarda `alta_ios` y pone
  `correos_baja` (con `correos_baja_at` y el motivo `alta_ios`): esa cuenta no recibe la bienvenida ni ningún correo del
  ciclo (primer día, casi fin, recordatorio, invita, bono, opinión, «bono25») ni la bienvenida genérica con «Tu prueba
  gratuita de N días», y el aviso de la mañana (un push) no lleva la frase del bono. Los correos de la cuenta (contraseña,
  códigos, verificación) no cambian. Un servidor sin esto ignora el campo nuevo: el build del iPhone puede salir antes.
- **Enlaces que salen de la app** (T5): dentro de la app `window.location.origin` es `capacitor://localhost`, que fuera de ella
  no abre; `origen()` (`src/marca.js`) da allí la web pública (`VITE_WEB_ORIGIN`, que `app-ios.yml` pasa al compilar, y por
  defecto `https://flotadsp.com`): el seguimiento que el repartidor manda al cliente por WhatsApp, el portal del conductor y
  «Copiar enlace para el cliente» del panel. En la web y en Android, la dirección de siempre.
- **Capturas de la ficha** (T2): el generador (`e2e/capturas-app-store.mjs`) simula la app de iPhone (`window.Capacitor`); la
  06 (enlace del cliente, es y en) ya no enseña «Ordena tu ruta gratis con FDS».

### Cómo se vigila
- **`frontend/e2e/ios-sin-pagos.spec.js`**: simula la app (`window.Capacitor` con `getPlatform() 'ios'`, el puente nativo y
  el agente `FDSApp`), recorre con la API simulada la cuenta en cada estado (prueba, suscrita, regalo, suspendida,
  promoción…), «Hoy» con sus avisos, bono e invitaciones, el error del tope, el alta entera, la entrada, el portal del
  conductor con la auditoría y su final, el panel y los textos legales, también con el móvil en los seis idiomas (y pt-BR),
  y comprueba que NADA de lo que se ve —ni los nombres accesibles, marcadores o títulos— casa con el vocabulario prohibido
  (suscripción, plan —en singular también—, prueba con días, precio, €/mes, promo, cupón, código de regalo, bono, invita y
  gana, gana N €, gratis hasta, paradas al día, Stripe, pagar, comprar, premium… y sus equivalentes en en, pt, fr, it y de).
  Cada pantalla tiene su **control**: la misma ruta sin simular el iPhone sigue enseñando lo que enseña la web. Suma, de la
  segunda pasada: la tabla de 41 mensajes REALES del servidor que se neutralizan y 45 que no (comprobados contra
  `server.py`), «Mándanos una idea» y el asistente con el error real, las páginas legales sin «importe pagado», «facturación»,
  «gratuito» ni «Google Play», el cuerpo del alta con `desde_ios` y los enlaces que salen de la app.
  Comprobado también al revés: con `sinPagos = () => false` fallan 99 de las 200 pruebas del archivo (97 de las 118 del
  iPhone y 2 de las de Node); las 74 de control de la web siguen en verde y las otras 21 del iPhone no tienen nada que esconder.
- **`backend/tests/test_alta_ios.py`** (8 pruebas): el alta del iPhone queda sin correos y sin bienvenida; sin `desde_ios`
  sigue la bienvenida del ciclo y la de las empresas; el ciclo entero, el primer día y la campaña de 25 € le saltan a la
  cuenta de la web y no a la del iPhone; el aviso de la mañana no habla del bono a esa cuenta; el esquema ignora campos
  desconocidos.
- **Regla para quien toque la app**: toda pantalla o texto nuevo con plan, precio, prueba, regalo, bono o invitación lleva
  `sinPagos()`; si no, esa prueba falla. Un mensaje de error nuevo del servidor que hable de eso, también: añadirlo a la
  tabla de la prueba (o a `HABLA_DE_PAGOS` si no lo casa).

### Lo que NO cambia (y hay que tener presente)
- El servidor sigue con sus reglas: desde el 01-01-2027 aplica el tope de 15 paradas nuevas al día a las cuentas sin
  suscripción (`REP_GRATIS_HASTA`), también a las del iPhone, que no sabe de qué plataforma viene una cuenta. En la app
  sale un aviso neutro (sin «plan» ni «tope»). Ver «Pendiente de Dani».
- Los correos que manda el servidor a cuentas creadas en el iPhone (bienvenida, ciclo, «te quedan N días de prueba», bono)
  ya no salen **si el servidor lleva este cambio** (`desde_ios`): hay que desplegarlo ANTES de que el revisor cree una
  cuenta. Las cuentas creadas antes (pruebas, revisores anteriores) ya recibieron lo suyo y no llevan `alta_ios`.
- Siguen sin la marca de «correos de baja» y sin tocar: los envíos que hace el super-admin a mano (`/admin/correo`), el
  resumen semanal de inspecciones (no habla de plan ni de precios) y los correos de cuenta (contraseña, códigos). Los
  avisos al móvil («Tu primera ruta con FDS», el de la mañana) no pasan por `correos_baja` y no llegan a un iPhone: la app de
  iPhone no tiene plugin de avisos y su WebView no admite web push.
- El mercadillo (anuncios entre repartidores) lleva el precio del objeto que se vende y el consejo «no pagues por
  adelantado»: no es un plan ni un pago de la app y se queda.
- Las listas de proveedores de los textos legales siguen nombrando la app de Android donde un proveedor solo la sirve
  (avisos con Firebase, mapa de OpenFreeMap, geocodificador de Android): es lo que pasa de verdad; solo se quitó «Google Play
  services».
- Las capturas 01-05 de la ficha son las del 30-10 (antes del diseño compacto): su generador ya no encuentra el botón
  «Editar parada» (la ficha de la parada cambió con el diseño compacto), así que no se regeneraron; solo las dos 06.

### Pendiente de Dani (no es de la app)
- **El tope de 15 paradas nuevas al día** del servidor desde el 01-01-2027 alcanzará también a las cuentas del iPhone, y allí
  no hay forma de quitarlo dentro de la app (sin pagos en la app no se puede vender «sin tope»). Es una decisión de negocio:
  quitar el tope a las cuentas con `alta_ios`, ofrecerlo con la compra de Apple más adelante, o aceptarlo.
- **Los correos ya enviados** antes de este cambio (a cuentas creadas en el iPhone: las de prueba, las de revisores de
  Apple anteriores) no se pueden retirar, y esas cuentas no llevan `alta_ios`: siguen en el ciclo hasta que se den de baja
  (enlace del correo).

### Qué contestar a Apple (Centro de resolución, en inglés; poner el número de build al subirlo)
Lo que se mandó el 09-11-2026 (build 20), sin prometer nada que no se pueda comprobar en la app (ni el correo de bienvenida ni
«es gratis»: el servidor pondrá el tope de 15 paradas al día en 2027):
```
Hello, and thank you for the review.

We have addressed both issues in a new binary of version 2.4.1 (build <N>).

Guideline 2.1(b): the iOS app no longer contains any reference to subscriptions, plans, prices, free-trial periods or
In-App Purchase products. We removed them from the iOS app's screens and notices (account screen, home notices, sign-up and
sign-in, legal pages and the company panel included). The app has no In-App Purchase products, so there is nothing to submit.

Guideline 3.1.1: the gift/promo code field, and any other code, coupon, bonus or referral reward, has been removed from the
iOS app. Nothing is sold, unlocked or redeemed inside the iOS app.

The demo account in the App Review Information is unchanged. Thank you for your time.
```

### Pasos para reenviarla
1. Mezclar la rama `ios/sin-pagos` en `main`.
2. **Desplegar el servidor** (`desde_ios`, `scripts/deploy-backend.ps1`) ANTES del build: así la cuenta que cree el revisor
   no recibe correos con plan, prueba ni precios.
3. **«App iPhone (App Store)»** → Run workflow (sube el build N a App Store Connect y compila la web con `VITE_WEB_ORIGIN`;
   el número de build es el de la ejecución del workflow). OJO: un push a `main` que toque `.github/workflows/app-ios.yml`,
   `frontend/ios/` o `frontend/capacitor.config.json` lo lanza SOLO (el #18 del 09-11 salió así); un cambio de `frontend/src`
   no. `python scripts/app_store_connect.py builds` dice cuándo está procesado y `adjuntar N` lo pone en la versión (que pasa
   de REJECTED a PREPARE_FOR_SUBMISSION).
4. Poner las notas de revisión (sin «free plan, no card» ni nada de pagos; piden usar la cuenta de prueba y no crear otra;
   el punto 6 describe el MERCADILLO como contenido de usuarios, con sus controles). OJO: `python scripts/app_store_connect.py
   revision` PISA las notas largas por las cortas y reescribe la cuenta de prueba; para cambiar solo las notas, el PATCH de
   `notes` en `appStoreReviewDetails/<id>` (4.000 caracteres como máximo; el script del PC `fds-emu/asc_notas_poner.py`
   las pone con el número de build y no toca la cuenta de prueba), o a mano en la versión → Información para el equipo de
   revisión. Las cuentas de prueba (autónomo y conductor) siguen vivas; no borrarlas.
5. Contestar en el Centro de resolución con el texto de arriba y volver a enviar. Si el envío rechazado no deja reenviar,
   como el 03-11: quitar su elemento rechazado y crear uno nuevo por la API (`enviar`).

## Plan B (10-11-2026): preparado por si Apple vuelve a rechazar

> La 2.4.1 (build 20) está en la cola de Apple desde el 09-11 a las 20:37. Esto NO toca nada de lo que está en revisión ni de
> lo desplegado: es trabajo hecho por adelantado en la rama `ios/plan-b` (sale de `main` 1e1f6df) para que, si Apple vuelve a
> rechazar, se reenvíe en un par de horas y no en un día. Si aprueba, sale en la siguiente versión. **Nada de esto se publica
> ni se le dice a Apple sin el visto bueno de Dani.**
>
> Puesto al día el 10-11-2026, con la rama ya construida: además del bloqueo lleva las normas que se aceptan al entrar, el
> filtro de palabras y quitarle el mercadillo a quien incumple. Lo que se cuenta aquí se ha leído en el código de la rama,
> pero **nada está desplegado**: lo que solo será verdad con la rama fusionada, desplegada y con el build nuevo va marcado
> **«con el plan B fusionado»**. Lo que no se ha podido comprobar desde el código lleva **[COMPROBAR]** y está junto al final
> («Lo que no se ha podido comprobar»).

### Para Dani, en corto
- Si Apple rechaza otra vez, lo más probable es la regla **1.2 (contenido de usuarios)**, por el mercadillo. A una app así
  Apple le pide cinco cosas: que se acepten unas normas, un filtro, poder denunciar, poder **bloquear** a otra persona y que
  tú actúes en 24 horas, retirando el contenido y echando a quien lo puso. La app que está en revisión solo tiene una parte
  (denunciar, y que cada anuncio lo revisas tú antes de que salga). **En esta rama están las cinco.**
- Si llega el rechazo: se mira qué regla dice, se coge de aquí la respuesta de esa regla y se siguen los pasos de abajo. Tú
  haces cuatro cosas: decir «sí» al despliegue, tener abierta tu sesión de App Store Connect, dar el visto bueno al texto y
  **no entrar al mercadillo con las cuentas de prueba de Apple** después de desplegar (si aceptas las normas con ellas, el
  revisor ya no ve esa pantalla).
- Hay cuatro decisiones que son tuyas y que este trabajo no toma por ti (abajo, «Pendiente de Dani»): revisar las denuncias
  del mercadillo en 24 horas, que las normas y el filtro le cambian el mercadillo a todo el mundo y no solo en el iPhone,
  qué hacer con el tope de 15 paradas en el iPhone y si se cobra allí con el sistema de Apple.
- **La regla de oro de todo lo que se le escribe a Apple:** tiene que ser verdad y poder comprobarse en la app o en el código.
  Si preguntan si hay un plan de pago fuera del iPhone, la respuesta es que **sí** (en la web y en Android), y que la app de
  iPhone ni lo vende, ni lo menciona, ni desbloquea nada con códigos. Nunca «es gratis para siempre». Y del mercadillo, igual:
  el filtro es una lista de palabras (nunca «lo detecta todo»), a quien se bloquea «no se le avisa» (nunca «no puede
  saberlo»), el acceso se le quita a una cuenta (no a una persona) y las 24 horas las cumples tú, no una máquina.

### Qué hay en la rama `ios/plan-b`
Primero, lo que Apple pide a una app con contenido de usuarios, en el orden de su lista (todo con el plan B fusionado):

1. **Aceptar las normas al entrar** (servidor y web). La primera vez que alguien entra al mercadillo —y otra vez si las
   normas cambian— ve «Normas del mercadillo» con la frase «Antes de entrar, lee las normas y acéptalas.» y, abajo, el botón
   **«Acepto las normas»**; sin pulsarlo no pasa (volver es salir del mercadillo). El servidor apunta quién, qué versión y
   cuándo. Vale para todos: quien reparte por su cuenta, el conductor de empresa (que nunca había marcado una casilla de
   términos) y la gente de oficina; a quien modera no se le piden. **La pantalla la impone la web; el servidor no cierra las
   demás rutas**, a propósito: la app de iPhone que está en revisión y las webs en caché no la conocen y dejarían de poder
   escribir. Además, como antes, publicar un anuncio pide marcar su casilla («Es mío, lo que cuento es verdad y cumple las
   normas…»), y esa sí la exige el servidor. API: `POST /mercadillo/normas`; `normas_ok` en `GET /mercadillo/estado` y en
   `GET /mercadillo`; se guarda en `mercadillo_prefs.normas` (`{v, ts}`); la versión es `NORMAS_VERSION`
   (`backend/mercadillo.py`).
2. **Un filtro automático de palabras** (servidor). Cada anuncio lo sigue revisando una persona ANTES de publicarse. Además,
   una lista básica de insultos, insultos racistas u homófobos y amenazas —en español y en inglés, con las palabrotas
   inglesas también sueltas y unos pocos de gallego, catalán, portugués, francés, italiano y alemán— no deja enviar ni un
   anuncio (título, descripción y zona) ni un mensaje que lleve alguno: «Ese mensaje no se puede enviar: no se permiten
   insultos, amenazas ni contenido ofensivo. Cámbialo y vuelve a enviarlo.». **Es una lista, y así hay que decirlo**: compara
   palabras y frases enteras, sin mayúsculas ni tildes; no entiende el contexto ni las letras cambiadas («h1jo de…») y **no
   lo detecta todo**. Deja pasar a propósito las palabrotas españolas sueltas, que entre compañeros no van contra nadie
   («está de puta madre»). El texto de una denuncia no se filtra (quien denuncia puede tener que citar lo que le han dicho),
   y las fotos no pasan por ningún filtro automático: las mira quien aprueba el anuncio. En `backend/mercadillo.py`:
   `OFENSIVO`, `ofensivo`, `validar` y `mensaje`.
3. **Denunciar** (ya estaba; no cambia). «Denunciar» en cada anuncio ajeno (en la tarjeta de quien vende y en la banderita
   de arriba) y en cada conversación, con motivos (uno es «Es ofensivo o es acoso»). Quien denuncia recibe acuse y, después,
   la decisión en su buzón; con denuncias de 3 personas distintas el anuncio se esconde solo hasta que se revisa. A Dani le
   llega cada denuncia al móvil o por correo (`merc_denunciar`, `DENUNCIAS_PARA_OCULTAR`, `_merc_cerrar_denuncias`,
   `_merc_a_dani`).
4. **Bloquear a una persona** (servidor y web). Desde la ficha de un anuncio ajeno («Bloquear a {nombre}», en la tarjeta de
   quien vende) o desde una conversación; se confirma en «¿Bloquear a {nombre}?» con **«Bloquear»**, y ahí mismo se puede
   marcar «Denunciar también este anuncio». Si A bloquea a B: A deja de ver los anuncios y las conversaciones de B al
   instante; B deja de ver los anuncios de A; ninguno puede escribir al otro. **A B no se le avisa** ni se le dice que es un
   bloqueo, pero puede deducirlo (la conversación le sale cerrada y el anuncio «ya no está»): no se promete otra cosa. Se
   deshace en «Personas bloqueadas» → «Desbloquear» (está siempre en «Mensajes» y, con alguien bloqueado, también al pie de
   la lista de anuncios). Cada bloqueo queda en Negocio → Mercadillo → «Bloqueos» (quién, a quién, cuándo y desde qué
   anuncio o conversación); a Dani le salta al móvil si tiene puestos los avisos del mercadillo, y cuando a la misma persona
   la han bloqueado dos o más le llega el aviso normal (al móvil o, si no, por correo). Un bloqueo no retira ni castiga nada
   por sí solo: decide Dani. Quien modera no bloquea. Topes: 200 personas bloqueadas y 30 bloqueos al día por persona. API:
   `POST /mercadillo/bloquear`, `GET /mercadillo/bloqueados`, `DELETE /mercadillo/bloqueados/{id}`; datos en
   `mercadillo_bloqueos`; constantes en `backend/mercadillo.py`.
5. **Quitarle el mercadillo a quien incumple, y devolvérselo** (servidor y web). En Negocio → Mercadillo, junto a cada
   persona (quien vende cada anuncio, las personas de cada denuncia y a quien han bloqueado) hay un **«Quitar del
   mercadillo»**: se elige el motivo (obligatorio: es lo que se le dice), una nota si hace falta, y «Quitar el acceso». Al
   instante esa cuenta deja de entrar al mercadillo, sus anuncios en revisión o publicados quedan retirados (y se cierran
   las denuncias que tuvieran, avisando a quien denunció) y sus conversaciones abiertas, cerradas. Al entrar solo lee «Te
   hemos quitado el acceso al mercadillo. Motivo: … Si crees que es un error, escribe a contacto@… y lo revisamos.», y se le
   manda lo mismo al móvil o por correo. Abajo, «Sin acceso al mercadillo» dice a quién se le ha quitado, cuándo y por qué,
   y **«Devolver el acceso»** lo deshace (se le avisa; ni vuelven sus anuncios ni se reabren sus conversaciones). En el
   registro de auditoría queda lo justo: que se tomó la decisión, sobre qué cuenta, con qué motivo y cuándo. **Se le quita
   a una cuenta o a una ficha (su clave), no a la persona física**: si vuelve con otra cuenta o le hacen otra ficha, entra,
   y hay que quitárselo otra vez. Pedir la baja de la cuenta o dar de baja a un conductor no borra ni la expulsión ni los
   bloqueos (bastaría reactivarlo para saltárselos): se borran cuando se borran de verdad los datos de la cuenta. API:
   `POST /admin/mercadillo/expulsar` y `POST /admin/mercadillo/readmitir` (solo el super-admin); datos en
   `mercadillo_expulsados`; motivos en `mercadillo.MOTIVOS_EXPULSION`.

Y lo demás:

6. **Normas y textos legales** (es y en). Las normas del mercadillo y los Términos (su apartado «Mercadillo de
   repartidores», que dentro del iPhone es el 5) dicen: que hay que aceptar las normas al entrar; que no se tolera el
   contenido ofensivo ni a los usuarios abusivos; que hay un filtro automático «sencillo» que «no lo detecta todo»; que se
   puede bloquear; que las denuncias las revisa una persona **en 24 horas como mucho**; y que a quien incumple se le quita
   el acceso, se le dice por qué y puede pedir que se revise. La Privacidad cuenta los datos nuevos (a quién bloqueas y
   cuándo, cuándo aceptaste las normas y, si se te quita el acceso, el motivo y la fecha), quién los ve y cuándo se borran.
7. **Lo del iPhone**:
   - «Avisarme en el móvil» ya no sale dentro de la app de iPhone (`AvisosMovil`, `Mercadillo.jsx`): allí no hay avisos y
     el botón solo sabía fallar.
   - La app de iPhone no nombra otras plataformas: las legales no enseñan allí las tres filas de proveedores que solo usa
     la app de Android (`SOLO_ANDROID`, `legal/config.js`), y el vocabulario prohibido de las pruebas del iPhone
     (`frontend/e2e/iphone.js`) lleva la regla «otra plataforma» (Android, Google Play, Play Store).
   - De una página legal, dentro de la app, se vuelve con **«Volver»** («Back») a donde se estaba; antes la única salida
     era el logo, que a un conductor de empresa lo dejaba en el login de oficina.
   - En la ficha del anuncio, «Bloquear a…» y «Denunciar» caben en la primera pantalla también en la más pequeña (375 ×
     647: la app de iPhone abierta en un iPad, que es donde revisó Apple).
   - Los flecos del 09-11: «Datos fiscales: 6 años» no sale en el iPhone; `/prueba-reparto` no existe allí; y
     `register_dsp` exime a `desde_ios` de la prueba con tarjeta.
   - Al pedir la baja de la cuenta, y al borrar un conductor, a alguien de oficina o una empresa, sus anuncios pasan a
     «quitado» y sus conversaciones se cierran (`_merc_baja`).
8. **Este kit**: las respuestas, las notas de revisión y lo pendiente de Dani.

Lo vigilan `backend/tests/test_mercadillo.py` (el servidor) y, simulando también la app de iPhone,
`frontend/e2e/mercadillo-bloqueo.spec.js`, `frontend/e2e/mercadillo-acceso.spec.js` y `frontend/e2e/ios-sin-pagos.spec.js`.

**Lo que Apple exige a una app con contenido de usuarios y dónde se ve cada cosa** (los cinco puntos de su mensaje tipo de
la regla 1.2, más el contacto que pide el texto de la regla; los números son los de la lista de arriba):
- *Aceptar unas condiciones que digan que no se tolera el contenido ofensivo ni a los usuarios abusivos* → punto 1. En la
  app: Cuenta → «Mercadillo de repartidores» → la pantalla de normas con «Acepto las normas». Una de las normas dice «No se
  tolera el contenido ofensivo ni el acoso: quien lo haga se queda sin mercadillo» (`NORMAS`, `Mercadillo.jsx`), y desde
  ahí se abren los Términos, que lo dicen entero («Tolerancia cero», `legal/Terminos.jsx` y `en/TermsEn.jsx`). Además, la
  casilla «Acepto los Términos…» del alta es obligatoria (`Registro.jsx`, `AltaRapida.jsx`).
- *Un filtro del contenido ofensivo* → punto 2. En la app: al publicar, el anuncio queda «En revisión» en «Mis anuncios» y
  nadie más lo ve hasta que Dani lo aprueba (nace `pendiente` en `merc_crear` y solo lo publica `admin_mercadillo_anuncio`;
  corregir uno publicado lo devuelve a revisión, `merc_cambiar`); y un anuncio o un mensaje con un insulto de la lista no
  se envía: sale el aviso en rojo.
- *Poder denunciar* → punto 3. En la app: «Denunciar» junto a «Bloquear a…», y la banderita de arriba, en el anuncio y en
  la conversación.
- *Poder bloquear a un usuario abusivo; el bloqueo quita su contenido al instante y avisa al desarrollador* → punto 4. En
  la app: «Bloquear a …» → «Bloquear»; después, «Personas bloqueadas» → «Desbloquear».
- *Actuar sobre las denuncias en 24 horas, retirando el contenido y expulsando a quien lo puso* → las 24 horas son un
  compromiso de Dani (Pendiente de Dani, 1); las herramientas están en Negocio → Mercadillo: «Retirar el anuncio», «Cerrar
  la conversación», «No incumple» y «Quitar del mercadillo» (punto 5). **Ese panel no está en la app de iPhone** (es de la
  web y solo lo ve el super-admin): el revisor no lo puede ver. Lo que sí se ve en la app es lo que lee quien se queda sin
  acceso: el aviso con el motivo y a dónde escribir.
- *Un contacto publicado.* `contacto@flotadsp.com` en la pestaña Cuenta, en los Términos y en la Privacidad (`marca.js`).

### Pasos para sacarlo si Apple rechaza
El orden es el que funcionó el 09-11, con una diferencia: **esta vez el servidor va antes que el build**, porque lo que el
revisor va a pulsar («Acepto las normas», «Bloquear») depende de él.

0. **Leer el rechazo y la captura del revisor** (Chrome con la sesión de Dani, página del envío; la captura se saca como dice
   la memoria `apple-revision-con-chrome`). Lo que Apple critica casi siempre está en esa captura. Elegir la respuesta de este
   kit que toque; si el motivo no está aquí, no improvisar una.
1. **Poner la fecha de ese día en las normas y en los textos legales** (en la rama, antes de fusionar): `NORMAS_VERSION` en
   `backend/mercadillo.py`, y `lastUpdate` en `Terminos.jsx`, `Privacidad.jsx`, `en/TermsEn.jsx` y `en/PrivacyEn.jsx`
   (`frontend/src/legal/`). Hoy dicen todos `2026-11-10`. Con una versión nueva, las normas se le piden otra vez a todo el
   mundo desde que se despliega (también a las cuentas de prueba de Apple, si alguien las hubiera aceptado con ellas). Las
   pruebas que leen esa fecha se cambian en el mismo commit; las enseña esta orden (la de `NORMAS_VERSION` en
   `test_mercadillo.py` y las de «Última actualización» / «Last updated» en las de `frontend/e2e`):
   `grep -rn --include=*.py --include=*.js "2026-11-10" backend/tests frontend/e2e | grep -v "T[0-9][0-9]:"`
2. **Fusionar `ios/plan-b` en `main`**, con lo de «Antes de dar algo por bueno» de `CLAUDE.md` en verde. OJO: un push a
   `main` que toque `.github/workflows/app-ios.yml`, `frontend/ios/` o `frontend/capacitor.config.json` lanza SOLO un build
   del iPhone; el plan B no los toca. Esto salía vacío el 10-11 y tiene que seguir saliendo vacío:
   `git diff --stat main...ios/plan-b -- .github/workflows/app-ios.yml frontend/ios frontend/capacitor.config.json`
3. **CI de GitHub en verde.**
4. **Con el «sí» de Dani en el chat** (el modo auto bloquea los despliegues y no se rodea): primero el servidor
   (`scripts/deploy-backend.ps1`) y después la web (`scripts/deploy-frontend.ps1`). La app de iPhone habla con la API de
   producción: con un servidor sin lo nuevo no saldría la pantalla de normas y «Bloquear» fallaría delante del revisor. El
   servidor nuevo sirve igual a la app que está en revisión y a las webs en caché (no les exige las normas). Antes de decir
   «sí», Dani tiene que saber que desde ese momento el filtro vale para todos, y que con la web desplegada todo el que
   entre al mercadillo tendrá que aceptar las normas una vez (Pendiente de Dani, 7).
5. **Comprobar en producción antes del build** (diez minutos, con la sesión de Dani) **[COMPROBAR]**:
   - **Con las dos cuentas de prueba de Apple (la de quien reparte y la del conductor) NO se entra al mercadillo** después
     de desplegar. Si alguien pulsa «Acepto las normas» con una de ellas, el revisor ya no verá esa pantalla con esa
     cuenta; el arreglo es cambiar otra vez `NORMAS_VERSION` y volver a desplegar el servidor.
   - Negocio → Mercadillo: está **encendido** y hay al menos **un anuncio publicado que no es de ninguna de esas dos
     cuentas** y al que le quedan más de dos semanas. En un anuncio propio no salen ni «Bloquear a…» ni «Denunciar»: sin
     uno ajeno, el revisor no tiene a quién denunciar ni bloquear, y rechaza otra vez. Mejor que sea de Dani o de otra
     cuenta de pruebas: así lo que el revisor pruebe (escribir, denunciar, bloquear) no le cae a un repartidor de verdad.
     Los anuncios duran 30 días: uno publicado el 17-10 caduca hacia el 16-11; si el único que hay es de entonces, volver a
     publicarlo.
   - Con OTRA cuenta de pruebas, en la web: entrar al mercadillo (salen las normas) → «Acepto las normas» → abrir ese
     anuncio → «Me interesa» con un insulto de la lista (no se envía y sale el aviso) → «Bloquear a …» → «Bloquear» (el
     anuncio desaparece de la lista).
   - En Negocio → Mercadillo → «Bloqueos»: ese bloqueo está apuntado (quién, a quién, cuándo y desde qué anuncio).
   - De vuelta en la cuenta de pruebas: «Personas bloqueadas» → «Desbloquear» (el anuncio vuelve a la lista).
   - «Quitar del mercadillo» no se prueba con un repartidor de verdad (le retira los anuncios y le llega el aviso). Si se
     quiere ver entero, con una cuenta de pruebas que tenga un anuncio: «Quitar del mercadillo» → esa cuenta entra y solo
     lee el motivo → «Devolver el acceso».
   - Negocio → Mercadillo dice si a Dani le llegan los avisos al móvil o por correo.
6. **El build del iPhone**: GitHub → Actions → «App iPhone (App Store)» → Run workflow sobre `main`. Cuándo lo ha procesado
   Apple lo dice `python scripts/app_store_connect.py builds` (el número de build es el de la ejecución del workflow).
7. **`python scripts/app_store_connect.py adjuntar N`**: la versión pasa de REJECTED a PREPARE_FOR_SUBMISSION.
8. **Las notas de revisión** (abajo): `python -I -X utf8 asc_notas_poner.py <fichero> N --seco` y, si cuadra, sin `--seco`
   (el script está en `%LOCALAPPDATA%\Temp\fds-emu`; cambia `BUILD_N` por N, se niega si pasan de 4.000 caracteres y no toca
   la cuenta de prueba). NO usar `app_store_connect.py revision`: pisa las notas largas por las cortas.
9. **Responder** en el envío rechazado («Responder al equipo de revisión de apps», 4.000 caracteres como máximo) con la
   respuesta de este kit, con el número de build en lugar de `BUILD_N` y los huecos `<…>` rellenos. El texto lo ve Dani antes.
10. **«Editar»** en el elemento → **«Actualizar revisión»** (pasa a «Listo para revisión») → **«Volver a enviar a revisión de
    apps»**. El botón de reenviar sale gris hasta hacer lo anterior. Comprobar por la API: WAITING_FOR_REVIEW con el build N.
    Si el envío no deja reenviar (pasó el 03-11): quitar su elemento rechazado y crear uno nuevo por la API (`enviar`).
11. Apuntarlo en `docs/ESTADO.md` y vigilar (`fds-emu/vigilar_apple.py`).

Cuánto tarda (estimado, no medido): del «sí» de Dani al reenvío, entre hora y media y dos horas si todo sale a la primera. Lo
que más pesa es la CI de GitHub, el Mac que compila la app (15-20 minutos) y que Apple procese el build. Lo alarga una CI en
rojo o una avería de GitHub como la del 09-11.

**Si Apple aprueba el build 20**, nada de esto corre prisa: todo sale en la siguiente versión. Entonces hay que subir la
versión (`APP_VERSION` en `app-ios.yml` y `appendUserAgent` en `capacitor.config.json`: tocarlos en `main` ya lanza el
build), crearla en App Store Connect (`python scripts/app_store_connect.py version X.Y.Z`) y mandar las notas de abajo con
ese build; los pasos 1, 4 y 5 valen igual. El servidor y la web se pueden desplegar antes, con el «sí» de Dani: el servidor
nuevo sirve igual a la app vieja (que no enseña ni las normas ni «Bloquear»; el filtro sí le vale, porque es del servidor).

### Respuestas para el Centro de resolución (en inglés, listas para pegar)
Cada párrafo va en una sola línea a propósito (así se pega sin saltos a media frase). `BUILD_N` es el número de build; lo que
va entre `<…>` hay que rellenarlo o quitarlo. Todas caben en los 4.000 caracteres del cuadro de respuesta (medidas el 10-11
con un build de cuatro cifras: de 800 caracteres, la de la 2.3.10, a 3.871, la de la 1.2). Se contesta **solo** a lo que
Apple pregunte: no se pega una respuesta que no han pedido. Si el rechazo vuelve a ser 2.1(b) o 3.1.1, vale la respuesta del
09-11 de más arriba, mirando primero en la captura qué ha visto el revisor.

#### 1.2 Safety - User-Generated Content (el mercadillo)
- **Cuándo:** el rechazo cita la regla 1.2, casi siempre con su lista de cinco precauciones. La respuesta sigue esa lista
  punto por punto y dice dónde se ve cada cosa en la app, con el texto de cada botón y su traducción.
- **Antes de mandarla:** los pasos 1 a 8 hechos (plan B fusionado y desplegado, build adjunto, notas nuevas), el paso 5
  comprobado y el «sí» de Dani a las 24 horas (Pendiente de Dani, 1), porque la respuesta las promete. Aunque Apple solo
  señale alguno de los cinco puntos, se dejan los cinco: es su lista, y así ve que no falta ninguno.
- **Riesgo:**
  - **El filtro es una lista básica de palabras**, y la respuesta lo dice así («a basic list», «does not catch everything»).
    Las fotos no pasan por ningún filtro automático: las ve una persona antes de publicar el anuncio (los mensajes son solo
    texto). Si Apple quiere más que eso, no hay nada hecho.
  - **Las 24 horas son el compromiso de una persona**, no algo que haga el servidor. Lo único automático es que un anuncio
    con denuncias de 3 personas se esconde solo; una conversación denunciada espera a que Dani la mire.
  - **El acceso se le quita a una cuenta** (o a una ficha de conductor), no a la persona: quien vuelva con otra cuenta
    entra, y hay que quitárselo otra vez. Por eso la respuesta dice «account».
  - **A quien se bloquea no se le avisa**, pero puede deducirlo (su conversación sale cerrada y el anuncio «ya no está»). La
    respuesta dice «is not notified», no que no pueda saberlo.
  - **El revisor no puede ver el panel de moderación** (no está en la app de iPhone: es de la web y solo del super-admin).
    Que cada bloqueo queda apuntado, los avisos a Dani y «Quitar del mercadillo» se los tiene que creer. Si pide verlo, hay
    que mandarle capturas o un vídeo del panel de la web, que no están hechos.
  - **La pantalla de normas la pone la app, no el servidor**: una versión vieja de la app no la enseña. La respuesta habla
    del build nuevo. Y si alguien aceptó las normas con la cuenta de prueba, el revisor no la verá (paso 5).
  - El aviso a Dani de un bloqueo suelto llega al móvil solo si tiene puestos los avisos del mercadillo; por correo llega
    desde el segundo bloqueo a la misma persona. Por eso la respuesta dice lo que es verdad en los dos casos: que cada
    bloqueo queda apuntado al momento en el panel, y que hay aviso con dos o más.
  - «Is notified by push notification or e-mail» (las denuncias) es verdad si en producción está puesto `CORREO_CONTACTO` o
    Dani tiene los avisos en el móvil **[COMPROBAR]**; si no, la denuncia solo queda en el panel.
  - El mercadillo está solo en español: el revisor puede no leerlo. La respuesta y las notas le dan el texto exacto de cada
    botón con su traducción.

```
Hello, and thank you for the review.

Guideline 1.2 – Safety – User-Generated Content

The only user-generated content in the app is the optional couriers' marketplace ("Mercadillo de repartidores", in the Account tab): classified ads for second-hand items between couriers, and private one-to-one text messages about each ad. Its screens are in Spanish, so the button labels are quoted below with a translation. The new binary of version 2.4.1 (build BUILD_N) has the five precautions:

1. Agreeing to terms. The first time a user opens the marketplace, the app shows its rules and the user cannot continue without tapping "Acepto las normas" (I accept the rules). We record who accepted, which version and when, and the rules are shown again if they change. They state that objectionable content and harassment are not tolerated ("No se tolera el contenido ofensivo ni el acoso") and that whoever does it loses access to the marketplace, and they link to the Terms, whose section 5 says so in full. They can be read again at any time under "Normas y seguridad" (Rules and safety). In addition, creating an account in the app requires ticking the "Acepto los Términos…" (I accept the Terms) box.

2. Filtering. A person reviews every ad (text and photos) before it is published; until then no other user sees it, and an edited ad goes back to review. Messages are text only. In addition, an automatic word filter refuses to send any ad or message that contains an insult, slur or threat from a basic list of Spanish and English words and phrases, and asks the user to change the text. It is a simple list and does not catch everything; reporting and blocking are there for the rest. An ad reported by three different users is hidden until we review it.

3. Reporting. Every ad from another user, and every conversation, has a "Denunciar" (Report) button with a list of reasons, one of them "Es ofensivo o es acoso" (It is offensive or it is harassment). The user receives an acknowledgement and, afterwards, our decision in the marketplace inbox.

4. Blocking. Every ad from another user (on the seller card), and every conversation, has a "Bloquear a …" (Block …) button, confirmed with "Bloquear" (Block). From that moment that user's ads and conversations are gone from the blocker's marketplace, neither of the two can see the other's ads or send the other a message, and the blocked user is not notified. The confirmation also offers "Denunciar también este anuncio" (Also report this ad). Every block is recorded at once in our moderation panel (who blocked whom, when, and from which ad or conversation), and the moderator is alerted when two or more users have blocked the same person. Blocks are listed and undone in "Personas bloqueadas" (Blocked people) → "Desbloquear" (Unblock).

5. Acting on reports within 24 hours. Every report appears in our moderation panel and the moderator, a person, is notified by push notification or e-mail. Our commitment, stated in the rules and in the Terms, is to review it within 24 hours. When a report of objectionable content or abuse is upheld, we remove the content (the ad is withdrawn or the conversation closed) and we remove the offending account's access to the marketplace ("Quitar del mercadillo", in our web moderation panel): that account can no longer open the marketplace, its ads are withdrawn and its conversations closed, and on opening it the user sees the reason and where to write to ask for a review.

Contact: contacto@flotadsp.com, published in the Account tab, the Terms and the Privacy Policy.

To check it with the demo account: Cuenta (Account) → "Mercadillo de repartidores" → "Acepto las normas" → open an ad → "Bloquear a …" → "Bloquear": the ad is no longer listed. To undo it: "Personas bloqueadas" (at the bottom of the list of ads, and in Mensajes) → "Desbloquear".

Thank you for your time.
```
Lo respalda, punto por punto (todo con el plan B fusionado, menos la casilla del alta y «Denunciar», que ya están):
- **1:** `Mercadillo.jsx` (`Normas`, `NORMAS` y, en `Mercadillo`, la guarda de `normas_ok === false`); `backend/server.py`
  (`merc_normas`, `_merc_normas_ok`, `merc_estado`, `merc_lista`) y `NORMAS_VERSION` (`backend/mercadillo.py`);
  `legal/Terminos.jsx` y `en/TermsEn.jsx` («Aceptar las normas» y «Tolerancia cero»; el apartado es el 5 dentro del iPhone);
  `Registro.jsx` y `AltaRapida.jsx` (la casilla del alta).
- **2:** `merc_crear` (el anuncio nace `pendiente`), `merc_lista` (solo sale lo `publicado`), `merc_cambiar` y
  `admin_mercadillo_anuncio`; `OFENSIVO`, `ofensivo`, `validar` y `mensaje` (`backend/mercadillo.py`; pasan por ellas
  `merc_crear`, `merc_cambiar`, `merc_contactar` y `merc_responder`); `DENUNCIAS_PARA_OCULTAR` en `merc_denunciar`.
- **3:** `Ficha`, `Chat`, `Acciones` y `Denunciar` (`Mercadillo.jsx`); `MOTIVOS_DENUNCIA`; `merc_denunciar` (el acuse) y
  `_merc_cerrar_denuncias` (la decisión).
- **4:** `Bloquear`, `Bloqueados` y `EntradaBloqueados` (`Mercadillo.jsx`); `merc_bloquear`, `_merc_bloqueos`, `merc_lista`,
  `merc_buzon`, `_merc_escribirle`, `merc_desbloquear` y `_merc_bloqueo_a_dani`; `admin_mercadillo` y «Bloqueos» en
  `MercadilloAdmin` (`Negocio.jsx`).
- **5:** `_merc_a_dani` (el aviso de cada denuncia); `admin_mercadillo_denuncia` (retirar el anuncio o cerrar la
  conversación); `admin_mercadillo_expulsar`, `_merc_expulsar_efectos`, `_merc_dentro` y `_merc_texto_expulsion`;
  `QuitarDelMercadillo` (`Negocio.jsx`) y `SinAcceso` (`Mercadillo.jsx`). Las 24 horas las dicen `NORMAS` y los Términos
  («Denunciar»); cumplirlas es cosa de Dani.

#### 2.3.10 Accurate Metadata (menciones a otras plataformas)
- **Cuándo:** el rechazo dice que la app o su ficha nombran otra plataforma móvil u otra tienda (Android, Google Play).
  Mirar en la captura DÓNDE lo ha visto: puede ser una pantalla que no sea de las legales.
- **Antes de mandarla:** el plan B fusionado y el build nuevo adjunto. Si el revisor señala otra pantalla, arreglarla
  primero (con `esAppIOS()`, como las demás) y nombrarla en el hueco. `frontend/e2e/ios-sin-pagos.spec.js` es el juez de lo
  que se ve en el iPhone.
- **Riesgo:** bajo. La ficha no nombra otra plataforma: comprobados el 10-11 los textos de los 7 idiomas de
  `frontend/ios/listing/` (ni «Android», ni «Google Play») y las 12 capturas del repositorio (es-ES y en-US). Sí aparecen
  «Google Maps» y «WhatsApp» en botones: son apps, no plataformas ni tiendas, pero si el revisor las señala no se discute:
  se cambia la captura. **[COMPROBAR]** que las capturas subidas a App Store Connect son las del repositorio.

```
Hello, and thank you for the review.

Guideline 2.3.10 – Performance – Accurate Metadata

We have removed the references to other mobile platforms from the iOS app in the new binary of version 2.4.1 (build BUILD_N):

- Legal pages (Privacy Policy, Data Processing Agreement and Security): the lists of service providers no longer show the three entries that described data processing carried out only by our app for another platform. The iOS app does not use those services, so on iOS they are not listed.
<- IF THE REVIEWER POINTED AT ANOTHER SCREEN: name it here and say that the reference has been removed.>

The App Store metadata (name, subtitle, description, keywords, promotional text and screenshots) contains no reference to other mobile platforms or app marketplaces.

Thank you for your time.
```
Lo respalda: `frontend/src/legal/config.js` (las tres filas, que dentro del iPhone no se enseñan: con el plan B fusionado);
la web que lleva dentro la app no usa esos tres servicios (sus mapas son teselas de OpenStreetMap y no lleva Firebase:
comprobado en `frontend/src`); `frontend/ios/listing/`.

#### 2.1 Information Needed (el cuestionario sobre el modelo de negocio)
- **Cuándo:** Apple no rechaza por un fallo: pide información («We need more information about your business model and your
  users») con una lista de preguntas. Dejar solo las que hagan, con su misma numeración.
- **Antes de mandarla:** nada de código, pero **sí la decisión de Dani sobre el tope** (Pendiente de Dani, 2): las preguntas
  5 y 6 son justo las de los pagos, y lo que se conteste ahí es lo que Apple usará para decidir si exige su compra dentro de
  la app. Rellenar el hueco de la pregunta 2 con lo que sea verdad ese día.
- **Riesgo:** alto en las preguntas 5 y 6 (es la regla 3.1.3(b), ver la respuesta siguiente); bajo en el resto.
  - La pregunta 2: un comentario del código del 03-11 dice que todas las cuentas de empresa son de Dani (`legal/config.js`).
    **[COMPROBAR]** que sigue siendo así el día que se conteste; si ya hay empresas de fuera, quitar esa frase.
  - Las fechas y las cifras de la 5 salen del código (`REP_GRATIS_HASTA` = 2026-12-31, `REP_GRATIS_PARADAS_DIA` = 15, 7 días
    de prueba en `PLAN_TARIFAS`) y de los Términos de la web. **[COMPROBAR]** que producción no las cambia con variables de
    entorno (`REP_GRATIS_HASTA`, `REP_GRATIS_PARADAS`) y que el cobro en la app de Android está encendido
    (`PLAY_COBRO_ACTIVO`); si no lo está, quitar «and in our Android app».
  - La pregunta 8: el micrófono está pedido en `Info.plist` para dictar y para el manos libres, pero no se ha visto en un
    iPhone si esos botones salen. **[COMPROBAR]** (abajo, «Lo que no se ha podido comprobar»).

```
Hello, and thank you for the review. Here is the information requested.

1. Who uses the app? Self-employed parcel couriers (the main audience) and the drivers and office staff of small delivery companies. A courier uses it to scan parcel labels, order the day's route, navigate stop by stop and record proof of delivery; a company driver uses it for the same route and for the daily vehicle inspection.

2. Is it restricted to one company or to a specific group of companies? No. Any self-employed courier can create an account in the app, and any delivery company can become a customer by signing up on our website. <At present the company features are used by our own delivery fleets.>

3. Which features are for the general public? The whole courier app (route planning, label scanning, navigation, proof of delivery, earnings and the optional marketplace) is available to anyone who creates an account in the app. The company panel and the driver portal need an account issued by a company.

4. How do users obtain an account? Couriers: in the app, "Crear mi cuenta" (name, e-mail, password, accepting the Terms). Company drivers: their company registers them with their e-mail address in the company's panel, and they sign in with that e-mail (a one-time code sent by e-mail, or a password). Companies: on our website.

5. Is there paid content, and who pays for it? Nothing is sold in the iOS app: it has no in-app purchases, shows no plans or subscription prices and redeems no codes. Outside the iOS app there are two paid services. (a) Companies pay a monthly fee per vehicle or per courier, contracted by the company on our website; their drivers and office staff pay nothing and sign in with the access their company gives them. (b) For self-employed couriers there is a paid plan on our website and in our Android app. Until 31 December 2026 no courier account has any limit, so nobody needs that plan. From 1 January 2027, accounts without it will be limited to 15 new stops per day once their first 7 days have passed; the plan removes that limit.

6. Where are those services purchased, and can they be used in the app? They are purchased only outside the iOS app (see 5). Accounts are the same on every platform: a company's users, and a courier who holds the paid plan, sign in to the iOS app with their usual credentials. The iOS app offers no way to buy, and no link or instruction to buy elsewhere.

7. Which external services does the app use? Our own API (flota-backend.fly.dev, hosted by Fly.io in Paris); OpenStreetMap map tiles; Photon, Nominatim and the Spanish CartoCiudad service for geocoding; OSRM for driving times and directions; Google Gemini, on our server, to read photographed delivery sheets; e-mail providers for account messages. Barcode reading and label OCR run on the device. There are no advertising SDKs, tracking pixels or third-party analytics in the iOS app. If the user chooses to, a stop can be opened in an external maps app and the customer contacted by phone or WhatsApp.

8. Which hardware does the app use? Only the iPhone itself: the camera (scanning labels, photographing delivery sheets, proof-of-delivery photos), location while the app is in use (ordering the route from the current position, the map and turn-by-turn guidance) and the speaker (voice guidance). The microphone is requested only if the user turns on dictation or hands-free commands, where the device offers them. No external hardware or accessories are needed.

Thank you for your time.
```
Lo respalda: `Registro.jsx` (en el iPhone solo se crea la cuenta de quien reparte); `DriverLogin.jsx` y `/auth/driver-lookup`,
`/auth/driver-code/verify`, `/auth/driver-login` (el acceso del conductor); `backend/server.py` (`PLAN_TARIFAS`,
`REP_GRATIS_HASTA`, `REP_GRATIS_PARADAS_DIA`, `_rep_sin_ilimitado`, `_rep_quedan_gratis`); `lib/plataforma.js` (`sinPagos`);
`legal/config.js` (los proveedores); `backend/fly.toml` (`cdg`, París); `lib/codigos.js` y `lib/ocrRuta.js` (lectura en el
móvil); `Info.plist` (permisos: cámara, fotos, ubicación mientras se usa, micrófono); `package.json` (solo los plugins
`app`, `splash-screen` y `status-bar` de Capacitor: ningún accesorio ni Bluetooth).

#### 3.1.3(b) Multiplatform Services (y 3.1.1 otra vez): el plan que se vende fuera
- **Cuándo:** Apple dice que la app da acceso a algo comprado fuera sin ofrecerlo como compra dentro de la app, o pregunta
  directamente por el plan de pago.
- **Antes de mandarla:** **que Dani haya elegido salida** (Pendiente de Dani, 2). La parte fija cuenta lo que hay hoy y vale
  siempre; el párrafo de cierre depende de lo que se haya hecho, y solo se pega el que sea verdad ESE día.
- **Riesgo:** el más alto del kit. La regla dice que una app multiplataforma puede dar acceso a lo comprado en otra parte
  **siempre que eso mismo se pueda comprar también dentro de la app con el pago de Apple**. Con el tope de 15 paradas en
  marcha (desde el 01-01-2027) y sin compra en la app, la respuesta sincera es justo el caso que la regla no permite: lo más
  probable es que Apple pida su compra dentro de la app o rechace. Para las empresas el argumento es mejor: sus planes se
  venden a la empresa para sus empleados (3.1.3(c), «Enterprise Services»), y eso Apple lo permite sin su pago.
  **[COMPROBAR]** las mismas cifras y variables que en la respuesta anterior.

```
Hello, and thank you for the review.

Guideline 3.1.3(b) – Multiplatform Services

FDS is a multiplatform service: the same account works in the iOS app, on our website and in our Android app.

What is sold, and where. Nothing is sold in the iOS app: it has no in-app purchases, shows no plans or subscription prices, redeems no codes and contains no link or call to action to buy anywhere else. Outside the iOS app there are two paid services: (a) delivery companies contract a per-vehicle subscription for their staff directly with us on our website (an enterprise service, Guideline 3.1.3(c)); (b) a paid plan for self-employed couriers is offered on our website and in our Android app.

What the courier plan does. Until 31 December 2026 every courier account is unlimited at no charge, so the plan gives nothing that a free account lacks. From 1 January 2027, accounts without the plan will be limited to 15 new stops per day once their first 7 days have passed; the plan removes that limit.

<ONE CLOSING PARAGRAPH, ONLY IF IT IS TRUE THAT DAY — SEE BELOW>

Thank you for your time.
```
Los cierres (uno, y solo si ya es verdad):
- **Salida A hecha** (el servidor ya no aplica el tope a quien usa la app de iPhone, desplegado y probado):
  `In the iOS app that limit does not apply: every account has the full functionality there, with or without the plan, so nothing acquired elsewhere is unlocked in the iOS app.`
- **Salida B hecha** (la compra de Apple está en la app y sus productos van enviados con el build):
  `The same plan is available in the iOS app as an auto-renewable subscription through In-App Purchase (products <IDS>, submitted for review with this build), as Guideline 3.1.3(b) requires.`
- **Salida D hecha** (el tope aplazado en el servidor, en la web y en los Términos) **y** con el compromiso de Dani:
  `We have postponed that limit to <DATE>, and it will not be applied to accounts used in the iOS app until the plan is also available there through In-App Purchase.`
- **Salida C** (no se cambia nada): no hay cierre que valga. La parte fija es la verdad y Apple decidirá con ella.

Lo respalda: `backend/server.py` (`REP_GRATIS_HASTA`, `REP_GRATIS_PARADAS_DIA`, `_rep_sin_ilimitado`, `_rep_quedan_gratis`,
`REP_TOPE_MENSAJE`, `PLAN_TARIFAS`); los Términos de la web (sección 5, que en el iPhone no se enseña); `lib/plataforma.js`
(`sinPagos`, `HABLA_DE_PAGOS`) y `frontend/e2e/ios-sin-pagos.spec.js`. Ninguno de los tres cierres está respaldado hoy.

#### 4.2 Minimum Functionality («es una web»)
- **Cuándo:** el rechazo dice que la app es una web empaquetada o que no aporta lo bastante como app.
- **Antes de mandarla:** nada de código. Conviene que alguien con iPhone haya probado la guía con voz y una entrega sin
  cobertura con ESE build (el vídeo del 03-11 solo enseña el escáner, la foto, la firma, el alta y borrar la cuenta).
- **Riesgo:** medio. Todo lo que dice está en el código, pero la app está hecha con Capacitor (la web compilada dentro de la
  app) y eso el revisor lo nota: la respuesta no dice que sea «nativa», dice lo que hace. De lo que cuenta, en un iPhone de
  verdad solo se ha visto la cámara (el vídeo); la guía con voz, la ubicación y lo de sin cobertura, **[COMPROBAR]**. No
  menciona el manos libres por voz: en el iPhone no está comprobado que exista.

```
Hello, and thank you for the review.

Guideline 4.2 – Design – Minimum Functionality

FDS for iPhone does not load a website. Its whole interface is packaged inside the binary and runs locally, and our server is used only as a data API. It is a working tool that a courier uses on the street all day, and it relies on the device:

- Camera. It scans the barcode of each parcel label in real time and reads the address printed on the label with on-device OCR, so the stop is added without typing; it photographs paper delivery sheets, and it takes the proof-of-delivery photo. Parts 2 and 3 of the screen recording attached to the App Review Information show this on a physical iPhone.
- Location. It orders the route from where the courier is, shows the courier and the stops on the map, gives turn-by-turn guidance to each stop with the next manoeuvre on screen and spoken aloud, and recalculates when the courier leaves the route. Location is used only while the app is in use.
- Offline. Without coverage, a stop marked as delivered or not delivered is stored on the phone, shown as done at once and sent automatically when the connection returns. The day's route is kept on the phone and shown immediately when the app is opened.
- Proof of delivery: photo, signature drawn on the screen, who received the parcel and cash on delivery.
- One-tap call or message to the customer of each stop, and a tracking link that the courier can send to the customer.

To see it with the demo account: log in, tap "Ver un ejemplo" (See an example) to load sample stops, scan any parcel label with the camera, order the route, open a stop and mark it delivered with a photo.

Thank you for your time.
```
Lo respalda: `frontend/capacitor.config.json` (`webDir: dist`, sin `server.url`: la web va DENTRO de la app) y `app-ios.yml`
(`npm run build` + `cap sync`); `lib/codigos.js` (lector de códigos en el móvil), `lib/ocrRuta.js` y Tesseract (texto de la
etiqueta, en el móvil); `pages/driver/Navegacion.jsx` (la guía: maniobra en grande y en voz alta con `lib/voz.js`, recalcula
al salirse); `pages/driver/MiRuta.jsx` (`COLA` = lo guardado sin cobertura, `COPIA_RUTA` = la última ruta en el móvil);
`Info.plist` (ubicación solo «mientras se usa»).

#### 5.1.1(v) Account Sign-In (borrar la cuenta)
- **Cuándo:** Apple dice que no encuentra cómo borrar la cuenta, o que desactivarla no basta.
- **Antes de mandarla:** con el plan B fusionado y desplegado, la frase de los anuncios del mercadillo es verdad (hoy, al
  borrar la cuenta, sus anuncios siguen publicados hasta que caducan: quitar esa frase si el plan B no está). Y que Dani esté
  borrando de verdad los datos de quien lo pide (Pendiente de Dani, 4).
- **Riesgo:**
  - El servidor **no borra nada él solo**: desactiva la cuenta al momento, apunta la petición (`bajas_cuentas`) y avisa por
    correo; los datos los borra Dani a mano. «En 30 días» es verdad solo si él lo hace.
  - Apple pide además **confirmar al usuario cuando el borrado termina**. Hoy no se manda nada: la respuesta no lo promete.
  - La cuenta del conductor de empresa no se puede borrar desde su portal (la crea y la quita su empresa en Panel →
    Conductores) y la de empresa se da de baja escribiendo. Apple lo exige a las cuentas que se crean en la app, y en la del
    iPhone solo se crea la del repartidor; si el revisor prueba con la cuenta de conductor y lo pide igual, haría falta un
    «Pedir que borren mi acceso» en el portal, que no existe.

```
Hello, and thank you for the review.

Guideline 5.1.1(v) – Account deletion

Accounts created in the app can be deleted in the app. The only accounts that can be created in the iOS app are those of self-employed couriers, and they are deleted from Cuenta (Account tab) → "Borrar mi cuenta" (Delete my account), at the bottom of the screen → enter the account password → "Sí, borrar mi cuenta" (Yes, delete my account). The screen states what happens: sign-in stops working immediately and the account's data (stops, customers, history) is erased within 30 days at most, and it cannot be undone. The account is disabled at once only so that nobody can use it while its data is being erased. <The user's marketplace ads are withdrawn and their conversations closed at the same moment.>

Company accounts cannot be created in the iOS app. A company's drivers sign in with access created by their employer; the employer, as the controller of its staff's data, deletes a driver's access from its own panel, and drivers can also write to contacto@flotadsp.com.

Part 4 of the screen recording attached to the App Review Information shows the deletion flow.

Thank you for your time.
```
Lo respalda: `RutaCuenta.jsx` (`BorrarMiCuenta`, al final de la pestaña) y sus textos en inglés (`lib/textosRutaB.js`);
`backend/server.py`, `borrar_cuenta` (`/auth/borrar-cuenta`: pide la contraseña, desactiva al momento, solo cuentas de quien
reparte); `Registro.jsx` (en el iPhone el alta es siempre la de quien reparte); `delete_driver_account`
(`/auth/driver-account/{id}`, lo que usa Panel → Conductores); la frase entre `<…>`, con el plan B fusionado.

### Las notas de revisión con el bloqueo (el punto 6 nuevo)
Las notas que tiene Apple desde el 09-11 dicen en su punto 6 que el mercadillo tiene revisión previa, «Denunciar», ocultación
con 3 avisos, mensajes privados, términos y contacto; de bloquear no pueden decir nada. Estas son las notas enteras para
cuando el bloqueo esté en la app (con el plan B fusionado). **El párrafo nuevo es el punto 6**; lo demás que cambia está en
la lista de debajo. `BUILD_N` es la marca del número de build.

```
FDS – information for App Review (build BUILD_N).

0. CHANGES IN THIS BUILD (Guideline 1.2): users can block other users in the marketplace, and its rules and the Terms now state zero tolerance for objectionable content and a 24-hour review of reports (point 6). Unchanged: the iOS app has no in-app purchases; it sells nothing, shows no plans or subscription prices and redeems no codes.

1. SCREEN RECORDING: attached (FDS-iPhone-demo.mp4, 2 min 37 s, no audio), captured on a physical iPhone with an earlier build (16) from TestFlight; its Account and registration screens (parts 4 and 5) are simpler now and show no plan, price, code or bonus. English captions: (1) launch and log in; (2) scanning two parcel labels with the camera and reading a photographed label to add each stop; (3) proof of delivery with signature and photo, and a stop marked as not delivered; (4) account deletion; (5) registration. Route ordering and the marketplace are not in it: see points 3 and 6.

2. PURPOSE AND AUDIENCE: FDS is a delivery-route app for self-employed parcel couriers (and the drivers of small delivery companies) in Spain, Portugal and Latin America. The courier scans the parcel labels with the camera or photographs the paper delivery sheet; the app geocodes the addresses, orders the stops by time windows and driving time, guides stop by stop with voice guidance, records proof of delivery (photo, signature, cash on delivery) and shows the day's earnings.

3. HOW TO ACCESS THE MAIN FEATURES:
- With the test account entered above (username and password): log in, then on the route screen tap "Ver un ejemplo" (See an example) to load sample stops, scan any parcel label with the camera, or add a stop by hand; order the route; open a stop and mark it delivered with a photo.
- Registration: the sign-in screen (after Cuenta → "Cerrar sesión") has "¿No tienes cuenta? Crear mi cuenta" ("No account? Create my account"): name, e-mail, password. The test account is enough; a new one is not needed.
- Account deletion: Cuenta → "Borrar mi cuenta" (asks for the password; the account is disabled immediately and its data erased within 30 days).

4. EXTERNAL SERVICES: our own API (flota-backend.fly.dev, Fly.io, Paris); OpenStreetMap, Photon, Nominatim and CartoCiudad (geocoding, map tiles); OSRM (driving times); barcode reading and OCR run on the device; Google Gemini on our server reads photographed delivery sheets. No advertising SDKs, tracking pixels or third-party analytics in the iOS app.

5. REGIONAL DIFFERENCES: none (only the earnings currency and the road-works feed, Spain: DGT, follow the route's country).

6. USER-GENERATED CONTENT (Guideline 1.2): the only user-generated content is the optional "Mercadillo de repartidores" card in the Account tab (in Spanish): classified ads between couriers for second-hand goods and van equipment (physical items; the app handles no payment for them) and private one-to-one text messages about each ad. Precautions:
- Terms: accepted at registration (by the courier, or by the company for its drivers); they and the rules ("Normas y seguridad") state zero tolerance for objectionable content and abusive users.
- Filter: we review every ad (text and photos) before it is published; an ad reported by 3 people is hidden until we review it.
- Report: flag button ("Denunciar") on every ad and conversation; we answer the reporter.
- Block: open an ad → "Bloquear a …" on the seller card (also in every conversation): that user's ads and conversations leave the blocker's marketplace at once, neither can message the other, and it is reported to us. Undo: Mensajes → "Personas bloqueadas".
- We review reports within 24 hours and remove the content and the offender's access.
- Contact: contacto@flotadsp.com (Account tab, Terms).
No other public content: a courier's stops are visible only to that courier (and to their own company for company drivers). Not a regulated industry.
```

El mismo texto está en `C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/notas-revision-planb.txt`
(junto a `notas-revision-nuevas.txt`, las actuales, que no se han tocado). Esa carpeta es de la sesión del 10-11 y puede no
durar: lo que vale es el bloque de arriba, que sirve tal cual para `asc_notas_poner.py` (paso 7) guardado en un fichero UTF-8.

Lo que cambia respecto a las actuales, además del punto 6:
- La cabecera pierde la fecha y el resumen en español (hacía falta el sitio; el número de build ya dice de cuándo son).
- El punto 0 pasa a contar lo nuevo de este build (bloqueo, tolerancia cero y 24 horas) y deja en una frase lo de los pagos:
  «the iOS app has no in-app purchases; it sells nothing, shows no plans or subscription prices and redeems no codes». Está
  escrito para un rechazo por la regla 1.2: **si el rechazo es por otra, el punto 0 se reescribe** para esa regla.
- Ya no dice «nothing is sold, unlocked or redeemed inside the iOS app». «Unlocked» era verdad el 09-11 y lo sigue siendo hoy
  (nadie tiene tope), pero dejará de ser exacto el 01-01-2027: quien pague el plan fuera no tendrá tope tampoco en el iPhone
  (Pendiente de Dani, 2).
- El punto 1 dice que el mercadillo no sale en el vídeo y manda al punto 6.
- El punto 2 dice «with voice guidance» (como la ficha de la tienda) en vez de «hands-free voice»: el manos libres por voz no
  está comprobado en el iPhone.
- El punto 3 pierde la línea de «no hay compras» (ahora está en el punto 0). Los puntos 4 y 5 no cambian.

**La cuenta de caracteres**, como la hace `asc_notas_poner.py` (`strip()` y `BUILD_N` por el número de build). Esta orden da
los caracteres y los bytes; el 10-11 dio `3935 3949`:

```
python -I -X utf8 -c "import sys; t=open(sys.argv[1],encoding='utf-8').read().strip().replace('BUILD_N',sys.argv[2]); print(len(t), len(t.encode('utf-8')))" notas-revision-planb.txt 21
```

| Fichero | Build | Caracteres | Bytes UTF-8 | Margen hasta 4.000 |
| --- | --- | --- | --- | --- |
| `notas-revision-planb.txt` (la propuesta) | 21 | 3.935 | 3.949 | 65 caracteres |
| `notas-revision-planb.txt` | 9999 | 3.937 | 3.951 | 63 caracteres |
| `notas-revision-nuevas.txt` (las actuales) | 20 | 3.911 | 3.923 | 89 caracteres |

Quedan 63 caracteres libres: cualquier frase que se añada obliga a quitar otra. `asc_notas_poner.py` se niega a
escribir si se pasan de 4.000.

### Pendiente de Dani (de este plan B)
Tres decisiones que son suyas. Aquí va lo que hay, sin decidir por él.

**1. Revisar las denuncias del mercadillo en 24 horas (es él quien modera).**
Con el plan B, la propia app (las normas del mercadillo y los Términos) dirá «Lo revisamos en 24 horas como mucho», y a Apple
se le dice lo mismo. Es un compromiso de todos los días, también fines de semana y vacaciones: cuando llega una denuncia (al
móvil si tiene puestos los avisos del mercadillo; si no, por correo al buzón de contacto), entrar en Negocio → Mercadillo y
resolverla: retirar el anuncio, cerrar la conversación o «no incumple». Hay una red para los anuncios (con denuncias de 3
personas distintas el anuncio se esconde solo hasta que lo mire), pero no para las conversaciones. Si no quiere atarse a eso,
las otras salidas son dar a otra persona su mismo acceso de dueño (hoy solo modera el super-admin) o apagar el mercadillo en
Negocio → Mercadillo (se apaga para todos, también en la web): sin mercadillo la app no tiene contenido de usuarios y la
regla 1.2 no aplica. Sin su «sí» a las 24 horas no se puede mandar la respuesta de la regla 1.2 ni las notas de arriba.

**2. El tope de 15 paradas al día, que desde el 01-01-2027 alcanza también al iPhone.** Tal cual está en el servidor:
- Hoy nadie tiene tope: la promoción dura hasta el 31-12-2026 incluido (`REP_GRATIS_HASTA`; lo dicen también la web y los
  Términos). Mientras dura, la pestaña Cuenta de la web ni siquiera enseña «Suscribirte» a quien reparte.
- Desde el 01-01-2027, a cada cuenta de repartidor sin suscripción, pasados sus 7 primeros días, el servidor le pone un tope
  de 15 paradas nuevas al día (`REP_GRATIS_PARADAS_DIA`). También a quien use el iPhone: el servidor mira la cuenta, no el
  aparato.
- En el iPhone, al añadir la parada 16 saldrá «No se ha podido completar. Inténtalo de nuevo más tarde.», sin decir por qué
  ni cómo seguir, porque allí no se puede hablar de planes.
- Quien pague el plan en la web o en Android (9,99 € al mes o 99 € al año) no tendrá tope tampoco en el iPhone.
- **El riesgo (regla 3.1.3(b)):** eso es dar acceso en el iPhone a algo comprado fuera, y Apple solo lo permite si lo mismo se
  puede comprar también dentro de la app con su sistema de pago. Puede rechazar la app, o retirarla más adelante, cuando lo
  vea o cuando se lo contemos; y si lo pregunta, hay que contárselo. Además, un revisor que llegue a la parada 16 verá un
  error sin explicación y puede tomarlo por un fallo (regla 2.1): la cuenta de prueba de Apple es del 30-10, así que desde
  el 01-01-2027 tendrá el tope como cualquiera si no tiene un regalo o una suscripción **[COMPROBAR]**.
- **Las salidas:**
  - **A. Que el tope no se aplique en la app de iPhone.** Allí todo el mundo tendría la app entera; la respuesta a Apple queda
    limpia («en el iPhone nada depende de una compra»). Cuesta que quien no quiera pagar puede repartir desde un iPhone, y un
    cambio en el servidor que no está hecho (quitarlo solo a las cuentas creadas en el iPhone, `alta_ios`, no basta: una
    cuenta creada en la web y usada en el iPhone seguiría con tope).
  - **B. Vender el plan también en el iPhone con la compra de Apple** (el punto 3). Es lo que la regla pide.
  - **C. Dejarlo como está.** No cuesta nada ahora y es la que más riesgo tiene: lo de arriba.
  - **D. Aplazar el tope** (la fecha está en el servidor, en la web, en los Términos y en los anuncios: hay que cambiarla en
    todos). Da tiempo para hacer A o B; no arregla nada por sí sola.
- Hay que decidirlo antes del 01-01-2027, y antes si Apple pregunta por los pagos.

**3. Cobrar en el iPhone con el sistema de Apple.**
Hoy la app de iPhone no lleva nada para cobrar: ni productos creados en App Store Connect (según `docs/ESTADO.md`, mirado
por la API el 09-11: ninguna compra y ningún grupo de suscripción), ni el componente de compras (`package.json` solo lleva
los de arranque y barra de estado). Hacerlo supone: firmar con Apple el acuerdo de apps de pago y dar los datos fiscales y
bancarios (lo hace Dani en App Store Connect); crear la suscripción mensual y la anual; meter la compra en la app y que el
servidor la dé por buena y la renueve o la corte; «restaurar compras»; avisar al borrar la cuenta de que la suscripción se
cancela aparte; y enviar los productos a revisión CON el build. Apple se queda entre el 15 % y el 30 % de cada cobro. A
cambio, la app de iPhone podría enseñar el plan (hoy no puede decir ni una palabra) y la regla 3.1.3(b) quedaría cumplida.
No es un trabajo de horas: son varios días de trabajo y otra revisión de Apple, con sus idas y vueltas.

Y tres cosas más que han salido al repasar el código para escribir esto (no estaban en la lista, pero van en lo que se le
dice a Apple):

**4. Los datos de quien borra su cuenta los borra Dani, a mano.** «Borrar mi cuenta» desactiva la cuenta al momento y manda
un correo al buzón de contacto; el servidor no borra nada por su cuenta ni enseña la lista en ninguna pantalla (queda en
`bajas_cuentas`). La app promete «en 30 días como mucho», y Apple pide además avisar al usuario cuando está hecho: hoy ese
aviso no existe.

**5. No hay forma de echar a una persona del mercadillo desde el panel.** Las normas dirán «quien lo haga se queda sin
mercadillo» y Apple pide expulsar a quien publica contenido ofensivo. Hoy Dani puede retirar un anuncio y cerrar una
conversación; para quitarle el mercadillo a una persona hay que tocar la base a mano, y a un conductor de empresa no se le
puede quitar sin apagárselo a toda su empresa. Falta un «Quitar el mercadillo a esta persona» en Negocio → Mercadillo.

**6. Que el revisor tenga algo que bloquear.** El día que se reenvíe tiene que haber un anuncio publicado que no sea de la
cuenta de prueba (paso 4). Los anuncios caducan a los 30 días.

### Con lo que el revisor puede tropezar y este plan B no arregla
Visto en el código el 10-11; ninguna de estas cosas está en la especificación del plan B.
- **«Avisarme en el móvil» dentro del mercadillo** (`AvisosMovil`, `Mercadillo.jsx`): sale también en la app de iPhone (en
  «Mensajes» y tras escribir a alguien o publicar) y allí no puede funcionar: la app no tiene avisos. Al pulsarlo contesta
  «Este navegador no permite avisos. En iPhone, primero añade la app a la pantalla de inicio y ábrela desde ahí». El revisor
  va a pasar por esa pantalla para probar el bloqueo. Convendría esconderlo dentro de la app (`esAppIOS()`).
- **El dictado y el manos libres** (el micro de la ficha de la parada, `MiRuta.jsx`, y el de la guía, `Navegacion.jsx`):
  usan el reconocimiento de voz del navegador de dentro de la app, si lo ofrece. `Info.plist` lleva el permiso del micrófono
  pero no el de reconocimiento de voz (`NSSpeechRecognitionUsageDescription`); si en un iPhone esos botones hacen algo, hay
  que ver qué pasa al pulsarlos. **[COMPROBAR]** en un iPhone de verdad: no se ha visto.
- **El error del tope** (Pendiente de Dani, 2): desde el 01-01-2027, un mensaje neutro al añadir la parada 16.

### Lo que no se ha podido comprobar
Desde el código no se ve producción, ni App Store Connect, ni un iPhone. Antes de afirmar cada cosa a Apple:
- **El bloqueo tal como quede fusionado.** Este kit lo describe según su especificación; los nombres de los botones se
  cotejaron el 10-11 con la web a medio hacer («Bloquear a {nombre}», «Personas bloqueadas», «Desbloquear»). Repasar los
  puntos 4 y 5 de la respuesta de la regla 1.2 y el punto 6 de las notas contra la app fusionada.
- **Producción:** el mercadillo encendido y con un anuncio ajeno publicado; `REP_GRATIS_HASTA` y `REP_GRATIS_PARADAS` (el
  código da 2026-12-31 y 15 si no hay variable); `PLAY_COBRO_ACTIVO` (el cobro en la app de Android); `CORREO_CONTACTO` (a
  dónde llegan los avisos de moderación por correo); que Dani tiene puestos los avisos del mercadillo en el móvil.
- **App Store Connect:** que las capturas subidas son las 12 del repositorio; que el vídeo sigue adjunto; que las dos cuentas
  de prueba siguen vivas y sin nadie bloqueado.
- **En un iPhone de verdad con el build que se envíe:** la guía con voz, la ubicación, una entrega sin cobertura, y si salen
  (y qué hacen) el dictado y el manos libres. Del vídeo del 03-11 solo se sabe que funcionan el escáner, la foto, la firma,
  el alta y borrar la cuenta, con el build 16.
- **Que todas las cuentas de empresa siguen siendo de Dani** (la frase entre `<…>` de la pregunta 2 del cuestionario).
