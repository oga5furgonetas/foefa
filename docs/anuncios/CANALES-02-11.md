# Canales de captación: plan del 02-11-2026

Para Dani (FDS). Encargo: «pausa las otras y consigue que cada registro me salga a 30 céntimos».

Respuesta corta:

- Con publicidad pagada en España el registro **no sale a 0,30 €**. Con los datos de la cuenta, 0,30 € exige un CPM de 1,40 € (el mediano de España es 6,4-7,2 €) o una tasa de registro 4,5 veces la actual. Ninguna palanca documentada por Meta, TikTok o Google da ese salto.
- Lo realista en Meta, haciéndolo bien: **de 1,34 € a 1,00-1,15 € en noviembre y 0,80-1,00 € hacia enero** (estimación; detalle en 2.6). El 0,30 € solo aparece en canales gratis (bolsas de empleo, grupos, orgánico) y en referidos, donde el registro cuesta 0 €.
- El problema no es el precio del registro: **32 registros del embudo del 23-10 dieron 0 días de reparto**. El coste por repartidor real es hoy infinito. Hay que comprar «primera ruta real», no registros, y eso se arregla con medición y embudo (sección 1, punto «antes de gastar») antes que con pujas.
- Sí: pausar las otras seis campañas y dejar una sola (sección 2.0).

Etiquetas: **[DATO]** cifra con fuente · **[CÁLCULO]** aritmética sobre datos · **[ESTIMACIÓN]** rango orientativo sin dato directo · **[SIN DATO]** no existe cifra fiable de 2025-2026.

---

## 1. Qué pasa hoy

Campaña «FDS Registros — Gratis 15 paradas — ES» (objetivo: registro completado en la web, 20 €/día). Administrador de anuncios de Meta, 02-11-2026 **[DATO]**:

| Métrica | Valor |
|---|---|
| Gasto | 92,32 € |
| Registros | 69 |
| Coste por registro | 1,34 € |
| Impresiones | 14.794 |
| CPM | 6,24 € |
| Registros por 1.000 impresiones | 4,66 **[CÁLCULO]** |

Otras campañas **[DATO]**: tráfico, clics a 0,07 €; visitas a 0,14 €; leads, 1 lead a 10,96 €. Embudo del 23-10: 32 registros, 0 días de reparto reales.

Desde el 01-07-2026 Meta cobra un 3 % extra («location fee») sobre lo entregado en España **[DATO]**: el 1,34 € real son 1,38 €. Todas las cifras de Meta de este plan llevan ese 3 % encima.

### Lo que exige 0,30 € por registro **[CÁLCULO]**

- Con la misma tasa (4,66 por 1.000 impresiones): un CPM de **1,40 €**. El CPM mediano de España fue 6,4-6,7 € en oct-nov 2025, 6,8-7,2 € en primavera de 2026 y 3,62 € en su mínimo (agosto de 2025) **[DATO Superads]**. El 6,24 € de FDS ya está en línea o por debajo: no hay impresiones a 1,40 € en España.
- Con el mismo CPM: **20,8 registros por 1.000 impresiones**, 4,5 veces la tasa actual. Las mejoras que Meta documenta valen 5-15 % cada una (Advantage+ audience 7,2-9,7 %, ubicaciones Advantage+ 11,7 %, vídeo 9:16 con sonido 4,8 %) **[DATO]**; todas juntas no llegan a ×1,4.
- Con clics a 0,07 €: 4,3 clics por registro, es decir, que se registre el **23 %** de los que hacen clic. Esos clics de 0,07 € son de campañas de tráfico, que Meta optimiza para el clic y no para el registro; el clic barato y la tasa alta no se dan a la vez en ninguna fuente.
- Tampoco en otros canales: TikTok In-Feed España CPC 0,25-0,65 $, Búsqueda España CPC 0,80-2,50 € **[DATO, fuentes débiles; sección 3]**. Un registro no puede costar menos que el clic que lo trae.

### Por qué el problema no es el CPM ni el 1,34 €

- 1,34 € por registro está muy por debajo de cualquier coste por lead publicado: 42,93 € mediana de España en nov-2025 (Superads), 27,66 $ en EE. UU. (WordStream, abr-24 a jun-25), 12,30 $ en Empleo (LocaliQ, 2026) **[DATO]**. No hay benchmark 2025-2026 de coste por registro de apps en España **[SIN DATO]**.
- Coste por usuario real = coste por registro ÷ tasa registro→primera ruta + 25 € de bono. Con 0 rutas es infinito. Con un 5 % de conversión **[ESTIMACIÓN]**: 1,34/0,05 + 25 = **51,8 €**; con el registro a 0,30 €: 31 €; con 1,34 € y un 10 %: 38,4 €. Bajar el registro de 1,34 a 0,30 € ahorra 21 € por repartidor; subir la conversión del 5 % al 10 % ahorra 13 €; pasar del 0 % a cualquier cosa es lo único que convierte el gasto en repartidores.
- El bono de 25 € fija el suelo: ningún canal, ni gratis, baja de 25 € por usuario real.

### Antes de gastar un euro más (0 €, 1-2 días de trabajo)

1. Enviar por API de conversiones `CompleteRegistration` deduplicado con el píxel (mismo `event_id`, ventana de 48 h), `app_login` (action_source «app») y `primera_ruta` (valor 25, EUR). Meta: «todas las fuentes habilitan optimización» **[DATO]**. Sin `primera_ruta` no se puede saber qué anuncio ni qué canal trae repartidores.
2. En el registro: pregunta «¿cómo nos conociste?» y campo de código (TIKTOK, nombre de agencia, código de referido). UTM distinta por canal y Play Install Referrer en la app (devuelve la URL de origen y las marcas de tiempo de clic e instalación) **[DATO]**.
3. Mirar los 32 registrados que no repartieron: ¿tienen trabajo de reparto? ¿Instalaron la app? ¿Tienen 20 entregas en 2 días? Si la mayoría no son repartidores en activo, el anuncio trae al público equivocado y el precio del registro da igual.

---

## 2. Meta: la receta para FDS

### 2.0 Pausar

