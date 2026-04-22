import type { NoteCore } from './note-core';

export interface CollectedNote extends NoteCore {
  noteId: string;
  vaultPath: string;
  relativePath: string;
  content: string;
}
