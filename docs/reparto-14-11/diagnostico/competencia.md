# Las apps de ruta que los repartidores sí usan, y dónde queda FDS

Fecha: 14-11-2026. Parte «competencia» del diagnóstico del 104 → 1.

## Qué he hecho y cómo repetirlo

Todo lo de esta carpeta (`.../scratchpad/reparto/diag/competencia`). No he tocado el repo ni producción ni he creado cuentas.

1. **Fichas públicas de Google Play** (España, México y EE. UU.) de Spoke (antes Circuit), Zeo, Routin, Route4Me y
   RoadWarrior, y la de FDS: `sh bajar_fichas.sh <id> ...` baja el HTML a `raw/` y `play_texto.py` saca el texto
   visible; `resumen_fichas.py raw/*.txt` saca nota, descargas, fecha y las reseñas que enseña la ficha. Resultado en
   `raw/resumen_fichas.txt` y `raw/play_*.txt`.
2. **Reseñas de App Store** del feed público de Apple (las 50 más recientes por país, es/mx/us/gb) de Spoke
   (id 1198232244), MyWay (1557014712) y Zeo (1525068524): `raw/rss_*.json`, leídas con `rss_resenas.py` →
   `raw/resenas_spoke_ios.txt` y `raw/resenas_myway_zeo_ios.txt`.
3. **Búsqueda pública de iTunes** («planificador rutas reparto» en España y «route planner» en EE. UU.) →
   `raw/itunes_lista.txt` (`itunes_lista.py`).
4. **Búsquedas en Play España** («planificador de rutas reparto», «ruta reparto», «ordenar ruta reparto», «app
   repartidor paqueteria») → `raw/play_busqueda_*.txt`.
5. **Precios de Spoke por país** de su propia web: `raw/spoke_pricing_{es,mx,gb,br}.txt`.
6. WebSearch/WebFetch para precios, ayuda oficial, historia de Circuit y foros (fuentes con fecha abajo).
7. El código de FDS (solo lectura) en `C:/Users/dlvie/foefa-p0` para la tabla final.

**Límites honrados:** Reddit no se puede leer desde aquí (la herramienta lo bloquea: «domains are not accessible»);
TikTok y YouTube no dan texto. No he instalado ninguna app en un móvil: «el primer minuto» de cada una sale de su
ayuda oficial, su ficha y lo que cuentan las reseñas, no de haberlo cronometrado. Intenté bajar más reseñas de Play
por su API interna y el sistema lo denegó; no lo rodeé. Las reseñas que cito son frases cortas sin nombre de autor.

---

## Lo encontrado, de más a menos grave

### 1. Nadie que busque en Play España encuentra FDS (captación) — PROBADO
En cuatro búsquedas de Play España sin sesión, FDS no sale ni una vez entre 15-22 apps por búsqueda; arriba siempre
están Spoke, Zeo, Maposcope, MyWay y Routin (`raw/play_busqueda_*.txt`: «FDS=0» en las cuatro). La ficha de FDS
dice **50+ descargas** (`raw/play_fds_es.txt:37`) frente a **10 M+** de Spoke, 1 M+ de Zeo, Routin, Route4Me y
RoadWarrior (`raw/resumen_fichas.txt`). En App Store España la búsqueda devuelve una nube de apps nuevas de 2026 con
0-4 valoraciones (`raw/itunes_lista.txt`): el hueco «app de ruta en español» ya está lleno de clones; salir en la
tienda no va a llegar solo.

