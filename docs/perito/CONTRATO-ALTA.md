# CONTRATO «UNA FLOTA EMPIEZA SOLA EN DIEZ MINUTOS» — servidor ↔ pantallas (14-11-2026)

Escrito leyendo `C:\Users\dlvie\foefa-p7` (líneas de `backend/server.py` de esa copia; búscalas por el nombre, pueden
moverse). Servidor y pantallas lo siguen al pie de la letra. Si algo no cuadra con el código, manda lo más seguro y se
dice en el informe. Todo error es `{"detail": ...}` de FastAPI; `require_admin` da 403 «Acceso restringido a
administradores»; sin sesión, 401 «Se requiere autenticación»; la demo bloquea las escrituras como ya hace.

## Correcciones del servidor (14-11-2026, al implementarlo; mandan sobre lo de abajo)

Las respuestas reales están en `frontend/e2e/fixtures/alta-*.json` (las genera `backend/tests/test_alta_fixtures.py`
con las rutas de verdad): úsalas como respuesta simulada. Lo que precisa o cambia respecto al texto de abajo:

1. **`n` de cada línea** (3.2 y 3.3) es su posición entre las líneas NO vacías (1, 2, 3…), no el número de línea del
   cuadro con las vacías contadas.
2. **`/alta/conductores`, cómo se parte una línea:** un trozo hecho solo de cifras y `+ ( ) - .` y espacios es un
   móvil; si no tiene 9 cifras o no se monta → error `«El móvil «612 34» no parece un número.»` (con el trozo tal cual).
   Sin separadores, además de un móvil al final («Ana López 612345678», si ese final tiene 3 cifras o más; «Furgo 2»
   sigue siendo nombre) vale un correo suelto en cualquier sitio de la línea. Con varios móviles o correos en una
   línea, cuenta el primero.
3. **«Ya está»** se mira en este orden: móvil, correo y, solo si la línea no trae ninguno, nombre. Si esa ficha es de
   un centro que el usuario no ve (o no tiene centro y el usuario tiene centros asignados), la línea es `error` con
   `«Es de un centro que no tienes asignado.»` y no se dice el nombre (igual que las furgonetas en 3.2).
4. **Con centros asignados, una ficha SIN centro no es visible** también en `GET /conductores/accesos` y en
   `/alta/estado` (como en 1.3): no sale en la lista ni cuenta.
5. **`renovado`** (1.3) es `true` siempre que hubiera un enlace anterior de ese conductor (abierto, sin abrir o
   caducado), y `false` si es el primero.
6. **`DELETE /conductores/{id}/acceso`** no se le niega a la plataforma (`imp`): quitar un acceso solo puede hacerlo más
   seguro. Crear sí (403 `_SOLO_EL_CLIENTE`).
7. **`POST /auth/enlace`, el 400** sale también si el cuerpo no es JSON o no es un objeto (nunca un 422 que devuelva
   lo recibido, ni un 500). El orden de 1.6 se mantiene: sin `dispositivo` válido, 400 antes de mirar nada.
8. **`/auth/renovar` sin `lk`** queda exactamente como hoy (no copia `via`). Con `lk`, como en 1.7.
9. **`revision.conductor`** (3.1): si la revisión tiene `driver_id` pero esa ficha ya no existe, `{"id", "nombre": ""}`.
10. **`TokenResponse.correo_bienvenida`** va `null` en todas las respuestas que no son el alta.
11. **`backend/analitica.py` (`"c"` en `PRIMEROS`) NO está hecho**: es un fichero fuera de la zona del servidor de
    esta tanda y el permiso se denegó. Hasta que se añada, una visita a `/c` se guarda como `/otra` (sin token: el
    fragmento no llega). Lo tiene que hacer quien integre.
12. **El correo del autónomo** que cae en la bienvenida genérica (sin el ciclo) conserva su frase de siempre en lugar
    de «No hace falta tarjeta…»; con prueba con tarjeta: «Al acabar la prueba se cobra el plan elegido salvo que lo
    canceles.» El correo lleva además una versión en texto (`text`) con lo mismo.

## Códigos (R12, tercera tanda, 14-11-2026; manda sobre lo de abajo)

Lo escribe la zona «acceso-servidor» (copia `foefa-p7`). La pantalla traduce por `codigo`; si no conoce el código,
enseña `detail` (siempre en español). Los códigos son fijos: no se renombran sin avisar.

**Forma de un error de estas rutas:** `{"detail": <lo de siempre>, "codigo": "<código>"}` y, cuando la frase lleva un
dato, `"dato": "<el dato>"` (el nombre del conductor, por ejemplo). `detail` NO cambia de forma: es texto, salvo en los
409 de `POST /conductores/{id}/acceso`, que siguen siendo el objeto `{"codigo", "mensaje"}` de siempre (el `codigo` va
además fuera, igual). Los errores genéricos que no son de estas rutas (`require_admin` 403 «Acceso restringido a
administradores», 401 sin sesión o con el token caducado, la demo) NO llevan `codigo`: se distinguen por el estado.

### Entrar con el enlace — `POST /api/auth/enlace`
| estado | `codigo` | `detail` |
|---|---|---|
| 400 | `enlace_sin_telefono` | `Falta el identificador de este teléfono. Vuelve a abrir el enlace.` |
| 401 | `enlace_no_vale` | `Este enlace ya no vale. Pide uno nuevo a tu empresa.` (idéntico, byte a byte, para todos los casos) |
| 409 | `enlace_usado_en_otro` | `Este enlace ya se abrió en otro teléfono o en otro navegador de este. Ábrelo donde lo abriste la primera vez o pide uno nuevo a tu empresa.` |
| 429 | `demasiados_intentos` | `Demasiados intentos fallidos. Espera 5 minutos.` |

El límite por enlace (5 fallos en 5 min) solo cuenta y solo castiga a los teléfonos SIN el secreto con que se abrió:
el teléfono bueno entra aunque otro haya probado cinco veces.

### La sesión del enlace en cualquier ruta, y `POST /api/auth/renovar`
| estado | `codigo` | `detail` |
|---|---|---|
| 401 | `acceso_cambiado` | `Este acceso ya no vale. Pide a tu empresa que te mande el enlace otra vez.` |

Sale cuando el enlace de la sesión se renueva, se anula, la ficha se da de baja o se le quita el acceso. El JWT caducado
(30 días) sigue siendo el 401 genérico sin código: la pantalla sabe por el propio token (`via: "enlace"`) qué decir.

### Lo que una sesión del enlace NO puede hacer (R12)
| ruta | estado | `codigo` | `detail` |
|---|---|---|---|
| `POST /api/auth/change-my-password` (cambiar o crear) | 403 | `enlace_sin_contrasena` | `Con el enlace no se puede cambiar la contraseña. Pide a tu empresa que te la cambie.` |
| `POST /api/auth/codigo-clave` (el código para cambiarla) | 403 | `enlace_sin_contrasena` | el mismo |
| `POST /api/portal/mi-correo-personal` (vincular un correo de acceso) | 403 | `enlace_sin_contrasena` | el mismo |
| `POST /api/portal/mi-telefono` cuando la ficha YA tiene teléfono (cambiarlo; ponerlo si falta sí se puede) | 403 | `enlace_sin_cambiar_telefono` | `Con el enlace no se puede cambiar el teléfono. Pide a tu empresa que te lo cambie.` |

