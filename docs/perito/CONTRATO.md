# CONTRATO «ANTES DEL PERITO» — servidor ↔ pantalla de repaso ↔ expediente (14-11-2026)

Escrito leyendo `C:\Users\dlvie\foefa-p1\backend\server.py` (líneas citadas de esa copia). Las tres zonas lo siguen
al pie de la letra. Si algo no cuadra con el código, manda lo más seguro y se dice en el informe.

## Correcciones del servidor (14-11-2026, ya construido; mandan sobre lo de abajo)

Los ficheros de ejemplo ya existen, generados por las rutas de verdad: `frontend/e2e/fixtures/repaso-dia.json` y
`frontend/e2e/fixtures/expediente.json` (prueba `backend/tests/test_perito_fixtures.py`). **La forma de las respuestas
es exactamente la del contrato** (la prueba compara las claves una a una); lo que cambia es esto:

1. **Ejemplos**: furgonetas `5678 KLM` (3 revisiones: 10, 11 y 12-11), `3456 HJK` (11 y 12-11, sin repasar; su
   lateral derecho del 12 no tiene foto anterior) y `9012 JMN` (sin revisión el 12, asignada a «Rosa M.»). Golpes del
   expediente: «Puerta lateral derecha» del 10-11 (`ya_estaba`, **reparado**, coste 180), «Retrovisor derecho» del 11-11
   (de Revisión rápida, `anterior_sin_repasar`) y «Puerta lateral corredera izquierda» del 12-11 (atribuible a Ana L.).
   El 12-11 la trasera de la 5678 está `no_se_ve`. Los `golpe_id` tienen forma de uuid; los `ledger_id` salen `null`
   (la base de mentira no pone `_id`): la pantalla tiene que aguantarlo. Las marcas `veredicto_at`/`confirmado_at`
   pueden venir sin microsegundos (`2026-11-12T08:41:10+00:00`).
2. **`is_new` del golpe copiado en `analysis.damages` = `not ya_estaba`** (un golpe que ya estaba no es nuevo; antes
   decía siempre `true`). `description` va como `""` si no se escribió (el modelo `Damage` pide texto).
3. **Deshacer también da 409** si el golpe en la ficha de la inspección tiene taller asignado (`workshop_id`) o un
   `repair_status` distinto de `pending`, aunque el libro siga abierto sin orden.
4. **`ia_previa`** guarda todos los campos que el golpe pisa y que la entrada de la IA tenía (lo de §2.2 es un
   subconjunto) más `orden_id`; deshacer la deja exactamente como estaba. Si la entrada de la IA ya tenía una orden
   de taller al marcar el golpe, esa orden no bloquea el deshacer (no es del golpe).
5. **Expediente**: un golpe de Revisión rápida cuya pieza no es de carrocería (`_canon_panel` da None: suciedad,
   interior, mecánica) no sale. Su `ya_estaba` = vista conocida y ninguna foto anterior de ese lado. En el
   calendario, un golpe `ya_estaba` NO pone el día en `golpe` (no apareció ese día: estaba). Si la revisión anterior
   que guardó el lado se borró después, `anterior` sale `null` y el motivo es `sin_foto_anterior`.
6. **Acceso por centro**: con `allowed_centers`, un centro vacío (furgoneta o conductor sin centro) NUNCA cuenta como
   visible (más estricto que `GET /vehicles/{id}`).
7. `DELETE /inspections/{id}/repaso/{photo_index}`: un `photo_index` que no es número da 400 «photo_index debe ser un
   numero» (no 422). `GET /repaso/dia`: `center` sale `null` si se pidió `""` o `"Todos"`.
8. Error 500 de §B.1 si algo falla tras reservar el lado: «No se ha podido guardar el golpe. No ha quedado nada a
   medias: vuelve a marcarlo.»
9. **«Origen de daños»** (`/damages/atribucion`), dos cambios pequeños: cada fila lleva `confirmado` (`true` si la
   entrada del libro es de una persona, `source == "human"`), para que la pantalla no enseñe lo de la IA como
   confirmado; y una entrada `ya_estaba: true` sale siempre con certeza `baja` («ya estaba en la primera foto de ese
   lado: no se atribuye a nadie»). Lo demás de esa pantalla, igual.
10. **D, además**: sin IA tampoco se piden cajas a Gemini en directo en `/inspections/{id}/annotated` y `/pdf`, y
    `POST /inspections/batch-upload` da 403 «Esta cuenta no tiene el análisis automático de fotos.».
    `odometer-photo` sin IA devuelve `sin_lector: true`: la web (`InspectionFlow.jsx`) hoy enseña con
    `servicio_caido` el aviso «Lector no disponible — pon los km a mano» como error; con `sin_lector` debería pedir
    los km sin aviso de fallo, y en el envío dice «Analizando con IA…» (zona del conductor: fuera de esta tanda).

## 0. Cambios respecto al encargo (leer primero)

1. **«Empresa nueva» no se decide por fecha, sino por una marca que pone el alta.** Las empresas sí guardan su fecha
   de alta (`organizations.created_at`, ISO UTC, `register_dsp` línea 5114), pero comparar con «14-11-2026» le
   quitaría la IA a las que se dieron de alta HOY antes de desplegar (ya existen: les cambiaría algo). Lo seguro: el
   alta nueva escribe `ia_danos: False` en la empresa. Ninguna empresa que ya existe tiene ese campo → para ellas
   no cambia nada, sin migrar. La demo, la demo comercial y la empresa dueña no pasan por `register_dsp`: no lo llevan.
2. **Un motivo más de no atribución: `sin_conductor`** (ninguna revisión de la ventana tiene conductor; p. ej. las
   hechas desde el panel). Sin él habría que mentir con otro motivo.
3. **`anterior_sin_repasar` significa «la foto anterior de ese lado no está marcada `igual` por una persona»**
   (sin veredicto, `no_se_ve` o `golpe`). El texto de pantalla tiene que decir eso, no «sin repasar».
4. **El veredicto no se cambia encima de otro**: un lado con veredicto responde 409; para cambiarlo, deshacer y volver
   a marcar. Así deshacer es siempre exacto.
5. **El golpe a mano va en `analysis.damages`, NO en `analysis.new_damages`.** `new_damages` es la cola de «Revisión
   rápida» (veredictos de la IA por índice, `damage-feedback`); meterlo allí le pediría a alguien validar su propio
   golpe y movería índices de `ai_feedback`. `damages` es lo que pintan la ficha de inspección y el taller.
6. **El libro de daños es UNO por pieza abierta** (índice único `uniq_veh_panel_open` sobre `vehicle_id + panel`
   con `status: "open"`, línea 1784, y `panel` es grueso: «puerta» vale para las cuatro puertas). Por eso el
   expediente lista los golpes desde las REVISIONES (la verdad de cada golpe: foto, caja, fecha) y usa el libro solo
   para el estado de reparación. Ver §B.4.
7. **Sin IA, también se apaga «Revisión rápida» e «IA Peritaje» para esa empresa** (sus textos hablan de la IA y
   estarían vacíos). Solo afecta a empresas con `ia_danos: False`.
8. **El módulo `repaso` no se añade a las listas ya guardadas** de empresas existentes con módulos «a medida»
   (lo prohíbe `test_empresas_producto.py:46`: una lista propia se respeta tal cual). Entra en el estándar, en los
   de alta por sector y en todos los planes; a una empresa con lista propia se lo activa el super-admin.
9. **La fecha pedida en el futuro da 400**: si no, «furgonetas sin revisión» listaría la flota entera.

## 1. Reglas comunes

- **Día de negocio**: `_dia_negocio()` (línea 222) = fecha local en la zona de la empresa (`_region_actual`, por
  defecto Europe/Madrid). Las revisiones de un día son las de `created_at` dentro de `_rango_dia_negocio(fecha)`
  (línea 239). Toda fecha `AAAA-MM-DD` que devuelven estas rutas es día LOCAL de la empresa; toda marca `*_at` es
  ISO en UTC tal como está guardada (`created_at` de la inspección = «recibida en el servidor»). El servidor da
  además `hora` (`"HH:MM"` local) para que ninguna pantalla convierta zonas.
