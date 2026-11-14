# El primer uso en la web, con una lista de direcciones (Marta, A Coruña)

Carpeta: `C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/reparto/diag/web-lista`
(capturas en `capturas/`, scripts `p1…p13*.mjs`, `geo_base*.py`, `photon_cerca.mjs`; registro de toques y tiempos en `bitacora.txt`).

## En una frase

Marta se da de alta en 5 toques y sin verificar nada, pega sus 30 direcciones en 6 toques… y **27 de las 30 se quedan
«Sin situar»** sin que la app le diga por qué ni qué hacer en bloque. Luego «Ordenar ruta» le dice «Ruta ordenada: 30
paradas, acabas ≈ 16:23» cuando solo ha ordenado 6. La causa está en el servidor y está probada: **la cuenta nueva no
tiene punto de salida y la ubicación en lote no usa la posición del móvil**, así que toda dirección escrita sin pueblo
ni CP (como las escribe la gente) se descarta aunque el buscador la encuentre a la primera.

## Cómo lo he hecho (para repetirlo)

1. El servidor real de FDS con la base en memoria y los buscadores de verdad por Internet:
   `python -X utf8 .../reparto/servidor_reparto.py C:/Users/dlvie/foefa-p0 8801 .../web-lista/servidor`.
2. La web compilada: `cd C:/Users/dlvie/foefa-p0/frontend && API_DEV_URL=http://127.0.0.1:8801 npx vite preview --port 4461 --strictPort`
   (escucha en `localhost`, no en 127.0.0.1).
3. Playwright (Chromium) como un Pixel 7 a 390×844, táctil, es-ES, con la ubicación concedida en A Coruña
   (43.3623, -8.4115). Un script por paso; el estado de la sesión se guarda en `estado.json` entre scripts.
   `comun.mjs` cuenta los toques y apunta el reloj en `bitacora.txt`.
4. Alta nueva: Marta / `marta.prueba@ejemplo.test` (datos inventados).
5. La lista de 30 direcciones (`lista30.txt`) escrita como en un WhatsApp: abreviaturas («Avda», «C/», «Mtro»,
   «Sta»), pisos («3ºB», «bajo», «4 izq»), sin CP casi todas, alguna con pueblo (Culleredo, Oleiros, Arteixo, Cambre),
   una sola con CP.
6. Para separar causas, la misma lista por el geocodificador del servidor (`geo_base.py`, `geo_base_completa.py`,
   importando `backend/geocodificador.py` sin escribir nada en el repo) con y sin punto de salida, y por Photon con la
   posición del móvil, igual que hace la hoja «Situar» del navegador (`photon_cerca.mjs`, que usa `paraBuscar`/`noToca`
   de `frontend/src/lib/situar.js`).
7. Al acabar, paré mis dos procesos (PID por `netstat -ano`, puertos 8801 y 4461).

Límites de la prueba: el servidor de pruebas no manda correos de verdad ni corre las tareas programadas (sin
`RESEND_API_KEY` no hay bienvenida: no es un fallo); no hay servidor de rutas (el orden sale «por distancia»); la foto
de la hoja necesita Gemini (no configurado) y el dictado necesita el micrófono: **esas dos maneras no las he podido
probar**. Photon y Nominatim cortaron a ratos (503/429 en `servidor.log`), quizá porque otros agentes los usaban desde
el mismo PC; por eso la causa principal la he probado también con el código y con CartoCiudad solo.

## Lo que pasa, paso a paso (reloj de máquina; el humano tarda más al teclear)

