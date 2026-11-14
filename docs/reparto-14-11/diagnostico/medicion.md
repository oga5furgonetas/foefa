# Las 104 altas: qué sabemos, qué no y cómo saberlo sin tocar la base a mano

Parte «medición» del diagnóstico de la app de reparto. Fecha: 14-11-2026. Código mirado: la copia de solo lectura
`C:/Users/dlvie/foefa-p0` (la rama a punto de publicarse). No he cambiado nada ahí, no he usado git y no he tocado
producción.

## Resumen en cinco frases

1. Los pasos que salen de la base (alta, mete parada, entrega, día real) están bien contados en lo esencial; los dos que
   salen de la medición de la app («abren otro día» y «navegan») no: «navegan» vale **cero para todo el que usa la app de
   Android**, porque la nativa no manda ninguna acción, y «abren otro día» se pierde a quien vuelve a una app de Android
   que se quedó abierta en segundo plano.
2. El embudo **no es una escalera**: cada paso cuenta a quien lo tocó, aunque no tocara el anterior. «35 vuelven → 23 meten
   parada» no quiere decir que 12 de los que volvieron no metieran parada; puede haber gente con parada que nunca volvió.
3. De cada alta **no se guarda ni la plataforma ni el origen**: el servidor recibe `desde_app` y lo tira; de utm,
   anuncio o página de entrada no se guarda nada en la cuenta. Por eso hoy no se puede saber si los 104 vinieron de un
   anuncio, de Play o de una invitación, ni si los que se caen son los de Android o los de la web.
4. La app no avisa de **nada de lo que sale mal** antes de la primera parada (cámara denegada, escaneo que no lee,
   dirección no encontrada, error del servidor, lista pegada sin paradas): no hay ni un evento de error. Lo único que
   queda es el registro de escrituras del servidor (`audit_requests`, 30 días), que nadie lee.
5. Sí se puede construir ya una «autopsia de altas» en el panel con lo que hay guardado (plataforma aproximada, forma de
   la primera parada, minutos hasta ella, errores del servidor, móvil apuntado a avisos, días distintos), y con tres
   campos nuevos en el alta se cierra el resto. Está especificada al final (§5).

## Cómo lo he hecho (para repetirlo)

- Leí `backend/activacion.py`, `backend/analitica.py`, las rutas `/analitica/evento`, `/admin/activacion`,
  `/admin/analitica`, `/admin/orgs`, `/admin/overview`, `/admin/primer-dia`, `/admin/actividad`, `/auth/register`,
  `/reparto/mis-pedidos`, `/reparto/pegar`, `/push/fcm-token` de `backend/server.py`; `frontend/src/lib/analitica.js`,
  `AltaRapida.jsx`, `Registro.jsx`, `Empleo.jsx`, `driver/MiRuta.jsx`, `panel/pages/Analitica.jsx` y `Negocio.jsx`;
  en la nativa, `data/Repositorio.kt`, `data/Api.kt`, `ui/hoy/HoyPantalla.kt`, `MainActivity.kt`, `ui/acceso/Acceso.kt`;
  y `tools/metricas/*.py`.
- `evidencias.py` saca con fichero:línea todas las líneas que prueban lo de abajo → **`evidencias.txt`** (278 líneas,
  incluida la lista completa de `medirAccion` de la web).
- `probar_conteo.py` ejecuta **copias** de `activacion.py` y `analitica.py` (carpeta `copia/`) con cuentas inventadas
  → **`salida_probar_conteo.txt`**. Repetir: `python -X utf8 probar_conteo.py`.
- Bajé las dos listas de bloqueo más usadas (EasyPrivacy y EasyList Spanish, páginas públicas) a `listas/` y busqué
  reglas que tapen `/api/analitica/evento`.

Todo está en `C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/reparto/diag/medicion`.

---

## 1. Cómo se cuenta cada paso del embudo

Ruta: `GET /admin/activacion` (`server.py:48353-48365`) → `activacion.recoger` + `activacion.embudo`. Se ve en
`/panel/analitica`, bloque «Activación de repartidores» (`Analitica.jsx:130-229`).

