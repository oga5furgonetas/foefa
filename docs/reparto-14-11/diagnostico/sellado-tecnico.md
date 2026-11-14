# Foto de entrega sellada: con qué piezas se hace a coste cero y qué tiene ya FDS

Fecha: 14-11-2026. Parte técnica de la investigación «demostrar y cobrar».

## Qué he hecho

- He leído el repo (`C:/Users/dlvie/foefa-p0`, solo lectura): el endpoint de estado del pedido y la foto de entrega en
  `backend/server.py` (líneas 62227-62311), la foto en la web (`frontend/src/pages/driver/MiRuta.jsx`, 1044-1120 y
  2206-2256), en la nativa (`app-android/.../ui/hoy/Hojas.kt` 500-633, `ui/Foto.kt`, `ui/Acciones.kt` 93-103), la
  limpieza de datos (`server.py` 60474-60505, `reparto.py` línea 29), quién puede ver la foto (`server.py` 61390-61400), el
  enlace de seguimiento (`server.py` 61445-61506 y `SeguimientoPedido.jsx`), «Entrega verificada» (`server.py`
  62169-62224, `reparto.py` 1249-1300), `MisDnr.jsx`, y la parte de empresas: la cadena de firmas
  (`server.py` 18540-18790), el comprobador público `/verify/{hash}` (19779-19820), `SelloFoto.jsx` y `lib/sello.js`.
- He buscado en Internet las piezas técnicas (sellos de tiempo, OpenTimestamps, C2PA, atestación de Android, Play
  Integrity, ubicación simulada, WhatsApp, precios de R2 y de sellos cualificados) y el valor legal (eIDAS art. 41,
  jurisprudencia sobre pruebas de WhatsApp).
- He hecho las cuentas del almacenamiento.

---

## Hallazgos, de más a menos importante

### 1. Lo que hoy NO tiene la foto de entrega de FDS: justo lo que haría falta para una reclamación (fuerte, repo)

La foto de entrega existe y funciona, pero no sirve todavía como justificante que se busca semanas después:

- **Se borra a los 30 días por defecto** (máximo 90). `reparto.py:29` `DIAS_CONSERVAR = 30`; la limpieza
  (`server.py:60485-60494`) pone a `None` la foto, la firma, la dirección y el cliente de los pedidos más viejos, y el
  ajuste de la empresa está acotado a 1-90 días. Si la reclamación o el descuento de la agencia llega en la liquidación
  del mes siguiente, la foto puede haber desaparecido ya.
- **El intento fallido no puede llevar foto.** Si el estado no es «entregado», el servidor borra foto, firma y dónde
  (`server.py:62290-62292`). Para el «ausente» (lo que más dinero cuesta) solo queda el registro del intento (hora de
  llegada, llamada, WhatsApp, espera), sin foto.
- **El repartidor no puede volver a ver su foto.** La única ruta que devuelve la foto es `GET /reparto/pedidos/{pid}/foto`
  y exige `require_admin` y permiso de datos (`server.py:61390-61393`). Un conductor de empresa no la ve; el autónomo,
  solo si su cuenta es de oficina (sospecha: no lo he comprobado). Tampoco hay historial ni búsqueda por código de
  paquete, ni forma de compartirla.
- **No se guarda con la foto ni el GPS ni la huella.** La posición del móvil solo se guarda como «puerta aprendida» y solo
  si es precisa (≤ 50 m) y está a ≤ 300 m de lo buscado (`reparto.py:1230-1246`); si no, se tira. No hay SHA-256 de la
  foto, ni cadena, ni sello de tiempo.
- **La hora la pone el móvil.** `_rep_hora_hecho` acepta la hora que manda el móvil (`hecho_en`) si es de las últimas 12 h
  (`server.py:62156-62166`), y no se guarda aparte la hora de llegada al servidor. Para la cola sin cobertura está bien,
  pero para un justificante es un punto débil: el móvil puede tener la hora cambiada.
