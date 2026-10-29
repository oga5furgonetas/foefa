# Estudio de la app del repartidor (29-10-2026)

> Qué es hoy la app, qué se ha medido, qué dijeron los que la usan, dónde cojea y qué hacer, en orden.
> Hecho leyendo entero el código (la app nativa en Kotlin, el servidor y el portal web del reparto) y las
> notas del proyecto (`ESTADO.md`, `PLAY_STORE.md`, `REPARTO.md`, `AUTOCRITICA-APP-25-10.md`, `PLAN-1000.md`,
> `PRECIOS.md` y los anuncios). Cada afirmación lleva su sitio en el código o en las notas. Lo que no se pudo
> comprobar se dice. Nada de generalidades ni de cifras inventadas.

## 0. En una página

1. **El cuello de botella no es la app: es que la gente no vuelve.** Embudo real a 30 días (23-10):
   32 altas → 13 vuelven otro día → 9 meten una parada → 9 navegan → 6 entregan → **0 días reales**. De las
   35 altas del anuncio del 24-10, 27 solo miraron el día del alta. Las dos únicas respuestas a «¿qué te
   frenó?» fueron «no supe cómo usarla» y «no tengo ruta» (muchos son riders o conductores a los que su
   empresa ya da la ruta). La app carga en 0,4 s y en 14 días no dio ningún error de navegador.
2. **La app nativa (2.2.4) salió a Play con menos que la web.** No cobra (y el 01-01-2027 entra el tope de
   15 paradas al día), no guía con voz, no manda el enlace de seguimiento al cliente, no enseña el bono ni
   «Mi dinero hoy», no tiene idiomas ni avisos push, y no mide nada. El plan que se vende promete «navegación
   con voz dentro de la app» y «enlace de seguimiento», y la nativa no hace ninguna de las dos.
3. **El servidor del reparto no aguanta crecer.** Ordenar la ruta es Python síncrono en el único proceso:
   medido aquí, 40 paradas 2,2 s, 100 paradas 7,1 s, 150 paradas 11,2 s, y mientras tanto no contesta a
   nadie, de ninguna empresa. Geocodificar y rutas van por servidores públicos gratuitos en un solo turno
   global de 1 petición por segundo. Ninguna colección del reparto tiene índice.
4. **Privacidad: cuatro cosas baratas de arreglar y necesarias antes de cobrar a una empresa.** El rastro de
   ubicación se guarda y nadie lo lee; el borrado de datos de clientes solo se dispara cuando alguien abre la
   lista de pedidos de la oficina; la analítica guarda la cuenta (en un autónomo, una persona); IBAN y
   teléfonos de Bizum en claro sin plazo de borrado.
5. **La parte de conductor de empresa (tu flota) va bien encaminada.** Entra, turnos, auditoría, trabajar
   más e invita y gana funcionan en tu móvil. Lo que más falta es lo que pediste el 18-10: avisos propios
   mejores que WhatsApp. La nativa no tiene push, y el servidor manda por web push cosas que el conductor con
   la app nativa no recibe (respuesta a su petición de turno, vacantes, inspección pendiente).
6. **Proceso.** `server.py` tiene 55.805 líneas, 654 rutas y 1.564 funciones en un fichero. La app nativa no
   se compila en el CI, el lint está apagado como freno, hay 1 fichero de tests JVM y 184 textos escritos a
   mano en español dentro del código. La fecha de la promoción está en cuatro sitios.

Lo que propongo, resumido: **una semana en el servidor sin recompilar la app** (optimizador en un hilo,
índices, borrado diario, rastro fuera), **una 2.2.5 con lo que un repartidor nota el primer día** (no perder
entregas, bono y paradas previas, seguimiento en el WhatsApp, olvidé mi contraseña, confirmaciones, firma de la
inspección, medición), **y en noviembre lo que decide el negocio**: cómo se cobra dentro de la app antes del
31-12, voz, idiomas y preparar la ruta de mañana. Al final, lo que decides tú.

## 1. La foto de hoy

### 1.1 Qué es la app

