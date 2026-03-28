import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Leaflet style regressions', () => {
  it('does not override Leaflet-managed transforms on image overlays', () => {
    const repoRoot = process.cwd();
    const source = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/leaflet-map/leaflet-map.component.scss'
      ),
      'utf8'
    );

    expect(source).not.toMatch(/\.leaflet-image-layer\s*\{[\s\S]*transform\s*:/);
    expect(source).not.toMatch(/\.leaflet-image-layer\s*\{[\s\S]*transform-origin\s*:/);
    expect(source).not.toMatch(/\.leaflet-overlay-pane\s*\{[\s\S]*transform-origin\s*:/);
  });

  it('does not use the zero-height padding-bottom sizing hack for the map container', () => {
    const repoRoot = process.cwd();
    const source = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/leaflet-map/leaflet-map.component.scss'
      ),
      'utf8'
    );

    expect(source).not.toMatch(/height:\s*0\s*;/);
    expect(source).not.toMatch(/padding-bottom:\s*56\.25%/);
  });

  it('keeps a targeted reset that does not override Leaflet-managed image overlay sizing', () => {
    const repoRoot = process.cwd();
    const source = readFileSync(join(repoRoot, 'apps/site/src/styles.scss'), 'utf8');

    expect(source).toContain("@import 'leaflet.fullscreen/dist/Control.FullScreen.css';");
    expect(source).toContain('.leaflet-container .leaflet-marker-icon');
    expect(source).toContain('.leaflet-container img.leaflet-image-layer');
    expect(source).toContain('max-width: none !important;');
    expect(source).toContain('max-height: none !important;');
    expect(source).not.toMatch(
      /\.leaflet-container img\.leaflet-image-layer\s*\{[\s\S]*width:\s*auto\s*!important;/
    );
    expect(source).not.toMatch(
      /\.leaflet-container img\.leaflet-image-layer\s*\{[\s\S]*height:\s*auto\s*!important;/
    );
  });

  it('keeps embedded maps bounded on mobile without allowing horizontal overflow', () => {
    const repoRoot = process.cwd();
    const source = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/leaflet-map/leaflet-map.component.scss'
      ),
      'utf8'
    );

    expect(source).toContain('max-inline-size: 100%;');
    expect(source).toContain('min-height: clamp(12rem, 48vw, 15rem);');
    expect(source).toContain('max-height: min(58vh, 18rem);');
    expect(source).toContain('min-height: clamp(11.5rem, 52vw, 13.5rem);');
    expect(source).toContain('max-height: min(52vh, 16rem);');
    expect(source).toContain('min-height: 11rem;');
    expect(source).toContain('max-height: 13rem;');
    expect(source).not.toContain('width: 46px !important;');
    expect(source).not.toContain('height: 46px !important;');
  });

  it('keeps touch controls compact enough on mobile while preserving usability', () => {
    const repoRoot = process.cwd();
    const source = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/leaflet-map/leaflet-map.component.scss'
      ),
      'utf8'
    );

    expect(source).toContain('--leaflet-control-size-touch: 44px;');
    expect(source).toContain('--leaflet-control-hit-area: var(--leaflet-control-size);');
    expect(source).toContain('min-width: var(--leaflet-control-hit-area);');
    expect(source).toContain('min-height: var(--leaflet-control-hit-area);');
    expect(source).toContain('--leaflet-control-size: var(--leaflet-control-size-touch);');
    expect(source).toContain('--leaflet-control-hit-area: var(--leaflet-control-size-touch);');
    expect(source).toContain('--leaflet-close-hit-area: 44px;');
    expect(source).not.toContain('width: 40px !important;');
    expect(source).not.toContain('width: 38px;');
  });
});
