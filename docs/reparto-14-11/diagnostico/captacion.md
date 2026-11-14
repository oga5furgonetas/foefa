# De dónde viene la gente y qué se le promete (14-11-2026)

Carpeta: `C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/reparto/diag/captacion`
(capturas en `capturas/`, lo leído de Internet en `web/`, scripts en la raíz).

## Qué he hecho y cómo repetirlo

1. **Google Play, de verdad (solo leer).** `node play.mjs` abre en Chromium la búsqueda pública de Play
   (`hl=es&gl=ES`) con seis búsquedas y guarda el orden de resultados (`web/play-busquedas.json`, capturas
   `capturas/play-busqueda-*.png`). `node play.mjs <id> <id>…` guarda la ficha de cada app (`web/play-fichas.json`,
   `capturas/play-ficha-*.png`). `node play2.mjs` abre «Información de la aplicación» de FDS y baja sus capturas
   (`capturas/play-fds-captura-1..6.png`, juntas en `capturas/play-fds-capturas-juntas.png`). Ojo: la búsqueda de la
   web de Play se parece a la del móvil pero no es idéntica; sirve como aproximación.
2. **La web compilada de la rama** (`foefa-p0/frontend/dist`) con `vite preview` en el 4464 y el servidor de pruebas en
   el 8804 (base en memoria). `node puertas.mjs` abre 14 puertas en un Pixel 7 (es-ES, ubicación en A Coruña) y hace
   captura de la primera pantalla y de la página entera (`capturas/p01..p14-*`), con texto y enlaces en
   `web/puertas.json`.
3. **Dos altas completas** con `node alta.mjs a` (desde `flotadsp.com` a secas) y `node alta.mjs b` (desde el enlace del
   anuncio de Meta «spot5»): capturas `capturas/a01..a07`, `b02..b07`, tiempos y toques en `web/alta-a.json` y
   `web/alta-b.json`. Robot: los tiempos son de máquina; una persona tarda más en escribir.
4. **Lectura**: ficha del repo (`app-android/play-listing/`, `docs/PLAY_STORE.md`), anuncios y campañas
   (`docs/anuncios/*.md`, `docs/ESTADO.md`, `docs/AUDITORIA-2026-11-01.md`), funciones de Cloudflare
   (`frontend/functions/`), la pantalla de entrada de la app nativa (`ui/acceso/Acceso.kt`) y la de empleo
   (`pages/Empleo.jsx`, `backend/campana_candidatos.py`). Producción solo se ha LEÍDO (sitemap, `og.png`, cabeceras de
   `/` e `/invita`). No he creado nada fuera de mi servidor local. Servidor y vite parados al acabar.

---

## Lo encontrado, de más a menos grave

### 1. BLOQUEA · La ficha pública de Play es la de la versión de pruebas del 04-10 y promete cosas que la app no tiene
- Título público «FDS – Reparto y rutas», desarrollador «FDsp», **50+ descargas, 0 valoraciones, sin vídeo**
  (`capturas/play-ficha-com.flotadsp.flota.png`).
- La descripción pública es el texto del 04-10 (`docs/PLAY_STORE.md:643-680`), no la «ficha mejorada» del 21-10 ni la
  de `play-listing/es-ES/` del 30-10: **nunca se pegaron**. Dice, literal: «Pruébala sin registrarte: abre la app y
  pulsa «Probar sin cuenta». 7 días gratis.» (`web/play-fds-info.json`).
  - La app nativa **no tiene** ningún «Probar sin cuenta»: su primera pantalla solo ofrece «Crear mi cuenta gratis» y
    «Ya tengo cuenta» (`app-android/.../ui/acceso/Acceso.kt`, textos de las líneas ~126-152; `grep "Probar sin cuenta"`
    en `app-android` y `frontend/src` da 0).
  - «7 días gratis» choca con lo que dicen la web, los anuncios y la propia app: «Gratis y sin límite hasta el 31 de
    diciembre» (`capturas/p02-repartidores-pantalla.png`).
  - Empieza hablando a «supermercados… distribuidores y empresas de paquetería» y tiene un bloque «Para la oficina».
