import { expect, test } from '@playwright/test';

type Breakpoint = {
  name: 'mobile' | 'desktop';
  width: number;
  height: number;
};

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const BREAKPOINTS: Breakpoint[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

function center(left: number, right: number) {
  return (left + right) / 2;
}

test.describe('Navigation and shell layout behavior', () => {
  test.skip(({ isMobile }) => isMobile, 'This spec drives its own breakpoints.');

  test('mobile topbar keeps menu, title, and search controls aligned without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/nested/deep-page');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.mobile-burger-btn')).toBeVisible();
    await expect(page.locator('.mobile-search-btn')).toBeVisible();
    await expect(page.locator('.site-name')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector('.topbar') as HTMLElement | null;
      const shell = document.querySelector('.main') as HTMLElement | null;
      const burger = document.querySelector('.mobile-burger-btn') as HTMLElement | null;
      const siteName = document.querySelector('.site-name') as HTMLElement | null;
      const search = document.querySelector('.mobile-search-btn') as HTMLElement | null;
      const desktopSearch = document.querySelector('.desktop-search') as HTMLElement | null;
      const toolbarActions = document.querySelector('.toolbar-actions') as HTMLElement | null;

      if (!topbar || !shell || !burger || !siteName || !search) {
        throw new Error('Topbar mobile fixture is missing required elements');
      }

      const topbarRect = topbar.getBoundingClientRect();
      const burgerRect = burger.getBoundingClientRect();
      const siteNameRect = siteName.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();

      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        shellClientWidth: shell.clientWidth,
        shellScrollWidth: shell.scrollWidth,
        topbarWidth: topbarRect.width,
        topbarScrollWidth: topbar.scrollWidth,
        burgerLeft: burgerRect.left,
        burgerTop: burgerRect.top,
        burgerRight: burgerRect.right,
        siteNameLeft: siteNameRect.left,
        siteNameTop: siteNameRect.top,
        siteNameRight: siteNameRect.right,
        searchLeft: searchRect.left,
        searchTop: searchRect.top,
        desktopSearchDisplay: desktopSearch ? getComputedStyle(desktopSearch).display : null,
        toolbarActionsDisplay: toolbarActions ? getComputedStyle(toolbarActions).display : null,
      };
    });

    expect(metrics.burgerRight).toBeLessThanOrEqual(metrics.siteNameLeft + 1);
    expect(metrics.siteNameRight).toBeLessThanOrEqual(metrics.searchLeft + 1);
    expect(Math.abs(metrics.burgerTop - metrics.siteNameTop)).toBeLessThanOrEqual(10);
    expect(Math.abs(metrics.searchTop - metrics.siteNameTop)).toBeLessThanOrEqual(10);
    expect(metrics.desktopSearchDisplay).toBe('none');
    expect(metrics.toolbarActionsDisplay).toBe('none');
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth + 2);
    expect(metrics.shellScrollWidth).toBeLessThanOrEqual(metrics.shellClientWidth + 2);
    expect(metrics.topbarScrollWidth).toBeLessThanOrEqual(metrics.topbarWidth + 2);
  });

  test('search stays centered inside the shell frame without route-root side padding', async ({
    page,
  }) => {
    for (const breakpoint of BREAKPOINTS) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');

      const routeRoot = page.locator('.search-page');
      await expect(routeRoot).toBeVisible();

      const metrics = await page.evaluate(() => {
        const shell = document.querySelector('.main') as HTMLElement | null;
        const routeRoot = document.querySelector('.search-page') as HTMLElement | null;

        if (!shell || !routeRoot) {
          throw new Error('Search route layout fixture is missing');
        }

        const shellRect = shell.getBoundingClientRect();
        const routeRect = routeRoot.getBoundingClientRect();
        const shellStyle = getComputedStyle(shell);
        const routeStyle = getComputedStyle(routeRoot);
        const shellInnerLeft = shellRect.left + Number.parseFloat(shellStyle.paddingLeft);
        const shellInnerRight = shellRect.right - Number.parseFloat(shellStyle.paddingRight);

        return {
          shellClientWidth: shell.clientWidth,
          shellScrollWidth: shell.scrollWidth,
          shellInnerLeft,
          shellInnerRight,
          routeLeft: routeRect.left,
          routeRight: routeRect.right,
          routeWidth: routeRect.width,
          routePaddingLeft: Number.parseFloat(routeStyle.paddingLeft),
          routePaddingRight: Number.parseFloat(routeStyle.paddingRight),
        };
      });

      expect(metrics.routePaddingLeft).toBe(0);
      expect(metrics.routePaddingRight).toBe(0);
      expect(metrics.routeLeft).toBeGreaterThanOrEqual(metrics.shellInnerLeft - 1);
      expect(metrics.routeRight).toBeLessThanOrEqual(metrics.shellInnerRight + 1);
      expect(
        Math.abs(
          center(metrics.routeLeft, metrics.routeRight) -
            center(metrics.shellInnerLeft, metrics.shellInnerRight)
        )
      ).toBeLessThanOrEqual(2);
      expect(metrics.shellScrollWidth).toBeLessThanOrEqual(metrics.shellClientWidth + 2);

      const shellInnerWidth = metrics.shellInnerRight - metrics.shellInnerLeft;
      expect(metrics.routeWidth).toBeLessThanOrEqual(shellInnerWidth + 2);
    }
  });

  test('offline keeps the centered page-box contract without adding route-root side padding', async ({
    page,
  }) => {
    for (const breakpoint of BREAKPOINTS) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/offline');
      await page.waitForLoadState('domcontentloaded');

      const routeRoot = page.locator('.offline-page');
      await expect(routeRoot).toBeVisible();

      const metrics = await page.evaluate(() => {
        const routeRoot = document.querySelector('.offline-page') as HTMLElement | null;

        if (!routeRoot) {
          throw new Error('Offline route layout fixture is missing');
        }

        const routeRect = routeRoot.getBoundingClientRect();
        const routeStyle = getComputedStyle(routeRoot);

        return {
          viewportWidth: document.documentElement.clientWidth,
          viewportScrollWidth: document.documentElement.scrollWidth,
          routeLeft: routeRect.left,
          routeRight: routeRect.right,
          routeWidth: routeRect.width,
          routePaddingLeft: Number.parseFloat(routeStyle.paddingLeft),
          routePaddingRight: Number.parseFloat(routeStyle.paddingRight),
        };
      });

      expect(metrics.routePaddingLeft).toBe(0);
      expect(metrics.routePaddingRight).toBe(0);
      expect(metrics.routeLeft).toBeGreaterThanOrEqual(0);
      expect(metrics.routeRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(
        Math.abs(center(metrics.routeLeft, metrics.routeRight) - metrics.viewportWidth / 2)
      ).toBeLessThanOrEqual(2);
      if (breakpoint.name === 'desktop') {
        expect(metrics.routeWidth).toBeLessThan(metrics.viewportWidth - 4);
      }
    }
  });

  test('search keeps its route-specific header and info-state treatment inside the shared page box', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByRole('searchbox', { name: /rechercher/i }).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('te');

    const infoState = page.locator('.search-page .state.info');
    await expect(infoState).toBeVisible();

    const metrics = await page.evaluate(() => {
      const routeRoot = document.querySelector('.search-page') as HTMLElement | null;
      const header = document.querySelector('.search-page .page-header') as HTMLElement | null;
      const state = document.querySelector('.search-page .state.info') as HTMLElement | null;

      if (!routeRoot || !header || !state) {
        throw new Error('Search route fixture is missing header or state nodes');
      }

      const routeRect = routeRoot.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const stateRect = state.getBoundingClientRect();
      const headerStyle = getComputedStyle(header);
      const stateStyle = getComputedStyle(state);

      return {
        routeWidth: routeRect.width,
        headerWidth: headerRect.width,
        stateWidth: stateRect.width,
        headerPaddingLeft: Number.parseFloat(headerStyle.paddingLeft),
        headerPaddingRight: Number.parseFloat(headerStyle.paddingRight),
        stateDisplay: stateStyle.display,
        stateGap: Number.parseFloat(stateStyle.columnGap || stateStyle.gap),
      };
    });

    expect(metrics.headerWidth).toBeGreaterThan(metrics.routeWidth - 8);
    expect(metrics.headerWidth).toBeLessThanOrEqual(metrics.routeWidth + 1);
    expect(metrics.stateWidth).toBeLessThanOrEqual(metrics.routeWidth + 1);
    expect(metrics.headerPaddingLeft).toBeGreaterThan(0);
    expect(metrics.headerPaddingRight).toBeGreaterThan(0);
    expect(metrics.stateDisplay).toBe('flex');
    expect(metrics.stateGap).toBeGreaterThan(0);
  });

  test('offline keeps its alert header and stacked mobile actions as an intentional route-specific surface', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/offline');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.offline-page .page-header')).toBeVisible();
    await expect(page.locator('.offline-page .state.info')).toBeVisible();
    await expect(page.locator('.offline-page .actions')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('.offline-page .page-header') as HTMLElement | null;
      const state = document.querySelector('.offline-page .state.info') as HTMLElement | null;
      const actions = document.querySelector('.offline-page .actions') as HTMLElement | null;
      const primaryButton = actions?.querySelector('.action-btn') as HTMLElement | null;

      if (!header || !state || !actions || !primaryButton) {
        throw new Error('Offline route fixture is missing required nodes');
      }

      const headerStyle = getComputedStyle(header);
      const stateStyle = getComputedStyle(state);
      const actionsStyle = getComputedStyle(actions);
      const actionsRect = actions.getBoundingClientRect();
      const buttonRect = primaryButton.getBoundingClientRect();

      return {
        headerBackgroundColor: headerStyle.backgroundColor,
        headerRadius: Number.parseFloat(headerStyle.borderTopLeftRadius),
        stateBackgroundColor: stateStyle.backgroundColor,
        stateRadius: Number.parseFloat(stateStyle.borderTopLeftRadius),
        actionsFlexDirection: actionsStyle.flexDirection,
        buttonWidth: buttonRect.width,
        actionsWidth: actionsRect.width,
      };
    });

    expect(metrics.headerBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(metrics.headerRadius).toBeGreaterThan(0);
    expect(metrics.stateBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(metrics.stateRadius).toBeGreaterThan(0);
    expect(metrics.actionsFlexDirection).toBe('column');
    expect(metrics.buttonWidth).toBeGreaterThanOrEqual(metrics.actionsWidth - 2);
  });

  test('admin keeps its distinct hero and panel treatment even in the disabled dashboard state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.admin-page .hero')).toBeVisible();
    await expect(page.locator('.admin-page .panel.empty')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const routeRoot = document.querySelector('.admin-page') as HTMLElement | null;
      const hero = document.querySelector('.admin-page .hero') as HTMLElement | null;
      const panel = document.querySelector('.admin-page .panel.empty') as HTMLElement | null;

      if (!routeRoot || !hero || !panel) {
        throw new Error('Admin route fixture is missing required nodes');
      }

      const routeStyle = getComputedStyle(routeRoot);
      const heroStyle = getComputedStyle(hero);
      const panelStyle = getComputedStyle(panel);
      const routeRect = routeRoot.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      return {
        routeGap: Number.parseFloat(routeStyle.rowGap || routeStyle.gap),
        heroBackgroundImage: heroStyle.backgroundImage,
        heroRadius: Number.parseFloat(heroStyle.borderTopLeftRadius),
        panelBackgroundColor: panelStyle.backgroundColor,
        panelRadius: Number.parseFloat(panelStyle.borderTopLeftRadius),
        panelWidth: panelRect.width,
        routeWidth: routeRect.width,
      };
    });

    expect(metrics.routeGap).toBeGreaterThan(0);
    expect(metrics.heroBackgroundImage).not.toBe('none');
    expect(metrics.heroRadius).toBeGreaterThan(0);
    expect(metrics.panelBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(metrics.panelRadius).toBeGreaterThan(0);
    expect(metrics.panelWidth).toBeLessThanOrEqual(metrics.routeWidth + 1);
  });

  test('admin None-encapsulated generic classes do not leak onto later routes without the admin root', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.admin-page .panel.empty')).toBeVisible();

    const adminPanelStyle = await page.evaluate(() => {
      const panel = document.querySelector('.admin-page .panel.empty') as HTMLElement | null;
      if (!panel) {
        throw new Error('Admin panel fixture is missing');
      }

      const style = getComputedStyle(panel);
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderTopLeftRadius,
        paddingTop: style.paddingTop,
      };
    });

    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.admin-page')).toHaveCount(0);

    const probeStyle = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'panel';
      probe.textContent = 'leak probe';
      document.body.appendChild(probe);

      const style = getComputedStyle(probe);
      const result = {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderTopLeftRadius,
        paddingTop: style.paddingTop,
      };

      probe.remove();
      return result;
    });

    expect(probeStyle.backgroundColor).not.toBe(adminPanelStyle.backgroundColor);
    expect(probeStyle.borderRadius).not.toBe(adminPanelStyle.borderRadius);
    expect(probeStyle.paddingTop).not.toBe(adminPanelStyle.paddingTop);
    expect(probeStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(probeStyle.paddingTop).toBe('0px');
  });

  test('mobile search overlay and drawer stay bounded rounded panels instead of edge-to-edge sheets', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const searchButton = page.locator('.mobile-search-btn');
    await expect(searchButton).toBeVisible();
    await searchButton.click();

    const searchOverlay = page.locator('.search-overlay-content');
    await expect(searchOverlay).toBeVisible();

    const searchMetrics = await page.evaluate(() => {
      const panel = document.querySelector('.search-overlay-content') as HTMLElement | null;
      if (!panel) {
        throw new Error('Search overlay panel is missing');
      }

      const rect = panel.getBoundingClientRect();
      const style = getComputedStyle(panel);

      return {
        viewportWidth: document.documentElement.clientWidth,
        panelWidth: rect.width,
        borderBottomLeftRadius: Number.parseFloat(style.borderBottomLeftRadius),
        borderBottomRightRadius: Number.parseFloat(style.borderBottomRightRadius),
      };
    });

    expect(searchMetrics.panelWidth).toBeLessThan(searchMetrics.viewportWidth);
    expect(searchMetrics.borderBottomLeftRadius).toBeGreaterThan(0);
    expect(searchMetrics.borderBottomRightRadius).toBeGreaterThan(0);

    await page.locator('.search-overlay-backdrop').click();
    await expect(searchOverlay).toBeHidden();

    const menuButton = page.locator('.mobile-burger-btn');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.locator('.vault-explorer.open');
    await expect(drawer).toBeVisible();

    const drawerMetrics = await page.evaluate(() => {
      const drawer = document.querySelector('.vault-explorer.open') as HTMLElement | null;
      if (!drawer) {
        throw new Error('Vault explorer drawer is missing');
      }

      const rect = drawer.getBoundingClientRect();
      const style = getComputedStyle(drawer);

      return {
        viewportWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        panelWidth: rect.width,
        borderTopRightRadius: Number.parseFloat(style.borderTopRightRadius),
        borderBottomRightRadius: Number.parseFloat(style.borderBottomRightRadius),
      };
    });

    expect(drawerMetrics.panelWidth).toBeLessThan(drawerMetrics.viewportWidth);
    expect(drawerMetrics.panelWidth).toBeLessThanOrEqual(MOBILE_VIEWPORT.width * 0.9 + 2);
    expect(drawerMetrics.documentScrollWidth).toBeLessThanOrEqual(drawerMetrics.viewportWidth + 2);
    expect(drawerMetrics.borderTopRightRadius).toBeGreaterThan(0);
    expect(drawerMetrics.borderBottomRightRadius).toBeGreaterThan(0);
  });
});
