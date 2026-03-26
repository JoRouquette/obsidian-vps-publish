# Architecture

## Monorepo layout

- `apps/node`: Express + TypeScript backend that renders Markdown to HTML, maintains `_manifest.json`, and serves API + static assets.
- `apps/site`: Angular SPA that consumes the manifest to render the published site.
- `apps/obsidian-vps-publish`: Obsidian plugin bundled with esbuild.
- Shared libs: `libs/core-domain`, `libs/core-application`.

## Backend API (`apps/node`)

- Stack: Express, TypeScript; CI builds on Node.js 22 and the container runtime is Node 20-alpine.
- Authentication: all `/api/**` routes require the `x-api-key` header.
- Session workflow:
  - `POST /api/session/start` creates a publish session with planned counts, ignore rules, folder display names, and the current pipeline signature.
  - `POST /api/session/:sessionId/notes/upload` uploads note source packages: raw Markdown, normalized frontmatter, and Obsidian-only enrichments.
  - `POST /api/session/:sessionId/assets/upload` uploads binary assets.
  - `POST /api/session/:sessionId/finish` marks the session complete and enqueues finalization.
  - `POST /api/session/:sessionId/abort` cancels the session and drops staged content.
- Publication ownership:
  - Plugin: vault reads, metadata cache extraction, Dataview block / DataviewJS execution, attachment discovery, and local settings collection.
  - API: authoritative deterministic transforms, HTML rendering, routing, slug deduplication, wikilink resolution, manifest/index rebuilds, and link validation.
- Finalization progress:
  - Backend finalization exposes stable phases over SSE and polling: `queued`, `rebuilding_notes`, `rendering_html`, `promoting_content`, `rebuilding_indexes`, `validating_links`, `completing_publication`, `completed`, `failed`.
  - Plugin UI uses those backend phases as the authoritative publish-progress label.
- Routing invariant: every published route must remain absolute (`/path/to/page`) from parsing to final promotion, otherwise internal HTML links can silently degrade into browser-relative paths.
- Public endpoints:
  - `GET /health` healthcheck.
  - `GET /public-config` exposes `siteName`, `author`, `repoUrl`, `reportIssuesUrl`.
- Static content:
  - `/content/**` and `/assets/**` are served from mounted volumes.
  - The SPA is served at `/` from the built Angular files copied into `UI_ROOT`.
- `_manifest.json` is the canonical source for internal routing and staged-to-production promotion.
- Key environment variables:
  - `API_KEY`, `ALLOWED_ORIGINS`, `LOGGER_LEVEL`, `PORT`, `NODE_ENV`
  - `CONTENT_ROOT`, `ASSETS_ROOT`, `UI_ROOT`
  - `SSR_ENABLED`, `UI_SERVER_ROOT`
  - `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`
  - `MAX_ASSET_SIZE_BYTES`, `VIRUS_SCANNER_ENABLED`, `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT`

## Frontend (`apps/site`)

- Angular SPA that reads `/content/_manifest.json`, renders pages via `filePath`, and provides search.
- Build: `npm run build:site`; dev: `npm run start site`.
- The Docker image copies the built `browser` output into `UI_ROOT` so the container can serve the SPA directly.

## Obsidian plugin (`apps/obsidian-vps-publish`)

- Responsibilities:
  - enumerate the vault and read raw note content
  - extract Obsidian-only metadata and execute Dataview block / DataviewJS logic
  - discover and upload attachments plus note source packages
  - surface publish progress from backend finalization phases
  - package and release the plugin assets
- Build/package: `npm run build:plugin` then `npm run package:plugin` -> `dist/vps-publish/`.
- Manifest + version sources: `manifest.json` (repo root) and `apps/obsidian-vps-publish/versions.json`.

## Shared libraries

- `libs/core-domain`: entities, value objects, ports, errors, utilities.
- `libs/core-application`: services/use cases for sessions, publication, vault parsing, and deterministic transforms.