- La descripción corta pública empieza por **«eparto y rutas: …»** (le falta la R): es lo que Play enseña como
  `description` de la página (`web/play-fds-info.json`, campo `meta`). Sospecho que es la descripción corta tal cual
  está guardada en Play Console; no lo he podido mirar en la consola.
- Las capturas: las 3 de móvil son del diseño viejo (oscuro, del 3 de octubre, con «Cliente 1 (prueba)»), sin una sola
  frase encima; la 3.ª es «Hola, Repartidor · Hacer la auditoría» (el portal del conductor de empresa); la 4.ª a 6.ª son
  **el panel de oficina en ordenador** con la marca vieja «Flota» y «TIENDA» arriba
  (`capturas/play-fds-capturas-juntas.png`, `play-fds-captura-3.png`).
- Comparación (mismas búsquedas, mismo día): Spoke/Circuit 4,7★ 189 mil reseñas 10 M+, con tráiler y capturas con
  título «Añadir paradas / Optimizar / Navegar»; Routal 4,5★ 10 mil+, tráiler y capturas «Escanea, no escribas»,
  «¿Papel? Foto y listo» (`capturas/play-ficha-com.underwood.route_optimiser.png`, `…com.routal.drivers.png`). Zeo 1 M+,
  Routin 1 M+ 4,8★ con tráiler, Route4Me 1 M+ 4,0★ con tráiler.
- Por qué importa: aunque alguien la encuentre, en tres segundos ve una app oscura sin reseñas que parece de oficina; y
  si la instala, lo primero que busca («Probar sin cuenta») no existe.

### 2. BLOQUEA · En Play no se encuentra buscando lo que busca un repartidor
`web/play-busquedas.json`, top 13-14 de cada búsqueda:
- «planificador de rutas reparto»: FDS no sale (sale Spoke, Zeo, Maposcope, «Planificador: rutas de reparto», Routin,
  MyWay, Routal, Route4Me…).
- «ruta repartidor»: no sale. «optimizar ruta paquetes»: no sale. «circuit gratis»: no sale (Circuit se come la
  búsqueda). «app repartidor»: no sale (Glovo, PeYa, Amazon Flex, Uber).
- «FDS reparto»: **sale la 1.ª**. Solo se encuentra por el nombre.
- Causas visibles: el título no tiene ninguna palabra de búsqueda salvo «reparto» y «rutas» sueltas (las de la
  competencia dicen «Planificador de rutas»); 0 valoraciones; 50+ descargas; la descripción habla de oficina. Las
  51 instalaciones de 28 días cuadran con lo que dice la auditoría: ~25 eran los conductores de la flota de Dani
  (`docs/AUDITORIA-2026-11-01.md:232-235`).

### 3. BLOQUEA (para medir) · Una buena parte de las altas probablemente no eran repartidores autónomos
Pruebas de que se ha metido gente que NO reparte por su cuenta por la puerta de «autónomo»:
- **Correo a 270 candidatos de empleo (17-10)**: 250 el 17-10 y 20 el 18-10, «10 € para ti con FDS, la app para
  repartir», a quienes habían pedido TRABAJO de repartidor en la flota de Dani; el botón lleva a
  `/repartidores?utm_campaign=candidatos` (`docs/ESTADO.md:4038-4058`, `backend/campana_candidatos.py:50-70`,
  `backend/server.py:27909`). Cae dentro de los 30 días del embudo.
- **La pantalla de gracias de cada candidatura de empleo** empuja a crear cuenta: «Crea tu cuenta y comparte tu
  enlace… Y si repartes por tu cuenta, 10 € para ti», botón «Ver Flota y crear mi enlace» → `/repartidores?utm_source=
  empleo` (`frontend/src/pages/Empleo.jsx:245-259`). El alta de `/repartidores` crea SIEMPRE una cuenta
  `sector: autonomo, plan: autonomo` (`frontend/src/pages/AltaRapida.jsx`, cuerpo del `POST /auth/register`).