| Paso | De dónde sale | Cuenta de menos cuando… | Cuenta de más cuando… |
|---|---|---|---|
| **Alta** | `organizations` con `sector == "autonomo"` y `created_at` en la ventana (`activacion.py:167-170`), pasadas por `filtrar_reales` (`activacion.py:63-87`) | alguien con `plan: autonomo` pero sin `sector` (lo cuenta `/admin/primer-dia`, `server.py:28384`, y aquí no); nombres que contienen «demo/test/prueba…» sin serlo; quien escribe su correo como nombre (ver §6) | entran cuentas que no son repartidores por su cuenta (§6) |
| **Abren la app otro día** | algún evento de `analitica_eventos` con `org` = la cuenta en un día de Madrid distinto al del alta (`activacion.py:99-101`) | la nativa solo manda su evento al **crear** la pantalla «Hoy» (`HoyPantalla.kt:209`, `LaunchedEffect(Unit)`), no al volver de segundo plano; sin red, el evento se pierde (`Repositorio.kt:137-143`, `runCatching`); bloqueadores (poco probable, ver abajo) | el día se mira con la hora de **Madrid** para todos: un alta de la tarde en América que sigue usando la app pasada la medianoche de Madrid cuenta como «volvió» (probado: caso 3 de `salida_probar_conteo.txt`) |
| **Meten una parada suya** | `reparto_pedidos.count_documents({"ejemplo": {"$ne": True}}) > 0` en la base de la cuenta (`activacion.py:186`) | quien metió una y la borró (el autónomo puede borrar, `server.py:63030-63033`) | — |
| **Empiezan a navegar** | la acción `ruta_navegar` (`activacion.py:43`), que solo manda la web al empezar la guía de la app (`MiRuta.jsx:437-441`) | **toda la app de Android** (no manda acciones, ver abajo); en la web, quien eligió Google Maps o Waze (el «Ir» es un enlace sin medir, `MiRuta.jsx:1538`) | — |
| **Entregan algo** | pedidos `estado: "entregado"` no de ejemplo (`activacion.py:188-190`) | — | una prueba en casa marcada como entregada |
| **Día real** | `_ref_uso_real` (`server.py:65093-65107`): un día con 2 entregas o más separadas 45 min | — | con 2 entregas a la misma dirección ya cuenta (caso 5). Hay **tres varas distintas**: esta, la de `usuarios_total.py:68` (además 2 direcciones distintas) y la de `uso_altas.py:55` (15 entregas en un día) |

**¿La nativa manda eventos con la cuenta? Sí, pero solo uno.** `Repositorio.kt:137-143` manda `{"tipo":"vista",
"ruta":"/ruta"}` con el token de la sesión (`Api.kt:109`), así que el servidor le pone la cuenta (`analitica.py:162-163`).
Queda **descartado** que el 35 esté mal porque la nativa no cuente. Lo que sí está probado:

- Es la **única** llamada de la nativa a la medición (`evidencias.txt`, primera sección): ninguna acción. Por eso
  «navegan» es 0 para Android, y la «peor caída» que pinta el panel puede salir entre «meten parada» y «navegan» sin
  que nadie se haya caído ahí (caso 2: una cuenta de Android que reparte un día entero sale con `navega: False`,
  `entrega: True`, `dia_real: True`).
- El evento de la nativa es **indistinguible** del de Chrome en Android (caso 1: mismo documento salvo la clave de
  sesión). Así que la medición no puede decir qué parte del 35 es app y qué parte web.
- Que se pierdan vueltas por la app abierta en segundo plano es **sospecha** de cuánto: el mecanismo está en el código,
  pero no lo he medido en un móvil.

**Bloqueadores.** Los pasos de la base no les afectan. La medición de la web va a otro dominio
(`VITE_API_URL: ${{ env.BACKEND }}/api`, `.github/workflows/desplegar.yml:157`), ruta `/api/analitica/evento`. En
EasyPrivacy y EasyList Spanish de hoy no hay regla que la tape (la única con «analitica» es para el dominio
`analitica.webrpp.com`, `listas/easyprivacy.txt:15355`). No lo he probado en un navegador con bloqueador: **sospecha**
de que es un efecto pequeño, menor que el de la nativa.

**El embudo no es una escalera.** `pasos_de` marca cada paso por separado (`activacion.py:104-111`) y `embudo` resta
los totales de pasos vecinos para sacar la «peor caída» (`activacion.py:142-147`). Una cuenta puede tener parada sin
haber vuelto otro día (caso 5: `vuelve: False`, `parada: True`). Con los números de producción: de los 23 con parada,
no se sabe cuántos están entre los 35 que volvieron.

