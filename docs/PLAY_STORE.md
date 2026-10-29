# La app de Android de Flota (Play Store)

Preparada el 03-10-2026 para que un autónomo (o cualquier repartidor o
empresa) instale Flota desde Play Store. Carpeta `android/` del repo.

## Qué es y por qué así

Es una **Trusted Web Activity**: la propia web flotadsp.com abierta por
Chrome a pantalla completa, sin barra de direcciones, con su icono, su nombre
y su pantalla de arranque. Es lo que recomienda Google para una web que ya es
una app (PWA), y lo que usan Twitter Lite, Starbucks, etc.

- **Una sola app**: no hay otro código que mantener; lo que se despliega en
  la web lo ve la app al momento, sin esperar a que Play apruebe una versión.
- **Mismos permisos**: cámara (escanear, foto de la etiqueta) y ubicación
  (solo en jornada) los pide Chrome con sus diálogos, como en el navegador.
  La app en sí no declara permisos: menos preguntas en la revisión de Play.
- **Enlaces**: los de flotadsp.com (portal del conductor, seguimiento de un
  pedido) se abren dentro de la app si está instalada (`autoVerify`).
- **Arranque**: `/app` lleva a cada uno a lo suyo: repartidor a «Mi ruta»,
  oficina al panel, y sin sesión a `/empezar` («Repartir yo mismo», «Soy
  repartidor de una empresa», «Gestiono una empresa», probar sin cuenta).
  Quien reparte solo vive en `/ruta`: su app de reparto, sin panel de flota.

Si algún día hace falta algo que la web no puede (escaneo en segundo plano,
avisos sin Chrome), se cambia por una app nativa; la cuenta, el paquete
(`com.flotadsp.flota`) y la clave de firma valen igual.

## Nombre de la app: FDS (04-10-2026)

Dani: «Flota da nombre a otras cosas, no a reparto». La app de Play se llama
**FDS** (`launcherName`/`app_name` en `android/`, versión 1.0.1 / code 2;
`short_name` del manifest web). La marca de la web sigue siendo Flota.

## Versión 1.0.3 (code 4): que no se note que es una web (25-10-2026)

Dani: «que no se siga viendo como app web en el móvil; es la que vamos a subir a Play, debe ser perfecta».
Comprobado antes de tocar nada: la web y los dos paquetes están verificados con Google (`assetlinks:check` →
`linked: true` para `com.flotadsp.flota` con la huella de Play App Signing y para `.web` con la de subida), así
que la app NO enseña barra de direcciones. Lo que la delataba estaba dentro, y se arregló:

