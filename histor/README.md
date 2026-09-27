# Histor

**Periódico digital global, multidioma y automatizado que solo publica como
hecho lo que puede verificar.** Descubre acontecimientos en fuentes públicas y
legales, los contrasta con fuentes independientes, redacta noticias originales
en 6 idiomas, las publica, las actualiza con historial visible y las retira
con una nota cuando dejan de sostenerse.

> Prioridades: veracidad > velocidad > relevancia > crecimiento > monetización.

- **Estado y pendientes:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
- **Arquitectura:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Cómo se verifica:** [`docs/VERIFICATION.md`](docs/VERIFICATION.md)
- **API:** [`docs/API.md`](docs/API.md) · **Operación y despliegue:** [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- **Seguridad:** [`docs/SECURITY.md`](docs/SECURITY.md) · **Fuentes:** [`docs/SOURCES.md`](docs/SOURCES.md)
- **Marca:** [`docs/BRAND.md`](docs/BRAND.md) · **Precios:** [`docs/PRICING.md`](docs/PRICING.md)

## Qué hay dentro

```
histor/
├── packages/core   dominio, verificación, redacción, pipeline, datos (Drizzle + Postgres), servicios
├── apps/web        Next.js 15: web pública (6 idiomas), panel de administración y API /api/v1
├── apps/worker     procesos 24/7 (pipeline, cola, newsletters, redes, mantenimiento) y CLI
├── infra/          plantillas de Fly.io y copias de seguridad
├── Dockerfile      imágenes de web y worker
└── docker-compose.yml
```

## Arrancar en local (5 minutos, sin ninguna clave)

Requisitos: Node 20.18+ (probado con 22) y PostgreSQL 15+ (o `docker compose up -d db`).

```bash
cd histor
npm ci
cp .env.example .env                       # sin claves externas funciona en modo local/DEMO
export DATABASE_URL=postgres://histor:histor@localhost:5432/histor_dev

npm run demo:seed                          # migra, carga la referencia y pasa el escenario DEMO por el pipeline real
DEMO_MODE=1 npm run dev                    # http://localhost:3000  (redirige a /es, /en… según el navegador)
npm run dev -w @histor/worker              # en otra terminal: el worker 24/7
```

Panel: crea el administrador con `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run cli -w @histor/worker -- create-admin`
y entra en `/admin` (en producción exige verificación en dos pasos).

**El modo DEMO** muestra solo contenido ficticio, con un aviso fijo, sin
indexar, sin publicar en redes ni enviar alertas. Se borra con `npm run demo:purge`.

## Contenido real

```bash
npm run cli -w @histor/worker -- seed                 # idiomas, países, secciones, ~40 fuentes reales, precios, mesas, newsletters
npm run sources:check -- --update                     # comprueba cada fuente (robots.txt, respuesta, formato) y pausa las que fallen
npm run build && INGEST_ENABLED=1 npm run worker      # el worker empieza a leer, verificar y publicar
```

## Comprobar que todo funciona

```bash
npm run typecheck && npm run lint -w @histor/web
npm test                                              # núcleo (unitarias, adversarias, integración con Postgres) y worker
npm run build
cd apps/web && npx playwright test                    # E2E escritorio y móvil contra next start (base *_e2e propia)
node scripts/check-secrets.mjs                        # sin secretos versionados
```

## Principios que el código hace cumplir

- Nada se publica como hecho sin superar el umbral de confianza **y** tener fuentes
  independientes (o la fuente oficial primaria que produce el dato).
- Viral no es verdadero: el impulso (momentum) nunca suma confianza.
- Las redes sociales son pistas, no pruebas.
- Cada frase publicada se puede rastrear a su evidencia; las citas deben existir
  literalmente en una fuente fiable y con el mismo autor.
- Autores = mesas automáticas declaradas como tales. No se inventan periodistas.
- Imágenes: solo con licencia; nunca imágenes generadas presentadas como fotos.
- Correcciones y retiradas visibles; las URL no cambian nunca.
- Ningún secreto en el código; ningún dato legal inventado (`[PENDIENTE: …]`).
