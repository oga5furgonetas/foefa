# El dinero y los muros: ¿algo impide a un repartidor nuevo hacer un día real en su primera semana?

Fecha: 14-11-2026. Copia leída: `C:/Users/dlvie/foefa-p0` (sin tocar nada). Todo lo de esta carpeta:
`C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/reparto/diag/limites`

## Respuesta corta

**Hoy no hay ningún muro.** He dado de alta cuentas nuevas por las cinco puertas (web con alta rápida, web con
/registro, Android, iPhone e invitado por un compañero), y cada una ha metido **150 paradas de golpe y una más a mano
sin ningún tope, sin tarjeta y sin aviso de pago**. Hasta el 31-12-2026 el dinero no explica la caída de 104 a 1.

Lo que sí hay son cosas que **huelen a trampa** (el bono de «25 € por tu primera ruta» que no se puede cobrar solo,
y una promoción de invitados que dice «que se registre» cuando hace falta que reparta) y un **precipicio el
01-01-2027**: ese día todos los que no paguen pasan a 15 paradas al día (un día real son 80-150), y en la app de
Android y en la de iPhone **no hay ninguna forma de pagar** para quitar el tope.

## Cómo lo he hecho (para repetirlo)

1. Leí `backend/server.py` por trozos (grep de las funciones del encargo) y la web/la app nativa.
2. Arranqué el servidor de pruebas (backend real, base en memoria):
   `python -X utf8 .../reparto/servidor_reparto.py C:/Users/dlvie/foefa-p0 8805 .../diag/limites/servidor`
3. `puertas.py` (en esta carpeta): una alta por puerta con el mismo cuerpo que manda cada cliente
   (`AltaRapida.jsx:64-77`, `Registro.jsx:412-428`, `Repositorio.kt:164-176`, `desde_ios`, y `ref` con el código del
   primero), luego `GET /org/billing`, `POST /reparto/pegar` con 150 direcciones inventadas y una parada más con
   `POST /reparto/pedidos`. Salida: `puertas_8805.json`.
4. `viaje_en_el_tiempo.py`: el mismo backend dentro del proceso para mover el reloj (prueba de 7 días acabada,
   y promoción acabada poniendo `REP_GRATIS_HASTA` a ayer). También mide la vara del «día real» con días inventados.
   Salida: `viaje.json`.
5. Mercado: páginas públicas de precios de Spoke (antes Circuit) y Zeo, y una búsqueda de Routin.

## 1. La línea de tiempo de quien se da de alta hoy (14-11-2026)

Reglas (server.py):
- Alta: `status: "trial"`, `trial_ends` = hoy + 7 días (`server.py:5240, 5254-5255`; `PLAN_TARIFAS["autonomo"]["dias_prueba"]=7`, `server.py:5795`).
  Invitado: +7 días, 14 en total (`server.py:5243-5245`, `_REF_DIAS_EXTRA=7` en `63860`).
- Tarjeta: solo si `PRUEBA_CON_TARJETA=1` en el entorno (por defecto `"0"`), nunca desde la app de Play sin Play
  listo (`server.py:5302-5305`), y aun así solo si Stripe o Play están configurados (`_falta_tarjeta`, `5655-5661`).
  El muro del servidor solo salta con `_falta_tarjeta` (`server.py:1171-1172`). Docs/PRECIOS.md:92 y ESTADO.md:2662
  dicen «hoy apagado». (No puedo ver los secretos de Fly: que en producción esté a 0 es lo que dice la documentación.)
- Tope: `_rep_sin_ilimitado` devuelve False mientras `_dia_negocio() <= "2026-12-31"` (`server.py:5710-5722`);
  después, tope de 15 paradas al día a quien tenga la prueba vencida y no pague (`5687, 5725-5735`), comprobado al
  crear (`60733-60735`), al pegar (`61306-61308`) y al escanear (`61996`).

| Puerta | Día 1 (14-11) | Día 8 (21-11) | Día 31 (14-12) | 01-01-2027 |
|---|---|---|---|---|
| Web (alta rápida y /registro) | Prueba 7 días + promo: sin tope, sin tarjeta | Prueba vencida, pero promo: sin tope | Igual | **15 paradas/día**; puede pagar con Stripe 9,99 €/mes (se cobra ese mismo día) |
| Android nativa | Igual | Igual | Igual | **15/día y sin forma de pagar en la app** |
| iPhone | Igual, sin ver nada de dinero | Igual | Igual | **15/día y sin forma de pagar** (ni se le dice por qué) |
| Invitado | Prueba 14 días + promo | Igual | Igual | **15/día** |
| Alta el 01-01-2027 o después | 7 días sin tope | 15/día | 15/día | — |

