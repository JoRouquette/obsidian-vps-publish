import z from 'zod';

export const VpsCleanupBodyDto = z.object({
  targetName: z.string().trim().min(1),
});
