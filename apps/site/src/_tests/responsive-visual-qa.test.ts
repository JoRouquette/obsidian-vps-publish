import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Responsive visual QA guards', () => {
  const repoRoot = process.cwd();

  it('keeps the viewer mobile reading surface padded and constrains wide content locally', () => {
    const source = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/viewer/viewer.component.scss'),
      'utf8'
    );

    expect(source).toContain('--page-pad: clamp(0.35rem, 1.4vw, 0.6rem);');
    expect(source).toContain('--page-pad: clamp(0.3rem, 2vw, 0.5rem);');
    expect(source).toContain('max-inline-size: min(var(--measure), 100%);');
    expect(source).toContain(
      'overflow-x: auto; /* Scroll horizontal uniquement dans le conteneur */'
    );
    expect(source).toContain('max-width: 100% !important;');
  });

  it('keeps shell and explorer containers protected against horizontal overflow', () => {
    const shellSource = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/shell/shell.component.scss'),
      'utf8'
    );
    const explorerSource = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/vault-explorer/vault-explorer.component.scss'
      ),
      'utf8'
    );

    expect(shellSource).toContain('overflow-x: hidden;');
    expect(shellSource).toContain('width: var(--shell-overlay-panel-width);');
    expect(shellSource).toContain('width: var(--shell-drawer-panel-width);');
    expect(explorerSource).toContain('overflow-x: hidden;');
    expect(explorerSource).toContain('touch-action: pan-y;');
  });

  it('keeps mobile navigation and Leaflet layout bounded without relying on horizontal scroll', () => {
    const topbarSource = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/topbar/topbar.component.scss'),
      'utf8'
    );
    const leafletSource = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/leaflet-map/leaflet-map.component.scss'
      ),
      'utf8'
    );

    expect(topbarSource).toContain('.breadcrumbs-mobile {');
    expect(topbarSource).not.toContain('overflow-x: auto;');
    expect(leafletSource).toContain('max-inline-size: 100%;');
    expect(leafletSource).toContain('--leaflet-control-size-touch: 44px;');
    expect(leafletSource).toContain('max-height: min(58vh, 18rem);');
  });
});
