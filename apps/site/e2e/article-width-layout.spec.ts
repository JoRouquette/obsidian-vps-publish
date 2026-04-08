import { expect, test, type Page } from '@playwright/test';

type Breakpoint = {
  name: 'mobile' | 'tablet' | 'desktop' | 'wide';
  width: number;
  height: number;
};

type LayoutMetrics = {
  shellPaddingLeft: number;
  shellClientWidth: number;
  shellScrollWidth: number;
  pageWidth: number;
  pageLeft: number;
  pageRight: number;
  proseWidth: number;
  proseLeft: number;
  proseRight: number;
  headingWidth: number;
  headingLeft: number;
  headingRight: number;
  headingComputedWidth: string;
  headingComputedMaxWidth: string;
  headingComputedInlineSize: string;
  listWidth: number;
  listLeft: number;
  listRight: number;
  listPaddingLeft: number;
  listPaddingRight: number;
  blockquoteWidth: number;
  blockquoteLeft: number;
  blockquoteRight: number;
  ruleWidth: number;
  ruleLeft: number;
  ruleRight: number;
  calloutWidth: number;
  calloutLeft: number;
  calloutRight: number;
  calloutContentWidth: number;
  calloutContentLeft: number;
  calloutContentRight: number;
  calloutContentPaddingLeft: number;
  calloutContentPaddingRight: number;
  tableWrapperClientWidth: number;
  tableWrapperScrollWidth: number;
  preClientWidth: number;
  preScrollWidth: number;
};

const BREAKPOINTS: Breakpoint[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'wide', width: 1600, height: 1000 },
];

const HOME_URL = '/';
const VIEWER_URL = '/article-width-page';

async function measureArticleLayout(page: Page, url: string, articleSelector: string) {
  const results: Array<{ breakpoint: Breakpoint['name']; metrics: LayoutMetrics }> = [];

  for (const breakpoint of BREAKPOINTS) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');

    const article = page.locator(articleSelector);
    await expect(article).toBeVisible();
    await expect(page.locator('[data-testid="layout-heading"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-prose"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-blockquote"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-rule"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-callout"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-callout-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-table-wrapper"]')).toBeVisible();
    await expect(page.locator('[data-testid="layout-code"]')).toBeVisible();

    const metrics = await page.evaluate((selector) => {
      const shell = document.querySelector('.main') as HTMLElement | null;
      const articleRoot = document.querySelector(selector) as HTMLElement | null;
      const heading = document.querySelector(
        '[data-testid="layout-heading"]'
      ) as HTMLElement | null;
      const prose = document.querySelector('[data-testid="layout-prose"]') as HTMLElement | null;
      const list = document.querySelector('[data-testid="layout-list"]') as HTMLElement | null;
      const blockquote = document.querySelector(
        '[data-testid="layout-blockquote"]'
      ) as HTMLElement | null;
      const rule = document.querySelector('[data-testid="layout-rule"]') as HTMLElement | null;
      const callout = document.querySelector(
        '[data-testid="layout-callout"]'
      ) as HTMLElement | null;
      const calloutContent = document.querySelector(
        '[data-testid="layout-callout-content"]'
      ) as HTMLElement | null;
      const tableWrapper = document.querySelector(
        '[data-testid="layout-table-wrapper"]'
      ) as HTMLElement | null;
      const pre = document.querySelector('[data-testid="layout-code"]') as HTMLElement | null;

      if (
        !shell ||
        !articleRoot ||
        !heading ||
        !prose ||
        !list ||
        !blockquote ||
        !rule ||
        !callout ||
        !calloutContent ||
        !tableWrapper ||
        !pre
      ) {
        throw new Error('Required layout fixture nodes are missing');
      }

      const shellStyle = globalThis.getComputedStyle(shell);
      const listStyle = globalThis.getComputedStyle(list);
      const headingStyle = globalThis.getComputedStyle(heading);
      const calloutContentStyle = globalThis.getComputedStyle(calloutContent);
      const pageRect = articleRoot.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const proseRect = prose.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const blockquoteRect = blockquote.getBoundingClientRect();
      const ruleRect = rule.getBoundingClientRect();
      const calloutRect = callout.getBoundingClientRect();
      const calloutContentRect = calloutContent.getBoundingClientRect();
      const tableWrapperRect = tableWrapper.getBoundingClientRect();
      const preRect = pre.getBoundingClientRect();

      return {
        shellPaddingLeft: Number.parseFloat(shellStyle.paddingLeft),
        shellClientWidth: shell.clientWidth,
        shellScrollWidth: shell.scrollWidth,
        pageWidth: pageRect.width,
        pageLeft: pageRect.left,
        pageRight: pageRect.right,
        proseWidth: proseRect.width,
        proseLeft: proseRect.left,
        proseRight: proseRect.right,
        headingWidth: headingRect.width,
        headingLeft: headingRect.left,
        headingRight: headingRect.right,
        headingComputedWidth: headingStyle.width,
        headingComputedMaxWidth: headingStyle.maxWidth,
        headingComputedInlineSize: headingStyle.inlineSize,
        listWidth: listRect.width,
        listLeft: listRect.left,
        listRight: listRect.right,
        listPaddingLeft: Number.parseFloat(listStyle.paddingLeft),
        listPaddingRight: Number.parseFloat(listStyle.paddingRight),
        blockquoteWidth: blockquoteRect.width,
        blockquoteLeft: blockquoteRect.left,
        blockquoteRight: blockquoteRect.right,
        ruleWidth: ruleRect.width,
        ruleLeft: ruleRect.left,
        ruleRight: ruleRect.right,
        calloutWidth: calloutRect.width,
        calloutLeft: calloutRect.left,
        calloutRight: calloutRect.right,
        calloutContentWidth: calloutContentRect.width,
        calloutContentLeft: calloutContentRect.left,
        calloutContentRight: calloutContentRect.right,
        calloutContentPaddingLeft: Number.parseFloat(calloutContentStyle.paddingLeft),
        calloutContentPaddingRight: Number.parseFloat(calloutContentStyle.paddingRight),
        tableWrapperClientWidth: tableWrapper.clientWidth,
        tableWrapperScrollWidth: tableWrapper.scrollWidth,
        preClientWidth: pre.clientWidth,
        preScrollWidth: pre.scrollWidth,
      } satisfies LayoutMetrics;
    }, articleSelector);

    results.push({ breakpoint: breakpoint.name, metrics });
  }

  return results;
}

