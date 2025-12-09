# E2E Testing & SSR Implementation Summary

This document summarizes the implementation of **End-to-End Testing** with Playwright and **Server-Side Rendering** for the `apps/site` Angular application.

## What Was Added

### 1. E2E Testing Infrastructure

**Dependencies:**

- `@playwright/test` - E2E testing framework
- `@nx/playwright` - Nx integration for Playwright

**Configuration Files:**

- `apps/site/playwright.config.ts` - Playwright configuration (browsers, timeouts, webServer)
- `apps/site/eslint.config.cjs` - Updated to support Playwright rules for E2E tests only

**Test Files:**

- `apps/site/e2e/home.spec.ts` - Home page tests
- `apps/site/e2e/search.spec.ts` - Search functionality tests
- `apps/site/e2e/viewer.spec.ts` - Content viewer tests
- `apps/site/e2e/vault-explorer.spec.ts` - Vault explorer sidebar tests

**Template Changes (data-testid attributes):**

- `apps/site/src/presentation/shell/shell.component.html`
- `apps/site/src/presentation/pages/search/search-content.component.html`
- `apps/site/src/presentation/pages/viewer/viewer.component.html`
- `apps/site/src/presentation/components/vault-explorer/vault-explorer.component.html`
- `apps/site/src/presentation/pages/topbar/topbar.component.html`
- `apps/site/src/presentation/components/image-overlay/image-overlay.component.html`

### 2. Server-Side Rendering (SSR)

**Dependencies:**

- `@angular/ssr@20.3.13` - Angular SSR package
- `@angular/platform-server@20.3.13` - Platform server for Angular

**New Files:**

- `apps/site/src/main.server.ts` - Server-side bootstrap entry point
- `apps/site/src/app.config.server.ts` - Server-specific configuration
- `apps/site/src/server.ts` - Express server for SSR
- `apps/site/tsconfig.server.json` - TypeScript config for server build

**Modified Files:**

- `apps/site/src/presentation/app.config.ts` - Added `provideClientHydration()`
- `apps/site/src/presentation/services/theme.service.ts` - Added `isPlatformBrowser` checks
- `apps/site/src/presentation/shell/shell.component.ts` - Protected browser APIs with `isPlatformBrowser`
- `apps/site/project.json` - Added SSR build configuration and `serve-ssr` target
- `apps/site/src/_tests/theme-service.test.ts` - Updated test to inject `PLATFORM_ID`

### 3. Configuration Updates

**Nx Configuration:**

- `nx.json` - Playwright plugin already configured by Nx generator
- `apps/site/project.json` - Added `server`, `ssr`, and `serve-ssr` targets

**Build Configuration:**

- SSR build now produces both `browser/` and `server/` bundles
- Server bundle includes Express server for production deployment

**Jest Configuration:**

- `apps/site/jest.config.ts` - Added `testPathIgnorePatterns` to exclude E2E tests from Jest
- `apps/site/tsconfig.spec.json` - Excluded E2E directory from unit tests

**ESLint Configuration:**

- `apps/site/eslint.config.cjs` - Added exceptions for SSR files (`server.ts`, `*.server.ts`, `playwright.config.ts`)

### 4. CI/CD Integration

**GitHub Actions:**

- `.github/workflows/ci-release.yml` - Added E2E job that runs after quality checks

**Package Scripts:**

- `package.json` - Added `start site:ssr` and `test:e2e` scripts

### 5. Documentation

**New Documentation:**

- `docs/e2e-testing.md` - Complete E2E testing guide
- `docs/ssr-guide.md` - SSR implementation and deployment guide

**Updated Documentation:**

- `README.md` - Added Testing and SSR sections

## Breaking Changes

### None

All changes are **backward compatible**:

- SPA mode still works (`npm run start site`)
- Existing tests continue to pass
- No API changes to existing components

## How to Use

### Run E2E Tests

```bash
# Local development
npm run test:e2e

# Or directly
npx nx e2e site
```

### Run SSR Dev Server

```bash
# SSR development mode
npm run start site:ssr

# Or directly
npx nx serve-ssr site
```

### Build for Production

```bash
# Build everything (includes SSR)
npm run build

# Build site with SSR
npx nx build site --configuration=production
```

Output includes:

