# FDS · vídeo para Artlist con QR a Google Play (29-10-2026)

Un anuncio para quien reparte paquetes por su cuenta. Montado en Artlist (clips + música + efectos con licencia) y
con las pantallas REALES de la app. Termina en un QR que abre la ficha de Google Play. Nada de «gratis hasta el
31 de diciembre», nada de cifras inventadas, nada que la app no haga hoy.

Ficheros de esta carpeta: `qr-play-fds.png` (1 024 px, listo para el vídeo) y `qr-play-fds.svg` (vectorial, para
imprimir en la furgoneta, el almacén o un flyer). Los dos abren:
`https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dqr%26utm_medium%3Dvideo%26utm_campaign%3Dartlist_fds`
(el `referrer` hace que en Play Console → Adquisición se vea cuántas instalaciones vienen del QR del vídeo).

---

## 1. A quién le hablamos y qué le duele

- **Quién**: reparte paquetes por su cuenta o para un intermediario (Amazon Flex, Glovo/Uber paquetes, mensajerías
  locales, Mercado Libre Flex en Latinoamérica). Cobra por paquete o por bloque: cada minuto perdido ordenando la ruta
  es dinero que no cobra.
- **Qué le duele** (lo que dicen en los grupos de Facebook y en las encuestas del 17-10): ordenar la ruta a ojo cada
  mañana, apuntar direcciones a mano, perder cobertura en garajes y naves, y acabar tarde.
- **Qué le da FDS, y es verdad**: foto o escaneo a la etiqueta y la dirección entra sola; la ruta se ordena por tiempo
  con el tráfico; te lleva con Google Maps o Waze parada a parada; funciona sin cobertura; entregado en un toque.
- **Oferta** (sin fecha): gratis, sin tarjeta. Punto. El plan sin tope existe, pero el anuncio no vende plan: vende
  «mañana sales con la ruta hecha».

Mercado: en TikTok/Reels el que reparte ve el vídeo con el móvil en la mano, **de pie, en 3 segundos decide**. El
hook va antes que el logo. El QR solo sirve donde se ve desde OTRO dispositivo (pantalla de la nave, cartel en la
furgoneta, YouTube en el ordenador, un flyer); en el feed del móvil el QR es decorativo y lo que convierte es el
enlace o la ficha de Play. Por eso hay dos cierres (§5).

## 2. La idea en una frase

**«Mañana sales con la ruta hecha.»** Todo el vídeo enseña el ANTES (caos, libreta, hora) y el DESPUÉS (foto,
ruta ordenada, primera parada) en el mismo tiempo que tarda un semáforo.

## 3. Guion principal · 30 s · vertical 9:16 (TikTok, Reels, Shorts; también pantalla de nave)

Voz en off cercana, de alguien del sector, sin tono de locutor. Subtítulos grandes SIEMPRE (el 80 % lo ve sin sonido).

