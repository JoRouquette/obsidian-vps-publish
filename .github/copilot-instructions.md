# Copilot Instructions: obsidian-vps-publish

## Project Overview

This is an **Nx monorepo** containing three main applications plus shared libraries:

- **Obsidian plugin** (`apps/obsidian-vps-publish`) - TypeScript plugin bundled with esbuild
- **Backend API** (`apps/node`) - Express.js API for content ingestion and serving
- **Frontend SPA** (`apps/site`) - Angular application for rendering published content
- **Shared libraries** (`libs/core-domain`, `libs/core-application`) - Domain entities, ports, and application services

The project enables users to publish Obsidian vault content to a self-hosted VPS via a session-based upload API, then serve it as a browsable website.

## Architecture: Clean Architecture + CQRS

This project follows **Clean Architecture** principles with **CQRS (Command Query Responsibility Segregation)** pattern.

### Layer Boundaries (Nx Tags)

The codebase enforces **strict layer boundaries** via ESLint's `@nx/enforce-module-boundaries` rule (see `eslint.config.cjs`):

- **`layer:domain`** (`libs/core-domain`): Entities, value objects, ports (interfaces), errors. **No dependencies** on other layers.
- **`layer:application`** (`libs/core-application`): Commands, queries, handlers, services. Depends only on `domain` and `application`.
- **`layer:infra`** (`apps/node`): Infrastructure adapters (filesystem, HTTP, logging). Tagged `type:api`.
- **`layer:ui`** (`apps/site`): Angular UI components and presentation. Tagged `type:app`.
- **Plugin** (`apps/obsidian-vps-publish`): Tagged `layer:application` + `type:plugin`.

**Critical rules**:

1. Domain layer must NEVER import from application/infra/ui layers
2. Always inject dependencies via **ports** (interfaces in `libs/core-domain/src/lib/ports/`)
3. Infrastructure adapters implement domain ports (e.g., `ConsoleLogger` implements `LoggerPort`)

### CQRS Pattern

The application layer follows **CQRS** to separate read and write operations:

**Commands** (write operations - modify state):

- Located in `libs/core-application/src/lib/*/commands/`
- Paired with a `CommandHandler<C, R>` that executes the command
- Examples:
  - `CreateSessionCommand` → `CreateSessionHandler` → creates new session
  - `FinishSessionCommand` → `FinishSessionHandler` → commits session content
  - `UploadAssetsCommand` → processes and stores assets

**Queries** (read operations - no side effects):

- Located in `libs/core-application/src/lib/catalog/queries/`
- Paired with a `QueryHandler<Q, R>` that executes the query
- Examples:
  - `FindPageQuery` → `FindPageHandler` → retrieves page from manifest
  - `LoadManifestQuery` → loads content catalog
  - `SearchPagesQuery` → searches pages by criteria

**Handler Pattern**:

```typescript
// Command handler signature
interface CommandHandler<C, R = void> {
  handle(command: C): Promise<R>;
}

// Query handler signature
interface QueryHandler<Q, R> {
  handle(query: Q): Promise<R>;
}
```

Handlers receive dependencies via **constructor injection** (ports only, never concrete implementations).

## Key Workflows & Commands

### Development

```bash
# Install dependencies (husky hooks will be set up)
npm install --no-audit --no-fund

# Start individual apps
npm run start node      # Backend on port 3000
npm run start site      # Angular dev server

# Build everything (respects dependency graph)
npm run build           # Builds all projects in order
npm run build:plugin    # Plugin only → dist/apps/obsidian-vps-publish/main.js
npm run package:plugin  # Build + copy assets → dist/vps-publish/ ready for Obsidian
```

### Testing & Quality

```bash
npm run lint            # ESLint all projects (checks layer boundaries!)
npm run lint:fix        # Auto-fix imports, unused vars
npm run test            # Jest tests across all projects
npm run format          # Prettier write (npm run format:dry for check)
```

### Docker Workflow

