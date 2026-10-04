# Campaña «FDS Repartidores — 250 €/día — 7 idiomas» (04-10-2026)

Lo que hay que crear en Meta y en TikTok. Dani pulsa Publicar: a mí el panel
me bloquea los botones que gastan.

## Por qué cambia respecto a la del 04-10 de madrugada

Medido en nuestra analítica: **410 visitas del anuncio al formulario de alta,
0 altas**; casi nadie pasó de la primera pantalla. Aterrizaban en «nombre,
correo, contraseña» de una app que no habían visto. Ya está cambiado:
`/repartidores` (ve la app, la prueba con 8 paradas sin registrarse, y luego
el alta). Las 4 campañas antiguas están pausadas.

## Meta (Facebook + Instagram)

- Objetivo: **Tráfico** → visitas a la página de destino (sin píxel no hay
  «conversiones»; el píxel exige portfolio empresarial, lo crea Dani).
- Presupuesto: **total 250 €**, inicio ahora, fin **hoy 23:59** (presupuesto
  total con fin hoy = se gasta hoy; «diario» no garantiza gastarlo entero).
- Un conjunto por idioma (la segmentación por idioma de Meta + países):

| Conjunto | Idiomas (Meta) | Países |
|---|---|---|
| ES | Español | España, México, Argentina, Colombia, Chile, Perú, EE. UU. |
| EN | Inglés | EE. UU., Reino Unido, Irlanda, Canadá, Australia |
| PT | Portugués | Portugal, Brasil |
| FR | Francés | Francia, Bélgica, Suiza, Canadá |
| DE | Alemán | Alemania, Austria, Suiza |
| IT | Italiano | Italia, Suiza |
| ZH | Chino (simplificado y tradicional) | España, Italia, Francia, Alemania, Reino Unido, EE. UU. (chinos fuera de China; dentro de China Facebook no llega) |

- Público: Advantage+ con 18-55, y como interés «Repartidor / Mensajería /
  Logística / Amazon Flex / Glovo / Uber Eats» (Meta los ofrece como intereses).
- Ubicaciones: Advantage+ (todas). Páginas: FDS. Anunciante y pagador: **FDS**
  (por defecto sale «Histor»: revisarlo siempre).
