# Redes de FDS: manual del community manager (29-10-2026)

> Dani (29-10): «coge mi Twitter, mi TikTok y mi Facebook y haz de manager: genera interacciones, busca hilos,
> métete en conversaciones, que la gente nos conozca, nos siga y acabe descargando la app».
> Este fichero es el manual que sigue cualquier sesión que haga una ronda de redes. Al acabar cada ronda,
> apuntarla en el «Registro» del final y `git push`.

## 1. La regla que manda: siempre a cara descubierta

Se contesta **como FDS** (desde la cuenta de la app) o **como Dani** («la hice yo»). Nunca como un usuario
anónimo que «descubre» la app («wow, yo uso esta aplicación»). Por qué, en orden de importancia:

1. Es una práctica comercial desleal prohibida en toda la UE: hacerse pasar por consumidor o esconder que se
   habla por cuenta de la empresa (Directiva 2005/29/CE, anexo I, punto 22; Ley 3/1991 de Competencia Desleal,
   art. 27; LSSI art. 20, la publicidad tiene que ser identificable). Multa y, peor, titular.
2. X, TikTok y Meta lo tratan como manipulación de la plataforma (cuentas falsas, interacción falsa). Cierran
   la cuenta y con ella el único canal orgánico que tenemos.
3. Se descubre siempre (mismo texto, misma hora, cuenta sin vida), y una app con 30 usuarios reales solo tiene
   una cosa que vender: que se puede confiar en ella.
4. No hace falta. «Soy el que la hizo, dime qué le falta» convierte mejor que un anuncio: la gente contesta a
   una persona, no a una marca. Ya es la regla del proyecto desde el 05-10 (`CANALES.md`: «decir siempre que la
   app es nuestra»; `reales/GUIONES.md`: «nada de testimonios inventados»).

Lo demás que tampoco se hace: inventar cifras («miles de repartidores»), reseñas o testimonios; nombrar otras
apps de rutas ni a Amazon; mensajes privados sin que lo pidan (LSSI); el mismo texto dos veces; discutir con
quien critica. Admitir fallos («si una etiqueta no la lee, la escribes tú») da más confianza que prometerlo todo.

## 2. Las cuentas y cómo se llega a ellas

| Red | Cuenta | Para qué | Cómo se opera |
|---|---|---|---|
| X | @FlotaDSP (Premium) | Hilos de repartidores y autónomos; un post al día | Responder en hilos: navegador con la sesión de Dani (Claude en Chrome desde su PC). Publicar: también desde la nube con un conector de programación (Metricool o Typefully) |
| TikTok | la cuenta de FDS (bio: «Gratis: flotadsp.com/repartidores») | Comentar vídeos de repartidores; un vídeo o carrusel al día a las 20:00 | Comentar: solo navegador. Publicar: navegador o Metricool |
| Facebook | página «FDs» (+ Instagram fds.8689) y perfil de Daniel para los grupos | Grupos de paquetería (ES, PT, LatAm); página 3 veces por semana | Grupos: solo el perfil de Daniel desde su navegador (`grupos-latam.md`). Página: navegador o Metricool |
| LinkedIn | página FlotaDSP | Flota para empresas (no FDS), un post por semana | Navegador o Metricool/Typefully |
| YouTube Shorts | la cuenta de Dani | Donde se suben los mismos vídeos de TikTok | Navegador |

**Metricool (29-10, enlazado por Dani):** TikTok Business `flotadsp`, Instagram `flotadsp`, LinkedIn página FlotaDSP y
YouTube FlotaDSP. X no (en Metricool es de pago) y la página de Facebook aún no. Es el conector con el que publica la
tarea programada (`redes/TAREA.md`).

**Lo que no existe:** ningún conector permite buscar hilos ajenos y responder en X, TikTok o Facebook. Eso solo
se hace con el navegador de Dani con sus sesiones abiertas (como se hizo el 24-10: «gestiona todas mis cuentas
profesionales», memoria `redes-sociales-fds`). Desde una sesión en la nube se puede PUBLICAR (con un conector) y
preparar todo lo demás; las rondas de respuestas se hacen desde una sesión en el PC. La API de X que permite
buscar cuesta 200 $ al mes: no compensa con el presupuesto a cero.

## 3. Lo que se puede decir (la oferta de hoy, nada más)

