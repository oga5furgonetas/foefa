# Anuncio de Spotify v2 (24-10-2026)

- `fds-spotify-v2.mp3` — el anuncio (26 s, voz + música, -16 LUFS, 0,6 MB)
- `portada-640.jpg` — la imagen que acompaña al audio (640×640, 36 KB): la web en grande y «Toca y crea tu cuenta»
- `guion.txt` — lo que dice (64 palabras; Spotify recomienda ≤65 para 30 s)

## Por qué así
En Spotify no se ve nada: si no se oye **dónde entrar**, no se registra nadie. Por eso, siguiendo la guía de
Spotify para anuncios de audio:
- La marca al final de la primera frase («Repartidor, esto es para ti: FDS.»).
- Problema → lo que hace la app → la oferta → **qué hacer**.
- La web se dice **dos veces y deletreada** («flota de ese pe punto com. Flota, de, ese, pe, punto com»), porque
  «flotadsp» no se entiende de oído a la primera.
- Y la alternativa más fácil: «toca este anuncio» (el anuncio de Spotify lleva botón).
Quien escribe flotadsp.com en el navegador llega a la portada, cuyo primer botón es «Crear mi cuenta gratis».

## Cómo subirlo (lo hace Dani: es gasto)
1. https://ads.spotify.com → Ad Studio → nueva campaña → objetivo «Clics» / visitas al sitio web.
2. Público: España, 20-55 años; de lunes a sábado por la mañana (6:00-11:00, cuando se carga la furgoneta).
3. Anuncio: subir `fds-spotify-v2.mp3` y `portada-640.jpg`; nombre del anunciante «FDS»; botón «Más
   información»; URL al tocar:
   `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=spotify&utm_content=audio2`
   (va directo al alta).
4. Presupuesto: lo decide Dani.

Medición: los toques llegan con `utm_source=spotify`. Los que escriben la web a mano llegan como «directo»: si
las visitas directas a la portada suben los días que corre el anuncio, también es Spotify.
