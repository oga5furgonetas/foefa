# La tarea programada «Redes FDS»

## Cómo se crea (Dani, desde claude.ai)

Las tareas creadas desde DENTRO de una sesión no llevan ni el repositorio ni los conectores: se probó dos veces
el 29-10 (la sesión que abrían clonaba el repo pero no podía hacer push, y no veía ningún conector), así que esa
tarea se borró. Hay que crearla desde la pantalla de tareas programadas de claude.ai con:

- **Entorno:** el de Flota en la nube. **Repositorio:** `oga5furgonetas/foefa`. **Conector:** Metricool.
- **Horario:** 7:51, 12:51 y 19:51 hora de Madrid (`CRON_TZ=Europe/Madrid 51 7,12,19 * * *`).
- **Instrucciones:** el texto corto de abajo, tal cual.
- **Avisos al móvil:** solo con novedades.

## Texto corto para la tarea (copiar tal cual)

```
Eres el community manager de FDS, la app gratuita de reparto de Flota. Ponte en la rama claude/trusting-feynman-0tfz62 (git fetch origin && git checkout claude/trusting-feynman-0tfz62 && git pull origin claude/trusting-feynman-0tfz62), lee docs/anuncios/redes/TAREA.md y haz la ronda exactamente como dice ahí, con el conector Metricool. Al acabar, apunta la ronda en el Registro de docs/anuncios/REDES.md y haz push a esa misma rama. Nunca publiques como un usuario anónimo, nunca inventes cifras, y sin conector no publiques nada.
```

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
3. **Qué toca en cada ronda** (hora de Madrid). Antes de nada, mira lo ya programado (la herramienta de
   publicaciones programadas de Metricool) y el Registro de REDES.md para no duplicar.
   - **7:51** → LinkedIn si es martes (texto del apartado 8 de REDES.md, enlace a /planes con utm). YouTube si es
     jueves o domingo: un Short con un vídeo de `docs/videos/` (`shorts-es*.mp4`, `tiktok-es*.mp4`) y la
     descripción de `docs/anuncios/tiktok/DESCRIPCION.txt` o del calendario, con «flotadsp.com/repartidores» y utm
     de youtube. Si la herramienta deja leer y responder comentarios de nuestras publicaciones, contéstalos con las
     plantillas del apartado 7 (nunca el mismo texto dos veces; nunca discutir).
   - **12:51** → Instagram a las 13:00: la pieza del día del calendario (un carrusel de imágenes va como publicación
     de varias fotos; un vídeo, como reel), con el texto y hashtags de TEXTO.md o del calendario. Facebook página
     igual, si está enlazada.
   - **19:51** → TikTok a las 20:00: la pieza del día del calendario (vídeo, o carrusel en modo foto con sus
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