- **Gratis y sin límite hasta el 31-12-2026, sin tarjeta.** Después: gratis para siempre hasta 15 paradas al día,
  o sin tope por 9,99 €/mes o 99 €/año, cancelable desde la app (`lib/precios.js`, `Repartidores.jsx`).
- **25 € de bienvenida** a la cartera al hacer la primera ruta real: 20 entregas reales en 2 días distintos (desde el 29-10; antes 10 €, `lib/precios.js` BONO_CENT).
- **Invita y gana:** 10 € por cada compañero que se registre con tu enlace y haga esa primera ruta real
  (promoción para altas hasta el 31-12; después 2,50 €). Bizum en España, PayPal fuera.
- **Qué hace:** foto a la etiqueta o escaneo del código y la dirección entra sola; ordena las paradas por tiempo
  (con el tráfico típico de la hora); te lleva con voz hasta cada puerta; manos libres en Android («entregado»,
  «siguiente», «llamar»); entregado en un toque con dónde lo dejas, quién recoge y firma; cobros (efectivo,
  tarjeta, Bizum) con foto; WhatsApp al cliente con un toque; «Mi dinero hoy» (ganado, gasolina, neto por hora)
  en la moneda de cada país; sin cobertura abre con la ruta guardada y envía lo entregado al volver la red;
  paradas de días anteriores y direcciones que ya conoces (25-10).
- **Dónde:** Android en Google Play (prueba abierta; si a alguien no le abre el enlace, flotadsp.com/app) e
  iPhone en flotadsp.com/app. Prueba sin cuenta con paradas de ejemplo en tu ciudad.
- **Quiénes somos:** un equipo pequeño de España; Dani lleva años en el reparto y tiene su propia flota.
  Usuarios reales hoy: unas pocas decenas. Se dice así cuando lo preguntan.

## 4. Enlaces (siempre con utm, uno distinto por sitio)

```
Repartidores:  https://flotadsp.com/repartidores?utm_source=<red>&utm_medium=organico&utm_campaign=rep_comunidad&utm_content=<qué>
Calculadora:   https://flotadsp.com/calculadora-repartidor?utm_source=<red>&utm_medium=organico&utm_campaign=rep_comunidad&utm_content=calculadora
Invita y gana: https://flotadsp.com/invita?utm_source=<red>&utm_medium=organico&utm_campaign=rep_comunidad&utm_content=invita
Empresas:      https://flotadsp.com/planes?utm_source=linkedin&utm_medium=organico&utm_campaign=empresas&utm_content=<qué>
```

`<red>` = `x`, `tiktok`, `facebook`, `linkedin`, `youtube`. `<qué>` = `hilo` (respuesta en un hilo ajeno), `post`
(publicación propia), `grupo_<nombre>`, `calculadora`, `invita`. En TikTok los comentarios no admiten enlaces: se
dice «enlace en el perfil» (el del perfil ya lleva `utm_campaign=perfil`). En X, el enlace va en una segunda
respuesta o solo si lo piden: el primer mensaje sin enlace llega a más gente.

## 5. La ronda diaria (25-30 minutos, una al día; dos si hay comentarios que contestar)

1. **Lo nuestro primero (5 min).** Contestar todos los comentarios de nuestros vídeos y posts de las últimas 24 h.
   En TikTok, la primera hora tras publicar es la que decide el alcance.
2. **X (10 min).** Tres búsquedas de la lista (apartado 6), 5-8 respuestas útiles (tope 10 al día), seguir a
   5-10 cuentas de repartidores o del sector que hayan escrito hoy (tope 20). Publicar el post del calendario.
3. **TikTok (10 min).** Buscar los términos del apartado 6 y entrar en «Recientes»: 8-12 comentarios en vídeos
   de repartidores (tope 15), sin enlace, que aporten o hagan reír. Publicar lo del calendario a las 20:00.
4. **Facebook (5 min).** 2-3 comentarios en los grupos donde ya estamos; página según calendario; UN grupo nuevo a
   la semana (leer sus normas antes; si prohíbe la autopromoción, no se publica; si borran, no se insiste).
5. **Apuntar la ronda** en el «Registro» de abajo: red, hilo, qué se dijo, qué pasó.

Proporción 3 a 1: de cada cuatro intervenciones, tres no mencionan la app (consejo, pregunta, broma del oficio) y
una sí. Si la cuenta solo habla de sí misma, las plataformas la enseñan menos y la gente la bloquea.

