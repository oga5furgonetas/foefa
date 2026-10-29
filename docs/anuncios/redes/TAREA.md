# La tarea programada «Redes FDS»

## Cómo está montada (29-10-2026, noche)

- Las tareas que abren una sesión NUEVA no sirven: esa sesión no tiene el repo con permiso de push y, en esta
  organización, tampoco se le pueden pasar conectores (probado tres veces el 29-10). Por eso la tarea **despierta la
  sesión en la nube que ya tiene Metricool, el repo y Artlist** (`session_016pE6fk3GgMPorT2VC6UMhQ`) tres veces al día:
  7:51, 12:51 y 19:51 hora de Madrid (`CRON_TZ=Europe/Madrid 51 7,12,19 * * *`). Dani no tiene que crear nada en
  «Programadas».
- Metricool: marca `7741371`, zona horaria `Europe/Madrid`. Enlazado el 29-10 por Dani: TikTok Business `flotadsp`,
  Instagram `flotadsp`, LinkedIn (página FlotaDSP) y YouTube. **X no** (en Metricool es de pago); **Facebook** aún no.
- Mejores horas según Metricool (29-10): TikTok 10:00, 12:00 y 18:00 (el pico de la tarde es a las 18:00, no a las
  20:00); por eso TikTok se programa a las **18:00**. Instagram a las **12:00**. LinkedIn los martes por la mañana.
- Las imágenes se sirven en `https://flotadsp.com/redes/<fichero>.png` solo cuando la web se despliega con
  `frontend/public/redes/` (rama mezclada en `main` y `wrangler pages deploy`). Hasta entonces Metricool las rechaza
  («Failed to normalize media») y solo se puede programar LinkedIn (texto + enlace). Los vídeos de `docs/videos/` no
  tienen URL pública: para TikTok y YouTube hay que copiarlos también a `frontend/public/redes/` (o subirlos a mano a
  Metricool) antes de programarlos.
- Para pararla: desde una sesión, «desactiva la tarea programada Redes FDS», o en «Programadas» de claude.ai.

## La ronda, paso a paso (esto es lo que sigue la sesión que abre la tarea)

0. **Rama y ficheros.** Ya estás en `claude/trusting-feynman-0tfz62`; haz `git merge --no-edit origin/main` (si da
   conflicto, `git merge --abort` y sigue). Solo se tocan `docs/anuncios/REDES.md`, `docs/anuncios/redes/`,
   `frontend/public/redes/` y `scripts/redes-fotos.mjs`. Ni `docs/ESTADO.md` ni código de la app. Todo se sube con
   commit y push a esa rama, nunca a otra.
1. **Lee entero** `docs/anuncios/REDES.md` (reglas, oferta vigente, enlaces con utm, calendario, plantillas,
   registro) y `docs/anuncios/redes/TEXTO.md`. La regla 1 no se rompe nunca: se publica como FDS, jamás como un
   usuario anónimo ni con cuentas falsas; nada de cifras de usuarios inventadas, testimonios ni reseñas; no se
   nombran otras apps de rutas ni Amazon; la oferta es exactamente la del apartado 3 de REDES.md.
2. **Cuentas en Metricool** (enlazadas por Dani el 29-10): TikTok Business `flotadsp`, Instagram `flotadsp`,
   LinkedIn página FlotaDSP, YouTube FlotaDSP. **X no está** (en Metricool es de pago): los posts de X del
   calendario se saltan salvo que la sesión tenga un conector de X. **Facebook** (página FDs): solo si Dani la
   enlaza en Metricool; mientras, se salta.
3. **Qué toca en cada ronda** (hora de Madrid). Antes de nada, mira lo ya programado (getScheduledPosts, de hoy a
   tres semanas vista) y el Registro de REDES.md para no duplicar. Lo mejor es dejar programados los 7 días
   siguientes en cada ronda, no una pieza por ronda: cada ronda rellena los huecos de la semana que viene.
   - **7:51** → LinkedIn si es martes (texto del apartado 8 de REDES.md, enlace a /planes con utm). YouTube si es
     jueves o domingo: un Short con un vídeo de `docs/videos/` (`shorts-es*.mp4`, `tiktok-es*.mp4`) y la
     descripción de `docs/anuncios/tiktok/DESCRIPCION.txt` o del calendario, con «flotadsp.com/repartidores» y utm
     de youtube. Si la herramienta deja leer y responder comentarios de nuestras publicaciones, contéstalos con las
     plantillas del apartado 7 (nunca el mismo texto dos veces; nunca discutir).
   - **12:51** → Instagram a las 12:00 del día siguiente (o de hoy si aún no ha pasado): la pieza del día del calendario (un carrusel de imágenes va como publicación
     de varias fotos; un vídeo, como reel), con el texto y hashtags de TEXTO.md o del calendario. Facebook página
     igual, si está enlazada.
   - **19:51** → TikTok a las 18:00 del día siguiente: la pieza del día del calendario (vídeo, o carrusel en modo foto con sus
     imágenes en orden), texto y hashtags de TEXTO.md o del calendario, y el comentario fijado si lo hay.
   - **Imágenes:** URL pública `https://flotadsp.com/redes/<fichero>.png` (comprueba con `curl -sI` que da 200; si
     da 404 la web aún no se ha desplegado con ellas: intenta subir el fichero de `frontend/public/redes/`
     directamente si la herramienta lo admite; si no, apúntalo y no publiques esa pieza). **Vídeos:** ficheros de
     `docs/videos/` (sin URL pública: súbelos si la herramienta lo admite; si no, apúntalo).
   - Programa a la hora del calendario; la «mejor hora» de Metricool solo para moverla dentro de ±1 h.
   - **Si no hay conector:** no publiques en ningún sitio ni lo simules. Prepara como mucho UNA pieza nueva
     (`cd frontend && node ../scripts/redes-fotos.mjs` con una idea del final de TEXTO.md, y su texto en TEXTO.md)
     solo si hay menos de 6 piezas sin publicar.
4. **Lunes a las 7:51:** analíticas de la semana anterior por red (seguidores, alcance, visitas al perfil) con la
   herramienta de analíticas de Metricool, y las altas por `utm_source` si tienes `MONGO_URL` (no la tendrás:
   entonces solo lo de Metricool). Apúntalo en el Registro.
5. **Cuando el calendario de 14 días esté publicado entero**, escribe en REDES.md las dos semanas siguientes con el
   mismo formato y tono (una idea distinta por día, contenido que sirve o hace reír, la app solo al final).
6. **Registro, commit y push.** Una línea en el Registro de REDES.md (fecha y hora, red, qué, resultado).
   `git add docs/anuncios frontend/public/redes scripts/redes-fotos.mjs && git commit -m "Redes FDS: ronda <fecha hora>" && git push origin claude/trusting-feynman-0tfz62`
   (si el push falla por red, 3 reintentos con 2, 4 y 8 segundos).
7. **Límites.** Nada de gasto: sin anuncios; créditos de Artlist solo si la sesión tiene Artlist y la pieza lo
   necesita, máximo 2 imágenes por ronda (si la red del entorno no deja bajarlas, apúntalo y no insistas). Nunca
   borres publicaciones ni cambies la bio o los enlaces de las cuentas. Mensajes privados, ninguno. Aviso al móvil
   de Dani SOLO si se ha publicado algo o hay un fallo nuevo que no esté ya en el Registro. Si algo falla,
   apúntalo y termina; no improvises.
8. **Termina con dos líneas:** qué se ha publicado o preparado (y por qué no, si es el caso) y qué queda
   pendiente de Dani.
