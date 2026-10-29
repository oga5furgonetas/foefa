# Lo generado en Artlist para «La ruta hecha» (29-10-2026)

Dani conectó Artlist a la sesión y pidió que se mandaran los prompts directamente. Todo lo de aquí está en su cuenta
de Artlist (Toolkit → generaciones), con enlaces de descarga abajo. Desde este contenedor no se pueden descargar los
ficheros (la red de la sesión no deja salir a artlist.io ni a imgix.net), así que **nada de esto se ha podido ver ni
oír aquí**: hay que mirarlo en Artlist antes de montar. Plan: «AI Suite 16500», renueva el 29-11.

## Gasto

| Qué | Modelo | Créditos |
|---|---|---|
| Imagen de referencia (2 variantes, 9:16, 2K) | Nano Banana Pro | 320 |
| Locución de prueba (8 frases, español) | ElevenLabs Eleven v3, voz «Alberto Rodríguez» | 66 |
| 5 planos de vídeo (ver abajo) | Veo 3.1 (2 con referencia) + Veo 3.1 Fast (3) | 4.000 (pendiente de que Dani apruebe) |

Precios medidos para decidir: Veo 3.1 1080p, 4 s = 1.000 y 6 s = 1.500; Veo 3.1 Fast, 4 s = 500 y 6 s = 750;
Kling 2.5 Turbo Pro, 5 s = 750; Seedance 2.5 1080p, 6 s = 6.000 (descartado). Nano Banana Pro: 160 por imagen.

## Imagen de referencia (el repartidor y la furgoneta)

Generación `01a187b7-39b8-7e6f-b1ac-75deebe20505`, dos variantes (0 y 1). Para los planos con el repartidor se usa
la **variante 0** salvo que Dani, al verlas, prefiera la 1 (entonces se regeneran los planos 2 y 9 con la 1).
- Variante 0: https://mcp.artlist.io/mcp/download?u=https%3A%2F%2Fcms-toolkit-artifacts.artlist.io%2Fcontent%2F-t-e-x-t_-t-o_-i-m-a-g-e-v1%2Fmedia__3%2Fimage-3fb07057-a278-4967-818d-5824814cfee0.png%3FExpires%3D2108638326%26Key-Pair-Id%3DK2ZDLYDZI2R1DF%26Signature%3DHPofS8UDl7~oHKPQ8rO91eudjCBaALTRL-vqYUo~CrXiBzylMUj3ybB0jG3GTQsGcizl8kqB-hZjGKL6D~MGSgfpoKZYDMWWBadTLG4q-GiBgJp9fmMm74lNLIxPPlZ~3R4grMGAwzUD82uia7ebuHi8ouB5FifnqvKl3H0s7hkqeMM8E0geKnwzmNnodHBCdVNJsCZrnYdFtmV9X7B-243-8H2~Pjq3D0dvD7AeuTnv0SxXqKjKztpAf9nPVvQ8ttpDMeVLthI1PbiL3E0iE~SxixE-yCZwWjO1KHtuhM9j4wS152fSbJcYMdfSekOJWuIoA8LnpTJiJZKzipInWQ__&name=image-3fb07057-a278-4967-818d-5824814cfee0.png
- Variante 1: https://mcp.artlist.io/mcp/download?u=https%3A%2F%2Fcms-toolkit-artifacts.artlist.io%2Fcontent%2F-t-e-x-t_-t-o_-i-m-a-g-e-v1%2Fmedia__5%2Fimage-0d1a3ef0-8f9a-4933-9ffa-02332136150b.png%3FExpires%3D2108638330%26Key-Pair-Id%3DK2ZDLYDZI2R1DF%26Signature%3D2a1gTBuPYl1q02i~~JlAAv3oi7TgwaWiA4HAgZBtlsOn0F2Kp3rQ5R1wfV4LfpyHplCYsc~Gjv-gOGABvs4YdPla-WcDnLFmSg35Rq0lVK~K7OJiUwJYY8cqckIQQZZEAAS2gX3QA9ZAz4SWb-Y-nll-vNrcikEiPSVfnl2d8ydIhD65QaCwfeEv0W4mzkf68BchBBmgKG2etzphknIr9~InyEASxI9OxyGKy4V5sfjsY64R0udnp0jHF5w78K-9f-6-dDIpT1dLhHg-cReShOjWUPAMm12Gk9H4r4Phb9nI4XV~U8ikCajpfp6PJvw6vn~1td~O5S04~sRGr3CwRA__&name=image-0d1a3ef0-8f9a-4933-9ffa-02332136150b.png