Lo que no se toca: hilos de accidentes, política, huelgas o peleas riders-plataformas (ahí no se vende nada; a lo
sumo un comentario humano sin la app), ni hilos en otro idioma que no sepamos sostener (inglés sí; el resto, con
el texto en su idioma del apartado 8 de `grupos-latam.md`).

## 6. Dónde están las conversaciones

**X (búsqueda avanzada, español, sin retuits):**
```
(repartidor OR repartidora OR mensajero) ruta lang:es -filter:retweets
"amazon flex" (ruta OR paradas OR bloque) lang:es -filter:retweets
(paquetería OR paqueteria) (paradas OR furgoneta OR "primer día") lang:es -filter:retweets
"repartidor autónomo" OR "repartidora autónoma" OR "mensajero autónomo" lang:es
"cuánto gana un repartidor" OR "cuanto gana un repartidor" OR "cuánto cobra un repartidor"
(contrareembolso OR contrarreembolso) (repartidor OR paquete OR mensajero) lang:es
"ordenar la ruta" OR "organizar la ruta" OR "optimizar la ruta" (reparto OR paquetes) lang:es
#repartidor OR #repartidores OR #paqueteria OR #ultimamilla OR #mensajeria -filter:links
```
Cuentas que conviene seguir y leer a diario: medios de logística y última milla, asociaciones de autónomos (ATA,
UPTA), cuentas de repartidores que cuentan su día, sindicatos de riders (leer, no vender).

**TikTok (barra de búsqueda → «Recientes», y los hashtags):** `repartidor`, `día de repartidor`, `un día conmigo
repartiendo`, `amazon flex españa`, `repartidor de paquetería`, `ruta de reparto`, `primer día repartiendo`,
`mensajero autónomo`, `furgoneta de reparto`; en portugués `estafeta`, `entregas`; en LatAm `repartidor mercado
libre`, `mensajero`, `motorizado`. Hashtags: #repartidor #repartidores #paqueteria #mensajeria #ultimamilla
#furgoneta #autonomos #reparto #amazonflex.

**Facebook:** los grupos de `CANALES.md` (España/PT) y `grupos-latam.md` (MX, AR, CO, BR). Dentro de cada grupo,
buscar «ruta», «app», «orden», «cuántas paradas», «primer día»: ahí están las preguntas que podemos contestar.

**Reddit (solo con el perfil de Dani y diciendo que es suya):** r/Autonomos, r/spain y r/es en hilos de
repartidores; r/Portugal. Muchos prohíben la promoción: se contesta a la pregunta y la app se nombra solo si
viene a cuento.

## 7. Qué se contesta (plantillas; cambiar siempre las palabras, nunca pegar igual dos veces)

1. **Se queja de perder la mañana ordenando la ruta.** Primero el consejo, luego quiénes somos.
   > Lo que a nosotros nos cambió la mañana: ordenar al cargar, no al salir. Y si quieres que lo haga la app, la
   > nuestra (FDS, la hicimos nosotros) ordena por tiempo con una foto a la etiqueta. Gratis hasta el 31-12. Si la
   > pruebas, dime qué le falta.
2. **Pregunta qué app de rutas usar.** Sin nombrar otras: las de pago rondan los 15-20 € al mes.
   > Depende de cuántas paradas hagas. Las de pago van por 15-20 € al mes. La nuestra es gratis sin límite hasta el
   > 31-12 y después gratis hasta 15 paradas al día (quien hace 100 paga 9,99). Soy parte interesada: la hicimos
   > nosotros, así que pruébala y critícala.
3. **Pregunta cuánto se gana repartiendo.** Enlace a la calculadora (no vende nada).
   > Hicimos una calculadora para eso, sin registro: metes paradas, tarifa y gasolina y te da el neto por hora.
   > [calculadora]. Si tus números no cuadran con los suyos, dímelo y la ajustamos.
4. **Primer día repartiendo.**
   > Tres cosas que nadie te dice: el orden de carga importa más que el de la ruta; el que no abre a las 9 abre a las
   > 14; aparca una vez para tres entregas. Lo demás se aprende en una semana. Suerte.
