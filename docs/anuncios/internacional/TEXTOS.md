# Anuncios de FDS en los 6 idiomas de la app: Meta y Spotify (30-10-2026)

Dani (30-10): «hazme anuncios para subir a Meta y a Spotify en todos los idiomas que tiene la app… vídeo puede
reutilizar el que tenemos… subtítulos en el idioma… y la voz del audio en el idioma nativo».

Lo que hay en esta carpeta, por idioma (es, en, pt, fr, it, de):

| Qué | Dónde | Cómo se hizo |
|---|---|---|
| Vídeo «La ruta hecha» (25-28 s, 9:16 para Reels/Stories/TikTok, 4:5 para el feed, 1:1, 16:9 con QR, y sin voz) | `salida/spot-ruta-*-<idioma>.mp4` (no se versionan; se rehacen con el comando de abajo) | El mismo montaje del 29-10 (`scripts/montar-spot-ruta.mjs`) con **la app grabada en ese idioma** (Playwright con `SPOT_LOCALE`, la app traduce sola), los rótulos de cada escena, la oferta y el cierre en ese idioma (`capas/<idioma>/`) y la voz nativa de Artlist (`voces/<idioma>/`). En español se queda el de siempre (`docs/anuncios/super-anuncio/salida/`, voz Puck). |
| Audio de Spotify (≤ 30 s) | `spotify/fds-spotify-<idioma>.mp3` · medidas en `spotify/medidas.json` | Voz nativa + la música del spot v4, a la norma de Spotify: -16 LUFS ±1,5, pico ≤ -2 dBTP, MP3 44,1 kHz 192 kbps (`scripts/spot-ruta/spotify-internacional.mjs`). En español vale el de la v4: `docs/anuncios/spotify/v4/fds-spotify-v4-play.mp3`. |
| Textos de Meta (principal, corto, título, descripción, botón) y la ficha de Spotify | abajo, y en `textos.json` (la fuente única de todo) | Escritos a mano en cada idioma, mismas verdades que el anuncio español (`super-anuncio/SUBIR.md`). |

Rehacer un idioma entero (desde este PC, con ffmpeg y Playwright):
```
cd frontend && SPOT_LOCALE=de-DE npx playwright test spot-ruta --project=escritorio --update-snapshots
mv test-results/spot-ruta ../docs/anuncios/internacional/grab/de && IDIOMA=de node ../scripts/spot-ruta/capas.mjs
cd .. && IDIOMA=de node scripts/montar-spot-ruta.mjs && node scripts/spot-ruta/spotify-internacional.mjs de
```
Las voces se generan con el conector de Artlist (una por frase + el anuncio de Spotify) y se guardan en
`voces/<idioma>/f1..f6.mp3` y `spotify.mp3`; `node scripts/spot-ruta/voces-internacional.mjs` mide las duraciones y
escribe `voz.json`.

## Sobre los subtítulos
En el vídeo del 29-10 Dani pidió **nada de letras encima de la app**: el texto va en su franja, arriba (rótulo de
cada escena), y en las tarjetas (gancho, «mañana sales con la ruta hecha», oferta, cierre). Eso es lo que está
traducido en cada vídeo; la voz dice lo mismo que se lee. Si quieres además subtítulos abajo (palabra a palabra),
la voz de Artlist no da el tiempo de cada palabra: habría que alinearla con whisper (como en el v5) y eso necesita
Python, que no hay en este PC.

## Las voces (Artlist, modelo Eleven v3; el acento es el de cada voz, no se puede cambiar)
| Idioma | Voz | Nota |
|---|---|---|
| es | Puck (Gemini TTS, la que eligió Dani el 24-10) | la de siempre |
| en | Christopher (británico, «gentle and trustworthy») | pensado para Reino Unido e Irlanda; para EE. UU. haría falta otra toma con una voz americana (Mark o Peter) |
| pt | Jon (hablando portugués) | **portugués de Portugal** (la app se grabó en pt-PT). Para Brasil: otra toma de voz (texto con «você», Pix) y la app en pt-BR |
| fr | Christopher (hablando francés) | |
| it | Jon (hablando italiano) | |
| de | Susi (alemana) | las frases alemanas salían largas: se acortaron tres y el audio de Spotify va acelerado un 12 % para no pasar de 30 s |

