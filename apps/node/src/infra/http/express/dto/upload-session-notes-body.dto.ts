import { z } from 'zod';

import { PublishableNoteDto, SanitizationRulesDto } from './upload-notes.dto';

export const UploadSessionNotesBodyDto = z.object({
  notes: z.array(PublishableNoteDto).min(1),
  cleanupRules: z.array(SanitizationRulesDto).optional(),
});