La sesión del enlace no cuenta como «recién entrado» (no lleva `at`): `GET /portal/mi-ficha` le da
`clave_sin_actual: false` y `configurar_cuenta: false`. Las sesiones de código y de contraseña siguen como siempre.

### El enlace en el panel — `POST /api/conductores/{id}/acceso`, `GET /api/conductores/accesos`, `DELETE /api/conductores/{id}/acceso`
| estado | `codigo` | `detail` | ruta |
|---|---|---|---|
| 403 | `sin_permiso` | `No tienes acceso a la pantalla de Conductores.` | las tres (usuario con permisos definidos sin «conductores») |
| 403 | `solo_el_cliente` | el texto de siempre de «Estás dentro como la plataforma…» | POST |
| 403 | `sesion_sin_empresa` | `Tu sesión no corresponde a ninguna empresa: entra otra vez.` | las tres |
| 404 | `conductor_no_encontrado` | `Conductor no encontrado` | POST, DELETE |
| 403 | `centro_no_visible` | `No tienes acceso a ese centro` | las tres (GET con `?center=` ajeno) |
| 409 | `ya_abierto` | `{"codigo": "ya_abierto", "mensaje": "Ana L. ya entra con su enlace…"}`; `dato`: el nombre | POST |
| 409 | `de_baja` | `{"codigo": "de_baja", "mensaje": "Ana L. está de baja…"}`; `dato`: el nombre | POST |
| 409 | `acceso_quitado` | `{"codigo": "acceso_quitado", "mensaje": "A Ana L. le quitaron el acceso…"}`; `dato`: el nombre | POST |

`whatsapp` (en la respuesta del POST y en cada fila de la lista) ya no se inventa: con «+» o «00» delante se respeta; sin
prefijo, según el país de la empresa: España 9 cifras que empiezan por 6 o 7 (o esas mismas con «34» delante); Portugal
9 cifras que empiezan por 91, 92, 93 o 96; Francia 06/07 y 8 cifras; Italia 3 y 8-9 cifras; Alemania 015/016/017 y
8-9 cifras; Reino Unido 07 y 9 cifras; Irlanda 083-089 y 7 cifras. Cualquier otra cosa, o un país sin regla → `null`
(WhatsApp pregunta a quién). Los días (`creado_dia`, `abierto_dia`, `caduca_dia`, y `dia`/`hora` de la revisión del
arranque) salen en la zona horaria de la empresa, no fijos en Madrid.

### El arranque — `GET /api/alta/estado`, `POST /api/alta/furgonetas`, `POST /api/alta/conductores`
Errores de la ruta:
| estado | `codigo` | `detail` |
|---|---|---|
| 400 | `sin_matriculas` | `Pega o escribe al menos una matrícula.` |
| 400 | `sin_conductores` | `Pega o escribe al menos un conductor.` |
| 400 | `demasiadas_lineas` | `Son demasiadas líneas: pega como mucho 300 de una vez.` |
| 400 | `elige_sede` | `Elige la sede de estas furgonetas: tienes varias.` / `Elige la sede de estos conductores: tienes varias.` |
| 400 | `centro_ajeno` | `Ese centro no es de tu empresa.` |
| 403 | `centro_no_visible` | `No tienes acceso a ese centro` |
| 403 | `sesion_sin_empresa` | `Tu sesión no corresponde a ninguna empresa: entra otra vez.` (también en `/alta/estado`) |

Cada línea de `/alta/furgonetas` lleva además `codigo` (null si es `nueva` sin más):
| `estado` | `codigo` | `motivo` |
|---|---|---|
| `nueva` | `null` | `null` |
| `ya_estaba` | `matricula_ya_estaba` | `Ya la tienes dada de alta.` |
| `error` | `matricula_repetida` | `Repetida en la lista.` |
| `error` | `matricula_rara` | `No parece una matrícula.` |
| `error` | `cabecera` | `Es la cabecera de la lista: no se da de alta.` |
| `error` | `otro_centro` | `Es de un centro que no tienes asignado.` |
| **`dudosa`** (nuevo) | `matricula_dudosa` | `¿Seguro que es una matrícula?` |

- **Parece matrícula** (sale `nueva`): las formas de verdad. España `1234 ABC` y las antiguas `M-1234-AB`, `GC 1234 B`,
  `M-123456`, `R-1234-BCD`; Portugal `AB-12-CD`, `12-AB-34`, `12-34-AB`, `AB-12-34`; Francia e Italia `AB-123-CD`;
  Alemania `B-AB 1234` (con su separador); Reino Unido `AB12 CDE`.
- **Dudosa**: tiene letras y cifras pero no tiene ninguna de esas formas («Furgo 1», «Calle 5», «VAN 12», «Furgoneta
  2», «Total: 3»). NO se da de alta salvo que se confirme: el cuerpo admite `"confirmadas": ["Furgo 1", …]` (el texto de
  la línea o la matrícula; se compara sin espacios ni guiones ni mayúsculas). Una dudosa confirmada sale `nueva`, con
  `codigo: null` y `"confirmada": true` (las demás llevan `"confirmada": false`). La respuesta suma `"dudosas": N`.
- **Dos columnas** («1234 ABC⇥48000 km», «1234 ABC;Ford Transit»): cuenta la primera (tabulador, «;» o «,»).
- **Cabecera**: «Matrícula», «Matrículas», «Placa», «Vehículo», «Furgoneta» (y lo mismo con dos columnas). No entra.

Cada línea de `/alta/conductores` lleva además `codigo`, `aviso_codigo` y `dato`:
| `estado` | `codigo` | `motivo` | `dato` |
|---|---|---|---|
| `nuevo` | `null` | `null` | `null` |
| `ya_estaba` | `conductor_ya_estaba` | `Ya está dado de alta como «LUIS PÉREZ».` | el nombre de la ficha que ya está |
| `error` | `falta_nombre` | `Falta el nombre.` | `null` |
| `error` | `telefono_raro` | `El móvil «612 34» no parece un número.` | el trozo tal cual |
| `error` | `conductor_repetido` | `Repetida en la lista.` | `null` |
| `error` | `otro_centro` | `Es de un centro que no tienes asignado.` | `null` |
| `error` | `cabecera` | `Es la cabecera de la lista: no se da de alta.` | `null` |
| `error` | `alta_rechazada` | el `mensaje` que dio el alta al guardar (correo repetido, ficha de baja…) | `null` |

`aviso_codigo`: `sin_movil` (`aviso`: `Sin móvil: tendrás que copiarle el enlace.`) o `null`.
- **Cabecera**: una línea sin cifras ni correo hecha solo de palabras de cabecera («Nombre, Teléfono», «Nombre⇥Móvil⇥
  Correo», «Conductor»…). No entra.
- **Nombre con coma**: «López García, Ana, 612 345 678» → nombre «López García, Ana». Lo que va entre comas y no es un
  móvil ni un correo es parte del nombre (con tabulador o «;» entre columnas, se juntan con un espacio).
- **El móvil** se monta con la misma regla que `whatsapp` (país de la empresa); si no se puede → `telefono_raro`.

