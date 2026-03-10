import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the home page', async ({ page }) => {
    await expect(page).toHaveURL('/');
    // Title should contain site name from manifest or env
    await expect(page).toHaveTitle(/E2E Test Site|Home/i);
  });

  test('should display logo or header', async ({ page }) => {
    // Check for logo or header link - adapt to site structure
    const logoOrHeader = page
      .getByRole('link', { name: /accueil|home/i })
      .or(page.locator('header a').first());
    await expect(logoOrHeader).toBeVisible();
  });

  test('should display navigation elements', async ({ page }) => {
    // Check for basic navigation elements (menu, search, theme toggle)
    const menuButton = page.getByRole('button', { name: /menu/i });
    const searchButton = page.getByRole('button', { name: /recherche|search/i });
    const themeToggle = page.getByRole('button', { name: /thème|theme/i });

    // At least one navigation element should be visible
    const hasNavigation =
      (await menuButton.isVisible()) ||
      (await searchButton.isVisible()) ||
      (await themeToggle.isVisible());

    expect(hasNavigation).toBe(true);
  });

  test('should display main content container', async ({ page }) => {
    // Main content should be visible
    const mainContent = page.locator('main, .home-container, [data-testid="viewer-content"]');
    await expect(mainContent.first()).toBeVisible();
  });

  test('should navigate to home when clicking logo', async ({ page }) => {
    // Navigate away first
    await page.goto('/search');
    await expect(page).toHaveURL('/search');

    // Click logo/home link to return home
    const homeLink = page
      .getByRole('link', { name: /accueil|home/i })
      .or(page.locator('header a[href="/"]'));
    if (await homeLink.first().isVisible()) {
      await homeLink.first().click();
      await expect(page).toHaveURL('/');
    }
  });

  test('should handle navigation to a content page', async ({ page }) => {
    // Find any internal link and verify navigation works
    const internalLink = page.locator('a[href^="/"]').first();

    if (await internalLink.isVisible()) {
      const href = await internalLink.getAttribute('href');
      await internalLink.click();

      if (href && href !== '/') {
        await expect(page).toHaveURL(new RegExp(href.replace('/', '\\/')));
      }
    }
  });
});
