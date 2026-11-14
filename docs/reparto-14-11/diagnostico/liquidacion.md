# El cuadre con la liquidación y la cuenta del día

Fecha: 14-11-2026. Parte: «¿llevan la cuenta de lo que reparten?, ¿les cuadra con lo que les pagan?, ¿con qué lo hacen?»

## Qué he hecho

- Unas 25 búsquedas (normales y «extended») sobre liquidaciones de agencias, descuentos, contra reembolso, plantillas, apps de ingresos de repartidores (EE. UU., Reino Unido, Brasil) y testimonios en foros y prensa.
- He abierto y leído yo mismo: COPE (Wilkins, Kate), noticiastrabajo (Emiliana), Xataka, Transnova (dos guías), informacionlogistica, nuevarevolucion (SEUR), elotrolado (GLS), cuatro hilos de Forocoches, Menéame, la petición de Change.org sobre Evri, el informe de Citizens Advice y la ficha de CourierLog en la App Store. No pude abrir bandaancha (403) ni el tablón del sindicato GMB (401).
- He leído el código de FDS (solo lectura): `frontend/src/pages/driver/MiRuta.jsx` (Mi dinero hoy, tarifa, cierre del día), `piezas/ResumenDia.jsx`, `pages/CalculadoraRepartidor.jsx` y en `backend/server.py` el `/reparto/mis-marcas` y el `PUT /reparto/ganancias`.

Lo que no tengo: ni una sola liquidación real de SEUR, GLS, MRW, Correos Express, DHL, Paack, Nacex o CTT publicada. No existen en abierto (o no las he encontrado). Todo lo que digo del formato sale de guías y testimonios.

## Hallazgos, de más a menos importante

### 1. En España casi nadie cuenta en público que su liquidación «no cuadre». El dinero que pierden es por reglas, no por errores de cuenta (matiza, fuerte)

Lo que se repite en todos los testimonios españoles de 2025-2026 es que **un ausente no se cobra**, que hay **sanciones** y que la factura bruta **no es lo que queda**. No es que la agencia cuente mal:
- Emiliana: «Me pagan 0,90 euros por paquete»; si hay incidencia «no me lo pagan». noticiastrabajo.es, actualizado 30-11-2025.
- Kate (TikTok): «nos pagan por paquete entregado», no por ausencia. COPE, 02-07-2026.
- Wilkins: facturó 4.000 € el primer mes, pero «eso no le queda a uno». COPE, 10-07-2026.
- Sanciones de hasta 40 € por una entrega mal gestionada. Xataka, 11-11-2025 (cita a El Confidencial, que no he podido abrir).
- SEUR: sanción por no repartir un paquete, por salirse de la franja de la app y por multas de aparcamiento (entrevista en nuevarevolucion.es, sin fecha visible, comentarios de 2021).

Con unas 25 búsquedas no he encontrado ni un solo caso español publicado de «me pagaron menos paquetes de los que entregué». Sí aparece:
- «tienen que pelear constantemente para que les paguen» (GLS y CTT con autónomos), de oídas, elotrolado.net, 04-04-2024.
- Pago a 60 días con financiera, o cobrar a fin de mes perdiendo un porcentaje (Forocoches, «solo buscador», sin fecha clara).
- Un intermediario que deja de pagar y quiebra: FedEx condenada a pagar 65.666 € a tres transportistas autónomos (Confilegal, 10-11-2026, «solo buscador»). Ahí el problema es que **no te pagan**, no que te cuenten mal.

**Conclusión:** el dolor de dinero existe, pero en España lo que se ve es «no cobro los ausentes», «me multan» y «me pagan tarde o no me pagan». No se ve «me cuentan mal». Que no aparezca no prueba que no pase. Sí dice que no es lo que la gente cuenta cuando se queja.

### 2. Donde sí hay errores de liquidación documentados, la prueba es la cuenta propia (apoya, media; es Reino Unido, no España)