| Paso | Toques | Tiempo | Qué ve Marta |
|---|---|---|---|
| Portada `/repartidores` (variante «a») | 0 | <2 s carga | Título claro: «Tu ruta de reparto, ordenada sola.» `01-repartidores.png` |
| Alta: nombre, correo, contraseña, casilla, botón | 5 + tecleo | ~4 s máquina (unos 45-60 s una persona) | Sin verificar correo, sin teléfono, sin tarjeta. `05-alta-rellena.png` |
| «Último paso: instala la app» | 1 («Ahora no, seguir en la web») | — | Pantalla clara, otro estilo. `06-tras-alta.png` |
| Hoja de bienvenida «¿Tienes ya tus paradas de hoy?» | 1 | — | `09-primera-pantalla.png` |
| «¿Cómo te llegan las paradas?» → «Una lista en WhatsApp…» | 1 | — | `14-como-te-llegan.png` |
| Pegar (mantener pulsado + Pegar) | 2 | — | `16-caja-pegada.png` |
| «Revisar» | 1 | 0,1 s | Solo cambia el botón a «Añadir 30 paradas a mi ruta». `17-revisado.png` |
| «Añadir 30 paradas» | 1 | 2,6 s | «✓ 30 paradas añadidas… (≈ 30 s); luego Ordenar ruta». `18-recien-anadidas.png` |
| Esperar | 0 | 50 s | **27 de 30 «Sin situar»**. `20-recargada.png` |
| «Ordenar ruta» | 1 | ~1 s | «Ruta ordenada por tiempo: 30 paradas, acabas ≈ 16:23». `21-ordenar-pulsado.png` |
| Situar UNA a mano (fila → Situar → sugerencia → «Es aquí») | 4 | ~6 s máquina | Funciona y acierta el portal. `25-situar.png`, `28-situada.png` |
| Meter UNA a mano («+» → A mano → teclear → sugerencia → Añadir) | 5 + ~15 letras | ~5 s máquina (~20-25 s una persona) | Autocompletado bueno. `32-a-mano-sugerencias.png` |
| «Ir» | 1 | ~3 s | Navega DENTRO, con giros y voz. `35-ir.png` |
| Entregar (Entregado → «Entregar sin foto») | 2 por entrega | ~2,5 s | `36-tras-entregado.png`, `38-tras-5.png` |
| No entregado (→ «No había nadie») | 2 | — | `40-ausente.png` |
| Fin del día | 0 (sale solo al no quedar ninguna) | — | «Ruta terminada», récord, compartir. `41-fin-del-dia.png` |

Desde que abre el enlace hasta tener 30 paradas metidas: **16 toques y unos 2 minutos**. Hasta tenerlas bien
situadas: **+96 toques** (24 × 4) y 4-6 minutos más, y aun así 5 no tienen una sugerencia buena.

## Hallazgos, de más a menos grave

### 1. BLOQUEA — Pegar la lista deja 27 de 30 «Sin situar», y no es culpa de las direcciones (probado)

- Pantalla: `20-recargada.png` y `20-recargada-entera.png`: tras 57 s, 27 de 30 con la etiqueta «Sin situar». Datos
  devueltos por el servidor en `ruta_tras_pegar.json`: `geo: "no"` en 24, `geo: "zona"` (solo el centro del pueblo) en
  3; con punto solo «Calle Real 52, A Coruña», «Calle Fernando Macias 18 1A, 15004» y la de Oleiros con pueblo y todo.
  La cuenta nueva tiene `base: None` (mismo fichero).
- Causa en el código:
  - `backend/server.py:60820-60826` (`_rep_ubicar_pendientes`, lo que ubica lo pegado en segundo plano) llama a
    `_rep_ubicar(..., base)` con el punto de salida de los ajustes y **sin `cerca`** (la posición del móvil).
  - `backend/server.py:62383-62385` (el reintento al pulsar «Ordenar ruta») igual: recibe la posición del móvil en el
    cuerpo (`origen`, línea 62370) pero ubica con `_rep_base(a)`, que es `None`.
  - `backend/geocodificador.py:625-627` (`lugar_nivel`): si la dirección no trae pueblo ni CP y no hay base, devuelve
    0 = «otro sitio». Lo usan los tres buscadores (líneas 757, 861, 878), así que se descarta todo lo que encuentren.
  - En cambio, una parada suelta sí manda la posición (`server.py:60795-60797`, `cerca`), y la hoja «Situar» y el «A
    mano» buscan en el navegador con la posición (`frontend/src/lib/direcciones.js:36-37`). Por eso a mano funciona y
    en lote no.
- Prueba de la causa, misma lista y mismo momento, geocodificador del servidor completo (`geo_base_completa.log`):
  **sin base 8/30 situadas; con la base en A Coruña 25/30** (16 con su portal exacto). Solo con CartoCiudad
  (`geo_base.py`): 6/30 frente a 16/30.
- Prueba de que la dirección se encuentra: Photon con la posición del móvil, como la hoja «Situar» (`photon_cerca.json`):
  19 de las 24 sin pueblo salen con su portal en A Coruña a la primera («Ronda de Outeiro 112, 15007», «Rúa Barcelona
  45, 15010», «Avenida de Arteixo 30, 15005»…). La hoja «Situar» de la app la encontró en 1,5 s (`25-situar.png`).
- Lo que ve Marta: una lista de 30 con 27 etiquetas naranjas iguales, ningún mensaje de conjunto («faltan 27: dinos tu
  ciudad» o similar), y la única salida es abrir cada una (4 toques). Es exactamente el escalón 104 altas → 23 con una
  parada: quien pega su lista ve que «no funciona».
- Sospecha razonable (no probada con datos de producción): en producción pasa igual a todo autónomo nuevo que pegue o
  importe sin pueblo, porque ninguna pantalla del alta pide el punto de salida.

