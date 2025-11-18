# syntax=docker/dockerfile:1.6

########################
#  FRONTEND BUILDER   ##
########################
FROM node:current-alpine3.22 AS frontend-builder
WORKDIR /app/frontend

# Dépendances front
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Sources front
COPY apps/frontend/ ./
# Build Angular (doit produire dist/<project>/browser ou équivalent)
RUN npm run build


########################
#  BACKEND BUILDER    ##
########################
FROM node:current-alpine3.22 AS backend-builder
WORKDIR /app/backend

# Dépendances back
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Sources back
COPY apps/backend/ ./
# Transpile TypeScript -> dist
RUN npm run build


########################
#      RUNTIME        ##
########################
FROM node:current-alpine3.22 AS runtime

# Defaults (surchargés via docker-compose / env)
ENV NODE_ENV=production \
    PORT=3000 \
    CONTENT_ROOT=/content \
    ASSETS_ROOT=/assets \
    UI_ROOT=/ui \
    API_PREFIX=/api \
    NODE_OPTIONS=--enable-source-maps

# Dépendances runtime uniquement
RUN apk add --no-cache wget

WORKDIR /app

# User non-root
RUN addgroup -S nodegrp \
    && adduser -S -D -h /app -G nodegrp nodeusr

########################
#    BACKEND RUNTIME  ##
########################

# Dépendances backend en prod
COPY --from=backend-builder /app/backend/package.json ./backend/package.json
COPY --from=backend-builder /app/backend/package-lock.json ./backend/package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    cd backend \
    && npm ci --omit=dev --omit=optional --no-audit --no-fund \
    && npm cache clean --force

# Code back
COPY --from=backend-builder --chown=nodeusr:nodegrp /app/backend/dist ./backend/dist


########################
#   FRONTEND STATIC   ##
########################

# On récupère le dist Angular
COPY --from=frontend-builder --chown=nodeusr:nodegrp /app/frontend/dist /app/ui-src

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
    [ -f "${UI_ROOT}/index.html" ] || (echo "ERROR: index.html not found in ${UI_ROOT}" && exit 1); \
    ls -l "${UI_ROOT}" || true


########################
#    CONTENT / ASSETS ##
########################

RUN mkdir -p "${CONTENT_ROOT}" "${ASSETS_ROOT}" \
    && chown -R nodeusr:nodegrp "${CONTENT_ROOT}" "${ASSETS_ROOT}" "${UI_ROOT}"

# Nettoyage des sourcemaps du front
RUN find "${UI_ROOT}" -type f -name "*.map" -delete || true

USER nodeusr

EXPOSE 3000

# Démarrage backend (doit servir /ui en statique + fallback SPA)
CMD ["node", "backend/dist/main.js"]
