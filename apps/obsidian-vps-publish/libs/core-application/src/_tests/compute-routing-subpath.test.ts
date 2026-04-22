import type { PublishableNote } from '@core-domain/entities/publishable-note';
import { describe, expect, it } from '@jest/globals';

import { ComputeRoutingService } from '../lib/vault-parsing/services/compute-routing.service';

describe('ComputeRoutingService - Subpath Handling', () => {
  const mockLogger = {
    child: () => mockLogger,
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const service = new ComputeRoutingService(mockLogger as any);

  it('should include subpath in href for resolved wikilinks', () => {
    const notes: PublishableNote[] = [
      {
        noteId: 'note-a',
        slug: { value: 'note-a', isValid: true },
        title: 'Note A',
        relativePath: 'note-a.md',
        content: '# Content',
        frontmatter: {},
        assets: [],
        tags: [],
        folderConfig: { routeBase: '' },
        resolvedWikilinks: [
          {
            raw: '[[Note B#Section]]',
            target: 'Note B',
            path: 'Note B',
            subpath: 'Section',
            kind: 'page',
            isResolved: true,
            targetNoteId: 'note-b',
          },
        ],
      } as any,
      {
        noteId: 'note-b',
        slug: { value: 'note-b', isValid: true },
        title: 'Note B',
        relativePath: 'note-b.md',
        content: '# Content',
        frontmatter: {},
        assets: [],
        tags: [],
        folderConfig: { routeBase: '' },
        resolvedWikilinks: [],
      } as any,
    ];

    const result = service.process(notes);

    // Note A should have wikilink with href including subpath
    const noteA = result.find((n) => n.noteId === 'note-a');
    expect(noteA).toBeDefined();
    expect(noteA!.resolvedWikilinks).toHaveLength(1);
    // The href should include the subpath
    expect(noteA!.resolvedWikilinks![0].href).toContain('#Section');
    expect(noteA!.resolvedWikilinks![0].subpath).toBe('Section');
  });

  it('should not include subpath when not present', () => {
    const notes: PublishableNote[] = [
      {
        noteId: 'note-a',
        slug: { value: 'note-a', isValid: true },
        title: 'Note A',
        relativePath: 'note-a.md',
        content: '# Content',
        frontmatter: {},
        assets: [],
        tags: [],
        folderConfig: { routeBase: '' },
        resolvedWikilinks: [
          {
            raw: '[[Note B]]',
            target: 'Note B',
            path: 'Note B',
            kind: 'page',
            isResolved: true,
            targetNoteId: 'note-b',
          },
        ],
      } as any,
      {
        noteId: 'note-b',
        slug: { value: 'note-b', isValid: true },
        title: 'Note B',
        relativePath: 'note-b.md',
        content: '# Content',
        frontmatter: {},
        assets: [],
        tags: [],
        folderConfig: { routeBase: '' },
        resolvedWikilinks: [],
      } as any,
    ];

    const result = service.process(notes);

    const noteA = result.find((n) => n.noteId === 'note-a');
    expect(noteA).toBeDefined();
    expect(noteA!.resolvedWikilinks).toHaveLength(1);
    // The href should NOT include a subpath fragment
    expect(noteA!.resolvedWikilinks![0].href).not.toContain('#');
    expect(noteA!.resolvedWikilinks![0].subpath).toBeUndefined();
  });
});
