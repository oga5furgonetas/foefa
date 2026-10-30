# Piezas para las redes (29-10-2026): textos de cada una

Las imágenes están en `frontend/public/redes/` y, cuando la web se despliega, en **https://flotadsp.com/redes/<fichero>**
(por ejemplo https://flotadsp.com/redes/A-1-portada.png): es la URL que se le da a Metricool. Los vídeos en español
(`tiktok-es.mp4`, `tiktok-es-llama.mp4`, `tiktok-es-cobro.mp4`, `shorts-es.mp4`, `shorts-es-llama.mp4`) están copiados ahí
también, con la misma URL pública (https://flotadsp.com/redes/tiktok-es.mp4); los originales siguen en `docs/videos/`.

Se generan con `cd frontend && node ../scripts/redes-fotos.mjs` (desde la nube vale con el Playwright del sistema).
Fondos: los de Pexels de `tiktok-fotos/fondos` (solo enseñan el oficio; nadie «usa» FDS en ellos). Si en
`redes/fondos/` están `furgoneta-amanecer.jpg`, `interior-paquetes.jpg` y `libreta-salpicadero.jpg`, el script
los usa: son tres fotos SIN personas generadas el 29-10 en la cuenta de Artlist de Dani (Nano Banana Pro, 9:16:
furgoneta blanca al amanecer con la puerta abierta; interior con paquetes; libreta con direcciones en el
salpicadero). Desde la nube no se pudieron bajar (la red del entorno bloquea `cms-toolkit-artifacts.artlist.io`
y `ai-toolkit-generations.imgix.net`): se guardan a mano con esos nombres, a 1080×1920, y se vuelve a ejecutar. **Hecho el 29-10 por la noche desde el PC** (bajadas con el conector de Artlist, recortadas a 1080×1920; las piezas de `frontend/public/redes/` ya llevan estos fondos).

Enlace en TikTok: no se puede poner en la descripción; va «enlace en el perfil». En X y Facebook, el enlace del
apartado 4 de `REDES.md` con su `utm_content`.

## Carrusel A · Lo que nadie te cuenta del primer día repartiendo (`A-1-portada` … `A-7-cierre`)
Modo foto de TikTok (7 imágenes en orden) · Instagram · página de Facebook. `utm_content=carrusel_primer_dia`.

> Si empiezas a repartir, guárdate esto: 5 cosas que se aprenden a golpes el primer día. ¿Cuál añadirías? 👇
> Y si quieres que la ruta se ordene sola: foto a la etiqueta y listo. Gratis hasta el 31 de diciembre, enlace en el perfil.

Hashtags: #repartidor #repartidores #primerdia #paqueteria #mensajeria #furgoneta #reparto #trucos
Comentario fijado: «¿Cuántas paradas hiciste tu primer día? Cuéntalo: a alguien le viene bien saber que es normal.»
Sonido: uno en tendencia, bajo, que no tape la lectura.

## Carrusel B · 7 frases que todo repartidor ha oído (`B-1-portada` … `B-9-cierre`)
Modo foto (9 imágenes) · Instagram · página de Facebook. `utm_content=carrusel_frases`.

> 7 frases que todo repartidor ha oído 😮‍💨 La 4 duele. Etiqueta a quien le pasa cada día.
> (Lo del pijama no lo arreglamos. La ruta, sí: enlace en el perfil.)

Hashtags: #repartidor #repartidores #humor #paqueteria #mensajeria #furgoneta #reparto #amazonflex
Comentario fijado: «¿Cuál falta? La mejor de los comentarios va al siguiente carrusel.»

## Carrusel C · ¿Cuánto gana de verdad un repartidor autónomo? (`C-1-portada` … `C-6-cierre`)
Modo foto (6 imágenes) · Instagram · página de Facebook · X (las 6 como imágenes). `utm_content=carrusel_cuanto_gana`.
Los números son los que trae por defecto la calculadora (`CalculadoraRepartidor.jsx`): 100 paradas × 1,10 € × 22
días = 2.420 €; 120 km × 0,15 € × 22 = 396 €; fijos 600 €; quedan 1.424 € y 198 h → 7,19 €/h. Se dice que es orientativo.

> ¿Cuánto gana de verdad un repartidor autónomo? Un ejemplo con números corrientes: 100 paradas, 1,10 € la parada,
> 22 días. Lo que se factura, lo que se va y lo que queda por hora, sin humo. Es orientativo: pon tus números en
> la calculadora gratis (sin registro), enlace en el perfil.

Hashtags: #repartidorautonomo #autonomos #repartidor #paqueteria #mensajeria #reparto #cuantogana
Comentario fijado: «¿Tus números son muy distintos? Dilos aquí (sin nombres de empresas) y ajustamos el ejemplo.»
En X y Facebook el enlace es el de la calculadora: `flotadsp.com/calculadora-repartidor?utm_source=<red>&utm_medium=organico&utm_campaign=rep_comunidad&utm_content=calculadora`.

## Carrusel D · Cómo cargar la furgoneta para no volverte loco (`D-1-portada` … `D-7-cierre`, 30-10)
Modo foto (7 imágenes) · Instagram · página de Facebook. `utm_content=carrusel_carga`. Sin fecha aún: para el primer
hueco de TikTok/Instagram a partir del 10-11 (la sesión del PC o la de la nube lo programan cuando esté desplegado).

> Cómo cargar la furgoneta para no volverte loco 📦 Cinco reglas que ahorran una hora al día (la 4 casi nadie la hace).
> ¿Cuál añadirías? 👇 Y el orden lo pone la app: foto a la etiqueta y cada bulto con su zona de carga. Gratis hasta el
> 31 de diciembre, enlace en el perfil.

Hashtags: #repartidor #repartidores #furgoneta #paqueteria #mensajeria #reparto #trucos #carga
Comentario fijado: «¿Cómo cargas tú: por calles, por tamaño o como cae? Sin vergüenza, que todos hemos empezado igual.»

## Tarjetas 16:9 para X (van con el post del calendario de `REDES.md`)
| Fichero | Post | Enlace |
|---|---|---|
| `X-primer-dia.png` | V 31-10 «Lo que nadie te cuenta al empezar a repartir» | sin enlace (que se comente) |
| `X-truco.png` | D 02-11 «¿Y dónde está el truco?» | repartidores, `utm_content=post_truco` |
| `X-cuanto-gana.png` | M 04-11 «¿Sabes cuánto ganas por hora?» | calculadora |
| `X-manos-libres.png` | X 05-11 «Manos libres en Android» | repartidores, `utm_content=post_manos_libres` |
| `X-latam.png` | S 08-11 «Repartidores de Latinoamérica» | repartidores, `utm_content=post_latam` |
| `X-sin-cobertura.png` | D 09-11 «Sin cobertura en el garaje del polígono» | repartidores, `utm_content=post_sin_cobertura` |
| `X-invita.png` | L 10-11 «Invita y gana» | invita, `utm_content=invita` |

## Ideas para las piezas siguientes (misma plantilla, una por ronda)
- «5 cosas que mirar antes de firmar con una agencia de reparto» (sin nombres de empresas; cierre: calculadora).
- «Lo que cuesta de verdad una furgoneta de reparto al mes» (ejemplo orientativo; cierre: calculadora).
- «Mensajes que puedes mandar al cliente antes de llegar» (3 plantillas; cierre: el WhatsApp con un toque).
- «La ruta de 40 paradas: a mano vs. ordenada» (dos capturas; cierre: gratis hasta el 31-12).
