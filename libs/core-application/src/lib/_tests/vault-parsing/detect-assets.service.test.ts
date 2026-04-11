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

  it('detects assets from a rendered content override without mutating the note content', () => {
    const noteWithInlineDataview: PublishableNote = {
      ...note,
      content: 'Resolved asset: `= this.cover`',
      frontmatter: { flat: {}, nested: { cover: '![[cover.png]]' }, tags: [] },
    };

    const assets = service.detectForContentOverride(
      noteWithInlineDataview,
      'Resolved asset: ![[rendered-cover.png]]'
    );

    expect(noteWithInlineDataview.content).toBe('Resolved asset: `= this.cover`');
    expect(assets.map((asset) => asset.target)).toEqual(
      expect.arrayContaining(['rendered-cover.png', 'cover.png'])
    );
  });

  it('detects markdown image syntax in rendered content overrides', () => {
    const assets = service.detectForContentOverride(
      note,
      'Rendered image: ![Cover](images/rendered-cover.png)'
    );

    expect(assets.some((asset) => asset.target === 'images/rendered-cover.png')).toBe(true);
    expect(assets.find((asset) => asset.target === 'images/rendered-cover.png')?.sourceSyntax).toBe(
      'markdown-image'
    );
  });

  it('detects html image refs and ignores non-exportable icon runtime markup', () => {
    const assets = service.detectForContentOverride(
      note,
      `
        <div class="dataviewjs">
          <img src="images/rendered-cover.png" alt="cover">
          <img data-src="/assets/gallery/second.png" alt="second">
          <svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"></path></svg>
          <span class="lucide lucide-star" data-icon="star"></span>
          <img src="https://example.com/remote.png" alt="remote">
        </div>
      `
    );

    const htmlAssets = assets.filter((asset) => asset.sourceSyntax === 'html-ref');
    expect(htmlAssets.map((asset) => asset.target)).toEqual(
      expect.arrayContaining(['images/rendered-cover.png', 'gallery/second.png'])
    );
    expect(htmlAssets.some((asset) => asset.target === 'remote.png')).toBe(false);
  });

  it('returns no content assets when rendered content has no local asset reference', () => {
    const assets = service.detectForContentOverride(
      {
        ...note,
        content: 'No assets',
        frontmatter: { flat: {}, nested: {}, tags: [] },
      },
      '<div><span class="icon">⭐</span><svg><path d="M0 0"></path></svg></div>'
    );

    expect(assets).toEqual([]);
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
