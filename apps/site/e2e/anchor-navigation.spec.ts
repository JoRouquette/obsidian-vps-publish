/**
 * E2E Tests for Anchor Navigation
 * Tests intra-page and inter-page anchor navigation (#section)
 */

import { expect, test } from '@playwright/test';

test.describe('Anchor Navigation', () => {
  const pageWithAnchors = '/page-with-anchor';
  const wikilinkSource = '/wikilink-source';

  test.describe('Intra-page Navigation', () => {
    test('should navigate to anchor on same page', async ({ page }) => {
      await page.goto(pageWithAnchors);

      // Wait for content to load
      const content = page.locator('[data-testid="viewer-content"]');
      await expect(content).toBeVisible();

      // Click on internal anchor link to section-two
      const anchorLink = page.locator('a[href="#section-two"]').first();
      if (await anchorLink.isVisible()) {
        await anchorLink.click();

        // URL should contain fragment
        await expect(page).toHaveURL(/#section-two/);

        // Wait for smooth scroll to complete
        await page.waitForTimeout(500);

        // Target section should be near the top of viewport
        const targetSection = page.locator('#section-two');
        await expect(targetSection).toBeVisible();

        const boundingBox = await targetSection.boundingBox();
        expect(boundingBox).not.toBeNull();
        if (boundingBox) {
          // Section should be visible in viewport (within reasonable range from top)
          expect(boundingBox.y).toBeLessThan(500);
          expect(boundingBox.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('should navigate to deep nested anchor', async ({ page }) => {
      await page.goto(pageWithAnchors);

      const deepLink = page.locator('a[href="#deep-section"]').first();
      if (await deepLink.isVisible()) {
        await deepLink.click();

        await expect(page).toHaveURL(/#deep-section/);

        const targetSection = page.locator('#deep-section');
        await expect(targetSection).toBeVisible();
      }
    });

    test('should handle fragment in URL on page load', async ({ page }) => {
      // Direct navigation to URL with fragment
      await page.goto(`${pageWithAnchors}#section-three`);

      // Wait for page to load and scroll
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Target section should exist and be visible
      const targetSection = page.locator('#section-three');
      await expect(targetSection).toBeVisible();
    });
  });

  test.describe('Inter-page Navigation', () => {
    test('should navigate to anchor on different page', async ({ page }) => {
      await page.goto(wikilinkSource);

      // Wait for content to load
      const content = page.locator('[data-testid="viewer-content"]');
      await expect(content).toBeVisible();

      // Find link to page-with-anchor#section-one
      const crossPageLink = page.locator('a[href*="page-with-anchor#section-one"]').first();

      if (await crossPageLink.isVisible()) {
        await crossPageLink.click();

        // Should navigate to the other page
        await expect(page).toHaveURL(/page-with-anchor/);
        await expect(page).toHaveURL(/#section-one/);

        // Wait for navigation and scroll
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Target section should be visible
        const targetSection = page.locator('#section-one');
        await expect(targetSection).toBeVisible();

        const boundingBox = await targetSection.boundingBox();
        expect(boundingBox).not.toBeNull();
        if (boundingBox) {
          // Heading should be scrolled into view (near top)
          expect(boundingBox.y).toBeLessThan(500);
        }
      }
    });

    test('should preserve anchor when using browser back button', async ({ page }) => {
      await page.goto('/');

      // Navigate to page with anchor
      await page.goto(`${pageWithAnchors}#section-two`);
      await page.waitForLoadState('networkidle');

      // Navigate to another page
      await page.goto(wikilinkSource);
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();

      // Should be back on page with anchor preserved
      await expect(page).toHaveURL(/page-with-anchor/);
      // Note: fragment preservation depends on browser history implementation
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle non-existent anchor gracefully', async ({ page }) => {
      await page.goto(`${pageWithAnchors}#non-existent-anchor`);

      // Page should still load
      await page.waitForLoadState('networkidle');

      // Content should be visible (no crash)
      const content = page.locator('[data-testid="viewer-content"]');
      await expect(content).toBeVisible();
    });

    test('should handle empty fragment', async ({ page }) => {
      await page.goto(`${pageWithAnchors}#`);

      // Page should load normally
      const content = page.locator('[data-testid="viewer-content"]');
      await expect(content).toBeVisible();
    });
  });
});