## 2. Qué se guarda de cada alta que diga de dónde vino y con qué

Alta: `POST /auth/register` (`server.py:5201-5390`). Los tres formularios mandan casi lo mismo: web portada
(`AltaRapida.jsx:64-76`), web `/registro` (`Registro.jsx:412-427`) y nativa (`Repositorio.kt:164-176`).

**En `organizations`** (`server.py:5251-5312`):

| Campo | Qué dice | Ojo |
|---|---|---|
| `created_at` | hora del alta, texto ISO en UTC | — |
| `pais`, `zona_horaria` | del móvil (`_region_alta`, `server.py:5615-5622`) | la web saca el país del idioma del navegador (`region.js:12-13`), la nativa de la SIM |
| `idioma` | el de la app al darse de alta (`server.py:5281-5282`) | — |
| `sector`, `plan` | `autonomo` | la nativa y el iPhone **siempre** mandan `autonomo` (§6) |
| `alta_ios` | `True` si el alta vino de la app de iPhone (`server.py:5275-5279`) | la **única** marca de plataforma que se guarda |
| `referido_por` / `referido_conductor_id` | quién le invitó, si trajo código válido (`server.py:5264-5268`) | — |
| `alta_red` | huella de la red (no la IP) (`server.py:5269`, `63908-63914`) | sirve para ver altas repetidas desde la misma red |
| `meta_ok`, `meta_fbp`, `meta_fbc` | si aceptó los píxeles y sus cookies (`server.py:5308-5311`) | `meta_fbc` solo existe si llegó por un clic de anuncio de Meta **y** aceptó cookies; la nativa manda siempre sin permiso |
| `prueba_con_tarjeta`, `correos_baja*`, `consentimiento_transferencia` | ajustes del alta | — |
| `meta_app_login_en`, `meta_primera_ruta_en` | se ponen después: primera vez que abre su ruta y primer día con una entrega (`server.py:7569`, `7600`) | marcas de embudo que el panel **no enseña** (§4) |

**En `admin_users`** (`server.py:5314-5320`): `id`, `username` (el correo), `name`, `role: admin`, `org_id`, `email`,
`created_at`. Nada de origen.

**Lo que NO se guarda:**

- **La plataforma del alta** (web, Android, iPhone): el servidor recibe `desde_app` (`server.py:794`) y solo lo usa para
  la tarjeta y Meta (`server.py:5303`, `5328`); no lo apunta. Tampoco la cabecera `X-FDS-App: android-<versión>` que la
  nativa manda en cada petición (`Api.kt:111`).
- **utm, anuncio (`utm_content`), página de entrada, referrer**: nada en la cuenta. Solo viven en la medición anónima,
  en los eventos de la sesión que trae la URL con utm (`analitica.js:80-95`).
- **El origen de un alta en la app de Android**: la nativa no lee el Install Referrer de Play (búsqueda sin
  coincidencias en `evidencias.txt`), no manda utm y no manda ningún evento al darse de alta.

**Lo que se puede reconstruir hoy:**

- **Plataforma, aproximada:** el sufijo del identificador. La nativa pone 4 cifras (`Repositorio.kt:169`,
  `(1000..9999).random()`); la web pone 4 caracteres de base 36 (`AltaRapida.jsx:68`, `Registro.jsx:400`), que solo
  salen todo cifras 6 de cada 1000 veces ((10/36)^4). `alta_ios` marca el iPhone. Además, una cuenta con un documento
  en `push_tokens` (`plataforma: "android"`, `org_id`, `server.py:21508-21518`) ha abierto la app nativa alguna vez
  (se apunta cada vez que se abre, `MainActivity.kt:229-233`).
- **Origen de un alta de la web, exacto:** `registro_ok` se manda **después** de guardar la sesión nueva
  (`AltaRapida.jsx:84-86`, `Registro.jsx:436-439`), así que ese evento lleva la cuenta (`org`). Con
  `{nombre: "registro_ok", org: <id>}` se saca su `sid`, y del primer evento de ese `sid` con `utm`/`ref`/`anuncio`, el
  origen. `tools/metricas/origen_altas.py` no lo aprovecha: casa por hora (±3 min), que con dos altas seguidas se
  equivoca.

