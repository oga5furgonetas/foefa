# Anuncio de Spotify v4 (26-10-2026): qué buscar y dónde entrar

Dani: «que sea coherente en Spotify para que sepan dónde tienen que entrar y qué deben buscar».

## Lo que fallaba en la v3

La v3 decía «una app» y «entra en flotadsp.com». Quien oye «app» la busca en la tienda, y **FDS todavía no está
publicada en Google Play**: el 26-10 la ficha pública (`play.google.com/store/apps/details?id=com.flotadsp.flota`)
da 404, porque sigue en prueba cerrada. Tampoco decía qué pasa después de entrar en la web.

## Las dos versiones (misma voz que eligió Dani: Puck)

| Fichero | Cuándo | Dura | Lo que dice al final |
|---|---|---|---|
| `fds-spotify-v4-ahora.mp3` | **AHORA**, mientras FDS no sea pública en Play | 29,9 s | «No la busques en la tienda: entra en flotadsp.com. Te lo repito: F-L-O-T-A-D-S-P punto com. Ahí creas tu cuenta, e instalas la app. O toca este anuncio.» |
| `fds-spotify-v4-play.mp3` | Cuando la ficha de Play sea pública (antes, comprobar que el enlace de arriba ya no da 404) | 26,6 s | «Búscala en Google Play: FDS. O entra en flotadsp.com: F-L-O-T-A-D-S-P punto com. O toca este anuncio, y en un minuto tienes tu cuenta.» |

El principio es el de la v3: «Oye, repartidor. Esto es para ti: FDS. La app gratis que te ordena la ruta sola. Le
haces una foto a la etiqueta, y te lleva con voz hasta cada puerta. Sin tarjeta, y sin límite hasta fin de año.»
Guiones completos en `guion-ahora.txt` y `guion-play.txt`.

«Ahí creas tu cuenta, e instalas la app» es lo que pasa de verdad. Tras el alta en flotadsp.com, la web enseña
«Instala FDS en tu móvil»: en Android, la descarga de la app; en iPhone, añadirla desde Safari (no hay App Store).
La versión «play» sirve también al iPhone, porque nombra la web.

## Comprobado

| Norma de Spotify | ahora | play |
|---|---|---|
| -16 LUFS ±1,5 | -16,3 | -16,2 |
| Pico real ≤ -2,0 dBTP | -2,7 | -2,8 |
| 30 s como máximo (con 0,5 s de silencio delante y detrás) | 29,9 s | 26,6 s |
| MP3 44,1 kHz estéreo 192 kbps | 0,72 MB | 0,64 MB |

La música queda 11,2 LU por debajo de la voz mientras habla.

Whisper, sin darle el guion (`oido-*.txt`), entiende «No la busques en la tienda. Entra en flotaDSP.com… Ahí creas
tu cuenta e instalas la app… toca este anuncio» y «Búscale en Google Play. FDS. O entra en flotaDSP.com». La web
deletreada suena: el tramo solo se transcribe «Flota, D, S, P». La primera redacción de «ahora» salía de 30,4 s y
se acortó la llamada.

## Todo lo demás del anuncio, ya coherente (no cambia)

- **Imagen** (`../v3/portada-640.jpg`): FDS · «La app de reparto gratis» · flotadsp.com · «Toca y crea tu cuenta en 1 minuto».
- **Canvas** (`../v3/canvas-puck-8s.mp4`): entrega → GRATIS → flotadsp.com.
- **Logo** `../v3/logo-1024.png`, anunciante «FDS», eslogan «Tu ruta, ordenada sola y gratis», botón **Registrarte**.
- **Al tocar** (cambia solo `utm_content`, para medir la v4 aparte de la v3):
  `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=spotify&utm_content=audio4`
- **La página de registro** dice lo mismo que el audio: «Gratis y sin límite hasta el 31 de diciembre · sin tarjeta».
- **La app nativa (FDS 2.0.0)** dice lo mismo en su portada y en el alta. Lo saca de `/billing/planes`, igual que la web.
  Antes ponía «Gratis hasta 15 paradas al día», que contradecía al anuncio.

## En Spotify Ads Manager (lo hace Dani)

La campaña de la v3 sigue en borrador porque Spotify no deja enviarla («Corrige los errores de validación»; ver
`../v3/LEEME.md`, pendiente de su soporte). Al desbloquearla:

1. En el anuncio, cambiar el audio por `fds-spotify-v4-ahora.mp3`.
2. Cambiar la URL a la de arriba (`utm_content=audio4`).
3. Dejar igual la imagen, el Canvas, el logo, el eslogan y el botón.

Cuando FDS salga en Play: subir `fds-spotify-v4-play.mp3` en su lugar.

## Rehacerlo

```
GEMINI_API_KEY=… py -3 scripts/spotify-v4/anuncio.py ahora play
```

La locución se guarda en `v4-<versión>.wav`. Si se cambia el guion, hay que borrarla para que se vuelva a generar.
La mezcla es la de la v3 (`scripts/spot-v5/spotify.py`, que ahora admite otro guion, carpeta y nombre). El script
para si el MP3 no cumple las normas de Spotify o si Whisper no oye la web y lo que hay que hacer.
