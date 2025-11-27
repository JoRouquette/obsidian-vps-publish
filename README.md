# Publish to personnal VPS

Self-hosted publishing stack (Nx monorepo) that turns Markdown notes into a browsable site and ships an Obsidian plugin to push content to your server.

## Monorepo structure

- `apps/node`: Node.js backend (Express) that renders Markdown to HTML and maintains `_manifest.json`.
- `apps/site`: Angular SPA that consumes the manifest to render the published site (routing, search, viewer).
- `apps/publish-to-personal-vps`: Obsidian plugin that packages notes and pushes them to the backend.
- Shared libs: `libs/core-domain`, `libs/core-application`.

## Applications

### Backend — `apps/node`

- Stack: Node.js 22, Express, markdown-it, Zod (validation), TypeScript.
- Responsibilities:
  - Receive uploads (Markdown + frontmatter), render HTML, persist files, update `_manifest.json`.
  - Serve API and static content (`/content/**`), plus SPA fallback for the frontend.
- Main routes:
  - `GET /api/ping` — health/status.
  - `POST /api/upload` — batch upload; expects `x-api-key` header and JSON payload (notes array with markdown/frontmatter).
  - Static: `/content/**` served from `CONTENT_ROOT`.
- Environment (TODO: document concrete values):
  - TODO: `API_KEY` (required for uploads).
  - TODO: `CONTENT_ROOT` (filesystem root for generated HTML/manifest).
  - TODO: `PORT`, `UI_ROOT`, `NODE_ENV`.
- Scripts: `npm run build:node`, `npm run start node`, tests via `npm run test`.

### Frontend — `apps/site`

- Stack: Angular, TypeScript, SCSS.
- Responsibilities:
  - Fetch `/content/_manifest.json`.
  - Routes: home (listing/search), `p/:slug` viewer that fetches the page HTML via `filePath`.
  - Search on title/tags; manifest-driven navigation.
- Build: `npm run build:site`; dev serve: `npm run start site`.
- TODO: Add branding/theme assets and link to screenshots in `docs/assets`.

### Obsidian plugin — `apps/publish-to-personal-vps`

- Stack: TypeScript, Obsidian API, esbuild bundle.
- Responsibilities:
  - Package the plugin (`dist/publish-to-personal-vps`), keep `manifest.json` and `versions.json` in sync.
  - Release flow zips the plugin and publishes it as a GitHub release asset.
- Build/package: `npm run build:plugin` then `npm run package:plugin`.
- Release config: `apps/publish-to-personal-vps/.releaserc.json` (used via root semantic-release).
- TODO: Add marketplace listing link once approved; add usage instructions and screenshots (place in `docs/assets`).

### Shared libraries

- `libs/core-domain`: entities, value objects, ports, errors, utilities.
- `libs/core-application`: application services/use-cases (catalog, publishing, sessions, vault parsing, etc.).

## Development

Prerequisites: Node.js 22+, npm.

Install:

```bash
npm install --no-audit --no-fund
```

Useful scripts:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run build:node` / `npm run build:site` / `npm run build:plugin`
- `npm run package:plugin`
- `npm run start node` / `npm run start site`

## Release and CI/CD

Workflow: `.github/workflows/ci-release.yml`

- `quality`: lint, test, build (Nx), publish `dist` artifact.
- `semantic-release`: bumps versions (including plugin manifest/versions), rebuilds and packages the plugin, zips it, creates a GitHub release with the asset.
- `docker-images`: builds and pushes Docker images to the private registry and Docker Hub (version tag, short SHA, latest).

Release config: `release.config.cjs` (version sync, changelog, git commits/tags, plugin packaging, GitHub assets).

Required secrets/vars (CI): `REGISTRY_URL`, `IMAGE_NAME`, `REGISTRY_USER`, `REGISTRY_PASSWORD`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `GITHUB_TOKEN` (provided by Actions).

TODO: Document API keys/vars per environment and how to trigger workflow_dispatch for releases.

## Docker

- Single container runs the backend and serves the Angular build plus static `/content`.
- Build: multi-stage Dockerfile that builds frontend + backend, then runs a Node runtime image.
- Runtime behavior:
  - Serves `/api/**` (backend).
  - Serves `/content/**` from `CONTENT_ROOT` volume.
  - Serves Angular build at `/` with SPA fallback.
- Example:

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

- TODO: Add docker compose/K8s examples and registry settings.

## Obsidian submission

- Latest release ships `dist/publish-to-personal-vps.zip` plus updated `manifest.json` and `versions.json`.
- Follow https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin for marketplace submission.
- TODO: Add link to the published plugin entry once available.
