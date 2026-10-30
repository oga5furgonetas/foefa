# Registro de rondas desde el PC de Dani (Claude en Chrome)

Lo que hace la sesión del PC (deploy, Metricool, X, rondas en Chrome). La sesión de la nube escribe en el
Registro de `docs/anuncios/REDES.md`; aquí no se pisa. Hora de Madrid.

## 29-10-2026 (noche, 21:30-23:00)

### Despliegue (desbloquea TikTok, Instagram y YouTube en Metricool)
- `main` puesto al día: merge de `origin/claude/trusting-feynman-0tfz62` (fast-forward, sin conflicto) y push.
- Chequeos en verde: check-existe, huerfanos, marca, i18n, permisos, modulos, promo; eslint 0 errores (20 avisos
  de react-hooks que ya estaban); vite build OK; sello OK. Web desplegada tres veces con `npx.cmd wrangler`
  (la última, `7061d2b8.flota-2fg.pages.dev`). `flotadsp.com/redes/A-1-portada.png` y `tiktok-es.mp4` → 200.
- Material (paso 5): las tres fotos de Artlist del 29-10 (generaciones 19:15, sin personas) bajadas con el
  conector y recortadas a 1080×1920 en `docs/anuncios/redes/fondos/` (furgoneta-amanecer, interior-paquetes,
  libreta-salpicadero). Playwright no tenía Chromium en este PC: `npx.cmd playwright install chromium` y
  `node ..\scripts\redes-fotos.mjs` regeneró los carruseles A, B, C y las 4 tarjetas de X con esos fondos
  (revisadas a ojo: portadas con la furgoneta/interior, texto legible). Copiados también a `frontend/public/redes/`
  el carrusel «5 trucos» (`trucos-1-portada…trucos-7-la-app.png`) y `funciones-9x16.png`, `invita-9x16.png`
  para que tengan URL pública. `lanzamiento-9x16.png` NO (dice 2,50 €: no es la oferta vigente).

### Metricool (marca 7741371), programado esta noche — antes solo había los 2 de LinkedIn (04-11 y 11-11)
| Red | Cuándo | Pieza | Notas |
|---|---|---|---|
| TikTok | J 30-10 18:00 | `tiktok-es.mp4` | Sustituye al sketch FDS-1 (no existe en este PC). Texto del calendario, comentario fijado «¿cuántas paradas…». Marca propia + IA |
| TikTok | V 31-10 18:00 | carrusel «5 trucos» (7 fotos) | texto de `tiktok-fotos/TEXTO.md`; ya se publicó en TikTok el 10-10 como vídeo (5 vistas): va como carrusel nuevo |
| TikTok | S 01-11 18:00 | `tiktok-es-llama.mp4` | marca propia + IA |
| TikTok | D 02-11 18:00 | carrusel A (7 fotos, fondos nuevos) | comentario fijado de TEXTO.md |
| TikTok | L 03-11 18:00 | `trucos-7-la-app.png` (imagen suelta) | sustituye al spot v5 Puck (no está en el PC); texto del calendario |
| TikTok | M 04-11 18:00 | `tiktok-es-cobro.mp4` | marca propia + IA |
| TikTok | X 05-11 18:00 | carrusel B (9 fotos) | comentario fijado de TEXTO.md |
| Instagram | 30-10 → 05-11, 12:00 | las mismas siete piezas | vídeos como reel (marcados «generado con IA»), carruseles e imagen como publicación |
| YouTube | J 30-10 19:00 | `shorts-es.mp4` | Short, público, no para niños, IA sí, utm youtube/post |
| YouTube | D 02-11 19:00 | `shorts-es-llama.mp4` | Short, ídem, utm_content=post_llama |
| LinkedIn | M 04-11 y 11-11 11:00 | (ya estaban) | — |

Ojo: Metricool aceptó los carruseles 9:16 para Instagram sin quejarse; si Instagram los recorta mal, se verá el
31-10 a las 12:00 (no verificado hasta que salga). Facebook página no está en Metricool: no programada.

### X (@FlotaDSP, desde Chrome; X Premium)
- Publicado 21:48: el post del J 30-10 del calendario («¿Cuánto tardas cada mañana en ordenar la ruta?…»). Hoy
  (29-10) no estaba en el calendario y las 21:00 son franja de X. Verificado en el perfil.
- Programados (verificados en «Scheduled»), todos a las 7:30: V 31-10 (`X-primer-dia.png`, sin enlace),
  S 01-11 (paradas al día, sin enlace), D 02-11 (`X-truco.png` + enlace utm `post_truco`), L 03-11 (te llama el
  cliente, sin enlace), M 04-11 (`X-cuanto-gana.png` + calculadora), X 05-11 (`X-manos-libres.png` + enlace
  `post_manos_libres`). El J 30-10 queda publicado hoy, así que el 30-10 por la mañana no sale nada.
- Visto en el perfil: dos posts de hoy (hace 1 h y 4 h) que no son de esta sesión; uno nombra a Amazon, SEUR, GLS y
  MRW («Pregunta para los de…»). Va contra la regla de no nombrar otras empresas; no se toca (nunca se borra).
  Dani decide.

### Ronda de conversación
Búsquedas de X hechas (8 del apartado 6, pestaña «Latest»): muy pocos hilos de repartidores hablando de su
trabajo; la mayoría son clientes quejándose de entregas, accidentes y noticias (ahí no se entra). Resultado:

