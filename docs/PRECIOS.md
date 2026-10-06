# Precios de Flota (estudio del 06-10-2026)

> Documento interno. Lo que se cobra, por qué, lo que nos cuesta y cómo se aplica en cada caso.
> Los precios de la competencia son los publicados en octubre de 2026 (fuentes al final).
> Todo lo que es una estimación lo dice. Revisar en enero de 2027: sube el precio de la IA.

## 1. Qué vendemos y contra qué compite

Flota no es un GPS ni un programa de envíos. Es lo que hay ALREDEDOR de la furgoneta y del conductor:
el estado del vehículo (inspección con foto y daños detectados por IA, quién causa los golpes),
el taller, los vencimientos, la operación del día (qué furgoneta lleva cada uno, cuadrante, turnos,
plantilla de salida, checklist) y la gente (fichas, portal del conductor, incorporaciones, chat).

| Lo que el cliente usa hoy para eso | Precio publicado | Qué le falta frente a Flota |
|---|---|---|
| Fleetio (mantenimiento de flota) | 4 / 7 / 10 $ por vehículo y mes (anual), mínimo 5 | Sin IA de daños, sin cuadrante ni turnos, en inglés |
| Whip Around (inspecciones) | 5 $ (Standard) / 10 $ (Pro) por vehículo y mes | Sin IA de daños, sin operación diaria |
| Software de flotas español con GPS | 12–28 € por vehículo y mes + equipo 80–200 € + instalación 60–120 € + SIM 2–5 €/mes | Hay que instalar algo en cada furgoneta; no mira daños ni turnos |
| Turnos/RR. HH. (Sesame, Factorial) | 4,75–8 € por EMPLEADO y mes | No sabe nada de vehículos |
| Rutas para equipos (Circuit for Teams) | ~40 $ por conductor y mes, o 100–1.000 $ al mes por paradas | Solo rutas |

Conclusión: una empresa que junte inspecciones + mantenimiento + turnos paga hoy entre 10 y 20 € por
vehículo y mes repartidos en tres programas. Flota lo da en uno, en español y sin instalar nada.

## 2. Lo que nos cuesta un vehículo (estimado, por mes)

| Partida | Cálculo | € por vehículo y mes |
|---|---|---|
| IA de daños | 4 fotos + 4 de referencia por inspección ≈ 13.000 tokens de entrada y ~1.500 de salida. Gemini 3.8 Flash: 0,75 $/M y 3,75 $/M hasta el 31-12-2026; **1,50 $/M y 7,50 $/M desde el 1-1-2027**. 22 inspecciones al mes | 0,35 hoy · **0,65 desde enero** |
| Fotos (R2) | 4 fotos × 300 KB × 22 días ≈ 26 MB/mes, guardadas 24 meses ≈ 0,6 GB → 0,015 $/GB | 0,01 |
| Base de datos | Atlas dedicado (M10) cuando haya clientes de pago ≈ 60 $/mes, repartido | 0,10–0,40 según clientes |
| Servidor (Fly) + correo | ≈ 30–40 €/mes en total | 0,05–0,20 |
| WhatsApp (si se usa) | Mensaje de utilidad en España ≈ 0,02 $ (tarifa de Meta, por confirmar en su tabla oficial) × ~8 avisos por conductor/mes | 0,15 por conductor (aparte: se repercute) |
| **Total sin personas** | | **≈ 1,0–1,4 €** |

El coste de verdad es de personas: implantación (cargar flota, configurar, formar) ≈ 10–25 h por
cliente mediano, y soporte. Por eso la implantación se cobra aparte (sección 4) salvo en contratos anuales grandes.

**Requisito antes del primer cliente de pago:** clave de Gemini de PAGO (la gratuita da ~20 peticiones
al día y una empresa de 150 furgonetas hace 150 inspecciones al día) y base de datos dedicada (el
clúster gratis tiene tope de 500 colecciones y no tiene copias ni garantía).

## 3. Los planes (por vehículo activo y mes, IVA aparte)

Usuarios de oficina y conductores **ilimitados** en todos los planes: se cobra por furgoneta, nunca por
persona. Es el argumento contra los programas de RR. HH., que cobran por empleado.