Una sola app en Play (`com.flotadsp.flota`, FDS), nativa desde la 2.0.0 (Kotlin + Jetpack Compose), con tres
públicos que el servidor distingue al entrar (`POST /auth/app-login` → `app_destino`):

| Público | Qué ve | Dónde está |
|---|---|---|
| Repartidor autónomo | Hoy (siguiente parada, navegar, llamar, WhatsApp, entregado / no entregado), escáner continuo, ficha de parada con lectura de etiqueta, mapa, historial, ajustes, cuenta | `ui/hoy`, `ui/escaner`, `ui/parada`, `ui/cuenta` |
| Conductor de empresa (OGA5, DGA1, DGA2) | Auditoría del vehículo con fotos, Mis turnos, pedir día, Trabajar más, Invita y gana, Mi cuenta. «Mi ruta» solo si la empresa reparte con la app | `ui/acceso/PortalConductorNativo.kt` y hermanos |
| Oficina | El panel web dentro de un WebView restringido a flotadsp.com | `ui/acceso/PortalEmpresa.kt` |

El servidor (`backend/server.py`, rutas `/reparto/*`, `/shifts/*`, `/inspections/*`, `/trabajar-mas`…) es el
mismo para la web y la app. La web del repartidor (`frontend/src/pages/driver/`, 16 pantallas, 7 idiomas)
sigue siendo la versión más completa.

### 1.2 Lo medido y lo dicho (de las notas, con fecha)

- **Cuentas**: 39 del plan Repartidor el 17-10 (37 España); 40 autónomos el 23-10, 18 con alguna parada; 35
  altas en los 10 días hasta el 24-10, casi todas del anuncio de Meta. **Ningún día de reparto real** con la
  vara del bono (20 entregas a direcciones distintas, en 2 días).
- **Embudo** (23-10, 30 días): 32 → 13 → 9 → 9 → 6 → 0. La caída grande (19 de 32) es entre el alta y
  volver otro día. Todos entran desde el móvil, 21 de 31 desde el navegador de Instagram o Facebook, de 13 a 22 h.
- **Correos del ciclo**: de 29 clics que iban a la ruta, entraron 7; el resto caía en «crear cuenta» porque
  la sesión se quedó en el navegador de Facebook. Desde el 24-10 cada correo lleva un pase de 72 h.
- **Campañas**: Meta es lo único que trae altas (1,64 a 2,43 € por alta); TikTok 203 € y 0 altas; Spotify 38
  clics con la URL rota; grupos de Facebook ≈ 0. «gana10»: 14 altas y 1 parada entre todas.
- **Lo que dijeron**: «no supe cómo usarla» (la única respuesta de un alta por Instagram que no volvió) y
  «no tengo ruta». Los testers de Play (20-10) no encontraron fallos y pidieron el ojo de la contraseña y
  confirmar al salir (hechos). Tú: «quiero una aplicación Android real, hecha para Android y bien hecha»
  (25-10), «el punto uno es mejor notificación de la propia app que WhatsApp» (18-10), «me centraría en la
  app del repartidor; mil repartidores son 10.000 € al mes» (18-10).
- **Errores en producción**: 171 en 30 días, casi todos del panel viejo; en la app de reparto, 0 en 14 días.
- **Tu flota**: el cuadrante de OGA5 (68 personas) en producción, 106 furgonetas evaluadas en Estado de la
  flota, DGA1 sin máximas, y por eso «Trabajar más» no enseña vacantes: correcto.

### 1.3 Lo que la web tiene y la nativa no (y al revés)

Lo que el servidor ya devuelve y la nativa tira: en `MiRuta` (`data/Modelos.kt:86-97`) se ignoran `bono`,
`previas`, `ganancias`, `jornada`, `aviso_hora`; en `Parada` se ignoran `antes` («la última vez en esa puerta»),
`seguimiento` y `tarde_min`. Es decir, parte de lo que falta son pantallas, no servidor.