- Creatividades por conjunto (del idioma): el **vídeo** `docs/videos/tiktok-<idioma>.mp4`
  (también en https://flotadsp.com/videos/tiktok-<idioma>.mp4) como anuncio
  principal, y las imágenes `docs/anuncios/<idioma>/1-feed.png` (4:5) y
  `3-historia-reels.png` (9:16) como segundo anuncio. Advantage+ creatividad: sí.
- URL de destino (todos): `https://flotadsp.com/repartidores?utm_source=facebook&utm_medium=cpc&utm_campaign=rep_250_oct&utm_content=<idioma>`
  (en chino: `https://flotadsp.com/cn?utm_source=...&utm_content=zh`).
- Botón: «Más información» (es lo que mejor funciona con una prueba sin registro).

### Textos (texto principal / titular / descripción)

- **ES**: «¿Aún ordenas la ruta a mano? Foto a la etiqueta, la ruta se ordena sola por tiempo y te guía con voz hasta cada puerta. Pruébala sin registrarte.» / «Tu ruta de reparto, ordenada sola» / «7 días gratis · 9,99 €/mes · cancela cuando quieras»
- **EN**: «Still planning your route by hand? Snap the label, the route sorts itself by time and guides you by voice to every door. Try it, no sign-up.» / «Your delivery route, sorted for you» / «7 days free · €9.99/month · cancel anytime»
- **PT**: «Ainda ordenas a rota à mão? Foto à etiqueta, a rota ordena-se sozinha por tempo e guia-te por voz até cada porta. Experimenta sem registo.» / «A tua rota de entregas, ordenada sozinha» / «7 dias grátis · 9,99 €/mês · cancela quando quiseres»
- **FR**: «Vous triez encore votre tournée à la main ? Photo de l’étiquette, la tournée se trie toute seule et vous guide à la voix jusqu’à chaque porte. Essayez sans inscription.» / «Votre tournée, organisée toute seule» / «7 jours gratuits · 9,99 €/mois · résiliable à tout moment»
- **IT**: «Ordini ancora il giro a mano? Foto all’etichetta, il percorso si ordina da solo per tempo e ti guida con la voce fino a ogni porta. Provala senza registrarti.» / «Il tuo giro di consegne, ordinato da solo» / «7 giorni gratis · 9,99 €/mese · disdici quando vuoi»
- **DE**: «Planst du deine Tour noch von Hand? Etikett fotografieren, die Route sortiert sich nach Zeit und führt dich per Sprache bis zu jeder Tür. Teste sie ohne Anmeldung.» / «Deine Zustelltour, von selbst sortiert» / «7 Tage gratis · 9,99 €/Monat · jederzeit kündbar»
- **ZH**: «还在手动排路线？拍下面单，路线按时间自动排好，并用中文语音导航到每个门口。免注册试用。» / «你的配送路线，自动排好» / «免费 7 天 · 每月 9.99 € · 随时取消»

## Lo que quedó montado en Meta (04-10, 17:30)

Un solo conjunto, un solo anuncio **multiidioma** (Meta enseña a cada persona la
versión de su idioma; con «Idiomas» del anuncio no hace falta un conjunto por
idioma, y además el panel me bloquea «Duplicar»):

- Campaña 52642951496339 · conjunto «Repartidores — 7 idiomas … — Europa + América»
  (52642951496139) · anuncio «ES — Vídeo (ruta ordenada sola)» (52642951496539).
- Países (19): ES MX AR CO CL PE US · GB IE CA AU · PT BR · FR BE CH · DE AT · IT.
  **Sin filtro de idioma** en el conjunto (lo decide la versión del anuncio).
- Idioma predeterminado Español + EN PT FR IT DE ZH(simplificado), cada uno con
  su vídeo `FDS voz <idioma>`, su URL (`utm_content=<idioma>`, el chino a /cn)
  y sus textos. CTA «Ver detalles» (Meta: +2,3 % CVR frente a «Más información»).
- Vídeos: los nuevos con voz en off (ver abajo). Recorte solo «Original»: Meta
  no permite un vídeo por idioma si hay recortes por ubicación.
- Estado: **Borrador, listo. Falta que Dani pulse Publicar.**

### Vídeos (rehechos 04-10 por la tarde)

Los primeros salían con la pantalla pequeña en gris y mudos (Playwright solo
reduce el tamaño del vídeo, nunca lo amplía). Ahora: `e2e/video-tiktok.spec.js`
graba al tamaño del viewport y guarda los instantes de los rótulos;
`e2e/video-montar.mjs` escala a 1080×1920, pone la voz neuronal de cada idioma
(edge-tts, `py -3 -m pip install edge-tts`) sincronizada con los rótulos y una
base musical sintetizada. En Meta hay que importarlos con `?v=2` en la URL para
saltarse la caché del borde.

## TikTok Ads (250 € hoy)

- Hace falta cuenta en https://ads.tiktok.com (entrar con la cuenta de TikTok
  de la marca). Objetivo: **Tráfico** (sin píxel). Presupuesto de campaña
  **250 € total**, fin hoy 23:59.
- Un grupo de anuncios por idioma con los mismos países de arriba (TikTok no
  llega a China continental: el chino va a la diáspora).
- Vídeo: `tiktok-<idioma>.mp4` (9:16, 28 s, sin audio: TikTok avisa; se le puede
  poner una música de su biblioteca comercial al subirlo). Texto del anuncio:
  el titular de arriba. Botón: «Más información». Misma URL con `utm_source=tiktok`.
- Público: 18-55, intereses «Delivery / Logistics / Gig economy».

## Qué medir mañana (nuestra analítica, anónima)

`analitica_eventos` desde hoy 14:30: sesiones con `utm`, cuántas pulsan
«Probarla ahora» (`rep_probar`), cuántas van al alta (`rep_alta`) y `registro_ok`.
