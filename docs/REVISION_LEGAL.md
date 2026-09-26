# Revisión legal y de privacidad de Flota — 26-09-2026

Hecha comprobando el código, la base de datos y el almacenamiento reales, no
de memoria. Cada punto lleva su prueba. No es asesoría jurídica: los textos
legales definitivos (aviso legal, contrato de encargo) conviene que los mire
un profesional, pero los hechos de abajo están comprobados.

Leyenda: **ARREGLADO** (hecho y verificado) · **DECIDE DANI** (no se hace sin
su sí) · **MEJORA** (no es urgente) · **SIN PROBLEMA** (comprobado, no es un
riesgo; está aquí para no dar falsos positivos).

---

## 0. EL CONTEXTO: el aviso de Amazon del 24-09-2026 (léelo primero)

El 24-09 Rubén Córdoba (Winiw Delivery S.L., la DSP) pasó a Dani lo que pedía
Amazon tras detectar la extensión y un repositorio público:
1. Desactivar la extensión de Chrome que interceptaba datos del portal Cortex
   («eliminar únicamente el repositorio público no detendrá el flujo de datos»).
2. Rotar la clave de Google Geocoding expuesta en el historial de git (commit 2f0bb46).
3. Revisar los registros de acceso de MongoDB Atlas y Fly.io para saber qué
   datos de Amazon se recopilaron y almacenaron fuera.
4. **Inventario de todos los datos derivados de Amazon en infraestructura de
   terceros (Atlas, R2, registros de Gemini…) y confirmar su eliminación.**

Dani contestó que ya estaba todo borrado y que la extensión «no extraía
ninguna información personal de ningún cliente». Lo que se comprobó después
(25-09 y 26-09), con cifras en `inventario_amazon.py` de la sesión c3af8cab:
- El 24-09 entre 10:30 y 10:36 la extensión **seguía enviando** desde algún
  Chrome de las naves (log de Fly). Hay que desinstalarla en los PC de OGA5,
  DGA1 y DGA2.
- La extensión SÍ guardaba datos personales: **44.174 direcciones de entrega
  de clientes** con coordenadas, y nombre, teléfono y GPS de conductores.
- **La base de FlotaDSP en el Atlas de Winiw NO está borrada**: sigue con
  48.653 documentos de la extensión y 39.391 de informes del portal.
- **El 26-09, al pedir Dani «recupera todo, traspasa todo», se COPIÓ todo eso
  a Flota** (Atlas de Flota: los mismos 48.653 + 39.935 de informes), a su PC
  (`Documents\copia-flotadsp-2026-09-26`, 1,44 GB, en claro) y a una copia
  cifrada en R2. Es lo contrario de lo que pidió Amazon y hay que corregirlo.
- La **DNR diaria** (recuperada el 26-09 a petición de Dani) guarda los Daily
  Report del portal de Amazon en Flota: el punto 4 de Amazon habla de «datos
  derivados de Amazon en infraestructura de terceros». El 26-09 a las 16:38 se
  subieron informes de OGA5 en producción (91 DNR, 295 resúmenes, 632 RTS).
- En Flota: 0 rutas para la extensión, 0 claves de Google en todo el historial
  de git, repositorios no públicos (comprobado).

**Plan propuesto, pendiente del sí de Dani (nada de esto se ha hecho):**
A. Borrar de Flota las 15 colecciones de la extensión (+ `cortex_llaves`).
B. Lo mismo en el Atlas de Winiw (es de Winiw: confirmarlo con Rubén).
C. Informes del portal y DNR diaria: desactivarla y borrar sus datos hasta
   tener permiso por escrito de Winiw/Amazon (o mantener si lo dan).
D. Borrar la copia cifrada de R2 y rehacerla limpia; limpiar o borrar la
   copia del PC.
E. Plantilla: que la lista de rutas no pase por la IA (si se pega de Cortex,
   iría a Google).