| Función | Web | Nativa |
|---|---|---|
| Guía giro a giro con voz y manos libres | Sí (`Navegacion.jsx`) | No: abre Google Maps o Waze (`ui/Acciones.kt:23-39`) |
| Trazado por calles en el mapa | Sí | Línea recta entre paradas (`MapaRuta.kt:67`) |
| WhatsApp al cliente con hora estimada y enlace de seguimiento | Sí (`MiRuta.jsx:127-133`) | Texto fijo sin hora ni enlace (`Hojas.kt:115`) |
| Bono de 10 €, «Mi dinero hoy», récord, paradas de otros días | Sí | No |
| Firma del cliente, ver la puerta, zonas de carga | Sí | No |
| Pegar lista, foto de la hoja, lote, CSV | Sí | No (solo escáner y ficha) |
| Preparar la ruta de mañana | No | No |
| Pagar el plan | Stripe en la web (en euros) | No: la Cuenta es solo texto (`Pestanas.kt:405-413`) |
| Idiomas | 7 | 1 (todo en español, en el código) |
| Avisos | Web push (aviso de la mañana, turnos, refuerzos, inspección) | Ninguno (no hay FCM) |
| Medición de uso | Sí (`/analitica/evento`) | Ninguna llamada |
| Entregas sin red | Reintento mientras la pestaña viva | Cola con WorkManager aunque la app esté cerrada (`EnvioWorker.kt`) |
| Lectura de etiquetas | zxing + OCR en el navegador | ML Kit en el móvil, cámara continua |
| Borrar mi cuenta | No existe | Sí |
| Firmar la inspección (conductor de empresa) | Sí (`/inspections/{id}/sign`) | No |

## 2. Diagnóstico

### C1. Primero el primer día, no más funciones

Quien se da de alta no vuelve (19 de 32 nunca), y quien vuelve no sabe meter sus paradas (9 de 32 lo
consiguen). Se han probado tres «primer uso guiado» (11-10, 17-10, 23-10) y las cifras del 24-10 siguen en 2
de 35 con paradas. Dos lecturas:

- **El público** (ya lo dice la autocrítica del 25-10): los anuncios traen riders de comida y conductores con
  la ruta en la app de su empresa. A esos FDS no les sirve, hagamos lo que hagamos. Apuntar a quien ordena su
  ruta (paquetería autónoma, Mercado Envíos Flex, mensajeros, súper a domicilio) vale más que cualquier
  pantalla nueva.
- **La vuelta a la mañana siguiente**: el aviso de la mañana es web push y solo llega a quien activó avisos
  desde el navegador (17 de 31 el 18-10). Con la app nativa en Play, **sin FCM nadie recibe el aviso**. Es la
  pieza que más empuja a volver y hoy no existe en la app que se descarga de Play.

### C2. La nativa tiene que llegar, como mínimo, a lo que promete el plan

El plan Repartidor (`server.py:5667-5671`) vende voz dentro de la app y enlace de seguimiento. En la nativa no
están. Y el 01-01-2027 entra el tope gratis de 15 paradas: quien choque con él recibe un 402 que dice «Pasa a
ilimitado en Cuenta», y en la Cuenta de la nativa no hay ningún botón. **Antes del 31-12 hay que decidir cómo
se cobra dentro de la app** (Play Billing exige cuenta de empresa y 10 % de comisión; «ofertas externas» en el
EEE también; o mandar a la web con Stripe). Hoy no hay ninguna de las tres.

### C3. El servidor del reparto está pensado para diez repartidores, no para mil

- `reparto.optimizar` corre en el hilo del servidor (`server.py:51991`, `reparto.py:376-447`, 60.000
  evaluaciones). Medido en este contenedor: 40 paradas 2,2 s, 100 paradas 7,1 s, 150 paradas 11,2 s. En Fly
  (una CPU compartida) será peor. **Durante ese tiempo la API entera está parada para todas las empresas.**
- Nominatim, Photon, OSRM de FOSSGIS y Overpass comparten un candado global a 1 petición por segundo
  (`server.py:51368`, `:51432`, `:51784-51796`). Una petición lenta a OSRM puede retener el candado 40 s; el
  cliente corta a los 30. Con 100 coordenadas o más, la matriz de tiempos no se pide y se ordena en línea
  recta (`:51803`, `:51832`).
