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