Uses **multi-stage Dockerfile** (builder + runtime):

```bash
# Via tasks.json (preferred)
"Docker: dev up"        # Compose up with dev overlay
"Docker: dev down"      # Compose down + volumes removed

# Manual
docker build -t obsidian-vps-publish:local .
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The runtime stage:

1. Installs **production-only** dependencies (`npm install --omit=dev --ignore-scripts`)
2. Copies built artifacts from Nx builder stage (`/workspace/dist`)
3. Extracts Angular `browser/` output to `UI_ROOT` (/ui)
4. Runs `dist/apps/node/main.js` as entrypoint

### Release Process (Automated)

- **semantic-release** drives versioning (see `release.config.cjs`)
- Commit types: `feat` (minor), `fix`/`hotfix`/`perf`/`refactor` (patch), `docs(readme)` (patch)
- On merge to `main`:
  1. `scripts/sync-version.mjs` updates `package.json`, `manifest.json`, `versions.json`, and `apps/{node,site}/src/version.ts`
  2. Plugin is built and packaged to `dist/vps-publish.zip`
  3. GitHub release created with plugin assets (`main.js`, `manifest.json`, `styles.css`, `versions.json`, `vps-publish.zip`)

**Important**: Keep `manifest.json` (root) and `apps/obsidian-vps-publish/versions.json` aligned manually for local development.

## Backend API Session Workflow

All `/api/**` routes require `x-api-key` header. The upload workflow is **session-based**:

1. **`POST /api/session/start`** → returns `sessionId` + upload URLs
2. **`POST /api/session/:sessionId/notes/upload`** → batch upload Markdown with frontmatter
3. **`POST /api/session/:sessionId/assets/upload`** → upload binary assets (images, PDFs, etc.)
4. **`POST /api/session/:sessionId/finish`** → commit staged content to `CONTENT_ROOT`, update `_manifest.json`
5. **`POST /api/session/:sessionId/abort`** → discard staged content

### Key Env Variables (Backend)

- `API_KEY` (required for auth)
- `CONTENT_ROOT` (default `/content`) - rendered HTML + manifest
- `ASSETS_ROOT` (default `/assets`) - binary assets
- `UI_ROOT` (default `/ui`) - Angular SPA static files
- `ALLOWED_ORIGINS` (CORS), `LOGGER_LEVEL`, `NODE_ENV`, `PORT`
- Metadata: `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`

See `apps/node/src/infra/config/env-config.ts` for defaults and `.env.dev.example` / `.env.prod.example` for templates.

## Testing Conventions

- **Test files**: `*.test.ts` or `*.spec.ts` in `_tests/` subdirectories
- **Jest config**: Each app/lib has its own `jest.config.cjs` (see `nx.json` for `@nx/jest/plugin`)
- **Mocking approach** (see `apps/node/src/_tests/app.test.ts`):
  - Mock heavy dependencies at top of test file with `jest.mock()`
  - Express controllers tested via `supertest`
  - All tests must pass before release (`npm test` runs in CI)

## Code Style & Linting

- **ESLint plugins**: `simple-import-sort` (auto-sorts imports), `unused-imports` (removes unused), `prettier`
- **Key rules** (from `eslint.config.cjs`):
  - `@typescript-eslint/no-explicit-any`: error (no `any` types)
  - `@typescript-eslint/no-floating-promises`: error (always await/catch promises)
  - `@typescript-eslint/no-misused-promises`: error (no promises in conditionals without proper handling)
  - Import order enforced: run `npm run lint:fix` to auto-sort

## Plugin-Specific Details

### Build System (esbuild)

- **Entry**: `apps/obsidian-vps-publish/src/main.ts`
- **Output**: `dist/apps/obsidian-vps-publish/main.js` (CommonJS, ES2018 target)
- **Externals**: `obsidian`, `electron`, CodeMirror modules, Node builtins (see `esbuild.config.mjs`)
- **Dev mode**: `npx nx run obsidian-vps-publish:dev` watches for changes
- **Prod mode**: minified, no sourcemaps

### Plugin Development Workflow

1. `npm run build:plugin` or `npm run package:plugin`
2. Symlink `dist/vps-publish/` to `<vault>/.obsidian/plugins/vps-publish/`
3. Reload plugins in Obsidian (`Ctrl+R` or Settings → Community plugins → Reload)
4. Check console for errors (Obsidian DevTools: `Ctrl+Shift+I`)

### Obsidian API Integration

- Main plugin class extends `Plugin` from `obsidian` package
- Settings stored via `loadData()` / `saveData()` (encrypted API keys with `lib/api-key-crypto.ts`)
- Uses adapters to bridge Obsidian APIs to domain ports:
  - `ObsidianVaultAdapter` → implements `VaultPort`
  - `ObsidianAssetsVaultAdapter` → implements `AssetsVaultPort`
  - `ConsoleLoggerAdapter` → implements `LoggerPort`

## Shared Libraries Design

**`libs/core-domain`**: Pure TypeScript, no framework dependencies (innermost layer)

- **Entities**: `Note`, `Asset`, `Session`, `CollectedNote`, `Manifest`, etc.
- **Value Objects**: `Slug` (URL-safe identifier with validation)
- **Ports**: Interfaces for dependencies (e.g., `LoggerPort`, `VaultPort`, `ContentStoragePort`, `ManifestPort`)
  - Ports define contracts that infrastructure must implement
  - Enable dependency inversion: domain doesn't depend on infrastructure
- **Errors**: Domain-specific error classes (e.g., `SessionError`)
- **No external dependencies**: Domain must remain pure and framework-agnostic

**`libs/core-application`**: Business logic orchestration (use cases layer)

- **Commands/Queries**: CQRS pattern for separating reads from writes
  - Commands: `CreateSessionCommand`, `FinishSessionCommand`, `UploadAssetsCommand`, etc.
  - Queries: `FindPageQuery`, `LoadManifestQuery`, `SearchPagesQuery`, etc.
- **Handlers**: Execute commands/queries with injected ports
  - `CreateSessionHandler`, `FinishSessionHandler` (command handlers)
  - `FindPageHandler`, `LoadManifestHandler` (query handlers)
- **Services**: Domain services for complex business logic
  - `DetectAssetsService`, `ResolveWikilinksService`, `ContentSanitizerService`
  - Services are stateless and injected into handlers
- **Mappers**: Transform between domain entities and DTOs (e.g., `NotesMapper`)
- **Chain-of-Responsibility**: Some handlers chain (e.g., `ParseContentHandler` → `EvaluateIgnoreRulesHandler`)

**Infrastructure Layer** (`apps/node/src/infra/`, `apps/obsidian-vps-publish/src/lib/infra/`):

- **Adapters**: Implement domain ports with concrete technologies
  - `ConsoleLogger` implements `LoggerPort`
  - `UuidIdGenerator` implements `IdGeneratorPort`
  - `FileSystemSessionRepository` implements `SessionRepository`
  - `ObsidianVaultAdapter` implements `VaultPort` (plugin-specific)
- **HTTP/Express**: REST API controllers, middleware, DTOs
- **File System**: Storage adapters for notes, assets, sessions, manifest
- Adapters translate between external APIs and domain models

## Common Pitfalls & Solutions

1. **Layer boundary violations**: If ESLint errors on imports, check project tags in `libs/*/project.json` and ensure domain → application → infra/ui direction. Domain layer cannot import from application/infra.
2. **Missing dependency injection**: Handlers must receive dependencies via constructor (ports only). Never instantiate infrastructure adapters directly in application layer.
3. **CQRS violations**: Commands should modify state and return minimal results. Queries should be read-only with no side effects. Don't mix concerns.
4. **Port implementation mismatches**: When creating an infrastructure adapter, ensure it fully implements the domain port interface. TypeScript will enforce the contract.
5. **Plugin not loading**: Verify `manifest.json` `minAppVersion` matches Obsidian version. Check `versions.json` is included in `dist/vps-publish/`.
6. **Docker builds failing**: Ensure Nx builds succeed locally first (`npm run build`). Check that `UI_ROOT` is populated correctly in Dockerfile's `COPY --from=builder` stage.
7. **Session upload errors**: Backend requires exact request shape (see `apps/node/src/infra/http/express/dtos/`). Use `_tests/dtos.test.ts` as reference for valid payloads.
8. **Version mismatches**: Release script syncs 6 files. For manual updates, edit `package.json` (root), `manifest.json`, `apps/obsidian-vps-publish/versions.json`, and run `scripts/sync-version.mjs`.

## Nx-Specific Notes

- **Implicit dependencies**: Nx infers build order from `import` statements. If build fails, check `nx.json` targetDefaults.
- **Cache**: Nx caches build/test results. Use `--skip-nx-cache` to force rebuild (scripts already include this where needed).
- **Tasks**: VS Code tasks (`.vscode/tasks.json`) integrate with Nx. Use `Ctrl+Shift+B` → "Launch all" to start both node + site in parallel.

## File Naming Conventions

- **Commands**: `*.command.ts` (application layer, CQRS write operations)
- **Queries**: `*.query.ts` (application layer, CQRS read operations)
- **Command Results**: `*.result.ts` (return types for commands)
- **Handlers**: `*.handler.ts` (command/query handlers or chain-of-responsibility)
- **Services**: `*.service.ts` (domain services in application layer)
- **Mappers**: `*.mapper.ts` (entity-to-dto transforms)
- **Ports**: `*-port.ts` or `*.port.ts` (interfaces in domain layer)
- **Adapters**: `*.adapter.ts` (plugin-specific), `*-file-system.*.ts` (backend infra)
- **Repositories**: `*.repository.ts` (persistence port implementations in infra)
- **DTOs**: `*.dto.ts` (backend HTTP layer, external contracts)
- **Entities**: Plain class files in `libs/core-domain/src/lib/entities/`
- **Value Objects**: `*.value-object.ts` in domain
- **Tests**: `*.test.ts` or `*.spec.ts` in `_tests/` folders

## Environment Setup for Contributors

1. Clone repo, run `npm install --no-audit --no-fund`
2. Copy `.env.dev.example` to `.env.dev` (or set env vars for Docker)
3. For plugin testing: symlink `dist/vps-publish/` after `npm run package:plugin`
4. For backend: `npm run start node`, or use Docker tasks
5. For frontend: `npm run start site` (standalone) or access via backend's `/` route

## Additional Documentation

- `docs/architecture.md` - Detailed API routes, environment variables, deployment
- `docs/development.md` - Setup and local workflows
- `docs/docker.md` - Multi-stage build details, compose files
- `docs/release.md` - semantic-release configuration and versioning strategy

---

## Clean Architecture Checklist

When adding new features, follow this workflow:

1. **Define domain concepts first** (`libs/core-domain`):
   - Create entities/value objects if needed
   - Define port interface for external dependencies
   - Add domain-specific errors if applicable

2. **Implement use case** (`libs/core-application`):
   - Create command (write) or query (read) interface
   - Create corresponding result type
   - Implement handler with constructor-injected ports
   - Add services for complex domain logic

3. **Build infrastructure** (`apps/node/src/infra/` or plugin's `lib/infra/`):
   - Create adapters that implement domain ports
   - Wire dependencies in controllers/main entry point
   - Add HTTP DTOs for API contracts (backend only)

4. **Test at boundaries**:
   - Mock infrastructure adapters when testing handlers
   - Use `jest.mock()` at file boundaries (see `apps/node/src/_tests/app.test.ts`)
   - Test adapters against their port contracts

**Remember**: This monorepo enforces clean architecture. Always think "domain → application → infrastructure" when adding features. Dependencies point inward: infra → application → domain. Use ports for all external dependencies.
