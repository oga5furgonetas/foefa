# Subir el anuncio con la voz de Dani (29-10-2026)

Dani: «despliega el bono de 25 en producción y ahora sube cada cosa a cada sitio que toque y haz publicidad».
Desde la sesión en la nube no hay navegador ni red hacia Meta, TikTok ni Spotify (el proxy devuelve 403), y el único
conector de claude.ai conectado es Artlist. Así que aquí está la lista exacta de clics, con el fichero, el texto y
el enlace de cada plataforma. Publicar lo pulsas tú: es gasto.

**Antes de pulsar nada**: comprobar que https://flotadsp.com/repartidores dice **«Gana 25 € con tu primera ruta
real»**. Si dice 10 €, el bono no está desplegado y el anuncio mentiría (ver `docs/ESTADO.md` → «Última sesión»).

## Presupuesto propuesto (pendiente de tu sí)

| Plataforma | Diario | Para qué |
|---|---|---|
| TikTok Ads | 10 €/día | tráfico a Play (Android) |
| Meta (Facebook + Instagram) | 10 €/día | dos conjuntos: Android → Play; iPhone/escritorio → alta web |
| Spotify Ad Studio | el mínimo que pida al crear (suele ser ~250 € por campaña) | vídeo vertical de 30 s |
| YouTube | 0 € (orgánico: Shorts y el canal) | el 16:9 con QR y el 9:16 con QR |

Total pagado: **20 €/día** (TikTok + Meta) más lo de Spotify si lo quieres. Se mira a los 3 días (tasa de enganche a
3 s con ≥2.000 impresiones por anuncio) y a los 7 (instalaciones y altas; lo que no trae nada, se apaga).
Si no confirmas, las campañas se dejan **creadas en pausa**.

## Ficheros (todos en `salida/`)

| Fichero | Tamaño | Para |
|---|---|---|
| `spot-dani-9x16-B.mp4` (1080×1920, 32,2 s) | 14 MB | TikTok, Reels, Historias, YouTube Shorts |
| `spot-dani-4x5-B.mp4` (1080×1350, 32,2 s) | 9 MB | feed de Facebook e Instagram |
| `spot-dani-9x16-B-30s.mp4` (1080×1920, 30,0 s justos) | 14 MB | Spotify Ad Studio (vídeo vertical) |
| `spot-dani-16x9-A-qr.mp4` (1920×1080, 32,2 s) | 9 MB | YouTube in-stream, pantallas de la nave |
| `spot-dani-9x16-A-qr.mp4` (1080×1920, 32,2 s) | 13 MB | YouTube Shorts con QR, flyer |

Las capas de IA son los planos de Artlist del gancho y del cierre: marcar **«Contenido generado por IA»** donde la
plataforma lo pida (TikTok y Meta lo piden).

## Enlaces (con atribución; `utm_content=spotdani` distingue este anuncio del de Puck)

Google Play directo (Play Console → Estadísticas → Adquisición separa por `referrer`):
- TikTok: `https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dtiktok%26utm_medium%3Dcpc%26utm_campaign%3Druta_hecha%26utm_content%3Dspotdani`
- Meta: `https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dfacebook%26utm_medium%3Dcpc%26utm_campaign%3Druta_hecha%26utm_content%3Dspotdani`
- Spotify: `https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dspotify%26utm_medium%3Dvideo%26utm_campaign%3Druta_hecha%26utm_content%3Dspotdani`
- YouTube/QR: el QR del vídeo ya lleva `utm_campaign=spot_ia`.

Alta web (iPhone y escritorio; el píxel mide «Registro completo»):
- Meta: `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=facebook&utm_content=spotdani`
- TikTok: `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=tiktok&utm_content=spotdani`

## Textos (el dinero primero, siempre con la condición al lado)

- **Meta, texto principal**: ¿Quieres 25 €? Completa tu primera ruta con FDS y son tuyos. Foto o escaneo a la etiqueta
  y la dirección entra sola; pulsa ordenar y tienes la ruta hecha, con la hora de cada parada; te lleva con voz hasta
  cada puerta. Empieza gratis y sin tarjeta. 20 entregas en 2 días, hasta el 31 de diciembre.
- **Meta, título**: Tu ruta de reparto, hecha sola · **Descripción**: Empieza gratis · 25 € con tu primera ruta.
- **TikTok (≤100 caracteres)**: ¿Quieres 25 €? Son tuyos con tu primera ruta en FDS. La ruta se hace sola. Empieza gratis.
- **Frase corta (imagen/portada)**: La app que te ayuda a repartir… y te paga 25 € por tu primera ruta.

Nunca «25 € gratis» a secas ni «te pagamos por repartir»: es un bono de bienvenida, una vez, con condición (primera
ruta: 20 entregas a direcciones distintas en 2 días, dentro de los 30 primeros días, alta hasta el 31-12).

## TikTok Ads Manager (ads.tiktok.com) — 9 clics

1. **Campaña → Crear**. Objetivo **Tráfico**. Nombre: `FDS · Spot Dani · Play (29-10)`. Presupuesto de campaña: no.
2. **Grupo de anuncios**: elegir el grupo de España que ya existe como base (`Ad group 20261004045045`) o crear uno:
   España · 20-55 · intereses *Express Deliveries* + *Logistics* · ubicación **solo TikTok** (desmarcar Pangle).
