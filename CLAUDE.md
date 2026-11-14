# FDS — la app de reparto y el panel de tu flota

> **Sesión nueva: lee primero `docs/ESTADO.md`** (qué está hecho, qué falta,
> credenciales, cómo desplegar y reglas). Al acabar, actualízalo y `git push`.
> Una sola sesión a la vez sobre este repo.

Producto para **cualquier empresa con vehículos** (reparto, logística, alquiler,
servicios técnicos, obra…): inspecciones con foto y detección de daños por IA,
taller y órdenes de reparación, vencimientos (ITV, seguro, renting), operación
diaria (asignación, checklist, cuadrante), equipo (conductores, incorporaciones,
empleo), chat con asistente IA y avisos por WhatsApp.

Nació el 25-09-2026 como copia depurada de FlotaDSP (producto de Dani para
repartidores de Amazon). De aquella se quitó TODO lo de Amazon: extensión de
Cortex, paquetes, scorecard, DNR/pre-DNR, WHC, DSC, debrief, rutas, Transporter
ID, métricas y sus tests. **No es FlotaDSP**: otra marca, otra base de datos,
otra infraestructura. Para la flota de Dani han vuelto, como módulos FUERA del
estándar y metiendo los datos a mano (nunca con la extensión): plantilla del
día, DNR diaria (`diarios`), horas/WHC pegando el plan (`horas`) y el ID de
reparto en la ficha (`transporter_id`).

## Regla que no se rompe

**Nunca se despliega sobre FlotaDSP.** Los scripts de despliegue leen el
destino de `despliegue.local.json` (fuera de git; ejemplo en
`despliegue.ejemplo.json`) o de variables `FLOTA_*`, y `scripts/destino.ps1`
se niega si el destino es infraestructura de FlotaDSP (el proyecto de Pages
`flotadsp-v2` o una app de Fly `flotadsp-*`). El DOMINIO flotadsp.com sí es de
Flota desde el 26-09-2026 (lo pidió Dani). `backend/fly.toml` apunta a
`flota-backend`; `deploy-backend.ps1` para si alguien lo cambia a una app de
FlotaDSP. No hay ningún secreto escrito en el código: todo va por entorno.

## Estructura

- `backend/server.py` — FastAPI monolítico (UTF-8 con BOM: leer con
  `utf-8-sig`), Motor/MongoDB multiempresa (una base por empresa + una global).
  `whatsapp.py`, `analitica.py`, `fiabilidad.py`, `piezas.py`, `seguimiento.py`.
- `frontend/` — React 18 + Vite + Tailwind. Panel en `src/panel/`, páginas
  públicas en `src/pages/`, portal del conductor en `src/pages/driver/`.
  i18n en 6 idiomas (`src/i18n.jsx`); la app de reparto y la portada, con `tx()` de
  `src/lib/idioma.js` (diccionario `src/lib/textosRuta*.js`, 7 idiomas).
- `frontend/functions/` — Cloudflare Pages Functions (SEO de ofertas, sitemap,
  robots). La API la leen de la variable `API_URL` del proyecto de Pages.
- `ai-service/` — microservicio opcional de visión (YOLO/SAM). Sin él, la IA
  de daños usa Gemini.
- `infra/mongo/` — el MongoDB de Flota en Fly (`flota-mongo`, solo red privada), desde el
  23-10-2026; antes era un M0 de Atlas. Restaurar: `backend/scripts/restaurar_copia.py`.
- `scripts/` — chequeos (`check-*.mjs`, `check_*.py`) y despliegue (`*.ps1`).
- `tools/` — herramientas de mantenimiento (poda, código muerto, cadenas).

## La marca

**FDS en todo** desde el 29-10-2026 (Dani: «unifica todo a FDS»): web, panel, app, correos y PDF. «Flota»
queda solo como nombre interno del repo y de la infraestructura (`flota-backend`, `flota-mongo`). Un solo sitio: `frontend/src/marca.js` (nombre, lema, IA, correo) y
`MARCA_NOMBRE` en el backend. `scripts/check-marca.mjs` falla si un texto
visible nombra otra plataforma o la marca escrita a mano. El logo es
`frontend/public/favicon.svg`; los PNG salen de él con
`node scripts/generar-iconos.mjs`. Los enlaces (portal, taller, empleo) salen
del dominio donde se sirve la app (`origen()`), nunca escritos. La única excepción (09-11-2026): dentro de la app de
iPhone la web se sirve desde `capacitor://localhost`, que fuera de la app no abre, y allí `origen()` da la web pública
(`VITE_WEB_ORIGIN`, que pasa `app-ios.yml`; por defecto `https://flotadsp.com`).

## La app de iPhone no vende ni menciona pagos

Apple rechazó la 2.4.1 (09-11-2026) por 2.1(b) y 3.1.1: veía el plan, un código de regalo e «Invita y gana». Desde
entonces, dentro de la app de iPhone (`sinPagos()` = `esAppIOS()`, `frontend/src/lib/plataforma.js`; `window.Capacitor`
solo existe allí) NO puede verse nada de suscripción, plan, precio, prueba con días, «gratis hasta…», tope de paradas,
códigos, cupones, regalos, bonos, «Invita y gana», cartera, Stripe o PayPal. La web y Android no cambian. Una pantalla o
texto nuevo con cualquiera de eso lleva `sinPagos()`; un mensaje de error nuevo del servidor que lo mencione también
(`HABLA_DE_PAGOS`). Lo vigila `frontend/e2e/ios-sin-pagos.spec.js` (cada pantalla con su control en la web) y el alta
desde el iPhone manda `desde_ios` para que el servidor no le mande correos de plan o prueba
(`backend/tests/test_alta_ios.py`). Detalle, qué se esconde y cómo se reenvía a Apple: `docs/APP_STORE.md`
(«Rechazo del 09-11-2026»).