- **Lo que trae Google**: de 117 clics en 90 días, 41 de marca y «casi todo lo demás» ofertas de empleo locales
  («repartidor vigo», «empleo ourense»); «ruta de reparto» 0 clics (`docs/AUDITORIA-2026-11-01.md:236-238`). Hoy el
  sitemap de producción no tiene ninguna oferta (`curl https://flotadsp.com/sitemap.xml | grep -c /empleo/` → 0), así
  que este grifo ahora está casi cerrado; antes no.
- **El anuncio de Meta que más altas trajo** optimizaba por «registro completado» con público Advantage+ en España
  20-55 (`docs/anuncios/CAMPANA-24-10-SPOT5.md`): Meta busca a quien rellena formularios, no a quien tiene 80 paquetes
  en la furgoneta mañana. Embudo del 23-10: 32 registros → 0 días de reparto (`docs/anuncios/CANALES-02-11.md`).
- Uno que busca trabajo y se da de alta como «autónomo» no tiene paquetes: abre la app, ve «Carga tus paradas de hoy»
  y no tiene nada que cargar. Eso explica bien el «35 vuelven → 23 meten una parada → 1 día real».

### 4. FRENA · El primer minuto no es el que promete el anuncio: tres pantallas y, en Android, volver a entrar
Lo que se promete justo antes (todas las puertas): «Haz una foto a la etiqueta… la app ordena las paradas por tiempo y
te lleva con voz» (`capturas/p02-repartidores-pantalla.png`). Lo que pasa justo después (`capturas/a05-tras-alta.png`,
`b07-ahora-no.png`, `web/alta-a.json`):
- Desde `flotadsp.com`: 1 toque a «La app de ruta», 3 campos, casilla, botón: **6 toques** y la cuenta está hecha.
- 1.ª pantalla tras el alta: «Cuenta creada · **Último paso: instala la app**» con la insignia de Google Play y un APK
  aparte («el móvil puede pedirte permitir apps de esta fuente»).
- Si pulsa Google Play, llega a la ficha del punto 1 (la de «7 días gratis» y el panel de oficina). Al abrir la app
  nativa tiene que escribir **otra vez** correo y contraseña: el enlace de Play no lleva la sesión
  (`frontend/src/components/GooglePlayBadge.jsx:4`, URL sin nada más) y la app nativa no recibe ningún «pase» (solo
  abre enlaces `/ruta`, `/app`, `/conductor`: `AndroidManifest.xml:80-102`; no hay código de «pase» en `app-android`).
  Leído en el código, no lo he probado en un móvil con la app instalada.
- Si pulsa «Ahora no, seguir en la web» (7.º toque): «Te damos la bienvenida a FDS · ¿Tienes ya tus paradas de hoy?»
  con «Sí, cargarlas ahora / Todavía no» encima de «Carga tus paradas de hoy». Esto está bien hecho, pero solo sirve a
  quien tiene los paquetes delante. Quien se da de alta desde un anuncio a las 22:00 en el sofá (o un candidato de
  empleo) no tiene nada que escanear: la promesa no se puede cumplir en ese minuto.
- iPhone: la app aún no está en la App Store (revisión urgente pedida el 13-11, `docs/APP_STORE.md`); la web lo dice
  bien (`capturas/p08-iphone-pantalla.png`): Safari → Compartir → «Añadir a pantalla de inicio». Son 4 pasos que la
  mayoría no hace.

### 5. FRENA · Nada mide de dónde viene cada instalación de Play
- El botón de Play de la web va a `…details?id=com.flotadsp.flota` sin `&referrer=` (`GooglePlayBadge.jsx:4`) y la app
  nativa no lee el Install Referrer (`grep -ri referrer app-android/app/src/main/java` → nada; `build.gradle.kts` sin
  `installreferrer`). Ya lo pedía `docs/anuncios/CANALES-02-11.md` §1.2. Solo los correos del bono llevan referrer
  (`server.py:27972`).
- Con esto no se puede saber si las 51 instalaciones son de la flota de Dani, de anuncios o de búsqueda.

