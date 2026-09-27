# Marca

## Nombre

**Histor**, del griego ἵστωρ: «el que sabe porque ha visto; testigo, juez». Es
la raíz de *historia* (Heródoto llamó a su obra *historíē*, «investigación»).
Corto, pronunciable en los 6 idiomas y reconocible en todos (historia, history,
Historie, histoire, storia, história). Encaja con el periodismo como «primer
borrador de la historia» y con la promesa del producto: contar lo que se ha
podido comprobar.

Descartados tras investigar por choque con medios o marcas de su sector:
Verum, Nuntia/Nunti, Fontis, Relata, Crivo, Gnomon, Atesta, Verax.

**Pendiente del propietario:** comprobar y registrar dominio y perfiles (desde el
entorno de desarrollo WHOIS/RDAP estaba bloqueado). Candidatos: `histor.news`,
`histor.media`, `readhistor.com`, `gethistor.com`. Registro de marca en la
EUIPO/OEPM y USPTO en las clases 9, 38, 41 y 42.

## Lema

- es: *Noticias verificadas, sin atajos* · en: *Verified news, no shortcuts* ·
  de: *Geprüfte Nachrichten, ohne Abkürzungen* · fr, it, pt en `i18n/dictionaries.ts`.

## Logotipo

Dos pilares (dos fuentes independientes) unidos por un travesaño rojo (la
corroboración) sobre un cuadrado de tinta: una «H» que dice cómo trabaja el
periódico. El archivo maestro es `apps/web/public/favicon.svg`; los PNG
(`icon-192`, `icon-512`, `icon-180`, `icon-maskable-512`, `favicon-32`) se
generan con `node scripts/generate-icons.mjs`. El logotipo en la web es un
componente (`components/Logo.tsx`) que respeta el modo oscuro.

## Paleta

| Uso | Claro | Oscuro |
|---|---|---|
| Papel (fondo) | `#fbfaf7` | `#111317` |
| Tinta (texto) | `#15171c` | `#ece9e2` |
| Acento / última hora | `#b3261e` | `#ff6b5e` |
| Verificado | `#0b6b55` | `#4cc9a2` |
| En desarrollo | `#8f5400` | `#f0b24c` |
| DEMO | `#6b2fb3` | `#c49bff` |
| Enlaces | `#1d4f91` | `#8db8ff` |

Contrastes AA sobre el fondo. Los estados nunca se comunican solo con color:
siempre llevan texto («Verificada», «En desarrollo», «Retirada»).

## Tipografía

- **Newsreader** (variable, óptica): titulares y lectura. Pensada para prensa en pantalla.
- **Inter** (variable): interfaz, etiquetas, datos.
- Autoalojadas con `@fontsource` (sin CDN de terceros: rendimiento y RGPD).

## Tono

Sobrio, preciso y sin adjetivos de más. Titulares informativos, nunca
sensacionalistas ni en forma de pregunta. Lo no confirmado se atribuye
(«según…»). Las mesas automáticas firman como «Redacción Histor», «Histor
Newsroom», etc., y se presentan como lo que son: no son personas.

## Imágenes

Sin foto con licencia, la noticia se presenta tipográficamente (como en el
papel). La imagen para redes (`/api/og`) es un gráfico con el titular y el
estado de verificación, nunca una foto inventada.
