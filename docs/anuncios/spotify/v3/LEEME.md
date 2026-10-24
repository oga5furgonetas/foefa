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