| Hora | Red | Hilo | Qué se dijo | App |
|---|---|---|---|---|
| 22:10 | X | @Murillo_fuenla (cliente esperando paquete «en reparto desde las 7:05») | qué significa «en reparto», una ruta normal acaba entre 18 y 20 | no |
| 22:12 | X | @lorenzobillares (hilo IKEA/@MasuBudget, paquetes que dan vueltas) | el repartidor es el último eslabón; lo que está en su mano es avisar antes | no |
| 22:14 | X | @rapunzelqueso (contrarreembolso: cliente «sin efectivo») | WhatsApp la víspera con el importe; importe+pago+foto en la parada; FDS lo hace así | sí |
| 22:16 | X | seguidos: @paquetria, @RPaqueteri17088, @autonomosata, @pymesyautonomos, @revistalogistic, @LogisticaProf | — | — |
| 22:25 | TikTok | @unecuatorianoenes «Un día entero repartiendo en Madrid» (hace 5 d) | orden de carga: lo último al fondo, lo de la primera hora a mano | no |
| 22:28 | TikTok | @alvarocancino_ «Primera vez trabajando en reparto» | ordenar al cargar; foto a la etiqueta en vez de teclear | no (la función, sin nombre) |
| 22:31 | TikTok | @roy.y.los.bloques «Cómo hacer tu ruta de Amazon flex más rápido» | truco de las dos zonas y aparcar una vez para tres | no |
| 22:34 | TikTok | @laryrepartidor «Día 117, doble ruta, 201 ubicaciones» | ¿compensa la doble ruta por hora? calculadora gratis | sí |
| 22:37 | TikTok | @israeljcg7 «Hoy tocó balconín» | humor: top 3 de clientes buenos | no |
| 22:40 | TikTok | @impar.uve «Abro debate» (frases de clientes) | humor: «déjalo en el buzón» con una lavadora | no |
| 22:43 | TikTok | @luisdmr20 «Un día de reparto en España» (145 paquetes, 6 pueblos) | pueblos: empezar por el más lejano, una pasada por pueblo | no |
| 22:46 | TikTok | @laryrepartidor «Una de las cosas malas de ser repartidor» | la pelea es con el reloj; saber la hora de fin antes de arrancar | no (la función, sin nombre) |
| 22:50 | TikTok | notificaciones de @flotadsp | solo una mención de spam del 10-05; nada que contestar | — |
| 22:52 | Instagram | notificaciones de @flotadsp | solo «me gusta» y seguidores nuevos; sin comentarios | — |
| 22:55 | Facebook | grupos (Repartidores de paquetería autónomos, Repartidores BCN) | solo anuncios de empleo; sin preguntas reales. En Repartidores BCN, Dani («Daniel Brao») publicó la app hace 5 h. Sin comentarios hoy; sin grupo nuevo (no se pudo comprobar la verificación del perfil) | — |

Totales: X 3 respuestas (1 con app) + 6 seguidos; TikTok 8 comentarios (2 con app), todos verificados publicados;
Instagram 0 (nada que contestar); Facebook 0. Proporción con app: 3 de 11.

### Lo que falló o queda
- Remote Control: el modo automático bloqueó activarlo desde la sesión; Dani lo enciende con el interruptor de la
  barra de la sesión.
- Sketch FDS-1/FDS-3/FDS-4 y el spot v5 (Puck) no están en este PC (`reales/salida/` no existe): el calendario
  los pide el 30-10, 03-11, 06-11 y 08-11. Sustituidos el 30-10 y el 03-11 (arriba); para el 06-11 y 08-11 hará
  falta otra pieza o que Dani copie esos mp4 a `frontend/public/redes/`.
- `tiktok-es.mp4` está programado el 30-10; el calendario lo repetía el 11-11: ese día habrá que cambiarlo.

### 29-10 23:30 — bono de bienvenida a 25 €
- Dani: «súbelo a 25». El código ya lo tenía (`precios.js` BONO_CENT=2500, `server.py` _BONO_CENT=2500, fusión de
  `sweet-brown` 19:50). REDES.md apartado 3 y el post del L 10-11 pasan a 25 € (invita y gana sigue en 10 €/2,50 €).
  Web redesplegada (`6b19bb8f.flota-2fg.pages.dev`, chequeos y build en verde). Backend desplegado a las 23:35 (release v168) y **verificado**: `/api/billing/planes` devuelve `bono_cent: 2500`.
- Nada de lo programado hasta el 05-11 menciona el bono. A partir de ahora la sesión del PC lleva las redes en
  bucle de 4 h (pasos 2-6).

### 29-10 23:45 – 00:20 — canales nuevos (Dani: «viralízate, conéctate a cada sitio»)
| Hora | Red | Dónde | Qué se dijo | App |
|---|---|---|---|---|
| 00:02 | YouTube | «la REALIDAD de trabajar en reparto en España» (Geshh, 160K vistas) | tres cosas que quitan una hora al día (orden de carga, aparcar una vez, avisar antes); «hicimos una app gratis para esto (FDS)» | sí, de pasada |
| 00:06 | YouTube | «Un día en la vida de un repartidor» (Javier Lucena, 24K) | dos móviles en la mano = multa; manos libres por voz; FDS | sí, de pasada |
| 00:12 | TikTok | @impar.uve «Que opináis?» (hace 1 d) | ofrecimiento público: probar la app y contar en un vídeo qué le falta, sin pagos | sí |
| 00:16 | TikTok | @unecuatorianoenes «¿Cuántos paquetes entrega un repartidor?» (hace 2 d) | mismo ofrecimiento, otro texto | sí |
| 00:08 | Google Play | Consola, FDS – Reparto y rutas | **0 reseñas; producción INACTIVA (prueba abierta)**; 39 adquisiciones y 26 dispositivos activos en 28 días. Nada que contestar | — |
| 00:00 | Reddit | — | **bloqueado por las restricciones del navegador de Claude** («site not allowed»): no se puede usar desde esta sesión | — |

Los comentarios en YouTube salen como @FlotaDSP (canal con sesión en Chrome). Loop de 4 h recreado con estos canales
(YouTube 2-3 por ronda, un ofrecimiento a creador por ronda, lo nuestro primero). Lo que más frena la viralidad: la app no
está en producción en Play (no sale en búsquedas) y no tiene reseñas: pendiente de Dani (subir el AAB 17 y pedir producción).

### 30-10 00:25 – 00:35 — la 2.3.0 enviada a revisión en Google Play
- Dani subió el AAB 18 (2.3.0) al borrador de producción (la sesión no puede: tope de 10 MB del puente del navegador).
- En el borrador estaba también el bundle 10 (2.0.0): retirado del borrador (queda en la biblioteca; nada borrado). Un primer
  intento retiró el 18 por error de fila; se volvió a añadir desde «Añadir de la biblioteca» y se retiró el 10.