Las otras seis campañas (tráfico, visitas, leads): pausadas. Según los commits del 02-11 en el repo, la cuenta está restringida por el pago y hoy no deja pausar ni editar; en cuanto se pague, pausar las seis y dejar solo la de registros. No reactivarlas más adelante: una pausa de 7 días o más reinicia la fase de aprendizaje **[DATO Meta]**; si hacen falta, se crean nuevas.

### 2.1 Estructura

Una campaña, un conjunto, 20 €/día.

- Objetivo «Clientes potenciales» (Leads), ubicación de conversión «sitio web», evento `CompleteRegistration`. «Ventas» vale igual; los dos entran ya en ubicaciones Advantage+ por defecto.
- Un solo conjunto. Salir del aprendizaje exige unos 50 resultados en la semana siguiente a la última edición **[DATO Meta]**: a 1,34 € son 67 €/semana; 20 €/día (140 €/semana) cubre un conjunto, no dos. Regla del 10× de Meta (presupuesto diario ≥ 10 × coste medio del evento = 13,40 €) **[DATO]**: 20 € vale.
- 6-10 anuncios dentro del conjunto (2.5).

### 2.2 Eventos y medición

- `CompleteRegistration`: píxel + API de conversiones, mismo `event_id` **[DATO]**.
- `app_login` por API de conversiones (action_source «app»).
- `primera_ruta` por API de conversiones (valor 25 €): es el único evento que mide repartidores. Se puede enviar hasta 7 días después del hecho **[DATO]**.
- Conversión personalizada «registro cualificado» = registro + login en la app en 48 h. Optimizar por ella cuando pase de 50 a la semana; mientras, seguir con `CompleteRegistration` y mirar `primera_ruta` por anuncio.
- Optimizar por `primera_ruta`: hoy imposible (0 a la semana; Meta pide ~50 **[DATO]**). El programa «Conversion Leads» de Meta exige 200 leads/mes y una tasa del 1-40 % en 28 días, y solo con formularios instantáneos **[DATO]**: no aplica.
- Público similar a partir de `primera_ruta`: necesita ≥100 personas de un mismo país en el público origen **[DATO]**. Hasta entonces, nada de similares.

### 2.3 Público

- Advantage+ audience. Controles duros: edad mínima 18, España, idioma español. Sugerencias (no límites): intereses de reparto, mensajería, paquetería, furgoneta, autónomos, logística.
- Exclusiones: público personalizado web «CompleteRegistration, 180 días», lista de clientes con los registrados y público de app con `app_login`. Es lo único que evita pagar dos veces por la misma persona.
- Dato de Meta: Advantage+ audience da 9,7 % menos coste por resultado en Leads y 7,2 % en Ventas/App (medianas, 99,9 % de confianza); no lo recomienda para remarketing **[DATO]**. Test independiente (Jon Loomer, registros, 30 días, 25 $/día por conjunto): Advantage+ logró 9-14 registros más y 0,89 $ menos de CPM que la segmentación detallada, sin significación estadística **[DATO]**. Es decir: no empeora y suele mejorar algo; no es la palanca del 0,30 €.

### 2.4 Ubicaciones

- Ubicaciones Advantage+ (todas). Meta: 11,7 % menos CPA que las manuales **[DATO]**; en Leads, Ventas y App está retirando la selección manual (despliegue gradual) **[DATO]**; añadir ubicaciones no sube el coste **[DATO]**.
- No cerrar a Reels/Stories: no hay dato de que baje el coste por registro **[SIN DATO]**. Lo que sí baja el CPA es el creativo nativo vertical: vídeo 9:16 con sonido, −4,8 % CPA y +5,1 % CTR (modelo de Meta sobre ~140.000 conjuntos, jul-2023); añadir creativo nativo de Reels, −16 % CPA (10 lift studies, 2023); romper la zona segura, −39 % CTR **[DATO, Booyah/Meta]**. Un artículo promocional de 2026 habla de −34,5 % de CPA frente a imagen, sin muestra ni periodo **[DATO sin fiabilidad]**.

### 2.5 Creatividad

Reglas: vertical 9:16, con sonido, texto fuera de la franja inferior, oferta en los 3 primeros segundos; 6-10 conceptos distintos, no variantes del mismo (Andromeda: «la diversificación creativa dará los mejores resultados») **[DATO]**. Los vídeos ya grabados para TikTok/Reels sirven de base. Ocho conceptos:

1. Oferta a cámara, 10 s: «Gratis hasta el 31-12 y 25 € por tu primera ruta».
2. Demo real de la guía de navegación nueva (mapa de día y de noche), 15 s de pantalla.
3. «60 paradas ordenadas en 2 minutos»: pantalla y cronómetro.
4. Testimonio tipo UGC: repartidor con furgoneta, qué cambió.
5. «Lo que pagas en otras apps de rutas, aquí gratis hasta fin de año» (sin nombrar marcas).
6. «¿Repartes paquetería con tu furgoneta? Tus paradas, tu orden, tu guía».
7. POV «un día de ruta con FDS», 20-30 s: es el formato que domina en #repartidor.
8. Tres pasos en texto: instala, carga las paradas, sal.

Se juzga cada anuncio por `primera_ruta`, no por registros: un anuncio con registros baratos y cero rutas es el anuncio equivocado.

### 2.6 Puja: tope de coste y qué esperar

Meta llama «objetivo de coste por resultado» a lo que antes era «cost cap» **[DATO]**.