5. **Le llama el cliente y no encuentra el paquete.**
   > Clásico. Lo que nos salvó: cada parada con su bulto y su teléfono, y un botón que le manda «llego en 10 min»
   > por WhatsApp. Lo tiene nuestra app (FDS); si usas otra, busca que lo haga.
6. **Cobros contrarreembolso a boli.**
   > Apunta importe, forma de pago y foto en el momento; al final del día, cuentas claras. FDS lo hace así (es
   > nuestra); si lo llevas en papel, al menos foto al papel cada tarde.
7. **«¿Y dónde está el truco de que sea gratis?»**
   > Ninguno escondido: hasta el 31-12 gratis sin límite; después gratis hasta 15 paradas al día, y quien reparte
   > 100 paga 9,99 al mes. Lo decimos ya para que nadie se lleve sorpresas.
8. **Crítica a FDS (algo no funciona, no le gustó).**
   > Gracias por decirlo. ¿Qué etiqueta/zona era? Lo miramos hoy y te cuento. (Y se mira de verdad y se contesta.)
   Nunca se discute, nunca se borra un comentario que no sea insulto o spam.
9. **Desde Latinoamérica.**
   > Funciona en cualquier país y «Mi dinero hoy» sale en tu moneda (en Brasil, Pix). Pruébala con paradas de
   > ejemplo en tu ciudad y dinos qué le falta allí: lo arreglamos.
10. **Pide descargarla.**
    > Android: Google Play (FDS) o flotadsp.com/app. iPhone: flotadsp.com/app. Sin tarjeta.

Como Dani (perfil personal, grupos, Reddit): las mismas, en primera persona («llevo años repartiendo y la hice
yo»). Como @FlotaDSP o la cuenta de TikTok: «la hicimos nosotros».

## 8. Calendario: 14 días listos (del 30-10 al 12-11)

Hora: X por la mañana (7:30-8:30, antes de cargar) o 21:00; TikTok a las 18:00 (pico según Metricool; antes se decía 20:00); Instagram y Facebook página a las 12:00.
Las piezas de vídeo y foto ya existen (`docs/videos/`, `docs/anuncios/tiktok-fotos/`, `reales/salida/tiktok/`,
`reales/salida/spot-v5-*-puck-web.mp4` en el PC de Dani) y las nuevas del 29-10 en `docs/anuncios/redes/` (tres
carruseles y cuatro tarjetas para X, textos en `redes/TEXTO.md`, generador `scripts/redes-fotos.mjs`). Dani no graba
vídeos (29-10): el material lo hace la sesión, una pieza nueva por ronda cuando haga falta.

