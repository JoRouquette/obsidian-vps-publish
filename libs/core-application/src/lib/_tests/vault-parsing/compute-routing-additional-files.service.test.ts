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

describe('ComputeRoutingService - Additional Files', () => {
  let service: ComputeRoutingService;
  let baseFolderConfig: FolderConfig;

  beforeEach(() => {
    service = new ComputeRoutingService(mockLogger);
    baseFolderConfig = {
      id: 'folder-1',
      vpsId: 'vps-1',
      vaultFolder: 'Blog',
      routeBase: '/blog',
      ignoredCleanupRuleIds: [],
      flattenTree: false,
      additionalFiles: ['External/Reference.md', 'Templates/BlogPost.md'],
    };
    jest.clearAllMocks();
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

  it('should route additional files to root of routeBase (ignoring actual vault path)', () => {
    // Regular note from Blog/Posts/Article.md
    const regularNote = createNote('Posts/Article.md', baseFolderConfig);

    // Additional file marked by vault adapter (actual path: External/Reference.md)
    const additionalFile1: PublishableNote = {
      ...createNote('__additional__/Reference.md', baseFolderConfig),
      vaultPath: 'External/Reference.md',
    };

    // Another additional file (actual path: Templates/BlogPost.md)
    const additionalFile2: PublishableNote = {
      ...createNote('__additional__/BlogPost.md', baseFolderConfig),
      vaultPath: 'Templates/BlogPost.md',
    };

    const routed = service.process([regularNote, additionalFile1, additionalFile2]);

    // Regular note should preserve subfolder structure
    expect(routed[0].routing.fullPath).toBe('/blog/posts/article');
    expect(routed[0].routing.path).toBe('posts');
    expect(routed[0].routing.slug).toBe('article');

    // Additional file 1 should be at root of /blog (no 'external' segment)
    expect(routed[1].routing.fullPath).toBe('/blog/reference');
    expect(routed[1].routing.path).toBe(''); // No subfolder segments
    expect(routed[1].routing.slug).toBe('reference');

    // Additional file 2 should be at root of /blog (no 'templates' segment)
    expect(routed[2].routing.fullPath).toBe('/blog/blogpost');
    expect(routed[2].routing.path).toBe('');
    expect(routed[2].routing.slug).toBe('blogpost');
  });

  it('should handle additional files with flattenTree enabled', () => {
    const flattenedConfig: FolderConfig = {
      ...baseFolderConfig,
      flattenTree: true,
    };

    // Regular note in subfolder (flattened)
    const regularNote = createNote('Posts/DeepFolder/Article.md', flattenedConfig);

    // Additional file
    const additionalFile: PublishableNote = {
      ...createNote('__additional__/Reference.md', flattenedConfig),
      vaultPath: 'External/Nested/Reference.md',
    };

    const routed = service.process([regularNote, additionalFile]);

    // Both should be at root level due to flattenTree
    expect(routed[0].routing.fullPath).toBe('/blog/article');
    expect(routed[0].routing.path).toBe('');

    expect(routed[1].routing.fullPath).toBe('/blog/reference');
    expect(routed[1].routing.path).toBe('');
  });

  it('should deduplicate additional files that are already in vaultFolder (by vault adapter)', () => {
    // Simulate vault adapter deduplication: if a file is already collected from vaultFolder,
    // it won't be added again as an additional file.
    // This test verifies that routing treats them the same.

    const noteFromFolder = createNote('Article.md', baseFolderConfig);

    // If vault adapter already collected this file, it won't have __additional__ marker
    const routed = service.process([noteFromFolder]);

    expect(routed[0].routing.fullPath).toBe('/blog/article');
    expect(routed[0].routing.path).toBe('');
  });

  it('should handle additional files in different folders independently', () => {
    const folder1: FolderConfig = {
      id: 'folder-1',
      vpsId: 'vps-1',
      vaultFolder: 'Blog',
      routeBase: '/blog',
      ignoredCleanupRuleIds: [],
      additionalFiles: ['Shared/Reference.md'],
    };

    const folder2: FolderConfig = {
      id: 'folder-2',
      vpsId: 'vps-1',
      vaultFolder: 'Docs',
      routeBase: '/docs',
      ignoredCleanupRuleIds: [],
      additionalFiles: ['Shared/Reference.md'], // Same file, different folder
    };

    const additionalFile1: PublishableNote = {
      ...createNote('__additional__/Reference.md', folder1),
      vaultPath: 'Shared/Reference.md',
    };

    const additionalFile2: PublishableNote = {
      ...createNote('__additional__/Reference.md', folder2),
      vaultPath: 'Shared/Reference.md',
    };

    const routed = service.process([additionalFile1, additionalFile2]);

    // Same file published to different routes
    expect(routed[0].routing.fullPath).toBe('/blog/reference');
    expect(routed[1].routing.fullPath).toBe('/docs/reference');
  });

  it('should handle collision detection for additional files in flattened folders', () => {
    const flattenedConfig: FolderConfig = {
      ...baseFolderConfig,
      flattenTree: true,
    };

    // Two additional files with same filename
    const additionalFile1: PublishableNote = {
      ...createNote('__additional__/Reference.md', flattenedConfig),
      vaultPath: 'External/Reference.md',
    };

    const additionalFile2: PublishableNote = {
      ...createNote('__additional__/Reference.md', flattenedConfig),
      vaultPath: 'Shared/Reference.md',
    };

    // Should detect collision (same slug in same folder)
    expect(() => service.process([additionalFile1, additionalFile2])).toThrow(
      /Slug collision detected/
    );
  });
});
