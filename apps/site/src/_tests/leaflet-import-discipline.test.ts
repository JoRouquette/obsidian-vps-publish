import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Leaflet import discipline', () => {
  const repoRoot = process.cwd();

  it.each([
    [
      'apps/site/src/presentation/components/leaflet-map/leaflet-map.component.ts',
      ['@core-domain/entities/leaflet-block', '@core-domain/entities/leaflet-image-overlay'],
    ],
    [
      'apps/site/src/presentation/services/leaflet-injection.service.ts',
      ['@core-domain/entities/leaflet-block'],
    ],
    [
      'apps/site/src/presentation/pages/viewer/viewer.component.ts',
      ['@core-domain/entities/leaflet-block'],
    ],
    [
      'apps/site/src/presentation/pages/home/home.component.ts',
      ['@core-domain/entities/leaflet-block', '@core-domain/entities/manifest-page'],
    ],
    [
      'apps/obsidian-vps-publish/src/main.ts',
      ['@core-application/vault-parsing/services/detect-leaflet-blocks.service'],
    ],
  ])('does not use deep imports in %s', (relativePath, disallowedImports) => {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8');

    disallowedImports.forEach((disallowedImport) => {
      expect(source).not.toContain(disallowedImport);
    });
  });
});
