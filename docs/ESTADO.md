# Estado de Flota y relevo entre sesiones

> **Si eres una sesión nueva: lee esto entero antes de tocar nada.**
> Al acabar tu trabajo, actualiza la sección «Última sesión» y «Pendiente»,
> haz commit y `git push`. Una sola sesión trabajando a la vez: antes de
> empezar, `git pull` y comprueba que nadie ha dejado nada a medias aquí.

Última actualización: **26-09-2026** (sesión `c3af8cab`, Claude Opus 5.5).

## Qué es y dónde está

- **Flota**: SaaS de gestión de flotas para cualquier empresa. Nació el 25-09-2026
  como copia depurada de FlotaDSP (sin extensión de Cortex ni nada que
  interfiera con Amazon). Dani lo usa también para **su propia flota**
  (reparto para Amazon, centros OGA5, DGA1, DGA2).
- Código: `C:\Users\Usuario\Downloads\flotia` (la carpeta NO se renombró),
  rama `main`, repo privado **github.com/oga5furgonetas/foefa**.
- Web: **https://flotadsp.com** (y www → 301). La sirve el Worker de Cloudflare
  `flota-dominio` (`infra/web-dominio/`), que reenvía al proyecto de Pages
  `flota` (https://flota-2fg.pages.dev). Ver el porqué en `infra/web-dominio/worker.js`.
- API: **https://flota-backend.fly.dev** (Fly, cuenta NUEVA de Dani, app `flota-backend`).
- Base de datos: MongoDB Atlas, clúster `cluster1` (M0 gratis). Bases:
  `flota` (empresa principal), `flota_global` (usuarios, empresas), `dsp_demo`
  (demo), `edge_os` (proyecto de apuestas, copiado tal cual).
- Ficheros y fotos: R2 `flotadsp-uploads` en la cuenta de Cloudflare
  **tr2santiago@winiw.es** (no en la de Flota). URL pública
  `https://pub-37efd7ef3dc94d0b918aeac1b5480b41.r2.dev`. Ahí están las ~30.000
  fotos de FlotaDSP, las copias `backups/flotadsp_*` y las nuevas `backups/flota_*`.
- IA: Gemini por clave de AI Studio (proyecto «Proyecto de Gemini 3», nivel
  gratuito). Modelo por defecto `gemini-3.8-flash` (`_modelo_ia()` en server.py).

## Credenciales (solo rutas; NUNCA imprimir su contenido)

| Qué | Fichero en el PC de Dani |
|---|---|
| Token de Fly (cuenta nueva) | `C:\Users\Usuario\.flotia-fly-token.txt` |
| URI de Mongo de Flota | `C:\Users\Usuario\.flota-mongo-uri.txt` |
| Clave de Gemini | `C:\Users\Usuario\.flota-gemini.txt` |
| Token de R2 (access, secret, endpoint) | `C:\Users\Usuario\.flota-r2.txt` |
| Admin de Dani | `C:\Users\Usuario\.flota-admin.txt` |

El CLI `fly` del PC está logueado en la cuenta VIEJA: usar siempre
`FLY_API_TOKEN` desde el fichero. Para meter secretos en Fly, desde **bash**
(`printf 'X=%s\n' "$(...)" | fly secrets import --stage -a flota-backend`):
desde PowerShell 5.1 el pipe mete un BOM en el nombre y falla.

## Cómo desplegar

```
# backend (desde backend/)
fly deploy --remote-only -a flota-backend --strategy immediate --ha=false
# web (desde frontend/)
VITE_API_URL=https://flota-backend.fly.dev/api npx vite build
node ../scripts/sellar-build.mjs
npx wrangler pages deploy dist --project-name flota --branch main --commit-dirty=true
```

Antes de desplegar, lo de CLAUDE.md («Antes de dar algo por bueno»): checks,
eslint, build, `pytest backend/tests` (506 en verde el 26-09) y humo de Playwright.
**Si algo se pone rojo, no se despliega.**

## Reglas de Dani (siempre)

- No borrar ni reescribir nada que ya funcione. Nada destructivo e irreversible
  (borrar datos reales, force push, migraciones que pierdan información) sin avisar.
- No tocar ni imprimir secretos.
- Si un despliegue falla: rollback y pegar el error, sin improvisar parches.
- No inventar: lo que no se pueda comprobar se marca «no verificado» y se dice cómo probarlo.
- Sin falsos positivos: cada hallazgo con su prueba.
- En español, directo; desplegar y subir a git al acabar cada cosa.

## Qué se hizo el 26-09-2026

1. **Datos de FlotaDSP recuperados y traspasados** a Flota (144.712 documentos:
   conductores, furgonetas, inspecciones, usuarios, DNR, turnos…). Solo
   inserta; manifiesto para deshacer en
   `C:\Users\Usuario\Documents\copia-flotadsp-2026-09-26\traspaso_manifiesto.json.gz`.
   Copia COMPLETA de la base vieja en esa misma carpeta (formato mongodump).
2. **Plantilla del día** (/panel/plantilla): pegando texto o captura; lee sin IA
   si la IA falla; edición compartida celda a celda.
3. **DNR diaria** (/panel/diarios, permiso `diarios`): Daily Report subido a mano.
4. **flotadsp.com** sirve Flota (Worker). **IA** con clave nueva y modelo actual.
5. **Fotos** recuperadas (R2 de winiw) y R2 conectado; primera copia de la base en R2.
6. **Pasada con datos reales** (193 GET, 238 mutaciones, 37 pantallas en
   escritorio y móvil): arreglados el historial de daños (500) y el ranking
   (7 s → 0,18 s); textos «nave/station» → «centro».

## Pendiente (por prioridad)

1. **Revisión legal** en curso: ver `docs/REVISION_LEGAL.md` (si existe, es la
   última versión; sus acciones marcadas «decide Dani» NO se hacen sin él).
2. **Atlas se suspende el 01-10-2026** (la organización tiene facturas sin
   pagar y Dani no quiere pagar). `cluster1` parece estar en esa misma
   organización: hace falta una organización NUEVA gratis, clúster M0, copiar
   `flota`, `flota_global`, `dsp_demo`, `edge_os` y cambiar `MONGO_URL` en Fly.
   Hay copia diaria en R2 (04:00) y la copia local, pero la app se caería.
3. Correo (Resend/Brevo), WhatsApp (claves `WHATSAPP_*`) y pagos: sin
   configurar. Telegram SÍ funciona (su config venía en los datos).
4. Investigaciones de DNR y portal `/dnr/t/` de FlotaDSP: no recuperados
   (están en el commit raíz `cfed72b` si Dani los pide).
5. Capturas para la portada (`ProductoReal.jsx` se oculta si no hay imágenes).

## Trampas conocidas

- FastAPI de esta versión registra las rutas al arrancar: para listarlas,
  pedir `/openapi.json` al servidor en marcha, no `server.app.routes`.
- La demo es de solo lectura (403 al escribir). Para probar escrituras:
  backend local contra bases `prueba_*` del clúster (ver cómo en la sesión
  c3af8cab: `api_prueba.py` con token de mantenimiento `maintenance-claude`).
- La caché DNS de Windows guarda los «no existe»: `ipconfig /flushdns` o
  `curl --resolve flotadsp.com:443:104.21.49.241`.
- El login de Cloudflare en el navegador integrado falla por la comprobación
  anti-robots: que Dani lo haga en su Chrome.