Prueba (salidas reales):
- Hoy, las cinco puertas: `"pegar_150": {"http": 200, "creados": 150, "sin_hueco": 0}` y `"parada_151": {"http": 200}`;
  `"falta_tarjeta": false, "bloqueo": ""`; invitado con `"days_left": 14` (`puertas_8805.json`).
- Día 8 con promoción: `"required": true, "days_left": 0` pero 150 creadas (`viaje.json`, `dia_8_prueba_acabada_promo_activa`).
- 01-01-2027, alta de noviembre (web e iPhone): `"creados": 15, "sin_hueco": 135` y la 16ª
  `402 "Has llegado al tope de paradas gratis de hoy. Pasa a ilimitado en «Cuenta» o sigue mañana."` (`viaje.json`).
- Alta el 01-01-2027: 150 creadas (7 días sin tope).

**¿Hay algún camino con muro o tope antes de un día de 80-150 paradas, hoy?** No. Lo he probado por las cinco
puertas. La única puerta que pondría muro (tarjeta para empezar) está apagada por entorno.

Cuándo ve un precio (web/Android, no iPhone):
- En el alta rápida, en la letra pequeña junto a la casilla de los Términos: «Gratis y sin límite hasta el 31 de
  diciembre. Después sigues gratis con hasta 15 paradas al día; sin tarjeta no se cobra nunca. Sin tope: plan
  Repartidor (9,99 €/mes).» (`AltaRapida.jsx:124-126`).
- En «Cuenta» (web): «Hasta el 31 de diciembre no tienes tope de paradas ni pagas nada. Después, gratis hasta 15
  paradas al día, o sin tope por 9,99 €/mes.» (`RutaCuenta.jsx:356-360`). Durante la promoción no se ofrece suscribirse
  (`RutaCuenta.jsx:77-78`).
- Android, antes del alta: «Sin tarjeta. Gratis y sin límite hasta el {fecha}; después, gratis hasta {p} paradas al día.»
  (`Acceso.kt:97-100`); en Cuenta: «Gratis y sin límite hasta el 31 de diciembre.» (`Pestanas.kt:489-490`).
- iPhone: nada (`sinPagos()`, `RutaApp.jsx:199, 296`; `RutaCuenta.jsx:71`).

## Hallazgos, de más a menos grave

### A. (Grave, a partir del 01-01-2027) El tope de 15 al día convierte la app en una demo, y en Android e iPhone no hay salida
- Probado: 15 de 150 el 01-01 (`viaje.json`). El mensaje dice «Pasa a ilimitado en «Cuenta»» (`server.py:5688`).
- La app nativa de Android no tiene cobro: no hay `BillingClient` en `app-android` (grep vacío) y su pantalla
  «Cuenta» solo tiene el texto del plan, invitar, soporte, privacidad, términos, salir y borrar
  (`ui/cuenta/Pestanas.kt:430-471`). Quien reparte con la app de Play se queda en 15 para siempre y Dani no le puede
  cobrar ni aunque quiera pagar.
- iPhone: el servidor aplica el tope igual (`docs/APP_STORE.md:353-355`) y la app no puede vender nada: tope fijo y
  sin explicación.
- Afecta a TODOS los de noviembre y diciembre el mismo día, de golpe, en plena campaña de Navidad/Reyes.

### B. (Frena la confianza) El bono de «25 € por tu primera ruta» no se puede cobrar solo
- En la app: «25 € por tu primera ruta real» y, al tocar, «Haz 20 entregas con la app en 2 días distintos y son tuyos.
  Hasta el 31 de diciembre.» (`MiRuta.jsx:2440-2445`). La portada: «Gana 25 € con tu primera ruta real…»
  (`Repartidores.jsx:194`).
- Pero solo se retira desde 60 € (`server.py:63893-63894`), y eso se esconde a propósito: «El mínimo de retirada no
  se enseña hasta que intentan cobrar (lo pidió así)» (`server.py:63888-63890`; `precios.js:121-123`). Lo descubre al
  pulsar «Cobrar»: «Se puede cobrar a partir de 60 €. Te faltan 35 €.» (`RutaCuenta.jsx:789`). Para llegar a 60 € con
  el bono hacen falta 4 compañeros que también hagan 20 entregas en 2 días. Esto es exactamente lo que un repartidor
  cuenta en el grupo de WhatsApp como «es un timo».
- Además, «son tuyos» no dice que cada día solo cuenta si las entregas van a direcciones distintas y se reparten en
  al menos 45 minutos (`server.py:65090-65106`); quien marca todo al final no avanza (ver punto 4).

