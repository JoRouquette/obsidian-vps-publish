# Publish to personal VPS

Self-hosted publishing stack (Nx monorepo) that turns Markdown notes into a searchable/browsable site, ships an Obsidian plugin to push content to your own server, and packages the API + SPA into a single container image.

## Monorepo map

- `apps/node`: Node.js backend (Express) that renders Markdown to HTML, maintains `_manifest.json`, and serves API + static assets.
- `apps/site`: Angular SPA that consumes the manifest to render the published site (routing, search, viewer).
- `apps/obsidian-vps-publish`: Obsidian plugin that packages notes and pushes them to the backend.
- Shared libs: `libs/core-domain`, `libs/core-application`.

## Backend API (`apps/node`)

- Stack: Express, TypeScript; CI builds on Node.js 22, container runtime is Node 20-alpine.
- Serves:
  - API under `/api/**` (protected by `x-api-key`).
  - Static content under `/content/**` and assets under `/assets/**` (from mounted volumes).
  - SPA at `/` from the built Angular files (copied into `UI_ROOT` during the image build).
  - Health: `GET /health` (used by the Docker healthcheck).
  - Public config: `GET /public-config` exposes `siteName`, `author`, `repoUrl`, `reportIssuesUrl`.
- Main API routes (all require `x-api-key`):
  - `GET /api/ping` - liveness.
  - `POST /api/session/start` - create a publish session (note/asset counts, optional callout styles).
  - `POST /api/session/:sessionId/notes/upload` - upload Markdown + frontmatter batch.
  - `POST /api/session/:sessionId/assets/upload` - upload binary assets.
  - `POST /api/session/:sessionId/finish` - finalize and publish staged content.
  - `POST /api/session/:sessionId/abort` - cancel and drop staged content.
- Key environment variables (see `.env.dev.example` / `.env.prod.example`):
  - `API_KEY` (required), `ALLOWED_ORIGINS`, `LOGGER_LEVEL`, `PORT`, `NODE_ENV`.
  - Roots: `CONTENT_ROOT` (rendered HTML + `_manifest.json`, default `/content`), `ASSETS_ROOT` (default `/assets`), `UI_ROOT` (default `/ui`).
  - Metadata: `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`.

## Frontend (`apps/site`)

- Angular SPA that reads `/content/_manifest.json`, renders pages via `filePath`, and provides search on title/tags.
- Build: `npm run build:site`; dev: `npm run start site`.
- The Docker image copies the built `browser` output into `UI_ROOT` so the container can serve the SPA directly.

## Obsidian plugin (`apps/obsidian-vps-publish`)

- Stack: TypeScript, Obsidian API, esbuild bundle.
- Responsibilities: bundle the plugin, keep `manifest.json` and `versions.json` in sync, and ship a zipped release asset.
- Local packaging: `npm run build:plugin` then `npm run package:plugin` -> `dist/vps-publish/` (contains `main.js`, `manifest.json`, `styles.css`, `versions.json`).
- Release packaging: `semantic-release` rebuilds the plugin, packages it, and creates `dist/vps-publish.zip`, which is attached to the GitHub release assets for download.
- Release config lives in `apps/obsidian-vps-publish/.releaserc.json` (invoked by the root `semantic-release` flow).

## Development

Prerequisites: Node.js 22+, npm.

Install dependencies:

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

## Docker and deployment

- Unified image that serves the API, static content, and the Angular SPA.
- Published image: `jorouquette/obsidian-vps-publish` (CI also pushes to the private registry).
- Ports: container listens on `PORT` (default 3000) and exposes `/health`, `/api/**`, `/content/**`, `/assets/**`, `/`.
- Example run (PowerShell):

```bash
docker run -d --name obsidian-vps-publish `
  -p 3000:3000 `
  -e NODE_ENV=production `
  -e PORT=3000 `
  -e API_KEY=change-me `
  -e CONTENT_ROOT=/content `
  -e ASSETS_ROOT=/assets `
  -e UI_ROOT=/ui `
  -v ${PWD}/content:/content `
  -v ${PWD}/assets:/assets `
  jorouquette/obsidian-vps-publish:latest
```

- Compose:
  - `docker-compose.dev.yml` builds the image locally for development.
  - `docker-compose.prod.yml` pulls `${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG:-latest}` and reads `.env.prod`.
- Healthcheck uses `http://localhost:3000/health`; adjust `PORT` if you remap.

## Plugin artifacts and releases

- GitHub Releases include `dist/vps-publish.zip` (ready to drop into Obsidian `.obsidian/plugins/`).
- CI `quality` job also uploads the entire `dist` directory as a short-lived artifact (contains built apps and the packaged plugin folder).

## Release and CI/CD

Workflow: `.github/workflows/ci-release.yml`

- `quality`: lint, test, build (Nx), upload `dist` artifact.
- `semantic-release`: syncs versions (workspace + plugin manifests), rebuilds and packages the plugin, zips it, creates the GitHub release and attaches the plugin asset.
- `docker-images`: builds and pushes the Docker image to the private registry and Docker Hub `jorouquette/obsidian-vps-publish` (tags: version, short SHA, `latest`).

Release config: `release.config.cjs` (version sync, changelog, git commits/tags, plugin packaging, GitHub assets).

Required secrets/vars (CI): `REGISTRY_URL`, `IMAGE_NAME`, `REGISTRY_USER`, `REGISTRY_PASSWORD`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `GITHUB_TOKEN` (Actions-provided).
