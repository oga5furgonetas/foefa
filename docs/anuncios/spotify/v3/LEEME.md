# Anuncio de Spotify v3 (24-10-2026)

Lo mismo que el v2 (dónde entrar, la web dos veces y «toca este anuncio»), con la voz de Gemini en lugar de la
de Microsoft y la mezcla medida con las normas de Spotify.

| Fichero | Duración |
|---|---|
| `fds-spotify-v3-puck.mp3` | 23,2 s |
| `fds-spotify-v3-achird.mp3` | 22,9 s |
| `fds-spotify-v3-laomedeia.mp3` | 29,4 s, más pausada |
| `portada-640.jpg` | la imagen que acompaña al audio, la misma del v2 (640×640, 36 KB) |
| `guion.txt` | lo que dice |

Dani elige la voz de oído. Whisper, sin darle el guion, entiende Puck y Laomedeia casi palabra por palabra;
con Achird se come algo el arranque («Oye» y «Le haces»).

## Lo que pide Spotify y cómo queda
Normas leídas el 24-10-2026 en ads.spotify.com: la página de especificaciones de anuncios de audio y la guía
de requisitos mínimos.

| Norma de Spotify | Los tres MP3 |
|---|---|
| -16 LUFS ±1,5 | -16,2 a -16,4 LUFS |
| Pico real ≤ -2,0 dBTP | -2,6 a -2,7 dBTP |
| 0,5 s de silencio al principio y al final | 0,5 s de silencio digital |
| MP3, 44,1 kHz, estéreo, 192-320 kbps | MP3, 44,1 kHz, estéreo, 192 kbps (0,55-0,71 MB) |
| 30 s como máximo | 22,9-29,4 s |
| Imagen 1:1, mínimo 600×600, máximo 200 KB | 640×640, 36 KB |

La música queda unos 12 LU por debajo de la voz mientras habla, y baja sola con sidechain, como en el vídeo.

El guion se lee con 70 palabras, porque la web deletreada cuenta como varias. Spotify recomienda 65 para 30 s.
Por eso se miró la duración real, que queda por debajo de 30 s.

## Pausas
Achird y Puck leen deprisa, y la web deletreada se pisaba con lo anterior: «Te lo repito:» tenía 0,07 s antes
de «flota de ese pe». El script alarga SOLO los silencios entre frases, sin estirar la voz:

- 0,42 s como mínimo tras un punto;
- 0,32 s tras dos puntos;
- 0,6 s antes de «Entra en…»;
- 0,75 s como máximo en cualquier pausa.

Dónde acaba cada frase lo dice faster-whisper.

## Cómo subirlo (lo hace Dani: es gasto)
1. https://ads.spotify.com → Ad Studio → nueva campaña → objetivo «Clics» o visitas al sitio web.
2. Público: España, 20-55 años; de lunes a sábado por la mañana, de 6:00 a 11:00, cuando se carga la
   furgoneta.
3. Anuncio: subir el MP3 elegido y `portada-640.jpg`. Nombre del anunciante «FDS», botón «Más información».
   URL al tocar:
   `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=spotify&utm_content=audio3`
4. Presupuesto: lo decide Dani.

Medición: los toques llegan con `utm_source=spotify`. Quien escribe la web a mano llega como «directo»: si las
visitas directas a la portada suben los días que corre el anuncio, también es Spotify.

## Rehacerlo
```
GEMINI_API_KEY=… py -3 scripts/spot-v5/voz_gemini.py --spotify Puck Achird Laomedeia   # la locución
py -3 scripts/spot-v5/spotify.py Puck Achird Laomedeia                                  # pausas, mezcla y comprobación
```
`spotify.py` se para si el MP3 final no cumple las normas de Spotify.