| Día | X (@FlotaDSP) | TikTok (18:00) e Instagram (12:00) | Facebook página |
|---|---|---|---|
| J 30-10 | ¿Cuánto tardas cada mañana en ordenar la ruta? Nosotros, 40 minutos con 60 paquetes y una libreta. Por eso hicimos FDS: foto a la etiqueta, la dirección entra sola y las paradas se ordenan por tiempo. Gratis y sin límite hasta el 31-12. | Sketch FDS-1 «¿Aún repartes a ojo?» · «¿Tú también repartes a ojo? Foto a la etiqueta → ruta ordenada → voz hasta la puerta. Gratis hasta el 31-12, enlace en el perfil» · comentario fijado: «¿Cuántas paradas haces un día normal? Nos sirve para saber para quién vale» | Texto largo de `app/TEXTOS.md` + `app/1-ruta-sola-4x5.png` |
| V 31-10 | [imagen `redes/X-primer-dia.png`] Lo que nadie te cuenta al empezar a repartir: 1) el orden de carga importa más que el de la ruta; 2) el que no abre a las 9 abre a las 14; 3) aparca una vez para tres entregas. ¿Cuál añadirías? (sin enlace) | Carrusel «5 trucos para acabar antes la ruta» (`tiktok-fotos/1-portada…7-la-app`, texto de su `TEXTO.md`) | — |
| S 01-11 | Pregunta a quien reparte: ¿cuántas paradas haces un día normal? En Flex 40-60, en paquetería 100-150. Lo preguntamos porque el plan gratis de FDS da 15 al día para siempre y queremos saber para quién vale. | `tiktok-es-llama.mp4` · «Te llama el cliente y tú buscando el paquete 😅 Cada parada con su bulto y su WhatsApp con un toque. Gratis hasta el 31-12, enlace en el perfil» | — |
| D 02-11 | [imagen `redes/X-truco.png`] «¿Y dónde está el truco?» nos preguntan. Ninguno: hasta el 31-12 gratis sin límite; después gratis hasta 15 paradas al día, y quien reparte 100 paga 9,99 €/mes. Lo decimos ya para que nadie se lleve sorpresas. Somos un equipo pequeño y la app es nuestra. | Carrusel A «Lo que nadie te cuenta del primer día» (`redes/A-1…A-7`, texto en `redes/TEXTO.md`) | — |
| L 03-11 | Te llama el cliente y estás buscando su paquete entre 80. En FDS cada parada tiene su bulto, su teléfono y un botón de WhatsApp («llego en 10 min»). Hecho por quien ha pasado por eso. | Spot v5 (voz de Puck) 9:16 · «La ruta se ordena sola. Gratis y sin límite hasta el 31-12, sin tarjeta. Android e iPhone, enlace en el perfil» | «¿Dónde está el truco?» (texto del domingo, versión larga) + `app/2-voz-4x5.png` |
| M 04-11 | [imagen `redes/X-cuanto-gana.png`] Si eres autónomo y repartes, ¿sabes cuánto ganas por hora después de la gasolina? Hicimos una calculadora gratis, sin registro: [calculadora, utm_content=calculadora] | `tiktok-es-cobro.mp4` · «Cobros en mano y cuentas a boli… se acabó: importe, forma de pago y foto en la misma app. Gratis hasta el 31-12» | — |
| X 05-11 | [imagen `redes/X-manos-libres.png`] Manos libres en Android: dices «entregado» y «siguiente» sin soltar el volante. Lo hicimos porque mirar el móvil con la furgoneta en marcha es multa y es peligroso. | Carrusel B «7 frases que todo repartidor ha oído» (`redes/B-1…B-9`, texto en `redes/TEXTO.md`) | Calculadora (texto del martes) + `tiktok-fotos/funciones-4x5.png` |
| J 06-11 | Primer día repartiendo: no te sepas la zona, sábete el orden. Foto a cada etiqueta al cargar, ordena por tiempo y empieza por la más lejana si vuelves a la nave. Y si algo no lo lee la app, lo escribes tú: no es magia. | Sketch FDS-3 «Repartidores de paquetería: esto os interesa» · «Foto a la etiqueta y la ruta se ordena sola. Gratis hasta el 31-12, enlace en el perfil» | — |
| V 07-11 | Contrarreembolso: cobras 23,40 en efectivo, lo anotas en un papel, pierdes el papel. FDS apunta importe, forma de pago y foto; al acabar el día, cuentas claras. Gratis hasta el 31-12. | `shorts-es.mp4` · «Así se ve una ruta de 30 paradas ordenada en 10 segundos. Enlace en el perfil» | Cobros (texto de hoy) + `app/4-entregado-4x5.png` |
| S 08-11 | Repartidores de Latinoamérica: la app funciona en cualquier país y «Mi dinero hoy» sale en vuestra moneda (en Brasil, Pix). Si la probáis en vuestra ciudad, decidnos qué le falta allí. | Sketch FDS-4 «Lo que nadie te cuenta al empezar a repartir» · «Tres cosas que nadie te dice el primer día 👇 (en comentarios). Enlace en el perfil» · comentario fijado con los tres consejos | — |
| D 09-11 | Sin cobertura en el garaje del polígono: la app abre con tu ruta guardada y lo entregado se envía al volver la red. Detalle pequeño, mañanas enteras salvadas. | Carrusel C «¿Cuánto gana de verdad un repartidor autónomo?» (`redes/C-1…C-6`, texto en `redes/TEXTO.md`) | — |
| L 10-11 | Invita y gana: por cada compañero que se registre con tu enlace y haga su primera ruta real (20 entregas en 2 días), 10 € a tu cartera hasta el 31-12 (después 2,50 €). Él, 25 € de bienvenida. Bizum o PayPal. Condiciones: [invita] | `tiktok-fotos/invita-9x16.png` · «10 € por cada compañero que la use de verdad, hasta el 31-12. Condiciones en el enlace del perfil» | Invita y gana (texto de hoy) + `tiktok-fotos/invita-4x5.png` |
| M 11-11 | ¿Qué le falta a una app de reparto para que la uses de verdad? Contestad aquí: lo que más se repita, lo hacemos. Las dos últimas cosas que pidieron los repartidores ya están: paradas de días anteriores y direcciones que ya conoces. | `tiktok-es.mp4` (el original) · «¿Todavía ordenas la ruta a mano? 🚚 Gratis hasta el 31-12, enlace en el perfil» | — |
| X 12-11 | Resumen honesto de las dos semanas: N altas nuevas, lo que arreglamos, lo que pedisteis. Construimos en público. (N sale de `tools/metricas/usuarios_total.py`; sin cifra real, no se publica) | La pieza nueva de la semana (ideas al final de `redes/TEXTO.md`) o la que mejor haya ido, con otro gancho | Resumen honesto + `portada/app-iphone.png` |

