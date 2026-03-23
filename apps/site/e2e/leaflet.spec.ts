import { expect, test } from '@playwright/test';

/**
 * Leaflet E2E smoke tests.
 *
 * Fixtures:
 *   - /leaflet-single  → one map  (e2e-map-single)
 *   - /leaflet-multi   → two maps (e2e-map-paris, e2e-map-london)
 *
 * The HTML fixtures contain pre-enriched `data-leaflet-block` attributes
 * (as the real backend would produce), so the Angular Viewer only needs
 * to create the LeafletMapComponent at runtime.
 *
 * Network isolation:
 *   All external tile/image requests (OSM tiles, unpkg marker icons) are
 *   intercepted via Playwright route() and fulfilled with a transparent
 *   1×1 PNG. This keeps the full Leaflet init path exercised without
 *   depending on third-party servers in CI.
 */

const SINGLE_MAP_URL = '/leaflet-single';
const MULTI_MAP_URL = '/leaflet-multi';
const IMAGE_MAP_URL = '/leaflet-image';
const NON_LEAFLET_URL = '/test-page';

// Leaflet dynamic import takes a moment; wait up to 15 s for the container
const MAP_TIMEOUT = 15_000;

// Minimal 1×1 transparent PNG (68 bytes) — served in place of real tiles/icons
const TRANSPARENT_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Intercept all external network requests that Leaflet makes:
 * - OSM tile server (*.tile.openstreetmap.org)
 * - unpkg CDN (marker icons)
 * Respond with a tiny transparent PNG so Leaflet initialises normally
 * but no real network call leaves the test runner.
 */
async function stubExternalTileRequests(page: import('@playwright/test').Page): Promise<void> {
  await page.route(/tile\.openstreetmap\.org/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_1X1_PNG,
    })
  );
  await page.route(/unpkg\.com\/leaflet/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_1X1_PNG,
    })
  );
}

test.describe('Leaflet Map E2E', () => {
  test.beforeEach(async ({ page }) => {
    await stubExternalTileRequests(page);
  });

  test('single map page renders a .leaflet-container', async ({ page }) => {
    await page.goto(SINGLE_MAP_URL);

    const container = page.locator('.leaflet-container').first();
    await expect(container).toBeVisible({ timeout: MAP_TIMEOUT });

    // The container must have non-zero dimensions (proves Leaflet initialised)
    const box = await container.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('multi-map page renders two independent .leaflet-container', async ({ page }) => {
    await page.goto(MULTI_MAP_URL);

    const containers = page.locator('.leaflet-container');
    await expect(containers.first()).toBeVisible({ timeout: MAP_TIMEOUT });
    await expect(containers).toHaveCount(2);

    // Each container must have non-zero dimensions
    for (let i = 0; i < 2; i++) {
      const box = await containers.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
  });

  test('maps survive client-side navigation between pages', async ({ page }) => {
    // Start on the single map page
    await page.goto(SINGLE_MAP_URL);
    await expect(page.locator('.leaflet-container').first()).toBeVisible({
      timeout: MAP_TIMEOUT,
    });

    // Navigate to multi-map via Angular router (click an internal link or use goto)
    await page.goto(MULTI_MAP_URL);
    const containers = page.locator('.leaflet-container');
    await expect(containers.first()).toBeVisible({ timeout: MAP_TIMEOUT });
    await expect(containers).toHaveCount(2);

    // Navigate back to single map
    await page.goto(SINGLE_MAP_URL);
    await expect(page.locator('.leaflet-container')).toHaveCount(1, {
      timeout: MAP_TIMEOUT,
    });
  });

  test('maps survive a hard reload', async ({ page }) => {
    await page.goto(SINGLE_MAP_URL);
    await expect(page.locator('.leaflet-container').first()).toBeVisible({
      timeout: MAP_TIMEOUT,
    });

    // Hard reload — forces full re-bootstrap
    await page.reload();
    await expect(page.locator('.leaflet-container').first()).toBeVisible({
      timeout: MAP_TIMEOUT,
    });

    const box = await page.locator('.leaflet-container').first().boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
  });

  test('image map zoom controls, mouse wheel, and fullscreen all work on the rendered overlay', async ({
    page,
  }) => {
    await page.goto(IMAGE_MAP_URL);

    const container = page.locator('.leaflet-container').first();
    const imageLayer = page.locator('img.leaflet-image-layer').first();
    const fullscreenButton = page.locator('a.leaflet-control-zoom-fullscreen').first();

    await expect(container).toBeVisible({ timeout: MAP_TIMEOUT });
    await expect(imageLayer).toBeVisible({ timeout: MAP_TIMEOUT });
    await expect(fullscreenButton).toBeVisible({ timeout: MAP_TIMEOUT });

    const readState = async () =>
      page.evaluate(() => {
        const containerEl = document.querySelector('.leaflet-container') as HTMLElement | null;
        const imageEl = document.querySelector('img.leaflet-image-layer') as HTMLElement | null;
        const imageRect = imageEl?.getBoundingClientRect();
        const containerRect = containerEl?.getBoundingClientRect();

        return {
          containerWidth: containerRect?.width ?? 0,
          containerHeight: containerRect?.height ?? 0,
          imageWidth: imageRect?.width ?? 0,
          imageHeight: imageRect?.height ?? 0,
          fullscreen: !!document.fullscreenElement,
        };
      });

    const initial = await readState();
    expect(initial.imageWidth).toBeGreaterThan(0);

    await page.click('a.leaflet-control-zoom-in');
    await page.waitForTimeout(400);
    const afterZoomIn = await readState();
    expect(afterZoomIn.imageWidth).toBeGreaterThan(initial.imageWidth);

    await page.click('a.leaflet-control-zoom-out');
    await page.waitForTimeout(400);
    const afterZoomOut = await readState();
    expect(afterZoomOut.imageWidth).toBeLessThan(afterZoomIn.imageWidth);

    await container.hover();
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(400);
    const afterWheelZoomIn = await readState();
    expect(afterWheelZoomIn.imageWidth).toBeGreaterThan(afterZoomOut.imageWidth);

    await fullscreenButton.click();
    await page.waitForTimeout(400);
    const afterFullscreen = await readState();
    expect(afterFullscreen.fullscreen).toBe(true);
    expect(afterFullscreen.containerWidth).toBeGreaterThan(initial.containerWidth);
    expect(afterFullscreen.containerHeight).toBeGreaterThan(initial.containerHeight);
  });

  test('no blocking Leaflet errors in the console', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(SINGLE_MAP_URL);
    await expect(page.locator('.leaflet-container').first()).toBeVisible({
      timeout: MAP_TIMEOUT,
    });

    const leafletErrors = errors.filter((e) => /leaflet/i.test(e));
    expect(leafletErrors).toHaveLength(0);
  });

  test('page without Leaflet blocks has zero .leaflet-container', async ({ page }) => {
    await page.goto(NON_LEAFLET_URL);
    await page.waitForLoadState('domcontentloaded');

    // Small wait to give any rogue init a chance to appear
    await page.waitForTimeout(1000);

    const containers = page.locator('.leaflet-container');
    await expect(containers).toHaveCount(0);
  });
});