F. Dani: desinstalar la extensión en las naves, borrar la clave de Geocoding
   en Google Cloud, y corregir ante Rubén lo de «no había datos personales» y
   «ya está borrado».
G. Después: dossier con evidencias para Rubén (inventario antes/después).

---

## 1. Lo grave que se encontró y ya está arreglado

### 1.1 La base de datos entera se podía descargar sin contraseña — ARREGLADO
- **Prueba:** `HEAD https://pub-37efd7…r2.dev/backups/flotadsp_2026-09-24_0201.jsonl.gz`
  → `200`, 112 MB. Las copias de seguridad iban **en claro**, con nombre
  predecible (fecha), en un almacenamiento que es público por enlace (así se
  sirven las fotos). Dentro: datos de conductores y candidatos, direcciones,
  hashes de contraseñas y claves de integraciones (p. ej. el bot de Telegram).
- **Qué se hizo:** las 15 copias se descargaron al PC
  (`Documents\copia-flotadsp-2026-09-26\backups-r2`, verificadas byte a byte) y
  se retiraron del almacenamiento (ahora `404`). Desde hoy cada copia va
  **cifrada** (AES-256-GCM, clave `C:\Users\Usuario\.flota-copias-clave.txt` y
  secreto `COPIAS_CLAVE` en Fly) y con nombre aleatorio; sin clave no se sube
  ninguna. Probado: sin la clave no se lee; con ella salen los 223.298 documentos.
- **Importante:** guarda una copia de esa clave fuera del PC (gestor de
  contraseñas). Sin ella, las copias no sirven.
- Nota honesta: el acceso público lo reactivamos hoy para recuperar las fotos;
  ese acceso ya existía así en FlotaDSP antes (por eso el patrón de nombres
  era conocido).

### 1.2 Las plantillas antiguas se podían adivinar — ARREGLADO
- **Prueba:** 76 de 78 plantillas (`plantillas/DGA1/plantilla_turno_wNN_DD-MM-AAAA.xlsx`,
  con nombres de conductores) daban `200` por el enlace público.
- **Qué se hizo:** renombradas a nombres aleatorios, 82 fichas de la base
  apuntando al nombre nuevo, los enlaces viejos dan `404`. Registro para
  deshacer: `Documents\copia-flotadsp-2026-09-26\plantillas_renombradas.json`.

### 1.3 Los CV no se borraban nunca — ARREGLADO (en el código)
- **Prueba:** la papelera de un candidato y la caducidad a 12 meses borraban
  la ficha, pero **el PDF del CV seguía en el almacenamiento** y se abría con
  su enlace. El formulario promete «guardamos tus datos 12 meses» (RGPD art.
  5.1.e plazo de conservación y art. 17 derecho de supresión).
- **Qué se hizo:** la papelera borra el CV antes que la ficha; una tarea cada
  6 h se adelanta un día a la caducidad y borra CV + ficha en todas las
  empresas. Test `test_cv_se_borra`.

### 1.4 Copias de prueba con datos personales — ARREGLADO
- Las bases `prueba_*` que se usaron hoy para probar con datos reales se
  borraron al terminar.

---

## 2. Lo que tiene que decidir Dani

### 2.1 Datos sacados de los sistemas de Amazon dentro de Flota — DECIDE DANI (recomendado: borrar)
- **Prueba:** al traspasar «todo» de FlotaDSP entraron en la base `flota`
  colecciones que la **extensión de Cortex** sacó de Amazon:
  - `cortex_direcciones`: **44.174 direcciones de entrega de clientes de
    Amazon** (calle, número, coordenadas). Son datos personales de terceros
    (los clientes de Amazon), obtenidos de un sistema de Amazon.
  - `direcciones_historico` (1.194), `geo_rescate` (303): más direcciones.
  - `cortex_posiciones` (990): posiciones GPS de conductores tomadas de Amazon.
  - `asociados_cuentas` (945): cuentas de asociados sacadas del portal de Amazon.
  - `cortex_resumen`, `cortex_debrief`, `cortex_diagnostico`, `cortex_day_snapshots`,
    `route_history`, `route_plans`, `route_demand`, `whc_api`, `whc_planes`,
    `scorecard_*`, `apoyos`, `amazon_reports`, `daily_dsp`.