- **Revisión** = documento de `inspections` con `deleted != true`.
- **Fotos de carrocería (los «lados»)** de una revisión, en este orden de decisión:
  1. si `photo_roles` es lista del mismo largo que `photos`: los índices con rol `"angle"`;
  2. si no, los índices cuya vista (`_vistas_inspeccion`, línea 4836) está en `_VISTAS_CARROCERIA`
     (`frontal`, `trasera`, `lateral_izq`, `lateral_der`);
  3. si no hay ni roles ni vistas: ninguna (lista vacía; la revisión sale con `estado: "sin_lados"`).
  `photo_index` es **1-based** sobre `photos` (igual que `Damage.photo_index` y `missed-damage`). `vista` puede ser
  `null` (rol `angle` sin vista conocida).
- **Foto anterior de la misma vista** (`anterior`) para el lado `k` de la revisión R: la revisión más reciente de la
  MISMA furgoneta con `created_at < R.created_at`, `deleted != true`, `id != R.id`, que tenga una foto con esa misma
  vista (por `_vistas_inspeccion`), recorriendo TODAS las anteriores (sin el `limit(30)` de
  `_referencias_por_vista`: aquí «no hay» tiene que ser verdad). Si la vista del lado es `null`: `anterior = null`.
  La URL es la foto cruda `photos[j]`, **nunca** `annotated_photos` (sin IA en pantalla).
- **Persona**: dos fichas con el mismo correo son la misma persona (`_atr_una_persona`, línea 22176).
- **Acceso por centro**: como `/inspections/review-queue` (línea 14853): `_filtro_centro(user, center)` → la revisión
  entra si su furgoneta O su conductor son de un centro visible. Para una revisión o furgoneta concreta, si el usuario
  tiene `allowed_centers` y ni la furgoneta ni el conductor son de esos centros → 403.
- **Gravedad**: `leve | moderado | grave | critico` (las de `_SEV_RANK`, línea 29840). Pieza → `panel` con
  `_canon_panel(part)` (línea 29854).
- Errores: siempre `{"detail": "<mensaje>"}` (FastAPI). `require_admin` da 403 «Acceso restringido a
  administradores»; sin sesión, 401 como en todo el panel. La demo bloquea las escrituras como ya hace.

## 2. Lo que se guarda (servidor)

### 2.1 En la revisión (`inspections`)

```
"repaso": {
  "lados": {                                   # clave = str(photo_index)
    "3": {
      "photo_index": 3, "vista": "lateral_izq",
      "veredicto": "golpe",                    # igual | golpe | no_se_ve
      "por": "Marta R.", "por_id": "<sub del token>", "at": "2026-11-12T08:41:10.120000+00:00",
      "anterior": {"inspection_id": "…", "photo_index": 3} | null,   # la que vio la persona al decidir
      "golpe": null | {
        "golpe_id": "<uuid4>", "part": "Puerta lateral corredera izquierda", "panel": "puerta",
        "severity": "moderado", "box_2d": [410, 220, 640, 470], "description": "Bollo con pintura saltada",
        "ya_estaba": false,
        "libro": {"accion": "nuevo" | "sustituye_ia" | "ya_apuntado", "ledger_id": "…" | null}
      }
    }
  },
  "completo": true | false,
  "completo_at": "…" | null,
  "reviewed_antes": null | {"reviewed": …, "reviewed_at": …, "reviewed_by": …, "reviewed_motivo": …}
}
```
Escritura del lado con condición `{"id": R, "repaso.lados.<k>": {"$exists": false}}` (dos clics a la vez: el segundo
da 409).

**Copia en `analysis.damages`** (para la ficha de inspección `Inspecciones.jsx`, el taller `PATCH
/inspections/{id}/damages/{idx}` y `_atr_indice_golpe`): se AÑADE al final
`{"part","severity","description","photo_index","box_2d","is_new": true,"confirmed": true,"origen": "repaso","golpe_id"}`.
Se reescribe la lista entera con `$set` (como `update_damage`, línea 28737); nunca `$pull` con condición.
- Si `analysis` era `null` (sin IA, pendiente o con error) se crea `{"origen": "repaso", "damages": [...],
  "new_damages": [], "severidad_ia": "sin_danos", "danos_ia": 0, ...}`.
- La primera vez que el repaso toca un `analysis` de la IA guarda `severidad_ia` (= su `severity`) y `danos_ia`
  (= su `total_damages_count`). Tras cada cambio: `severity = max(severidad_ia, gravedad de los golpes a mano)`
  (`sin_danos` < leve < … < critico) y `total_damages_count = danos_ia + nº de golpes a mano`.
- **Los dos sitios que reescriben `analysis` entero** (subida en segundo plano, línea 14300, y `reanalyze`, línea
  15630) tienen que volver a añadir los daños con `origen: "repaso"` del documento actual y refrescar
  `severidad_ia`/`danos_ia` con el resultado nuevo de la IA (un helper, `_analisis_con_repaso`). Sin esto, un
  reanálisis tardío borra el golpe de la ficha.
- Modelo `Damage` (línea 547): añadir `origen: Optional[str] = None` y `golpe_id: Optional[str] = None`. Sin ellos,
  `GET /inspections/{id}` (con `response_model=Inspection`, `extra="ignore"`) los borra de la respuesta.

**Repasada**: cuando todos los lados tienen veredicto → `repaso.completo = true`, se guarda en
`repaso.reviewed_antes` lo que hubiera en `reviewed/reviewed_at/reviewed_by/reviewed_motivo` (la IA cierra sola
muchas, línea 27611) y se pone `reviewed: true, reviewed_at: ahora, reviewed_by: <nombre>, reviewed_motivo: "repaso"`.
Deshacer cualquier lado de una revisión completa lo devuelve tal cual estaba (`reviewed_antes`) y
`completo = false`. **El estado de repaso nunca se deduce de `reviewed`** (la IA lo pone en el 95 %).

### 2.2 En el libro (`vehicle_damage_ledger`)

Entrada de un golpe a mano (todo por `_ledger_upsert` o `update_one` sobre la existente; nunca `insert_one`):
```
{"vehicle_id","panel","status":"open","part","severity","rank","source":"human","origen":"repaso",
 "golpe_id","first_seen":"2026-11-12","first_seen_inspection":"<id revisión>","photo_index":3,
 "vista":"lateral_izq","box_2d":[…],"description":"…","ya_estaba":false,
 "confirmado_por":"Marta R.","confirmado_at":"…","updated_at":"…"}
```
`first_seen` = día de negocio de ESA revisión (no el de hoy). Los campos que ya leen otras pantallas (`part`,
`panel`, `severity`, `rank`, `status`, `first_seen`, `first_seen_inspection`, `source`, `orden_id`,
`repaired_at`) mantienen su significado.

**Si ya hay una entrada abierta en `(vehicle_id, panel)`** (se mira ANTES de escribir):
| Lo que hay | Qué se hace | `libro.accion` |
|---|---|---|
| nada | se crea la entrada de arriba | `nuevo` |
| entrada con `source != "human"` (de la IA, sin confirmar) | se queda con ella: se guarda lo anterior en `ia_previa: {source, part, severity, rank, first_seen, first_seen_inspection}` y se escriben los campos de arriba | `sustituye_ia` |
| entrada con `source == "human"` (otro golpe ya confirmado en esa pieza) | el libro NO se toca; el golpe queda en la revisión enlazado a esa entrada | `ya_apuntado` |
Si `_ledger_upsert` devuelve False (otro proceso la creó entre medias) se vuelve a leer y se aplica la tabla.

## A. El repaso del día

`GET /api/repaso/dia?fecha=AAAA-MM-DD&center=OGA5` · `require_admin` · `fecha` opcional (por defecto
`_dia_negocio()`), `center` opcional (`""` o `"Todos"` = todos los visibles).

