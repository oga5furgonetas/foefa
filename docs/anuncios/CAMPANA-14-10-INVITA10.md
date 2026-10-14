# Anuncio Meta «Invita y gana 10 €» (14-10-2026)

Lo pidió Dani el 14-10: un anuncio de Facebook con muchas conversiones, la app de reparto con las
mejoras, y **10 € por cada amigo que inviten y empiece a usarla**, retirables, como promoción hasta el
**31-10-2026**. En la app: el premio es 10 € por cada invitado que se registre hasta el 31-10 (incluido,
hora de España) y haga 20 entregas reales en 2 días distintos; el mínimo de retirada sube a **60 €** y
no se enseña hasta que intentan cobrar (en las condiciones sí consta). Dani pulsa Publicar: el panel me
bloquea lo que gasta, y la cuenta sigue restringida por el pago fallido.

## Dónde va

En la campaña que ya convertía, **«FDS Registros — Gratis 15 paradas»** (objetivo registros con el
píxel, evento CompleteRegistration; ~1,9 € por alta el 10-10). Un anuncio nuevo en su conjunto, igual
que se hizo con «Lanzamiento + gana 5 €». Si Dani quiere Latinoamérica, un conjunto aparte con los mismos
anuncios y países MX, CO, AR, CL, PE (allí se cobra por PayPal: cambiar «Bizum» por «PayPal» en el texto).

## Creatividades (hechas)

- Vídeo 9:16 (Reels, Stories): `docs/anuncios/reales/salida/meta/FDS-directo-gana10-9x16.mp4` (25,6 s)
  y la variante `FDS-pov-gana10-9x16.mp4`.
- Vídeo 4:5 (feed): `FDS-directo-gana10-4x5.mp4` y `FDS-pov-gana10-4x5.mp4`.
- Imagen de la tarjeta (para un anuncio de imagen o una historia): `docs/anuncios/tiktok-fotos/gana10-9x16.png`.
- Se montan con `cd frontend && node ../scripts/anuncio-gana10.mjs` (corta la tarjeta «2,50 €» de los
  vídeos del 11-10 y pega la nueva). Al subirlos a Meta, URL con `?v=3` si coge el vídeo viejo de la caché.

## Textos (versión «la app primero», 14-10 tarde: Dani quiere que se entienda qué es y qué hace)

**Texto principal (ES):**

> 🚚 ¿Repartes paquetes? Hay una app nueva que te hace solo el trabajo pesado del día.
>
> FDS ordena tu ruta sola:
> 📸 Foto a la etiqueta o escanea el paquete: la dirección y el teléfono entran solos.
> 🗺️ Todas tus paradas ordenadas por tiempo, con el tráfico de cada hora. Sin tope de paradas.
> 🔊 Te guía con voz hasta cada puerta y, en Android, manos libres: dices «entregado» y sigues.
> 📋 ¿Te dan la ruta en una hoja? Una foto y entran todas las paradas.
> 💶 Cuánto llevas ganado hoy y lo que se va en gasolina.
>
> Gratis y sin límite hasta el 31 de diciembre. Sin tarjeta. Pruébala sin registrarte en 1 minuto.
>
> 🎁 Y hasta el 31 de octubre: GANA 10 € por cada compañero que invites y la use (20 entregas en 2 días).
> Lo cobras por Bizum o transferencia.

**Titular:** Tu ruta ordenada sola · Gana 10 € por invitar
**Descripción:** Gratis y sin límite hasta el 31-12 · sin tarjeta · promo 10 € hasta el 31-10
**Enlace visible:** flotadsp.com/repartidores · **Botón:** Registrarte (o «Ver detalles»)
**URL:** `https://flotadsp.com/repartidores?utm_source=facebook&utm_medium=cpc&utm_campaign=rep_invita10&utm_content=gana10`

Imagen con las funciones (segundo anuncio o historia): `docs/anuncios/tiktok-fotos/funciones-4x5.png` y
`funciones-9x16.png` (`cd frontend && node ../scripts/anuncio-funciones.mjs`). Las zonas de carga no
se anuncian: en España salen pocas y no está comprobado contra Overpass real.

**Latinoamérica (si se abre el conjunto):** igual, con «Lo cobras por PayPal», «celular» y «toma una foto».

## Qué NO dice y por qué

- No dice el mínimo de retirada (60 €): lo pidió Dani; está en las condiciones (Terminos 5 bis) y la app lo
  dice al pulsar «Cobrar». No decir en el anuncio una condición esencial es arriesgado ante una reclamación;
  queda avisado.
- No dice cifras de usuarios ni testimonios: no hay.
- Lleva las condiciones del premio (20 entregas en 2 días) en el propio texto: es lo que hace que «10 €»
  no sea engañoso.

## Pasos en el Administrador de anuncios (Dani o yo con su Chrome)

1. Campañas → «FDS Registros — Gratis 15 paradas» → conjunto → **Crear anuncio**.
2. Nombre: «FDS — Invita y gana 10 € (promo 31-10)». Identidad: página **FDs**.
3. Formato: un solo vídeo. Subir `FDS-directo-gana10-9x16.mp4`; en «Recortar» poner el 4:5 para feed.
4. Textos de arriba, botón «Registrarte», URL de arriba. Seguimiento: píxel FDS.
5. Publicar. Al segundo anuncio (`pov`) igual, con «Texto principal» corto.
6. Cuando la cuenta vuelva a estar activa: 15 €/día es poco para medir en 2 semanas; 30-50 €/día lo
   decide Dani.

## Medir

`tools/metricas/origen_altas.py` y `embudo_canal.py`: canal `facebook:gana10`. Y en el panel, Negocio →
Retiradas de la cartera, para ver invitados, cualificados y saldos.
