# La ficha de FDS en la App Store, por idioma (30-10-2026)

Generada con `node scripts/ficha-app-store.mjs` desde la de Google Play (`app-android/play-listing/`), sin Google
Play, Android, precios ni pagos (en el iPhone no se vende nada: regla 3.1.1 de Apple, ver `docs/APP_STORE.md`).
Se pega en App Store Connect → la app → App Store → la versión → cada idioma (añadir idiomas en «Localizations»):

| Carpeta | Idioma en App Store Connect | name (30) | subtitle (30) | promotional (170) | description (4000) | keywords (100) |
|---|---|---|---|---|---|---|
| es-ES | Spanish (Spain) | 20 | 25 | 75 | 1438 | 100 |
| es-419 | Spanish (Mexico) | 20 | 25 | 76 | 1379 | 91 |
| en-US | English (U.S.) | 27 | 30 | 78 | 1371 | 95 |
| pt-BR | Portuguese (Brazil) | 21 | 26 | 73 | 1285 | 97 |
| fr-FR | French | 26 | 22 | 81 | 1450 | 97 |
| it-IT | Italian | 21 | 27 | 72 | 1329 | 97 |
| de-DE | German | 17 | 29 | 86 | 1444 | 98 |

- `name.txt` → Name · `subtitle.txt` → Subtitle · `promotional.txt` → Promotional Text · `description.txt` →
  Description · `keywords.txt` → Keywords. Support URL: https://flotadsp.com · Marketing URL: https://flotadsp.com ·
  Privacy Policy URL: https://flotadsp.com/privacidad (en inglés sale sola cuando el móvil no está en español).
- Categoría: Business (secundaria: Navigation). Clasificación de edad: 4+. Copyright: © 2026 FDS.
- Las capturas (iPhone 6,7": 1290×2796) se hacen con la app en TestFlight con el iPhone en cada idioma.
