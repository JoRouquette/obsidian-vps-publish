import z from 'zod';

export const FinishSessionBodyDto = z.object({
  notesProcessed: z.number().int().nonnegative(),
  assetsProcessed: z.number().int().nonnegative(),
});