## 3. Qué eventos manda hoy la app de reparto y cuáles faltan

**Nativa (Android):** solo la vista `/ruta` (`HoyPantalla.kt:209`) y, en el portal de conductor de empresa,
`/conductor/p/<pantalla>` (`PortalConductorNativo.kt:108`). Ninguna acción.

**Web (y la app de iPhone, que es la web):** todas las vistas de página (`main.jsx:424-428`) y estas acciones
(lista completa con línea en `evidencias.txt`):

- Primera vez y carga: `bienvenida_vista` (`MiRuta.jsx:1014`, una vez por móvil y solo con la ruta vacía),
  `bienvenida_cargar`, `bienvenida_luego` (`2354-2355`), `carga_etiquetas|hoja|lista|mano` (`1027`),
  `ejemplo_cargar` (`995`), `tour_ejemplo` (`1913`, `2360`).
- Meter paradas: `ruta_escaner` (abre la cámara, `1510`, `2062`), `ruta_anadir` (`1519`), `ruta_escaneo` /
  `ruta_codigo` (código leído, `695`, `868`), `ruta_foto_etiqueta` (`755`), `ruta_foto_hoja` (`1390`),
  `ruta_fichero` (`1407`), `ruta_parada_nueva` (`721`, `849`, `915`; el mismo nombre se meta como se meta).
- Situar y repartir: `ruta_situar`, `ruta_situar_mapa|movil|sugerencia` (`1142-1207`), `ruta_ordenar` (`1251`),
  `ruta_navegar` (`439`), `ruta_entregado` / `ruta_no_entregado` (`1239`), `ruta_carga` (`CargaGuiada.jsx:46`).
- Lo demás: `ruta_tarifa`, `consejo_ordenar|hueco|guia_app`, `invitar`, `invitar_entrega_*`, `compartir_dia`,
  `aviso_manana_si|no|fuera`, `tema_*`, `letra_grande|normal`, `gestoria_descargar`, `instalar_*`.
- En el alta de la web: `rep_form_inicio`, `rep_alta`, `registro_ok`, `rep_10s`, `rep_mitad`, `rep_probar`,
  `rep_abrir_alta`, `cookies_si|no`.

**Lo que falta para saber por qué alguien no mete su primera parada:**

| Falta | Hoy | Prueba |
|---|---|---|
| Abrir la app (cada vez, también al volver de segundo plano) | web: vista por página; nativa: solo al crear «Hoy» | `HoyPantalla.kt:209` |
| Cualquier cosa de la nativa (tocar añadir, escáner, escaneo, parada nueva, navegar, entregar) | nada | `Repositorio.kt:137-143` es la única llamada |
| Permiso de cámara denegado / cámara que no arranca | sale «Sin permiso de cámara» y no se mide | `MiRuta.jsx:2816-2817` |
| Permiso de ubicación denegado | no se mide | `MiRuta.jsx:227-229` |
| Escáner abierto que se cierra sin leer nada | se puede deducir en la web (`ruta_escaner` sin `ruta_escaneo` detrás, misma sesión); nativa nada | — |
| Error del servidor al guardar, buscar, pegar o leer el ticket | sale un aviso y no se mide (`setAviso(txError(...))`) | `MiRuta.jsx:742`, `790`, `921` |
| Lista pegada en la que no se ve ninguna parada | el servidor contesta 400 en `/reparto/pegar`, queda solo en `audit_requests` | `server.py:61299-61300` |
| Dirección no encontrada | queda en la parada (`geo: "no"` o `"zona"`, `server.py:60306-60310`), pero se pisa si luego la sitúa a mano | — |
| Llegó al tope del plan gratis (402) | solo en `audit_requests` | `server.py:60734-60736` |
| Cómo se metió la parada (teclado, escáner, foto, lista, compartir) | en la parada: `origen` = `conductor`, `escaneo`, `ticket`, `pegado` (`server.py:62145`, `61315`, `62037`); «compartir con FDS» y «pegar» salen igual (`pegado`) | — |
| Cerró sin hacer nada | se puede deducir en la web (sesión con cuenta y solo vistas); nativa nada | — |
| De qué app viene cada evento (nativa, web, iPhone) | no se guarda; `so` sale del navegador y no distingue la nativa de Chrome | `analitica.py:153`, caso 1 |