`GET /api/alta/estado` es barata: `revisiones` vale 0, 1 o 2 (**2 = dos o más**; la pantalla solo mira 0, 1 y >0) y
no se leen listas enteras. Lo demás, igual.

## 0. Cambios respecto al encargo (leer primero)

1. **Las sesiones de hoy NO se pueden cortar.** El token del conductor es un JWT de 30 días (`create_token`, l. 969)
   y `get_current_user` (l. 1088) solo vuelve a mirar la base para los admin; para el conductor solo cambia la ficha
   de baja por la activa del mismo correo (`_ficha_activa_de`). Ni dar de baja ni quitar la cuenta corta hoy una
   sesión abierta por código o contraseña (solo `/auth/renovar` lo mira). **Regla que sí se cumple:** la sesión que
   nace del enlace lleva dentro el id del enlace (`lk`) y `get_current_user` comprueba en CADA petición (caché de 60 s
   por proceso, como `_admin_cacheado`) que ese enlace sigue vivo y que la ficha sigue activa. Renovar, invalidar o
   dar de baja corta esa sesión en 60 s como mucho (al momento en el proceso que hace el cambio, que borra su caché).
   Las sesiones por código o contraseña siguen exactamente como hoy (no se cortan): fuera de esta tanda, se apunta.
2. **El token va en el fragmento: `https://<web>/c#<token>`, no en la ruta `/c/<token>`.** Lo que va detrás de `#`
   no llega a ningún servidor (ni a Cloudflare, ni a la vista previa que hace WhatsApp, ni a ningún registro), igual
   que el pase al móvil de hoy (`/auth/pase-movil`, l. 8873). La ruta que se mide es `/c` sin nada más.
3. **El token es `secrets.token_hex(32)`** (64 cifras hex, los mismos 256 bits que `token_urlsafe(32)`): un `-` o `_`
   al final de un enlace hace que algunas apps lo corten al convertirlo en enlace.
4. **El secreto del teléfono lo crea el navegador, no el servidor.** El navegador guarda UNO por teléfono
   (`localStorage['fds_dispositivo']`, 32 bytes aleatorios en base64url) y lo manda en cada canje; la primera vez el
   servidor guarda su SHA-256 y desde entonces el enlace solo vale con él. Si el servidor lo entregase y la respuesta se
   perdiese por mala cobertura, el enlace quedaría atado a un secreto que el teléfono no tiene. Así un reintento vale.
5. **Entrar es un toque, no automático.** `/c` enseña un botón «Entrar»; el canje sale al tocarlo. Así ningún
   programa que abra el enlace (vistas previas, antivirus) lo ata a su máquina. Si en ese navegador hay una sesión del
   PANEL (`flota_token`), avisa antes de atarlo (el dueño probando su propio enlace).
6. **«Mandado» no se puede saber** (lo manda el dueño desde su WhatsApp). Los estados son `sin_enlace`,
   `sin_abrir` («Enlace creado, sin abrir»), `abierto` y `caducado`.
7. **Mandarlo otra vez = renovarlo.** Solo se guarda el hash: el mismo enlace no se puede volver a enseñar. Si aún no
   se abrió, se crea otro sin preguntar (el viejo deja de valer); si ya se abrió, el servidor pide `renovar: true`.
8. **Dar de baja** = `DELETE /drivers/{id}` y el `PATCH /drivers/{id}` que pasa `active` de true a false (el `PUT`
   de l. 29964 no toca `active` hoy; si lo tocase, igual):
   borran el enlace (reactivar después NO lo revive; hay que mandar otro). Lo inactivo por la hoja de Google o por
   fusión no lo borra, pero mientras la ficha no esté activa el enlace y su sesión no valen.
9. **Listas pegadas: dos rutas nuevas pequeñas** (`/alta/furgonetas`, `/alta/conductores`) en vez de la importación
   de ficheros: dicen línea a línea qué pasa ANTES de guardar. Por dentro usan las mismas piezas (`_veh_clave`,
   `_veh_matricula`, `create_driver`), así que las reglas son las mismas.
10. **El recorrido vive en `/panel/arranque`** (no `/panel/empezar`: `/empezar` ya es una página pública y la
    analítica las confundiría).
11. **La guía de hoy (`Activacion.jsx`)**: su bloque de tres pasos se quita (lo sustituye el recorrido); su parte por
    sede (`naves`) se queda tal cual, porque la usan empresas con varias naves.
12. **Quien entra cada día con contraseña no pierde nada:** la pantalla recuerda en ese teléfono con qué entró la
    última vez (`localStorage['fds_dr_metodo']`) y, si fue con contraseña, abre directamente la contraseña.
13. **Textos sin cifras que nadie ha medido:** «unos minutos», no «unos dos minutos». Y la revisión pide también la
    rueda de repuesto (`InspectionFlow.jsx`), así que se dice.
14. **El correo de bienvenida va solo en español** (sin el párrafo en inglés, sin emojis, sin degradados).
15. **«Sin recargar» en el inicio**: el inicio pregunta `/alta/estado` cada 30 s. La pantalla «Repaso» es de otra
    zona: no se toca aquí (puede usar la misma ruta; se apunta en el informe).

## 1. El enlace personal del conductor

### 1.1 Dónde se guarda

Colección GLOBAL `global_db.accesos_conductor` (el canje no sabe la empresa hasta encontrar el enlace). Un documento por
conductor y empresa; nunca el token ni el secreto, solo sus SHA-256 (`hashlib.sha256(x.encode()).hexdigest()`).

```
{"id": "5b0c9e2a4f7d4e1c9a3b6d8e2f1a7c40",   # uuid4().hex; cambia al renovar; viaja en la sesión como "lk"
 "token_hash": "<sha256 del token>",
 "org_id": "a1b2c3d4e5f6", "driver_id": "<id de la ficha>",
 "creado_at": "2026-11-14T09:12:03.120000+00:00", "creado_por": "Transportes Pérez", "creado_por_id": "<sub>",
 "caduca_at": "2026-12-14T09:12:03.120000+00:00",   # creado_at + 30 días; solo cuenta si NUNCA se abrió
 "abierto_at": null, "dispositivo_hash": null, "ultimo_uso_at": null}
```
`dispositivo_hash` y `abierto_at` se guardan como `null` explícito al crear (la condición del canje busca `None`).
Índices en `create_indexes` (l. 1966), con `_idx`: `token_hash` único (`acceso_conductor_token_unico`), `id` único
(`acceso_conductor_id_unico`) y `[("org_id",1),("driver_id",1)]` único (`acceso_conductor_uno_por_conductor`).
La empresa de un admin: `get_org(user["org_id"])`; si no tiene `org_id` y es la cuenta dueña, la organización con
`account_type == "owner"` (como `_hash_inicial_de`, l. 8518). Su base: `_tenant_db_name(org)`.

### 1.2 ¿Vale este enlace? (una sola función, `_acceso_vivo`, la usan el canje y la sesión)
Vale si y solo si: el documento existe; la empresa existe y su `status` es `active` o `trial` (la dueña, siempre); la
ficha `driver_id` existe en la base de la empresa con `active` distinto de `False`, sin `merged_into` y con `status`
fuera de `deleted`/`fusionada`; ninguna `driver_accounts` de esa ficha tiene `active: False` (la oficina le quitó el
acceso, como en `driver_code_verify`); y, si `abierto_at` es `null`, `caduca_at` > ahora.

