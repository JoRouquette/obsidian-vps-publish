# E2E Testing Guide

This document explains how to run and write end-to-end tests for the `apps/site` Angular application using Playwright.

## Prerequisites

- Node.js 22.14.0 or later
- All dependencies installed (`npm install`)
- Playwright browsers installed (happens automatically on first run)
- Build artifacts ready (`npm run build`)

## Architecture

E2E tests run against the **full stack**:

1. **Backend (Express)** on port 3000 - serves API and Angular UI
2. **Test fixtures** - deterministic content in `apps/site/e2e/fixtures/`
3. **Playwright** - browser automation and assertions

The tests use dedicated fixtures (not production data) to ensure reproducible results.

## Running E2E Tests

### Local Development

```bash
# Run all E2E tests (builds first, then starts backend automatically)
npm run test:e2e

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests in debug mode (step through)
npm run test:e2e:debug

# Run specific test file
npx playwright test apps/site/e2e/home.spec.ts --config=apps/site/playwright.config.ts

# View HTML report after test run
npm run test:e2e:report

# Setup fixtures only (without running tests)
npm run e2e:setup
```

### CI/CD

E2E tests run automatically in the GitHub Actions CI pipeline and are **BLOCKING**:

1. `quality` job: builds all projects
2. `e2e` job: runs E2E tests against built artifacts
3. `semantic-release` job: only runs if e2e passes

If E2E tests fail, the release is blocked.

```yaml
# CI command
npx nx e2e site --configuration=ci
```

Artifacts uploaded on failure:

- `playwright-report/` - HTML report with screenshots
- `test-results/` - traces and videos

## Test Structure

Tests are located in `apps/site/e2e/` and organized by feature:

| File                                 | Coverage                               |
| ------------------------------------ | -------------------------------------- |
| `home.spec.ts`                       | Home page, navigation, logo            |
| `search.spec.ts`                     | Search functionality                   |
| `viewer.spec.ts`                     | Content viewer, images, breadcrumbs    |
| `anchor-navigation.spec.ts`          | Intra-page and inter-page #anchors     |
| `assets.spec.ts`                     | Image rendering, asset downloads       |
| `pwa-offline.spec.ts`                | Service worker, offline mode, manifest |
| `seo.spec.ts`                        | Meta tags, sitemap, robots.txt, cache  |
| `vault-explorer.spec.ts`             | Sidebar navigation                     |
| `wikilink-header-navigation.spec.ts` | Wikilink scrolling to headers          |
| `leaflet.spec.ts`                    | Map rendering                          |

## Test Fixtures

Fixtures are in `apps/site/e2e/fixtures/`:

```
fixtures/
├── manifest.json          # Test manifest with 6 pages
└── content/
    ├── index.html         # Home page
    ├── test-page.html     # Basic test page
    ├── page-with-anchor.html  # Page with #section anchors
    ├── page-with-assets.html  # Page with images
    ├── wikilink-source.html   # Page with wikilinks
    └── nested/
        └── deep-page.html # Nested folder page
```

The `scripts/e2e-setup.mjs` script copies fixtures to `tmp/e2e-content/` and creates test assets in `tmp/e2e-assets/`.

## Test Patterns

### Using data-testid Selectors

```typescript
// Good: Use data-testid for test-specific elements
const vaultExplorer = page.locator('[data-testid="vault-explorer"]');

// Good: Use semantic roles for accessibility elements
const menuButton = page.getByRole('button', { name: /menu/i });

// Good: Bilingual patterns (FR/EN)
const searchInput = page.getByPlaceholder(/rechercher|search/i);

// Avoid: Fragile CSS selectors
const menu = page.locator('.vault-explorer.open'); // ❌
```

### Available data-testid Values

- `vault-explorer` - Vault explorer sidebar
- `resize-handle` - Sidebar resize
- `search-results` - Search results container
- `viewer-content` - Main content viewer
- `breadcrumbs` - Breadcrumb navigation
- `image-viewer` - Image overlay modal
- `offline-indicator` - Offline mode indicator (if implemented)
- `leaflet-map-{id}` - Leaflet map containers

### Writing New Tests

