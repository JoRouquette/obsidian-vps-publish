import { z } from 'zod';
import { PublishableNoteDto } from './upload-notes.dto';

export const UploadSessionNotesBodyDto = z.object({
  notes: z.array(PublishableNoteDto).min(1),
});
