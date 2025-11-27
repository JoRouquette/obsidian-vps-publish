import { PublishableNote } from '@core-domain';
import {
  UploadNotesCommand,
  UploadNotesResult,
} from '../../../publishing/commands/upload-notes.command';

describe('UploadNotesCommand', () => {
  const sampleNote: PublishableNote = {
    noteId: 'note-1',
    title: 'Sample Note',
    content: 'This is a test note.',
    publishedAt: new Date(),
    routing: {
      fullPath: '/notes/sample-note',
      path: '/notes/sample-note',
      slug: 'sample-note',
      routeBase: '/notes',
    },
    vaultPath: 'vault/notes/sample-note.md',
    relativePath: 'notes/sample-note.md',
    frontmatter: { tags: ['tag1'], flat: {}, nested: {} },
    folderConfig: { id: 'folder-1', vaultFolder: 'notes', routeBase: '/notes', vpsId: 'vps-1' },
    eligibility: { isPublishable: true },
  };

  it('should create a valid UploadNotesCommand object', () => {
    const command: UploadNotesCommand = {
      sessionId: 'session-123',
      notes: [sampleNote],
    };
    expect(command.sessionId).toBe('session-123');
    expect(command.notes).toHaveLength(1);
    expect(command.notes[0]).toEqual(sampleNote);
  });
});

describe('UploadNotesResult', () => {
  it('should represent a successful upload with no errors', () => {
    const result: UploadNotesResult = {
      sessionId: 'session-123',
      published: 2,
    };
    expect(result.sessionId).toBe('session-123');
    expect(result.published).toBe(2);
    expect(result.errors).toBeUndefined();
  });

  it('should represent a partial upload with errors', () => {
    const result: UploadNotesResult = {
      sessionId: 'session-456',
      published: 1,
      errors: [
        { noteId: 'note-2', message: 'Validation failed' },
        { noteId: 'note-3', message: 'Network error' },
      ],
    };
    expect(result.sessionId).toBe('session-456');
    expect(result.published).toBe(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors?.[0].noteId).toBe('note-2');
    expect(result.errors?.[1].message).toBe('Network error');
  });

  it('should allow an empty errors array', () => {
    const result: UploadNotesResult = {
      sessionId: 'session-789',
      published: 0,
      errors: [],
    };
    expect(result.errors).toEqual([]);
  });
});