- Sin índices en `reparto_pedidos`, `reparto_jornadas`, `reparto_rutas` ni `reparto_enlaces` (no aparecen en
  `_idx`, `server.py:1560-1860`). El enlace público de seguimiento busca por token sin índice.
- `GET /reparto/mi-ruta` se recarga tras cada entrega (`RutaVM.kt:79`) y en cada llamada mira 90 días de
  «la última vez en esa puerta» (hasta 3.000 pedidos), calcula el bono (hasta 5.000 entregas) y crea enlaces
  de seguimiento uno a uno (`server.py:52468-52545`).
- Las tareas en segundo plano (situar lo pegado) viven en memoria (`:51725-51735`): un despliegue deja
  paradas con `geo: pendiente`.

Nada de esto se nota con 10 repartidores. Con 100 sí, y con 1.000 se cae.

### C4. Privacidad: lo que contradice lo que dice `REPARTO.md`

- **Rastro de ubicación**: se guarda (hasta 2.000 puntos por jornada, `server.py:53270`) y ninguna lectura
  lo usa (`:52459`, `:52514` lo excluyen). Es dato de localización de una persona sin finalidad: fuera.
- **Borrado a los N días**: `_rep_limpiar` solo se llama desde `GET /reparto/pedidos` (`:52111`). Un
  autónomo que solo use «Hoy» conserva nombres, teléfonos y fotos de sus clientes sin límite, y
  `mis-direcciones` se los vuelve a enseñar 180 días. `REPARTO.md` dice «se borran solos».
- **Analítica «anónima»** que guarda la cuenta (`analitica.py:195-197`); en un autónomo la cuenta es la persona.
- **Cartera**: IBAN, teléfono de Bizum y correo de PayPal en claro y sin plazo (`server.py:55453-55457`).
- **«Entrar como» (la plataforma dentro de la cuenta de un cliente)**: el bloqueo de escritura en
  `/api/reparto/` no es global (`server.py:1038-1045` solo exime del cobro), y según la lectura crear paradas,
  cambiar estados y borrar pedidos no lo comprueban. `REPARTO.md` dice lo contrario. **A confirmar ruta a
  ruta antes de tocar.**

### C5. El conductor de empresa: bien, con cuatro huecos claros

- **Avisos**: el servidor manda por web push la respuesta a una petición de turno (`server.py:32035`), las
  vacantes de refuerzo (`:32529`) y la inspección pendiente (`:18861`). Con la app nativa no llega nada.
- **Firma de la inspección**: la web firma (`/inspections/{id}/sign`), la auditoría nativa no.
- **Si Android mata la app con la cámara abierta** se pierde la foto de la auditoría (`captura` no es
  guardable, `AuditoriaConductorNativa.kt:121`). Y las fotos solo están en memoria hasta subir.
- **Detalles**: el teléfono sale vacío en Mi cuenta aunque el servidor lo tiene (`fichaConductor()` nunca se
  usa); tras revisar una etiqueta vuelve a Hoy y no al escáner; no hay ajustes de navegador ni tema; el
  conductor no renueva sesión y vuelve a entrar cada 30 días; salir no pide confirmación.

### C6. Cosas de la app que un repartidor notaría el primer día

- **Se pierden entregas encoladas sin avisar**: en `vaciarCola` cualquier error que no sea de red ni 401 se
  descarta (`Repositorio.kt:257-258`), incluidos 500, 429 y 408. Y si se entrega sin red, se deshace con red
  y luego llega la cola, la parada acaba entregada.
- **«Deshacer» borra en el servidor la foto, la firma y quién recibió** (`server.py:52890`) sin avisar.
- **Editar una parada ya cerrada siempre da 409** (la ficha manda campos que el servidor rechaza), y aun así
  sale el botón.
