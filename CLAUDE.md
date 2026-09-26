# Flota — gestión de flotas con IA

Producto para **cualquier empresa con vehículos** (reparto, logística, alquiler,
servicios técnicos, obra…): inspecciones con foto y detección de daños por IA,
taller y órdenes de reparación, vencimientos (ITV, seguro, renting), operación
diaria (asignación, checklist, cuadrante), equipo (conductores, incorporaciones,
empleo), chat con asistente IA y avisos por WhatsApp.

Nació el 25-09-2026 como copia depurada de FlotaDSP (producto de Dani para
repartidores de Amazon). De aquella se quitó TODO lo de Amazon: extensión de
Cortex, paquetes, scorecard, DNR/pre-DNR, WHC, DSC, debrief, rutas, Transporter
ID, métricas y sus tests. **No es FlotaDSP**: otra marca, otra base de datos,
otra infraestructura.

## Regla que no se rompe

**Nunca se despliega sobre FlotaDSP.** Los scripts de despliegue leen el
destino de `despliegue.local.json` (fuera de git; ejemplo en
`despliegue.ejemplo.json`) o de variables `FLOTA_*`, y `scripts/destino.ps1`
se niega si el destino contiene «flotadsp». `backend/fly.toml` apunta a
`flota-backend`; `deploy-backend.ps1` para si alguien lo cambia a una app de
FlotaDSP. No hay ningún secreto escrito en el código: todo va por entorno.

## Estructura

- `backend/server.py` — FastAPI monolítico (UTF-8 con BOM: leer con
  `utf-8-sig`), Motor/MongoDB multiempresa (una base por empresa + una global).
  `whatsapp.py`, `analitica.py`, `fiabilidad.py`, `piezas.py`, `seguimiento.py`.
- `frontend/` — React 18 + Vite + Tailwind. Panel en `src/panel/`, páginas
  públicas en `src/pages/`, portal del conductor en `src/pages/driver/`.
  i18n en 6 idiomas (`src/i18n.jsx`; la portada en `src/pages/landingTextos.js`).
- `frontend/functions/` — Cloudflare Pages Functions (SEO de ofertas, sitemap,
  robots). La API la leen de la variable `API_URL` del proyecto de Pages.
- `ai-service/` — microservicio opcional de visión (YOLO/SAM). Sin él, la IA
  de daños usa Gemini.
- `scripts/` — chequeos (`check-*.mjs`, `check_*.py`) y despliegue (`*.ps1`).
- `tools/` — herramientas de mantenimiento (poda, código muerto, cadenas).

## La marca

Un solo sitio: `frontend/src/marca.js` (nombre, lema, IA, correo) y
`MARCA_NOMBRE` en el backend. `scripts/check-marca.mjs` falla si un texto
visible nombra otra plataforma o la marca escrita a mano. El logo es
`frontend/public/favicon.svg`; los PNG salen de él con
`node scripts/generar-iconos.mjs`. Los enlaces (portal, taller, empleo) salen
del dominio donde se sirve la app (`origen()`), nunca escritos.

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
cd frontend && npx eslint src && npx vite build
python -m pytest backend/tests -q --ignore=backend/tests/test_api.py   # test_api necesita Mongo
cd frontend && npx playwright test humo --project=escritorio         # todas las pantallas, API simulada
```

`scripts/i18n-muertas.mjs` lista (y con `--borrar` quita) traducciones que ya
no usa nadie. `tools/imports_sin_usar.py` quita imports que ESLint marca.

## Nombres heredados que se quedan a propósito

- `account_type: "dsp"` es el valor interno de «cuenta de cliente»; cambiarlo
  obligaría a migrar datos sin ganar nada. No se enseña en pantalla.
- La colección `daily_assignments` guarda `route` en cada salida: es la ruta,
  zona o servicio del día, opcional para cualquier empresa.
- La tienda de ropa y el panel de negocio son del DUEÑO del producto (solo
  super-admin), no de las empresas cliente.
