import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Site navigation ergonomics styles', () => {
  const repoRoot = process.cwd();

  it('keeps mobile breadcrumbs as a compact orientation pattern instead of a scroll strip', () => {
    const source = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/topbar/topbar.component.scss'),
      'utf8'
    );

    expect(source).toContain('padding: 0.25rem 0.7rem;');
    expect(source).toContain('border-radius: 999px;');
    expect(source).toMatch(
      /grid-template-areas:\s*'burger-btn site-name search-btn'\s*'breadcrumbs breadcrumbs breadcrumbs';/
    );
    expect(source).toContain('.breadcrumbs-mobile {');
    expect(source).toContain('grid-template-columns: auto minmax(0, 1fr);');
    expect(source).toContain('max-width: min(18ch, 52vw);');
    expect(source).toContain('max-width: min(16ch, 42vw);');
    expect(source).not.toContain('overflow-x: auto;');
  });

  it('gives explorer search and rows more visual rhythm and comfortable interactive states', () => {
    const source = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/vault-explorer/vault-explorer.component.scss'
      ),
      'utf8'
    );

    expect(source).toContain('--row-radius: 0.75rem;');
    expect(source).toContain('padding: 0.75rem 0.75rem 0.6rem;');
    expect(source).toContain(
      'background: color-mix(in oklab, var(--bg-surface) 92%, var(--primary) 2%);'
    );
    expect(source).toContain('padding: 0.2rem var(--pad-x);');
    expect(source).toContain('background: color-mix(in oklab, var(--primary) 10%, transparent);');
    expect(source).toContain('font-weight: 500;');
    expect(source).toContain('overflow-x: hidden;');
    expect(source).toContain('touch-action: pan-y;');
  });

  it('keeps mobile overlays integrated as rounded panels instead of raw edge-to-edge sheets', () => {
    const source = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/shell/shell.component.scss'),
      'utf8'
    );

    expect(source).toContain('--shell-overlay-panel-width: min(92vw, 38rem);');
    expect(source).toContain('--shell-drawer-panel-width: min(20rem, 85vw);');
    expect(source).toContain('width: var(--shell-overlay-panel-width);');
    expect(source).toContain('width: var(--shell-drawer-panel-width);');
    expect(source).toContain('border-radius: 0 0 1rem 1rem;');
    expect(source).toContain('border-radius: 0 1rem 1rem 0;');
    expect(source).toContain('--shell-drawer-panel-width: min(18.75rem, 80vw);');
    expect(source).toContain('--shell-drawer-panel-width: min(17.5rem, 85vw);');
    expect(source).toContain('--shell-drawer-panel-width: min(16.25rem, 90vw);');
  });
});
