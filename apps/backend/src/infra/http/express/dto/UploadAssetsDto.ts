import { z } from 'zod';

export const UploadAssetDto = z.object({
  noteId: z.string().min(1),
  noteRoute: z.string().min(1),
  relativeAssetPath: z.string().min(1),
  fileName: z.string().min(1),
  contentBase64: z.string().min(1),
});

export type UploadAssetsDtoType = z.infer<typeof UploadAssetDto>;