## La campaña en Spotify Ads (24-10-2026)
Cuenta publicitaria FDs. Campaña «FDS — Spotify audio (Puck) · registro (24-10)», objetivo tráfico del sitio web
(clics; no hay píxel de Spotify). Grupo «España · 18-54 · móvil · audio Puck»: España, 18-54, idioma español,
solo iPhone y Android, categoría Tecnología > Aplicaciones, música y pódcasts, ubicación automática.
**15 € al día** (el mínimo de Spotify; el presupuesto total pide más de 250 €) del 24-10 07:25 al 31-10 23:59.
Anuncio «Audio Puck 23 s · registro · audio3»: anunciante FDS, eslogan «Tu ruta, ordenada sola y gratis», botón
**Registrarte**, URL `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=spotify&utm_content=audio3`,
`fds-spotify-v3-puck.mp3`, `portada-640.jpg`, `logo-1024.png` (el favicon a 1024 px) y `canvas-puck-8s.mp4`
(Canvas: 8 s del spot de Puck sin subtítulos, entrega → GRATIS → flotadsp.com, en bucle mientras suena).

Gotchas del editor de Spotify: el campo de URL se come el «?» al escribir (poner el valor con el setter nativo
del input y disparar `input`/`change`); si la hora de inicio ya pasó, «Presupuesto y fechas» queda en rojo; el
borrador puede volver a una versión vieja (perdió nombre, idioma, dispositivos, fin, imágenes y audio una vez):
revisar la pantalla «Revisar y enviar» antes de enviar. Para enviar, la facturación pide dirección postal,
población, comunidad autónoma y código postal: datos de Dani.

### 24-10-2026, tarde: no se pudo enviar desde el PC
Hay dos borradores listos: «FDS Spotify audio Puck registro 24-10» (el primero) y «FDS Spotify audio Puck
registro» (rehecho desde cero; categoría Tecnología > Programas informáticos, inicio 24-10 15:27, fin 31-10
23:59). En los dos, «Enviar» responde «Corrige los errores de validación» sin decir cuáles y sin llamar al
servidor (validación solo en el navegador). Descartado: la hora (la regla es que el inicio esté a más de 60
minutos), la categoría, el Canvas, los nombres con «—», «·» o paréntesis y la fecha de fin. Sospecha: la
extensión de Claude en el Chrome de Dani (Meta también avisa de que «una extensión interfiere»). Dani lo envía
desde el móvil. Al volver a la pantalla de revisión, Spotify vacía la dirección de facturación: rellenarla justo
antes de «Enviar».

### 24-10-2026, 14:15: diagnóstico del «Corrige los errores de validación»
También falla desde Microsoft Edge (sin la extensión de Claude), así que la extensión no es la causa.
Lo comprobado en el código de la página (Ads Manager, Next.js):
- Al pulsar «Enviar» NO sale ninguna llamada a la API de anuncios (medido con el registro de tiempos del
  navegador: solo telemetría y píxeles). El bloqueo es de la propia página.
- Los editores de campaña, grupo y anuncio dan sus formularios válidos (sin errores), y el de facturación
  también (`submitSucceeded: true`). Pero al enviar, la página marca CAMPAIGN, AD_SET y AD como `ERROR` y
  enseña el mensaje genérico `I18N_ERROR_CAMPAIGN_PUBLISH_VALIDATION` (código `PUBLISH_VALIDATION_ERROR`).
- La cuenta publicitaria está `ACTIVE`, «Requiere atención (0)», pero su dirección de facturación nunca se
  ha llegado a guardar (`billingAddress` solo tiene el nombre, `billingType: UNSET`).
- Descartado: hora de inicio (regla de 60 minutos), categoría, Canvas, nombres, fecha de fin, URL con o sin
  parámetros, borrador nuevo desde cero.
Siguiente paso: soporte de Spotify (chat de Ads Manager o ads-manager-support@spotify.com). Mensaje propuesto:
«Hola. Ad account FDs (0332a42a-0ab8-43bf-8d25-4c4a697ac505), campaña en borrador a7d8c60e-0e0f-4913-9130-e90aa5ffd5c6.
Al pulsar Enviar aparece "Corrige los errores de validación e inténtalo de nuevo" sin indicar ningún campo; no se
envía ninguna petición a la API y los editores no muestran errores. Pasa en Chrome y en Edge, también con una
campaña nueva. ¿Podéis ver qué bloquea la publicación? Gracias.»