- **No hay «olvidé mi contraseña»** aunque la ruta existe y la web la usa.
- **Una sesión que caduca no se explica**: `FdsApp.caducada` se emite y nadie lo escucha.
- **Con la letra grande del sistema se cortan textos**: botones de altura fija, «No entregado» a una línea,
  celdas cuadradas del calendario.
- **El mapa** vuelve a hacer zoom en cada cambio y, sin paradas, se centra en España sea cual sea el país.
- **La foto de entrega** no corrige la rotación (la de la auditoría sí) y las fotos a tamaño completo nunca se
  borran de la caché.

### C7. Proceso y estructura

- `server.py`: 55.805 líneas, 654 rutas, 1.564 funciones. Hay 20 módulos al lado, pero el reparto entero
  (unas 2.000 líneas) sigue dentro. Cualquier cambio obliga a leer un fichero que no cabe en ninguna cabeza.
- La app nativa **no se compila en el CI** (ninguna mención a Gradle en `ci.yml`); el lint está apagado como
  freno (`abortOnError=false`); 1 fichero de tests JVM y 1 instrumentado; `mockwebserver` y
  `coroutines-test` declarados y sin usar. La prueba de contrato (61 llamadas) sí corre en el CI desde hoy.
- 184 `Text("…")` en español dentro del código y `strings.xml` solo con el nombre de la app.
- Lógica de negocio en la pantalla: la auditoría es un Composable de 373 líneas con 25 estados; las reglas de
  cuándo se puede pedir un día, el formato «de X a Y», la zona horaria por país, «20 entregas en 2 días» escrito.
- La lectura de etiquetas está dos veces (JS y Kotlin) con los mismos casos de prueba copiados a mano.
- La fecha de la promoción en 4 sitios (`server.py:5296`, `:54026`, `precios.js:106` y `:116`), con
  comentarios que aún dicen 31-10.
- Cinco formateadores de fecha distintos en la nativa, dos compresores de foto, dos peticiones de permiso de
  cámara, el mensaje de WhatsApp dos veces.

## 3. Propuestas, por impacto y esfuerzo

Esfuerzo: **B** (horas), **M** (un par de días), **A** (una semana o más, o decisión de negocio).

### 3.1 Para que el autónomo vuelva y reparta

