# syntax=docker/dockerfile:1.7
# Histor — una imagen, dos destinos:
#   docker build --target web    -t histor-web .
#   docker build --target worker -t histor-worker .
ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
# El secreto opcional `npm_ca` permite construir detrás de un proxy con CA propia
# (docker build --secret id=npm_ca,src=ca.crt …); en un entorno normal no hace falta.
RUN --mount=type=secret,id=npm_ca,required=false \
    sh -c 'if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; npm ci --no-audit --no-fund'

FROM deps AS build
COPY . .
RUN npm run build -w @histor/web && npm run build -w @histor/worker

# ── Web (Next.js standalone) ──
FROM node:${NODE_VERSION} AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 HISTOR_SERVICE=web
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

# ── Worker (pipeline 24/7, cola, newsletters, CLI) ──
FROM node:${NODE_VERSION} AS worker-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN --mount=type=secret,id=npm_ca,required=false \
    sh -c 'if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; npm ci --omit=dev --no-audit --no-fund --workspace @histor/core --include-workspace-root=false'

FROM node:${NODE_VERSION} AS worker
WORKDIR /app
ENV NODE_ENV=production HISTOR_SERVICE=worker HISTOR_MIGRATIONS_DIR=/app/packages/core/migrations
COPY --from=worker-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/packages/core/migrations ./packages/core/migrations
USER node
EXPOSE 8081
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:8081/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica migraciones al arrancar (idempotente) y lanza el worker.
CMD ["sh", "-c", "node apps/worker/dist/cli.js migrate && node apps/worker/dist/index.js"]