LinkedIn (página FlotaDSP, martes 04-11 y 11-11), para empresas con flota: «Inspección diaria con foto y daños
detectados por IA, ITV/seguro/renting avisados, cuadrante con motor, portal del conductor. Sin instalar nada en
la furgoneta. Desde 5 € por vehículo al mes, usuarios ilimitados. [planes, utm_content=inspecciones]» y la
segunda semana sobre «quién causa los golpes» (revisión rápida de daños, plan Pro). Sin cifras de clientes.

## 9. Medición (semanal, lunes)

- Altas por red: `tools/metricas/origen_altas.py` filtrando `utm_source` en `x`, `tiktok`, `facebook`, `linkedin` y
  `utm_campaign=rep_comunidad`/`perfil`. Es la única cifra que importa; seguidores y «me gusta» son medios.
- Activación de esas altas (primera ruta real): `tools/metricas/uso_altas.py`.
- Por red: seguidores, respuestas recibidas, comentarios en nuestros vídeos, publicaciones borradas por admins.
- Si en dos semanas una red trae 0 altas con 14 publicaciones y ~100 respuestas, se baja a mantenimiento (3 posts
  por semana, solo respuestas) y el tiempo va a la que sí trae. El TikTok orgánico ya dio 0-2 vistas por vídeo
  del 05 al 10-10: lo que se prueba ahora es COMENTAR en vídeos ajenos, no publicar más de lo mismo.

## 10. Lo que necesito de Dani

1. **Para las rondas de respuestas** (X, TikTok, grupos de Facebook): una sesión en su PC con Claude en Chrome y
   las sesiones abiertas, y decirle «haz la ronda de redes de `docs/anuncios/REDES.md`». Desde la nube no se
   llega a su navegador.
2. **Para publicar el calendario desde la nube:** Metricool ya está enlazado con TikTok, Instagram, LinkedIn y
   YouTube (29-10). Falta: conectar Metricool en claude.ai → Personalizar → Conectores, crear la tarea programada
   desde claude.ai (`redes/TAREA.md`), enlazar la página de Facebook en Metricool y desplegar la web para que las
   imágenes de `frontend/public/redes/` tengan URL pública. X: Typefully, si se quiere.
3. **Red del entorno de la nube**: permitir `cms-toolkit-artifacts.artlist.io` y `ai-toolkit-generations.imgix.net`
   (menú del entorno → Edit → Network access → Allowed domains) para que las fotos generadas en Artlist se puedan
   bajar desde aquí. Mientras tanto, las tres del 29-10 se guardan a mano (ver `redes/TEXTO.md`).
4. Facebook: que el perfil y la página puedan publicar (la verificación por vídeo selfie que pedía el 24-10).

## 11. Modo autónomo: la tarea programada «Redes FDS»

Dani (29-10, noche): «que tengas tu propia programación: hace 3 horas que no subo nada a TikTok, me autopido una
pieza, la genero y la subo; que yo no me tenga que preocupar de nada». La **tarea programada** abre una sesión
nueva tres veces al día (7:51, 12:51 y 19:51, hora de Madrid) sobre este repo y hace la ronda sola: lee este
manual y `redes/TAREA.md`, mira qué toca según el calendario y la hora, publica o programa con Metricool, prepara
una pieza nueva si hace falta, apunta la ronda en el Registro y hace push a la rama `claude/trusting-feynman-0tfz62`
(todo lo de redes vive ahí hasta que Dani lo mezcle en `main`). Cómo se crea (desde claude.ai, con el repo y el
conector; las creadas desde una sesión no sirven), el texto y la ronda paso a paso: `redes/TAREA.md`.

