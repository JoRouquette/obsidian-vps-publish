import type { PublishableNote } from '@core-domain/entities/publishable-note';

import { DetectWikilinksService } from '../../vault-parsing/services/detect-wikilinks.service';
import { ResolveWikilinksService } from '../../vault-parsing/services/resolve-wikilinks.service';
import { NoopLogger } from '../helpers/fake-logger';

describe('ResolveWikilinksService', () => {
  const logger = new NoopLogger();
  const detect = new DetectWikilinksService(logger);
  const service = new ResolveWikilinksService(logger, detect);

  const baseNote = {
    noteId: '1',
    title: 'A',
    vaultPath: 'Vault/A.md',
    relativePath: 'A.md',
    content: 'Link to [[B.md]]',
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

  const targetNote = {
    ...baseNote,
    noteId: '2',
    title: 'B',
    content: 'Content',
    relativePath: 'B.md',
    vaultPath: 'Vault/B.md',
  };

  it('marks wikilinks as resolved when target exists', () => {
    const [note] = service.process([baseNote, targetNote]);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('2');
    expect(note.resolvedWikilinks?.[0].origin).toBe('content');
  });

  it('marks wikilinks as unresolved when target missing', () => {
    const [note] = service.process([baseNote]);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(false);
  });

  it('marks wikilinks as unresolved when target exists but has no routing (not published)', () => {
    const unpublishedTarget = {
      ...targetNote,
    };
    // Remove routing to simulate unpublished note
    delete (unpublishedTarget as any).routing;

    const [note] = service.process([baseNote, unpublishedTarget as any]);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(false);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('2'); // Note ID is still captured
  });

  it('resolves wikilinks without extension against matching note files', () => {
    const noteWithoutExt = {
      ...baseNote,
      content: 'See [[B]]',
    };

    const [note] = service.process([noteWithoutExt, targetNote]);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('2');
  });

  it('preserves alias text while resolving the canonical target', () => {
    const noteWithAlias = {
      ...baseNote,
      content: 'See [[B|Alias for B]]',
    };

    const [note] = service.process([noteWithAlias, targetNote]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('2');
    expect(note.resolvedWikilinks?.[0].alias).toBe('Alias for B');
  });

  it('resolves nested-path wikilinks deterministically', () => {
    const nestedTarget = {
      ...targetNote,
      noteId: 'nested-target',
      title: 'Page',
      relativePath: 'Folder/Page.md',
      vaultPath: 'Vault/Folder/Page.md',
    };
    const noteWithNestedPath = {
      ...baseNote,
      content: 'See [[Folder/Page]]',
    };

    const [note] = service.process([noteWithNestedPath, nestedTarget]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('nested-target');
  });

  it('preserves note fragments for resolved wikilinks', () => {
    const routedTarget = {
      ...targetNote,
      routing: {
        slug: 'b',
        path: '/blog/b',
        routeBase: '/blog',
        fullPath: '/blog/b',
      },
    };
    const noteWithFragment = {
      ...baseNote,
      content: 'See [[B#Section Title]]',
    };

    const [note] = service.process([noteWithFragment, routedTarget]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].href).toBe('/blog/b#Section Title');
  });

  it('preserves alias and fragment together', () => {
    const noteWithAliasAndFragment = {
      ...baseNote,
      content: 'See [[B#Section Title|Alias Section]]',
    };

    const [note] = service.process([noteWithAliasAndFragment, targetNote]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].alias).toBe('Alias Section');
    expect(note.resolvedWikilinks?.[0].subpath).toBe('Section Title');
  });

  it('resolves relative markdown links against the current note folder', () => {
    const parentTarget = {
      ...targetNote,
      noteId: 'parent-target',
      title: 'Shared',
      relativePath: 'Shared.md',
      vaultPath: 'Vault/Shared.md',
      routing: {
        slug: 'shared',
        path: '/blog/shared',
        routeBase: '/blog',
        fullPath: '/blog/shared',
      },
    };
    const noteWithRelativeMarkdownLink = {
      ...baseNote,
      relativePath: 'Folder/Current.md',
      vaultPath: 'Vault/Folder/Current.md',
      content: 'See [Shared reference](../Shared.md)',
    };

    const [note] = service.process([noteWithRelativeMarkdownLink, parentTarget]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('parent-target');
    expect(note.resolvedWikilinks?.[0].alias).toBe('Shared reference');
    expect(note.resolvedWikilinks?.[0].href).toBe('/blog/shared');
  });

  it('matches wikilinks using slug/diacritics-insensitive comparison', () => {
    const accentTarget = {
      ...targetNote,
      noteId: 'tenebra-id',
      title: 'Ténébra',
      relativePath: 'Divinites/Tenebra.md',
      routing: {
        slug: 'tenebra',
        path: '/blog/divinites/tenebra',
        routeBase: '/blog',
        fullPath: '/blog/divinites/tenebra',
      },
    };
    const noteWithAccent = {
      ...baseNote,
      content: 'Vers [[Ténébra]]',
    };

    const [note] = service.process([noteWithAccent, accentTarget]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('tenebra-id');
    expect(note.resolvedWikilinks?.[0].path).toContain('divinites');
  });

  it('prefers a same-folder note when basename duplicates exist elsewhere', () => {
    const sameFolderTarget = {
      ...targetNote,
      noteId: 'same-folder-target',
      title: 'Page',
      relativePath: 'Folder/Page.md',
      vaultPath: 'Vault/Folder/Page.md',
    };
    const otherFolderTarget = {
      ...targetNote,
      noteId: 'other-folder-target',
      title: 'Page',
      relativePath: 'Elsewhere/Page.md',
      vaultPath: 'Vault/Elsewhere/Page.md',
    };
    const currentNote = {
      ...baseNote,
      noteId: 'current-folder-note',
      relativePath: 'Folder/Source.md',
      vaultPath: 'Vault/Folder/Source.md',
      content: 'See [[Page]]',
    };

    const [note] = service.process([currentNote, sameFolderTarget, otherFolderTarget]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe('same-folder-target');
  });

  it('leaves ambiguous basename-only wikilinks unresolved instead of choosing silently', () => {
    const targetA = {
      ...targetNote,
      noteId: 'duplicate-a',
      title: 'Shared',
      relativePath: 'FolderA/Shared.md',
      vaultPath: 'Vault/FolderA/Shared.md',
    };
    const targetB = {
      ...targetNote,
      noteId: 'duplicate-b',
      title: 'Shared',
      relativePath: 'FolderB/Shared.md',
      vaultPath: 'Vault/FolderB/Shared.md',
    };
    const noteWithAmbiguousLink = {
      ...baseNote,
      content: 'See [[Shared]]',
    };

    const [note] = service.process([noteWithAmbiguousLink, targetA, targetB]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(false);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBeUndefined();
  });

  it('detects frontmatter wikilinks and keeps their origin', () => {
    const withFrontmatter: PublishableNote = {
      ...baseNote,
      content: 'nothing to see here',
      frontmatter: { flat: {}, nested: { related: '[[B.md]]' }, tags: [] },
    };

    const [note] = service.process([withFrontmatter, targetNote]);
    expect(note.resolvedWikilinks?.[0].origin).toBe('frontmatter');
    expect(note.resolvedWikilinks?.[0].frontmatterPath).toBe('related');
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
  });

  it('resolves same-page fragment-only caret links to the current note', () => {
    const noteWithCaretLink: PublishableNote = {
      ...baseNote,
      content: 'Jump to [[#^37066d]]',
      routing: {
        slug: 'a',
        path: '/blog/a',
        routeBase: '/blog',
        fullPath: '/blog/a',
      },
    };

    const [note] = service.process([noteWithCaretLink, targetNote]);

    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].targetNoteId).toBe(noteWithCaretLink.noteId);
    expect(note.resolvedWikilinks?.[0].href).toBe('#^37066d');
  });

  it('detects note embeds and resolves them like canonical internal targets', () => {
    const routedTarget = {
      ...targetNote,
      routing: {
        slug: 'b',
        path: '/blog/b',
        routeBase: '/blog',
        fullPath: '/blog/b',
      },
    };
    const noteWithEmbed = {
      ...baseNote,
      content: '![[B#Section Title]]',
    };

    const [note] = service.process([noteWithEmbed, routedTarget]);

    expect(note.resolvedWikilinks?.[0].embed).toBe(true);
    expect(note.resolvedWikilinks?.[0].isResolved).toBe(true);
    expect(note.resolvedWikilinks?.[0].href).toBe('/blog/b#Section Title');
  });
});
