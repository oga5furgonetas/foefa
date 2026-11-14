# El día real del repartidor autónomo de paquetería: quién necesita la app y quién no

Fecha: 14-11-2026. Parte: investigación en Internet (no se ha probado la app ni se ha tocado producción ni el repo).

## Qué he hecho y cómo repetirlo

1. Unas 25 búsquedas (WebSearch, varias en modo «extended») sobre cada red de reparto, las cifras del sector, las apps de rutas, los problemas del repartidor y los canales donde se informa.
2. He abierto con WebFetch las fuentes que importaban para leerlas yo y sacar fecha y frase exacta: hilos de Forocoches, ElOtroLado, Menéame y Foro Correos; artículos de Xataka, Xataka Móvil, COPE, Softzone, Economist & Jurist, El Mercantil, Águila Digital, Información Logística, The Objective, Transnova Avanza y la comparativa de Xpedit.
3. Solo he mirado en el repo lo justo para comparar (sin cambiar nada): `C:/Users/dlvie/foefa-p0/frontend/src/pages/driver/MiRuta.jsx`.
4. Lo que dice el resumen de un buscador y no he podido abrir yo lo marco como **(solo buscador)**. Las sospechas van como **sospecha**.

Límites honrados: no he encontrado datos fiables de MRW, Nacex, Envialia, Tipsa, CTT Express, DHL, UPS, FedEx/TNT, InPost/Mondial Relay, Celeritas ni Ecoscooting, ni de los repartos locales. No me invento sus casillas: en la tabla pone «sin dato». Tampoco hay cifras públicas del tamaño de los canales de repartidores en TikTok o YouTube.

## La tabla, red por red (lo que he podido probar)

| Red | Quién reparte | ¿La ruta llega ya ordenada? | Volumen y cobro | Prueba |
|---|---|---|---|---|
| **Amazon (DSP, app «Rabbit»)** | Asalariado de la subcontrata (DSP), con furgoneta de la empresa | **Sí.** «Ruta pre-establecida como tal sólo la ofrece la aplicación de Amazon». Se quejan de que da rodeos, pero llega hecha | 1.200-1.800 €/mes; entre 30 y 100 paquetes al día (300 en campaña); 9 h pagadas por ruta | ElOtroLado 13-04-2024 [1]; Softzone 15-01-2026 [2]; Forocoches 15-09-2024 [3] |
| **Amazon Flex** | Autónomo, por bloques de horas | La pone la app de Amazon (no lo he podido confirmar con una fuente española) | 14 € brutos/h, 10-12 € netos | Softzone [2] |
| **Correos** | Asalariado | El cartero ordena los envíos en la PDA escaneándolos en el orden que quiere. Desde el 08-07-2026 hay un piloto («Orión», USE de Valladolid) que calcula la ruta y el orden de carga | Nómina | Foro Correos 15-01-2021 [4]; Xataka Móvil 24-07-2026 [5] |
| **SEUR** | Autónomos y subcontratas de las franquicias | **No del todo.** Su app DeliveryPRO deja al repartidor fijar su propio orden y lo envía a SEUR con horas estimadas **(solo buscador; la ficha de Play da 404 hoy)** | Antes ~1,70-1,90 € por domicilio (2014-15, viejo) | Forocoches 2014-15 [6]; buscador [7] |
| **GLS** | Solo socios y empresas de transporte, no contrata repartidores | La app trae «un orden muy bonito», pero no sirve en la calle; meten las chinchetas en Google Maps | «Tienen que pelear constantemente para que les paguen» (foro, 2024) | Web de GLS [8]; ElOtroLado 04/13-04-2024 [1] |
| **Correos Express, DHL, Paack, Zeleris** | Subcontratas y autónomos | Igual que GLS: orden en la app que, según el repartidor, no sirve | Paack: 1,4-1,5 € por artículo (una oferta en Bilbao, **solo buscador**) | ElOtroLado 13-04-2024 [1]; [9] |
| **Cainiao / AliExpress** | Subcontrata con «autónomos» que el TSJCV declaró laborales | La app es obligatoria; la empresa asigna zona y ruta; multa de 20 € por dejar el paquete fuera de la zona | Cantidad fija por paquete | Economist & Jurist 29-10-2026 [10] |
| **El sector en general** | Cada vez más autónomos y subcontratas | — | 0,75-1,50 € por paquete entregado; más de 100 entregas al día; multas de hasta 40 € | Xataka 11-11-2025 (cita El Confidencial, abril 2025) [11] |
| MRW, Nacex, Envialia, Tipsa, CTT, UPS, FedEx/TNT, InPost, Celeritas, Ecoscooting, repartos locales | sin dato | sin dato | sin dato | No he encontrado fuentes que se puedan comprobar |