## 4. Lo que enseña hoy el panel de super-admin sobre los repartidores

| Página | Qué sale de los repartidores |
|---|---|
| `/panel/analitica` → «Activación de repartidores» | el embudo de 6 pasos de §1 (cuentas y %), la peor caída y una tabla por semana (altas, con parada, entregan, día real). Sin desglose por plataforma, origen ni país. Periodo 7, 30 o 90 días |
| `/panel/analitica` → resto | todo por **visitas**, no por cuentas. «Altas de empresa» cuenta todas las cuentas `account_type: dsp`, **autónomos incluidos** (`server.py:48392-48396`); «Empresas que usan la app» mezcla empresas y autónomos; el filtro «Clientes» también (no hay «Repartidores»: el token no lleva el sector). «De dónde llegan» es por visitas a páginas públicas, no por alta. «Lo que pulsan» enseña 8 acciones de 30 (`Analitica.jsx:465`). El sistema (`so`) y el anuncio (`anuncio`) se guardan en cada evento pero el informe **no los usa** (en `analitica.py` solo aparecen al guardarlos, líneas 153-159) |
| `/panel/admin?s=empresas` | la lista de **todas** las cuentas `dsp` (`server.py:7072-7088`), autónomos mezclados con empresas: nombre, identificador (`/slug`, de ahí sale la plataforma aproximada), estado, plan (`autonomo`), naves, días de prueba que quedan (14 suele ser «invitado», 7 no) y módulos. **Sin** fecha de alta en pantalla, última actividad, paradas, plataforma ni origen |
| `/panel/admin?s=opiniones` | las opiniones y «Qué les frenó» con sus recuentos: «Todavía no he tenido reparto», «No supe cómo meter los paquetes», «Ya uso otra app», «Mi empresa no me deja», «Otra cosa» (`server.py:64070-64071`), con paradas y entregas de cada uno. **Es lo más cercano a un «por qué» que hay hoy** |
| `/panel/admin?s=referidos` | quién invitó a quién y si el invitado llegó a uso real |
| `/panel/admin?s=interesados`, `?s=fundador` | contactos y reservas; no son repartidores de la app |

**Rutas de super-admin que existen y el panel no usa** (ninguna llamada en `frontend/src`, ver `evidencias.txt`):
`/admin/primer-dia` (`server.py:28374`: registrados, con `app_login`, con parada, con primera ruta, con bono, avisos y
correos del primer día), `/admin/actividad` (`server.py:48291`: el registro de escrituras, con nombres e IP),
`/admin/audit-log`, `/admin/org/{id}/stats`, `/admin/latidos`. Desde el Chrome de Dani **no se pueden leer** sin
ejecutar código (piden la cabecera con el token), así que para la sesión principal no existen.

**¿Hay una lista de repartidores con su última actividad, plataforma, paradas y origen? No.** ¿Embudo por origen o
por plataforma? **No.** Lo que la sesión principal puede leer hoy: la Activación (`/panel/analitica`), las
Opiniones con sus motivos (`?s=opiniones`) y, contando a mano en `?s=empresas` las filas con plan `autonomo`, cuántas
tienen identificador que acaba en 4 cifras (Android) y cuántas no (web o iPhone).

## 5. La autopsia de altas (diseño, sin construir)

### Ruta

`GET /api/admin/autopsia-altas?dias=30&minimo=3` — solo `require_superadmin`. `dias` entre 7 y 90. `minimo`: un grupo
con menos cuentas se junta en «otros» (para que ninguna fila señale a una persona). **Nunca** devuelve nombre, correo,
identificador, dirección ni id.

### Respuesta

