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
| Marcas | Ley de Marcas | Ni «Amazon» ni nombres de otras apps de rutas en pantalla (`check-marca`). |
| Llamar al cliente | — | «Llamar» usa el teléfono del conductor, que el cliente verá. Si hace falta ocultarlo, llamadas enmascaradas (no hecho). |

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
