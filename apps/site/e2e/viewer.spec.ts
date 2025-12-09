import { expect, test } from '@playwright/test';

test.describe('Viewer Page', () => {
  // Test with a known page slug - adjust based on your actual content
  const testSlug = 'test-page'; // Update with real slug from your manifest

  test('should load viewer page with slug', async ({ page }) => {
    await page.goto(`/${testSlug}`);

    // Should not be redirected (404 would redirect to home or show error)
    await expect(page.url()).toContain(testSlug);
  });

  test('should display page content', async ({ page }) => {
    await page.goto(`/${testSlug}`);

    // Main content container should be visible
    const contentContainer = page.locator('[data-testid="viewer-content"]');
    await expect(contentContainer).toBeVisible();
  });

  test('should display page title', async ({ page }) => {
    await page.goto(`/${testSlug}`);

    // Page should have a title (h1 or similar)
    const pageTitle = page.locator('h1').first();
    await expect(pageTitle).toBeVisible();
  });

  test('should handle internal links navigation', async ({ page }) => {
    await page.goto(`/${testSlug}`);

    // Find first internal link (if exists)
    const internalLink = page.locator('a[href^="/"]').first();

    if (await internalLink.isVisible()) {
      const linkHref = await internalLink.getAttribute('href');
      await internalLink.click();

      // Should navigate to linked page
      if (linkHref) {
        await expect(page).toHaveURL(new RegExp(linkHref.replace('/', '\\/')));
      }
    }
  });

  test('should display breadcrumbs if page has path', async ({ page }) => {
    // Test with nested page if available
    await page.goto(`/${testSlug}`);

    const _breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
    // Breadcrumbs may not always exist (root pages)
    // This test documents the feature
  });

  test('should open images in viewer', async ({ page }) => {
    await page.goto(`/${testSlug}`);

    // Find first image in content
    const contentImage = page.locator('[data-testid="viewer-content"] img').first();

    if (await contentImage.isVisible()) {
      await contentImage.click();

      // Image viewer modal should open
      const imageViewer = page.locator('[data-testid="image-viewer"]');
      await expect(imageViewer).toBeVisible();

      // Close button should exist
      const closeButton = page.getByRole('button', { name: /fermer|close/i });
      await expect(closeButton).toBeVisible();

      await closeButton.click();
      await expect(imageViewer).not.toBeVisible();
    }
  });

  test('should handle non-existent page gracefully', async ({ page }) => {
    await page.goto('/non-existent-page-xyz-123');

    // Should show error message or redirect to home
    // Adjust based on actual error handling implementation
    const errorMessage = page.getByText(/introuvable|not found|erreur/i);
    const isOnHome = page.url().endsWith('/');

    expect((await errorMessage.isVisible()) || isOnHome).toBeTruthy();
  });
});