```json
{
  "dias": 30, "desde": "2026-10-15", "cuentas": 104,
  "fuera": {"demo_o_propia": 0, "nombre_de_prueba": 0, "lote_de_testers": 0, "correo_de_nombre": 0},
  "cobertura": {"eventos_desde": "…", "registro_escrituras_desde": "…", "nota": "la nativa no manda acciones"},
  "por": {
    "plataforma": [{"grupo": "android_nativa", "n": 0,
                    "pasos": {"vuelve": 0, "parada": 0, "entrega": 0, "dia_real": 0},
                    "min_a_primera_parada": {"mediana": null, "p75": null},
                    "con_error": 0, "con_avisos": 0}],
    "origen": [], "pais": [], "idioma": [], "franja_alta": [], "invitado": []
  },
  "primera_parada": {
    "forma": {"teclado": 0, "escaneo": 0, "foto_etiqueta": 0, "lista_pegada": 0},
    "minutos_desde_alta": {"menos_10": 0, "10_60": 0, "1_24h": 0, "mas_24h": 0, "mediana": null},
    "tamano_primera_ruta": {"1": 0, "2_5": 0, "6_20": 0, "21_mas": 0},
    "sin_sitio_en_el_mapa": 0, "situada_a_mano": 0
  },
  "errores": {"cuentas_con_error": 0,
              "por_tipo": [{"ruta": "/api/reparto/mis-pedidos", "codigo": 400, "cuentas": 0}],
              "tope_gratis_402": 0},
  "app": {"avisos_android": 0, "avisos_web": 0, "entraron": 0},
  "dias_distintos": {"1": 0, "2": 0, "3_6": 0, "7_mas": 0}
}
```

`pasos` en cada grupo con la misma vara que `activacion.pasos_de`, y además el embudo **en escalera** (vuelve Y
parada, parada Y entrega…) para leer las caídas de verdad.

### Consultas, y qué sale ya de lo guardado

| Dato | Se saca ya de… | Falta empezar a guardar |
|---|---|---|
| Cuentas | `organizations` con `sector` **o** `plan` `autonomo`, `created_at` en la ventana, `filtrar_reales` | — |
| Plataforma | `alta_ios` → «iphone_app»; `slug` que acaba en `-\d{4}` → «android_nativa»; si no, «web». Contraste: `push_tokens` `{org_id, plataforma:"android"}` | `organizations.alta_plataforma` (web / android / ios_app) y `alta_version` desde `desde_app`, `desde_ios` y la cabecera `X-FDS-App` (`server.py:7500-7504` ya la lee) |
| Origen | `referido_por`/`referido_conductor_id` → «invitado»; `meta_fbc` → «anuncio Meta (aceptó cookies)»; para la web: `analitica_eventos {tipo:"accion", nombre:"registro_ok", org:<id>}` → `sid` → primer `utm`/`anuncio`/`ref` de ese `sid` | `organizations.alta_origen = {utm_source, utm_campaign, utm_content, ref, entrada}`: la web lo guarda al aterrizar (primer toque, en `sessionStorage`) y lo manda en el alta; la nativa, el Install Referrer de Play |
| País, idioma, zona | `pais`, `idioma`, `zona_horaria` | — |
| Franja del alta | `created_at` pasado a `zona_horaria`: mañana 6-14, tarde 14-21, noche 21-6 | — |
| Hasta dónde llegó | lo de §1 (base + eventos) | eventos de la nativa (abajo) |
| Minutos a la primera parada | `min(reparto_pedidos.creado_en)` con `ejemplo != True` menos `created_at` | — (sobrevive a la limpieza de 30 días: `_rep_limpiar` borra datos del cliente, no `creado_en` ni `origen`, `server.py:60488-60495`) |
| Tamaño de la primera ruta | `count(reparto_pedidos {fecha: <fecha de la primera>, ejemplo != True})` | — |
| Forma de la primera parada | `origen` de la primera: `conductor`→teclado, `escaneo`, `ticket`→foto, `pegado`→lista | separar `compartido`/`hoja` de `pegado` y `lote` (escanear seguidos) de `escaneo` |
| Vio un error | `audit_requests {org_id, method:"POST", path: /^\/api\/reparto\//, status: {$gte: 400}}` (30 días, `server.py:2055`); `reparto_pedidos.geo in ["no","zona"]` y `geo_origen` (la situó a mano) | eventos de error del lado del móvil (abajo) |
| App instalada | `push_tokens` (Android) y `push_subscriptions` (web) por `org_id`; `meta_app_login_en` | — |
| Días distintos que la abrió | `analitica_eventos {org}` agrupado por día en su `zona_horaria` | que la nativa mande «abrir» al volver de segundo plano |

### Lo nuevo que pide (pequeño)

