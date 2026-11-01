# FDS, el siguiente nivel — 01-11-2026

> Dani (01-11, 01:4x): «si eso no funciona es porque la app no es lo suficientemente buena; debemos ir por delante y
> ser mejores que la competencia, ofrecer cosas que otros no ofrecen [...] ideas realistas y buenas que faciliten y
> mejoren el trabajo y la eficiencia de la app, mejora el visual, funcionalidades y mapa [...] no te quedes en lo
> básico, avanza al siguiente nivel [...] debes ser tú quien monte algo increíble».
>
> Esto es lo que yo montaría. Cada idea dice qué es, por qué un repartidor la usaría CADA DÍA, qué hay ya en FDS,
> cómo se construye con lo que tenemos (sin inventar infraestructura), cuánto cuesta en días, y quién lo tiene hoy
> (para no vender como nuevo lo que no lo es). Lo que viene de fuera lleva su fuente (§6). Lo comprobé contra el
> código antes de escribirlo: las zonas de la furgoneta, la puerta aprendida, la voz, el mapa y la foto de entrega
> existen; la carga guiada, el briefing, la memoria compartida, la comprobación con IA, la hora buena, la propina,
> el perfil verificado y el mapa vectorial no.

## 0. La idea madre

Un repartidor abre una app todos los días si le hace **llegar antes, fallar menos entregas y ganar más, y se lo
puede demostrar a alguien**. Todo lo de abajo cuelga de esas cuatro cosas. Ninguna app del mercado las junta: Spoke
y Routal ordenan la ruta; Gridwise y Solo cuentan el dinero; Amazon y HERE guían el último metro solo dentro de sus
sistemas; nadie le da al autónomo español una prueba verificada de su trabajo ni un cliente que le ayude antes de
llegar. FDS ya tiene media casa construida (escáner, foto a la hoja, ruta por tiempo, voz, cliente que contesta,
«mi dinero hoy», puerta aprendida, foto de entrega); lo de abajo es lo que la convierte en la que «no puedo dejar».

## 1. Lo que la competencia ya hace (comprobado hoy, para no repetirlo como novedad)

| Quién | Lo que tiene | Lo que NO tiene |
|---|---|---|
| Spoke (ex Circuit) | Ruta optimizada, 10 paradas gratis por ruta, prueba de entrega, reparto en equipo, **Package Finder** (escaneas al cargar y luego te dice dónde está) | Nada del dinero, nada del cliente que contesta, nada de reputación |
| Routal Drivers (Barcelona) | Foto a las etiquetas («menos de 1 s por envío»), paradas por voz, bici/pie, CO2, 10 paradas gratis, 9,90 €/mes | Una reseña de Capterra: «en ruta no puedes parar a ver qué paquetes entran en cada parada; se vuelve lioso» |
| Zeo | Rutas sin conexión, pensado para gig | Precio sin publicar; nada de carga ni de cliente |
| Amazon Flex (2026) | Pantallas de inicio de ruta, **entradas de edificio** (junio 2026), aviso de llegada al cliente por número de Amazon, mapa con límites de velocidad y colegios | Solo dentro de Amazon; sin ruta propia |
| HERE «Last Meter» (beta, mayo 2026) | Dónde aparcar, por dónde andar y qué portal, con datos de sensores | Es una API para flotas grandes; no la verá un autónomo |
| DispatchTrack «Driver AI» (2025) | **Resumen de 30 s por voz antes de cada parada** (acceso, portal, aparcamiento, ascensor) | Enterprise; 149 $+/mes |
| Gridwise / Solo | €/hora, cuándo salir, gastos y kilómetros, asistente IA (Solo) | No ordenan ruta; EE. UU. |
| Bettermile (blog) | Carga LIFO: el siguiente paquete junto a la puerta «ahorra 2-3 min por parada» | Es un sistema de empresa |

Conclusión: **ordenar la ruta ya no distingue a nadie.** Lo que distingue es lo que pasa antes de salir (la carga),
en los últimos 50 metros (el portal, el cliente), después (el dinero y la prueba) y lo que se acumula con los días
(la memoria de la calle y la reputación).

## 2. Las doce cosas, por orden de impacto partido por esfuerzo

