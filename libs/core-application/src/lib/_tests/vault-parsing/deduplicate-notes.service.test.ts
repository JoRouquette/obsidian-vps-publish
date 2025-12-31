import type { FolderConfig, PublishableNote } from '@core-domain';

import { DeduplicateNotesService } from '../../vault-parsing/services/deduplicate-notes.service';

describe('DeduplicateNotesService', () => {
  let service: DeduplicateNotesService;
  let mockLogger: any;

  const baseFolder: FolderConfig = {
    id: 'folder-1',
    vaultFolder: '/vault/blog',
    routeBase: '/blog',
    vpsId: 'vps-1',
    ignoredCleanupRuleIds: [],
  };

  const createNote = (
    id: string,
    slug: string,
    contentLength: number,
    vaultPath: string,
    folderConfig: FolderConfig = baseFolder
  ): PublishableNote => ({
    noteId: id,
    title: slug,
    vaultPath,
    relativePath: `${slug}.md`,
    content: 'x'.repeat(contentLength), // Content of specified length
    frontmatter: {
      tags: [],
      flat: {},
      nested: {},
    },
    routing: {
      slug,
      path: `/${slug}`,
      fullPath: `${folderConfig.routeBase}/${slug}`,
      routeBase: folderConfig.routeBase,
    },
    publishedAt: new Date('2025-01-01'),
    eligibility: {
      isPublishable: true,
    },
    folderConfig,
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };
    service = new DeduplicateNotesService(mockLogger);
  });

  describe('Test 1: Two notes with same name and same size', () => {
    it('should keep only one note (strict duplicate)', () => {
      const notes = [
        createNote('note-1', 'article', 100, '/vault/blog/article.md'),
        createNote('note-2', 'article', 100, '/vault/blog/subfolder/article.md'),
      ];

      const result = service.process(notes);

      expect(result).toHaveLength(1);
      expect(result[0].routing.slug).toBe('article');
      // Should keep the first one alphabetically by vaultPath (deterministic)
      expect(result[0].noteId).toBe('note-1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Removed strict duplicates in folder',
        expect.objectContaining({
          folderId: 'folder-1',
          duplicatesRemoved: 1,
        })
      );
    });
  });

  describe('Test 2: Three notes with same name and all same size', () => {
    it('should keep only one note (all strict duplicates)', () => {
      const notes = [
        createNote('note-1', 'guide', 250, '/vault/blog/guide.md'),
        createNote('note-2', 'guide', 250, '/vault/blog/tutorials/guide.md'),
        createNote('note-3', 'guide', 250, '/vault/blog/archive/guide.md'),
      ];

      const result = service.process(notes);

      expect(result).toHaveLength(1);
      expect(result[0].routing.slug).toBe('guide');
      // First alphabetically by vaultPath
      expect(result[0].vaultPath).toBe('/vault/blog/archive/guide.md');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Removed strict duplicates in folder',
        expect.objectContaining({
          duplicatesRemoved: 2,
        })
      );
    });
  });

  describe('Test 3: Two notes with same name but different sizes', () => {
    it('should keep both notes, renaming the smaller one with suffix (1)', () => {
      const notes = [
        createNote('note-1', 'report', 500, '/vault/blog/report.md'),
        createNote('note-2', 'report', 300, '/vault/blog/draft/report.md'),
      ];

      const result = service.process(notes);

      expect(result).toHaveLength(2);

      // Canonical (largest) keeps original slug
      const canonical = result.find((n) => n.noteId === 'note-1');
      expect(canonical).toBeDefined();
      expect(canonical!.routing.slug).toBe('report');
      expect(canonical!.routing.fullPath).toBe('/blog/report');

      // Smaller gets suffix (1)
      const renamed = result.find((n) => n.noteId === 'note-2');
      expect(renamed).toBeDefined();
      expect(renamed!.routing.slug).toBe('report (1)');
      expect(renamed!.routing.fullPath).toBe('/blog/report (1)');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Notes renamed due to slug collisions with different sizes',
        expect.objectContaining({
          renamedCount: 1,
          details: expect.arrayContaining([
            expect.objectContaining({
              original: 'report',
              new: 'report (1)',
            }),
          ]),
        })
      );
    });
  });

  describe('Test 4: Three notes with same name, different sizes (10, 12, 12)', () => {
    it('should apply deterministic renaming based on size and vaultPath', () => {
      const notes = [
        createNote('note-1', 'document', 10, '/vault/blog/old/document.md'),
        createNote('note-2', 'document', 12, '/vault/blog/document.md'),
        createNote('note-3', 'document', 12, '/vault/blog/new/document.md'),
      ];

      const result = service.process(notes);

      expect(result).toHaveLength(3);

      // Sorting: size desc (12, 12, 10), then vaultPath asc
      // Canonical: note-2 (size=12, vaultPath="/vault/blog/document.md")
      const canonical = result.find((n) => n.noteId === 'note-2');
      expect(canonical).toBeDefined();
      expect(canonical!.routing.slug).toBe('document');

      // note-3 (size=12, vaultPath="/vault/blog/new/document.md") gets (1)
      const renamed1 = result.find((n) => n.noteId === 'note-3');
      expect(renamed1).toBeDefined();
      expect(renamed1!.routing.slug).toBe('document (1)');

      // note-1 (size=10) gets (2)
      const renamed2 = result.find((n) => n.noteId === 'note-1');
      expect(renamed2).toBeDefined();
      expect(renamed2!.routing.slug).toBe('document (2)');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Notes renamed due to slug collisions with different sizes',
        expect.objectContaining({
          renamedCount: 2,
        })
      );
    });
  });

  describe('Test 5: Multiple groups with different names (no collision between groups)', () => {
    it('should process each group independently without cross-interference', () => {
      const notes = [
        createNote('note-1', 'alpha', 100, '/vault/blog/alpha.md'),
        createNote('note-2', 'alpha', 100, '/vault/blog/copy/alpha.md'),
        createNote('note-3', 'beta', 200, '/vault/blog/beta.md'),
        createNote('note-4', 'beta', 150, '/vault/blog/beta-draft.md'),
        createNote('note-5', 'gamma', 300, '/vault/blog/gamma.md'),
      ];

      const result = service.process(notes);

      // alpha: 2 same size → 1 retained (1 duplicate removed)
      const alphas = result.filter((n) => n.routing.slug.startsWith('alpha'));
      expect(alphas).toHaveLength(1);

      // beta: 2 different sizes → 2 retained (1 renamed)
      const betas = result.filter((n) => n.routing.slug.startsWith('beta'));
      expect(betas).toHaveLength(2);
      expect(betas.some((n) => n.routing.slug === 'beta')).toBe(true);
      expect(betas.some((n) => n.routing.slug === 'beta (1)')).toBe(true);

      // gamma: unique → 1 retained
      const gammas = result.filter((n) => n.routing.slug === 'gamma');
      expect(gammas).toHaveLength(1);

      expect(result).toHaveLength(4); // 1 + 2 + 1
    });
  });

  describe('Test 6: Collisions across different folders (independent processing)', () => {
    it('should deduplicate independently per folder', () => {
      const folder2: FolderConfig = {
        id: 'folder-2',
        vaultFolder: '/vault/docs',
        routeBase: '/docs',
        vpsId: 'vps-1',
        ignoredCleanupRuleIds: [],
      };

      const notes = [
        // Folder 1: two "page" with same size
        createNote('note-1', 'page', 100, '/vault/blog/page.md', baseFolder),
        createNote('note-2', 'page', 100, '/vault/blog/archive/page.md', baseFolder),
        // Folder 2: two "page" with different sizes
        createNote('note-3', 'page', 200, '/vault/docs/page.md', folder2),
        createNote('note-4', 'page', 150, '/vault/docs/old/page.md', folder2),
      ];

      const result = service.process(notes);

      // Folder 1: 1 retained (1 duplicate removed)
      const folder1Notes = result.filter((n) => n.folderConfig.id === 'folder-1');
      expect(folder1Notes).toHaveLength(1);
      expect(folder1Notes[0].routing.slug).toBe('page');

      // Folder 2: 2 retained (1 renamed)
      const folder2Notes = result.filter((n) => n.folderConfig.id === 'folder-2');
      expect(folder2Notes).toHaveLength(2);
      expect(folder2Notes.some((n) => n.routing.slug === 'page')).toBe(true);
      expect(folder2Notes.some((n) => n.routing.slug === 'page (1)')).toBe(true);

      expect(result).toHaveLength(3);
    });
  });

  describe('Test 7: Suffix insertion with file extensions', () => {
    it('should insert suffix before extension', () => {
      const notes = [
        createNote('note-1', 'file.md', 100, '/vault/blog/file.md'),
        createNote('note-2', 'file.md', 80, '/vault/blog/copy/file.md'),
        createNote('note-3', 'file.md', 90, '/vault/blog/backup/file.md'),
      ];

      const result = service.process(notes);

      expect(result).toHaveLength(3);

      // Largest keeps original
      const canonical = result.find((n) => n.noteId === 'note-1');
      expect(canonical!.routing.slug).toBe('file.md');

      // Others get suffixes before .md
      const renamed = result.filter((n) => n.noteId !== 'note-1');
      expect(renamed.some((n) => n.routing.slug === 'file (1).md')).toBe(true);
      expect(renamed.some((n) => n.routing.slug === 'file (2).md')).toBe(true);
    });
  });

  describe('Test 8: Empty input', () => {
    it('should return empty array for empty input', () => {
      const result = service.process([]);
      expect(result).toEqual([]);
    });

    it('should return same array for single note', () => {
      const notes = [createNote('note-1', 'single', 100, '/vault/blog/single.md')];
      const result = service.process(notes);
      expect(result).toEqual(notes);
    });
  });

  describe('Test 9: Deterministic behavior', () => {
    it('should produce identical results for repeated calls with same input', () => {
      const notes = [
        createNote('note-1', 'test', 100, '/vault/blog/test.md'),
        createNote('note-2', 'test', 150, '/vault/blog/copy/test.md'),
        createNote('note-3', 'test', 100, '/vault/blog/old/test.md'),
      ];

      const result1 = service.process(notes);
      const result2 = service.process(notes);

      expect(result1).toHaveLength(result2.length);
      expect(result1.map((n) => n.routing.slug)).toEqual(result2.map((n) => n.routing.slug));
      expect(result1.map((n) => n.noteId)).toEqual(result2.map((n) => n.noteId));
    });
  });

  describe('Test 10: Slug path consistency', () => {
    it('should update fullPath and path consistently when renaming', () => {
      const notes = [
        createNote('note-1', 'article', 100, '/vault/blog/article.md'),
        createNote('note-2', 'article', 80, '/vault/blog/draft/article.md'),
      ];

      const result = service.process(notes);

      const renamed = result.find((n) => n.noteId === 'note-2');
      expect(renamed!.routing.slug).toBe('article (1)');
      expect(renamed!.routing.path).toBe('/article (1)');
      expect(renamed!.routing.fullPath).toBe('/blog/article (1)');

      // Verify original note unchanged
      const original = result.find((n) => n.noteId === 'note-1');
      expect(original!.routing.slug).toBe('article');
      expect(original!.routing.path).toBe('/article');
      expect(original!.routing.fullPath).toBe('/blog/article');
    });
  });
});
