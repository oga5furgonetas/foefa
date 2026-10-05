# Anuncios REALES para FDS (05-10-2026)

Lo que genera confianza es una persona de verdad, con su voz, su furgoneta y su móvil.
Nada de actores generados, testimonios inventados ni cifras que la app no cumpla.
Se graba con un móvil, en vertical, sin necesidad de equipo.

## Cómo se monta (lo hace Claude)
1. Pasa el vídeo grabado (o dime la ruta). Si puedes, escribe lo que se dice en un `.srt` con el mismo nombre;
   si no, me dices las frases y yo hago los subtítulos.
2. `node scripts/montar-anuncio-real.mjs <video.mp4> [subtitulos.srt]`
   → `docs/anuncios/reales/salida/<nombre>-9x16.mp4` (TikTok/Reels), `-4x5.mp4` (Facebook feed), `-1x1.mp4`.
   Sonido normalizado, subtítulos grandes, tarjeta final «7 días gratis · sin tarjeta · flotadsp.com/repartidores».
3. Se suben a TikTok y a Meta. Publicar lo pulsa Dani.

## Reglas para que se vea de verdad
- Vertical, móvil a 1080p, luz de día (junto a la ventanilla o fuera), micro cerca (auriculares con micro sirven).
- Sin música con derechos. Ruido ambiente de la furgoneta: bien, da realismo.
- Que hable quien de verdad usa la app y diga SOLO lo que piensa. Si no lo usa, no se hace «testimonio».
- Permiso por escrito/mensaje de quien aparece (y de a quien se vea la cara).
- Decir que es la app propia cuando habla Dani. Admitir un fallo («si no lee una etiqueta, la escribes tú») genera más confianza que prometerlo todo.

## Guion A · Dani a cámara (30-35 s)  ← el que más confianza da
Plano: Dani en la furgoneta o junto a ella, móvil en la mano, hablando a cámara.
1. (0-4 s) «Llevo años en el reparto y lo que más tiempo me quitaba era ordenar la ruta cada mañana.»
2. (4-9 s) «Por eso hice una app: le haces foto a la etiqueta, la dirección entra sola y ordena las paradas.» (enseña el móvil)
3. (9-16 s) PANTALLA REAL del móvil de Dani: foto de una etiqueta → ruta ordenada → «Empezar a navegar». (grabación de pantalla del móvil, sin editar datos de clientes: tapar nombres/direcciones reales)
4. (16-23 s) «Te guía por voz hasta cada puerta. Si alguna etiqueta no la lee, la escribes tú: no es magia.»
5. (23-30 s) «Es mía, así que soy parte interesada, jaja. Pruébala 7 días gratis, sin tarjeta, y dime qué le falta.»

## Guion B · Un repartidor en ruta (20-25 s)  ← solo si de verdad la usa
Plano: móvil en el soporte del salpicadero y manos al volante; al final, sonríe a cámara.
1. «Antes ordenaba la ruta a mano. Ahora hago foto a la etiqueta y ya está.»
2. (pantalla del móvil mientras reparte) «Me va diciendo por voz a dónde ir.»
3. «Lo mejor: no pierdo la mañana. Lo peor: [lo que de verdad piense].»
4. «Si repartes, pruébala: son 7 días gratis.»

## Guion C · Solo manos y pantalla + voz de Dani (15-20 s)
Plano: manos sosteniendo el móvil sobre cajas/paquetes (sin cara), foto a una etiqueta, ruta ordenándose.
Voz en off (grabada pegado al micro, tono normal, sin «locutor»):
«Cuarenta paquetes, una libreta… y la ruta a ojo. Así lo hacía. Ahora: foto a la etiqueta, la app ordena las paradas y te guía por voz. Siete días gratis, sin tarjeta.»

## Qué NO hacer
- No descargar anuncios de YouTube ni de otras marcas para reutilizarlos: tienen derechos.
- No inventar «+10.000 repartidores», estrellas, ni reseñas. Hoy hay muy pocos usuarios: decirlo con honestidad
  («acabamos de empezar, ayúdame a mejorarla») funciona mejor que aparentar una empresa gigante.
