# Architecture

## Monorepo Layout

This project uses **Nx** to manage a monorepo with three main applications and shared libraries:

- **`apps/node`**: Express + TypeScript backend that renders Markdown to HTML, maintains `_manifest.json`, and serves API + static assets
- **`apps/site`**: Angular SPA that consumes the manifest to render the published site (routing, search, viewer)
- **`apps/obsidian-vps-publish`**: Obsidian plugin (TypeScript + Obsidian API, bundled with esbuild)
- **Shared libraries**: `libs/core-domain`, `libs/core-application`

## Clean Architecture Layers

The codebase follows **Clean Architecture** principles with strict layer boundaries enforced by ESLint's `@nx/enforce-module-boundaries` rule:

### Layer Hierarchy

```
┌─────────────────────────────────────┐
│  Infrastructure (apps/node/infra)   │  ← Adapters, HTTP, File System
├─────────────────────────────────────┤
│  Application (libs/core-application)│  ← Use Cases, Services, Handlers
├─────────────────────────────────────┤
│  Domain (libs/core-domain)          │  ← Entities, Ports, Value Objects
└─────────────────────────────────────┘
```

**Dependency Rule**: Dependencies point **inward** (infra → application → domain). Domain has zero external dependencies.

### Domain Layer (`libs/core-domain`)

- **Entities**: `Note`, `Asset`, `Session`, `Manifest`, `Page`, etc.
- **Value Objects**: `Slug` (URL-safe identifier with validation)
- **Ports**: Interfaces for external dependencies (`LoggerPort`, `VaultPort`, `ContentStoragePort`, `ManifestPort`)
- **Errors**: Domain-specific exceptions (`SessionError`, `ValidationError`)
- **Zero dependencies**: Pure TypeScript, framework-agnostic

### Application Layer (`libs/core-application`)

- **CQRS Pattern**: Commands (write operations) and Queries (read operations)
- **Handlers**: Execute commands/queries with injected ports
  - Command handlers: `CreateSessionHandler`, `FinishSessionHandler`
  - Query handlers: `FindPageHandler`, `LoadManifestHandler`
- **Services**: Domain services for complex business logic
  - `DetectAssetsService`, `ResolveWikilinksService`, `ContentSanitizerService`
- **Mappers**: Transform between domain entities and DTOs
- **Dependency Injection**: All handlers receive dependencies via constructor (ports only)

### Infrastructure Layer

**Backend** (`apps/node/src/infra/`):

- **Adapters**: Implement domain ports with concrete technologies
  - `ConsoleLogger` implements `LoggerPort`
  - `FileSystemSessionRepository` implements `SessionRepository`
  - `UuidIdGenerator` implements `IdGeneratorPort`
- **HTTP/Express**: REST API controllers, middleware, DTOs
- **File System**: Storage adapters for notes, assets, sessions, manifest

**Plugin** (`apps/obsidian-vps-publish/src/lib/infra/`):

- `ObsidianVaultAdapter` implements `VaultPort`
- `ObsidianAssetsVaultAdapter` implements `AssetsVaultPort`
- `ConsoleLoggerAdapter` implements `LoggerPort`

## Backend API (`apps/node`)

### Stack

- **Runtime**: Express + TypeScript
- **CI**: Node.js 22
- **Docker**: Node 20-alpine

### Authentication

All `/api/**` routes require `x-api-key` header matching `API_KEY` environment variable.

### Session Workflow

Publishing uses a **session-based upload** system:

1. **`POST /api/session/start`**
   - Creates new session
   - Returns `sessionId` + upload URLs
   - Optional callout styles configuration

2. **`POST /api/session/:sessionId/notes/upload`**
   - Batch upload Markdown + frontmatter
   - Content staged in session directory

3. **`POST /api/session/:sessionId/assets/upload`**
   - Upload binary assets (images, PDFs, etc.)
   - Assets staged separately

4. **`POST /api/session/:sessionId/finish`**
   - Commit staged content to `CONTENT_ROOT`
   - Update `_manifest.json`
   - Session becomes active

5. **`POST /api/session/:sessionId/abort`**
   - Discard staged content
   - Cleanup session directory

### Public Endpoints

- **`GET /health`**: Healthcheck (used by Docker)
- **`GET /public-config`**: Site metadata (`siteName`, `author`, `repoUrl`, `reportIssuesUrl`)

### Static Content

- **`/content/**`\*\*: Rendered HTML from mounted volume
- **`/assets/**`\*\*: Binary assets from mounted volume
- **`/`**: Angular SPA served from `UI_ROOT`

### Environment Variables

See `.env.dev.example` / `.env.prod.example` for complete configuration.

**Required**:

- `API_KEY`: Authentication key for API routes

**Paths**:

- `CONTENT_ROOT` (default: `/content`): Rendered HTML + `_manifest.json`
- `ASSETS_ROOT` (default: `/assets`): Binary assets
- `UI_ROOT` (default: `/ui`): Angular SPA static files

**Metadata**:

- `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`

**Configuration**:

- `ALLOWED_ORIGINS` (CORS)
- `LOGGER_LEVEL` (debug, info, warn, error)
- `PORT` (default: 3000)
- `NODE_ENV` (development, production)

## Frontend (`apps/site`)

### Stack

- **Framework**: Angular 20 (standalone components)
- **State Management**: Signals + RxJS
- **UI**: Material Design 3
- **Rendering**: SSR + CSR (Server-Side Rendering + Client-Side Rendering)

### Architecture

- **Facades**: `CatalogFacade`, `ConfigFacade`, `SearchFacade`
- **Repositories**: `HttpContentRepository` (loads HTML from `/content/`)
- **Components**: Shell, Topbar, Viewer, Home, VaultExplorer, SearchBar