### 6. FRENA · Con la portada nueva, el repartidor que escribe flotadsp.com cae en la página de empresas
- Hoy en producción `/` es la de la app de reparto (`<title>FDS · La app de reparto gratis…`). En la rama, `/` es
  «Para empresas con furgonetas · El golpe, el día que aparece» (`capturas/p01-portada-pantalla.png`).
- Lo bueno: la primera línea de la pantalla es «¿Repartes tú? **La app de ruta** →» y lleva a `/repartidores` en 1 toque.
  Lo malo: el botón grande y el «Probar» de arriba a la derecha crean una cuenta de **empresa**
  (`/registro?sector=otra&plan=operacion&flota=20`, `web/puertas.json`). Un repartidor con prisa pulsa el botón de color.
- `/registro` a secas (en el sitemap con prioridad 0,8) pone «Repartir yo mismo» en **6.º lugar**, debajo de
  «Mensajería y paquetería», que un repartidor puede creer suyo y crea una cuenta de empresa
  (`capturas/p10-registro-pantalla.png`, la opción no se ve sin bajar).
- `/instalar` (la dirección que decían los planes de octubre, `docs/anuncios/CRECIMIENTO.md`) lleva a «Entra en FDS»
  (login), no a instalar nada (`web/puertas.json`, `p12-instalar` → `/login?next=/ruta`).

### 7. FRENA · Lo que se ve al pasar el enlace por WhatsApp no enseña la app de ruta
- El enlace de invitar es `/invita?ref=…` (`frontend/src/lib/compartir.js:11-13`). `/invita` no tiene función de
  Cloudflare propia (`ls frontend/functions`), así que WhatsApp enseña las etiquetas genéricas de `index.html`:
  hoy en producción «FDS — La app de reparto y el panel de tu flota» con un `og.png` de solo texto
  (`web/og-prod.png`); con la rama, **la foto de una furgoneta con un golpe y «El golpe, el día que aparece»**
  (`frontend/public/og.png`, md5 distinto del de producción). La imagen buena existe (`og-repartidores.png`: «Tu ruta,
  ordenada sola · GRATIS y sin límite hasta el 31-12») pero solo la usa `/repartidores`.
- El mensaje que se comparte es largo y suena a contrato: «Si te registras con mi enlace y completas 20 entregas a
  direcciones distintas en 2 días diferentes, repartidas durante el día y dentro de tus primeros 30 días, gano…»
  (`compartir.js:16-27`). El del portal del conductor de empresa dice «Estoy usando **Flota**…» (marca vieja,
  `pages/driver/DriverReferralWallet.jsx:32`), y la gracias de empleo dice «Enséñale **Flota**»
  (`pages/Empleo.jsx:252-256`).

### 8. MOLESTA · Promesas de precio distintas según la puerta
- Web, anuncios, app: «Gratis y sin límite hasta el 31 de diciembre» + «Gana 25 € con tu primera ruta real».
- Play: «7 días gratis». Grupos de Facebook de octubre: «7 días gratis» (`docs/ESTADO.md:1789-1790`).
- El correo a candidatos: «10 €» por la primera ruta; la web ya dice **25 €** (`campana_candidatos.py:62` frente a
  `capturas/p02-repartidores-pantalla.png`).
- La pregunta «¿Tengo que instalar algo?» de `/repartidores` dice que funciona en el navegador y no nombra Google Play
  (`Repartidores.jsx`, `PREGUNTAS`).