### C. (Frena) La promoción de invitados promete pagar por registro, y no es así
- «Promoción hasta el 31 de diciembre: 10 € por cada compañero que se registre con tu enlace.» (`RutaCuenta.jsx:826`;
  igual en `DriverReferralWallet.jsx:70`). El servidor solo paga si el invitado hace 20 entregas reales en 2 días en
  su primer mes (`server.py:65204-65219`, `_referido_premiar`), lo que la misma pantalla dice dos líneas más arriba
  (`RutaCuenta.jsx:808`). Dos frases que se contradicen en la misma tarjeta.
- Sospecha (no probada con datos): si los dos están en la misma red (wifi de la nave, o la misma IP de la operadora
  móvil), el premio no se paga solo y queda «para revisar» (`server.py:65232-65236`, huella de la IP exacta en
  `63908-63914`). La propia app sugiere invitar en la nave con un QR (`RutaCuenta.jsx:757`).

### D. (Molesta) «Gratis hasta el 31 de diciembre» es una fecha de calendario, no un tiempo de prueba
- Se repite en portada, alta, correo y app (`Repartidores.jsx:140, 191, 259`; `ciclo_correos.py:338-341`;
  `AltaRapida.jsx:124-126`). El texto es honrado (dice qué pasa después y que sin tarjeta no se cobra), pero lo que
  se entiende es «en enero me lo quitan». Y quien llega el 20 de diciembre tiene 11 días, quien llega el 2 de enero
  tiene 7: la oferta empeora cada día para el que llega.
- Lo que está bien: no se pide tarjeta y se dice claro «sin tarjeta no se cobra nunca». Eso da confianza.

### E. (Molesta) Vender regalos y códigos mientras todo es gratis
- En «Cuenta» (web) se ve «Canjear» y «Regalar» (comprar un regalo de la app) aun con la promoción activa
  (`RutaCuenta.jsx:80-81`), cuando la app no cuesta nada hasta enero. Ruido de dinero sin sentido para un nuevo.
- La portada pone el precio fijo «9,99 €/mes» en el texto, sin la moneda del país (`Repartidores.jsx:260, 264`),
  mientras el servidor tiene precios por país (`server.py:5572-5577`). Sospecha: en México/EE. UU. se lee un precio en
  euros.

### F. (Bien) Nada más en la primera semana echa a nadie
- Sin verificación de correo obligatoria en el alta (`register_dsp`, `server.py:5200-5386`, no hay paso de
  verificación).
- Sesión de 30 días que se renueva sola al usar la app (`SESION_APP_HORAS = 24*30`, `server.py:7640`;
  `Repositorio.kt:178-189`).
- Límite de altas: 5 por minuto y 30 al día por IP (`server.py:5205-5208`), con la IP real de Fly (`5110-5123`): no
  molesta a una persona.
- País: todos abiertos; China pide un consentimiento aparte (`server.py:5286-5289`).
- Contraseña mínima de 8 y usuario = correo. Un pequeño fallo: si el correo ya existe, el error dice «Ese usuario ya
  existe, elige otro» (`server.py:5221`) a quien solo ha escrito un correo (no probado en pantalla).

## 3. El 01-01-2027 y el mercado

| App | Gratis | Pagando |
|---|---|---|
| Spoke (antes Circuit) | 10 paradas por ruta, rutas sin límite | Lite 9,99 $/mes, Standard 19,99 $/mes, paradas sin límite (spoke.com/route-planner/pricing, leído hoy) |
| Zeo | 7 días de prueba; su tabla muestra «3 Routes / Day» para el nivel gratis | por conductor (zeorouteplanner.com/pricing; la página no da todos los precios) |
| Routin | Según su ficha de App Store (no verificado por mí): hasta 300 paradas por ruta gratis, con anuncios | ~9,99 $/mes y créditos (dato de un tercero) |
| FDS desde el 01-01 | 15 paradas al día | 9,99 €/mes o 99 €/año, solo en la web |

Lectura: 15 al día no sirve para trabajar (igual que los 10 de Spoke), así que el plan gratis no hace que la app pase
de mano en mano: un compañero que la prueba el lunes con su ruta de 120 se encuentra el tope en la parada 16. El precio
de 9,99 € está en línea con el mercado (Spoke Lite). El problema no es el precio, es que el gratis no deja vivir un
día de verdad y que en móvil no se puede pagar.

Qué haría (sin gastar dinero):
- **Cambiar la fecha por un contador personal:** «30 días sin límite desde tu primer día de reparto», sin tarjeta.
  Así enero no es un precipicio y el que llega tarde no sale perdiendo.
