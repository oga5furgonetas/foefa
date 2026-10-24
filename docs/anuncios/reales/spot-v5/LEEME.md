# Spot v5 (24-10-2026): el anuncio de la app de reparto

Dani, sobre el v4: «mejorable: las transiciones, las imágenes de la app; busca una voz que no sea robótica;
cuida el volumen de los sonidos, sé meticuloso».

Los vídeos no se versionan. Están en `docs/anuncios/reales/salida/`, uno por voz:

| Fichero | Para |
|---|---|
| `spot-v5-9x16-<voz>.mp4` | Reels, Historias y TikTok (pantalla completa) |
| `spot-v5-4x5-<voz>.mp4` | feed de Facebook e Instagram |
| `spot-v5-1x1-<voz>.mp4` | feed cuadrado |
| `spot-v5-*-sin-voz.mp4` | lo mismo con música y efectos, sin locución (los subtítulos y las tarjetas lo cuentan todo) |

Voces: `achird` (24,4 s), `puck` (24,0 s) y `laomedeia` (26,2 s). Dani elige de oído.

## Qué cambia respecto al v4
- **Un día de reparto de verdad**: 15 paradas en calles reales del centro de A Coruña, ruta por carretera
  (OSRM, 14,2 km) y la hora de cada parada. Antes eran tres paradas de juguete. Los destinatarios son
  inventados.
- **La app a pantalla completa y nítida** (grabada a 1080×2342), con zoom suave en cada escena.
- **Transiciones encadenadas**: zoom al entrar, destello del obturador en la foto, deslizamientos y apertura
  en círculo hacia la oferta.
- **Una píldora arriba con lo que se ve**: «Foto a la etiqueta», «Ruta ordenada sola», «La hora de cada
  parada», «Tus 15 paradas, en el mapa», «Te guía con voz» y «Entrega con prueba». En la entrega se dice «con
  prueba» y no «en un toque» porque son dos toques.
- **Voz de Gemini TTS**: entona como una persona; la de Microsoft sonaba a centralita. Cada voz lee el guion
  entero de una vez y se corta por frases.
- **Subtítulos al tiempo real de cada palabra**: faster-whisper escucha cada frase y casa sus palabras con el
  guion. Las tres voces casan el 100 % de las palabras. El reparto por sílabas de antes se iba hasta 0,6 s.
- **4x5 y 1x1 sin recortes**: la pantalla entera en el centro, sobre la misma imagen desenfocada. Recortar el
  9x16 dejaba fuera las píldoras, la tarjeta de giro y el botón «Entregar sin foto».

## Sonido medido (no a ojo)
Cada pieza se lleva a un nivel objetivo por su sonoridad medida. El montaje mide la mezcla final y escribe
el resultado en `mezcla-<voz>.json`. Con Achird:

| Pieza | Nivel |
|---|---|
| Máster | -14 LUFS integrados, pico -1 dBFS (loudnorm lineal en dos pasadas: no cambia el equilibrio) |
| Voz | -13,9 LUFS (momentánea mientras habla) |
| Música mientras habla la voz | 11,4 LU por debajo (baja sola con sidechain) |
| Música sola (gancho, tarjetas) | -19,6 LUFS |
| Whoosh de cada transición | 12 LU por debajo de la voz |
| Obturador de la foto | 12,8 LU por debajo |
| Toques (pop) | 13,2 LU por debajo |
| Ding de «Entregado» | 7,8 LU por debajo |
| Paso al cierre (whoosh + subida) | 7,3 LU por debajo |

Ningún efecto llega a la voz. Puck y Laomedeia quedan igual, con 1 LU de diferencia como mucho.

## Cómo subirlo (lo hace Dani: es gasto)
- **Meta**: la campaña de registros, objetivo «Clientes potenciales» en el sitio web, evento Lead, botón
  **«Registrarte»**. URL:
  `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=facebook&utm_content=spot5`
  Texto: «¿Todavía ordenas la ruta a mano? Con FDS haces una foto a la etiqueta, la ruta se ordena sola con
  la hora de cada parada y te lleva con voz hasta cada puerta. Gratis y sin tarjeta. Crea tu cuenta en un
  minuto.»
  Sube el 9x16 para Reels e Historias y el 4x5 para el feed en el mismo anuncio, con «personalizar por
  ubicación».
- **TikTok**: el 9x16 con voz, botón «Registrarse», misma URL con `utm_source=tiktok`.
- Probar con voz y sin voz a la vez (dos anuncios en el mismo conjunto) y quedarse con el que tenga más
  registros a los 3 días.

## Voz humana
Sigue siendo lo mejor. Todas las voces sintéticas actuales son neuronales, también las de Gemini; esta es la
que menos lo parece. Si Dani graba las 6 frases de `voz_gemini.py` (FRASES) con el móvil en un sitio
silencioso, se cortan igual que las de Gemini y se monta con el mismo script.

## Rehacerlo
```
py -3 scripts/spot-v5/ruta.py                       # solo si cambian las paradas
cd frontend && node ../scripts/spot-v5/capas.mjs
npx vite build && npx playwright test spot-v5 --project=escritorio --update-snapshots
cd .. && GEMINI_API_KEY=… py -3 scripts/spot-v5/voz_gemini.py Achird Puck Laomedeia
py -3 scripts/spot-v5/alinear.py                    # tiempos reales de cada palabra (después de voz_gemini)
VOZ=Puck node scripts/montar-spot-v5.mjs
```
Reutiliza del v4 el gancho, la oferta, el cierre, el fondo, el círculo del toque y los sonidos
(`scripts/spot-v4/{etiqueta,capas}.mjs`, `sonido.py`). La clave de Gemini es la del backend en Fly: se lee
con `fly ssh console -C 'printenv GEMINI_API_KEY'`, nunca se escribe en ningún sitio.