### 1. Carga guiada: la furgoneta se organiza sola mientras escaneas (3-4 días)
- **Qué es.** En la nave, al escanear cada paquete, FDS le asigna un hueco (las 6 zonas que ya existen: delante/medio/
  detrás × izquierda/derecha) según la POSICIÓN que ese paquete tendrá en la ruta: lo último que se entrega va al
  fondo, lo primero junto a la puerta (LIFO). La pantalla enseña el dibujo de la furgoneta con el número de paquetes
  por hueco y, al llegar a cada parada, dice «está delante a la izquierda» (en pantalla y por voz). Si reordenas la
  ruta, te avisa de qué mover (normalmente nada: las zonas son gruesas a propósito).
- **Por qué engancha.** Es lo primero que hace cada mañana y donde más minutos se pierden: 2-3 min por parada buscando
  (Bettermile); un caso real de escáner de carga pasó de 40 a 15 min (OnTrac). Y es la crítica literal a Routal.
- **Lo que hay.** El escáner por lotes, la ruta ordenada antes de cargar («carga y sale con la ruta hecha») y las
  zonas manuales (`HUECOS` en `MiRuta.jsx`, «¿Dónde va en la furgoneta?»). Falta que la zona la proponga la app.
- **Cómo.** Al confirmar la carga, `ordenar` ya devuelve el orden; asignar hueco = `posición / n_paradas` → 6 tramos,
  con dos reglas: bultos grandes al suelo y «prioridad» siempre delante. Guardar `hueco_sugerido` en la parada; la
  ficha y la voz lo leen. En la nativa, lo mismo (`RutaVM`), con el dibujo en Compose.
- **Quién lo tiene.** Spoke, a medias (Package Finder: te dice dónde dejaste cada paquete, no te dice dónde ponerlo).

### 2. El briefing de la parada, por voz, 300 metros antes (2-3 días)
- **Qué es.** Al acercarte (GPS a 300 m), una frase de 15-30 s: «Calle Real 12, 3.º B. El cliente dice que está hasta
  las seis; portal 4321; la última vez entraste por la puerta de atrás; deja en el buzón si no está. Paquete en
  delante-izquierda». Manos libres, sin tocar nada.
- **Por qué engancha.** Es lo que DispatchTrack vende a flotas por 149 $/mes, y lo que Amazon está construyendo con
  las entradas de edificio. El repartidor no lee en la furgoneta: escucha.
- **Lo que hay.** La guía por voz (`Navegacion.jsx`, `speechSynthesis`), «lo que dice el cliente» (`cliente_dice`), la
  puerta aprendida (`geo = puerta`), las notas de la parada y «dónde va en la furgoneta». Solo hay que juntarlo en una
  frase y dispararla por distancia.
- **Cómo.** Web: `watchPosition` + distancia a la siguiente parada + `speechSynthesis` en el idioma de la cuenta.
  Nativa: `TextToSpeech` de Android + el `LocationCallback` que ya mueve el mapa. Una plantilla por idioma (7).
- **Quién lo tiene.** DispatchTrack (enterprise). Ningún planificador de autónomos.

### 3. Memoria de la calle compartida (3 días)
- **Qué es.** Cada portal acumula lo que se aprende: código, «deja en el buzón», «perro», «entrada por el garaje»,
  «no hay ascensor», la foto del portal, y a qué hora suelen estar. Para el autónomo es suya; para una empresa es DE
  LA EMPRESA: el conductor nuevo en una ruta hereda lo que sabía el anterior. Es exactamente lo que Amazon y HERE
  llaman «last meter» y lo que ninguna app pequeña hace.
- **Lo que hay.** `mis-direcciones` (direcciones conocidas por cuenta), la puerta aprendida por posición al entregar,
  y las notas por parada (se pierden con el pedido).
- **Cómo.** Colección `calle_memoria` por empresa (clave: dirección normalizada + geohash): notas estructuradas
  (código, dónde dejar, acceso, foto) + contadores de éxito por franja horaria (ver 5). Se rellena desde la ficha de
  la parada con tres toques («Guardar para la próxima») y se enseña en la ficha y en el briefing (2). RGPD: datos
  de acceso a un edificio son datos del cliente final; se guardan como «instrucciones de entrega» con la misma base
  legal que el pedido y caducan con el último pedido a esa dirección (12 meses), como ya caducan los candidatos.
