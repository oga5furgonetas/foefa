# Flota y FDS a 29-10-2026: qué somos, qué sobra, qué falta y cómo llegar a «esto es increíble»

> Dani (29-10, noche): «actúa como el mejor del mundo: verifica la APK, la página, qué mejorar para los autónomos,
> para nosotros (OGA5, DGA1) y para empresas que contraten repartidores; qué añadir, qué quitar, qué tiene
> sentido, cómo funciona el mercado, cómo viralizarnos y qué hace falta para ser la más potente».
>
> Hecho leyendo el código (app nativa, servidor, web), las notas (`ESTADO.md`, `ESTUDIO_APP.md`,
> `AUTOCRITICA-APP-25-10.md`, `PLAN-1000.md`, `PRECIOS.md`, `REPARTO.md`, `REVISION_LEGAL.md`, `anuncios/*`),
> usando la web, la demo de la ruta y la demo del panel **en producción desde un móvil emulado**, y buscando el
> mercado en fuentes de 2026 (al final). No repite las 41 propuestas de `ESTUDIO_APP.md` (siguen valiendo): va un
> escalón por encima, a decidir qué producto somos y dónde se gana. Lo que no se pudo comprobar se dice. Nada de
> cifras inventadas.

## 0. En una página

1. **No tenemos un producto: tenemos tres y medio bajo un dominio y un servidor.** FDS para el autónomo; Flota para
   flotas (nuestro caso: OGA5, DGA1, DGA2); Reparto para empresas que reparten lo suyo (súper, distribución,
   mensajería); y cosas que no son producto (Valor, tienda de ropa, mercadillo, casas de alquiler, China, 7 idiomas).
   Cada uno tiene media web propia, dos marcas (FDS y Flota, con logos y temas distintos) y el mismo `server.py`.
2. **El autónomo es el segmento más disputado y el de menor ticket.** Spoke (antes Circuit) y Routal Drivers dan
   gratis 10 paradas; nosotros 15. Nosotros 9,99 €/mes; Spoke 9,99 $ (Lite) y 19,99 $ (Standard). Es paridad. Con
   40 cuentas reales y **0 días reales** (`ESTUDIO_APP.md` §0), cada euro de anuncio hoy compra altas que no vuelven.
3. **Donde somos imbatibles en precio y no lo sabe nadie: empresas con 2-30 repartidores.** El plan Reparto cuesta
   12 €/repartidor (mínimo 36 €/mes). Spoke Dispatch arranca en unos 100-125 $/mes, Onfleet en 149-549 $/mes,
   Routific en 39-119 $/vehículo, Routal (plataforma) en 99 $/mes. **No existe ni una página web para ese cliente**
   (el canal 8 del `PLAN-1000.md` sigue sin hacerse).
4. **Donde Flota es única en Europa: lo que Hera cobra a 9 $/conductor en EE. UU.** (cuadrante, seguimiento,
   coaching, flota, mensajes) nosotros lo tenemos a 5-9 €/vehículo, en español, sin instalar nada y con la IA de
   daños. Con una condición previa que no se negocia: **el plan A-G de los datos de Amazon (24-09) sigue abierto**.
   No se puede vender Flota a otra DSP con eso pendiente.
5. **Cinco hallazgos de hoy en producción que no están en ninguna nota** (§3): el píxel de Meta **no está cargado**
   en la web (las campañas de Meta, el único canal que trae altas, optimizan a ciegas); dos marcas en un dominio;
   el título «Flota — Gestión de flotas con IA» en páginas de FDS; «Oferta fundador · quedan 10 de 10 plazas»;
   y el aviso de cookies tapando un tercio de la primera pantalla del móvil sin que haga falta.
6. **La apuesta**: una marca, dos puertas («reparto» / «tengo repartidores»), un motor. La viralidad de este
   sector no es un vídeo: es la nave a las 7 de la mañana, el grupo de WhatsApp de la agencia y el jefe que mete a
   sus 15 repartidores de golpe. **El B2B es el motor de activación del B2C**, no al revés. Mil repartidores de
   pago se llega antes por 60 empresas de 15 que por 1.000 anuncios de uno en uno.

## 1. Qué tenemos hoy (sin adornos)

| Producto | Para quién | Qué hace | Estado real | Dónde |
|---|---|---|---|---|
| **FDS (autónomo)** | Quien reparte por su cuenta | Escáner de cualquier etiqueta, foto a la hoja, ruta por tiempo, guía por voz, prueba de entrega, cobros, seguimiento al cliente, Mi dinero hoy, sin cobertura, historial, Excel para la gestoría, invita y gana | Web: 16 pantallas, 7 idiomas. Nativa 2.2.5 (Play, prueba abierta): menos que la web (sin voz, sin pago, sin push, sin idiomas). 40 cuentas, 0 días reales | `pages/driver/*`, `app-android/` |
| **Conductor de empresa (nuestra flota)** | OGA5, DGA1, DGA2 | Auditoría con fotos e IA, Mis turnos, pedir día, Trabajar más, Invita y gana, Mi cuenta | Funciona en el móvil de Dani (2.2.4). 68 personas en el cuadrante de OGA5. Sin avisos push nativos | `ui/acceso/*`, `pages/driver/*` |
| **Flota (oficina)** | Jefe de nave, oficina | 40+ pantallas: vehículos, estado de la flota, inspecciones + IA, revisión rápida, origen de daños, vencimientos, aparcamiento, incidencias, órdenes, talleres, asignación, plantilla, DNR, horas, cuadrante, turnos, checklist, conductores, incorporaciones, empleo, contactos, conversaciones, actividad, importaciones, Centro IA… | En producción para nuestra flota. 0 clientes de pago. Demo pública de solo lectura | `panel/pages/*` |
| **Reparto (empresas)** | Súper, distribución, mensajería local | Pedidos pegados o escaneados, zonas, ruta por tiempo, mapa en vivo de la oficina, seguimiento para el cliente, cobro a la entrega | 2 mensajerías (2 conductores). Gadis y Disgón sin cerrar. Plan de 12 €/repartidor | `panel/pages/Reparto.jsx`, `MiRuta.jsx` |
| **Lo que no es producto** | Dani / nadie | Valor (apuestas), tienda de ropa, mercadillo, casas de alquiler, renting, /cn y la TWA para China, 7 idiomas en la app de ruta | Vive en el mismo servidor, la misma base y el mismo repo | `backend/valor/`, `Tienda*`, `Mercadillo*`, `android/` |

