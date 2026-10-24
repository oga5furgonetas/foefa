# Spot v4 (24-10-2026) — el anuncio de la app de reparto

Vídeos (no se versionan, están en `docs/anuncios/reales/salida/`):
- `spot-v4-9x16.mp4` → Reels, Historias, TikTok (28,8 s, con voz)
- `spot-v4-4x5.mp4` → feed de Facebook/Instagram
- `spot-v4-1x1.mp4` → feed cuadrado
- `*-sin-voz.mp4` → lo mismo con música y efectos, sin locución (los subtítulos cuentan todo)

## Por qué es así (cómo funcionan los anuncios de apps en TikTok/Reels)
1. **Gancho en 2 s que nombra al público y su problema**: «📦 REPARTIDORES · ¿Todavía ordenas la ruta a mano?» sobre
   un repartidor apuntando en papel. Si no para el pulgar en 2 s, no lo ve nadie.
2. **La app a pantalla completa, haciendo el trabajo** (grabada a 1080 px, no un móvil pequeño con pantallazos):
   foto a la etiqueta → la dirección se rellena sola → «Ordenar ruta» → mapa → guía por voz → «Entregado».
3. **Cortes de 1,5-3 s** con el toque marcado (círculo) y un efecto de sonido en cada corte.
4. **Subtítulos grandes palabra a palabra**: en Reels casi todo se ve sin sonido.
5. **Oferta clara** (GRATIS · sin tarjeta · sin límite hasta el 31-12) y **cierre con dónde entrar y qué pulsar**:
   flotadsp.com · «Toca el botón de abajo 👇».
Todo lo que se ve lo hace la app hoy (API simulada con un trazado real de A Coruña). La etiqueta es genérica, sin
marca de ninguna empresa, y el destinatario es inventado. El metraje del repartidor es de Pexels (licencia
comercial) y solo cuenta el problema: no se le enseña usando ni recomendando FDS.

## Cómo subirlo (lo hace Dani: es gasto)
- **Meta**: campaña de registros (la que daba 1,64 € por alta), objetivo «Clientes potenciales» en el sitio web,
  evento Lead. Botón **«Registrarte»**. URL:
  `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=facebook&utm_content=spot4`
  Texto: «¿Todavía ordenas la ruta a mano? Con FDS haces una foto a la etiqueta, la ruta se ordena sola y te lleva
  con voz hasta cada puerta. Gratis y sin tarjeta. Crea tu cuenta en un minuto.»
- **TikTok**: el 9:16 con voz, botón «Registrarse», misma URL con `utm_source=tiktok`.
- Probar el de voz y el sin voz a la vez (2 anuncios en el mismo conjunto) y quedarse con el que tenga más
  registros a los 3 días.

## Voz
Es la voz neuronal de Microsoft (Ximena) tratada para que suene menos a máquina. **Voz humana es mejor**: si Dani
graba las 6 frases de `guion.txt` con el móvil (notas de voz, sitio silencioso) y las deja aquí como
`s1.mp3 … s6.mp3`, se rehace igual:
```
py -3 scripts/spot-v4/voz.py && node scripts/montar-spot-v4.mjs
```

## Rehacerlo entero
```
cd frontend && node ../scripts/spot-v4/etiqueta.mjs && node ../scripts/spot-v4/capas.mjs
npx vite build && npx playwright test spot-v4 --project=escritorio --update-snapshots
cd .. && py -3 scripts/spot-v4/voz.py && py -3 scripts/spot-v4/sonido.py && node scripts/montar-spot-v4.mjs
```
