# Node.js Backend Documentation (API)

> **Version française :** [docs/api/](../../api/)

This section contains documentation for the Node.js backend (`apps/node`): the Express API that manages upload, storage, and rendering of published content.

## 🎯 Overview

The Node.js/Express backend:

- Exposes a secure REST API (`/api/**`) with `x-api-key` authentication
- Manages publication workflow through sessions (start, upload notes/assets, finish/abort)
- Renders Markdown to HTML with advanced support (wikilinks, footnotes, Dataview)
- Serves static content (pages, assets, Angular SPA)
- Maintains a content manifest (`_manifest.json`)

## 📄 Available Documentation

See French documentation for logging and performance details.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Environment variables configured (see `.env.dev.example`)

### Dev Mode

```bash
npm install
npm run start node
```

The API starts at `http://localhost:3000`.

### Production Build

```bash
npm run build node
```

Artifacts are generated in `dist/apps/node/`.

## 🛠️ Configuration

The backend uses environment variables:

### Required Variables

- **`API_KEY`**: Authentication key for `/api/**`

### Storage Variables

- **`CONTENT_ROOT`** (default `/content`): Rendered HTML + `_manifest.json` storage
- **`ASSETS_ROOT`** (default `/assets`): Binary files storage (images, PDFs, etc.)
- **`UI_ROOT`** (default `/ui`): Angular SPA static files

### Network Variables

- **`PORT`** (default `3000`): HTTP listening port
- **`ALLOWED_ORIGINS`**: CORS allowed origins (comma-separated)

### Metadata Variables

- **`SITE_NAME`**: Site name (exposed via `/public-config`)
- **`AUTHOR`**: Site author
- **`REPO_URL`**: GitHub repository URL
- **`REPORT_ISSUES_URL`**: Bug report URL

### Logging Variables

- **`LOGGER_LEVEL`** (default `info`): Log level (`debug`, `info`, `warn`, `error`)
- **`NODE_ENV`**: Environment (`development`, `production`)

See `.env.dev.example` and `.env.prod.example` for complete templates.

## 📡 API Endpoints

### Public (no authentication)

- **`GET /health`**: Healthcheck (returns `{ status: 'ok' }`)
- **`GET /public-config`**: Public configuration (siteName, author, repoUrl, reportIssuesUrl)

### Secured (`x-api-key` header required)

#### Session Workflow

1. **`POST /api/session/start`**: Create publication session
2. **`POST /api/session/:sessionId/notes/upload`**: Upload notes (batch)
3. **`POST /api/session/:sessionId/assets/upload`**: Upload assets (batch)
4. **`POST /api/session/:sessionId/finish`**: Finalize and publish
5. **`POST /api/session/:sessionId/abort`**: Cancel and delete

#### Cleanup

- **`POST /api/cleanup`**: Delete all published content (⚠️ irreversible)

## 🔗 Useful Links

- [General Architecture](../architecture.md)
- [Development Workflow](../development.md)
- [Docker](../../docker.md) (French)
- [Frontend Site](../site/)
- Source code: `apps/node/src/`

---

**Last Updated**: 2025-12-25
