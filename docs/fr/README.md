# Publish to personnal VPS

Stack d'auto-hébergement (monorepo Nx) qui transforme des notes Markdown en site navigable et fournit un plugin Obsidian pour pousser le contenu vers votre serveur.

## Structure du monorepo

- `apps/node` : backend Node.js (Express) qui rend le Markdown en HTML et maintient `_manifest.json`.
- `apps/site` : SPA Angular qui consomme le manifeste pour afficher le site publié (routing, recherche, viewer).
- `apps/publish-to-personal-vps` : plugin Obsidian qui empaquette les notes et les envoie au backend.
- Librairies partagées : `libs/core-domain`, `libs/core-application`.

## Applications

### Backend — `apps/node`

- Stack : Node.js 22, Express, markdown-it, Zod (validation), TypeScript.
- Rôles :
  - Réception des uploads (Markdown + frontmatter), rendu HTML, persistance des fichiers, mise à jour de `_manifest.json`.
  - Exposition de l'API et du contenu statique (`/content/**`), plus fallback SPA pour le frontend.
- Routes principales :
  - `GET /api/ping` — santé/statut.
  - `POST /api/upload` — upload batch ; attend l'en-tête `x-api-key` et un payload JSON (tableau de notes avec markdown/frontmatter).
  - Statique : `/content/**` servi depuis `CONTENT_ROOT`.
- Environnement (TODO : compléter les valeurs) :
  - TODO : `API_KEY` (requis pour les uploads).
  - TODO : `CONTENT_ROOT` (racine FS pour le HTML généré et le manifeste).
  - TODO : `PORT`, `UI_ROOT`, `NODE_ENV`.
- Scripts : `npm run build:node`, `npm run start node`, tests via `npm run test`.

### Frontend — `apps/site`

- Stack : Angular, TypeScript, SCSS.
- Rôles :
  - Récupère `/content/_manifest.json`.
  - Routes : accueil (listing/recherche), `p/:slug` (viewer qui récupère le HTML via `filePath`).
- Recherche sur titre/tags ; navigation pilotée par le manifeste.
- Build : `npm run build:site` ; dev : `npm run start site`.
- TODO : Ajouter branding/thème et lier des captures dans `docs/assets`.

### Plugin Obsidian — `apps/publish-to-personal-vps`

- Stack : TypeScript, API Obsidian, bundle esbuild.
- Rôles :
  - Packager le plugin (`dist/publish-to-personal-vps`), maintenir `manifest.json` et `versions.json` en phase.
  - Le flux de release zipe le plugin et le publie comme asset de release GitHub.
- Build/package : `npm run build:plugin` puis `npm run package:plugin`.
- Config release : `apps/publish-to-personal-vps/.releaserc.json` (utilisée via la semantic-release racine).
- TODO : Ajouter le lien marketplace une fois approuvé ; ajouter mode d'emploi et captures (à placer dans `docs/assets`).

### Librairies partagées

- `libs/core-domain` : entités, value objects, ports, erreurs, utilitaires.
- `libs/core-application` : services/cas d'usage (catalogue, publication, sessions, parsing de vault, etc.).

## Développement

Prérequis : Node.js 22+, npm.

Installation :

```bash
npm install --no-audit --no-fund
```

Scripts utiles :

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run build:node` / `npm run build:site` / `npm run build:plugin`
- `npm run package:plugin`
- `npm run start node` / `npm run start site`

## Release et CI/CD

Workflow : `.github/workflows/ci-release.yml`

- `quality` : lint, tests, build (Nx), publication de l'artefact `dist`.
- `semantic-release` : incrémente les versions (manifest/versions du plugin inclus), reconstruit et package le plugin, zippe et crée une release GitHub avec l'asset.
- `docker-images` : construit et pousse les images Docker vers le registre privé et Docker Hub (tag version, short SHA, latest).

Config de release : `release.config.cjs` (sync de version, changelog, commits/tags git, packaging du plugin, assets GitHub).

Secrets/vars requis (CI) : `REGISTRY_URL`, `IMAGE_NAME`, `REGISTRY_USER`, `REGISTRY_PASSWORD`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `GITHUB_TOKEN` (fourni par Actions).

TODO : Documenter les clés/vars par environnement et comment déclencher `workflow_dispatch` pour les releases.

## Docker

- Conteneur unique qui exécute le backend et sert le build Angular + `/content` statique.
- Build : Dockerfile multi-stage qui construit frontend + backend, puis lance une image Node runtime.
- Comportement runtime :
  - Sert `/api/**` (backend).
  - Sert `/content/**` depuis le volume `CONTENT_ROOT`.
  - Sert le build Angular à `/` avec fallback SPA.
- Exemple :

```bash
docker build -t obsidian-vps-publish:latest .
docker run -d --name obsidian-vps-publish \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e API_KEY=change-me \
  -e CONTENT_ROOT=/content \
  -e UI_ROOT=/ui \
  -v $(pwd)/content:/content \
  obsidian-vps-publish:latest
```

- TODO : Ajouter des exemples docker compose/K8s et la configuration du registre.

## Soumission Obsidian

- La dernière release contient `dist/publish-to-personal-vps.zip` ainsi que `manifest.json` et `versions.json` à jour.
- Suivre https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin pour la soumission marketplace.
- TODO : Ajouter le lien vers l'entrée publiée une fois disponible.
