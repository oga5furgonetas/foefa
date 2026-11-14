# Cámaras con sello de hora y GPS: ¿las usan los repartidores para cubrirse? ¿Hay alguna del repartidor?

Fecha: 14-11-2026. Investigación con WebSearch y WebFetch.

## Qué he hecho y qué no he podido

- He sacado las cifras de las cámaras de sello en AppGoblin (que copia los datos de Google Play; la ficha de Play no se deja leer
  con mi herramienta: devuelve 130 caracteres) y en la App Store (fichas y reseñas, que sí se leen).
- He leído las reseñas visibles de la App Store de GPS Map Camera y de Timemark buscando reparto, paquetes, reclamaciones.
- He buscado apps de «prueba de entrega para el repartidor suelto» en inglés, español y portugués, y he abierto las que salieron.
- He mirado qué prueba de entrega dan Spoke (Circuit), Zeo, Routin, Xpedit.
- **No he podido leer Reddit**: la búsqueda limitada a reddit.com da error (Reddit bloquea al buscador) y las búsquedas abiertas no
  devuelven hilos de r/AmazonDSPDrivers, r/AmazonFlexDrivers, r/couriersofreddit, etc. Tampoco TikTok (la página llega vacía) ni el
  texto de un YouTube Short. Así que la parte «qué aconsejan en los foros» está floja: lo que hay sale de guías de terceros que
  citan a conductores, no de los hilos. Es la mayor laguna del informe.
- SpotLens, Conota y Dat Camera: no encontré fichas con cifras (o no existen con ese nombre, o son muy pequeñas). No las cuento.

## Hallazgos, de más a menos importante

### 1. Ya existen varias apps hechas justo para «el repartidor guarda sus pruebas», y ninguna ha despegado (MATIZA, fuerte)

Esto es lo más importante: la idea (a) no es nueva y quien la ha probado no ha encontrado masa, al menos todavía.

- **«Delivery Driver Parcel Proof»** (PepperTools, iPhone): «Built for one driver, not for a fleet». Sello en la foto (fecha,
  hora, GPS, dirección, logo), **búsqueda por número de seguimiento, sitio o nota**, filtros hoy/7/30 días, PDF del día para mandar
  por mensajería, marca de «paquete dañado», sin cuenta, todo en el móvil, 17 idiomas. Pago único (17,99 SAR, unos 4,5 euros).
  **Sin valoraciones suficientes para mostrar nota.** Es casi exactamente la función (a) propuesta.
  https://apps.apple.com/sa/app/delivery-driver-parcel-proof/id6811637065 (leída 14-11-2026)
- **SnapProof** (iPhone, salida feb-2026): cámara de sello pensada para DoorDash/Uber Eats/Amazon Flex, sin cuenta, 5 fotos gratis
  y después pago. **0 valoraciones** según el rastreador y «no hay suficientes» en la App Store.
  https://snapproof.pro/blog/proof-of-delivery-photos/ (post del 25-03-2026) y https://appgoblin.info/apps/6759391608 (solo buscador)
- **PicAnchor**: cámara con sello y código de verificación de 16 caracteres (verify.picanchor.com), gratis para un conductor
  suelto; no muestra búsqueda de fotos antiguas. No encontré su ficha en ninguna tienda.
  https://www.picanchor.com/for/delivery (leída 14-11-2026)
- **MoveDefense** (Android y web): «dispute proof app» para conductores de plataformas: registro de paradas, kilómetros, gasolina,
  fotos y notas, y un **PDF «paquete de disputa»** para apelar bajas o «no recibido». 3,99 y 6,99 $/mes. No encontré ni una
  valoración ni cifra de usuarios. https://movedefense.com/ (leída 14-11-2026)

Lectura honrada: hay al menos cuatro intentos de 2025-2026 de «app de pruebas del repartidor» y ninguno tiene tracción visible.
Sospecha (no probada): o la necesidad no es lo bastante fuerte para instalar algo aparte, o la cubre ya la cámara genérica, o estas
apps no tienen con qué darse a conocer.

### 2. Las cámaras genéricas de sello son enormes, gratis, y unos pocos repartidores ya las usan para eso (APOYA la necesidad, TUMBA el gancho; fuerte)

