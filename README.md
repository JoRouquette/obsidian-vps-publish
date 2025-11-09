# scribe-ektaron / personal-publish

`personal-publish` is a small self-hostable backend designed to receive notes from Obsidian (or any client), render them to static HTML, and publish them to a directory that can be served directly by Nginx.

The goal is simple:

> **Push Markdown from your vault → get a styled static site generated on your VPS.**

This repository contains:

- a **Node.js + TypeScript** backend (`personal-publish`),
- a **clean architecture** layout (domain / application / infra),
- a **Docker** setup for easy deployment,
- examples for **Nginx** and an optional **private Docker registry**.

## Features

- `GET /api/ping` – healthcheck endpoint.
- `POST /api/upload` – upload a batch of notes:
  - Authenticated via `x-api-key`.
  - JSON payload containing notes (Markdown + frontmatter).
  - Server-side Markdown → HTML rendering.
  - Server-side HTML sanitization basics (no raw HTML in markdown, configurable later).
  - Page templating with a consistent, minimal dark theme.
  - Each route is published as `CONTENT_ROOT/<route...>/index.html`.
  - Automatic generation of:
    - a global `index.html` (site summary),
    - a `_manifest.json` with all published pages.

Intended use-case: an Obsidian plugin that preprocesses/sanitizes notes, then POSTs them to this API.

## Architecture Overview

The project follows a Clean Architecture / Hexagonal style:

```text
src/
  domain/
    entities/
      Note.ts
      PublishedPage.ts
  application/
    ports/
      MarkdownRendererPort.ts
      ContentStoragePort.ts
      SiteIndexPort.ts
    usecases/
      PublishNotesUseCase.ts
  infra/
    http/
      express/
        app.ts
        controllers/
        dto/
        mappers/
        middleware/
    filesystem/
      FileSystemContentStorage.ts
      FileSystemSiteIndex.ts
    markdown/
      MarkdownItRenderer.ts
    config/
      EnvConfig.ts
  shared/
    errors/
      DomainError.ts
  main.ts
```

- **Domain**: pure business entities (`Note`, `PublishedPage`), no HTTP/FS/Express/Docker.
- **Application**: use cases (`PublishNotesUseCase`) + ports (interfaces).
- **Infra**: adapters (Express controllers, filesystem, markdown renderer, env config).
- **Main**: composition root (wires adapters and use cases, starts HTTP server).

## Requirements

For local development:

- Node.js 20+
- npm
- (Optional but recommended) Docker + docker compose v2
- Nginx for serving static content in production

## Installation (Local Development)

Clone the repository:

```bash
git clone https://github.com/JoRouquette/scribe-ektaron.git
cd scribe-ektaron
```

Install dependencies:

```bash
npm install
```

### Environment variables

Create a `.env` file at the root:

```bash
cat > .env << 'EOF'
PORT=3000
API_KEY=dev-key-local
CONTENT_ROOT=./tmp/site
NODE_ENV=development
EOF
```

> `.env` is ignored by git. You can also create a `.env.example` for documentation.

### Run in development

```bash
npm run dev
```

The server listens on `PORT` (default `3000`).

Healthcheck:

```bash
curl http://localhost:3000/api/ping
```

Expected JSON example:

