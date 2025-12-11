import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { DetectLeafletBlocksService } from '../../vault-parsing/services/detect-leaflet-blocks.service';

class NoopLogger implements LoggerPort {
  private _level: any = 0;
  set level(level: any) {
    this._level = level;
  }
  get level() {
    return this._level;
  }
  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('DetectLeafletBlocksService', () => {
  const logger = new NoopLogger();
  const service = new DetectLeafletBlocksService(logger);

  const createMockNote = (content: string): PublishableNote => ({
    noteId: 'test-note',
    title: 'Test Note',
    content,
    vaultPath: 'Test/test-note.md',
    relativePath: 'test-note.md',
    frontmatter: {
      flat: {},
      nested: {},
      tags: [],
    },
    folderConfig: {
      id: 'test-folder',
      vpsId: 'test-vps',
      vaultFolder: 'Test',
      routeBase: '/',
      ignoredCleanupRuleIds: [],
    },
    routing: {
      slug: 'test-note',
      path: '',
      routeBase: '/',
      fullPath: '/test-note',
    },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
  });

  describe('process', () => {
    it('should return notes unchanged when no leaflet blocks present', () => {
      const notes = [createMockNote('Simple content without leaflet blocks')];
      const result = service.process(notes);

      expect(result).toHaveLength(1);
      expect(result[0].leafletBlocks).toBeUndefined();
    });

    it('should detect simple leaflet block with required id', () => {
      const content = `
Some text before

\`\`\`leaflet
id: my-map
lat: 50.5
long: 30.5
\`\`\`

Some text after
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      expect(result).toHaveLength(1);
      expect(result[0].leafletBlocks).toBeDefined();
      expect(result[0].leafletBlocks).toHaveLength(1);

      const block = result[0].leafletBlocks![0];
      expect(block.id).toBe('my-map');
      expect(block.lat).toBe(50.5);
      expect(block.long).toBe(30.5);
    });

    it('should parse all standard leaflet properties', () => {
      const content = `
\`\`\`leaflet
id: full-map
height: 500px
width: 100%
lat: 48.8566
long: 2.3522
minZoom: 1
maxZoom: 18
defaultZoom: 10
unit: meters
darkMode: true
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      const block = result[0].leafletBlocks![0];
      expect(block.id).toBe('full-map');
      expect(block.height).toBe('500px');
      expect(block.width).toBe('100%');
      expect(block.lat).toBe(48.8566);
      expect(block.long).toBe(2.3522);
      expect(block.minZoom).toBe(1);
      expect(block.maxZoom).toBe(18);
      expect(block.defaultZoom).toBe(10);
      expect(block.unit).toBe('meters');
      expect(block.darkMode).toBe(true);
    });

    it('should parse markers with coordinates', () => {
      const content = `
\`\`\`leaflet
id: map-with-markers
marker: default, 48.8566, 2.3522
marker: custom, 51.5074, -0.1278, [[London Note]]
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      const block = result[0].leafletBlocks![0];
      expect(block.markers).toBeDefined();
      expect(block.markers).toHaveLength(2);

      expect(block.markers![0]).toEqual({
        type: 'default',
        lat: 48.8566,
        long: 2.3522,
        link: undefined,
      });

      expect(block.markers![1]).toEqual({
        type: 'custom',
        lat: 51.5074,
        long: -0.1278,
        link: 'London Note',
      });
    });

    it('should parse image overlays from wikilinks', () => {
      const content = `
\`\`\`leaflet
id: map-with-image
image: [[MyMap.png]]
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      const block = result[0].leafletBlocks![0];
      expect(block.imageOverlays).toBeDefined();
      expect(block.imageOverlays).toHaveLength(1);
      expect(block.imageOverlays![0].path).toBe('MyMap.png');
    });

    it('should parse multiple image overlays', () => {
      const content = `
\`\`\`leaflet
id: map-multi-images
image: [[Map1.png]], [[Map2.jpg]]
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      const block = result[0].leafletBlocks![0];
      expect(block.imageOverlays).toBeDefined();
      expect(block.imageOverlays).toHaveLength(2);
      expect(block.imageOverlays![0].path).toBe('Map1.png');
      expect(block.imageOverlays![1].path).toBe('Map2.jpg');
    });

    it('should parse tile server configuration', () => {
      const content = `
\`\`\`leaflet
id: map-custom-tiles
tileServer: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      const block = result[0].leafletBlocks![0];
      expect(block.tileServer).toBeDefined();
      expect(block.tileServer!.url).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    });

    it('should parse boolean darkMode values correctly', () => {
      const testCases = [
        { input: 'true', expected: true },
        { input: 'false', expected: false },
        { input: 'yes', expected: true },
        { input: 'no', expected: false },
        { input: '1', expected: true },
        { input: '0', expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const content = `\`\`\`leaflet\nid: test\ndarkMode: ${input}\n\`\`\``;
        const notes = [createMockNote(content)];
        const result = service.process(notes);

        expect(result[0].leafletBlocks![0].darkMode).toBe(expected);
      });
    });

    it('should handle multiple leaflet blocks in same note', () => {
      const content = `
First block:
\`\`\`leaflet
id: map-1
lat: 40.0
long: -70.0
\`\`\`

Second block:
\`\`\`leaflet
id: map-2
lat: 50.0
long: -80.0
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      expect(result[0].leafletBlocks).toHaveLength(2);
      expect(result[0].leafletBlocks![0].id).toBe('map-1');
      expect(result[0].leafletBlocks![1].id).toBe('map-2');
    });

    it('should skip blocks without required id property', () => {
      const content = `
\`\`\`leaflet
lat: 50.5
long: 30.5
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      // Block should be skipped due to missing id
      expect(result[0].leafletBlocks).toBeUndefined();
    });

    it('should ignore comment lines starting with #', () => {
      const content = `
\`\`\`leaflet
# This is a comment
id: commented-map
# Another comment
lat: 45.0
long: 5.0
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      const block = result[0].leafletBlocks![0];
      expect(block.id).toBe('commented-map');
      expect(block.lat).toBe(45.0);
      expect(block.long).toBe(5.0);
    });

    it('should process multiple notes with leaflet blocks', () => {
      const note1 = createMockNote(`\`\`\`leaflet\nid: map-1\n\`\`\``);
      const note2 = createMockNote(`\`\`\`leaflet\nid: map-2\n\`\`\``);
      const note3 = createMockNote('No leaflet block here');

      const result = service.process([note1, note2, note3]);

      expect(result[0].leafletBlocks).toHaveLength(1);
      expect(result[0].leafletBlocks![0].id).toBe('map-1');
      expect(result[1].leafletBlocks).toHaveLength(1);
      expect(result[1].leafletBlocks![0].id).toBe('map-2');
      expect(result[2].leafletBlocks).toBeUndefined();
    });

    it('should store raw content for debugging', () => {
      const rawContent = 'id: test-map\nlat: 10.0\nlong: 20.0';
      const content = `\`\`\`leaflet\n${rawContent}\n\`\`\``;
      const notes = [createMockNote(content)];
      const result = service.process(notes);

      expect(result[0].leafletBlocks![0].rawContent).toBe(rawContent);
    });

    it('should handle lon as alias for long', () => {
      const content = `
\`\`\`leaflet
id: test-lon
lat: 40.0
lon: -70.0
\`\`\`
`;

      const notes = [createMockNote(content)];
      const result = service.process(notes);

      const block = result[0].leafletBlocks![0];
      expect(block.long).toBe(-70.0);
    });
  });
});
