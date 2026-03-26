import { type PublishableNote, type SanitizationRules, type SourcePackageNote } from '@core-domain';

export type UploadSessionNote = PublishableNote | SourcePackageNote;

export interface UploadNotesCommand {
  sessionId: string;
  notes: UploadSessionNote[];
  cleanupRules?: SanitizationRules[];
  folderDisplayNames?: Record<string, string>;
  apiOwnedDeterministicNoteTransformsEnabled?: boolean;
}

export interface UploadNotesResult {
  sessionId: string;
  published: number;
  errors?: { noteId: string; message: string }[];
}