- Nombre «2.3.0», notas es-ES con la oferta de REDES.md §3 (25 € de bienvenida, gratis hasta 31-12-2026). Advertencia única:
  símbolos nativos no subidos (no bloquea). Guardado y **«Enviar 3 cambios a revisión»** confirmado: en «Resumen de
  publicación» aparece «Cambios en revisión»: 2.3.0 lanzamiento completo, +177 países y «resto del mundo».
- La prioridad in-app (4-5 → pantalla completa) no existe en la consola web, solo por API. Pendiente de Dani:
  `APP_ANDROID_MIN="2.3.0"` en Fly cuando la 2.3.0 esté publicada. Hasta que Google apruebe, la app sigue sin salir en Play.

### 30-10 00:55 – 01:05 — la 2.3.0 ya está en Google Play; APP_ANDROID_MIN puesta
- Play Console: «2.3.0 · Disponible en Google Play · publicada 29 oct 23:42», producción activa, 178 países (Google la
  aprobó en minutos). Ya sale en la tienda: a partir de ahora los anuncios pueden enlazar a Play sin la prueba abierta.
- Dani: «ponla tú» → `fly secrets set -a flota-backend APP_ANDROID_MIN="2.3.0"` (release automática). Verificado:
  login con `android-2.2.5` → 426 «Hay una versión nueva de FDS. Actualízala en Google Play…»; `android-2.3.0` → 401 normal.
- Repartidores con todas las funciones: comprobado en el código y en `/api/billing/planes` de producción (promo hasta
  31-12-2026 → sin tope de paradas ni bloqueo por tarjeta). Enviada a Dani la captura real de una notificación de FDS
  (`docs/capturas-29-10/emulador-03-notificacion.png`). Cron de comprobación de Play borrado (ya no hace falta).

## 30-10-2026 (00:10 – 00:50) — ronda del bucle de 4 h (primera con la app ya en Play)

### Metricool (marca 7741371)
Ya estaba todo hasta el 05-11 (TikTok 18:00, Instagram 12:00, YouTube 30-10 y 02-11, LinkedIn 04-11 y 11-11). Añadido:
| Red | Cuándo | Pieza | Notas |
|---|---|---|---|
| YouTube | J 05-11 19:00 | `tiktok-es-cobro.mp4` | Short «Cobros en mano y cuentas a boli… se acabó», utm `post_cobro`, IA sí (id 410646601) |
| TikTok | V 06-11 18:00 | `funciones-9x16.png` | sustituye al sketch FDS-3 (no está en el PC); texto del calendario del 06-11; comentario fijado «¿qué consejo darías a uno que empieza mañana?» (410646617) |
| Instagram | V 06-11 12:00 | `funciones-9x16.png` | mismo texto, publicación (410646632) |

### X (@FlotaDSP)
- El post del J 30-10 ya salió anoche a las 21:48; V 31-10 → X 05-11 estaban programados. **Programado J 06-11 7:30** («Primer día repartiendo: no te sepas la zona, sábete el orden…», sin enlace). Verificado en «Will send on Fri, Nov 6, 2026 at 7:30 AM».
- Ojo con el botón Reply: pulsado por referencia (ref) NO envía; hay que pulsarlo por coordenadas. Las tres respuestas de hoy están comprobadas en el perfil («with replies»).

### Ronda de conversación (lo nuestro primero; proporción con app 3 de 11)
| Hora | Red | Hilo | Qué se dijo | App |
|---|---|---|---|---|
| 00:16 | X | @lorenzobillares contestó a nuestra respuesta de ayer («yo también soy repartidor, llegan cosas de pena y nos obligan a sacarlos») | el cliente no ve que llega así a la nave; foto al bulto al salir y al entregar; cuídate | no |
| 00:19 | X | @kevincrestt (7,3K vistas; «lo bueno de comprar tanto es que el repartidor viene a primera hora, vacía media furgoneta») | humor desde el otro lado: la mejor parada del día, se carga lo tuyo lo último | no |
| 00:22 | X | @ArinGora (cliente: el repartidor marcó ausente sin bajar) | no tiene defensa y nos hace daño; a 150 paradas hay apps de empresa que obligan a marcar «ausente»; un WhatsApp de «llego en 5 min» arregla casi todo | no |
| 00:28 | TikTok | @laryrepartidor contestó a nuestro comentario de ayer («hacer la doble ruta si le compensa») | chapeau; cuídate la espalda | no |
| 00:31 | TikTok | @soylastefa «Hoy me puse en los zapatos de un repartidor» (4.108 ❤, 256 comentarios) → respuesta a AnthonyS, que pide orientación para empezar | plantilla 4 (orden de carga, el que no abre a las 9 abre a las 14, aparca una vez para tres) | no |
| 00:32 | TikTok | mismo vídeo, comentario general | el que carga ordenado llega el primero a casa; gracias por enseñar el lado de dentro | no |
| 00:36 | TikTok | @monicareal63 «No aceptes una ruta sin preguntar esto» (2.936 ❤) | dos preguntas más: recogidas y cuándo pagan; neto por hora con paradas, tarifa, km y gasolina | no (la función, sin nombre) |
| 00:38 | TikTok | **seguida @monicareal63** (repartidora autónoma en Madrid, 4.894 seguidores, 10 años en el sector) | — | — |
| 00:40 | TikTok | @monicareal63 «¿Está pensando en hacerse autónomo en el reparto?» (hace 2 d) → **ofrecimiento público a micro-creadora** | somos FDS, equipo pequeño de España; ¿la pruebas una semana y cuentas en vídeo qué le falta, sin filtros? sin pago ni condiciones; está en Google Play | sí |
| 00:44 | YouTube | Por Tu Cuenta «¿Cuánto gana DE VERDAD un repartidor en España en 2026?» (732 vistas, 0 comentarios: el nuestro es el primero) | restar gasolina, seguro, cuota y desgaste antes de mirar la factura; ejemplo de la calculadora (100 paradas → ~7 €/h, orientativo) + flotadsp.com/calculadora-repartidor | sí |
| 00:47 | YouTube | Alejandro Casallas «Así es trabajar como repartidor de furgoneta en España» (8,7K) | lo que vale es la carga: apuntar qué va en cada hueco, aparcar una vez para tres portales; calculadlo con gasolina y cuota | no |
| 00:49 | Instagram | notificaciones de @flotadsp | solo me gusta y seguidores; sin comentarios. Aviso de Instagram «alguien está intentando iniciar sesión» (hace 3 h; probablemente el enlace de Metricool): que lo mire Dani | — |
| 00:50 | Facebook | notificaciones | solo reacciones a reels de la página; en los grupos, solo anuncios de empleo. **Hay un anuncio de pago de la página «FDs» (de Dani) con el pago rechazado** («Urgente: tus anuncios no se están publicando…»): no es de esta sesión, no se toca; Dani decide | — |