Etiquetas: no he encontrado ninguna fuente pública que lo cuente. Lo que sí está en el repo es que FDS ya lee el código 2D de SEUR/DPD, GLS y GS1, que según el comentario lleva la dirección exacta (`MiRuta.jsx:713`). Eso no lo he probado con una etiqueta real.

## Cuántos son (orden de magnitud)

- CNMC, informe del sector postal de 2025: unos 105.000 trabajadores postales. De ellos, **57.317 solo de paquetería**, 46.924 hacen paquetería y correo a la vez (casi todo Correos) y 433 solo correo. Fuente: Águila Digital, 13-08-2026 [12].
- 4.494 operadores inscritos, de los que **el 52 % son autónomos** (unos 2.300). Fuente: El Mercantil, 05-08-2026 [13]. Hubo 1.334,8 millones de paquetes en 2025 [13].
- Las empresas de última milla ya mueven el 37,5 % de los paquetes, más que Correos (15,8 %), y «casi el 70 %» de ellas se sostiene con autónomos. Fuentes: The Objective, 11-08-2026 [14]; Información Logística, 19-08-2026 [15].
- **Mi cuenta (sospecha razonada, no es un dato):** de esos ~57.000 de paquetería, quizá la mitad conducen. Si quito Amazon (ruta hecha) y Correos (nómina, PDA y ahora Orión), quedan **entre 15.000 y 30.000 repartidores** de SEUR, GLS, Correos Express, DHL, Paack, MRW y subcontratas que, según los foros, se ordenan la ruta ellos o con Google Maps. Ese es el mercado que de verdad podría necesitar un planificador en España. Es un mercado real, pero no es grande, y cada uno cobra muy poco por paquete.

## Qué usan hoy para ordenar la ruta

- **Google Maps con chinchetas y la memoria de la zona.** Es lo que más sale. «introducir en el Google Maps todas las chinchetas» (ElOtroLado, 13-04-2024 [1]); «Tira de Google Maps y te la haces tú mismo» (Forocoches, 18-07-2023 [16]). En una nave, el orden lo hace un compañero «a ojo» [16].
- **Saltarse el orden de la PDA** y agrupar por cercanía: «no hay que seguir al dedillo el predictor de la ruta» (Menéame, 2021 [17]).
- **Apps de rutas (competencia):**
  - Spoke (antes Circuit): gratis hasta 10 paradas; en España, 4,99 y 9,99 € al mes **(solo buscador)**.
  - Routin: gratis con anuncios, hasta 300 paradas, 4,7 estrellas con 25.400 reseñas en Play **(solo buscador)**.
  - **Xpedit**, española y de 2025: 4,99 €/mes, plan gratis de 10 paradas al día, voz, lectura de etiquetas y aviso al cliente (su blog, 14-02-2026 [18]). Está escribiendo justo los artículos que encuentra quien busca «app para repartidores», es decir, compite en el mismo hueco y por el mismo precio.
- En los foros españoles casi nadie nombra una app de rutas. En el hilo de 2023 [16] el autor ni conocía Circuit y lo descubre allí.

## Lo que les quita el sueño, por orden (de lo que he leído)

1. **Cobrar solo lo entregado, con descuentos y multas.** Un ausente no se cobra (COPE, 02-07-2026 [19]). Hay multas de hasta 40 € por una entrega mal hecha y de 20 € por dejar un paquete fuera de zona [10][11]. Las subcontratas pujan por el paquete más barato y lo bajan al repartidor [1].
2. **La presión por volumen y las jornadas largas:** 10-12 h y más de 100 entregas al día. Para quitarse trabajo marcan «incidencia» o «ausente» [11][17].
3. **Que les paguen la agencia:** «pelear para que les paguen» [1]; liquidaciones con retraso, cuando el plazo legal es de 30 días (Transnova, 30-10-2026 [20]).
4. **Aparcar, multas y ZBE:** faltan plazas de carga y descarga; a los carteros de Bilbao les multan (**solo buscador**).
5. **Preparar la ruta por la mañana y encontrar el portal:** existe (es lo que resuelve FDS), pero en los foros sale bastante menos que el dinero.

¿Dónde ayuda un móvil? En 1 y 3 sí, con una **prueba de cada entrega o intento** (foto, hora y GPS) para reclamar una multa o un «no recibido», y con el **recuento del día frente a lo que liquida la agencia**. En 5 también, que es donde ya está FDS. ¿Por cuál pagarían 5-10 € al mes sin pensarlo? **Sospecha:** por la que les devuelve dinero (una multa quitada o una liquidación cuadrada), no por la que les ahorra 15 minutos, que ya resuelven gratis con Google Maps o Routin. No he encontrado una herramienta para autónomos que haga lo de la prueba y el cuadre, pero tampoco lo he buscado a fondo: es una sospecha que hay que comprobar.

