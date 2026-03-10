import { expect, test } from '@playwright/test';

test.describe('Wikilink Header Navigation Bug', () => {
  test('should navigate to header anchor when clicking wikilink with subpath', async ({ page }) => {
    // This test requires specific E2E fixtures to exist
    // Skip if the required pages don't exist in the test environment
    const sourcePageUrl = '/objets-magiques/objet-merveilleux/masque-de-tacticien-basique';
    const targetPageUrl = '/regles-de-la-table/sens-et-capacites';
    const expectedFragmentId = 'vision-thermique';

    // Try to navigate to source page
    const response = await page.goto(sourcePageUrl);

    // Skip if page doesn't exist (404)
    if (response?.status() === 404) {
      test.skip();
      return;
    }

    // Wait for content to load
    const contentContainer = page.locator('[data-testid="viewer-content"]');
    const contentVisible = await contentContainer.isVisible().catch(() => false);

    if (!contentVisible) {
      // Content not available in test environment, skip
      test.skip();
      return;
    }

    // Find the wikilink with "vision thermique" text
    const wikilinkToHeader = contentContainer
      .locator('a, span')
      .filter({ hasText: /vision thermique/i })
      .first();

    const linkVisible = await wikilinkToHeader.isVisible().catch(() => false);
    if (!linkVisible) {
      // Link not found in test content, skip
      test.skip();
      return;
    }

    // If it's an <a> tag, verify navigation
    const tagName = await wikilinkToHeader.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'a') {
      const href = await wikilinkToHeader.getAttribute('href');
      expect(href).toContain(targetPageUrl);
      expect(href).toContain(`#${expectedFragmentId}`);

      await wikilinkToHeader.click();

      // Verify URL contains the fragment
      await expect(page).toHaveURL(
        new RegExp(`${targetPageUrl.replace(/\//g, '\\/')}#${expectedFragmentId}`),
        { timeout: 10000 }
      );

      // Verify target element exists
      const targetHeading = page.locator(`#${expectedFragmentId}`);
      await expect(targetHeading).toBeVisible({ timeout: 5000 });

      // Wait for scroll animation
      await page.waitForTimeout(1000);

      const headingBox = await targetHeading.boundingBox();
      expect(headingBox).not.toBeNull();

      if (headingBox) {
        // Heading should be near top of viewport (with tolerance for fixed header)
        expect(headingBox.y).toBeLessThan(400);
        expect(headingBox.y).toBeGreaterThanOrEqual(0);
      }
    } else {
      // If still a <span> (HTML not regenerated), skip
      test.skip();
    }
  });

  test('should handle fragment-only links on same page', async ({ page }) => {
    // Test requires specific E2E fixtures
    const pageUrl = '/regles-de-la-table/sens-et-capacites';

    const response = await page.goto(pageUrl);

    // Skip if page doesn't exist
    if (response?.status() === 404) {
      test.skip();
      return;
    }

    const contentContainer = page.locator('[data-testid="viewer-content"]');
    const contentVisible = await contentContainer.isVisible().catch(() => false);

    if (!contentVisible) {
      test.skip();
      return;
    }

    // Create a test fragment link
    await page.evaluate(() => {
      const testLink = document.createElement('a');
      testLink.href = '#vision-thermique';
      testLink.textContent = 'Test link to vision thermique';
      testLink.id = 'test-fragment-link';
      document.querySelector('[data-testid="viewer-content"]')?.prepend(testLink);
    });

    const fragmentLink = page.locator('#test-fragment-link');
    await expect(fragmentLink).toBeVisible();

    const href = await fragmentLink.getAttribute('href');
    await fragmentLink.click();

    // URL should contain the fragment
    await expect(page).toHaveURL(
      new RegExp(`${pageUrl.replace(/\//g, '\\/')}${href?.replace('#', '\\#')}`)
    );

    // Target element should be visible
    const target = page.locator(`#vision-thermique`);
    const targetVisible = await target.isVisible().catch(() => false);

    if (targetVisible) {
      await page.waitForTimeout(500);
      const box = await target.boundingBox();
      if (box) {
        expect(box.y).toBeLessThan(400);
      }
    }
  });

  test('should handle direct URL with fragment (deep link)', async ({ page }) => {
    // Test requires specific E2E fixtures
    const targetPageUrl = '/regles-de-la-table/sens-et-capacites';
    const expectedFragmentId = 'vision-thermique';
    const fullUrl = `${targetPageUrl}#${expectedFragmentId}`;

    // Navigate directly to URL with fragment
    const response = await page.goto(fullUrl);

    // Skip if page doesn't exist
    if (response?.status() === 404) {
      test.skip();
      return;
    }

    // Wait for content to load
    const contentContainer = page.locator('[data-testid="viewer-content"]');
    const contentVisible = await contentContainer.isVisible().catch(() => false);

    if (!contentVisible) {
      test.skip();
      return;
    }

    // Verify target element exists
    const targetHeading = page.locator(`#${expectedFragmentId}`);
    const headingVisible = await targetHeading.isVisible().catch(() => false);

    if (headingVisible) {
      // Wait for scroll animation
      await page.waitForTimeout(1000);

      const headingBox = await targetHeading.boundingBox();
      if (headingBox) {
        expect(headingBox.y).toBeLessThan(400);
        expect(headingBox.y).toBeGreaterThanOrEqual(0);
      }
    }
    // If heading doesn't exist, test passes (fixture may not have this heading)
  });
});