| # | Propuesta | Por qué | Esf. | Dónde |
|---|---|---|---|---|
| 1 | **Avisos nativos (FCM)**: el de la mañana a la hora que eligió, y los del conductor de empresa | Es lo que más empuja a volver y hoy no llega a nadie con la app de Play | A | Manifiesto + servicio FCM; guardar el token junto a las suscripciones web push y añadirlo a `send_web_push_to_users` (`server.py:15865`) |
| 2 | **No perder entregas encoladas** | Hoy un 500 del servidor tira la entrega sin avisar | B | `Repositorio.kt:257-258`: reintentar en ≥500, 408 y 429; avisar de rechazos; encolar detrás si ya hay algo pendiente para esa parada |
| 3 | **Bono visible y paradas de días anteriores** | El servidor ya lo manda; es la zanahoria del «día real» y el camino para no perder lo de ayer | B | `Modelos.kt:86` (`bono`, `previas`), tarjeta en `HoyPantalla.kt:187` y `traer-previas` |
| 4 | **WhatsApp al cliente con hora estimada y enlace de seguimiento** | Lo promete el plan; la web ya lo hace | B | `Hojas.kt:115`, `HoyPantalla.kt:202` con `Parada.seguimiento` y `eta` |
| 5 | **«Olvidé mi contraseña»** y aviso de «tu sesión ha caducado» | Hoy el camino es escribir a soporte | B | `Acceso.kt:210`, `MainActivity` escuchando `caducada` |
| 6 | **Avisar antes de «Deshacer» una entrega** (o no borrar la foto en el servidor) | Borra la prueba de entrega sin avisar | B | `Hojas.kt:134`, `RutaVM.kt:78` o `server.py:52890` |
| 7 | **Medir desde la nativa**: apertura, navegar, entregado, escaneo | Hoy el embudo no ve a nadie que use la app de Play | M | Cola a `/analitica/evento` con el token |
| 8 | **Preparar la ruta de mañana** | Lo pide la autocrítica; Circuit y Zeo lo tienen; quien carga por la noche hoy pierde la ruta a las 00:00 | M | Parámetro `fecha` en `mis-pedidos`, `escanear`, `lote` y `mi-ruta`; elegir «hoy / mañana» al cargar tras las 18:00 |
| 9 | **Cobro dentro de la app antes del 31-12** | El 01-01 entra el tope de 15 y no hay botón | A | Decisión: Play Billing (cuenta de empresa), ofertas externas en el EEE, o abrir la web con Stripe desde la Cuenta |
| 10 | **Guía con voz en la nativa** | Lo promete el plan; es lo que diferencia de abrir Google Maps | A | Reutilizar `/mi-ruta/guia` del servidor y TTS de Android |
| 11 | **Idiomas en la nativa** (pt y en primero) | La app atiende Brasil y Latinoamérica, los correos salen en el idioma del móvil y la app en español | M-A | `res/values-pt`, `values-en`; quitar el `ESPANOL` forzado (`Tema.kt:103`) |
| 12 | **Firma del cliente** y detalle de lo entregado (dónde, quién, cobro) | La web lo tiene; es la prueba de entrega | M | `Hojas.kt:162-242`, `Pestanas.kt:174` |
| 13 | **Reordenar arrastrando** | `ordenAMano` existe en el repositorio y nadie lo usa | M | `HoyPantalla.kt:215` |
| 14 | **Mapa con trazado real** y sin perder el zoom | Hoy líneas rectas y el zoom se resetea | B-M | `MapaRuta.kt:63-90` con `/mi-ruta/trazado` |
| 15 | **Letra grande y accesibilidad** | Botones de altura fija, textos a una línea, calendario solo por color | B-M | `heightIn(min)`, `FlowRow`, `liveRegion` en el escáner, `semantics` en el calendario |

### 3.2 Para el conductor de empresa (tu flota)

| # | Propuesta | Esf. | Dónde |
|---|---|---|---|
| 16 | Avisos FCM de turnos, refuerzos e inspección pendiente (es el mismo trabajo que el 1) | A | ver 1 |
| 17 | Firmar la inspección al terminar la auditoría | B | `AuditoriaConductorNativa.kt` + `/inspections/{id}/sign` |
| 18 | Auditoría que sobreviva a que Android mate la app: fotos a fichero, `rememberSaveable`, cola en WorkManager | M | `AuditoriaConductorNativa.kt:109`, `:121` |
| 19 | Teléfono precargado, volver al escáner tras revisar, ajustes de navegador y tema, renovar sesión, confirmar al salir | B | `PortalConductorNativo.kt:148`, `:262`, `:302`; `Repositorio.kt:127` y backend |
| 20 | «Mis turnos» como lo querías el 18-10 (lo dijiste: «me gustaba más antes; así hacia abajo no») | M | `TurnosConductorNativo.kt` |
| 21 | Historial propio del conductor (hoy estadísticas y pedidos exigen ser administrador) | M | `server.py:52106`, `:52324` |

### 3.3 Para la oficina

| # | Propuesta | Esf. | Dónde |
|---|---|---|---|
| 22 | Que la nativa abra jornada y mande posición: hoy los conductores con la app no salen en el mapa en vivo | M | `/reparto/jornada`, `/reparto/posicion` desde `RutaVM` |
| 23 | Hora estimada que se actualice con las entregas hechas, y aviso automático al cliente | M | `server.py:52008-52014` |
| 24 | «Ordenar todos» en paralelo (hoy conductor a conductor) | B | `server.py:52263` |
| 25 | Cerrar la jornada sola al terminar la ruta o a una hora tope | B | `server.py:53228` |

### 3.4 Servidor y datos (sin recompilar la app)