**No verificado de oído** (no puedo escuchar): el acento y la naturalidad de cada voz. Antes de subir, escúchalas
tú o alguien nativo; si una no convence, cambiarla es una generación más (unos 10-70 créditos de Artlist).

## Lo que hay que comprobar antes de subir fuera de España
1. **El bono de 25 €** se enseña en la oferta de todos los idiomas: Dani confirmó el 30-10 que se paga también fuera de
   España (PayPal), así que se queda.
2. **La página de alta y la web** están en los 6 idiomas (`docs/EXPANSION-INTERNACIONAL-30-10.md` §1). Las
   **páginas legales** estaban solo en español y, desde la 2.4.0, también en inglés: en pt/fr/it/de el usuario
   firma unos términos que no están en su idioma.
3. **Spotify Ads** se compra por país: hoy existe en Reino Unido, Irlanda, Francia, Alemania, Italia y Portugal (y
   LatAm en varios países); comprueba en Spotify Ad Studio que el país que quieras esté disponible para tu cuenta.
4. **Meta**: un conjunto de anuncios por país e idioma (no mezclar idiomas en un conjunto), con la segmentación
   «idioma = <el del anuncio>» además del país, para que a un alemán en Londres no le salga el inglés.
5. Los enlaces de abajo llevan `utm_content=rutahecha_<idioma>` para distinguir cada idioma en las altas.

---

## Español (España) · `es`
Ya hecho el 29-10: textos y pasos en `docs/anuncios/super-anuncio/SUBIR.md`; audio en `docs/anuncios/spotify/v4/`.

## English (UK) · `en`
**Meta · texto principal**
> Delivering parcels? Photo or scan the label and the address fills itself in. Tap sort and your route is done, with a time for every stop and loading bays on the map. It guides you by voice to every door. And when you complete your first route, €25 in your wallet. Works whether you deliver for a courier company, a platform or a supermarket. Start free, no card needed.

**Corto (TikTok / primera línea):** Still sorting your route by hand? Photo the label, the route sorts itself and it guides you by voice to every door. Start free, no card.
**Título:** Your delivery route, sorted for you · **Descripción:** Start free · €25 with your first route · **Botón:** Sign up
**Enlace:** `https://flotadsp.com/registro?sector=autonomo&plan=autonomo&utm_source=facebook&utm_content=rutahecha_en`
(Play directo: `https://play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dfacebook%26utm_medium%3Dcpc%26utm_campaign%3Druta_hecha_en`)

**Spotify (24,5 s de voz; 25,5 s el fichero)**
> Hey, courier. This one's for you: FDS. The free app that sorts your route for you. Take a photo of the label, and it guides you by voice to every door. No card, and no limits until the end of the year. Find it on Google Play: FDS. Or go to flotadsp.com: F-L-O-T-A-D-S-P dot com. Or tap this ad, and in a minute you've got your account.

Ficha: anunciante «FDS» · eslogan «Your route, sorted for you and free» · botón **Sign up** · imagen: «FDS · The free delivery app · flotadsp.com · Tap and create your account in 1 minute» (la portada de `docs/anuncios/spotify/v3/portada-640.jpg` está en español: hay que rehacerla con este texto) · enlace con `utm_source=spotify&utm_content=audio_en`.

**Lo que dice el vídeo:** Still sorting your route by hand every morning? · Look: take a photo of the label, and the address fills itself in. · Tap sort, and every stop is in order, with a time for each one. · See the route on the map, and it guides you by voice, door to door. · And the best part: it's free, with no card. · Go to flotadsp.com, and in a minute you've got your account.

## Português (Portugal) · `pt`
**Meta · texto principal**
> Entregas encomendas? Foto ou leitura da etiqueta e a morada entra sozinha. Carregas em ordenar e tens a rota feita, com a hora de cada paragem e as zonas de cargas e descargas no mapa. Leva-te por voz até cada porta. E ao completares a tua primeira rota, 25 € na tua carteira. Serve igual se entregas para uma transportadora, uma plataforma ou um supermercado. Começa grátis e sem cartão.

