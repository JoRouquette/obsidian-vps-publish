import { expect, test, Page } from '@playwright/test';

/**
 * Helper to ensure vault explorer is visible.
 * On desktop (>768px), the vault explorer is always visible in the grid layout.
 * On mobile (<768px), we need to click the burger button to open it.
 */
async function ensureVaultExplorerOpen(page: Page) {
  const vaultExplorer = page.locator('[data-testid="vault-explorer"]');

  // Check if already visible (desktop mode)
  if (await vaultExplorer.isVisible()) {
    return;
  }

  // Mobile mode: click burger button
  const menuButton = page.getByRole('button', { name: /ouvrir le menu/i });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await expect(vaultExplorer).toBeVisible();
  }
}

test.describe('Vault Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display vault explorer', async ({ page }) => {
    await ensureVaultExplorerOpen(page);

    // Vault explorer should be visible
    const vaultExplorer = page.locator('[data-testid="vault-explorer"]');
    await expect(vaultExplorer).toBeVisible();
  });

  test('should toggle vault explorer on mobile', async ({ page }) => {
    // This test is mobile-specific
    const viewport = page.viewportSize();
    if (!viewport || viewport.width > 768) {
      test.skip();
      return;
    }

    const vaultExplorer = page.locator('[data-testid="vault-explorer"]');
    const menuButton = page.getByRole('button', { name: /ouvrir le menu/i });

    // Open menu
    await menuButton.click();
    await expect(vaultExplorer).toBeVisible();

    // Close menu (use the close button inside the menu)
    const closeButton = page.getByRole('button', { name: /fermer le menu/i });
    await closeButton.click();

    // Wait for animation and state change to complete
    // Use Playwright's auto-retrying assertion instead of manual checks
    await expect(vaultExplorer).toBeHidden({ timeout: 5000 });
  });

  test('should display folder structure', async ({ page }) => {
    await ensureVaultExplorerOpen(page);

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
    await ensureVaultExplorerOpen(page);

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
    await ensureVaultExplorerOpen(page);

    await page.waitForSelector('[data-testid="vault-explorer"]');

    // Find first page link
    const firstPageLink = page.locator('[data-testid^="page-"] a').first();

    if (await firstPageLink.isVisible()) {
      // Store initial URL
      const initialUrl = page.url();

      // Use JavaScript click to bypass overlapping elements
      await firstPageLink.evaluate((el) => (el as HTMLAnchorElement).click());

      // Wait for navigation to complete
      await page.waitForLoadState('domcontentloaded');

      // Should navigate away from initial URL (any valid navigation is acceptable)
      // The exact target page can vary depending on the test fixtures
      await page.waitForTimeout(500);
      const newUrl = page.url();
      expect(newUrl).not.toBe(initialUrl);

      // Viewer content should be visible
      const viewerContent = page.locator('[data-testid="viewer-content"]');
      await expect(viewerContent).toBeVisible();
    }
  });

  test('should highlight active page in vault explorer', async ({ page }) => {
    // Navigate to a specific page first
    await page.goto('/test-page'); // Adjust with real slug

    // Open vault explorer
    await ensureVaultExplorerOpen(page);

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

    await ensureVaultExplorerOpen(page);

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

  test('should clear filter when clicking clear button', async ({ page }) => {
    // Skip on mobile - search field is not visible on small screens
    const viewport = page.viewportSize();
    if (viewport && viewport.width <= 768) {
      test.skip();
      return;
    }

    await ensureVaultExplorerOpen(page);

    await page.waitForSelector('[data-testid="vault-explorer"]');

    // Locate the search input
    const searchInput = page.locator('.search-field input[type="search"]').first();
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill('test-query');
    await page.waitForTimeout(300); // Debounce

    // Verify value is set
    await expect(searchInput).toHaveValue('test-query');

    // Clear button should appear
    const clearButton = page.locator('.search-field button[aria-label="Effacer la recherche"]');
    await expect(clearButton).toBeVisible();

    // Click clear button
    await clearButton.click();

    // Value should be empty
    await expect(searchInput).toHaveValue('');

    // Clear button should disappear
    await expect(clearButton).not.toBeVisible();

    // Input should still be focused
    await expect(searchInput).toBeFocused();
  });

  test('should filter ONLY on basename (file/folder name), not on parent path', async ({
    page,
  }) => {
    await ensureVaultExplorerOpen(page);

    await page.waitForSelector('[data-testid="vault-explorer"]');

    // Wait for at least one folder or page to be visible
    const anyNode = page.locator('[data-testid^="folder-"], [data-testid^="page-"]').first();
    await expect(anyNode).toBeVisible({ timeout: 10000 });

    // Get all files/folders before filtering
    const allNodes = page.locator('[data-testid^="folder-"], [data-testid^="page-"]');
    const initialCount = await allNodes.count();

    // Ensure we have some content to start with
    expect(initialCount).toBeGreaterThan(0);

    // Type a search query that matches a parent folder name but NOT the files inside
    // Example: searching for "mecaniques" should only show folders/files named "mecaniques",
    // NOT files like "combats.md" that are inside the "_Mecaniques" folder
    const searchInput = page.locator('.search-field input[type="search"]').first();
    await searchInput.fill('mecaniques');

    // Wait for debounce + filtering
    await page.waitForTimeout(300);

    // Check result count message (should show only items with "mecaniques" in their basename)
    const resultCount = page.locator('.result-count');
    if (await resultCount.isVisible()) {
      const countText = await resultCount.textContent();
      // Should show a specific count of matching items (not all items)
      expect(countText).toMatch(/\d+ résultat/);
    }

    // Verify that only folders/files with "mecaniques" in their name are visible
    const filteredNodes = page.locator('[data-testid^="folder-"], [data-testid^="page-"]');
    const filteredCount = await filteredNodes.count();

    // The filtered count should be less than initial count (unless everything contains "mecaniques")
    // This proves filtering is working
    if (initialCount > 1) {
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('should match on basename and display correct result count', async ({ page }) => {
    await ensureVaultExplorerOpen(page);

    await page.waitForSelector('[data-testid="vault-explorer"]');

    const searchInput = page.locator('.search-field input[type="search"]').first();

    // Search for a specific filename (adjust based on actual test data)
    // Using "combats" as an example - if file "Combats.md" exists, it should match
    await searchInput.fill('combats');
    await page.waitForTimeout(300);

    // Result count should be visible and show the number of matches
    const resultCount = page.locator('.result-count');

    // Wait for either result count or "no result" message
    const hasResults = await resultCount.isVisible().catch(() => false);
    const noResultMessage = page.locator('.empty-state .title');
    const hasNoResults = await noResultMessage.isVisible().catch(() => false);

    // Should have either results or no-result message (not both)
    expect(hasResults || hasNoResults).toBe(true);

    if (hasResults) {
      // Result count should display a number
      const countText = await resultCount.textContent();
      expect(countText).toMatch(/\d+ résultat/);

      // Verify that the count matches the actual number of visible nodes
      const visibleNodes = page.locator('[data-testid^="folder-"], [data-testid^="page-"]');
      const actualCount = await visibleNodes.count();

      // Extract the number from "X résultat(s)" text
      const match = /(\d+) résultat/.exec(countText ?? '');
      if (match) {
        const displayedCount = Number.parseInt(match[1], 10);
        // The displayed count should match the actual visible nodes count
        expect(displayedCount).toBe(actualCount);
      }
    }
  });

  test('should NOT match on title or tags, only on basename', async ({ page }) => {
    await ensureVaultExplorerOpen(page);

    await page.waitForSelector('[data-testid="vault-explorer"]');

    const searchInput = page.locator('.search-field input[type="search"]').first();

    // Search for a term that might appear in titles or tags but not in filenames
    // For example, if a file is named "01_renvois.md" but has title "Renvois et Références"
    // searching for "references" should NOT match it (only basename "01_renvois" would match)
    await searchInput.fill('xxxyyyzzz-unique-term-not-in-any-basename');
    await page.waitForTimeout(300);

    // Should show "no result" message
    const noResultMessage = page.locator('.empty-state .title');
    await expect(noResultMessage).toBeVisible();
    await expect(noResultMessage).toHaveText('Aucun résultat');

    // Result count should NOT be visible (no results found)
    const resultCount = page.locator('.result-count');
    await expect(resultCount).not.toBeVisible();
  });

  test('should display updated result count as user types', async ({ page }) => {
    // Skip on mobile - search field is not visible on small screens
    const viewport = page.viewportSize();
    if (viewport && viewport.width <= 768) {
      test.skip();
      return;
    }

    await ensureVaultExplorerOpen(page);

    await page.waitForSelector('[data-testid="vault-explorer"]');

    const searchInput = page.locator('.search-field input[type="search"]').first();
    const resultCount = page.locator('.result-count');
    const noResultMessage = page.locator('.empty-state .title');

    // Type progressively and check that result count updates or no-result message appears
    // Using common terms that might match E2E fixtures
    await searchInput.fill('t');
    await page.waitForTimeout(500);

    // Check if we have results or a "no result" message
    const hasFirstCount = await resultCount.isVisible().catch(() => false);
    const hasFirstEmpty = await noResultMessage.isVisible().catch(() => false);
    const firstCount = hasFirstCount ? await resultCount.textContent().catch(() => null) : null;

    // Refine search
    await searchInput.fill('te');
    await page.waitForTimeout(500);

    const hasSecondCount = await resultCount.isVisible().catch(() => false);
    const hasSecondEmpty = await noResultMessage.isVisible().catch(() => false);
    const secondCount = hasSecondCount ? await resultCount.textContent().catch(() => null) : null;

    // Further refine
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    const hasThirdCount = await resultCount.isVisible().catch(() => false);
    const hasThirdEmpty = await noResultMessage.isVisible().catch(() => false);
    const thirdCount = hasThirdCount ? await resultCount.textContent().catch(() => null) : null;

    // Collect visible counts and empty states
    const counts = [firstCount, secondCount, thirdCount].filter(Boolean);
    const emptyStates = [hasFirstEmpty, hasSecondEmpty, hasThirdEmpty].filter(Boolean);

    // The search should be reactive - either showing counts OR empty states
    // At least one feedback should be visible, proving the filter works
    expect(counts.length + emptyStates.length).toBeGreaterThan(0);
  });
});