Qué comprobar al verla: ni una letra en cajas, etiquetas, furgoneta o ropa; manos bien; que no parezca el uniforme
de ninguna empresa. Si falla, se regenera (160 créditos) antes de hacer los vídeos.

## Los 5 planos de vídeo (9:16, 1080p, sin audio)

| Plano del guion | Modelo | Duración | Créditos | Estado |
|---|---|---|---|---|
| 1 · la pila y la libreta | Veo 3.1 Fast (texto a vídeo) | 4 s | 500 | pendiente de aprobar |
| 2 · ¿por dónde empiezas? | Veo 3.1 con la imagen de referencia | 4 s | 1.000 | pendiente de aprobar |
| 3 · el móvil hacia la etiqueta | Veo 3.1 Fast | 4 s | 500 | pendiente de aprobar |
| 7a · la furgoneta por la ciudad | Veo 3.1 Fast | 4 s | 500 | pendiente de aprobar |
| 9 · la furgoneta vacía | Veo 3.1 con la imagen de referencia | 6 s | 1.500 | pendiente de aprobar |

Por qué así: solo los planos donde se ve la cara (2 y 9) necesitan la referencia para que sea el mismo hombre; los
de manos, furgoneta y cabina salen igual de bien con el modelo rápido a mitad de precio. Los prompts exactos son los
de `GUION.md` §5.4 con la biblia de §5.2 delante y el negativo de §5.2 en «negative_prompt».

## Locución

Voz de prueba generada con Artlist (voz «Alberto Rodríguez», acento latinoamericano: en Artlist **no hay voz
masculina con acento de España**). Sirve para montar y medir tiempos, **no para publicar en España**: la voz final es
Puck (Gemini TTS, `scripts/spot-v5/voz_gemini.py`, la que eligió Dani) o la de Dani grabada.
- Generación `01a187b9-f9ce-77ca-8a98-6201667a497c`, **24 s** (encaja con los 25 s del guion sin acelerar nada):
  https://mcp.artlist.io/mcp/download?u=https%3A%2F%2Fcms-toolkit-artifacts.artlist.io%2Fcontent%2F-t-e-x-t_-t-o_-s-p-e-e-c-h-v1%2Fmedia__2%2F-t-e-x-t_-t-o_-s-p-e-e-c-h-ddd96ef0-70b8-4b19-a02b-95b9e4a48f1b.mp3%3FExpires%3D2108638528%26Key-Pair-Id%3DK2ZDLYDZI2R1DF%26Signature%3DPUwgeXHwq2SuJK~PFQoeR8KS1GNtl8~4567XKj0gG84j8IlZ1mgysiq5AReqknApFXmanXXj3QzjUdyccPsQhvGaLqvSbTnLP-rhO4LA637MSzHsU5mW4Jg8n0EijeGq6-6imblK-uSa1bWm-yYIY96z8GS4wUxnLYXRpCYq5dgR7SCOs7qnlGskgpB5acmjx7PTlgxw0-w-C6L5Ht9d18pItouuDYWWM1BClFuZxGu1Dnb4GtmOFxhz4vAKwuDro-TR343acUZFXVi38lrNjqNTLYKWzci-jiJ9TL5~nrJld78bYw~nmb5MOD6flO7bNnzjNREcQtY~46BECc3wMA__&name=-t-e-x-t_-t-o_-s-p-e-e-c-h-ddd96ef0-70b8-4b19-a02b-95b9e4a48f1b.mp3

