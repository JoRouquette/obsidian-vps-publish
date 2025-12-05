# Docker deployment

The unified image serves the API, static content, and the Angular SPA.

- Image: `jorouquette/obsidian-vps-publish` (CI also pushes to the private registry).
- Ports: container listens on `PORT` (default `3000`) and exposes `/health`, `/api/**`, `/content/**`, `/assets/**`, and `/`.
- Volumes: mount `CONTENT_ROOT` and `ASSETS_ROOT` to persist rendered HTML/manifest and uploaded assets.
- Healthcheck: `http://localhost:${PORT}/health`.

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

- `docker-compose.dev.yml` builds the image locally for development.
- `docker-compose.prod.yml` pulls `${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG:-latest}` and reads `.env.prod`.

## Environment variables

- Required: `API_KEY`.
- Common: `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`, `LOGGER_LEVEL`.
- Roots: `CONTENT_ROOT` (default `/content`), `ASSETS_ROOT` (default `/assets`), `UI_ROOT` (default `/ui`).
- Metadata shown in the SPA and `/public-config`: `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`.