### 1.3 Crear o renovar — `POST /api/conductores/{driver_id}/acceso` (require_admin)
Cuerpo: `{}` o `{"renovar": true}`. 403 con `_SOLO_EL_CLIENTE` si el token es `imp` (la plataforma mirando la cuenta).
La ficha se busca en la base de la sesión (`db.drivers`): la de otra empresa da 404. Con `allowed_centers`, la ficha
tiene que ser de un centro visible y una sin centro NO cuenta como visible. Si ya hay enlace abierto y no viene
`renovar: true` → 409. Si no, `replace_one({"org_id","driver_id"}, nuevo, upsert=True)` con `id` y token nuevos; se
borra de la caché de sesión el `id` viejo. Respuesta con `Cache-Control: no-store`. `_audit(user,
"acceso_conductor", {"driver_id": id, "renovado": bool})` sin token. El token NUNCA va a un `logger`.

200:
```json
{"driver_id": "0f8e2c1a-6b7d-4c3e-9a1f-2d4b6c8e0a12", "nombre": "Ana López", "empresa": "Transportes Pérez",
 "token": "9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d0f", "ruta": "/c#9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d0f",
 "whatsapp": "34612345678", "renovado": false,
 "acceso": {"estado": "sin_abrir", "creado_dia": "2026-11-14", "abierto_dia": null, "caduca_dia": "2026-12-14"}}
```
`whatsapp`: `whatsapp.normaliza_telefono(movil_personal or phone)` (cifras sin `+`) o `null`. La pantalla monta la
dirección con `origen() + ruta` (`frontend/src/marca.js`), nunca con el dominio escrito.

Errores:
| código | `detail` |
|---|---|
| 404 | `"Conductor no encontrado"` |
| 403 | `"No tienes acceso a ese centro"` |
| 409 | `{"codigo": "ya_abierto", "mensaje": "Ana López ya entra con su enlace desde su teléfono. Si lo renuevas, el anterior deja de valer y tendrá que abrir el nuevo."}` |
| 409 | `{"codigo": "de_baja", "mensaje": "Ana López está de baja. Reactívala antes de mandarle su acceso."}` |
| 409 | `{"codigo": "acceso_quitado", "mensaje": "A Ana López le quitaron el acceso al portal. Vuelve a dárselo en su ficha y después mándale el enlace."}` |

### 1.4 Estado de cada conductor — `GET /api/conductores/accesos?center=` (require_admin)
Las fichas activas que ve el usuario (`_filtro_centro(user, center)`, l. 17689), ordenadas por nombre sin
distinguir mayúsculas, con el estado de su enlace. Sin tope de 500: todas. Nunca tokens ni hashes.
```json
{"empresa": "Transportes Pérez",
 "conductores": [
  {"driver_id": "0f8e2c1a-6b7d-4c3e-9a1f-2d4b6c8e0a12", "nombre": "Ana López", "center": "PRINCIPAL",
   "movil": "+34612345678", "whatsapp": "34612345678", "email": null,
   "acceso": {"estado": "abierto", "creado_dia": "2026-11-14", "abierto_dia": "2026-11-14", "caduca_dia": null}},
  {"driver_id": "7c1d…", "nombre": "Luis Pérez", "center": "PRINCIPAL", "movil": null, "whatsapp": null,
   "email": "luis@ejemplo.es",
   "acceso": {"estado": "sin_abrir", "creado_dia": "2026-11-14", "abierto_dia": null, "caduca_dia": "2026-12-14"}},
  {"driver_id": "2a9b…", "nombre": "Rosa M.", "center": "PRINCIPAL", "movil": "+34698765432",
   "whatsapp": "34698765432", "email": null,
   "acceso": {"estado": "sin_enlace", "creado_dia": null, "abierto_dia": null, "caduca_dia": null}}],
 "cuentas": {"sin_enlace": 1, "sin_abrir": 1, "abierto": 1, "caducado": 0}}
```
`estado`: `sin_enlace` (no hay documento) · `sin_abrir` · `abierto` · `caducado` (sin abrir y `caduca_at` pasado).
Los `*_dia` son día LOCAL de la empresa (`ZoneInfo(_region_actual.get()[1])`, como `_dia_negocio`); `caduca_dia`
es `null` cuando ya se abrió. `movil` = `movil_personal` o `phone` tal como está guardado.

### 1.5 Invalidar — `DELETE /api/conductores/{driver_id}/acceso` (require_admin)
Mismas comprobaciones de empresa y centro que 1.3 (404 / 403). Borra el documento y su entrada de caché. Idempotente:
```json
{"ok": true, "acceso": {"estado": "sin_enlace", "creado_dia": null, "abierto_dia": null, "caduca_dia": null}}
```

### 1.6 Entrar con el enlace — `POST /api/auth/enlace` (pública)
Cuerpo: `{"token": "<64 hex>", "dispositivo": "<secreto del navegador>"}`. Respuesta con `Cache-Control: no-store`.
Orden: (1) `dispositivo` con forma `^[A-Za-z0-9_-]{43,128}$`, si no 400; (2) `_rl_check("ip:<ip>")` (50 fallos en
5 min, el mismo cupo que las demás entradas); (3) token con forma `^[0-9a-f]{64}$`, si no → fallo; (4) `h =
sha256(token)`, `_rl_check("enl:" + h[:32])` (5 fallos en 5 min); (5) busca por `token_hash` y aplica 1.2; (6) si
`dispositivo_hash` es `null`: `update_one({"id": doc.id, "dispositivo_hash": None}, {"$set": {"dispositivo_hash":
sha256(dispositivo), "abierto_at": ahora, "ultimo_uso_at": ahora}})`; si no modifica, se relee (dos toques a la vez)
y se compara; (7) si `dispositivo_hash` ≠ `sha256(dispositivo)` → 409 y `_rl_fail` de las dos claves; (8) si todo
vale, `ultimo_uso_at = ahora`, `_rl_ok` de las dos y sesión. Cada fallo de 401: `_rl_fail` de la IP (tipo «un enlace de
conductor», contexto con la IP y SIN el token) y `await asyncio.sleep(0.5)`. El 401 es EL MISMO, byte a byte, para:
forma mala, no existe, caducado, renovado (el viejo ya no existe), invalidado, ficha de baja o inexistente, cuenta
quitada y empresa no activa.

La sesión es la MISMA que la de `driver_code_verify` (l. 8493): `create_token(driver_id, "driver", nombre,
org_id=org["id"], db_name=_tenant_db_name(org), account_type=org.get("account_type"), entrada=time.time(),
enlace=doc["id"], via="enlace")`. `create_token` gana dos parámetros opcionales que escriben `"lk"` y `"via"` en el
token; nada más cambia (30 días, sin permisos, sin centros, rol `driver`: no abre el panel).

