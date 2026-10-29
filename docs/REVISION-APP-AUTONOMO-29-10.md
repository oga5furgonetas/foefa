# Revisión a fondo de la app del repartidor autónomo — 29-10-2026 (noche)

Para Dani. Qué hay, qué falta, qué cambiar y en qué orden en la app de quien reparte por su cuenta: la **nativa de
Android** (FDS, `app-android/`) y su **versión web** (`/ruta`, la misma cuenta desde el navegador). Cada hallazgo lleva
su prueba: una captura en `docs/capturas-autonomo-29-10/` o `fichero:línea`. Lo que no pude comprobar está al final,
en «No verificado». Sin inventar nada.

## En una página

**Veredicto.** La app nativa hace bien lo que se usa cien veces al día: escanear, ordenar, navegar con Google Maps o
Waze, entregar (con cobro, dónde quedó, foto) y seguir sin cobertura. Visualmente está limpia, con botones grandes y
una sola acción principal por tarjeta: para usarla al sol y con prisa es mejor que la web. Pero la **web del mismo
producto va por delante en 20 funciones** (tabla en «Lo que la web tiene y la nativa no»), y tres pesan ya:

1. **En la nativa no se puede pagar.** Cuando acabe la promoción (31-12) el plan pasa a «15 paradas nuevas al día» y la
   app solo lo dice (`Pestanas.kt:405-412`); no hay botón de suscribirse, ni con Google Play ni con Stripe, ni de
   canjear un regalo. En la web sí (Play Billing dentro de la app de Play, Stripe en el navegador) y el servidor ya
   está listo. Es lo primero.
2. **De noche dice «Acabas ≈ 09:24»** sin decir que sales a las 09:00 (captura `02-ordenada.png`, hecha a las 23:31).
   La web lo dice («Sales a las 09:00 · Acabas ≈ …»). El dato llega del servidor y la app lo ignora.
3. **«Mi dinero hoy» no se puede poner desde la app**: solo enseña «Hoy llevas X» si la tarifa se puso en la web. Es la
   función que ninguna app rival tiene y la que más enseña un repartidor a otro.

**Qué añadir, por orden** (detalle y esfuerzo en «Qué añadir o cambiar»): (1) pago dentro de la app; (2) cabecera del
día completa; (3) tarifa y dinero del día; (4) ficha de parada completa: qué lleva, horario del cliente y hueco en la
furgoneta; (5) historial de verdad: hora, prueba de entrega, la semana y el Excel para la gestoría; (6) buscar y
reordenar a mano; (7) firma en pantalla; (8) «has llegado» al volver de Google Maps; (9) mapa con tu punto, las zonas
de carga y «las próximas 4 en Maps»; (10) cuenta completa: cartera, QR, contraseña, idea, aviso de la mañana. Después,
con usuarios: navegación con voz dentro de la app, idiomas, pausa de comida.

**Qué no hacer ahora**: traducir la nativa, meter el mercadillo, ni construir el navegador propio antes que lo de arriba.

## Cómo se miró (para que no haya falsos positivos)

- **La nativa entera**: 31 ficheros Kotlin, 6.776 líneas (`app-android/app/src/main/java/com/flotadsp/fds/`), y las 31
  rutas del servidor que llama (`data/Repositorio.kt`). Lo que la app no llama, no lo tiene: así se ha comprobado cada
  «falta».
- **La web del autónomo**: `pages/driver/MiRuta.jsx` (2.485 líneas), `Navegacion.jsx` (449), `pages/RutaApp.jsx`
  (640), `RutaCuenta.jsx` (849), `AvisoManana.jsx`, `OpinionRuta.jsx`, `AjustesMovil.jsx`, `AntesPuerta.jsx`,
  `SeguimientoPedido.jsx`, `Empezar.jsx` y `Ajustes` de `panel/pages/Reparto.jsx`; y las 56 rutas `/reparto/*`,
  `/billing/*`, `/referidos`, `/cartera`, `/opinion` de `backend/server.py`.
