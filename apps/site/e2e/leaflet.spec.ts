import { expect, test } from '@playwright/test';

test.describe('Leaflet Map Integration', () => {
  // Ce test suppose qu'il existe une page avec un bloc Leaflet dans le manifest
  // Pour un vrai test, vous devriez créer une page de test avec un bloc Leaflet

  test('should render leaflet map container when page has leaflet blocks', async ({ page }) => {
    // Pour ce test, nous allons mocker une page avec un bloc Leaflet
    // En production, il faudrait une vraie page avec un bloc ```leaflet

    // Naviguer vers une page (adapter selon votre manifest)
    await page.goto('/');

    // Injecter un mock de leafletBlocks dans le manifest pour tester
    await page.evaluate(() => {
      // Mock du manifest avec un leaflet block
      const mockManifest = {
        pages: [
          {
            id: 'test-leaflet',
            title: 'Test Leaflet',
            route: '/test-leaflet',
            leafletBlocks: [
              {
                id: 'test-map',
                lat: 48.8566,
                long: 2.3522,
                defaultZoom: 13,
                height: '400px',
                width: '100%',
              },
            ],
          },
        ],
        generatedAt: new Date(),
        siteMetadata: {
          siteName: 'Test Site',
          author: 'Test Author',
        },
      };

      // Remplacer le manifest dans sessionStorage
      sessionStorage.setItem('vps-manifest', JSON.stringify(mockManifest));
    });

    // Naviguer vers la page de test
    await page.goto('/test-leaflet');

    // Attendre que la page charge
    await page.waitForLoadState('networkidle');

    // Vérifier que le conteneur de carte Leaflet existe
    const mapContainer = page.locator('[data-testid="leaflet-map-test-map"]');

    // Le conteneur doit être présent dans le DOM
    await expect(mapContainer).toBeAttached();

    // Vérifier que le conteneur a les bonnes dimensions
    const height = await mapContainer.evaluate((el: HTMLElement) => el.style.height);
    const width = await mapContainer.evaluate((el: HTMLElement) => el.style.width);

    expect(height).toBe('400px');
    expect(width).toBe('100%');
  });

  test('should not throw errors when initializing leaflet on client side', async ({ page }) => {
    // Capturer les erreurs console
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capturer les erreurs de page
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto('/');

    // Attendre que la page soit complètement chargée
    await page.waitForLoadState('networkidle');

    // Vérifier qu'il n'y a pas d'erreurs liées à Leaflet
    const leafletErrors = consoleErrors.filter((err) => err.toLowerCase().includes('leaflet'));
    expect(leafletErrors).toHaveLength(0);

    const leafletPageErrors = pageErrors.filter((err) =>
      err.message.toLowerCase().includes('leaflet')
    );
    expect(leafletPageErrors).toHaveLength(0);
  });

  test('should handle SSR without crashing (no window/document access)', async ({ page }) => {
    // Ce test vérifie que le SSR ne crash pas
    // En vérifiant simplement que la page se charge sans erreur 5xx

    const response = await page.goto('/');

    // La réponse ne doit pas être une erreur serveur
    expect(response?.status()).toBeLessThan(500);

    // La page doit contenir du contenu
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test('should display multiple leaflet maps if page has multiple blocks', async ({ page }) => {
    // Mock avec plusieurs blocs
    await page.evaluate(() => {
      const mockManifest = {
        pages: [
          {
            id: 'multi-maps',
            title: 'Multiple Maps',
            route: '/multi-maps',
            leafletBlocks: [
              {
                id: 'map-1',
                lat: 48.8566,
                long: 2.3522,
                defaultZoom: 13,
              },
              {
                id: 'map-2',
                lat: 51.5074,
                long: -0.1278,
                defaultZoom: 12,
              },
            ],
          },
        ],
        generatedAt: new Date(),
        siteMetadata: {
          siteName: 'Test Site',
          author: 'Test Author',
        },
      };

      sessionStorage.setItem('vps-manifest', JSON.stringify(mockManifest));
    });

    await page.goto('/multi-maps');
    await page.waitForLoadState('networkidle');

    // Vérifier que les deux conteneurs existent
    const map1 = page.locator('[data-testid="leaflet-map-map-1"]');
    const map2 = page.locator('[data-testid="leaflet-map-map-2"]');

    await expect(map1).toBeAttached();
    await expect(map2).toBeAttached();
  });

  test('should not display leaflet section when page has no blocks', async ({ page }) => {
    await page.goto('/');

    // La section leaflet-maps-section ne devrait pas être présente
    const leafletSection = page.locator('.leaflet-maps-section');

    // Vérifier que la section n'existe pas ou n'est pas visible
    const count = await leafletSection.count();
    expect(count).toBe(0);
  });
});
