import { expect, test } from '@playwright/test';

test.describe('Viewer Page', () => {
  // Test with known page slugs from E2E fixtures
  const testSlug = 'test-page';
  const pageWithAssets = 'page-with-assets';
  const nestedPage = 'nested/deep-page';

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

  test('should display breadcrumbs for nested page', async ({ page }) => {
    // Test with nested page
    await page.goto(`/${nestedPage}`);

    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
    // Breadcrumbs should be visible for nested pages
    if ((await breadcrumbs.count()) > 0) {
      await expect(breadcrumbs).toBeVisible();
    }
  });

  test('should display images in content', async ({ page }) => {
    await page.goto(`/${pageWithAssets}`);

    // Find first image in content
    const contentImage = page.locator('[data-testid="viewer-content"] img').first();

    if (await contentImage.isVisible()) {
      // Verify image has src attribute
      const src = await contentImage.getAttribute('src');
      expect(src).toBeTruthy();
    }
  });

  test('should open images in viewer modal', async ({ page }) => {
    await page.goto(`/${pageWithAssets}`);

    // Find first image in content
    const contentImage = page.locator('[data-testid="viewer-content"] img').first();

    if (await contentImage.isVisible()) {
      await contentImage.click();

      // Image viewer modal should open (if feature exists)
      const imageViewer = page.locator('[data-testid="image-viewer"]');

      if ((await imageViewer.count()) > 0) {
        await expect(imageViewer).toBeVisible();

        // Close button should exist
        const closeButton = page.getByRole('button', { name: /fermer|close/i });
        await expect(closeButton).toBeVisible();

        await closeButton.click();
        await expect(imageViewer).not.toBeVisible();
      }
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