### 2. BLOQUEA — «Ordenar ruta» dice que ha ordenado 30 cuando ha ordenado 6 (probado)

- `21-ordenar-pulsado.png`: «Ruta ordenada por tiempo: 30 paradas, acabas ≈ 16:23» y arriba «Acabas ≈ 16:23 · 33,6 km».
  En la lista (texto en `bitacora`/salida de `p5`), las 6 primeras tienen hora y las 24 siguientes «Sin situar» y sin
  hora, en el orden en que se pegaron. La hora de fin y los km son solo de esas 6.
- Además 3 de esas 6 están en «zona» (el centro de Cambre, Culleredo o Arteixo), y la app les pone hora (15:21, 15:38,
  16:19) y deja «Ir» y «Entregado» como a cualquier otra (`38-tras-5.png`, «Av. Gonzalo Navarro 14, Ar… 16:19 · Sin situar»).
- Texto del aviso: `frontend/src/pages/driver/MiRuta.jsx:1258-1260` (usa `data.ordenados`, que en
  `server.py:62396` es `ruta["paradas"]`). Para quien viene de Circuit, que te marca en rojo lo que no ha podido poner
  en el mapa antes de optimizar, esto es engañoso: se fía, sale, y a mitad de mañana se encuentra 24 paradas sin orden.

### 3. FRENA — Cuando falla, se le pide arreglar una a una (4 toques) y algunas sugerencias son de otra ciudad (probado)

- Situar una: fila → «Situar» → sugerencia → «Es aquí» = 4 toques (`bitacora.txt`, «situar una parada: 4 toques»). Para
  24: ~96 toques. No hay «situar todas» ni «todas son de A Coruña».
- Hoja «Situar» bien hecha cuando hay sugerencia: acierta el portal (`25-situar.png`). Pero con la posición del móvil,
  Photon da como primera opción, para 5 de las 24, un sitio de otra ciudad (`photon_cerca.json`): «Plaza de Pontevedra 9» →
  Fuenlabrada; «Rúa Caballeros 15» → Santiago; «Calle Joaquin Planells 23» → Oviedo; «Avda Finisterre 210» → Canadá;
  «Lugar de Mera 4» → Suiza. Las de otro país las filtra la web (`direcciones.js:47`); las de otra ciudad de España
  saldrían como sugerencia. No lo he visto en pantalla para esas 5: es lo que devuelve la misma búsqueda.
- Con base, el servidor también se equivoca en 2 (`geo_base_completa.log`): «C/ Ramon Cabanillas 12» → Acea de Ama
  (Culleredo) y «rua Pintor Seijo Rubio 5» → Betanzos (20 km), cuando Photon las da en A Coruña (15007 y 15006).

### 4. FRENA — Tres puertas distintas y la del enlace corto no deja darse de alta (probado)

- `/ruta` sin sesión (`02-ruta-sin-cuenta.png`) es un «Entra en FDS» con correo y contraseña, botón naranja y otra letra;
  darse de alta es un enlace pequeño abajo. Si a Marta le pasan «flotadsp.com/ruta», lo primero que ve es que le piden
  una cuenta que no tiene.
- `/repartidores` (`01-repartidores.png`) y `/empezar` (`03-empezar.png`) sí se entienden en 5 s. Pero las tres no se
  parecen entre sí, y la app de dentro (`09-…`, fondo claro, verde azulado) tampoco se parece a ninguna de ellas.
- La portada promete «Haz una foto a la etiqueta o escanea el paquete»: Marta no tiene etiquetas, tiene una lista de
  WhatsApp; eso solo se menciona en la variante «b» (`42-repartidores-variante-b.png`: «¿Te dan una hoja con la lista?»).

### 5. MOLESTA — Antes de su primera parada, tres capas entre ella y la caja (probado)

- Tras el alta: «Último paso: instala la app» (pantalla entera, `06-tras-alta.png`) → hoja de bienvenida
  (`09-primera-pantalla.png`) → «¿Cómo te llegan las paradas?» (`14-como-te-llegan.png`) → caja. Son 3 toques que no
  meten nada. Lo de «Último paso: instala la app» lleva a Play o a un APK con el aviso «el móvil puede pedirte permitir
  apps de esta fuente», que asusta y le saca de la web donde ya está dentro.
- La pantalla de inicio ofrece a la vez: Escanear, Foto etiqueta, Lista u hoja, A mano, Código + lupa, Cargar paquetes,
  Ver un ejemplo, ¿Cómo funciona?, la franja «Instala la app» y la de «25 € por tu primera ruta real» (`09-…` detrás de
  la hoja). Diez cosas tocables para una sola decisión.
