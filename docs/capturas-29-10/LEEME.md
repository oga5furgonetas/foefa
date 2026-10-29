# Capturas del 29-10-2026: FDS en todo, cookies, planes, el panel y los avisos al móvil

Las de la web las hace `frontend/e2e/capturas-29-10.mjs` contra `vite preview --port 4174` de una compilación
con el píxel (`VITE_META_PIXEL_ID`), con la API simulada de las pruebas (`e2e/api-simulada.js`); el mismo script
genera `frontend/public/og.png`. `titulos.json` guarda el título de pestaña de cada pantalla.

| Fichero | Qué enseña |
|---|---|
| `01-portada-movil.png` | La portada en el móvil: marca FDS, «En 6 idiomas», distintivo de Play |
| `02-planes-movil.png` | `/planes` con el logo y el cian de FDS, «Entrar», y «plazas limitadas» (ya no «quedan 10 de 10») |
| `03-empezar-movil.png` | `/empezar` |
| `04-cookies-movil.png` | El aviso de cookies nuevo (solo con píxel): dos líneas pegadas abajo, «Solo necesarias» y «Aceptar» iguales |
| `05-panel-login-movil.png` | Entrar al panel, marca FDS |
| `06-panel-movil.png`, `07-vehiculos-movil.png` | El panel en el móvil (título de pestaña «Dashboard · FDS», «Vehículos · FDS») |
| `08-portada-escritorio.png`, `09-planes-escritorio.png`, `10-panel-escritorio.png` | Lo mismo en escritorio |
| `og.png` | La imagen al compartir un enlace (antes decía «Flota · Gestión de flotas con IA») |
| `emulador-*.png` | La app nativa 2.3.0 en el emulador de Android Studio contra `servidor_pruebas.py`: el portal del conductor con «Tienes 1 aviso nuevo», la bandeja de avisos y la notificación |