- `dist/apps/site/browser/` - Client-side static files
  - `index.csr.html` - Client-side rendering version
  - `index.server.html` - Server-side rendering template (for SSR server)
  - JavaScript chunks, CSS, and static assets
- `dist/apps/site/server/` - SSR Express server bundles

### Docker Deployment (Current: Static CSR)

The Docker build now handles the SSR output structure:

```bash
# Build and run with Docker Compose
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**What happens during Docker build:**

1. Nx builds both `browser/` (client) and `server/` (SSR) bundles
2. Dockerfile copies `browser/` contents to `/ui`
3. Automatically renames `index.csr.html` → `index.html`
4. Backend serves `/ui` files statically
5. Angular hydration optimizes client-side rendering

The application is **SSR-ready** but currently deployed as optimized CSR with hydration for simplicity.

### Run Production SSR Server (Standalone)

```bash
cd dist/apps/site/server
node server.mjs
```

Server listens on `http://localhost:4000` (configurable via `PORT` env variable).

## Testing Coverage

### E2E Tests Cover:

- ✅ Home page loading and navigation
- ✅ Search functionality and results display
- ✅ Content viewer (pages, links, images)
- ✅ Vault explorer (folders, files, navigation, resize)
- ✅ Logo and topbar controls
- ✅ Breadcrumbs navigation
- ✅ Image viewer modal

### SSR-Safe Code:

- ✅ ThemeService (localStorage, window.matchMedia)
- ✅ ShellComponent (document event listeners, localStorage)
- ✅ All browser APIs protected with `isPlatformBrowser`

## Technical Notes

### Why Playwright?

- Modern, fast, and reliable
- Built-in auto-waiting (no flaky tests)
- Multiple browser support (Chromium, Firefox, WebKit)
- Great developer experience with TypeScript
- Already TypeScript-based like the rest of the project

### Why These data-testid Attributes?

E2E tests use stable selectors:

1. **Semantic selectors** first (roles, labels): `getByRole('button', { name: /menu/i })`
2. **data-testid** for non-semantic elements: `[data-testid="vault-explorer"]`
3. **Avoid CSS classes/IDs** to prevent fragile tests

### SSR Implementation Details

The SSR setup follows Angular's **standalone + SSR** pattern:

- Client hydration enabled via `provideClientHydration()`
- Server rendering via `provideServerRendering()`
- Express server serves both static assets and SSR routes
- Platform detection ensures browser-only code doesn't crash on server

## CI/CD Flow

The updated CI pipeline:

1. **Quality Job** (unchanged):
   - Lint
   - Unit tests
   - Build all projects

2. **E2E Job** (new):
   - Install Playwright browsers
   - Run E2E tests (`npx nx e2e site`)
   - Upload Playwright report as artifact

3. **Semantic Release Job**:
   - Depends on both Quality and E2E jobs
   - Only runs if both pass

## Maintenance

### Adding New E2E Tests

1. Create `*.spec.ts` in `apps/site/e2e/`
2. Follow patterns in existing tests
3. Add `data-testid` attributes if needed
4. Run locally: `npx nx e2e site`

### Updating SSR Code

When adding new features with browser APIs:

1. Inject `PLATFORM_ID` in constructor
2. Use `isPlatformBrowser(this.platformId)` checks
3. Update tests to provide mock `PLATFORM_ID`

### ESLint Rules for SSR Files

SSR files (`server.ts`, `*.server.ts`, `playwright.config.ts`) have relaxed rules:

- Can use `express` import
- Can use `process.env`
- Can use `console.log`

These exceptions are defined at the **end** of `apps/site/eslint.config.cjs` to override previous rules.

## Next Steps (Optional Enhancements)

While not required, consider these improvements for production:

1. **Prerendering**: Add prerender routes in build config for static pages
2. **Edge Deployment**: Deploy SSR to Vercel/Netlify Edge for global performance
3. **Visual Regression**: Add Percy/Chromatic for visual testing
4. **Accessibility Tests**: Add axe-core to E2E tests
5. **Performance Budgets**: Configure Lighthouse CI for performance monitoring

## Support & Documentation

- **E2E Guide**: `docs/e2e-testing.md`
- **SSR Guide**: `docs/ssr-guide.md`
- **Playwright Docs**: https://playwright.dev
- **Angular SSR**: https://angular.io/guide/ssr
