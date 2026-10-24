# La app de reparto (FDS) vista por primera vez — autocrítica del 25-10-2026

Dani: «sé autocrítico; si vieras la app por primera vez, ¿qué mejorarías, cambiarías e implementarías? Que la gente
quiera usarla siempre para trabajar y merezca pagar. Sin falsos positivos».

## Cómo la he mirado
- **Usándola como un repartidor nuevo**, en móvil y en producción: portada `/repartidores` → «Probarla ahora» (8
  paradas de ejemplo) → ordenar → navegar → entregar. A las 00:10, que es cuando se apunta mucha gente.
- **Con datos**: 35 altas reales de repartidor en 10 días; 27 solo miraron el día del alta, 2 metieron paradas, 1
  entregó algo, **ninguno ha hecho un día de reparto real** (`tools/metricas/uso_altas.py`). Sesiones que llegan desde
  los correos: de 29 que iban a su ruta, 7 entraron.
- **El mercado** (fuentes al final): Circuit/Spoke, Zeo, Xpedit, Routal Drivers.

## Lo que está bien (y no hay que tocar por tocar)
- El núcleo es completo: foto a la etiqueta o escáner (también en iPhone, con WebAssembly), lista de reparto en una
  foto, ruta por tiempo con franjas, guía por voz dentro de la app o en Google Maps/Waze, prueba de entrega (foto,
  dónde, quién, firma), cobros, sin cobertura (la entrega se guarda y se envía sola), «Ver la puerta», «la última
  vez en esa puerta», dónde va cada paquete en la furgoneta, «Mi dinero hoy» y el resumen al terminar.
- El precio es competitivo: 9,99 €/mes o 99 €/año frente a Circuit (Premium 19,99 $/mes, Lite 9,99 $), y el plan
  gratis da 15 paradas al día frente a 10 por ruta.

## Lo que fallaba, con pruebas (arreglado entre el 24 y el 25-10)
| Fallo | Prueba | Arreglo |
|---|---|---|
| El correo de la mañana llevaba a «crear cuenta» | 22 de 29 clics no entraron; alguno se registró dos veces | Enlace con pase (entra sin contraseña, 72 h); `/ruta` sin sesión va a «Entra en FDS» |
| El correo «primer día» llegaba un día tarde | Exigía 20 h desde el alta; se apuntan de 13 a 23 h | Desde las 8 h: llega la mañana siguiente |
| De noche, la ruta salía «desde ahora» | 8 paradas en A Coruña: «00:18, 00:25… 11 h 53 min» | De 22:00 a 5:59 sale a su hora de salida (Ajustes, 9:00) y lo dice: «Sales a las 9:00» |
| Lo no entregado desaparecía a las 00:00 | La ruta es la del día (`fecha == hoy`) | Aviso «Tienes N paradas sin entregar de días anteriores» → «Pasarlas a hoy» (solo si lo pide) |
| La opinión se pedía al ir a cargar | Salía arriba de «Hoy», una vez, nada más llegar a 2 entregas | Se pide al terminar la ruta, debajo del resumen |
| No veía su progreso | Solo el resumen del día | Récord de verdad (≥10 y más que cualquier día anterior) y «Llevas N entregas con FDS» |
| No había guía de uso en su momento | Solo un recorrido de 3 pasos el primer día | Un consejo al día, solo de lo que no usa y cuando viene a cuento («Entendido» lo quita para siempre) |
| Las direcciones repetidas se volvían a escribir | La queja más repetida de Circuit; nosotros solo recordábamos la nota de la puerta | Al escribir, primero «Ya estuviste aquí · N veces», con su punto, cliente y teléfono |

## Lo que sigue fallando o falta (por orden de lo que creo que mueve la aguja)
1. **El público.** Muchas altas no tienen una ruta propia que ordenar: riders de comida (una entrega cada vez) o
   conductores de empresas que ya les dan la ruta en su app. Las dos únicas respuestas a «¿qué te frenó?» son «no
   supe» y «no tengo ruta». Hay que apuntar los anuncios a quien sí ordena: autónomos de paquetería, Mercado Envíos
   Flex, mensajeros, súper a domicilio. No es la app: es a quién se le enseña.
2. **Preparar la ruta de mañana.** Quien carga por la tarde o la noche no puede planificar «para mañana»: solo hay
   «hoy». El arreglo de hoy (traer lo de ayer) lo salva, pero lo bueno es poder elegir «hoy / mañana» al cargar
   después de las 18:00. Circuit y Zeo planifican por fecha.
3. **Más consejos** sobre lo que ya hay y casi nadie descubre («Ver la puerta», escanear uno tras otro, la hoja de
   reparto en una foto), con el mismo criterio: solo cuando viene a cuento.
4. **Resumen semanal** (correo y aviso, sábado): días repartidos, entregas, su mejor día. Solo a quien ha repartido
   esa semana. Es la recompensa que hace volver; hoy solo hay el resumen del día.
5. **La portada pesa**: dos promociones juntas, chips de marcas y un texto legal largo antes del botón. Más corta:
   qué hace, gratis, botón; lo demás debajo.
6. **Tráfico en vivo**: hoy es «tráfico típico» por hora y día. En vivo cuesta dinero por consulta; solo cuando haya
   repartidores de pago que lo justifiquen.

## Lo que NO haría
- Medallas o rachas por cosas que no son trabajo, cifras de ahorro inventadas («ahorras 2 h») o testimonios falsos.
- Más avisos al móvil: uno por la mañana basta; el resto, dentro de la app.
- Cambiar el modelo de precio ahora: primero que haya repartidores que lo usen cada día.

## Cómo saber si funciona
- Sesiones `utm_source=correo` que acaban en `/ruta` con sesión (antes 7 de 29).
- Altas que meten paradas suyas en las 48 h siguientes y altas con un día real (≥15 entregas): `uso_altas.py`.
- Paradas traídas de días anteriores (`traida_de` en `reparto_pedidos`) y opiniones al terminar la ruta.

## Fuentes del mercado
- Precios de Circuit/Spoke: [help.getcircuit.com](https://help.getcircuit.com/en/articles/9335950-how-much-does-circuit-route-planner-cost),
  [apppricinglab.com](https://apppricinglab.com/iap/apple/1198232244), [elogii.com](https://elogii.com/blog/circuit-review).
- Quejas de usuarios de Circuit/Spoke (direcciones repetidas, sin conexión, fallos tras actualizar):
  [capterra.lu](https://www.capterra.lu/software/210604/Spoke), [rfp.wiki](https://www.rfp.wiki/vendors/circuit).
- Zeo (precios y límites por plan): [upperinc.com](https://www.upperinc.com/blog/zeo-route-planner-pricing/),
  [capterra.com](https://www.capterra.com/p/208151/Zeo-Route-Planner/pricing/).
- España/LatAm: [Routal Drivers](https://routal.com/en/blog/la-revolucion-del-reparto-para-autonomos-ya-esta-aqui-llega-la-nueva-app-de-routal-drivers),
  [Spoke en App Store MX](https://apps.apple.com/MX/app/id1198232244).
