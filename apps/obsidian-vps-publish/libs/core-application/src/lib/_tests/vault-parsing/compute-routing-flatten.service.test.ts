import type { FolderConfig, LoggerPort } from '@core-domain';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import { LogLevel } from '@core-domain/enums/logger-level.enum';

import { ComputeRoutingService } from '../../vault-parsing/services/compute-routing.service';

const mockLogger: LoggerPort = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn().mockReturnThis(),
  get level(): LogLevel {
    return LogLevel.info;
  },
  set level(_level: LogLevel) {
    // noop
  },
};

describe('ComputeRoutingService - flattenTree', () => {
  let service: ComputeRoutingService;
  let baseFolderConfig: FolderConfig;

  beforeEach(() => {
    service = new ComputeRoutingService(mockLogger);
    baseFolderConfig = {
      id: 'folder-1',
      vpsId: 'vps-1',
      vaultFolder: 'Flore',
      routeBase: '/le-vivant/flore',
      ignoredCleanupRuleIds: [],
      flattenTree: false, // Default: preserve structure
    };
    jest.clearAllMocks();
  });

  it('should preserve subfolder structure when flattenTree is false (default)', () => {
    const notes: PublishableNote[] = [
      createNote('Angiospermes/Arbres/Chene.md', baseFolderConfig),
      createNote('Angiospermes/Arbres/Erable.md', baseFolderConfig),
      createNote('Angiospermes/Fleurs/Rose.md', baseFolderConfig),
    ];

    const routed = service.process(notes);

    expect(routed[0].routing.fullPath).toBe('/le-vivant/flore/angiospermes/arbres/chene');
    expect(routed[1].routing.fullPath).toBe('/le-vivant/flore/angiospermes/arbres/erable');
    expect(routed[2].routing.fullPath).toBe('/le-vivant/flore/angiospermes/fleurs/rose');

    expect(routed[0].routing.path).toBe('angiospermes/arbres');
    expect(routed[1].routing.path).toBe('angiospermes/arbres');
    expect(routed[2].routing.path).toBe('angiospermes/fleurs');
  });

  it('should flatten tree when flattenTree is true', () => {
    const flattenedConfig: FolderConfig = {
      ...baseFolderConfig,
      flattenTree: true,
    };

    const notes: PublishableNote[] = [
      createNote('Angiospermes/Arbres/Chene.md', flattenedConfig),
      createNote('Angiospermes/Arbres/Erable.md', flattenedConfig),
      createNote('Angiospermes/Fleurs/Rose.md', flattenedConfig),
      createNote('Gymnospermes/Pin.md', flattenedConfig),
      createNote('TopLevel.md', flattenedConfig),
    ];

    const routed = service.process(notes);

    // All notes should be at the root level (no subfolder segments)
    expect(routed[0].routing.fullPath).toBe('/le-vivant/flore/chene');
    expect(routed[1].routing.fullPath).toBe('/le-vivant/flore/erable');
    expect(routed[2].routing.fullPath).toBe('/le-vivant/flore/rose');
    expect(routed[3].routing.fullPath).toBe('/le-vivant/flore/pin');
    expect(routed[4].routing.fullPath).toBe('/le-vivant/flore/toplevel');

    // Path should be empty (no subfolder segments)
    expect(routed[0].routing.path).toBe('');
    expect(routed[1].routing.path).toBe('');
    expect(routed[2].routing.path).toBe('');
    expect(routed[3].routing.path).toBe('');
    expect(routed[4].routing.path).toBe('');

    // Slugs should be preserved
    expect(routed[0].routing.slug).toBe('chene');
    expect(routed[1].routing.slug).toBe('erable');
    expect(routed[2].routing.slug).toBe('rose');
  });

  it('should detect slug collision when flattenTree is true', () => {
    const flattenedConfig: FolderConfig = {
      ...baseFolderConfig,
      flattenTree: true,
    };

    // Two notes with the same filename in different subfolders
    const notes: PublishableNote[] = [
      createNote('Angiospermes/Arbres/Especes-communes.md', flattenedConfig),
      createNote('Gymnospermes/Especes-communes.md', flattenedConfig),
    ];

    expect(() => service.process(notes)).toThrow(/Slug collision detected/);
    expect(() => service.process(notes)).toThrow(/Especes-communes/);
    expect(() => service.process(notes)).toThrow(/Angiospermes\/Arbres\/Especes-communes.md/);
    expect(() => service.process(notes)).toThrow(/Gymnospermes\/Especes-communes.md/);
  });

  it('should not detect collision for different slugs in flattened tree', () => {
    const flattenedConfig: FolderConfig = {
      ...baseFolderConfig,
      flattenTree: true,
    };

    const notes: PublishableNote[] = [
      createNote('Angiospermes/Arbres/Chene.md', flattenedConfig),
      createNote('Angiospermes/Fleurs/Rose.md', flattenedConfig),
      createNote('Gymnospermes/Pin.md', flattenedConfig),
    ];

    expect(() => service.process(notes)).not.toThrow();
  });

  it('should not check collisions when flattenTree is false', () => {
    // With flattenTree=false, notes in different subfolders have different routes
    const notes: PublishableNote[] = [
      createNote('Angiospermes/Especes Communes.md', baseFolderConfig),
      createNote('Gymnospermes/Especes Communes.md', baseFolderConfig),
    ];

    const routed = service.process(notes);

    // Different routes because subfolder segments are preserved
    expect(routed[0].routing.fullPath).toBe('/le-vivant/flore/angiospermes/especes-communes');
    expect(routed[1].routing.fullPath).toBe('/le-vivant/flore/gymnospermes/especes-communes');
    expect(() => service.process(notes)).not.toThrow();
  });

  it('should handle mixed folders (some flattened, some not)', () => {
    const flattenedConfig: FolderConfig = {
      ...baseFolderConfig,
      flattenTree: true,
    };

    const normalConfig: FolderConfig = {
      id: 'folder-2',
      vpsId: 'vps-1',
      vaultFolder: 'Faune',
      routeBase: '/le-vivant/faune',
      ignoredCleanupRuleIds: [],
      flattenTree: false,
    };

    const notes: PublishableNote[] = [
      createNote('Angiospermes/Chene.md', flattenedConfig),
      createNote('Angiospermes/Rose.md', flattenedConfig),
      createNote('Mammiferes/Carnivores/Loup.md', normalConfig),
      createNote('Mammiferes/Herbivores/Cerf.md', normalConfig),
    ];

    const routed = service.process(notes);

    // Flattened folder: no subfolders in route
    expect(routed[0].routing.fullPath).toBe('/le-vivant/flore/chene');
    expect(routed[1].routing.fullPath).toBe('/le-vivant/flore/rose');

    // Normal folder: subfolders preserved
    expect(routed[2].routing.fullPath).toBe('/le-vivant/faune/mammiferes/carnivores/loup');
    expect(routed[3].routing.fullPath).toBe('/le-vivant/faune/mammiferes/herbivores/cerf');
  });

  it('should detect collision only within the same flattened folder', () => {
    const flattenedConfig1: FolderConfig = {
      ...baseFolderConfig,
      id: 'folder-1',
      flattenTree: true,
    };

    const flattenedConfig2: FolderConfig = {
      id: 'folder-2',
      vpsId: 'vps-1',
      vaultFolder: 'Faune',
      routeBase: '/le-vivant/faune',
      ignoredCleanupRuleIds: [],
      flattenTree: true,
    };

    // Same filename in two different flattened folders - should NOT collide
    const notes: PublishableNote[] = [
      createNote('Sub1/Intro.md', flattenedConfig1),
      createNote('Sub2/Intro.md', flattenedConfig2),
    ];

    const routed = service.process(notes);

    // Different routeBases, so no collision
    expect(routed[0].routing.fullPath).toBe('/le-vivant/flore/intro');
    expect(routed[1].routing.fullPath).toBe('/le-vivant/faune/intro');
    expect(() => service.process(notes)).not.toThrow();
  });
});

function createNote(relativePath: string, folderConfig: FolderConfig): PublishableNote {
  return {
    noteId: `note-${relativePath}`,
    title: relativePath.split('/').pop()?.replace('.md', '') ?? relativePath,
    vaultPath: `${folderConfig.vaultFolder}/${relativePath}`,
    relativePath,
    frontmatter: {
      flat: {},
      nested: {},
      tags: [],
    },
    content: `# ${relativePath}`,
    folderConfig,
    publishedAt: new Date(),
    routing: { slug: '', path: '', routeBase: '', fullPath: '' }, // Will be computed
    eligibility: { isPublishable: true },
  };
}