200:
```json
{"access_token": "<jwt>", "token_type": "bearer", "role": "driver", "name": "Ana López",
 "id": "0f8e2c1a-6b7d-4c3e-9a1f-2d4b6c8e0a12", "center": "PRINCIPAL", "configurar_cuenta": false,
 "slug": "transportes-perez", "empresa": "Transportes Pérez", "email": null}
```
Errores:
| código | `detail` |
|---|---|
| 400 | `"Falta el identificador de este teléfono. Vuelve a abrir el enlace."` |
| 401 | `"Este enlace ya no vale. Pide uno nuevo a tu empresa."` |
| 409 | `"Este enlace ya se abrió en otro teléfono. Pide uno nuevo a tu empresa."` |
| 429 | `"Demasiados intentos fallidos. Espera 5 minutos."` (el de `_rl_check`, sin cambiarlo) |

### 1.7 La sesión del enlace en cada petición
En `get_current_user`, después de `set_current_org_db` y ANTES de `_ficha_activa_de`: si `role == "driver"` y hay
`lk`, `_acceso_vivo` por `id == lk` (caché `{lk: (expira, ok)}` de 60 s, limpiada si pasa de 2000 entradas) y
además `doc.org_id == payload.org_id` y `doc.driver_id == payload.sub`. Si no → 401 `"Tu acceso ha cambiado: abre el
último enlace que te ha mandado tu empresa."`. `/auth/renovar` (l. 7546) con `lk`: en vez de exigir `driver_accounts`
(la ficha puede no tener correo ni cuenta), exige `_acceso_vivo` y la ficha activa; el token nuevo copia `lk`, `via` y
`at`. Sin `lk`, todo igual que hoy.

### 1.8 Dónde va cada cosa en el navegador
- `localStorage['fds_dispositivo']`: el secreto del teléfono (se crea la primera vez que hace falta con
  `crypto.getRandomValues`, 32 bytes, base64url sin `=`). Uno por navegador, para todos los enlaces. **Salir del
  portal NO lo borra** (si no, el siguiente toque al enlace diría «otro teléfono»). Sin almacén (modo privado), en
  memoria: vale esa vez.
- La sesión, donde ya va hoy: `flota_driver_token` y `flota_driver` (`{"id","name","email","center",
  "configurar_cuenta": false}`); después, `location.replace('/conductor#' + slug)`.
- El canje se manda con `fetch(API_BASE + '/auth/enlace', ...)` SIN `Authorization` (el interceptor de
  `services/api.js` pondría la sesión del panel, y el registro de escrituras la apuntaría como suya).
- Nada más cargar `/c`: se lee `location.hash`, se guarda en memoria y se hace `history.replaceState(null, '', '/c')`.
- `frontend/public/_headers`, bloque nuevo `/c` con `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` y
  `Cache-Control: no-store`.
- Analítica: el cliente ya mide `/c` (patrón sin token: el fragmento no entra). El servidor añade `"c"` a `PRIMEROS`
  de `backend/analitica.py` (si no, sale «/otra»).

### 1.9 Textos de `/c` (claves `alta.c.*`, 6 idiomas)
- Título `«Entrar en tu portal»`; debajo `«Toca Entrar y quedará guardado en este teléfono. No necesitas contraseña.»`;
  botón principal `«Entrar»`.
- Con sesión del panel en el navegador, ANTES del botón: `«Este enlace es el acceso personal de un conductor. Si lo
  abres aquí, se queda guardado en este teléfono y a él ya no le servirá.»` Botón principal `«No abrirlo»` (→
  `/panel`), secundario con borde `«Abrirlo igualmente»`.
- 401 y `/c` sin token: el `detail` del 401. 409: el del 409. 429: `«Has probado muchas veces seguidas. Espera 5
  minutos y vuelve a abrir el enlace.»` Sin red: `«No hay conexión. Comprueba los datos del móvil y vuelve a tocar
  Entrar.»` Cualquier otro: `«No se ha podido entrar. Vuelve a tocar Entrar en un momento.»`

## 2. La entrada del conductor de siempre (`DriverLogin.jsx`)

Cambia:
- Paso del correo: botón principal `«Recibir un código»` (llama a `driverLookup`, como hoy el enlace pequeño); Enter
  hace lo mismo. Debajo, secundario: `«Entrar con contraseña»` (va al paso de contraseña). Con
  `localStorage['fds_dr_metodo'] === 'clave'` (lo escribe un login con contraseña que sale bien; uno con código
  escribe `'codigo'`), el paso del correo abre la contraseña como principal y el código como secundario.
- `POST /auth/driver-code/verify` devuelve SIEMPRE `configurar_cuenta: false` y su token lleva `via: "codigo"`.
  `GET /portal/mi-ficha` (l. 11467) devuelve `configurar_cuenta: false` si el token tiene `via` `codigo` o `enlace`
  (así el portal no le manda a «Elige tu contraseña» al cargar). Puede elegir una cuando quiera desde su cuenta, como
  hoy (`clave_sin_actual` sigue con `at`).
- Los textos fijos pasan a `t()`: «Cuenta consultada:», «Entrar», «Cambiar correo», «No se pudo solicitar otro
  código.» (claves `alta.dr.*` o las `dr.*` que ya existan).

NO cambia: `/auth/driver-login` (contraseña) responde igual, con `configurar_cuenta` como hoy: quien entra con la
contraseña inicial compartida de la empresa o con una temporal sigue obligado a elegir la suya. `driver-lookup`, sus
límites (12 por IP y 3 por correo cada 15 min), el código de 6 cifras y sus 10 minutos, el `slug` del portal, el
enlace por sede de «Portal Conductor» y su QR. La sesión dura lo mismo.

## 3. El arranque del dueño (`/panel/arranque`)

No se guarda ninguna marca: el paso en que va sale de los datos (`GET /alta/estado`). Dejarlo a medias = salir; el
inicio enseña «Sigue con el arranque · paso N de 4» mientras `paso_actual` no sea `null`.

### 3.1 `GET /api/alta/estado` (require_admin)
Con `allowed_centers`: furgonetas y conductores de sus centros (`_filtro_centro`) y revisiones de esas furgonetas.
Revisión = `inspections` con `deleted != true`. `revision` = la MÁS RECIENTE (es la que acaba de llegar al esperar).
```json
{"empresa": "Transportes Pérez", "centros": ["PRINCIPAL"],
 "furgonetas": 3, "conductores": 2,
 "accesos": {"sin_enlace": 0, "sin_abrir": 1, "abierto": 1, "caducado": 0},
 "revisiones": 1,
 "pasos": [{"id": "furgonetas", "hecho": true}, {"id": "conductores", "hecho": true},
           {"id": "acceso", "hecho": true}, {"id": "revision", "hecho": true}],
 "paso_actual": null,
 "revision": {"id": "c3d4…", "dia": "2026-11-14", "hora": "09:31", "recibida_at": "2026-11-14T08:31:07.512000+00:00",
   "furgoneta": {"id": "v1…", "matricula": "5678 KLM", "modelo": "Proace"},
   "conductor": {"id": "0f8e…", "nombre": "Ana López"},
   "fotos": [{"photo_index": 1, "vista": "frontal", "url": "https://…/frontal.jpg"},
             {"photo_index": 2, "vista": "trasera", "url": "https://…/trasera.jpg"},
             {"photo_index": 3, "vista": "lateral_izq", "url": "https://…/izq.jpg"},
             {"photo_index": 4, "vista": "lateral_der", "url": "https://…/der.jpg"}],
   "km": 48210, "combustible_pct": 75}}
```
- Furgonetas: `vehicles` con `status` fuera de `deleted`/`baja`. Conductores: `drivers` activos.
- `pasos`: furgonetas > 0; conductores > 0; `acceso` = algún enlace `abierto` O alguna revisión (quien ya entra por
  correo no necesita enlace); `revision` = revisiones > 0. `paso_actual` = número (1–4) del primero sin hacer, o `null`.
