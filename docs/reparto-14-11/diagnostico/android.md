# El primer uso en la app nativa de Android — diagnóstico con pruebas

Fecha: 14-11-2026. Plan A cumplido: emulador en marcha, app compilada e instalada y servidor de verdad en el PC.
Carpeta: `C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/reparto/diag/android`
(capturas en `capturas/`, registro de toques en `toques.log`, tiempos de paradas en `paradas.log`, registro del servidor en `servidor2.log`).

## Cómo lo he hecho (para repetirlo)

1. Emulador: el AVD se llama **`Medium_Phone_API_37.0`**, no «Medium_Phone» (con ese nombre `emulator.exe` dice «Unknown AVD name»).
   `emulator.exe -avd Medium_Phone_API_37.0 -no-snapshot-save -no-boot-anim -gpu swiftshader_indirect -no-audio`. Arranca en ~1 min.
2. Servidor: `servidor_reparto.py` en el 8787. Para ver qué llamadas hace la app, una copia con el registro de peticiones encendido
   (`servidor_con_log.py`: la misma, con `log_level="info"`) → `servidor2.log`.
3. App: copia de `app-android` sin `build/` ni `.gradle` en mi carpeta, con `local.properties` apuntando al SDK, y
   `./gradlew :app:assembleDebug -PapiUrl=http://10.0.2.2:8787/api/` (2 min 49 s) → `adb install`. Es la 2.4.6, la misma versión que la de Play.
4. Idioma de la app en español con `adb shell cmd locale set-app-locales com.flotadsp.flota.debug --locales es-ES` (el emulador va en inglés y sin root; por eso los diálogos de permisos del sistema salen en inglés).
5. Recorrido con `emu.sh` (copia de `pruebas/emu.sh` con el ADB de este PC: `tocar`, `escribir`, `foto`, `textos`), con `pm clear` antes de empezar para que la app esté como recién instalada.

**Límite de la prueba que hay que tener en cuenta:** la SIM del emulador es de EE. UU. (`gsm.sim.operator.iso-country = us`). La app saca de ahí el país de la cuenta (`Repositorio.kt:94-98`), así que la cuenta nació en «Estados Unidos»: palabras de Latinoamérica («celular», «camioneta»), decimales con punto («4.4 km», «25.00 €») y el buscador de direcciones buscando fuera de España (la primera dirección: «No la encuentro», captura `13-escribiendo-direccion.png`). Lo cambié a España en Ajustes → «País donde repartes» (`15-ajustes-pais.png`) antes de meter paradas. Nada de eso lo cuento como fallo: un repartidor con SIM española no lo vería. Los segundos de las paradas son de la máquina (adb escribe de golpe); los toques sí son los de una persona.

## Las respuestas, en corto

**a) Lo que ve quien instala desde Play.** Una portada limpia: logo, «Tu ruta de reparto, ordenada sola», cuatro ventajas, «Gratis y sin límite hasta el 31 de diciembre · sin tarjeta» y dos botones: «Crear mi cuenta gratis» y «Ya tengo cuenta» (`01-primera-apertura.png`).
No se puede probar nada sin cuenta (no hay ejemplo ni modo invitado: `Acceso.kt:119-157`). No hay «Entrar con Google»: ni en la pantalla ni en el código (en `ui/acceso/` no aparece Google). El alta es una pantalla con **3 campos (nombre, correo, contraseña de 8) + una casilla obligatoria** de términos (`02-alta.png`, `Acceso.kt:343-401`). No pide código por correo. Toques: 1 (crear) + 3 campos + cerrar teclado + casilla + «Crear mi cuenta» = **7 toques y ~50 s** hasta pulsar crear (`toques.log`).
**Y ahí se rompe todo (hallazgo 1).**

**b) La primera pantalla** (`11-hoy-vacia.png`): «Sin paradas todavía» / «Carga tus paradas de hoy» / «Escanea los paquetes o comparte la hoja de la agencia» y dos botones, «Escanear» y «A mano». Dice qué hacer, sí. Hasta la primera parada a mano: «A mano» → tocar el campo (no se pone solo el cursor) → escribir → «Añadir a mi ruta» = **3 toques + la dirección escrita**.