- **La app en el emulador** (Medium Phone, 1440×2560) con la compilación debug de esta sesión, contra el servidor de
  pruebas en memoria (`app-android/pruebas/servidor_pruebas.py`: cuenta `prueba@fds.test`, 4 paradas en A Coruña).
  Recorrido entero como autónomo: acceso, Hoy, ordenar, mapa, hoja de parada, editar, entregar con cobro, no entregado,
  nueva parada, escáner, una entrega hecha, historial y su día, ajustes y cuenta. **16 capturas** en
  `docs/capturas-autonomo-29-10/` (reducidas a la mitad). La app se identifica como «FDS 2.2.5-debug» porque el número
  2.3.0 fue lo último que entró en el código; los textos de cada pantalla coinciden con el código actual.
- **La web**, por su código y por sus capturas reales de hoy (`frontend/public/capturas-ruta/es/`: ruta, mapa y
  navegando).
- **Mercado**: Spoke (Circuit), Zeo y Routal, por sus páginas públicas el 29-10 (precios y funciones de 2026).

## Lo que ya está bien (no tocar)

| Qué | Prueba |
|---|---|
| Escaneo seguido con ML Kit, linterna, permiso explicado («solo mientras escaneas y las imágenes no salen del móvil»), y «Ya estaba: parada N» cuando el paquete ya está | `ui/escaner/EscanerPantalla.kt`, `EscanerVM.kt:89-95`, captura `10-escaner.png` |
| La etiqueta se lee **en el móvil** (dirección, teléfono, código): la foto no sale de ahí | `etiqueta/LectorEtiqueta.kt` (368 líneas), `FichaParada.kt` («Leer la etiqueta con una foto») |
| Sin cobertura: la entrega se guarda y se envía sola; la ruta guardada se enseña con su hora | `Repositorio.kt:285-333` (cola con candado), `data/EnvioWorker.kt`, `HoyPantalla.kt` (SinCobertura) |
| Entregar: cobro con método e **importe editable**, dónde quedó, quién lo recoge, nota y foto comprimida y bien girada (EXIF) | `Hojas.kt:203-284` y `313-337`, captura `06-entrega.png` |
| No entregado con motivo **y nota** (la web no tiene la nota) | `Hojas.kt:286-303`, captura `07-no-entregado.png` |
| Deshacer en el aviso tras entregar, y «volver a por entregar» con confirmación que dice qué se borra | `HoyPantalla.kt:246`, `Hojas.kt` (ParadaHoja), captura `11-hecha.png` |
| Paradas de otros días («Traer a hoy»), bono de bienvenida con su barra, «la última vez en esa puerta», WhatsApp al cliente con la hora y el enlace de seguimiento | `HoyPantalla.kt:340-372`, `Hojas.kt:84-104` |
| Avisos al móvil (bandeja + FCM), la app se actualiza sola, borrar la cuenta desde la app (lo exige Play), cerrar sesión con confirmación | `data/Avisos.kt`, `Actualizacion.kt`, `Pestanas.kt` (BorrarCuenta), captura `14-cuenta.png` |
| La ubicación solo se pide al pulsar «Ordenar ruta», y si no la da se ordena desde la base | `HoyPantalla.kt:131-140` |
| Tirar para actualizar, fecha de la ruta (la del servidor, no la del reloj), tema claro/oscuro/automático, país y hora de salida en Ajustes | `HoyPantalla.kt` (PullToRefreshBox, fechaLarga), `Pestanas.kt:182-330`, captura `13-ajustes.png` |
| Visual: una acción principal por tarjeta, botones de 52-56 dp, chips para hora/cobro/urgente/bultos, números de parada en círculo | capturas `01-hoy.png`, `02-ordenada.png`, `04-parada.png` |

## Hallazgos por pantalla (nativa), con captura

### Acceso (`00-acceso.png`, `00b-entrar.png`)
Nada que cambiar: promesa en cuatro líneas, «Gratis y sin límite hasta el 31 de diciembre · sin tarjeta», dos
botones, y en «Entrar» las dos salidas (código al correo, contraseña olvidada).