## Cómo se enteran de las herramientas

- Del compañero de la nave y del jefe de la subcontrata. Lo apunta el hilo de 2023 [16] («lo hace un compañero»), y la regla de la casa, porque la subcontrata decide la herramienta. No tengo cifras.
- TikTok: hay repartidores españoles con vídeos virales, como Kate (@kateperdo, COPE 02-07-2026 [19]) y Geni (Extremadura, COPE 31-05-2026, **solo buscador**). No he encontrado el tamaño de sus cuentas ni un canal grande y estable de repartidores de paquetería en España. Lo que más audiencia tiene en «repartidor» en español es de Mercado Libre en México y Argentina.
- Latinoamérica (en segundo plano): Mercado Libre Flex paga por paquete y semanalmente, y el repartidor acepta rutas ya agrupadas con pago y tiempo estimados (**solo buscador**, fuente débil). No he encontrado cómo se ordenan las paradas.

## Lo que funciona bien y no hay que tocar

- FDS ya tiene lo que vende la competencia española a 4,99 €: lee la etiqueta con su código 2D, usa la foto para lo que falte, dicta la dirección por voz y tiene carga guiada (`MiRuta.jsx:351`, `:713`, `:745-755`, `:796`). No he probado que funcione: lo digo por el código. Si funciona, **la falta de funciones no explica el 104 → 1**.

## Hallazgos, de más a menos grave

1. **El que manda en volumen (Amazon DSP y Flex) ya recibe la ruta hecha en la app de Amazon.** Para él, FDS sobra el día a día [1][2][3]. **Sospecha fuerte:** FDS nació de una flota de Amazon y su dominio es flotadsp.com, así que una parte de las 104 altas puede venir de repartidores de Amazon que no tienen nada que meter. Se comprueba mirando, en la base, de qué agencia o empresa dicen ser los que se dieron de alta y no metieron ninguna parada.
2. **Correos tampoco lo necesita:** van en nómina, con PDA, y desde julio de 2026 hay un piloto con ruta calculada por la empresa [4][5].
3. **El hueco real está en SEUR, GLS, Correos Express, DHL, Paack y las subcontratas.** Son entre 15.000 y 30.000 repartidores (estimación), que hoy usan Google Maps y la memoria. Están ocupando ese hueco con apps de 0-5 € (Routin gratis, Spoke y Xpedit a 4,99 €) [18].
4. **El dolor número uno es el dinero** (cobrar solo lo entregado, multas de 20-40 €, cobros que tardan), no el orden de las paradas [1][10][11][19][20].
5. **Ellos casi no buscan apps:** se enteran por el compañero y el jefe. Una ficha de Play sin valoraciones no la encuentra nadie.

## Mi conclusión, sin contentar a nadie

- **A quién le resuelve un problema diario:** al autónomo o asalariado de una subcontrata de SEUR, GLS, Correos Express, DHL o Paack en zona urbana o semiurbana. Sale con 80-150 paquetes, la app de su agencia le da un orden que no le sirve, y hoy pierde tiempo con Google Maps (10 paradas como máximo) o «de memoria» cuando le cambian de zona o hace una sustitución. Son decenas de miles, no cientos de miles, y pagan poco.
- **Al de Amazon y al de Correos no**, y es probable que buena parte de las altas sean de ese tipo (sospecha que hay que comprobar con los datos).
- **El mercado del planificador para autónomos en España es pequeño y ya tiene ocupantes baratos.** El problema más grande, y que no he visto cubierto (sospecha), es **demostrar y cobrar**: la prueba de cada entrega o intento frente a las multas y los «no recibido», y el cuadre de lo repartido frente a lo que paga la agencia.
- **El primer minuto:** que pregunte una sola cosa, «¿con qué agencia repartes?». Si dice Amazon o Correos, que no le prometa la ruta y le ofrezca lo que sí le sirve (prueba de entrega o registro del día) o le diga la verdad. Si dice SEUR, GLS u otra, «haz una foto a la primera etiqueta», y la parada aparece en el mapa en segundos. El que no mete una parada suya en el primer minuto no vuelve.

## Las tres cosas que yo arreglaría primero y por qué

