import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UploadNotesHandler,
  PublishNotesOutput,
} from '../src/application/publishing/handlers/UploadNotesHandler';
import type { Note } from '../src/domain/entities/Note';
import type { ContentStoragePort } from '../src/application/publishing/ports/ContentStoragePort';
import type {
  NotesIndexPort,
  Manifest,
  ManifestPage,
} from '../src/application/publishing/ports/NotesIndexPort';
import type { LoggerPort } from '../src/application/ports/LoggerPort';
import { MarkdownRendererPort } from '../src/application/ports/MarkdownRendererPort';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Test Note',
    markdown: '# Hello',
    route: '/notes/test-note',
    slug: 'test-note',
    vaultPath: 'vault/test-note.md',
    relativePath: 'test-note.md',
    publishedAt: new Date('2024-01-01T00:00:00Z'),
    frontmatter: { tags: [], flat: {}, nested: {} },
    ...overrides,
  };
}

describe('UploadNotesHandler', () => {
  let markdownRenderer: MarkdownRendererPort;
  let contentStorage: ContentStoragePort;
  let notesIndex: NotesIndexPort;
  let logger: LoggerPort;

  beforeEach(() => {
    markdownRenderer = { render: vi.fn(async (md: string) => `<p>${md}</p>`) };
    contentStorage = { save: vi.fn(async () => {}) };
    notesIndex = {
      save: vi.fn(async () => {}),
      rebuildIndex: vi.fn(async () => {}),
    };
    logger = {
      child: vi.fn(() => logger),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  it('publishes notes and updates manifest/index', async () => {
    const note = createNote();
    const handler = new UploadNotesHandler(markdownRenderer, contentStorage, notesIndex, logger);

    const result = await handler.handle([note]);

    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(markdownRenderer.render).toHaveBeenCalledWith(note.markdown);
    expect(contentStorage.save).toHaveBeenCalledWith({
      route: note.route,
      content: expect.stringContaining('<div class="markdown-body">'),
      slug: note.slug,
    });
    expect(notesIndex.save).toHaveBeenCalledWith({
      pages: [expect.objectContaining({ id: note.id })],
    });
    expect(notesIndex.rebuildIndex).toHaveBeenCalled();
  });

  it('handles errors during markdown rendering', async () => {
    (markdownRenderer.render as any).mockRejectedValueOnce(new Error('Render failed'));
    const note = createNote();
    const handler = new UploadNotesHandler(markdownRenderer, contentStorage, notesIndex, logger);

    const result = await handler.handle([note]);

    expect(result.published).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ noteId: note.id, message: 'Render failed' });
    expect(contentStorage.save).not.toHaveBeenCalled();
    expect(notesIndex.save).not.toHaveBeenCalled();
  });

  it('handles errors during content storage', async () => {
    (contentStorage.save as any).mockRejectedValueOnce(new Error('Storage failed'));
    const note = createNote();
    const handler = new UploadNotesHandler(markdownRenderer, contentStorage, notesIndex, logger);

    const result = await handler.handle([note]);

    expect(result.published).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ noteId: note.id, message: 'Storage failed' });
    expect(notesIndex.save).not.toHaveBeenCalled();
  });

  it('publishes multiple notes and sorts manifest pages by publishedAt descending', async () => {
    const note1 = createNote({ id: '1', publishedAt: new Date('2024-01-01T00:00:00Z') });
    const note2 = createNote({ id: '2', publishedAt: new Date('2024-02-01T00:00:00Z') });
    const handler = new UploadNotesHandler(markdownRenderer, contentStorage, notesIndex, logger);

    await handler.handle([note1, note2]);

    const manifestArg = (notesIndex.save as any).mock.calls[0][0] as Manifest;
    expect(manifestArg.pages[0].id).toBe('2');
    expect(manifestArg.pages[1].id).toBe('1');
  });

  it('logs warnings if some notes fail to publish', async () => {
    (contentStorage.save as any).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    const note1 = createNote({ id: '1' });
    const note2 = createNote({ id: '2' });
    const handler = new UploadNotesHandler(markdownRenderer, contentStorage, notesIndex, logger);

    await handler.handle([note1, note2]);

    expect(logger.warn).toHaveBeenCalledWith('Some notes failed to publish', expect.anything());
  });

  it('returns unknown error message for non-Error exceptions', async () => {
    (markdownRenderer.render as any).mockImplementationOnce(() => {
      throw 'not-an-error';
    });
    const note = createNote();
    const handler = new UploadNotesHandler(markdownRenderer, contentStorage, notesIndex, logger);

    const result = await handler.handle([note]);
    expect(result.errors[0].message).toBe('Unknown error');
  });
});