### 9. Historial de anuncios (fechas y resultado, de los documentos)
| Fecha | Dónde | Texto / gancho | A dónde mandaba | Resultado documentado |
|---|---|---|---|---|
| 04-10 madrugada | Meta, 4 campañas | — | formulario «nombre, correo, contraseña» | 410 visitas, 0 altas (`Repartidores.jsx` comentario) |
| 04-10 | Meta + TikTok, 250 €, 7 idiomas | «¿Aún ordenas la ruta a mano?… Pruébala sin registrarte» · «7 días gratis» | `/repartidores` | TikTok 1.107 visitas, 88 % se va (`Repartidores.jsx`); TikTok 203 € y 0 altas (`AUDITORIA:244`) |
| 05-10 | Grupos de Facebook («Trabajo de repartidor España», BCN, Madrid…), LinkedIn | «Soy repartidor y me cansé… 7 días gratis» | `/repartidores?utm_source=grupo` | sin cifra |
| 10-10 → 29-10 | Meta «FDS Registros — Gratis 15 paradas», 10-20 €/día | «Gratis sin límite» | `/repartidores` | 69 registros a 1,34 € (`CANALES-02-11.md`) |
| 14-10 / 17-10 | Meta «Invita y gana 10 €», «bono» | 10 € por invitar / por primera ruta | `/repartidores?utm_campaign=rep_invita10` | sin cifra separada |
| 17-10 | Correo a 270 candidatos de empleo | «10 € para ti con FDS» | `/repartidores?utm_campaign=candidatos` | 250+20 enviados, 2 bajas la 1.ª hora |
| 24-10 → 29-10 | Meta «spot5» (voz Puck), 10→20 €/día | «¿Todavía ordenas la ruta a mano cada mañana?… Crea tu cuenta en un minuto» | `/registro?sector=autonomo…utm_content=spot5` (redirige a `/repartidores`) | 23-10: 32 registros → 0 días reales |
| 30-10 | Meta EN/PT/FR/IT/DE «Ruta hecha» | — | de Play pasados a `/repartidores` | en borrador; cuenta de Meta restringida por pago desde ~30-10/01-11 |
Desde el 01-11 la cuenta de Meta está restringida (`AUDITORIA:240-241`): en noviembre no hay anuncios pagados
documentados. Eso cuadra con «casi 0 instalaciones al día desde el 4-11».

---

## Lo que funciona bien y no hay que tocar
- **`/repartidores`**: la primera pantalla dice para quién es, qué hace y el regalo, con el vídeo de la app y dos botones
  claros (crear cuenta / probar sin registrarse). Carga en ~2 s en local (`capturas/p02-repartidores-pantalla.png`).
- **El alta**: 3 campos, sin tarjeta, con sugerencia de correo mal escrito; 6 toques desde `flotadsp.com`.
- **La primera pantalla tras «Ahora no»**: una sola pregunta («¿Tienes ya tus paradas de hoy?») y botones grandes
  (`capturas/b07-ahora-no.png`). Es lo correcto para quien SÍ tiene paquetes.
- **La portada nueva no esconde al repartidor**: «¿Repartes tú? La app de ruta» es lo primero que se ve.
- **`/iphone`** explica con honradez cómo usarla sin App Store.
- **Las ofertas de empleo** cerradas salen con `noindex` (`functions/empleo/[slug]/[oferta].js`) y hoy no hay ninguna en
  el sitemap.
- **`og-repartidores.png`** es una buena tarjeta para WhatsApp: hay que usarla en más sitios, no rehacerla.

---

## 1. Cada puerta: qué promete antes y qué encuentra después
| Puerta | Promesa justo antes | Tipo de cuenta | Primer minuto | ¿Coincide? |
|---|---|---|---|---|
| `/repartidores` (anuncios, grupos, invitaciones, correo a candidatos, gracias de empleo) | «Tu ruta de reparto, ordenada sola» · foto a la etiqueta · gratis hasta 31-12 · 25 € por tu primera ruta | autónomo | «Último paso: instala la app» → Play o web «¿Tienes ya tus paradas de hoy?» | A medias: solo si tienes paquetes delante |
| `/registro?sector=autonomo` (anuncio spot5, `/empezar`, `/iphone`, login) | lo mismo (redirige a `/repartidores`) | autónomo | igual | igual |
| `/empezar` | «Crear mi cuenta gratis… Sin tarjeta» | autónomo | igual | igual |
| `/registro` a secas | «¿Qué vas a hacer con FDS?», 6 opciones, la del repartidor la 6.ª | empresa si elige mal | panel de empresa | No, si elige «Mensajería y paquetería» |
| `/` (rama) botón grande «Probar» | furgonetas y golpes | empresa | panel de empresa | No para un repartidor |
| App de Play | Ficha: «Probar sin cuenta», «7 días gratis», oficina | autónomo | «Crear mi cuenta gratis / Ya tengo cuenta», sin demo | **No** |
| Correo a candidatos | «10 € para ti… la app para repartir» | autónomo | pide paradas que no tiene | **No**: pedían trabajo, no una app |

