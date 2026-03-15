/**
 * Tests for asset path replacement logic in SessionFinalizerService.
 *
 * These tests verify that when images are optimized (e.g., .png → .webp),
 * the paths are correctly replaced in:
 * - HTML attributes (src, href, data-src)
 * - Leaflet JSON blocks (data-leaflet-block)
 * - Manifest pages (coverImage, leafletBlocks.imageOverlays.path)
 */
import type { LeafletBlock, LoggerPort, Manifest, ManifestPage } from '@core-domain';
import { LogLevel } from '@core-domain';

import { SessionFinalizerService } from '../infra/sessions/session-finalizer.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface LogCall {
  level: 'warn' | 'info' | 'error' | 'debug';
  message: string;
  meta?: Record<string, unknown>;
}

function createFakeLogger(): LoggerPort & { calls: LogCall[] } {
  const calls: LogCall[] = [];
  let currentLevel: LogLevel = LogLevel.debug;
  const logger: LoggerPort & { calls: LogCall[] } = {
    calls,
    set level(l: LogLevel) {
      currentLevel = l;
    },
    get level(): LogLevel {
      return currentLevel;
    },
    child() {
      return logger;
    },
    debug(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'debug', message, meta });
    },
    info(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'info', message, meta });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'warn', message, meta });
    },
    error(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'error', message, meta });
    },
  };
  return logger;
}

/**
 * Build a minimal SessionFinalizerService and return bound references
 * to its private asset path replacement methods.
 */
function getAssetPathReplacementFns(): {
  replaceAssetPathsInLeafletBlocks: (
    html: string,
    mappings: Record<string, string>,
    log: LoggerPort
  ) => { content: string; modified: boolean };
  replaceAssetPathsInManifestPages: (
    manifest: Manifest,
    mappings: Record<string, string>,
    log: LoggerPort
  ) => {
    modified: boolean;
    pagesModified: number;
    coverImagesUpdated: number;
    leafletOverlaysUpdated: number;
  };
  replaceAssetPath: (assetPath: string, mappings: Record<string, string>) => string;
} {
  const service = new (SessionFinalizerService as any)(
    null, // notesStorage
    null, // stagingManager
    null, // markdownRenderer
    null, // contentStorage factory
    null, // manifestStorage factory
    null // sessionRepository
  ) as SessionFinalizerService;

  return {
    replaceAssetPathsInLeafletBlocks: (service as any)['replaceAssetPathsInLeafletBlocks'].bind(
      service
    ),
    replaceAssetPathsInManifestPages: (service as any)['replaceAssetPathsInManifestPages'].bind(
      service
    ),
    replaceAssetPath: (service as any)['replaceAssetPath'].bind(service),
  };
}

function createManifestPage(overrides: Partial<ManifestPage> = {}): ManifestPage {
  return {
    id: 'test-id',
    title: 'Test Page',
    slug: { value: 'test-page' },
    route: '/test-page',
    publishedAt: new Date(),
    ...overrides,
  };
}

function createManifest(pages: ManifestPage[]): Manifest {
  return {
    sessionId: 'test-session',
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    pages,
  };
}

// ---------------------------------------------------------------------------
// Tests: replaceAssetPath (core path replacement logic)
// ---------------------------------------------------------------------------

