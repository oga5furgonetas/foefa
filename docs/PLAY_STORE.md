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
  oficina al panel, nuevo a entrar/darse de alta.

Si algún día hace falta algo que la web no puede (escaneo en segundo plano,
avisos sin Chrome), se cambia por una app nativa; la cuenta, el paquete
(`com.flotadsp.flota`) y la clave de firma valen igual.

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
./gradlew bundleRelease assembleRelease
```

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

### Resumen de lo que necesito de ti

1. La **huella SHA-256** de Play App Signing (paso 3).
2. El usuario de la **cuenta para el revisor** de Google (paso 5).
3. Avisarme cuando la cuenta sea **de empresa** para hacer la integración
   del paso 7.

## Textos para la ficha

**Nombre**: Flota

**Descripción corta** (≤ 80):
Reparto y flota: escanea paquetes, ruta ordenada, llama al cliente.

**Descripción larga**:
Flota es la app de reparto y gestión de flota para repartidores autónomos,
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

Prueba sin registrarte en flotadsp.com/prueba-reparto.

**Categoría**: Empresa. **Etiquetas**: reparto, rutas, logística, flota.

## Seguridad de los datos (cuestionario de Play), respuestas

- ¿Recoge o comparte datos del usuario? **Sí, recoge.**
- Ubicación aproximada/precisa: **Sí**, precisa, **opcional**, solo durante
  la jornada que el usuario inicia; finalidad: funciones de la app; **no se
  comparte** con terceros; se borra a los 30 días.
- Información personal (nombre, correo, teléfono): **Sí**, del usuario y de
  los clientes de la empresa que éste introduce; finalidad: funciones de la
  app; no se comparte; se borra según el plazo de la empresa (30 días por
  defecto).
- Fotos: **Sí** (inspecciones de vehículos; la foto de la etiqueta se
  procesa en el dispositivo y **no se recoge**).
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