- **Semanas 1-2: «Volumen más alto», sin tope.** Sin tocar nada durante 7 días: cambiar segmentación, creativos, evento, estrategia de puja o añadir un anuncio reinicia el aprendizaje **[DATO Meta]**. Meta recomienda 2 semanas así antes de poner un objetivo de coste cuando el histórico es corto **[DATO]**.
- **Semana 3: objetivo de coste por resultado = coste medio de 30 días × 1,1-1,2** → con 1,34 €, **1,47-1,61 €** **[DATO Meta: 10-20 % por encima]**. Presupuesto diario ≥ 5 × el objetivo (7,35 €) **[DATO]**: 20 € sobra. Después, cada semana: si gasta todo y el coste real queda por encima, bajar el objetivo 5-10 %; si deja de gastar, subirlo 5-10 %; nunca más de un cambio por semana **[DATO Meta]**.
- **Trayectoria si todo va bien [ESTIMACIÓN]**: 1,47 → 1,32 → 1,19 → 1,07 → 0,96 → 0,87 → 0,78 €. Seis semanas para rozar 0,80 €, y solo si la subasta lo permite. Common Thread (253 cuentas, 200 M$, mar-2025 a jul-2026): el coste real queda de media en el **140 % del objetivo** **[DATO]**. Lo verosímil: 1,00-1,20 € en diciembre (la demanda sube: el CPL mediano de España pasó de 42,93 € en nov-2025 a 94,82 € en dic-2025 **[DATO]**) y 0,80-1,00 € en enero-febrero (el CPM más bajo del año fue en agosto-septiembre, 3,6-3,8 € **[DATO]**).
- **Si el tope se pone en 0,30 € [DATO Meta + CÁLCULO]**: Meta marca «aprendizaje limitado» por «control de coste bajo», «puede gastar menos que el presupuesto» y «el cumplimiento no está garantizado». Con un histórico de 1,34 €, un tope un 78 % por debajo es un tope que el sistema no puede cumplir: entregará casi nada (0-5 registros a la semana), el poco gasto no enseña nada y, si entrega algo, el coste real quedará ~40 % por encima del tope (0,42 €), no por debajo. La puja máxima (bid cap) a 0,30 € equivale a pujar un CPM de 1,40 € en una subasta a 6-7 €: cero impresiones. Y el objetivo de coste no es un precio fijo, es una media semanal.
- **Lo que sí abarata el registro sin tope**: Advantage+ audience + ubicaciones Advantage+ + creativo nativo 9:16 (mejoras documentadas de 5-15 % cada una, no garantizadas ni acumulables) → de 1,34 € a ~1,00-1,15 € **[ESTIMACIÓN]**.

### 2.7 Presupuesto, calendario e hitos

20 €/día × 21 días = **420 €** (+3 % de tasa España ≈ 433 €). Registros esperados: 290-350 a 1,20-1,45 € **[ESTIMACIÓN]**.

- Día 7: ≥50 registros (fuera del aprendizaje) y coste ≤1,50 €. Si no, revisar creativos; no antes.
- Día 14: ≥100 registros; `primera_ruta` por anuncio; apagar como máximo los dos anuncios peores.
- Día 21: poner el objetivo de coste en 1,47 €.
- Regla dura: **150 registros acumulados y 0 `primera_ruta` → parar la campaña.** El problema es la oferta, el onboarding o el público, no el precio del anuncio.

### 2.8 No hacer

- Varios conjuntos, bid cap, cambios diarios, reactivar las campañas pausadas (reinician el aprendizaje).
- Campaña de instalación de app en Meta: exige el SDK de Meta o un MMP para atribuir instalaciones; sin ellos optimiza por clic y el dato de instalaciones sale a cero **[DATO Meta]**. El registro web ya se mide; no ahora.

---

## 3. TikTok, YouTube Shorts/Demand Gen, Búsqueda y App Campaigns (≤50 € por canal)

En los cuatro, el evento que se mira es `primera_ruta` (Events API/CAPI), no el registro. Nada de esto se ha tocado en ninguna cuenta.

### 3.1 TikTok: Spark Ads sobre los vídeos ya publicados

- Coste **[DATO, fuentes sin metodología]**: In-Feed España CPM 3,20-6,80 $, CPC 0,25-0,65 $, lead 8-22 $ (Stackmatix, 06-09-2026); Europa e-commerce 2025: CPM 7,50 €, CPC 0,55 €, CTR 1,5 %, CPA 18 € (Fullmetrix, 14-04-2026); global 2025 (Triple Whale vía Influee): CPM 13,26 $, CTR 1,77 %, CVR 2,01 %; CPI utilidades 0,7-2,5 $ (2025). Spark Ads: TikTok cita −4 % CPM y +43 % CVR con datos internos de 2020-2021; casos de agencia con 30-61 % menos CPA, sin muestra **[DATO sin fiabilidad]**.
- Coste por registro **[ESTIMACIÓN]**: **1-3 €** (CPC 0,25-0,65 $ y 15-30 % de registro por visita).
- Mínimos **[DATO TikTok, jul-2026]**: >20 USD/día por grupo de anuncios; la campaña solo exige >50 USD/día si se le pone presupuesto: dejar la campaña en «Sin límite» (TikTok lo recomienda) y el presupuesto diario en el grupo. Una vez activo no se puede cambiar el tipo de presupuesto.
- Prueba: 1 campaña de conversión web (píxel/Events API, evento registro), 1 grupo a 20 USD/día, **3 días = 60 USD (≈ 52-56 €; la búsqueda de hoy no da un tipo de cambio fiable, 1,08-1,15 $/€)**: pasa unos euros del tope de 50 € porque TikTok no deja menos. Solo España, 18+, Android. 2 Spark Ads con los dos vídeos de más retención (cuenta vinculada: sin código de autorización **[DATO]**). Parar a los 60 USD.
- Medir: CPM, CTR, coste por visita, registros, registros con `primera_ruta`.
- Decidir el día 3: <5 registros o >3 € por registro → fuera; CTR <0,5 % → el fallo es el vídeo, no el canal. Con 60 USD no se completa el aprendizaje (~25 resultados o 7 días **[DATO TikTok, jun-2026]**): se lee CPM, CTR y coste por visita, no un CPA fiable. TikTok recomienda 30 USD/día para conversiones web en EMEA y presupuesto diario = CPA objetivo × 10 **[DATO]**: a 2 € de registro serían 20 USD, justo el mínimo.

### 3.2 YouTube Shorts / Demand Gen

