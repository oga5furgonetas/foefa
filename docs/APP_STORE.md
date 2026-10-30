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
- **Comprar el plan**: Apple obliga a usar su pago dentro de la app (regla 3.1.1, con el 15-30 % de comisión) y
  rechaza las apps que llevan a pagar fuera. Hasta tener el pago de Apple hecho, dentro del iPhone no se vende nada
  (la cuenta se ve, el plan se contrata en la web). Ahora mismo es gratis hasta el 31-12, así que no se nota.
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
     autónomos: escanea paquetes, ordena la ruta y navega. Para probar: entrar y pulsar "Verlo en acción con 3
     paradas de ejemplo". No hay compras dentro de la app.»
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
  Claude en su pestaña) y `enviar` → WAITING_FOR_REVIEW; se publica sola al aprobarla. El DSA quedó pendiente de Dani.

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
- «Pagos fuera de la app» (3.1.1): dentro del iPhone no hay ningún botón de pagar ni enlace a pagar (ver arriba).
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
  tema, con el plugin StatusBar). `lib/instalar.js` da la app por instalada dentro de la nativa (sin «instalar»);
  `RutaCuenta.jsx` esconde la compra en iOS.
- El servidor admite el origen `capacitor://localhost` en CORS siempre (`server.py`): sin eso el iPhone no podría
  ni entrar.
- Para compilar en local hace falta un Mac: `cd frontend && npm ci && VITE_API_URL=https://flota-backend.fly.dev/api
  npm run build && npx cap sync ios && npx cap open ios` (abre Xcode; con tu cuenta de Apple en Xcode → firma
  automática → Product → Archive → Distribute).

## Tanda 2 (cuando esté en la tienda)

- Avisos al móvil con APNs (`@capacitor/push-notifications` + certificado/clave APNs en el servidor).
- El pago de Apple (StoreKit, suscripción mensual y anual) o, en la UE, el enlace externo con las condiciones del
  DMA; mientras, el plan se contrata en la web.
- Compartir la ubicación en segundo plano para «Seguirme» con la pantalla apagada (hoy, solo con la app abierta).
- Capturas por idioma y la ficha en en/pt/fr/it/de (las de Play valen).
