# El que se da de alta de noche, y la vuelta al día siguiente

Rubén, repartidor autónomo, 22:30, en el sofá, sin direcciones a mano. Probado sobre la copia `C:/Users/dlvie/foefa-p0`
(sin tocarla), con el servidor real en memoria y la web compilada, en un móvil simulado (Pixel 7, es-ES, A Coruña).

## Cómo lo he hecho (para repetirlo)

Carpeta: `C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/reparto/diag/web-noche`

1. Servidor: `servidor_reparto.py <repo> 8803 <carpeta>/servidor`; web: `vite preview --port 4463` con `API_DEV_URL`.
2. Guiones de Playwright (todos en la carpeta, ejecutar con `node`):
   - `noche.mjs <correo>`: alta desde `/empezar` hasta la primera pantalla de `/ruta` (capturas 01–05).
   - `noche2.mjs`: «Ahora no, seguir en la web» y la bienvenida (06–07).
   - `noche-completa.mjs <correo> <prefijo> si`: la noche entera de un tirón: alta → «Ahora no» → «Todavía no» →
     ejemplo (capturas b-*, c-*). Con `HASTA_EJEMPLO=1` para y guarda la sesión.
   - `cuenta.mjs`: pestaña Cuenta, «Invitar a un compañero» (se captura lo que se compartiría), Ajustes, quitar el
     ejemplo, «¿Cómo funciona?», «Instalar» (capturas d-*).
   - `dia2.mjs`: la mañana siguiente (reloj del navegador en el lunes 16-11 a las 7:05) con la misma sesión y con sesiones
     nuevas por `/`, `/ruta` y `/app` (capturas e-*, f-*, g-*, h-*).
   - `otros.mjs <correo> <ref>`: entrar por `/panel/login`, la página `/invita` que recibe el compañero y `/repartidores`
     (capturas i-*, j-*, k-*).
   - `permiso.mjs`: comprueba que en Chromium sin ventana `Notification.permission` es SIEMPRE «denied». Por eso, para ver
     lo que ve una persona con Chrome de verdad, los guiones emulan «default» (sin contestar).
3. Correos: el servidor de pruebas no tiene `RESEND_API_KEY`, así que el alta no lanza la bienvenida y
   `servidor/correos.jsonl` queda vacío (`server.py:5349`: la bienvenida solo sale con la clave). No es un fallo del
   producto. Para saber qué recibe Rubén y cuándo, `simular_ciclo.py` usa el módulo real `backend/ciclo_correos.py` (sin
   red ni base): pregunta «¿qué toca?» cada 10 minutos durante 30 días para un alta a las 22:30 de cada día de la semana,
   sin paradas, con el seguimiento encendido y apagado, y saca el texto de cada correo. Salida: `ciclo-simulado.txt` y
   `primer-dia-lunes.txt`.
4. Cuenta por API: `billing.py` (lee `/org/billing` y `/reparto/mi-ruta` como Rubén).
5. Al acabar, parados el servidor (PID 34476, puerto 8803) y vite (PID 41344, puerto 4463).

Lo que NO he podido comprobar desde aquí: los valores en producción de `CICLO_CORREOS`, `VAPID_*` y FCM; la app nativa en
un móvil; el navegador de Instagram/TikTok; y el reloj del servidor (la fecha que pinta «Hoy» es la del PC: sáb 14 nov).

## La película de la primera noche (medida)

