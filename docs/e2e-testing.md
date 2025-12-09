# E2E Testing Guide

This document explains how to run and write end-to-end tests for the `apps/site` Angular application using Playwright.

## Prerequisites

- Node.js 22.14.0 or later
- All dependencies installed (`npm install`)
- Playwright browsers installed (happens automatically on first run)

## Running E2E Tests

### Local Development

```bash
# Run all E2E tests (starts dev server automatically)
npm run test:e2e

# Or using Nx directly
npx nx e2e site

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test apps/site/e2e/home.spec.ts

# Run tests in debug mode
npx playwright test --debug

# Generate HTML report
npx playwright show-report
```

### CI/CD

E2E tests run automatically in the GitHub Actions CI pipeline after the build step. The workflow:

1. Builds all projects (`npm run build`)
2. Installs Playwright browsers
3. Runs E2E tests (`npx nx e2e site`)
4. Uploads Playwright report as artifact (available for 7 days)

## Test Structure

Tests are located in `apps/site/e2e/` and organized by feature:

- `home.spec.ts` - Home page tests (logo, navigation, content)
- `search.spec.ts` - Search functionality tests
- `viewer.spec.ts` - Content viewer tests (page loading, links, images)
- `vault-explorer.spec.ts` - Vault explorer sidebar tests

## Test Patterns

### Using data-testid Selectors

Components use `data-testid` attributes for stable test selectors:

```typescript
// Good: Use data-testid for test-specific elements
const vaultExplorer = page.locator('[data-testid="vault-explorer"]');

// Good: Use semantic roles for accessibility elements
const menuButton = page.getByRole('button', { name: /menu/i });

// Avoid: Fragile CSS selectors
const menu = page.locator('.vault-explorer.open'); // ❌
```

### Available data-testid Values

- `vault-explorer` - Vault explorer sidebar container
- `resize-handle` - Sidebar resize handle
- `search-results` - Search results container
- `viewer-content` - Main content viewer
- `breadcrumbs` - Breadcrumb navigation
- `image-viewer` - Image overlay modal
- `folder-{path}` - Folder nodes (dynamic, e.g., `folder-guides/tutorial`)
- `page-{path}` - Page nodes (dynamic, e.g., `page-docs/intro`)

### Writing New Tests

1. **Follow existing patterns**: Check similar test files for examples
2. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByPlaceholder`
3. **Add data-testid when needed**: For elements without semantic roles
4. **Test behavior, not implementation**: Focus on user flows, not internals
5. **Handle async properly**: Use `await` and Playwright's auto-waiting

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

Playwright configuration is in `apps/site/playwright.config.ts`:

- **Base URL**: `http://localhost:4200` (auto-started dev server)
- **Browsers**: Chromium, Firefox, WebKit (all enabled)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries on CI, 0 locally
- **Workers**: Parallel execution (4 workers on CI)

## Debugging Failed Tests

1. **View HTML report**: `npx playwright show-report`
2. **Run in headed mode**: `npx playwright test --headed`
3. **Use debug mode**: `npx playwright test --debug`
4. **Inspect trace**: Enable trace in config or use `--trace on`
5. **CI artifacts**: Download Playwright report from GitHub Actions

## Best Practices

✅ **Do**:

- Use semantic selectors (`getByRole`, `getByLabel`)
- Test user-visible behavior
- Use `data-testid` for non-semantic elements
- Handle async with `await` and auto-waiting
- Write descriptive test names

❌ **Don't**:

- Rely on CSS class names or IDs
- Test internal implementation details
- Use hardcoded waits (`page.waitForTimeout`) unless necessary
- Make tests dependent on each other
- Test too many things in one test

## Related Documentation

- [Playwright Documentation](https://playwright.dev)
- [Nx Playwright Plugin](https://nx.dev/nx-api/playwright)
- [Angular Testing Guide](https://angular.io/guide/testing)