- **Quién lo tiene.** Amazon (dentro), HERE (beta). Spoke/Routal, no.

### 4. Comprobación de puerta con IA: la entrega que nadie puede discutir (2 días)
- **Qué es.** Al hacer la foto de entrega, Gemini Flash mira si sale el número o el portal de ESA dirección, si se ve
  el paquete y si el sitio es razonable (buzón, puerta, conserje). Si no cuadra, avisa ANTES de marcar entregado
  («no se ve el número; haz la foto con la puerta»). La parada queda «entrega verificada» y el enlace del cliente lo
  enseña con la hora y el punto GPS.
- **Por qué engancha.** El 45 % de las reclamaciones a las mensajerías en España son «no me lo han entregado» (OCU,
  enero 2026); el autónomo cobra por paquete entregado y pierde el pago (o le cae la bronca) cuando no puede probarlo.
  Una prueba verificada es dinero para él y una queja menos para la agencia.
- **Lo que hay.** La foto de entrega, el punto GPS, la IA de daños con Gemini (la misma llave), el enlace de
  seguimiento. Falta el juicio sobre la foto.
- **Cómo.** En `POST /reparto/pedidos/{id}/estado` con foto: una llamada a Gemini Flash con la dirección y la foto
  (≈0,001 € cada una al precio actual; 150 fotos/día = 0,15 €/día por repartidor). Respuesta estructurada: {numero_visible,
  coincide, paquete_visible, lugar}. Si `coincide = no`, 200 con `aviso` y la app pregunta; nunca bloquea (la IA se
  equivoca). Guardar el veredicto. Cola si Gemini no contesta (ya existe el patrón de reintentos).
- **Quién lo tiene.** Amazon (foto de entrega con verificación). Ninguna app de autónomos.

### 5. La hora buena de cada puerta (3-4 días, mejora con el uso)
- **Qué es.** Por cada dirección (y por calle, cuando no hay historia), FDS aprende a qué horas las entregas salen
  bien y a cuáles fallan, y el ordenador de ruta prefiere esas horas («mejor entre 16 y 19»). En la ficha: «aquí
  suelen estar por la tarde (4 de 5)».
- **Por qué engancha.** Cada fallida es una vuelta (y en paquetería, un paquete no cobrado). Es la función que más
  dinero devuelve con el tiempo, y nadie la ofrece al autónomo.
- **Lo que hay.** Las ventanas horarias y el orden por tiempo (`ordenar`), el historial de entregas con hora y resultado.
- **Cómo.** Una tabla de agregados por dirección normalizada × franja de 2 h (éxitos/fallos), actualizada al cerrar
  cada parada; el optimizador la usa como ventana blanda (penalización, no prohibición). Arranca por cuenta; en una
  empresa, por empresa. En cuanto haya 5 datos de una puerta, se enseña.
- **Quién lo tiene.** Las grandes plataformas por dentro. Ninguna app de ruta.

### 6. El cliente avisado solo, la propina y la valoración (2-3 días + configurar Meta)
- **Qué es.** (a) Al empezar la ruta, cada cliente con teléfono recibe «Tu paquete llega entre las 11 y las 12;
  si no vas a estar, dinos dónde dejarlo» con el enlace que ya existe; a 2 paradas, «llego en 10 min». Para una
  empresa va por la API de WhatsApp (≈0,02-0,05 € por mensaje de utilidad, a confirmar en la tabla de Meta, se
  repercute); para el autónomo, un botón «Avisar a todos» que abre WhatsApp con cada cliente, uno tras otro. (b) Al
  entregar, la página de seguimiento dice «¿Cómo ha ido? ★★★★★» y «Invítale a un café» con el enlace de Bizum del
  repartidor (Bizum es gratis entre particulares; desde 2026 los bancos informan a Hacienda de los cobros de
  profesionales por cualquier medio, así que en la app se dice claro que es un ingreso).
- **Por qué engancha.** El aviso reduce fallidas (lo pide la calle, informe del 30-10); la propina y la estrella son
  la primera recompensa del día que no depende de la agencia. Y la valoración alimenta el punto 7.