Qué entra: revisiones del día (§1), del centro (§1), en orden de llegada (`created_at` ascendente). Las antiguas sin
repasar NO cuentan en nada. `sin_revision`: furgonetas con `status == "active"` de los centros visibles
(`_filtro_centro` sobre `vehicles`) sin ninguna revisión ese día; `asignada_a` sale de `daily_assignments` de esa
fecha (`slots.vehicle_id`), o `null`. `ya_apuntado`: entradas del libro de esa furgoneta con `status == "open"` y
`source == "human"` (confirmadas por una persona), las más recientes primero; `en_taller = bool(orden_id)`;
`origen = "repaso"` si la entrada lo dice, si no `"revision_rapida"`.

`estado` de cada revisión: `sin_lados` (0 lados) · `sin_repasar` (0 con veredicto) · `a_medias` · `repasada` (todos).

```json
{
  "fecha": "2026-11-12",
  "es_hoy": false,
  "zona": "Europe/Madrid",
  "center": "OGA5",
  "cuentas": {
    "revisiones": 1, "repasadas": 0, "a_medias": 1, "sin_repasar": 0, "sin_lados": 0,
    "con_golpe": 1, "golpes": 1, "furgonetas_activas": 2, "sin_revision": 1
  },
  "revisiones": [
    {
      "id": "c0a8f2d4-1111-4a2b-9c3d-000000000001",
      "recibida_at": "2026-11-12T06:58:31.402000+00:00",
      "hora": "07:58",
      "vehiculo": {"id": "veh-5678", "matricula": "5678 KLM", "modelo": "Ford Transit Custom", "centro": "OGA5"},
      "conductor": {"id": "drv-ana", "nombre": "Ana L."},
      "estado": "a_medias",
      "lados": [
        {
          "photo_index": 1, "vista": "frontal",
          "foto_url": "https://fotos.ejemplo/veh-5678/2026-11-12-frontal.jpg",
          "anterior": {
            "inspection_id": "c0a8f2d4-1111-4a2b-9c3d-000000000000", "photo_index": 1,
            "foto_url": "https://fotos.ejemplo/veh-5678/2026-11-11-frontal.jpg",
            "recibida_at": "2026-11-11T07:03:12.000000+00:00", "fecha": "2026-11-11", "hora": "08:03",
            "conductor": {"id": "drv-ana", "nombre": "Ana L."},
            "veredicto": "igual"
          },
          "veredicto": "igual", "veredicto_por": "Marta R.", "veredicto_at": "2026-11-12T08:40:02.000000+00:00",
          "golpe": null
        },
        {
          "photo_index": 3, "vista": "lateral_izq",
          "foto_url": "https://fotos.ejemplo/veh-5678/2026-11-12-lateral_izq.jpg",
          "anterior": {
            "inspection_id": "c0a8f2d4-1111-4a2b-9c3d-000000000000", "photo_index": 3,
            "foto_url": "https://fotos.ejemplo/veh-5678/2026-11-11-lateral_izq.jpg",
            "recibida_at": "2026-11-11T07:03:12.000000+00:00", "fecha": "2026-11-11", "hora": "08:03",
            "conductor": {"id": "drv-ana", "nombre": "Ana L."},
            "veredicto": "igual"
          },
          "veredicto": "golpe", "veredicto_por": "Marta R.", "veredicto_at": "2026-11-12T08:41:10.000000+00:00",
          "golpe": {
            "golpe_id": "9b1e…", "pieza": "Puerta lateral corredera izquierda", "panel": "puerta",
            "gravedad": "moderado", "descripcion": "Bollo con pintura saltada",
            "box_2d": [410, 220, 640, 470], "ya_estaba": false,
            "libro": {"accion": "nuevo", "ledger_id": "6732a0…"}
          }
        },
        {
          "photo_index": 4, "vista": "lateral_der",
          "foto_url": "https://fotos.ejemplo/veh-5678/2026-11-12-lateral_der.jpg",
          "anterior": null,
          "veredicto": null, "veredicto_por": null, "veredicto_at": null, "golpe": null
        }
      ],
      "ya_apuntado": [
        {"ledger_id": "6732a0…", "golpe_id": "9b1e…", "pieza": "Puerta lateral corredera izquierda",
         "panel": "puerta", "gravedad": "moderado", "desde": "2026-11-12",
         "inspection_id": "c0a8f2d4-1111-4a2b-9c3d-000000000001", "vista": "lateral_izq",
         "origen": "repaso", "en_taller": false, "de_esta_revision": true}
      ]
    }
  ],
  "sin_revision": [
    {"id": "veh-9012", "matricula": "9012 JMN", "modelo": "Renault Master", "centro": "OGA5",
     "asignada_a": {"id": "drv-luis", "nombre": "Luis P."}}
  ]
}
```
(En el ejemplo se omite el lado 2 por brevedad; la respuesta trae siempre todos los lados de carrocería, en orden de
`photo_index`.)

Nulos: `vehiculo.modelo` `null` si no hay marca ni modelo; `vehiculo.matricula`/`centro` `null` si la furgoneta ya no
existe; `conductor` `null` si la revisión no tiene `driver_id`, y `{"id": "<id>", "nombre": null}` si la ficha ya no
existe (lo mismo en `anterior.conductor` y `asignada_a`); `anterior` `null` = primera foto de ese lado o vista desconocida (`vista: null`);
`anterior.veredicto` `null` si nadie la marcó; `veredicto*` y `golpe` `null` sin veredicto; `golpe.descripcion`
`null` si no se escribió; `ya_apuntado[].ledger_id` `null` si la entrada no tiene `_id` legible, `golpe_id` y
`vista` `null` en entradas de «Revisión rápida»; `asignada_a` `null` sin asignación. `ledger_id` = `str(_id)`, como
en «Origen de daños».

Errores: 400 «La fecha tiene que ser AAAA-MM-DD» · 400 «Ese día todavía no ha llegado» · 400 «Código de centro
inválido» · 403 «No tienes acceso a ese centro» (los dos de `_filtro_centro`).

## B. El veredicto de un lado, y deshacerlo

### B.1 Marcar
`POST /api/inspections/{inspection_id}/repaso` · `require_admin` · cuerpo JSON:
```json
{"photo_index": 1, "veredicto": "igual"}
{"photo_index": 2, "veredicto": "no_se_ve"}
{"photo_index": 3, "veredicto": "golpe", "part": "Puerta lateral corredera izquierda", "severity": "moderado",
 "box_2d": [410, 220, 640, 470], "description": "Bollo con pintura saltada"}
```
`part`: texto (`_texto_cuerpo`, máx. 80). `box_2d`: 4 enteros 0–1000, `ymin < ymax`, `xmin < xmax`.
`description`: opcional, máx. 300.

Respuesta 200:
```json
{
  "ok": true,
  "inspection_id": "c0a8f2d4-1111-4a2b-9c3d-000000000001",
  "lado": { …mismo objeto que en A.revisiones[].lados[]… },
  "libro": {"accion": "ya_apuntado", "ledger_id": "6731ff…", "pieza": "Puerta trasera derecha",
            "panel": "puerta", "desde": "2026-11-03", "golpe_id": null},
  "estado": "repasada",
  "cuentas_revision": {"lados": 4, "con_veredicto": 4, "golpes": 1}
}
```
`libro` es `null` con `igual`/`no_se_ve`. Con `golpe`: `nuevo` y `sustituye_ia` devuelven la entrada escrita (su
`golpe_id` = el del golpe); `ya_apuntado` devuelve la entrada QUE YA ESTABA (su `pieza`, su `desde`, su `golpe_id` o
`null`) para que la pantalla diga «En esa pieza ya había un golpe apuntado desde el 03-11-2026: este queda en la
revisión con su foto». **`ya_estaba: true`** cuando el lado no tiene `anterior` y su vista es conocida (no existe
ninguna foto anterior de ese lado de esa furgoneta): no se atribuye a nadie.

