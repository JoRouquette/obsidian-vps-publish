import z from 'zod';

export const FinishSessionBodyDto = z.object({
  notesProcessed: z.number().int().nonnegative(),
  assetsProcessed: z.number().int().nonnegative(),
  /**
   * All routes collected from vault (PHASE 6.1)
   * Optional for backward compatibility
   */
  allCollectedRoutes: z.array(z.string()).optional(),
});
