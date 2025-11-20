# scribe-ektaron

**scribe-ektaron** is a small, self-hostable publishing stack made of two apps:

- **personal-publish** — a **Node.js + TypeScript** backend that receives Markdown notes (e.g., from Obsidian), renders them to HTML, writes them to a shared `/content` folder, and generates a machine-readable **\_manifest.json**.
- **publish-frontend** — an **Angular (v18+) SPA** that reads `_manifest.json`, provides **dynamic routing** (`/p/:slug`), **search**, and fetches the generated HTML for display with a clean, themeable layout.

> **Push Markdown from your vault → browse a styled site on your VPS.**
>
> No manual Nginx config per folder: the **frontend uses the manifest** to know what to display.

The repository includes a **Clean Architecture** layout on both sides, a **Docker** setup to ship a single container, and optional **Nginx**/registry recipes.
**Bundle name** (image/service) remains **`scribe-ektaron`**.

## Features

### Backend — `personal-publish`

- `GET /api/ping` — JSON healthcheck.
- `POST /api/upload` — batch upload of notes (Markdown + frontmatter) authenticated by `x-api-key`.
- Markdown → HTML server-side via **markdown-it** (extensible).
- (Basic) HTML sanitization policy server-side (no raw HTML passthrough; configurable).
- Page templating (minimal dark theme; meta tags; semantic HTML).
- Filesystem publishing:

  - Writes **HTML** under **`CONTENT_ROOT`**.
  - Maintains **`CONTENT_ROOT/_manifest.json`**.
  - (Optional) Generates a **`CONTENT_ROOT/index.html`** summary.

- Idempotent per `route`: re-upload replaces the same page and updates the index.

### Frontend — `publish-frontend`

- Angular **v18** standalone, signals, **`@if` / `@for`** templates, SCSS.
- Reads **`/content/_manifest.json`** and builds:

  - Dynamic routes: **`/p/:slug`** (manifest-driven).
  - **Search** (title + tags).
  - **Viewer** that fetches the generated HTML at `filePath`.

- Lightweight, accessible UI; easy theming.
- Clean Architecture (domain / application / infrastructure / presentation).
- Works behind a single Node/Express server that serves:

  - `/api/**` (backend),
  - `/content/**` (generated HTML),
  - `/` (Angular build) with **SPA fallback**.

## Monorepo Layout

```
.
├── apps/
│   ├── backend/                     # personal-publish
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── domain/
│   │       │   └── entities/        # Note.ts, PublishedPage.ts
│   │       ├── application/
│   │       │   ├── ports/           # MarkdownRendererPort.ts, ContentStoragePort.ts, SiteIndexPort.ts
│   │       │   └── usecases/        # PublishNotesUseCase.ts
│   │       ├── infra/
│   │       │   ├── config/          # EnvConfig.ts
│   │       │   ├── filesystem/      # FileSystemContentStorage.ts, FileSystemSiteIndex.ts, SiteIndexTemplates.ts
│   │       │   └── http/
│   │       │       └── express/     # app.ts, controllers/, dto/, mappers/, middleware/
│   │       ├── shared/              # errors/DomainError.ts
│   │       └── main.ts
│   └── frontend/                    # publish-frontend (Angular v18)
│       ├── package.json
│       ├── angular.json
│       └── src/
│           ├── domain/              # pure TS: models, value-objects, ports
│           ├── application/         # usecases, facades (signals)
│           ├── infrastructure/      # http repositories, DTOs, mappers
│           └── presentation/        # routes, pages (home, viewer), app.config.ts
├── content/                         # shared R/W volume (generated HTML + _manifest.json)
│   ├── _manifest.json
│   └── ...
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
└── (tests in /test remain; Vitest)
```

## Clean Architecture

### Backend (Node/Express)

- **Domain** — pure entities (`Note`, `PublishedPage`), no IO.
- **Application** — use cases (`PublishNotesUseCase`) and **ports** (`MarkdownRendererPort`, `ContentStoragePort`, `SiteIndexPort`).
- **Infra** — adapters (Express controllers, FS, Markdown renderer, env).
- **Main** — composition root (wire deps, start HTTP server).

### Frontend (Angular)

- **domain** — models, value-objects (e.g., `Slug`), and ports (`ManifestRepository`, `HtmlGateway`) **without Angular**.
- **application** — orchestration/use-cases (`LoadManifest`, `FindPage`, `SearchPages`) + a **Facade** (signals).
- **infrastructure** — Angular **HttpClient** implementations of domain ports + DTO→domain mapping.
- **presentation** — components/routes only; no business logic, only binds the Facade.