| App | Instalaciones (Android) | Nota | Precio | Fuente |
|---|---|---|---|---|
| Timestamp Camera (Bian Di) | 95,9 M | 4,7 (434 mil) | Gratis con anuncios, sin compras | https://appgoblin.info/apps/com.jeyluta.timestampcamerafree |
| GPS Map Camera (GPS Map Camera UK) | 149,8 M | 4,32 (398 mil) | Gratis con anuncios y compras | https://appgoblin.info/apps/com.gpsmapcamera.geotagginglocationonphoto |
| Timemark (OG Co.) | 25,3 M | 4,83 (1 M) | Gratis, sin anuncios, compras (nube, equipos) | https://appgoblin.info/apps/com.oceangalaxy.camera.new |
| NoteCam Lite (Derekr) | 23,5 M | 4,17 (24 mil) | Gratis | https://appgoblin.info/apps/com.derekr.NoteCam (solo buscador) |
| GPS Map Camera iOS (Susamp Infotech) | — | 4,6 (8,3 mil, App Store) | Compras de 2,99 a 19,99 $ | https://apps.apple.com/us/app/gps-map-camera-geo-photos/id1503116917 |
| Timemark iOS | — | 4,8 (17 mil, App Store) | Gratis | https://apps.apple.com/us/app/timemark-timestamp-camera-gps/id6446071834 |
| Solocator | ~5 mil (iOS) | 4,3 | Pago | https://appwisp.com/app/ios/.com.solocator.solocator (solo buscador) |

Cifras de AppGoblin leídas el 14-11-2026; son de la ficha de Play pero el rastreador puede ir con retraso.

