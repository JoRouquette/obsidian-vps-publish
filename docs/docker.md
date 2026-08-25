# Docker deployment

The unified image serves the API, static content, and the Angular SPA.

- Image: `jorouquette/obsidian-vps-publish` (CI also pushes to the private registry).
- Ports: container listens on `PORT` (default `3000`) and exposes `/health`, `/api/**`, `/content/**`, `/assets/**`, and `/`.
- Volumes: mount `CONTENT_ROOT` and `ASSETS_ROOT` to persist rendered HTML/manifest and uploaded assets.
- Healthcheck: `http://localhost:${PORT}/health`.

> For a complete production walkthrough (nginx TLS front, firewall, auto-updates), see the [VPS setup guide](./vps-setup.md) ([English](./en/vps-setup.md)).

## What the image contains

One self-contained image runs the whole self-hosted stack:

- **Node API** (`apps/node`) — receives plugin uploads (`/api/**`, authenticated with the `x-api-key` header), renders and stores publications, serves `/content/**`, `/assets/**`, `/health`, and `/public-config`.
- **Angular SPA** (`apps/site`) — the public website, served statically from `UI_ROOT` on `/`.
- **Shared libraries** (`libs/core-domain`, `libs/core-application`) — bundled into the API at build time.

## Published tags

Every stable release publishes to Docker Hub — <https://hub.docker.com/r/jorouquette/obsidian-vps-publish>:

| Tag           | Meaning                                             |
| ------------- | --------------------------------------------------- |
| `X.Y.Z`       | Immutable release tag (matches the plugin version). |
| `<short-sha>` | Commit-pinned build.                                |
| `latest`      | Most recent stable release.                         |

Versioning is **lockstep** with the plugin: image `X.Y.Z` pairs with plugin `X.Y.Z` (see the [compatibility matrix](./vps-setup.md#matrice-de-compatibilité)). Pre-releases (`-alpha.N`) never publish images.

## Quick run

```bash
docker run -d --name obsidian-vps-publish \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e API_KEY=change-me \
  -e CONTENT_ROOT=/content \
  -e ASSETS_ROOT=/assets \
  -e UI_ROOT=/ui \
  -v $(pwd)/content:/content \
  -v $(pwd)/assets:/assets \
  jorouquette/obsidian-vps-publish:latest
```

## Compose files

- `docker-compose.dev.yml` builds the image locally and reads `.env.dev`.
- `docker-compose.prod.yml` is self-contained for application runtime variables and pulls `jorouquette/obsidian-vps-publish:latest` by default.

## Environment variables

- Required: `API_KEY`.
- Common: `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`, `LOGGER_LEVEL`.
- Roots: `CONTENT_ROOT` (default `/content`), `ASSETS_ROOT` (default `/assets`), `UI_ROOT` (default `/ui`).
- Metadata shown in the SPA and `/public-config`: `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`.

## SSR Build Structure

Since Angular SSR is enabled, the build now produces:

- `dist/apps/site/browser/` - Client-side files (static assets)
  - `index.csr.html` - Client-side rendering fallback (renamed to `index.html` by Dockerfile)
  - JavaScript chunks, CSS, and assets
- `dist/apps/site/server/` - Server-side rendering bundles (not used in current deployment)

The Dockerfile automatically handles the SSR build structure:

1. Copies `browser/` folder contents to `UI_ROOT` (`/ui`)
2. Renames `index.csr.html` to `index.html` if present
3. Validates that `index.html` exists in the final location

This ensures backward compatibility while supporting future SSR server deployment if needed.