- **Después, días completos en vez de paradas:** por ejemplo, 2 días de reparto completos gratis cada semana (o 4 al
  mes) y el resto con el plan. Un día completo gratis es lo que hace que uno se lo enseñe al de al lado en la nave; 15
  paradas no.
- **Antes del 01-01: cobro dentro de Android (Google Play Billing)**, o no aplicar el tope en Android/iPhone hasta que
  se pueda pagar allí. Sin eso el tope solo echa gente y no cobra nada.
- **Aviso con tiempo** a los de noviembre-diciembre, y que los que ya hicieron días reales conserven algo (precio de
  fundador, p. ej. 4,99 €/mes el primer año), para que no se sientan engañados.

## 4. «Un día real»: cómo se cuenta

- `activacion.pasos_de` marca «día real» si `_ref_uso_real` da al menos 1 día (`activacion.py:111`, con la misma función
  que el bono, `server.py:48360`).
- `_ref_uso_real` (`server.py:65093-65106`): un día cuenta si tiene **2 o más entregas marcadas como entregadas, con al
  menos 45 minutos entre la primera y la última**. Las direcciones distintas solo cambian CUÁNTAS entregas cuentan, no
  si el día cuenta.
- Mínimo: **2 entregas separadas 45 minutos**. Es una vara muy baja: el «1» no sale bajo por exigir mucho.

Medido con días inventados (`viaje.json`):
- 120 entregas en 8 h → cuenta (120, 1 día).
- **120 entregas marcadas al final, en 30 minutos → no cuenta (0, 0).**
- 2 entregas con 50 min → cuenta.
- 80 entregas en un mismo edificio en 3 h → cuenta el día, pero solo 1 entrega.

Dónde puede quedarse corto (sospechas, sin datos de producción):
- Quien usa la app para ordenar y navegar y no marca «entregado», o lo marca todo al acabar: no cuenta.
- Entregas sin cobertura que se envían más de 12 h después: se guardan con la hora del envío
  (`_rep_hora_hecho`, `server.py:62156-62167`) y pueden caer dentro de 45 minutos.
- Solo cuenta `estado: "entregado"`; un día con muchas ausencias y pocas entregas puede no contar.
- El filtro de cuentas de prueba quita nombres que contienen «test», «demo», «prueba» o «claude» y los que usan el
  correo como nombre (`activacion.py:27-28, 64-89`): alguien llamado Claude, o que puso su correo de nombre, desaparece
  del embudo.
- Ninguno de estos cambia la conclusión: de 12 que entregaron algo, 11 no tuvieron ni 2 entregas a 45 minutos. Eso es
  falta de uso, no una vara alta.
- Ojo: el bono es otra cosa y sí exige más: 20 entregas EN 2 DÍAS (`server.py:63884-63885`). Un día real de 120 no lo
  gana (`viaje.json`: `bono_con_un_solo_dia_de_120` = 120 entregas, 1 día).

## Lo que funciona bien y no hay que tocar
- Sin tarjeta y sin muro en ninguna puerta; probado.
- Las frases sobre el después son honradas («sin tarjeta no se cobra nunca»), y durante la promoción no se ofrece
  suscribirse (`RutaCuenta.jsx:77`) ni se avisa de «quedan N días de prueba» (`RutaApp.jsx:296`), ni sale el correo
  «casi fin» (`ciclo_correos.py:195-196`).
- La app de iPhone no enseña nada de dinero y el alta desde iPhone no recibe correos de plan (`server.py:5275-5279`).
- Al pegar una lista más larga que el tope, guarda las que caben y dice cuántas no (`sin_hueco`), en vez de fallar todo.
- Sesiones largas y sin verificación de correo: nada echa a nadie en la primera semana.

## Las tres cosas que yo arreglaría primero y por qué

1. **Decir la verdad del bono y de los invitados, ya.** Que la condición de los 60 € para cobrar se vea al lado de
   «25 € por tu primera ruta» (o, mejor, que el bono se pueda cobrar solo), y cambiar «que se registre» por «que haga
   20 entregas en 2 días». Hoy es lo único de dinero que un repartidor nuevo puede sentir como trampa, y la confianza es
   lo que hace que se pase de mano en mano.
2. **Quitar el precipicio del 01-01-2027 antes de que llegue.** Cambiar «gratis hasta el 31 de diciembre» por «30 días
   sin límite desde tu primer día de reparto», y que el plan gratis de después deje hacer días completos (p. ej. 2 por
   semana) en vez de 15 paradas. Con 15 al día nadie puede probarla en su ruta real.
3. **Poder pagar donde está la gente (Android) antes de poner ningún tope**, o no aplicar el tope en Android e iPhone
   hasta entonces. Hoy el tope no cobra nada: solo echa gente, porque en la app nativa no hay botón de pagar.