- `revision`: `null` si no hay. Fotos de carrocería por la regla de `CONTRATO.md` §1 (rol `angle` o vista de
  carrocería), URL cruda `photos[j]`, NUNCA `annotated_photos`; sin ninguna, `[]`. `conductor`: `null` si la revisión
  no tiene conductor. `km` = `notes.odometer_km` (JSON) o `null`; `combustible_pct` = `combustible.pct` o `null`. `dia`
  y `hora` locales de la empresa. Ningún dato de la IA.

### 3.2 `POST /api/alta/furgonetas` (require_admin)
Cuerpo `{"texto": "1234 ABC\n5678-klm\n1234abc\nfurgo de Juan", "center": "PRINCIPAL" | null, "guardar": false}`.
Una matrícula por línea; las líneas vacías no cuentan. **Parece una matrícula** si `_veh_clave(línea)` tiene de 4 a
10 caracteres con al menos una cifra y una letra. Repetida = misma `_veh_clave` que una línea anterior. Ya la tienes =
esa clave está en `_veh_contexto()` (en cualquier centro que el usuario vea; en uno que no ve → error «Es de un centro
que no tienes asignado.»). Con `guardar: true` se dan de alta SOLO las `nueva`, como `import_vehicles` con `crear`:
`{"id", "license_plate": _veh_matricula(línea), "status": "active", "created_at", "updated_at", "origen": "alta",
"center": <centro>}`; `DuplicateKeyError` → esa línea pasa a `ya_estaba`.
**Centro:** el `center` del cuerpo si es de la empresa y visible (`_naves_que_ve(user, _centros_de_la_empresa())`);
sin él, el único visible; con varios y sin elegir → 400. Sin ningún centro en la empresa, sin centro.
```json
{"lineas": [
  {"n": 1, "texto": "1234 ABC", "matricula": "1234 ABC", "estado": "nueva", "motivo": null},
  {"n": 2, "texto": "5678-klm", "matricula": "5678 KLM", "estado": "ya_estaba", "motivo": "Ya la tienes dada de alta."},
  {"n": 3, "texto": "1234abc", "matricula": "1234 ABC", "estado": "error", "motivo": "Repetida en la lista."},
  {"n": 4, "texto": "furgo de Juan", "matricula": null, "estado": "error", "motivo": "No parece una matrícula."}],
 "nuevas": 1, "ya_estaban": 1, "errores": 2, "center": "PRINCIPAL", "guardado": false, "creadas": []}
```
Con `guardar: true`, `"guardado": true` y `"creadas": [{"id": "…", "matricula": "1234 ABC"}]`.
Errores 400: `"Pega o escribe al menos una matrícula."` · `"Son demasiadas líneas: pega como mucho 300 de una vez."` ·
`"Elige la sede de estas furgonetas: tienes varias."` · `"Ese centro no es de tu empresa."`; 403
`"No tienes acceso a ese centro"`. `texto` de más de 20 000 caracteres → el de «demasiadas líneas».

### 3.3 `POST /api/alta/conductores` (require_admin)
Cuerpo `{"texto": "Ana López, 612 345 678\nLuis Pérez\t698765432\tluis@ejemplo.es", "center": null, "guardar": false}`.
Una persona por línea, «Nombre, móvil» y, si se quiere, el correo; separadores: tabulador, `;` o `,` (sin separador,
un móvil al final de la línea también vale: «Ana López 612345678»). De cada trozo: correo si casa `_EMAIL_RE`; móvil
si tiene 9 o más cifras y solo `0-9 +()-.` y espacios → `whatsapp.normaliza_telefono`, guardado `"+" + e164` en
`movil_personal` (como `create_driver`); lo demás es el nombre (espacios juntados). Errores de línea: nombre de menos
de 3 letras → `"Falta el nombre."`; móvil que no se monta → `"El móvil «612 34» no parece un número."`; repetida
(mismo móvil, o mismo correo, o —sin ninguno— mismo nombre sin tildes ni mayúsculas que una anterior) →
`"Repetida en la lista."`. Ya está → `ya_estaba` si una ficha ACTIVA tiene ese móvil (`movil_personal` o `phone`
normalizados) o ese correo, o, si la línea no trae ninguno, ese nombre: motivo `"Ya está dado de alta como «ANA LÓPEZ»."`.
Sin móvil la línea es `nuevo` con `aviso: "Sin móvil: tendrás que copiarle el enlace."`. Con `guardar: true`, cada
`nuevo` se da de alta llamando a `create_driver(DriverCreate(name, movil_personal, email, center), nueva=False,
admin=user)`: mismas reglas que el alta a mano (contraseña inicial de la empresa si tiene correo, 409 de correo
repetido o de ficha de baja → esa línea pasa a `error` con el `mensaje` del 409). Centro: como 3.2 (400 `"Elige la sede
de estos conductores: tienes varias."`), porque sin sede el portal no le enseña ninguna furgoneta.
```json
{"lineas": [
  {"n": 1, "texto": "Ana López, 612 345 678", "nombre": "Ana López", "movil": "+34612345678", "email": null,
   "estado": "nuevo", "motivo": null, "aviso": null},
  {"n": 2, "texto": "Luis Pérez\t698765432\tluis@ejemplo.es", "nombre": "Luis Pérez", "movil": "+34698765432",
   "email": "luis@ejemplo.es", "estado": "ya_estaba", "motivo": "Ya está dado de alta como «LUIS PÉREZ».", "aviso": null},
  {"n": 3, "texto": "Rosa M.", "nombre": "Rosa M.", "movil": null, "email": null, "estado": "nuevo", "motivo": null,
   "aviso": "Sin móvil: tendrás que copiarle el enlace."}],
 "nuevos": 2, "ya_estaban": 1, "errores": 0, "center": "PRINCIPAL", "guardado": false, "creados": []}
```
Con `guardar: true`: `"creados": [{"id": "…", "nombre": "Ana López"}, …]`. Errores 400: `"Pega o escribe al menos un
conductor."`, el de demasiadas líneas, el de la sede y `"Ese centro no es de tu empresa."`.
El paso 2 «fila a fila» (nombre, móvil, correo) manda sus filas a esta MISMA ruta, una por línea separadas por
tabulador.

### 3.4 Lo que enseña cada paso (textos `alta.*`)
1. **Tus furgonetas** — `«Pega o escribe las matrículas, una por línea.»` Ejemplo en el cuadro: `1234 ABC` / `5678 KLM`.
   Principal `«Revisar»` → lista con lo de cada línea; luego principal `«Guardar 3 furgonetas»` (solo con alguna
   `nueva`). Secundario `«Subir un Excel»` → `/panel/importaciones?t=furgonetas`. Con una ya se sigue.
