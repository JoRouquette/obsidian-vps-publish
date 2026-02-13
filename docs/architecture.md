# Architecture

## Monorepo layout

- `apps/node`: Express + TypeScript backend that renders Markdown to HTML, maintains `_manifest.json`, and serves API + static assets.
- `apps/site`: Angular SPA that consumes the manifest to render the published site (routing, search, viewer).
- `apps/obsidian-vps-publish`: Obsidian plugin (TypeScript + Obsidian API, bundled with esbuild).
- Shared libs: `libs/core-domain`, `libs/core-application`.

## Backend API (`apps/node`)

- Stack: Express, TypeScript; CI builds on Node.js 22 and the container runtime is Node 20-alpine.
- Authentication: all `/api/**` routes require the `x-api-key` header.
- Session workflow:
  - `POST /api/session/start` — create a publish session (note/asset counts, optional callout styles).
  - `POST /api/session/:sessionId/notes/upload` — upload Markdown + frontmatter batch.
  - `POST /api/session/:sessionId/assets/upload` — upload binary assets.
  - `POST /api/session/:sessionId/finish` — finalize and publish staged content.
  - `POST /api/session/:sessionId/abort` — cancel and drop staged content.
- Public endpoints:
  - `GET /health` — healthcheck (used by the Docker image).
  - `GET /public-config` — exposes `siteName`, `author`, `repoUrl`, `reportIssuesUrl`.
- Static content:
  - `/content/**` and assets under `/assets/**` (from mounted volumes).
  - SPA served at `/` from the built Angular files copied into `UI_ROOT` during the image build.
- Key environment variables (see `.env.dev.example` / `.env.prod.example`):
  - `API_KEY` (required), `ALLOWED_ORIGINS`, `LOGGER_LEVEL`, `PORT`, `NODE_ENV`.
  - Roots: `CONTENT_ROOT` (rendered HTML + `_manifest.json`, default `/content`), `ASSETS_ROOT` (default `/assets`), `UI_ROOT` (default `/ui`).
  - Metadata: `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`.
  - Asset security: `MAX_ASSET_SIZE_BYTES` (default 10MB), `VIRUS_SCANNER_ENABLED` (default false), `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT` (see [Asset Security](./api/asset-security.md)).
- Asset validation pipeline:
  - **MIME detection** via file-type library (magic bytes) prevents spoofing attacks.
  - **Size limits** reject oversized files before processing (configurable via `MAX_ASSET_SIZE_BYTES`).
  - **Virus scanning** (optional, requires ClamAV daemon) scans uploads via TCP socket.
  - Clean Architecture: ports in `core-domain` (`AssetValidatorPort`, `AssetScannerPort`), implementations in `apps/node/src/infra/` (`FileTypeAssetValidator`, `NoopAssetScanner`, `ClamAVAssetScanner`).

## Frontend (`apps/site`)

- Angular SPA that reads `/content/_manifest.json`, renders pages via `filePath`, and provides search on title/tags.
- Build: `npm run build:site`; dev: `npm run start site`.
- The Docker image copies the built `browser` output into `UI_ROOT` so the container can serve the SPA directly.

## Obsidian plugin (`apps/obsidian-vps-publish`)

- Responsibilities: bundle the plugin, keep `manifest.json` and `versions.json` in sync, and ship a zipped release asset.
- Build/package: `npm run build:plugin` then `npm run package:plugin` -> `dist/vps-publish/` (contains `main.js`, `manifest.json`, `styles.css`, `versions.json`).
- Release packaging: `semantic-release` rebuilds the plugin, packages it, and creates `dist/vps-publish.zip`, which is attached to GitHub release assets.
- Manifest + version sources: `manifest.json` (repo root) and `apps/obsidian-vps-publish/versions.json`; keep them aligned with tags.

## Shared libraries

- `libs/core-domain`: entities, value objects, ports, errors, utilities.
- `libs/core-application`: services/use cases (catalogue, publication, sessions, vault parsing, etc.).