- Datos: las Video Action pasaron a Demand Gen en 09-2025; Shorts es una ubicación con el control de canales «solo YouTube» **[DATO]**. Mínimo 5 USD/día desde el 01-04-2026 **[DATO Google]**. Google pide presupuesto ≥10-20× el CPA objetivo, ≥50 conversiones y 100 USD/día por grupo para evitar el arranque en frío; su product manager llama a 100 $/día «el mínimo» **[DATO]**. CPM Shorts ~4 $ (Strike Social, 2024), CPV 0,10-0,30 $, CTR 0,1-0,5 % (Pixability, 11-2025) **[DATO]**; Demand Gen e-commerce 2026: CPC 0,30-1,50 $, CVR 0,5-2 %, CPA 15-60 $ (Storegrowers, observación de autor) **[DATO débil]**. España: **[SIN DATO]**.
- Coste por registro **[ESTIMACIÓN]**: **2-5 €**.
- Prueba: 10 €/día × 5 días = **50 €**. Solo YouTube, solo España, Android, vídeo 9:16, «Maximizar conversiones» sin CPA objetivo, conversiones por visualización desactivadas (si no, desde el 15-07-2026 factura por CPM **[DATO]**).
- Medir: CPM, CPV, CTR, registros, `primera_ruta`. Decidir el día 5: <5 registros o >5 € por registro → fuera. Tercero en orden: menos datos y más presupuesto exigido.

### 3.3 Google Búsqueda (intención)

- Datos: sin gasto mínimo **[DATO]**. CPC España: 0,80-2,50 € la mayoría, software/SaaS 2-5 € (Organik, 05-2026, sin fuente primaria); media Búsqueda 2,69 € (Dobleo/AdPredictor, 2026) **[DATO débil]**. Volúmenes de «app rutas reparto», «organizar ruta reparto», «circuit route planner gratis», «alternativa a Circuit», «app repartidor autónomo»: **[SIN DATO público]**; se miran gratis en el Planificador de palabras clave de la cuenta.
- Coste por registro **[ESTIMACIÓN]**: **1-4 €** (20-40 % de registro por clic), pero es el canal de pago con más probabilidad de que el registrado reparta: busca quien ya tiene paradas que ordenar.
- Prueba: 5 €/día × 10 días = **50 €**. 5-8 palabras en concordancia exacta o de frase (las cinco de arriba más «planificador de rutas gratis», «app para repartidores», «optimizar ruta de reparto»); anuncio «Gratis hasta el 31-12 · 25 € por tu primera ruta»; CPC manual máximo 1 €; solo Android, solo España; destino: la página de registro, no la portada.
- Medir: impresiones (volumen real), CPC, registros, `primera_ruta`. Decidir a los 10 días o a los 50 clics: ≥10 registros y ≥1 primera ruta → subir a 10 €/día. Si la cuenta de Google Ads es nueva, el crédito de bienvenida (gasto mínimo previo, 60 días, un canje) **[DATO]** abarata la prueba.

### 3.4 Google App Campaigns (Play)

- Datos **[DATO Google]**: presupuesto diario ≥50× el CPI objetivo (CPI 1,5 € → 75 €/día) o ≥10-15× el CPA in-app; 7-14 días tras cada cambio; evaluar a 30 días; la acción in-app la deben hacer ≥10 usuarios al día. CPI Android Europa Occidental 1,85 $ (compilación 2026); EMEA 2-4 $ (2025); España ≈ 0,4-0,6× el Tier-1 (05-2026) **[DATO débil]**. CPI Android España 2025-2026: **[SIN DATO]** (el último público es de 2015, 0,81 $).
- Coste **[ESTIMACIÓN]**: 1,5-3 € por instalación, 2-5 € por registro.
- Con 50 € no hay prueba válida (es el 10 % del mínimo de Google). **No ahora**: esperar a ≥300 € o a que Búsqueda o TikTok demuestren registros que reparten.

---

## 4. Canales gratis: nombres y cómo entrar sin que te echen

Contexto que cambia a quién buscar **[DATO]**: Amazon Flex cerró en España (0 % de los envíos; Amazon remitió a sus autónomos a los DSP); Glovo laboralizó (21.000 repartidores) y Uber Eats elimina a sus 4.286 autónomos el 30-11-2026 (pasan a flotas: Quinde Crew ~4.300, Closer Logistics >4.000). El «repartidor autónomo» real que queda es el de paquetería con furgoneta (agencias de SEUR, GLS, MRW, DSP de Amazon): 212.848 autónomos en Transporte (UPTA, nov-2025). Los grupos «Amazon Flex España» que citan los blogs son restos.

### 4.1 Bolsas de empleo (1 día de trabajo, 0 €)

- **Autónomos en Ruta** (revista): bolsa gratis, 102 ofertas al 02-11-2026, incluye reparto con furgoneta **[DATO]**. Publicar como colaboración: «Repartidor/a autónomo/a con furgoneta: app de rutas gratis hasta el 31-12 y 25 € por la primera ruta».
- **JobToday**: publicar es gratis, se paga por contactar candidatos; ya hay 13 ofertas de «paquetería autónomo» **[DATO]**. Dejar que contacten ellos.
- **Milanuncios**, Empleo > Transportistas: 36 anuncios de reparto autónomo solo en Madrid; tarifas profesionales no publicadas **[DATO]**. Un anuncio por ciudad grande.
- **Indeed**: 3 ofertas gratis al mes, 30 días visibles, pero prohíbe «oportunidades de negocio» y anuncios de servicios **[DATO]**: solo si se publica una ruta real pagada de un cliente. No para FDS como app.
- **InfoJobs**: sin tarifa pública; terceros citan ≥69 € por oferta **[DATO débil]**: no es gratis.
- Medir: URL con UTM distinta por portal, teléfono o código por portal.

### 4.2 Grupos de Facebook (2-3 h/semana, 0 €)