### Hoy, antes de ordenar (`01-hoy.png`)
- Bien: la siguiente parada arriba con Navegar, llamar, WhatsApp, Entregado y No entregado; lista compacta; «Escanear»
  flotante.
- **H1 · El bono ocupa una tarjeta entera** entre el resumen y la siguiente parada, todos los días hasta que se gane
  (`HoyPantalla.kt:354`). En la web, con la ruta en marcha, va en una línea (`MiRuta.jsx:1140-1142`, `2054-2066`).
  Con la ruta cargada, lo que importa es la parada.
- **H2 · Sin buscador** con muchas paradas (la web lo saca a partir de 5: `MiRuta.jsx:1361-1367`). Con 60 paradas y un
  cliente que llama, no hay forma de encontrarlo (no hay filtro en `ui/hoy/`).

### Ordenada (`02-ordenada.png`)
- **H3 · «Acabas ≈ 09:24 · 2,0 km» a las 23:31**, sin «Sales a las 09:00», sin los minutos y sin «con tráfico típico».
  `ResumenRuta` trae `salida`, `programada`, `minutos` y `trafico` (`Modelos.kt:74-84`); el resumen solo usa `fin` y
  `km` (`HoyPantalla.kt:291`). La web: `MiRuta.jsx:2154-2162` y `2174-2177`. De noche, sin «sales a las», las horas no
  se entienden.
- **H4 · No se avisa del retraso**: la web dice «Vas 12 min por detrás de lo previsto» (`MiRuta.jsx:1015-1017`, `2180`)
  y «llega N min tarde» en la parada (`1417`). `Parada` de `Modelos.kt` no lee `tarde_min`.
- Menor: «Ordenar ruta» sigue igual de grande después de ordenar; podría pasar a texto («Reordenar») y dejar sitio a la
  acción del día.

### Mapa (`03-mapa.png`)
- Bien: el trazado por las calles y los números.
- **H5 · Sin punto azul** de dónde estás: `MapaRuta.kt` pinta paradas, trazado y «Tu base» (`:76-92`) y nada más (no
  hay overlay de ubicación). Tampoco «Por las calles: 2,0 km · 8 min» (web `MiRuta.jsx:1331-1335`), ni las **zonas de
  carga y descarga** (web `336-351`, `1336-1346`; servidor `GET /reparto/mi-ruta/zonas-carga`, `server.py:53133`), ni
  «Las próximas 4 paradas en Google Maps» (web `180-190`, `1352-1357`), ni la hora prevista en el marcador (web `1328`).

### Hoja de parada (`04-parada.png`)
- Bien: todo a mano (Navegar, llamar, WhatsApp, Entregado, No entregado, Editar, Quitar con confirmación), código, hora.
- **H6 · Falta «Ver la puerta»** (Street View mirando al portal: web `MiRuta.jsx:2238-2258`, servidor
  `GET /reparto/pedidos/{pid}/fachada`, `server.py:53025`) y **el hueco en la furgoneta** solo se enseña si ya estaba
  puesto (`Hojas.kt:127`); no se puede poner (ver H7).

### Editar y Nueva parada (`05-editar.png`, `08-anadir.png`)
- Bien: direcciones conocidas («Ya estuviste aquí · N veces»), foto de la etiqueta, bultos, cobro, urgente, recogida.
- **H7 · Faltan tres campos** que la web tiene (`MiRuta.jsx:1795-1815`): **qué lleva**, **horario del cliente** («de 10
  a 12»: el servidor lo convierte en ventana y la ruta lo respeta) y **¿dónde va en la furgoneta?** La app los
  conserva al editar (`FichaParada.kt:187-188`) pero no deja ponerlos. Tampoco dictar la dirección por voz (web
  `920-948`).

### Entregar (`06-entrega.png`)
- Bien (ver la tabla de arriba).
- **H8 · Sin firma en pantalla** (web `MiRuta.jsx:2260-2301`; el servidor ya guarda `entrega_firma`: `server.py:52596`
  la excluye del listado porque existe).
