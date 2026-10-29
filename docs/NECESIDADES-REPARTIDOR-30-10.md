# Lo que de verdad le quita tiempo y dinero a un repartidor, y qué puede hacer FDS — 30-10-2026

Para Dani. La pregunta no es «qué le falta a la nativa frente a la web» (eso está en
`docs/REVISION-APP-AUTONOMO-29-10.md`), sino **qué necesita de verdad quien reparte y cómo se lo resolvemos**: en el
mapa (carga y descarga, cortes, atascos) y en todo lo demás, incluida la estructura y el aspecto de la app. Sin
falsos positivos: cada necesidad dice de dónde sale (fuente y fecha), y cada propuesta dice qué tenemos ya
(`fichero:línea`) y qué habría que hacer. Lo que no he podido comprobar está al final.

## En una página

**El dato que lo ordena todo.** Al repartidor autónomo **le pagan por paquete entregado, no por intento**: «nos pagan
por paquete entregado, no por ausencia» (Kate, repartidora, COPE, 02-07-2026; tarifas de 0,50 a 5 € por paquete).
Alrededor del **20 % de las entregas falla a la primera** (Harvard Business Review, citado por la UOC, 2024) y cada
fallo cuesta unos **15 €** a quien envía (PCA Predict). Con 60 paradas a 1,10 €, cada fallo es media hora perdida y
0 €. En los foros lo dicen a su manera: «no puedes volver con la furgona con paquetes sin repartir» (Forocoches,
2019); «es prácticamente imposible repartirlo todo», con «300-400 entregas diarias» y «10-12 horas» (Meneame, un
repartidor con diez años de oficio, 2021). **La necesidad número uno no es la ruta: es no fallar la entrega.** Y hoy FDS no la ataca: el WhatsApp al
cliente lo manda el repartidor a mano, parada a parada (`Hojas.kt:84`, `MiRuta.jsx:127-133`), y el enlace de
seguimiento es de solo lectura: el cliente no puede decir «no estaré, déjalo en portería» ni «estaré de 16 a 18»
(`server.py:52414-52438`, `SeguimientoPedido.jsx`).

**Las diez necesidades**, de más a menos dinero para el repartidor, y lo que haría FDS:

| # | Necesidad (fuente) | Lo que haría FDS | Tenemos |
|---|---|---|---|
| 1 | No fallar la entrega (COPE, UOC/HBR, Forocoches) | El cliente te ayuda antes de llegar: en su enlace dice si estará, dónde dejarlo, el código del portal y la franja | Enlace solo lectura |
| 2 | Encontrar la puerta: polígonos, s/n, bloques (Scandit, SEUR, DoorDash) | La app aprende la puerta exacta al entregar y la recuerda | «La última vez» por dirección, sin el punto |
| 3 | Aparcar sin multa y sin dar vueltas (RGC art. 94, Forocoches, atopisimo) | C/D con horario en la ficha, «dónde aparqué», «aparca una vez y entrega 4 a pie» | C/D en el mapa web |
| 4 | Tráfico y cortes de verdad (Scandit; Dani) | Cortes y obras de la DGT y atascos en el mapa; «reordenar desde aquí» | Tráfico típico por franjas |
| 5 | Zonas de bajas emisiones y franjas de reparto (Motor16, Moncloa, Covey) | Perímetros en el mapa y aviso según la etiqueta de tu furgoneta | Nada |
| 6 | Cargar en orden y no revolver (Xpedit, Circuit) | Orden de carga inverso y hueco automático al escanear | Hueco a mano en la web |
| 7 | Que no te reclamen (AEPD contra UPS; Ofcom 2026) | «Al vecino» con permiso del cliente y aviso automático al dejarlo | Foto, dónde, quién, firma |
| 8 | Saber cuánto ganas de verdad (Forocoches, COPE) | «Mi dinero» con las fallidas que no cobras y el €/hora | Web sí, nativa no |
| 9 | Papeles: gestoría y DeCA (BOE/proveedores DeCA) | Excel del mes (ya) y, si aplica, el DeCA con QR por ruta | Excel en la web |
| 10 | Cuerpo: pausas, agua, baños, calor (UGT/CGT 07-2026) | Pausa de comida en el plan; baños y agua en el mapa | Nada |

**Qué haría primero** (tanda A, detalle en «Orden propuesto»): (1) el enlace del cliente con «¿estarás?», dónde
dejarlo, código del portal y franja; (2) la app aprende la puerta y «dónde aparqué»; (3) cortes y obras de la DGT en
el mapa y «reordenar desde aquí» cuando vas tarde; (4) las fallidas en el dinero. Son las cuatro cosas que un
repartidor le enseña a otro porque **le han ahorrado dinero o una multa**: eso es lo viral, no una pantalla bonita.