- Un mensajero de Evri (Reino Unido, cobra por paquete) escribe que «Parcels I had completed were missing from invoices» y que lo descubrió «Counting completed parcels against invoices». Calcula unas 200-300 libras al mes de menos. Cita a otro compañero al que le faltaban «between 50 and 120 delivered parcels» (de segunda mano). Para reclamar reúne fotos, etiquetas, hojas de ruta y facturas. Change.org, actualización del 30-08-2026. Es una sola persona y Evri no responde en la página.
- Citizens Advice (30-09-2026, 50 repartidores): descuentos de 10 a 25 libras al día por retrasos o rondas sin acabar, y a algunos solo les pagan las entregas «con éxito». Solo el 25 % llega al salario mínimo una vez restados los gastos.
- El sindicato GMB habla de un «Invoice Deductions Issue» en Evri que la empresa aceptó devolver (2023-2024, «solo buscador», no pude abrir la página).

Es el mismo modelo que en España (autónomo, cobro por paquete) y aquí sí hay casos claros de facturas que no cuadran. Y cuando pasa, el arma es **la lista propia de lo entregado, con prueba**. Esto respalda más la parte (a) de la hipótesis (la foto sellada) que la (b) (la suma).

### 3. Las liquidaciones: mensuales, con 30 a 60 días de retraso y conceptos que el repartidor no ve en el día (apoya, media)

Esto sale de guías y foros, no de liquidaciones reales:
- **Cada cuánto y con cuánto retraso:** cada mes. La primera llega «a 30-45 días del arranque». Puede ser una autofactura de la agencia o una factura del repartidor. Transnova, 01-09-2026, actualizado el 30-10-2026. Es una cooperativa que vende su servicio a repartidores: tiene interés.
- **Conceptos:** la misma guía dice que la tarifa debería venir desglosada por parada, bulto extra, voluminoso, segunda visita, recogida y kilómetros hasta la nave. También dice que «la "ruta a X euros" sin desglose esconde los recortes» y que «los descuentos por "bulto no entregado" se discuten con fotos y trazas de la app». Su consejo: «documenta cada entrega y cada liquidación».
- **Otros modelos:** ruta a unos 80 € + IVA al día hasta unos 70 paquetes, y 90 € a partir de ahí (Transnova, 17-10-2026). SEUR, en 2018: 120-140 € + IVA al día (Forocoches). 1,50 € «por entrega y recogida» en una empresa nacional (Forocoches, 05-07-2023). Quien cobra **por día** no tiene nada que cuadrar paquete a paquete.
- **Incidencias que te cargan:** «Quien "pierde", paga» y una «compensación económica por mala praxis» por ausentes mal justificados (Forocoches, 05-07-2023, una sola persona).

**Lo que pesa para FDS:** si la liquidación llega un mes después y mezcla entregas, recogidas, voluminosos, segundas visitas y descuentos, una cuenta que solo hace «entregas × tarifa» **no va a cuadrar nunca** con ella. Para comparar de verdad haría falta saber qué es cada parada y apuntar los descuentos.

### 4. Cómo llevan hoy la cuenta: no se ve. Ni plantillas, ni apps en español, ni vídeos de «así cuadro mi liquidación» (tumba en parte, media)

- **Plantillas:** no hay ninguna gratis en español para un repartidor solo. Lo más parecido es un Excel de pago en Hotmart pensado para quien tiene **varios** repartidores («solo buscador»), y las plantillas de gastos del vehículo de Infoautónomos.
- **Apps en español:** no he encontrado ninguna que cuente paquetes para un repartidor por paquete. Las que hay son de comida o de taxi tipo Uber (DeliTiza, Driver Power) o programas de empresa (YoFacturo).
- **Lo que tienen ya:** la PDA o la app de la agencia registra cada escaneo. Eso es «la cuenta» que ya llevan sin hacer nada. Es una sospecha razonable (todas las agencias escanean), pero no he visto una captura de un resumen diario de una PDA.
- En los hilos de Forocoches sobre «¿cómo pueden vivir los autónomos?» (2021) y sobre el coche propio (2020) **nadie** dice cómo lleva la cuenta. Discuten la gasolina y la cuota.

### 5. Fuera de España sí hay apps de «lo mío», pero viven de lo que aquí no existe (matiza, fuerte)