- **H9 · Decisión, no fallo**: «Entregado» en la tarjeta de la siguiente parada **entrega sin pasar por esta hoja** si no
  hay cobro (`HoyPantalla.kt:141-143`); la hoja solo sale desde la parada abierta (`:244`). Es rápido y hay Deshacer, pero
  quien necesita foto en todas (subcontratas de agencias) no puede obligarse. La web siempre ofrece la prueba y
  «Entregar sin foto» (`MiRuta.jsx:801`, `1918-1922`). Propuesta: ajuste «Pedir siempre la prueba de entrega».

### No entregado (`07-no-entregado.png`)
Nada que cambiar.

### Escáner (`10-escaner.png`)
- **H10 · Cuando el paquete ya está en la ruta**, solo una línea abajo: «Ya estaba: parada 3 · Lucía M.»
  (`EscanerVM.kt:94-95`). La web enseña el **número de parada en grande** y pide el hueco (`MiRuta.jsx:1560-1578`). Con 80
  paquetes en la mano, el número grande es lo que se mira (es el «package finder» de Circuit).

### Una entrega hecha (`11-hecha.png`)
- Bien: 1/4, «HECHAS HOY · 1», aviso con Deshacer, la siguiente pasa arriba.
- **H11 · El bono sigue en «Llevas 0 entregas»** tras entregar: el bono viene en `/reparto/mi-ruta` y la app no vuelve a
  pedirla al entregar (actualiza la lista en local). La web recarga la ruta tras cada entrega (`MiRuta.jsx:810`).

### Historial (`12-historial.png`, `12b-dia.png`)
- **H12 · «1 entregas en 30 días»**: el texto es fijo en plural (`Pestanas.kt:126`).
- **H13 · Es una lista de días y nada más**: sin la semana en barras ni lo ganado (web `RutaApp.jsx:424-458`), sin el
  **Excel para la gestoría** (web `460-513`; servidor `GET /reparto/entregas-mes`, `server.py:52500`), sin «ver otro
  día» (web `410-418`). Media pantalla vacía (captura).
- **H14 · En el día, cada parada dice «Entregado» sin la hora** (`HoyPantalla.kt:506`, vía `Fila`; web `RutaApp.jsx:587`),
  sin «Ver prueba de entrega» (web `603-607`; servidor `GET /reparto/pedidos/{pid}/foto`, `server.py:52335`) y sin
  «Pasar a hoy» parada a parada (web `608-613`; la nativa solo tiene el aviso de arriba con todas, `HoyPantalla.kt:340`).

### Ajustes (`13-ajustes.png`)
- Bien: Navegar con, Aspecto, desde dónde sales, hora de salida, país, volver a la base, y la explicación de cómo se ordena.
- **H15 · Faltan, frente a la web** (`Reparto.jsx:454-620`): minutos por parada y por bulto (`560-566`), contar el tráfico
  (`568`), borrar los datos de los clientes a los N días (`594-603`), leer el ticket con IA si la cuenta lo tiene
  (`586-592`), la **hora del aviso de la mañana** (`AvisoManana.jsx:140-189`), idioma, y la **tarifa** (la web la pone en
  «Hoy», `MiRuta.jsx:1626-1644`). El guardado nativo ya es campo a campo (`Repositorio.kt:382-385`): añadirlos es barato.

### Cuenta (`14-cuenta.png`)
- **H16 · Crítico: el plan es solo de lectura** (`Pestanas.kt:339-412`). No hay suscribirse, gestionar, ni canjear un
  regalo; cuando el servidor conteste «Plan gratis: hasta 15 paradas nuevas al día» (`:408`) no habrá nada que pulsar.
  En la web: Stripe (`RutaCuenta.jsx:323-372`), Play Billing dentro de la app de Play (`434-514`), gestionar
  (`374-427`), canjear (`544-568`) y el muro cuando toca pagar (`659-705`). Servidor listo: `POST /billing/play/verificar`
  (`server.py:53920`), productos `repartidor_mensual` y `repartidor_anual` (`53798`), `POST /billing/stripe/suscripcion`
  (`53648`), `/org/billing` ya devuelve `play.productos` (`5405`).