| Reloj | Toques | Lo que ve Rubén | Captura |
|---|---|---|---|
| 0 s | 0 | `/empezar`: «Tu ruta de reparto, ordenada sola», «Crear mi cuenta gratis», gratis hasta el 31-12, sin tarjeta | 01-empezar.png |
| 2 s | 1 | Formulario: nombre, correo, contraseña, casilla. Arriba «🎁 Y 25 € para ti con tu primera ruta real» | 02-formulario.png |
| 8 s | 6 | «¡Cuenta creada!» · «Plan Repartidor · gratis hasta el 31 de diciembre» · «Empezar mi ruta →». Sin código de verificación | 04-cuenta-creada.png |
| 10 s | 7 | A pantalla completa: «Último paso: instala la app» con Google Play, «Descargar la app para Android» (APK) y «Ahora no, seguir en la web» | 05-ruta-primera.png |
| 12 s | 8 | Bienvenida: «¿Tienes ya tus paradas de hoy?» · «Sí, cargarlas ahora» / «Todavía no» | 07-hoy-vacio.png, c-11-bienvenida.png |
| 13 s | 9 | Tras «Todavía no»: «Sin problema. Cuando cargues la furgoneta, abre la app…», «Por la mañana te llega un correo con un botón para entrar directo a tu ruta, sin contraseña», «¿A qué hora cargas la furgoneta?» (6:00…10:00) y «Avísame a las 8:00», y «Mientras, verlo en acción con 3 paradas de ejemplo» | c-12-todavia-no.png |
| 19 s | 10 | Ejemplo cargado: 3 paradas «Cliente de ejemplo 1/2/3», «Calle de ejemplo 1/2/3», con Ir / Entregado, y la tarjeta «25 € por tu primera ruta real 0/20 · Las paradas de ejemplo no cuentan» | c-13-ejemplo.png |

Alta completa en unos 10 segundos y 7 toques: rápido, sin trampas. Lo que se lleva en la cabeza al cerrar, si lee todo:
«mañana me llega un correo», «hay 25 € si hago 20 entregas», y quizá «me avisa a las 8». Lo más probable es que se aburra
en el ejemplo: son tres paradas sin nombres de calle de verdad («Calle de ejemplo 2»), «Entregado» sin paquete delante no
enseña nada nuevo, y ya no queda nada que hacer hasta mañana.

## La mañana siguiente (medida)

- Misma sesión (la sesión dura 30 días y se guarda en el móvil: `SESION_APP_HORAS = 24*30`, `server.py:7640`;
  `localStorage`, `frontend/src/panel/auth.js:278`): abre directo en «Hoy» vacío con «Carga tus paradas de hoy» y los
  botones Escanear / Foto etiqueta / Lista u hoja / A mano. **De abrir a estar pegando la lista: 1 toque** («Lista u
  hoja» abre la caja de pegar). Las paradas de ejemplo de anoche NO aparecen (`server.py:61826-61830` excluye
  `ejemplo`) y la bienvenida no se repite. Capturas e-30, e-31, e-32. Esto está bien.
- Sesión nueva (otro navegador, p. ej. se dio de alta dentro de Instagram y hoy abre Chrome):
  - `flotadsp.com/` → portada **para empresas** («El golpe, el día que aparece…»); lo suyo es un enlace pequeño arriba,
    «¿Repartes tú? La app de ruta» (f-40-nueva-.png).
  - `/ruta` → «Entra en FDS», con «Tu correo» y contraseña (g-40-nueva-ruta.png). Bien.
  - El «Entrar» de la portada y el de `/empezar` llevan a `/panel/login`, que dice «Bienvenido de nuevo · USUARIO»
    (i-50-panel-login.png). Con el correo entra y le lleva a `/ruta` (i-51), pero «usuario» despista a quien se dio de
    alta con un correo.
  - Con el correo de la mañana no hace falta nada de esto: su enlace es `/pase?ir=ruta…#p=…` y entra sin contraseña.

## Los mensajes que FDS manda a un repartidor nuevo que no mete paradas

Fuente: `backend/ciclo_correos.py` (reglas y textos), `server.py:27538-27700` (envío), `server.py:27963-28070`
(campaña «bono25»), `server.py:27694-27760` (aviso push de la mañana). Momentos sacados de `ciclo-simulado.txt`.

