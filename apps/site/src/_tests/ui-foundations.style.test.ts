import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Site UI foundations styles', () => {
  const repoRoot = process.cwd();
  const foundationSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/theme/_markdown-layout.foundation.scss'),
    'utf8'
  );
  const articleSkinSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/theme/_markdown-article-skin.foundation.scss'),
    'utf8'
  );
  const indexSource = readFileSync(join(repoRoot, 'apps/site/src/index.html'), 'utf8');
  const routePageSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/theme/_route-page.foundation.scss'),
    'utf8'
  );
  const themeSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/theme/its.theme.scss'),
    'utf8'
  );
  const shellSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/shell/shell.component.scss'),
    'utf8'
  );
  const viewerSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/viewer/viewer.component.scss'),
    'utf8'
  );
  const homeSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/home/home.component.scss'),
    'utf8'
  );
  const searchSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/search/search-content.component.scss'),
    'utf8'
  );
  const searchComponentSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/search/search-content.component.ts'),
    'utf8'
  );
  const offlineSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/offline/offline.component.scss'),
    'utf8'
  );
  const adminSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/admin/admin-dashboard.component.scss'),
    'utf8'
  );
  const adminComponentSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/admin/admin-dashboard.component.ts'),
    'utf8'
  );
  const viewerComponentSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/viewer/viewer.component.ts'),
    'utf8'
  );
  const homeComponentSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/pages/home/home.component.ts'),
    'utf8'
  );
  const imageOverlayComponentSource = readFileSync(
    join(
      repoRoot,
      'apps/site/src/presentation/components/image-overlay/image-overlay.component.ts'
    ),
    'utf8'
  );
  const relatedPagesComponentPath = join(
    repoRoot,
    'apps/site/src/presentation/components/related-pages/related-pages.component.ts'
  );
  const relatedPagesTemplatePath = join(
    repoRoot,
    'apps/site/src/presentation/components/related-pages/related-pages.component.html'
  );
  const relatedPagesStylePath = join(
    repoRoot,
    'apps/site/src/presentation/components/related-pages/related-pages.component.scss'
  );

  function expectSharedArticleLayoutConsumer(source: string) {
    expect(source).toContain("@use '../../theme/markdown-layout.foundation' as markdownLayout;");
    expect(source).toContain("@use '../../theme/markdown-article-skin.foundation' as articleSkin;");
    expect(source).toContain('@include markdownLayout.article-page-width-foundation');
    expect(source).toContain('@include markdownLayout.article-wide-content-foundation();');
    expect(source).toContain('@include articleSkin.article-shared-skin();');
    expect(source).toContain('@include articleSkin.article-shared-mobile-skin();');
    expect(source).toContain('--page-pad: var(--layout-page-box-pad-compact);');
    expect(source).toContain('--page-pad: var(--layout-page-box-pad-compact-tight);');
    expect(source).not.toContain('width: min(var(--measure), 100%) !important;');
    expect(source).not.toContain('inline-size: min(var(--measure), 100%) !important;');
  }

  function expectNoLocalReadableRailDrift(source: string) {
    expect(source).not.toContain('width: min(var(--measure), 100%) !important;');
    expect(source).not.toContain('inline-size: min(var(--measure), 100%) !important;');
    expect(source).not.toContain('.callout-content {\n      margin-inline: auto;');
    expect(source).not.toContain('.callout {\n      max-inline-size: min(var(--measure), 100%);');
  }

  it('defines shared responsive typography and layout tokens in global styles', () => {
    const source = readFileSync(join(repoRoot, 'apps/site/src/styles.scss'), 'utf8');

    expect(source).toContain('--font-size-body:');
    expect(source).toContain('--font-size-heading-1:');
    expect(source).toContain('--layout-page-gutter:');
    expect(source).toContain('--layout-page-box-pad: 0px;');
    expect(source).toContain('--layout-page-box-pad-compact:');
    expect(source).toContain('--layout-page-box-pad-compact-tight:');
    expect(source).toContain('--layout-page-box-pad-portrait:');
    expect(source).toContain('--layout-reader-max:');
    expect(source).toContain('--layout-wide-column-max: 24rem;');
    expect(source).toContain('--layout-non-article-max: 67.5rem;');
    expect(source).toContain('--layout-non-article-max-compact: 45rem;');
    expect(source).toContain('--layout-shell-overlay-max: 38rem;');
    expect(source).toContain('--layout-shell-drawer-max: 20rem;');
    expect(source).toContain('--layout-nav-crumb-max: 24ch;');
    expect(source).toContain('--layout-nav-site-name-max: clamp(150px, 25vw, 300px);');
    expect(source).toContain('--layout-overlay-tooltip-max: 20rem;');
    expect(source).toContain('--layout-article-float-asset-max: min(20rem, 45%);');
    expect(source).toContain('--space-2xl: 1rem;');
    expect(source).toContain('--space-5xl: 1.5rem;');
    expect(source).toContain('--radius-md: 0.625rem;');
    expect(source).toContain('--radius-xl: 0.875rem;');
    expect(source).toContain('--radius-pill: 999px;');
    expect(source).toContain('--interactive-secondary-pill-radius: var(--radius-pill);');
    expect(source).toContain('--interactive-secondary-soft-radius: var(--radius-lg);');
    expect(source).toContain('--interactive-secondary-padding-inline: 0.7rem;');
    expect(source).toContain('--interactive-secondary-touch-target: 2.75rem;');
    expect(source).toContain('font-size: var(--font-size-body);');
    expect(source).toContain('line-height: var(--line-height-body);');
    expect(source).toContain('.katex-display {');
    expect(source).toContain('overflow-x: hidden;');
    expect(source).toContain('.katex-display .katex-html {');
    expect(source).toContain('display: flex;');
    expect(source).toContain('flex-wrap: wrap;');
    expect(source).toContain('.katex-display .katex-html > .base {');
    expect(source).toContain('display: inline-block;');
    expect(source).toContain('flex: 0 0 auto;');
    expect(source).toContain('white-space: nowrap;');
  });

  it('keeps Angular Material theme emission in global styles and leaves the theme file as definitions only', () => {
    const source = readFileSync(join(repoRoot, 'apps/site/src/styles.scss'), 'utf8');

    expect(source).toContain("@use './presentation/theme/its.theme' as theme;");
    expect(source).toContain('@include mat.core();');
    expect(source).toContain('@include mat.theme(theme.$its-light);');
    expect(source).toContain('@include mat.theme(theme.$its-dark);');
    expect(themeSource).toContain('$its-light: mat.define-theme(');
    expect(themeSource).toContain('$its-dark: mat.define-theme(');
    expect(themeSource).not.toContain('@include mat.theme($its-light);');
    expect(themeSource).not.toContain('@include mat.theme($its-dark);');
  });

  it('keeps Material tooltip surface styling global and leaves viewer with only the tooltip proxy trigger', () => {
    const source = readFileSync(join(repoRoot, 'apps/site/src/styles.scss'), 'utf8');

    expect(source).toContain('Material tooltip surface styling is owned globally');
    expect(source).toContain('.mat-mdc-tooltip {');
    expect(source).toContain('.mdc-tooltip__surface {');
    expect(source).toContain('background-color: var(--mat-sys-inverse-surface) !important;');
    expect(source).toContain(':root.theme-dark .mat-mdc-tooltip .mdc-tooltip__surface {');
    expect(source).toContain(':root.theme-light .mat-mdc-tooltip .mdc-tooltip__surface {');

    expect(viewerSource).toContain('.wikilink-tooltip-proxy {');
    expect(viewerSource).not.toContain('.mat-mdc-tooltip .mdc-tooltip__surface {');
  });

  it('keeps shell width variables and route-page mixins available as shared layout primitives', () => {
    expect(shellSource).toContain('--shell-pad-inline: var(--layout-page-gutter);');
    expect(shellSource).toContain('--shell-pad-block:');
    expect(shellSource).toContain('--shell-overlay-panel-width:');
    expect(shellSource).toContain('--shell-drawer-panel-width:');
    expect(routePageSource).toContain('@mixin non-article-route-host()');
    expect(routePageSource).toContain('@mixin non-article-route-page-box()');
    expect(routePageSource).toContain(
      'inline-size: min(var(--route-page-max, var(--layout-non-article-max)), 100%);'
    );
    expect(routePageSource).toContain('margin-inline: auto;');
  });

  it('keeps global encapsulation only on rendered-article routes and scopes generic page selectors under explicit roots', () => {
    expect(viewerComponentSource).toContain('encapsulation: ViewEncapsulation.None');
    expect(homeComponentSource).toContain('encapsulation: ViewEncapsulation.None');
    expect(adminComponentSource).toContain('encapsulation: ViewEncapsulation.None');

    expect(searchComponentSource).not.toContain('ViewEncapsulation.None');
    expect(imageOverlayComponentSource).not.toContain('ViewEncapsulation.None');

    expect(searchSource).toContain('.search-page {');
    expect(searchSource).toContain('.page-header {');
    expect(searchSource).toContain('.state {');
    expect(searchSource).not.toMatch(/^\.(page-header|state|results|result-card)\s*\{/m);

    expect(adminSource).toContain('.admin-page {');
    expect(adminSource).toContain('.panel {');
    expect(adminSource).toContain('.toolbar {');
    expect(adminSource).toContain('.badge {');
    expect(adminSource).toContain('.tab-panel {');
    expect(adminSource).not.toMatch(/^\.(hero|panel|toolbar|badge|tab-panel)\s*\{/m);
  });

  it('assigns page, readable, and wide rails in the shared foundation', () => {
    expect(foundationSource).toContain('@mixin article-page-rail-box()');
    expect(foundationSource).toContain('@mixin article-readable-rail()');
    expect(foundationSource).toContain('@mixin article-readable-flow-foundation()');
    expect(foundationSource).toContain('@mixin article-wide-block-rail()');
    expect(foundationSource).toContain('@mixin article-page-width-foundation($flow-root: false)');
    expect(foundationSource).toContain('--page-max: var(--layout-content-max);');
    expect(foundationSource).toContain('--measure: var(--layout-reader-max);');
    expect(foundationSource).toContain('--page-pad: var(--layout-page-box-pad);');
    expect(foundationSource).toContain('@include article-page-rail-box();');
    expect(foundationSource).toContain('@include article-readable-flow-foundation();');
    expect(foundationSource).toContain('@include article-wide-block-rail();');
    expect(foundationSource).toContain('inline-size: min(var(--page-max), 100%);');
    expect(foundationSource).toContain('padding-inline: var(--page-pad);');
    expect(foundationSource).toContain('overflow-x: hidden;');
    expect(foundationSource).toContain('reading-flow blocks align to one common article column');
    expect(foundationSource).toContain(
      'wide/local-scroll blocks opt out through the wide-content foundation'
    );
    expect(foundationSource).toContain('h1,');
    expect(foundationSource).toContain('h6,');
    expect(foundationSource).toContain('blockquote,');
    expect(foundationSource).toContain('figcaption,');
    expect(foundationSource).toContain('hr,');
    expect(foundationSource).toContain('.callout {');
    expect(foundationSource).toContain('max-inline-size: min(var(--measure), 100%);');
    expect(foundationSource).toContain('margin-inline: auto;');
    expect(foundationSource).toContain('.callout-content {');
    expect(foundationSource).toContain('@mixin article-wide-content-foundation()');
    expect(foundationSource).toContain(
      '--table-column-max: min(var(--measure), var(--layout-wide-column-max));'
    );
    expect(foundationSource).toContain('pre,');
    expect(foundationSource).toContain('.frontmatter-card,');
    expect(foundationSource).toContain('.leaflet-map-placeholder');
    expect(foundationSource).toContain('.table-wrapper {');
    expect(foundationSource).toContain(
      'overflow-x: scroll; /* Scroll horizontal uniquement dans le conteneur */'
    );
    expect(foundationSource).toContain('table-layout: auto;');
    expect(foundationSource).toContain('inline-size: fit-content;');
    expect(foundationSource).toContain('width: fit-content;');
    expect(foundationSource).toContain('text-align-last: auto;');
  });

  it('moves shared article typography, links, callouts, and base media rules into one skin foundation', () => {
    expect(articleSkinSource).toContain('@mixin article-shared-skin()');
    expect(articleSkinSource).toContain('@mixin article-shared-mobile-skin()');
    expect(articleSkinSource).toContain('text-align: justify;');
    expect(articleSkinSource).toContain('.wikilink {');
    expect(articleSkinSource).toContain('.material-icons,');
    expect(articleSkinSource).toContain('.callout-icon {');
    expect(articleSkinSource).toContain('.callout-title {');
    expect(articleSkinSource).toContain('.callout-content {');
    expect(articleSkinSource).toContain('The shared article skin owns the visual callout contract');
    expect(articleSkinSource).toContain('details.callout .callout-title::after');
    expect(articleSkinSource).toContain('details.callout:not([open]) .callout-content');
    expect(articleSkinSource).toContain('figure.md-asset.align-left');
    expect(articleSkinSource).toContain('@media (max-width: 768px)');
    expect(articleSkinSource).toContain('@media (max-width: 520px)');
    expect(indexSource).toContain('Material+Symbols+Outlined');
    expect(indexSource).toContain('Material+Icons');

    expect(viewerSource).not.toContain(".callout[data-callout='info']");
    expect(homeSource).not.toContain(".callout[data-callout='info']");
    expect(viewerSource).not.toContain('.wikilink {');
    expect(homeSource).not.toContain('.wikilink {');
    expect(viewerSource).not.toContain('.material-icons,');
    expect(homeSource).not.toContain('.material-icons,');
  });

  it('makes viewer and home consume the same shared article rail model', () => {
    expectSharedArticleLayoutConsumer(viewerSource);
    expectSharedArticleLayoutConsumer(homeSource);
    expectNoLocalReadableRailDrift(viewerSource);
    expectNoLocalReadableRailDrift(homeSource);

    expect(viewerSource).toContain('--article-callout-border-width: 6px;');
    expect(viewerSource).toContain(
      '--article-asset-float-max-width: var(--layout-article-float-asset-max);'
    );
    // --article-h1/h2/hx-size intentionally omitted in home: the mixin fallback
    // var(…, var(--font-size-heading-N)) already applies the global token.
    expect(homeSource).toContain('--article-callout-shadow-hover: 0 6px 16px');
    expect(homeSource).toContain('--article-callout-title-gap: var(--space-lg);');
  });

  it('keeps viewer-specific behavior local instead of redefining shared rails', () => {
    expect(viewerSource).toContain(
      '@include markdownLayout.article-page-width-foundation($flow-root: true);'
    );
    expect(viewerSource).toContain(
      'the shared markdown foundation owns the page-width, readable-article, and wide-content rails'
    );
    expect(viewerSource).toContain('--page-pad: var(--layout-page-box-pad-portrait);');
    expect(viewerSource).toContain('--article-mobile-callout-title-padding: 0.65rem 0.85rem;');
    expect(viewerSource).toContain('font-size: clamp(1.02rem, 0.99rem + 0.35vw, 1.08rem);');
    expect(viewerSource).toContain('line-height: 1.72;');
    expect(viewerSource).toContain('pre > code {');
    expect(viewerSource).toContain('.frontmatter-card {');
    expect(viewerSource).toContain('.leaflet-map-placeholder {');

    // Inline icons in DataviewJS output: the override must be scoped to .dv-js-output
    // so the global `img { display: block }` reset is not affected outside DataviewJS blocks.
    expect(viewerSource).toContain('.dv-js-output {');
    expect(viewerSource).toMatch(
      /\.dv-js-output[\s\S]*?h[1-6][\s\S]*?\{[\s\S]*?img[\s\S]*?\{[\s\S]*?display:\s*inline-block/
    );
  });

  it('keeps home-specific chrome and asset affordances local instead of redefining shared rails', () => {
    expect(homeSource).toContain(
      'the shared markdown foundation owns the page-width, readable-article, and wide-content rails'
    );
    expect(homeSource).toContain('.head {');
    expect(homeSource).toContain('.title-block {');
    expect(homeSource).toContain('max-inline-size: var(--layout-page-title-max);');
    expect(homeSource).toContain('--article-mobile-h1-size: clamp(1.25rem, 1.7vw, 1.45rem);');
    expect(homeSource).toContain('.md-asset-download-btn {');
    expect(homeSource).toContain('border-radius: var(--radius-md);');
    expect(homeSource).toContain('.md-asset-download-action {');
    expect(homeSource).not.toContain('inline-size: min(clamp(72ch, 92vw, 96ch), 100%);');
    expect(homeSource).not.toContain('--container-pad-inline: clamp(12px, 3vw, 24px);');
    expect(homeSource).not.toContain('max-inline-size: 20rem;');
  });

  it('maps non-article and admin shells onto the shared spacing and radius tokens first', () => {
    expect(adminSource).toContain('gap: var(--space-5xl);');
    expect(adminSource).toContain('border-radius: var(--radius-3xl);');
    expect(adminSource).toContain(
      'grid-template-columns: repeat(auto-fit, minmax(var(--layout-panel-column-min), 1fr));'
    );
    expect(adminSource).toContain('border-radius: var(--radius-pill);');
  });

  it('raises navigation text to shared readable UI sizes', () => {
    const topbarSource = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/topbar/topbar.component.scss'),
      'utf8'
    );
    const explorerSource = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/vault-explorer/vault-explorer.component.scss'
      ),
      'utf8'
    );

    expect(topbarSource).toContain('font-size: 0.95rem;');
    expect(explorerSource).toContain('font-size: var(--font-size-ui);');
    expect(explorerSource).toContain('font-size: var(--font-size-ui-sm);');
    expect(explorerSource).not.toContain('font-size: 0.85rem;');
  });

  it('removes repo-orphaned style code instead of keeping stale compatibility blocks', () => {
    expect(existsSync(relatedPagesComponentPath)).toBe(false);
    expect(existsSync(relatedPagesTemplatePath)).toBe(false);
    expect(existsSync(relatedPagesStylePath)).toBe(false);

    expect(viewerSource).not.toContain('.leaflet-maps-section {');
    expect(viewerSource).not.toContain('.leaflet-map-wrapper {');
    expect(homeSource).not.toContain('.spin {');
    expect(homeSource).not.toContain('@keyframes spin');
    expect(shellSource).not.toContain('.mobile-overlay-logo');
    expect(shellSource).not.toContain('.mobile-overlay-search');
    expect(shellSource).not.toContain('.hamburger-menu');
  });
});