Orden (el servidor): validar → reservar el lado (escritura condicionada) → copia en `analysis.damages` → libro →
apuntar `libro` en el lado → ¿completa? Si falla algo después de reservar, se deshace lo hecho y 500.

Errores: 404 «Revisión no encontrada» (no existe o borrada) · 403 «No tienes acceso a esa revisión» · 400 «Falta
photo_index» / «photo_index debe ser un numero» (`_entero`) · 400 «Esa foto no es de la carrocería» · 400 «El
veredicto tiene que ser igual, golpe o no_se_ve» · 400 «Indica la pieza» · 400 «Esa pieza no es de la carrocería:
elige otra» (`_canon_panel` da None) · 400 «La gravedad tiene que ser leve, moderado, grave o critico» · 400 «Dibuja
la caja del golpe en la foto» · 409 «Ese lado ya tiene veredicto. Deshazlo antes de cambiarlo.»

### B.2 Deshacer
`DELETE /api/inspections/{inspection_id}/repaso/{photo_index}` · `require_admin` · sin cuerpo.

Hace, en este orden: (1) si había golpe, comprueba el libro: con `accion` `nuevo` o `sustituye_ia`, si la entrada de
su `golpe_id` tiene `orden_id` o `status != "open"` → 409 y no toca nada; (2) quita el lado de `repaso.lados`;
(3) quita de `analysis.damages` el daño con ese `golpe_id` y recalcula `severity`/`total_damages_count` (§2.1); si
`analysis.origen == "repaso"` y no queda ningún daño, `analysis = null`; (4) libro: `nuevo` → borra esa entrada
(`delete_one` por `golpe_id` y `status: "open"`); `sustituye_ia` → devuelve los campos de `ia_previa` y quita los
del golpe (`origen`, `golpe_id`, `photo_index`, `vista`, `box_2d`, `description`, `ya_estaba`, `confirmado_*`,
`ia_previa`); `ya_apuntado` → nada; (5) si la revisión estaba completa, `reviewed*` vuelve a `reviewed_antes` y
`completo = false`.

Respuesta 200:
```json
{"ok": true, "inspection_id": "c0a8f2d4-…-000000000001", "photo_index": 3,
 "libro": {"accion": "borrado"}, "estado": "a_medias",
 "cuentas_revision": {"lados": 4, "con_veredicto": 3, "golpes": 0}}
```
`libro`: `null` (no era golpe) · `{"accion": "borrado"}` · `{"accion": "devuelto_a_ia"}` · `{"accion": "sin_cambios"}`.

Errores: 404 «Revisión no encontrada» · 403 «No tienes acceso a esa revisión» · 404 «Ese lado no tiene veredicto» ·
409 «Ese golpe ya está en el taller o reparado: no se puede deshacer desde aquí.»

### B.3 Rutas: orden y choques
`/repaso/dia` es un prefijo nuevo. `POST /inspections/{id}/repaso` y `DELETE /inspections/{id}/repaso/{n}` no chocan
con `GET/DELETE /inspections/{id}` (distinto número de tramos). Pasar `scripts/check_rutas_tapadas.py`.

### B.4 Qué pasa con las pantallas que ya existen
- Ficha de inspección (`Inspecciones.jsx`): ve el golpe en `analysis.damages`, con su caja en su foto, y su
  `DamageRow` lo manda al taller por índice (`PATCH /inspections/{id}/damages/{idx}`, línea 28678). Al marcarlo
  reparado ahí, el libro pasa la pieza a `repaired` (línea 28721) → el expediente lo da por reparado.
- Taller (`/work-orders/danos-pendientes`, órdenes): leen el libro abierto sin `orden_id`; la entrada a mano sale como
  cualquier otra.
- «Origen de daños» (`/damages/atribucion`): lee el libro; la entrada a mano sale con su `first_seen` y su revisión;
  `_atr_indice_golpe` la encuentra por la pieza exacta en `analysis.damages`. Esa pantalla tiene SU regla (excluye
  leves, etc.); no se toca.
- «Revisión rápida»: no ve los golpes a mano (no están en `new_damages`); una revisión repasada entera sale de su
  cola (`reviewed: true`).
- La IA de las empresas que la tienen: `_known_damaged_panels` y `_known_damages_prompt` ven la pieza en el libro y
  no la vuelven a dar como nueva. `damage-feedback "wrong"` y la autorrevisión solo borran entradas `source: "ai"`:
  la de una persona no la toca la IA.

## C. El expediente «antes del perito»

`GET /api/vehicles/{vehicle_id}/antes-del-perito` · `require_admin` · sin parámetros. Vale con cualquier `status`
de la furgoneta (una de baja es justo la que se devuelve al renting).

**Golpes que salen (solo confirmados por una persona):**
1. Del repaso: cada lado con `veredicto: "golpe"` de las revisiones de esa furgoneta. `id = golpe_id`,
   `origen = "repaso"`.
2. De «Revisión rápida»: `ai_feedback` con `vehicle_id` de la furgoneta, `verdict` en `correct | corrected` y su
   revisión no borrada. Caja: `corrected_box` si `corrected`, si no `damage.box_2d`. `id = "rr-" + ai_feedback.id`,
   `origen = "revision_rapida"`, `confirmado_por = reviewed_by`, `confirmado_at = created_at`. Si coincide con uno
   del repaso (misma revisión, mismo `panel`, mismo `photo_index`), sale solo el del repaso.
Lo que la IA dijo y nadie confirmó NO sale. Ni `annotated_photos`, ni `analysis.severity`, ni `fraud_*`, ni IP, ni
nada de otra furgoneta.

**Reparación** de cada golpe, desde el libro: la entrada con su `golpe_id`; si no lo hay (Revisión rápida o
`ya_apuntado`), la de `(vehicle_id, panel)` con `first_seen_inspection` = su revisión, y si no, la de `(vehicle_id,
panel)` abierta. `status` `repaired` → `reparado`; `open` con `orden_id` → `en_taller`; `open` → `abierto`; sin entrada
o `archived` → `desconocido`. `coste`: `actual_cost` del daño en `analysis.damages` de su revisión (por `golpe_id`, o
por pieza + `photo_index`), si no `null`.

**Atribución** (la misma función para los dos orígenes). Se evalúa en este orden y el primer motivo que salta es el
que se da:
| # | Condición | motivo |
|---|---|---|
| 1 | el golpe es `ya_estaba` (no existe ninguna foto anterior de ese lado) | `ya_estaba` |
| 2 | no hay `anterior` (vista del golpe desconocida) | `sin_foto_anterior` |
| 3 | el lado de la foto anterior no tiene veredicto `igual` de una persona | `anterior_sin_repasar` |
| 4 | día local del golpe − día local de la anterior > 1 | `varios_dias` |
| 5 | personas distintas (por correo) entre los `driver_id` de las revisiones de esa furgoneta con `created_at` entre la anterior y la del golpe, AMBAS INCLUIDAS (revisiones sin conductor no cuentan) > 1 | `varios_conductores` |
| 6 | esas personas = 0 | `sin_conductor` |
| — | si no | `atribuible: true`, `motivo: null` |
`anterior` del golpe del repaso = la que guardó el lado al marcarlo (`lado.anterior`); de Revisión rápida = §1 sobre
su `photo_index`. Nunca se dice quién dio el golpe: `conductor` es «quién la llevaba».

**Cómo entró / cómo está**: por cada vista de carrocería, la foto MÁS ANTIGUA (cómo entró) o MÁS RECIENTE (cómo
está) de esa vista entre todas las revisiones (pueden salir de revisiones distintas), en orden frontal, trasera,
lateral_izq, lateral_der; una vista sin ninguna foto no sale. `golpes_ya_estaban` = ids de los golpes con
`ya_estaba: true`.

**Calendario**: un elemento por día local desde `periodo.desde` hasta `periodo.hasta`, ambos incluidos:
`golpe` (aparece algún golpe confirmado ese día) › `revisada` (hubo al menos una revisión con fotos) › `sin_revisar`
(no hubo ninguna; incluye fines de semana: la pantalla dirá «sin fotos», no «sin revisar»).