- Ningún buscador da el tamaño de los grupos de repartidores **[SIN DATO]**. Verificados solo los de camioneros, audiencia adyacente: «Camioneros y transportistas europeos» >35.000, «Transportes camioneros españoles» 29.800, «Camioner@s – Un estilo de vida» 23.500, «Camioneros en ruta española» 8.000 (13-04-2026) **[DATO]**.
- Buscar dentro de Facebook: «repartidores autónomos», «furgoneta reparto», «mensajeros», «paquetería», «riders» + ciudad, «DSP Amazon». Quedarse con los de >1.000 miembros y publicaciones diarias.
- Para que no te echen: leer las normas; escribir antes al administrador y ofrecerle algo (FDS gratis para el grupo, el vídeo de la guía); entrar con contenido útil (vídeo de la guía, calculadora «cuánto cobras por paquete», hilo de trucos de portal) y poner el enlace solo cuando lo pidan o en un comentario; cuenta personal con historial, no la página; una publicación por semana y grupo.
- Medir: enlace distinto por grupo, Play Install Referrer y «¿cómo nos conociste?».

### 4.3 Forocoches y Reddit (0 €)

- **Forocoches**: hilos vivos del nicho («Trabajé como repartidor en Amazon 1 año y contesto preguntas», 03-04-2026, 118 mensajes; «Repartidor autónomo AMAZON», 2024; «DSP en Amazon»; «Fui repartidor de Amazon y respondo preguntas») **[DATO]**. Hilo tipo «pregúntame» desde una cuenta real con antigüedad, sin enlace en el primer mensaje; responder de verdad; FDS sale cuando pregunten por apps. Si parece publicidad, baneo.
- **Reddit**: los subreddits de reparto son de EE. UU. (r/AmazonFlexDrivers 180k, r/AmazonDSPDrivers 146k) y no sirven; los españoles son generalistas y castigan la promoción (r/spain 1,1 M, r/es 254k, r/askspain 241k, r/Espana 240k; r/autonomos ~1k) **[DATO]**. Prioridad baja: responder en hilos que pregunten por apps de rutas, nada más.
- Medir: UTM por foro.

### 4.4 WhatsApp y Telegram (0 €)

- **Telegram**: ningún grupo público de repartidores verificable **[SIN DATO]**; los chats de asociaciones (Repartidores Unidos, APRA, AAR, AUR) son privados y de 2021.
- **WhatsApp**: lo que funciona es la difusión por blogs y páginas locales de empleo que ya tienen canales provinciales (ejemplo: «El Blog de Moisés y Ana», 10 canales en Andalucía y Murcia, publicó «se buscan repartidores autónomos con furgoneta» el 16-09-2025) **[DATO]**. Enviarles la oferta redactada como colaboración; publican ellos.
- Canal propio de WhatsApp para registrados (solo quien se suscriba): recordatorio de la primera ruta y del bono. Empuja hacia la ruta, que es lo que falta.
- Prohibido por las normas de WhatsApp (23-09-2026) **[DATO]**: mensajería masiva o automática, añadir gente a grupos, contacto reiterado no deseado. Nada de escribir 1:1 en frío.
- Medir: enlace por blog y canal.

### 4.5 TikTok, Reels y Shorts orgánico (3-5 vídeos/semana con lo grabado, 0 €)

- TikTok alcanza 19,0 M de adultos en España (+13,5 % interanual); Facebook 20,4 M, Instagram 24,8 M, YouTube 39,7 M (DataReportal, ene-2025) **[DATO]**. #repartidor: 54.500 vídeos y 904 M de vistas; #paqueteria 17.100 **[DATO]**.
- Lo que domina el nicho: «cuánto gané hoy», un día de ruta, trucos de portal y parada, comparativas de apps. Hacer eso con FDS en pantalla, sin tono de anuncio.
- Los vídeos con más retención pasan a Spark Ads (3.1) y a Meta como creativos (2.5).
- Medir: enlace en bio con UTM y código «TIKTOK» en el registro.

### 4.6 Agencias y flotas (horas comerciales, 0 €)

- SEUR (8.100 colaboradores), agencias de GLS (>550; GLS no emplea repartidores, los ponen las agencias), MRW (~1.500 rutas), DSP de Amazon (asalariados: encaja el panel de flota), flotas de Uber Eats (Quinde Crew ~4.300, Closer >4.000) y Glovo volviendo a flotas en ~63 ciudades **[DATO]**.
- Oferta: la agencia o la flota da FDS gratis a sus autónomos o conductores; código por agencia. Ciclos de 60-90 días **[ESTIMACIÓN]**. Es el canal con más rutas reales por registro, porque ya reparten.

### 4.7 Referidos (solo se paga por activo real)

- 10 € por invitado que reparte + 25 € de bono al nuevo = **35 € por usuario real y 0 € por registro** **[DATO interno + CÁLCULO]**. Uber paga al invitado tras un número de viajes en un plazo; Stuart tras 15 entregas en 30 días **[DATO]**. Las 20 entregas en 2 días de FDS son más exigentes que ambos; si en diciembre siguen sin salir primeras rutas, probar 20 entregas en 7 días.
- Pedir el código en el registro; enseñar el código propio justo después de la primera ruta.

---

## 5. Tabla final

Coste por usuario real = coste por registro ÷ tasa registro→primera ruta + 25 € de bono. La tasa real hoy es 0 % (32 registros, 0 rutas); la columna usa un 5 % salvo que se indique otra cosa. Todo lo de esa columna es **[ESTIMACIÓN]**.