| Antes | Ahora |
|---|---|
| Barra de arriba del móvil negra (#070a0e) encima de la app clara | La web pone su `theme-color` al papel de la app (#f7f6f3; #060a14 con el tema oscuro). En una TWA verificada, Chrome pinta la barra con el `theme-color` de la página (commit de Chromium 71357f7) |
| Pantalla de arranque y barra de abajo negras | `android/.../values/colors.xml` `fondo` = #F7F6F3, iconos oscuros (`windowLightStatusBar`, y `windowLightNavigationBar` en `values-v27`) |
| «Atrás» del móvil cerraba la app con una hoja abierta | `lib/atras.js`: cada hoja, el escáner, la navegación, el día del historial y las pestañas meten una entrada en el historial; «atrás» las cierra y desde otra pestaña vuelve a «Hoy» |
| Al abrir, /app recargaba la página entera hacia /ruta (dos cargas) | Cambio de pantalla dentro de la misma página (`<Navigate>`) |
| Cargando: negro con un círculo naranja | El papel de la app con el cian de la marca |
| Aviso de cookies y píxeles de Meta/TikTok dentro de la app | Ninguno dentro de la app instalada: «Seguridad de los datos» (no comparte con terceros) queda cierto |
| Se ampliaba con dos dedos y al mantener pulsado un enlace salía el menú de Chrome | No, solo dentro de la app (`prepararModoApp`) |
| Sin cobertura: el dinosaurio de Chrome | Service worker (`public/sw.js`): abre con la última versión guardada y la ruta guardada en el móvil, con «Sin conexión: es tu ruta de las HH:MM» |
| Cada apertura volvía a preguntar por cada trozo de la app | Los trozos (con huella) salen del móvil; solo se guarda JS que llega como JS (el veneno del borde no entra) |

Medido con la cámara lenta de Playwright (Pixel 5, CPU ×4, 4G de 150 ms), misma compilación con y sin el
service worker: abrir la app la primera vez ~3,8 s; las siguientes **~0,6 s** (sin él, ~3,1 s). Al abrir ya no
se bajan el mapa ni el mercadillo (−74 KB comprimidos, el 28 %): se cargan al usarlos.

**Para subir:** `android/app/build/outputs/bundle/playRelease/app-play-release.aab` (firmado con la clave de
subida, `jarsigner -verify` → «jar verified»). La de la web (`/descargas/FDS.apk`) ya es la 1.0.3. Lo que no
se ha podido ver en un móvil físico: los colores de la pantalla de arranque y de la barra de abajo (no hay
emulador con Chrome en el PC); lo de dentro de la web, sí, con pruebas (`e2e/app-nativa.spec.js`).

## Versión 2.0.0 (code 10): la app NATIVA (25/26-10-2026)

Dani, al ver la 1.0.3: «se ve y es una aplicación web… quiero una aplicación Android real, hecha para Android y
bien hecha». Desde la 2.0.0 la app de Play es **nativa** (Kotlin + Jetpack Compose, Material 3) en
`app-android/`, con el **mismo paquete** (`com.flotadsp.flota`) y la **misma clave de subida**: en Play es una
actualización de la FDS de siempre, no otra app. `android/` (la TWA) se queda para la variante de China.

Es la app de quien reparte por su cuenta (autónomo): entrar o crear la cuenta, «Hoy» (siguiente parada,
navegar con Google Maps o Waze, llamar, WhatsApp, entregado / no entregado con motivo, cobro con su forma de
pago y foto), ordenar la ruta desde donde estás, mapa (OpenStreetMap), escáner continuo (barra y 2D; si el código
no trae la dirección, la lee del texto de la etiqueta y abre la ficha para revisarla), historial, ajustes (navegar
con, tema, salida, hora, país, volver a la base), cuenta (plan, invitar, soporte, cerrar sesión, **borrar la
cuenta**). Sin cobertura: abre con la última ruta y lo entregado se envía solo al volver la red (WorkManager).
Los conductores de empresa y la oficina siguen en la web.

**Comprobado en un emulador Android 14 oficial contra el servidor real** (`pruebas/servidor_pruebas.py`: el
`server.py` de verdad con una base en memoria) y con la versión **minificada con R8** (la que va a Play):
alta, entrar, ruta, ordenar (con permiso de ubicación), mapa, entregar con cobro, no entregado, deshacer,
entrega sin red con la app en segundo plano (llega al servidor ~5 s después de volver la red), escáner en vivo
con la cámara virtual del emulador (etiqueta SEUR: entra sola; etiqueta de solo barra: OCR → ficha), girar el
móvil con la ficha a medias, tema oscuro, ajustes (país y hora guardados en el servidor), cerrar sesión, borrar
la cuenta. 7 pruebas de lectura de etiquetas con ML Kit en el propio emulador
(`app/src/androidTest/.../LecturaEnElMovilTest.kt`) y 5 del lector en JVM. Lint sin errores.
**No comprobado:** un móvil físico (cámara real, GPS real, rendimiento) ni la subida a Play.

Fallos que salieron al probarla y están arreglados (que no vuelvan):
- ML Kit devuelve `rawValue = null` en los 2D con tildes en Latin-1 (`TextoDelCodigo`: se leen los bytes).
- Con la cámara denegada, hacer una foto cerraba la app (`SecurityException`): `ui/Foto.kt` pide el permiso antes.
- La cámara seguía encendida al salir del escáner (va atada a la actividad: se suelta en `onDispose`).
- La barra y el 2D de la misma etiqueta contaban como dos paquetes; con la etiqueta quieta, sumaba cada 6 s.
- Girar el móvil cerraba el escáner y borraba la ficha (`configChanges` en el manifiesto).
- Una contraseña mal escrita al borrar la cuenta cerraba la sesión (el servidor daba 401: ahora 400).
- La cuenta salía de EE. UU. con el móvil en inglés: el país se toma de la SIM (y se cambia en Ajustes).
- Cobros en euros para todos y Bizum fuera de España: moneda y formas de pago del país, como la web.
- Botón «Escanear» e interruptores sin nombre para TalkBack; icono encogido en un círculo blanco (ahora adaptativo).

## Preparación 2.1.0 (code 11): portal de empresa dentro de FDS (28-10-2026)

La app nativa conserva el acceso autónomo y añade una entrada de empresa. Los enlaces personalizados del panel
(`flotadsp.com/conductor/#<slug>`) se verifican como App Links y abren el portal dentro de FDS. El acceso pide el
email y el servidor busca la ficha entre las organizaciones activas; tras verificar el código enviado al correo,
emite una sesión ligada a la empresa. El slug del enlace queda como pista opcional. La WebView mantiene navegación
dentro de `flotadsp.com`, no permite contenido mixto ni acceso a archivos locales y abre el selector de imágenes del
móvil para las fotos del portal.

El inicio de sesión del conductor puede usar un código temporal por correo (10 minutos, un uso, cinco intentos,
límite de solicitudes, tenant en el JWT) o contraseña. La oficina puede vincular un correo personal desde la ficha;
el conductor confirma con un enlace de un solo uso, válido 24 horas. A partir de ahí, el OTP se envía al correo
personal verificado aunque el conductor escriba su email laboral. Si el mismo email aparece en varias empresas, el
sistema no elige una automáticamente. No se revela si una dirección existe y una ficha de baja o cuenta suspendida
no puede entrar. Los códigos vencidos se limpian con TTL en Mongo.

El vínculo de correo personal y la resolución del tenant son cambios web/API. La app FDS abre ese portal web remoto,
por lo que este cambio no requiere subir un AAB nuevo a Google Play. Los usuarios verán el flujo actualizado al
abrir o recargar FDS; el despliegue web/API ya está publicado en flotadsp.com. Los cambios nativos anteriores
(2.1.0, code 11)
siguen necesitando compilar y publicar su propio AAB si aún no se han subido.

`app-android/app/build.gradle.kts` queda en versionCode 11 / 2.1.0. Aún no se ha generado ni subido un AAB: este
entorno no tiene JDK ni Android SDK. Antes de Play, compilar, ejecutar las pruebas API contra Mongo de test y probar
el enlace de empresa, subida de fotos, contraseña y OTP en un móvil físico.

## Preparación 2.2.1 (code 13): un acceso que abre el portal correcto (28-10-2026)

En el inicio de FDS, «Ya tengo cuenta» usa un acceso Android unificado. La API valida primero las credenciales y
solo entonces decide el destino: cuenta autónoma → reparto nativo; cuenta de oficina → panel móvil de empresa;
conductor de empresa → portal del conductor dentro de FDS. El token de empresa/conductor se entrega a la WebView
solo desde Android y se guarda en el almacenamiento local del dominio HTTPS; no viaja en la URL.
El alta de cuenta sigue siendo para reparto autónomo. Los enlaces `/conductor/#<slug>` siguen abriendo el portal
de empresa directamente mediante App Links.

La API y el frontend web pueden desplegarse sin subir otra app. Para que este acceso unificado aparezca en la app
instalada desde Google Play sí hace falta publicar el AAB `versionCode 13` / `versionName 2.2.1`. El código 12
ya está registrado en Play Console; no reutilizarlo. El AAB se genera con la clave de subida original y se debe
verificar la firma antes de cargarlo.

**Ficheros** (en `app-android/salida/`, fuera de git):
- `FDS-2.0.0.aab` → **lo que se sube a Play** (Producción o la prueba cerrada). Firmado con la clave de subida
  (SHA-256 `5B:48:01:D5:…:73:44:61`). Play le da a cada móvil solo lo suyo (~21 MB en un móvil arm64).
- `FDS-2.0.0.apk` → para instalar a mano o descargar de la web: paquete **`com.flotadsp.flota.web`** (como la
  TWA de la web), solo procesadores de móvil (arm64 y armv7, 32 MB). Convive con la de Play y actualiza la que se
  bajó de la web. Todavía NO está en `frontend/public/descargas/`: primero que Dani la pruebe en su móvil.

**Compilar** (bash, en `app-android/`; el SDK y el JDK 17 como en «Cómo volver a compilar»):

```bash
export ANDROID_HOME='C:\Users\Usuario\AppData\Local\Android\Sdk'
export JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
export FLOTA_KEYSTORE='C:\Users\Usuario\.flota-android.keystore'
export FLOTA_KEYSTORE_PASSWORD="$(tr -d '\r\n' < /c/Users/Usuario/.flota-android-keystore.txt)"
./gradlew :app:bundleRelease                                   # el AAB de Play
./gradlew :app:assembleRelease -PsoloMoviles -PparaWeb         # el APK para descargar (arm64 + armv7, 32 MB)
./gradlew :app:assembleRelease -PsoloMoviles=arm64 -PparaWeb   # solo arm64 (21 MB): cabe para mandarlo al móvil
```

**Probar en el PC** (emulador oficial `FDS_Pixel`, Android 14, imagen `google_apis/x86_64`):
`py -3 app-android/pruebas/servidor_pruebas.py` (puerto 8787, cuenta `prueba@fds.test` / `ruta-de-prueba-1`
con 4 paradas en A Coruña; ojo: siembra el día en que arranca, reiniciarlo pasada la medianoche) y
`./gradlew :app:installDebug -PapiUrl=http://10.0.2.2:8787/api/` (o `installPrueba`: la de Play con R8, firmada
con la clave de depuración). `pruebas/emu.sh` toca y lee la pantalla por adb (`MSYS_NO_PATHCONV=1`).
Para el escáner en vivo: `pruebas/cartel_etiqueta.py` hace el cartel, el emulador lo cuelga con
`-virtualscene-poster wall=<png>` (o `adb emu virtualscene-image wall <png>`) y la cámara virtual se pone delante
por gRPC (`setPhysicalModel`: posición `-1.407 0.32 4.277`, giro `0 -150 0`). Las pruebas en el emulador
(`connectedDebugAndroidTest`) desinstalan la app de depuración: hay que volver a entrar.

**En Play Console, para esta versión:**
- Seguridad de los datos: ahora la app declara **cámara** (escanear y foto de la entrega; la foto de la entrega
  SÍ se guarda: es la prueba de entrega) y **ubicación precisa** (opcional, solo con la app abierta, para ordenar
  la ruta desde donde estás). Ver las respuestas al final.
- **Eliminación de cuentas** (obligatorio si se crean cuentas en la app): en la app, Cuenta → «Borrar mi cuenta»
  (con la contraseña; la cuenta queda desactivada al momento y la petición en `bajas_cuentas`, con aviso a
  `CORREO_CONTACTO`). **Los datos los borra una persona en 30 días como mucho**: es tarea de Dani. Play pide
  además un enlace web: hoy vale `https://flotadsp.com/privacidad` (apartado 6, por correo); mejor una página
  propia que explique los dos caminos (pendiente, DECIDE DANI).
- Permisos que verá Google: Internet, cámara, ubicación, vibrar, y los de WorkManager para reintentar tras
  reiniciar el móvil (`WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`). El servicio en primer plano de WorkManager se quita
  del manifiesto (no se usa).

## Versión 2.2.4 (code 16): la pantalla de elegir contraseña dice por qué no deja seguir (29-10-2026, tarde)

Dani probó la 2.2.3 en su móvil con un conductor de OGA5 y la contraseña temporal común de la plantilla: entró
(el primer intento dio «incorrecta», casi seguro el bloqueo de 5 minutos tras varios intentos mal tecleados; tras
reinstalar y teclearla bien, entró) y se quedó atascado en «Elige tu contraseña»: con tres letras en cada campo el
botón «Guardar y continuar» seguía gris sin decir nada, y los campos no dejaban ver lo escrito. La regla era correcta
(6 caracteres o más y las dos iguales), la pantalla no la explicaba.

Cambios, solo en la app (`app-android/`), sin tocar servidor ni web:
- Los tres campos de contraseña de esa pantalla (y de «Cambiar contraseña») usan el campo con el ojo de la pantalla
  de entrada (`CampoClave`, que pasa de `private` a `internal` en `Acceso.kt`).
- Debajo de los campos sale el motivo por el que el botón está apagado: «Faltan N: la contraseña tiene que tener 6
  caracteres o más», «Las dos contraseñas no coinciden» o «Escribe también tu contraseña actual».
- La tarjeta «Mi ruta» del portal del conductor solo sale cuando el servidor dice que la empresa reparte con la app
  (`activo` en `reparto/mi-ruta`), como ya hacía el portal web. En OGA5, DGA1 y DGA2 (reparto para Amazon) no
  sale: Dani la vio y no tenía sentido allí.
- `versionCode 16` / `versionName 2.2.4` (el 15 queda sin subir: no se reutiliza).

Probado por Dani en su móvil con la 2.2.3 (29-10, tarde), con ese conductor: auditoría del vehículo bien, Mis turnos
bien, Trabajar más contesta «no hay vacantes disponibles» (correcto si hoy no hay), Invita y gana bien. Queda por
probar la entrada con la cuenta de oficina (panel de empresa dentro de FDS).

**Compilada el 29-10 por la tarde en el PC de casa de Dani** (usuario `dlvie`): `:app:testDebugUnitTest :app:lintDebug`,
`:app:bundleRelease` y `:app:assembleRelease -PsoloMoviles=arm64 -PparaWeb` en verde. Ese PC compila desde entonces:
proyecto clonado con git en `C:\Users\dlvie\foefa`, Android Studio con el SDK en `%LOCALAPPDATA%\Android\Sdk` (Gradle
bajó solo la plataforma 36 y las build-tools 35), JDK el de Android Studio (`C:\Program Files\Android\Android Studio\jbr`)
y la clave de subida con su contraseña en `C:\Users\dlvie\` (donde `build.gradle.kts` las busca). En PowerShell:

```powershell
cd C:\Users\dlvie\foefa\app-android
git pull
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'; $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug
.\gradlew.bat :app:bundleRelease                                   # app\build\outputs\bundle\release\app-release.aab
.\gradlew.bat :app:assembleRelease -PsoloMoviles=arm64 -PparaWeb   # app\build\outputs\apk\release\app-release.apk
```

Firma verificada (`jarsigner -verify`: jar verified) y **probada por Dani en su móvil el 29-10 por la tarde: correcto**.
Los ficheros: `C:\Users\dlvie\Downloads\FDS-2.2.4-code16.aab` y `FDS-2.2.4.apk`. **Subido a Play Console el 29-10 por la
tarde: pista «Prueba abierta», versión 16 (2.2.4), «Iniciar lanzamiento completo», en revisión**, sin ningún aviso al
subir (ni 16 KB, ni permisos). Publicación gestionada desactivada: al aprobarse se publica sola en esa pista.

## Versión 2.2.3 (code 15): la que se sube, compilada y firmada el 29-10-2026

Las versiones 2.1.0, 2.2.1 y 2.2.3 se escribieron desde un entorno sin JDK ni SDK: nunca se habían compilado. El
29-10 se compiló por primera vez en el PC de Winiw (Android Studio y su SDK ya estaban), se pasaron las pruebas y se
generó el AAB con la clave de subida. **Lo que hay que subir a Play: `app-android/salida/FDS-2.2.3.aab`** (35 MB,
firmado con la clave de subida `5B:48:01:D5…73:44:61`, comprobado con `jarsigner -verify`). `versionCode 15` /
`versionName 2.2.3` (el 12, 13 y 14 ya estaban registrados en Play Console: no se reutilizan). Al lado,
`salida/FDS-2.2.3.apk` (paquete `com.flotadsp.flota.web`, arm64 + armv7) para instalar a mano en un móvil.

Lo arreglado antes de firmar (todo en `app-android/`, commit del 29-10):
- **Mis turnos**: el día de suspensión se pintaba como «sin turno» (la app miraba `type == "susp"` y el servidor
  manda `cod == "SUSP"`, como lee la web); y el diálogo de confirmación decía la fecha en crudo («2026-11-02») en
  vez de «2 de noviembre».
- **Auditoría del vehículo**: abría la cámara del sistema sin pedir el permiso de cámara. Como la app lo declara
  (lo usa el escáner), Android lo exige: un conductor de empresa que nunca hubiera usado el escáner no podía hacer
  ni una foto (fallaba con «No se pudo abrir la cámara»). Ahora lo pide antes, como ya hacía la ficha de entrega
  (`ui/Foto.kt`). De paso, `androidx.exifinterface` en vez de `android.media.ExifInterface` (lo pedía lint).
- **Portal de empresa dentro de FDS**: al inyectar la sesión en la web, borra también `flota_acceso` y la sesión
  previa, como hace el login web (`saveSession` en `frontend/src/panel/auth.js`); si no, un resto de la sesión
  anterior ganaba al token nuevo hasta que `/auth/me` contestara.
- **Firma sin variables**: `build.gradle.kts` busca la clave en `~/.flota-android.keystore` y la contraseña en
  `~/.flota-android-keystore.txt` si no vienen por `FLOTA_KEYSTORE*`. En este PC son
  `C:\Users\Winiw Delivery\…`; en el de Dani, `C:\Users\Usuario\…`. La contraseña no pasa por la línea de
  órdenes ni por ningún log.
- Avisos del compilador fuera (`Locale("es","ES")` obsoleto, iconos `AutoMirrored`, `!!` de más).

Comprobado el 29-10:
- `./gradlew :app:testDebugUnitTest :app:lintDebug`: 5 pruebas en verde; lint 0 errores (51 avisos: versiones
  fijadas a propósito, `UseKtx`, el `javaScriptEnabled` del portal, que hace falta).
- **El contrato app ↔ API, con el servidor real** (`app-android/pruebas/api_conductor.py` contra
  `servidor_pruebas.py`, que ahora siembra también una empresa con un conductor: `conductor@fds.test` /
  `turno-de-prueba-1`, furgoneta 1234 KLM asignada hoy, libra mañana, un refuerzo abierto por la oficina): 61
  comprobaciones en verde. Son las mismas llamadas, cuerpos y campos que usa la app nativa: acceso unificado y
  destino, turnos (shifts/mine, bloqueos, pedir día, vistas), trabajar más (vacantes, solicitar, retirar,
  cancelar), auditoría (furgoneta de hoy, validar foto, cuentakilómetros con rango a mano, subir la inspección
  entera y el 409 al repetir), Invita y gana, teléfono, correo personal, cambio de contraseña, código por correo,
  y lo del autónomo (ruta, renovar, planes, ajustes, estadísticas).
- **No comprobado**: un móvil físico ni el emulador. En el PC de Winiw el emulador no arranca (falta el driver de
  hipervisor de Android o la «Plataforma de hipervisor de Windows»: se activa en «Características de Windows»,
  con permisos de administrador y reinicio). Antes de Producción: instalar `salida/FDS-2.2.3.apk` en un móvil y
  pasar el portal de empresa (entrar, turnos, auditoría con fotos, trabajar más) y el autónomo.

Compilar en el PC de Winiw (`app-android/`, desde el panel de Terminal de la app de Claude o desde PowerShell;
en este PC el daemon de Gradle no arranca desde las herramientas de la sesión, sí desde una terminal normal):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'        # JDK 21 de Android Studio
$env:ANDROID_HOME = 'C:\Users\Winiw Delivery\AppData\Local\Android\Sdk'
.\gradlew.bat :app:bundleRelease                                   # salida: app/build/outputs/bundle/release/
.\gradlew.bat :app:assembleRelease -PsoloMoviles -PparaWeb         # el APK para la web (com.flotadsp.flota.web)
```

Probar sin emulador: `backend\.venv\Scripts\python app-android\pruebas\servidor_pruebas.py` en una ventana y
`backend\.venv\Scripts\python app-android\pruebas\api_conductor.py` en otra (el venv se creó el 29-10 con
`requirements.txt` + `tzdata` + `segno`).

## Lo que ya está hecho

| Qué | Dónde |
|---|---|
| Proyecto Android (Gradle 9.1, AGP 8.13.1, `targetSdk 36`, `minSdk 24`) | `android/` |
| Librería de Google `androidbrowserhelper 2.7.3` | `android/app/build.gradle.kts` |
| Clave de firma (RSA 2048, 10.000 días, alias `flota`) | `C:\Users\Usuario\.flota-android.keystore`; contraseña en `C:\Users\Usuario\.flota-android-keystore.txt` (**nunca imprimirla ni subirla**) |
| Huellas SHA-256 en `assetlinks.json` | Play App Signing (la que firma lo que llega a los móviles): `C8:E4:A4:E4:F0:EB:43:17:54:DB:9A:97:53:4E:C6:9E:A2:04:A6:2C:0C:A0:82:46:01:95:4D:A5:01:80:EC:F6` · clave de subida (la nuestra): `5B:48:01:D5:CE:33:D1:C5:9E:4C:A0:40:40:3C:A4:9B:15:BF:E1:FD:7A:2B:7B:1B:F1:3A:E0:EB:1C:73:44:61` |
| La web declara la app | `frontend/public/.well-known/assetlinks.json` (servido en https://flotadsp.com/.well-known/assetlinks.json) |
| La app declara la web | `asset_statements` en el `AndroidManifest.xml` |
| Manifest web (nombre, `start_url: /app`, iconos, atajos) | `frontend/public/manifest.json` |
| Iconos y pantalla de arranque | `android/app/src/main/res/mipmap-*`, `drawable/splash.png` (del logo) |
| Compilado firmado | `android/app/build/outputs/bundle/release/app-release.aab` (lo que se sube a Play) y `apk/release/app-release.apk` (para instalar a mano y probar) |

### Cómo volver a compilar

Desde bash, en `android/`:

```bash
export FLOTA_KEYSTORE='C:\Users\Usuario\.flota-android.keystore'
export FLOTA_KEYSTORE_PASSWORD="$(tr -d '\r\n' < /c/Users/Usuario/.flota-android-keystore.txt)"
export JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
./gradlew bundlePlayRelease assembleChinaRelease
```

**Tercera variante, `web` (10-10-2026).** La misma app de Play con paquete
`com.flotadsp.flota.web`, para descargar desde la web (`/descargas/FDS.apk`)
mientras Play está en prueba cerrada: `./gradlew assembleWebRelease` y copiar
`app/build/outputs/apk/web/release/app-web-release.apk` a
`frontend/public/descargas/FDS.apk`. Va firmada con la clave de subida, y
`assetlinks.json` declara ese paquete con esa huella (por eso abre a pantalla
completa).

**Dos variantes (04-10-2026).** `play` es la de Google Play (lo que se sube:
`app/build/outputs/bundle/playRelease/app-play-release.aab`). `china` es para
China, donde no hay Play ni casi Chrome: paquete `com.flotadsp.flota.cn`, abre
la web en un WebView propio (`src/china/java/.../WebActivity.java`: ubicación,
cámara y fotos con los permisos del sistema) y cobra con Stripe. Su APK
(`app/build/outputs/apk/china/release/app-china-release.apk`) se copia a
`frontend/public/descargas/FDS-china.apk` y se descarga desde la web (la
tarjeta «Instala la app» lo ofrece desde China, y la portada /cn).

Para una versión nueva: subir `versionCode` (entero, siempre mayor) y
`versionName` en `android/app/build.gradle.kts`. Como la app es la web, solo
hace falta una versión nueva si cambia algo del propio envoltorio (icono,
nombre, `targetSdk` que Play exija).

## El plan del autónomo: 7 días gratis y 9,99 €/mes

Quien se da de alta como «Repartidor autónomo» no elige plan: entra en el plan
**Autónomo** (`PLAN_TARIFAS["autonomo"]`): **7 días de prueba** sin tarjeta y
después **9,99 €/mes** fijos (o **99 €/año**, 10 meses). Límites: 1 repartidor
(él), 2 vehículos, 1 base; todo el reparto, su furgoneta, taller y vencimientos;
sin chat de equipo ni informe pericial. Al acabar la prueba el panel enseña el
aviso de pago (`TrialBanner`) con el botón de pagar.

**El cobro es con Stripe** (04-10-2026, la cuenta de Dani, la misma de la
tienda). En Stripe hay un producto «Flota Autónomo» con precios de 9,99 €/mes
y 99 €/año (IVA incluido) y un webhook propio para las suscripciones. En Fly:
`STRIPE_PRICE_AUTONOMO`, `STRIPE_PRICE_AUTONOMO_ANNUAL`,
`STRIPE_WEBHOOK_SECRET_SUSCRIPCIONES` (los ids también en
`C:\Users\Usuario\.flota-stripe-suscripciones.env`). Cómo va: el aviso de
prueba del panel → el servidor crea una sesión de Stripe Checkout
(`/billing/stripe/suscripcion`) respetando lo que quede de prueba (mete la
tarjeta ahora, primer cobro al acabar los 7 días) → Stripe avisa por el webhook
→ la empresa pasa a `active`. Impago o cancelación → `suspended` (el panel
pide pagar). Cancelar, cambiar de tarjeta o ver facturas: «Gestionar
suscripción» en Configuración (portal de Stripe). Para cobrar los otros
planes por Stripe basta crear sus precios y poner `STRIPE_PRICE_OPERACION`,
`STRIPE_PRICE_COMPLETO` (cantidad = vehículos en flota).

**Cobrar dentro de la app de Play Store** (importante, cambió el 30-06-2026):
una suscripción que desbloquea funciones de la app es un «servicio digital» y
Google quiere su parte. Desde el 30-06-2026, en la UE (y EE. UU. y Reino
Unido) Google permite **mandar al usuario a pagar en la web** (programa
«External Content Links») o usar una pasarela propia dentro de la app, pero
cobra igualmente una **comisión del 10 %** de lo ingresado por esa vía (con
Google Play Billing serían 10 % + 5 %). Hay que **apuntarse al programa** en
Play Console y declarar los enlaces. Alternativa limpia: que el autónomo se
suscriba en flotadsp.com (web, sin la app) y la app solo sirva para usarlo;
lo que se contrata fuera de la app, sin enlaces desde ella, no paga comisión.
En la práctica: en la app, al acabar la prueba, el botón de pagar lleva a la
web de Lemon Squeezy; si Google lo revisa y lo considera venta desde la app,
toca apuntarse al programa (10 %) o quitar el botón dentro de la app.

## Paso a paso en Google Play (lo que hace Dani)

Lo que Google exige y no puede hacer nadie por ti. Tarda ~1 h de clics y
luego días de espera de Google. Material listo en `docs/play-store/`:
`icono-512.png`, `grafico-cabecera-1024x500.png` y cinco capturas
(`captura-1…5`, tres de móvil y dos de tablet/ordenador).

### 1. La cuenta de desarrollador (play.google.com/console)

- Entra con tu Google (mejor una cuenta que no sea personal-personal:
  `contacto@flotadsp.com` si la tienes como Google Workspace, o un Gmail
  dedicado). Pago único de **25 USD**.
- Tipo de cuenta: **«Organización/Empresa»** si puedes aportar CIF; si no,
  «Personal». **Importante**: el programa de pagos externos (para que el botón
  de pagar funcione DENTRO de la app) **solo lo admiten cuentas de empresa**.
  Mientras la sociedad no exista, la app puede estar en Play con los 7 días de
  prueba, pero sin botón de pagar dentro (la app lo oculta sola); el autónomo
  se suscribiría en flotadsp.com desde el navegador. En cuanto tengas el CIF,
  se cambia la cuenta a empresa (Google lo permite) y se activa el botón.
- Verificación de identidad (DNI con el móvil) y, para cuentas de empresa,
  D-U-N-S o documentación de la sociedad. Suele tardar 1-3 días.
- Para cuentas personales nuevas Google exige **probar la app con 12 personas
  durante 14 días** (prueba cerrada) antes de poder publicarla.

### 2. Crear la app

Play Console → **Crear aplicación**: nombre «Flota», idioma «Español
(España)», «Aplicación», «Gratis». Acepta las declaraciones.

### 3. Subir la app y la firma

- **Pruebas → Prueba interna → Crear versión nueva**. Te propone **Play App
  Signing**: acepta («Usar la firma de Google Play»). Sube
  `android/app/build/outputs/bundle/release/app-release.aab`.
- Al terminar, en **Configuración → Integridad de la app → Firma de la
  app**, copia la **huella SHA-256 del certificado de la clave de firma de la
  app** (la de Google, no la de «subida») y **pásamela**: la añado a
  `assetlinks.json` y la app deja de enseñar la barra de direcciones.
- Añade probadores (correos) en Prueba interna y comparte el enlace: les
  llega al momento, sin revisión.

### 4. La ficha (Presencia en la tienda → Ficha principal)

Pega los textos de la sección «Textos para la ficha», sube el icono, el
gráfico de cabecera y las capturas. Categoría «Empresa». Correo de contacto
`contacto@flotadsp.com`. **Política de privacidad**:
`https://flotadsp.com/privacidad`.

### 5. Los cuestionarios (Política y programas → Contenido de la app)

- Política de privacidad: la URL de arriba.
- Acceso a la app: «Toda la funcionalidad está disponible sin restricciones»
  **no** vale (hace falta cuenta): elige «Se necesita acceso restringido» y da
  **credenciales de prueba**: las de la demo no sirven (no son usuario y
  contraseña). Crea en flotadsp.com/registro una cuenta de autónomo para
  Google (p. ej. usuario `revisor-google`) y pon ahí su usuario y contraseña;
  avísame y le quito la caducidad de la prueba.
- Anuncios: No. Clasificación de contenido: cuestionario, todo «No» → «Para
  todos». Público objetivo: 18+ (herramienta de trabajo). App de noticias: No.
  COVID: No. Aplicaciones gubernamentales: No. Servicios financieros: No.
- **Seguridad de los datos**: respuestas en la sección de abajo.
- Declaración de **permisos**: la app no pide ninguno (cámara y ubicación los
  pide Chrome). Si Google pregunta por «ubicación en segundo plano»: No.

### 6. Prueba cerrada → Producción

Pruebas → **Prueba cerrada** → crea una pista, sube el mismo AAB, añade al
menos 12 correos (repartidores de confianza, familia…) y que instalen y la
usen; a los 14 días con 12 activos Google deja pedir **acceso a producción**
(formulario de 3 preguntas: qué se probó, qué se corrigió, a quién va). Luego
**Producción → Crear versión** con el mismo AAB. La primera revisión tarda de
1 a 7 días.

### 7. Apuntarse al programa de pagos externos (cuando la cuenta sea de empresa)

Es el programa **«Ofertas externas» (External offers program)** de la UE.
Lo que dice Google ahora (04-10-2026):

- Requisitos: cuenta de **empresa**, app no dirigida solo a niños, y
  **no mezclar** con Google Play Billing (o se cobra fuera o con Google).
- Comisión: **0 % el primer pago** (adquisición), **10 % en suscripciones**
  renovables, 20 % en otros pagos dentro de la app.
- Dónde: Play Console → **Configuración → Ofertas externas**: aceptar sus
  condiciones, configurar el **perfil de pagos** (ahí te cobrarán la comisión)
  e **integrar sus APIs**. Luego **Configuración → Enlaces a ofertas
  externas → Gestionar** (en la app) → «Añadir países/regiones» → los del EEE
  → Guardar.
- La parte técnica es mía, y es trabajo que **aún no está hecho**: Google
  exige llamar a su API nativa (Play Billing Library, «external offers») para
  enseñar su pantalla de información antes de salir al pago y **comunicar
  cada transacción en 24 h**. La app actual es la web envuelta y no lleva
  esa capa nativa: hay que añadirla al proyecto `android/` y un puente con la
  web. Cuando tengas la cuenta de empresa aprobada, lo hago y después se
  enciende en Fly `PLAY_PAGO_EN_APP=1`, que es lo que hace que el botón de
  pagar aparezca dentro de la app.

Mientras tanto la app funciona entera (prueba de 7 días, luego pide pagar
sin enseñar botón ni enlace), y la suscripción se contrata en la web.

### Dónde estamos (04-10-2026)

- Cuenta personal «FDsp» verificada; app `com.flotadsp.flota` creada.
- Prueba interna activa (lista «yo»), versión 1.0.1 «FDS».
- Ficha («FDS – Reparto y rutas»), configuración de la tienda (Mapas y navegación)
  y los 10 cuestionarios hechos.
- Prueba cerrada Alpha: España, testers = grupo `fds-testers@googlegroups.com`
  (https://groups.google.com/g/fds-testers). Todo **enviado a revisión** el 04-10.
- Cuenta del revisor de Google: org «Revisor Google», `status: active`,
  `revisor_play: true` (no caduca). Usuario `dlvieites19+google@gmail.com`: hasta el 26-10 era
  `lvieites19+google@…`, sin la «d», y sus correos iban a un buzón ajeno. Contraseña nueva del 26-10 en
  `C:\Users\Usuario\.flota-revisor-google.txt`. La app nativa la pide en «Datos de inicio de sesión»
  (antes «Acceso a la aplicación»): «Sí» + instrucciones. Con «No», Play no deja enviar a revisión.
- Falta: 12 testers con la app instalada 14 días → «Solicitar acceso a producción».

## Resumen de lo que necesito de ti

1. La **huella SHA-256** de Play App Signing (paso 3).
2. El usuario de la **cuenta para el revisor** de Google (paso 5).
3. Avisarme cuando la cuenta sea **de empresa** para hacer la integración
   del paso 7.

## Textos para la ficha

**Nombre** (≤ 30): FDS – Reparto y rutas

**Descripción corta** (≤ 80):
Reparto y rutas: escanea paquetes, ruta ordenada, llama al cliente y entrega.

**Descripción larga**:
FDS es la app de reparto para quien reparte por su cuenta y para
supermercados con reparto a domicilio, distribuidores y empresas de
paquetería.

Para el repartidor:
• Escanea el código de cada paquete o haz una foto a la etiqueta: la
  dirección y el teléfono entran solos (la foto se lee en tu móvil, no se
  envía a nadie).
• La ruta se ordena por tiempo, contando el tráfico típico de cada hora, el
  rato en cada portal y el horario de cada cliente, con la hora estimada de
  cada parada.
• En cada parada: ir con el navegador, llamar o escribir por WhatsApp al
  cliente con su hora de llegada, marcar entregado o no entregado, y cobrar
  (efectivo, tarjeta o Bizum) si el pedido lo lleva.
• Recogidas, urgentes y reintentos para otro día.

Para la oficina:
• Pedidos del día en el mapa, por repartidor y por zona, y dónde va cada
  uno mientras está en jornada.
• Enlace de seguimiento para el cliente sin datos personales.
• Vehículos, inspecciones con foto, taller, ITV y vencimientos.

Privacidad por diseño: cada repartidor ve solo sus pedidos, la ubicación
solo se comparte durante la jornada que él mismo empieza y termina, y los
datos de los clientes se borran solos. Más en flotadsp.com/privacidad.


**Categoría**: Empresa. **Etiquetas**: reparto, rutas, logística, flota.

### Ficha mejorada (21-10-2026): para que la encuentren al buscar

Lo pidieron quienes probaron la app (informe de testerscommunity del 20-10): textos con las palabras que
busca la gente («ruta de reparto», «optimizada», «repartidor», «escanear paquetes», «navegación por voz») y
capturas con una frase encima. Todo lo de abajo lo hace la app hoy (es lo mismo que dice la portada).
«Gratis» va en la descripción larga y no en la corta ni en el nombre: Google no deja precio ni
promociones en el nombre ni en el icono, y por prudencia tampoco se pone en la corta. **Cuando acabe la promoción
(31-12-2026) hay que cambiar el párrafo PRECIO.**

**Descripción corta** (76 de 80):
Ruta de reparto optimizada: escanea paquetes y te guía con voz a cada puerta

**Descripción larga** (2178 de 4000):

```
FDS es la app de reparto para repartidores: escanea los paquetes, la ruta se ordena sola y te guía con voz hasta cada puerta. Sirve con los paquetes de cualquier agencia, plataforma o súper, sin conectarse con ellos.

CARGA LOS PAQUETES EN SEGUNDOS
• Escanea o haz una foto a la etiqueta, sea de la empresa que sea: la dirección y el teléfono entran solos (la foto se lee en tu móvil).
• Escanea seguidos todos los paquetes al cargar la furgoneta.
• ¿Te dan una hoja con la lista? Una foto y entran todas las paradas. También puedes pegarla.
• Busca las direcciones o díctalas con la voz.

RUTA OPTIMIZADA
• La ruta se ordena sola por tiempo, con el tráfico típico de cada hora y el horario de cada cliente.
• Navegación por voz hasta cada puerta dentro de la app, o con Google Maps o Waze.
• El mapa te sigue y recalcula si te desvías; ves la fachada de cada parada.
• Las zonas de carga y descarga cerca de tus paradas, en el mapa.

EN LA PUERTA
• Manos libres en Android: di «entregado» y sigue conduciendo.
• Dónde lo dejas (vecino, buzón, portería…), quién lo recoge y su firma con el dedo.
• Recuerda la última vez en esa puerta: dónde lo dejaste y tu nota.
• Avisa al cliente con tu hora de llegada.
• Sin cobertura no pasa nada: se guarda y se envía al volver la red.
• Escanea un paquete y te dice en qué parada va.

TUS CUENTAS
• Cuánto llevas ganado hoy y la gasolina.
• El historial de cada día y tu semana frente a la anterior.
• El mes entero en un Excel para la gestoría.

PRECIO
Gratis y sin límite hasta el 31 de diciembre de 2026, sin tarjeta. Después, gratis hasta 15 paradas al día, o sin tope por 9,99 € al mes o 99 € al año.

PARA EMPRESAS
Supermercados con reparto a domicilio, distribuidores y empresas de paquetería: panel de la oficina con los pedidos en el mapa, enlace de seguimiento para el cliente, vehículos, revisiones con foto e IA, taller y vencimientos.

PRIVACIDAD
Cada repartidor ve solo sus paradas. Si repartes para una empresa, tu ubicación solo se comparte durante la jornada que tú empiezas y terminas. Los datos de los clientes se borran solos a los días que tú fijes.

En español, inglés, portugués, francés, italiano, alemán y chino.
```

**Frases para las capturas** (una por captura, arriba, letra grande): «Foto a la etiqueta: la dirección entra
sola» · «La ruta se ordena sola» · «Te guía con voz hasta cada puerta» · «Di "entregado" y sigue conduciendo» ·
«Lo que llevas ganado hoy».

### Fichas para Latinoamérica y Brasil (11-10-2026)

En Play Console → Presencia en la tienda → Ficha principal → «Gestionar traducciones» → añadir
**Español (Latinoamérica) – es-419** y **Portugués (Brasil) – pt-BR**, y pegar esto. Sin Bizum (solo existe en
España); la app ya cobra en la moneda del país, con Pix en Brasil. Sin «pruébala sin cuenta»: en la
app no está a propósito (Dani, 04-10: la cuenta es gratis, sería una incongruencia).

**es-419 · Nombre** (≤ 30): FDS – Rutas de reparto

**es-419 · Descripción corta** (≤ 80):
Ordena tu ruta de reparto sola: foto a la guía, mapa y guía por voz. Gratis.

**es-419 · Descripción larga**:
FDS es la app para repartidores y mensajeros de paquetería que reparten por su cuenta.

• Le tomas una foto a la guía o escaneas el código del paquete: la dirección y el teléfono entran solos
  (la foto se lee en tu celular, no se envía a nadie). También puedes pegar una lista de direcciones.
• La ruta se ordena sola por tiempo, con el tráfico típico de cada hora, y ves la hora estimada de cada parada.
• Te guía con voz hasta cada puerta, dentro de la app, o abre tu navegador de siempre.
• En cada parada: llamar o escribir por WhatsApp al cliente, marcar entregado o no entregado y cobrar
  (efectivo, tarjeta o transferencia) si el pedido lo lleva.
• «Mi dinero hoy»: pon cuánto te pagan por entrega y la app te dice cuánto llevas ganado, la gasolina y lo
  que te queda limpio, en la moneda de tu país.
• Al terminar, comparte tu día con una imagen para tu estado.
• Invita a otros repartidores con tu enlace y gana por cada uno que la use (cobro por PayPal).

Gratis y sin límite hasta el 31 de diciembre, sin tarjeta. Después, gratis hasta 15 paradas al día.


**pt-BR · Nome** (≤ 30): FDS – Rotas de entrega

**pt-BR · Descrição curta** (≤ 80):
Organize sua rota de entregas: foto da etiqueta, mapa e guia por voz. Grátis.

**pt-BR · Descrição completa**:
FDS é o app para entregadores e motoristas de encomendas que trabalham por conta própria.

• Tire uma foto da etiqueta ou escaneie o código do pacote: o endereço e o telefone entram sozinhos
  (a foto é lida no seu celular, não é enviada a ninguém). Também dá para colar uma lista de endereços.
• A rota se organiza sozinha por tempo, com o trânsito típico de cada hora, e você vê o horário previsto de
  cada parada.
• O app te guia por voz até cada porta, ou abre o seu navegador de sempre.
• Em cada parada: ligar ou mandar WhatsApp ao cliente, marcar entregue ou não entregue e receber
  (dinheiro, cartão ou Pix) se o pedido tiver cobrança.
• «Meu dinheiro hoje»: informe quanto você ganha por entrega e o app mostra quanto já ganhou, o combustível
  e o que sobra, em reais.
• No fim do dia, compartilhe o seu dia com uma imagem para o seu status.
• Convide outros entregadores com o seu link e ganhe por cada um que usar (pagamento por PayPal).

Grátis e sem limite até 31 de dezembro, sem cartão. Depois, grátis até 15 paradas por dia.


## Seguridad de los datos (cuestionario de Play), respuestas

- ¿Recoge o comparte datos del usuario? **Sí, recoge.**
- Ubicación aproximada/precisa: **Sí**, precisa, **opcional**, solo durante
  la jornada que el usuario inicia; finalidad: funciones de la app; **no se
  comparte** con terceros; se borra a los 30 días.
- Información personal (nombre, correo, teléfono): **Sí**, del usuario y de
  los clientes de la empresa que éste introduce; finalidad: funciones de la
  app; no se comparte; se borra según el plazo de la empresa (30 días por
  defecto).
- Fotos: **Sí** (inspecciones de vehículos y, desde la app nativa 2.0.0, la
  foto de la entrega que hace quien reparte, como prueba de entrega; la foto
  y el vídeo de la etiqueta se leen en el dispositivo y **no se recogen**).
- Cámara y ubicación en la app nativa (2.0.0): la cámara solo con el escáner
  abierto o al hacer una foto; la ubicación solo al pulsar «Ordenar ruta»
  (un punto, con la app abierta, nunca en segundo plano). Ambas opcionales.
- Mensajes, audio, historial de navegación, contactos, calendario, archivos,
  salud, identificadores de dispositivo: **No**.
- Datos cifrados en tránsito: **Sí** (HTTPS). El usuario puede pedir que se
  borren sus datos: **Sí** (contacto@flotadsp.com y desde su empresa).
- ¿Se ha validado de forma independiente? No.

## Riesgos y cosas a vigilar

- **Sin la huella de Play App Signing en `assetlinks.json`**, la app se abre
  con barra de direcciones. Es lo primero que hay que hacer tras el primer
  AAB subido.
- `assetlinks.json` se sirve desde Cloudflare Pages con el fallback de la
  SPA (`/* /index.html 200`): como el fichero existe en `dist`, Pages lo
  sirve tal cual. Comprobado con `curl` tras desplegar; si alguna vez
  devolviera HTML, la verificación de Google falla.
- Chrome tiene que estar instalado y actualizado en el móvil (en Android lo
  está casi siempre). Sin él, la app abre la web en una pestaña normal
  (`FALLBACK_STRATEGY = customtabs`), no falla.
- El escaneo de códigos usa el lector del propio Chrome (`BarcodeDetector`);
  en móviles sin él se escribe el código o se hace la foto.
- Google revisa la primera versión en días (a veces una semana); las
  siguientes, horas.

## Cobrar dentro de la app con Google Play (04-10-2026)

Dentro de la app de Play no se puede cobrar con Stripe (política de Google):
se cobra con **Google Play Billing**. Desde la versión **1.0.2 (versionCode 3)**
la app lleva la librería de cobro (`androidbrowserhelper:billing 1.2.0`) y una
pantalla de pago propia, `PagoActivity`, que:

- elige la oferta de **prueba gratis** si el cliente tiene derecho (la de la
  librería coge la primera de la lista y Google no garantiza el orden);
- liga la compra a la cuenta (`obfuscatedAccountId` = sha256 de la cuenta): el
  servidor rechaza un token de compra de otra cuenta.

El servidor (`POST /billing/play/verificar`) pregunta a Google por la compra
(API `subscriptionsv2`), la **acepta** (sin eso Google la devuelve a los 3
días) y activa la cuenta (`pago_proveedor: play`, `play_hasta`). Sin avisos en
tiempo real: el estado se vuelve a preguntar al abrir la app y antes de
bloquear a nadie. Un regalo canjeado aplaza el cobro de Google (`defer`).

### Lo que hace Dani en Play Console (una vez)

1. Subir `FDS-1.0.2.aab` a la prueba cerrada (o interna).
2. **Monetizar con Play → Productos → Suscripciones → Crear suscripción**, dos veces:
   - ID `repartidor_mensual` · plan base (renovación automática, **1 mes**,
     9,99 €) · marcar el plan base como **compatible con versiones anteriores**.
   - ID `repartidor_anual` · plan base (**1 año**, 99 €) · compatible con
     versiones anteriores.
   - En cada plan base, **oferta**: «Prueba gratuita» de **7 días**, para
     clientes nuevos. Activar plan base y oferta.
3. **Cuenta de servicio** para que el servidor compruebe las compras:
   - Google Cloud Console → proyecto → activar «Google Play Android Developer API».
   - Crear cuenta de servicio → Claves → Añadir clave JSON (se descarga un fichero).
   - Play Console → Usuarios y permisos → Invitar al correo de esa cuenta de
     servicio, con «Ver información financiera» y «Gestionar pedidos y suscripciones».
   - Guardar el JSON en `C:\Users\Usuario\.flota-play-cuenta.json`. Se sube a
     Fly como secreto `GOOGLE_PLAY_CUENTA_SERVICIO` (nunca al repositorio).
4. **Probar sin pagar**: Ajustes → Pruebas de licencia → añadir el Gmail de
   prueba. Con esa cuenta los cobros son de prueba y las renovaciones van rápidas.

Mientras no esté el secreto, la app no enseña el pago con Google y no pide
tarjeta a quien se da de alta desde la app.