**Qué estampan y cómo se ve el sello:**
- GPS Map Camera: un recuadro abajo con **mini-mapa a la izquierda** y, al lado, dirección, coordenadas, fecha y hora; opcional
  tiempo, brújula, altitud, QR al sitio, logo, nombre de empresa, proyecto, teléfono, número de foto. En la versión gratis lleva la
  marca de la app; el plan de pago la quita (la ficha de Play: que el cliente «vea tu empresa, no la nuestra», según el resumen del
  buscador de https://play.google.com/store/apps/details?id=com.gpsmapcamera.geotagginglocationonphoto&hl=en_US, solo buscador).
- Timestamp Camera: texto de fecha/hora en tiempo real, 61 formatos, 7 posiciones, opacidad; opcional GPS, mapa, brújula, texto,
  logo. También vídeo. Guardado: solo «directo a la tarjeta SD»; **no describe álbumes ni búsqueda**.
- Timemark: hora de la red (no se falsea cambiando el reloj), dirección, GPS, notas, plantillas; detecta GPS falso («Virtual
  location detected») y pone un **«Photo Code» que cualquiera comprueba en verify.timemark.com** sin cuenta. Organiza por proyecto,
  persona y fecha solo en «Teamspace» (web de equipos); copia en Google Drive/OneDrive solo en planes de pago.
  https://www.timemark.com/llms.txt y https://www.timemark.com/solutions/proof-of-delivery-photo (leídas 14-11-2026)

**Cómo se guardan y se buscan:** en ninguna de las grandes he visto búsqueda por dirección o por código de paquete para el usuario
suelto. Van al carrete del móvil (GPS Map Camera tiene copia en Google Drive). Timemark ordena por proyecto/fecha/persona, pero
pensado para equipos. **Encontrar la foto de una entrega concreta semanas después es justo lo que no resuelven.** (Ausencia de
dato en las fichas, no prueba de que no exista.)

**Repartidores que ya las usan (citas reales, pocas):**
- Reseña de GPS Map Camera, App Store, 01-06-2021: un repartidor de supermercado la usa como «photo proof» tras dejar la compra,
  contra clientes que dicen que no llegó. Y otra de 2026 (4 de mayo): sirve de prueba de que estuvo allí y con clientes difíciles,
  pero se queja de los anuncios. https://apps.apple.com/us/app/gps-map-camera-geo-photos/id1503116917?see-all=reviews&platform=iphone
- Reseña de Timemark, App Store, 15-11-2025: la usa para **DoorDash**, cambia el texto de entrega, añade el piso a la dirección y
  pone el logo de DoorDash; cree que le quita pedidos fraudulentos.
  https://apps.apple.com/us/app/timemark-timestamp-camera-gps/id6446071834?see-all=reviews&platform=iphone
- Otra reseña de Timemark (18-09-2024) pregunta cuánto vale la foto como prueba en una disputa; el desarrollador contesta con la
  hora de red, el bloqueo del GPS falso y el Photo Code. Es la pregunta del «¿me la creerán?».
- Un YouTube Short: «Delivery Drivers Fight Back against Scams & Wrongful Deactivations by using TIMESTAMP App»
  https://www.youtube.com/watch?v=nYpoZrR0YWI (solo el título; sin visitas ni fecha).
- TikTok: el buscador resume que creadores recomiendan una cámara de sello gratis para fotos de entrega «como registro privado»
  extra (solo buscador; la página llega vacía).

Cuenta honrada: en las 10 reseñas visibles de cada una, **2 de 10 en GPS Map Camera y 1 de 10 en Timemark** hablan de reparto. El
resto son obra, inspecciones, tejados, topografía, permisos. Los repartidores son un uso real pero minoritario de estas cámaras.

**Timemark ya va a por el reparto:** tiene una página «Free Proof of Delivery Photo App» que nombra correo, DoorDash, Amazon y
mercancías, dice que sirve a «outsourced drivers and drivers who use their own vehicles», ofrece verificación online y no sigue al
conductor en vivo. Sus testimonios son de jefes de flota, no de conductores.
https://www.timemark.com/solutions/proof-of-delivery-photo (leída 14-11-2026)

### 3. Lo que odian los usuarios de estas cámaras (MATIZA, media)

- Anuncios que tapan botones y cortan el trabajo (GPS Map Camera): resumen de agregadores (solo buscador) y la reseña del 4 de
  mayo de 2026 en la App Store citada arriba. Un procesador judicial se va porque ya no puede quitar el sonido del disparo (App Store,
  11 de junio).
- Pagar y que la marca de agua siga (reseña citada por el buscador; solo buscador).
- Dirección equivocada y sin poder corregirla (Timemark, reseña del 24-03-2025).
- Fotos que no se guardan en el móvil o vídeo que se corta (Timemark, reseñas del 02-12-2025 y 09-12-2025).
- GPS Map Camera vende el «quitar anuncios» a 2,99 $ y todo a 9,99 $/año (App Store).

### 4. Los planificadores apenas dan prueba de entrega al conductor suelto (APOYA un hueco, media)

- **Spoke (Circuit) Route Planner**: planes Gratis (10 paradas), Lite 9,99 $/mes, Standard 19,99 $/mes; la página de precios **no
  nombra prueba de entrega** en ninguno; solo la nombra en «Spoke Dispatch», el producto de equipos.
  https://spoke.com/route-planner/pricing (leída 14-11-2026). Upper (competidor) dice que ningún plan individual la incluye
  (https://www.upperinc.com/blog/circuit-pricing/, solo buscador).
- **Zeo**: su propio blog dice que la prueba de entrega (foto con hora, firma) está en el gratis y en el de pago, pero otra página
  suya la pone como «premium»: contradictorio (solo buscador; https://zeorouteplanner.com/route-planners-proof-of-delivery).
- **Xpedit**: foto + firma en el plan Pro a 4,99 euros/conductor/mes (Capterra/GetApp/G2, solo buscador).
- **Routin**: no encontré nada que diga que tenga prueba de entrega con foto (solo buscador).
- **Geo2**: prueba de entrega con foto/firma; su propio artículo se contradice (Pro a 8,99 $/mes o gratis).
  https://geo2.com/blog/amazon-flex-tips-how-to-earn-more-per-hour-2026 (11-08-2026)
- En ninguno he visto que la foto lleve sello quemado en la imagen ni búsqueda semanas después pensada para el conductor (ausencia
  de dato, no prueba).

### 5. El consejo «haz tu propia foto» existe, pero con un límite claro: no siempre te la aceptan (MATIZA, media)

- Guía de FlexingBot (actualizada 28-09-2026) para Amazon Flex: muchos conductores fotografían cada entrega en puerta y también lo
  que la app no pide (verja cerrada, negocio cerrado, taquilla que no abre, paquete dañado); esas fotos «stay on your own phone, and
  they become useful when you appeal». Pero también: **conductores han perdido apelaciones de «no recibido» aun con GPS y fotos**, y
  algún canal de soporte dejó de admitir adjuntos. https://flexingbot.com/guides/amazon-flex-photo-on-delivery/ (vendedor de otra cosa)
- Guías de apelación de bajas (Gridwise, terms.law, 2026) aconsejan guardar fotos con hora y GPS (solo buscador).
- En España: la prensa cuenta multas al repartidor de hasta 40 euros y el truco del «ausente» para evitarlas, y que la agencia ya
  sabe si pasó por la zona porque su app lleva geolocalizador (Xataka, Blanquivioletas; solo buscador). Sospecha: en España la PDA de
  la agencia ya hace foto/firma, y la foto propia del repartidor vale sobre todo para discutir con SU agencia o subcontrata, no con el
  cliente. No lo he podido comprobar.
- No he encontrado en español ni en portugués a repartidores recomendando una cámara de sello concreta. En portugués solo salen
  quejas de clientes en Reclame Aqui («consta entregue mas não recebi»).

### 6. ¿La marca de la app en la foto, mandada por WhatsApp, es su publicidad? (FLOJA)

- No encontré ningún estudio ni declaración del crecimiento por la marca de agua. Lo único: GPS Map Camera vende **quitar** su
  marca («que vean tu empresa, no la nuestra», solo buscador) y presenta el logo como «reconocimiento de marca» de la empresa del
  usuario (https://gpsmapcamera.com/features_gps_map_camera, solo buscador). Timemark la deja pequeña en el gratis (según una web
  competidora, solo buscador). Que la foto sellada viaje por WhatsApp y atraiga a quien la recibe es plausible, pero **no lo he
  podido probar**: es sospecha.
- La reseña de DoorDash muestra el efecto contrario a lo esperado: el repartidor pone el logo de DoorDash, no el de la app.

## Mi veredicto

La necesidad de «foto que demuestra» es real pero **no es de masas entre repartidores**, y como gancho para instalar una app nueva
**no se sostiene** con lo que he encontrado:

1. Quien quiere cubrirse ya tiene cámaras de sello gratis con decenas de millones de descargas (Timemark incluso con verificación
   online y página de «prueba de entrega»), y quien no se cubre usa la foto que le exige la app de la agencia o de Amazon.
2. En las reseñas, el reparto es un uso minoritario (1-2 de cada 10 reseñas visibles), casi todo en EE. UU. y con plataformas
   (DoorDash, supermercado), no paquetería española.
3. Lo más grave: **ya hay al menos cuatro apps hechas exactamente para «el repartidor guarda sus pruebas»** (Parcel Proof, SnapProof,
   PicAnchor, MoveDefense), alguna con búsqueda por código de seguimiento y PDF del día, y ninguna tiene valoraciones. Si fuese el
   dolor que hace instalar y enseñar al compañero, alguna se vería.
4. Y que la prueba la crean no está garantizado: hay conductores que pierden apelaciones con foto y GPS.

Lo que sí queda abierto: las cámaras genéricas no resuelven **encontrar la foto de un paquete concreto semanas después** (no buscan
por dirección ni por código), ni el **justificante de ausente/intento**, ni el **recuento para cuadrar la liquidación**. Ese hueco
existe, pero el hueco de «encontrar» solo duele el día de la reclamación, que es raro; no es algo que se use cada día ni que se
enseñe al compañero.

Para que un repartidor dejara su cámara de sello por la de FDS tendría que: (1) salir sola dentro del flujo de entrega, sin abrir
otra app ni un paso más (la foto que ya hace al marcar entregado/ausente queda sellada y guardada); (2) atarse al paquete: código
escaneado, dirección, hora, GPS, estado (entregado, ausente, rechazado); (3) encontrarse en segundos por código, dirección o día;
(4) generar el justificante en un toque para WhatsApp, con verificación que no dependa de creerse al repartidor (código comprobable,
hora de red); (5) gratis, sin anuncios, sin marca de pago. Eso solo tiene sentido como **parte** de una app que ya use para repartir,
no como gancho para instalarla.

## Lo que yo haría

1. **No construir la «foto sellada» como gancho de captación.** Las pruebas apuntan a que no hace instalar (cuatro apps lo intentan
   sin tracción y la cámara gratis ya existe).
2. Si se hace algo, que sea **barato y dentro del flujo**: la foto que la app ya toma al marcar entregado/ausente, quemarle el sello
   (hora, dirección, código del paquete) y permitir buscarla por código o dirección; coste cero de servidor si se queda en el móvil.
3. Antes de nada, **preguntar a 5-10 repartidores españoles reales** (los de la flota de Dani sirven): «¿cuántas reclamaciones te
   descontaron el último mes, y qué te pidieron para quitarlas?». Si la agencia no acepta fotos del móvil del repartidor, todo esto
   no vale; si sí, el dato que manda es cuántas veces al mes pasa.
4. Que otro agente lea Reddit/TikTok con el Chrome de Dani (aquí no se pudo): buscar en r/AmazonDSPDrivers y r/couriersofreddit
   «own photo», «timestamp app», «Timemark», y contar menciones de verdad.
5. Mirar mejor la parte (b), el recuento entregas x tarifa contra la liquidación: aquí no he visto a nadie cubriéndola para el
   repartidor suelto (MoveDefense registra paradas y kilómetros, no tarifas). Puede ser el hueco más limpio, pero eso es de otra parte
   del estudio.