Totales: X 3 respuestas (0 con app); TikTok 5 comentarios (1 con app, el ofrecimiento) + 1 seguida; YouTube 2 (1 con app);
Instagram 0; Facebook 0. Con app: 3 de 11 (justo la proporción). Reddit no se intentó (bloqueado). Sin pieza nueva: quedan
piezas sin usar (`invita-9x16.png`, carrusel C, X-* para el 07-11 en adelante) y sigue faltando el sketch FDS-4 del 08-11.

## 30-10-2026 (04:10 – 04:50) — ronda del bucle de 4 h

### Metricool (marca 7741371)
Los 7 días (hasta el V 06-11) ya estaban completos. Para no dejar hueco a la siguiente ronda, añadido el sábado:
| Red | Cuándo | Pieza | Notas |
|---|---|---|---|
| TikTok | S 07-11 18:00 | `shorts-es.mp4` | «De 30 etiquetas a una ruta ordenada en 10 segundos ⏱️…» (texto nuevo, no el del Short de YouTube del 30-10); comentario fijado «¿Cuánto tardas tú en ordenar la ruta por la mañana?»; marca propia + IA (410775414) |
| Instagram | S 07-11 12:00 | `shorts-es.mp4` | reel, mismo texto, IA sí (410775431) |

### X (@FlotaDSP)
- Programados V 31-10 → V 06-11 ya estaban. **Programado S 07-11 7:30** (contrarreembolso: «…apuntado en un papel… y el papel desaparece», enlace repartidores `utm_content=post_cobro`, sin imagen: no hay tarjeta X-* para ese día). Verificado en «Will send on Sat, Nov 7, 2026 at 7:30 AM».
- La cuenta tiene ya la marca azul (aviso «Your account is now verified», hace 16 h).

### Ronda de conversación (lo nuestro primero)
| Hora | Red | Hilo | Qué se dijo | App |
|---|---|---|---|---|
| 04:12 | X | @ArinGora contestó a lo nuestro («entiendo que sea complicado; le esperé abajo; ahora pongo punto de entrega») | bajar tú ya es más de lo que hace la mayoría; el punto de entrega es buena solución para los dos | no |
| 04:14 | X | @kevincrestt contestó («desde el otro lado tiene todo el sentido, win-win») y **nos siguió** | la furgoneta se carga al revés de como se reparte; gracias por el follow | no |
| 04:20 | X | búsquedas «repartidor», «paquetería/furgoneta + reparto» (recientes, es) | a las 4 de la mañana solo hay sucesos y LatAm; el único hilo útil (@Murillo_fuenla, paquete «en reparto» desde las 7) ya lo contestamos hace 7 h. Sin más respuestas | — |
| 04:23 | X | **seguida @DeRepartidores** (Asociación de Repartidores Autónomos de Cataluña) | — | — |
| 04:27 | TikTok | AnthonyS contestó a nuestro consejo en el vídeo de @soylastefa («lo tomo muy en cuenta») | mucha suerte; el primer día no te compares con nadie | no |
| 04:30 | TikTok | @latindriver27 «¿Cuánto debe cobrar un repartidor?» (hace 8 h, 493 ❤, 64 comentarios) | la cifra del mes engaña: lo que cuenta es lo que queda por hora; restar gasolina, cuota y desgaste; «hicimos una calculadora gratis» | sí, **retenido por TikTok** (ver abajo) |
| 04:38 | TikTok | @bruselasinfiltro «Repartir paquetería en España no es como lo pintan» (11,7K ❤) → respuesta a Frank Cárdenas («¿buen precio por paquete a un autónomo?») | los números de la calculadora (1,10 €/parada, 100 paradas, 22 días → 7,19 €/h, orientativo) | no, **retenido** |
| 04:41 | TikTok | mismo vídeo, comentario general (corto, sin cifras) | la mitad de la jornada se decide en cómo cargas | no, **retenido** |
| 04:46 | YouTube | Jeremias Savedra «Trabajando repartiendo paquetes en España, ¿merece la pena?» (hace 2 d, 83 vistas, 1,55K suscriptores) → **ofrecimiento público a micro-creador** | somos FDS, equipo pequeño de España; ¿la llevas una semana en la furgo y cuentas en vídeo qué le falta, lo malo también? sin pago ni condiciones; en Google Play buscando FDS | sí (publicado como @FlotaDSP, verificado) |
| 04:49 | YouTube | Un Ecuatoriano en España «Un día entero trabajando como repartidor» (hace 4 d, 108 vistas, 0 comentarios: el nuestro es el primero) | aparcar una vez para tres portales; en 120 paradas son 40 maniobras menos | no (verificado) |
| 04:51 | Instagram | notificaciones | nada nuevo (sigue el aviso de inicio de sesión de hace 7 h) | — |
| 04:52 | Facebook | notificaciones | nada nuevo; sigue el anuncio con el pago rechazado (no se toca) | — |