- «Revisar» (`17-revisado.png`) no enseña lo leído (ni cuántas tienen pueblo, ni cuáles no se van a poder situar): solo
  cambia el botón. Es un toque sin información. Es el sitio natural para avisar «24 sin pueblo ni CP: ¿son de A Coruña?».
- Al teclear a mano sale «No la encuentro: elige una sugerencia o …» en naranja mientras la sugerencia correcta está
  justo debajo (`32-a-mano-sugerencias.png`): parece un error cuando no lo es.

### 6. MOLESTA — Detalles que restan confianza (probado)

- Una parada repetida no se detecta si se escribe distinto: añadí «Rúa Vizcaya 3» a mano y quedó como la 31 junto a la
  13 «Rua Vizcaya 3» (salida de `p10`, «31 Rúa Vizcaya 3, 15007 A Coruña»).
- Tras situar una sola, el botón pasa a «Reordenar» en naranja y aparece «+23 min» en rojo arriba (`32-…`, `36-…`)
  sin explicar qué es.
- Las etiquetas «Detrás · izq», «Medio · izq», «Cargar 0/30» aparecen al ordenar sin que Marta haya cargado nada
  (`21-ordenar-pulsado.png`): es el «dónde va en la furgoneta», pero no lo dice.
- La ficha de una parada sin nombre se titula «Cliente» (`24-ficha-parada.png`).
- El primer día ya dice «¡Récord de entregas!» y «¡Tu mejor día!» (`41-fin-del-dia.png`).

## Lo que funciona bien y no hay que tocar

- **El alta**: 3 campos, sin verificar correo, sin teléfono, sin tarjeta; entra directa a `/ruta`
  (`frontend/src/pages/AltaRapida.jsx:89`).
- **Pegar y abrir fichero**: acepta la lista tal cual, quita pisos y «bajo», y el fichero .txt carga las 30 líneas
  (`43-fichero-cargado.png`).
- **Meter a mano**: autocompletado con la posición del móvil, rápido y con el portal correcto (`32-…`), y tiene
  micrófono para dictar (no probado).
- **Situar una**: la hoja con mapa y «¿Es alguna de estas?» acierta el portal cuando lo hay (`25-situar.png`).
- **Navegar**: dentro de la app, con giros, distancia y voz (`35-ir.png`), sin saltar a Google Maps (se puede elegir).
- **Entregar**: 2 toques («Entregado» → «Entregar sin foto»), con «Deshacer» y la siguiente parada en el aviso
  (`38-tras-5.png`). No entregado: 2 toques con motivos claros. Botones grandes, se pulsan con el pulgar.
- **Fin del día**: aparece solo al acabar, con el resumen de un vistazo (`41-fin-del-dia.png`).
- **La app por dentro** tiene buena jerarquía: número grande, dirección en negrita, botones grandes, contraste
  bueno. Parece una app seria, no una plantilla; lo que la estropea es la cantidad de cosas a la vez, no el estilo.

## Comparado con Circuit/Spoke

Circuit: pegar o importar → marca en rojo las que no entiende ANTES de optimizar → «Optimizar» → «Siguiente parada».
Aquí lo de pegar, navegar y entregar está a la altura (o mejor, por navegar dentro y entregar en 2 toques). Lo que
falta es justo el paso del medio: situar bien en lote usando dónde está el repartidor, y decir con claridad cuántas no
ha podido situar antes de dar la ruta por ordenada.

## Las tres cosas que yo arreglaría primero y por qué

1. **Ubicar lo pegado con la posición del móvil (o pedir la ciudad una vez).** Que la app mande su posición al pegar y
   que `_rep_ubicar_pendientes` y el reintento de «Ordenar» la usen como `cerca` cuando no hay base; o, mejor aún,
   guardar esa posición como punto de salida la primera vez. En la misma lista pasa de 8/30 a 25/30 situadas. Es el
   arreglo más pequeño con más efecto sobre el escalón 104 → 23.
2. **No decir «30 paradas ordenadas» si no lo están.** Antes de ordenar, «Faltan 24 por situar» con un botón para
   situarlas, y el aviso con la cifra de verdad («6 ordenadas, 24 sin situar»). Que las de «zona» no parezcan paradas
   buenas. Hoy la app engaña justo en el momento en que Marta decide fiarse.
3. **Una sola puerta y nada entre el alta y la caja de pegar.** `/ruta` sin sesión con el alta delante (no un
   «Entrar»), quitar la pantalla entera de «instala la app» del primer minuto (dejar la franja) y que «Revisar» enseñe
   lo leído y avise de las que no traen pueblo. Son 3-4 toques y un susto menos antes de la primera parada.