| # | Propuesta | Esf. | Dónde |
|---|---|---|---|
| 26 | **Optimizador en un hilo** (`asyncio.to_thread`) y presupuesto menor con muchas paradas | B | `server.py:51991`, `reparto.py:376` |
| 27 | **Índices**: `reparto_pedidos` (`fecha`+`conductor_id`, `fecha`+`codigo`, `id`), `reparto_enlaces.token` (único, con caducidad), `reparto_jornadas.id`, `organizations.ref_codigo` | B | `_idx`, `server.py:1560-1860` |
| 28 | **Borrado diario en segundo plano** por empresa, y no solo desde la lista de la oficina | B | `_rep_limpiar`, `server.py:51567` |
| 29 | **Dejar de guardar el rastro** (o 24 h y leerlo para algo) | B | `server.py:53270` |
| 30 | `mi-ruta` más ligero: usar la respuesta de `POST estado` en vez de recargar todo; «la última vez» y bono con caché | B-M | `RutaVM.kt:79`, `server.py:52485-52525` |
| 31 | Bloquear las escrituras de reparto a «entrar como», tras confirmarlo ruta a ruta | B | `server.py:1038` |
| 32 | Cola de geocodificación y rutas por empresa, con prioridad a lo que pide una persona, y esperas más cortas | M | `server.py:51368-51796` |
| 33 | Una sola fuente para la fecha de la promoción, servida por `/billing/planes` | B | 4 sitios |
| 34 | Códigos postales y teléfonos por país (hoy solo España) | M | `reparto.py:59-73`, `server.py:51406` |
| 35 | OSRM y Nominatim propios cuando haya repartidores de pago (`REPARTO_RUTAS_URL` ya existe) | A | Decisión de coste |
| 36 | Cartera: cifrar o borrar IBAN y teléfonos tras pagar | B | `server.py:55453` |

### 3.5 Proceso

| # | Propuesta | Esf. |
|---|---|---|
| 37 | Compilar la app en el CI (`:app:testDebugUnitTest :app:lintDebug :app:assembleDebug`) y volver a poner el lint como freno en release | B-M |
| 38 | Ampliar la prueba de contrato a `estado`, `escanear`, `mis-pedidos` y `register` | B |
| 39 | Textos de la nativa a `strings.xml` (paso previo a los idiomas) | M |
| 40 | Una sola lista de casos de etiquetas para JS y Kotlin (un JSON compartido) | B |
| 41 | Subida a Play desde el CI con la clave como secreto (hoy se compila a mano en tu PC) | M |

## 4. Reestructuración: qué partir y en qué orden

No hace falta reescribir nada. Hace falta partir por donde ya hay costura:

1. **`server.py` → paquetes por dominio, empezando por el reparto.** `reparto.py` ya existe (el motor puro);
   las ~2.000 líneas de rutas `/reparto/*` y `/seguimiento/*` son un bloque contiguo (51290-53470) con
   dependencias claras (`db`, `global_db`, `require_*`, `_rep_*`). Mover ese bloque a `backend/reparto_api.py`
   con un `APIRouter` y `include_router` es un cambio mecánico, verificable con el contrato y los tests. Luego
   el portal del conductor (`/shifts`, `/shift-requests`, `/trabajar-mas`, `/portal/*`), luego `auth`. Cada
   trozo que sale es un fichero que cabe en una cabeza y que se puede probar solo.
2. **La app nativa: una capa de datos tipada.** Las pantallas del conductor leen `JsonObject` sueltos con
   `campoSeguro` que devuelve "" si falta la clave: si el servidor renombra algo, la pantalla sale vacía sin
   error. Pasar a `@Serializable` como ya hace el autónomo. Y un solo módulo «ruta» (Hoy, escáner, ficha)
   compartido por autónomo y conductor, en vez de cablearlo dos veces (`MainActivity.kt:139-177` y
   `PortalConductorNativo.kt:240-279`).
3. **La web del repartidor**: `MiRuta.jsx` tiene 2.507 líneas; sacar la guía, el mapa y la carga de paradas a
   componentes es lo mismo que ya se hizo con `Navegacion.jsx`.