```json
{
  "ok": true,
  "service": "personal-publish",
  "version": "1.0.0",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Run tests

This project uses **Vitest**.

```bash
npm run test
```

## API

### `GET /api/ping`

- **Purpose**: healthcheck.
- **Auth**: none.
- **Response**:

```json
{
  "ok": true,
  "service": "personal-publish",
  "version": "1.0.0",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### `POST /api/upload`

- **Auth**: required, header `x-api-key: <your-api-key>`.
- **Content-Type**: `application/json`.

#### Request body

```json
{
  "notes": [
    {
      "id": "uuid-or-other-id",
      "slug": "my-note-slug",
      "route": "/blog/my-note",
      "markdown": "# Title\n\nSome content...",
      "frontmatter": {
        "title": "My Note",
        "description": "Short description",
        "date": "2025-01-01T12:00:00.000Z",
        "tags": ["tag1", "tag2"]
      },
      "publishedAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-01-01T12:30:00.000Z"
    }
  ]
}
```

Notes:

- `route` must start with `/` (e.g. `/blog/my-note`).
- `publishedAt` and `updatedAt` are ISO date strings (converted to `Date` on the server).
- `frontmatter.title` is required.

#### Behavior

For each note:

1. Validate the payload structure (via Zod).

2. Convert `markdown` → HTML using `markdown-it`.

3. Wrap the HTML in a full page template:
   - `<html lang="fr">` (or `en` depending on template),
   - `<title>` from frontmatter,
   - meta tags (description, keywords, publishedAt, updatedAt),
   - consistent CSS (dark theme, readable layout),
   - a simple header with a link back to `/`.

4. Persist to filesystem:
   - `CONTENT_ROOT` is defined by the env variable.
   - `route` is mapped to `CONTENT_ROOT/<segments>/index.html`.
   - Example: `route = "/blog/my-note"` → `CONTENT_ROOT/blog/my-note/index.html`.

5. Update the global index:
   - Maintain `_manifest.json` in `CONTENT_ROOT`.
   - Regenerate `CONTENT_ROOT/index.html` as a summary page listing all routes.

The operation is **idempotent** for a given route: re-uploading a note with the same `route` overwrites the previous page and updates the index.

#### Response

On success:

```json
{
  "ok": true,
  "published": 1,
  "errors": []
}
```

On partial failure:

```json
{
  "ok": false,
  "published": 1,
  "errors": [{ "noteId": "some-id", "message": "Error details..." }]
}
```

On invalid payload (400):

```json
{
  "ok": false,
  "error": "Invalid request body",
  "details": {
    /* zod error structure */
  }
}
```

On missing/invalid API key:

- `401` if `x-api-key` is missing.
- `403` if `x-api-key` is wrong.

On internal server error:

- `500` with `{ "ok": false, "error": "Internal server error" }`.

## Building for Production (without Docker)

Build TypeScript:

```bash
npm run build
```

This uses `tsconfig.build.json` and outputs JS to `dist/`.

Run:

```bash
NODE_ENV=production \
PORT=3000 \
API_KEY=change-me \
CONTENT_ROOT=/var/www/personal-publish/site \
node dist/main.js
```

You must ensure that the `CONTENT_ROOT` directory exists and is writable by the process.

## Docker Deployment

### Dockerfile

The repository includes a multi-stage Dockerfile:

- Stage 1: Node 20 Alpine, install deps, compile TS → JS.
- Stage 2: Node 20 Alpine, install only production deps, run `dist/main.js`.

Build:

```bash
docker build -t personal-publish:latest .
```

Run:

```bash
docker run -d \
  --name personal-publish \
  -p 3000:3000 \
  -e PORT=3000 \
  -e API_KEY=change-me \
  -e CONTENT_ROOT=/var/www/personal-publish/site \
  -e NODE_ENV=production \
  -v /srv/personal-publish/site:/var/www/personal-publish/site \
  personal-publish:latest
```

- The host directory `/srv/personal-publish/site` will contain all generated HTML.
- Nginx can serve this directory directly.

### docker-compose example

Create `docker-compose.yml`:

```yaml
services:
  personal-publish:
    image: personal-publish:latest
    container_name: personal-publish
    restart: unless-stopped

    env_file:
      - .env

    environment:
      NODE_ENV: production

    volumes:
      - /srv/personal-publish/site:/var/www/personal-publish/site

    ports:
      - '127.0.0.1:3000:3000'
```

Example `.env`:

```env
PORT=3000
API_KEY=change-me
CONTENT_ROOT=/var/www/personal-publish/site
NODE_ENV=production
```

Then:

```bash
docker compose up -d
```

## Nginx Configuration (Static Site + API)

Assuming:

- `personal-publish` runs on `127.0.0.1:3000`.
- Static content root is `/srv/personal-publish/site`.
- Domain name: `publish.example.com`.

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name publish.example.com;

    # Redirect HTTP -> HTTPS (optional but recommended)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name publish.example.com;

    ssl_certificate     /etc/letsencrypt/live/publish.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/publish.example.com/privkey.pem;

    # Static site generated by personal-publish
    root /srv/personal-publish/site;
    index index.html;

    # API backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files: everything else is served from the generated site
    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

## Optional: Private Docker Registry (Advanced)

If you want to host your own Docker registry (e.g. `registry.example.com`) and push images there:

1. Run a `registry:2` container on your server (only on localhost):

   ```yaml
   # /srv/apps/registry/docker-compose.yml
   services:
     registry:
       image: registry:2
       container_name: registry
       restart: unless-stopped
       environment:
         REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY: /var/lib/registry
       volumes:
         - /srv/registry/data:/var/lib/registry
       ports:
         - '127.0.0.1:5000:5000'
   ```

2. Put Nginx in front of it on `registry.example.com`:

   ```nginx
   server {
       listen 80;
       server_name registry.example.com;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name registry.example.com;

       ssl_certificate     /etc/letsencrypt/live/registry.example.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/registry.example.com/privkey.pem;

       # Allow big Docker layers
       client_max_body_size 0;

       location /v2/ {
           auth_basic           "Private Docker Registry";
           auth_basic_user_file /etc/nginx/htpasswd-registry;

           proxy_pass          http://127.0.0.1:5000;
           proxy_read_timeout  900;

           proxy_set_header    Host $host;
           proxy_set_header    X-Real-IP $remote_addr;
           proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header    X-Forwarded-Proto $scheme;
       }
   }
   ```

3. From your dev machine:

   ```bash
   docker login registry.example.com
   docker build -t registry.example.com/personal-publish:latest .
   docker push registry.example.com/personal-publish:latest
   ```

4. On your server, use this image in `docker-compose.yml`:

   ```yaml
   services:
     personal-publish:
       image: registry.example.com/personal-publish:latest
       # ...
   ```

Then:

```bash
docker compose pull
docker compose up -d
```

## Notes / Trade-offs

- The backend purposely does **not** handle:
  - user management,
  - authentication beyond a simple API key,
  - dynamic rendering or client-side JS frontends.

- It is designed to be a **simple publishing pipeline**:
  - Obsidian (or another tool) → API → static HTML → Nginx.

- The CSS is embedded in the HTML template for simplicity; if you want advanced theming, you can:
  - replace the inline `<style>` with a shared CSS file,
  - add assets and more complex layouts in the filesystem adapter.

If you want to extend the system (page listing API, delete endpoint, manifest search, custom templates, etc.), the Clean Architecture structure should make it straightforward to add new use cases and adapters without mixing HTTP/infra concerns into the domain.