**c) Maneras de meter paradas en la nativa:**
| Manera | ¿Existe? | Coste medido |
|---|---|---|
| A mano, una a una | Sí | 3 toques + escribir la dirección, por parada. 10 paradas = 30 toques + 10 direcciones (`paradas.log`). La 1.ª pantalla de cada parada no pone el cursor en la dirección (`FichaParada.kt:209-216`: solo lo hace al venir del escáner). |
| Pegar una lista | **No** dentro de la app | No hay botón de pegar ni caja de lista (en `ui/` no hay ningún texto de «pegar»). |
| Compartir desde WhatsApp u otra app | Sí (`MainActivity.kt:146-155`, `CompartidoPantalla.kt`) | 3 toques (Compartir → FDS → «Añadir N paradas»). Funciona (`28-compartido-lista.png`), con pegas: hallazgo 3. Y nadie le dice al usuario que existe salvo la frase de la pantalla vacía. |
| Escáner de código/etiqueta | Sí | Abre bien y pide la cámara al entrar (`36-escaner-camara.png`). No he podido probar una etiqueta de verdad (la cámara del emulador es una habitación virtual). |
| Foto de la etiqueta en la ficha | Sí («Foto etiqueta», `16-direccion-1.png`) | No probado con etiqueta real. |
| Voz (dictar) | **No** en la app | Solo el micrófono del teclado de Google. La voz de la app es para hablar (el briefing), no para escuchar (no hay `SpeechRecognizer` en el código). |
| Foto de la hoja / Excel / CSV | Solo si se comparte desde otra app | No hay botón dentro de la app. |

**d) Permisos.**
- **Notificaciones: nada más entrar**, en frío, sin explicar para qué (`04-tras-crear.png`; `MainActivity.kt:228-233`). Si dice que no, al volver a entrar lo pide otra vez (`10-dentro-tras-entrar.png`). Sin consecuencia visible en la app.
- **Ubicación: al pulsar «Ordenar ruta»** (`19-permiso-ubicacion.png`). Si dice que no, ordena igualmente (`20-ordenada-sin-ubicacion.png`) — bien. Al pulsar «Ir» lo pide otra vez y, si dice que no, la guía lo dice claro con un botón «Abrir los permisos» (`22-guia-sin-ubicacion.png`) — bien.
- **Cámara: al abrir el escáner.** Si dice que no: «Para escanear hace falta la cámara» con «Permitir la cámara» (`35-escaner-denegado.png`) — bien.

**e) Nativa frente a web** (web leída en `frontend/src/pages/driver/MiRuta.jsx`, no recorrida por mí).
- Solo la web: «Ver un ejemplo» con paradas de muestra a tu alrededor (`MiRuta.jsx:993-1001`, `:1633`); la bienvenida «¿Tienes ya tus paradas? ¿Cómo te llegan?» que lleva a la herramienta de cada caso (`:1002-1031`); «Lista u hoja» para pegar (`:1561`); foto de la hoja con todas las paradas de golpe (`:1029`, `:1395`); abrir un CSV/Excel (`:1409-1412`); dictar la dirección (`:351`, `:1363`). El propio comentario del código cuenta que esa bienvenida se hizo porque «no supe cómo usarla» era la queja (`:1002-1008`). **Nada de eso existe en la nativa**, que es la que se baja de Play.
- Solo la nativa: «Compartir con FDS» desde cualquier app (texto, foto, PDF), la guía giro a giro con el mapa propio, el escáner con la cámara nativa y la lectura de la etiqueta en el móvil, la carga guiada por huecos («Cargar 0/10»), avisos aunque la app esté cerrada (WorkManager).

**f) Diseño.** No parece una plantilla: tiene una línea propia (cian y verde, tarjeta de la siguiente parada con «Ir / No entregado / Entregado» grandes, lista con número, hora y hueco de la furgoneta: `20-ordenada-sin-ubicacion.png`; guía clara: `24-guia-con-ubicacion.png`). Lo que flojea, con captura:
- `11-hoy-vacia.png`: dos títulos seguidos que dicen lo mismo («Sin paradas todavía» y «Carga tus paradas de hoy»), media pantalla vacía y una cinta «25.00 € por tu primera ruta real · 0/20» que no explica qué es «0/20» (20 entregas, se adivina).
- `02-alta.png`: correcta pero de formulario de siempre; el texto de «sin tarjeta» va debajo del botón, donde ya no se lee, y la casilla de términos con dos enlaces sueltos debajo ocupa como un campo más.
- `18-diez-paradas.png`: la parada se guarda tal cual se escribió («Rua Real 25, A Coruna»), no como la encontró el buscador («Calle Real 25, 15003 A Coruña», `16-direccion-1.png`); la lista queda con faltas.
- `28-compartido-lista.png`: lo compartido no se puede quitar ni corregir fila a fila; solo «Añadir 4» o volver.
- `01-primera-apertura.png`: está bien hecha, pero es texto: ni una imagen de la app trabajando, ni un «pruébala».

