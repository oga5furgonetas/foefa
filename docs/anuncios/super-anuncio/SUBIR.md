# «La ruta hecha»: todo a punto para subir (29-10-2026)

Dani: «súbelo a TikTok, Facebook Ads y Spotify Ads, o déjamelo a punto; que se descargue directo desde Google Play;
y el bono: 25 € si completan su primera ruta». Desde esta sesión no hay acceso a tu Chrome (ni extensión ni
Remote Control), así que aquí está cada plataforma con los ficheros, los textos y los pasos en orden. Publicar lo
pulsas tú; es gasto.

**Antes de publicar, dos cosas que tienen que estar en producción:**
1. El bono de bienvenida a **25 €** (antes 10 €): `frontend/src/lib/precios.js` (`BONO_CENT`), `backend/server.py`
   (`_BONO_CENT`) y los Términos. Está en la rama `claude/sweet-brown-i5ukdc`; hay que desplegar backend y web
   (`docs/ESTADO.md` → «Cómo desplegar») ANTES de que corra un anuncio que lo promete. Condiciones (Términos):
   20 entregas a direcciones distintas, en 2 días distintos, dentro de los primeros 30 días; alta hasta el 31-12;
   una vez por persona.
2. Los vídeos: `salida/spot-ruta-9x16-B.mp4` (móvil), `spot-ruta-4x5-B.mp4` (feed), `spot-ruta-16x9-A-qr.mp4`
   (YouTube/pantallas). Si se regraba con el mapa real y la voz de España (GENERADO.md), sustituir por los nuevos.

## Enlaces (con atribución)

- **Google Play directo** (lo que pidió Dani; Play Console → Adquisición distingue cada campaña por `referrer`):
  - TikTok: `https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dtiktok%26utm_medium%3Dcpc%26utm_campaign%3Druta_hecha`
  - Meta: `https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dfacebook%26utm_medium%3Dcpc%26utm_campaign%3Druta_hecha`
  - Spotify: `https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dspotify%26utm_medium%3Daudio%26utm_campaign%3Druta_hecha`
  - YouTube/QR: el del vídeo (`utm_campaign=spot_ia`).
  Ojo: con destino Play, Meta y TikTok **no ven la conversión** (el alta pasa dentro de la app, sin píxel), así que
  optimizan a clics, no a registros; y en iPhone el enlace de Play no sirve. Por eso el conjunto de iPhone (o el
  anuncio para todos) va al alta web:
- **Alta web** (lo que ya da altas a ~2 €; el píxel mide «Registro completo»):
  `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=facebook&utm_content=rutahecha`
  (TikTok: `utm_source=tiktok`). Tras el alta, la web ofrece instalar la app.
  Recomendación: **dos conjuntos**: Android → Play directo; iPhone y escritorio → alta web. Se comparan a los 7 días.

## Textos (verdades: todo lo que dicen lo hace la app hoy; el bono, al desplegar)

Texto principal (Meta, 125 caracteres visibles antes de «ver más»; TikTok ≤100 en el campo «texto»):
> **Meta**: ¿Repartes paquetes? Foto o escaneo a la etiqueta y la dirección entra sola. Pulsa ordenar y tienes la
> ruta hecha, con la hora de cada parada y las zonas de carga y descarga en el mapa. Te lleva con voz hasta cada
> puerta. Y al completar tu primera ruta, **25 € en tu cartera**. Sirve igual si repartes para una agencia, una
> plataforma o un súper. Empieza gratis y sin tarjeta.
> **TikTok** (≤100): Foto o escaneo a la etiqueta y la ruta se hace sola. 25 € con tu primera ruta. Empieza gratis.
> **Frase corta para imagen/portada**: La app que te ayuda a repartir… y te paga 25 € por tu primera ruta.

Título (Meta): «Tu ruta de reparto, hecha sola» · Descripción: «Empieza gratis · 25 € con tu primera ruta».
Botón: con destino Play, «Instalar ahora» si Meta lo ofrece en la campaña; si no, «Más información». Con destino
web, «Ver detalles» (clientes potenciales) o «Registrarte». Enlace visible: `flotadsp.com`.

No decir «la app que te paga por repartir» a secas: es un bono de bienvenida, una vez, con condiciones; dicho así
Meta lo tumba por «ingresos prometidos» y un repartidor se siente engañado. «Te paga 25 € por tu primera ruta» es
verdad y vende igual.

## TikTok Ads (Ads Manager → Campaña)