- **H17 · «Invita a un compañero» sin cartera**: sin saldo, sin «Cobrar», sin QR para el compañero que está al lado
  (web `RutaCuenta.jsx:714-849`; servidor `GET /referidos`, `server.py:54266`, `POST /cartera/retirar`, `55600`).
- **H18 · Sin cambiar contraseña ni correo** (web `Acceso`, `RutaCuenta.jsx:128-252`; la nativa ya lo tiene para el
  conductor de empresa: `Repositorio.kt:181`), sin «Mándanos una idea» (`OpinionRuta.jsx:72-110`; `POST /opinion`,
  `server.py:54411`), sin la hora del aviso de la mañana, sin idioma.

## Lo que la web tiene y la nativa no (paridad)

El servidor ya lo soporta todo lo de esta tabla: es trabajo solo de la app. Esfuerzo orientativo: **S** medio día,
**M** uno o dos días, **L** tres a cinco.

| # | Función | En la web | Falta en la nativa (prueba) | Esf. |
|---|---|---|---|---|
| 1 | Suscribirse / gestionar / canjear | `RutaCuenta.jsx:323-705` | solo texto del plan, `Pestanas.kt:405-412`; no llama a `/billing/*` | L |
| 2 | «Sales a las», minutos, con tráfico / tu orden | `MiRuta.jsx:2154-2177` | `HoyPantalla.kt:291` | S |
| 3 | Tarifa y «Mi dinero hoy» con gasolina, neto y €/hora | `MiRuta.jsx:1019-1031`, `1626-1644`, `2182-2207` | sin `PUT /reparto/ganancias`; `HoyPantalla.kt:298-300` solo lee | S |
| 4 | Retraso («vas X min por detrás», «llega N min tarde») | `MiRuta.jsx:1015-1017`, `1417`, `2180` | `Parada` sin `tarde_min` | S |
| 5 | Qué lleva, horario del cliente, hueco en la furgoneta | `MiRuta.jsx:1795-1815`, `2303-2319` | `FichaParada.kt:187-188` solo conserva | S |
| 6 | Buscar en la ruta | `MiRuta.jsx:1361-1367` | nada en `ui/hoy/` | S |
| 7 | Reordenar a mano (arrastrar o flechas) | `MiRuta.jsx:862-908`, `1266-1300` | `Repositorio.kt:354` existe sin quien lo llame | M |
| 8 | Firma en pantalla | `MiRuta.jsx:2260-2301` | `Hojas.kt:203-284` | S |
| 9 | Navegación dentro de la app con voz, manos libres, «has llegado» | `Navegacion.jsx` entero | `Acciones.kt:23-29` abre Google Maps / Waze | L |
| 10 | Punto azul, km/min por las calles, zonas C/D, próximas 4 en Maps | `MiRuta.jsx:297-351`, `1322-1358` | `MapaRuta.kt:76-92` | M |
| 11 | Ver la puerta (Street View) | `MiRuta.jsx:2238-2258` | sin `/fachada` | S |
| 12 | Paquete encontrado en grande + hueco al escanear | `MiRuta.jsx:1560-1578` | `EscanerVM.kt:94-95` (una línea) | S |
| 13 | Historial: semana en barras, ganado, Excel gestoría, otro día | `RutaApp.jsx:424-513`, `410-418` | `Pestanas.kt:108-180` | M |
| 14 | Día: hora de entrega, ver prueba, pasar a hoy | `RutaApp.jsx:587`, `603-613` | `HoyPantalla.kt:506` | S |
| 15 | Ajustes: minutos/parada y bulto, tráfico, borrar a los N días, IA | `Reparto.jsx:560-603` | `Pestanas.kt:182-330` | S |
| 16 | Aviso de la mañana (elegir hora) | `AvisoManana.jsx` | sin `/reparto/aviso-manana` | S |
| 17 | Cartera: saldo, cobrar, QR | `RutaCuenta.jsx:714-849` | `Pestanas.kt:339-400` | M |
| 18 | Cambiar contraseña y correo; mándanos una idea; opinión al acabar | `RutaCuenta.jsx:128-252`, `OpinionRuta.jsx` | sin `/opinion`; `change-my-password` solo en el portal de empresa | S |
| 19 | Pegar una lista, foto de la hoja, fichero CSV | `MiRuta.jsx:950-992`, `1645-1678` | sin `/reparto/pegar` (el OCR ya está en la app: `LectorEtiqueta.kt`) | M |
| 20 | Primera vez: «¿cómo te llegan las paradas?», paradas de ejemplo, consejos del día, comparte tu día | `MiRuta.jsx:198-220`, `697-705`, `1106-1112`, `1951-2022` | `HoyPantalla.kt:375-388` (dos botones) | M |
| 21 | Idiomas (es, en, pt, fr, it, de) y letra más grande | `lib/idioma.js:27-29`, `AjustesMovil.jsx` | textos en español dentro del código (sin `strings.xml`); la letra ya la escala Android | L / — |