1. En el alta: `alta_plataforma`, `alta_version`, `alta_origen` (arriba).
2. En `analitica.evento_desde`: un campo `app` con la cabecera `X-FDS-App` (o «web»).
3. En la nativa: mandar acciones con el mismo nombre que la web (`ruta_escaner`, `ruta_escaneo`, `ruta_parada_nueva`,
   `ruta_navegar`, `ruta_entregado`, `carga_*`) y la vista `/ruta` también en `ON_RESUME`.
4. En las dos: `error_camara`, `error_ubicacion`, `error_guardar`, `error_buscar`, `error_pegar`, `error_ticket`,
   `escaner_sin_leer` (cerró el escáner sin lectura).
5. Sellos en la cuenta que no caducan: `primera_parada_en`, `primera_parada_forma`.

### Dónde va en `Analitica.jsx`

Un componente `Autopsia({ dias })` justo debajo de `<Activacion dias={dias} />` (`Analitica.jsx:293`): arriba, una fila
de pestañas «Plataforma · Origen · País · Hora · Invitado»; debajo, una tabla con una fila por grupo y columnas
Altas · Vuelven · Parada · Entregan · Día real · Min. a la 1.ª parada · Con error; al pie, «Primera parada» (forma y
tamaño) y «Errores» por tipo. Con `minimo`, ningún grupo de menos de 3. La nota de cobertura arriba, como la «·» de la
Activación.

## 6. El filtro de «cuentas reales»

**Lo que hace** (`activacion.py:63-87`): fuera demos, la propia, `sector != autonomo`, nombres con
`prueba|test|demo|revisor|pepito|claude`, tres o más altas en el **mismo minuto de reloj** y el correo como nombre.

**Deja fuera a gente de verdad (probado con nombres inventados, caso 6):**

- «Transportes Demonte» sale fuera por llevar «demo» dentro.
- Quien escribe su correo en «Tu nombre» sale fuera; la regla se hizo para los testers de Play, pero una persona con
  prisa también lo hace.
- `plan: autonomo` sin `sector` sale fuera aquí y dentro en `/admin/primer-dia` (`server.py:28384`).
- Al revés: tres altas en 40 s a caballo de dos minutos se quedan **dentro** aquí y **fuera** en `usuarios_total.py`
  (que mira ±60 s). Los dos sitios que dicen «la misma regla» no la cumplen igual.

**Deja dentro cuentas que no son repartidores por su cuenta (camino probado, cuántos: sospecha):**

- **La app de iPhone** crea siempre cuentas `autonomo` (`Registro.jsx:305`, `310`): una empresa que la pruebe desde el
  iPhone entra como repartidor. Peso en los 104: probablemente poco (la app de iPhone es reciente).
- **La app de Android** crea siempre cuentas `autonomo` (`Repositorio.kt:170`) y su botón grande es «Crear mi cuenta
  gratis» (`Acceso.kt:149`). Un conductor de una empresa cliente al que le dicen «bájate FDS» y no tiene su enlace
  puede crearse una cuenta propia y no meter nunca una parada. El motivo «Mi empresa no me deja» de las opiniones
  apunta a que esa gente existe. Medible en la autopsia: altas cuyo correo coincide con la ficha de un conductor de
  otra empresa (contado como número, sin nombres).
- **Candidatos a empleo**: la página de gracias de una candidatura manda a `/repartidores?utm_source=empleo…` con
  «Invita y gana» (`Empleo.jsx:254`), donde está el formulario de alta (`Repartidores.jsx:143`). Quien busca trabajo y
  quiere el premio por invitar entra como repartidor. Medible ya: `utm = empleo` en la sesión del `registro_ok`.
- **Dos cuentas de la misma persona** (no recuerda la contraseña y se hace otra): cuentan dos. Medible con `alta_red`
  repetida.
- **Empresas que eligen «Repartir yo mismo»** en `/registro` (`Registro.jsx:108-109`): posible, no medible hoy.

**Lo que está bien:** las demos de reparto no crean cuenta (`server.py:63266-63318`: el visitante es un conductor de
la demo `demo-reparto`, con `demo: True`), la demo comercial es `sector: mensajeria`, y el super-admin «entrando
como» un cliente no cuenta (`analitica.py:123-124`, token con `imp`).

---

## Lo que funciona y no hay que tocar

