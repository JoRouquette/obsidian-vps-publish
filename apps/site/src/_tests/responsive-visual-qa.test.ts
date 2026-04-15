import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Responsive visual QA guards', () => {
  const repoRoot = process.cwd();
  const foundationSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/theme/_markdown-layout.foundation.scss'),
    'utf8'
  );
  const articleSkinSource = readFileSync(
    join(repoRoot, 'apps/site/src/presentation/theme/_markdown-article-skin.foundation.scss'),
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

  function expectNoLocalReadableRailDrift(source: string) {
    expect(source).not.toContain('width: min(var(--measure), 100%) !important;');
    expect(source).not.toContain('inline-size: min(var(--measure), 100%) !important;');
    expect(source).not.toContain('.callout-content {\n      margin-inline: auto;');
  }

  it('keeps viewer and home on the shared article foundations without reintroducing local readable-rail overrides', () => {
    for (const source of [viewerSource, homeSource]) {
      expect(source).toContain("@use '../../theme/markdown-layout.foundation' as markdownLayout;");
      expect(source).toContain(
        "@use '../../theme/markdown-article-skin.foundation' as articleSkin;"
      );
      expect(source).toContain('@include markdownLayout.article-page-width-foundation');
      expect(source).toContain('@include markdownLayout.article-wide-content-foundation();');
      expect(source).toContain('@include articleSkin.article-shared-skin();');
      expect(source).toContain('@include articleSkin.article-shared-mobile-skin();');
      expect(source).toContain('--page-pad: var(--layout-page-box-pad-compact);');
      expect(source).toContain('--page-pad: var(--layout-page-box-pad-compact-tight);');
      expectNoLocalReadableRailDrift(source);
    }
  });

  it('keeps wide-content ownership in the shared foundations instead of route-local table rails', () => {
    expect(foundationSource).toContain('@include article-wide-block-rail();');
    expect(foundationSource).toContain('.table-wrapper {');
    expect(foundationSource).toContain('pre,');
    expect(foundationSource).toContain('.frontmatter-card,');
    expect(foundationSource).toContain('.leaflet-map-placeholder');
    expect(articleSkinSource).toContain('@mixin article-shared-skin()');
    expect(articleSkinSource).toContain('.callout-title {');
    expect(articleSkinSource).toContain('figure.md-asset.align-left');
    expect(viewerSource).not.toContain(
      'overflow-x: scroll; /* Scroll horizontal uniquement dans le conteneur */'
    );
    expect(homeSource).not.toContain(
      'overflow-x: scroll; /* Scroll horizontal uniquement dans le conteneur */'
    );
    expect(viewerSource).not.toContain('table-layout: auto;');
    expect(homeSource).not.toContain('table-layout: auto;');
  });

  it('keeps textual Dataview wrappers on the shared readable rail without shrinking table blocks', () => {
    expect(foundationSource).toContain(
      "'.dataview.dataview-container:not(:has(.table-wrapper, table))'"
    );
    expect(foundationSource).toContain("'.dataviewjs:not(:has(.table-wrapper, table))'");
    expect(foundationSource).toContain("'.dv-js-output:not(:has(.table-wrapper, table))'");
    expect(foundationSource).toContain("'.dataview-view-result:not(:has(.table-wrapper, table))'");
    expect(foundationSource).toContain('DataviewJS and legacy Dataview HTML frequently render');
  });
});