| Canal | Coste estimado por registro | Por usuario real (bono 25 € incluido) | Presupuesto de prueba | Días para decidir | Prioridad |
|---|---|---|---|---|---|
| Medición y embudo: CAPI `primera_ruta`, «¿cómo nos conociste?», revisar por qué 32 no repartieron | — | — | 0 € (1-2 días) | Antes de todo | 1 |
| Meta: 1 campaña Leads/registro web, Advantage+ audience y ubicaciones, 6-10 creativos, 20 €/día, tope de coste desde la semana 3 | 1,34 € hoy **[DATO]** → 1,00-1,15 € en noviembre, 0,80-1,00 € hacia enero **[ESTIMACIÓN]**; 0,30 € no es alcanzable | 45-52 € (5 %); 35-38 € (10 %) | 420 € en 21 días (+3 % tasa ES) | 7 / 14 / 21 | 2 |
| Bolsas de empleo: Autónomos en Ruta, JobToday, Milanuncios | 0 € (JobToday cobra solo por contactar) | 25 € | 0 € (1 día) | 14 | 3 |
| Referidos (10 € al que invita, 25 € al nuevo) | 0 € | 35 € **[CÁLCULO]** | 0 € fijo | 30 | 3 |
| TikTok Spark Ads (vídeos ya publicados) | 1-3 € | 45-85 € | 60 USD ≈ 52-56 € (3 días; mínimo de TikTok) | 3 | 4 |
| Google Búsqueda (exacta/frase, CPC máx. 1 €) | 1-4 € | 35-65 € (10 %: intención alta) | 50 € (5 €/día × 10) | 10 o 50 clics | 4 |
| TikTok, Reels y Shorts orgánico | 0 € (3-5 vídeos/semana) | 25 € | 0 € | 21 | 5 |
| Grupos de Facebook, Forocoches, canales de WhatsApp de blogs de empleo | 0 € (2-3 h/semana) | 25 € | 0 € | 21 | 5 |
| Agencias y flotas: SEUR, agencias GLS, MRW, DSP, Quinde Crew, Closer | 0 € | 25 € + horas comerciales | 0 € | 60-90 | 6 |
| YouTube Shorts / Demand Gen | 2-5 € | 65-125 € | 50 € (10 €/día × 5) | 5 | 7 |
| Google App Campaigns (Play) | 2-5 € (1,5-3 € por instalación) | 65-125 € | 0 € ahora (mínimo útil ≈ 75 €/día) | — | 8: no ahora |
| Meta, instalación de app | — | — | 0 € (exige SDK de Meta o MMP) | — | No ahora |

Lectura de la tabla: el único sitio donde el registro cuesta 0,30 € o menos es la mitad inferior, la gratis. Si el objetivo es el precio del registro, el dinero va a bolsas de empleo, orgánico y referidos; si el objetivo es repartidores, va a medición, Meta bien montado, Búsqueda y agencias.

Orden de las tres semanas: semana 1, medición y embudo, pausar las seis, montar la campaña única de Meta, publicar en las tres bolsas, activar referidos y el canal de WhatsApp; semana 2, TikTok Spark (3 días) y Búsqueda (10 días) en paralelo, orgánico 3-5 vídeos/semana, primeros grupos y Forocoches; semana 3, tope de coste en Meta, Demand Gen (5 días), primeras llamadas a agencias y flotas. Gasto total de pago: 420 € Meta + ~155 € de pruebas.

---

## 6. Fuentes

Las páginas de ayuda de Meta no sirven el cuerpo sin sesión; las citas provienen de la consulta de hoy en la investigación previa y de los fragmentos de búsqueda, y se marcan «consultada 02-11-2026».

### Datos propios

- Administrador de anuncios de Meta, cuenta de FDS, 02-11-2026: 69 registros, 92,32 €, 14.794 impresiones, CPM 6,24 €; clics a 0,07 €, visitas a 0,14 €, 1 lead a 10,96 €.
- Embudo del 23-10-2026: 32 registros, 0 días de reparto. Oferta: gratis hasta el 31-12-2026, 25 € por la primera ruta real (20 entregas en 2 días), 10 € por referido que reparte.
- Estado de la cuenta (restringida por el pago; interruptores y Editar deshabilitados): commits del repo del 02-11-2026.

### Meta: ayuda y documentación (páginas sin fecha, consultadas 02-11-2026)

- Fase de aprendizaje (~50 resultados en 7 días): https://www.facebook.com/business/help/112167992830700
- Aprendizaje limitado y «control de coste bajo»: https://www.facebook.com/business/help/269269737396981
- Ediciones significativas (pausa ≥7 días, creativos, puja, evento): https://www.facebook.com/business/help/316478108955072
- Objetivo de coste por resultado (media semanal, 50-100 conversiones, puede gastar menos): https://www.facebook.com/business/help/272336376749096
- Buenas prácticas del objetivo de coste (10-20 % por encima, 2 semanas en Volumen más alto, cambios de 5-10 %): https://www.facebook.com/business/help/176339196621566
- Presupuestos mínimos (5× el tope de coste): https://www.facebook.com/business/help/203183363050448
- Regla del 10× sobre el coste medio del evento: https://www.facebook.com/business/help/351253434981419
- Estrategias de puja («adherence is not guaranteed»): https://www.facebook.com/business/help/1619591734742116
- Marketing API, COST_CAP: https://developers.facebook.com/docs/marketing-api/bidding/overview/bid-strategy
- Advantage+ audience (14,8 / 9,7 / 7,2 %): https://www.facebook.com/business/help/273363992030035 y https://www.facebook.com/business/ads/meta-advantage-plus/audience
- Ubicaciones Advantage+ (11,7 % menos CPA; retirada de la selección manual): https://www.facebook.com/business/help/196554084569964 ; https://www.facebook.com/business/help/407108559393196 ; https://www.facebook.com/business/help/23942209872116948
- Campañas de leads Advantage+: https://www.facebook.com/business/ads/meta-advantage-plus/leads
- API de conversiones, evento de servidor (action_source, event_id, 48 h): https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event
- API de conversiones, eventos offline (7 días): https://developers.facebook.com/docs/marketing-api/conversions-api/offline-events
- Conversion Leads (200 leads/mes, 1-40 %, 28 días): https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration
- Públicos similares (≥100 personas de un país): https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/guides/lookalike-audiences
- Instalaciones de app: SDK o MMP obligatorios: https://www.facebook.com/business/help/305102563866933 y https://www.facebook.com/business/ads/meta-advantage-plus/app-campaigns
- Tasa del 3 % en España desde el 01-07-2026 («location fee», según correo de Meta recogido por Bloomberg): https://marketing4ecommerce.net/en/meta-location-fee/ ; https://www.medianama.com/2026/03/223-meta-advertisers-location-fees-digital-service-taxes/ (marzo 2026) ; https://www.storyboard18.com/digital/meta-to-charge-advertisers-2-5-location-fee-in-select-countries-to-offset-digital-service-taxes-91778.htm

### Estudios y tests sobre Meta