```json
{
  "generado_at": "2026-11-14T09:00:00+00:00",
  "vehiculo": {"id": "veh-5678", "matricula": "5678 KLM", "modelo": "Ford Transit Custom", "centro": "OGA5",
               "fin_renting": "2027-03-31", "km": 48210, "km_fecha": "2026-11-12"},
  "periodo": {"desde": "2026-11-10", "hasta": "2026-11-12", "dias": 3},
  "cuentas": {"revisiones": 3, "conductores": 2, "golpes": 2, "reparados": 0, "abiertos": 2, "en_taller": 0,
              "atribuibles": 1, "ya_estaban": 1, "dias_con_revision": 3, "dias_sin_revision": 0},
  "como_entro": {
    "fotos": [{"vista": "frontal", "photo_index": 1, "foto_url": "https://fotos.ejemplo/…/2026-11-10-frontal.jpg",
               "inspection_id": "…000000000009", "fecha": "2026-11-10", "recibida_at": "2026-11-10T07:01:00+00:00",
               "hora": "08:01"}],
    "golpes_ya_estaban": ["4c2d…"]
  },
  "como_esta": {
    "fotos": [{"vista": "frontal", "photo_index": 1, "foto_url": "https://fotos.ejemplo/…/2026-11-12-frontal.jpg",
               "inspection_id": "…000000000001", "fecha": "2026-11-12", "recibida_at": "2026-11-12T06:58:31+00:00",
               "hora": "07:58"}]
  },
  "golpes": [
    {
      "id": "9b1e…", "origen": "repaso",
      "pieza": "Puerta lateral corredera izquierda", "panel": "puerta", "gravedad": "moderado",
      "descripcion": "Bollo con pintura saltada",
      "fecha": "2026-11-12", "recibida_at": "2026-11-12T06:58:31.402000+00:00", "hora": "07:58",
      "inspection_id": "c0a8f2d4-…-000000000001", "vista": "lateral_izq", "photo_index": 3,
      "foto_url": "https://fotos.ejemplo/veh-5678/2026-11-12-lateral_izq.jpg", "box_2d": [410, 220, 640, 470],
      "confirmado_por": "Marta R.", "confirmado_at": "2026-11-12T08:41:10.000000+00:00",
      "ya_estaba": false,
      "anterior": {"inspection_id": "…000000000000", "photo_index": 3,
                   "foto_url": "https://fotos.ejemplo/veh-5678/2026-11-11-lateral_izq.jpg",
                   "fecha": "2026-11-11", "recibida_at": "2026-11-11T07:03:12+00:00", "hora": "08:03",
                   "conductor": {"id": "drv-ana", "nombre": "Ana L."}, "veredicto": "igual"},
      "reparacion": {"estado": "abierto", "orden_numero": null, "reparado_at": null, "coste": null},
      "atribucion": {"atribuible": true, "motivo": null, "dias": 1,
                     "conductor": {"id": "drv-ana", "nombre": "Ana L."},
                     "conductores": [{"id": "drv-ana", "nombre": "Ana L."}]}
    }
  ],
  "calendario": [
    {"fecha": "2026-11-10", "estado": "revisada", "revisiones": 1},
    {"fecha": "2026-11-11", "estado": "revisada", "revisiones": 1},
    {"fecha": "2026-11-12", "estado": "golpe", "revisiones": 1}
  ]
}
```
Nulos: sin ninguna revisión → `periodo.desde/hasta` `null`, `dias` 0, `como_entro` y `como_esta` `null`, `golpes` y
`calendario` `[]`, cuentas a 0. `modelo`, `centro`, `fin_renting` (`renting_end_date`), `km` (`mileage`), `km_fecha`
(último `mileage_history[].date`, día local) `null` si no constan. `descripcion` `null` si vacía. `box_2d` `null` si el
daño no la tiene. `anterior` `null` en los casos 1 y 2. `reparacion.orden_numero` (`orden_numero` del libro),
`reparado_at`, `coste` `null` si no constan. `atribucion.dias` `null` sin anterior; `atribucion.conductor` `null` si no
es atribuible; `atribucion.conductores` = las personas de la ventana (vacía sin anterior). `conductor.nombre` `null`
si la ficha ya no existe. Golpes ordenados por `recibida_at` ascendente.

Errores: 404 «Esa furgoneta no existe» · 403 «No tienes acceso a esa furgoneta».

## D. La IA apagada para empresas nuevas

- **Marca**: `register_dsp` (línea 5105) añade `"ia_danos": False` al `org` de toda alta nueva.
- **Interruptor del dueño**: variable de entorno `IA_DANOS_DE_PAGO=1` (el dueño la pone cuando tenga la clave de
  Gemini de pago) → las empresas con `ia_danos: False` vuelven a la IA. Cualquier otro valor o ausente = apagada.
- **Helper**: `_ia_danos_activa(org) -> bool`: `org` None → True; `org.get("ia_danos") is False` y la variable no es
  `"1"` → False; si no → True. Empresas existentes y `get_org` sin empresa (pruebas, base por defecto) → True:
  **mismo comportamiento que hoy**.
- **Subida** (`/inspections/upload`, línea 14354): sin IA no se lanza `_analyze_and_update` ni
  `_run_yolo_for_inspection`; se guarda `analysis_status: "sin_ia"`, `analysis_error: null`, `analysis: null`, y la
  respuesta lleva `"analysis_status": "sin_ia"` (el resto igual). El fraude (`_delayed_fraud`, EXIF y hash, sin
  Gemini) sigue. El orden de comprobación queda: sin IA → `sin_ia`; con IA y sin `ai` en el plan → `plan_disabled`
  como hoy; si no, análisis.
- **`sin_ia` no es error ni pendiente**: el bucle de recuperación (línea 15372) solo reintenta `pending` y
  `error|gemini_failed|gemini_timeout` → no lo toca; `autorrevisar_inspecciones` solo mira `ok` → no lo toca.
  `/stats/attention` (línea 30020) cuenta como «fallidos» todo lo que no es `ok`: hay que excluir `sin_ia` (y
  `plan_disabled`). `/inspections/reanalyze-failed` (línea 29795): excluir `sin_ia`.
- **`POST /inspections/validate-photo`** sin IA → 200 `{"valid": true, "checked": false}` sin llamar a Gemini (la web
  dice «Foto capturada», la nativa la acepta).
- **`POST /vehicles/{id}/odometer-photo`** sin IA (después del 404 y del 400 de la imagen, sin llamar a
  `_odo_leer_foto`) → 200
  `{"aceptada": false, "km": null, "confianza": 0.0, "current_mileage": 48210, "manual_permitido": true,
  "manual_min": 48210, "manual_max": 48710, "dias": 1, "motivo": "Escribe los kilómetros que marca el cuadro.",
  "servicio_caido": true, "sin_lector": true}` (el `base` de la línea 31909 más esos tres). La web pide los km a mano
  (`servicio_caido`), la nativa enseña `motivo`. Ya existe ese camino: `inspeccion_manual` en la subida.
- **`POST /inspections/{id}/reanalyze`** sin IA → 403 «Esta cuenta no tiene el análisis automático de fotos.»
- **Módulos** (`org_modulos`, línea 1442): si `not _ia_danos_activa(org)`, se quitan `revision` e `ia-peritaje`.
- El conductor ya teclea los km cuando el lector no vale; no hay que tocar las apps.

## E. El módulo «Repaso»

Clave: **`repaso`**. Ruta del panel: **`/panel/repaso`**.
- Servidor (`server.py`, zona servidor):
  - `MODULOS_PANEL` (línea 1362), grupo Flota, justo después de `vehiculos`:
    `{"clave": "repaso", "nombre": "Repaso", "grupo": "Flota", "que": "La foto de hoy junto a la anterior del mismo lado"}`
  - `MODULOS_ESTANDAR` (línea 1399) y `_MODULOS_REPARTO` (línea 1407), después de `"vehiculos"`.
    `_MODULOS_DSP_AMAZON` y `_MODULOS_MENSAJERIA` lo heredan solos. El autónomo NO.
  - **NO** va en `_MODULOS_SOLO_PRO` (línea 1438): lo ve también Esencial y Reparto.