### Build

- **Development**: `npm run start site` (port 4200)
- **Production**: `npm run build` (outputs to `dist/apps/site/browser/`)
- **SSR**: `npm run start site:ssr`

### Docker Integration

The Docker image copies `dist/apps/site/browser/` to `UI_ROOT` during build, allowing the backend to serve the SPA directly at `/`.

## Obsidian Plugin (`apps/obsidian-vps-publish`)

### Responsibilities

1. Parse vault content (notes, assets, Dataview blocks)
2. Process wikilinks and embed references
3. Upload to backend via session API
4. Provide settings UI for configuration
5. Encrypt API keys locally

### Build System

- **Bundler**: esbuild (CommonJS, ES2018 target)
- **Entry**: `apps/obsidian-vps-publish/src/main.ts`
- **Output**: `dist/apps/obsidian-vps-publish/main.js`
- **Externals**: `obsidian`, `electron`, CodeMirror, Node builtins

### Commands

- **Build**: `npm run build:plugin`
- **Watch**: `npx nx run obsidian-vps-publish:dev`
- **Package**: `npm run package:plugin` → `dist/vps-publish/`

### Release Packaging

**semantic-release** automates versioning and release:

1. Determines version from commit messages
2. Updates 6 files:
   - `package.json` (root)
   - `manifest.json` (root)
   - `apps/obsidian-vps-publish/versions.json`
   - `apps/{node,site}/src/version.ts`
3. Builds plugin with `npm run build:plugin`
4. Packages to `dist/vps-publish.zip`
5. Creates GitHub release with assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   - `versions.json`
   - `vps-publish.zip`

### Manifest Alignment

Keep these files synchronized manually for local development:

- `manifest.json` (root)
- `apps/obsidian-vps-publish/versions.json`

## Shared Libraries

### `libs/core-domain`

**Purpose**: Pure domain logic (innermost layer)

**Contents**:

- **Entities**: `Note`, `Asset`, `Session`, `CollectedNote`, `Manifest`, `Page`
- **Value Objects**: `Slug` (validated URL-safe identifier)
- **Ports**: Interface definitions for external dependencies
  - `LoggerPort`, `VaultPort`, `ContentStoragePort`, `ManifestPort`, `SessionRepository`
- **Errors**: `SessionError`, `ValidationError`, `PublishError`
- **Utils**: String manipulation, path utilities

**Rules**:

- No external dependencies (pure TypeScript)
- No imports from application/infrastructure layers
- Framework-agnostic

### `libs/core-application`

**Purpose**: Business logic orchestration (use cases layer)

**Contents**:

- **Commands**: Write operations that modify state
  - `CreateSessionCommand`, `FinishSessionCommand`, `UploadAssetsCommand`
- **Queries**: Read operations with no side effects
  - `FindPageQuery`, `LoadManifestQuery`, `SearchPagesQuery`
- **Handlers**: Execute commands/queries
  - Receive dependencies via constructor (ports only)
  - Example: `CreateSessionHandler`, `FindPageHandler`
- **Services**: Domain services for complex logic
  - `DetectAssetsService`, `ResolveWikilinksService`, `ContentSanitizerService`
- **Mappers**: Entity-to-DTO transformations

**Rules**:

- Depends only on `core-domain`
- All dependencies injected via ports
- No direct infrastructure dependencies

## Testing

### Test Structure

- **Unit Tests**: `*.test.ts` or `*.spec.ts` in `_tests/` subdirectories
- **Integration Tests**: API endpoints tested with `supertest`
- **E2E Tests**: Playwright tests in `apps/site/e2e/`

### Jest Configuration

Each app/lib has its own `jest.config.cjs` (Nx plugin: `@nx/jest/plugin`)

### Coverage

- **Backend**: 114 tests (apps/node + libs)
- **Plugin**: 73 tests
- **Frontend**: 26 tests

## Docker Workflow

### Multi-Stage Build

**Dockerfile** uses builder + runtime stages:

1. **Builder**: Installs all dependencies, runs Nx builds
2. **Runtime**: Copies built artifacts, installs production-only dependencies

### Development

```bash
# Via VS Code tasks
Task: "Docker: dev up"

# Or manually
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Deployment

### Requirements

- Docker + Docker Compose
- Node.js 20+ (for local development)
- Obsidian 1.5.0+ (for plugin)

### Volumes

- `./content:/content`: Rendered HTML + manifest
- `./assets:/assets`: Binary assets
- `./logs:/logs`: Application logs (optional)

### Healthcheck

Docker healthcheck calls `GET /health` every 30s. Container is healthy when endpoint returns `{"status":"healthy"}`.

## Related Documentation

- [Development](./development.md) - Local setup and workflows
- [Docker](./docker.md) - Container image and deployment
- [Release](./release.md) - Versioning and release process
- [Markdown Rendering](./markdown-rendering.md) - Advanced rendering features
- [Dataview](./dataview.md) - Dataview processing

## Key Design Decisions

### Why Clean Architecture?

- **Testability**: Domain and application layers testable without infrastructure
- **Flexibility**: Easy to swap implementations (e.g., different storage backends)
- **Maintainability**: Clear boundaries prevent coupling

### Why CQRS?

- **Separation of Concerns**: Reads and writes have different optimization needs
- **Scalability**: Can optimize query and command paths independently
- **Clarity**: Explicit intent (command vs query)

### Why Nx Monorepo?

- **Code Sharing**: Domain and application logic shared across backend/plugin
- **Build Orchestration**: Nx understands dependency graph
- **Type Safety**: TypeScript shared across entire codebase
- **Developer Experience**: Single `npm install`, unified tooling