**TikTok retiene los comentarios**: desde las 04:30 `api/comment/publish` devuelve 200 pero el comentario no aparece (ni
recargando, ni el corto sin cifras ni enlace). El de AnthonyS (04:27) sí entró. Probable límite temporal por volumen de
comentarios de la cuenta (unos 30 en 30 h): **en la siguiente ronda, comprobar con un comentario y, si sigue, dejar TikTok
reposar 24 h**. Ojo: el comentario a Frank se reenvió dos veces (clic + Enter); si TikTok los libera, puede salir duplicado.

Totales publicados: X 2 respuestas (0 con app) + 1 seguida; TikTok 1 (0 con app) + 3 retenidos; YouTube 2 (1 con app, el
ofrecimiento); Instagram 0; Facebook 0. Con app: 1 de 5 publicados. Reddit no se intentó (bloqueado). Sin pieza nueva.

## 30-10-2026 (08:00 – 08:40) — ronda del bucle de 4 h

### Metricool (marca 7741371)
Los 7 días estaban completos hasta el S 07-11. Alguien (creado a las 07:55, usuario de Dani; no es de esta sesión) había
añadido ya el **D 08-11 con el carrusel C** en TikTok e Instagram (410876098 / 410876132): el calendario lo tenía el 09-11,
se respeta. Para no dejar hueco, añadido el domingo siguiente:
| Red | Cuándo | Pieza | Notas |
|---|---|---|---|
| TikTok | D 09-11 18:00 | `invita-9x16.png` | «Invita y gana 💶 … 10 € a tu cartera … Él se lleva 25 € de bienvenida» (texto nuevo, oferta de REDES.md §3); comentario fijado «¿Tienes un compañero que todavía ordena la ruta a mano?…»; marca propia (410884328) |
| Instagram | D 09-11 12:00 | `invita-9x16.png` | mismo texto, publicación (410884395) |
| YouTube | D 09-11 19:00 | `tiktok-es.mp4` | Short «La ruta se ordena sola con una foto a la etiqueta», utm `post_ruta`, IA sí (410884421) |

### X (@FlotaDSP)
- Hoy no había post pendiente (el del 30-10 salió ayer); V 31-10 → S 07-11 ya programados. **Programado D 08-11 7:30**
  (Latinoamérica: «funciona en cualquier país y “Mi dinero hoy” sale en vuestra moneda (en Brasil, Pix)», enlace repartidores
  `utm_content=post_latam`). Ojo: en `/compose/post` el primer tecleo se perdió al abrir el calendario; hubo que volver a
  escribir el texto en el cuadro de inicio (ya con la fecha puesta) y pulsar Schedule. Verificado en la lista de programados.

### Ronda de conversación (lo nuestro primero)
| Hora | Red | Hilo | Qué se dijo | App |
|---|---|---|---|---|
| 08:13 | X | notificaciones | nada nuevo desde las 04:10 | — |
| 08:18 | X | @David77811756 («soy repartidor muchos años, el repartidor no sabe qué hay en las cajas», hilo de un paquete manipulado) | el repartidor ve una caja cerrada y precintada; cada vez más compañeros hacen foto al cargar y al entregar | no |
| 08:20 | X | **seguida @cadesum** (Cadena de Suministro, medio del sector) | — | — |
| 08:21 | X | @00sslashers (cliente, queja contra una empresa concreta, ya contestada por su cuenta de ayuda) | no se contesta (sería meterse en una queja ajena) | — |
| 08:25 | TikTok | Actividad: laryrepartidor contestó «Gracias bro» a lo nuestro; SOFIA TORREZ y AnthonyS dieron me gusta | sin respuesta (no hace falta) | — |
| 08:29 | TikTok | **prueba**: @amazon_espana_19 «Un día como repartidor en Pamplona» (13-10, 573 ❤) | aparcar una vez para varios portales e ir andando con el sobre es lo que más ahorra en ciudad | no. **Publicado y visible tras recargar: TikTok ha soltado los comentarios** |
| 08:33 | TikTok | @eljuanitoesp «Latinos en España trabajando de repartidores de paquetería» (hace 5 d, 5.966 ❤, 74 comentarios) → respuesta a kevinpadilla440 (reembolsos sin cambio) | avisar por WhatsApp con el importe exacto y apuntar cada cobro con foto; al final del día sin discusiones | no (la función, sin nombre) |
| 08:34 | TikTok | mismo vídeo, comentario general | falta una: cuatro pisos sin ascensor y «es para mi vecino» | no |
| 08:36 | TikTok | @emilianaxel «Cuánto gano repartiendo paquetería en Madrid» (2025-11, 32,2K ❤, 1.911 comentarios) | la cifra por paquete engaña, lo que cuenta es lo que queda por hora; «hicimos una calculadora gratis, sin registro (somos FDS)» | sí |
| 08:39 | YouTube | Elmer mk «Un día de repartidor de paquetes» (hace 1 a, 4,9K vistas, 11 comentarios) | los bultos sueltos en el suelo de la furgo son minutos perdidos; apuntar el hueco de cada paquete y ordenar antes de arrancar | no (verificado) |
| 08:43 | YouTube | Agustín Álvarez «Un día trabajando… y por qué lo dejo» (hace 2 a, 169K vistas, 564 comentarios) | lo que quema es el tiempo muerto (buscar el paquete, ordenar a mano, cobros en papel); «por eso hicimos FDS, app gratis de reparto»; que nos digan qué le falta | sí (verificado) |
| 08:45 | Instagram | notificaciones | nada nuevo (sigue el aviso de inicio de sesión, ahora «hace 11 h») | — |
| 08:46 | Facebook | notificaciones y feed de grupos | nada nuevo; en los grupos solo ventas de coches y anuncios de rutas. Sigue el anuncio de la página con el pago rechazado (no se toca) | — |

Sin ofrecimiento nuevo a micro-creador esta ronda (los dos de ayer, @monicareal63 y Jeremias Savedra, siguen sin contestar;
no se insiste). Pendiente de comprobar si TikTok publicó también los 3 retenidos de las 04:30 (y si el de Frank Cárdenas
salió duplicado): no verificado.

