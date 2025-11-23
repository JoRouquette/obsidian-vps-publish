import z from 'zod';

export const CreateSessionBodyDto = z.object({
  notesPlanned: z.number().int().nonnegative(),
  assetsPlanned: z.number().int().nonnegative(),
  batchConfig: z.object({
    maxBytesPerRequest: z.number().int().positive(),
  }),
});
