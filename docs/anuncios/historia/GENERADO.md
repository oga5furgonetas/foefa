# «¿Y Manolo?» — lo generado y montado con IA (11-11-2026)

Dani: «Hazlo con IA» y, al ver el coste, «sí». Corte corto del guion (`GUION.md` §4), en vertical.

**Resultado:** `salida/spot-manolo-9x16.mp4` (17,0 s, 1080×1920). Se rehace con `bash scripts/montar-spot-manolo.sh`.

## Qué lleva

| Seg. | Plano | De dónde sale |
|---|---|---|
| 0–3,4 | El encargado: «Lucía. Hoy llevas la zona de Manolo.» | `planos/1-encargado.mp4` (IA, con su voz) |
| 3,4–6,8 | La app: escanear y la ruta ordenada, con tres bips | `../super-anuncio/salida/spot-ruta-9x16-B.mp4` (grabación real) |
| 6,8–8,6 | La señora: «¿Y Manolo?» | `planos/2-senora.mp4` (IA, con su voz) |
| 8,6–10,5 | El perro ladra, subtítulo «¿Y Manolo?» | `planos/3-perro.mp4` (IA) |
| 10,5–14,5 | Lucía al teléfono: «Manolo… ya he acabado.» y el lema encima | `planos/4-lucia.mp4` (IA, con su voz) |
| 14,5–17 | Tarjeta de cierre B («Toca el botón de abajo») | `../super-anuncio/capas/cierre-B.png` |

## Gasto en Artlist

3.600 créditos (aprobados por Dani): cuatro planos con Veo 3.1 Fast, 9:16, 1080p, con audio (800 + 800 + 800 por los de
4 s y 1.200 por el de 6 s). Quedaban 8.490 antes; el plan renueva el 29-11. Carpeta «FDS Manolo» en Artlist.
Generaciones: `01a1cbe1-8927-74a4-9921-8af524dfceff` (encargado), `01a1cbe1-896e-7275-aff4-d445ccf28cd3` (señora),
`01a1cbe1-8926-7582-b763-688cf4874f06` (perro), `01a1cbe1-89af-7090-b40b-9a8affcb68f9` (Lucía). Los prompts están en
el historial de Artlist de cada una.

## Lo que NO se ha podido comprobar desde la sesión

- **El sonido no se ha escuchado.** Los planos se han revisado fotograma a fotograma (sin letras ni logotipos, caras y
  manos bien), pero las voces las tiene que oír Dani: puede que el acento no sea de España o que la frase no sea
  exactamente la del subtítulo. Repetir un plano de 4 s son 800 créditos.
- **Sin música ni locución de marca.** La voz de siempre (Puck) necesita la clave de Gemini, que la sesión de la nube no
  tiene. El cierre va con rótulo y en silencio.
- **La furgoneta vacía casi no se ve**: el plano de Lucía se corta en 0,6 s para que el anuncio no pase de 17 s.
- La réplica de Manolo por teléfono («…¿Cómo que has acabado?») no está: en Artlist no hay voz masculina de España.

## Para descargar de Artlist desde la nube

La red de la sesión bloqueaba `mcp.artlist.io` y `cms-toolkit-artifacts.artlist.io`. Se creó el entorno personal
«foefa» (solo esos dos hosts, asociado a este repo): una sesión nueva sobre ese entorno ya puede descargar.