- Common Thread, controles de coste (253 cuentas, 200 M$, mar-2025 a jul-2026; objetivo de coste al 140 %): https://commonthreadco.com/blogs/coachs-corner/meta-cost-controls-study-taylor-holiday-andrew-faris (06-08-2026)
- Jon Loomer, Advantage+ audience vs detallada vs similares (registros): https://www.jonloomer.com/test-results-advantage-plus-audience-detailed-targeting-lookalikes/ (09-09-2024, actualizado 06-03-2025)
- Jon Loomer, Andromeda y diversificación creativa: https://www.jonloomer.com/meta-andromeda-creative-diversification/ (20-10-2025)
- Social Media Today, novedades Advantage+ y Andromeda: https://www.socialmediatoday.com/news/meta-advantage-plus-ad-updates-february-2025/739472/ (06-02-2025)
- Booyah/Meta, creativo nativo de Reels (−16 % CPA; 9:16 con sonido −4,8 % CPA; zona segura −39 % CTR): https://www.booyah.com/blog/why-you-should-use-creative-designed-specifically-for-reels/ (datos 2021-2023)
- El Imparcial, «−34,5 % CPA» (promocional, sin muestra): https://www.elimparcial.com/estilos/2026/06/11/meta-revela-el-truco-de-reels-para-bajar-tus-costos-un-34/ (11-06-2026)

### Benchmarks de coste

- Superads, CPM mediano España (jul-2025 a jul-2026): https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/spain (consultado 02-11-2026)
- Superads, CPL mediano España (jul-2025 a jun-2026): https://www.superads.ai/facebook-ads-costs/cost-per-lead/spain (consultado 02-11-2026)
- Superads, CPI España (serie inconsistente, no sirve): https://www.superads.ai/facebook-ads-costs/cost-per-app-install/spain (consultado 02-11-2026)
- WordStream/LocaliQ vía ppc.land, benchmarks 2025 EE. UU.: https://ppc.land/facebook-ad-costs-jump-21-as-lead-campaigns-struggle-while-traffic-ads-thrive/ (09-09-2025)
- LocaliQ, benchmarks 2026 (Empleo: CPL 12,30 $): https://localiq.com/blog/facebook-advertising-benchmarks/ (23-09-2026)
- Coste por registro de apps en España 2025-2026: sin fuente (búsquedas del 02-11-2026 sin resultado).

### TikTok

- Presupuestos mínimos: https://ads.tiktok.com/help/article/budget?lang=es (julio 2026)
- Campaña «Sin límite» recomendada: https://ads.tiktok.com/resources/help/article/budget-and-bidding-faq y https://ads.tiktok.com/help/article/budget-best-practices (consultadas 02-11-2026)
- Presupuesto recomendado (30 USD/día en EMEA): https://ads.tiktok.com/business/es/how-it-works/budgeting (consultado 02-11-2026)
- Fase de aprendizaje (~25 resultados o 7 días): https://ads.tiktok.com/help/article/learning-phase (junio 2026)
- Presupuesto del grupo = CPA objetivo × 10: https://ads.tiktok.com/help/article/bidding-budget-solutions-drive-tiktok-auction-ad-performance (agosto 2026)
- Spark Ads, creación y códigos: https://ads.tiktok.com/help/article/spark-ads-creation-guide (junio 2026)
- Atribución de apps (MMP obligatorio): https://ads.tiktok.com/help/article/set-up-app-attribution-tiktok-ads-manager (consultado 02-11-2026)
- Stackmatix, costes por país 2026 (España): https://www.stackmatix.com/blog/tiktok-ads-cost-by-country-2026 (06-09-2026)
- Fullmetrix, Europa e-commerce 2025: https://fullmetrix.com/en/blog/tiktok-ads-ecommerce-guide (14-04-2026)
- Influee/Triple Whale, global 2025: https://influee.co/es/blog/tiktok-ads-benchmarks (22-07-2026)
- Lebesgue, CTR/CVR/CPM: https://lebesgue.io/tiktok-ads/tiktok-ads-benchmarks-for-ctr-cr-and-cpm (23-09-2026)
- Digital Eagle, CPI por vertical: https://digital-eagle.us/blog/cpi-in-tiktok/ (13-11-2025)
- Spark Ads, evidencia (test REPLUG; datos internos TikTok 2020-2021): https://mobilemarketingmagazine.com/?p=116642 ; https://tuffgrowth.com/do-spark-ads-get-better-results-on-tiktok-yes-but-its-complex ; https://admakeai.com/blog/tiktok-spark-ads (consultadas 02-11-2026)

### Google

- Demand Gen, mínimo 5 USD/día desde el 01-04-2026: https://ads-developers.googleblog.com/2026/02/minimum-budget-requirement-for-demand.html (27-02-2026)
- Demand Gen, guía de rendimiento y «presupuesto bajo»: https://support.google.com/google-ads/answer/16797388?hl=en ; https://support.google.com/google-ads/answer/14718973?hl=en (consultadas 02-11-2026)
- PM de Google: 100 $/día como mínimo: https://ppc.land/google-pm-calls-100-a-day-the-floor-for-a-demand-gen-campaign/ (04-10-2026)
- Demand Gen, facturación por CPM desde el 15-07-2026: https://www.digitalapplied.com/blog/google-ads-demand-gen-cpm-billing-2026-advertiser-playbook (19-06-2026)
- Storegrowers, Demand Gen y YouTube/Shorts: https://www.storegrowers.com/demand-gen-benchmarks/ (27-02-2026) ; https://www.storegrowers.com/youtube-ads-benchmarks/ (19-02-2026)
- Organik, CPC Búsqueda España por sector: https://www.organikmarketing.es/cuanto-cuesta-google-ads-espana/ (mayo 2026)
- Dobleo, CPC medio España: https://dobleo.com/blog/pago-por-click/coste-google-ads/ (2026)
- App Campaigns, presupuesto y tiempos: https://support.google.com/google-ads/answer/6167156?hl=en (consultada 02-11-2026)
- CPI: https://thesocialoutline.com/blog/mobile-app-cpi-benchmarks-2026 (21-06-2026) ; https://mapendo.co/blog/cost-per-install-by-country-2025 (2025) ; https://www.singular.net/quarterly-report-2025-q4/ (Q3-2025) ; https://www.ad-stack.ai/blog/cpi-benchmarks-mobile-apps-2026/ (15-05-2026) ; Geenapp vía Reason Why (2015, obsoleto): https://www.reasonwhy.es/actualidad/digital/todo-lo-que-tienes-que-saber-sobre-el-cpi-o-coste-por-instalacion-de-apps_2015-03
- Crédito para anunciantes nuevos: https://www.google.com/intl/es_es/ads/coupons/terms/ ; https://support.google.com/google-ads/answer/6388096?hl=es (consultadas 02-11-2026)
- Play Install Referrer: https://developer.android.com/google/play/installreferrer (consultada 02-11-2026)
- Tipo de cambio EUR/USD del 02-11-2026: sin fuente fiable en la búsqueda (valores entre 1,08 y 1,15, fechados hasta agosto de 2026).