- Panel (zona repaso): `NAV_DEF` de `frontend/src/panel/PanelLayout.jsx` (grupo `nav.g.fleet`, después de
  vehículos: `{ to: '/panel/repaso', labelKey: 'nav.repaso', icon: … }`); la casilla de permiso en
  `frontend/src/panel/pages/Usuarios.jsx` (lista de la línea 28: `['repaso', 'nav.repaso']`); la ruta
  `<Route path="repaso" …/>` en `frontend/src/main.jsx` (junto a la de `revision`, línea 486); la clave `nav.repaso`
  con sus 6 lenguas en `frontend/src/i18nDict.js`; y las respuestas simuladas de §A y §B en `frontend/e2e/api-simulada.js`
  para que `humo` abra la pantalla.
- **Aviso**: `node scripts/check-modulos.mjs` solo pasa con las dos zonas juntas. En la copia del servidor fallará
  con ««repaso» esta en MODULOS_PANEL y no en el menu»; en la del repaso, con «esta en el menu y no en
  MODULOS_PANEL». Es lo esperado: se comprueba al integrar.

## F. Ficheros de ejemplo (la unión entre servidor y pantallas)

El servidor añade `backend/tests/test_antes_del_perito.py` que, con `base_de_mentira.py`, siembra una furgoneta
`5678 KLM` con tres revisiones (10, 11 y 12-11-2026; conductores «Ana L.» y «Luis P.»; un golpe del repaso
atribuible y uno `ya_estaba`; un lado sin veredicto; una furgoneta `9012 JMN` sin revisión), llama a las funciones
de las rutas de verdad y escribe:
- `frontend/e2e/fixtures/repaso-dia.json` ← `GET /api/repaso/dia?fecha=2026-11-12`
- `frontend/e2e/fixtures/expediente.json` ← `GET /api/vehicles/veh-5678/antes-del-perito`
Con fechas fijas (nunca «hoy»): antes de escribir, `generado_at` se pone a `"2026-11-14T09:00:00+00:00"` y
`es_hoy` sale `false` por la fecha pedida. JSON con `ensure_ascii=False`, `indent=2`, `\n` al final. El test falla si
el fichero escrito difiere del que hay en el repositorio salvo que se lance con `ACTUALIZAR_FIXTURES=1`.
Repaso y expediente, mientras no exista, escriben el suyo con esta misma forma y en esa ruta; al integrar manda el
del servidor.

Ojo con `base_de_mentira.py`: no pone `_id` (el `ledger_id` saldrá `null` en los ejemplos: la pantalla tiene que
aguantarlo), ignora las proyecciones de inclusión, su `$pull` solo quita iguales exactos y no aplica índices únicos.

## G. Lo que ya existe y lee lo que se toca (no romperlo)

Servidor y pruebas:
- `org_modulos` / módulos: `backend/tests/test_modulos_empresa.py` (l. 31: el estándar visto = `MODULOS_ESTANDAR` +
  fijos), `test_precios.py` (l. 46-60, Esencial sin lo de Pro), `test_empresas_producto.py` (l. 46: lista propia se
  respeta tal cual), `test_tanda2_dnr.py`, `scripts/check-modulos.mjs`.
- Alta: `test_alta_ios.py`, `test_cobro_repartidor.py`, `test_primer_dia.py`, `test_referidos.py`,
  `test_reparto_paises.py` (llaman a `register_dsp`; el campo nuevo no debe cambiar lo que comprueban).
- Subida y fotos: `test_tanda3_seguridad.py` (llama a `upload_inspection_photos` sin empresa: tiene que seguir con
  IA), `test_ficha_de_acceso.py` (lee el fuente de `upload_inspection_photos`: `'"$in": list(mis_ids)'`),
  `test_vistas_fotos.py`, `test_combustible_km.py`, `test_atribucion_fotos.py`, `test_salud_flota.py`,
  `test_odometro_respaldo.py`, `app-android/pruebas/api_conductor.py` (validate-photo con `valid`, odometer-photo con
  `aceptada`).
- Libro y revisión: `test_atribucion.py`, `test_atribucion_fotos.py`, `test_autorrevision.py`, `test_ledger_copias.py`,
  `test_tanda3_dia.py`, `test_demo_comercial.py`, `test_demo_fotos.py`, `test_fiabilidad.py`.
- Comprobadores: `check_contracts.py` (modelos `Damage`/`Inspection`), `check_rutas_tapadas.py`, `check_unicos.py`
  (escrituras en el libro con `except DuplicateKeyError` → índice declarado: ya lo está), `check_borrado.py`,
  `check_tenant.py`, `check_multiempresa.py`, `check_objectid.py` (el `ledger_id` es `str(_id)`), `check_cuerpos.py`
  (el POST lee el cuerpo con `_texto_cuerpo`/`_entero`).
Pantallas que leen estos campos:
- `frontend/src/panel/pages/Inspecciones.jsx` (`analysis.damages`, `severity`, `total_damages_count`, `DamageRow` por
  índice), `RevisionRapida.jsx` (`/inspections/review-queue`, `new_damages`, `damage-feedback`, `missed-damage`,
  `mark-reviewed`), `Vehiculos.jsx` (expediente viejo `/vehicles/{id}/expediente`, libro), `MiDia.jsx`,
  `IAPeritaje.jsx` (cuenta como «fallido» todo `analysis_status` que no es `ok` ni `pending`: con `sin_ia` lo
  contaría, pero esa empresa no tiene el módulo), `panel/twin3d/useVehicleDamages.js`, la pantalla de «Origen de
  daños» (`/damages/atribucion`), las de órdenes de taller (`/work-orders/danos-pendientes`).
- Conductor: `frontend/src/pages/driver/InspectionFlow.jsx` (l. 154-199: `valid`, `checked`, `aceptada`,
  `servicio_caido`, `motivo`, `manual_min/max`), `app-android/.../AuditoriaConductorNativa.kt` (l. 152-182).
- e2e: `frontend/e2e/api-simulada.js`, `origen-danos-fotos.spec.js`, `demo-fotos.spec.js`, `empresas-producto.spec.js`,
  `ios-sin-pagos.spec.js` (simula validate-photo y odometer-photo).

---

## CORRECCIONES TRAS LA REVISIÓN (14-11-2026, mandan sobre todo lo de arriba)

Las fija quien coordina para que servidor, repaso y expediente trabajen a la vez. El servidor las implementa
(`ARREGLOS-SERVIDOR.md`), las pantallas las usan (`ARREGLOS-1.md`).

R1. **La pieza se manda por su CLAVE.** `POST /inspections/{id}/repaso` con veredicto `golpe` acepta un campo nuevo
    `pieza_clave` (texto). La lista de claves válidas es la de las sugerencias de la pantalla
    (`frontend/src/panel/components/repaso/logica.js`: las claves de `repaso.p.<clave>` de `i18nDict.js`) más
    `"otra"`. El servidor guarda la lista como un diccionario `clave → (pieza gruesa del libro, nombre en español)` y
    una prueba comprueba que coincide con la de la pantalla.
    - Con `pieza_clave` válida y distinta de `"otra"`: la pieza gruesa y el nombre (`part`) salen de la clave; el
      `part` que mande la pantalla se ignora.
    - Con `pieza_clave: "otra"`: `part` es obligatorio (1-80 caracteres, texto libre de la persona), la pieza gruesa
      es `otros`, y nunca da el error «no es de la carrocería».
    - Sin `pieza_clave` (clientes viejos o pruebas): como hasta ahora, por el texto de `part`.
    - Clave desconocida: 400 «Esa pieza no está en la lista».