3. Presupuesto del grupo: **10 €/día** · puja automática · empieza mañana a las 06:00.
4. **Anuncio**: identidad la cuenta FDS · subir `salida/spot-dani-9x16-B.mp4`.
5. Texto: el de TikTok de arriba. Botón **«Descargar»**. URL: la de Play de TikTok de arriba.
6. Marcar **«Contenido generado por IA»**.
7. **Enviar** (Submit). Queda «En revisión»; si no has confirmado el gasto, pausa la campaña desde la lista.
8. A las 24 h: desglose por ubicación y CTR; en Play Console, los `referrer` de `tiktok`.
9. Si TikTok rechaza por «ingresos prometidos», cambiar el texto por el de «Frase corta» (lleva la condición).

## Meta Ads Manager (cuenta 934137992742194) — 10 clics

1. **Crear campaña** → objetivo **Tráfico** → nombre `FDS · Spot Dani · Play (29-10)` · presupuesto de campaña
   (Advantage): **10 €/día**.
2. **Conjunto Android**: España · 20-55 · ubicaciones Advantage+ · Configuración avanzada → **Dispositivos: solo
   Android** · destino la URL de Play de Meta de arriba. Nombre: `Android → Play`.
3. **Conjunto iPhone/escritorio**: duplicar el anterior · **Dispositivos: solo iOS** (y escritorio) · destino la URL de
   alta web de Meta. Nombre: `iPhone → alta web`.
4. **Anuncio** (en cada conjunto): identidad página FDs + Instagram fds.8689 · **Personalizar por ubicación**:
   `spot-dani-9x16-B.mp4` para Reels e Historias y `spot-dani-4x5-B.mp4` para el feed.
5. Texto principal, título y descripción: los de Meta de arriba. Botón **«Instalar ahora»** (Play) o **«Más
   información»** si no lo ofrece; en el conjunto web, **«Registrarte»**. Enlace visible: `flotadsp.com`.
6. **Apagar las mejoras de IA de Meta** (reescribe el texto y mete personas).
7. Marcar **«Etiqueta de IA»** si lo pide.
8. **Publicar desde el editor del anuncio** («Publicar»), nunca «Revisar y publicar (N)»: arrastra 3 borradores viejos,
   uno de tráfico a 35 €/día. Si no has confirmado el gasto: publicar y **pausar la campaña** en la lista.
9. Pausar el anuncio de la voz de Puck (24-10) cuando este esté en circulación, o dejarlos competir 3 días y quedarse
   con el de más altas por `utm_content`.
10. La **verificación de anunciante** (DNI) sigue pendiente: sin ella Meta no sirve en toda España. Hacerla hoy.

## Spotify Ad Studio (ads.spotify.com) — 8 clics

Sin API ni conector: a mano, mejor desde el móvil (el formulario fallaba desde el Chrome con extensión el 24-10).
1. **Crear campaña** → objetivo **Clics (visitas al sitio web)** → nombre `FDS · Spot Dani · vídeo`.
2. Formato: **Vídeo vertical** (Spotify Video). Subir `salida/spot-dani-9x16-B-30s.mp4` (30,0 s justos: empieza con la voz).
3. Público: España · 20-55 · **mañanas de lunes a sábado, 6-10 h** (cuando se carga la furgoneta) · intereses trabajo
   y conducción.
4. Anunciante **FDS** · botón **«Más información»** · URL la de Play de Spotify de arriba.
5. Presupuesto: el **mínimo** que pida al crear (lo dice en pantalla); fechas: una semana.
6. Enviar a revisión. Si no has confirmado el gasto, dejarla como borrador.
7. Alternativa de audio (si prefieres solo audio): `docs/anuncios/spotify/v4/fds-spotify-v4-play.mp3` con la imagen
   `docs/anuncios/app/1-ruta-sola-spotify-640.jpg` (ese audio NO dice los 25 €).
8. A los 7 días: Play Console → Adquisición → `referrer` de `spotify`.

## YouTube — 5 clics (gratis)

1. YouTube Studio → **Crear** → subir `salida/spot-dani-9x16-A-qr.mp4` como **Short**. Título: «¿Quieres 25 €? Te los
   damos por tu primera ruta con la app». Descripción: el texto de Meta + el enlace a Play (`utm_source=youtube`).
2. Subir `salida/spot-dani-16x9-A-qr.mp4` como vídeo normal (para in-stream y para las pantallas de la nave).
3. Marcar **«Contenido alterado o sintético»** (planos de IA).
4. Si quieres pagarlo: Google Ads → campaña de vídeo → in-stream saltable con el 16:9, España, 5 €/día.
5. El QR en SVG para el flyer: `../super-anuncio/qr-play-fds-spot.svg`.

## Medir (3 y 7 días)

- Play Console → Estadísticas → Adquisición: instalaciones por `referrer` (tiktok, facebook, spotify, youtube, qr).
- `/panel/analitica` y `analitica_eventos`: altas por `utm_content=spotdani` (alta web).
- Decidir por instalaciones y altas, nunca por visitas ni «me gusta». Lo que no trae nada en 7 días, se apaga.
