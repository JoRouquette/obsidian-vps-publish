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
    const projectJson = JSON.parse(readFileSync(join(repoRoot, 'apps/site/project.json'), 'utf8'));

    // Leaflet CSS imports are loaded via the styles[] array in project.json (not @import in styles.scss)
    const stylesArray: string[] = projectJson?.targets?.build?.options?.styles ?? [];
    expect(stylesArray).toContain('node_modules/leaflet.fullscreen/dist/Control.FullScreen.css');

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
});