### Canales gratis

- Indeed: límite gratuito https://es.indeed.com/help/employers/articles/free-job-post-limit ; publicaciones no permitidas https://es.indeed.com/help/employers/articles/policy-non-job-posting ; precios https://es.indeed.com/reclutamiento/recursos/howtohub/precio-de-indeed-costes-de-la-publicaci%C3%B3n-de-empleos (11-04-2026)
- JobToday: https://jobtoday.com/es/landings/advertise-for-free ; https://jobtoday.com/es/trabajos-paqueteria-autonomo (02-11-2026)
- Milanuncios: https://www.milanuncios.com/transportistas-en-madrid/reparto-paqueteria-autonomo.htm (02-11-2026)
- InfoJobs: https://empresas.infojobs.net/soluciones/publicar-oferta-de-empleo/ ; https://www.betterteam.com/mx/infojobs (consultadas 02-11-2026)
- Autónomos en Ruta, bolsa de empleo: https://www.autonomosenruta.com/empleo-transporte (02-11-2026)
- DataReportal, Digital 2025 Spain: https://datareportal.com/reports/digital-2025-spain (enero 2025)
- Hashtag Radar, #repartidor: https://hashtagradar.com/hashtag/repartidor/ (2026)
- Reddit: https://gummysearch.com/r/AmazonFlexDrivers ; https://gummysearch.com/r/AmazonDSPDrivers ; https://gummysearch.com/r/spain ; https://gummysearch.com/r/es ; https://gummysearch.com/r/Espana ; https://gummysearch.com/r/autonomos (30-09 a 01-11-2026)
- Forocoches: https://forocoches.com/foro/showthread.php?t=10648432 (03-04-2026) ; https://forocoches.com/foro/showthread.php?t=9936863 (22-04-2024)
- Grupos de Facebook de camioneros: https://seguropordias.com/motor/articulos/foros-camioneros (13-04-2026)
- Grupos «Amazon Flex España» (sin cifras): https://mevoyalmundo.com/amazon-flex/ (consultado 02-11-2026)
- Chats de asociaciones de riders: https://www.eldiario.es/economia/ataques-riders-chats-asociaciones-afines-glovo-deliveroo-hay-troncharles-piernas_1_7942165.html (17-05-2021)
- Directorio WhatsApp: https://www.gruposwats.com/deliverys-y-repartidores-unidos_gr_2906283 (16-10-2024)
- Blog de empleo con canales de WhatsApp: https://www.empleoycursosmoisesyana.com/2025/09/se-buscan-repartidores-de-paqueteria.html (16-09-2025)
- Normas de mensajes de WhatsApp: https://www.whatsapp.com/legal/messaging-guidelines?lang=es (23-09-2026)
- Referidos: Uber https://www.uber.com/es/es-es/deliver/basics/earnings/how-referrals-work (consultada 02-11-2026) ; Stuart https://help.stuart.com/en/articles/12554591-how-do-i-refer-a-friend (13-01-2026)

### Sector

- UPTA, autónomos del Transporte: https://upta.es/upta-vaticina-que-el-ano-terminara-con-tres-millones-y-medio-de-autonomos-afiliados-al-reta/ (02-12-2025) ; https://upta.es/el-trabajo-autonomo-no-toca-techo-3-414-192-afiliados-en-el-mes-de-octubre/ (04-11-2025)
- Amazon Flex cierra en España: https://marketing4ecommerce.net/amazon-flex-se-despide-de-espana-dejando-atras-a-sus-repartidores-autonomos/ (14-06-2022)
- Uber Eats, fin de los autónomos el 30-11-2026: https://www.eldiario.es/1_cfcde9 (27-10-2026) ; https://theobjective.com/economia/2026-01-15/uber-eats-colaborar-trabajadores-autonomos/ (15-01-2026)
- Glovo: https://www.eldiario.es/economia/glovo-anuncia-ere-750-repartidores-medio-denuncias-multiples-despidos-individuales_1_13059750.amp.html (11-03-2026) ; https://www.democrata.es/economia/glovo-acuerda-ere-sindicatos-436-trabajadores/ (13-05-2026) ; https://www.merca2.es/2026/03/13/glovo-ere-flotas-2359832/ (13-03-2026)
- SEUR: https://www.seur.com/es/repartidores/hazte-repartidor/ (consultada 02-11-2026)
- GLS: https://gls-group.com/ES/es/medios/sala-de-prensa/gls-spain-preve-superar-el-millon-de-envios-durante-los-dias-de-mayor-demanda-de-la-campana-de-navidad (03-11-2025) ; https://gls-group.com/ES/es/sobre-nosotros/nuestros-partners/quiero-trabajar-como-repartidor-de-paqueteria/
- MRW y SEUR, flota: https://www.shippypro.com/blog/es/empresas-de-reparto-espana (28-10-2026)
- Amazon DSP en España: https://press.aboutamazon.com/es/2019/5/de-empleados-a-emprendedores-la-nueva-iniciativa-de-amazon-ayuda-a-que-sus-empleados-inicien-su-propia-compania-de-reparto (13-05-2019)
- Fenadismer: https://www.interempresas.net/Logistica/494654-Entrevista-a-Julio-Villaescusa-presidente-de-Fenadismer.html (02-11-2023)
