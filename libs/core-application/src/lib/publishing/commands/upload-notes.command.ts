import { type PublishableNote, type SanitizationRules } from '@core-domain';

export interface UploadNotesCommand {
  sessionId: string;
  notes: PublishableNote[];
  cleanupRules?: SanitizationRules[];
}

export interface UploadNotesResult {
  sessionId: string;
  published: number;
  errors?: { noteId: string; message: string }[];
}