## 2. Quién es probable que fueran las 104 altas (APUESTA, sin datos de producción)
Qué mirar para saberlo, en este orden:
1. `python tools/metricas/origen_altas.py 30` con `MONGO_URL` (o Negocio → «Cómo va el negocio»): cada alta con su
   `utm_source / utm_campaign / utm_content` y el referrer de su primera visita.
2. Contar por separado `utm_campaign=candidatos` y `utm_source=empleo` (ex-candidatos), `utm_content=spot5` y
   `facebook:*` (Meta), `utm_source=referido` (invitados), `desde_app=true` (alta dentro de la app de Play) y sin utm.
3. Cruzar el correo de cada alta con `candidatos` de la base de la flota: cuántas altas «autónomo» habían pedido trabajo
   antes.
4. Para las 23 que metieron una parada y las 12 que entregaron: cuántas paradas, a qué hora del día y si eran
   direcciones distintas (una persona probando con su casa no es un repartidor).

Mi apuesta (no es un dato): la mitad o algo más, de Meta (registro barato, público amplio); entre 10 y 25, de la
campaña a candidatos y de la gracias de empleo (gente que quería un contrato); unas pocas, invitaciones y grupos; muy
pocas desde la app de Play por búsqueda (no sale). Repartidores autónomos en activo con paquetes al día siguiente:
un puñado. El «1 día de reparto real» encaja con eso.

## 3. La ficha de Play: los cinco cambios que más instalaciones darían (texto ya escrito)
1. **Título (30)**: `FDS Planificador rutas reparto` (30 justos). Mete la búsqueda principal del mercado («planificador de
   rutas», «reparto») como hacen Spoke, Zeo, Routin y Route4Me. Alternativa: `Ruta de reparto FDS: escanear`.
2. **Descripción corta (80)**, sin la R perdida: `Foto a la etiqueta y la ruta se ordena sola. Te guía con voz a cada
   puerta.` (75). Habla del gesto que la diferencia (foto a la etiqueta, como Routal con «Escanea, no escribas»).
3. **Las tres primeras capturas**, del diseño nuevo, claras, con una frase grande arriba y una sola idea cada una:
   - 1: la etiqueta de un paquete con la cámara encima → «**Foto a la etiqueta. La dirección entra sola.**»
   - 2: el mapa con las paradas numeradas y la hora de cada una → «**80 paradas, ordenadas en segundos.**»
   - 3: la guía de la siguiente parada con «Entregado» grande → «**Te lleva con voz hasta cada puerta.**»
   Fuera de la ficha de repartidor el panel de oficina, el portal del conductor y todo lo que lleve «Flota», «TIENDA» o
   «(prueba)».
4. **Descripción larga**: pegar la de `play-listing/es-ES/full.txt` (ya escrita el 30-10) quitando el «para pequeñas
   empresas…» del final y empezando así: «FDS es el planificador de rutas para el repartidor que va por su cuenta.
   Fotografías la etiqueta de cada paquete, la ruta se ordena sola por tiempo y te guía con voz parada a parada. Sirve
   con paquetes de cualquier agencia (Amazon, MRW, Nacex, Tipsa, GLS, SEUR…), sin conectarse con ellas.» Y quitar
   «Probar sin cuenta» y «7 días gratis», o poner de vuelta en la app un «Ver un ejemplo» en la primera pantalla
   nativa. Palabras que tienen que salir dos o tres veces, con naturalidad: planificador de rutas, ruta de reparto,
   optimizar ruta, repartidor, paquetería, escanear paquetes, navegación por voz, multiparada.