| Mensaje | Cuándo sale | Asunto / texto | Condición |
|---|---|---|---|
| Correo «bienvenida» | Al darse de alta (22:31) | «Tu cuenta de FDS está lista: así cargas tu primera ruta». 3 pasos («Cargar paquetes», foto a la etiqueta, «Montar ruta y empezar»), enlace sin contraseña, «¿Sin paquetes a mano? … Ver un ejemplo», el bono de 25 €, «contesta a este correo: lo leo yo» | Siempre (web y Android) si hay `RESEND_API_KEY` (`server.py:5349-5353`). No en iPhone (`desde_ios`), y eso está bien |
| Correo «primer_dia» | De 7:00 a 8:59 de lunes a sábado, entre 8 h y 72 h después del alta. Alta lun–vie a las 22:30 → **a las 7:01 del día siguiente** | «¿Te ayudo con tu primera ruta?» · «Ayer creaste tu cuenta en FDS y todavía no has cargado ninguna parada…» + 3 pasos + «¿Hoy no tienes paquetes? … Ver un ejemplo» + bono | **Solo con `CICLO_CORREOS=1`** (`server.py:27544`, `27664`) |
| Correo «bono25» | 9:00–21:00, en cuanto pasen 18 h del último correo | «¡Enhorabuena! Tu primera ruta con FDS ahora vale 25 €» + Google Play y QR + «Tienes hasta el 14 de diciembre» + «puntúala en Google Play» | Campaña encendida por defecto (`CAMPANA_BONO25`, `server.py:27976`); sale aunque el seguimiento esté apagado |
| Correo «recordatorio» | Día 3–8, de 7 a 9 | «¿Repartes esta semana? Tu ruta, lista en 2 minutos» | `CICLO_CORREOS=1` y 0 paradas |
| Correo «opinion» | Día 5, de 9 a 21 | «¿Qué te frenó con FDS? (se contesta con un clic)» con 5 respuestas | `CICLO_CORREOS=1` |
| Push «aviso de la mañana» | A la hora elegida (8:00 si no elige), lunes a sábado, 21 días, solo si ese día no hay paradas | «¿Empezamos la ruta?» / «Foto a la etiqueta de cada paquete y la ruta se ordena sola. Tu primera ruta de verdad te da 25 €.» | Solo si pulsó «Avísame…» en la web (y hay VAPID en el servidor) o si usa la app de Play (pide permiso al abrir y registra el token FCM: `MainActivity.kt:230`, `server.py:21507`) |
| WhatsApp | Nunca | — | `whatsapp.py` no tiene nada para el autónomo |

Calendario simulado (0 paradas, alta a las 22:30, seguimiento encendido):

```
Alta lun: bienvenida 22:31 | primer_dia mar 07:01 | bono25 mié 09:01 | recordatorio vie 07:01 | opinion dom 09:01
Alta vie: bienvenida 22:31 | primer_dia sáb 07:01 | bono25 dom 09:01 | recordatorio mar 07:01 | opinion jue 09:01
Alta sáb: bienvenida 22:31 | bono25 dom 16:31 | primer_dia MAR 07:01 (+57 h) | recordatorio mié 07:01 | opinion vie 09:01
Seguimiento APAGADO, cualquier día: bienvenida 22:31 | bono25 al día siguiente a las 16:31. Nada por la mañana.
```

## Lo encontrado, de más a menos grave

### 1. La promesa «Por la mañana te llega un correo» depende de un interruptor que puede estar apagado — FRENA (sospecha fuerte, sin poder ver producción)
La pantalla de la noche lo promete (`MiRuta.jsx:2378`, captura c-12-todavia-no.png). El correo de la mañana
(«primer_dia») solo sale con `CICLO_CORREOS=1` (`server.py:27544` y `27664`; por defecto «0»). `docs/ESTADO.md:3490`
lo dejó «hoy APAGADO: falta el sí de Dani»; `docs/ESTADO.md:4035` dice que el 17-10 salieron 13 «primer_dia», o sea, que
entonces estaba encendido; y `docs/ESTUDIO_APP.md:335` reconoce que el valor de producción no se ha comprobado. Si está
apagado, lo único que le llega al día siguiente es «bono25»… a las 16:31, con la furgoneta ya vacía (simulación). Hay que
mirarlo en Fly (`fly secrets list`) y en `correos_enviados` (`por: "ciclo:primer_dia"` de los últimos 30 días).

### 2. Quien se da de alta el sábado por la noche no recibe nada el lunes por la mañana — FRENA (probado con el módulo real)
`en_su_manana` salta el domingo (`ciclo_correos.py:144`). El domingo a las 16:31 sale «bono25», y la regla de 18 h entre
correos (`ciclo_correos.py:57`) tapa el lunes de 7 a 9 (16:31 + 18 h = lunes 10:31). El «primer_dia» llega el MARTES a
las 7:01, 57 h después. El lunes, primer día de reparto tras el alta, Rubén no recibe nada. Salida: `ciclo-simulado.txt`.
Con el resto de días el «primer_dia» llega a las 7:01 del día siguiente: eso está bien pensado.