Lo que la nativa tiene y la web no: la nota en «No entregado», el importe cobrado editable, el escáner con ML Kit y
linterna (más rápido y fiable que el `BarcodeDetector` del navegador), la cola sin cobertura con candado, los avisos
aunque la app esté cerrada, y la foto girada bien.

## Frente a Spoke, Zeo y Routal (lo visto el 29-10)

- **Spoke (Circuit)**: finder de paquetes, foto y nota de entrega, ventanas horarias y prioridad, **pausas y tiempo por
  parada**, navegación dentro o con Maps/Waze, **editar paradas por voz**, escáner de etiquetas. Gratis hasta 10 paradas
  por ruta; Lite 9,99 $/mes; Standard 19,99 $/mes.
- **Zeo**: paradas por voz, por imagen y por CSV; **avisos para reoptimizar** cuando vas tarde; compartir la hora de
  llegada con el cliente.
- **Routal Drivers**: gratis hasta 10 paradas al día.
- **FDS**: hoy gratis y sin límite (promoción hasta el 31-12); después 15 paradas al día gratis, y sin tope por 9,99 €/mes
  o 99 €/año. El tramo gratis es más generoso que el de todos ellos.

**Lo que FDS (web) tiene y ellos no**: «Mi dinero hoy» y lo ganado en la semana y el mes; el bono e «invita y gana»;
«la última vez en esa puerta»; el Excel para la gestoría; el WhatsApp al cliente con seguimiento sin datos personales;
la lista pegada o la foto de la hoja de reparto; el aviso de la mañana a su hora. Es el ángulo que ninguno trabaja
(el dinero del repartidor, no solo la ruta) y la nativa es donde menos se ve: ahí hay que llevarlo.

**Lo que ellos tienen y FDS no (ni web ni nativa)**: la **pausa de comida** en el plan y el tiempo **por parada**
individual (FDS tiene minutos por parada global y por bulto, `Reparto.jsx:560-566`; en `server.py` no hay «pausa» ni
«descanso» para el reparto); **reoptimizar solo** cuando vas tarde (la web avisa del retraso pero no propone reordenar);
y en la nativa, meter paradas **por voz**.

## Qué añadir o cambiar, por orden

### Tanda 1 — antes del 31-12: la nativa al nivel de la web en lo que paga el día
1. **Pagar en la app** (H16, L). En la de Play, Google Play Billing con los productos que ya conoce el servidor
   (`repartidor_mensual`, `repartidor_anual`) y `POST /billing/play/verificar`; en la `.web` (la de la web), abrir
   `POST /billing/stripe/suscripcion` en el navegador. Tarjeta del plan como la de la web (`Estado`,
   `RutaCuenta.jsx:255-318`): qué tienes, hasta cuándo, qué pasa después; canjear código; y cuando el servidor conteste el
   tope (402 al crear parada), el aviso con el botón, no solo el error. Dónde: `Pestanas.kt` (Cuenta) + `Pago.kt` nuevo.
