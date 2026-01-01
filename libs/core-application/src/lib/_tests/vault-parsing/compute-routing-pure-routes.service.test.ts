import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { ComputeRoutingService } from '../../vault-parsing/services/compute-routing.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('ComputeRoutingService - Pure Route Nodes', () => {
  const logger = new NoopLogger();
  const service = new ComputeRoutingService(logger);

  const basePureRouteNote = {
    noteId: '1',
    title: 'Guide',
    vaultPath: 'MyGuides/getting-started.md',
    relativePath: 'MyGuides/getting-started.md', // From customIndexFile
    content: 'c',
    frontmatter: { flat: {}, nested: {}, tags: [] },
    folderConfig: {
      id: 'pure-route-1',
      vaultFolder: '', // Pure route - no vaultFolder
      routeBase: '/guides', // Route segment
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
    routing: { slug: '', path: '', routeBase: '', fullPath: '' },
  } as PublishableNote;

  it('should compute routing for pure route node with customIndexFile', () => {
    const [note] = service.process([basePureRouteNote]);

    expect(note.routing.slug).toBe('gettingstarted'); // Slugified
    expect(note.routing.routeBase).toBe('/guides');
    // Pure route: file treated as child of route
    expect(note.routing.fullPath).toBe('/guides/myguides/gettingstarted');
  });

  it('should compute routing for pure route node with additionalFile marker', () => {
    const additionalFileNote = {
      ...basePureRouteNote,
      noteId: '2',
      relativePath: '__additional__/overview.md', // Marked as additional file
    } as PublishableNote;

    const [note] = service.process([additionalFileNote]);

    expect(note.routing.slug).toBe('overview');
    expect(note.routing.path).toBe(''); // Additional files are forced to root
    expect(note.routing.fullPath).toBe('/guides/overview');
  });

  it('should compute routing for nested pure route nodes', () => {
    const nestedPureRouteNote = {
      ...basePureRouteNote,
      noteId: '3',
      relativePath: 'API/endpoints.md',
      folderConfig: {
        id: 'pure-route-2',
        vaultFolder: '',
        routeBase: '/guides/api', // Nested pure route
        vpsId: 'vps',
        ignoredCleanupRuleIds: [],
      },
    } as PublishableNote;

    const [note] = service.process([nestedPureRouteNote]);

    expect(note.routing.slug).toBe('endpoints');
    expect(note.routing.routeBase).toBe('/guides/api');
    expect(note.routing.fullPath).toBe('/guides/api/api/endpoints');
  });

  it('should handle pure route node with flattenTree', () => {
    const flattenedNote = {
      ...basePureRouteNote,
      noteId: '4',
      relativePath: 'Deep/Nested/Path/file.md',
      folderConfig: {
        ...basePureRouteNote.folderConfig,
        flattenTree: true,
      },
    } as PublishableNote;

    const [note] = service.process([flattenedNote]);

    expect(note.routing.slug).toBe('file');
    expect(note.routing.path).toBe(''); // Flattened
    expect(note.routing.fullPath).toBe('/guides/file');
  });

  it('should differentiate between folder-based and pure routes with same routeBase', () => {
    const folderBasedNote = {
      ...basePureRouteNote,
      noteId: '5',
      relativePath: 'subfolder/note1.md',
      folderConfig: {
        id: 'folder-route-1',
        vaultFolder: 'Documentation', // Has vaultFolder
        routeBase: '/docs',
        vpsId: 'vps',
        ignoredCleanupRuleIds: [],
      },
    } as PublishableNote;

    const pureRouteNote = {
      ...basePureRouteNote,
      noteId: '6',
      relativePath: 'Other/note2.md',
      folderConfig: {
        id: 'pure-route-3',
        vaultFolder: '', // Pure route
        routeBase: '/docs',
        vpsId: 'vps',
        ignoredCleanupRuleIds: [],
      },
    } as PublishableNote;

    const [note1, note2] = service.process([folderBasedNote, pureRouteNote]);

    // Folder-based: normal routing
    expect(note1.routing.fullPath).toBe('/docs/subfolder/note1');

    // Pure route: file path included
    expect(note2.routing.fullPath).toBe('/docs/other/note2');
  });

  it('should detect slug collisions within pure route nodes with flattenTree', () => {
    const note1 = {
      ...basePureRouteNote,
      noteId: '7',
      relativePath: 'Folder1/duplicate.md',
      folderConfig: {
        ...basePureRouteNote.folderConfig,
        flattenTree: true,
      },
    } as PublishableNote;

    const note2 = {
      ...basePureRouteNote,
      noteId: '8',
      relativePath: 'Folder2/duplicate.md',
      folderConfig: {
        ...basePureRouteNote.folderConfig,
        flattenTree: true,
      },
    } as PublishableNote;

    // Both notes have same filename in flattened folder
    expect(() => service.process([note1, note2])).toThrow(/Slug collision detected/);
  });
});
