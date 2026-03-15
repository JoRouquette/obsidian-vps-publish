import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { DetectAssetsService } from '../../vault-parsing/services/detect-assets.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('DetectAssetsService', () => {
  const logger = new NoopLogger();
  const service = new DetectAssetsService(logger);

  const note = {
    noteId: '1',
    title: 'A',
    vaultPath: 'Vault/A.md',
    relativePath: 'A.md',
    content: 'Image ![[img.png|center]] and pdf ![[doc.pdf]]',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'f',
      vaultFolder: 'Vault',
      routeBase: '/blog',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
    routing: { slug: '', path: '', routeBase: '', fullPath: '' },
  } as PublishableNote;

  it('detects assets with kind and display options', () => {
    const [withAssets] = service.process([note]);
    expect(withAssets.assets?.length).toBe(2);
    expect(withAssets.assets?.[0].origin).toBe('content');
    expect(withAssets.assets?.[0].kind).toBe('image');
    expect(withAssets.assets?.[0].display?.alignment).toBe('center');
    expect(withAssets.assets?.[1].kind).toBe('pdf');
    expect(withAssets.assets?.[0].target).toBe('img.png');
  });

  it('detects assets declared in frontmatter', () => {
    const withFrontmatter: PublishableNote = {
      ...note,
      content: 'No embeds here',
      frontmatter: { flat: {}, nested: { cover: '![[cover.png]]' }, tags: [] },
    };

    const [result] = service.process([withFrontmatter]);

    expect(result.assets?.length).toBe(1);
    expect(result.assets?.[0].origin).toBe('frontmatter');
    expect(result.assets?.[0].frontmatterPath).toBe('cover');
    expect(result.assets?.[0].target).toBe('cover.png');
  });

  it('detects assets from Leaflet block imageOverlays', () => {
    const noteWithLeaflet: PublishableNote = {
      ...note,
      content: 'A map will be here',
      leafletBlocks: [
        {
          id: 'my-map',
          height: '500px',
          imageOverlays: [
            {
              path: 'MyFantasyMap.png',
              topLeft: [0, 0],
              bottomRight: [100, 100],
            },
            {
              path: 'subfolder/AnotherMap.jpg',
              topLeft: [0, 0],
              bottomRight: [50, 50],
            },
          ],
        },
      ],
    };

    const [result] = service.process([noteWithLeaflet]);

    expect(result.assets?.length).toBe(2);

    // First Leaflet asset
    expect(result.assets?.[0].target).toBe('MyFantasyMap.png');
    expect(result.assets?.[0].kind).toBe('image');
    expect(result.assets?.[0].origin).toBe('content');
    expect(result.assets?.[0].raw).toBe('![[MyFantasyMap.png]]');

    // Second Leaflet asset (with subfolder)
    expect(result.assets?.[1].target).toBe('subfolder/AnotherMap.jpg');
    expect(result.assets?.[1].kind).toBe('image');
    expect(result.assets?.[1].origin).toBe('content');
  });

  it('combines content, frontmatter, and Leaflet assets', () => {
    const noteWithAll: PublishableNote = {
      ...note,
      content: 'Image ![[content-image.png]]',
      frontmatter: { flat: {}, nested: { cover: '![[cover.png]]' }, tags: [] },
      leafletBlocks: [
        {
          id: 'combined-map',
          imageOverlays: [{ path: 'map.png', topLeft: [0, 0], bottomRight: [100, 100] }],
        },
      ],
    };

    const [result] = service.process([noteWithAll]);

    expect(result.assets?.length).toBe(3);

    const targets = result.assets?.map((a) => a.target) ?? [];
    expect(targets).toContain('content-image.png');
    expect(targets).toContain('cover.png');
    expect(targets).toContain('map.png');
  });

  it('skips Leaflet blocks without imageOverlays', () => {
    const noteWithEmptyLeaflet: PublishableNote = {
      ...note,
      content: 'A marker-only map',
      leafletBlocks: [
        {
          id: 'markers-only-map',
          markers: [{ lat: 48.8, long: 2.3, type: 'default' }],
          // No imageOverlays
        },
      ],
    };

    const [result] = service.process([noteWithEmptyLeaflet]);

    // Should have no assets from Leaflet blocks (note content has no embeds either)
    expect(result.assets?.length).toBe(0);
  });

  it('integration: detects Leaflet asset from real Ektaron.md block format', () => {
    // This test replicates the exact structure from test-vault/Ektaron/Ektaron.md
    // The issue: Leaflet block with `image: [[Ektaron.png]]` should detect the asset

    // First, simulate what DetectLeafletBlocksService produces
    const noteWithRealLeafletBlock: PublishableNote = {
      ...note,
      vaultPath: 'Ektaron/Ektaron.md',
      content: `## Carte

<div class="leaflet-map-placeholder" data-leaflet-map-id="Ektaron-map"></div>
<small style="font-style: italic">1 jour de voyage à cheval = 8h = 5 hexagones = 50 km</small>`,
      leafletBlocks: [
        {
          id: 'Ektaron-map',
          defaultZoom: 6,
          scale: 1365,
          unit: 'km',
          height: '700px',
          imageOverlays: [
            {
              path: 'Ektaron.png',
              topLeft: [0, 0],
              bottomRight: [0, 0],
            },
          ],
        },
      ],
    };

    const [result] = service.process([noteWithRealLeafletBlock]);

    // The asset MUST be detected
    expect(result.assets).toBeDefined();
    expect(result.assets?.length).toBe(1);
    expect(result.assets?.[0].target).toBe('Ektaron.png');
    expect(result.assets?.[0].kind).toBe('image');
    expect(result.assets?.[0].origin).toBe('content');
    expect(result.assets?.[0].raw).toBe('![[Ektaron.png]]');
  });
});
