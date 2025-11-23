import { PublishableNote } from '../../../domain/entities/Note';

export interface UploadNotesCommand {
  sessionId: string;
  notes: PublishableNote[];
}

export interface UploadNotesResult {
  sessionId: string;
  published: number;
  errors?: { noteId: string; message: string }[];
}