- **Gridwise (EE. UU.):** unos 24.850 votos en la App Store con un 4,9 («solo buscador»). Otras fuentes dan desde 150.000 usuarios activos (MileageWise, 10-2025) hasta 1,3-2,6 millones de instalaciones (AppGoblin), cifras que no casan. Lo que valoran es que **junta automáticamente varias apps** (Uber, DoorDash, Instacart…) y que **apunta los kilómetros para Hacienda**. Una reseña: lo bajó para los kilómetros y ahora lo mira cada día por sus ganancias («solo buscador»).
- **Stride y Everlance:** viven de los kilómetros para deducir impuestos en EE. UU.
- **StopClub (Brasil):** unos 530.000 usuarios («solo buscador», fecha poco clara). Lo que engancha es ver **antes de aceptar** cuánto da un viaje por km, rechazar los malos de forma automática y una cámara para defenderse de acusaciones. Es para conductores de Uber, iFood y similares, no para paquetería.
- **CourierLog (Reino Unido):** es justo «la cuenta de lo mío» del mensajero por paquete: paquetes y kilómetros por jornada, tarifa normal y tarifa baja, semana, mes y año fiscal. Es gratis, solo para iPhone y **sin bastantes votos para mostrar una nota** (lo comprobé el 14-11-2026). Es la prueba más directa de esta parte: alguien lo construyó para el mismo oficio y casi nadie lo valora.

**Por qué no se trasladan:** el repartidor español de agencia trabaja para **una** agencia (no hay nada que juntar), no deduce kilómetros con una tarifa fija como en EE. UU., y no elige pedido a pedido (no hay «rechaza este»). Los tres motivos que hacen que se abran esas apps cada día **no existen aquí**.

### 6. El contra reembolso es poco y no es un dolor visible (tumba ese punto, media)

- Entre el 1 y el 2 % de las compras por internet en España (estudio de CTT Express, «solo buscador», sin fecha confirmada; IESE-Veepee, gráfico difícil de leer).
- SEUR, 2021: al acabar el día «etiquetamos, liquidamos cobros». Existe, pero nadie se queja de descuadres. Las quejas de efectivo que salen son de clientes de Rappi y Uber Eats en Chile (reclamos.cl), no de paquetería en España.
- FDS ya tiene «Cobrado» por forma de pago en el cierre del día. Para esto basta.

### 7. «Lo que me queda limpio»: les importa antes de firmar, no cada día (matiza, media)

- Todos los testimonios y guías repiten «facturar no es ganar» (Wilkins; Transnova; Forocoches 2018, donde discuten 750 € de gasoil al mes frente a 300). La cuenta se hace **una vez**, para decidir si coger la ruta. No he encontrado a nadie que diga que la mira a diario.
- Eso encaja con la **Calculadora** de FDS como página de búsqueda en Google, más que con un número en el móvil cada día. Es una sospecha: no tengo datos de búsquedas.

### 8. Lo que FDS ya tiene (leído en el código)

**Ya existe:**
- **«Pon tu tarifa» / «Mi dinero hoy»** (`MiRuta.jsx`, l. 1458-1488 y 1934-1970; servidor `PUT /reparto/ganancias`). Se guardan el pago por entrega, el fijo por día, la gasolina por km y el Bizum. Calcula lo bruto (entregas × tarifa + fijo), la gasolina de lo recorrido, lo **limpio** y lo limpio **por hora**. Además: «{n} sin entregar = {euros} sin cobrar». Solo lo ve el autónomo (`ruta.autonomo`).
- **ResumenDia:** el chip «💶 {limpio}» o «Pon tu tarifa», y la etiqueta «Cobrado {x}».
- **Cierre del día (`Resumen`, l. 2670):** hechas, sin hacer, cobrado (una fila por forma de pago), duración y km, «Tu mejor día» y «Llevas {n} entregas con FDS».
- **`/reparto/mis-marcas`:** entregas totales, de hoy, días, días de esta semana y mejor día. Solo cuenta, sin dinero.
- **CalculadoraRepartidor.jsx:** paradas, tarifa, días, horas, km, €/km y gastos fijos. Da lo que queda al mes, al día y por hora. Es una página pública, no está dentro de la app.

