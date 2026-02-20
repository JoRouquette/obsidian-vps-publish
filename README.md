# Publish to VPS (Obsidian plugin + self-hosted site)

Obsidian plugin that publishes selected vault folders to your own server, plus a containerized backend + SPA that renders and serves the published site. This repository is the single source of truth for both the plugin and the self-hosted stack.

## What this gives you

- Obsidian command to package Markdown (with frontmatter filtering, routing, and asset handling) and push it securely to your VPS.
- Docker image `jorouquette/obsidian-vps-publish` that serves the API, content, and the Angular site.
- Monorepo (Nx) with backend, frontend, and shared libraries for contributors.

## Requirements

- Obsidian `>=1.5.0` on desktop (mobile not tested).
- A reachable API endpoint running this stack (see Quick start below).
- Optional for local builds: Node.js `22+` and npm.

## Install the plugin

### From release (recommended)

1. Download the latest plugin assets from GitHub Releases (`main.js`, `manifest.json`, `styles.css`, `versions.json`, or the packaged `vps-publish.zip`) at `https://github.com/JoRouquette/obsidian-vps-publish/releases`.
2. Create `your-vault/.obsidian/plugins/vps-publish/` (inside your vault).
3. Extract or copy the assets into that folder.
4. Reload plugins in Obsidian and enable **Publish to VPS**.

### From source

1. `npm install --no-audit --no-fund`
2. `npm run package:plugin`
3. Copy or symlink `dist/vps-publish/` into `your-vault/.obsidian/plugins/vps-publish/`.

## Quick start (Docker-backed server)

1. Run the server container (example):

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

   The container exposes `/api/**`, `/content/**`, `/assets/**`, `/health`, and `/` (SPA). See `docs/docker.md` for more options, compose files, and environment details.

2. In Obsidian, open **Settings → Community plugins → Publish to VPS**:
   - API URL: e.g., `http://localhost:3000`
   - API key: the `API_KEY` you passed to the container
   - Target folders, routes, and ignore rules to control what is published
3. Run the **Publish to VPS** command (and **Test VPS connection** if enabled).

## Features at a glance

- Property-based filtering and folder routing for published notes.
- Bundles assets alongside Markdown uploads.
- Generates and serves `_manifest.json` so the SPA can render and search your content.
- **Server-Side Rendering (SSR)** for improved SEO and faster first paint.
- **End-to-end testing** with Playwright for reliable UI validation.
- Release artifacts include a ready-to-drop `vps-publish.zip` for manual installs.

## Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

See `docs/site/testing-e2e.md` for detailed E2E testing guide.

## SEO Features

This project implements comprehensive **search engine optimization** to ensure published content is discoverable and ranks well in search results.

### Key SEO Capabilities

| Feature                   | Description                                     | Status | Implementation                           |
| ------------------------- | ----------------------------------------------- | ------ | ---------------------------------------- |
| **Dynamic Meta Tags**     | OG tags, Twitter Cards, canonical links         | ✅     | [docs/site/seo.md](docs/site/seo.md)     |
| **Sitemap.xml**           | Auto-generated XML sitemap with ETag caching    | ✅     | [docs/api/README.md](docs/api/README.md) |
| **Robots.txt**            | Search engine crawl directives                  | ✅     | [docs/api/README.md](docs/api/README.md) |
| **301 Redirects**         | Automatic slug change detection and redirection | ✅     | [docs/site/seo.md](docs/site/seo.md)     |
| **Cache Optimization**    | ETag-based conditional caching for performance  | ✅     | [docs/site/seo.md](docs/site/seo.md)     |
| **JSON-LD**               | Structured data for rich snippets               | ✅     | [docs/site/seo.md](docs/site/seo.md)     |
| **Server-Side Rendering** | Pre-rendered HTML for search engine crawlers    | ⚠️     | [docs/site/ssr.md](docs/site/ssr.md)     |

⚠️ **Known Issue**: Angular 20 SSR has a JIT compilation error ("PlatformLocation needs JIT compiler"). SSR gracefully falls back to CSR mode. Application remains fully functional with client-side rendering. See [docs/site/ssr.md](docs/site/ssr.md#known-issue-angular-20-jit-compilation-error) for details.

### SEO Configuration

#### Environment Variables

```bash
# Backend SEO settings
BASE_URL=https://your-domain.com          # Required for sitemap and canonical URLs
SITE_NAME="Your Site Name"                # Used in meta tags
AUTHOR="Your Name"                        # Used in JSON-LD structured data
```

#### Manifest Fields

Pages in `_manifest.json` support SEO metadata:

```json
{
  "slug": "/my-page",
  "title": "Page Title",
  "description": "Page description for meta tags",
  "lastModifiedAt": "2026-02-02T10:00:00Z",
  "coverImage": "/assets/cover.jpg",
  "noIndex": false,
  "canonicalSlug": "/my-page"
}
```

### SEO Endpoints

| Endpoint                  | Purpose                        | Cache Strategy                   |
| ------------------------- | ------------------------------ | -------------------------------- |
| `/seo/sitemap.xml`        | XML sitemap for search engines | ETag-based, 1h cache             |
| `/seo/robots.txt`         | Crawl directives               | Static, long cache               |
| `/content/_manifest.json` | Content catalog                | ETag, 60s cache, must-revalidate |

### Automatic Features

1. **Slug Change Detection**: When publishing, if a page's route changes, a 301 redirect is automatically created from old → new route
2. **NoIndex Support**: Mark pages with `noIndex: true` in frontmatter to exclude from sitemap and add `robots: noindex` meta tag
3. **Canonical URLs**: Automatically generated for every page to avoid duplicate content issues
4. **Social Media Cards**: OG and Twitter Card meta tags for rich previews when shared

### Testing SEO

```bash
# Run E2E tests including SEO validation
npx nx e2e site --grep="SEO"

# Validate sitemap
curl http://localhost:3000/seo/sitemap.xml

# Check meta tags in real browser
# Open DevTools → Elements → <head>

# Lighthouse SEO audit
npx lighthouse http://localhost:4200 --only-categories=seo --view
```

### SEO Documentation

Complete SEO implementation details:

- [PR #1: Domain Layer SEO](docs/PR-1-DOMAIN-LAYER-SEO.md) - Domain entities (8 tests)
- [PR #2: Backend SEO API](docs/PR-2-BACKEND-SEO-API.md) - Sitemap & robots.txt (17 tests)
- [PR #3: Frontend SEO Service](docs/PR-3-FRONTEND-SEO-SERVICE.md) - Meta tags & resolver (24 tests)
- [PR #4: Redirections 301](docs/PR-4-REDIRECTIONS-301.md) - Slug change detection (21 tests)
- [PR #5: Cache Optimizations](docs/PR-5-CACHE-OPTIMIZATIONS.md) - ETag caching (15 tests)
- [PR #6: E2E Tests](docs/PR-6-E2E-TESTS.md) - Browser validation (21 tests)

**Total: 106 tests across 6 PRs** ensuring robust SEO implementation.

## Server-Side Rendering

The Angular frontend supports SSR for better SEO and performance:

```bash
# Development with SSR
npm run start site:ssr

# Production build (includes SSR)
npx nx build site --configuration=production
```

See `docs/ssr-guide.md` for complete SSR documentation.

## Contributors / deeper docs

Architecture, build, release, and API notes live in `/docs`. Start with `docs/README.md`.

## License

Distributed under `MIT License` (see `LICENSE`).