1. Objetivo **Tráfico** (destino Play) o **Conversiones en web** con el píxel «Flota web» y el evento Registro
   completo (destino alta web). Nombre: «FDS · Ruta hecha · Play (29-10)».
2. Grupo: España, 20-55, intereses Express Deliveries + Logistics (el grupo ES que ya existe, `Ad group
   20261004045045`); ubicación solo TikTok (desmarcar Pangle si deja); presupuesto 20 €/día; puja automática.
3. Anuncio: subir `spot-ruta-9x16-B.mp4` (10 MB, 1080×1920). Texto TikTok de arriba. Botón «Descargar» (Play) o
   «Registrarse» (web). Marcar **«Contenido generado por IA»** (gancho y cierre llevan planos de IA). URL de Play con
   `utm_source=tiktok`.
4. Identidad: la cuenta FDS. Publicar lo pulsas tú (Submit). A las 24 h: mirar el desglose por ubicación y el CTR.
   En Play Console → Adquisición, los `referrer` de tiktok.

## Facebook / Instagram (Administrador de anuncios, cuenta 934137992742194)

1. Campaña nueva **«FDS · Ruta hecha · Play (29-10)»**, objetivo **Tráfico** (destino Play), o duplicar la de
   registros «FDS Registros — Gratis 15 paradas — ES» (clientes potenciales, evento Registro completo) con el
   anuncio nuevo y destino web. Presupuesto 20 €/día (el que está).
2. Conjunto Android: España, 20-55, ubicaciones Advantage+, **dispositivos: solo Android** (Configuración avanzada
   → Dispositivos), destino la URL de Play con `utm_source=facebook`. Conjunto iPhone: solo iOS, destino alta web.
3. Anuncio: `spot-ruta-9x16-B.mp4` para Reels/Historias y `spot-ruta-4x5-B.mp4` para el feed («personalizar por
   ubicación»). Texto principal, título, descripción y botón de arriba. Identidad: página FDs + Instagram
   fds.8689. **Sin mejoras de IA de Meta** (reescribe el texto y mete personas con la app). Marcar «Etiqueta de IA»
   si lo pide.
4. Publicar desde el editor del anuncio («Publicar»), nunca «Revisar y publicar (N)» (arrastra 3 borradores viejos,
   uno de tráfico a 35 €). Pausar el anuncio de Puck del 24-10 cuando este esté en circulación, o dejarlos competir
   3 días y quedarse con el que tenga más altas por `utm_content`.
5. Verificación de anunciante (documento de identidad): sigue pendiente; sin ella Meta no sirve en toda España.

## Spotify Ad Studio (ads.spotify.com)

No tiene API ni acceso desde aquí: se sube a mano desde el móvil (desde el Chrome con extensión fallaba el
formulario el 24-10).
1. Nueva campaña, objetivo «Clics» / visitas al sitio web. Nombre «FDS · Ruta hecha · audio».
2. Público: España, 20-55, mañanas de lunes a sábado (6-10 h, cuando se carga la furgoneta); intereses trabajo /
   conducción.
3. Anuncio de audio: `docs/anuncios/spotify/v4/fds-spotify-v4-play.mp3` (dice «Búscala en Google Play: FDS
   Reparto»), imagen `docs/anuncios/app/1-ruta-sola-spotify-640.jpg`, anunciante «FDS», botón «Más información»,
   URL de Play con `utm_source=spotify`. Si Dani quiere el bono en el audio, hay que regrabar la locución (28 s,
   ≤65 palabras): «…y al completar tu primera ruta, 25 euros en tu cartera».
4. Presupuesto: el mínimo que pida Spotify (lo dice al crear). Vídeo vertical (Spotify Video): `spot-ruta-9x16-A-qr.mp4`.

## YouTube (Shorts e in-stream)

Shorts: `spot-ruta-9x16-A-qr.mp4`, enlace a Play del vídeo. In-stream 16:9: `spot-ruta-16x9-A-qr.mp4`. Pantallas
de la nave y flyer: el 16:9 o el 9:16 con QR; el QR en SVG está en esta carpeta.

## Medir (a los 3 y 7 días)

- Play Console → Estadísticas → Adquisición: instalaciones por `referrer` (tiktok, facebook, spotify, qr).
- `/panel/analitica` y `analitica_eventos`: altas por `utm_content=rutahecha` (alta web).
- Decidir por instalaciones y altas, nunca por visitas ni «me gusta». Lo que no trae nada en 7 días, se apaga.