2. **Cabecera del día completa** (H3, H4, S): «Sales a las 09:00 · Acabas ≈ 09:24 · 2,0 km · 24 min», chip «con tráfico
   típico» / «tu orden» / «por distancia», «vas X min por detrás» y «llega N min tarde» en la parada. Dónde:
   `HoyPantalla.kt:271-310` (Resumen, Etiquetas), `Modelos.kt` (+`tarde_min`).
3. **Tarifa y dinero** (S): en Ajustes «Te pagan por entrega / fijo por día / gasolina por km» (`PUT /reparto/ganancias`)
   y en el resumen «Llevas 24 € · gasolina ≈ 3 € · 11 €/hora · limpio 21 €», como la web. Y «¿Cuánto llevas ganado hoy?
   Pon tu tarifa» cuando no la tiene. Dónde: `Pestanas.kt` (Ajustes), `HoyPantalla.kt:298-300`.
4. **Ficha de parada completa** (H7, S): qué lleva, horario del cliente («de 10 a 12») y la rejilla de la furgoneta
   (seis huecos, como la web `HuecoRejilla`). Dónde: `FichaParada.kt`.
5. **Historial de verdad** (H12-H14, M): la semana en barras con la anterior y lo ganado; el Excel del mes para la gestoría
   (`GET /reparto/entregas-mes` → hoja de compartir de Android); «ver otro día»; y en cada parada la hora, «Ver prueba de
   entrega» (`GET /reparto/pedidos/{pid}/foto`) y «Pasar a hoy». Arreglar «1 entregas». Dónde: `Pestanas.kt:108-180`.
6. **Buscar y reordenar a mano** (H2, S + M): el buscador a partir de 5 paradas; y «A mano» con arrastrar (o flechas) que
   llame al `ordenAMano` que ya existe (`Repositorio.kt:354`).
7. **Firma en pantalla** (H8, S): un `Canvas` blanco, PNG 480×160 en base64 en `firma`, solo cuando es «en mano», «al
   vecino» o «portería», como la web. Dónde: `Hojas.kt:203-284`.
8. **Dos detalles**: recargar la ruta tras entregar para que el bono se mueva (H11), y el bono en una línea con la ruta
   en marcha (H1).

### Tanda 2 — lo que hace que la elijan frente a Maps y papel
9. **«Has llegado» al volver de Google Maps o Waze** (M): al volver la app al frente, si estás a menos de 40 m de la
   siguiente parada, abrir la hoja de entregar con «Has llegado» (es lo que hace la guía de la web al llegar,
   `Navegacion.jsx:184-193`). Da el 80 % del valor del navegador propio sin construirlo.
10. **Mapa** (H5, M): tu punto azul (osmdroid `MyLocationNewOverlay`), «Por las calles: km · min», las zonas de carga y
    descarga con su interruptor, «Las próximas 4 paradas en Google Maps», y la hora prevista en el marcador.
11. **Ver la puerta** (H6, S): Street View con el rumbo que calcula el servidor (`/fachada`), con el intent
    `google.streetview:`.
12. **Paquete encontrado en grande** (H10, S): al escanear uno que ya está, el número de parada a toda pantalla medio
    segundo y el hueco si lo tiene; con 80 paquetes es lo que se mira.
13. **Primera vez** (M): «¿Cómo te llegan las paradas?» con sus cuatro caminos, paradas de ejemplo
    (`POST /reparto/mis-pedidos/ejemplo`), pegar lista y **foto de la hoja de reparto** (el OCR de ML Kit ya está en la
    app), y un consejo al día como la web.
14. **Cuenta completa** (H17, H18, M): cartera con saldo y «Cobrar» (`/cartera/retirar`), QR de invitación, cambiar
    contraseña y correo (la nativa ya llama a `auth/change-my-password` para el conductor), «Mándanos una idea» y la
    opinión al acabar la ruta (`/opinion`), y la hora del aviso de la mañana (`/reparto/aviso-manana`).