- **Lo que hay.** El enlace de seguimiento con respuesta del cliente, el aviso al repartidor cuando contesta, la
  integración de WhatsApp (sin configurar: `WHATSAPP_*`), el campo teléfono.
- **Cómo.** Un paso más en `ordenar` (envío en lote para empresas con plantilla de utilidad aprobada) y un botón en
  «Hoy» para autónomos; en `SeguimientoPedido.jsx`, valoración (1 toque) y enlace Bizum (`bizum://`/número, con el
  consentimiento del repartidor en Cuenta). Guardar `valoracion` en el pedido y en el perfil (7).
- **Quién lo tiene.** Avisos al cliente: todos los de flotas; propina al repartidor por Bizum: nadie en España.

### 7. El currículum de reparto: el perfil verificado del repartidor (3-4 días)
- **Qué es.** Una página pública `flotadsp.com/r/<código>` con lo que FDS puede verificar porque lo ha visto: entregas
  hechas, % a la primera, puntualidad en las franjas, valoraciones de clientes, zonas que domina, meses en activo,
  «entregas verificadas por IA». El repartidor la enseña a la agencia para negociar la tarifa o para que le den
  más ruta; la empresa que busca repartidores (Empleo de FDS) la ve en la candidatura.
- **Por qué engancha.** Crea la necesidad que pedías: el repartidor quiere los números porque le dan trabajo, y
  solo los tiene si reparte con FDS cada día. Nadie en España ofrece una reputación portátil al repartidor de
  paquetería; es lo que Gridwise hace con el dinero y Uber con las estrellas, pero del lado del trabajador.
- **Lo que hay.** Estadísticas (`reparto/estadisticas`), el historial, Empleo con candidaturas, «invita y gana».
- **Cómo.** Agregados ya calculables; una página pública con lista blanca de campos (nada de clientes ni direcciones);
  el repartidor decide qué enseña; se enlaza desde Cuenta y desde la candidatura de Empleo.
- **Quién lo tiene.** Nadie para paquetería en España.

### 8. El mapa de verdad: vectorial, con números de portal, oscuro y sin conexión (5-8 días)
- **Qué es.** Hoy la web pinta Leaflet con teselas de imagen y la nativa osmdroid (también imagen): se ve como un
  mapa de 2015. Pasar a **MapLibre GL** (web y Android) con teselas vectoriales **Protomaps (PMTiles) alojadas en
  nuestro R2**: coste por petición cero, números de portal y entradas a partir del zoom 18, «modo furgoneta» oscuro
  de noche, el mapa gira con el rumbo, las paradas con el color de su franja (verde a tiempo, ámbar justa, rojo
  pasada), agrupadas de lejos, y la ciudad descargable para ir sin cobertura (un fichero PMTiles por provincia).
  La navegación giro a giro sigue en Google Maps/Waze, que es lo que el repartidor prefiere, con un botón flotante
  «Volver a FDS» (hoy ya se vuelve, pero sin el chip).
- **Por qué.** Es la parte «visual» que más se nota, y la que más confianza da a un cliente de empresa en una demo.
  Mapbox cobra por usuario activo; MapLibre + PMTiles es gratis y nuestro.
- **Cómo.** `maplibre-gl` en `MapaReparto.jsx`/`Navegacion.jsx` (misma API de capas que Leaflet, cambia la fuente),
  `maplibre-android` en la nativa (sustituye a osmdroid en `MapaRuta.kt`), estilo propio (una variante clara y una
  oscura), PMTiles de España generados con Planetiler (una vez al mes, en GitHub Actions) y subidos a R2 con el
  dominio propio que de todas formas hay que montar (auditoría §5).
- **Quién lo tiene.** Spoke y Routal usan Google/Mapbox (mejor que el nuestro hoy). Esto nos pone a su altura en
  lo visual y por delante en coste y en modo sin conexión.

### 9. «Compartir con FDS»: la hoja de la agencia entra sola (1-2 días)
- **Qué es.** En Android (y en el iPhone con la hoja de compartir), cualquier PDF, foto, captura o texto compartido
  con FDS se convierte en paradas: el manifiesto en PDF de la agencia, la captura del WhatsApp del jefe, la lista del
  Excel. Gemini ya lee la foto de la hoja; falta que FDS aparezca en «Compartir».