- **Por qué importa:** es justo lo que «interfería con Amazon». Guardar
  direcciones de clientes de Amazon sin necesidad es un riesgo de protección
  de datos (minimización, art. 5.1.c RGPD) y de confidencialidad con Amazon.
  Flota ya no usa nada de esto (ninguna pantalla lo lee; Flota no se conecta
  a Amazon: comprobado, no hay ni una llamada a sus sistemas).
- **Propuesta:** borrar esas colecciones de `flota`. También están dentro de
  la copia local de `Documents` y de las copias viejas de FlotaDSP que se
  bajaron al PC: decidir si se borran o se guardan cifradas y apartadas.
- **Ojo, lo que SÍ es tuyo y se queda:** `dnr_rows`, `daily_reports`,
  `rts_rows`, `pod_rows`, `cc_rows` vienen de los **Daily Report que Amazon te
  da como DSP** y que ahora se suben a mano. No llevan nombres ni direcciones
  de clientes (solo nº de seguimiento, código postal e importe). Usarlos para
  gestionar tu propia empresa es uso interno normal. Si algún día se vende el
  módulo DNR a otras DSP, revisar antes la cláusula de confidencialidad del
  contrato DSP.

### 2.2 143 CV sueltos en el almacenamiento — DECIDE DANI (recomendado: borrar)
- **Prueba:** 378 CV en `cv/`, solo 235 los usa alguna ficha; **143 (44 MB)**
  son de candidaturas ya borradas o sustituidas. Siguen abriéndose con su
  enlace y no hay ninguna finalidad para guardarlos.

### 2.3 Aviso legal incompleto (LSSI art. 10) — DECIDE DANI
- **Prueba:** `frontend/src/legal/config.js` tiene vacíos el NIF, el domicilio
  y **el correo de contacto** (`MARCA.correo = ''`). La LSSI obliga a quien
  ofrece un servicio por internet a dar nombre, NIF, domicilio y un correo.
  El dominio sí tiene correo entrante (Cloudflare Email Routing), pero la web
  no enseña ninguno.
- **Qué hace falta de ti:** o tus datos como persona física (nombre, NIF,
  domicilio), o los de la sociedad cuando la constituyas, y qué dirección de
  correo poner (p. ej. `contacto@flotadsp.com` desviado a tu Gmail).

### 2.4 Cobrar sin estar dado de alta — DECIDE DANI
- La web enseña planes y precios y deja registrarse con prueba de 14 días.
  Los pagos **no están configurados** (no se cobra a nadie hoy), así que no
  hay problema ahora. Antes de cobrar al primer cliente: alta como autónomo o
  sociedad para poder facturar.

### 2.5 Contrato de encargado del tratamiento (RGPD art. 28) — DECIDE DANI
- **Prueba:** los términos (`legal/Terminos.jsx`) no incluyen contrato de
  encargo. Cuando una empresa cliente mete a sus conductores en Flota, ella es
  la responsable y Flota la **encargada**: la ley exige ese contrato por
  escrito (objeto, duración, instrucciones, confidencialidad, seguridad,
  subencargados, devolución/borrado al terminar).
- **Propuesta:** añadir un anexo de encargo que se acepte al registrarse. Se
  puede redactar sobre el modelo de la AEPD; que lo revise un profesional.

### 2.6 Política de privacidad desactualizada — DECIDE DANI (texto)
- No menciona: **candidatos de empleo** (CV, teléfono, 12 meses),
  **incorporaciones** (documentación del alta), **Telegram** como proveedor
  (recibe avisos con matrícula y daños), la **IA que atribuye golpes a
  conductores** (ver 2.7), el **chat** y WhatsApp.
- Menciona **Lemon Squeezy**, que hoy no se usa.
- Dice «mejora de la IA con datos anonimizados»: los veredictos guardan la
  foto y el daño; mejor decir «con los veredictos de revisión de tu empresa».