**Corto:** Ainda organizas a rota à mão? Foto à etiqueta, a rota faz-se sozinha e leva-te por voz até cada porta. Começa grátis, sem cartão.
**Título:** A tua rota de entregas, feita sozinha · **Descripción:** Começa grátis · 25 € com a tua primeira rota · **Botón:** Registar
**Enlace:** `…&utm_content=rutahecha_pt`

**Spotify (28,2 s de voz; 29,2 s el fichero)**
> Olá, estafeta. Isto é para ti: FDS. A app grátis que te ordena a rota sozinha. Tiras uma foto à etiqueta, e leva-te por voz até cada porta. Sem cartão, e sem limite até ao fim do ano. Procura no Google Play: FDS. Ou entra em flotadsp.com: F-L-O-T-A-D-S-P ponto com. Ou toca neste anúncio, e num minuto tens a tua conta.

Ficha: eslogan «A tua rota, ordenada sozinha e grátis» · botón **Registar** · imagen «FDS · A app de entregas grátis · flotadsp.com · Toca e cria a tua conta em 1 minuto».

**Vídeo:** Ainda organizas a rota à mão todas as manhãs? · Olha: tiras uma foto à etiqueta, e a morada entra sozinha. · Ordenar, e tens as paragens em ordem, com a hora de cada uma. · Vês a rota no mapa, e leva-te por voz, porta a porta. · E o melhor: é grátis, e sem cartão. · Entra em flotadsp.com, e num minuto tens a tua conta.

## Français · `fr`
**Meta · texto principal**
> Tu livres des colis ? Photo ou scan de l'étiquette et l'adresse se remplit toute seule. Appuie sur trier et ta tournée est prête, avec l'heure de chaque arrêt et les aires de livraison sur la carte. Elle te guide à la voix jusqu'à chaque porte. Et quand tu termines ta première tournée, 25 € dans ton portefeuille. Ça marche aussi bien si tu livres pour un transporteur, une plateforme ou un supermarché. Commence gratuitement et sans carte.

**Corto:** Tu organises encore ta tournée à la main ? Photo de l'étiquette, la tournée se fait toute seule et elle te guide à la voix jusqu'à chaque porte. Commence gratuitement, sans carte.
**Título:** Ta tournée de livraison, prête toute seule · **Descripción:** Commence gratuitement · 25 € avec ta première tournée · **Botón:** S'inscrire
**Enlace:** `…&utm_content=rutahecha_fr`

**Spotify (26,7 s de voz; 27,8 s el fichero)**
> Hé, livreur. C'est pour toi : FDS. L'appli gratuite qui organise ta tournée toute seule. Tu prends l'étiquette en photo, et elle te guide à la voix jusqu'à chaque porte. Sans carte, et sans limite jusqu'à la fin de l'année. Cherche-la sur Google Play : FDS. Ou va sur flotadsp.com : F-L-O-T-A-D-S-P point com. Ou touche cette pub, et en une minute tu as ton compte.

Ficha: eslogan «Ta tournée, organisée toute seule et gratuite» · botón **S'inscrire** · imagen «FDS · L'appli de livraison gratuite · flotadsp.com · Touche et crée ton compte en 1 minute».

**Vídeo:** Tu organises encore ta tournée à la main chaque matin ? · Regarde : tu prends l'étiquette en photo, et l'adresse se remplit toute seule. · Tu appuies sur trier, et toutes les étapes sont dans l'ordre, avec l'heure de chacune. · Tu vois la tournée sur la carte, et elle te guide à la voix, porte à porte. · Et le meilleur : c'est gratuit, et sans carte. · Va sur flotadsp.com, et en une minute tu as ton compte.

## Italiano · `it`
**Meta · texto principal**
> Consegni pacchi? Foto o scansione dell'etichetta e l'indirizzo entra da solo. Premi ordina e il giro è fatto, con l'ora di ogni fermata e le aree di carico e scarico sulla mappa. Ti guida con la voce fino a ogni porta. E quando completi il tuo primo giro, 25 € nel tuo portafoglio. Vale lo stesso se consegni per un corriere, una piattaforma o un supermercato. Inizia gratis e senza carta.

**Corto:** Ordini ancora il giro a mano? Foto all'etichetta, il giro si fa da solo e ti guida con la voce fino a ogni porta. Inizia gratis, senza carta.
**Título:** Il tuo giro di consegne, fatto da solo · **Descripción:** Inizia gratis · 25 € con il tuo primo giro · **Botón:** Iscriviti
**Enlace:** `…&utm_content=rutahecha_it`