2. **Tus conductores** — `«Nombre y móvil, uno por línea. El correo, si lo tienes.»` Ejemplo: `Ana López, 612 345 678`.
   Igual que el 1 (`«Guardar 2 conductores»`, `«Subir un Excel»` → `/panel/importaciones?t=conductores`).
3. **Dales acceso** — lista de `GET /conductores/accesos` con su estado: `«Sin mandar»` · `«Enlace creado, sin abrir»`
   · `«Abierto el 14-11»` · `«Caducado: mándalo otra vez»`. Por fila, principal `«Mandar por WhatsApp»` (crea con
   1.3 y abre `wa.me`) y secundario `«Copiar enlace»` (crea con 1.3 y copia `origen() + ruta`). Abierto: solo
   `«Renovar»`, que confirma con el `mensaje` del 409 `ya_abierto` y repite con `renovar: true`.
4. **La primera revisión** — esperando: `«Cuando abra el enlace, hará cuatro fotos de la furgoneta, la del
   cuentakilómetros, el depósito y la rueda de repuesto. Son unos minutos.»` La pantalla pregunta `/alta/estado`
   cada 5 s mientras está visible (`document.visibilityState`) y para al llegar. Llegada: `«Ha llegado la primera
   revisión»`, la matrícula con `Matricula.jsx`, `«Recibida en el servidor el 14-11 a las 09:31»`, `«Hecha por Ana
   López»` (o `«Sin conductor»`), las fotos con `SelloFoto.jsx` y principal `«Repasarla»` → `/panel/repaso`.

### 3.5 El mensaje de WhatsApp (`alta.wa.mensaje`, 6 idiomas; el del idioma del panel)
`https://wa.me/<whatsapp>?text=<encodeURIComponent(mensaje)>`; sin móvil, `https://wa.me/?text=…`. `{nombre}` = la
primera palabra del nombre con solo la inicial en mayúscula («ANA LÓPEZ» → «Ana»); `{empresa}` = `empresa`; `{enlace}`
= `origen() + ruta`. `t()` no interpola: `.replace('{nombre}', …)` como hace el resto del panel.
- **es:** `Hola, {nombre}. Te escribo de {empresa}. Con este enlace entras desde el móvil para hacer la revisión de la furgoneta: {enlace}` + salto + `Ábrelo en tu teléfono y toca Entrar. No necesitas contraseña ni instalar nada. Es solo para ti: no lo reenvíes.`
- **en:** `Hi {nombre}, this is {empresa}. With this link you do the van check from your phone: {enlace}` + salto + `Open it on your phone and tap Sign in. No password, nothing to install. It's only for you, so please don't forward it.`
- **pt:** `Olá, {nombre}. Escrevo-te em nome de {empresa}. Com este link fazes a revisão da carrinha pelo telemóvel: {enlace}` + salto + `Abre-o no teu telemóvel e toca em Entrar. Não precisas de palavra-passe nem de instalar nada. É só para ti: não o reencaminhes.`
- **fr:** `Bonjour {nombre}, je t'écris de la part de {empresa}. Avec ce lien, tu fais le contrôle de la camionnette depuis ton téléphone : {enlace}` + salto + `Ouvre-le sur ton téléphone et appuie sur Entrer. Pas de mot de passe, rien à installer. Il est personnel : ne le transfère pas.`
- **it:** `Ciao {nombre}, ti scrivo da parte di {empresa}. Con questo link fai il controllo del furgone dal telefono: {enlace}` + salto + `Aprilo sul tuo telefono e tocca Entra. Niente password, niente da installare. È solo per te: non inoltrarlo.`
- **de:** `Hallo {nombre}, ich schreibe dir im Namen von {empresa}. Mit diesem Link machst du die Fahrzeugkontrolle am Handy: {enlace}` + salto + `Öffne ihn auf deinem Handy und tippe auf Anmelden. Kein Passwort, nichts zu installieren. Er ist nur für dich: bitte nicht weiterleiten.`
El botón de `/c` (`alta.c.entrar`) se llama igual que en el mensaje: es «Entrar», en «Sign in», pt «Entrar», fr
«Entrer», it «Entra», de «Anmelden».

## 4. El correo de bienvenida y los textos falsos

### 4.1 Correo (`register_dsp`, rama de empresa, l. 5240; la del autónomo `_ciclo_enviar` no se toca)
- Nombre del plan: `{"operacion": "Esencial", "basico": "Esencial", "completo": "Pro", "pro": "Pro", "flota": "Pro",
  "holding": "Empresa", "reparto": "Reparto", "autonomo": "Repartidor"}`; sin plan, no se nombra ninguno.
- Asunto: `Tu cuenta de {MARCA} está lista` (sin «¡», sin «gratuita»).
- Cuerpo (tinta sobre papel `#10181A`/`#F5F6F3`, botón cian `#14E7D8` con texto tinta, sin degradados ni emojis):
  `Hola, {org_name}:` · `Tu cuenta está creada con el plan {Pro} y {14} días de prueba. No hace falta tarjeta: al
  acabar la prueba eliges tú si seguir.` (sin plan: `Tu cuenta está creada con {14} días de prueba. …`) ·
  `Entras al panel con el usuario {username}.` · botón `Entrar al panel` → `{_PORTAL_BASE_FRONT}/panel` ·
  `Para empezar: pega las matrículas de tus furgonetas, apunta a tus conductores con su móvil y mándales su acceso por
  WhatsApp. Con un toque entran desde el móvil y hacen la revisión con fotos.` · `¿Dudas? Escríbenos a
  {CORREO_CONTACTO}.` Si `plan_elegido == "autonomo"` cae aquí, su frase final de hoy se queda igual.
- Fuera: el párrafo en inglés, «sin límites», «¡Bienvenido…!», los emojis.
- `TokenResponse` gana `correo_bienvenida: Optional[bool]`: `true` solo si Resend contestó 2xx (empresa) o si se lanzó
  `_ciclo_enviar` (autónomo); si no, `false`.

### 4.2 Textos del camino (pantallas)
| dónde | hoy | queda |
|---|---|---|
| `Registro.jsx`, final empresa | `¡Cuenta creada!` + 📧 | `Cuenta creada`, sin emoji (el del autónomo, igual) |
| `Registro.jsx` | `Hemos enviado un email de bienvenida a {email}.` siempre | solo si `correo_bienvenida === true` |
| `Registro.jsx` | `Puedes acceder ahora y verificar tu email después.` | `Son cuatro pasos y puedes dejarlos a medias.` |
| `Registro.jsx` | botón `Traer mis vehículos y conductores →` → `/panel/importaciones` | `Empezar` → `/panel/arranque` |
| `Registro.jsx` `reg.url` | `La URL de tu empresa` con `{dominio()}/` delante | `Dirección del portal de tus conductores` con `{dominio()}/conductor#` |
| `reg.urlhint` | `Aquí entran tú y tus conductores…` | `Tus conductores también pueden entrar por aquí con su correo. Solo letras, números y guiones.` |
| `nav.dashboard` | `Dashboard` | es `Inicio`, en `Home`, fr `Accueil`, de `Start`, it `Home`, pt `Início` |
| `Conductores.jsx` vacío | `…cada conductor recibe su acceso al portal…` | `Trae tu lista de Excel: se reconoce cada columna y eliges la sede. Después le mandas a cada uno su acceso por WhatsApp desde aquí.` |
| `Activacion.jsx` | bloque de 3 pasos (`ob.v/c/i.*`, «Ver cómo se hace», «Cada uno recibe su acceso…») | fuera; queda la parte por sede |
| `Importaciones.jsx` | pestaña `Turnos` siempre | solo si el usuario puede ver `turnos` (el mismo `canSee` del menú) |
| `Importaciones.jsx`, `ImportarConductores.jsx`, `DriverLogin.jsx` | textos fijos en español | a `t()` |