## El diseño compacto de la app de reparto

Desde el 08-11-2026 las pantallas de reparto (web y nativa) se montan con unos tokens y unas piezas comunes, no con
clases, colores ni alturas a mano:

- **Web:** los tokens están en `frontend/tailwind.config.js` (la letra `text-pie|sec|etiqueta|texto|boton|nombre|campo|
  titulo|cifra|guia|paquete` y los colores `ruta-*`) y en `frontend/src/index.css` (`--letra`, la «Letra más grande», y
  `--r-*`, los colores con significado); las piezas, en `frontend/src/pages/driver/piezas/` (Cabecera, Boton, Aviso, Hoja,
  FilaParada, Chip…).
- **Nativa:** `fds/ui/Tema.kt` (letra, formas, `Paleta` y `Extra`) y `fds/ui/Componentes.kt` (`Esp`, `Alto` y las piezas).
- **La regla:** una pantalla nueva de reparto se monta con las piezas. Ni `text-[13px]`, ni `#hex`, ni `fontSize =`, ni
  `Color(0x…)`, ni alturas fijas con texto dentro. `check-tokens-ruta.mjs` y `check-tokens-nativa.mjs` lo vigilan en TODAS
  las pantallas; las del portal que el diseño no rediseñó están en la lista `EXCEPCIONES` de cada checker, con su tope.
- **Los textos van por `tx()`:** el español es la clave. Lo que dicen las dos apps, con sus 5 idiomas (en, pt, fr, it, de),
  va al final de `frontend/src/lib/textosRutaA.js`; lo que solo dice la nativa, en `app-android/traducciones-nativa.json`.
  `ui/Traducciones.kt` es generado (`node scripts/nativa-idioma.mjs`): no se edita.

## Arrancar en local

```
cd backend && pip install -r requirements.txt
SECRET_KEY=... MONGO_URL=mongodb://localhost:27017 DB_NAME=flota uvicorn server:app --port 8000
cd frontend && npm install && npm run dev      # proxy /api -> localhost:8000
```

## Variables de entorno del backend

Obligatorias: `SECRET_KEY`, `MONGO_URL`. Recomendadas: `DB_NAME`,
`GLOBAL_DB_NAME`, `PUBLIC_BASE_URL_FRONT` (la web), `PUBLIC_BASE_URL_BACKEND`
(la API vista desde fuera, para webhooks), `CORS_ORIGINS`, `CORREO_CONTACTO`,
`EMAIL_FROM`, `MARCA_NOMBRE`, `SUPERADMIN_USERNAME` + `SUPERADMIN_PASSWORD`
(el super-admin del producto), `ADMIN_USERNAME` + `ADMIN_PASSWORD` (primer
admin). Opcionales: `GEMINI_API_KEY`, R2 (`R2_*`), correo (`RESEND_API_KEY`,
`BREVO_API_KEY`), WhatsApp (`WHATSAPP_*`), pagos (`LS_*`, `STRIPE_*`), push
(`VAPID_*`). Frontend: `VITE_API_URL` solo si la API va en otro dominio.

## Antes de dar algo por bueno

```
node scripts/check-existe.mjs && node scripts/check-huerfanos.mjs && node scripts/check-marca.mjs
node scripts/check-i18n.mjs && node scripts/check-permisos.mjs && node scripts/check-modulos.mjs
node scripts/check-promo.mjs
node scripts/check-guias-renting.mjs     # /devolucion-renting: guías iguales a lo verificado, «se factura» solo donde lo dicen
node scripts/check-tokens-ruta.mjs && node scripts/check-tokens-nativa.mjs     # el diseño compacto de reparto
node scripts/check-textos-ruta.mjs && node scripts/nativa-idioma.mjs --comprobar   # sus traducciones, web y nativa
cd frontend && npx eslint src && npx vite build
python -m pytest backend/tests -q --ignore=backend/tests/test_api.py   # test_api necesita Mongo
cd frontend && npx playwright test humo --project=escritorio         # todas las pantallas, API simulada
```

`scripts/i18n-muertas.mjs` lista (y con `--borrar` quita) traducciones que ya
no usa nadie (las del panel; las de la app de reparto, `textosRuta*.js`, las lista `check-textos-ruta.mjs` como «sin uso»,
que no pide ni la web, ni la nativa ni el servidor, y se quitan a mano). `tools/imports_sin_usar.py` quita imports que ESLint marca.

## Nombres heredados que se quedan a propósito

- `account_type: "dsp"` es el valor interno de «cuenta de cliente»; cambiarlo
  obligaría a migrar datos sin ganar nada. No se enseña en pantalla.
- La colección `daily_assignments` guarda `route` en cada salida: es la ruta,
  zona o servicio del día, opcional para cualquier empresa.
- La tienda de ropa y el panel de negocio son del DUEÑO del producto (solo
  super-admin), no de las empresas cliente.