| | **Esencial** | **Pro** (recomendado) | **Empresa** |
|---|---|---|---|
| Precio | **5 €** | **9 €** | **desde 12 €** (a medida) |
| Mínimo | 10 vehículos (50 €/mes) | 20 vehículos (180 €/mes) | 100 vehículos |
| Delegaciones | 1 | Ilimitadas, con jefe por delegación | Ilimitadas |
| Vehículos, documentos, vencimientos (ITV, seguro, renting) | ✓ | ✓ | ✓ |
| Inspección diaria con fotos **y daños detectados por IA** | ✓ | ✓ | ✓ |
| Incidencias, talleres y órdenes de reparación | ✓ | ✓ | ✓ |
| Conductores y su portal (inspección, turnos, peticiones) | ✓ | ✓ | ✓ |
| Chat interno, importar de Excel, avisos por correo | ✓ | ✓ | ✓ |
| Revisión rápida de daños y **quién causa los golpes** | — | ✓ | ✓ |
| Qué furgoneta lleva cada uno (asignación y furgonetas fijas) | — | ✓ | ✓ |
| Cuadrante con motor, turnos y días libres | — | ✓ | ✓ |
| Plantilla de salida, checklist de apertura/cierre, aparcamiento | — | ✓ | ✓ |
| Incorporaciones, empleo y contactos | — | ✓ | ✓ |
| Exportar a Excel | — | ✓ | ✓ |
| Informe pericial firmado (para reclamar al renting o al seguro) | — | ✓ sin límite | ✓ sin límite |
| WhatsApp con conductores y talleres | — | complemento | ✓ incluido (hasta 2.000 mensajes/mes) |
| API de solo lectura (flota y taller a vuestros sistemas) | — | — | ✓ |
| Implantación asistida y formación por delegación | — | — | ✓ incluida |
| Soporte | Correo | Correo y teléfono | Prioritario, con persona asignada |

Por qué así: Esencial compite de tú a tú con Fleetio/Whip Around (5 $) llevando ya la IA (decisión de
producto del 04-10: la IA va en todos los planes, sin ella el producto no se distingue de una hoja de
cálculo). Pro cuesta lo que Fleetio Premium (10 $) pero trae la operación diaria entera, que nadie
más da. Empresa justifica su precio con lo que tiene coste para nosotros (WhatsApp, peritajes,
implantación, soporte) y con la API.

Margen bruto (sin personas): Esencial ≈ 75 %, Pro ≈ 85 %, Empresa ≈ 85 % (con el WhatsApp incluido).

### El repartidor autónomo (FDS)
9,99 €/mes o 99 €/año, 7 días de prueba. Es otro producto (la app de ruta, sin panel). Se queda igual:
es una persona con una furgoneta, no una empresa, y por debajo de Circuit o Routific.

## 4. Complementos («paga más y obtén…»)

| Complemento | Precio | Para quién |
|---|---|---|
| **Reparto**: app de ruta para conductores (escanear o foto a la etiqueta, ruta ordenada por tiempo, navegación, prueba de entrega, seguimiento para el cliente, cobro) | 6 € por conductor que la use en el mes (se cuenta solo: conductores distintos con pedidos el mes anterior) | Empresas sin PDA ni ruta optimizada (súper, distribución, pequeñas mensajerías) |
| **WhatsApp** con número propio | 150 € de alta + mensajes a precio de Meta + 20 % | Pro (Empresa ya lo trae) |
| **Vehículos de colaboradores** (subcontrata con su furgoneta: inspección, documentos y vencimientos) | 3 € por vehículo y mes (se marca en la ficha: «Cómo se factura») | Paquetería con autónomos que reparten para ella |
| **Vehículos de campaña** (Black Friday, Navidad) | 0,30 € por día de alta, a mes vencido (fechas en la ficha) | Picos de temporada |
| **Implantación asistida** (cargamos flota y conductores, configuramos delegaciones y permisos, formación online) | 490 € hasta 50 vehículos · 990 € hasta 200 · a medida por encima | Esencial y Pro. **Gratis con contrato anual de 100 vehículos o más** |
| **Formación presencial** | 300 € por jornada + desplazamiento | Quien la pida |
| **Integración con su programa de envíos** (Alertran u otro) | A presupuestar tras ver su API (orientativo 1.500–3.000 € + 100 €/mes de mantenimiento) | Empresa |