### 2.7 Conductores: informar del uso de fotos e IA — DECIDE DANI
- Flota guarda fotos de cada revisión, usa IA para detectar daños y tiene
  «Origen de daños» (quién causa los golpes) y un ranking por conductor. Con
  trabajadores, la ley pide **informarles antes** de estos controles (Estatuto
  de los Trabajadores art. 20.3 y LOPDGDD art. 87 y siguientes) y que ninguna
  decisión que les afecte sea **solo automática** (RGPD art. 22).
- Lo que ya está bien: la IA propone y una persona valida («Revisión rápida»).
- Falta: un texto informativo para los conductores (por ejemplo en su portal
  la primera vez que entran) y dejarlo dicho en la política.

### 2.8 Dónde están las fotos: la cuenta de winiw — DECIDE DANI
- Las fotos, CV y documentos están en el R2 de la cuenta de Cloudflare
  **tr2santiago@winiw.es**. Si winiw es tuya, perfecto. Si es de otra empresa,
  esa empresa estaría guardando datos de tus conductores sin contrato: habría
  que pasarlos a tu cuenta (caben en lo gratuito, ~6 GB).

### 2.9 Copias en el PC sin cifrar — DECIDE DANI
- `Documents\copia-flotadsp-2026-09-26` (≈1,6 GB) tiene la base completa de
  FlotaDSP y las 15 copias viejas, **en claro**, incluidos los datos de 2.1.
  Recomendado: cuando Flota esté estable en el Atlas nuevo, cifrarlas o
  borrarlas, y proteger el PC (contraseña, cifrado de disco BitLocker).

---

## 3. Mejoras (no urgentes)

- **CV y documentos por enlace:** sus nombres son aleatorios (no se pueden
  adivinar, comprobado sobre los 30.143 ficheros), pero quien tenga un enlace
  lo abre sin contraseña. Lo correcto a medio plazo: almacenamiento privado y
  enlaces firmados que caduquen (cambio técnico mediano).
- **Gemini:** comprobado en sus condiciones: desde el Espacio Económico
  Europeo, Google trata lo enviado como servicio de pago aunque sea gratuito
  (no lo usa para entrenar). Aun así, el apartado gratuito pide no enviar
  datos personales: cuando haya clientes, activar la facturación del proyecto
  para quedar con condiciones de pago y contrato de datos.
- `/api/health` enseña a cualquiera detalles técnicos (modelo de IA, nombre
  del almacenamiento). No son datos personales; se puede recortar.

---

## 4. Comprobado y SIN PROBLEMA (para no dar falsos positivos)

- **Flota no se conecta a Amazon:** ni extensión, ni llamadas a sus sistemas
  (búsqueda en todo el código: solo quedan comentarios con nombres de centro).
- **Sin sesión no sale ningún dato personal:** las 193 rutas de lectura de
  producción probadas sin iniciar sesión; solo contestan las públicas (planes,
  ofertas de empleo publicadas, estado técnico).
- **Analítica propia anónima:** sin IP, sin cookies, sin usuario; una clave de
  sesión que muere al cerrar la pestaña. No necesita consentimiento.
- **Cookies:** solo almacenamiento necesario y de preferencias; la política lo
  dice bien.
- **Dónde están los datos:** base de datos en París (AWS eu-west-3,
  comprobado en el propio clúster) y servidor en París (Fly `cdg`): dentro de
  la UE, como dice la política.
- **Geolocalización:** solo cuando alguien de oficina busca talleres o
  alquileres cerca, desde su dispositivo y al pulsar. No se sigue a nadie.
- **Candidatos:** la caducidad a 12 meses funciona (índice TTL presente y
  fechas bien guardadas; ninguno vencido sin borrar). Con 1.3 ahora también el CV.
- **Contraseñas** con bcrypt; **secretos** fuera del código; repositorio
  **privado**; la demo es de solo lectura.