### 2. La ficha publicada promete una cosa que la app no tiene y dice dos precios distintos (captación/alta) — PROBADO en la ficha y en la rama; SIN PROBAR en la versión publicada
La ficha de Play en vivo (actualizada el 8 nov 2026) dice: «Pruébala sin registrarte: abre la app y pulsa «Probar
sin cuenta». 7 días gratis.» (`raw/play_fds_es.txt:57`). En la rama a publicar:
- la nativa abre con solo «Crear mi cuenta gratis» y «Ya tengo cuenta» (`app-android/.../ui/acceso/Acceso.kt:149-152`);
- la web lo prueba al revés: `frontend/e2e/humo.spec.js:1806-1807` comprueba que «Probar sin cuenta» NO existe.
- y la ficha del repo (`app-android/play-listing/es-ES/full.txt`) dice «Gratis y sin límite hasta el 31 de diciembre»,
  no «7 días gratis».
Además la ficha viva mezcla repartidor con «Para la oficina: Vehículos, inspecciones con foto, taller, ITV»
(`raw/play_fds_es.txt:52-55`) y el desarrollador sale como «FDsp». Quien llega de Play lee una app de flotas y un
botón que luego no encuentra. La ficha buena ya está escrita en el repo; falta subirla.

### 3. Lo que más se queja la gente de todas estas apps no es una función: es pagar y que cambie (pago) — PROBADO en reseñas
El enfado de 1-2 estrellas más repetido es el cobro: subidas, cortes y apps que eran gratis y dejan de serlo.
- Spoke, App Store UK, 07-11-2025: «Had a 100% price increase on our monthly plan»; 14-03-2025: «Doubled price without notice».
- MyWay, App Store EE. UU.: «Was good… not worth the $80 per year» (15-08-2026); «now yall want to charge» (24-09-2026); UK 27-03-2026: deja de funcionar sin premium.
- Spoke México, 06-08-2025: «después de cancelarlo me sigue intentando cobrar».
- Zeo México, 29-10-2021: pagó y la app volvió a pedirle pagar con tope de 15.
Lo que se alaba es lo contrario: Routin por pagar solo lo que usas («It's pay as you need», Play EE. UU., 04-06-2021) y
MyWay por no tener ventanas de pago traicioneras («not once has there been a sneaky pop up», 27-10-2026).
**Para FDS:** el plan actual («gratis y sin límite hasta el 31-12, después 15 paradas al día o 9,99 €») es justo
el patrón que más odio genera: gratis y después tope. Si el 1-1-2027 se corta a quien empezó gratis, saldrán estas
mismas reseñas.

### 4. En España FDS cuesta el doble que la versión barata de Spoke (pago) — PROBADO
Spoke cobra por país (su web, `raw/spoke_pricing_*.txt`): España **Lite 4,99 €/mes**, Standard 9,99 €; México
MX$99/199; Brasil R$24,99/49,90; Reino Unido £9,99/19,99. Gratis: 10 paradas por ruta, rutas sin límite. FDS:
**9,99 €/mes** en España, MX$149, R$39,90, £8,99 (`frontend/src/lib/precios.js:151-155`), gratis 15 paradas al día
(`precios.js:112`). Ojo: el Lite de Spoke en España NO trae importar hoja, voz/cámara, ventanas horarias ni
«Locate packages» (su web: «Not included…»); el Standard sí, a 9,99 €. Es decir, FDS cobra lo mismo que el
Standard de Spoke y el doble que el Lite, sin la marca ni las reseñas. Otras: MyWay 15 paradas gratis por ruta y
$9,99/mes o $79,99/año (Routific, 22-10-2026); Routin 300 paradas gratis y créditos o anuncios para optimizar
(App Store); RoadWarrior $14,99/mes o $100/año (su ficha de Play); Zeo de pago por conductor para flotas (su web);
Straightaway 25 gratis, $9,99/mes (ficha de Play según tercero); Upper desde $50/usuario/mes sin plan gratis
(su web); Onfleet desde ~$619/mes y Detrack ~$29-39 por conductor (terceros 2026: solo referencia de empresa).

### 5. Que la app te deje en la puerta buena, no en la calle de atrás (navegar) — PROBADO que es la queja nº 1 de uso
Es la queja de uso más repetida en todas: Spoke EE. UU. 29-05-2026 «taking me to the street BEHIND the house»;
18-10-2026 «the wrong gate, street, entrance or route»; UK 09-11-2026 «Keeps sending me to the wrong address»;
RoadWarrior Play España 2021: «terminar en la parte de atrás del lugar»; Zeo EE. UU. 14-08-2025: alleys y patios
traseros; Routin Play EE. UU.: le manda a un rango de números, no al portal. Y la alabanza simétrica: MyWay EE. UU.
«you can set coordinates for like parking lot» (09-08-2026).
**FDS** ya tiene la base: «Situar la parada», chincheta fija y «Ya estuviste aquí»
(`frontend/src/pages/driver/SituarParada.jsx:3-10`) y la memoria del portal (`MemoriaPuerta.jsx:13-18`).

### 6. Recordar cada dirección: notas, código, dónde dejarlo (meter_paradas/entregar) — PROBADO que se pide; FDS lo tiene
Spoke Play España 26-10-2026 (4-5★): pide «algún directorio» para «direcciones recurrentes, con ciertas indicaciones
y notas». Spoke México 2021: «anotaciones por domicilio y que al llegar te las recordara». Spoke EE. UU.
16-04-2026: «I wish the notes updated across all routes»; 01-09-2025: guardar paradas en grupos. Ninguna de las
grandes lo vende como función. **FDS sí**: «Memoria de la puerta» (portal, dónde dejarlo, cómo se entra; caduca al
año, la dice la voz al llegar). Es de lo poco que FDS tiene y la gente pide con sus palabras.

### 7. Meter una parada desde un enlace de WhatsApp o de Google Maps (meter_paradas) — PROBADO que se pide; en FDS no lo encuentro
Spoke Play España 16-10-2026: los clientes le mandan la ubicación por WhatsApp y tiene que copiarla a mano; pide
«compartir directamente el enlace o la ubicación». Spoke México 28-09-2025: quitaron los plus codes y «es hora de
cancelar mi suscripción». Routin dice que lo hace («Add shared locations from supported apps directly as stops»,
su ficha). **FDS:** la nativa acepta compartir texto, imagen y PDF (`AndroidManifest.xml:83-95`), pero no encuentro
código que lea un enlace `maps.app.goo.gl`, unas coordenadas pegadas o un plus code: el único rastro es un comentario
que trata la URL como «basura» al limpiar direcciones (`backend/server.py:48213`). Búsqueda: `grep -rn "goo.gl\|maps.app"`
en backend, frontend y nativa → solo ese comentario. Sospecha fuerte, no lo he probado en un móvil.

### 8. El primer minuto: Zeo deja hacer la primera ruta sin cuenta; FDS y Spoke piden cuenta (alta) — PROBADO en fichas y código
- **Zeo** (ficha de Play): «No Sign In, No Credit Card details required to create your first route.»
- **Spoke**: hay que entrar (reseña UK 25-05-2026: entró con su número y le llegó spam; reseña EE. UU. 20-06-2025:
  se quedó atascado en «what best describes your job?»). Su ayuda oficial: crear ruta → añadir paradas (buscar,
  voz, escanear una etiqueta, foto de la hoja/manifiesto, PDF, hoja de cálculo en Android, mantener pulsado el mapa,
  copiar de una ruta pasada) → Optimizar → Empezar. Con más de 10 paradas sale la prueba de Standard (routeplannerhelp.spoke.com).
- **Routin**: 300 paradas por ruta sin pagar; optimizar gasta créditos que se ganan viendo anuncios o comprando.
- **Google Maps**: gratis, 10 paradas como mucho y sin ordenar (varias guías 2026; sin fuente oficial de Google).
- **FDS**: alta con nombre, correo, contraseña y casilla (`frontend/src/pages/AltaRapida.jsx`), y la nativa no deja
  ver nada sin cuenta (`Acceso.kt:149`). Existe una demo sin registro, pero es para encargados de súper
  (`frontend/src/pages/PruebaReparto.jsx:7-12`), no para el autónomo.
**Con 100 paradas:** Spoke y MyWay sin límite pagando (MyWay hasta 200, Upper 250+), Routin 300 gratis, Google Maps
imposible. Lo que sufre la gente con muchas paradas es meterlas: Spoke EE. UU. 2021: «Spent an hour manually entering
about 86 stops»; Zeo España 2023: más de 200 a la semana y la voz escribe los números en letras; Zeo Argentina
31-10-2026: al cargar 20 direcciones repite unas y se come otras.

### 9. Las actualizaciones que rompen o quitan cosas espantan a los fieles (volver_otro_dia) — PROBADO en reseñas
Spoke tras el cambio de nombre: «One day it's called Spoke instead of Circuit and all the features are different»
(EE. UU. 14-11-2025); quitaron editar la ruta a mano (UK 08-02-2026); paradas que desaparecen del mapa (España
31-07 y 05-08-2026). MyWay con su versión 3.0 (UK 29-10 y 02-11-2026; EE. UU. 05-11-2026). Para FDS, que acaba de
mover botones («Navegar» pasa a «Ir», «Escanear» a la cabecera, etc., `play-listing/NOVEDADES-2.4.6.md`), es un aviso:
a quien ya reparte no se le cambia el sitio de las cosas sin decírselo.

### 10. Lo que la gente dice que le hace pagar (pago) — PROBADO en reseñas y webs
- **Ahorro de tiempo**: «ahorro hasta una hora y media en cada día» (Spoke España 2023), «saves me at least 40miles
  per day» (Spoke UK 2024). Es EL argumento de las fichas («ahorra una hora al día»).
- **Sin límite de paradas** (el muro de 10 de Spoke es lo que convierte: «as my route grew… (more than 10 stops)», UK 2024).
- **Fotos del paquete y saber dónde va en la furgoneta**: «being able to add pictures. Makes sorting through loads
  much easier» (Spoke UK 17-01-2025); «take pictures of the packages and automatically putting them in order» (EE. UU. 17-10-2026).
- **Escanear la etiqueta / la hoja** (Spoke EE. UU. 30-10-2025 «ability to scan addresses into routes»; MyWay UK
  28-01-2026: voz, texto y foto incluidos, que en su app anterior eran de pago).
- **Entrada por voz**: «Introducir las paradas por voz es lo mejor» (Spoke España 31-07-2025).
- **Ventanas horarias** cuando funcionan (FedEx: «20+ packages due by 10:30am», Spoke EE. UU. 26-07-2025).
- **Elegir el navegador** (Waze, Google Maps…): lo ofrecen Spoke, Zeo, Routin y RoadWarrior en sus fichas; y cuando
  Spoke obligó a su navegador propio, protestas (EE. UU. 14-11-2025).
- Varias furgonetas: lo venden como producto aparte para empresas (Spoke Dispatch, Routin-Team, Zeo Fleet, RoadWarrior Flex).

### 11. Cómo creció Circuit (mercado) — PROBADO con fuentes, la parte «boca a boca» es deducción
- Nace en 2016-2017 en Londres como planificador general; **los repartidores se lo quedaron** y el producto se giró a
  ellos (entrevista al fundador, TechRound, 13-05-2021).
- **Pagaba anuncios de Google primero**; en 2020-2021 montó SEO de «dolor» y páginas de «alternativas a X»: las visitas
  orgánicas pasaron de 920 a 14.577 en 6 meses y las pruebas de 59 a 244 (Grow and Convert, actualizado 13-01-2022).
- **El Covid**: en abril de 2020 diez veces más altas de repartidores que en febrero; triplicó ingresos ese año (TechRound).
- **Un día gratis a la semana**: «Circuit Thursdays», Premium gratis los jueves hasta finales de 2022 (página de
  marketing de Circuit enlazada en resultados de búsqueda; ya no carga) — y la reseña de Spoke México del 04-11-2021
  lo agradece: «los jueves te dan acceso ilimitado, ojalá que nunca lo quiten».
- **Las reseñas cuentan cómo se pasa de mano en mano**: «Me re comenzaron esta aplicación» (España 01-01-2026), «I was
  told about this app» (UK 2024), «I recommend it to every newbie» (Zeo, Play EE. UU. 2022), «Exelente herramienta
  sobretodo para un nuevo repartidor» (España 2023). Quien la recomienda es el veterano al nuevo que no conoce la zona.
- Hoy: 10 M+ descargas, 4,7 en Play con 189 mil reseñas, «#3 top en ingresos mapas y navegación» en España
  (`raw/play_spoke_es.txt`). En un foro español de 2025 un repartidor resume: usa Google Maps de apoyo y «hay gente
  que usa circuit» (Forocoches, 06-09-2025).

---

## 6. EL HUECO: lo que se pide una y otra vez y nadie da bien

| # | Necesidad del día de reparto | Quién la pide (fuente y fecha) | Quién la cubre | FDS |
|---|---|---|---|---|
| 1 | Llegar a la puerta/entrada buena, no a la calle de atrás | Spoke EE. UU. 29-05-2026 y 18-10-2026; Spoke UK 09-11-2026; RoadWarrior ES 2021; Zeo EE. UU. 14-08-2025; Routin EE. UU. 2022 | Nadie bien (MyWay deja fijar coordenadas) | Sí: Situar + «Ya estuviste aquí» |
| 2 | Recordar cada dirección: notas, código, dónde dejarlo, para la próxima | Spoke ES 26-10-2026; Spoke MX 2021; Spoke EE. UU. 16-04-2026 y 01-09-2025 | Nadie como función | Sí: Memoria de la puerta |
| 3 | Meter la ubicación que manda el cliente por WhatsApp / enlace de Maps / plus code | Spoke ES 16-10-2026; Spoke MX 28-09-2025 | Routin dice que sí | No lo encuentro |
| 4 | Ventanas horarias que de verdad ordenen (no «llegas 1 h antes y esperas») | Spoke ES 21-09-2025; Spoke EE. UU. 2021; Zeo UK 2020; MyWay EE. UU. 07-11-2026 | Mal en todas según reseñas | Dice que sí («el horario de cada cliente»), sin probar aquí |
| 5 | Mover una parada a mano, rápido, sin que la app «sepa más» | Spoke ES 30-06-2025; EE. UU. 26-09-2025 y 01-09-2025 («just let me organize it»); MX 2022; UK 08-02-2026 | Spoke lo quitó y lo puso a medias | Sin comprobar |
| 6 | Un precio estable, sin cortes ni subidas, o pagar solo los días que se usa | ver hallazgo 3 | Routin (créditos) | Hoy gratis; después tope de 15/día |
| 7 | Que no se cuelgue ni pierda paradas; que funcione sin cobertura | Spoke ES 31-07 y 05-08-2026; EE. UU. 30-07 y 01-08-2025; MX 18-08-2026 | Droppath dice offline | Dice que sí (sin cobertura) |
| 8 | Escáner que acierte ciudad y CP; voz que escriba números como números; importar sin duplicar | Spoke EE. UU. 23-09-2025; UK 2023; Zeo ES 2023; Zeo AR 31-10-2026 | A medias en todas | Escáner y hoja sí; calidad sin medir aquí |
| 9 | Encontrar el paquete en la furgoneta al llegar | Spoke UK 17-01-2025; EE. UU. 17-10-2026 | Spoke (Standard), Routin | Sí: Carga guiada, gratis |
| 10 | Moto y bici como vehículo de verdad | Zeo MX/RD 22-10-2026; Spoke ES 28-12-2024 (bici trazada como coche) | Mal | No lo encuentro |
| 11 | Kilómetros y no millas; evitar peajes que funcione | Spoke Play ES 11-09-2026 y 26-10-2026 | Spoke falla | Km sí (`region.js:85-87`); evitar peajes no lo encuentro |
| 12 | Verla en la pantalla del coche (CarPlay / Android Auto) | Spoke ES 25-04-2025, 25-01-2024; MX 20-12-2024 | Spoke en parte | No (`grep androidx.car` vacío) |
| 13 | Apuntar lo que se cobra en cada parada | Spoke UK 17-01-2025; Spoke MX 25-06-2021 | Routin | Sí: cobro efectivo/tarjeta/Bizum |
| 14 | Avisar de calles cortadas | Spoke UK 01-05-2026 | Nadie | DGT/ZBE: en parte (DGT es sobre todo carretera; sin probar en ciudad) |
| 15 | Que detecte bien que llegaste (ni a dos cuadras ni pasando de largo) | Spoke MX 14-05-2026; EE. UU. 14-07-2026; Zeo ES 2020 | Mal | Sin comprobar |

**Mi apuesta, las tres que harían decir «esto no lo tiene Circuit» y enseñárselo a un compañero:**
1. **La puerta que se recuerda** (filas 1 + 2): la segunda vez que vas a una casa, la app te lleva al portal bueno y te
   dice el código y dónde dejarlo, sin escribir nada. Se pide con esas palabras en español y nadie lo vende. FDS ya
   lo tiene a medias; hay que hacerlo lo primero que se ve y enseñarlo en 10 segundos de vídeo.
2. **Compartir la ubicación de WhatsApp y entra como parada** (fila 3): es el gesto de cada día en España y
   Latinoamérica, Spoke no lo hace y un usuario de pago se va por eso. Cabe en la puerta de «Compartir con FDS» que ya existe.
3. **Saber dónde va cada paquete en la furgo, gratis** (fila 9): Spoke lo esconde detrás del Standard (9,99 € en
   España); en FDS la carga guiada es gratis y además el hueco lo pone la app por el orden de la ruta. Se enseña en la nave, delante de todos.

---

## 7. Tabla: las apps frente a FDS

Fuentes: fichas de Play (`raw/`), webs de precios, ayuda oficial, y el código de FDS. «?» = no comprobado.

| | Spoke (Circuit) | Zeo | Routin | MyWay | RoadWarrior | Route4Me | Google Maps / Waze | **FDS** |
|---|---|---|---|---|---|---|---|---|
| Descargas Play | 10 M+ | 1 M+ | 1 M+ | (iOS 4,8 / 2.365 val.) | 1 M+ | 1 M+ | — | **50+** |
| Nota | 4,6-4,7 (189 mil) | 4,5 (36 mil) | 4,8 (27 mil) | 4,82 iOS | 4,0 | 4,4 | — | sin reseñas |
| Primera ruta sin cuenta | No (móvil) | **Sí** | ? | ? | ? | ? | Sí | No (la ficha viva dice que sí) |
| Gratis | 10 paradas/ruta, rutas ∞ | Prueba 7 días (su web; terceros hablan de 15 gratis) | 300 paradas; optimizar con créditos/anuncios | 15 paradas/ruta | Limitado | Prueba 7 días | Maps: 10 sin ordenar (guías 2026); Waze: no ordena rutas | ∞ hasta 31-12-2026; luego 15/día |
| Precio España | 4,99 € Lite / 9,99 € Standard | por conductor (flota) | $9,99/mes o créditos | ~$9,99/mes, $79,99/año | $14,99/mes, $100/año | ~$10/mes (reseñas) | Gratis | 9,99 €/mes, 99 €/año |
| Escanear etiqueta | Sí | Sí | Sí | Sí | ? | ? | No | Sí |
| Foto de la hoja / manifiesto | Sí | Sí | Sí (listas) | Sí | Subida FedEx/OnTrac | ? | No | Sí |
| Voz para meter paradas | Sí | Sí | Sí | Sí | ? | Sí | — | Web sí; nativa no la encuentro (`grep RecognizerIntent` vacío) |
| Excel/CSV | Sí (Android) | Sí | Sí | ? | Sí | Sí | No | CSV/pegar; Excel no (`MiRuta.jsx:1403-1408`) |
| Ubicación de WhatsApp / enlace Maps | No | ? | Sí | ? | ? | ? | — | **No lo encuentro** |
| Navegador a elegir | Sí + propio | Sí | Sí | Sí | Sí | Propio | — | Propio + Maps/Waze |
| Ventanas horarias | Sí (Standard) | Sí | Sí | Sí | Sí | Sí | No | Sí |
| Dónde va el paquete en la furgo | Sí (Standard, a mano) | ? | Sí | ? | ? | ? | No | **Sí, gratis y automático** |
| Prueba de entrega | En Dispatch | Sí | Fotos | Sí (reseña) | ? | ? | No | Sí (foto, firma) |
| Avisar al cliente | En Dispatch | Sí | SMS/WhatsApp plantillas | ? | Glympse | ? | No | Sí (enlace en el que contesta) |
| Recordar la puerta (código, dónde dejar) | No (lo piden) | ? | Agenda con notas | ? | ? | Agenda | No | **Sí** |
| Cobro en la puerta / lo ganado | No (lo piden) | Gastos | Importe por parada | ? | ? | ? | No | **Sí (Bizum, «Mi dinero hoy»)** |
| Moto / bici | Bici (mal según reseña) | No (piden moto) | ? | ? | ? | ? | Sí | No lo encuentro |
| CarPlay / Android Auto | Sí (según terceros) | ? | ? | ? | ? | ? | Sí | No |
| Cortes DGT y ZBE | No lo anuncian | No lo anuncian | No lo anuncian | ? | ? | ? | Waze: avisos | **Sí** |
| Plantilla diaria/DNR | No | No | No | No | No | No | No | Sí (módulo de la flota de Dani) |

**¿Le importa a alguien lo que solo tiene FDS?**
- **Memoria de la puerta**: sí, se pide con esas palabras (hueco fila 2). Es lo más valioso que tiene.
- **Carga guiada**: sí, la gente paga Spoke Standard por las fotos del paquete; FDS lo da gratis.
- **Cobro y «Mi dinero hoy»**: algo (dos peticiones encontradas). Bizum solo importa en España.
- **DGT/ZBE**: no he encontrado a nadie que lo pida; lo más cercano es una queja de calles cortadas en UK. Bonito, no mueve a nadie.
- **DNR / plantilla del día**: solo vale para repartidores de Amazon (la flota de Dani); para el autónomo que busca
  «ordenar ruta» no existe.

---

## Lo que funciona bien y no hay que tocar
- **Kilómetros según el país** (`frontend/src/lib/region.js:85-87`): justo lo que dos reseñas españolas de Spoke de
  septiembre-octubre de 2026 echan en falta.
- **Muchas formas de meter paradas en la primera pantalla** (etiqueta, hoja en papel, lista de WhatsApp/Excel, a mano:
  `MiRuta.jsx:2396-2400`) y **«Compartir con FDS»** para foto, captura, PDF o texto (`AndroidManifest.xml:83-95`): a la
  altura de Spoke, por encima de MyWay y RoadWarrior.
- **Situar la parada en el mapa propio** en vez de mandar a Google Maps (`SituarParada.jsx`) y la **memoria del portal**: es la respuesta a la queja nº 1 del sector.
- **La ficha del repo** (`play-listing/es-ES/full.txt`) habla al repartidor, con su precio claro. Lo que falla es que no es la que está subida.

---

## Las tres cosas que yo arreglaría primero y por qué
1. **Subir ya la ficha de Play buena y que diga la verdad.** La que está en vivo promete «Probar sin cuenta» y
   «7 días gratis», habla de ITV y taller, y la app de la rama no tiene ese botón. Quien llega por la tienda se encuentra
   otra cosa y se va. Es lo más barato y lo que más gente toca. (Hallazgos 1 y 2.)
2. **Dejar hacer la primera ruta sin cuenta (como Zeo) y pedir el correo al guardar o al terminar.** Hoy FDS pide
   nombre, correo y contraseña antes de enseñar nada; las grandes que crecieron (Spoke) se lo pueden permitir con 10 M de
   descargas y reseñas; FDS con 50 no. Y no cortar a nadie el 1-1-2027 sin aviso: es la queja que más estrellas quita en
   todo el sector; mejor un precio que no asuste (Spoke Lite cuesta 4,99 € en España) o pagar por días. (Hallazgos 3, 4 y 8.)
3. **Hacer de «la puerta que se recuerda» la razón para enseñarla, y añadir «compartir la ubicación de WhatsApp».**
   Es lo que los repartidores piden en español, ninguna grande lo da, y FDS ya tiene media parte hecha. Es lo que un
   veterano le enseña a un nuevo en la nave: así creció Circuit, de veterano a nuevo, con un día gratis a la semana y
   mucho anuncio y SEO detrás; las funciones solas no lo hicieron. (Hallazgos 5, 6, 7 y 11.)

---

## Fuentes (con fecha)
- Spoke, precios por país: https://spoke.com/route-planner/pricing/es (/mx /gb /br), leído 14-11-2026 (`raw/spoke_pricing_*.txt`).
- Spoke, planes: https://help.spoke.com/en/articles/1925291-spoke-products-pricing (31-07-2026).
- Spoke, crear ruta: https://routeplannerhelp.spoke.com/en/articles/9546292-how-to-add-stops-and-create-a-route (actualizado «hace 3 semanas», leído 14-11-2026).
- Spoke, foto del paquete / manifiesto: https://spoke.com/route-planner/product-updates (varias fechas; dictar lista 22-04-2026).
- Fichas de Play (leídas 14-11-2026): Spoke `com.underwood.route_optimiser` (act. 10-11-2026), Zeo `com.zeoauto.zeocircuit` (9-11-2026), Routin `tr.com.ussal.smartrouteplanner` (13-11-2026), Route4Me `com.route4me.routeoptimizer` (13-11-2026), RoadWarrior `com.roadwarrior.android` (12-11-2026), FDS `com.flotadsp.flota` (8-11-2026).
- Reseñas App Store: feed público https://itunes.apple.com/{es,mx,us,gb}/rss/customerreviews/id={1198232244,1557014712,1525068524}/sortby=mostrecent/json (leído 14-11-2026).
- Routin App Store: https://apps.apple.com/us/app/routin-route-planner/id1608488021.
- MyWay: https://help.mywayroute.com/what-is-myway-route-planner/how-much-does-myway-route-planner-cost ; precios en https://www.routific.com/blog/planificador-de-rutas-gratis (22-10-2026).
- Zeo: https://zeorouteplanner.com/pricing/ (leído 14-11-2026). Upper: https://www.upperinc.com/pricing/ (leído 14-11-2026).
- Onfleet y Detrack (terceros 2026): https://fleets.levyelectric.com/compare/onfleet-pricing ; https://costbench.com/software/last-mile-delivery/detrack/
- Circuit, historia: https://techround.co.uk/interviews/jack-underwood-co-founder-and-ceo-circuit/ (13-05-2021); SEO: https://www.growandconvert.com/content-marketing/scaling-seo-traffic/ (13-01-2022).
- Foro español: https://forocoches.com/foro//showthread.php?p=500530305 (06-09-2025); COPE, repartidor autónomo con 140 paquetes/día, 6:00-22:00 (10-07-2026).
- Xpedit (app española, 2025): https://www.xpedit.es/blog/mejores-apps-repartidores — ojo, dice que Circuit no tiene voz ni español, y la ayuda de Spoke prueba lo contrario: fuente poco fiable.
