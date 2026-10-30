# La ficha de FDS en Google Play, por idioma (30-10-2026)

Textos listos para pegar en Play Console → Presencia en la tienda → Ficha principal → **Gestionar traducciones →
Añadir tus propias traducciones**. Una carpeta por idioma de Play: `title.txt` (30 caracteres como mucho),
`short.txt` (80) y `full.txt` (4.000). Las capturas se reutilizan (la app está en ese idioma: basta con poner el
emulador en él y repetir `docs/capturas-30-10`).

| Carpeta | Idioma en Play | Para quién |
|---|---|---|
| `es-ES` | Español (España) | la ficha de siempre |
| `es-419` | Español (Latinoamérica) | México, Colombia, Chile, Argentina, Perú… |
| `en-US` | Inglés (Estados Unidos) | EE. UU., Reino Unido, Irlanda y todo el que no tenga su idioma |
| `pt-BR` | Portugués (Brasil) | Brasil (Portugal la lee también) |
| `fr-FR` | Francés | Francia, Bélgica, Suiza |
| `de-DE` | Alemán | Alemania, Austria, Suiza |
| `it-IT` | Italiano | Italia |

Lo que cambia entre idiomas no es solo la lengua: fuera de España no se nombra la DGT ni las ZBE (el aviso de
cortes y obras solo existe con datos de España), ni Bizum, y el precio va en la moneda del país
(`PRECIOS_REPARTIDOR` en `backend/server.py`). Play también ofrece traducción automática gratuita de la ficha
(Grow users → Translations), pero estos textos están escritos a mano para que digan lo que la app hace de verdad.
