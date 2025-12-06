# syntax=docker/dockerfile:1.6

################################
#   STAGE 1 : NX BUILDER       #
################################
FROM node:20-alpine AS builder

WORKDIR /workspace

# Fichiers de base du monorepo Nx
COPY package.json package-lock.json nx.json tsconfig.base.json ./

# Sources des apps et libs Nx
COPY apps ./apps
COPY libs ./libs
# (si tu as besoin d'autres fichiers globaux pour le build, tu peux les ajouter ici)

# Install des dépendances (avec devDependencies pour builder Angular/Node)
# Ici on laisse les scripts s'exécuter (prepare, postinstall...) pour un environnement de build complet.
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

# Build global via ton script Nx déjà configuré
# => construit core-domain, core-application, node, site
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

# User non-root avec UID/GID fixes pour compatibilité avec les volumes montés
RUN addgroup -g 1000 nodegrp \
    && adduser -u 1000 -S -D -h /app -G nodegrp nodeusr

################################
#   INSTALL DEPENDANCES RUNTIME
################################
# On repart du package.json racine du monorepo
COPY package.json package-lock.json ./

# Ici on NE VEUT PAS :
# - les devDependencies
# - les optionalDependencies
# - NI les scripts npm (prepare, postinstall, etc. → husky, etc.)
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
    [ -f "${UI_ROOT}/index.html" ] || (echo "ERROR: index.html not found in ${UI_ROOT}" && exit 1); \
    ls -l "${UI_ROOT}" || true

################################
#   CONTENT / ASSETS           #
################################
RUN mkdir -p "${CONTENT_ROOT}" "${ASSETS_ROOT}" \
    && chown -R nodeusr:nodegrp "${CONTENT_ROOT}" "${ASSETS_ROOT}" "${UI_ROOT}"

# Optionnel : on vire les sourcemaps Angular en prod
RUN find "${UI_ROOT}" -type f -name "*.map" -delete || true

USER nodeusr

EXPOSE 3000

# Point d'entrée : build Nx de l'app Node
CMD ["node", "dist/apps/node/main.js"]
