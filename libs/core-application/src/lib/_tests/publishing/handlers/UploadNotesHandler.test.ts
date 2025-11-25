import { UploadNotesHandler } from '../../../publishing/handlers/UploadNotesHandler';
import { UploadNotesCommand } from '../../../publishing/commands/UploadNotesCommand';
import { PublishableNote } from '@core-domain';

describe('UploadNotesHandler', () => {
  let markdownRenderer: any;
  let contentStorage: any;
  let manifestStorage: any;
  let logger: any;

  beforeEach(() => {
    markdownRenderer = { render: jest.fn(async (content) => `<p>${content}</p>`) };
    contentStorage = { save: jest.fn(async () => {}) };
    manifestStorage = {
      load: jest.fn(async () => undefined),
      save: jest.fn(async () => {}),
      rebuildIndex: jest.fn(async () => {}),
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
        id: 'note-1',
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
      },
      vpsConfig: {
        id: 'vps-1',
        name: 'Default VPS',
        url: 'https://example.test',
        apiKey: 'dummy',
      },
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

    expect(markdownRenderer.render).toHaveBeenCalledWith(note.content);
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
});
