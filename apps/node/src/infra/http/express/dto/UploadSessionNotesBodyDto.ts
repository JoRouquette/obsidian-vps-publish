import { z } from 'zod';
import { PublishableNoteDto } from './UploadNotesDto';

export const UploadSessionNotesBodyDto = z.object({
  notes: z.array(PublishableNoteDto).min(1),
});
