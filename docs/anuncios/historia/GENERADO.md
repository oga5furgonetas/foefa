# «¿Y Manolo?» — lo generado y montado con IA (11-11-2026)

**Resultado:** `salida/spot-manolo-9x16.mp4` (21,6 s, 1080×1920, 7 MB). Se rehace con `bash scripts/montar-spot-manolo.sh`.

Es la SEGUNDA versión. La primera (17 s: encargado hablando a cámara, la app pegada con los rótulos de otro anuncio, sin
música) no le gustó a Dani («muy mejorable… bastante lamentable») y se rehízo con su «b»: una sola protagonista, voz en
off, la app dentro del plano, música y los planos igualados.

## Qué lleva

| Seg. | Plano | Voz en off | De dónde sale |
|---|---|---|---|
| 0–4,1 | Lucía, de espaldas, ante la furgoneta llena | «Segunda semana en la nave. Y hoy me dan la zona de Manolo.» | `planos/5-nave.mp4` |
| 4,1–6,0 | Sus manos con la libreta de garabatos | «La que solo se sabe Manolo.» | `planos/6-libreta.mp4` |
| 6,0–7,3 | Lucía escanea una caja | «Escaneo los paquetes…» | `planos/7-escaneo.mp4` |
| 7,3–10,3 | La app real (escanear, «Añadida a tu ruta», ruta ordenada) sobre su plano desenfocado, con tres bips | «…y la ruta se ordena sola.» | `../super-anuncio/salida/spot-ruta-9x16-B.mp4`, recortada con `../super-anuncio/capas/marco-fondo.png` |
| 10,3–12,1 | La señora asoma por la puerta | «En cada puerta, la misma pregunta:» | `planos/2-senora.mp4` (sin su audio) |
| 12,1–14,0 | El perro ladra | «¿Y Manolo?» | `planos/3-perro.mp4` (con su ladrido) |
| 14,0–18,4 | Lucía cierra la furgoneta y llama; al final, el lema | «Manolo… ya he acabado.» | `planos/4-lucia.mp4` (solo el golpe de la puerta) |
| 18,4–21,6 | Tarjeta de cierre B | «FDS. Mañana sales con la ruta hecha.» | `../super-anuncio/capas/cierre-B.png` |

- **Lucía es la misma en todos**: se sacó un fotograma del plano del teléfono (`imagenes/lucia-referencia.jpg`), con él
  se hicieron tres imágenes (`imagenes/lucia-1..3.jpg`, Nano Banana Pro) y esas se animaron (Veo 3.1 Fast, sin audio).
- **Voz**: `voz/l1..l6.mp3`, con edge-tts (gratis, acento de España): `es-ES-ElviraNeural` para Lucía y
  `es-ES-AlvaroNeural` para la marca. En Artlist no hay ninguna voz de España. `planos/1-encargado.mp4` ya no se usa.
- **Música**: `musica-lyria.mp3`, generada con Lyria 3 (instrumental). La del catálogo de Artlist sale con marca de
  agua con el plan «AI Suite» (no incluye música), así que no vale.
- **Acabado común**: contraste, viñeta y grano en todos los planos; el del perro, templado.

## Gasto en Artlist (plan «AI Suite 16500», renueva el 29-11)

| Qué | Créditos |
|---|---|
| Versión 1: cuatro planos con voz, Veo 3.1 Fast (aprobado por Dani) | 3.600 |
| Tres imágenes de Lucía, Nano Banana Pro | 480 |
| Tres planos animados, Veo 3.1 Fast sin audio (aprobado por Dani) | 1.500 |
| Música, Lyria 3 | 150 |
| **Total** | **5.730** |

Quedaban 8.490 al empezar; quedan unos 2.760. Todo está en la carpeta «FDS Manolo» de Artlist.

## Lo que NO se ha podido comprobar desde la sesión

- **El sonido no se ha escuchado**: ni la voz (entonación, la pausa de «FDS.»), ni la música, ni la mezcla. Solo se ha
  medido el nivel (−15,5 LUFS). Lo tiene que oír Dani.
- **La boca de Lucía** en el plano del teléfono se mueve con la frase que generó Veo, y encima va la voz de Elvira: puede
  no casar del todo.
- La app sigue saliendo de un anuncio ya montado (sin sus rótulos): la fecha y los datos son los de aquella grabación.

## Red de la sesión de nube

El entorno personal «foefa» (asociado a este repo) permite: `mcp.artlist.io`, `cms-toolkit-artifacts.artlist.io`,
`artlist-prod-ai-toolkit-custom-user-uploads.s3.eu-central-1.amazonaws.com` (subir referencias) y
`speech.platform.bing.com` (edge-tts, con `--proxy "$HTTPS_PROXY"` y `SSL_CERT_FILE=/root/.ccr/ca-bundle.crt`).

## Versión en inglés: «Where's Tony?» (11-11-2026, noche)

Dani, tras ver la versión 2 en español: «¿puedes ponerle voz que no sea IA, o tan sintetizada? Haz el vídeo en inglés,
que deberías tener más margen».

**Resultado:** `salida/spot-tony-en-9x16.mp4` (24,7 s, 1080×1920, 7 MB). Se rehace con `bash scripts/montar-spot-manolo-en.sh`.

- **Voz**: `voz-en/l1..l6.mp3`, de Artlist (Eleven v3), mucho menos sintética que las de edge-tts: «Zara – The Warm,
  Real-World Conversationalist» (americana, joven) para Lucía y «Mark – Natural Conversations» para la marca. 54 créditos.
  Sigue siendo voz generada: una voz que no sea IA solo sale grabando a una persona.
- **Manolo pasa a ser Tony** («Where's Tony?»): un nombre que se entiende igual en Reino Unido y en EE. UU.
- **El final cambia**: Lucía ya no dice la frase a cámara (su boca se movía con la frase en español); lo cuenta la voz:
  «By the time Tony called to check on me… I was done.» Así no hay nada que sincronizar.
- **La app, grabada en inglés** con `SPOT_LOCALE=en npx playwright test spot-ruta` (fotogramas en `app-en/`): la cámara
  leyendo la etiqueta y la ruta ordenada con la hora de cada parada («Route sorted by time: 15 stops, you finish ≈ 11:13»),
  dentro de un móvil sobre el plano de Lucía desenfocado. Se dejaron fuera los fotogramas con el aviso «Earn €10 per
  colleague» (promoción con fecha). La etiqueta del paquete sigue en español («ENVÍO ESTÁNDAR»): es la de la prueba.
- **Lema y tarjeta** en inglés: `../internacional/capas/en/manana.png` y `cierre-B.png`.
- La grabación de Playwright falló al final (paso de «Empezar a navegar», línea 356 de `spot-ruta.spec.js` en inglés),
  después de haber grabado lo que hacía falta; no se ha investigado. En la nube hay que enlazar el navegador instalado a
  la versión que pide el proyecto (`ln -sfn /opt/pw-browsers/chromium_headless_shell-1243 …-1234`).

Texto: «Second week on the job. And today, they hand me Tony's route. · The one only Tony knows. · So I scan the
parcels… and the route sorts itself. · At every door, the same question: where's Tony? · By the time Tony called to check
on me… I was done. · FDS. Tomorrow, you leave with the route done.»

Gasto total en Artlist con esto: 5.784 créditos; quedan unos 2.700. El sonido sigue sin haberse podido escuchar.