### 3. El aviso de la mañana (push) solo se ofrece una vez, de noche, y luego queda escondido — FRENA (probado)
«Hoy» tiene un único hueco de aviso, y en un móvil «Instala la app» va antes que el aviso de la mañana
(`RutaApp.jsx:304-305`). Mientras no instale o cierre esa línea, la tarjeta «¿Te aviso por la mañana?» no sale nunca
(capturas d-23-sin-ejemplo.png, e-30-manana-misma-sesion.png: solo «Instala la app»). La única ocasión visible es la hoja
de bienvenida tras «Todavía no»; si la cierra con la ✕, pulsa «Sí, cargarlas ahora» o «ver el ejemplo», el aviso queda en
la pestaña Cuenta, abajo del todo (d-20-cuenta.png). En iPhone desde Safari no hay avisos sin añadirla a la pantalla de
inicio. Nota de banco de pruebas: en Chromium sin ventana el permiso sale siempre «denied» (`permiso.mjs`); emulado como
en un Chrome de verdad, la hoja enseña bien las horas y «Avísame a las 8:00».

### 4. Instalar desde Google Play rompe la sesión y el correo de la mañana no abre la app instalada — FRENA (leído en el código; sin probar en un móvil)
La pantalla «Último paso: instala la app» manda a Google Play (05-ruta-primera.png; «Instalar» en «Hoy» abre la ficha,
d-25-instalar.png). La app de Play no recibe la sesión: no usa el «install referrer» ni entiende `/pase`
(`AndroidManifest.xml:80-81` solo abre `/ruta` y `/app`), así que a las 22:35 tiene que escribir otra vez su correo y la
contraseña que acaba de inventar. Y los enlaces de los correos son `/pase?ir=ruta…`: los abre el navegador, no la app.
A cambio, la app de Play pide permiso de avisos al abrirse y registra su token: es el camino que mejor asegura el aviso de
las 8 (si FCM está configurado en producción, que no he podido ver).

### 5. El bono dice dos fechas distintas — MOLESTA (probado)
La app (c-15-bono.png, `MiRuta.jsx:2445`), la Cuenta (d-20) y la bienvenida dicen «Hasta el 31 de diciembre». El
servidor solo cuenta las entregas hasta 30 días después del alta (`server.py:65151`, `65174`; `/reparto/mi-ruta` devuelve
`"limite": "2026-12-14"` para un alta del 14-11), y el correo «bono25» dice «Tienes hasta el 14 de diciembre». Quien se
fíe de la app puede perder los 25 €.

### 6. La página que recibe el compañero invitado le habla a quien invita — MOLESTA (probado)
`/invita?ref=…` (j-60b-invita-pantalla.png, `Invita.jsx:49`): el titular es «¿Tienes un colega que reparte sin una app
para organizarse? Enséñale FDS», y la caja del premio empieza por «quien te invitó gana 10 €»; lo suyo (25 €) va al final.
Debajo del botón, «Sin tarjeta · primero puedes ver cómo funciona» casi no se ve (verde muy claro sobre verde, línea 61).
Lo que se comparte sí está bien: un texto con el enlace, «Y tú ganas 25 € con tu primera ruta real» y las condiciones
(salida de `cuenta.mjs`). «Invitar a un compañero» está en Cuenta (d-20) y como línea al final de «Hoy».

### 7. La puerta de vuelta, en una sesión nueva, es la de las empresas — MOLESTA (probado)
`flotadsp.com/` es la portada de flotas (f-40-nueva-.png); el «Entrar» de arriba y el «Ya tengo cuenta · Entrar» de
`/empezar` llevan a `/panel/login`, que pide «USUARIO» (i-50). Funciona con el correo, pero no lo dice.

### 8. El ejemplo no se parece a un día de reparto — MOLESTA (probado)
«Cliente de ejemplo 2 · Calle de ejemplo 2 · Cobrar 12,50 € · 2 bultos» (c-13-ejemplo.png). Son tres, a su alrededor,
pero sin calles de verdad; no enseña el valor (ordenar una ruta de 40 paradas) a quien está en el sofá.