function railCenter(rail: { left: number; right: number }) {
  return (rail.left + rail.right) / 2;
}

function expectCenteredOnReadableRail(
  readableRail: { left: number; right: number },
  candidate: { left: number; right: number },
  tolerance = 2
) {
  expect(Math.abs(railCenter(candidate) - railCenter(readableRail))).toBeLessThanOrEqual(tolerance);
}

function expectCloserToReadableRailThanPageRail(
  pageWidth: number,
  readableWidth: number,
  candidateWidth: number
) {
  expect(Math.abs(candidateWidth - readableWidth)).toBeLessThan(
    Math.abs(candidateWidth - pageWidth)
  );
}

function expectSharedArticleWidthInvariants(
  measurements: Array<{ breakpoint: Breakpoint['name']; metrics: LayoutMetrics }>
) {
  const byBreakpoint = new Map(measurements.map((entry) => [entry.breakpoint, entry.metrics]));
  const desktop = byBreakpoint.get('desktop');
  const wide = byBreakpoint.get('wide');

  expect(desktop).toBeDefined();
  expect(wide).toBeDefined();

  for (const { breakpoint, metrics } of measurements) {
    expect(metrics.shellPaddingLeft).toBeGreaterThan(0);
    expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.shellClientWidth + 1);
    expect(metrics.proseWidth).toBeLessThanOrEqual(metrics.pageWidth + 1);
    expect(metrics.shellScrollWidth).toBeLessThanOrEqual(metrics.shellClientWidth + 2);
    expect(metrics.tableWrapperScrollWidth).toBeGreaterThan(metrics.tableWrapperClientWidth + 1);
    expect(metrics.preScrollWidth).toBeGreaterThan(metrics.preClientWidth + 1);

    const proseRail = {
      left: metrics.proseLeft,
      right: metrics.proseRight,
      width: metrics.proseWidth,
    };
    const pageRail = {
      left: metrics.pageLeft,
      right: metrics.pageRight,
      width: metrics.pageWidth,
    };
    const listTextRail = {
      left: metrics.listLeft + metrics.listPaddingLeft,
      right: metrics.listRight - metrics.listPaddingRight,
      width: metrics.listWidth - metrics.listPaddingLeft - metrics.listPaddingRight,
    };
    const calloutContentTextRail = {
      left: metrics.calloutContentLeft + metrics.calloutContentPaddingLeft,
      right: metrics.calloutContentRight - metrics.calloutContentPaddingRight,
      width:
        metrics.calloutContentWidth -
        metrics.calloutContentPaddingLeft -
        metrics.calloutContentPaddingRight,
    };

    expectCenteredOnReadableRail(proseRail, {
      left: metrics.headingLeft,
      right: metrics.headingRight,
    });
    expectCloserToReadableRailThanPageRail(
      metrics.pageWidth,
      metrics.proseWidth,
      metrics.headingWidth
    );

    expect(listTextRail.width).toBeLessThan(metrics.pageWidth - 4);
    expect(Math.abs(listTextRail.width - metrics.proseWidth)).toBeLessThan(
      Math.abs(listTextRail.width - pageRail.width)
    );

    expectCenteredOnReadableRail(proseRail, {
      left: metrics.blockquoteLeft,
      right: metrics.blockquoteRight,
    });
    expectCloserToReadableRailThanPageRail(
      metrics.pageWidth,
      metrics.proseWidth,
      metrics.blockquoteWidth
    );

    expectCenteredOnReadableRail(proseRail, {
      left: metrics.ruleLeft,
      right: metrics.ruleRight,
    });
    expect(Math.abs(metrics.ruleWidth - metrics.proseWidth)).toBeLessThanOrEqual(4);

    expectCenteredOnReadableRail(proseRail, {
      left: metrics.calloutLeft,
      right: metrics.calloutRight,
    });
    expectCloserToReadableRailThanPageRail(
      metrics.pageWidth,
      metrics.proseWidth,
      metrics.calloutWidth
    );
    expectCenteredOnReadableRail(
      proseRail,
      {
        left: calloutContentTextRail.left,
        right: calloutContentTextRail.right,
      },
      12
    );
    expect(calloutContentTextRail.width).toBeLessThan(metrics.pageWidth - 8);
    expect(Math.abs(calloutContentTextRail.width - metrics.proseWidth)).toBeLessThan(
      Math.abs(calloutContentTextRail.width - pageRail.width)
    );

    if (breakpoint === 'tablet' || breakpoint === 'desktop' || breakpoint === 'wide') {
      expect(metrics.proseWidth).toBeLessThan(metrics.pageWidth - 8);
      expect(metrics.headingWidth).toBeLessThan(metrics.pageWidth - 8);
      expect(metrics.calloutWidth).toBeLessThan(metrics.pageWidth - 8);
      expect(metrics.tableWrapperClientWidth).toBeGreaterThan(metrics.proseWidth + 8);
      expect(metrics.preClientWidth).toBeGreaterThan(metrics.proseWidth + 8);
    }
  }

  expect(Math.abs((wide?.pageWidth ?? 0) - (desktop?.pageWidth ?? 0))).toBeLessThanOrEqual(4);
  expect(Math.abs((wide?.proseWidth ?? 0) - (desktop?.proseWidth ?? 0))).toBeLessThanOrEqual(4);
}

test.describe('Article width layout regression', () => {
  test.skip(({ isMobile }) => isMobile, 'This spec drives its own breakpoints.');

  test('home keeps shell gutter, page box, prose measure, and local wide-content overflow aligned', async ({
    page,
  }) => {
    const measurements = await measureArticleLayout(
      page,
      HOME_URL,
      '.home .content .markdown-body'
    );
    expectSharedArticleWidthInvariants(measurements);
  });

  test('viewer keeps shell gutter, page box, prose measure, and local wide-content overflow aligned', async ({
    page,
  }) => {
    const measurements = await measureArticleLayout(
      page,
      VIEWER_URL,
      '.viewer .content .markdown-body'
    );
    expectSharedArticleWidthInvariants(measurements);
  });
});
