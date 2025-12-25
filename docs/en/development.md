# Development Guide

## Prerequisites

- **Node.js**: 22+ (for development and CI)
- **npm**: Included with Node.js
- **Obsidian**: 1.5.0+ (for plugin testing)
- **Docker**: Optional (for container testing)
- **Git**: For version control

## Initial Setup

```bash
# Clone the repository
git clone https://github.com/JoRouquette/obsidian-vps-publish.git
cd obsidian-vps-publish

# Install dependencies
npm install --no-audit --no-fund
```

This installs all dependencies for the monorepo and sets up **husky** git hooks for commit message linting.

## Development Scripts

### Building

```bash
# Build all projects (respects dependency graph)
npm run build

# Build specific projects
npm run build:node      # Backend only
npm run build:site      # Angular frontend only
npm run build:plugin    # Obsidian plugin only

# Package plugin for Obsidian
npm run package:plugin  # Build + copy assets → dist/vps-publish/
```

### Development Servers

```bash
# Start backend (Express API on port 3000)
npm run start node

# Start frontend (Angular dev server on port 4200)
npm run start site

# Start plugin in watch mode
npx nx run obsidian-vps-publish:dev
```

### Testing & Quality

```bash
# Run all tests (Jest)
npm run test

# Run tests for specific project
npx nx test node
npx nx test site
npx nx test obsidian-vps-publish

# Linting
npm run lint            # Lint all projects
npm run lint:fix        # Auto-fix imports, unused vars

# Formatting
npm run format          # Prettier write
npm run format:dry      # Check formatting without writing
```

## Local Plugin Development

### Option 1: Symlink (Recommended)

```bash
# Build and package plugin
npm run package:plugin

# Create symlink in your vault
# Windows (PowerShell as Administrator):
New-Item -ItemType SymbolicLink -Path "C:\path\to\vault\.obsidian\plugins\vps-publish" -Target "C:\path\to\repo\dist\vps-publish"

# macOS/Linux:
ln -s /path/to/repo/dist/vps-publish ~/path/to/vault/.obsidian/plugins/vps-publish

# Reload plugins in Obsidian (Ctrl+R or Settings → Community plugins → Reload)
```

### Option 2: Manual Copy

```bash
# Build and package
npm run package:plugin

# Copy dist/vps-publish/ to vault/.obsidian/plugins/vps-publish/
cp -r dist/vps-publish /path/to/vault/.obsidian/plugins/vps-publish

# Reload plugins in Obsidian
```

### Plugin Development Workflow

1. Make changes to plugin code in `apps/obsidian-vps-publish/src/`
2. Run `npx nx run obsidian-vps-publish:dev` (watch mode)
3. Reload plugin in Obsidian (Ctrl+R)
4. Check console for errors (Ctrl+Shift+I)
5. Test functionality
6. Run tests: `npx nx test obsidian-vps-publish`

### Debugging Plugin

1. Open Obsidian DevTools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
2. Check Console tab for logs
3. Use `console.log()` statements in plugin code
4. Inspect network requests in Network tab

## Environment Configuration

### Backend (.env files)

Create environment files from examples:

```bash
# Development
cp .env.dev.example .env.dev

# Production
cp .env.prod.example .env.prod
```

**Required variables**:

- `API_KEY`: Authentication key for API routes

**Optional variables** (see `apps/node/src/infra/config/env-config.ts` for defaults):

- `CONTENT_ROOT` (default: `/content`)
- `ASSETS_ROOT` (default: `/assets`)
- `UI_ROOT` (default: `/ui`)
- `ALLOWED_ORIGINS` (CORS)
- `LOGGER_LEVEL` (debug, info, warn, error)
- `PORT` (default: 3000)
- `NODE_ENV` (development, production)
- `SITE_NAME`, `AUTHOR`, `REPO_URL`, `REPORT_ISSUES_URL`

### Plugin Settings

Plugin settings are stored in Obsidian's data folder:

- Path: `vault/.obsidian/plugins/vps-publish/data.json`
- API keys are encrypted using `lib/api-key-crypto.ts`

## Docker Development

### Start Development Environment

```bash
# Via VS Code task (preferred)
Task: "Docker: dev up"

# Or manually
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Access Services

- **API**: http://localhost:3000
- **Health**: http://localhost:3000/health
- **Frontend**: http://localhost:3000/ (served by backend)

### View Logs

```bash
# All logs
docker compose logs -f

# Backend only
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100
```

### Stop & Cleanup

```bash
# Via VS Code task
Task: "Docker: dev down"

# Or manually
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

## VS Code Tasks

The project includes predefined VS Code tasks (`.vscode/tasks.json`):

