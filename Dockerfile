# syntax=docker/dockerfile:1.6

FROM node:20.19.0-alpine3.20 AS frontend-builder
WORKDIR /app/frontend

# Dépendances front
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Sources front
COPY apps/frontend/ ./
# Build Angular (doit produire dist/<project>/browser)
RUN npm run build

FROM node:20.19.0-alpine3.20 AS backend-builder
WORKDIR /app/backend

# Dépendances back
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Sources back
COPY apps/backend/ ./
# Transpile TypeScript -> dist
RUN npm run build

FROM node:20.19.0-alpine3.20 AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    LOGGER_LEVEL=debug \
    CONTENT_ROOT=/content \
    ASSETS_ROOT=/assets \
    UI_ROOT=/ui \
    API_PREFIX=/api \
    AUTHOR_NAME="Jonathan Rouquette" \
    REPO_URL="https://github.com/JoRouquette/scribe-ektaron" 

# Paquets de base (wget pour healthcheck)
RUN apk --no-cache upgrade && apk add --no-cache wget

# ---- Backend runtime deps ----
WORKDIR /app/apps/backend
COPY --from=backend-builder /app/backend/package.json ./package.json
COPY --from=backend-builder /app/backend/package-lock.json ./package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --omit=optional --no-audit --no-fund \
    && npm cache clean --force

# Code back
COPY --from=backend-builder /app/backend/dist ./dist

# ---- Frontend static ----
WORKDIR /app
COPY --from=frontend-builder /app/frontend/dist /app/ui-src

# Copie robuste du bon dossier "browser" (Angular 16+)
RUN set -eux; \
    mkdir -p "${UI_ROOT}"; \
    BDIR="$(find /app/ui-src -type d -name browser -print -quit || true)"; \
    if [ -n "$BDIR" ]; then \
    cp -r "$BDIR/"* "${UI_ROOT}/"; \
    elif [ -f "/app/ui-src/index.html" ]; then \
    cp -r /app/ui-src/* "${UI_ROOT}/"; \
    else \
    echo "ERROR: Angular build not found (dist/**/browser). Tree:"; \
    ls -R /app/ui-src || true; \
    exit 1; \
    fi; \
    rm -rf /app/ui-src; \
    [ -f "${UI_ROOT}/index.html" ]; \
    addgroup -S nodegrp && adduser -S -D -h /app -G nodegrp nodeusr; \
    mkdir -p "${CONTENT_ROOT}"; \
    chown -R nodeusr:nodegrp /app "${CONTENT_ROOT}" "${UI_ROOT}"

USER nodeusr

# Nettoyage (cartes sourcemaps, caches)
RUN find "${UI_ROOT}" -type f -name "*.map" -delete || true
ENV NODE_OPTIONS=--enable-source-maps

EXPOSE 3000

# Démarrage backend (doit servir /ui en statique + fallback SPA)
CMD ["node", "apps/backend/dist/main.js"]