R2. **Cada golpe lleva su `pieza_clave`** (o `null`) allí donde hoy lleva su pieza: en `repaso.lados.N.golpe`, en el
    daño copiado en `analysis.damages`, en `ya_apuntado[]` de `/repaso/dia`, en la respuesta del `POST` y en cada
    golpe de `/vehicles/{id}/antes-del-perito` (campo nuevo, sin cambiar los que hay). Las pantallas enseñan el nombre
    traducido por la clave (`repaso.p.<clave>`) y, si es `null` u `"otra"`, el texto `pieza` tal cual.
R3. **La respuesta al marcar dice qué había ya**: cuando `libro.accion == "ya_apuntado"`, `libro.pieza` (nombre) y
    `libro.pieza_clave` (o `null`) son los de la entrada que ya estaba abierta. La pantalla la nombra: «En el libro
    ya había un golpe abierto en: {pieza}. Este se ha apuntado junto a él.»
R4. **El estado de reparación de cada golpe es el suyo** (ver `ARREGLOS-SERVIDOR.md`, decisión 1): los valores de
    `reparacion.estado` no cambian; lo que cambia es de dónde salen. `cuentas.reparados` cuenta solo los golpes cuyo
    propio estado es `reparado`.
R5. **Repaso y «Revisión rápida»**: la revisión con daños nuevos de la IA sin decidir NO sale de la cola de «Revisión
    rápida» por completar el repaso. `/repaso/dia` y `/repaso/pendientes` cuentan con `repaso.completo`, no con
    `reviewed`.
R6. Los ejemplos (`frontend/e2e/fixtures/*.json`) se regeneran con más casos; las pruebas de pantalla arman sus casos
    a partir del fichero, sin depender de un nombre o un número concreto.

## Más correcciones del servidor (14-11-2026, ya construidas en foefa-p1; mandan sobre lo de arriba)

M1. **La lista de piezas (R1)** es la de `PIEZAS` de `frontend/src/panel/components/repaso/logica.js`, tal cual está
    hoy (28 claves), más `"otra"`. En el servidor: `_REPASO_PIEZAS` (`server.py`), `clave → (pieza gruesa, nombre)`.
    `backend/tests/test_perito_arreglos_pieza.py` lee `logica.js` buscando `export const PIEZAS = {` y líneas
    `clave: 'Nombre',`, y comprueba que las claves y los nombres en español coinciden y que cada clave tiene su
    `repaso.p.<clave>` en `i18nDict.js`. Si la pantalla cambia la forma de `PIEZAS`, que cambie también esa prueba.
    - Golpe con `pieza_clave` válida ≠ `"otra"`: `part` del cuerpo se ignora; `pieza` = nombre en español.
    - `pieza_clave: "otra"`: `part` obligatorio (400 «Indica la pieza»), pieza gruesa `otros`; nunca «no es de la
      carrocería».
    - Sin `pieza_clave` (o `null`): como antes, por el texto.
    - `pieza_clave` que no está en la lista (o no es texto, o `""`): 400 «Esa pieza no está en la lista».
M2. **`pieza_clave`** (texto o `null`) va en: `lados[].golpe` (§A y la respuesta de §B.1), `libro` de §B.1 (la de la
    entrada que ya estaba con `ya_apuntado`), `ya_apuntado[]`, cada golpe del expediente (`null` en los de «Revisión
    rápida») y el daño copiado en `analysis.damages` (también en `GET /inspections/{id}`: modelo `Damage`).
M3. **`ya_apuntado[]` es una fila por GOLPE, no por entrada del libro.** El libro sigue siendo uno por pieza gruesa;
    la entrada lleva `golpe_ids` (todos los golpes del repaso enlazados) y su dueño en `golpe_id`. Cada golpe
    enlazado sin reparar sale como su propia fila (su `pieza`, `pieza_clave`, `vista`, `desde` = día de SU revisión,
    `foto_url`, `box_2d`, `de_esta_revision`), con el MISMO `ledger_id` que la del dueño. `en_taller`: orden de taller
    de la entrada (solo en la fila del dueño) o taller/estado apuntado en la ficha de ese golpe. Orden: `desde`
    descendente y, a igualdad, `golpe_id`. Así la segunda puerta marcada sale en «Ya apuntado» y no se vuelve a
    marcar al día siguiente. La fila de una entrada de «Revisión rápida» sigue igual (`golpe_id`/`vista`/`foto_url`
    `null`).
M4. **`DELETE /inspections/{id}/repaso/{n}`**, `libro.accion` puede ser además:
    - `"pasa_a_otro"`: el golpe era el dueño de la entrada y había otros enlazados; la entrada sigue abierta con los
      datos del siguiente (la pantalla debe quitar de «Ya apuntado» la fila del golpe deshecho, como con `borrado`).
    - `"queda_revision_rapida"`: la pieza la confirmó también otra persona en «Revisión rápida»; la entrada se queda
      con lo de esa persona (su fila pasa a ser `origen: "revision_rapida"`, sin `golpe_id`).
    `"sin_cambios"` ahora también = el golpe no era el dueño (solo se desenlaza). Recargar el día tras deshacer
    deja todo cuadrado en cualquier caso.
M5. **`POST /inspections/{id}/repaso`, un error nuevo**: 409 «Ese lado se ha deshecho mientras se guardaba el golpe.
    Vuelve a mirarlo.» (otra persona deshizo ese lado mientras se apuntaba; no queda nada a medias). La pantalla:
    como el otro 409, recargar el día.
M6. **Permisos en el servidor** (las cinco rutas): 403 «No tienes permiso para esa pantalla» si el usuario tiene lista
    de pantallas y no está `repaso` (las cuatro del repaso) o `vehiculos` (el expediente); 403 «Tu cuenta no tiene
    esa pantalla» si la empresa tiene lista de módulos sin ese módulo (p. ej. un autónomo). Van antes del 404.
M7. **Expediente, `anterior` con la revisión anterior borrada**: ya no sale `null` con `sin_foto_anterior` (era
    falso, ver la corrección 5 de arriba): sale la anterior VIVA de ese lado (la misma que enseña el repaso del día)
    y la atribución se calcula con ella. `sin_foto_anterior` queda solo para la vista desconocida.
M8. **Expediente, `reparacion`** (R4): `estado` sale del daño del golpe en la ficha (`repair_status: "done"` →
    `reparado` con `reparado_at` = `completed_at` y `coste` = `actual_cost`; taller asignado → `en_taller` con
    `orden_numero: null`) y, solo si el golpe es el dueño de su entrada del libro, de esa entrada (orden de taller →
    `en_taller` con su número; cerrada → `reparado`). Sin dato propio: `abierto` si el golpe sigue en la ficha,
    `desconocido` si no. Un golpe de «Revisión rápida» sin foto (`photo_index` vacío) que también se marcó en el
    repaso (misma revisión y pieza gruesa) sale una sola vez.
M9. **El análisis de la ficha (`analysis`)**: en un análisis de la IA, `severity` y `total_damages_count` son SIEMPRE
    los de la IA; con golpes a mano aparecen `severidad_con_repaso` y `total_con_repaso` (sin contar dos veces un
    golpe que la IA ya traía), y desaparecen al deshacer el último. En el análisis de la persona (`origen:
    "repaso"`), `severity`/`total_damages_count` son los de sus golpes. Ya no existen `severidad_ia` ni `danos_ia`.
M10. **`reviewed`**: completar el repaso pone `repaso.completo: true` siempre, pero `reviewed: true` solo si a la IA
    no le queda nada por decidir en «Revisión rápida» (sin IA, o análisis terminado y cada daño nuevo de la IA con
    su veredicto); queda apuntado en `repaso.marco_revisada`. `/repaso/dia` y `/repaso/pendientes` cuentan por los
    lados de cada revisión (lo mismo que `repaso.completo`), nunca por `reviewed`.
M11. **`damage-feedback`** sobre un golpe del repaso: 400 «Ese golpe lo marcó una persona en el repaso: no es de la
    IA.» (`RevisionRapida.jsx` ya no los ofrece).
