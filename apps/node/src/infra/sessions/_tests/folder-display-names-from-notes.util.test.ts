import type { PublishableNote } from '@core-domain';

import { buildFolderDisplayNamesFromPublishedNotes } from '../folder-display-names-from-notes.util';

function createNote(overrides: Partial<PublishableNote>): PublishableNote {
  return {
    noteId: overrides.noteId ?? 'note-1',
    title: overrides.title ?? 'Note',
    vaultPath: overrides.vaultPath ?? 'Vault/Chroniques d_Ete/Page Note.md',
    relativePath: overrides.relativePath ?? 'Chroniques d_Ete/Page Note.md',
    content: overrides.content ?? '# Note',
    frontmatter: overrides.frontmatter ?? { flat: {}, nested: {}, tags: [] },
    folderConfig: overrides.folderConfig ?? {
      id: 'folder-1',
      vpsId: 'vps-1',
      vaultFolder: 'Vault/Trésors',
      routeBase: '/tresors',
      ignoredCleanupRuleIds: [],
    },
    routing: overrides.routing ?? {
      slug: 'page-note',
      path: 'chroniques-d-ete',
      routeBase: '/tresors',
      fullPath: '/tresors/chroniques-d-ete/page-note',
    },
    publishedAt: overrides.publishedAt ?? new Date('2026-03-26T12:00:00Z'),
    eligibility: overrides.eligibility ?? { isPublishable: true },
  };
}

describe('buildFolderDisplayNamesFromPublishedNotes', () => {
  it('derives visible folder labels from vault spelling without changing technical routes', () => {
    const notes = [
      createNote({
        noteId: 'note-a',
        relativePath: 'Chroniques d_Ete/Page Note.md',
        routing: {
          slug: 'page-note',
          path: 'chroniques-d-ete',
          routeBase: '/tresors',
          fullPath: '/tresors/chroniques-d-ete/page-note',
        },
      }),
      createNote({
        noteId: 'note-b',
        relativePath: 'Chroniques d_Ete/Arc Áncestral/Histoire.md',
        routing: {
          slug: 'histoire',
          path: 'chroniques-d-ete/arc-ancestral',
          routeBase: '/tresors',
          fullPath: '/tresors/chroniques-d-ete/arc-ancestral/histoire',
        },
      }),
    ];

    const displayNames = buildFolderDisplayNamesFromPublishedNotes(notes);

    expect(notes[1].routing.fullPath).toBe('/tresors/chroniques-d-ete/arc-ancestral/histoire');
    expect(displayNames).toEqual({
      '/tresors': 'Trésors',
      '/tresors/chroniques-d-ete': 'Chroniques d_Ete',
      '/tresors/chroniques-d-ete/arc-ancestral': 'Arc Áncestral',
    });
  });

  it('keeps explicit display names and skips flattened subfolders', () => {
    const notes = [
      createNote({
        folderConfig: {
          id: 'folder-1',
          vpsId: 'vps-1',
          vaultFolder: 'Vault/Règles du Jeu',
          routeBase: '/regles',
          displayName: 'Règles du Jeu',
          flattenTree: true,
          ignoredCleanupRuleIds: [],
        },
        relativePath: 'Bestiaire/Créatures/Dragon Rouge.md',
        routing: {
          slug: 'dragon-rouge',
          path: '',
          routeBase: '/regles',
          fullPath: '/regles/dragon-rouge',
        },
      }),
    ];

    const displayNames = buildFolderDisplayNamesFromPublishedNotes(notes, {
      '/regles': 'Règles configurées',
    });

    expect(displayNames).toEqual({
      '/regles': 'Règles configurées',
    });
  });
});