| Tiempo | Imagen (Artlist / pantalla real) | Texto en pantalla | Voz en off | Sonido |
|---|---|---|---|---|
| 0-2 s | Primer plano de un maletero lleno de paquetes, mano que coge una libreta arrugada. Corte seco. | **112 paquetes.** | «Ciento doce paquetes.» | Un golpe de caja al cerrar (SFX). Sin música aún. |
| 2-4 s | La misma mano pasando el dedo por la libreta; reloj del salpicadero: 07:41. | **¿Por dónde empiezas?** | «¿Por dónde empiezas?» | Entra la música: pulso seco, 100-110 bpm. |
| 4-7 s | PANTALLA REAL: la app en «Hoy» vacía → se pulsa **Escanear**. | Foto a la etiqueta. | «Foto a la etiqueta.» | *Bip* del escáner (el de la app). |
| 7-11 s | PANTALLA REAL: tres etiquetas seguidas; abajo sube «3 añadidas». La dirección entra sola. | **La dirección entra sola.** | «La dirección entra sola. Tres, diez, cuarenta… las que lleves.» | Tres *bips* en ritmo con la música. |
| 11-15 s | PANTALLA REAL: «Ordenar ruta» → la lista se reordena y aparece «Acabas ≈ 14:20 · 38 km». | **La ruta se ordena por tiempo, con el tráfico.** | «Pulsas ordenar y la ruta se hace por tiempo, con el tráfico de tu zona.» | Subida de la música (drop suave). |
| 15-19 s | Plano real: móvil en el soporte del salpicadero, Google Maps abierto desde la app, la furgoneta arranca. | **Te lleva parada a parada.** | «Y te lleva parada a parada, con Google Maps o Waze.» | Intermitente (SFX) muy bajo. |
| 19-23 s | Plano real: garaje subterráneo, el móvil sin cobertura (icono) y la app sigue; se pulsa **Entregado**. | **Funciona sin cobertura.** | «En un garaje sin cobertura, sigue funcionando: lo que entregas se envía solo al volver la red.» | *Clic* de entregado + vibración (SFX corto). |
| 23-26 s | Plano real: el mismo maletero, ahora vacío; mano cerrando el portón; cielo de tarde. | **Mañana sales con la ruta hecha.** | «Mañana sales con la ruta hecha.» | La música se abre. |
| 26-30 s | **Tarjeta final** (§5): logo FDS, QR grande, distintivo de Google Play, URL corta. | **FDS · Gratis. Sin tarjeta.** / Escanea y descárgala | «FDS. Gratis y sin tarjeta. Escanea y descárgala.» | Cierre de la música en seco con el *bip* del escáner. |

Reglas del montaje:
- Cortes cada 1-2 s hasta el segundo 11; después planos de 3-4 s para que se lea la pantalla.
- Las pantallas de la app van **grabadas del móvil de verdad** (ajustes del móvil → grabar pantalla), con la cuenta
  de pruebas (`app-android/pruebas/servidor_pruebas.py`: cuatro paradas en A Coruña, sin datos de clientes reales).
  Si se usa una ruta real: tapar nombres y direcciones.
- Tipografía gruesa, blanca con sombra, en el tercio central (TikTok tapa arriba y abajo).
- Nada de marcas ajenas en plano (ni logotipos de Amazon en la furgoneta ni en los paquetes): se giran o se tapan.

## 4. Qué buscar en Artlist

**Clips (Footage)**, en vertical o recortables a 9:16:
- `delivery van packages trunk close up` · `courier hands notebook addresses` · `van dashboard clock morning`
- `delivery driver phone mount navigation` · `underground parking garage driving pov` · `courier handing parcel
  door` · `empty van trunk closing sunset`
- Evitar clips con uniformes o furgonetas de marcas reconocibles.

**Música**: buscar `driving percussive minimal 105 bpm` o `urban hip hop instrumental confident`; sin voces. Que tenga
un *drop* o cambio limpio entre el segundo 10 y el 15 (ahí cae «la ruta se ordena»). Mood: *determined*, *focused*;
descartar *epic* y *corporate*.

**Efectos (SFX)**: `cardboard box close` · `barcode scanner beep` (o el *bip* real de la app, mejor) · `car turn
signal` · `phone notification click` · `van door slam`.

**Voz**: si Dani la graba pegado al micro, gana (ver `../reales/GUIONES.md`). Si se usa voz generada, una voz
masculina o femenina de 30-40 años, acento neutro de España; en la versión para Latinoamérica, mexicano neutro.

## 5. La tarjeta final (26-30 s) y las dos salidas

**Composición** (1080×1920): fondo liso (el oscuro de la app), logo FDS arriba, QR centrado de **al menos 480 px de
lado** (un 45 % del ancho), debajo el distintivo oficial de Google Play (el que ya usa la web, `frontend/src/`) y la
URL corta en grande: **flotadsp.com/app**. Texto: «FDS · Gratis. Sin tarjeta.» y «Escanea y descárgala».

Reglas del QR (si no se cumplen, no se lee en una pantalla):
- Zona blanca alrededor: el PNG ya la lleva (4 módulos). No recortarla ni poner el QR sobre foto.
- Quieto en pantalla **4 segundos como mínimo**; sin animación encima, sin degradados, sin logo dentro.
- Negro sobre blanco. Nada de QR en color de marca.
- Prueba obligatoria: exportar a 1080p, ponerlo en una tele o un monitor y escanearlo con dos móviles distintos
  desde 2 metros. Si no entra a la primera, agrandar.
