# El anuncio con la voz de Dani (29-10-2026, tarde)

Dani grabó la locución en una nota de voz de WhatsApp (`fuente-dani-whatsapp.mp3`, 30 s, acento de España, la
suya) y pidió «utilízame este audio y móntame el vídeo acorde al audio» y, después, «mete lo de los 25 euros como
gancho inicial». Este anuncio es ESE montaje: la voz manda el tiempo y cada pantalla entra con la frase que la cuenta.

Vídeos en `salida/` (los sube Dani; ver `../super-anuncio/SUBIR.md` para los pasos de cada plataforma):

| Fichero | Para | Duración |
|---|---|---|
| `spot-dani-9x16-B.mp4` | TikTok, Reels, Historias, YouTube Shorts (cierre «toca el botón de abajo») | 32,2 s |
| `spot-dani-9x16-A-qr.mp4` | Pantallas de la nave, YouTube en ordenador, flyer (cierre con QR a Google Play) | 32,2 s |
| `spot-dani-9x16-B-30s.mp4` | Spotify (vídeo de 30 s justos: empieza con la voz, sin el gancho de los 25 €) | 30,0 s |
| `spot-dani-4x5-B.mp4` | Feed de Facebook e Instagram | 32,2 s |
| `spot-dani-16x9-A-qr.mp4` | YouTube, tele, ordenador | 32,2 s |
| `spot-dani-1x1-B.mp4` | Feed cuadrado (no se versiona; se regenera) | 32,2 s |

## Qué dice y qué se ve

La transcripción (whisper small, en el propio contenedor) está en `voz.json` con el inicio y fin de cada frase. En el
vídeo la voz empieza a los 1,7 s, después del gancho.

| Segundo (vídeo) | La voz de Dani | En pantalla |
|---|---|---|
| 0,0 | *(música)* | **«¿Quieres 25 € gratis? Te los damos por tu primera ruta con la app.»** sobre la furgoneta llena de paquetes (plano de Artlist) |
| 1,7 | ¿Trabajas repartiendo paquetes, comida o haciendo mensajería? | La cabina de la furgoneta con el móvil en el soporte (plano de Artlist) + la pregunta escrita |
| 4,6 | ¿Eres autónomo o formas parte de una empresa de reparto? | La app en el móvil: la ruta ordenada con la hora de cada parada, bajando por la lista |
| 7,8 | Esto te interesa. | Tarjeta «Esto te interesa.» |
| 8,9 | Llega Flota DSP, | El logo, «Flota DSP», «FDS · Reparto y rutas», «Google Play · flotadsp.com» |
| 10,3 | la aplicación pensada para los repartidores | La app: el mapa REAL de A Coruña con la ruta del día («Tu ruta del día, en el móvil») |
| 12,2 | y el control de flotas. | El panel de empresa (captura real de `docs/play-store/captura-4-oficina-mapa.png`), la cámara entra hacia el mapa con los repartidores |
| 13,9 | Una solución digital para ayudarte a organizar mejor el trabajo | Escanear dos paquetes: bip, «Añadida a tu ruta» («Foto o escaneo: la dirección entra sola») |
| 17,1 | y gestionar el reparto de forma más eficiente. | «Ordenar ruta» → la ruta con la hora de cada parada |
| 19,8 | Da igual si trabajas por tu cuenta | El mapa con las zonas de carga y descarga encendiéndose |
| 21,6 | o trabajas para una empresa. | La guía parada a parada («Te lleva con voz») |
| 23,1 | El reparto evoluciona y tú puedes | «Entregado», con la prueba de entrega |
| 24,9 | formar parte del cambio. | El repartidor cerrando la furgoneta (plano de Artlist) + «El reparto evoluciona. Forma parte del cambio.» |
| 26,3 | Descubre Flota DSP en flotadsp.com. | Cierre: logo, **flotadsp.com**, «+25 € con tu primera ruta», «Toca el botón de abajo», Google Play |
| 29,1 | Flota DSP. | (sigue el cierre) |
| 30,1 | Cada entrega cuenta. | Entra el lema «Cada entrega **cuenta**.» |

Los titulares de arriba van en una franja aparte, nunca encima de la app (Dani, 29-10). Sin subtítulos: la voz cuenta.

## El mapa real, sin red

El entorno no llega a `tile.openstreetmap.org`, y el mapa esquemático que se usó antes «no tenía sentido». La salida:
`docs/play-store/captura-4-oficina-mapa.png` (la captura del panel para Google Play) tiene el mapa de verdad de A Coruña
a 2x. `scripts/spot-ruta/teselas.py` la georreferencia casando sus 12 marcadores con las coordenadas de los pedidos de
la demo (error < 1 px), le quita marcadores, líneas y controles, la amplía por reflejo en los bordes, sube la
resolución ×2 y ×4 con FSRCNN (modelo de `github.com/Saafke/FSRCNN_Tensorflow`, público; sin él, Lanczos + enfoque) y
corta teselas de los zooms 13-17. `e2e/spot-ruta.spec.js` las sirve en vez de las de OSM (variable `TESELAS`). El
mapa limpio queda en `../super-anuncio/mapa-coruna.jpg` (+ `.json` con la georreferencia). A zoom 17 (la navegación)
se nota que viene de una captura a zoom 14: con red de verdad, la grabación saldría nítida sin tocar nada.

## Cómo se regenera

```
python scripts/spot-ruta/teselas.py /tmp/teselas                       # (SR_MODELOS=<carpeta con FSRCNN_x2/x4.pb> para la superresolución)
cd frontend && npx vite build && TESELAS=/tmp/teselas npx playwright test spot-ruta --project=escritorio --update-snapshots
cp -r frontend/test-results/spot-ruta /tmp/grab                         # Playwright borra test-results en cada tanda
cd frontend && node ../scripts/spot-dani/capas.mjs                      # las capas gráficas (capas/*.png)
GRAB=/tmp/grab node scripts/montar-spot-dani.mjs                        # BONO=0 → la variante sin el gancho de los 25 €
```

La voz: `voz-dani.flac` es la nota de voz tal cual, con un toque (paso alto a 55 Hz, un poco de presencia a 3 kHz,
compresión suave 1,8:1 y -16 LUFS). **La nota ya trae su música, sin derechos**, así que el montaje NO le mezcla la
nuestra (Dani, 29-10: «hay dos pistas mezcladas; quita nuestra música»); `MUSICA=1` la volvería a poner. Efectos:
una subida bajo el gancho (para que no vaya en silencio hasta que entra la voz), whoosh en cada corte, bip del
escáner, pop en cada toque, campana al entregar, subida antes del cierre. Máster a -14 LUFS / -1 dBTP (lo que piden
TikTok, Meta y YouTube).

## Antes de subirlo

- **Desplegar el bono de 25 €** (backend + web; está en el código desde el 29-10) antes de que corra un anuncio que
  lo promete. Condición real: completar la primera ruta (20 entregas en 2 días, dentro de 30 días del alta).
- Enlaces, textos y pasos por plataforma: `../super-anuncio/SUBIR.md` (mismos enlaces; cambiar `spot-ruta` por
  `spot-dani` en el nombre del fichero y en `utm_content`).
- Si Dani regraba la voz (más despacio o con otra frase), basta con sustituir `fuente-dani-whatsapp.mp3`, limpiarla
  igual, rehacer `voz.json` (frases con inicio y fin) y montar.