Cómo se cobra cada uno (06-10-2026): reparto, colaboradores y campaña los calcula solo el cobro
mensual (`_cuenta_flota` y `_lineas_complementos` en server.py) y salen como líneas aparte en Negocio.
WhatsApp, implantación, formación e integración se pactan y se facturan a mano. El informe pericial
dejó de ser complemento el 06-10: la app lo da sin límite en Pro (`forensics`) y la web lo vendía a 9 €.

## 5. Descuentos

- **Anual**: se pagan 10 meses (2 gratis, −16,7 %). Ya está así en la app.
- **Volumen** (sobre el precio por vehículo): 50–149 vehículos −10 % · 150–299 −15 % · 300 o más −20 %.
- Anual y volumen se suman.
- **Cliente fundador** (las 10 primeras empresas): Pro a 6 € por vehículo, congelado 24 meses. No se suma al volumen; sí al anual. (Antes la web decía «Completo a 5 € para siempre»: nadie había reservado y se cambió el 06-10.)
- **Piloto** para 50 vehículos o más: 45 días gratis en una delegación, con objetivos medibles pactados
  por escrito (ver la propuesta de cada cliente). Si al final se contrata, el piloto no se cobra.
- Nunca descuentos a cambio de nada: cada rebaja lleva compromiso (anual, volumen, testimonio o caso de éxito publicable).

## 6. Casuísticas

| Caso | Regla |
|---|---|
| ¿Qué vehículo cuenta? | Las propias de alta el día que se genera el cobro del mes (por adelantado). Las del taller cuentan; las de baja, las de colaboradores y las de campaña, no (van aparte). |
| Alta o baja a mitad de mes | Ese mes no se toca: el cobro ya está hecho y lo nuevo entra en el del mes siguiente. Nunca a toro pasado. (No hay prorrateo automático en el cobro mensual.) |
| Usuarios y conductores | Ilimitados. Nunca se cobra por persona. |
| Furgonetas de subcontratas | Se marcan «De colaborador» en la ficha: 3 € al mes, fuera del plan, del mínimo y del descuento por volumen. |
| Picos de temporada | Se marcan «De campaña» con fechas: 0,30 € por día, en el cobro del mes siguiente. Al darla de baja, la campaña se cierra ese día. |
| Cambio de plan | Subir: se activa cuando entra el pago (o lo fuerza el super-admin); la vista previa calcula la diferencia de los días que quedan. Bajar: desde el panel, al momento; el cobro del mes ya hecho no se devuelve. |
| Prueba | 14 días de Pro sin tarjeta, autoservicio. Más de 50 vehículos: piloto acompañado. |
| IA, uso razonable | Propuesta: hasta 2 inspecciones por vehículo y día; por encima, 0,05 € cada una. **No está implementado**: hoy no se mide ni se cobra. |
| Impago | Propuesta: aviso a los 7 días, solo lectura a los 15, datos guardados 90 días. **Hoy es manual**: el cobro se marca a mano en Negocio y la cuenta se suspende desde allí. |
| Baja | Mensual: cuando quiera. Anual: al acabar el año. Se le devuelven o se borran los datos, lo que elija (contrato de encargo). El borrado lo hace el super-admin a mano («Eliminar empresa»); no hay borrado automático. |
| Subida de precio | Como mucho una vez al año, con al menos 30 días de aviso (lo que dicen los Términos). Los fundadores, congelado 24 meses. |
| Datos personales | Somos encargados del tratamiento: el contrato de encargo (art. 28 RGPD) va incluido en el alta. |
| Cobro | Tarjeta (Stripe) o domiciliación/transferencia con factura para Empresa y anuales. |

## 7. Fuentes (consultadas el 06-10-2026)

- Fleetio: https://tech.co/fleet-management/fleetio-review
- Whip Around: https://www.selecthub.com/p/fleet-maintenance-software/whip-around/
- Flotas con GPS en España: https://trackia.es/blog/cuanto-cuesta-software-gestion-flotas-espana/
- Sesame HR y Factorial: https://www.tramitapp.com/blog/sesame-recursos-humanos/ · https://factorial.es/blog/factorial-sesame-hr-comparativa/
- Circuit for Teams: https://www.upperinc.com/blog/circuit-pricing/
- WhatsApp Business API España: https://engrana.es/en/blog/whatsapp-business-api-pricing-spain (comprobar en la tabla oficial de Meta antes de cerrar precios de WhatsApp)
- Gemini 3.8 Flash: https://pricepertoken.com/pricing-page/model/google-gemini-3.8-flash