- **Cómo.** `ACTION_SEND`/`SEND_MULTIPLE` en el manifiesto (hoy no está) → `MainActivity` → la misma ruta que «foto a
  la hoja» (`reparto/escanear` / lectura con Gemini). En iOS, la extensión de compartir de Capacitor.
- **Quién lo tiene.** Routal, por foto; por «compartir» desde cualquier app, no lo he visto en ninguna.

### 10. El día en una tarjeta y el trimestre para la gestoría (2-3 días)
- **Qué es.** Al cerrar el día, una tarjeta para el estado de WhatsApp: entregas, a la primera, €/hora, km, hora de
  fin, con tu enlace de invitación (existe `compartirDia.js`: hay que convertirla en la joya). Y al mes y al
  trimestre, el fichero para la gestoría con gastos (foto del ticket) y kilómetros, IVA e IRPF (existe el Excel;
  faltan gastos y el formato trimestral).
- **Por qué.** Lo que un repartidor enseña a otro es cuánto ganó y a qué hora acabó (Para, Gridwise). La gestoría
  es el gasto fijo que más duele al autónomo.

### 11. Para empresas: «Entrega al renting» (2 días)
- **Qué es.** Un flujo completo: fotos de salida (cuando llega la furgoneta) y fotos de devolución, la IA marca lo
  nuevo, y sale un dosier PDF fechado con cadena de custodia (`/verify`) para discutir la «matriz de daños» de la
  empresa de alquiler (franquicias de 1.250-2.000 € por furgoneta, National 2026). Es el argumento de venta número
  uno de Flota para una DSP (auditoría §7).
- **Lo que hay.** Inspecciones con fotos, IA de daños, peritaje firmado. Falta el flujo «salida ↔ devolución» con
  el PDF comparado.

### 12. Para empresas: el jefe de nave a las 6:30 en el móvil (2 días)
- **Qué es.** «Mi día» como primera pantalla del móvil del jefe de nave: quién falta, quién sin furgoneta, auditorías
  sin hacer, lo que vence hoy, la furgoneta que no sale, con un toque para avisar por WhatsApp. Existe `MiDia.jsx`
  para escritorio; falta que quepa en una pantalla de móvil y sea lo primero.

## 3. El visual: «modo furgoneta»

Lo que yo cambiaría de la pantalla de ruta, y por qué (hay un boceto en `docs/bocetos/hoy-modo-furgoneta.svg`):

1. **Una pantalla, una acción.** Arriba, la SIGUIENTE parada ocupa un tercio: dirección en 22 px, franja con su color,
   lo que lleva y en qué hueco, lo que dijo el cliente, y dos botones grandes (Navegar · Entregado). Todo lo demás
   (lista, mapa, dinero) está a un toque pero no compite.
2. **El mapa detrás, no al lado.** MapLibre a pantalla completa con el rumbo arriba; la tarjeta flota encima. De
   noche, oscuro solo.
3. **Objetivos de 56 px** y separación de 12 px: se usa con guantes, con el móvil en el soporte y a 30 cm.
4. **Color con significado y nada más**: verde (hecho), ámbar (franja a menos de 30 min), rojo (fallida o franja
   pasada), azul (siguiente). Sin degradados decorativos.
5. **El anillo del día** arriba a la derecha: 37/112 y la hora prevista de fin; se toca y sale «Mi dinero hoy».
6. **Sonido y vibración**: un tono al marcar entregado, otro al llegar a 300 m (con el briefing), nada más.
7. **Letra**: 18 px de base en modo ruta (hoy 14-15), Inter como está; números en tabular.
8. **Animación de entregado**: la tarjeta se va y la siguiente entra en 250 ms; es la única animación.

## 4. En qué orden lo haría (y qué medir)

| Semana | Qué | Se mide con |
|---|---|---|
| 1 | Briefing por voz (2) + «Compartir con FDS» (9) + la tarjeta del día (10) | Paradas con briefing escuchado; rutas creadas desde «compartir»; tarjetas compartidas |
| 2 | Carga guiada (1) + comprobación de puerta con IA (4) | Minutos de carga (hora del primer escaneo → salida); % de entregas «verificadas» |
| 3-4 | Memoria de la calle (3) + hora buena (5) + cliente avisado y propina (6) | Fallidas por cada 100 paradas; respuestas del cliente; propinas |
| 5-6 | Perfil verificado (7) + «modo furgoneta» con MapLibre (8) | Perfiles compartidos; demos a empresas con el mapa nuevo |
| En paralelo (empresa) | Entrega al renting (11) y Mi día móvil (12) | Dosieres generados; aperturas de Mi día a las 6-8 h |

