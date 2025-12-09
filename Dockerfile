# syntax=docker/dockerfile:1.6

################################
#   STAGE 1 : NX BUILDER       #
################################
FROM node:20-alpine AS builder

WORKDIR /workspace

COPY package.json package-lock.json nx.json tsconfig.base.json ./

COPY apps ./apps
COPY libs ./libs

RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

RUN npm run build


################################
#   STAGE 2 : RUNTIME          #
################################
FROM node:20-alpine AS runtime

# Valeurs par défaut – surchargées par docker-compose / .env.*
ENV NODE_ENV=production \
    PORT=3000 \
    CONTENT_ROOT=/content \
    ASSETS_ROOT=/assets \
    UI_ROOT=/ui \
    NODE_OPTIONS=--enable-source-maps

# Utilitaires pour le healthcheck (wget)
RUN apk add --no-cache wget

WORKDIR /app


################################
#   INSTALL DEPENDANCES RUNTIME
################################
# On repart du package.json racine du monorepo
COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --omit=optional --no-audit --no-fund --ignore-scripts \
    && npm cache clean --force


################################
#   COPIE DES BUILDS NX        #
################################
# On copie tout le dossier dist généré par Nx (apps + libs)
COPY --from=builder /workspace/dist ./dist


################################
#   FRONTEND STATIC (Angular)  #
################################
# On cherche le dossier "browser" d'Angular dans dist/apps/site
RUN set -eux; \
    mkdir -p "${UI_ROOT}"; \
    BDIR="$(find /app/dist/apps/site -type d -name browser -print -quit || true)"; \
    if [ -n "$BDIR" ]; then \
    cp -r "$BDIR/"* "${UI_ROOT}/"; \
    elif [ -f "/app/dist/apps/site/index.html" ]; then \
    # fallback si la structure diffère
    cp -r /app/dist/apps/site/* "${UI_ROOT}/"; \
    else \
    echo "ERROR: Angular build not found (dist/apps/site/**/browser). Tree:"; \
    ls -R /app/dist/apps/site || true; \
    exit 1; \
    fi; \
    if [ -f "${UI_ROOT}/index.csr.html" ] && [ ! -f "${UI_ROOT}/index.html" ]; then \
    echo "SSR build detected: renaming index.csr.html to index.html"; \
    mv "${UI_ROOT}/index.csr.html" "${UI_ROOT}/index.html"; \
    fi; \
    [ -f "${UI_ROOT}/index.html" ] || (echo "ERROR: index.html not found in ${UI_ROOT}" && exit 1); \
    ls -l "${UI_ROOT}" || true


################################
#   CONTENT / ASSETS           #
################################
RUN mkdir -p "${CONTENT_ROOT}" "${ASSETS_ROOT}"

RUN find "${UI_ROOT}" -type f -name "*.map" -delete || true

EXPOSE 3000

RUN apk add --no-cache gosu

RUN printf '#!/bin/sh\n\
    set -e\n\
    \n\
    # Si on est déjà node, on lance directement (production avec user: node dans docker-compose)\n\
    if [ "$(id -u)" != "0" ]; then\n\
    echo "Running as non-root user $(id -u):$(id -g)"\n\
    exec "$@"\n\
    fi\n\
    \n\
    # Sinon, on est root (dev local) : fixer les permissions puis basculer sur node\n\
    echo "Running as root - fixing permissions for mounted volumes..."\n\
    for dir in "${CONTENT_ROOT}" "${ASSETS_ROOT}" "${UI_ROOT}"; do\n\
    if [ -d "$dir" ]; then\n\
    chown -R node:node "$dir" 2>/dev/null || {\n\
    echo "Warning: Could not change ownership of $dir (may be expected on some systems)"\n\
    }\n\
    fi\n\
    done\n\
    \n\
    echo "Starting application as user node ($(id -u node):$(id -g node))..."\n\
    exec gosu node "$@"\n' > /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/apps/node/main.js"]
