# Development

## Prerequisites

- Node.js `22+` and npm.
- Obsidian desktop for testing the plugin locally.

## Setup

```bash
npm install --no-audit --no-fund
```

Useful scripts:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run build:node` / `npm run build:site` / `npm run build:plugin`
- `npm run package:plugin`
- `npm run start node` / `npm run start site`

## Local plugin workflow

1. `npm run package:plugin`
2. Copy or symlink `dist/vps-publish/` to `your-vault/.obsidian/plugins/vps-publish/`.
3. Reload plugins in Obsidian to test changes.

## Environment configuration

- Backend expects `API_KEY` plus `CONTENT_ROOT`, `ASSETS_ROOT`, `UI_ROOT`, and optionally `UI_SERVER_ROOT` for SSR (see `docs/architecture.md` for defaults).
- Populate `.env.dev` / `.env.prod` from the provided `.env.*.example` files before running Docker or compose.

### SSR-specific variables

- `SSR_ENABLED`: Enable/disable Server-Side Rendering (default: `false` in dev, `true` in production)
- `UI_SERVER_ROOT`: Path to Angular SSR server bundle (default: `./dist/apps/site/server` in dev)
- **Known Issue**: Angular 20 SSR has JIT compilation error, gracefully falls back to CSR when SSR initialization fails

### Dotenv loading behavior

- By default, dotenv does NOT override existing environment variables
- The backend uses `override: true` to ensure `.env.dev` values take precedence
- Load order: `.env.dev` (if exists) → `.env` (fallback)
- Variables loaded: 18 expected (check console on startup for count)

## VS Code Tasks for SSR Development

The project includes specialized tasks for SSR workflows (see `.vscode/tasks.json`):

### Quick Start Tasks

| Task                    | Description                                             | Use When                          |
| ----------------------- | ------------------------------------------------------- | --------------------------------- |
| **SSR: Full Restart**   | Clean + rebuild Angular SSR + backend, ready for launch | First time or after major changes |
| **SSR: Launch Server**  | Start Node backend with SSR (auto-builds if needed)     | Daily dev workflow                |
| **SSR: Quick Test**     | curl localhost:3000 to verify meta tags (no rebuild)    | Verify SSR is working             |
| **SSR: Validate SEO**   | Test robots.txt, sitemap.xml, meta tags, JSON-LD        | Full SEO validation               |
| **SSR: Complete Setup** | Build Angular + copy index.html (no server launch)      | After frontend changes            |

### Typical Workflow

1. **First launch today:**

   ```
   Run Task: "SSR: Full Restart"
   Run Task: "SSR: Launch Server"
   Run Task: "SSR: Quick Test"
   ```

2. **After modifying frontend code:**

   ```
   Ctrl+C in server terminal
   Run Task: "SSR: Complete Setup"
   Run Task: "SSR: Launch Server"
   ```

3. **Quick verification (server already running):**
   ```
   Run Task: "SSR: Quick Test (no rebuild)"
   ```

### Task Dependencies

- `SSR: Launch Server` depends on `SSR: Build Angular` + `SSR: Copy index.html`
- `SSR: Complete Setup` runs Angular build + index.html copy in sequence
- `SSR: Full Restart` cleans Nx cache + dist, rebuilds everything

### Known Issues

**Angular 20 SSR JIT Compilation Error:**

- Error: "PlatformLocation needs JIT compiler, but @angular/compiler not available"
- Impact: SSR initialization fails, falls back to CSR gracefully
- Status: Under investigation
- Workaround: CSR mode fully functional, SEO meta tags still work client-side

## Notes for contributors

- Branch from `main`, keep changes scoped, and add tests where it makes sense (`npm test`).
- Keep `manifest.json` (root) and `apps/obsidian-vps-publish/versions.json` aligned with releases/tags.
- Before committing SSR changes, run `SSR: Validate SEO` to ensure meta tags are correct.

## Lighthouse CI (Performance Testing)

The project includes comprehensive Lighthouse CI integration for performance budget validation. It is **blocking** in CI/CD: performance regressions prevent releases.

### Quick Start

```bash
# Build the project first
npm run build

# Run Lighthouse locally (non-blocking)
npm run lighthouse

# Run in CI mode (blocking, fails on budget violations)
npm run lighthouse:ci

# Test CSR mode instead of SSR
npm run lighthouse:csr

# Verbose output for debugging
npm run lighthouse:verbose
```

### What Gets Tested

| Page                                 | Description                    |
| ------------------------------------ | ------------------------------ |
| `/`                                  | Homepage (custom index)        |
| `/search`                            | Search functionality           |
| `/test-page`                         | Standard note page             |
| `/test-page-with-image`              | Note with embedded image asset |
| `/test-page-with-sections#section-2` | Deep link to anchor            |

### Performance Budgets (Blocking)

| Metric              | Threshold | Level |
| ------------------- | --------- | ----- |
| LCP                 | < 2.5s    | error |
| CLS                 | < 0.1     | error |
| TBT                 | < 300ms   | error |
| Performance Score   | >= 80%    | error |
| SEO Score           | >= 90%    | error |
| Accessibility Score | >= 85%    | warn  |

### Adjusting Budgets

Edit `lighthouserc.cjs` to adjust thresholds:

```javascript
assertions: {
  // Core Web Vitals
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  'total-blocking-time': ['error', { maxNumericValue: 300 }],
  // ...
}
```

- Change `'error'` to `'warn'` for non-blocking assertions
- Adjust `maxNumericValue` or `minScore` as needed
- Run `npm run lighthouse:ci` to test new thresholds

### Reports

After running, reports are saved to `.lighthouseci/`:

```bash
# View HTML reports
open .lighthouseci/*.html    # macOS
start .lighthouseci\*.html   # Windows
```

### CI/CD Integration

The `performance` job in `.github/workflows/ci-release.yml`:

1. Runs after `quality` job (lint, test, build)
2. Uses deterministic test fixtures (no external dependencies)
3. Runs Lighthouse against 5 pages
4. Fails the pipeline if budgets are exceeded
5. Uploads reports as artifacts (14-day retention)

The `semantic-release` job depends on `performance`, ensuring **no release if Lighthouse fails**.

### Nx Target

You can also run via Nx:

```bash
npx nx lighthouse node                  # Local mode
npx nx lighthouse node --configuration=ci    # CI mode (blocking)
```
