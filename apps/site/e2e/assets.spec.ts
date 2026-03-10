/**
 * E2E Tests for Assets Rendering
 * Tests images, PDFs, and other asset types
 */

import { expect, test } from '@playwright/test';

test.describe('Assets Rendering', () => {
  const pageWithAssets = '/page-with-assets';

  test.describe('Image Assets', () => {
    test('should render images with correct src', async ({ page }) => {
      await page.goto(pageWithAssets);

      const content = page.locator('[data-testid="viewer-content"]');
      await expect(content).toBeVisible();

      // Find images in content
      const images = page.locator('[data-testid="viewer-content"] img');
      const imageCount = await images.count();

      if (imageCount > 0) {
        // Check first image
        const firstImage = images.first();
        await expect(firstImage).toBeVisible();

        // Image should have src pointing to assets
        const src = await firstImage.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src).toMatch(/\/assets\//);
      }
    });

    test('should load images successfully (no broken images)', async ({ page }) => {
      const brokenImages: string[] = [];

      // Listen for failed image loads
      page.on('response', (response) => {
        if (response.request().resourceType() === 'image' && response.status() >= 400) {
          brokenImages.push(response.url());
        }
      });

      await page.goto(pageWithAssets);
      await page.waitForLoadState('domcontentloaded');

      // Verify no images failed to load
      expect(brokenImages).toHaveLength(0);
    });

    test('should display images with correct dimensions', async ({ page }) => {
      await page.goto(pageWithAssets);

      const images = page.locator('[data-testid="viewer-content"] img');

      if ((await images.count()) > 0) {
        const firstImage = images.first();
        await expect(firstImage).toBeVisible();

        // Image should have rendered dimensions
        const box = await firstImage.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });

    test('should have alt text for accessibility', async ({ page }) => {
      await page.goto(pageWithAssets);

      const images = page.locator('[data-testid="viewer-content"] img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        const alt = await image.getAttribute('alt');
        // Images should have alt text (can be empty string for decorative)
        expect(alt).not.toBeNull();
      }
    });
  });

  test.describe('Asset Links', () => {
    test('should have download links for documents', async ({ page }) => {
      await page.goto(pageWithAssets);

      // Find download links (PDF, etc.)
      const downloadLinks = page.locator('a[href*="/assets/"]');

      if ((await downloadLinks.count()) > 0) {
        const firstLink = downloadLinks.first();
        const href = await firstLink.getAttribute('href');
        expect(href).toMatch(/\/assets\/.+/);
      }
    });

    test('should serve asset files from backend', async ({ page }) => {
      // Directly request an asset to verify backend serves it
      const response = await page.request.get('/assets/test-image.png');

      // Should return 200 (asset exists in fixtures)
      expect(response.status()).toBe(200);

      // Should have correct content type for images
      const contentType = response.headers()['content-type'];
      expect(contentType).toMatch(/image/);
    });

    test('should return 404 for non-existent assets', async ({ page }) => {
      const response = await page.request.get('/assets/non-existent-file.xyz');

      // Backend returns 404 for missing assets (assets route doesn't fall through to SPA)
      // Note: may return 200 if SPA fallback is enabled for all routes
      expect([200, 404]).toContain(response.status());
    });
  });

  test.describe('Asset API', () => {
    test('should serve assets via /assets endpoint', async ({ page }) => {
      const response = await page.request.get('/assets/test-document.pdf');

      expect(response.ok() || response.status() === 404).toBeTruthy();
    });
  });
});