- El QR lleva `utm_campaign=artlist_fds`: en Play Console → Estadísticas → Adquisición se ve cuántos instalan desde él.

**Salida A (con QR)**: para pantallas de nave, YouTube en escritorio, cartel en la furgoneta, flyer y Spotify
Video. La voz dice «Escanea y descárgala».

**Salida B (sin QR)**: para TikTok, Reels y Shorts en el móvil. Misma tarjeta pero el QR se sustituye por el
distintivo de Google Play a lo grande y la frase «Búscala en Google Play: FDS» + «flotadsp.com/app». La voz dice
«Descárgala en Google Play». Y el enlace del anuncio apunta a la ficha de Play (en Meta, botón «Instalar»).

iPhone: la URL corta vale para ambos (abre la app web en iPhone); el QR es solo Android, y se dice en el flyer.

## 6. Versiones cortas

**15 s (Reels / bumper largo)**: 0-2 «112 paquetes. ¿Por dónde empiezas?» → 2-6 foto a la etiqueta, «la dirección
entra sola» → 6-10 «Ordenar ruta», «por tiempo, con el tráfico» → 10-12 móvil en el soporte, «te lleva parada a
parada» → 12-15 tarjeta final.

**6 s (bumper YouTube, no saltable)**: 0-2 libreta + «¿Por dónde empiezas?» → 2-4 foto a la etiqueta → ruta ordenada
→ 4-6 «FDS. Gratis.» + distintivo de Play (sin QR: en 2 s no se escanea).

## 7. Tres ganchos para probar (se cambia solo el 0-4 s)

1. **Número**: «112 paquetes. ¿Por dónde empiezas?» (el de arriba).
2. **Hora**: reloj 07:41 → «A esta hora ya tendrías que estar en la primera parada.»
3. **Confesión**: Dani a cámara, un segundo: «Yo ordenaba la ruta en una libreta. Hice esta app para no hacerlo
   más.» (el que más confianza da: ver `../reales/GUIONES.md`).

Se lanzan los tres con el mismo cuerpo y se deja el que más retención tenga a los 3 s y más instalaciones a
7 días. No se decide por «me gusta».

## 8. Versión Latinoamérica (misma estructura)

- «112 paquetes» → «112 paquetes de Mercado Libre Flex» NO: no nombrar la marca. Mejor «112 paquetes. ¿Por dónde
  empiezas?» tal cual, y el plano de la furgoneta cambia por moto o coche, que es lo habitual.
- «Google Maps o Waze» se mantiene (es lo que usan). «Gratis. Sin tarjeta.» se mantiene.
- Voz y subtítulos en español neutro; en Brasil, portugués (la app ya está en 7 idiomas).
- El mismo QR vale: la ficha de Play está localizada por país.

## 9. Lo que no se hace

- No se promete nada que la app no haga hoy. Si una etiqueta no se lee, la escribes tú: se puede decir, y da confianza.
- Sin cifras de usuarios, estrellas ni testimonios que no existan.
- Sin «gratis hasta el 31 de diciembre» ni ninguna fecha: caduca el vídeo y cansa.
- Sin caras ni matrículas de nadie sin permiso; sin logotipos de terceros.
- Sin música bajada de YouTube: todo con licencia de Artlist (guardar el certificado de licencia junto al vídeo).

## 10. Antes de publicar (lista)

- [ ] Pantallas reales grabadas con la cuenta de pruebas; nada de datos de clientes.
- [ ] Subtítulos quemados y revisados (sin faltas; «parada a parada», no «parada por parada»).
- [ ] QR probado desde 2 metros en una pantalla con dos móviles.
- [ ] Tarjeta final 4 s mínimo; distintivo de Google Play oficial sin deformar.
- [ ] Dos salidas exportadas (con QR / sin QR) en 9:16; la de 16:9 para YouTube y pantallas de nave.
- [ ] Enlace del anuncio = ficha de Play; en Play Console, mirar «Adquisición» a los 7 días.