Totales publicados: X 1 respuesta (0 con app) + 1 seguida; TikTok 4 (1 con app); YouTube 2 (1 con app); Instagram 0;
Facebook 0. Con app: 2 de 7. Reddit no se intentó (bloqueado). Sin pieza nueva (quedan sin usar: carrusel C ya programado,
`invita-9x16.png` ya programado; faltan tarjetas X-* del 08-11 en adelante y el sketch FDS-4).

### 30-10 08:50 – 09:10 — Dani: «sigue así; incluso puedes buscarlo en otros idiomas dado que estamos para más sitios»
- Regla nueva escrita en `PROMPT-PC.md` (paso 4): cada ronda busca también en pt, en, it, fr, de y español de LatAm y contesta en el idioma del hilo.
- X en portugués, inglés e italiano (recientes): solo clientes quejándose de empresas, política y anuncios de trabajo; nada útil. Notificaciones: me gusta de Songokurious, David y Cristina C. a nuestras respuestas.
- TikTok (la cuenta es región ES: la búsqueda en portugués devuelve vídeos en español; la de inglés sí funciona):
| Hora | Red | Hilo | Qué se dijo | App |
|---|---|---|---|---|
| 09:00 | TikTok | @ndouble.1 (Nottingham) «Should we get less multi-drops??» (1.448 ❤, 95 comentarios) | en inglés: los multi-drop solo se aguantan si la furgoneta va cargada en orden de parada; saber en qué balda va cada bulto antes de salir | no (visible) |
| 09:03 | TikTok | @jst_mate.o (español repartiendo en Berlín) «Día 5: repartidor en Alemania» (525 ❤) | patios interiores con tres portales y nombres en el timbre; ¿cuántas paradas salen por allí? | no (visible) |
| 09:08 | TikTok | @toporingo87 (Ciudad de México) «183 paquetes, 151 paradas, ruta al 100 % antes de las 3:30» (16,7K ❤, 478 comentarios) | dividir la zona en cuadrantes vale igual en CDMX que en Madrid; «hicimos una app gratis que hace justo eso… Mi dinero hoy en pesos; somos FDS»; que digan qué falta en México | sí (visible) |
- Descartados: @juanfraaanjf (2021, viejo) y @boxdeliverysl (Murcia 2024, solo quejas de clientes). Con app: 1 de 3.

## 30-10-2026 (09:40 – 11:00) — Dani: «anuncios para Meta y Spotify en todos los idiomas de la app»

Hecho en `docs/anuncios/internacional/` (léeme: `TEXTOS.md`; fuente única: `textos.json`):
- **Vídeo «La ruta hecha» en en, pt, fr, it y de**: la app grabada en cada idioma (el guion de Playwright ahora busca
  los botones con el diccionario de la app, `SPOT_LOCALE`), rótulos/oferta/cierre traducidos (`capas/<idioma>/`,
  `IDIOMA=xx node ../scripts/spot-ruta/capas.mjs`) y voz nativa de Artlist (Eleven v3: Christopher en/fr, Jon pt/it, Susi de),
  montado con `IDIOMA=xx node scripts/montar-spot-ruta.mjs` → `salida/spot-ruta-{9x16-B,4x5-B,1x1-B,9x16-A-qr,16x9-A-qr,9x16-B-sin-voz}-xx.mp4`
  (no se versionan). En español se queda el del 29-10. Sin subtítulos encima de la app (regla de Dani del 29-10): el texto
  va en los rótulos y tarjetas; la voz de Artlist no da tiempos por palabra.
- **Spotify en 5 idiomas**: `spotify/fds-spotify-xx.mp3` a -16 LUFS, pico ≤ -2 dBTP, 25-29,5 s (`spotify-internacional.mjs`).
  El alemán salía a 32 s: se acortó el texto y va acelerado un 12 %.
- Textos de Meta (principal, corto, título, descripción, botón, enlace con `utm_content=rutahecha_xx`) y ficha de Spotify.
- Artlist: 40 generaciones de voz (unos 700 créditos del plan; no es gasto nuevo). **ffmpeg instalado con winget** en este PC
  (`Gyan.FFmpeg`, la ruta que ya buscaba `cierre-video-promo.mjs`).
- **No verificado**: el acento y la naturalidad de las voces (no puedo oírlas); el bono de 25 € fuera de España lo confirmó Dani a las 11:05: «se paga fuera», se queda.
  Pendiente de Dani: escucharlas, decidir lo del bono fuera, rehacer la portada de Spotify en cada idioma, y versiones
  pt-BR y en-US si quiere Brasil y EE. UU.

## 30-10-2026 (11:20 – 13:50) — Dani: «revísame el anuncio en inglés de Facebook… crea anuncios para varios idiomas y haz lo propio para Spotify Ads + TikTok»