15. **Ajuste «Pedir siempre la prueba de entrega»** (H9, S): para quien reparte para una agencia que la exige.
16. **Ajustes que faltan** (H15, S): minutos por parada y por bulto, contar el tráfico, borrar datos de clientes a los N
    días, IA si la cuenta la tiene.

### Tanda 3 — después, con usuarios de verdad
17. **Navegación con voz dentro de la app** (L): `POST /reparto/mi-ruta/navegar` ya da los pasos; faltaría el mapa que
    sigue, el TTS de Android y el recálculo. Solo si los repartidores lo piden: Google Maps y Waze navegan mejor; el
    valor diferencial es manos libres («entregado», «no entregado», «llamar») y eso puede hacerse encima de Maps (9).
18. **Idiomas** (L): sacar los ~400 textos a `strings.xml` (es, en, pt, fr, it, de como la web). Antes no: la web ya
    atiende a quien no habla español.
19. **Pausa de comida y tiempo por parada individual** (M, servidor + web + nativa): lo que Spoke tiene y FDS no.
20. **Comparte tu día** (M): la imagen con paradas, horas y km que la web ya genera (`lib/compartirDia.js`), desde la
    hoja de compartir de Android. Es viral y gratis.
21. **Dictar la dirección** (S): `SpeechRecognizer` de Android en la ficha de parada.

## Qué no hacer
- **No traducir la nativa ahora** (18): es lo más caro y no hay usuarios fuera de España; la web ya los atiende.
- **No meter el mercadillo** de la web en la nativa: distrae de la ruta y lo revisa Play con lupa (contenido de usuarios).
- **No construir el navegador propio antes que la tanda 1**: lo que se cobra es el plan, no el GPS.
- **No volver a poner el bono o «invita» encima de la ruta**: la web ya aprendió (23-10) que encima del escáner
  distraía a quien aún no metió su primer paquete.
- **No duplicar hojas**: la de parada, la de entregar y la de no entregado ya están bien; lo nuevo entra en ellas.

## Orden propuesto y cuándo está hecho
1. **Tanda 1** (noviembre, antes de que acabe la promoción): hecho cuando un autónomo con la app de Play puede suscribirse
   y ver su plan sin salir de la app; la cabecera dice sales, acabas, minutos y retraso; la tarifa se pone en la app y
   el resumen enseña el neto; la ficha tiene qué lleva, horario y hueco; el historial tiene hora, prueba, semana y Excel;
   se busca y se reordena; y se firma. Todo con prueba en `app-android/pruebas/api_conductor.py` (contrato) y en Gradle.
2. **Tanda 2** (diciembre): hecho cuando al volver de Maps sale «Has llegado»; el mapa tiene punto azul, zonas y
   «próximas 4»; el escáner enseña el número en grande; la primera vez pregunta cómo llegan las paradas; y Cuenta tiene
   cartera, QR, contraseña, idea y aviso de la mañana.
3. **Tanda 3** (2027, con usuarios): navegación con voz, idiomas, pausa de comida, comparte tu día, dictar.

## No verificado
- Que los productos `repartidor_mensual` y `repartidor_anual` estén creados y activos en Play Console (el servidor los
  nombra; no he entrado en la consola).
- Que el aviso de la mañana llegue a los móviles con token FCM: `_aviso_manana_vuelta` (`server.py:22193-22201`) los
  cuenta, pero no lo he hecho sonar de punta a punta en el emulador.
- «Navegar» en un móvil real con Google Maps y Waze instalados (el emulador no tiene apps de mapas; no lo pulsé).
- El rendimiento de la lista nativa con 80 paradas o más (el servidor de pruebas tenía 4).
- El texto exacto que enseña la nativa cuando el servidor devuelve el tope del plan gratis (402): hoy la promoción lo
  impide probar.
- Los precios y funciones de Spoke, Zeo y Routal son los de sus páginas el 29-10; cambian.