1. **Use fixture data**: Reference pages from `manifest.json`
2. **Use bilingual selectors**: Support FR/EN (`/menu|menu/i`)
3. **Handle optional features**: Use `if (await element.isVisible())`
4. **Avoid hardcoded waits**: Use Playwright's auto-waiting
5. **Test behavior, not implementation**: Focus on user flows

Example:

```typescript
test('should navigate to page from vault explorer', async ({ page }) => {
  await page.goto('/');

  // Open vault explorer
  const menuButton = page.getByRole('button', { name: /menu/i });
  await menuButton.click();

  // Wait for explorer to be visible
  const vaultExplorer = page.locator('[data-testid="vault-explorer"]');
  await expect(vaultExplorer).toBeVisible();

  // Click first page link
  const firstPageLink = page.locator('[data-testid^="page-"] a').first();
  await firstPageLink.click();

  // Verify navigation
  const viewerContent = page.locator('[data-testid="viewer-content"]');
  await expect(viewerContent).toBeVisible();
});
```

## Configuration

Configuration in `apps/site/playwright.config.ts`:

| Setting     | Local                 | CI                    |
| ----------- | --------------------- | --------------------- |
| Base URL    | http://localhost:3000 | http://localhost:3000 |
| Retries     | 0                     | 2                     |
| Workers     | auto                  | 2                     |
| Trace       | on-first-retry        | on-first-retry        |
| Screenshots | only-on-failure       | only-on-failure       |
| Video       | retain-on-failure     | retain-on-failure     |

Environment variables for backend:

- `NODE_ENV=test`
- `PORT=3000`
- `CONTENT_ROOT=tmp/e2e-content`
- `ASSETS_ROOT=tmp/e2e-assets`
- `UI_ROOT=dist/apps/site/browser`
- `SSR_ENABLED=false`

## Critical Test Scenarios

The following scenarios are tested to catch regressions:

1. **Page load** - Home loads, title correct, navigation visible
2. **Content navigation** - Click links, verify URL changes
3. **Anchor navigation** - Intra-page (#section) and inter-page scrolling
4. **Search** - Input works, results appear
5. **Assets** - Images load, no broken images
6. **SEO** - Meta tags present, sitemap/robots.txt served
7. **PWA** - Manifest present, service worker (if production build)
8. **Error handling** - 404 pages graceful, non-existent anchors safe

## Debugging Failed Tests

1. **View HTML report**: `npm run test:e2e:report`
2. **Run in headed mode**: `npm run test:e2e:headed`
3. **Use debug mode**: `npm run test:e2e:debug`
4. **Inspect trace**: Download from CI artifacts
5. **Check fixtures**: Verify `tmp/e2e-content/` has correct files

### Common Issues

| Issue           | Solution                                           |
| --------------- | -------------------------------------------------- |
| Port conflict   | Stop any running server on 3000                    |
| No index.html   | Run `npm run build` first                          |
| Fixture missing | Run `npm run e2e:setup`                            |
| Timeout         | Increase timeout in config or check server startup |
| Flaky selector  | Use more specific data-testid                      |

## Adding New Fixtures

1. Add page to `apps/site/e2e/fixtures/manifest.json`
2. Create HTML file in `apps/site/e2e/fixtures/content/`
3. Add assets to `apps/site/e2e/fixtures/assets/` (if needed)
4. Write test in `apps/site/e2e/`

## Best Practices

✅ **Do**:

- Use semantic selectors (`getByRole`, `getByLabel`)
- Test user-visible behavior
- Use `data-testid` for non-semantic elements
- Handle async with `await` and auto-waiting
- Write descriptive test names
- Support both FR and EN text patterns

❌ **Don't**:

- Rely on CSS class names
- Test internal implementation details
- Use hardcoded waits (`page.waitForTimeout`) unless necessary
- Make tests dependent on each other
- Test too many things in one test
- Assume specific site content (use fixtures)

## Related Documentation

- [Development Guide](../development.md)
- [Docker Guide](../docker.md)
- [CI/CD Pipeline](.github/workflows/ci-release.yml)

- [Playwright Documentation](https://playwright.dev)
- [Nx Playwright Plugin](https://nx.dev/nx-api/playwright)
- [Angular Testing Guide](https://angular.io/guide/testing)