- Los pasos de la base (alta, parada, entrega, día real) se leen de la base y no dependen del móvil ni de bloqueadores.
- La medición nunca rompe una pantalla (`analitica.js:97-107`, `Repositorio.kt:137-143`) y limpia lo que llega
  (`analitica.py:74-116`).
- `registro_ok` lleva la cuenta: el origen de cada alta de la web se puede casar **exacto** con su sesión.
- Las paradas guardan `origen`, `creado_en` y `geo`, y la limpieza de 30 días no los borra.
- `audit_requests` guarda 30 días de cada escritura con la cuenta y el código de respuesta: los errores al meter
  paradas están ahí.
- `push_tokens` dice qué cuentas han abierto la app de Android.
- El panel avisa de que los pasos con «·» pueden ir por debajo y desde cuándo hay eventos (`Analitica.jsx:220-224`).

## Hallazgos, de más a menos grave

1. **No se guarda ni la plataforma ni el origen del alta** — `server.py:794`, `5251-5312`; `Repositorio.kt:164-176`.
   Sin esto no se puede contestar «¿quién se cae?». (bloquea el diagnóstico)
2. **La app de Android no manda ninguna acción ni ningún error, y la web no manda errores** — `Repositorio.kt:137-143`;
   `MiRuta.jsx:2816-2817`. Lo que pasa antes de la primera parada es invisible. (bloquea el diagnóstico)
3. **«Navegan» es 0 para todo Android y el embudo no es una escalera** — `activacion.py:43`, `104-111`, `142-147`;
   casos 2 y 5. La «peor caída» del panel puede señalar un sitio donde nadie se cae. (frena: lleva a arreglar lo
   que no es)
4. **El panel no tiene lista ni desglose de repartidores**, `/admin/primer-dia` no se ve, «Altas de empresa» mezcla
   autónomos y `so`/`anuncio` se guardan y no se usan — §4. (frena)
5. **Entran cuentas que no son repartidores por su cuenta** (Android e iPhone siempre `autonomo`, candidatos de Empleo)
   — §6. Cuántas: sospecha. (frena)
6. **«Abren otro día» se pierde vueltas a la app de Android que estaba en segundo plano** — `HoyPantalla.kt:209`.
   Cuántas: sospecha. (molesta)
7. **El día se mira con la hora de Madrid** para todo el mundo — `activacion.py:59-60`; caso 3. (molesta)
8. **Tres definiciones de «día real» y dos de «tester»** — `_ref_uso_real`, `usuarios_total.py:68`, `uso_altas.py:55`;
   `activacion.py:82` frente a `usuarios_total.py:47`. (molesta)
9. **Las herramientas de `tools/metricas` piden la clave de la base y escriben nombres**, y `uso_altas.py:50` decide
   «app o web» por un referrer que la nativa ya no manda. (molesta)
10. **Bloqueadores**: con las listas de hoy no se tapa la medición; sin probar en un navegador. (sospecha, poco peso)

## Las tres cosas que yo arreglaría primero y por qué

1. **Guardar en el alta la plataforma y el origen** (`alta_plataforma`, `alta_version`, `alta_origen` con utm,
   anuncio, página de entrada y el Install Referrer de Play). Es poco código, no cambia nada para el repartidor, y
   cada alta que entre desde hoy ya dice de dónde viene. Sin esto, la pregunta «¿se caen los de Android o los del
   anuncio X?» no tiene respuesta nunca, por mucho que se mire el panel.
2. **Que la app de Android mande lo mismo que la web, más los errores en las dos** (abrir al volver de segundo plano,
   escáner, escaneo, parada nueva con su forma, navegar, entregar; cámara y ubicación denegadas, error al guardar,
   escáner cerrado sin leer, lista sin paradas), con un campo `app` en cada evento. Así el embudo deja de dar 0 en
   «navegan» para Android y se ve **en qué toque** se queda la gente antes de su primera parada.
3. **La autopsia de altas en `/panel/analitica`** (§5), que con lo que ya hay saca hoy plataforma aproximada, forma y
   tiempo de la primera parada, errores del servidor y móvil apuntado, todo en números y sin un solo nombre, y el
   embudo en escalera. Es lo que deja a la sesión principal (y a Dani) leer el porqué desde el panel en vez de
   ejecutar scripts contra la base.