M12. **Ejemplos**: además de `repaso-dia.json` y `expediente.json` hay `frontend/e2e/fixtures/repaso-respuestas.json`
    con tres respuestas de verdad: `marcar_ya_apuntado` (POST con `libro.accion: "ya_apuntado"`),
    `marcar_nuevo` (POST con `nuevo`) y `deshacer` (DELETE con `borrado`). Qué hay ahora en cada uno: ver el
    informe de la zona servidor.

## TERCERA TANDA (14-11-2026, tras la segunda revisión; mandan sobre todo lo de arriba)

Las fija quien coordina para que servidor y pantallas trabajen a la vez (`ARREGLOS-3.md`). El servidor las construye
(zona servidor, `C:\Users\dlvie\foefa-p1`); las pantallas las usan con un ejemplo escrito a mano hasta que se junte.

R7. **`GET /api/repaso/pendientes` lleva `avisar` (bool)**, además de `fecha` y `pendientes` (que no cambian).
    - `avisar: false` SOLO cuando la empresa tiene la IA de daños activa (`_ia_danos_activa(org)`) y en esa empresa
      nadie ha dado todavía ningún veredicto en el Repaso (ninguna revisión con `repaso.lados`). En todos los demás
      casos, `true`. Tiene que ser barato (se pide cada 2 minutos): una búsqueda con `find_one` y, en cuanto sale que
      sí, se recuerda en memoria por empresa (nunca vuelve a `false`).
    - Pantalla (`PanelLayout.jsx`): el número junto a «Repaso» solo se pinta si `avisar !== false` (un servidor viejo
      que no lo mande sigue como hoy). La pantalla «Repaso» no cambia.
R8. **`GET /api/vehicles/{id}/antes-del-perito` lleva `posibles_ia` (lista)**, siempre presente; vacía si la empresa no
    tiene la IA activa o no hay nada.
    - Qué entra: los daños que marcó la IA como nuevos (`is_new`), en revisiones no borradas del periodo pedido, que
      NADIE ha confirmado ni descartado (sin veredicto en `ai_feedback`, sin `golpe_id`, y cuya pieza no tiene un
      golpe confirmado en esa misma revisión). Máximo 60, del más reciente al más antiguo; si hay más, `posibles_ia_mas`
      (número) dice cuántos quedan fuera.
    - Cada elemento: `{"inspeccion_id", "fecha" (ISO de la revisión), "pieza" (texto tal como lo dijo la IA),
      "vista" (0-3 o null), "foto_url" (o null), "box_2d" (o null), "anterior": {"foto_url", "fecha"} | null}`.
      Sin conductor, sin gravedad, sin coste. No cuentan en `cuentas` ni en el calendario.
    - Pantalla (`DocumentoExpediente.jsx`): un anexo al final, solo si la lista no está vacía.
R9. **`GET /api/auth/me/assigned-vehicle` lleva `sin_ia` (bool)** en sus dos respuestas (con y sin furgoneta):
    `true` cuando la empresa del conductor NO tiene la IA de daños activa. La web del conductor
    (`InspectionFlow.jsx`) no nombra la IA ni espera a que lea nada cuando es `true`. Las cuentas con IA (`false` o
    campo ausente) siguen EXACTAMENTE igual. La app de Android no lo lee y no se toca.
R10. **`GET /api/org/billing` lleva `ia` (bool)**: `false` cuando la empresa no tiene la IA activa. El panel esconde
    el asistente (`AsistenteBurbuja`) y los botones «con IA» de importar y del cuadrante cuando es `false`; campo
    ausente = como hoy.
R11. **Sin IA, ninguna llamada a Gemini**: `POST /assistant/ask`, `POST /ai/asistente`, `POST
    /ai/asistente/fichas-tecnicas`, `POST /cuadrante/chat` (solo la parte que llama a la IA: las órdenes que
    entienden las reglas siguen funcionando), `POST /assignments/import-text`, `POST /assignments/import-image` y
    `POST /tools/plantilla-extraer` contestan 403 `{"detail": "Esta cuenta no tiene esa función."}` para una empresa
    sin la IA activa, ANTES de crear el cliente de Gemini. Las cuentas de autónomo de la app de reparto no cambian
    (su regla es `_rep_ia_permitida`).
R12. **Entrar con el enlace personal** (`CONTRATO-ALTA.md`), correcciones:
    - Una sesión con `via: "enlace"` recibe 403 `{"detail": "Con el enlace no se puede cambiar la contraseña. Pide a
      tu empresa que te la cambie."}` en TODA ruta que cree o cambie una contraseña o el correo de acceso.
    - `POST /auth/driver-code/verify` y `POST /auth/enlace` contestan siempre `configurar_cuenta: false`, y si la
      única cuenta del conductor es la contraseña inicial compartida de su empresa, la RETIRAN para él en ese
      momento (la inicial deja de abrirle la cuenta). Entrar CON la inicial sigue contestando
      `configurar_cuenta: true`, como siempre. `POST /auth/renovar` y `GET` de `mi-ficha` contestan lo mismo que
      la entrada de ese `via` (código o enlace → `false`).
    - `POST /auth/renovar` conserva `via` y `lk` del token que renueva.
    - Los errores de las rutas del alta y del enlace llevan además `codigo` (texto corto y fijo, p. ej.
      `enlace_usado_en_otro`, `enlace_caducado`, `demasiados_intentos`, `matricula_repetida`, `matricula_rara`,
      `conductor_repetido`, `telefono_raro`) junto a `detail`; la pantalla traduce por `codigo` y, si no lo conoce,
      enseña `detail`. La lista exacta la escribe la zona acceso en `CONTRATO-ALTA.md` («Códigos»).

### Correcciones del servidor (tercera tanda, 14-11-2026; construidas en foefa-p1, mandan sobre R7-R11)

C1. **R8, `vista`**: es el TEXTO de la vista, como en los golpes del expediente y en el repaso (`"frontal"`,
    `"trasera"`, `"lateral_izq"`, `"lateral_der"`) o `null` si no se sabe de qué lado es la foto. No es un número 0-3
    (en todo el contrato `vista` es texto; con números la pantalla tendría dos vocabularios para lo mismo).
C2. **R8, `posibles_ia_mas`**: va SIEMPRE, número (0 si no hay más de 60). Así la forma de la respuesta no cambia.
C3. **R8, `anterior.fecha`**: ISO, igual que `fecha` del elemento (marca «recibida en el servidor», en UTC).
C4. **R8, qué entra, además de lo dicho**: fuera también lo que la propia autorrevisión de la IA descartó
    (`veredicto_ia: "descartado"`, ya lo quitó del libro) y lo que la IA ya daba por registrado (`is_new: false`). Un
    veredicto de una persona sobre la copia del daño en `damages` (scope «all») también cuenta como decidido.
    `pieza` puede ser `null` si la IA no dijo pieza. Orden: de la revisión más reciente a la más antigua.
C5. **R7**: el primer veredicto deja una marca en la base de la empresa (`app_meta`, `_id: "repaso_usado"`); la ruta
    mira esa marca (por `_id`) y la memoria del proceso. Las revisiones se recorren buscando `repaso.lados` UNA sola
    vez por proceso (por lo marcado antes de que existiera la marca), no cada 2 minutos. Respuesta: la de R7.
C6. **R11, el chat del cuadrante**: el 403 sale solo cuando las reglas NO entienden la orden (la parte que iría a la
    IA); lo que entienden las reglas contesta como siempre. `POST /tools/plantilla-extraer`, `import-text` e
    `import-image` dan 403 siempre sin la IA (también con texto que se podría leer sin ella): la pantalla esconde
    esos botones (R10).
C7. **R9**: `sin_ia` va en las dos respuestas, también `{"assigned": false, "vehicle": null, "sin_ia": …}`.
C8. **R10**: `ia` es `true` sin empresa (pruebas) y con `IA_DANOS_DE_PAGO=1`, como `_ia_danos_activa`.