## 5. Quién toca qué y qué pruebas deja

### Servidor (`backend/server.py`, `backend/analitica.py` —solo `"c"` en `PRIMEROS`—, `backend/tests/test_alta_*.py`)
Solo: `create_token`, `get_current_user` (el bloque de 1.7), `TokenResponse`, `register_dsp` (correo y
`correo_bienvenida`), `driver_code_verify`, `/auth/renovar`, `portal_mi_ficha`, `create_indexes` (3 índices), las
rutas nuevas de 1.3–1.6 y 3.1–3.3 (junto a `/drivers/importar`, l. 13111) y el borrado del enlace en `delete_driver`
y en `PATCH /drivers/{id}` cuando da de baja. NADA de inspecciones, repaso, libro de daños, planes ni módulos.
Pruebas (base de mentira), una por regla:
- `test_alta_enlace.py`: el token es de 64 hex y en la base no aparece ni el token ni el secreto (solo hashes); entra
  la primera vez y la sesión es igual que la del código (`sub`, `org_id`, `db_name`, `account_type`, rol, 30 días) más
  `lk`/`via`, y `configurar_cuenta` false; vuelve a entrar con el mismo teléfono; otro teléfono → 409 exacto; el 401
  es idéntico (status y cuerpo) para no existe, forma mala, caducado, renovado, invalidado, de baja, cuenta quitada y
  empresa no activa; abierto ya no caduca; 5 fallos con otro teléfono → 429 en ese token; 50 de la IP → 429; el de
  una empresa no entra en otra (admin de B sobre ficha de A → 404; la sesión del enlace de A va a la base de A);
  renovar e invalidar cortan la sesión abierta (`get_current_user` → 401); dar de baja la corta y reactivar no la
  revive; sesión sin `lk` sigue igual (no mira la base); `/auth/renovar` con `lk` vale sin cuenta y se niega con el
  enlace muerto; no abre el panel (`require_admin` → 403); `imp` → 403 al crear; centro no visible → 403; ningún
  `logger` recibe el token (captura `caplog`); `Cache-Control: no-store` en las dos respuestas; el código por correo
  da `configurar_cuenta` false y `mi-ficha` con `via` también; la contraseña inicial sigue dando true.
- `test_alta_arranque.py`: `/alta/estado` (vacío, cada paso, `paso_actual`, revisión más reciente con fotos de
  carrocería y sin `annotated_photos`, centros limitados); `/alta/furgonetas` y `/alta/conductores` línea a línea
  (cada motivo), `guardar` solo da de alta las nuevas, la sede (única, elegida, varias → 400, ajena → 403).
- `test_alta_correo.py`: el HTML no tiene «Welcome», «Completo», «sin límites», «verific», «¡» ni emojis; dice
  «plan Pro» para `completo`; sin plan no nombra plan; `correo_bienvenida` true/false según Resend (simulado).
- `test_alta_fixtures.py`: escribe con las rutas de verdad `frontend/e2e/fixtures/alta-estado.json`,
  `alta-accesos.json`, `alta-acceso-creado.json`, `alta-enlace.json`, `alta-furgonetas.json` y
  `alta-conductores.json` (token y JWT sustituidos por valores fijos de ejemplo). Mientras no existan, pantallas
  escribe los suyos con este contrato, mismo nombre y ruta; al integrar mandan los del servidor.
Comprobaciones: `python -m pytest backend/tests -q -k "alta or clave or inicial or sesion or ficha or analitica"` y
los `check_*.py` de `ENCARGO.md` §4 (`check_unicos.py` vigila los índices únicos).

### Pantallas
Ficheros: `frontend/src/pages/driver/EntrarConEnlace.jsx` (nuevo, ruta `/c`), `frontend/src/main.jsx` (solo la ruta
`/c`, perezosa), `frontend/src/pages/driver/DriverLogin.jsx`, `frontend/src/panel/pages/Arranque.jsx` (nuevo) y su ruta
en el panel (abre siempre para un admin, como el inicio: que `check-permisos` y `check-modulos` sigan en verde), su
entrada en `Dashboard.jsx`, `Activacion.jsx` (quitar los 3 pasos), `Conductores.jsx` (botón «Mandar su acceso» por
fila con 1.3/1.5 y su estado, y el texto vacío), `PortalConductor.jsx` (una línea: el acceso personal se manda desde
Conductores), `Importaciones.jsx`, `ImportarConductores.jsx`, `Registro.jsx` (pantalla final, `reg.url*`),
`frontend/src/panel/api.js` (funciones nuevas al final), `frontend/src/i18nDict.js` (bloque seguido `alta.*` y las
claves de 4.2), `frontend/public/_headers` (bloque `/c`). Pruebas que ajustar sin cambiar lo que vigilan:
`e2e/humo.spec.js` (`['', 'Dashboard']` → `'Inicio'`), `e2e/ios-sin-pagos.spec.js` (`SESION_ALTA` con
`correo_bienvenida: true`; y `/panel/arranque` y `/c` en el iPhone sin nada de precios).
Pruebas nuevas (API simulada con los ficheros de §5):
- `e2e/alta-enlace.spec.js`: `/c#<token>` → «Entrar» → portal; la URL queda en `/c` sin token antes del canje;
  ninguna petición lleva el token en la URL ni en `Referer`, la analítica manda `/c`; el canje va sin `Authorization`;
  `fds_dispositivo` se crea, se reutiliza y sobrevive a salir del portal; 401, 409, 429 y sin red con sus textos; aviso
  con sesión del panel; no pide elegir contraseña.
- `e2e/alta-entrada.spec.js`: código como botón principal; contraseña secundaria; `fds_dr_metodo` la pone delante;
  con `configurar_cuenta: true` desde la contraseña sigue llevando a «Elige tu contraseña».
- `e2e/alta-arranque.spec.js`: los 4 pasos con sus verbos; las líneas malas se ven antes de guardar; la URL de
  `wa.me` exacta (con y sin móvil); «Copiar enlace»; «Renovar» con su confirmación; la espera pregunta cada 5 s y
  enseña la revisión al llegar con «Recibida en el servidor…»; el inicio enseña «Sigue con el arranque».
Fotos a 1280 y 390 px en `...\perito\fotos-alta\`, y los comprobadores de `ENCARGO.md` §4.
- `sin_permiso_vehiculos` (403, «No tienes acceso a la pantalla de Vehículos.»): `POST /alta/furgonetas` exige la pantalla de Vehículos; `POST /alta/conductores`, la de Conductores (`sin_permiso`). Añadido al integrar.
