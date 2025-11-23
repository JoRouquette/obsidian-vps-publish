import z from 'zod/v4/classic/external.cjs';

export const FinishSessionBodyDto = z.object({
  notesProcessed: z.number().int().nonnegative(),
  assetsProcessed: z.number().int().nonnegative(),
});
