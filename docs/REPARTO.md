# Reparto a domicilio y a negocios (03-10-2026)

Módulo `reparto` de Flota, para empresas que reparten **su propia mercancía**:
el supermercado que lleva la compra a casa (caso Gadis: ticket de caja pegado a
las cajas, apuntado a boli, cada repartidor con su zona) y el distribuidor que
reparte a negocios (caso Disgón: por la mañana se escanean los bultos y salen
las direcciones de talleres y astilleros).

## Cómo funciona

1. **Alta**: en `/registro` el primer paso pregunta a qué se dedica la empresa.
   «Supermercado» y «Distribución a negocios» nacen con el módulo `reparto` y
   sin lo que es de paquetería por turnos (`SECTORES_REGISTRO` en server.py).
   A una empresa que ya existe se le activa «Reparto» desde la plataforma.
2. **Entran pedidos** de tres formas:
   - la oficina los añade a mano o **pega la lista** de su programa/Excel
     (`reparto.lee_pegado`: cabeceras por nombre o código;cliente;dirección;teléfono;lleva);
   - el **conductor escanea** el código de la caja (`BarcodeDetector` del
     navegador, Chrome de Android; nada sale del móvil). Si el pedido está en
     la lista, entra en SU ruta; el segundo bulto del mismo pedido lo reconoce
     y cuenta «bulto 2 de 4». Si no está, lo mete a mano —o con **foto del
     ticket leída por IA**, ver abajo—;
   - en iPhone (sin lector en el navegador) se escribe el código o se usa la foto.
3. **Zonas**: cada zona con su conductor, por código postal o palabra de la
   dirección. «Repartir por zonas» asigna lo que no tiene conductor.
4. **Ruta**: vecino más cercano + 2-opt desde el almacén (o desde donde está el
   conductor), sin servicios de pago. «Ir» abre el navegador del móvil.
5. **Seguimiento**: la oficina ve el mapa con las paradas, el progreso de cada
   uno y dónde va cada conductor **en jornada**.

API: `/api/reparto/*` (server.py, bloque «REPARTO»). Lógica pura y probada en
`backend/reparto.py` (`tests/test_reparto.py`, `tests/test_reparto_api.py`).
Pantallas: `panel/pages/Reparto.jsx`, `pages/driver/MiRuta.jsx`,
`panel/components/MapaReparto.jsx`.

## Lo legal: qué se puede y qué no, y cómo está hecho