## Lo encontrado, de más a menos grave

### 1. BLOQUEA — Al crear la cuenta desde la app, te echa de ella a los pocos segundos (probado dos veces)
- Qué ve el repartidor: rellena el alta, pulsa «Crear mi cuenta», sale el permiso de notificaciones… y vuelve a la pantalla del alta con sus datos puestos, sin ningún aviso (`04-tras-crear.png`, `05b-pantalla.png`, `07-alta2-tras-permiso.png`). Si vuelve a pulsar «Crear mi cuenta»: **«Ese usuario ya existe, elige otro»** (`08-alta-otra-vez.png`). Solo sale de ahí si adivina que tiene que ir a «Ya tengo cuenta» y entrar con lo mismo (`09-entrar.png` → `11-hoy-vacia.png`).
- La prueba de que la cuenta se creó y la sesión se borró: el servidor dio `POST /api/auth/register 200`, `GET /api/reparto/mi-ruta 200` y luego `POST /api/auth/register 409 Conflict` (`servidor2.log`); en el móvil quedan el nombre y el correo pero **no la sesión** (lectura de `files/datastore/fds.preferences_pb`: solo `nombre` y `correo`, sin `token`). El sistema registra que el aviso periódico (AvisosWorker) arrancó justo un segundo después del alta (logcat: `13:26:04 … AvisosWorker`, alta a las `13:26:03`).
- La causa, en el código:
  - El alta del servidor no dice a qué app va: `register_dsp` devuelve el token sin `app_destino` (`backend/server.py:5374-5380`; comprobado contra el servidor local: `app_destino: None` en la respuesta y en el token). El de entrar sí lo pone (`server.py:7463`, `:7657`).
  - La app, cada vez que lee la sesión guardada, **borra** la de un admin si no tiene destino «reparto» (`app-android/.../data/Cuenta.kt:72-88`: `tokenValido = … (rol == "admin" && destino == "reparto")`; si no, `it.remove(kToken)`).
  - Y la sesión se relee justo después del alta: `AvisosWorker.doWork` llama a `cuenta.cargar()` (`data/Avisos.kt:39-41`), y se programa al entrar (`MainActivity.kt:229-232`); también `Fcm.kt:44` y cada vez que se abre la app (`MainActivity.kt:96`).
- Contraprueba: entrando con «Ya tengo cuenta» (que usa `/auth/app-login`, con destino) la sesión **sí** aguanta un cierre y apertura de la app (probado con `am force-stop` y volver a abrir: sigue en «Hoy»).
- Lo que no he podido probar: producción. Pero la app de la prueba es la 2.4.6 (la de Play) y el alta del servidor es el de esta rama; si producción tiene el mismo `register_dsp`, **todo el que se da de alta desde la app de Play se encuentra esto**. Encaja con la caída de los números (alta → abrir otro día). Hay que comprobarlo en producción con una cuenta de prueba antes de nada.

### 2. FRENA — En la app de Play no se pueden meter muchas paradas de golpe, salvo compartiéndolas desde otra app
- No hay «pegar lista», ni foto de la hoja, ni ejemplo, ni la pregunta «¿cómo te llegan las paradas?» (ver e). La pantalla vacía ofrece solo «Escanear» y «A mano» (`11-hoy-vacia.png`, `HoyPantalla.kt:815-825`).
- A mano, 10 paradas = 30 toques + 10 direcciones escritas con el pulgar (`paradas.log`). Con 80-150 paquetes al día, nadie lo hace así.
- Compartir existe y va bien, pero la única pista es la frase «comparte la hoja de la agencia», sin botón ni explicación de cómo.

### 3. FRENA — Lo compartido entra con basura y sin situar
- Compartí una lista como la de un grupo de WhatsApp (cabecera «Pedidos de hoy:» y líneas numeradas). Entraron **4 paradas: la cabecera también** (`28-compartido-lista.png`, `30-lista-abajo.png`), con el «1.», «2.», «3.» delante y el nombre y el teléfono pegados a la dirección («3. Calle Panaderas 30, A Coruna - Ana 600111222»). En esa pantalla no se puede quitar ni corregir ninguna fila (`CompartidoPantalla.kt` no tiene ninguna acción por fila).
- Todas quedaron «Sin situar» (también una lista limpia sin números, 25 s después: `31-compartidas-tras-espera.png`), mientras que las escritas a mano salían «En el mapa» al momento. Al pulsar «Ordenar ruta» se situaron todas menos «Pedidos de hoy:», que se queda en la ruta para siempre como parada sin situar (`33-ordenar-con-sin-situar.png`).