**Spotify (25,5 s de voz; 26,5 s el fichero)**
> Ehi, corriere. Questo è per te: FDS. L'app gratis che ti ordina il giro da sola. Fai una foto all'etichetta, e ti guida con la voce fino a ogni porta. Senza carta, e senza limiti fino a fine anno. Cercala su Google Play: FDS. O entra su flotadsp.com: F-L-O-T-A-D-S-P punto com. O tocca questo annuncio, e in un minuto hai il tuo account.

Ficha: eslogan «Il tuo giro, ordinato da solo e gratis» · botón **Iscriviti** · imagen «FDS · L'app di consegne gratis · flotadsp.com · Tocca e crea il tuo account in 1 minuto».

**Vídeo:** Ordini ancora il giro a mano ogni mattina? · Guarda: fai una foto all'etichetta, e l'indirizzo entra da solo. · Premi ordina, e hai tutte le fermate in ordine, con l'ora di ognuna. · Vedi il giro sulla mappa, e ti guida con la voce, porta a porta. · E la cosa migliore: è gratis, e senza carta. · Entra su flotadsp.com, e in un minuto hai il tuo account.

## Deutsch · `de`
**Meta · texto principal**
> Du stellst Pakete zu? Foto oder Scan vom Etikett und die Adresse trägt sich von selbst ein. Tipp auf Sortieren und deine Tour ist fertig, mit Uhrzeit für jeden Stopp und den Ladezonen auf der Karte. Sie führt dich per Sprache bis zu jeder Tür. Und wenn du deine erste Tour abschließt, 25 € in deinem Wallet. Egal, ob du für einen Paketdienst, eine Plattform oder einen Supermarkt fährst. Gratis starten, ohne Karte.

**Corto:** Sortierst du die Tour noch von Hand? Etikett fotografieren, die Tour macht sich von selbst und sie führt dich per Sprache bis zu jeder Tür. Gratis starten, ohne Karte.
**Título:** Deine Zustelltour, fertig sortiert · **Descripción:** Gratis starten · 25 € mit deiner ersten Tour · **Botón:** Registrieren
**Enlace:** `…&utm_content=rutahecha_de`

**Spotify (31,9 s de voz acelerada un 12 %; 29,5 s el fichero)**
> Hey, Zusteller. Das ist für dich: FDS. Die Gratis-App, die deine Tour von selbst sortiert. Etikett fotografieren, und sie führt dich per Sprache bis zu jeder Tür. Ohne Karte, ohne Limit bis Jahresende. Such sie bei Google Play: FDS. Oder geh auf flotadsp.com: F-L-O-T-A-D-S-P punkt com. Oder tipp auf diese Anzeige: in einer Minute hast du dein Konto.

Ficha: eslogan «Deine Tour, von selbst sortiert und gratis» · botón **Registrieren** · imagen «FDS · Die Gratis-Zustell-App · flotadsp.com · Tippen und in 1 Minute dein Konto anlegen».

**Vídeo:** Sortierst du deine Tour noch jeden Morgen von Hand? · Schau: Etikett fotografieren, und die Adresse trägt sich selbst ein. · Tipp auf Sortieren: alle Stopps in Reihenfolge, mit Uhrzeit. · Die Tour auf der Karte, und sie führt dich per Sprache von Tür zu Tür. · Und das Beste: es ist gratis, und ohne Karte. · Geh auf flotadsp.com, und in einer Minute hast du dein Konto.

## Medidas de los audios de Spotify (`spotify/medidas.json`)
| Idioma | Voz | Total | LUFS | Pico | Tamaño |
|---|---|---|---|---|---|
| en | 24,5 s | 25,5 s | -16,2 | -3,9 dBTP | 0,61 MB |
| pt | 28,2 s | 29,2 s | -16,3 | -4,0 dBTP | 0,70 MB |
| fr | 26,7 s | 27,8 s | -16,2 | -4,6 dBTP | 0,67 MB |
| it | 25,5 s | 26,5 s | -16,1 | -4,4 dBTP | 0,64 MB |
| de | 31,9 s (×1,12) | 29,5 s | -16,3 | -4,1 dBTP | 0,71 MB |