4. **Un solo lector de etiquetas**: hoy hay dos (JS y Kotlin). La opción barata es un fichero de casos
   compartido; la cara, mover la lectura al servidor (pierde el «sin red»). Quedarse con la barata.
5. **Las notas**: `ESTADO.md` tiene 2.100 líneas y no está en orden de fechas. Un índice por fecha al
   principio y las secciones «Última sesión» y «Pendiente» siempre arriba ahorrarían la media hora que cada
   sesión nueva pierde orientándose.

## 5. Plan por fases

- **Fase 0, esta semana, solo servidor (sin recompilar la app)**: 26, 27, 28, 29, 31, 33, 36. Más el 400 de
  «cambiar contraseña» que ya está en `main` (dd5a9d3) y espera despliegue. Un `fly deploy`.
- **Fase 1, la 2.2.5 (una o dos semanas)**: 2, 3, 4, 5, 6, 7, 17, 19, 14, 15, y empezar el 1 (FCM) porque
  es lo que más empuja a volver. Compilas en tu PC como hoy; mientras, 37 y 38 para que el CI lo cubra.
- **Fase 2, noviembre (decisiones de negocio)**: 9 (cómo se cobra en la app, antes del 31-12), 8 (mañana),
  10 (voz), 11 (idiomas), 12, 13, 22, 23. Y los anuncios al público que sí ordena su ruta.
- **Fase 3, diciembre**: 32, 35 (OSRM propio), partir `server.py` (4.1), 21, 41.

Lo que no haría, y por qué (coincide con la autocrítica del 25-10): medallas y rachas, cifras inventadas
(«ahorras 2 h»), más avisos de los necesarios, cambiar el precio antes de que haya uso diario, y funciones
nuevas antes de que alguien haga un día real con las que hay.

## 6. Lo que decides tú

1. **A quién se le enseña**: seguir con Meta pero apuntando a quien ordena su ruta (paquetería autónoma,
   Flex, mensajeros, súper), y dejar TikTok.
2. **Cómo se cobra dentro de la app** antes del 31-12: Play Billing (cuenta de empresa y 10 %), ofertas
   externas, o la web con Stripe desde la Cuenta.
3. **OSRM propio** (unos euros al mes en Fly) cuando haya repartidores de pago, o antes si se quiere pasar de
   100 paradas por carretera.
4. **Gemini de pago** para la IA de tickets y para que Gadis lo pruebe.
5. **Las cuatro rutas heredadas** sin consumidor: engancharlas o borrarlas.
6. **Desplegar**: el backend (el 400 de hoy y la fase 0 cuando esté) y la web (fichas de ayuda y colores).

## 7. Riesgos que no hay que perder de vista

- **Datos de Amazon**: la regla sigue siendo no usar ni ampliar hasta que decidas (plan A-G pendiente).
- **Play**: 16 KB al subir (hasta ahora sin aviso), la página web para borrar la cuenta, y que cobrar en la
  app obliga a cuenta de empresa.
- **Servicios públicos** (Nominatim, FOSSGIS, Overpass, teselas de OSM): sin contrato; una app con tráfico
  puede quedarse fuera. Y desde el móvil se llama directo a Photon y a las teselas: la IP del usuario llega a
  un tercero.
- **Un solo nodo de Mongo** sin transacciones: si muere, se pierde como mucho un día (hay copia y vigilante).
- **Resend/Brevo**: 100 y 300 correos al día. Con mil repartidores el ciclo de correos no cabe.

## 8. Qué no se ha podido comprobar desde aquí

Los valores en producción de `CICLO_CORREOS`, `REPARTO_IA_PERMITIDA`, `PLAY_COBRO_ACTIVO`, `VAPID_*`,
`REP_GRATIS_HASTA` y `STRIPE_PRICE_*`; el resultado de la medición de iPhone frente a Android (la analítica lo
guarda desde el 23-10, pero no hay cifra en las notas); si alguien ha leído las respuestas de `/opinion`; qué
pasó con la reunión de Transportes Auto Radio (07-10); y las cifras del optimizador en Fly (aquí se midieron
en un contenedor con más CPU de la que tiene el servidor).
