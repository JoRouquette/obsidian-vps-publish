import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { filterUnchangedNotes } from '../lib/utils/filter-unchanged-notes.util';

function createNote(params: {
  noteId: string;
  vaultPath: string;
  route: string;
  content: string;
  title?: string;
}): PublishableNote {
  return {
    noteId: params.noteId,
    title: params.title ?? params.noteId,
    vaultPath: params.vaultPath,
    relativePath: params.vaultPath,
    content: params.content,
    frontmatter: {
      flat: {},
      nested: {},
      tags: [],
    },
    folderConfig: {
      id: 'folder-1',
      vaultFolder: 'notes',
      routeBase: '/notes',
      vpsId: 'vps-1',
      ignoredCleanupRuleIds: [],
    },
    routing: {
      slug: params.noteId,
      path: '/notes',
      fullPath: params.route,
      routeBase: '/notes',
    },
    eligibility: {
      isPublishable: true,
    },
    publishedAt: new Date('2026-03-26T00:00:00.000Z'),
    resolvedWikilinks: [],
    assets: [],
  };
}

const hashService = {
  computeHash: jest.fn(async (content: string) => `hash:${content}`),
};

describe('filterUnchangedNotes', () => {
  beforeEach(() => {
    hashService.computeHash.mockClear();
  });

  it('skips unchanged notes in the api-owned path using vaultPath hashes', async () => {
    const notes = [
      createNote({
        noteId: 'a',
        vaultPath: 'notes/a.md',
        route: '/notes/a',
        content: 'same',
      }),
    ];

    const result = await filterUnchangedNotes({
      notes,
      existingSourceNoteHashesByVaultPath: {
        'notes/a.md': 'hash:same',
      },
      pipelineChanged: false,
      apiOwnedDeterministicNoteTransformsEnabled: true,
      hashService,
    });

    expect(result).toEqual({
      notesToUpload: [],
      skippedCount: 1,
      applied: true,
    });
  });

  it('keeps changed notes in the api-owned path', async () => {
    const notes = [
      createNote({
        noteId: 'a',
        vaultPath: 'notes/a.md',
        route: '/notes/a',
        content: 'changed',
      }),
    ];

    const result = await filterUnchangedNotes({
      notes,
      existingSourceNoteHashesByVaultPath: {
        'notes/a.md': 'hash:old',
      },
      pipelineChanged: false,
      apiOwnedDeterministicNoteTransformsEnabled: true,
      hashService,
    });

    expect(result.notesToUpload).toEqual(notes);
    expect(result.skippedCount).toBe(0);
    expect(result.applied).toBe(true);
  });

  it('supports mixed changed and unchanged notes in the api-owned path', async () => {
    const unchanged = createNote({
      noteId: 'unchanged',
      vaultPath: 'notes/unchanged.md',
      route: '/notes/unchanged',
      content: 'same',
    });
    const changed = createNote({
      noteId: 'changed',
      vaultPath: 'notes/changed.md',
      route: '/notes/changed',
      content: 'new',
    });

    const result = await filterUnchangedNotes({
      notes: [unchanged, changed],
      existingSourceNoteHashesByVaultPath: {
        'notes/unchanged.md': 'hash:same',
        'notes/changed.md': 'hash:old',
      },
      pipelineChanged: false,
      apiOwnedDeterministicNoteTransformsEnabled: true,
      hashService,
    });

    expect(result.notesToUpload).toEqual([changed]);
    expect(result.skippedCount).toBe(1);
    expect(result.applied).toBe(true);
  });

  it('treats duplicate-title notes across folders independently by vaultPath', async () => {
    const alpha = createNote({
      noteId: 'same-title-a',
      title: 'Same Title',
      vaultPath: 'alpha/index.md',
      route: '/alpha/same-title',
      content: 'same',
    });
    const beta = createNote({
      noteId: 'same-title-b',
      title: 'Same Title',
      vaultPath: 'beta/index.md',
      route: '/beta/same-title-2',
      content: 'changed',
    });

    const result = await filterUnchangedNotes({
      notes: [alpha, beta],
      existingSourceNoteHashesByVaultPath: {
        'alpha/index.md': 'hash:same',
        'beta/index.md': 'hash:old',
      },
      pipelineChanged: false,
      apiOwnedDeterministicNoteTransformsEnabled: true,
      hashService,
    });

    expect(result.notesToUpload).toEqual([beta]);
    expect(result.skippedCount).toBe(1);
  });

  it('falls back safely when authoritative vaultPath hashes are unavailable', async () => {
    const notes = [
      createNote({
        noteId: 'a',
        vaultPath: 'notes/a.md',
        route: '/notes/a',
        content: 'same',
      }),
    ];

    const result = await filterUnchangedNotes({
      notes,
      existingSourceNoteHashesByVaultPath: {},
      pipelineChanged: false,
      apiOwnedDeterministicNoteTransformsEnabled: true,
      hashService,
    });

    expect(result).toEqual({
      notesToUpload: notes,
      skippedCount: 0,
      applied: false,
    });
    expect(hashService.computeHash).not.toHaveBeenCalled();
  });

  it('keeps legacy route-based skipping unchanged for the default path', async () => {
    const notes = [
      createNote({
        noteId: 'a',
        vaultPath: 'notes/a.md',
        route: '/notes/a',
        content: 'same',
      }),
    ];

    const result = await filterUnchangedNotes({
      notes,
      existingNoteHashes: {
        '/notes/a': 'hash:same',
      },
      pipelineChanged: false,
      apiOwnedDeterministicNoteTransformsEnabled: false,
      hashService,
    });

    expect(result.notesToUpload).toEqual([]);
    expect(result.skippedCount).toBe(1);
    expect(result.applied).toBe(true);
  });
});