## Música (catálogo de Artlist, con licencia del plan; se descarga al montar, no antes)

Buscado: instrumental, percusivo, mínimo, 98-115 bpm, «determined». Para elegir de oído (ninguna se ha podido
escuchar desde aquí); la primera es la apuesta por título, tempo y autor:
1. **Minimal Truth** · Xavi Morató · 110 bpm · 3:17 — https://artlist.io/royalty-free-music/song/minimal-truth/6001695
2. Get It? · Shinto · 102 bpm · 2:49 — https://artlist.io/royalty-free-music/song/get-it/116162
3. Secret · Kadir Demir · 110 bpm · 2:49 — https://artlist.io/royalty-free-music/song/secret/47692
4. Pelicans · Jimit · 110 bpm · 1:41 (solo batería, muy seco) — https://artlist.io/royalty-free-music/song/pelicans/111831
5. FRWD. (instrumental) · Just Adam · 100 bpm — https://artlist.io/royalty-free-music/song/frwd-instrumental-version/6002091

Lo que tiene que cumplir la elegida: sin voces, que tenga un cambio limpio para caer en «Ordenar» (segundo 8-9 del
anuncio) y que acabe bien en seco. Si ninguna, buscar «urban hip hop instrumental confident minimal 105 bpm».

## Efectos (catálogo de Artlist)

| Momento | Efecto | Enlace |
|---|---|---|
| 0 s, la libreta cae | Paper – Cardboard Box, Impact (Mechanical Wave) | https://artlist.io/sfx/track/paper---cardboard-box-impact/70853 |
| alternativa | Essential Drops – Dropping a Cardboard Box, Short (Sonic Bat) | https://artlist.io/sfx/track/essential-drops---dropping-a-carboard-box-short/79324 |
| 4-8 s, tres bips | Supermarket – Scanning Item, Short Beep (Shirly Spikes); mejor el bip real de la app | https://artlist.io/sfx/track/supermarket----scanning-item-cash-register-short-beep/62436 |
| cortes | Balanced Transitions – Short Airy Whoosh (Artlist Studios) | https://artlist.io/sfx/track/balanced-transitions---short-airy-whoosh/124626 |
| alternativa | Air Motion – Short Airy Whoosh | https://artlist.io/sfx/track/air-motion---short-airy-whoosh/117173 |
| toques en la app | Sweet UI – High Pitch Popup (SoundCrib) | https://artlist.io/sfx/track/sweet-ui---high-pitch-popup/135704 |
| 17 s, «Entregado» | Musical UI Sounds – Friendly Alert (Sound Ex Machina) | https://artlist.io/sfx/track/musical-ui-sounds---friendly-alert/47568 |
| 14-15 s, intermitente | Volkswagen Polo – Turn Signal, Clicking (Soundkrampf), muy bajo | https://artlist.io/sfx/track/volkswagen-polo---turn-signal-clicking/55640 |
| 19 s, portón | Just Impacts – Closing Shut, Car Door (SoundBits) | https://artlist.io/sfx/track/just-impacts---closing-shut-car-door/90822 |

## Lo que falta para tener el anuncio

1. Dani aprueba los 4.000 créditos (o cambia el reparto de modelos) y se generan los 5 planos; se miran en Artlist.
2. Las 5 pantallas reales (GUION.md §6): grabadas en la nave o con el montaje del spot v5.
3. Montaje (GUION.md §4, §7 y §8): planos de IA + pantallas + voz (Puck o Dani) + subtítulos + música + efectos +
   tarjeta final con `qr-play-fds-spot.png`. Tres ganchos, 9:16 / 4:5 / 1:1 (/ 16:9).
4. Subir (GUION.md §10) y mirar a los 3 días.