1. **Saber de qué agencia es cada alta, y separar el embudo por agencia.** Si la mayoría de las 104 son de Amazon, el 104 → 1 no es culpa de la app sino de a quién se le ofrece. Es lo más barato de comprobar y lo que más cambia las decisiones.
2. **Que el primer minuto sea «foto a la etiqueta → parada en el mapa»** para SEUR, GLS y las demás, y no un formulario. La competencia vende exactamente eso a 4,99 €, y FDS ya lo tiene en el código (`MiRuta.jsx:713`).
3. **Probar el dolor del dinero antes de construir más ruta:** una «prueba de entrega e intento» (foto, hora y GPS en un PDF que se pueda enviar a la agencia) y un «resumen del día» para cuadrar con la liquidación. Es lo que les quita el sueño, lo que puede valer 5-10 € al mes, y a primera vista no lo ofrece nadie para el autónomo. Antes de hacerlo, se pregunta a 5-10 repartidores reales de SEUR y GLS.

## Fuentes (todas abiertas el 14-11-2026)

1. ElOtroLado, «¿GLS? ¿Va a superar a Seur…?», mensajes del 04 al 13-04-2024: https://www.elotrolado.net/hilo_gls-va-a-superar-a-seur-como-peor-empresa-de-reparto_2499910_s50
2. Softzone, sueldo del repartidor de Amazon, 15-01-2026: https://www.softzone.es/noticias/trabajo/salario-condiciones-repartidor-amazon-2025/
3. Forocoches, «Fui repartidor de Amazon…», 15-09-2024: https://forocoches.com/foro/showthread.php?t=10094052
4. Foro Correos, «PDA (ordenar envíos)», 15-01-2021: https://forocorreos.es/index.php?topic=1551.0
5. Xataka Móvil, Correos Orión, 24-07-2026: https://www.xatakamovil.com/movil-y-sociedad/correos-jubila-intuicion-cartero-software-dictara-sus-rutas-como-cargar-furgoneta
6. Forocoches, «Entrevista autonomo Seur», 2014-2015 (viejo; solo como contexto): https://forocoches.com/foro/showthread.php?t=3695137
7. SEUR DeliveryPRO en Google Play (descripción vista en el buscador; la ficha devuelve 404 el 14-11-2026): https://play.google.com/store/apps/details?id=com.seur.deliverypro
8. GLS, nuestros socios de transporte: https://gls-group.com/ES/es/sobre-nosotros/nuestros-partners/nuestro-socio-de-transporte/
9. Glassdoor, oferta de Paack (solo buscador): https://www.glassdoor.es/job-listing/repartidor-de-paqueter%C3%ADa-paack-JV_KO0,24_KE25,30.htm?jl=1009949705500
10. Economist & Jurist, TSJCV y la app Cainiao, 29-10-2026: https://www.economistjurist.es/actualidad-juridica/jurisprudencia/la-aplicacion-que-mandaba-mas-que-un-jefe-asi-ve-un-tribunal-a-los-repartidores-autonomos/
11. Xataka, el truco del «destinatario ausente», 11-11-2025: https://www.xataka.com/servicios/repartidor-dice-que-no-habia-nadie-casa-realidad-siquiera-paso-tu-calle-sintoma-sector-saturado
12. Águila Digital, cifras de la CNMC, 13-08-2026: https://aguiladigitalrd.com/economia/la-cnmc-pone-cifras-al-avance-de-los-autonomos-frente-a-correos-pedro-saura-en-la-ultima-milla/
13. El Mercantil, 05-08-2026: https://elmercantil.com/2026/08/05/la-paqueteria-supera-por-primera-vez-al-negocio-postal-tradicional-en-espana/
14. The Objective, 11-08-2026: https://theobjective.com/economia/transporte/2026-08-11/empresas-reparto-autonomos-correos/
15. Información Logística, 19-08-2026: https://informacionlogistica.com/la-ultima-milla-sostenida-por-autonomos-ya-mueve-mas-paquetes-que-correos/
16. Forocoches, «App de rutas de paquetes (portales)», 18-07-2023: https://forocoches.com/foro/showthread.php?t=9618056
17. Menéame, «Soy repartidor de paquetería…», noviembre de 2021: https://www.meneame.net/m/TeRespondo/soy-repartidor-paqueteria-respondo-tus-dudas-sobre-este-mundo
18. Xpedit, mejores apps para repartidores, 14-02-2026: https://www.xpedit.es/blog/mejores-apps-repartidores
19. COPE, Kate, repartidora, 02-07-2026: https://www.cope.es/actualidad/economia/noticias/kate-repartidora-paquetes-pagan-paquete-entregado-no-ausencia-deriva-punto-recogida-no-vas-casa-20260702_3396154.html
20. Transnova Avanza, guía del autónomo con agencias, 30-10-2026: https://www.transnovaavanza.com/trabajar-agencias-paqueteria-autonomo/
