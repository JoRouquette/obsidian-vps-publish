import { z } from 'zod';

import { SanitizationRulesDto, UploadSessionNoteDto } from './upload-notes.dto';

export const UploadSessionNotesBodyDto = z.object({
  notes: z.array(UploadSessionNoteDto).min(1),
  cleanupRules: z.array(SanitizationRulesDto).optional(),
});
