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
  con `vite preview --port 4174` en marcha). Apple las admite en JPEG.

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
     3 paradas de muestra).» (Sin una palabra de planes ni de pagos: la app no los tiene, ver abajo.)
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
- Registration: "Crear mi cuenta" → name, e-mail, password.
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
  regalos, «Invita y gana», bono y cartera; la Privacidad sin «Invita y gana», cartera ni pagos; las Cookies sin Stripe ni
  `flota_plan`; Seguridad, Aviso legal y Encargo sin «pagos» ni «suscripción»; Stripe y Google Play fuera de la lista de
  encargados.
- **Páginas de la web que en el iPhone no existen** (`main.jsx`, `SoloWeb`; llevan a la app del repartidor): la portada (`/`),
  `/planes`, `/regalo/…`, `/invita`, `/repartidores`, `/calculadora-repartidor`, `/iphone`, `/empleo/prioridad`,
  `/peritaje-tecnico` y `/t/…` (la tienda). En la candidatura de empleo y en el seguimiento del cliente, sin «Invita y
  gana», promociones, ropa ni «ordena tu ruta gratis».
- **Errores del servidor** (`txError`, `services/api.js`): lo que mande el servidor sobre plan, suscripción, prueba, tope,
  regalo, promoción o Stripe, y cualquier 402, sale como «No se ha podido completar. Inténtalo de nuevo más tarde.» (o el
  texto por defecto de la pantalla). El servidor no se tocó.

### Cómo se vigila
- **`frontend/e2e/ios-sin-pagos.spec.js`**: simula la app (`window.Capacitor` con `getPlatform() 'ios'`, el puente nativo y
  el agente `FDSApp`), recorre con la API simulada la cuenta en cada estado (prueba, suscrita, regalo, suspendida,
  promoción…), «Hoy» con sus avisos, bono e invitaciones, el error del tope, el alta entera, la entrada, el portal del
  conductor con la auditoría y su final, el panel y los textos legales, también con el móvil en los seis idiomas (y pt-BR),
  y comprueba que NADA de lo que se ve —ni los nombres accesibles, marcadores o títulos— casa con el vocabulario prohibido
  (suscripción, plan, prueba con días, precio, €/mes, promo, cupón, código de regalo, bono, invita y gana, gana N €,
  gratis hasta, paradas al día, Stripe, pagar, comprar, premium… y sus equivalentes en en, pt, fr, it y de). Cada pantalla
  tiene su **control**: la misma ruta sin simular el iPhone sigue enseñando lo que enseña la web. Comprobado también al
  revés: con `sinPagos = () => false` fallan 89 de las 107 pruebas del iPhone (las otras 18 no tienen nada que esconder).
- **Regla para quien toque la app**: toda pantalla o texto nuevo con plan, precio, prueba, regalo, bono o invitación lleva
  `sinPagos()`; si no, esa prueba falla.

### Lo que NO cambia (y hay que tener presente)
- El servidor sigue con sus reglas: desde el 01-01-2027 aplica el tope de 15 paradas nuevas al día a las cuentas sin
  suscripción (`REP_GRATIS_HASTA`), también a las del iPhone, que no sabe de qué plataforma viene una cuenta. En la app
  sale un aviso neutro (sin «plan» ni «tope»). Si no se quiere que el iPhone tenga tope, hay que decidirlo en el servidor
  antes de esa fecha.
- Los correos que manda el servidor (bienvenida, «te quedan N días de prueba») siguen hablando de plan y prueba: no están
  en la app, pero una cuenta creada en el iPhone también los recibe.
- El mercadillo (anuncios entre repartidores) lleva el precio del objeto que se vende y el consejo «no pagues por
  adelantado»: no es un plan ni un pago de la app y se queda.
- OJO, ajeno a esto: dentro de la app `origen()` es `capacitor://localhost`, así que el enlace de seguimiento que el
  repartidor manda al cliente por WhatsApp sale con esa dirección, que no abre fuera de la app.

### Qué contestar a Apple (Centro de resolución, en inglés; poner el número de build al subirlo)
```
Thank you for the review. We removed all references to subscriptions, plans, trials, prices, promo codes and bonuses from the
iOS app; it is free for couriers on iPhone and nothing in the app unlocks functionality through mechanisms other than the App
Store.
- 2.1(b): the app no longer mentions any subscription or In-App Purchase product (account screen, notices, sign-up, legal pages
  and the company panel included), so there are no In-App Purchase products to submit.
- 3.1.1: the gift/promo code field, and any other code, coupon, bonus or referral reward, is gone from the iOS app.
A new binary (build <N>) is attached.
```

### Pasos para reenviarla
1. Mezclar la rama `ios/sin-pagos` en `main`.
2. **«App iPhone (App Store)»** → Run workflow (sube el build N a App Store Connect; `app-ios.yml` ya no se lanza solo);
   `python scripts/app_store_connect.py builds` dice cuándo está procesado y `adjuntar` lo pone en la versión.
3. Poner las notas de revisión de arriba (sin «free plan, no card» ni nada de pagos): `python scripts/app_store_connect.py
   revision`, o a mano en la versión → Información para el equipo de revisión.
4. Contestar en el Centro de resolución con el texto de arriba y volver a enviar. Si el envío rechazado no deja reenviar,
   como el 03-11: quitar su elemento rechazado y crear uno nuevo por la API (`enviar`).
