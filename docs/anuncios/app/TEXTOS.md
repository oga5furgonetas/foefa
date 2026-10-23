# Anuncios con la app de verdad (23-10-2026)

Imágenes (`scripts/anuncio-app.mjs`): cuatro tarjetas con capturas reales de la app, en 4:5 (feed), 9:16
(historias/reels) y 1:1. Vídeo: `../reales/salida/spot-v3-{9x16,4x5,1x1}.mp4` (36 s, `scripts/montar-spot-v3.mjs`).
Todo lo que dicen lo hace la app hoy; la oferta sale de `lib/precios.js` (gratis y sin límite hasta el 31-12).

URL de destino: `https://flotadsp.com/app?utm_source=facebook&utm_content=app_<tarjeta>` (una por tarjeta, para
saber cuál trae altas; TikTok con `utm_source=tiktok`).

## Texto principal (Meta / Instagram)
**Corto (recomendado):**
> ¿Repartes paquetes y todavía ordenas la ruta a mano? Con FDS haces una foto a la etiqueta, la ruta se ordena
> sola y te lleva con voz hasta cada puerta. Gratis y sin límite hasta el 31 de diciembre, sin tarjeta.
> Android e iPhone.

**Largo:**
> 📦 Para quien reparte: FDS, la app de reparto gratis.
> 📸 Foto a la etiqueta: la dirección y el teléfono entran solos.
> 🗺️ La ruta se ordena sola, por tiempo y con el tráfico.
> 🔊 Te lleva con voz hasta cada puerta (y en Android, manos libres).
> ✅ Entregado en un toque: dónde lo dejas, quién lo recoge y su firma.
> Gratis y sin límite hasta el 31 de diciembre · sin tarjeta · Android e iPhone.

Titular: «La app de reparto gratis» · Descripción: «La ruta se ordena sola» · Botón: «Más información» o
«Registrarte».

## Por tarjeta
1. `1-ruta-sola`: titular «La ruta se ordena sola».
2. `2-voz`: «Te lleva con voz hasta cada puerta».
3. `3-mapa`: «Tus paradas, en el mapa».
4. `4-entregado`: «Entregado en un toque».

## Vídeo (spot v3)
Guion en `../reales/spot-v3/guion.txt`. Voz neuronal (Ximena); si Dani graba las 5 frases como `s1..s5.mp3` en
`docs/anuncios/reales/spot-v3/`, `scripts/spot-v3/voz.py` las usa y se vuelve a montar.