**Y la app en sí** (sección «La app: estructura y aspecto»): con la ruta en marcha, la siguiente parada tiene que
ser lo primero de la pantalla, no lo tercero; cuatro pestañas «Hoy · Mapa · Dinero · Yo»; dos modos claros,
cargando y en ruta; números de parada más grandes para buscar el paquete con la caja en la mano.

## Qué dicen los repartidores (y los clientes, y las multas)

Fuentes leídas el 29 y 30-10-2026. Lo de foros es anónimo y en parte antiguo; lo marco.

| Queja | Dónde | Qué implica para la app |
|---|---|---|
| «Nos pagan por paquete entregado, no por ausencia; deriva a un punto de recogida si no vas a estar» | COPE, 02-07-2026 (repartidora viral) | Reducir fallos es dinero directo; el cliente debe poder decir dónde dejarlo |
| «No puedes volver con la furgona con paquetes sin repartir»; «ratio paquetes/hora imposible»; 230 km y 50-60 entregas en 12 h | Forocoches 7183239 (2019), 9508204 (2023), 8403463 | Lo que ahorra minutos por parada vale más que cualquier función nueva |
| Tráfico y dificultad para acceder a la dirección: los dos mayores problemas; el 67 % entrega en distintos tipos de punto | Scandit, encuesta a 1.200 conductores en 11 países (fecha ≈ 2022) | Tráfico real y la puerta exacta |
| Direcciones incompletas: «dar vueltas al edificio»; el pin en el edificio equivocado | AOL / DoorDash drivers | Instrucciones del cliente y punto real |
| «Se pica al interfono o timbre, esperas varios minutos» pero «ni esperan los 2-3 minutos de rigor»; «TODOS los repartos nos llegan al mediodía» y el portero solo está mañana y tarde | Meneame, hilo de un repartidor con diez años (Correos, Seur, Amazon), 173 comentarios, 11-2021 (#128, #115, #103) | Temporizador de espera en la parada; la franja de la portería la pone el cliente |
| «Tienen terminantemente prohibido dejarse a un vecino», salvo con portero; «el dispacher te obliga a entregarlo a un vecino» y «esa penalización va a ti aun no teniendo la culpa» | Meneame #3, #16 | Guardar el permiso del cliente y avisarle al dejarlo |
| «Te enrutan de una forma muy burda e ilógica»: «la entrega 10, 11, 45, 104, 22»; por eso «no seguir la ruta establecida» | Meneame #136 | Orden por tiempo (ya) y cambiarlo a mano (falta en la nativa) |
| «No te deja llamar si no estás a pocos metros de la entrega»; «aun estando en la misma portería no te dejaba validar»; en el campo «la geo estaba marcada a 2 kilómetros» | Meneame #158, #169 | Nunca bloquear nada por el GPS; aprender la puerta real |
| Ausentes falsos («repartidores que hacen llama-cuelga»), «strikes» al repartidor, «es prácticamente imposible repartirlo todo»; «un autónomo puede tener 300-400 entregas diarias», «10-12 horas» | Meneame #34, #16, #3, #27 | Un registro del intento que defienda al repartidor; la app tiene que aguantar 300 paradas |
| «Las apps de reparto comen muchísima batería»; «ni voy a gastar datos que no me van a pagar»; para mear, «entro en un bar o en un supermercado» | Meneame #159, #161 | Batería y datos mínimos; baños en el mapa |
| «Priorizaba primero los comercios y empresas y luego hacía la ruta normal» | Meneame #123 | Un toque «cierra a las 14:00» en los negocios |
| En un polígono o complejo de naves «es a veces difícil saber cuál es el punto exacto de entrega»; DPD Alemania probó what3words con un 15 % menos de tiempo | Blog de SEUR | Aprender la puerta resuelve lo mismo sin pedirle nada al cliente |
| Multa por doble fila 200 € (RGC art. 94); en C/D «exceder el tiempo, aunque repartas, misma sanción»; caso de 1.500 € en Torrelavega | Autonocion, Multas CEA, Forocoches 7887840, atopisimo | C/D con horario a mano; saber cuánto llevas parado |
| ZBE en 68 ciudades (149 obligadas); multas automáticas por cámara (200 €; Madrid 500 € sin autorización DUM); franjas de reparto (Ourense 7:30-11:00 y 15:00-17:00) | Motor16, Moncloa 07 y 10-2026, Covey, Autopista | Perímetros y franjas en el mapa y en el orden |
| Dejar el paquete al vecino sin avisar: sanción de la AEPD a UPS; clientes hartos de «ausente» falso y puntos lejanos; el 28 % de los paquetes, «en sitio inapropiado» | Forocoches 9306997, El Mercantil 05-2026, Ofcom 2026 | «Al vecino» solo con permiso y con aviso; prueba de entrega siempre a mano |
| Calor, sin pausas fijadas, sin agua, esperar fuera de los locales | UGT y CGT, 07-2026 (riders, no furgoneta) | Pausa en el plan; agua y baños en el mapa |
| Robos de la furgoneta mientras entregas (Fene, Sants, Sagunto, Valladolid) | Prensa 01, 04, 07 y 10-2026 | Entregar a pie varias seguidas acorta las ausencias; la prueba de entrega demuestra qué se entregó |
| Spoke: cobra tras 10 paradas «sin aviso»; quitaron «Restart route»; el cliente no puede escribir al repartidor; piden rutas guardadas que se repiten; ETAs que no cambian en hora punta ni con cortes | Capterra, justuseapp, Upper (reseñas 2025-2026) | Avisar del tope antes; «repetir la ruta de ayer»; respuesta del cliente; tráfico real |
| Zeo: con 100 paradas al día se pulsa «Listo» dos veces sin querer | Reseña en la web de Zeo | FDS ya tiene Deshacer (`HoyPantalla.kt:246`); no tocarlo |
| DeCA obligatorio en electrónico desde el 05-10-2026 para transporte público de mercancías; 401-600 € por envío sin documento (cifra de proveedores) | Plataforma Nacional, Dashdoc, Kaleidotrans, Jobers | Si aplica al autónomo de paquetería, el DeCA sale de la ruta |

## Pensar como repartidor: el día entero y dónde duele

**06:00, la nave.** Cargas 60 paquetes. Si los metes como vienen, a media mañana revuelves la furgoneta en cada
parada («cargar en el orden de las paradas ahorra hasta 30 minutos», Xpedit). Hoy FDS ordena la ruta la noche antes
(sale a la hora de salida, `Reparto.jsx:555`) y en la web se apunta el hueco a mano (`MiRuta.jsx:161-163`, 2303-2319).
Duele: no te dice el orden de carga, ni asigna el hueco solo, ni te avisa si te falta un paquete de la lista.

**08:00, salir.** ¿Puedes entrar en el centro con tu furgoneta? ¿A qué hora? Las ZBE multan por cámara y la carta
llega semanas después. FDS no sabe nada de ZBE ni de franjas de reparto.

**09:00-14:00, repartir.** Cada parada: aparcar (doble fila, C/D ocupada, zona azul), encontrar el portal (bloques,
polígonos, s/n), el telefonillo, el cliente que no está, el vecino, la foto. FDS tiene la ruta por tiempo, la
C/D en el mapa web con su horario (`reparto.py:787-830`), «la última vez en esa puerta» (`reparto.py:122`), la
hoja de entrega con dónde, quién, foto y firma (`Hojas.kt:203`, `MiRuta.jsx:1867-1924`), el WhatsApp con la hora y el
enlace. Duele: nada avisa al cliente solo, nada aprende el punto exacto, nada te dice dónde dejaste la furgoneta
ni qué paradas puedes hacer a pie desde ahí, y el tráfico es el «típico de cada hora» (`reparto.py:285-296`), no el
de hoy.

**14:00, comer.** No hay pausa en el plan: «acabas ≈ 15:40» no cuenta que paras media hora. Y los baños: nadie los
pone en el mapa.

**16:00-19:00, segundas visitas y recogidas.** Lo fallido de la mañana vuelve mañana («Traer a hoy»,
`HoyPantalla.kt:340`), sin franja y sin que el cliente sepa cuándo. Es la parada que más veces falla.

**20:00, cerrar.** ¿Cuánto has ganado de verdad? La web lo dice (`MiRuta.jsx:1019-1031`) contando solo lo entregado;
las fallidas, que son dinero perdido, no se ven. Y el Excel para la gestoría solo está en la web
(`RutaApp.jsx:460-513`).

## Las propuestas, con lo que tenemos y lo que falta

Esfuerzo orientativo: **S** medio día, **M** uno o dos días, **L** tres a cinco. «Servidor» quiere decir que hay que
tocar `backend/server.py`; si no lo pone, es solo app (web y nativa).

### 1. No fallar la entrega (dinero directo)

1.1 **El cliente te ayuda antes de llegar** (M, servidor). En el enlace de seguimiento que ya le llega por WhatsApp
(`/s/{token}`), tres preguntas: «¿Estarás? Sí / No: déjalo en … (buzón, portería, vecino, punto de recogida) / Mejor
de … a …», «Código del portal o instrucciones (piso, timbre que no funciona)». Lo que conteste entra en la parada
(notas, `ventana_desde/hasta`, un campo nuevo `cliente_dice`) y le salta un aviso al repartidor (la bandeja
`avisos_movil` ya existe desde el 29-10). Hoy el enlace es de solo lectura (`server.py:52414-52438`). Hace falta
`POST /seguimiento/{token}/respuesta` con límite por IP (ya hay `_rl_public_action`) y los campos en las dos apps. Es
la función con más retorno de todo este informe: ataca el 20 % de fallos y las reclamaciones a la vez, y cada
cliente que la usa ve la marca (el pie del enlace ya dice «¿Repartes? Ordena tu ruta gratis»).

1.2 **«Llego en 20 minutos» de un toque** (S). Cuando una parada pasa a «siguiente», la app propone el WhatsApp con
la hora (ya existe el texto, `Hojas.kt:84`, `MiRuta.jsx:127`); un toque y sale. Automático de verdad (sin tocar)
exige la API de WhatsApp Business o SMS, con coste por mensaje: **no verificado** el coste actual; medir antes.

1.3 **Protocolo «no contesta»** (S). Al llegar: llamar → WhatsApp «estoy en tu portal» → un temporizador de 2
minutos en pantalla → lo que dijo el cliente en 1.1 → si «al vecino», foto, nombre y **aviso automático al cliente**
con la plantilla «lo dejé con …» (lo que la AEPD sancionó a UPS fue no avisar). Hoy la hoja de entrega tiene dónde,
quién y foto (`Hojas.kt:203-284`) pero no el aviso posterior ni el permiso del cliente guardado.

1.4 **La segunda visita que no se pierde** (S, servidor). Al marcar «no había nadie», «¿mañana a qué hora?»: el
cliente elige en su enlace (1.1) y la parada de mañana ya lleva la franja y el aviso. Hoy «Traer a hoy» mueve las
paradas sin franja (`HoyPantalla.kt:340`, `server.py:52667`).

1.5 **Las fallidas en el dinero** (S). «3 no entregadas = 3,30 € sin cobrar y 25 min» en el resumen del día y en la
semana. Hoy «Mi dinero hoy» cuenta solo lo entregado (`MiRuta.jsx:1019-1031`). Es lo que hace que el repartidor
quiera 1.1.

1.6 **Avisar del tope antes de llegar** (S). Cuando acabe la promoción, «te quedan 3 paradas gratis hoy» al escanear,
no el error al llegar al tope: es la queja más repetida de Spoke («cobra tras 10 paradas sin aviso»).

1.7 **Repetir la ruta de ayer** (S, servidor). Quien reparte lo mismo cada día (pan, farmacia, prensa) quiere «la de
ayer» con un toque: copiar las paradas de un día a hoy. Spoke no lo tiene y se lo piden.

1.8 **El registro del intento que te defiende** (S, servidor). En cada parada, la app apunta sola la hora de
llegada, que se pulsó «Llamar» y a qué hora, que salió el WhatsApp, los minutos de espera y la foto del portal o del
timbre. Un «no entregado» lleva ese registro, y el enlace del cliente lo enseña: «el repartidor llamó a las 11:02 y
esperó 3 minutos». Es la respuesta a los «ausentes falsos» y a los «strikes» que cuenta el hilo de Meneame: protege
al repartidor honrado ante la empresa y ante el cliente, y al cliente ante el que no llama. Hoy el fallo guarda
motivo y nota (`Hojas.kt:286-303`), nada más.

1.9 **«Cierra a las 14:00»** (S). Un toque en la parada de un negocio pone la ventana hasta su cierre, y la ruta
los mete antes: es lo que el repartidor de Meneame hacía a mano («primero los comercios y empresas»). La ventana ya
existe por parada (`reparto.py:313-347`); falta el toque, y en la nativa el campo (`FichaParada.kt`).

### 2. Encontrar la puerta y aparcar

2.1 **La app aprende la puerta** (S, servidor). Al pulsar «Entregado», si el móvil da la posición con menos de 30 m
de error, se guarda en el pedido (`entrega_lat/lng`). La próxima vez en esa dirección (`mis-direcciones`,
`server.py:52684`; «la última vez», `reparto.py:122`) el pin es la puerta real, no lo que adivinó el geocodificador:
polígonos, naves, «s/n», pueblos y bloques con varias entradas. Hoy el estado de la entrega guarda foto, dónde,
quién, firma y hora, pero no la posición (`server.py:52938-53024`). Es lo que DPD probó con what3words (−15 % de
tiempo) sin pedirle nada a nadie.

2.2 **«Dónde aparqué»** (S). Un botón (o solo: cuando dejas de ir a más de 8 km/h y empiezas a andar) guarda el
punto de la furgoneta; en la parada, flecha y metros de vuelta. No existe (ni en la web ni en la nativa).

2.3 **Aparca una vez, entrega cuatro a pie** (M, servidor). Agrupar las paradas a menos de 150 m andando: «deja la
furgoneta aquí (C/D a 40 m, hasta las 14:00) y haz la 7, 8 y 9 a pie». Hoy solo se agrupa «misma puerta»
(`MiRuta.jsx:1013-1014`, `1418`) y la C/D sale en el mapa, no en la parada. Menos doble fila, menos tiempo con la
furgoneta abierta (los robos de Fene y Sants fueron «en esas breves ausencias»).

2.4 **C/D con horario en la ficha de la parada y en la nativa** (S). La web ya consulta OpenStreetMap y lee el horario
(`reparto.py:811-830`); falta enseñar «C/D más cercana: Rúa X, a 60 m, de 8 a 14» en la parada y pintarlas en la
nativa (`MapaRuta.kt`).

2.5 **ZBE y franjas de reparto** (M, servidor). Perímetros de las zonas de bajas emisiones en el mapa y, con la
etiqueta de tu furgoneta en Ajustes (B, C, ECO), aviso «estas 6 paradas están dentro de la ZBE de Ourense: reparto
de 7:30 a 11:00 y de 15:00 a 17:00». Datos: OpenStreetMap (`boundary=low_emission_zone`, Madrid mapeada) y el
conjunto abierto Atlas ZBE (copia diaria, ODbL, avisa de perímetros que pueden estar desactualizados). Hay que decir
siempre la fuente y la fecha del perímetro: una multa de 200 € no se discute con un mapa viejo.

2.6 **Foto de referencia de la puerta** (S). La primera vez, una foto del portal (ya hay cámara y compresión,
`Hojas.kt:313`); la próxima, sale en la parada junto a «la última vez». Y «Ver la puerta» (Street View, web
`MiRuta.jsx:2238-2258`) en la nativa.

### 3. Tráfico de verdad en el mapa y en el orden

Hoy FDS ordena con un servidor OSRM público (`routing.openstreetmap.de`, respaldo `router.project-osrm.org`,
`server.py:51885-51888`) y multiplica los tiempos por un factor fijo según la franja horaria y el día
(`reparto.py:285-296`). Es «tráfico típico», no el de hoy: un corte o un atasco no cambian nada. Lo que se puede
hacer con datos reales y a qué coste:

3.1 **Cortes y obras de la DGT en el mapa** (M, servidor). El Punto de Acceso Nacional de la DGT (`nap.dgt.es`)
publica las incidencias de la red estatal en DATEX II (v3.6), **gratis y sin registro**, actualizadas cada 1-5
minutos (fuentes discrepan); Cataluña y el País Vasco tienen su feed aparte. Se descarga en el servidor, se guarda
lo que cae en la caja de cada ruta y se pinta: «corte en la N-550 a 2 km de tu parada 12». Urbano: Madrid publica el
estado del tráfico cada 5 minutos (`informo.madrid.es`, XML, niveles fluido/lento/retenciones/congestión); de
Barcelona y A Coruña no encontré datos abiertos en tiempo real. **No verificado**: la URL exacta del feed v3.6 y sus
términos de uso.

3.2 **Atascos en tiempo real** (M, servidor). TomTom Traffic: incidencias con **2.500 peticiones al mes gratis** y
teselas de flujo e incidencias con 200.000 al mes gratis (según su página de precios; otras fuentes hablan de
2.500 al día; y anuncia cambio de precios el 01-07-2026). Con una petición por ruta al ordenar y las teselas para
pintar colores de velocidad en el mapa, da para empezar; al crecer, se paga. HERE tiene plan gratuito con límites que
no he podido confirmar. Google Routes con tráfico: de pago desde la primera petición.

3.3 **Reordenar con el tráfico de hoy.** Tres caminos:
- (c) **Lo barato, ya** (S): la web ya calcula «vas X min por detrás» (`MiRuta.jsx:1015-1017`); cuando pase de 15
  minutos o haya un corte (3.1) sobre el trazado, botón «Reordenar desde aquí» (el orden desde la posición ya
  existe, `server.py:53049`). Es lo que Zeo vende como «avisos para reoptimizar».
- (b) Matriz de tiempos con tráfico de TomTom o HERE en vez de OSRM (L, coste por petición): tiempos reales en el
  orden.
- (a) OSRM propio con `osrm-customize` y velocidades por tramo (L): hace falta una fuente de velocidades (TomTom
  Flow Segment, 20.000 al mes gratis) y un servidor nuestro. Solo con usuarios de verdad.
No prometer «con tráfico en tiempo real» hasta tener (b) o (a): hoy sería mentira.

3.4 **«Aquí hay atasco», de los propios repartidores** (S, servidor). Un botón «reportar: corte / atasco / no se
puede aparcar» que ven los demás repartidores FDS de la zona durante 2 horas. Es lo de Waze, y es viral, pero solo
sirve con densidad: dejarlo para cuando haya 50 repartidores en una ciudad.

### 4. Cargar bien en la nave

4.1 **Orden de carga y hueco automático** (S). Con la ruta ordenada la noche antes, «carga primero la 60, última la
1» y el hueco por tramos (las diez primeras «detrás derecha»…), que al escanear al cargar se enseñe en grande junto
al número de parada (ya propuesto en la revisión del 29-10, H10). Hoy el hueco es a mano y solo en la web.

4.2 **«Me falta un paquete»** (S). Si la lista vino pegada o de la empresa, al cerrar la carga: «59 escaneados de
60: falta el de Lucía M.». Hoy el escáner cuenta «añadidos» y «ya estaban» (`EscanerVM.kt:89-95`) pero no lo que no
ha pasado.

### 5. Cobrar y papeles

5.1 **Dinero completo** (S): lo de 1.5 más km, horas y €/hora reales, en la nativa también (hoy solo lee «Hoy
llevas», `HoyPantalla.kt:298-300`), y el Excel del mes para la gestoría en la nativa (`GET /reparto/entregas-mes`,
`server.py:52500`).

5.2 **El DeCA desde la ruta** (M, servidor; **condicional**). Si el autónomo de paquetería está dentro del ámbito
(transporte público de mercancías por carretera; sanción de 401 a 600 € por envío según los proveedores), FDS tiene
ya cargador, transportista, fecha, origen, destinos y bultos: generar el PDF con QR por ruta es trabajo de un día.
Antes, confirmar el ámbito en la Orden FOM/2861/2012 y la Resolución de 5 de junio de 2026 (BOE 12-06-2026). Si
aplica, es una necesidad legal que ninguna app de rutas cubre.

### 6. Cuerpo

6.1 **Pausa de comida y tiempo por parada individual** (M, servidor): en Ajustes «paro a comer 30 min hacia las
14:00»; la ruta la cuenta. Spoke lo tiene; FDS no (ni «pausa» ni «descanso» en `server.py`).

6.2 **Baños, agua y gasolineras en el mapa** (S). Una capa opcional con `amenity=toilets`, `drinking_water` y
`fuel` de OpenStreetMap: la consulta a Overpass ya existe para las C/D (`reparto.py:811`). La queja documentada es
de riders (UGT/CGT); en furgoneta es la misma jornada al sol.

### 7. La app: estructura y aspecto

Lo que sigue son propuestas de diseño, no fallos; salen de las capturas del 29-10 (`docs/capturas-autonomo-29-10/`).

7.1 **La siguiente parada, lo primero** (S). Con la ruta en marcha, en la nativa la parada está en el tercio medio,
debajo del resumen y del bono (`01-hoy.png`, `02-ordenada.png`). Orden propuesto: siguiente parada → resumen en una
línea («3 de 12 · acabas ≈ 14:10 · vas 8 min tarde») → lista. El bono, en una línea; «Ordenar ruta», como texto cuando
ya está ordenada.

7.2 **Dos modos claros** (S). *Cargando* (sin ordenar): el escáner es el protagonista, con el contador y el orden de
carga. *En ruta*: la parada es la protagonista y el escáner pasa al «+». Hoy el botón flotante «Escanear» es igual
en los dos.

7.3 **Cuatro pestañas: Hoy · Mapa · Dinero · Yo** (M). El mapa a un toque (hoy es un icono arriba, `03-mapa.png`);
«Dinero» como identidad de FDS (lo ganado, las fallidas, la semana, el Excel: hoy «Historial» es una lista de días,
`12-historial.png`); «Yo» con cuenta y ajustes.

7.4 **Tamaños para la mano y el sol** (S). El número de parada más grande en la lista (hoy `labelLarge`,
`HoyPantalla.kt:80-88`): se busca con la caja en la mano. Las horas previstas en los chips, más grandes. Botones de
entregar ya están a 56 dp: bien. Contraste del tema claro al sol: comprobarlo con un checker (la web tiene
`frontend/e2e/contraste.spec.js`; la nativa no tiene nada parecido).

7.5 **Estado por color en el número** (S): teal pendiente, verde hecho, rojo fallido, ámbar «cobrar»; hoy el color
va en chips aparte (`HoyPantalla.kt:91-105`).

7.6 **Guantes y una mano** (S): deslizar la tarjeta para «Entregado» con Deshacer (ya existe el Deshacer; mantener
el toque también). Nada de doble toque para confirmar: es la queja de Zeo con 100 paradas.

7.7 **Lo que ya está bien y no se toca**: tema automático de noche, botones grandes, el Deshacer, la hoja de entrega
en una sola pantalla, el escáner seguido.

7.8 **Batería y datos** (S, medir). «Las apps de reparto comen muchísima batería» y «ni voy a gastar datos que no
me van a pagar» (Meneame #159). La nativa ya pide la posición solo al ordenar (`HoyPantalla.kt:131-140`) y no sigue
al repartidor en segundo plano; lo que falta es medirlo (una jornada de 8 h con el perfilador de Android Studio) y
decirlo en la ficha de Play: «no te sigue, no gasta batería ni datos cuando no la usas». Con 300 paradas, la lista
y el mapa tienen que ir finos: probarlo con 300, no con 4.

## Qué no hacer

- **No decir «tráfico en tiempo real»** en el orden hasta tener velocidades reales (3.3 b o a). Pintar cortes y
  atascos en el mapa (3.1, 3.2) sí se puede decir, porque lo son.
- **No integrar what3words**: la app aprende la puerta sola (2.1) y no obliga al cliente a nada.
- **No automatizar WhatsApp por la API** sin medir el coste por mensaje; primero el mensaje de un toque (1.2).
- **No pintar ZBE sin fuente y fecha** del perímetro.
- **No hacer red social de repartidores**: lo que se comparte es lo que ahorra dinero y lo que da seguridad ante una
  reclamación.
- **No tocar el Deshacer ni la hoja de entrega**: funcionan.
- **No bloquear nada por la distancia del GPS** («no te deja llamar si no estás a pocos metros», «en la misma
  portería no te dejaba validar», Meneame #158): el GPS ayuda, nunca manda. «Ya he llegado» y «Entregado» siempre a
  mano.
- **En el portal de empresa, no penalizar un «ausente» sin mirar el registro del intento** (1.8): es lo que
  quema a los repartidores en las apps de las grandes.

## Orden propuesto y cuándo está hecho

- **Tanda A (noviembre)**: 1.1, 1.3, 1.4, 1.5, 1.8, 2.1, 2.2, 3.1, 3.3 (c), 1.6, 7.1. Hecho cuando: el cliente contesta
  en su enlace y el repartidor lo ve en la parada; cada intento queda registrado con hora, llamada y espera; al
  entregar se guarda la puerta y la próxima vez el pin es ese; hay «dónde aparqué»; los cortes de la DGT se ven en el
  mapa y «vas tarde» ofrece reordenar; las fallidas se ven en el dinero; la siguiente parada es lo primero de Hoy.
- **Tanda B (diciembre)**: 2.3, 2.4, 2.5, 3.2, 4.1, 4.2, 6.1, 6.2, 7.2, 7.3, 1.7. Hecho cuando: hay «aparca una vez y
  entrega 4», C/D en la parada y en la nativa, ZBE con fuente y fecha, atascos de TomTom en el mapa, orden de carga
  con hueco, pausa en el plan, baños en el mapa, y las cuatro pestañas.
- **Tanda C (2027, con usuarios)**: 3.3 (b o a), 3.4, 5.2 si aplica, 7.6.

## No verificado

- Reddit no es accesible desde mi buscador (bloqueo del sitio): las quejas en inglés vienen de prensa (DoorDash en
  AOL) y de la encuesta de Scandit (≈ 2022, 1.200 conductores, 11 países).
- Los hilos de Forocoches son de 2019 y 2023 (16 y 10 mensajes, pocos repartidores de verdad). El de Meneame es de
  2021 (173 comentarios, leído entero): un repartidor con diez años de oficio, pero asalariado y de las grandes
  (Correos, Seur, Amazon), no autónomo con furgoneta propia; convenios y tarifas que cita pueden estar desfasados.
- El rendimiento de la app con 300 paradas en un día (lo que dice Meneame que lleva un autónomo): no probado; el
  servidor de pruebas tiene 4.
- Las cifras «20 % de fallos» y «15 € por fallo» son internacionales y de hace años (HBR, PCA Predict); el «3.200
  millones al año en España» es una extrapolación de un medio.
- TomTom: las fuentes discrepan entre 2.500 peticiones al mes y al día; anuncia nuevos precios el 01-07-2026. HERE:
  límites gratuitos sin confirmar.
- DGT NAP: versión DATEX II vigente (v3.6 frente a la antigua), URL exacta del feed y términos de uso.
- Cobertura real de las ZBE en OpenStreetMap (Madrid sí; Barcelona sin confirmar); Atlas ZBE avisa de perímetros
  desactualizados.
- DeCA: si el autónomo de paquetería entra en el ámbito; la sanción de 401-600 € la citan proveedores, no la he
  visto en el BOE.
- Las quejas de calor, pausas y agua son de riders (moto y bici), no de furgoneta.
- El coste actual por mensaje de la API de WhatsApp Business.

## Fuentes

- COPE, Kate repartidora: https://www.cope.es/actualidad/economia/noticias/kate-repartidora-paquetes-pagan-paquete-entregado-no-ausencia-deriva-punto-recogida-no-vas-estar-casa-20260702_3396154.html
- UOC, 20 % de fallos: https://www.uoc.edu/es/news/2024/porque-fallan-un-20-por-ciento-entregas-comercio-electronico-razones-soluciones
- Diario El Canal, 15 € por fallo: https://www.diarioelcanal.com/entrega-fallida-ecommerce/
- Ecommerce News, 3.200 M€: https://ecommerce-news.es/se-estima-que-el-coste-de-las-entregas-fallidas-en-espana-supera-los-3-200m-de-euros-al-ano/
- Forocoches: https://forocoches.com/foro/showthread.php?t=7183239 · https://forocoches.com/foro/showthread.php?t=9508204 · https://forocoches.com/foro/showthread.php?t=8403463 · https://forocoches.com/foro/showthread.php?t=9306997 · https://forocoches.com/foro/showthread.php?t=7887840
- Meneame, «Soy repartidor de paquetería»: https://www.meneame.net/m/TeRespondo/soy-repartidor-paqueteria-respondo-tus-dudas-sobre-este-mundo
- Scandit, encuesta a conductores: https://www.scandit.com/blog/key-to-last-mile-success/
- AOL, DoorDash drivers: https://www.aol.com/lifestyle/13-things-doordash-drivers-wish-194000454.html
- SEUR, última milla y what3words: https://blog.seur.com/sistema-mas-rapido-ultima-milla/
- Autonocion, carga y descarga: https://www.autonocion.com/aparcar-carga-descarga-multas/ · Multas CEA: https://www.multascea.es/recurrir/325-recurrir-multa-aparcamiento-zona-carga-y-descarga · Torrelavega: https://atopisimo.com/noticias/denuncian-a-un-repartidor-con-1500e-por-aparcar-en-doble-fila/
- ZBE: https://www.motor16.com/las-ultimas-noticias/zonas-bajas-emisiones-flotas · https://www.moncloa.com/2026/10/02/zona-bajas-emisiones-ourense-multas-3441250/ · https://www.covey.es/noticias/zbe-madrid-2026-furgonetas · https://www.autopista.es/noticias-motor/que-coches-no-podran-circular-por-madrid-en-2026-mejor-guia-no-te-multen_333202_102.html
- OSM ZBE: https://wiki.openstreetmap.org/wiki/Tag:boundary=low_emission_zone · Atlas ZBE: https://github.com/marcc992/atlaszbe-datos
- Clientes: https://elmercantil.com/2026/05/19/la-adaptacion-de-la-entrega-de-paqueteria-genera-una-percepcion-de-desconfianza-entre-los-clientes/ · Ofcom 2026: https://shopappy.com/logistics/last-mile-delivery/ofcom-parcel-satisfaction-evri-yodel-2026
- Calor y pausas: https://www.que.es/2026/07/15/ugt-riders-ola-calor-protocolo-verano/ · https://www.infobae.com/espana/2026/07/16/repartir-crema-y-gafas-de-sol-no-es-suficiente-los-riders-exigen-medidas-reales-ante-las-olas-de-calor/ · https://www.cope.es/emisoras/galicia/noticias/trabajar-30-grados-galicia-prioriza-productividad-encima-salud-trabajadores-20260703_3397888.html
- Robos: https://www.elespanol.com/quincemil/ferrolterra/20261001/detenidas-personas-fene-neda-coruna-robar-paquetes-furgonetas-reparto/1003744404255_0.html · https://metropoliabierta.elespanol.com/sants-montjuic/20260726/cazan-falsos-repartidores-saqueaban-furgonetas-paqueteria-sants-montjuic/1003742782317_0.html · https://www.valladolidplural.com/articulo/sucesos/repartidor-varios-viandantes-retienen-ladron-que-asalto-furgoneta-llena-paquetes-plena-calle-valladolid/20260104124731067652.html
- Spoke/Circuit: https://www.capterra.com/p/210604/Spoke/reviews · https://justuseapp.com/en/app/1198232244/circuit-route-planner/reviews · https://www.upperinc.com/alternatives/circuit-route-planner/ · https://spoke.com/dispatch/route-optimization
- Zeo: https://zeorouteplanner.com/es/
- DGT NAP: https://nap.dgt.es/dataset/incidencias-de-trafico-srti-en-formato-lod-datex-ii · https://nap-pre.dgt.es/dataset/incidencias-dgt-datex2-v3-6
- Madrid tráfico en tiempo real: https://datos.gob.es/en/catalogo/l01280796-trafico-datos-del-trafico-en-tiempo-real
- TomTom precios: https://docs.tomtom.com/pricing · https://apibenchmarks.com/maps/tomtom
- OSRM y tráfico: https://project-osrm.org/docs/v26.5.0/tools
- DeCA: https://plataformanacional.es/documento-electronico-de-control-administrativo-deca/ · https://www.dashdoc.com/es/blog/documento-de-control-digital · https://kaleidotrans.com/documento-de-control-administrativo-deca · https://web.jobers.es/blog/deca-documento-control-transporte-2026/
- Trucos para autónomos (carga en orden): https://www.xpedit.es/blog/trucos-repartidores-autonomos
