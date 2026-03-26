import { type PublishableNote } from '@core-domain';

import { type UploadNotesCommand } from '../../../publishing/commands/upload-notes.command';
import { UploadNotesHandler } from '../../../publishing/handlers/upload-notes.handler';

describe('UploadNotesHandler', () => {
  let markdownRenderer: any;
  let contentStorage: any;
  let manifestStorage: any;
  let logger: any;

  beforeEach(() => {
    markdownRenderer = {
      render: jest.fn(async (note: PublishableNote) => `<p>${note.content}</p>`),
    };
    contentStorage = { save: jest.fn(async () => {}) };
    let storedManifest: any = undefined;
    manifestStorage = {
      load: jest.fn(async () => storedManifest),
      save: jest.fn(async (m: any) => {
        storedManifest = m;
      }),
      rebuildIndex: jest.fn(async () => {}),
      atomicUpdate: jest.fn(async (updater: (current: any) => Promise<any>) => {
        const current = await manifestStorage.load();
        const updated = await updater(current);
        await manifestStorage.save(updated);
      }),
    };
    logger = {
      child: jest.fn(() => logger),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  function createNote(overrides: Partial<PublishableNote> = {}): PublishableNote {
    return {
      noteId: 'note-1',
      title: 'Test Note',
      content: 'Hello world',
      publishedAt: new Date('2023-01-01T00:00:00Z'),
      routing: {
        fullPath: '/notes/test-note',
        path: '/notes/test-note',
        slug: 'test-note',
        routeBase: '/notes',
      },
      vaultPath: 'vault/path',
      relativePath: 'relative/path',
      frontmatter: { tags: ['tag1', 'tag2'], flat: {}, nested: {} },
      assets: [],
      folderConfig: {
        id: 'folder-1',
        vaultFolder: 'notes',
        routeBase: '/notes',
        vpsId: 'vps-1',
        ignoredCleanupRuleIds: [],
      },
      eligibility: { isPublishable: true },
      ...overrides,
    };
  }

  it('publishes notes and updates manifest', async () => {
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const note = createNote();
    const command: UploadNotesCommand = {
      sessionId: 'session-1',
      notes: [note],
    };

    const result = await handler.handle(command);

    expect(markdownRenderer.render).toHaveBeenCalledWith(
      note,
      expect.objectContaining({
        ignoredTags: undefined,
        manifest: expect.objectContaining({
          pages: [expect.objectContaining({ id: note.noteId, route: note.routing.fullPath })],
        }),
      })
    );
    expect(contentStorage.save).toHaveBeenCalledWith({
      route: note.routing.fullPath,
      content: expect.stringContaining('<div class="markdown-body">'),
      slug: note.routing.slug,
    });
    expect(manifestStorage.save).toHaveBeenCalled();
    expect(manifestStorage.rebuildIndex).toHaveBeenCalled();
    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('renders notes against a projected manifest that includes existing and incoming pages', async () => {
    const existingPage = {
      id: 'existing-note',
      title: 'Existing Page',
      route: '/notes/existing-page',
      slug: 'existing-page',
      publishedAt: new Date('2022-01-01T00:00:00Z'),
      vaultPath: 'notes/Existing Page.md',
      relativePath: 'notes/Existing Page.md',
      tags: [],
    };
    manifestStorage.load.mockResolvedValueOnce({
      sessionId: 'session-1',
      createdAt: new Date('2022-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2022-01-01T00:00:00Z'),
      pages: [existingPage],
    });

    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const noteA = createNote({
      noteId: 'note-a',
      title: 'Note A',
      routing: {
        fullPath: '/notes/note-a',
        path: '/notes/note-a',
        slug: 'note-a',
        routeBase: '/notes',
      },
    });
    const noteB = createNote({
      noteId: 'note-b',
      title: 'Note B',
      routing: {
        fullPath: '/notes/note-b',
        path: '/notes/note-b',
        slug: 'note-b',
        routeBase: '/notes',
      },
    });

    await handler.handle({
      sessionId: 'session-1',
      notes: [noteA, noteB],
    });

    expect(markdownRenderer.render).toHaveBeenCalledWith(
      noteA,
      expect.objectContaining({
        manifest: expect.objectContaining({
          pages: expect.arrayContaining([
            expect.objectContaining({ id: 'existing-note', route: '/notes/existing-page' }),
            expect.objectContaining({ id: 'note-a', route: '/notes/note-a' }),
            expect.objectContaining({ id: 'note-b', route: '/notes/note-b' }),
          ]),
        }),
      })
    );
  });

  it('handles markdown rendering errors gracefully', async () => {
    markdownRenderer.render.mockRejectedValueOnce(new Error('Render failed'));
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const note = createNote();
    const command: UploadNotesCommand = {
      sessionId: 'session-2',
      notes: [note],
    };

    const result = await handler.handle(command);

    expect(result.published).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors && result.errors[0].noteId).toBe(note.noteId);
    expect(result.errors && result.errors[0].message).toBe('Render failed');
    expect(contentStorage.save).not.toHaveBeenCalled();
    expect(manifestStorage.save).not.toHaveBeenCalled();
  });

  it('merges manifest pages by note id, latest wins', async () => {
    const oldNote = createNote({
      noteId: 'note-1',
      publishedAt: new Date('2022-01-01T00:00:00Z'),
      title: 'Old Title',
    });
    const newNote = createNote({
      noteId: 'note-1',
      publishedAt: new Date('2023-01-01T00:00:00Z'),
      title: 'New Title',
    });
    manifestStorage.load.mockResolvedValueOnce({
      sessionId: 'session-3',
      createdAt: new Date('2022-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2022-01-01T00:00:00Z'),
      pages: [
        {
          id: oldNote.noteId,
          title: oldNote.title,
          route: oldNote.routing.fullPath,
          slug: oldNote.routing.slug,
          publishedAt: oldNote.publishedAt,
          vaultPath: oldNote.vaultPath,
          relativePath: oldNote.relativePath,
          tags: oldNote.frontmatter.tags,
        },
      ],
    });
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const command: UploadNotesCommand = {
      sessionId: 'session-3',
      notes: [newNote],
    };

    await handler.handle(command);

    const manifestArg = manifestStorage.save.mock.calls[0][0];
    expect(manifestArg.pages).toHaveLength(1);
    expect(manifestArg.pages[0].title).toBe('New Title');
    expect(manifestArg.pages[0].publishedAt.getTime()).toBe(newNote.publishedAt.getTime());
  });

  it('starts a new manifest if sessionId changes', async () => {
    manifestStorage.load.mockResolvedValueOnce({
      sessionId: 'old-session',
      createdAt: new Date('2022-01-01T00:00:00Z'),
      lastUpdatedAt: new Date('2022-01-01T00:00:00Z'),
      pages: [
        {
          id: 'note-1',
          title: 'Old Note',
          route: '/old',
          slug: 'old',
          publishedAt: new Date('2022-01-01T00:00:00Z'),
          vaultPath: 'vault/old',
          relativePath: 'relative/old',
          tags: [],
        },
      ],
    });
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const note = createNote();
    const command: UploadNotesCommand = {
      sessionId: 'new-session',
      notes: [note],
    };

    await handler.handle(command);

    const manifestArg = manifestStorage.save.mock.calls[0][0];
    expect(manifestArg.sessionId).toBe('new-session');
    expect(manifestArg.pages).toHaveLength(1);
    expect(manifestArg.pages[0].id).toBe(note.noteId);
  });

  it('logs warnings if some notes fail to publish', async () => {
    markdownRenderer.render.mockImplementationOnce(() => {
      throw new Error('fail');
    });
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const note = createNote();
    const command: UploadNotesCommand = {
      sessionId: 'session-4',
      notes: [note],
    };

    await handler.handle(command);

    expect(logger.warn).toHaveBeenCalledWith('Some notes failed to publish', expect.anything());
  });

  it('returns correct result when no notes are provided', async () => {
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const command: UploadNotesCommand = {
      sessionId: 'session-5',
      notes: [],
    };

    const result = await handler.handle(command);

    expect(result.published).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(manifestStorage.save).not.toHaveBeenCalled();
  });

  it('persists raw notes when a storage adapter is provided', async () => {
    const notesStorage = {
      append: jest.fn(async () => {}),
      saveCleanupRules: jest.fn(async () => {}),
    };
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger,
      notesStorage as any
    );
    const note = createNote();
    await handler.handle({ sessionId: 's-raw', notes: [note] });

    expect(notesStorage.append).toHaveBeenCalledWith('s-raw', [note]);
  });

  it('skips upload-time rendering and index rebuild when finalization will rebuild later', async () => {
    const notesStorage = {
      append: jest.fn(async () => {}),
      saveCleanupRules: jest.fn(async () => {}),
    };
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger,
      notesStorage as any
    );
    const note = createNote();

    await handler.handle({ sessionId: 's-no-index-rebuild', notes: [note] });

    expect(markdownRenderer.render).not.toHaveBeenCalled();
    expect(contentStorage.save).not.toHaveBeenCalled();
    expect(manifestStorage.save).toHaveBeenCalled();
    expect(manifestStorage.rebuildIndex).not.toHaveBeenCalled();
  });

  it('defers manifest page materialization until backend finalization', async () => {
    const notesStorage = {
      append: jest.fn(async () => {}),
      saveCleanupRules: jest.fn(async () => {}),
    };
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger,
      notesStorage as any
    );
    const note = createNote({
      folderConfig: {
        ...createNote().folderConfig,
        displayName: 'Notes',
      },
      routing: {
        fullPath: 'Vault/Test Note.md',
        path: '',
        slug: '',
        routeBase: '/notes',
      },
    });

    await handler.handle({
      sessionId: 's-finalization',
      notes: [note],
    });

    expect(markdownRenderer.render).not.toHaveBeenCalled();
    expect(contentStorage.save).not.toHaveBeenCalled();
    expect(manifestStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 's-finalization',
        pages: [],
        folderDisplayNames: expect.objectContaining({
          '/notes': note.folderConfig.displayName,
        }),
      })
    );
  });

  it('hydrates lean source-package notes for the canonical upload path', async () => {
    const notesStorage = {
      append: jest.fn(async () => {}),
      saveCleanupRules: jest.fn(async () => {}),
    };
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger,
      notesStorage as any
    );
    const note = createNote();
    const { routing: _routing, resolvedWikilinks: _resolvedWikilinks, ...leanNote } = note as any;

    await handler.handle({
      sessionId: 's-lean',
      notes: [leanNote],
    });

    expect(notesStorage.append).toHaveBeenCalledWith(
      's-lean',
      expect.arrayContaining([
        expect.objectContaining({
          noteId: note.noteId,
          routing: {
            slug: '',
            path: '',
            fullPath: note.vaultPath,
            routeBase: note.folderConfig.routeBase,
          },
        }),
      ])
    );
  });

  it('renders unresolved frontmatter wikilinks with the shared unavailable state markup', async () => {
    const handler = new UploadNotesHandler(
      markdownRenderer,
      contentStorage,
      manifestStorage,
      logger
    );
    const note = createNote({
      frontmatter: {
        tags: [],
        flat: {},
        nested: { related: '[[Existing Page]]' },
      },
      resolvedWikilinks: [
        {
          raw: '[[Existing Page]]',
          target: 'Existing Page',
          path: 'Existing Page',
          kind: 'note',
          isResolved: false,
          origin: 'frontmatter',
          frontmatterPath: 'related',
        },
      ],
    });

    await handler.handle({ sessionId: 'frontmatter-state', notes: [note] });

    expect(contentStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(
          'class="fm-value fm-wikilink-unresolved wikilink wikilink-unresolved"'
        ),
      })
    );
    expect(contentStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('data-wikilink="Existing Page"'),
      })
    );
    expect(contentStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Cette page sera bientot disponible'),
      })
    );
  });
});
