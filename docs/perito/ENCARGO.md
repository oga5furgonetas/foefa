# ENCARGO «ANTES DEL PERITO» (14-11-2026) — léelo entero antes de tocar nada

## 1. De dónde sale y qué se ha decidido

FDS lleva 5-6 meses y 0 € cobrados. Una investigación con fuentes, quince candidatos y un tribunal (carpeta
`C:\Users\dlvie\AppData\Local\Temp\claude\34f2eefc27d3445b\9022e766-4683-4c72-a196-f839ddac5172\scratchpad\crecer\busqueda\`,
decisión en `DECISION.md`) ha concluido:

- Lo único con dinero detrás y con precio de mercado es **la furgoneta revisada cada día con fotos** (Pave lo vende a
  6,70 € por furgoneta y mes). Lo usa cada día la empresa del dueño: 3 naves, 63 furgonetas, unas 200 revisiones por semana.
- **La IA de daños no se vende ni se promete**: de cada 100 daños que marca, unos 25 son reales
  (`backend/fiabilidad.py`), y la capa gratuita de Gemini no se puede usar con empresas cliente de la UE.
- Al renting le da igual qué conductor dio el golpe: paga la empresa. Lo que ahorra dinero es **enterarse del golpe el
  día que aparece** (para arreglarlo en el taller propio antes de que lo cobre el perito del renting) y **tener la foto
  de cómo entró la furgoneta**. Por eso el producto que se vende se llama por dentro «Antes del perito»:
  **solo golpes confirmados por una persona**, cada uno con su foto, su fecha y, solo cuando es seguro, quién la llevaba.

Lo que se construye en esta tanda (cuatro zonas, cada una en su copia de trabajo):

| Zona | Copia | Rama | Puerto | Qué |
|---|---|---|---|---|
| servidor | `C:\Users\dlvie\foefa-p1` | flota/perito-servidor | — | el repaso del día, los golpes a mano en el libro, el expediente solo con lo confirmado, la IA apagada para empresas nuevas |
| repaso | `C:\Users\dlvie\foefa-p2` | flota/perito-repaso | 4402 | la pantalla «Repaso» del panel: la foto de hoy junto a la anterior del mismo lado |
| expediente | `C:\Users\dlvie\foefa-p3` | flota/perito-expediente | 4403 | el documento «Expediente del vehículo» para imprimir y su ejemplo público |
| portada | `C:\Users\dlvie\foefa-p4` | flota/perito-portada | 4404 | la portada nueva (empresas primero) con la identidad nueva, y las páginas públicas sin promesas falsas |

## 2. Reglas de verdad (no se negocian; un revisor las comprobará frase a frase)

1. Nada que la app no haga HOY, tal como queda al acabar esta tanda. Si dudas de si algo existe, léelo en el código.
2. La IA: ni «detecta», ni «ve», ni «señala cada golpe», ni «analiza», como promesa. En las pantallas nuevas de esta
   tanda **no aparece la IA**. Quien decide es una persona.
3. «Quién la llevaba» solo se dice cuando es seguro (regla exacta en el contrato del servidor). Si no: «sin conductor
   atribuible» y el motivo. Nunca «quién dio el golpe», nunca «culpable», nunca «responsable».
4. Las fechas son «recibida en el servidor el… a las…». Nunca «hecha a las…».
5. Prohibido: «certificado», «sellado», «inmutable», «auténtico», «verificado», «firmado» (salvo donde ya exista la
   firma de verdad), «sin discusión», «válido ante un juez», «nadie más lo tiene», cifras de ahorro, testimonios,
   nombres de empresas de renting como si las conociéramos, «gratis» como reclamo principal.
6. Precios: los del código hoy (`server.py`, PLAN_LIMITS y precios: Esencial 5 € por vehículo y mes, 14 días de prueba
   sin tarjeta). No inventes planes ni mínimos distintos de los que haya.
7. Las cifras de la casa (3 naves, 63 furgonetas, unas 200 revisiones por semana) ya están en
   `frontend/src/pages/Empresas.jsx` (`CIFRAS_CASA`): se reutilizan tal cual, no se redondean hacia arriba.
8. Datos de ejemplo: siempre inventados (matrículas tipo 5678 KLM, nombres con inicial: «Ana L.»). Nunca datos reales
   de clientes, de conductores ni de paquetes.
9. Dentro de la app de iPhone no puede verse nada de precios ni planes: lo que lleve precio va envuelto como ya van
   `/empresas` y `/planes` (`SoloWeb` en `main.jsx`; lo vigila `frontend/e2e/ios-sin-pagos.spec.js`).

## 3. La identidad nueva (el diseño)

El dueño ha rechazado el aspecto actual por parecer «hecho por una IA». El boceto aprobado para construir está en
`...\scratchpad\crecer\identidad\` (ábrelo: `portada.png`, `producto.png`, y su código en `portada.html`,
`producto.html` y `comun.css`). El informe de un director de diseño sobre qué delata a la máquina está en
`...\busqueda\interfaces.md` (léelo: secciones 2.2 y 3).

**Principio:** tinta sobre papel. El cian del logo es la firma: UNA cosa por pantalla (la acción principal). Lo demás,
tres colores que significan algo (hecho, fallo, avisar). La matrícula y la fecha de cada foto son las protagonistas.

**Colores (día):** tinta `#10181A` · papel `#F5F6F3` · superficie `#FFFFFF` · gris `#545E66` · línea tinta al 12 %
(fuerte, 22 %) · cian relleno `#14E7D8` con tinta encima; cian en texto `#0B6E69` · hecho `#0A7346` · fallo `#B42318` ·
ámbar relleno `#FFC233` con tinta; ámbar en texto `#7A4500`. **Noche:** tinta `#E9EDEF` · papel `#0B1012` · superficie
`#141B1E` · gris `#A3ADB4` · cian `#14E7D8` · hecho `#4CD68A` · fallo `#FF8A80` · ámbar `#FFC233`.

**Letra:** Archivo (ya instalada, `Archivo Variable`) para todo; IBM Plex Mono para fechas, matrículas y cifras.
Titulares en 800 con interletra −0,03em; nada de mayúsculas espaciadas encima de los títulos.

**Lo que NO se pone nunca en lo nuevo:** degradados (ni en botones ni en titulares), sombras de color o brillos,
manchas desenfocadas, ventanas de navegador falsas, rótulos en mono mayúscula espaciada («eyebrows»), rejillas de
tarjetas iguales con un icono en un cuadradito tintado, animaciones que no confirman una acción, emojis.

**Lo que SÍ:** una acción principal por pantalla (botón de 52 px, radio 12, cian relleno con tinta); la secundaria,
con borde; fotos reales con su sello de fecha; la matrícula como pieza; reglas finas de 1 px para separar; números
grandes tabulares; listas en vez de tarjetas; mucho aire; textos de verbo y resultado, tuteando, sin exclamaciones.

**Piezas ya hechas en la base (úsalas, no las dupliques):** `frontend/src/components/Matricula.jsx`,
`frontend/src/components/SelloFoto.jsx`, `frontend/src/lib/sello.js` (`matriculaLegible`, `selloDeFecha`) y sus estilos
`.matricula` y `.sello-foto` al final de `frontend/src/index.css`. Otras que ya existen: el comparador
`frontend/src/panel/components/CompareSlider.jsx`, el editor de cajas `frontend/src/panel/components/BboxEditor.jsx`.

## 4. Normas de trabajo (para todas las zonas)

- Trabaja SOLO en tu copia y SOLO en los ficheros de tu zona. Si necesitas algo de otra zona, no lo toques: dilo en tu
  informe. **Nada de git** (ni add, ni commit, ni stash, ni checkout): de git se encarga quien te ha lanzado.
- `backend/server.py` es enorme, UTF-8 con BOM y CRLF: se edita con la herramienta Edit por trozos exactos, nunca se
  reescribe entero ni con scripts que cambien finales de línea. Búscalo con Grep y lee solo lo necesario.
- En Git Bash, un argumento que empieza por `/` se convierte en ruta de Windows: pon `MSYS_NO_PATHCONV=1` delante si
  pasas rutas tipo `/api/...` a un programa. No uses heredocs con comillas mezcladas: escribe los ficheros con Write.
- Textos del panel: por `t('clave')` con las 6 lenguas en `frontend/src/i18nDict.js` (lo vigila
  `node scripts/check-i18n.mjs`). Textos de páginas públicas: por `tx('frase en español')` con sus 5 traducciones en
  `frontend/src/lib/textosRutaB.js` (lo vigila `node scripts/check-textos-ruta.mjs`). Traduce de verdad, con cuidado.
- Antes de darlo por bueno, en tu copia (desde su raíz): los comprobadores que toquen a tu zona
  (`node scripts/check-existe.mjs`, `check-huerfanos`, `check-marca`, `check-i18n`, `check-permisos`, `check-modulos`,
  `check-textos-ruta`, `check-clases-fantasma`, `check-tema`, `check-contraste` (este lee `frontend/dist`: compila
  antes), `check-funciones-pages`), `cd frontend && npx eslint src e2e && npx vite build`, tus pruebas de Playwright
  con `PUERTO_ZONA=<tu puerto> npx playwright test <tu spec> --project=escritorio --config playwright.zona.config.js`
  (y `--project=movil`), y, si eres el servidor, `python -m pytest backend/tests -q -k "<lo tuyo>"` más los
  comprobadores de Python (`python scripts/check_contracts.py`, `check_tenant.py`, `check_multiempresa.py`,
  `check_objectid.py`, `check_cuerpos.py`, `check_rutas_tapadas.py`, `check_borrado.py`, `check_unicos.py`).
  `check-huerfanos` puede quejarse de piezas comunes que tu zona no usa: dilo en el informe, no las borres.
- Saca fotos de lo que construyas (Playwright, a 1280 px y a 390 px) y MÍRALAS antes de darlo por bueno; guárdalas en
  `...\scratchpad\crecer\perito\fotos-<zona>\`. Si algo se ve torcido, cortado o feo, arréglalo.
- No arranques servidores con Bash salvo el `vite preview` que lanza Playwright con la configuración de zona.
- Tu informe final (texto, corto): qué ficheros has tocado o creado, qué comprobaciones has pasado con su resultado
  literal, qué has dejado sin hacer y por qué, y cualquier cosa que hayas visto rara en el código vecino. No digas que
  algo funciona si no lo has ejecutado.

## 5. El contrato entre el servidor y las pantallas

Lo escribe PRIMERO un agente (antes de que empiecen las zonas servidor, repaso y expediente) en
`...\scratchpad\crecer\perito\CONTRATO.md`, leyendo el código real, con la forma EXACTA de cada respuesta (JSON de
ejemplo completo) y cada error. Las tres zonas lo siguen al pie de la letra. Además, el servidor genera con un test
los ficheros de ejemplo `frontend/e2e/fixtures/repaso-dia.json` y `frontend/e2e/fixtures/expediente.json` a partir de
las rutas de verdad (con la base de mentira de las pruebas), y las pruebas de pantalla de repaso y expediente usan
ESOS ficheros como respuesta simulada: así la pantalla y el servidor no pueden separarse sin que una prueba falle.
Mientras el servidor no los haya generado, repaso y expediente escriben los suyos siguiendo el contrato, en la misma
ruta y con el mismo nombre (al integrar manda el del servidor).

Lo que tiene que cubrir el contrato (los nombres definitivos los fija el contrato tras leer el código):

**A. El repaso del día** — `GET /api/repaso/dia?fecha=AAAA-MM-DD&center=` (admin; respeta el centro y
`allowed_centers` como `/inspections/review-queue`). Devuelve las revisiones de ESE día de negocio (por defecto, hoy),
cada una con: id, furgoneta (id, matrícula, modelo), conductor (id, nombre), hora de llegada, y por cada foto de
carrocería (las de rol «angle»): `photo_index`, `vista`, la URL de la foto, **la foto anterior de la misma vista**
(URL, fecha, conductor, id de su revisión, y si ESA foto anterior fue marcada «igual» o «golpe» por una persona) o
`null` si es la primera de ese lado, y el veredicto ya dado en este repaso (`igual` | `golpe` | `no_se_ve` | `null`).
Además: los golpes confirmados y abiertos de esa furgoneta («ya apuntado», para no marcar dos veces), las furgonetas
activas que hoy no tienen revisión, y las cuentas del día (total, repasadas, con golpe, sin revisar). Las revisiones
antiguas sin repasar (la empresa del dueño tiene más de 1.700) NO son deuda: el repaso es del día que se pide.

**B. El veredicto de un lado** — `POST /api/inspections/{id}/repaso` con `{photo_index, veredicto: "igual"}`,
`{photo_index, veredicto: "no_se_ve"}` o `{photo_index, veredicto: "golpe", part, severity, box_2d, description?}`
(`box_2d` = `[ymin, xmin, ymax, xmax]` de 0 a 1000, como en `missed-damage`). Guarda quién y cuándo. Con «golpe»: el
daño queda en la propia revisión como confirmado por una persona (para que lo pinten la ficha de la inspección, el
taller y el expediente) y en el libro de daños de la furgoneta con origen «human», con la fecha de ESA revisión como
primera vez visto. Si no había foto anterior de ese lado, el golpe se guarda como «ya estaba al empezar»
(`ya_estaba: true`): no se le atribuye a nadie. Si en ese panel ya hay un golpe abierto en el libro, no se pierde ni
se junta en silencio: la respuesta lo dice. Cuando todos los lados de la revisión tienen veredicto, la revisión queda
repasada (`reviewed`). **Deshacer** un veredicto (`DELETE` del mismo lado) lo quita todo limpiamente.

**C. El expediente** — `GET /api/vehicles/{id}/antes-del-perito` (admin). Solo golpes confirmados por una persona
(los marcados en el repaso y los de la IA que alguien confirmó en «Revisión rápida» con «correct»/«corrected»); los de
la IA sin confirmar NO salen. Devuelve: la furgoneta (matrícula, modelo, fin de renting, km), el periodo (primera y
última revisión), cuentas (revisiones, conductores distintos, golpes confirmados, reparados), **cómo entró** (fotos
por vista de la primera revisión y los golpes `ya_estaba`), **cómo está** (fotos por vista de la última), cada golpe
(pieza, gravedad, descripción, fecha en que aparece, foto con su caja, la foto anterior de la misma vista con su fecha
y su conductor, estado de reparación, coste si lo hay) y la **atribución**: `atribuible: true` solo si entre la foto
anterior y la del golpe hubo un único conductor, pasó un día o menos, y la foto anterior de ese lado fue marcada
«igual» por una persona; si no, `atribuible: false` con `motivo` (`varios_conductores` | `varios_dias` |
`anterior_sin_repasar` | `sin_foto_anterior` | `ya_estaba`). Y el calendario: un estado por día del periodo
(`revisada` | `sin_revisar` | `golpe`). Sin IP, sin datos de otras furgonetas, sin nada de la IA.

**D. La IA apagada para empresas nuevas** — Las empresas dadas de alta desde el 14-11-2026 no usan la IA de daños ni
las llamadas a Gemini de la revisión (validación de cada foto, lectura del cuentakilómetros, análisis), salvo que el
dueño de FDS confirme una clave de pago con una variable de entorno. Para las empresas que ya existen NO cambia nada
(mismo comportamiento, mismas rutas). Sin IA, la revisión se guarda con un estado propio (no «error», no «pendiente»,
sin reintentos), el conductor escribe los km a mano (ya existe ese camino) y ninguna pantalla habla de la IA.

**E. El módulo** — «Repaso» (`repaso`) entra en los módulos de TODOS los planes de empresa (Esencial incluido); el
servidor y el panel tienen que coincidir (`node scripts/check-modulos.mjs`, `check-permisos`).
