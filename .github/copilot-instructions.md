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

- `docs/README.md` - **Documentation Charter** (MUST READ for any doc change)
- `docs/architecture.md` - Detailed API routes, environment variables, deployment
- `docs/development.md` - Setup and local workflows
- `docs/docker.md` - Multi-stage build details, compose files
- `docs/release.md` - semantic-release configuration and versioning strategy
- `docs/site/` - Angular frontend documentation
- `docs/api/` - Node.js backend documentation
- `docs/plugin/` - Obsidian plugin documentation

---

## Documentation Maintenance Rules (CRITICAL)

### Documentation Charter

**Read `docs/README.md` FIRST** before any documentation change. It defines:

- What to document (and what NOT to document)
- Documentation structure
- Standard document format
- Mandatory update rules

### Non-negotiable Rules

1. **Documentation serves usage, not history**
   - ❌ NO migration journals, refactoring summaries, implementation summaries
   - ❌ NO "overhaul-summary", "migration-summary", "implementation-summary" files
   - ✅ Document current state: architecture, usage, configuration, troubleshooting

2. **Plugin changes MUST update internal help**
   - Any change in `apps/obsidian-vps-publish/src/` affecting parsing/rendering/syntax MUST update:
     - `apps/obsidian-vps-publish/src/i18n/locales.ts` → `help` sections (EN + FR)
     - `docs/plugin/syntaxes.md`
   - This includes: wikilinks, footnotes, callouts, tags filtering, dataview, leaflet, etc.

3. **No orphaned documentation files**
   - Every `.md` file in `docs/` MUST be referenced in an index README
   - Allowed locations: `docs/{site,api,plugin}/`, `docs/en/{site,api,plugin}/`, `docs/_archive/`
   - Anything else triggers CI failure

4. **No redundant documentation**
   - Before creating a new doc file, check if an existing file can be extended
   - One topic = one page (don't split unnecessarily)
   - No duplicate FR/EN unless truly useful for international audience

### Decision Tree for Documentation Changes

**When you make ANY code change**, ask:

1. **Does this change user-facing behavior or configuration?**
   - YES → Update relevant doc in `docs/{site,api,plugin}/`
   - NO → No doc update needed

2. **Does this change plugin parsing/rendering/syntax?**
   - YES → **MANDATORY** update:
     - `apps/obsidian-vps-publish/src/i18n/locales.ts` (help sections)
     - `docs/plugin/syntaxes.md`
   - NO → Continue to next question

3. **Does this change require a new documentation file?**
   - Check existing docs in target area (`site/`, `api/`, `plugin/`)
   - If a relevant file exists, extend it with a new section
   - Only create new file if topic is distinct and substantial (>50 lines)

4. **Is this a refactoring/migration with historical interest?**
   - NO new doc file allowed
   - Update existing doc to reflect current state
   - If truly useful for internal reference, add to `docs/_archive/` (not indexed)

### Forbidden Documentation Practices

❌ **Never create these types of files:**

- `*-summary.md`, `*-implementation.md`, `*-migration.md`, `*-overhaul.md`
- `*-checklist.md` (unless active, operational checklist used in CI/workflows)
- `*-journal.md`, `*-log.md`, `*-history.md`
- Step-by-step implementation narratives ("we did X, then Y, then Z")

❌ **Never document:**

- How a refactoring was done (irrelevant once complete)
- Step-by-step migration details (document final state only)
- Obsolete implementation details replaced by newer versions
- Exhaustive catalogs of all internal components (document what's configurable/used)

### Standard Document Format

Every feature doc MUST follow this structure:

```markdown
# Feature Title

## Purpose

Why this feature exists, what problem it solves.

## When to Use

Concrete use cases, typical scenarios.

## Key Concepts

Definitions, architecture, involved components (keep concise).

## Configuration

Environment variables, settings, available options.

## Usage

Practical examples, commands, workflows.

## Troubleshooting

Common issues and solutions.

## References

Links to source code, relevant issues, PRs.
```

### Validation Rules (enforced by CI)

The script `npm run docs:check` verifies:

1. **Structure compliance**: No `.md` files outside allowed locations
2. **Index completeness**: All `.md` files are referenced in a README index
3. **Plugin help sync**: Changes in plugin parsing/rendering are accompanied by help updates

**These checks run in CI and will fail the build if violated.**

### Examples of Good Documentation Updates

✅ **Adding a new feature** (Leaflet maps):

1. Add section to existing doc: `docs/site/leaflet.md`
2. Update `docs/site/README.md` index to reference it
3. Update plugin help: `locales.ts` → `help.sections.leaflet`
4. Run `npm run docs:check`

✅ **Documenting a new API endpoint**:

1. Add section to `docs/api/README.md` under "API Endpoints"
2. If substantial (>50 lines), create `docs/api/endpoint-name.md`
3. Update index in `docs/api/README.md`

✅ **Refactoring performance**:

1. Update `docs/api/performance.md` with new metrics/config
2. Remove any mention of "how we migrated" or "before/after"
3. Document only current state and usage

❌ **Bad examples (DON'T DO THIS)**:

1. Creating `docs/leaflet-implementation-summary.md` after implementing Leaflet
2. Creating `docs/performance-overhaul-summary.md` after performance refactoring
3. Adding step-by-step migration details to a doc
4. Creating a new doc when existing `docs/site/leaflet.md` could be extended

### Plugin Help Component Sync (CRITICAL)

**File**: `apps/obsidian-vps-publish/src/i18n/locales.ts`

**Sections to keep synchronized**:

````typescript
help: {
  sections: {
    publishing: { ... },      // publish: false, draft: true
    noPublishing: { ... },    // ^no-publishing marker
    frontmatter: { ... },     // YAML properties
    wikilinks: { ... },       // [[Note]], [[#Header]], [[Note#Section]]
    assets: { ... },          // ![[image.png]], ![](path)
    dataview: { ... },        // `= this.prop`, dataview blocks
    leaflet: { ... },         // ```leaflet blocks
    markdown: { ... }         // Advanced: headings, footnotes, tags filtering
  }
}
````

**When to update**:

- Adding/removing supported syntax
- Changing behavior of existing syntax
- Adding new plugin setting that affects rendering
- Fixing a bug that changes how syntax is processed

**How to update**:

1. Edit `locales.ts` → `en` and `fr` help sections
2. Update `docs/plugin/syntaxes.md` to match
3. Test help modal in Obsidian (open with command or settings button)

### Automated Checks Implementation

**Script location**: `scripts/docs-check.mjs` (to be created in next step)

**What it checks**:

1. All `.md` files are in allowed locations
2. All `.md` files (except `_archive/`) are referenced in an index README
3. Changes in plugin src affecting parsing/rendering have corresponding help updates

**Integration**:

- Added to `package.json`: `"docs:check": "node scripts/docs-check.mjs"`
- Runs in CI (GitHub Actions) before build/test
- Blocks merge if checks fail

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