### 4. MOLESTA — El permiso de notificaciones, nada más entrar y sin decir para qué
- Lo primero que ve tras el alta es el diálogo del sistema (`04-tras-crear.png`); si dice que no, en la siguiente entrada lo vuelve a pedir (`10-dentro-tras-entrar.png`). Código: `MainActivity.kt:228-233`. Es el peor momento: aún no sabe qué le va a avisar.

### 5. MOLESTA — Escribir una parada pide un toque de más y guarda la dirección mal escrita
- El campo dirección no se activa solo al abrir «Nueva parada» (`FichaParada.kt:209-216`, solo desde el escáner): un toque más por parada.
- Se guarda lo tecleado y no la dirección que encontró («Rua Real 25, A Coruna» en vez de «Calle Real 25, 15003 A Coruña»): `16-direccion-1.png` frente a `18-diez-paradas.png`.

### 6. MOLESTA — La pantalla vacía repite títulos y la cinta del bono no se entiende
- `11-hoy-vacia.png`: «Sin paradas todavía» + «Carga tus paradas de hoy»; la cinta «25.00 € por tu primera ruta real · 0/20» no explica el 0/20. (El punto decimal es por la SIM de EE. UU.; ver límite de la prueba.)

### 7. Sospecha, no probada — «Acabas ≈ 15:28» no cambió tras entregar 3
- Después de 3 entregas, la cabecera seguía en «Acabas ≈ 15:28 · 4.4 km» (`26-hoy-tras-3.png`), igual que recién ordenada. El reloj del emulador iba en otra zona horaria que el servidor, así que no lo doy por fallo.

### 8. No hay «cerrar el día»
- Ni en la nativa ni en la web encontré un «cerrar/terminar el día» (búsqueda en `ui/` y en `frontend/src`). El día acaba solo con «Ruta terminada» cuando no queda nada (`HoyPantalla.kt:829-841`); lo que quede pasa como «paradas de otros días». No lo cuento como fallo: es una decisión, pero el usuario no recibe un cierre ni un resumen al acabar.

## Lo que funciona bien y no hay que tocar
- La portada: clara, una frase y dos botones (`01-primera-apertura.png`).
- El alta corta, sin código por correo ni tarjeta.
- Entrar con «Ya tengo cuenta» y que la sesión aguante al cerrar y abrir la app.
- El buscador de direcciones al escribir, con «En el mapa / Calle encontrada, sin el portal / Otra calle» (`16-direccion-1.png`): 9 de 10 direcciones de A Coruña encontradas (`paradas.log`).
- «Ordenar ruta» funciona aunque se niegue la ubicación (`20-ordenada-sin-ubicacion.png`), y sitúa las paradas compartidas al ordenar.
- La guía dentro de la app: instrucción grande, «Luego…», hora de llegada, y «Entregado» de un toque que pasa sola a la siguiente con «Deshacer» (`24-guia-con-ubicacion.png`, `25-entrega-1..3.png`). Entregar 3 = 3 toques.
- Cuando falta un permiso, lo dice con un botón para darlo (guía y escáner).
- Compartir desde otra app: 3 toques y entra todo de golpe.

## Las tres cosas que yo arreglaría primero y por qué

1. **Que el alta desde la app no eche al usuario.** Que `register_dsp` devuelva `app_destino: "reparto"` (en la respuesta y en el token) a quien reparte solo, y que la app, al guardar la sesión del alta, apunte «reparto» aunque el servidor no lo diga; y una prueba que haga alta → releer la sesión → seguir dentro. Antes, comprobarlo en producción con una cuenta de prueba. Es lo primero porque, si pasa en Play, ninguna otra mejora llega a verse: el usuario ni siquiera llega a la pantalla de «Hoy» tras darse de alta.
2. **Traer a la nativa la forma de meter muchas paradas de golpe**: «Pegar lista» y «Foto de la hoja» como botones en la pantalla vacía, junto a «Escanear» y «A mano», y explicar «Compartir con FDS» desde WhatsApp. Es donde se cae el resto (23 metieron una parada, 12 entregaron): a mano, una ruta real no se puede cargar.
3. **Limpiar lo compartido/pegado**: no meter cabeceras como parada, quitar «1.» y separar nombre y teléfono, dejar quitar filas antes de añadir y situarlas al momento. Si lo que se pega sale sucio y «sin situar», el repartidor deja de confiar en la app la primera mañana.