**Lo que le falta para ser «la cuenta de lo mío»:**
1. **No hay mes ni historial con dinero.** Todo es de **hoy**. No existe «este mes: 1.840 entregas, 1.656 €». Los datos ya están (`reparto_pedidos` guarda la fecha y el estado de cada parada), pero no hay pantalla ni endpoint que sume por mes, ni lista de días.
2. **Una sola tarifa.** No distingue recogida, voluminoso, segunda visita, devolución ni bulto extra, que son justo los conceptos de la liquidación (hallazgo 3).
3. **No se pueden apuntar descuentos ni sanciones** («me han cargado 40 € por…»), ni contrastarlos.
4. **No hay lista para comparar.** No se puede sacar «día, códigos entregados, hora» (CSV o PDF), que es lo único que sirve para discutir una liquidación (Evri, hallazgo 2).
5. **La tarifa es la de hoy.** Si cambia, los días pasados se recalcularían con la nueva. No se guarda con qué tarifa se hizo cada día.
6. **Los gastos fijos** (cuota, seguro, furgoneta) solo están en la Calculadora pública, no en la app.
7. **No sé si alguien la usa.** El código mide `ruta_tarifa` (`medirAccion`), pero no he podido ver los números de producción. Con 1 persona que hizo un día real, no hay datos para saber si «Mi dinero hoy» engancha.

## Mi veredicto

**La parte (b) de la hipótesis, la cuenta de cuánto llevo y si me cuadra, no se sostiene como motivo para instalar la app y enseñársela al compañero.** Las pruebas:
- En España no he encontrado ni un caso publicado de «me pagaron menos paquetes de los que entregué». Lo que duele es lo que **la regla** no paga (ausentes), las **sanciones** y los **retrasos o impagos** de quien está en medio. Ninguna de esas tres se arregla con una suma.
- Nadie enseña cómo lleva la cuenta: ni plantillas, ni apps en español, ni vídeos. La PDA de la agencia ya cuenta por ellos.
- La app más parecida que existe (CourierLog, Reino Unido, gratis, hecha para el mensajero por paquete) no tiene ni bastantes votos para mostrar una nota. Las de EE. UU. y Brasil triunfan por razones que aquí no existen: varias apps a la vez, kilómetros para Hacienda, elegir pedido a pedido.
- La liquidación llega 30-60 días después y mezcla conceptos y descuentos. Un «entregas × tarifa» no la iguala, y si no la iguala, el número del móvil deja de creerse.

**Lo que sí se sostiene, en parte**, es que cuando hay pelea por el dinero (una liquidación corta, un bulto «no entregado» que te cargan) gana quien tiene **su propia lista con pruebas**. Así lo cuenta el mensajero de Evri y así lo aconseja la guía de Transnova. Eso empuja hacia la parte **(a)**, la foto sellada que se encuentra en segundos. La cuenta de dinero sería, como mucho, una consecuencia de esa lista y no el gancho. «Cuánto llevo hoy» es **un adorno agradable**, no algo que se abra cada día para cuadrar. FDS además ya lo tiene.

Aviso honrado: casi todo son testimonios sueltos y guías con intereses (Transnova es una cooperativa que vende). No hay encuesta. Que no aparezcan quejas de «me cuentan mal» puede deberse a que no se publican. Se tumba como «motivo de instalación», no como «no pasa nunca».

## Lo que yo haría

1. **No construir el «cuadre con la liquidación».** No hacer el mes con dinero, ni tarifas por tipo, ni sanciones, mientras no haya una sola prueba de que alguien lo pide. Lo que ya existe (Mi dinero hoy, el cierre) basta como adorno.
2. **Mirar antes cuántos ponen la tarifa.** En «Cómo va el negocio», contar el evento `ruta_tarifa` frente a las altas. Si de 104 altas casi nadie la puso, es otra prueba de que esto no engancha. Es gratis y lleva cinco minutos.
3. **Preguntar a 5 repartidores reales** (el que hizo un día, los de la flota de Dani si alguno es autónomo, un grupo de WhatsApp de repartidores): «¿Te ha pasado que la liquidación no te cuadre? ¿Qué hiciste? ¿Tienes alguna foto o lista tuya?». Si 3 de 5 dicen que sí y que no tenían con qué demostrarlo, entonces sí.
4. **Si se hace algo, que sea la lista con pruebas, no la suma.** Que cada entrega y cada intento guarde código, hora, GPS y foto, que se encuentre por código o dirección y que se exporte un día o un mes en CSV o PDF. Eso sirve a la vez para la reclamación del «no recibido» y para discutir una liquidación. Y es la parte (a), que es la que tiene más pinta.
5. **La Calculadora, a Google.** «Lo que me queda limpio» se piensa **antes de firmar** una ruta: dejarla como página para buscadores (ya lo es), no como pantalla diaria.

## Fuentes (con fecha)

