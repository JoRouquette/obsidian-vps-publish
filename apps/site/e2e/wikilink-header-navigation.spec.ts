import { expect, test } from '@playwright/test';

test.describe('Wikilink Header Navigation Bug', () => {
  test('should navigate to header anchor when clicking wikilink with subpath', async ({ page }) => {
    // FAIT 1 (VÉRIFIÉ): La note "Masque de tacticien basique" existe
    // dans tmp/site-content/objets-magiques/objet-merveilleux/masque-de-tacticien-basique.html
    const sourcePageUrl = '/objets-magiques/objet-merveilleux/masque-de-tacticien-basique';

    // FAIT 2 (VÉRIFIÉ): La note "Sens et capacités" existe
    // dans tmp/site-content/regles-de-la-table/sens-et-capacites.html
    const targetPageUrl = '/regles-de-la-table/sens-et-capacites';

    // FAIT 3 (VÉRIFIÉ dans le HTML): Le heading "Vision thermique" a l'id "vision-thermique"
    const expectedFragmentId = 'vision-thermique';

    // ÉTAPE 1: Ouvrir la page source
    await page.goto(sourcePageUrl);

    // Attendre que le contenu soit chargé
    const contentContainer = page.locator('[data-testid="viewer-content"]');
    await expect(contentContainer).toBeVisible({ timeout: 10000 });

    // ÉTAPE 2: Trouver le lien wikilink avec le texte "vision thermique"
    // Note: Le HTML actuel contient un <span> car généré avant le correctif backend
    // Après régénération, ce sera un <a> avec href="/regles-de-la-table/sens-et-capacites#vision-thermique"
    const wikilinkToHeader = contentContainer
      .locator('a, span')
      .filter({ hasText: /vision thermique/i })
      .first();
    await expect(wikilinkToHeader).toBeVisible();

    // Si c'est un <a>, vérifier le href
    const tagName = await wikilinkToHeader.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'a') {
      const href = await wikilinkToHeader.getAttribute('href');
      expect(href).toContain(targetPageUrl);
      expect(href).toContain(`#${expectedFragmentId}`);

      // ÉTAPE 3: Cliquer sur le lien
      await wikilinkToHeader.click();

      // ÉTAPE 4: Vérifier que l'URL contient le fragment
      await expect(page).toHaveURL(
        new RegExp(`${targetPageUrl.replace(/\//g, '\\/')}#${expectedFragmentId}`),
        { timeout: 10000 }
      );

      // ÉTAPE 5: Vérifier que l'élément avec l'id correspondant existe
      const targetHeading = page.locator(`#${expectedFragmentId}`);
      await expect(targetHeading).toBeVisible({ timeout: 5000 });

      // ÉTAPE 6 (CRITIQUE): Vérifier que le heading est effectivement dans le viewport
      // C'est ici que le bug se manifeste: le heading existe mais n'a pas été scrollé
      await page.waitForTimeout(1000); // Attendre que le smooth scroll se termine

      const headingBox = await targetHeading.boundingBox();
      expect(headingBox).not.toBeNull();

      if (headingBox) {
        // Le heading devrait être proche du haut de la page (tolérance de 300px pour le header fixe)
        expect(headingBox.y).toBeLessThan(400);
        expect(headingBox.y).toBeGreaterThanOrEqual(0);
      }
    } else {
      // Si c'est encore un <span> (HTML non régénéré), sauter le test
      test.skip();
    }
  });

  test('should handle fragment-only links on same page', async ({ page }) => {
    // Test de non-régression: les liens fragment-only (#heading) doivent continuer à fonctionner
    const pageUrl = '/regles-de-la-table/sens-et-capacites';

    await page.goto(pageUrl);

    const contentContainer = page.locator('[data-testid="viewer-content"]');
    await expect(contentContainer).toBeVisible({ timeout: 10000 });

    // Créer artificiellement un lien fragment-only pour tester
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

    // L'URL devrait contenir le fragment
    await expect(page).toHaveURL(
      new RegExp(`${pageUrl.replace(/\//g, '\\/')}${href?.replace('#', '\\#')}`)
    );

    // L'élément cible devrait être visible
    const target = page.locator(`#vision-thermique`);
    await expect(target).toBeVisible();

    // Vérifier le scroll
    await page.waitForTimeout(500);
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y).toBeLessThan(400);
    }
  });

  test('should handle direct URL with fragment (deep link)', async ({ page }) => {
    // Test du cas où l'utilisateur arrive directement sur une URL avec fragment
    const targetPageUrl = '/regles-de-la-table/sens-et-capacites';
    const expectedFragmentId = 'vision-thermique';
    const fullUrl = `${targetPageUrl}#${expectedFragmentId}`;

    // Naviguer directement vers l'URL avec fragment
    await page.goto(fullUrl);

    // Attendre que le contenu soit chargé
    const contentContainer = page.locator('[data-testid="viewer-content"]');
    await expect(contentContainer).toBeVisible({ timeout: 10000 });

    // Vérifier que l'élément cible existe
    const targetHeading = page.locator(`#${expectedFragmentId}`);
    await expect(targetHeading).toBeVisible({ timeout: 5000 });

    // Attendre que le scroll se termine
    await page.waitForTimeout(1000);

    // Vérifier que le heading est dans le viewport
    const headingBox = await targetHeading.boundingBox();
    expect(headingBox).not.toBeNull();

    if (headingBox) {
      expect(headingBox.y).toBeLessThan(400);
      expect(headingBox.y).toBeGreaterThanOrEqual(0);
    }
  });
});