### 9. Al entrar en Cuenta, lo primero tras el plan es vender un regalo — MOLESTA (probado)
«Regala FDS · 1 mes 9,99 € · 1 año 99 € · Comprar regalo» va antes que «Invita y gana» y que el aviso de la mañana
(d-20-cuenta.png). A alguien que lleva diez minutos en la app no le dice nada.

### 10. Dos formas de instalar en Android, una de ellas con aviso de «apps de esta fuente» — MOLESTA (probado)
Google Play y, debajo, «Descargar la app para Android» con «el móvil puede pedirte permitir apps de esta fuente»
(05-ruta-primera.png). A las 22:30 una advertencia de seguridad es un buen motivo para no instalar nada.

## Lo que funciona bien y no hay que tocar

- Alta en ~10 s y 7 toques, sin código de verificación, con lo de «gratis y sin tarjeta» lo primero (01–04).
- La bienvenida pregunta lo correcto («¿Tienes ya tus paradas de hoy?») y da un camino honesto a quien no las tiene
  («Todavía no» → correo de mañana, hora del aviso, ejemplo) (c-11, c-12).
- El correo de bienvenida: claro, con los nombres reales de los botones, enlace que entra sin contraseña y «contesta a
  este correo: lo leo yo» (`ciclo-simulado.txt`).
- «primer_dia» a las 7:01 del día siguiente para altas de lunes a viernes, con «Ayer creaste tu cuenta…»
  (`primer-dia-lunes.txt`), y el resto del ciclo con baja de un clic.
- La mañana siguiente, con la misma sesión: entra solo, «Hoy» limpio, el ejemplo de anoche no estorba, y en 1 toque
  está la caja de pegar la lista (e-30, e-31, e-32). La sesión dura 30 días.
- La app de Play pide permiso de avisos al abrir y se apunta para el aviso de la mañana.

## Los huecos: cuándo se queda sin motivo para volver

1. Al cerrar el ejemplo la primera noche: ya no queda nada que hacer, y el motivo para volver es un correo que puede no
   salir (hallazgo 1) y un aviso que solo vio una vez (hallazgo 3).
2. El lunes por la mañana si se dio de alta el sábado (hallazgo 2).
3. Si instaló la app de Play: al abrirla, otra vez el correo y la contraseña (hallazgo 4).
4. Si cerró la línea de instalar o el móvil es un iPhone en Safari, sin icono y sin aviso: solo queda el correo.

## Veredicto

La hipótesis se sostiene en parte: la app SÍ le da algo a quien se da de alta de noche (ejemplo, pregunta honesta,
hora del aviso, correo de bienvenida), y el plan de traerle a las 7 está bien pensado. Lo que puede explicar que 69 de
104 no vuelvan es que el motivo para volver depende de piezas que no se ven o se caen: el correo de las 7 cuelga de
`CICLO_CORREOS` (sin confirmar en producción), el sábado se pierde el lunes, el aviso push se ofrece una sola vez y luego
lo tapa «Instala la app», y el camino recomendado (Google Play) pide entrar de nuevo. No lo explica el alta (rápida y
limpia) ni la mañana siguiente con la misma sesión (1 toque hasta pegar la lista). Sin ver `correos_enviados` y los
secretos de producción no se puede decir cuánto pesa cada hueco.

## Las tres cosas que yo arreglaría primero y por qué

1. **Comprobar hoy si `CICLO_CORREOS` está a 1 en producción y cuántos «primer_dia» han salido en 30 días**; si está
   apagado, encenderlo (lo decide Dani). Es lo que la app promete en pantalla, y sin él no hay nada a las 7.
2. **Que «Hoy» enseñe el aviso de la mañana antes que «Instala la app» mientras no haya paradas** (o los dos), y que la
   regla de 18 h no se coma la mañana: «bono25» no debería salir la tarde anterior a una mañana de «primer_dia» (el
   lunes del que se apuntó el sábado). Son dos cambios pequeños sobre el único momento en que puede volver.
3. **Que la app de Play entre con la cuenta ya abierta** (el pase en el «install referrer» de Google Play, o un enlace
   `/pase` que la app entienda) y que los correos abran la app si está instalada. Es el camino que la propia app
   recomienda y el único con aviso seguro por la mañana; hoy empieza pidiendo la contraseña otra vez.