- Emiliana, 0,90 €/paquete: https://www.noticiastrabajo.es/economia/emiliana-repartidora-de-paqueteria-habla-claro-sobre-lo-que-cobra-me-pagan-090-euros-por-paquete-si-entrego-50-cobro-unos-990-euros-al-mes-pero-si-hay-algun-paquete-con-incidencia-no-me-lo-pagan/ (actualizado 30-11-2025)
- Kate: https://www.cope.es/actualidad/economia/noticias/kate-repartidora-paquetes-pagan-paquete-entregado-no-ausencia-deriva-punto-recogida-no-vas-casa-20260702_3396154.html (02-07-2026)
- Wilkins: https://www.cope.es/actualidad/economia/noticias/wilkins-repartidor-primer-mes-vi-4-000-euros-facturacion-autonomo-no-le-queda-no-mantienes-120-140-paquetes-ve-apretado-20260710_3403096.html (10-07-2026)
- Xataka, sanciones de hasta 40 €: https://www.xataka.com/servicios/repartidor-dice-que-no-habia-nadie-casa-realidad-siquiera-paso-tu-calle-sintoma-sector-saturado (11-11-2025)
- Transnova, agencias: https://www.transnovaavanza.com/trabajar-agencias-paqueteria-autonomo/ (01-09-2026, act. 30-10-2026)
- Transnova, modelos: https://www.transnovaavanza.com/repartidor-autonomo/ (17-10-2026, act. 09-11-2026)
- Entrevista a un repartidor de SEUR: https://nuevarevolucion.es/entrevista-a-un-repartidor-de-seur-seur-ficha-a-los-mas-necesitados-los-que-saben-que-no-protestan-y-cumplen-con-el-trabajo/ (sin fecha; comentarios de 2021)
- GLS y CTT en elotrolado: https://www.elotrolado.net/hilo_gls-va-a-superar-a-seur-como-peor-empresa-de-reparto_2499910_s50 (04-04-2024)
- Forocoches, empresa nacional: https://forocoches.com/foro/showthread.php?t=9603791 (05-07-2023)
- Forocoches, autónomo de SEUR: https://forocoches.com/foro/showthread.php?t=3695137 (2018-2019)
- Forocoches, 2021 y 2020: https://forocoches.com/foro/showthread.php?t=8431559 y https://forocoches.com/foro/showthread.php?t=8146369
- Menéame, repartidor de paquetería: https://www.meneame.net/m/TeRespondo/soy-repartidor-paqueteria-respondo-tus-dudas-sobre-este-mundo (11-2021)
- Última milla, 70 % autónomos: https://informacionlogistica.com/la-ultima-milla-sostenida-por-autonomos-ya-mueve-mas-paquetes-que-correos/ (19-08-2026)
- FedEx condenada (solo buscador): https://confilegal.com/20261110-fedex-condenada-pagar-transportistas-autonomos-impagos-intermediario/ (10-11-2026)
- Evri, petición: https://www.change.org/p/stop-evri-from-unfairly-cutting-couriers-rates-and-removing-work-without-notice/u/35214798 (30-08-2026)
- Citizens Advice: https://www.citizensadvice.org.uk/policy/publications/deliver-at-all-costs-how-insecure-pay-and-conditions-for-delivery-drivers-are-failing-parcel-consumers/ (30-09-2026)
- GMB, Evri (solo buscador): https://www.gmb.org.uk/private-sector/logistics/evri-formerly-hermes-noticeboard
- CourierLog: https://apps.apple.com/app/courierlog/id6759669582 (consultado el 14-11-2026)
- Gridwise (solo buscador): https://apps.apple.com/us/app/gridwise-gig-driver-assistant/id1215991382 ; https://www.mileagewise.com/?p=27368 ; https://appgoblin.info/apps/com.gridwise.app
- StopClub (solo buscador): https://www.mobiletime.com.br/noticias/16/12/2021/stopclub-app-para-gig-workers-cresce-mais-de-100-mes-a-mes/ ; https://observador.pt/especiais/stopclub-empresa-brasileira-que-enfrenta-uber-em-tribunal-chega-a-portugal-para-ajudar-motoristas-a-perceber-que-viagens-valem-a-pena/
- Excel de Hotmart (solo buscador): https://hotmart.com/es/marketplace/productos/sistema-de-control-de-reparto-para-repartidores/F101417132S
- Contra reembolso, 1-2 % (solo buscador): https://www.iese.edu/media/research/pdfs/79428.pdf