- **Sin cobertura, la foto se puede perder.** En la web, si el almacenamiento local no da para la foto, la entrega se
  guarda sin ella (`MiRuta.jsx:1090-1094`, y el comentario de la línea 87).
- **La foto no sale de la app como prueba.** La web la recomprime en el navegador (640 px, calidad 0,6, unos 40-70 KB,
  `MiRuta.jsx:2219-2228`) y la nativa a 1.280 px y calidad 75 hasta caber en 280.000 caracteres base64
  (`Hojas.kt:606-633`). Las dos recompresiones borran el EXIF (la nativa lo dice en su comentario). Se guarda como texto
  base64 dentro del documento del pedido en Mongo, no en R2 (`server.py:62251-62260`).
- **En la nativa la foto la hace la app de cámara del sistema**, no FDS: `rememberHacerFoto` lanza el intent de cámara
  con un fichero de FDS (`Foto.kt:18-28`). Eso evita la galería, pero no prueba que la imagen salga de la cámara del
  móvil. En la web, `<input type=file accept="image/*" capture="environment">` (`MiRuta.jsx:2221`): según el navegador
  se puede elegir un fichero (sospecha: no lo he probado aquí).

Fuente: el repo, en las líneas citadas.

### 2. FDS ya tiene casi todas las piezas de servidor, en la parte de empresas (fuerte, repo)

- **Cadena de huellas**: cada firma de revisión guarda `prev_hash` (la huella de la anterior de la empresa) y
  `content_hash` = SHA-256 de un JSON canónico (`server.py:18540-18570`, `18694-18757`), con reintento si dos firmas
  chocan y un índice único por huella. Es exactamente la «cadena de huellas» que pide la idea.
- **Comprobador público** `GET /api/verify/{hash}` sin sesión, con límite de uso por IP, que localiza la empresa por un
  índice global y comprueba que la huella sale de lo guardado (`server.py:19779-19820`). Pide los 64 caracteres: no hay
  código corto ni QR para el cliente final (en el PDF de peritaje sí hay QR, `server.py:18824`, «reportlab + qrcode»).
- **Honradez ya escrita en el código**: «NO firma electrónica avanzada eIDAS» (`server.py:18542`) y el PDF dejó de decir
  «sello temporal» porque «no hay sellado de tiempo de un tercero» (`server.py:19439-19443`).
- **Punto débil a no copiar**: la firma de revisiones mete en la huella las URL de las fotos, no sus bytes
  («URL inmutable = foto inmutable», `server.py:18560`). Si alguien cambia el fichero en R2 detrás de la misma URL, la
  cadena no lo detecta. Para la foto de entrega, la huella tiene que ser la de los bytes de la imagen.
- **`SelloFoto.jsx`** es una etiqueta HTML encima de la imagen, con la fecha de llegada al servidor
  (`components/SelloFoto.jsx:3-5`): no queda grabada en la imagen; al reenviarla por WhatsApp no viaja.
- **No hay sello de tiempo de terceros** en ningún sitio: busqué RFC 3161 / TSA / OpenTimestamps y no aparece.

### 3. Un sello de tiempo gratis y creíble existe: OpenTimestamps; las TSA gratuitas son frágiles (fuerte, Internet)

