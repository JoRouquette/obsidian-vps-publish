# syntax=docker/dockerfile:1.6

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS builder

ENV CI=true \
    HUSKY=0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /workspace

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs
COPY scripts ./scripts

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --legacy-peer-deps

RUN npm run build


FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    CONTENT_ROOT=/content \
    ASSETS_ROOT=/assets \
    LOG_FILE_PATH=/app/tmp/logs/node.log \
    UI_ROOT=/ui \
    UI_SERVER_ROOT=/ui-server \
    SSR_ENABLED=true \
    NODE_OPTIONS=--enable-source-maps \
    NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apk add --no-cache gosu wget

WORKDIR /app

COPY --from=builder /workspace/dist/apps/node/package.json ./package.json
COPY --from=builder /workspace/dist/apps/node/package-lock.json ./package-lock.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund --legacy-peer-deps

COPY --from=builder /workspace/dist/apps/node ./dist/apps/node
COPY --from=builder /workspace/dist/apps/site ./dist/apps/site

RUN set -eux; \
    mkdir -p "${CONTENT_ROOT}" "${ASSETS_ROOT}" "${UI_ROOT}" "${UI_SERVER_ROOT}"; \
    BDIR="$(find /app/dist/apps/site -type d -name browser -print -quit || true)"; \
    if [ -n "$BDIR" ]; then \
    cp -r "$BDIR/"* "${UI_ROOT}/"; \
    elif [ -f "/app/dist/apps/site/index.html" ]; then \
    cp -r /app/dist/apps/site/* "${UI_ROOT}/"; \
    else \
    echo "ERROR: Angular browser build not found."; \
    ls -R /app/dist/apps/site || true; \
    exit 1; \
    fi; \
    if [ -f "${UI_ROOT}/index.csr.html" ] && [ ! -f "${UI_ROOT}/index.html" ]; then \
    mv "${UI_ROOT}/index.csr.html" "${UI_ROOT}/index.html"; \
    fi; \
    [ -f "${UI_ROOT}/index.html" ] || (echo "ERROR: index.html not found in ${UI_ROOT}" && exit 1); \
    SDIR="$(find /app/dist/apps/site -type d -name server -print -quit || true)"; \
    if [ -n "$SDIR" ]; then \
    cp -r "$SDIR/"* "${UI_SERVER_ROOT}/"; \
    elif [ "${SSR_ENABLED}" = "true" ]; then \
    echo "WARNING: Angular SSR bundle not found; SSR will fall back to CSR."; \
    fi; \
    find "${UI_ROOT}" -type f -name "*.map" -delete || true

EXPOSE 3000

RUN printf '#!/bin/sh\n\
    set -e\n\
    \n\
    if [ "$(id -u)" != "0" ]; then\n\
    echo "Running as non-root user $(id -u):$(id -g)"\n\
    exec "$@"\n\
    fi\n\
    \n\
    echo "Running as root - fixing permissions for mounted volumes..."\n\
    LOG_DIR="$(dirname "${LOG_FILE_PATH:-/app/tmp/logs/node.log}")"\n\
    mkdir -p "$LOG_DIR"\n\
    touch "${LOG_FILE_PATH:-/app/tmp/logs/node.log}"\n\
    for dir in "${CONTENT_ROOT}" "${ASSETS_ROOT}" "${UI_ROOT}" "${UI_SERVER_ROOT}" "$LOG_DIR"; do\n\
    if [ -d "$dir" ]; then\n\
    chown -R node:node "$dir" 2>/dev/null || {\n\
    echo "Warning: Could not change ownership of $dir (may be expected on some systems)"\n\
    }\n\
    fi\n\
    done\n\
    chown node:node "${LOG_FILE_PATH:-/app/tmp/logs/node.log}" 2>/dev/null || true\n\
    \n\
    echo "Starting application as user node ($(id -u node):$(id -g node))..."\n\
    exec gosu node "$@"\n' > /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/apps/node/main.js"]