> Angular path aliases (in `apps/frontend/tsconfig.json`):

```json
{
  "compilerOptions": {
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infra/*": ["src/infrastructure/*"],
      "@presentation/*": ["src/presentation/*"]
    }
  }
}
```

## API (backend)

### `GET /api/ping`

- **Auth**: none
- **Response**

```json
{
  "ok": true,
  "service": "personal-publish",
  "version": "1.0.0",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### `POST /api/upload`

- **Auth**: header `x-api-key: <your-api-key>`
- **Content-Type**: `application/json`
- **Body**

```json
{
  "notes": [
    {
      "id": "uuid-or-other-id",
      "slug": "my-note-slug",
      "route": "/p/my-note-slug",
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

**Behavior (per note)**

1. Validate payload (e.g., with **Zod**).
2. Render Markdown → HTML via **markdown-it**.
3. Wrap in the HTML template (title, meta, CSS, header link, etc.).
4. Write to **`CONTENT_ROOT`** at **`filePath`** (see manifest contract below).
   _If you use `route`, the conventional mapping is `CONTENT_ROOT/<segments>/index.html`._
5. Update **`CONTENT_ROOT/_manifest.json`**; (optionally) update `CONTENT_ROOT/index.html`.

**Responses**

- Success

```json
{ "ok": true, "published": 1, "errors": [] }
```

- Partial failure

```json
{ "ok": false, "published": 1, "errors": [{ "noteId": "id", "message": "Error details..." }] }
```

- Invalid payload → `400` with Zod details
- Missing API key → `401`; wrong key → `403`
- Server error → `500`

## Manifest Contract (`/content/_manifest.json`)

Minimal fields consumed by the frontend:

```json
{
  "version": 1,
  "generatedAt": "2025-11-10T10:00:00Z",
  "pages": [
    {
      "route": "/p/mon-slug",
      "slug": "mon-slug",
      "title": "Titre de page",
      "tags": ["t1", "t2"],
      "filePath": "/content/notes/mon-slug/index.html",
      "updatedAt": "2025-11-10T10:00:00Z"
    }
  ]
}
```

**Rules & invariants**

- `version` — integer, manifest format version.
- `generatedAt` — ISO 8601.
- `pages[]` — each page:

  - `route` — **must** start with `/p/` for SPA routing.
  - `slug` — recommended (the frontend can derive it from `route` if missing).
  - `title` — required.
  - `tags` — array (can be empty).
  - `filePath` — **absolute path from the host** as served by Express static under `/content` (e.g., `/content/.../index.html`).
  - `updatedAt` — ISO 8601 (optional but useful).

## Frontend Behavior (Angular)

- **Load manifest** once from `GET /content/_manifest.json` (cached).
- **Routes**

  - `''` → Home (search + listing).
  - `'p/:slug'` → Viewer; resolves the page by `slug` (or `route`) then fetches `filePath`.
  - SPA **fallback** is handled by Express (see Docker section).

- **Search** — case-insensitive filter on `title` and `tags`.
- **Security** — HTML is expected to be safe (server-rendered). If you plan to accept unsafe user content, add client-side sanitization (e.g., DOMPurify) on top of the server policy.

## Dev & Run

### Requirements

- Node.js **20+** (dev), npm
- Docker + docker compose v2 (for containerized runs)

### Env vars (root `.env`)

```env
PORT=3000
API_KEY=dev-key-local
CONTENT_ROOT=./content
UI_ROOT=/ui
NODE_ENV=development
```

### Local development (separate)

Backend:

```bash
cd apps/backend
npm install
npm run dev
# Exposes /api and serves /content + /ui if present
```

Frontend:

```bash
cd apps/frontend
npm install
npm start
# http://localhost:4200
```

Smoke test (without backend):
Create `content/_manifest.json` and an HTML page under `content/...` to validate the SPA locally. In containerized mode the backend will serve `/content` statically.

### Tests

```bash
npm run test
```

(Vitest)

## Build (no Docker)

Backend:

```bash
cd apps/backend
npm run build
NODE_ENV=production PORT=3000 API_KEY=change-me CONTENT_ROOT=./content node dist/main.js
```

Frontend:

```bash
cd apps/frontend
npm run build
# outputs dist/ which will be served at / (copied to /ui in the container)
```

## Docker (single image: `scribe-ektaron`)

The Dockerfile builds Angular + backend, then runs a **single Node process** that:

- serves `/api/**`,
- serves static **`/content/**`\*\* (volume),
- serves Angular build at `/` with a **SPA fallback** to `index.html`.

### Dockerfile (multi-stage, summarized)

- **frontend-builder**: `npm ci` + `npm run build` (Angular) → `dist/`
- **backend-builder**: `npm ci` + `npm run build` (TS) → `dist/`
- **runtime**: Node 20 Alpine, install prod deps for backend, copy backend **dist** and frontend build → `/ui`, create `/content`, run `apps/backend/dist/main.js`.

### Build & Run

```bash
docker build -t scribe-ektaron:latest .
docker run -d --name scribe-ektaron \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e API_KEY=change-me \
  -e CONTENT_ROOT=/content \
  -e UI_ROOT=/ui \
  -v $(pwd)/content:/content \
  scribe-ektaron:latest
```

Now:

- Angular SPA → `http://localhost:3000/`
- Manifest → `http://localhost:3000/content/_manifest.json`
- API → `http://localhost:3000/api/...`

### docker-compose

```yaml
services:
  scribe-ektaron:
    build:
      context: .
      dockerfile: Dockerfile
    image: scribe-ektaron:latest
    restart: unless-stopped
    env_file: [.env]
    environment:
      NODE_ENV: production
    volumes:
      - ./content:/content
    ports:
      - '3000:3000'
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:3000/health || exit 1']
      interval: 20s
      timeout: 3s
      retries: 5
```

> **Note**: The backend should expose `/health` (text `ok`) for the healthcheck and `/api/ping` for JSON status.

## Nginx (optional, TLS / reverse proxy)

You **no longer** need per-folder config. Put Nginx in front for HTTPS and proxy **all** to the Node container, keeping `/content` and SPA fallback served by Express:

```nginx
server {
  listen 80;
  server_name publish.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name publish.example.com;

  ssl_certificate     /etc/letsencrypt/live/publish.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/publish.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  add_header X-Content-Type-Options nosniff;
  add_header X-Frame-Options SAMEORIGIN;
  add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

If you insist on serving `/content` directly from Nginx’s filesystem, you can still mount `./content` there — the SPA will keep working as long as **`/content/_manifest.json` and `filePath` URLs** are reachable.

## CI/CD & Versioning (trunk-based)

- **Trunk** on `main`, **Conventional Commits**, **semantic-release v25** computes **SemVer** and maintains **one unified version** across the monorepo:

  - root `package.json`
  - `apps/frontend/package.json`
  - `apps/backend/package.json`
  - (optional) `apps/*/src/version.ts` via `scripts/sync-version.mjs`

- **GitHub Actions** (`.github/workflows/release.yml`) on every push to `main`:

  - Node **≥ 22.14.0** via `actions/setup-node@v4`
  - `fetch-depth: 0`
  - `permissions.contents: write`
  - Commits `chore(release): x.y.z`, creates tag `vX.Y.Z`, updates `CHANGELOG.md`, publishes GitHub Release.

- Release rules:

  - `feat` → **minor**
  - `fix` / `hotfix` → **patch**
  - `type!` or **BREAKING CHANGE** → **major**
  - Non-cutting: `docs`, `test`, `chore`, `build`.

- Dry-run locally:

```bash
npx semantic-release --dry-run
```

## Optional: Private Docker Registry

Run a local `registry:2`, front it with Nginx + BasicAuth, and push **`scribe-ektaron:latest`** there.

**Compose (registry host)**

```yaml
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

**Nginx (TLS + auth)**

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

**Push**

```bash
docker login registry.example.com
docker build -t registry.example.com/scribe-ektaron:latest .
docker push registry.example.com/scribe-ektaron:latest
```

**Use**

```yaml
services:
  scribe-ektaron:
    image: registry.example.com/scribe-ektaron:latest
    # ...
```

## Notes & Trade-offs

- Backend auth is a **simple API key**; no users/sessions/ACL.
- Server-side sanitization is deliberately conservative; expand as needed.
- Front assumes the HTML produced by the backend is trusted. If not, add a client sanitizer.
- The “single process” container is **simpler** and avoids supervising multiple daemons; if you need nginx/Caddy in-container, expect more complexity.
- No delete endpoint yet; can be added as another use case and manifest rebuild.

## Healthchecks (summary)

- **JSON**: `GET /api/ping` → `{ ok: true, service, version, timestamp }`
- **Plain**: `GET /health` → `ok` (used by Docker healthcheck)

That’s it. With this setup, you keep **Clean Architecture** on both sides, remove **per-folder Nginx hacks**, and ship a single, predictable **`scribe-ektaron`** image.