Todo esto va en web y nativa a la vez (la nativa de Android es la que se instala desde Play; la de iPhone es la
web). Antes de la semana 1: cerrar lo de Apple y lo de la auditoría §8 que requiere tus clics.

## 5. Lo que NO haría aunque suene bien
- Navegación giro a giro propia (Mapbox cobra por usuario; la nuestra sería peor que Google/Waze durante años).
- Medallas y rachas: en paquetería huele a juego; la reputación verificada (7) es la versión seria.
- Chat con IA «para preguntar cosas» dentro de la app de ruta: lo que vale es la IA que trabaja sola (4, 5, 9).
- Más idiomas y países antes de que lo anterior funcione en A Coruña.

## 6. Fuentes (consultadas el 01-11-2026)
- Spoke/Routal/Zeo/RoadWarrior: [Cigo](https://cigotracker.com/blog/best-apps-for-delivery-drivers/), [Routific](https://www.routific.com/blog/apps-for-delivery-routes), [SuiteFleet](https://www.suitefleet.com/blog/top-10-delivery-driver-apps-2026); Routal Drivers: [web](https://routal.com/en/products/drivers), [Capterra (opiniones)](https://www.capterra.es/software/195153/Routal), [lanzamiento](https://routal.com/en/blog/the-delivery-revolution-for-the-self-employed-is-here-the-new-routal-drivers-app-is-here)
- Amazon Flex 2026: [app actualizada](https://flex.amazon.com/blog/improved-flex-app-easier-deliveries/), [seguridad](https://flex.amazon.com/blog/safety-features-in-the-amazon-flex-app/), [blog (entradas de edificio, inicio de ruta)](https://flex.amazon.com/blog/)
- Último metro con IA: [HERE Last Meter Guidance (14-05-2026)](https://www.here.com/about/press-releases/here-unveils-ai-powered-last-meter-guidance-solution-to-help-delivery-drivers-complete-the-final-handoff), [SCMR](https://www.scmr.com/article/ai-is-reshaping-the-last-meter-of-delivery), [DispatchTrack Driver AI](https://www.dispatchtrack.com/blog/driver-ai-2/), [Bettermile](https://blog.bettermile.com/5-innovative-examples-of-last-mile-ai-in-action-f030d9e02faf)
- Carga de la furgoneta: [Bettermile, carga LIFO](https://blog.bettermile.com/parcel-sorting-loading-how-to-make-loading-efficient-for-every-driver-c23607c11429), [OnTrac (escáner de carga)](https://www.ninetwothree.co/case-studies/ontrac)
- Dinero y hábito: [Gridwise vs Solo](https://gridwise.io/blog/gridwise-vs-solo), [Solo](https://www.worksolo.com/blog/solo-vs-gridwise-which-gig-work-app-is-best-in-2026), [Gridwise earnings](https://gridwise.io/features/earnings)
- Quejas en España: [OCU, nota de prensa enero 2026](https://www.ocu.org/organizacion/prensa/notas-de-prensa/2026/mensajeria2210126), [OCU, quejas de mensajería](https://www.ocu.org/consumo-familia/compras-online/noticias/quejas-mensajeria)
- Bizum y propinas: [N26](https://n26.com/es-es/blog/propinas-espana), [Idealista: Bizum y Hacienda 2026](https://www.idealista.com/en/news/node/876231), [Stripe: Bizum](https://stripe.com/jp/resources/more/bizum-in-depth-guide)
- Mapas: [Mapbox precios 2026](https://www.woosmap.com/blog/mapbox-pricing), [Mapbox docs](https://docs.mapbox.com/accounts/guides/pricing.md), [MapLibre vs otros](https://www.pkgpulse.com/guides/react-native-maps-vs-mapbox-rn-vs-maplibre-rn-mobile-2026)
