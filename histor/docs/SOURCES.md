# Fuentes

Histor solo usa fuentes **públicas y legales**: organismos oficiales, agencias,
medios con redacción identificable y fuentes académicas. De cada pieza toma el
titular, el resumen y los datos para **contrastar**; enlaza siempre al original
y nunca republica artículos. El texto de las fuentes se borra a los 30 días.

## Reglas de rastreo

- Respeta `robots.txt` (con 401/403 se considera prohibido) y `Crawl-delay`.
- Respeta la reserva de minería de textos (`tdm-reservation: 1`): se guarda solo el titular y el enlace.
- GET condicional (`ETag` / `If-Modified-Since`) y como máximo una petición por segundo y dominio.
- User-Agent `HistorBot/0.1 (+URL de contacto)`.
- No se saltan muros de pago, no se inician sesiones, no se usan servicios de terceros para extraer contenido.
- Las redes sociales solo mediante sus API oficiales y con credenciales del propietario; vienen **en pausa**
  y, aunque se activen, son **pistas** que abren una investigación, nunca evidencia.

## Fuentes configuradas (`packages/core/src/config/sources.ts`)

| Fuente | Tipo | País | Idiomas | Conector | Estado inicial |
|---|---|---|---|---|---|
| USGS Earthquake Hazards Program | Oficial primaria | US | en | geojson | activa |
| GDACS (Global Disaster Alert and Coordination System) | Oficial | internacional | en | rss | activa |
| World Health Organization | Oficial primaria | internacional | en | rss | activa |
| UN News | Oficial | internacional | en | rss | activa |
| Noticias ONU | Oficial | internacional | es | rss | activa |
| ONU Info | Oficial | internacional | fr | rss | activa |
| European Central Bank | Oficial primaria | internacional | en | rss | activa |
| Federal Reserve Board | Oficial primaria | US | en | rss | activa |
| NASA | Oficial primaria | US | en | rss | activa |
| GOV.UK | Oficial primaria | GB | en | atom | activa |
| Boletín Oficial del Estado | Oficial primaria | ES | es | rss | activa |
| Agência Brasil | Agencia | BR | pt | rss | activa |
| Europa Press | Agencia | ES | es | rss | activa |
| ANSA | Agencia | IT | it | rss | activa |
| BBC News | Medio | GB | en | rss | activa |
| BBC News UK | Medio | GB | en | rss | activa |
| BBC News Mundo | Medio | GB | es | rss | activa |
| BBC News Brasil | Medio | GB | pt | rss | activa |
| The Guardian | Medio | GB | en | rss | activa |
| NPR | Medio | US | en | rss | activa |
| DW | Medio | DE | en | rss | activa |
| DW (Deutsch) | Medio | DE | de | rss | activa |
| DW (Español) | Medio | DE | es | rss | activa |
| DW Brasil | Medio | DE | pt | rss | activa |
| tagesschau | Medio | DE | de | rss | activa |
| ZDFheute | Medio | DE | de | rss | activa |
| DER SPIEGEL | Medio | DE | de | rss | activa |
| France 24 | Medio | FR | fr | rss | activa |
| France 24 (English) | Medio | FR | en | rss | activa |
| France 24 (Español) | Medio | FR | es | rss | activa |
| RFI | Medio | FR | fr | rss | activa |
| franceinfo | Medio | FR | fr | rss | activa |
| Le Monde | Medio | FR | fr | rss | activa |
| El País | Medio | ES | es | rss | activa |
| El Mundo | Medio | ES | es | rss | activa |
| Corriere della Sera | Medio | IT | it | rss | activa |
| Il Post | Medio | IT | it | rss | activa |
| RTP Notícias | Medio | PT | pt | rss | activa |
| Folha de S.Paulo | Medio | BR | pt | rss | activa |
| Euronews | Medio | FR | en | rss | activa |
| The Conversation | Académica | internacional | en | atom | activa |
| Reddit r/worldnews | Red social (pista) | internacional | en | reddit | en pausa |
| X (búsqueda reciente) | Red social (pista) | internacional | — | x | en pausa |

Cada fuente declara además su grupo propietario (dos medios del mismo grupo
cuentan como una sola fuente), su fiabilidad previa (Beta), la sección
habitual y las notas de licencia (p. ej. dominio público del Gobierno de EE. UU.,
Open Government Licence del Reino Unido, CC BY 4.0 de Agência Brasil).

## Comprobarlas antes de encender la ingesta

```bash
npm run sources:check                 # informe: HTTP, nº de piezas, reserva TDM, última pieza
npm run sources:check -- --update     # guarda el resultado y pone en pausa las que fallan
npm run sources:check -- --only=bbc-world
```

> Desde el entorno de desarrollo donde se construyó Histor la política de red
> bloqueaba estos dominios, así que las URL se han tomado de la documentación
> pública de cada medio y **deben validarse con `sources:check` al desplegar**.
> El pipeline completo está probado de punta a punta con el escenario DEMO.

## Añadir una fuente

1. Comprueba que su feed es público y que sus condiciones permiten leerlo.
2. Añádela a `SOURCE_SEEDS` con su tipo, grupo propietario, idiomas y país.
3. `npm run cli -w @histor/worker -- seed` (idempotente) y `sources:check --only=<slug>`.
4. En el panel → Fuentes puedes pausarla, bloquearla, cambiar su tipo o su frecuencia.

Tipos de conector: `rss`, `atom`, `jsonfeed`, `geojson` (USGS), `sitemap`
(Google News sitemap), `html` (metadatos `og:`/`article:` de páginas públicas),
`reddit`, `x`, `youtube`, `bluesky` y `mastodon` (API oficiales, con credenciales; como pistas).

## Fuentes DEMO

El escenario DEMO (`packages/core/src/demo/scenario.ts`) define 22 fuentes
ficticias («Agencia Demo», «Diario Demo», «El Satírico Demo», «Red Social
Demo»…) con piezas pensadas para ejercitar cada regla: dos fuentes que
coinciden, una sola fuente, sátira, rumor en redes, noticia antigua reciclada,
cifra que evoluciona, contradicción entre fuentes y la misma noticia en varios
idiomas. Todo lo DEMO lleva `is_demo = true` y nunca se mezcla con lo real.