- **Launch all**: Start both node + site in parallel
- **Launch site**: Angular dev server
- **Launch node**: Express API server
- **Plugin: dev (watch)**: Watch mode for plugin
- **Plugin: build**: Build plugin once
- **Plugin: package**: Build + package plugin
- **Docker: dev up**: Start Docker dev environment
- **Docker: dev down**: Stop Docker and remove volumes
- **Build all**: `npm run build`
- **Lint all**: `npm run lint`
- **Lint all --fix**: `npm run lint:fix`
- **Test all**: `npm run test`
- **Format all**: `npm run format:write`

Use `Ctrl+Shift+B` to access build tasks.

## Code Style

### ESLint Rules

- **Import sorting**: `simple-import-sort` plugin (auto-sort with `lint:fix`)
- **Unused imports**: `unused-imports` plugin (auto-remove with `lint:fix`)
- **No explicit any**: `@typescript-eslint/no-explicit-any`
- **Promise handling**: `@typescript-eslint/no-floating-promises`
- **Layer boundaries**: `@nx/enforce-module-boundaries` (enforces clean architecture)

### Prettier

Run `npm run format` to auto-format all files.

Configuration: `.prettierrc` (single quotes, trailing commas, 100 char line length)

## Testing Conventions

### File Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- Test location: `_tests/` subdirectories

### Jest Configuration

Each app/lib has its own `jest.config.cjs` configured via Nx plugin `@nx/jest/plugin`.

### Mocking

Use `jest.mock()` at top of test files for heavy dependencies:

```typescript
jest.mock('obsidian');
jest.mock('electron');

describe('MyClass', () => {
  // Tests...
});
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npx nx test node --watch

# Coverage
npx nx test node --coverage

# Specific test file
npx nx test node --testPathPattern=heading-slugger
```

## Commit Conventions

This project uses **Conventional Commits** and **semantic-release** for automated versioning.

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature (triggers **minor** release)
- `fix`, `hotfix`, `perf`, `refactor`: Bug fix or improvement (triggers **patch** release)
- `docs`: Documentation changes
- `docs(readme)`: README changes (triggers **patch** release)
- `test`: Test changes
- `chore`: Build/tooling changes
- `ci`: CI configuration changes

### Examples

```bash
feat(plugin): add command to insert ^no-publishing marker
fix(backend): resolve wikilinks to headings correctly
docs: update architecture documentation
refactor(api): simplify session controller logic
```

### Commitlint

Pre-commit hook runs `commitlint` to validate commit messages. If validation fails, fix the message and recommit.

## Release Process

Releases are **automated** via GitHub Actions + semantic-release:

1. Merge to `main` branch
2. CI determines version from commit types
3. Updates 6 files:
   - `package.json`
   - `manifest.json`
   - `apps/obsidian-vps-publish/versions.json`
   - `apps/{node,site}/src/version.ts`
4. Builds and packages plugin
5. Creates GitHub release with assets

**Manual steps for local development**:

- Keep `manifest.json` and `apps/obsidian-vps-publish/versions.json` aligned with package.json version

## Troubleshooting

### Build Failures

**Symptom**: Nx build fails with module not found

**Solution**:

```bash
# Clear Nx cache and reinstall
rm -rf node_modules .nx
npm install
npm run build
```

### Plugin Not Loading

**Symptom**: Plugin doesn't appear in Obsidian

**Solution**:

1. Check `manifest.json` `minAppVersion` matches your Obsidian version
2. Verify `dist/vps-publish/` contains: `main.js`, `manifest.json`, `styles.css`, `versions.json`
3. Check Obsidian console for errors (`Ctrl+Shift+I`)
4. Ensure plugin is enabled in Settings → Community plugins

### Docker Build Fails

**Symptom**: Docker build fails at COPY step

**Solution**:

```bash
# Build locally first to verify
npm run build

# Check Nx has built all required artifacts
ls -la dist/apps/node
ls -la dist/apps/site/browser

# Rebuild Docker image
docker compose build --no-cache
```

### Tests Failing

**Symptom**: Jest tests fail with "Cannot find module"

**Solution**:

```bash
# Clear Jest cache
npx jest --clearCache

# Reinstall dependencies
rm -rf node_modules
npm install

# Run tests again
npm test
```

### Layer Boundary Violations

**Symptom**: ESLint error about importing from wrong layer

**Solution**: Check `eslint.config.cjs` and project tags in `*/project.json`. Ensure imports follow dependency rule: `infra → application → domain`.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes and add tests
4. Run quality checks: `npm run lint && npm test && npm run build`
5. Commit with conventional commits: `git commit -m "feat: add feature"`
6. Push and create Pull Request

## Related Documentation

- [Architecture](./architecture.md) - Project structure and design
- [Docker](./docker.md) - Container deployment
- [Release](./release.md) - Versioning and release process
- [Testing](./e2e-testing.md) - E2E testing with Playwright

## Additional Resources

- [Nx Documentation](https://nx.dev)
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins)
- [Angular Documentation](https://angular.dev)
- [Express.js](https://expressjs.com)
- [Conventional Commits](https://www.conventionalcommits.org)
