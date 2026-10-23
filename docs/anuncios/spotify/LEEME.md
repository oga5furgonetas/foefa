# Anuncio de audio para Spotify (23-10-2026)

Ficheros de esta carpeta:
- `fds-spotify-30s-ximena.mp3` y `fds-spotify-30s-alvaro.mp3`: el anuncio montado (29,8 s, voz + música, -16 LUFS,
  192 kbps, ≈0,7 MB). Dos voces para elegir: Ximena (mujer) y Álvaro (hombre). Voz neuronal de Microsoft.
- `voz-ximena.mp3` / `voz-alvaro.mp3`: la voz sola, por si se cambia la música.
- `guion.txt`: lo que dice (60 palabras; Spotify recomienda ≤65 para 30 s).
- Imagen de acompañamiento (640×640, ≤200 KB): `../app/1-ruta-sola-spotify-640.jpg` (o cualquiera de las
  otras tres `*-spotify-640.jpg`).

**Voz humana, mejor.** Si Dani graba el guion con el móvil en un sitio silencioso (nota de voz, 25-28 s, sin
prisa), se monta igual con la música: `ffmpeg` con el mismo filtro de `scripts/spotify/` (sidechain + loudnorm).
Guardar la grabación como `voz-dani.m4a` en esta carpeta y avisar.

## Cómo subirlo (lo hace Dani: es gasto)
1. https://ads.spotify.com → Ad Studio → crear campaña → objetivo «Visitas al sitio web» (o «Instalaciones de
   app» cuando esté en Google Play).
2. Público: España (y Portugal si se quiere), 20-55 años, intereses relacionados con trabajo/conducción;
   momento: mañanas de lunes a sábado (es cuando se carga la furgoneta). Spotify deja elegir franjas.
3. Anuncio: subir el MP3, la imagen 640×640, nombre del anunciante «FDS» (≤25 caracteres), botón «Más
   información» y la URL `https://flotadsp.com/app?utm_source=spotify&utm_content=audio30`.
4. Presupuesto: lo fija Dani (Spotify pide un mínimo por campaña; lo dice al crearla).

Especificaciones (Spotify): 30 s máximo, ≤65 palabras, imagen 1:1 ≥600 px ≤200 KB, audio MP3/WAV/OGG.
Fuentes: https://ads.spotify.com/en-US/ad-specs/audio-ad-specs/ y https://ads.spotify.com/ad-specs/audio-ad-specs/

Medición: las visitas llegan con `utm_source=spotify` a la analítica (`/panel/analitica`, orígenes).