- **OpenTimestamps**: los servidores de calendario públicos «free to use» y sin registro ni clave
  ([opentimestamps.org](https://opentimestamps.org/), consultado 14-11-2026). Agrupan muchas huellas en una sola
  transacción de Bitcoin; la confirmación tarda «a few hours»
  ([README del cliente, GitHub](https://github.com/opentimestamps/opentimestamps-client), consultado 14-11-2026). Hay
  librería de Python (`opentimestamps-client` / `python-opentimestamps`), de JavaScript (`javascript-opentimestamps`),
  Java y Rust (opentimestamps.org). Para comprobar con el cliente oficial hace falta un nodo de Bitcoin Core («a pruned
  node is fine», README). Lo bueno: no depende de que FDS ni nadie siga vivo; se manda solo la huella (ni foto ni datos
  personales). Lo malo: la prueba queda «pendiente» unas horas y hay que pedir la mejora (`ots upgrade`) más tarde; y
  explicárselo a un juez cuesta más que un sello RFC 3161.
- **FreeTSA** (RFC 3161, gratis): el sitio no dice quién está detrás con nombre de empresa (contacto en un dominio
  particular, «busindre»), no promete disponibilidad ni da límites con números, solo «(do not abuse)»; su certificado
  nuevo vale desde el 16-03-2026 «until February 2040» y el anterior dejó de valer en marzo de 2026
  ([freetsa.org](https://freetsa.org/), consultado 14-11-2026). Sirve como segundo sello, nunca como único.
- **ACCV** (Generalitat Valenciana) da sellos cualificados RFC 3161 gratis, pero solo «for personal use (citizens)»; el
  uso profesional se contrata y sin contrato pueden cortar el servicio
  ([accv.es](https://www.accv.es/en/servicios/empresas/sellado-de-tiempo/), consultado 14-11-2026). Una app comercial no
  debe usarlo.
- **Sellos cualificados eIDAS** de pago: Camerfirma, 180 € + IVA la bolsa de 1.000 (0,18 €/sello)
  ([shop.camerfirma.com](https://shop.camerfirma.com/bolsa-de-1000-sellos-de-tiempo), consultado 14-11-2026);
  certificados.eu 300 € los 1.000; Mensatek 0,029-0,043 € (estos dos, solo buscador). Con 100 fotos al día por
  repartidor no es viable sello a sello; sí lo sería **un sello al día** por empresa sobre la huella del día (0,18 € × 30
  = 5,4 €/mes), pero ya no es coste cero.
- **Qué vale en juicio**: el art. 41.1 de eIDAS dice que a un sello de tiempo no se le puede negar efecto ni admisión como
  prueba solo por no ser cualificado; el cualificado (41.2) añade la presunción de exactitud de la hora y de integridad
  ([legislation.gov.uk, Reglamento 910/2014 art. 41](https://www.legislation.gov.uk/eur/2014/910/article/41), solo
  buscador). Es decir: el sello gratis se admite, pero quien lo aporta tiene que defenderlo.

### 4. Lo que de verdad decide: una reclamación de la agencia no es un juicio, y en un juicio la foto de WhatsApp se puede impugnar (media)

- El Tribunal Supremo (STS 300/2015, sobre mensajes de Tuenti, citada para WhatsApp) pide «todas las cautelas» por la
  facilidad de manipulación, y si la otra parte impugna, la carga de probar la autenticidad es de quien la aporta, a
  menudo con pericial informática (comentarios en [legaltoday.com](https://www.legaltoday.com/practica-juridica/derecho-publico/derecho-administrativo/la-conversacion-de-un-whatsapp-como-prueba-2017-01-04/),
  solo buscador). Sospecha razonable, no comprobada: una reclamación de «no recibido» se discute con la oficina de la
  agencia, no en un juzgado; allí lo que pesa es que la foto aparezca en segundos, con hora, sitio y código del paquete,
  y que sea difícil de fabricar. El sello criptográfico suma credibilidad, pero no es lo que gana la discusión.
- Consecuencia de diseño: «prueba irrefutable» no; «registro con fecha, lugar y huella que cualquiera puede comprobar»
  sí.

### 5. WhatsApp borra los datos ocultos de la foto y la recomprime: el sello tiene que ir VISIBLE y con un enlace (media)

- En envío normal, WhatsApp recomprime (unos 1.600 px el lado largo, 70-100 KB) y en ese proceso quita el EXIF y el GPS;
  solo «enviar como documento» conserva el fichero original (varias guías de 2025-2026, de calidad desigual:
  [fast.io](https://fast.io/resources/whatsapp-telegram-signal-photo-metadata-preservation/),
  [ghacks.net](https://www.ghacks.net/how-to-send-pictures-on-whatsapp-in-high-quality/), solo buscador). No encontré
  ninguna prueba hecha con C2PA a través de WhatsApp; como C2PA va en el mismo contenedor que el EXIF, lo más probable es
  que se pierda (sospecha, no comprobada).
- Por eso lo que viaja por WhatsApp tiene que ser: **la foto con el sello pintado dentro** (hora, dirección corta, código
  del paquete, coordenadas, y un código corto) y **un enlace** a la página de comprobación, donde está el original y su
  huella. La foto recomprimida ya no tendrá la misma huella, y no pasa nada: la comprobación se hace contra el original
  guardado, con el código corto que se lee en la imagen.
- El sello visible de las «cámaras GPS» es un producto que ya existe y gratis: «Timestamp Camera» tiene más de 10
  millones de descargas ([appbrain.com](https://www.appbrain.com/app/timestamp-camera-auto-gps-cam/timestamp.geotag.camera.gpsmapcamera),
  solo buscador). El sello visible solo NO diferencia a FDS (se falsifica en cualquier editor); lo que diferencia es que
  se encuentre por código de paquete y que se pueda comprobar.

### 6. Que la foto se hizo en la app y en un móvil de verdad: en Android se puede, gratis; en la web, no (media)

- **Atestación de clave de Android (Keystore)**: gratis, sin cupo de Google. La app crea una clave dentro del hardware
  (TEE o StrongBox) y manda al servidor la cadena de certificados; si la raíz es la de Google y nada está revocado, «Your
  key is in hardware that Google believes to be secure». La validación se hace en el servidor, nunca en el móvil, y Google
  da una librería de Kotlin para verificarla y la lista de revocados en `android.googleapis.com/attestation/status`
  ([developer.android.com, Key attestation](https://developer.android.com/privacy-and-security/security-key-attestation),
  consultado 14-11-2026). Con eso la nativa puede **firmar en el móvil** la huella de cada foto con una clave que no sale
  del hardware: prueba que la firmó ESE móvil con la app.
- **Play Integrity**: 10.000 peticiones al día gratis por proyecto; para más, se pide con un formulario y hay que tener la
  app en Google Play y el proyecto de Cloud enlazado
  ([developer.android.com, quota limits](https://developer.android.com/google/play/integrity/quota-limits) y
  [setup](https://developer.android.com/google/play/integrity/setup), consultado 14-11-2026). Basta pedirlo una vez al
  día por móvil o al empezar la jornada, no por foto: 10.000 al día dan para miles de repartidores.
- **Ubicación simulada**: `Location.isMock()` desde Android 12 (API 31), `isFromMockProvider()` antes; para versiones
  viejas, `LocationCompat.isMock()` (referencia de Android, solo buscador). Las apps de GPS falso más corrientes se
  detectan con eso; un atacante serio no. Las mediciones GNSS en bruto (`GnssMeasurement`, Android 7+) permiten detectar
  suplantación, pero es investigación, no algo para hacer ahora
  ([NAVI, Universidad de Colorado](https://navi.ion.org/content/69/3/navi.537), solo buscador).
- **Hora**: lo honrado es guardar las dos, la del móvil y la de llegada al servidor, y enseñar la diferencia. Si la foto
  se sella al volver la red, la hora de la foto la dice el móvil y la hora segura es la del sello («existía antes de...»).
- **Foto desde la cámara y no desde la galería**: en la nativa, con CameraX dentro de la app (ya se usa en el escáner,
  `ui/escaner/EscanerPantalla.kt:308-375`) en vez del intent de la cámara del sistema. En la web no hay forma fiable: el
  `<input capture>` es una sugerencia al navegador y no hay atestación de hardware ni `isMock`. **La web pierde casi toda
  la parte de «móvil de verdad»**; conserva la huella, la hora del servidor y la cadena.

### 7. C2PA (Content Credentials) en 2026: posible en Android, pero hoy no compensa (media)

- El Pixel 10 firma con C2PA cada foto de su cámara y Google dice que llegó al nivel de garantía 2 del programa de
  conformidad ([blog de seguridad de Google, 10-09-2025](https://security.googleblog.com/2025/09/pixel-android-trusted-images-c2pa-content-credentials.html),
  solo buscador, el texto no cargó). El Galaxy S25 solo marca las fotos editadas con IA (c2paviewer.com, solo buscador).
- Existe `c2pa-android` (Kotlin sobre la librería en Rust, firma con clave en memoria o con una función propia) y una app
  de ejemplo con CameraX marcada como prototipo
  ([opensource.contentauthenticity.org](https://opensource.contentauthenticity.org/docs/c2pa-android-example/), solo
  buscador).
- El problema: un certificado hecho por FDS no está en la lista de confianza de C2PA, y los comprobadores lo marcan como
  de origen desconocido; la propia C2PA dice que una credencial con un certificado fuera de la lista no verifica nada
  (resumen de [c2pa.org, white paper 09-2025](https://c2pa.org/wp-content/uploads/sites/33/2025/10/content_credentials_wp_0925.pdf)
  y guías de terceros, solo buscador). Entrar en la lista exige certificado de una CA reconocida y conformidad: no es
  gratis. Y WhatsApp lo borraría (hallazgo 5). Conclusión: dejarlo para más adelante.

### 8. Las cuentas: guardar la foto completa 12 meses deja de ser gratis a partir de 3-4 repartidores (fuerte, cálculo con precios oficiales)

Precios de R2 (página oficial, «Last updated: Oct 30, 2026»,
[developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/), consultado 14-11-2026): gratis cada
mes 10 GB-mes de almacenamiento estándar, 1 millón de operaciones de clase A (subidas) y 10 millones de clase B
(lecturas), salida gratis; por encima, 0,015 $/GB-mes, 4,50 $/millón de clase A y 0,36 $/millón de clase B. La capa
gratis no vale para «Infrequent Access».

Supuesto: 100 fotos al día, 25 días al mes = 2.500 fotos al mes por repartidor.

| Qué se guarda | Por repartidor y mes | Guardado 12 meses (régimen) | Repartidores gratis (10 GB) | Coste por repartidor y mes por encima |
|---|---|---|---|---|
| Foto 80 KB | 200 MB | 2,4 GB | 4 | 0,036 $ |
| Foto 150 KB | 375 MB | 4,5 GB | 2 | 0,068 $ |
| Foto 80 KB, 3 meses | 200 MB | 0,6 GB | 16 | 0,009 $ |
| Miniatura 15 KB + huella, 12 meses | 37,5 MB | 0,45 GB | 22 | 0,007 $ |
| Solo huella y datos (~0,5 KB) | 1,25 MB | 15 MB | miles | ~0 |

- Subidas: 2.500 por repartidor y mes; el millón gratis da para unos 400 repartidores.
- Con 100 repartidores y fotos de 80 KB a 12 meses: 240 GB → (240 − 10) × 0,015 ≈ **3,5 $/mes**; con 150 KB, ≈ 6,6 $/mes.
  Es poco, pero no es cero.
- **Hoy las fotos van en Mongo, no en R2**, y en base64 (un 33 % más). El volumen de `flota-mongo` se creó de 3 GB según
  el comentario de `infra/mongo/fly.toml:23`. Con la foto de la nativa (hasta ~200 KB en base64), 100 fotos al día y
  30 días, son unos 0,5 GB por repartidor activo: **con 5-6 repartidores de verdad el disco de la base se llena** (cálculo
  mío; no he mirado cuánto ocupa hoy). Si la función crece, las fotos tienen que salir de Mongo.
- Alternativa a coste cero de verdad: **la foto completa se queda en el móvil** (con su huella) y al servidor van solo la
  huella, los datos y una miniatura. Riesgo: si el repartidor cambia de móvil o borra la app, pierde las fotos; la huella
  en el servidor prueba que existió, pero sin el original no se puede enseñar. Mitigación gratis: que la app guarde las
  fotos en una carpeta del móvil que él pueda copiar, y que sea él quien elija subirlas en un caso concreto.

---

## Inventario: qué sirve tal cual, qué hay que adaptar y qué falta

**Sirve tal cual**
- La cámara y la compresión de la foto en las dos apps (`Hojas.kt:601-633`, `MiRuta.jsx:2219-2231`).
- El registro del intento (hora de llegada, llamada, WhatsApp, espera) y su visualización en el enlace del cliente
  (`reparto.py:1208-1227`, `SeguimientoPedido.jsx:157-162`).
- La cola sin cobertura con la hora del hecho (`MiRuta.jsx:1057-1099`, `_rep_hora_hecho`).
- La posición con precisión en la nativa (`Acciones.kt:93-103`) y en la web (`MiRuta.jsx:1109-1114`).
- El código del paquete en el pedido cuando entra escaneado.
- El patrón de cadena de huellas, el índice global y el límite de uso del comprobador público (`server.py:18540-18790`,
  `19779-19820`).
- La generación de QR que ya usa el PDF de peritaje.
- El tono honrado de los textos («no es firma eIDAS», «no hay sellado de un tercero»).

**Hay que adaptar**
- El estado «fallido» tiene que poder llevar foto (hoy se borra).
- La huella tiene que ser de los bytes de la foto, calculada en el móvil antes de mandarla, no de una URL.
- Guardar con la foto: lat, lng, precisión, `isMock`, hora del móvil, hora de llegada al servidor, código del paquete,
  dirección; y no tirar la posición si no es precisa (guardarla con su precisión).
- El plazo de borrado: hoy 30 días por defecto y 90 como máximo. Para cuadrar liquidaciones y reclamaciones hacen falta
  al menos 3-6 meses (decisión de Dani y de privacidad: separar la foto del paquete, que se conserva, de los datos del
  cliente, que se borran a los 30 días).
- El permiso: que el propio repartidor vea, busque y comparta sus fotos.
- La foto nativa, con CameraX dentro de la app en vez del intent de cámara, para poder decir «hecha en FDS».
- El comprobador público: código corto (8-10 caracteres) además de la huella de 64, y una página para cualquiera.
- `SelloFoto.jsx`: hoy pinta HTML encima; hay que pintar el sello dentro de la imagen (canvas en web, `Canvas` de
  Android en nativa) en la copia que se comparte.

**Falta**
- Historial y búsqueda por código de paquete, fecha y dirección para el repartidor.
- Botón «Mandar por WhatsApp» con la imagen sellada y el enlace de comprobación.
- Anclaje externo de la cadena (OpenTimestamps del resumen del día).
- Atestación de clave de Android y firma de la huella en el móvil.
- El recuento del día y del mes (entregas por tarifa), que no es de esta parte, pero sale de los mismos datos.
- Sacar las fotos de Mongo (a R2 o al móvil) si se usa de verdad.

---

## Propuesta de arquitectura mínima, por orden de construcción (coste cero al mes)

**Paso 1, el que más credibilidad da por menos trabajo: registro con huella, encontrable y compartible.**
1. En el móvil, al hacer la foto: SHA-256 de los bytes del JPEG final (Web Crypto `crypto.subtle.digest` en web,
   `MessageDigest` en Android), con hora del móvil, lat/lng/precisión, `isMock` (nativa) y código del paquete.
2. En el servidor: guarda la entrada con la hora de llegada, y la encadena a la anterior del mismo repartidor
   (`prev_hash`, como `forensic_signatures`), con un código corto.
3. Foto también para «no entregado / ausente».
4. Pantalla «Mis pruebas» para el repartidor: busca por código de paquete o fecha; abre la foto en segundos.
5. Compartir: genera en el móvil una copia con el sello pintado dentro (hora, calle y número, código del paquete, código
   corto) y la manda por WhatsApp con un enlace `/comprobar/<código>`; la página pública enseña la miniatura, la hora del
   servidor, la huella y si la cadena cuadra, sin nombre ni teléfono del cliente.
6. Texto honrado en la página: «Registro de FDS: la foto se guardó a esta hora y no ha cambiado desde entonces», nunca
   «prueba irrefutable».

**Paso 2: anclaje externo gratis, una vez al día.**
- Cada noche, la raíz del día (una huella de todas las huellas de ese día, todas las empresas) va a OpenTimestamps; se
  guarda el `.ots` y se mejora al día siguiente. Con eso FDS ya no puede reescribir el pasado sin que se note. Opcional:
  la misma raíz a FreeTSA como segundo sello. Una sola petición al día: sin problemas de límites. Sin fotos ni datos
  personales fuera.

**Paso 3: «hecho en un móvil de verdad con FDS» (solo Android nativa).**
- Clave en el Keystore con atestación al dar de alta el móvil; el servidor valida la cadena una vez. Cada huella va
  firmada en el móvil. Play Integrity una vez al día por móvil (10.000 gratis al día). CameraX dentro de la app.

**Paso 4: almacenamiento.**
- Por defecto, la foto completa en el móvil y en el servidor la huella, los datos y una miniatura de ~15 KB. Si se
  guarda la foto completa, a R2 (no a Mongo) y con plazo de 3 meses: gratis hasta unos 16 repartidores; después, unos
  céntimos por repartidor y mes.

**Lo que NO haría**: C2PA (certificado fuera de la lista de confianza y WhatsApp lo borra), sellos cualificados por foto
(0,18 € cada uno), ACCV (sus condiciones no lo permiten), detección por GNSS en bruto, y prometer nada en la web que
dependa de que el móvil «es de verdad».

---

## Mi veredicto

En mi parte, la hipótesis se sostiene **técnicamente**: una foto de entrega con huella, hora del servidor, cadena y
anclaje diario en Bitcoin se puede hacer a coste cero y con piezas que FDS ya tiene en la parte de empresas. Pero hay que
decirlo claro: **lo que hoy tiene la app de reparto no sirve todavía para «demostrar y cobrar»**: la foto se borra a los
30 días, el ausente no puede llevar foto, el repartidor no puede volver a verla, no hay búsqueda, no hay huella, y la
hora la pone el móvil. Y lo técnico no es lo que decide si alguien instala la app: el sello visible ya lo dan gratis
cámaras GPS con más de 10 millones de descargas, y una reclamación de la agencia se gana enseñando la foto rápido, no
con criptografía. Lo criptográfico es un extra de confianza, no el gancho. El coste cero se rompe con la foto completa
guardada 12 meses a partir de 3-4 repartidores (en R2) y, hoy, mucho antes por el disco de Mongo; se arregla dejando el
original en el móvil o guardando 3 meses.

## Lo que yo haría

1. No construir nada de sellos todavía: primero que otra parte de la investigación confirme que el repartidor busca su
   foto cuando le reclaman, y con qué plazo (eso fija cuánto hay que guardar).
2. Si se confirma, el paso 1 (huella en el móvil + hora del servidor + cadena + «Mis pruebas» con búsqueda + compartir por
   WhatsApp con sello visible y enlace) y foto también para el ausente. Es lo que más credibilidad da por menos trabajo.
3. El anclaje diario con OpenTimestamps (un trabajo nocturno, una petición al día): barato y cambia «confía en FDS» por
   «compruébalo tú».
4. Ampliar el plazo de la foto separándola de los datos del cliente, y sacar las fotos de Mongo antes de crecer.
5. Atestación de Android y CameraX solo cuando haya repartidores usándolo de verdad.
6. Nada de C2PA, sellos cualificados por foto ni ACCV.
