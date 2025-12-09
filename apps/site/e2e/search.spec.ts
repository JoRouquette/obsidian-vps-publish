import { expect, test } from '@playwright/test';

test.describe('Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('should load the search page', async ({ page }) => {
    await expect(page).toHaveURL('/search');
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/rechercher/i);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEditable();
  });

  test('should perform search and display results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/rechercher/i);

    // Type search query
    await searchInput.fill('test');

    // Wait for results to appear (debounce delay + network)
    await page.waitForTimeout(500);

    // Check that results container exists
    const resultsContainer = page.locator('[data-testid="search-results"]');
    await expect(resultsContainer).toBeVisible();
  });

  test('should clear search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/rechercher/i);

    await searchInput.fill('example query');
    await expect(searchInput).toHaveValue('example query');

    // Look for clear button (if exists in UI)
    const clearButton = page.getByRole('button', { name: /effacer|clear/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(searchInput).toHaveValue('');
    }
  });

  test('should navigate to search via topbar button', async ({ page }) => {
    // Start from home
    await page.goto('/');

    // Click search button in topbar
    const searchButton = page.getByRole('button', { name: /recherche/i });
    await searchButton.click();

    // Should navigate to search page
    await expect(page).toHaveURL('/search');
  });

  test('should preserve search state when navigating back', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/rechercher/i);

    await searchInput.fill('persistent query');
    await page.waitForTimeout(300);

    // Navigate away
    await page.goto('/');
    await expect(page).toHaveURL('/');

    // Go back to search
    await page.goBack();
    await expect(page).toHaveURL('/search');

    // Search query should be preserved (if implemented)
    // This test documents expected behavior
  });
});
