import z from 'zod/v4/classic/external.cjs';
import { PublishableNoteDto } from './UploadNotesDto';

export const UploadSessionNotesBodyDto = z.object({
  notes: z.array(PublishableNoteDto).min(1),
});