5. **Vídeo (tráiler)**: 25-30 s grabado en la pantalla del móvil, sin presentador: 0-3 s una mano haciendo foto a una
   etiqueta y la parada aparece; 3-10 s veinte paquetes seguidos y «Ordenar ruta»; 10-20 s la guía con voz por la calle;
   20-25 s «Entregado» y el contador del día. Es lo que tienen 4 de los 5 competidores mirados y FDS no. Ya hay piezas
   grabadas (`docs/videos/shorts-es.mp4`, `docs/anuncios/super-anuncio/`): hay que subir una a YouTube y ponerla.
   Además (no cuenta como cambio de ficha, pero sin ello nada sube): pedir valoración dentro de la app tras el primer
   día con 20 entregas; 0 valoraciones es el primer filtro de quien busca.

## 4. Cómo se pasa una app así en la nave (España, 2026) y qué le falta
Lo que he visto en el código y en las capturas, y lo que propondría:
- **Se pasa enseñando la pantalla, no un enlace.** En la nave alguien mira el móvil del de al lado mientras carga. En
  10 segundos tiene que verse: la lista de paradas ya ordenadas con la hora de cada una y un número grande («87
  paradas · acabas ≈ 15:40»). La app lo tiene en «Hoy», pero no hay un «modo enseñar»: falta un botón de compartir el
  día que haga una imagen (mapa + «87 paradas ordenadas en 40 s» + logo) lista para mandar al grupo de WhatsApp de la
  nave o subir a un estado. Hoy solo se comparte texto (`compartir.js`).
- **El paso siguiente es «pásamela».** Si el compañero tiene Android, lo natural es un enlace a Play o un QR en la
  pantalla del que ya la usa. Hoy el enlace va a la web (`/invita` → `/repartidores`), cuya tarjeta en WhatsApp no
  enseña la app (punto 7). Falta: un QR en «Invita» que lleve directo a Play con `referrer=ref-<código>`, y la tarjeta
  `og-repartidores.png` en `/invita`.
- **El mensaje tiene que caber en una línea.** «Uso FDS para ordenar la ruta: foto a la etiqueta y te la ordena sola.
  Gratis hasta fin de año 👉 enlace». Las condiciones del premio, en la página, no en el mensaje.
- **TikTok / vídeos cortos «un día de reparto».** Lo que funciona es el POV real (furgoneta, paquetes, manos). La app
  tiene que verse bien en vertical en 3 s: la foto a la etiqueta y la parada que aparece es el plano estrella. El
  candidato natural es Dani y sus conductores grabando su propio día, no un anuncio montado.
- **Que el compañero vea lo mismo que le enseñaron.** Hoy, tras el alta, lo primero es «Último paso: instala la app» y
  luego una pantalla vacía. Si llega con paquetes, bien; si no, debería caer en el ejemplo ya cargado (lo de «Ver un
  ejemplo» que la web ya tiene) en lugar de una lista vacía.

---

## Las tres cosas que yo arreglaría primero y por qué
1. **La ficha de Play, hoy mismo** (título, descripción corta sin la R perdida, descripción larga sin «Probar sin
   cuenta» ni «7 días gratis», y tres capturas nuevas con frase). Es la única puerta que trabaja sola y sin dinero, y
   ahora mismo no sale en ninguna búsqueda y miente en dos cosas que el usuario comprueba en el primer minuto.
2. **Separar y medir quién se da de alta**: dejar de mandar candidatos de empleo a crear cuenta de autónomo (la gracias de
   empleo y el correo a candidatos), poner el `referrer` en el botón de Play y leerlo en la app, y sacar el
   `origen_altas.py` de los últimos 30 días. Sin esto, el 104 → 1 mezcla a gente que nunca iba a repartir con su app
   y no deja ver el problema de verdad.
3. **Que el enlace que un repartidor pasa en la nave enseñe la app**: la tarjeta de `og-repartidores.png` en `/invita`
   (y en cualquier enlace de invitar), un QR directo a Play en la pantalla de invitar y un mensaje de una línea. El boca a
   boca es el único canal barato para autónomos; hoy, con la rama, el enlace de un compañero enseñaría una furgoneta
   con un golpe.