| Ámbito | Norma | Cómo queda |
|---|---|---|
| Datos de los clientes de la empresa (nombre, teléfono, dirección, qué compra) | RGPD art. 4, 6.1.b, 28 | La empresa es la **responsable**; Flota su **encargada**. Nosotros NO los vemos: entrando como la empresa (`imp` en el token) salen tapados (`reparto.tapar`) y no se pueden crear ni tocar pedidos. |
| Contrato de encargo | RGPD art. 28.3 | Publicado el 03-10 en `/encargo` (`legal/Encargo.jsx`), anexo de los términos que se acepta en el alta (casilla del registro). Falta la razón social, CIF y domicilio cuando se constituya la empresa, (el correo ya está: contacto@flotadsp.com desde el 03-10). |
| Minimización | RGPD art. 5.1.c | Cada conductor ve solo SUS pedidos; las direcciones van al geocodificador sin nombre ni teléfono. |
| Plazo de conservación | RGPD art. 5.1.e | Nombre, teléfono, dirección, contenido y coordenadas se borran solos a los N días (por defecto 30, la empresa elige 1-90). Quedan los números. Rastros de ubicación: 30 días. |
| Ubicación de los conductores | LOPDGDD art. 90, ET art. 20.3 | Solo entre «Empezar jornada» y «Terminar»; la primera vez el conductor lee el aviso (qué se ve, quién, cuánto tiempo) y queda registrado (`reparto_avisos`). Fuera de jornada el servidor rechaza los puntos (409) y no guarda ni el último. La plataforma tampoco ve las ubicaciones. |
| Foto del ticket | — | Se lee **en el propio móvil** (tesseract.js servido desde `/ocr/<versión>/` de nuestro dominio, `lib/leerTicket.js`): la foto no sale del teléfono, no hay tercero. El conductor revisa lo leído antes de guardar. |
| IA leyendo tickets (servidor) | RGPD art. 28.4 y 44 | Alternativa más lista pero **bloqueada** hasta tener clave de pago: en el nivel gratuito de Gemini, Google puede usar lo enviado para mejorar sus productos. Se enciende con `REPARTO_IA_PERMITIDA=1` en Fly solo con clave de pago (o Vertex con contrato). La foto nunca se guarda. |
| Geocodificación | Norma de uso de Nominatim | 1 petición/s con User-Agent propio. Si el volumen crece (muchas empresas), hay que pasar a un servicio propio o de pago: Nominatim público no admite uso masivo. |
| Mapa | Norma de uso de teselas de OSM | Válido para poco uso con atribución (puesta). Con muchos clientes, proveedor de teselas propio. La web del panel pide teselas a OSM: mencionarlo en la política de privacidad (IP del usuario). |
| Sistemas de terceros | Lo que pasó con Amazon (24-09) | Nada se lee de sistemas ajenos: ni de la caja del súper ni de la app de Disgón. Solo lo que la empresa mete, pega o escanea de sus propias cajas. Integrar con su TPV/ERP solo con su autorización y su API. |
| Ruta por tiempo | Norma de uso de FOSSGIS | Matriz de tiempos por carretera del servidor de rutas de OpenStreetMap (FOSSGIS, UE): solo coordenadas, 1 petición/s, identificados, atribución y enlace «corregir el mapa» bajo el mapa. Tráfico: **típico por hora** (estimación, se dice así), no en vivo; el tráfico real solo lo dan servicios de pago (TomTom, HERE, Google) con clave. Si el volumen crece: OSRM propio (`REPARTO_RUTAS_URL`). |
| Enlace de seguimiento del cliente | RGPD art. 5.1.c y 25 | `/s/<token>`: estado, hora estimada, paradas antes y franja. Sin nombre, dirección, teléfono, contenido ni ubicación del repartidor (lo prueba `test_seguimiento_del_cliente_sin_datos_personales`). Token de 128 bits, caduca al día siguiente, `Disallow: /s/` y `noindex`. |
| Prueba de entrega (foto) | RGPD art. 5.1.c, 6.1.b | Foto pequeña (640 px, ~50 KB) del paquete donde se deja, guardada en el propio pedido en la base de la empresa (no en el R2 público), nunca en la lista ni en «mi ruta» (se pide una a una), y se borra con el resto de datos personales. La pantalla pide «sin personas en la foto». Es la práctica estándar del sector (Routific, Onfleet). |
| Cobro a la entrega | — | Importe a cobrar y método (efectivo, tarjeta, Bizum): no se guarda ningún dato de pago, solo cómo pagó y cuánto. |
| WhatsApp/llamar al cliente | RGPD art. 6.1.b | Desde el móvil del repartidor y para la entrega (ejecución del contrato del cliente con la empresa). WhatsApp solo con móviles; el mensaje es fijo y neutro. |
| Marcas | Ley de Marcas | Ni «Amazon» ni nombres de otras apps de rutas en pantalla (`check-marca`). |
| Llamar al cliente | — | «Llamar» usa el teléfono del conductor, que el cliente verá. Si hace falta ocultarlo, llamadas enmascaradas (no hecho). |

### Hecho el 03-10 (noche)
- Ruta por TIEMPO (`reparto.optimiza_por_tiempo`): matriz por carretera, tráfico típico por hora,
  minutos por parada y por bulto, franjas del cliente (columna «horario» o nota que hable de
  horas; «portal 5-7» no cuenta), urgentes, hora de salida, volver al almacén; hora estimada
  de cada parada y aviso de «llegará tarde».
- Autónomo (`sector: autonomo`): es su propio repartidor; «Mi ruta» dentro de su panel; foto
  de la etiqueta; llamar y WhatsApp en cada parada; demo propia y aislada por visitante.
- Panel por sector: inicio de reparto, «Tiendas/Almacenes», «Repartidores», sin cierres de
  turno ni ejemplos de paquetería; avisos en vivo solo de los módulos que tiene la empresa.
- Nada de una empresa en otra: lo guardado en el navegador se borra al cambiar de sesión
  (`aislarSesion`). Lo destapó la demo enseñando avisos de OGA5 de la sesión anterior.
- Seguimiento para el cliente, cobro a la entrega, recogidas y «reintentar mañana».

### Hecho el 03-10 (tarde)
- Contrato de encargo publicado y aceptado en el alta; política de privacidad
  corregida (decía «no tratamos geolocalización en tiempo real», ya falso) y
  con el reparto; OpenStreetMap en la lista de subencargados.
- Foto del ticket leída en el móvil, sin IA externa.

### Pendiente que decide Dani
- Datos de la empresa (razón social, CIF, domicilio) para las páginas legales,
  cuando se constituya. El correo ya está (contacto@flotadsp.com).
- Clave de Gemini de pago antes de encender la IA de tickets.
- Probar con Gadis gratis: activar a mano `status: active` en su organización.
