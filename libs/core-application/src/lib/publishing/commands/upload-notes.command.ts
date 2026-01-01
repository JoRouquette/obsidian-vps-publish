import { type PublishableNote, type SanitizationRules } from '@core-domain';

export interface UploadNotesCommand {
  sessionId: string;
  notes: PublishableNote[];
  cleanupRules?: SanitizationRules[];
  folderDisplayNames?: Record<string, string>;
}

export interface UploadNotesResult {
  sessionId: string;
  published: number;
  errors?: { noteId: string; message: string }[];
}
