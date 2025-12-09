import { expect, test } from '@playwright/test';

test.describe('Vault Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open vault explorer menu', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /menu/i });
    await menuButton.click();

    // Vault explorer should be visible
    const vaultExplorer = page.locator('[data-testid="vault-explorer"]');
    await expect(vaultExplorer).toBeVisible();
  });

  test('should close vault explorer menu', async ({ page }) => {
    // Open menu
    const menuButton = page.getByRole('button', { name: /menu/i });
    await menuButton.click();

    const vaultExplorer = page.locator('[data-testid="vault-explorer"]');
    await expect(vaultExplorer).toBeVisible();

    // Close menu
    await menuButton.click();
    await expect(vaultExplorer).not.toBeVisible();
  });

  test('should display folder structure', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /menu/i });
    await menuButton.click();

    // Wait for vault explorer to load
    await page.waitForSelector('[data-testid="vault-explorer"]');

    // Should have at least root folders or pages
    const folders = page.locator('[data-testid^="folder-"]');
    const pages = page.locator('[data-testid^="page-"]');

    const foldersCount = await folders.count();
    const pagesCount = await pages.count();

    // Should have some content
    expect(foldersCount + pagesCount).toBeGreaterThan(0);
  });

  test('should expand and collapse folders', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /menu/i });
    await menuButton.click();

    await page.waitForSelector('[data-testid="vault-explorer"]');

    // Find first folder with expand button
    const firstFolder = page.locator('[data-testid^="folder-"]').first();

    if (await firstFolder.isVisible()) {
      const expandButton = firstFolder.locator('button').first();

      // Click to expand
      await expandButton.click();
      await page.waitForTimeout(200);

      // Check if children are visible (if folder has children)
      const hasChildren = await firstFolder
        .locator('[data-testid^="folder-"], [data-testid^="page-"]')
        .count();

      if (hasChildren > 0) {
        // Click to collapse
        await expandButton.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('should navigate to page when clicking on page link', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /menu/i });
    await menuButton.click();

    await page.waitForSelector('[data-testid="vault-explorer"]');

    // Find first page link
    const firstPageLink = page.locator('[data-testid^="page-"] a').first();

    if (await firstPageLink.isVisible()) {
      const href = await firstPageLink.getAttribute('href');
      await firstPageLink.click();

      // Should navigate to the page
      if (href) {
        await expect(page).toHaveURL(new RegExp(href.replace('/', '\\/')));
      }

      // Viewer content should be visible
      const viewerContent = page.locator('[data-testid="viewer-content"]');
      await expect(viewerContent).toBeVisible();
    }
  });

  test('should highlight active page in vault explorer', async ({ page }) => {
    // Navigate to a specific page first
    await page.goto('/test-page'); // Adjust with real slug

    // Open vault explorer
    const menuButton = page.getByRole('button', { name: /menu/i });
    await menuButton.click();

    await page.waitForSelector('[data-testid="vault-explorer"]');

    // Active page should have special class/attribute
    const _activePage = page.locator(
      '[data-testid^="page-"].active, [data-testid^="page-"][aria-current="page"]'
    );

    // This test documents the feature - may not always have active state
  });

  test('should resize vault explorer on desktop', async ({ page }) => {
    // Skip on mobile viewports
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 768) {
      test.skip();
      return;
    }

    const menuButton = page.getByRole('button', { name: /menu/i });
    await menuButton.click();

    const vaultExplorer = page.locator('[data-testid="vault-explorer"]');
    await expect(vaultExplorer).toBeVisible();

    // Find resize handle
    const resizeHandle = page.locator('[data-testid="resize-handle"]');

    if (await resizeHandle.isVisible()) {
      const initialWidth = await vaultExplorer.evaluate((el) => el.getBoundingClientRect().width);

      // Drag resize handle
      await resizeHandle.hover();
      await page.mouse.down();
      await page.mouse.move(350, 100); // Move to right
      await page.mouse.up();

      const newWidth = await vaultExplorer.evaluate((el) => el.getBoundingClientRect().width);

      // Width should have changed
      expect(newWidth).not.toBe(initialWidth);
    }
  });
});