Lo que la tarea NO hace y por qué:
- **X**: Metricool solo lo da en plan de pago. Los posts de X del calendario quedan escritos para una sesión en el
  PC (apartado 12) o para cuando haya conector de X (Typefully).
- **Responder en hilos ajenos de X, TikTok o Facebook.** Ningún conector lo permite; sigue siendo una sesión en el
  PC de Dani con Claude en Chrome (apartado 12), aunque sea una vez por semana.
- **Gastar**: ni anuncios ni créditos de Artlist más allá de 2 imágenes por ronda. Nunca borra publicaciones ni toca
  la bio o los enlaces de las cuentas. Mensajes privados, ninguno.

## 12. Para la sesión que ejecute una ronda (PC con Chrome)

1. `git pull`; leer este fichero entero y el último «Registro».
2. Comprobar en cada red que la cuenta no está restringida (TikTok Studio, X → notificaciones, Facebook → estado
   de la página). Si lo está, no se publica: se apunta y se avisa a Dani.
3. Hacer la ronda del apartado 5 con los topes. Cada respuesta, escrita para ese hilo; antes de enviar, releer:
   ¿queda claro que somos la app? ¿aporta algo aunque no pulsen el enlace? ¿lo firmaría Dani?
4. Publicar lo del calendario del día (y comprobar que se ve publicado, no «en revisión» sin más).
5. Apuntar la ronda abajo, commit y push.

## Registro de rondas

| Fecha | Red | Hilo o publicación | Qué se dijo | Resultado |
|---|---|---|---|---|
| 29-10 | (nube) | — | Sesión en la nube sin acceso a las cuentas: solo este manual, el calendario y las plantillas. Nada publicado. | Pendiente: Dani conecta Metricool o abre sesión en el PC |
| 29-10 noche | (nube) | — | Piezas nuevas: carruseles A, B y C y 4 tarjetas para X (`redes/`, textos en `redes/TEXTO.md`). Tres fondos generados en Artlist (en la cuenta de Dani; la red de la nube no deja bajarlos). Tarea programada «Redes FDS» creada (3 rondas al día). Nada publicado: sin conector. | Dani: conectar Metricool y avisar para recrear la tarea con él |
| 29-10 21:30 | (nube) | — | Dos pruebas de la tarea creada desde la sesión: la sesión que abre no tiene el repo con permiso de push ni conectores → tarea borrada; hay que crearla desde claude.ai (`redes/TAREA.md`). Dani enlazó en Metricool TikTok Business, Instagram, LinkedIn y YouTube (X, de pago; Facebook, pendiente). Piezas movidas a `frontend/public/redes/` para tener URL pública. | Dani: conectar Metricool en claude.ai, crear la tarea desde claude.ai, desplegar la web |
| 29-10 21:45 | LinkedIn | Programados en Metricool: martes 04-11 11:00 «Un golpe que nadie vio» (inspección con IA, `utm_content=inspecciones`) y martes 11-11 11:00 «¿Quién le dio el golpe?» (`utm_content=golpes`) | Metricool conectado a la sesión (Dani, 20:27). TikTok/Instagram/YouTube: Metricool rechaza las URLs de flotadsp.com/redes/ hasta que se despliegue la web («Failed to normalize media»). Tarea «Redes FDS» creada: despierta ESTA sesión a las 7:51, 12:51 y 19:51. | Dani: mezclar la rama en `main` y desplegar la web; después la tarea programa la semana sola |
| 30-10 07:55 | (nube) | Metricool | Ronda 1 de la tarea programada. La sesión del PC ya lo tenía todo programado hasta el S 07-11 (TikTok 18:00, Instagram 12:00, YouTube 30-10/02-11/05-11, X hasta el 07-11) y la web desplegada. Añadido el D 08-11: carrusel C «¿Cuánto gana de verdad un repartidor autónomo?» en TikTok 18:00 (410876098) e Instagram 12:00 (410876132); sustituye al sketch FDS-4 del calendario, que no está en el PC. YouTube del domingo sin programar: no hay vídeo nuevo (los que quedan ya salieron en Shorts). | Pendiente de Dani (lo apuntó el PC): dos posts de X del 29-10 que no son de las sesiones, uno nombra a Amazon, SEUR, GLS y MRW; anuncio de la página FDs con el pago rechazado; aviso de inicio de sesión en Instagram |
