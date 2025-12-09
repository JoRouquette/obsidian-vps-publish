import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the home page', async ({ page }) => {
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle(/Scribe d'Ektaron/i);
  });

  test('should display logo', async ({ page }) => {
    const logo = page.getByRole('link', { name: /accueil/i }).locator('img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('alt', /Scribe d'Ektaron/i);
  });

  test('should display navigation elements', async ({ page }) => {
    // Vérifie la présence des éléments de navigation principaux
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();

    const searchButton = page.getByRole('button', { name: /recherche/i });
    await expect(searchButton).toBeVisible();

    const themeToggle = page.getByRole('button', { name: /thème/i });
    await expect(themeToggle).toBeVisible();
  });

  test('should display welcome content', async ({ page }) => {
    // Vérifie que le contenu principal est chargé
    await expect(page.locator('.home-container')).toBeVisible();
  });

  test('should navigate to home when clicking logo', async ({ page }) => {
    // Navigate away first
    await page.goto('/search');
    await expect(page).toHaveURL('/search');

    // Click logo to return home
    const logo = page.getByRole('link', { name: /accueil/i });
    await logo.click();

    await expect(page).toHaveURL('/');
  });
});