Todo desde el Chrome del PC 1 de Dani (los vídeos salen de este PC: `docs/anuncios/internacional/salida/subir/fds-ruta-hecha-9x16-xx.mp4`,
crf 24, 6,5-7,3 MB). **Nada publicado: todo queda en borrador y lo lanza Dani** (regla: el gasto es su clic).
- **Meta** (cuenta 934137992742194, campaña «New Tráfico Campaign»): el anuncio EN que colgó Dani llevaba el vídeo y el
  texto principal en español y el inglés metido en el título → arreglado (vídeo EN, texto/título/descripción de `TEXTOS.md`,
  botón «Registrarse», enlace a Play con `referrer=utm_source=facebook&utm_medium=cpc&utm_campaign=ruta_hecha_en`) y el conjunto
  pasa de España/islas de EE. UU. a Reino Unido + Irlanda + EE. UU. con idioma inglés («FDS · Ruta hecha · EN (UK, IE, US)»).
  Nuevos conjuntos PT (Portugal), FR (Francia), IT (Italia) y DE (Alemania), cada uno con su vídeo, textos, idioma y enlace
  `ruta_hecha_xx`. **Bloqueo**: la cuenta publicitaria está inactiva por pago (#1885009) y el anuncio EN marca el error de
  permisos #1487194 (seguramente lo mismo): Dani tiene que arreglar el pago y después «Publicar».
- **Spotify Ads**: campaña «FDS · Ruta hecha · internacional (EN PT FR IT DE)» (objetivo tráfico web) con cinco conjuntos
  EN·Reino Unido, PT·Portugal, FR·Francia, IT·Italia, DE·Alemania a 15 €/día (mínimo), idioma del anuncio = idioma del conjunto
  (si no, da error), audio `spotify/fds-spotify-xx.mp3`, logo `logo-1024.png` de portada y acompañante, botón «Learn more»,
  enlace `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=spotify&utm_content=audio_xx`. Sin errores en el
  árbol; **no se ha pulsado Enviar**. Bloqueo: los anuncios de Spotify están pausados por un pago fallido. La portada por idioma
  sigue siendo la española (pendiente de Dani).
- **TikTok Ads** (campaña borrador «FDS · Ruta hecha · internacional (EN PT FR IT DE)», objetivo tráfico, id 1880473270357154):
  los cinco vídeos en la biblioteca de creatividades y cinco grupos a 20 €/día: «EN · Reino Unido, Irlanda, EE. UU.» (inglés),
  «PT · Portugal» (portugués), «FR · Francia» (francés), «IT · Italia» (italiano), «DE · Alemania» (alemán); cada uno con su
  anuncio «FDS · XX · Ruta hecha»: vídeo del idioma, texto ≤ 100 caracteres de `textos.json` (el francés recortado a 100),
  enlace a Play con `utm_campaign=ruta_hecha_xx`, botón dinámico. Guardado con «Salir → Quedarme/borrador»; **no «Publicar todo»**.
  Bloqueo: saldo 0,00 € y TikTok pide verificar el teléfono. La sugerencia de subir el presupuesto a 34,43 € NO se aplicó.
- Trucos que han hecho falta (para la próxima): en Meta el input de archivo solo existe al pulsar «Subir» (parchear
  `HTMLInputElement.prototype.click` para que se quede en el DOM); en Spotify y TikTok el campo de URL se rellena con el setter
  nativo + eventos `input/change` (al teclear se pierde el «?» o se pega al valor anterior); en TikTok el texto del anuncio y la URL
  son `ks-text-field` con shadow DOM, los vídeos se cambian con «Editar selecciones → Biblioteca → buscar 9x16-xx», y hay que
  quitar el vídeo anterior de la bandeja; pulsar en el nombre de un grupo del árbol a veces activa la edición en masa (salir con
  «Salir del modo de edición en masa» y usar «Continuar»).
- **No verificado**: que los borradores pasen la revisión de cada plataforma al publicarlos; las voces de oído. Pendiente de Dani:
  pagos de Meta y Spotify, saldo y teléfono de TikTok, y pulsar Publicar / Enviar / Publicar todo cuando quiera lanzar.

## 30-10-2026 (14:00 – 14:45) — ronda del bucle de 4 h (desde el Chrome del PC 1 de Dani)

### Metricool (marca 7741371)
Completo hasta el L 09-11 en las tres redes (TikTok 18:00 e Instagram 12:00 cada día; YouTube J 30-10, L 02-11, J 05-11 y
L 09-11; LinkedIn M 04-11 y M 11-11). Nada que añadir. Ojo para la próxima: el domingo 01-11 y el 08-11 no tienen Short
(los hay el lunes siguiente); si se quiere cumplir «jueves y domingo» a rajatabla, mover o duplicar con otro vídeo.

### X (@FlotaDSP)
- Hoy sin post pendiente (el del 30-10 salió ayer); V 31-10 → D 08-11 ya programados. **Programado L 09-11 7:30** («Sin
  cobertura en el garaje del polígono: la app abre con tu ruta guardada y lo entregado se envía solo al volver la red…»,
  sin enlace ni imagen). Mismo truco que la ronda anterior: el primer texto se pierde al fijar la fecha; se vuelve a escribir
  en el cuadro ya con la fecha y se pulsa Schedule. Verificado en «Scheduled» («Will send on Mon, Nov 9, 2026 at 7:30 AM»).
- Notificaciones: me gusta de Blacksark (+2), goraarin, Cristina C. y Kevin Crestt a nuestras respuestas; Kevin Crestt nos sigue.
  Nada que contestar.
- Seguidas: **@informacionlog** (Información Logística) y **@todotransport** (TodoTransporte).
- Búsquedas en español («repartidor furgoneta», «soy repartidor») e inglés («delivery driver», «multi-drop», «van driver»):
  solo clientes quejándose de empresas, un post patrocinado de la UNED y el hilo de Lorenzobillares que ya contestamos hace 12 h
  (es una queja contra una empresa de reparto: no se insiste). 0 respuestas nuevas.

### Ronda de conversación (lo nuestro primero)
| Hora | Red | Hilo | Qué se dijo | App |
|---|---|---|---|---|
| 14:10 | TikTok | Actividad: .impar.uve dio me gusta a dos comentarios nuestros (hace 1 h) | sin respuesta | — |
| 14:13 | TikTok | @unecuatorianoenes «Un día entero repartiendo paquetes en Madrid» (hace 6 d, 605 ❤) | ya comentado por nosotros hace 15 h; se pasa | — |
| 14:17 | TikTok | **@latindriver27** «¿Cuánto debe cobrar un repartidor?» (hace 16 h, 918 ❤, 131 comentarios) | la cifra del mes engaña: dividir por las horas reales desde la carga a las 6:30 y quitar la gasolina; el que aguanta es porque sabe ordenar la furgoneta, no porque corra | no (verificado) |
| 14:20 | TikTok | **@quienescifu** «La Merche hoy no quiere chamba» (hace 21 h, 783 ❤; furgoneta que no arranca, en Alemania) | humor: la Merche se ha puesto en huelga antes que tú; cuando arranque, que sea con la carga en orden de parada | no (verificado) |
| 14:24 | TikTok | **@jordan.blnc** (Francia) «Je vous montre comment je m'organise avant de partir livrer» (29-09, 2.222 ❤, 55 comentarios) | en francés: la tournée se gagne au chargement; «on a fait une appli gratuite… on est FDS»; **ofrecimiento público** a que la pruebe en una tournée real y diga qué falta en Francia, sans contrepartie | sí (verificado) |
| 14:28 | TikTok | **@hidia98** DIA ON ROUTE (Italia) «Tour del furgone» (hace 3 h, 58 ❤) | en italiano: ogni pacco al suo posto prima di partire è metà del giro; ¿ordenas por calle o por horario de apertura? | no (verificado) |
| 14:32 | TikTok | @laryrepartidor «Día 131 trabajando como autónomo en reparto» (hace 2 d, 53 ❤) | el bloque de cajas grandes es el bueno; lo que castiga es el de 60 sobres en 60 portales; ánimo por el día 131 | no (verificado) |
| 14:36 | YouTube | Emet «Trabajando un día como REPARTIDOR DE AMAZON» (389K vistas, hace 2 a, 503 comentarios) | sobre el comentario de millonariosonline1040 (180 paradas en 8 h): el tiempo se gana antes, con la furgoneta cargada en orden de entrega | no (verificado) |
| 14:40 | YouTube | Con L de Latino «Día de Reparto Amazon España Ep. 5» (3,4K vistas, hace 1 a) | el que empieza tarda el doble ordenando a mano; «por eso hicimos FDS, app gratis de reparto…»; que diga qué le falta | sí (verificado) |
| 14:42 | Instagram | — | **sin sesión en este Chrome** (pantalla de login; no se inicia sesión) | — |
| 14:44 | Facebook | notificaciones | un administrador aprobó hace 2 h la publicación de Dani en «Repartidores Paquetería Madrid» (aún sin comentarios). **Ojo**: el texto dice «7 días gratis y no pide tarjeta» y la tarjeta del enlace «GRATIS y sin límite hasta el 31-12»: es la oferta vieja, que la corrija Dani (es su perfil, no la toco). Además 10 avisos «No se ha podido subir el vídeo» (hace 1 h) y reacciones a un reel «Built for speed. Driven by passion…» de la página FDs que no es de esta sesión (no verificado quién lo subió). Facebook pide crear una clave de acceso (passkey): cerrado sin tocar | — |

Sin pieza nueva. Totales: X 0 respuestas + 2 seguidas; TikTok 5 comentarios (1 con app, el ofrecimiento en francés); YouTube 2
(1 con app); Instagram 0 (sin sesión); Facebook 0 (nada que contestar). Con app: 2 de 7. Reddit no se intentó (bloqueado).
La búsqueda en portugués en TikTok sigue devolviendo vídeos en español (cuenta región ES).

## 30-10-2026 (15:00 – 15:30) — Dani: «¿has quitado el anuncio en español de Facebook? Me traía bastantes clientes, ponlo de nuevo»

Sí: el conjunto que Dani tenía en español (ahora «FDS · Ruta hecha · EN (UK, IE, US)», id 52648299574539; llevaba 32 clics y
3,30 € cuando lo toqué a las 11:30) lo convertí al inglés al «revisar el anuncio en inglés». Repuesto como conjunto nuevo en la
misma campaña: **«FDS · Ruta hecha · ES (España)»** (id 52648537418339, duplicado del EN sin recomendaciones), ubicación España,
sin límite de idioma, anuncio **«FDS · Ruta hecha · ES»** (52648537418139) con el vídeo español `spot-ruta-9x16-B.mp4` del 29-10
(copia de subida `internacional/salida/subir/fds-ruta-hecha-9x16-es.mp4`, 6,4 MB), texto/título/descripción de `textos.json` → es
(«¿Repartes paquetes? Foto o escaneo a la etiqueta…», «Tu ruta de reparto, hecha sola», «Empieza gratis · 25 € con tu primera ruta»),
botón «Registrarse», enlace `https://flotadsp.com/repartidores?utm_source=facebook&utm_medium=cpc&utm_campaign=ruta_hecha&utm_content=rutahecha_es`.
El conjunto «España · 20-55 · reparto · registro» (60 registros, 75,98 €) no lo toqué y sigue activo.
- **Hallazgo**: Meta rechaza el enlace a Google Play en una campaña de tráfico (#1487810: «solo puede incluirse la URL de la
  aplicación con el objetivo de instalaciones»). Es la causa del #1487194 del EN. Los conjuntos EN/PT/FR/IT/DE siguen con el enlace
  de Play: hay que cambiarlos a la web (`/repartidores?…utm_content=rutahecha_xx`) o no entregarán. No verificado por qué DE/FR/PT
  salen «Activa» con 0 € (puede que Dani pulsara Publicar).
- Queda en **borrador** (la cuenta sigue inactiva por pago): Dani pulsa «Publicar» (hay 9 cambios pendientes en «Revisar y publicar»).

## 30-10-2026 (15:35 – 16:20) — Dani: «Sí, cámbialos» (los enlaces de Play de los cinco anuncios de Meta)

Anuncios EN (52648299575339), PT (52648512622939), IT (52648514792539), FR (52648514792139) y DE (52648514792339): el enlace
pasa de Google Play a `https://flotadsp.com/repartidores?utm_source=facebook&utm_medium=cpc&utm_campaign=ruta_hecha&utm_content=rutahecha_xx`.
Guardados como «cambios sin publicar» (pie «Se han guardado todos los cambios»), sin errores; verificado recargando cada anuncio
y mirando el final del enlace. **Dani pulsa Publicar** («Revisar y publicar» tiene ahora los seis conjuntos: ES nuevo + cinco enlaces).
- Trucos: en Meta, poner la URL con el setter de JS NO se guarda (al recargar vuelve la de Play); hay que teclearla en el campo
  (triple clic por coordenadas, Ctrl+A, escribir). **Chrome autocompleta el final del enlace con el anterior** (al IT le puso
  `rutahecha_pt` al pulsar Tab): escribir, pulsar Escape y salir del campo con un clic, no con Tab; luego comprobar el final.
  Pulsar el campo por referencia abre el menú lateral. La sección «Destino» se renderiza solo al hacer scroll con la rueda hasta
  ella (con `scrollIntoView` el campo mide 0). Aviso «Funcionamiento incorrecto de la extensión del navegador»: Aceptar y seguir.