describe('SessionFinalizerService.replaceAssetPath', () => {
  const { replaceAssetPath } = getAssetPathReplacementFns();

  const mappings = {
    'image.png': 'image.webp',
    'photo.jpg': 'photo.webp',
    '_assets/Ektaron.png': '_assets/Ektaron.webp',
  };

  it('should replace exact filename match', () => {
    expect(replaceAssetPath('image.png', mappings)).toBe('image.webp');
  });

  it('should replace path ending with filename', () => {
    expect(replaceAssetPath('/assets/image.png', mappings)).toBe('/assets/image.webp');
  });

  it('should replace path with nested folder', () => {
    expect(replaceAssetPath('/assets/_assets/Ektaron.png', mappings)).toBe(
      '/assets/_assets/Ektaron.webp'
    );
  });

  it('should return original path when no match', () => {
    expect(replaceAssetPath('/assets/other.gif', mappings)).toBe('/assets/other.gif');
  });

  it('should handle absolute URLs (no replacement)', () => {
    expect(replaceAssetPath('https://example.com/image.png', mappings)).toBe(
      'https://example.com/image.png'
    );
  });

  it('should replace path containing the original filename', () => {
    expect(replaceAssetPath('/content/assets/photo.jpg', mappings)).toBe(
      '/content/assets/photo.webp'
    );
  });

  // Basename matching tests - when path structures differ
  it('should replace using basename when path structures differ', () => {
    // Mapping has _assets/ but path has /assets/ (no underscore)
    expect(replaceAssetPath('/assets/Ektaron.png', mappings)).toBe('/assets/Ektaron.webp');
  });

  it('should replace using basename for wikilink-style image paths', () => {
    const wikiMappings = {
      '_assets/BrocheCameleon.png': '_assets/BrocheCameleon.webp',
    };
    // The HTML might have /assets/BrocheCameleon.png (different folder)
    expect(replaceAssetPath('/assets/BrocheCameleon.png', wikiMappings)).toBe(
      '/assets/BrocheCameleon.webp'
    );
  });

  it('should replace using basename for deeply nested paths', () => {
    const nestedMappings = {
      'folder/subfolder/deep-image.jpg': 'folder/subfolder/deep-image.webp',
    };
    // The HTML path structure is completely different
    expect(replaceAssetPath('/assets/deep-image.jpg', nestedMappings)).toBe(
      '/assets/deep-image.webp'
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: replaceAssetPathsInLeafletBlocks (HTML JSON replacement)
// ---------------------------------------------------------------------------

describe('SessionFinalizerService.replaceAssetPathsInLeafletBlocks', () => {
  const { replaceAssetPathsInLeafletBlocks } = getAssetPathReplacementFns();

  const mappings = {
    'Ektaron.png': 'Ektaron.webp',
    'map-overlay.jpg': 'map-overlay.webp',
  };

  it('should replace image overlay path in Leaflet block JSON', () => {
    const leafletBlock = {
      id: 'map-1',
      lat: 50,
      long: 30,
      imageOverlays: [
        {
          path: '/assets/Ektaron.png',
          topLeft: [100, 0],
          bottomRight: [0, 100],
        },
      ],
    };
    const html = `<div data-leaflet-block='${JSON.stringify(leafletBlock)}'></div>`;

    const result = replaceAssetPathsInLeafletBlocks(html, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    // Cheerio HTML-encodes the JSON, so check for encoded path
    expect(result.content).toContain('Ektaron.webp');
    expect(result.content).not.toContain('Ektaron.png');
  });

  it('should replace multiple image overlays in same block', () => {
    const leafletBlock = {
      id: 'map-multi',
      imageOverlays: [
        { path: '/assets/Ektaron.png', topLeft: [0, 0], bottomRight: [100, 100] },
        { path: '/assets/map-overlay.jpg', topLeft: [0, 0], bottomRight: [50, 50] },
      ],
    };
    const html = `<div data-leaflet-block='${JSON.stringify(leafletBlock)}'></div>`;

    const result = replaceAssetPathsInLeafletBlocks(html, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    // Cheerio HTML-encodes the JSON, so check for encoded paths
    expect(result.content).toContain('Ektaron.webp');
    expect(result.content).toContain('map-overlay.webp');
    expect(result.content).not.toContain('Ektaron.png');
    expect(result.content).not.toContain('map-overlay.jpg');
  });

  it('should handle multiple Leaflet blocks in same HTML', () => {
    const block1 = {
      id: 'map-1',
      imageOverlays: [{ path: 'Ektaron.png', topLeft: [0, 0], bottomRight: [1, 1] }],
    };
    const block2 = {
      id: 'map-2',
      imageOverlays: [{ path: 'map-overlay.jpg', topLeft: [0, 0], bottomRight: [1, 1] }],
    };
    const html = `
      <div data-leaflet-block='${JSON.stringify(block1)}'></div>
      <p>Some content</p>
      <div data-leaflet-block='${JSON.stringify(block2)}'></div>
    `;

    const result = replaceAssetPathsInLeafletBlocks(html, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.content).toContain('Ektaron.webp');
    expect(result.content).toContain('map-overlay.webp');
  });

  it('should return unmodified if no Leaflet blocks present', () => {
    const html = '<div><p>No leaflet here</p></div>';

    const result = replaceAssetPathsInLeafletBlocks(html, mappings, createFakeLogger());

    expect(result.modified).toBe(false);
    expect(result.content).toBe(html);
  });

  it('should return unmodified if no matching paths in Leaflet blocks', () => {
    const leafletBlock = {
      id: 'map-1',
      imageOverlays: [{ path: '/assets/other-image.gif', topLeft: [0, 0], bottomRight: [1, 1] }],
    };
    const html = `<div data-leaflet-block='${JSON.stringify(leafletBlock)}'></div>`;

    const result = replaceAssetPathsInLeafletBlocks(html, mappings, createFakeLogger());

    expect(result.modified).toBe(false);
  });

  it('should handle Leaflet blocks without imageOverlays', () => {
    const leafletBlock = {
      id: 'simple-map',
      lat: 48.8566,
      long: 2.3522,
      defaultZoom: 13,
    };
    const html = `<div data-leaflet-block='${JSON.stringify(leafletBlock)}'></div>`;

    const result = replaceAssetPathsInLeafletBlocks(html, mappings, createFakeLogger());

    expect(result.modified).toBe(false);
    expect(result.content).toContain('simple-map');
  });

  // Basename matching tests - when path structures differ
  it('should replace using basename when path structures differ in Leaflet', () => {
    // Mapping has _assets/ prefix but overlay path is /assets/ (different folder)
    const basenameMapping = {
      '_assets/WorldMap.png': '_assets/WorldMap.webp',
    };
    const leafletBlock = {
      id: 'map-basename',
      imageOverlays: [{ path: '/assets/WorldMap.png', topLeft: [0, 0], bottomRight: [100, 100] }],
    };
    const html = `<div data-leaflet-block='${JSON.stringify(leafletBlock)}'></div>`;

    const result = replaceAssetPathsInLeafletBlocks(html, basenameMapping, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.content).toContain('WorldMap.webp');
    expect(result.content).not.toContain('WorldMap.png');
  });

  it('should replace wikilink-style image paths in Leaflet using basename', () => {
    // Real-world scenario: vault has _assets/BrocheCameleon.png
    // but HTML references /assets/BrocheCameleon.png
    const wikiMapping = {
      '_assets/BrocheCameleon.png': '_assets/BrocheCameleon.webp',
    };
    const leafletBlock = {
      id: 'map-wikilink',
      imageOverlays: [
        { path: '/assets/BrocheCameleon.png', topLeft: [0, 0], bottomRight: [100, 100] },
      ],
    };
    const html = `<div data-leaflet-block='${JSON.stringify(leafletBlock)}'></div>`;

    const result = replaceAssetPathsInLeafletBlocks(html, wikiMapping, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.content).toContain('BrocheCameleon.webp');
    expect(result.content).not.toContain('BrocheCameleon.png');
  });
});

// ---------------------------------------------------------------------------
// Tests: replaceAssetPathsInManifestPages (manifest page path replacement)
// ---------------------------------------------------------------------------

describe('SessionFinalizerService.replaceAssetPathsInManifestPages', () => {
  const { replaceAssetPathsInManifestPages } = getAssetPathReplacementFns();

  const mappings = {
    'cover.png': 'cover.webp',
    'Ektaron.png': 'Ektaron.webp',
    'map-image.jpg': 'map-image.webp',
  };

  it('should replace coverImage path in manifest page', () => {
    const page = createManifestPage({ coverImage: '/assets/cover.png' });
    const manifest = createManifest([page]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.coverImagesUpdated).toBe(1);
    expect(manifest.pages[0].coverImage).toBe('/assets/cover.webp');
  });

  it('should replace leafletBlocks imageOverlay paths in manifest page', () => {
    const leafletBlock: LeafletBlock = {
      id: 'map-1',
      imageOverlays: [{ path: '/assets/Ektaron.png', topLeft: [0, 0], bottomRight: [100, 100] }],
    };
    const page = createManifestPage({ leafletBlocks: [leafletBlock] });
    const manifest = createManifest([page]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.leafletOverlaysUpdated).toBe(1);
    expect((manifest.pages[0].leafletBlocks![0] as LeafletBlock).imageOverlays![0].path).toBe(
      '/assets/Ektaron.webp'
    );
  });

  it('should replace both coverImage and leafletBlocks paths', () => {
    const leafletBlock: LeafletBlock = {
      id: 'map-1',
      imageOverlays: [{ path: '/assets/map-image.jpg', topLeft: [0, 0], bottomRight: [1, 1] }],
    };
    const page = createManifestPage({
      coverImage: '/assets/cover.png',
      leafletBlocks: [leafletBlock],
    });
    const manifest = createManifest([page]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.pagesModified).toBe(1);
    expect(result.coverImagesUpdated).toBe(1);
    expect(result.leafletOverlaysUpdated).toBe(1);
    expect(manifest.pages[0].coverImage).toBe('/assets/cover.webp');
    expect((manifest.pages[0].leafletBlocks![0] as LeafletBlock).imageOverlays![0].path).toBe(
      '/assets/map-image.webp'
    );
  });

  it('should handle multiple pages with different asset paths', () => {
    const page1 = createManifestPage({
      id: 'page-1',
      route: '/page-1',
      coverImage: '/assets/cover.png',
    });
    const leafletBlock: LeafletBlock = {
      id: 'map-2',
      imageOverlays: [{ path: '/assets/Ektaron.png', topLeft: [0, 0], bottomRight: [1, 1] }],
    };
    const page2 = createManifestPage({
      id: 'page-2',
      route: '/page-2',
      leafletBlocks: [leafletBlock],
    });
    const manifest = createManifest([page1, page2]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.pagesModified).toBe(2);
    expect(result.coverImagesUpdated).toBe(1);
    expect(result.leafletOverlaysUpdated).toBe(1);
  });

  it('should return unmodified when no matching paths', () => {
    const page = createManifestPage({
      coverImage: '/assets/unrelated.gif',
    });
    const manifest = createManifest([page]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(false);
    expect(result.pagesModified).toBe(0);
  });

  it('should handle pages without coverImage or leafletBlocks', () => {
    const page = createManifestPage({});
    const manifest = createManifest([page]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(false);
    expect(result.pagesModified).toBe(0);
  });

  it('should handle leafletBlocks without imageOverlays', () => {
    const leafletBlock: LeafletBlock = {
      id: 'simple-map',
      lat: 48.8566,
      long: 2.3522,
    };
    const page = createManifestPage({ leafletBlocks: [leafletBlock] });
    const manifest = createManifest([page]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(false);
  });

  it('should handle multiple image overlays in one block', () => {
    const leafletBlock: LeafletBlock = {
      id: 'multi-overlay',
      imageOverlays: [
        { path: '/assets/Ektaron.png', topLeft: [0, 0], bottomRight: [1, 1] },
        { path: '/assets/map-image.jpg', topLeft: [0, 0], bottomRight: [2, 2] },
        { path: '/assets/unmatched.gif', topLeft: [0, 0], bottomRight: [3, 3] },
      ],
    };
    const page = createManifestPage({ leafletBlocks: [leafletBlock] });
    const manifest = createManifest([page]);

    const result = replaceAssetPathsInManifestPages(manifest, mappings, createFakeLogger());

    expect(result.modified).toBe(true);
    expect(result.leafletOverlaysUpdated).toBe(2);

    const overlays = (manifest.pages[0].leafletBlocks![0] as LeafletBlock).imageOverlays!;
    expect(overlays[0].path).toBe('/assets/Ektaron.webp');
    expect(overlays[1].path).toBe('/assets/map-image.webp');
    expect(overlays[2].path).toBe('/assets/unmatched.gif'); // unchanged
  });
});