Lo bueno, que no hay que tocar por tocar: el núcleo del reparto es completo y lo he visto funcionar hoy en la
demo (8 paradas en A Coruña, consejos en su momento, «Pon tu tarifa», botones grandes, «Ver la puerta», «¿Dónde
va en la furgoneta?»). La web del repartidor **parece un producto serio**. El panel tiene una bienvenida honesta
(«Hay muchas pantallas, pero el día se hace con estas cuatro»). El precio está bien puesto en los tres casos.

## 2. El mercado, de verdad

### 2.1 El autónomo (B2C): paridad de precio, mucha competencia, poco ticket

| | FDS | Spoke (ex Circuit) | Routal Drivers | Zeo |
|---|---|---|---|---|
| Gratis | 15 paradas **al día** | 10 paradas **por ruta** | 10 paradas por ruta al día | Limitado |
| Pago | 9,99 €/mes · 99 €/año | Lite 9,99 $ · Standard 19,99 $ (119,99 $/año) | Lite / Pro (precio en España sin publicar) | De pago por tramos |
| Tienda | Play (prueba abierta); iPhone solo web | Play y App Store, millones de descargas | Play y App Store | Play y App Store |

Fuentes: Spoke [precios oficiales](https://spoke.com/route-planner/pricing) y [App Store](https://apps.apple.com/us/app/spoke-route-planner/id1198232244);
Routal [planes de conductor](https://support.routal.com/en/articles/14470533-drivers-plans).

Lo que FDS tiene y ellos no (comprobado en el código, no en la publicidad): escaneo de etiquetas de cualquier
agencia con la dirección dentro (SEUR, DPD, GLS) y lectura del texto si no la trae; la hoja de reparto en una foto;
«la última vez en esa puerta»; «Mi dinero hoy» con la tarifa del repartidor; manos libres; cobros con Bizum y foto;
seguimiento al cliente por WhatsApp; entregas sin cobertura que se envían solas. Lo que ellos tienen y nosotros no:
marca, años, App Store, equipo, y en el caso de Spoke un producto de equipos ya rodado.

**A quién le sirve de verdad** (lo dicen las dos únicas respuestas a «¿qué te frenó?»: «no supe» y «no tengo
ruta»): al subcontratado de agencia que recibe 60-150 paquetes con etiqueta y sin app. **No** al de Amazon Flex, al
rider de comida ni al conductor de una DSP: a esos la ruta se la da su empresa. Cuántos son en España no lo publica
nadie; no me invento la cifra. Se mide por el embudo.

La cuenta que hay que mirar de frente: el ticket máximo es 120 €/año. Con altas a 1,6-2,4 € y 0 % de activación, el
coste por usuario activo hoy es infinito. Con el bono de 25 € más anuncios, el coste por usuario **activado** será
de 30 € o más, que se recuperan a los 3-4 meses de pago, si paga. Es un negocio solo si la retención a 3 meses es
alta, y eso aún no lo sabe nadie porque nadie ha hecho un día real. Por eso el orden es activación → retención →
anuncios, nunca al revés.

### 2.2 Empresas con 2-30 repartidores (B2B): 3-10 veces más baratos que todos, y sin página

| Quién | Precio publicado | Fuente |
|---|---|---|
| Spoke Dispatch / Circuit for Teams | desde ~100-125 $/mes (500-1.000 paradas), tramos por paradas | [rfp.wiki](https://www.rfp.wiki/supply-chain-logistics-transportation/transportation-management-systems/last-mile-delivery-technology-solutions/circuit/routific), [Levy](https://fleets.levyelectric.com/compare/circuit-for-teams-pricing) |
| Onfleet | 149-549 $/mes; auto-asignación solo en planes altos | [Shipday (competidor)](https://www.shipday.com/post/6-best-onfleet-alternatives-for-delivery-teams-in-2026) |
| Routific | 39-119 $ por vehículo y mes (fuentes dispares) | [Zeo (competidor)](https://zeorouteplanner.com/bringg-competitors-7-cost-effective-alternatives-for-2026/) |
| OptimoRoute · Track-POD · Route4Me | ~35 $/conductor · 29-49 $/usuario · 40-60 $/conductor | ídem |
| Routal (plataforma, Barcelona) | Light 99 $/mes con app de conductores | [Capterra](https://www.capterra.com/p/195153/Routal/) |
| **Flota Reparto** | **12 €/repartidor activo, mínimo 36 €/mes**; furgonetas, usuarios y tiendas sin cobrar | `PRECIOS.md` §3 |

Quién es: el súper que lleva la compra (Gadis), el distribuidor a negocios (Disgón), la mensajería local, la
farmacia o parafarmacia con reparto, la floristería, la lavandería, el e-commerce que reparte en su ciudad, el
catering. Y también las empresas de servicio técnico (visitas, no entregas): la misma app vale. Hoy esa gente
trabaja con WhatsApp, papel y Google Maps. Venta: una demo de 15 minutos («pega tu Excel»), prueba de 14 días, y
cada cliente trae de golpe 3-20 repartidores **con ruta real desde el primer día**. Es lo que a los autónomos les
falta y aquí viene de serie.

### 2.3 DSP de Amazon (B2B): lo que Hera cobra en EE. UU., nosotros lo tenemos en Europa

- **Hera**: 9 $ por conductor activo y mes, todo incluido (cuadrante, rendimiento, coaching, flota, mensajes,
  dispositivos, inventario), 45 días de prueba ([precios](https://www.hera.app/pricing), [FAQ](https://www.hera.app/faq)).
  **Sortd**: ~999 $/mes ([comparativa](https://www.automateboring.ai/sortd-vs-hera)). Otros (Drive-IQ, LMDmax):
  coaching sobre Netradyne/Mentor; precios no publicados. Todos de EE. UU.; en España no encuentro un equivalente
  (no verificado: puede haberlo sin web).
- Una DSP en España tiene «20 a 40 furgonetas y entre 30 y 70 conductores» (folleto de Amazon,
  [DSP_2_Brochure_ES](https://m.media-amazon.com/images/G/01/DSP2/DSP_2_Brochure_ES.pdf)). Con Flota Pro a 9 €/vehículo:
  180-360 €/mes por DSP. Amazon anuncia 1.900 M$ más en el programa DSP para 2027 (EE. UU.,
  [aboutamazon](https://www.aboutamazon.com/news/transportation/amazon-dsp-program-investment-2026)): el programa crece.
- Lo que tenemos que Hera no: IA de daños y «quién causa los golpes» (el coste número uno de una DSP son los
  golpes y el renting), estado de la flota, taller, vencimientos, incorporaciones y empleo, plantilla del día,
  furgonetas fijas, todo en español y sin instalar nada. Lo que Hera tiene que nosotros no: avisos push nativos,
  scorecard y coaching **sobre los datos de Amazon** (y ahí está el muro, ver abajo), años en el Vendor Exchange.
- **El muro**: `REVISION_LEGAL.md` §0. Amazon pidió el 24-09 inventario y borrado de los datos sacados de Cortex;
  el 26-09 se copiaron a Flota, al PC y a R2. El plan A-G lleva un mes esperando el sí de Dani. Mientras esté
  abierto, Flota no se enseña a ninguna otra DSP: la primera pregunta de un dueño de DSP será «¿y Amazon qué
  dice?». La respuesta tiene que ser «nunca tocamos vuestros sistemas; todo lo mete la oficina a mano» y ser
  verdad en la base de datos, no solo en el código.

### 2.4 El tamaño del pastel (solo orientativo)

Optimización de rutas: entre 7,6 y 11,3 mil millones de dólares en 2025 según el vendedor del informe, Europa un
26-28 % ([NextBillion](https://nextbillion.ai/feeds/blog/route-optimization-software-market),
[Fortune](https://www.fortunebusinessinsights.com/route-optimization-software-market-117193)). Software de última
milla: 3-10 mil millones según definición. Son cifras de informes de pago, dispares entre sí: sirven para saber que
el mercado existe y crece dos dígitos, no para decidir nada.

### 2.5 Un viento a favor en España que nadie de las apps de autónomos usa

Desde el **5 de octubre de 2026** el documento de control del transporte (DeCA) es electrónico y obligatorio en el
transporte público de mercancías por carretera (Ley 9/2025, DT 8.ª; Resolución de 5-6-2026): un PDF generado por
programa, con QR, sin anotaciones a mano; no llevarlo es falta grave de 401-600 €
([Edicom](https://edicomgroup.com/es/blog/documento-control-administrativo-electronico-deca),
[GA_P](https://ga-p.com/publicaciones/guia-para-no-perderte-con-el-nuevo-deca)). **No he podido confirmar** si
alcanza al autónomo de paquetería o a la furgoneta de reparto propio: que lo mire la gestoría. Si alcanza, generar
el DeCA desde la ruta es una función que ninguna app de rutas de autónomos tiene y que vende sola.

## 3. Lo visto hoy en producción (con su prueba)

1. **El píxel de Meta no está cargado en la web.** En flotadsp.com, desde el navegador (no la app):
   `typeof window.fbq === 'undefined'`, ningún script de facebook ni tiktok, y el aviso de cookies sale en modo
   informativo («No usamos cookies de seguimiento ni marketing»), que es lo que `metaPixel.js` hace cuando
   `VITE_META_PIXEL_ID` está vacío al compilar. La web se desplegó el 29-10 a las 20:40 desde el PC con el
   comando de `ESTADO.md` → «Cómo desplegar», **que no lleva `VITE_META_PIXEL_ID`**. Consecuencia: las campañas de
   Meta (el único canal que trae altas) no reciben el evento `Lead` ni `CompleteRegistration` y optimizan a
   ciegas, y «de dónde salen las altas» solo se ve por utm. Arreglo: desplegar la web con el píxel (el nuevo
   `desplegar.yml` ya lo cose; falta que Dani ponga los tres secretos) y añadir la variable al comando de ESTADO.
2. **Dos marcas en un dominio.** `/`, `/repartidores` y `/empezar` son **FDS** (logo cian, fondo oscuro, «Empezar
   gratis»). `/planes` es **Flota** (logo naranja, otro tema, «Acceder»). El panel es Flota en tema claro. Quien
   pulsa «Planes» desde FDS cambia de empresa sin saberlo.
3. **Títulos de pestaña.** `/empezar`, `/planes`, la ruta (`/conductor?vista=ruta`) y el panel se titulan
   «Flota — Gestión de flotas con IA». Solo `/` y `/repartidores` ponen el suyo (`document.title` existe en
   `Landing.jsx` e `Iphone.jsx`). Es lo que sale en Google, en el historial y al compartir.
4. **«Oferta fundador · quedan 10 de 10 plazas»** en `/planes`. Dice que no hay ningún cliente. O se quita el
   contador o se deja «plazas limitadas» sin número.
5. **El aviso de cookies tapa un tercio de la primera pantalla en el móvil.** Sin píxel no hace falta ninguno
   (LSSI 22.2, como ya hace la app instalada). Con píxel, hace falta consentimiento, pero cabe en una tira de dos
   líneas abajo, no en un cartel. El 100 % de las altas entran desde el móvil y el 70 % desde Instagram o Facebook
   (`PLAN-1000.md`): esa pantalla es el anuncio.
6. **La app nativa no la he podido ejecutar** (aquí no hay emulador). Por el código es Material 3 de libro: correcta,
   accesible (TalkBack cuidado), pero sin nada que la haga reconocible. El riesgo es que parezca «una app de Compose
   más». Dani ya la probó en el móvil (2.2.4) y la dio por buena: me fío de eso para lo funcional, no para el «wow».
7. **Lo que está bien y hay que decirlo**: la portada de FDS en el móvil es clara («La app de reparto gratis que
   ordena tu ruta sola», botón, «Probarla ahora sin registrarme»); la demo abre en 5 s con paradas reales de la
   ciudad; el panel en 375 px funciona y tiene barra inferior de 5; nada se rompió en toda la vuelta.

## 4. Qué quitar (y por qué)

| # | Qué | Por qué | Esfuerzo |
|---|---|---|---|
| Q1 | **Valor (apuestas) fuera del repo, del servidor y del clúster** | Un escáner de apuestas dentro de un SaaS de logística es un riesgo de reputación, de revisión de Play (la app de empresa abre el panel en un WebView) y de cualquier conversación con un cliente o inversor que mire el código. Corre en el mismo proceso que atiende a los clientes. Que viva en su propio repo y su propia app de Fly | M |
| Q2 | Tienda de ropa, mercadillo, casas de alquiler, renting como páginas de producto | Dispersan al equipo y al menú. Lo que sea solo de Dani, solo super-admin (parte ya lo es); lo demás, congelado | B |
| Q3 | China (`/cn`, `i18nZh`, la TWA `android/`) | Nadie llega de allí; cada cambio de la web lo arrastra | B |
| Q4 | 7 idiomas en la app de ruta → **es, pt-BR, en** | Los 4 restantes (fr, it, de, zh) no tienen una sola alta medida. Cada función nueva cuesta 7 textos | B (congelar) |
| Q5 | Tres superficies de la app del repartidor (web, TWA, nativa) → **nativa en Android, web en iPhone** | Hoy se mantienen tres; la TWA ya no se usa fuera de China | B |
| Q6 | Las 4 rutas heredadas sin consumidor, las envolturas muertas y el lector de etiquetas duplicado (un JSON de casos) | `ESTUDIO_APP.md` §3.5 | B |
| Q7 | **Tres ofertas a la vez**: «gratis sin límite hasta el 31-12» + «25 € por tu primera ruta» + «10 € por amigo» | Confunden y atraen cazadores de bonos: la campaña «gana10» trajo 14 altas y 1 parada. Quedarse con **una**: los 25 € por la primera ruta real (es el incentivo de activación, no de alta). El premio por amigo vuelve a 2,50 € y solo se enseña dentro de la app, nunca en el anuncio. Y **tope** a los 25 €: los 100 primeros, y se mira el fraude antes de seguir | B (decisión) |
| Q8 | «Quedan 10 de 10 plazas» | §3.4 | B |
| Q9 | El cartel de cookies | §3.5 | B |
| Q10 | «Flota» como marca en `/planes` para quien viene de FDS | §3.2; ver §6 «una marca, dos puertas» | M |

## 5. Qué añadir, por público

Lo de `ESTUDIO_APP.md` (FCM, cola, bono, WhatsApp con hora, olvidé mi contraseña, mañana, pago en la app, voz,
idiomas, firma, mapa real, letra grande, índices, OSRM propio…) sigue en pie y en su orden. Esto es lo que va por
encima o al lado.

### 5.1 Para el autónomo

| # | Qué | Por qué | Esf. |
|---|---|---|---|
| A1 | **La nativa, a la par de la web antes de un solo anuncio más** (voz, seguimiento, pago, push, pt/en) | El anuncio lleva a Play; lo que se instala desde Play hace menos que lo que se promete. Es la primera causa de «no supe usarla» que podemos arreglar | A |
| A2 | **El «ticket del día»**: al acabar la ruta, una tarjeta bonita (entregas, km, horas, € ganados, €/hora, gasolina) para el estado de WhatsApp, con tu enlace de invitación | «Comparte tu día» existe (`compartirDia.js`) pero no es la joya de la app. Lo que un repartidor enseña a otro es cuánto ha ganado y a qué hora ha acabado. Para, Gridwise y Solo crecieron enseñando el dinero (§7) | B-M |
| A3 | Resumen semanal el sábado (correo y aviso): días, entregas, mejor día, €/hora | La recompensa que hace volver; solo a quien ha repartido | B |
| A4 | **El dinero del autónomo de verdad**: gastos con foto del ticket (gasolina, peajes), km del mes, y el trimestre listo para la gestoría (IVA/IRPF) | «El mes para la gestoría» y la calculadora ya existen; cerrarlo con gastos lo convierte en la herramienta que abre cada día aunque no ordene ruta | M |
| A5 | DeCA desde la ruta (si aplica, §2.5) | Nadie lo tiene; la multa lo vende | M (tras confirmar) |
| A6 | Preparar mañana (hoy/mañana al cargar después de las 18:00) | `AUTOCRITICA` #2; Circuit y Zeo planifican por fecha | M |
| A7 | iPhone: seguir en web, **sin** App Store por ahora | Cuesta 99 $/año y un envoltorio; no cambia la activación. Se revisa cuando haya 100 días reales | — |

### 5.2 Para nosotros (OGA5, DGA1, DGA2)

| # | Qué | Por qué | Esf. |
|---|---|---|---|
| N1 | **Avisos push nativos (FCM)**: turno aceptado, vacante, inspección pendiente, mensaje de la oficina, con «leído» | Lo pediste el 18-10 («mejor notificación propia que WhatsApp») y sigue sin existir; el servidor ya lo manda por web push y en la app de Play no llega nada | A |
| N2 | **«Mi día» como pantalla de inicio en el móvil del jefe de nave** a las 6:30: quién falta, quién sin furgoneta, auditorías sin hacer, qué vence hoy, qué furgoneta no sale | `MiDia.jsx` existe; que sea lo primero y que quepa en una pantalla de móvil | M |
| N3 | **Vencimientos de personas**, no solo de furgonetas: carnet, DNI/NIE, permiso de trabajo, reconocimiento médico | La ficha guarda «Nº carnet» (`Conductores.jsx:1300`) y no vi fecha de caducidad. Un conductor con el carnet caducado al volante es el riesgo más caro que tiene una DSP | B-M |
| N4 | Firma de la inspección en la nativa, auditoría que sobreviva a que Android mate la app | `ESTUDIO_APP.md` #17-18 | M |
| N5 | WhatsApp con los conductores: o se configura (`WHATSAPP_*` sin poner) o se quita la pantalla «Conversaciones» del menú | Una pantalla que no funciona cuesta confianza | B |
| N6 | Scorecard y coaching semanal por conductor **con datos metidos a mano por la oficina** | Es lo que vende Hera. Solo cuando el plan A-G esté cerrado y Winiw/Amazon lo hayan dado por escrito | A (bloqueado) |

### 5.3 Para empresas que ponen repartidores (el plan Reparto)

| # | Qué | Por qué | Esf. |
|---|---|---|---|
| E1 | **La página `/empresas-de-reparto`** (o «/para-equipos»): qué ve la oficina, qué ve el repartidor, 12 €/repartidor, «pega tu Excel y en 5 minutos tienes rutas», demo del panel de reparto con datos de ejemplo, prueba 14 días | Es el segmento con mejor precio relativo (§2.2) y no tiene ni una página. `PLAN-1000.md` canal 8, pendiente desde el 10-10 | M |
| E2 | **Aviso automático al cliente final** (WhatsApp o SMS) con la hora estimada y el enlace de seguimiento, al ordenar y al estar a 2 paradas | Hoy lo manda el repartidor a mano desde su móvil. Para un súper es la función. Coste: precio de Meta por mensaje de utilidad (~0,02-0,05 €, confirmar en la tabla oficial) repercutido | M |
| E3 | **Prueba de entrega en PDF por pedido, informe del día y cierre de caja** (cobros por repartidor y forma de pago) | `Reparto.jsx` no exporta nada (comprobado). Es lo que pide la contabilidad del cliente y lo que se reclama cuando un cliente dice «no me llegó» | M |
| E4 | **Seguimiento con el logo y el nombre de la empresa** | `SeguimientoPedido.jsx` no pinta logo. La página de seguimiento es lo único que ve el cliente final: con su marca, el súper lo enseña; con la nuestra, no | B |
| E5 | Plantillas de importación por sector (súper, distribución, mensajería) y, después, conectores (Shopify, WooCommerce, PrestaShop) | Hoy «pega tu lista» vale para todos; los conectores solo cuando dos clientes los pidan (no verificado que los pidan) | B / A |
| E6 | La nativa abre jornada, manda posición y recibe mensajes de la oficina | `ESTUDIO_APP.md` #22; sin esto los conductores con la app de Play no salen en el mapa de la oficina | M |
| E7 | Multi-día, recogidas y devoluciones como ciudadanos de primera | Hoy existen «recoger» y «reintentar mañana»; hace falta que la oficina las vea y planifique | M |
| E8 | Alta guiada con llamada de 20 minutos (Dani o quien sea) para los 10 primeros clientes | Cada uno trae 3-20 repartidores activos; vale más que 100 altas de anuncio | B (tiempo de Dani) |

## 6. Qué tendría sentido y qué no

**Tiene sentido**

- **Una marca, dos puertas, un motor.** Una sola identidad visual (la de FDS, que es la que funciona) y en la
  portada dos botones: «Reparto yo» y «Tengo repartidores / una flota». `/planes` con el mismo logo y el mismo
  tema. El panel, con el tema de la marca. Las dos puertas comparten servidor, app y cuenta.
- **El B2B como motor de activación.** Cada empresa que entra pone 3-20 repartidores con ruta real el primer día.
  Son los «días reales» que el autónomo suelto no da. Y cada repartidor de empresa es un autónomo potencial cuando
  cambie de trabajo (la cuenta es suya).
- **España, Portugal y México**, en ese orden. Routal apunta a los mismos tres. El resto de Latinoamérica llega
  solo si llega, sin invertir.
- Mantener el precio. Está bien en los tres casos. Lo que falta no es precio, es que alguien lo use cada día.
- Infraestructura propia antes de cobrar a una empresa: OSRM y geocodificador propios (unas decenas de euros al
  mes en Fly o Hetzner, cifra exacta sin verificar), una base con réplica o gestionada, y medir errores en la
  nativa (no hay Crashlytics ni Sentry: comprobado en `app-android/`).
- Cobrar en la app vía web (Stripe) desde la Cuenta, y no Play Billing, mientras no haya cuenta de empresa en
  Play. Las reglas de pagos alternativos en el EEE cambian: confirmar antes del 31-12.

**No tiene sentido (y lo dicen los datos)**

- Más funciones para el autónomo antes de que alguien haga un día real. (Lo dicen la autocrítica, el estudio y
  este informe: tres veces.)
- Medallas, rachas, rankings, «ahorras 2 h». Ni testimonios inventados ni cuentas anónimas (`REDES.md` §1).
- Anuncios en TikTok (203 € → 0 altas) y publicar en grupos de Mercado Libre (los admins lo borran).
- 7 idiomas, China, iOS nativo ahora, conectores con ERP antes de que dos clientes los pidan.
- Vender «IA» al repartidor. Al repartidor le importan el tiempo y el dinero. La IA vende a la oficina (los
  golpes), y ahí sí hay que contarla.
- Pagar 25 € a todo el que llegue, sin tope y sin mirar el fraude.
- Cambiar el nombre ahora. «flotadsp» lleva «DSP» dentro: para vender a una DSP es un guiño, para vender a
  cualquier otra empresa es ruido, y para Amazon es una bandera. Es un problema real, pero renombrar hoy cuesta
  más de lo que da. Que quede apuntado para cuando haya 10 clientes de pago: entonces un dominio neutro para FDS
  (y «Flota» como producto de empresa) sale solo.

## 7. Cómo viralizarnos (mecánicas, no deseos)

Lo que se sabe de cómo crecen las apps de repartidores: **Para** llegó a 250.000 descargas en semanas en 2021 sin
anuncios, porque enseñaba la propina que DoorDash escondía; corrió por TikTok, Reddit y grupos de Facebook de
repartidores ([Vice](https://www.vice.com/en/article/no-dasher-no-deliveries-doordash-drivers-strike-for-tip-transparency/),
[Data & Society](https://datasociety.net/research-library/deliver-us-from-tip-theft/)). **Gridwise** (300.000
conductores según ellos) creció enseñando lo ganado por hora y por plataforma ([gridwise.io](https://gridwise.io/features/earnings)).
La lección no es «hackea a Amazon» (ya sabemos cómo acaba): es que **lo que se comparte es el dinero y el tiempo,
y la pantalla que lo enseña es el anuncio.** En paquetería, además, la gente se ve cada mañana en la nave.

Mecánicas que se pueden construir con lo que hay, por orden de lo que creo que mueve:

1. **El jefe mete a los suyos** (E1 + E8). Una empresa de 15 repartidores son 15 usuarios con ruta real el lunes.
   Botón en el panel: «Invitar a mis repartidores» → 15 WhatsApp con pase de 72 h. Es el único mecanismo que
   crea días reales en bloque. Objetivo: 10 empresas en 60 días por contactos de Dani y la página nueva.
2. **El ticket del día en el estado de WhatsApp** (A2). Con el enlace de invitación dentro. Se mide por
   `utm_source=referido`. Sin premio en metálico en el anuncio; el premio está dentro.
3. **La nave**. Un cartel A5 con QR para la furgoneta y el tablón de la nave («¿Todavía ordenas la ruta a mano?»),
   y los 68 de OGA5 como primeros embajadores: ellos no necesitan la ruta (la da Amazon), pero conocen a los
   autónomos de las agencias de al lado. Medible con `utm_content=nave_<centro>`.
4. **La página de seguimiento** (E4 + el pie que ya existe): cada entrega de un súper es un cliente final que ve
   «hecho con FDS» y un negocio que ve que su vecino tiene seguimiento con logo y él no.
5. **Dani a cara descubierta**: «repartidor de A Coruña con su propia flota hace una app gratis» es una historia
   real que la prensa local y la de logística publica. Nota de prensa (canal 9 del plan, sin hacer), un día real
   grabado con la app de verdad (ya hay dos anuncios con su voz), y responder en hilos como FDS (`REDES.md`).
6. **La comunidad**: un grupo de Telegram o WhatsApp de repartidores autónomos llevado como FDS (no anónimo),
   donde se contesta en el día y se pide «¿qué le falta?». Los 40 de ahora son el germen; Barry (38 paradas,
   2 días) es la primera llamada.

Lo que NO va a viralizar: un vídeo bonito a público frío. Está probado: 2.005 visitas de TikTok y 0 altas; Spotify
con la URL rota; grupos que borran. Lo que viraliza aquí es la recomendación de una persona a otra en la nave, y
para eso tiene que haber, primero, una persona que haya hecho un día real y acabado antes.

## 8. Qué hace falta para ser la más potente del mercado

**Producto (lo que haría que alguien dijera «necesito esto»)**

- Para el autónomo: cargar la furgoneta escaneando y salir con la ruta hecha, voz, manos libres, «la última vez
  en esa puerta», y al final el ticket del día con lo ganado. Todo eso **existe en la web**; falta que exista en
  lo que se baja de Play y que vaya a 0,5 s. El «wow» ya está diseñado; hay que entregarlo donde se instala.
- Para la empresa pequeña: pegar el Excel y en 5 minutos ver a sus repartidores en el mapa, al cliente con su
  enlace, la prueba de entrega en PDF y el cierre de caja por la noche. Por 36 €/mes. Nadie da eso a ese precio.
- Para la DSP: el día del jefe de nave en el móvil, los golpes con quién y cuánto, el cuadrante que se hace solo,
  los vencimientos de furgonetas y personas, y avisos que la gente lee. Sin tocar Amazon.

**Técnica (lo que hoy nos tira abajo a los 100 usuarios)**

- OSRM y Nominatim/Photon propios; cola por empresa; la nativa con medición y errores; FCM; índices (hecho);
  `server.py` partido por dominio empezando por el reparto; base con réplica; copias probadas (hay vigilante).
- Un solo lector de etiquetas, un solo diccionario de textos (nativa a `strings.xml`), un solo sitio para cada
  precio y fecha (hecho para la promo).

**Negocio y legal (lo que hace que un cliente pueda firmar)**

- Cerrar el plan A-G de Amazon y poder decirlo por escrito. Razón social, CIF y domicilio en las páginas legales.
  Contrato de encargo (ya publicado) con esos datos. Gemini de pago antes de la IA de tickets.
- Cobro dentro de la app antes del 31-12 (el tope de 15 entra el 01-01 y la Cuenta de la nativa no tiene botón).
- Un canal de soporte que conteste en el día (WhatsApp Business o correo con SLA) y facturas automáticas.

**Equipo y proceso (lo que más se nota desde fuera)**

- Hoy, en un solo día, han trabajado tres o cuatro sesiones en paralelo (CI, estudio, anuncio ×2, redes, bono,
  despliegue): `ESTADO.md` tiene 2.300 líneas y «una sola sesión a la vez» ya no se cumple. Lo que distingue a
  un producto potente no es hacer más cosas, es hacer **menos y acabarlas**: una cola, un dueño, un «hecho» que
  signifique «en producción y medido».
- Una página (esta, resumida) que diga qué es Flota, para quién, y qué NO hacemos, y que cada sesión lea
  antes que `ESTADO.md`.

## 9. Plan de 90 días (y qué dejamos de hacer)

**Noviembre: arreglar la puerta y abrir la segunda**

1. Desplegar con el píxel (secretos en GitHub → `desplegar.yml`). Un solo logo y tema en toda la web; títulos
   por página; fuera «10 de 10»; cartel de cookies a una tira o fuera.
2. Decidir Amazon (A-G) y ejecutarlo. Sin esto, el punto 5 no se hace.
3. Una oferta: 25 € por la primera ruta real, con tope de 100 y revisión de fraude; «invita» a 2,50 € y solo dentro.
4. Nativa 2.2.5 a Play producción (cuando pase la revisión) y la 2.3 con FCM, pago desde la Cuenta (Stripe en la
   web) y pt/en. Nada más en la 2.3.
5. `/empresas-de-reparto` + «Invitar a mis repartidores» + llamada de 20 min. Objetivo: 5 empresas probando.
6. OSRM propio y medición en la nativa. Sentry o equivalente.
7. **Dejamos de hacer**: anuncios nuevos (hay dos montados), TikTok de pago, grupos de ML, idiomas nuevos, China,
   tienda/mercadillo, cualquier pantalla nueva del panel.

**Diciembre: que vuelvan**

8. Ticket del día + resumen semanal + preparar mañana. Aviso al cliente automático (E2) y PDF/cierre de caja (E3)
   para las empresas que estén probando. Seguimiento con logo.
9. Vencimientos de personas y «Mi día» móvil para nuestra flota. Cobro en la app en producción antes del 31-12.
10. Valor fuera del repo. TWA fuera. Idiomas congelados.

**Enero-febrero 2027: vender**

11. Con 3 empresas de pago y 30 días reales medidos: nota de prensa, Dani en hilos, la comunidad, el cartel de la
    nave. Entonces, y no antes, Meta a 30-50 €/día apuntando a paquetería autónoma y a dueños de negocios con
    reparto.
12. Flota para DSP: si A-G está cerrado y Winiw lo apoya, tres DSP conocidas de Dani como pilotos de 45 días con
    objetivos escritos (`PRECIOS.md` §5).
13. Partir `server.py` por dominios (reparto, portal del conductor, auth) y la capa de datos tipada en la nativa.

## 10. Cómo saber si funciona (las únicas cifras que mandan)

| Qué | Hoy | Objetivo a 90 días | Dónde se mide |
|---|---|---|---|
| Días reales (≥ 20 entregas a direcciones distintas en 2 días) | 0 | 100 | `tools/metricas/uso_altas.py`, embudo de activación |
| Autónomos que vuelven la semana siguiente | no medido en la nativa | 40 % de los activados | `/analitica/evento` desde la app |
| Empresas en prueba → de pago | 0 → 0 | 10 → 3 | Negocio |
| Repartidores de empresa con ruta real | 2 | 60 | `reparto_conductores` del mes |
| Coste por día real (anuncios + bonos / días reales) | ∞ | < 15 € | Meta + `correos_enviados` + cartera |
| Pedidos con enlace de seguimiento abierto por el cliente | no medido | se mide | `utm_source=seguimiento` |
| Errores en la nativa | no medido | medido | Sentry o equivalente |

## 11. Lo que decides tú

1. **Una marca o dos.** Mi recomendación: una (la de FDS), dos puertas. Si quieres dos, entonces dos dominios.
2. **Amazon (A-G)**: sí o no, esta semana. Sin esto, ni DSP ni dormir tranquilo.
3. **La oferta**: una sola (25 € por la primera ruta, con tope) o seguir con las tres.
4. **Dónde van los anuncios de noviembre**: a nadie (mi recomendación hasta tener 30 días reales) o a paquetería
   autónoma con 15 €/día y el píxel puesto.
5. **Reparto para empresas como prioridad número uno de ventas** (tus contactos, Gadis, Disgón, Auto Radio) o
   seguir solo con el autónomo.
6. **Cobro en la app**: Stripe desde la web (mi recomendación) o Play Billing con cuenta de empresa.
7. **Valor fuera del repo**: sí (mi recomendación) o se queda.
8. **El DeCA**: que la gestoría confirme si aplica a nuestros clientes; si sí, se hace en diciembre.

## 12. Lo que no he podido comprobar desde aquí

La app nativa en un móvil o emulador; los valores de `VITE_META_PIXEL_ID` en despliegues anteriores (solo sé que
hoy no está); si Routal Drivers cobra algo en España; si existe un «Hera europeo»; cuántos autónomos de paquetería
hay en España; si el DeCA alcanza a nuestros clientes; qué pasó con Transportes Auto Radio (07-10); las cifras del
optimizador en Fly; y si alguien ha leído las respuestas de `/opinion`.

## 13. Fuentes (consultadas el 29-10-2026)

- Spoke (Circuit): [precios](https://spoke.com/route-planner/pricing), [App Store](https://apps.apple.com/us/app/spoke-route-planner/id1198232244), [Google Play](https://play.google.com/store/apps/details?id=com.underwood.route_optimiser), [reseña 2026](https://kardinal.ai/circuit-app-for-route-planning-review-and-alternatives/), [Upper sobre Spoke Dispatch](https://www.upperinc.com/blog/circuit-pricing/)
- Routal: [Routal Drivers](https://routal.com/en/blog/la-revolucion-del-reparto-para-autonomos-ya-esta-aqui-llega-la-nueva-app-de-routal-drivers), [planes de conductor](https://support.routal.com/en/articles/14470533-drivers-plans), [Capterra](https://www.capterra.com/p/195153/Routal/), [ronda de 1 M€](https://elreferente.es/?p=158907)
- Equipos: [Circuit for Teams (Levy)](https://fleets.levyelectric.com/compare/circuit-for-teams-pricing), [rfp.wiki](https://www.rfp.wiki/supply-chain-logistics-transportation/transportation-management-systems/last-mile-delivery-technology-solutions/circuit/routific), [Shipday vs Onfleet](https://www.shipday.com/post/6-best-onfleet-alternatives-for-delivery-teams-in-2026), [Zeo sobre Bringg y otros](https://zeorouteplanner.com/bringg-competitors-7-cost-effective-alternatives-for-2026/)
- DSP: [Hera precios](https://www.hera.app/pricing), [Hera FAQ](https://www.hera.app/faq), [Sortd vs Hera](https://www.automateboring.ai/sortd-vs-hera), [Amazon DSP 2026](https://www.aboutamazon.com/news/transportation/amazon-dsp-program-investment-2026), [folleto DSP España](https://m.media-amazon.com/images/G/01/DSP2/DSP_2_Brochure_ES.pdf)
- Viralidad: [Para en Vice](https://www.vice.com/en/article/no-dasher-no-deliveries-doordash-drivers-strike-for-tip-transparency/), [Data & Society](https://datasociety.net/research-library/deliver-us-from-tip-theft/), [Gridwise](https://gridwise.io/features/earnings)
- Mercado: [NextBillion](https://nextbillion.ai/feeds/blog/route-optimization-software-market), [Fortune Business Insights](https://www.fortunebusinessinsights.com/route-optimization-software-market-117193)
- DeCA: [Edicom](https://edicomgroup.com/es/blog/documento-control-administrativo-electronico-deca), [GA_P](https://ga-p.com/publicaciones/guia-para-no-perderte-con-el-nuevo-deca), [Docusign](https://www.docusign.com/es-es/blog/ley-de-movilidad-sostenible-establece-la-obligatoriedad-del-documento-de-control-del-transporte-docusign)
- Mercado Libre Flex (contexto LatAm): [The Logistics World](https://thelogisticsworld.com/actualidad-logistica/como-convertirse-en-repartidor-de-mercado-libre/)
